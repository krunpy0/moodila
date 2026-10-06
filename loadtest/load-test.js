/*
 * ==============================================================================================
 *  MOODILA LOAD TESTING & BREAKPOINT CAPACITY SUITE (k6)
 *  Target Architecture: Go API + PostgreSQL (1 vCPU / 1 GB RAM Target Server)
 * ==============================================================================================
 *
 *  КАК ПРАВИЛЬНО ЗАПУСКАТЬ НАГРУЗОЧНЫЙ ТЕСТ:
 *  ----------------------------------------------------------------------------------------------
 *  ВАЖНО: Запускайте k6 ТОЛЬКО С ОТДЕЛЬНОЙ НАГРУЗОЧНОЙ МАШИНЫ (не с того же сервера, где крутится
 *  тестируемый Go API и PostgreSQL!).
 *  Почему: генератор k6 на высоких RPS (100-300 req/s) активно утилизирует CPU (до 50-100% ядра)
 *  и RAM (VUs, таймеры arrival-rate), что создаст ложное замедление и исказит p95/p99 задержки,
 *  если запускать на том же 1 vCPU / 1 GB сервере.
 *
 *  1. ЗАПУСК k6 С ОТДЕЛЬНОЙ МАШИНЫ:
 *     - Если k6 установлен локально:
 *       k6 run loadtest/load-test.js \
 *         -e BASE_URL=http://<IP_ИЛИ_ДОМЕН_СЕРВЕРА>:8080 \
 *         -e STEPS=10,25,50,100,150,200,300 \
 *         -e STEP_DURATION=120s \
 *         -e USERS=200 \
 *         -e PRE_VUS=150 \
 *         -e MAX_VUS=1200
 *
 *     - Через официальный Docker-образ (на отдельной машине):
 *       docker run --rm -i \
 *         -v "$PWD/loadtest:/scripts" \
 *         grafana/k6 run /scripts/load-test.js \
 *         -e BASE_URL=http://<IP_ИЛИ_ДОМЕН_СЕРВЕРА>:8080 \
 *         -e STEPS=10,25,50,100,150,200,300 \
 *         -e STEP_DURATION=120s
 *
 *  2. КОМАНДЫ ДЛЯ МОНИТОРИНГА НА САМОМ СЕРВЕРЕ (ПАРАЛЛЕЛЬНО С ТЕСТОМ):
 *     А. Мониторинг утилизации ресурсов Docker-контейнеров:
 *        docker stats moodila-api-loadtest moodila-postgres-loadtest
 *        (следите за % CPU, объемом памяти и Mem %, а также за сетевым I/O)
 *
 *     Б. Системный мониторинг хоста:
 *        htop
 *        (обратите внимание на % steal time (st) в облаке, load average и swap)
 *
 *     В. Анализ узких мест в базе данных PostgreSQL (pg_stat_statements):
 *        -- Шаг 1: Сбросить накопленную статистику ПЕРЕД тестом:
 *        SELECT pg_stat_statements_reset();
 *
 *        -- Шаг 2: Выполнить во время или сразу после теста (топ-10 тяжелых запросов по времени CPU):
 *        SELECT 
 *            substring(query, 1, 75) AS query_snippet,
 *            calls,
 *            round(total_exec_time::numeric, 1) AS total_ms,
 *            round(mean_exec_time::numeric, 2) AS mean_ms,
 *            round(max_exec_time::numeric, 2) AS max_ms,
 *            round((100 * total_exec_time / nullif(sum(total_exec_time) OVER (), 0))::numeric, 1) AS pct_cpu
 *        FROM pg_stat_statements
 *        WHERE query NOT LIKE '%pg_stat_statements%'
 *        ORDER BY total_exec_time DESC
 *        LIMIT 10;
 *
 *        -- Шаг 3: Проверка размера очереди и пула соединений:
 *        SELECT count(*), state FROM pg_stat_activity WHERE datname = 'moodila' GROUP BY state;
 * ==============================================================================================
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

// Помечаем 200 и 201 как ожидаемые статусы, чтобы UPSERT (ON CONFLICT DO UPDATE)
// и создание записей не помечались ошибочными при повторных датах
http.setResponseCallback(http.expectedStatuses(200, 201));

// ----------------------------------------------------------------------------------------------
// Метрики операций (Trends)
// ----------------------------------------------------------------------------------------------
const feedTrend = new Trend('feed_duration', true);
const calendarTrend = new Trend('calendar_duration', true);
const profileTrend = new Trend('profile_duration', true);
const writeTrend = new Trend('write_duration', true);
const loginTrend = new Trend('login_duration', true);
const setupTrend = new Trend('setup_duration', true);
const warmupTrend = new Trend('warmup_duration', true);

// Счетчики выполненных запросов по каждой операции (для проверки баланса запросов)
const feedReqs = new Counter('op_feed_reqs');
const calendarReqs = new Counter('op_calendar_reqs');
const profileReqs = new Counter('op_profile_reqs');
const writeReqs = new Counter('op_write_reqs');
const loginReqs = new Counter('op_login_reqs');
const setupReqs = new Counter('op_setup_reqs');
const warmupReqs = new Counter('op_warmup_reqs');

// Связка ошибок op + status и системные счетчики
const opStatusErrors = new Counter('op_status_errors');
const rateLimitHits = new Counter('rate_limit_hits');
const successRate = new Rate('success_rate');

// ----------------------------------------------------------------------------------------------
// Конфигурация сценария из переменных окружения
// ----------------------------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || __ENV.TARGET_URL || 'http://localhost:8080';
const SCENARIO_TYPE = __ENV.SCENARIO || 'ramp'; // 'ramp', 'smoke', 'login', 'login-only'
const LOGIN_SHARE = parseFloat(__ENV.LOGIN_SHARE || '0.02'); // Доля логина в основном потоке (по умолчанию 2%)

const STEPS_STR = __ENV.STEPS || (SCENARIO_TYPE === 'login' || SCENARIO_TYPE === 'login-only' ? '1,2,5,8,12,16,20,25' : '10,25,50,100,150,200,300');
const STEP_RATES = STEPS_STR.split(',')
  .map((s) => parseInt(s.trim(), 10))
  .filter((n) => !isNaN(n) && n > 0);

// Длительность ступени (по умолчанию 2 минуты = 120s, итого 14+ минут для 7 ступеней)
const STEP_DURATION_SEC = parseInt(__ENV.STEP_DURATION || '120', 10);
const PRE_VUS_CONFIG = parseInt(__ENV.PRE_VUS || '150', 10);
const MAX_VUS_CONFIG = parseInt(__ENV.MAX_VUS || '1200', 10);

// Пул пользователей для setup() (по умолчанию 1500) и общее число в БД
const USERS_POOL_COUNT = parseInt(__ENV.USERS || '1500', 10);
const TOTAL_SEEDED_USERS = parseInt(__ENV.TOTAL_SEEDED_USERS || '20000', 10);

// Среднее число HTTP-запросов на 1 k6-итерацию:
// LOGIN_SHARE логин (1 req) + 30% открытие приложения (3 reqs) + (1 - LOGIN_SHARE - 0.3) одиночные (1 req)
const REQS_PER_ITERATION = (SCENARIO_TYPE === 'login' || SCENARIO_TYPE === 'login-only') ? 1.0 : (1.0 + 0.60);

// ----------------------------------------------------------------------------------------------
// Генерация сценариев k6 (Ramping Arrival Rate по ступеням)
// ----------------------------------------------------------------------------------------------
function buildScenarios() {
  if (SCENARIO_TYPE === 'smoke') {
    return {
      smoke_test: {
        executor: 'constant-arrival-rate',
        rate: 5,
        timeUnit: '1s',
        duration: '15s',
        preAllocatedVUs: 5,
        maxVUs: 20,
        tags: { step_rps: '5', scenario_name: 'smoke_test' },
      },
    };
  }

  // Отдельный сценарий 'login-only' для замера чистой пропускной способности bcrypt
  if (SCENARIO_TYPE === 'login' || SCENARIO_TYPE === 'login-only') {
    const scenarios = {};
    let currentOffsetSec = 0;

    for (let i = 0; i < STEP_RATES.length; i++) {
      const targetRps = STEP_RATES[i];
      const name = `login_step_${targetRps}_rps`;
      const preVUs = Math.max(5, targetRps * 2);
      const maxVUs = Math.max(30, targetRps * 8);

      scenarios[name] = {
        executor: 'ramping-arrival-rate',
        startRate: targetRps,
        timeUnit: '1s',
        preAllocatedVUs: preVUs,
        maxVUs: maxVUs,
        startTime: `${currentOffsetSec}s`,
        stages: [{ target: targetRps, duration: `${STEP_DURATION_SEC}s` }],
        tags: { step_rps: String(targetRps), scenario_name: name, op: 'login' },
      };

      currentOffsetSec += STEP_DURATION_SEC;
    }

    return scenarios;
  }

  const scenarios = {};
  let currentOffsetSec = 0;

  for (let i = 0; i < STEP_RATES.length; i++) {
    const targetRps = STEP_RATES[i];
    const name = `step_${targetRps}_rps`;

    // Чтобы реальный HTTP RPS соответствовал желаемому шагу,
    // калибруем частоту запуска итераций с учетом ~1.6 reqs/iter
    const iterRate = Math.max(1, Math.round(targetRps / REQS_PER_ITERATION));

    // Динамический запас VUs на каждую ступень
    const preVUs = Math.max(5, Math.min(PRE_VUS_CONFIG, Math.round(targetRps * 0.7)));
    const maxVUs = Math.max(50, Math.min(MAX_VUS_CONFIG, Math.round(targetRps * 4.0)));

    scenarios[name] = {
      executor: 'ramping-arrival-rate',
      startRate: iterRate,
      timeUnit: '1s',
      preAllocatedVUs: preVUs,
      maxVUs: maxVUs,
      startTime: `${currentOffsetSec}s`,
      stages: [
        { target: iterRate, duration: `${STEP_DURATION_SEC}s` },
      ],
      tags: { step_rps: String(targetRps), scenario_name: name },
    };

    currentOffsetSec += STEP_DURATION_SEC;
  }

  return scenarios;
}

// Пороги прерывания теста (SLO)
const P95_LIMIT = parseInt(__ENV.P95_THRESHOLD || '300', 10);
const FAIL_RATE_LIMIT = parseFloat(__ENV.ERROR_THRESHOLD || '0.02');
const DELAY_ABORT = __ENV.DELAY_ABORT || '30s'; // 30 секунд задержки перед первой оценкой abortOnFail

// ----------------------------------------------------------------------------------------------
// Thresholds с abortOnFail (Прерывание теста при нахождении предела сервера)
// ----------------------------------------------------------------------------------------------
function buildThresholds() {
  const thresholds = {};

  if (SCENARIO_TYPE === 'login' || SCENARIO_TYPE === 'login-only') {
    // В сценарии тестирования bcrypt пороги ставятся только на op:login
    thresholds['http_req_duration{op:login}'] = [
      { threshold: `p(95)<=${P95_LIMIT * 3}`, abortOnFail: true, delayAbortEval: DELAY_ABORT },
    ];
    thresholds['http_req_failed{op:login}'] = [
      { threshold: `rate<=${FAIL_RATE_LIMIT}`, abortOnFail: true, delayAbortEval: DELAY_ABORT },
    ];
  } else {
    // В основном сценарии пороги ставятся ТОЛЬКО на под-метрики с тегом op:
    // feed, calendar, profile, write (SLO: p95 <= 300 ms, ошибки <= 2%)
    // Запросы op:setup и op:warmup в порогах НЕ УЧАСТВУЮТ!
    const monitoredOps = ['feed', 'calendar', 'profile', 'write'];
    for (const op of monitoredOps) {
      thresholds[`http_req_duration{op:${op}}`] = [
        { threshold: `p(95)<=${P95_LIMIT}`, abortOnFail: true, delayAbortEval: DELAY_ABORT },
      ];
      thresholds[`http_req_failed{op:${op}}`] = [
        { threshold: `rate<=${FAIL_RATE_LIMIT}`, abortOnFail: true, delayAbortEval: DELAY_ABORT },
      ];
    }

    // Для логина в основном потоке (2% трафика) контролируем уровень ошибок
    thresholds['http_req_failed{op:login}'] = [
      { threshold: `rate<=${FAIL_RATE_LIMIT}`, abortOnFail: true, delayAbortEval: DELAY_ABORT },
    ];
  }

  // Пошаговые пороги для сбора метрик по каждой ступени в data.metrics
  // abortOnFail: false, так как прерывание управляется целевыми порогами операций op
  if (SCENARIO_TYPE === 'smoke') {
    thresholds['http_req_duration{scenario:smoke_test}'] = [{ threshold: 'p(95)>=0', abortOnFail: false }];
    thresholds['http_req_failed{scenario:smoke_test}'] = [{ threshold: 'rate>=0', abortOnFail: false }];
    thresholds['http_reqs{scenario:smoke_test}'] = [{ threshold: 'count>=0', abortOnFail: false }];
  } else {
    const scenarioPrefix = (SCENARIO_TYPE === 'login' || SCENARIO_TYPE === 'login-only') ? 'login_step_' : 'step_';
    for (let i = 0; i < STEP_RATES.length; i++) {
      const targetRps = STEP_RATES[i];
      const name = `${scenarioPrefix}${targetRps}_rps`;
      thresholds[`http_req_duration{scenario:${name}}`] = [{ threshold: 'p(95)>=0', abortOnFail: false }];
      thresholds[`http_req_failed{scenario:${name}}`] = [{ threshold: 'rate>=0', abortOnFail: false }];
      thresholds[`http_reqs{scenario:${name}}`] = [{ threshold: 'count>=0', abortOnFail: false }];
    }
  }

  // Регистрация субметрик op + status для гарантированного сохранения в data.metrics
  const ops = ['feed', 'calendar', 'profile', 'write', 'login', 'setup', 'warmup'];
  const statuses = ['200', '201', '400', '401', '403', '404', '409', '429', '500', '502', '503', '504', '0'];
  for (const op of ops) {
    for (const st of statuses) {
      thresholds[`op_status_errors{op:${op},status:${st}}`] = [{ threshold: 'count>=0', abortOnFail: false }];
    }
  }

  return thresholds;
}

export const options = {
  setupTimeout: '360s',
  scenarios: buildScenarios(),
  thresholds: buildThresholds(),
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
};

// ----------------------------------------------------------------------------------------------
// Вспомогательные функции
// ----------------------------------------------------------------------------------------------
function randomDate(daysBack = 30) {
  const d = new Date(Date.now() - Math.floor(Math.random() * daysBack) * 86400000);
  return d.toISOString().split('T')[0];
}

function randomMonth(monthsBack = 12) {
  const d = new Date(Date.now() - Math.floor(Math.random() * monthsBack) * 30 * 86400000);
  return d.toISOString().slice(0, 7);
}

// Глобальный счетчик логирования тел ошибок (первые 20 ошибок)
let loggedErrorCount = 0;
const MAX_LOGGED_ERRORS = 20;

function trackResponse(op, res) {
  const isOk = res.status >= 200 && res.status < 300;
  const statusStr = String(res.status);

  // Добавляем длительность в Trend операции
  switch (op) {
    case 'feed':
      feedTrend.add(res.timings.duration, { op, status: statusStr });
      feedReqs.add(1, { op, status: statusStr });
      break;
    case 'calendar':
      calendarTrend.add(res.timings.duration, { op, status: statusStr });
      calendarReqs.add(1, { op, status: statusStr });
      break;
    case 'profile':
      profileTrend.add(res.timings.duration, { op, status: statusStr });
      profileReqs.add(1, { op, status: statusStr });
      break;
    case 'write':
      writeTrend.add(res.timings.duration, { op, status: statusStr });
      writeReqs.add(1, { op, status: statusStr });
      break;
    case 'login':
      loginTrend.add(res.timings.duration, { op, status: statusStr });
      loginReqs.add(1, { op, status: statusStr });
      break;
    case 'setup':
      setupTrend.add(res.timings.duration, { op, status: statusStr });
      setupReqs.add(1, { op, status: statusStr });
      break;
    case 'warmup':
      warmupTrend.add(res.timings.duration, { op, status: statusStr });
      warmupReqs.add(1, { op, status: statusStr });
      break;
  }

  if (res.status === 429) {
    rateLimitHits.add(1);
  }

  if (!isOk) {
    successRate.add(false);
    opStatusErrors.add(1, { op, status: statusStr });

    // Логирование тела ответа для первых 20 ошибок
    if (loggedErrorCount < MAX_LOGGED_ERRORS) {
      loggedErrorCount++;
      const bodySnippet = (res.body || '').toString().slice(0, 200).replace(/[\r\n\t]+/g, ' ');
      console.warn(`[ERROR #${loggedErrorCount}] [${op.toUpperCase()}] HTTP ${res.status} on ${res.url} | Body: ${bodySnippet}`);
    }
  } else {
    successRate.add(true);
  }

  return isOk;
}

// ----------------------------------------------------------------------------------------------
// Setup: Аутентификация пула тестовых пользователей и прогрев кэшей (Warmup)
// ----------------------------------------------------------------------------------------------
export function setup() {
  const setupStartTime = new Date();
  console.log(`[${setupStartTime.toISOString()}] [SETUP] ================================================================`);
  console.log(`[${setupStartTime.toISOString()}] [SETUP] Moodila Real Server Capacity & Saturation Load Test`);
  console.log(`[${setupStartTime.toISOString()}] [SETUP] Target Server:  ${BASE_URL} (Hardware: 1 vCPU / 1 GB RAM)`);
  console.log(`[${setupStartTime.toISOString()}] [SETUP] Scenario Type:  ${SCENARIO_TYPE} (Login share in main stream: ${(LOGIN_SHARE * 100).toFixed(1)}%)`);
  console.log(`[${setupStartTime.toISOString()}] [SETUP] Steps:          ${STEP_RATES.join(' -> ')} req/s (${STEP_DURATION_SEC}s each)`);
  console.log(`[${setupStartTime.toISOString()}] [SETUP] User Sessions:  Pre-authenticating ${USERS_POOL_COUNT} bots uniformly across ${TOTAL_SEEDED_USERS} accounts...`);
  console.log(`[${setupStartTime.toISOString()}] [SETUP] Parallel Batch: Logging in via http.batch in chunks of 4 (setupTimeout >= 300s)...`);
  console.log(`[${setupStartTime.toISOString()}] [SETUP] ================================================================`);

  // 1. Формируем список ботов, равномерно распределенных по всему пространству 20 000 аккаунтов
  const credsList = [];
  for (let i = 0; i < USERS_POOL_COUNT; i++) {
    const botIdx = Math.floor((i * TOTAL_SEEDED_USERS) / USERS_POOL_COUNT);
    credsList.push({
      email: `loadtest_${botIdx}@moodila.test`,
      password: 'Password123!',
      username: `loadtest_${botIdx}`,
      display_name: `Load Bot ${botIdx}`,
      botIdx,
    });
  }

  // 2. Вход пачками по 4 через http.batch (1 ядро хеширует bcrypt последовательно)
  const BATCH_SIZE = 4;
  const sessions = [];
  let loginsFailed = 0;

  for (let b = 0; b < credsList.length; b += BATCH_SIZE) {
    const chunk = credsList.slice(b, b + BATCH_SIZE);
    const requests = chunk.map((c) => [
      'POST',
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email: c.email, password: c.password }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { op: 'setup', name: 'SetupLogin' },
      },
    ]);

    const responses = http.batch(requests);

    for (let j = 0; j < responses.length; j++) {
      const res = responses[j];
      trackResponse('setup', res);

      if (res.status === 200 || res.status === 201) {
        let accessToken = '';
        let csrfToken = '';

        try {
          const body = JSON.parse(res.body);
          csrfToken = body.csrf_token || '';
        } catch (_) {}

        const cookie = res.cookies && res.cookies.access_token;
        if (cookie && cookie.length > 0) {
          accessToken = cookie[0].value;
        }

        if (accessToken) {
          sessions.push({
            accessToken,
            csrfToken,
            email: chunk[j].email,
            userId: `bot_${chunk[j].botIdx}`,
          });
        } else {
          loginsFailed++;
        }
      } else {
        loginsFailed++;
      }
    }

    if ((b + BATCH_SIZE) % 100 === 0 || (b + BATCH_SIZE) >= credsList.length) {
      const curTime = new Date();
      console.log(`[${curTime.toISOString()}] [SETUP] Progress: ${Math.min(b + BATCH_SIZE, credsList.length)}/${USERS_POOL_COUNT} auth attempted (${sessions.length} tokens ok, ${loginsFailed} failed)`);
    }
  }

  const loginEndTime = new Date();
  console.log(`[${loginEndTime.toISOString()}] [SETUP] ✅ Authenticated ${sessions.length}/${USERS_POOL_COUNT} user sessions for VU pool (${loginsFailed} failed). Time taken: ${((loginEndTime - setupStartTime) / 1000).toFixed(1)}s.`);
  if (sessions.length === 0) {
    console.warn(`[${loginEndTime.toISOString()}] [SETUP] ⚠️ Warning: No authenticated sessions obtained. Test will hit unauthenticated endpoints.`);
  }

  // 3. Прогрев (Warmup) сразу после логина пула сессий
  // Отправляет по 1 запросу каждой ручки (Feed, Profile, Calendar, Write) для 100-200 юзеров.
  // Все запросы помечаются тегом op:warmup, исключены из порогов и из статистики ступеней.
  const WARMUP_COUNT = Math.min(sessions.length, 150);
  if (WARMUP_COUNT > 0 && SCENARIO_TYPE !== 'login' && SCENARIO_TYPE !== 'login-only') {
    const warmupStartTime = new Date();
    console.log(`[${warmupStartTime.toISOString()}] [WARMUP] 🔥 Warming up Go API and PostgreSQL caches (${WARMUP_COUNT} users, 4 requests each)...`);
    const warmupMonth = randomMonth(12);

    for (let i = 0; i < WARMUP_COUNT; i += 4) {
      const chunk = sessions.slice(i, i + 4);
      const warmupRequests = [];

      for (const s of chunk) {
        const h = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${s.accessToken}`,
          'Cookie': `access_token=${s.accessToken}; csrf_token=${s.csrfToken}`,
        };
        const writeH = Object.assign({}, h, { 'X-CSRF-Token': s.csrfToken });
        const warmupDate = randomDate(365);

        warmupRequests.push([
          'GET',
          `${BASE_URL}/feed?limit=10&include_self=true`,
          null,
          { headers: h, tags: { op: 'warmup', name: 'WarmupFeed' } },
        ]);
        warmupRequests.push([
          'GET',
          `${BASE_URL}/users/me`,
          null,
          { headers: h, tags: { op: 'warmup', name: 'WarmupProfile' } },
        ]);
        warmupRequests.push([
          'GET',
          `${BASE_URL}/entries/summary?month=${warmupMonth}`,
          null,
          { headers: h, tags: { op: 'warmup', name: 'WarmupCalendar' } },
        ]);
        warmupRequests.push([
          'POST',
          `${BASE_URL}/entries`,
          JSON.stringify({
            date: warmupDate,
            mood: 3,
            tags: ['warmup'],
            text: 'Warmup entry to prime DB query cache and connections',
          }),
          { headers: writeH, tags: { op: 'warmup', name: 'WarmupWrite' } },
        ]);
      }

      const responses = http.batch(warmupRequests);
      for (const res of responses) {
        trackResponse('warmup', res);
      }
    }
    const warmupEndTime = new Date();
    console.log(`[${warmupEndTime.toISOString()}] [WARMUP] ✅ Warmup completed in ${((warmupEndTime - warmupStartTime) / 1000).toFixed(1)}s: primed feed, profile, calendar, write endpoints for ${WARMUP_COUNT} users.`);
  } else if (WARMUP_COUNT > 0 && (SCENARIO_TYPE === 'login' || SCENARIO_TYPE === 'login-only')) {
    const warmupStartTime = new Date();
    console.log(`[${warmupStartTime.toISOString()}] [WARMUP] 🔥 Warming up bcrypt on server (10 logins)...`);
    for (let i = 0; i < 10; i += 2) {
      const chunk = credsList.slice(i, i + 2);
      const reqs = chunk.map((c) => [
        'POST',
        `${BASE_URL}/auth/login`,
        JSON.stringify({ email: c.email, password: c.password }),
        {
          headers: { 'Content-Type': 'application/json' },
          tags: { op: 'warmup', name: 'WarmupLogin' },
        },
      ]);
      const resps = http.batch(reqs);
      for (const res of resps) {
        trackResponse('warmup', res);
      }
    }
    const warmupEndTime = new Date();
    console.log(`[${warmupEndTime.toISOString()}] [WARMUP] ✅ Warmup completed in ${((warmupEndTime - warmupStartTime) / 1000).toFixed(1)}s: bcrypt primed.`);
  }

  const setupEndTime = new Date();
  console.log(`[${setupEndTime.toISOString()}] [SETUP] Finished all setup routines in ${((setupEndTime - setupStartTime) / 1000).toFixed(1)}s.`);
  return { sessions };
}

// ----------------------------------------------------------------------------------------------
// Исполнение отдельных операций
// ----------------------------------------------------------------------------------------------
function doFeed(headers) {
  const res = http.get(`${BASE_URL}/feed?limit=10&include_self=true`, {
    headers,
    tags: { op: 'feed', name: 'Feed' },
  });
  trackResponse('feed', res);
  check(res, { 'feed is 200': (r) => r.status === 200 });
}

function doProfile(headers) {
  const res = http.get(`${BASE_URL}/users/me`, {
    headers,
    tags: { op: 'profile', name: 'Profile' },
  });
  trackResponse('profile', res);
  check(res, { 'profile is 200': (r) => r.status === 200 });
}

function doCalendar(headers) {
  const month = randomMonth(12);
  const res = http.get(`${BASE_URL}/entries/summary?month=${month}`, {
    headers,
    tags: { op: 'calendar', name: 'Calendar' },
  });
  trackResponse('calendar', res);
  check(res, { 'calendar is 200': (r) => r.status === 200 });
}

function doWriteEntry(headers, csrfToken) {
  // Выбираем случайную дату за последний год (365 дней).
  // В PostgreSQL таблица entries имеет ограничение UNIQUE (user_id, date).
  // При повторной записи на ту же дату бэкенд (repository/entries.go) выполняет
  // ON CONFLICT (user_id, date) DO UPDATE и возвращает HTTP 200 OK.
  // Благодаря http.setResponseCallback(http.expectedStatuses(200, 201)) и UPSERT-логике бэкенда,
  // коллизий 409 не возникает.
  const entryDate = randomDate(365);
  const writeHeaders = Object.assign({}, headers, { 'X-CSRF-Token': csrfToken });
  const payload = JSON.stringify({
    date: entryDate,
    mood: 1 + Math.floor(Math.random() * 5),
    tags: ['focus', 'diary', 'work'],
    text: `Daily mood log at ${Date.now()}: staying productive and focused.`,
  });

  const res = http.post(`${BASE_URL}/entries`, payload, {
    headers: writeHeaders,
    tags: { op: 'write', name: 'WriteEntry' },
  });
  trackResponse('write', res);
  check(res, { 'write entry is 200': (r) => r.status === 200 });
}

function doLiveLogin() {
  const botIdx = Math.floor(Math.random() * TOTAL_SEEDED_USERS);
  const payload = JSON.stringify({
    email: `loadtest_${botIdx}@moodila.test`,
    password: 'Password123!',
  });

  const res = http.post(`${BASE_URL}/auth/login`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { op: 'login', name: 'Login' },
  });
  trackResponse('login', res);
  check(res, { 'login is 200': (r) => r.status === 200 });
}

// ----------------------------------------------------------------------------------------------
// Главный цикл VU
// ----------------------------------------------------------------------------------------------
export default function (data) {
  if (__ITER === 0) {
    console.log(`[${new Date().toISOString()}] [VU ${__VU}] Started first iteration (scenario: ${__ENV.SCENARIO || 'ramp'})`);
  }

  // Отдельный сценарий 'login-only' тестирует только пропускную способность bcrypt
  if (SCENARIO_TYPE === 'login' || SCENARIO_TYPE === 'login-only') {
    doLiveLogin();
    return;
  }

  const sessions = data && data.sessions ? data.sessions : [];
  let token = __ENV.AUTH_TOKEN || '';
  let csrf = '';

  if (sessions.length > 0) {
    const s = sessions[(__VU - 1) % sessions.length] || sessions[Math.floor(Math.random() * sessions.length)];
    token = s.accessToken;
    csrf = s.csrfToken;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Cookie': `access_token=${token}; csrf_token=${csrf}`,
  };

  const rand = Math.random();

  // 1. Доля реального логина в основном потоке (LOGIN_SHARE, по умолчанию 0.02 = 2%)
  if (rand < LOGIN_SHARE) {
    doLiveLogin();
    return;
  }

  // 2. 30% сценариев: "Открытие приложения" (User Startup Lifecycle: Feed + Profile + Calendar)
  if (rand < LOGIN_SHARE + 0.30) {
    if (token) {
      doFeed(headers);
      doProfile(headers);
      doCalendar(headers);
    } else {
      doLiveLogin();
    }
    return;
  }

  // 3. Одиночные действия пользователя (~68%)
  // Фактическое распределение запросов: Feed ~40%, Calendar ~30%, Profile ~15%, Write ~10-15%, Login ~2%
  if (token) {
    const actionRand = Math.random();
    if (actionRand < 0.48) {
      // Одиночный просмотр ленты
      doFeed(headers);
    } else if (actionRand < 0.74) {
      // Одиночный просмотр календаря
      doCalendar(headers);
    } else {
      // Одиночная запись настроения дня (POST /entries с CSRF-токеном)
      doWriteEntry(headers, csrf);
    }
  } else {
    doLiveLogin();
  }
}

// ----------------------------------------------------------------------------------------------
// Форматирование метрик
// ----------------------------------------------------------------------------------------------
function fmt(metric) {
  if (!metric || !metric.values) return 'N/A';
  const v = metric.values;
  const p50 = (v['p(50)'] != null ? v['p(50)'] : v.med) != null ? (v['p(50)'] != null ? v['p(50)'] : v.med).toFixed(1) : 'N/A';
  const p90 = v['p(90)'] != null ? v['p(90)'].toFixed(1) : 'N/A';
  const p95 = v['p(95)'] != null ? v['p(95)'].toFixed(1) : 'N/A';
  const p99 = v['p(99)'] != null ? v['p(99)'].toFixed(1) : 'N/A';
  return `p50=${p50.padStart(5)}ms | p90=${p90.padStart(5)}ms | p95=${p95.padStart(6)}ms | p99=${p99.padStart(6)}ms`;
}

function getMetric(metrics, baseName, scenarioName) {
  if (!metrics) return null;
  const direct = metrics[`${baseName}{scenario:${scenarioName}}`];
  if (direct) return direct;
  for (const k of Object.keys(metrics)) {
    if (k.startsWith(baseName) && k.includes(scenarioName)) {
      return metrics[k];
    }
  }
  return null;
}

// ----------------------------------------------------------------------------------------------
// Итоговый динамический отчет ( handleSummary )
// ----------------------------------------------------------------------------------------------
export function handleSummary(data) {
  const reqTotal = data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0;
  const globalDuration = data.metrics.http_req_duration ? data.metrics.http_req_duration.values : {};
  const globalFailed = data.metrics.http_req_failed ? data.metrics.http_req_failed.values : {};
  const limitsHit = data.metrics.rate_limit_hits ? data.metrics.rate_limit_hits.values.count : 0;

  // Метрика dropped_iterations в k6 (случаи, когда VUs были перегружены и k6 не успевал)
  const droppedMetric = data.metrics.dropped_iterations;
  const droppedCount = droppedMetric && droppedMetric.values ? droppedMetric.values.count : 0;
  const droppedRate = droppedMetric && droppedMetric.values ? (droppedMetric.values.rate || 0).toFixed(2) : '0.00';

  const totalFailRate = globalFailed.rate != null ? (globalFailed.rate * 100).toFixed(2) : '0.00';
  const totalFailsCount = globalFailed.passes != null ? globalFailed.passes : 0;

  // 1. Проверка баланса и распределения операций (включая setup и warmup)
  const cFeed = data.metrics.op_feed_reqs ? data.metrics.op_feed_reqs.values.count : 0;
  const cCalendar = data.metrics.op_calendar_reqs ? data.metrics.op_calendar_reqs.values.count : 0;
  const cProfile = data.metrics.op_profile_reqs ? data.metrics.op_profile_reqs.values.count : 0;
  const cWrite = data.metrics.op_write_reqs ? data.metrics.op_write_reqs.values.count : 0;
  const cLogin = data.metrics.op_login_reqs ? data.metrics.op_login_reqs.values.count : 0;
  const cSetup = data.metrics.op_setup_reqs ? data.metrics.op_setup_reqs.values.count : 0;
  const cWarmup = data.metrics.op_warmup_reqs ? data.metrics.op_warmup_reqs.values.count : 0;
  const cSum = cFeed + cCalendar + cProfile + cWrite + cLogin + cSetup + cWarmup;
  const cMissing = reqTotal - cSum;
  const mainTraffic = cFeed + cCalendar + cProfile + cWrite + cLogin;

  const pctTotal = (val) => (reqTotal > 0 ? ((val / reqTotal) * 100).toFixed(1) : '0.0');
  const pctTraffic = (val) => (mainTraffic > 0 ? ((val / mainTraffic) * 100).toFixed(1) : '0.0');

  // 2. Анализ результатов по ступеням нагрузки
  const scenarioPrefix = (SCENARIO_TYPE === 'login' || SCENARIO_TYPE === 'login-only') ? 'login_step_' : 'step_';
  const stepsToAnalyze = SCENARIO_TYPE === 'smoke'
    ? [{ targetRps: 5, scenarioName: 'smoke_test', durationSec: 15 }]
    : STEP_RATES.map((rps) => ({ targetRps: rps, scenarioName: `${scenarioPrefix}${rps}_rps`, durationSec: STEP_DURATION_SEC }));

  const stepResults = [];

  for (let i = 0; i < stepsToAnalyze.length; i++) {
    const { targetRps, scenarioName, durationSec } = stepsToAnalyze[i];

    const reqsMetric = getMetric(data.metrics, 'http_reqs', scenarioName);
    const durationMetric = getMetric(data.metrics, 'http_req_duration', scenarioName);
    const failedMetric = getMetric(data.metrics, 'http_req_failed', scenarioName);

    const stepReqs = reqsMetric && reqsMetric.values ? reqsMetric.values.count : 0;
    const actualRps = stepReqs > 0 ? (stepReqs / durationSec).toFixed(1) : '0.0';
    const actualRpsNum = parseFloat(actualRps) || 0;

    const failRateVal = failedMetric && failedMetric.values ? failedMetric.values.rate * 100 : 0;
    const failsCount = failedMetric && failedMetric.values ? failedMetric.values.passes : 0;

    const durValues = durationMetric && durationMetric.values ? durationMetric.values : {};
    const p50 = (durValues['p(50)'] != null ? durValues['p(50)'] : durValues.med) != null
      ? (durValues['p(50)'] != null ? durValues['p(50)'] : durValues.med).toFixed(1)
      : 'N/A';
    const p90 = durValues['p(90)'] != null ? durValues['p(90)'].toFixed(1) : 'N/A';
    const p95 = durValues['p(95)'] != null ? durValues['p(95)'].toFixed(1) : 'N/A';
    const p99 = durValues['p(99)'] != null ? durValues['p(99)'].toFixed(1) : 'N/A';
    const avg = durValues.avg != null ? durValues.avg.toFixed(1) : 'N/A';

    const p95Num = parseFloat(p95) || 0;
    const p99Num = parseFloat(p99) || 0;

    let status = '🟢 Устойчиво';
    let isSustainable = false;
    let isAborted = false;

    if (stepReqs === 0) {
      status = '⏸️ Не запускалась';
      isAborted = true;
    } else if (failRateVal >= 5.0 || p95Num > 1000) {
      status = '🔴 Предел / Сбой';
    } else if (failRateVal >= (FAIL_RATE_LIMIT * 100) || p95Num > P95_LIMIT) {
      status = '🟠 Нарушение SLO';
    } else if (failRateVal >= 1.0 || p95Num > 250) {
      status = '🟡 Допустимо';
      isSustainable = true;
    } else {
      status = '🟢 Устойчиво';
      isSustainable = true;
    }

    stepResults.push({
      targetRps,
      actualRps: actualRpsNum,
      reqs: stepReqs,
      p50,
      p90,
      p95: p95Num,
      p99: p99Num,
      avg,
      failRate: failRateVal,
      failsCount,
      status,
      isSustainable,
      isAborted,
    });
  }

  // 3. Выявление ступени сбоя / прерывания (abortOnFail)
  let abortedStep = null;
  let abortReason = '';

  for (let i = 0; i < stepResults.length; i++) {
    const s = stepResults[i];
    const hasNextZero = (i < stepResults.length - 1 && stepResults[i + 1].reqs === 0);
    const breachedSlo = (s.p95 > P95_LIMIT || s.failRate >= (FAIL_RATE_LIMIT * 100));

    if (s.reqs > 0 && (breachedSlo || hasNextZero)) {
      abortedStep = s;
      const reasons = [];
      if (s.p95 > P95_LIMIT) {
        reasons.push(`задержка p95 = ${s.p95.toFixed(1)} ms > ${P95_LIMIT} ms`);
      }
      if (s.failRate >= (FAIL_RATE_LIMIT * 100)) {
        reasons.push(`ошибки = ${s.failRate.toFixed(2)}% >= ${(FAIL_RATE_LIMIT * 100).toFixed(1)}% (${s.failsCount} шт.)`);
      }
      if (reasons.length === 0 && hasNextZero) {
        reasons.push(`сработал порог abortOnFail (превышение лимита задержек/ошибок)`);
      }
      abortReason = reasons.join('; ');
      s.status = '⛔ Сбой (Abort)';
      s.isAborted = true;
      break;
    } else if (s.reqs === 0 && !abortedStep) {
      abortedStep = s;
      abortReason = 'тест остановлен до старта данной ступени';
      s.status = '⏸️ Не запускалась';
      s.isAborted = true;
      break;
    }
  }

  // Для ВСЕХ ступеней после ступени со сбоем ставим статус "⏸️ Не запускалась"
  let sawAbort = false;
  for (let i = 0; i < stepResults.length; i++) {
    const s = stepResults[i];
    if (sawAbort) {
      s.status = '⏸️ Не запускалась';
      s.isAborted = true;
    } else if (s === abortedStep) {
      sawAbort = true;
    }
  }

  // 4. Определение Точки Излома (Breakpoint RPS)
  // Считается СТРОГО ПО ТАБЛИЦЕ СТУПЕНЕЙ:
  // Ищем последнюю непрерывную ступень (начиная с первой), где:
  // • reqs > 0
  // • !isAborted
  // • failRate <= 1.0% (доля ошибок в пределах 1%)
  // • p95 > 0 && p95 <= P95_LIMIT (задержка p95 <= 300 ms)
  let breakpointStep = null;
  for (let i = 0; i < stepResults.length; i++) {
    const s = stepResults[i];
    if (s.reqs > 0 && !s.isAborted && s.failRate <= 1.0 && s.p95 > 0 && s.p95 <= P95_LIMIT) {
      breakpointStep = s;
    } else {
      break; // Как только ступень нарушает SLO или прерывается, цепочка устойчивости обрывается
    }
  }

  // 5. Формирование таблицы ступеней
  let stepTableRows = '';
  for (let i = 0; i < stepResults.length; i++) {
    const s = stepResults[i];
    const targetCol = String(`${s.targetRps} req/s`).padEnd(12);
    const actualCol = String(s.reqs > 0 ? `${s.actualRps.toFixed(1)} req/s` : '-').padEnd(12);
    const reqsCol = String(s.reqs).padEnd(8);
    const p50Col = String(s.reqs > 0 && s.p50 !== 'N/A' ? `${s.p50} ms` : '-').padEnd(9);
    const p95Col = String(s.reqs > 0 && s.p95 > 0 ? `${s.p95.toFixed(1)} ms` : '-').padEnd(9);
    const p99Col = String(s.reqs > 0 && s.p99 > 0 ? `${s.p99.toFixed(1)} ms` : '-').padEnd(9);
    const failCol = String(s.reqs > 0 ? `${s.failRate.toFixed(2)}% (${s.failsCount})` : '-').padEnd(14);
    stepTableRows += `  ${targetCol} | ${actualCol} | ${reqsCol} | ${p50Col} | ${p95Col} | ${p99Col} | ${failCol} | ${s.status}\n`;
  }

  // 6. Поиск конкретного порога (metric + condition), вызвавшего abortOnFail
  const failedThresholds = [];
  for (const [metricName, metricData] of Object.entries(data.metrics)) {
    if (metricData && metricData.thresholds) {
      for (const [threshExpr, threshResult] of Object.entries(metricData.thresholds)) {
        const isFailed = (threshResult === false) || (threshResult && threshResult.ok === false);
        if (isFailed) {
          const v = metricData.values || {};
          let actualValStr = '';
          if (threshExpr.includes('p(95)')) {
            actualValStr = `p95 = ${(v['p(95)'] != null ? v['p(95)'].toFixed(1) : (v.med != null ? v.med.toFixed(1) : 'N/A'))} ms`;
          } else if (threshExpr.includes('p(99)')) {
            actualValStr = `p99 = ${(v['p(99)'] != null ? v['p(99)'].toFixed(1) : 'N/A')} ms`;
          } else if (threshExpr.includes('rate')) {
            actualValStr = `rate = ${(v.rate != null ? (v.rate * 100).toFixed(2) + '%' : 'N/A')}`;
          } else if (threshExpr.includes('count')) {
            actualValStr = `count = ${v.count != null ? v.count : 'N/A'}`;
          } else {
            actualValStr = JSON.stringify(v);
          }
          failedThresholds.push({
            metricName,
            threshExpr,
            actualValStr,
          });
        }
      }
    }
  }

  let thresholdAbortSection = '';
  if (failedThresholds.length > 0) {
    thresholdAbortSection = failedThresholds
      .map((f) => `  🔴 [СБОЙ ПОРОГА]:\n     • Метрика:        ${f.metricName}\n     • Условие (SLO):  ${f.threshExpr}\n     • Факт. значение: ${f.actualValStr}`)
      .join('\n\n') + '\n';
  } else {
    thresholdAbortSection = '  • Прерываний по порогам (abortOnFail) не зафиксировано (все активные пороги соблюдены).\n';
  }

  // 7. Разбор ошибок по операциям и статусам HTTP
  const aggregatedErrors = [];
  for (const [key, metric] of Object.entries(data.metrics)) {
    if (key.startsWith('op_status_errors{') && metric.values && metric.values.count > 0) {
      const match = key.match(/op:([^,}]+).*status:([^,}]+)/);
      if (match) {
        const op = match[1];
        const status = match[2];
        if (status !== '200' && status !== '201') {
          aggregatedErrors.push({
            op,
            status,
            count: metric.values.count,
          });
        }
      }
    }
  }

  aggregatedErrors.sort((a, b) => b.count - a.count);

  let errorsSection = reqTotal === 0
    ? '  • Запросы не выполнялись (0 запросов в тесте).\n'
    : '  • Ошибок HTTP не зафиксировано (100% запросов завершились 2xx).\n';
  if (aggregatedErrors.length > 0) {
    errorsSection = aggregatedErrors
      .map((e) => `  • [${e.op.toUpperCase()}] HTTP ${e.status}: ${e.count} ошибок`)
      .join('\n') + '\n';
  }

  // 8. Расчет одновременных пользователей по закону Литтла
  // Считается строго от НАЙДЕННОГО УСТОЙЧИВОГО RPS (Breakpoint), а не от сгенерированного скриптом
  const baseCapacityRps = breakpointStep ? breakpointStep.actualRps : 0;
  const activeOnline = Math.round(baseCapacityRps * 3);
  const normalOnline = Math.round(baseCapacityRps * 7);
  const passiveOnline = Math.round(baseCapacityRps * 15);

  // 9. Объективное заключение с явным указанием ступени сбоя и причины
  let conclusion = '';
  if (mainTraffic === 0) {
    const triggerInfo = failedThresholds.length > 0
      ? failedThresholds.map((f) => `${f.metricName} [${f.threshExpr}] (факт: ${f.actualValStr})`).join('; ')
      : 'процесс k6 завершился до старта сценариев (таймаут setupTimeout, внешняя остановка SIGINT/Ctrl+C, либо сбой в setup/warmup)';

    conclusion =
      `⏸️ ОСНОВНОЙ ТРАФИК НАГРУЗКИ НЕ ЗАПУСКАЛСЯ (0 рабочих запросов):\n` +
      `     • Причина остановки:   ${triggerInfo}\n` +
      `     • Запросов в setup():  ${cSetup} шт. (логин пула сессий)\n` +
      `     • Запросов в warmup(): ${cWarmup} шт. (прогрев кэшей)\n` +
      `     • Все ступени (RPS):   не запускались\n` +
      `     • Вердикт:             Основная фаза тестирования не достигнута. Емкость сервера под нагрузкой не оценивалась.`;
  } else if (failedThresholds.length > 0) {
    const abortedTarget = abortedStep ? abortedStep.targetRps : 'N/A';
    const cancelledSteps = stepResults
      .filter((s) => s.targetRps > abortedTarget)
      .map((s) => `${s.targetRps} req/s`);
    const cancelledMsg = cancelledSteps.length > 0
      ? `\n     • Отмененные ступени:  ${cancelledSteps.join(', ')} (не запускались)`
      : '';

    conclusion =
      `🔴 ТЕСТ ПРЕРВАН ДОСРОЧНО АВТОМАТИЧЕСКИМ ПРЕДОХРАНИТЕЛЕМ (abortOnFail):\n` +
      `     • Ступень сбоя:        ${abortedTarget} req/s (на ${abortedStep ? abortedStep.actualRps.toFixed(1) : 0} факт. req/s, ${abortedStep ? abortedStep.reqs : 0} запросов)\n` +
      `     • Сработавший порог:   ${failedThresholds.map((f) => `${f.metricName} [${f.threshExpr}] (факт: ${f.actualValStr})`).join('; ')}` +
      cancelledMsg + `\n` +
      `     • Точка излома (RPS):  ${breakpointStep ? `${breakpointStep.actualRps.toFixed(1)} req/s (ступень ${breakpointStep.targetRps} req/s)` : 'НЕТ (сервер не выдержал начальную нагрузку)'}\n` +
      `     • Вердикт:             Аппаратный ресурс 1 vCPU / 1 GB RAM исчерпан на ступени ${abortedTarget} req/s.`;
  } else if (abortedStep && abortedStep.reqs > 0) {
    const abortedTarget = abortedStep.targetRps;
    const cancelledSteps = stepResults
      .filter((s) => s.targetRps > abortedTarget)
      .map((s) => `${s.targetRps} req/s`);
    const cancelledMsg = cancelledSteps.length > 0
      ? `\n     • Отмененные ступени:  ${cancelledSteps.join(', ')} (не запускались)`
      : '';

    conclusion =
      `🔴 СТУПЕНЬ НАГРУЗКИ НАРУШИЛА КРИТЕРИИ УСТОЙЧИВОСТИ:\n` +
      `     • Ступень деградации:  ${abortedTarget} req/s (на ${abortedStep.actualRps.toFixed(1)} факт. req/s, ${abortedStep.reqs} запросов)\n` +
      `     • Причина сбоя:        ${abortReason}` +
      cancelledMsg + `\n` +
      `     • Точка излома (RPS):  ${breakpointStep ? `${breakpointStep.actualRps.toFixed(1)} req/s (ступень ${breakpointStep.targetRps} req/s)` : 'НЕТ'}\n` +
      `     • Вердикт:             Достигнут предел пропускной способности на ступени ${abortedTarget} req/s.`;
  } else if (!breakpointStep) {
    conclusion =
      `🔴 СЕРВЕР НЕ СООТВЕТСТВУЕТ КРИТЕРИЯМ SLO ДАЖЕ НА СТАРТОВОЙ НАГРУЗКЕ (${STEP_RATES[0]} req/s):\n` +
      `     • Задержки p95 превышают ${P95_LIMIT} ms или уровень ошибок > 1.0% с самого начала теста.\n` +
      `     • Вердикт: Требуется оптимизация PostgreSQL и Gin-хендлеров перед повторным тестированием.`;
  } else if (breakpointStep.targetRps === STEP_RATES[STEP_RATES.length - 1]) {
    conclusion =
      `🟢 СЕРВЕР УСПЕШНО ВЫДЕРЖАЛ ВСЕ СТУПЕНИ ВПЛОТЬ ДО ${breakpointStep.targetRps} req/s:\n` +
      `     • Реальный предел:     >= ${breakpointStep.actualRps.toFixed(1)} req/s (максимальная ступень теста)\n` +
      `     • Качество сервиса:    p95 = ${breakpointStep.p95.toFixed(1)} ms (< ${P95_LIMIT} ms), ошибок = ${breakpointStep.failRate.toFixed(2)}% (< 1.0%)\n` +
      `     • Вердикт:             Сервер 1 vCPU / 1 GB RAM показал отличную емкость для текущего профиля нагрузки.`;
  } else {
    conclusion =
      `🟠 ТЕСТ ЗАВЕРШЕН ПОЛНОСТЬЮ. НАЙДЕН РЕАЛЬНЫЙ ПРЕДЕЛ СЕРВЕРА 1 vCPU / 1 GB RAM:\n` +
      `     • Точка излома:        ${breakpointStep.actualRps.toFixed(1)} req/s (ступень ${breakpointStep.targetRps} req/s)\n` +
      `     • Задержки на пределе: p50 = ${breakpointStep.p50} ms | p95 = ${breakpointStep.p95.toFixed(1)} ms | p99 = ${breakpointStep.p99.toFixed(1)} ms\n` +
      `     • Вердикт:             Стабильная пропускная способность — ${breakpointStep.actualRps.toFixed(1)} req/s. Дальше наступает деградация.`;
  }

  // Расчет строк таблицы операций (если 0 запросов -> статус '⚪ Нет данных')
  const opRow = (title, count, targetPct) => {
    const colTitle = String(title).padEnd(28);
    const colCount = String(count).padStart(7);
    const colTotalPct = String(`${pctTotal(count)}%`).padStart(9);
    const colTrafficPct = count > 0 && mainTraffic > 0 ? String(`${pctTraffic(count)}%`).padStart(12) : String('-').padStart(12);
    const colTarget = String(targetPct).padStart(12);
    const colStatus = count > 0 ? '✅' : '⚪ Нет данных';
    return `  ${colTitle} | ${colCount} | ${colTotalPct} | ${colTrafficPct} | ${colTarget} | ${colStatus}`;
  };

  const diffStatus = cMissing === 0 ? '✅ 0 (нет расхождений)' : `⚠️ ${cMissing} (расхождение)`;
  const diffRow = `  Неучтенные запросы (Diff)    | ${cMissing.toString().padStart(7)} | ${pctTotal(cMissing).padStart(8)}% |           -  |       0 (0%) | ${diffStatus}`;

  const diffDescription = cMissing === 0
    ? `  • Неучтенные запросы: 0 шт. (100% HTTP-запросов, включая setup и warmup, размечены явным тегом op).`
    : `  • ⚠️ Неучтенные запросы: ${cMissing} шт. Причина: запросы выполнены без явного тега op или с нераспознанным тегом (системные запросы k6, редиректы).`;

  const droppedStatus = droppedCount === 0
    ? `  • Пропущено итераций (dropped_iterations): 0 (генератор k6 успевал отправлять 100% запланированного трафика)`
    : `  • ⚠️ Пропущено итераций (dropped_iterations): ${droppedCount} (интенсивность ~${droppedRate}/s) — исчерпан пул VUs или зависли ответы сервера`;

  const textSummary = `
================================================================================================
          РЕЗУЛЬТАТЫ СТРЕСС-ТЕСТИРОВАНИЯ И ПОИСКА ПРЕДЕЛА СЕРВЕРА (BREAKPOINT)
          Конфигурация стенда: 1 vCPU / 1 GB RAM | Go API + PostgreSQL
================================================================================================

1. РАСПРЕДЕЛЕНИЕ ЗАПРОСОВ ПО ОПЕРАЦИЯМ И БАЛАНС:
------------------------------------------------------------------------------------------------
  Операция                     | Запросов| % от всех | % от трафика | Целевая доля | Статус
  -----------------------------|---------|-----------|--------------|--------------|-------
${opRow('• Лента (Feed)', cFeed, '~40%')}
${opRow('• Календарь (Calendar)', cCalendar, '~30%')}
${opRow('• Профиль (Profile)', cProfile, '~15%')}
${opRow('• Запись дня (Write Entry)', cWrite, '10-15%')}
${opRow('• Реальный логин (Login)', cLogin, `${(LOGIN_SHARE * 100).toFixed(1)}%`)}
  -----------------------------|---------|-----------|--------------|--------------|-------
  Рабочий трафик (Main Traffic)| ${mainTraffic.toString().padStart(7)} | ${pctTotal(mainTraffic).padStart(8)}% |      100.0%  |            - | ${mainTraffic > 0 ? '✅' : '⚪ Нет данных'}
  Авторизация пула (Setup)     | ${cSetup.toString().padStart(7)} | ${pctTotal(cSetup).padStart(8)}% |           -  |   однократно | ${cSetup > 0 ? '✅' : '⚪ Нет данных'}
  Прогрев кэшей (Warmup)       | ${cWarmup.toString().padStart(7)} | ${pctTotal(cWarmup).padStart(8)}% |           -  |   однократно | ${cWarmup > 0 ? '✅' : '⚪ Нет данных'}
${diffRow}
  -----------------------------|---------|-----------|--------------|--------------|-------
  ИТОГО (http_reqs)            | ${reqTotal.toString().padStart(7)} |      100.0% |              |              | ${cMissing === 0 ? '✅ 100% учтено' : `⚠️ ${cMissing} утеряно`}
  ----------------------------------------------------------------------------------------------
${droppedStatus}
${diffDescription}

2. ДЕТАЛИЗАЦИЯ ЗАДЕРЖЕК ПО ОПЕРАЦИЯМ (TRENDS):
------------------------------------------------------------------------------------------------
  • Лента друзей (Feed):        ${fmt(data.metrics.feed_duration)}
  • Календарь (Calendar):       ${fmt(data.metrics.calendar_duration)}
  • Профиль юзера (Profile):    ${fmt(data.metrics.profile_duration)}
  • Запись дня (Write Entry):   ${fmt(data.metrics.write_duration)}
  • Реальный логин (Login):     ${fmt(data.metrics.login_duration)}
  • Setup авторизация:          ${fmt(data.metrics.setup_duration)}
  • Прогрев кэшей (Warmup):     ${fmt(data.metrics.warmup_duration)}

3. РЕЗУЛЬТАТЫ ПО СТУПЕНЯМ НАГРУЗКИ (ARRIVAL RATE):
------------------------------------------------------------------------------------------------
  Ступень (Цель)| Реальный RPS | Запросов | p50 (ms)  | p95 (ms)  | p99 (ms)  | Ошибки (%/шт)| Статус
  --------------|--------------|----------|-----------|-----------|-----------|--------------|-------------------
${stepTableRows}
================================================================================================
                                ИТОГОВАЯ ОЦЕНКА ЕМКОСТИ СЕРВЕРА
================================================================================================

  🏆 МАКСИМАЛЬНЫЙ УСТОЙЧИВЫЙ RPS (ТОЧКА ИЗЛОМА / BREAKPOINT):
  ----------------------------------------------------------------------------------------------
  • Реальный предел:           ${breakpointStep ? `${breakpointStep.actualRps.toFixed(1)} req/s` : '0.0 req/s'} (на ступени ${breakpointStep ? breakpointStep.targetRps : 'N/A'} req/s)
  • Задержки на пределе:       p50 = ${breakpointStep ? breakpointStep.p50 : 'N/A'} ms | p95 = ${breakpointStep ? breakpointStep.p95.toFixed(1) : 'N/A'} ms | p99 = ${breakpointStep ? breakpointStep.p99.toFixed(1) : 'N/A'} ms
  • Ошибок на пределе:         ${breakpointStep ? breakpointStep.failRate.toFixed(2) : 'N/A'}%
  • Rate Limit 429 за тест:    ${limitsHit}

  👥 ОЦЕНКА ОДНОВРЕМЕННЫХ ПОЛЬЗОВАТЕЛЕЙ (ОЦЕНКА ПО ЗАКОНУ ЛИТТЛА ОТ НАЙДЕННОГО RPS):
  ----------------------------------------------------------------------------------------------
  • Суперактивные (1 клик / 3 сек):       ~${activeOnline} пользователей онлайн
  • Обычное использование (1 клик / 7 сек): ~${normalOnline} пользователей онлайн
  • Спокойная сессия (1 клик / 15 сек):     ~${passiveOnline} пользователей онлайн
  * Примечание: оценка по закону Литтла (N = RPS_устойчивый × T_паузы) от реального предела сервера.

4. ДЕТАЛИЗАЦИЯ ОШИБОК ПО СТАТУСАМ И ОПЕРАЦИЯМ:
------------------------------------------------------------------------------------------------
${errorsSection}
5. ЗАКЛЮЧЕНИЕ:
------------------------------------------------------------------------------------------------
  ${conclusion}

6. ПОРОГ, ВЫЗВАВШИЙ ПРЕРЫВАНИЕ ТЕСТА (ABORT TRIGGER):
------------------------------------------------------------------------------------------------
${thresholdAbortSection}================================================================================================
`;

  return {
    stdout: textSummary,
    'loadtest-summary.json': JSON.stringify(data, null, 2),
  };
}

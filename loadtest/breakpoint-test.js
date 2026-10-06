import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

// Configuration from environment variables
const BASE_URL = __ENV.BASE_URL || __ENV.TARGET_URL || 'http://localhost:8080';
const STEP_DURATION_SEC = parseInt(__ENV.STEP_DURATION || '15', 10);
const STEPS_STR = __ENV.STEPS || '5,10,20,30,50,75,100';
const STEP_VUS = STEPS_STR.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0);
const MAX_VU_REQUIRED = Math.max(...STEP_VUS, 20);
const USERS_COUNT = parseInt(__ENV.USERS || String(MAX_VU_REQUIRED), 10);

// Build sequential scenarios
function buildScenarios() {
  const scenarios = {};
  let currentOffset = 0;

  for (let i = 0; i < STEP_VUS.length; i++) {
    const vus = STEP_VUS[i];
    const name = `step_${vus}_vus`;

    scenarios[name] = {
      executor: 'constant-vus',
      vus: vus,
      duration: `${STEP_DURATION_SEC}s`,
      startTime: `${currentOffset}s`,
      tags: { scenario_name: name, vus: String(vus) },
    };

    currentOffset += STEP_DURATION_SEC;
  }

  return scenarios;
}

function buildThresholds() {
  const thresholds = {};
  for (let i = 0; i < STEP_VUS.length; i++) {
    const vus = STEP_VUS[i];
    const name = `step_${vus}_vus`;
    thresholds[`http_req_duration{scenario:${name}}`] = [{ threshold: 'max>=0', abortOnFail: false }];
    thresholds[`http_reqs{scenario:${name}}`] = [{ threshold: 'count>=0', abortOnFail: false }];
    thresholds[`http_req_failed{scenario:${name}}`] = [{ threshold: 'rate<=1.0', abortOnFail: false }];
  }
  return thresholds;
}

export const options = {
  scenarios: buildScenarios(),
  thresholds: buildThresholds(),
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
};

function randomDate(daysBack = 30) {
  const d = new Date(Date.now() - Math.floor(Math.random() * daysBack) * 86400000);
  return d.toISOString().split('T')[0];
}

export function setup() {
  console.log(`=======================================================`);
  console.log(` Moodila Real User Simulation: Breakpoint Test`);
  console.log(` Target:         ${BASE_URL}`);
  console.log(` Steps (VUs):    ${STEP_VUS.join(' -> ')}`);
  console.log(` Step Duration:  ${STEP_DURATION_SEC}s each (Total ~${(STEP_VUS.length * STEP_DURATION_SEC)}s)`);
  console.log(` Sessions:       Initializing ${USERS_COUNT} unique user accounts...`);
  console.log(` User Actions:   Feed (40%), Calendar (30%), Profile (15%), Writes (15%)`);
  console.log(`=======================================================`);

  const sessions = [];

  for (let i = 0; i < USERS_COUNT; i++) {
    const credentials = {
      email: `loadtest_${i}@moodila.test`,
      password: 'Password123!',
      username: `loadtest_${i}`,
      display_name: `Load Bot ${i}`,
    };

    const params = {
      headers: { 'Content-Type': 'application/json' },
      timeout: '10s',
    };

    let res = http.post(`${BASE_URL}/auth/register`, JSON.stringify(credentials), params);

    if (res.status === 409 || res.status === 400) {
      res = http.post(
        `${BASE_URL}/auth/login`,
        JSON.stringify({
          email: credentials.email,
          password: credentials.password,
        }),
        params
      );
    }

    if (res.status === 200 || res.status === 201) {
      let accessToken = '';
      let csrfToken = '';

      try {
        const data = JSON.parse(res.body);
        csrfToken = data.csrf_token || '';
      } catch (_) {}

      const cookie = res.cookies && res.cookies.access_token;
      if (cookie && cookie.length > 0) {
        accessToken = cookie[0].value;
      }

      if (accessToken) {
        sessions.push({ accessToken, csrfToken, email: credentials.email });
      }
    }
  }

  console.log(`✅ Authenticated ${sessions.length}/${USERS_COUNT} test user sessions.`);

  if (sessions.length === 0) {
    console.warn(`⚠️ Warning: Authentication failed, will hit public endpoints.`);
  }

  return { sessions };
}

export default function (data) {
  const sessions = data && data.sessions ? data.sessions : [];
  let token = __ENV.AUTH_TOKEN || '';
  let csrf = '';

  if (sessions.length > 0) {
    const s = sessions[(__VU - 1) % sessions.length];
    token = s.accessToken;
    csrf = s.csrfToken;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Cookie': `access_token=${token}; csrf_token=${csrf}`,
  };

  const rand = Math.random();

  if (token) {
    if (rand < 0.40) {
      // 40%: Лента (SQL с JOIN'ами дружбы, приватности, реакций)
      const res = http.get(`${BASE_URL}/feed?limit=10&include_self=true`, {
        headers,
        tags: { name: 'Feed' },
      });
      const ok = check(res, { 'feed is 200': (r) => r.status === 200 });
      if (!ok) console.warn(`⚠️ Feed failed (HTTP ${res.status}): ${res.body}`);

    } else if (rand < 0.70) {
      // 30%: Календарь (агрегации месяца в БД)
      const month = new Date().toISOString().slice(0, 7);
      const res = http.get(`${BASE_URL}/entries/summary?month=${month}`, {
        headers,
        tags: { name: 'Calendar' },
      });
      const ok = check(res, { 'calendar is 200': (r) => r.status === 200 });
      if (!ok) console.warn(`⚠️ Calendar failed (HTTP ${res.status}): ${res.body}`);

    } else if (rand < 0.85) {
      // 15%: Профиль (чтение профиля, друзей)
      const res = http.get(`${BASE_URL}/users/me`, {
        headers,
        tags: { name: 'Profile' },
      });
      const ok = check(res, { 'profile is 200': (r) => r.status === 200 });
      if (!ok) console.warn(`⚠️ Profile failed (HTTP ${res.status}): ${res.body}`);

    } else {
      // 15%: Запись настроения (INSERT/UPDATE в PostgreSQL со случайными датами)
      const entryDate = randomDate(30);
      const writeHeaders = Object.assign({}, headers, { 'X-CSRF-Token': csrf });
      const payload = JSON.stringify({
        date: entryDate,
        mood: 1 + Math.floor(Math.random() * 5),
        tags: ['focus', 'diary'],
        text: `Mood updated at ${Date.now()}`,
      });

      const res = http.post(`${BASE_URL}/entries`, payload, {
        headers: writeHeaders,
        tags: { name: 'WriteEntry' },
      });
      const ok = check(res, { 'write entry is 200': (r) => r.status === 200 });
      if (!ok) console.warn(`⚠️ WriteEntry failed (HTTP ${res.status}): ${res.body}`);
    }
  } else {
    http.get(`${BASE_URL}/features`, { tags: { name: 'Features' } });
  }

  // Realistic human think time between clicks
  sleep(0.3 + Math.random() * 0.5);
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

export function handleSummary(data) {
  const stepResults = [];

  for (let i = 0; i < STEP_VUS.length; i++) {
    const vus = STEP_VUS[i];
    const scenarioName = `step_${vus}_vus`;

    const reqsMetric = getMetric(data.metrics, 'http_reqs', scenarioName);
    const durationMetric = getMetric(data.metrics, 'http_req_duration', scenarioName);
    const failedMetric = getMetric(data.metrics, 'http_req_failed', scenarioName);

    const totalReqs = reqsMetric && reqsMetric.values ? reqsMetric.values.count : 0;
    const rps = totalReqs > 0 ? (totalReqs / STEP_DURATION_SEC).toFixed(1) : '0.0';

    const failRateVal = failedMetric && failedMetric.values ? failedMetric.values.rate * 100 : 0;
    const failRate = failRateVal.toFixed(1);

    const durValues = durationMetric && durationMetric.values ? durationMetric.values : {};
    const avg = durValues.avg != null ? durValues.avg.toFixed(1) : 'N/A';
    const p50 = (durValues['p(50)'] != null ? durValues['p(50)'] : durValues.med) != null
      ? (durValues['p(50)'] != null ? durValues['p(50)'] : durValues.med).toFixed(1)
      : 'N/A';
    const p95 = durValues['p(95)'] != null ? durValues['p(95)'].toFixed(1) : 'N/A';
    const p99 = durValues['p(99)'] != null ? durValues['p(99)'].toFixed(1) : 'N/A';

    const p95Num = parseFloat(p95) || 0;
    const p99Num = parseFloat(p99) || 0;
    const rpsNum = parseFloat(rps) || 0;

    const activeUsers = Math.round(rpsNum * 3);
    const normalUsers = Math.round(rpsNum * 7);
    const passiveUsers = Math.round(rpsNum * 15);

    let status = '🟢 Норма';
    let isHealthy = false;
    let isBreaking = false;

    if (failRateVal > 5 || p95Num > 4000) {
      status = '🔴 Предел / Сбой';
      isBreaking = true;
    } else if (p95Num > 1000 || p99Num > 2500 || failRateVal > 1) {
      status = '🟠 Деградация';
    } else if (p95Num > 400 || p99Num > 900) {
      status = '🟡 Приемлемо';
      isHealthy = true;
    } else {
      status = '🟢 Комфортно';
      isHealthy = true;
    }

    stepResults.push({
      vus,
      rps: rpsNum,
      avg,
      p50,
      p95: p95Num,
      p99: p99Num,
      failRate: failRateVal,
      activeUsers,
      normalUsers,
      passiveUsers,
      status,
      isHealthy,
      isBreaking,
    });
  }

  // 1. Healthy Limit: Highest tier where failRate <= 1.0% AND p95 <= 700ms AND p99 <= 1800ms
  let healthyStep = stepResults[0];
  for (let i = 0; i < stepResults.length; i++) {
    const s = stepResults[i];
    if (s.failRate <= 1.0 && s.p95 <= 700 && s.p99 <= 1800 && s.rps > 0) {
      healthyStep = s;
    }
  }

  // 2. Physical Breaking Point: Highest RPS step before severe failure (> 10% errors)
  let maxRpsStep = stepResults[0];
  for (let i = 0; i < stepResults.length; i++) {
    const s = stepResults[i];
    if (s.rps > maxRpsStep.rps && s.failRate <= 10.0) {
      maxRpsStep = s;
    }
  }

  let tableRows = '';
  for (let i = 0; i < stepResults.length; i++) {
    const s = stepResults[i];
    const vusCol = String(s.vus).padEnd(5);
    const rpsCol = String(s.rps.toFixed(1)).padEnd(8);
    const avgCol = String(s.avg).padEnd(9);
    const p95Col = String(s.p95 > 0 ? s.p95.toFixed(1) : 'N/A').padEnd(9);
    const p99Col = String(s.p99 > 0 ? s.p99.toFixed(1) : 'N/A').padEnd(9);
    const failCol = (s.failRate.toFixed(1) + '%').padEnd(8);
    const usersCol = (`~${s.normalUsers} чел.`).padEnd(14);
    tableRows += `  ${vusCol} | ${rpsCol} | ${avgCol} | ${p95Col} | ${p99Col} | ${failCol} | ${usersCol} | ${s.status}\n`;
  }

  const textSummary = `
================================================================================================
          РАСШИРЕННЫЙ СТРЕСС-ТЕСТ: РЕАЛЬНЫЕ ЗАПРОСЫ В БАЗУ ДАННЫХ (BREAKPOINT)
================================================================================================
  Сценарии юзеров: Лента (40%), Календарь (30%), Профиль (15%), Создание записи (15%)

  VUs   | RPS      | Avg (ms)  | p95 (ms)  | p99 (ms)  | Ошибки   | Онлайн (норм)  | Статус
  ------|----------|-----------|-----------|-----------|----------|----------------|----------------
${tableRows}
================================================================================================
                                ИТОГОВЫЕ КРИТИЧЕСКИЕ ТОЧКИ
================================================================================================

  🏆 1. КОМФОРТНЫЙ РАБОЧИЙ ЛИМИТ (SLO базы данных - p95 <= 700ms, p99 <= 1800ms, 0% ошибок):
  ----------------------------------------------------------------------------------------------
  • Виртуальных ботов (VUs):     ${healthyStep.vus} VUs
  • Реальная пропускная способность: ${healthyStep.rps.toFixed(1)} req/s (RPS в базу)
  • Задержка ответа:              p50 = ${healthyStep.p50} ms | p95 = ${healthyStep.p95.toFixed(1)} ms | p99 = ${healthyStep.p99.toFixed(1)} ms
  • Ошибок в БД:                  ${healthyStep.failRate.toFixed(1)}%
  • РЕАЛЬНЫЕ ПОЛЬЗОВАТЕЛИ ОНЛАЙН:
      - Суперактивные (1 клик / 3 сек):       ~${healthyStep.activeUsers} чел. одновременно
      - Обычное использование (1 клик / 7 сек): ~${healthyStep.normalUsers} чел. одновременно
      - Спокойная сессия (1 клик / 15 сек):     ~${healthyStep.passiveUsers} чел. одновременно


  💥 2. ФИЗИЧЕСКИЙ МАКСИМУМ СИСТЕМЫ И БАЗЫ ДАННЫХ (Breaking / Saturation Point):
  ----------------------------------------------------------------------------------------------
  • Пиковый предел пропускной способности: ${maxRpsStep.rps.toFixed(1)} req/s (RPS) при ${maxRpsStep.vus} VUs
  • Задержка на пике:             p95 = ${maxRpsStep.p95.toFixed(1)} ms | p99 = ${maxRpsStep.p99.toFixed(1)} ms
  • Ошибок на пике:               ${maxRpsStep.failRate.toFixed(1)}%
  • Максимальная емкость онлайн:  ~${maxRpsStep.normalUsers} чел. онлайн (дальше пул базы захлебывается)
================================================================================================
`;

  return {
    stdout: textSummary,
    'breakpoint-summary.json': JSON.stringify(stepResults, null, 2),
  };
}

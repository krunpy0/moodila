import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

// Custom action metrics (Real User Simulation)
const feedDuration = new Trend('feed_duration', true);
const calendarDuration = new Trend('calendar_duration', true);
const profileDuration = new Trend('profile_duration', true);
const entryWriteDuration = new Trend('entry_write_duration', true);
const rateLimitHits = new Counter('rate_limit_hits');
const successRate = new Rate('success_rate');
const errorCount = new Counter('error_count');

// Configuration from environment variables
const BASE_URL = __ENV.BASE_URL || __ENV.TARGET_URL || 'http://localhost:8080';
const SCENARIO_TYPE = __ENV.SCENARIO || 'ramp'; // 'ramp', 'constant', 'smoke', 'arrival'
const MAX_VUS = parseInt(__ENV.MAX_VUS || '30', 10);
const USERS_COUNT = parseInt(__ENV.USERS || String(Math.max(MAX_VUS, 20)), 10);
const DURATION = __ENV.DURATION || '1m';

function getOptions() {
  const common = {
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
  };

  const defaultThresholds = {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:Feed}': ['p(95)<500'],
    'http_req_duration{name:Calendar}': ['p(95)<300'],
    'http_req_duration{name:WriteEntry}': ['p(95)<400'],
  };

  if (SCENARIO_TYPE === 'smoke') {
    return {
      ...common,
      vus: 1,
      duration: '15s',
      thresholds: defaultThresholds,
    };
  }

  if (SCENARIO_TYPE === 'constant') {
    return {
      ...common,
      vus: MAX_VUS,
      duration: DURATION,
      thresholds: defaultThresholds,
    };
  }

  // Open Model: Arrival Rate (avoids Coordinated Omission)
  if (SCENARIO_TYPE === 'arrival') {
    return {
      ...common,
      scenarios: {
        breakpoint: {
          executor: 'ramping-arrival-rate',
          startRate: parseInt(__ENV.START_RATE || '5', 10),
          timeUnit: '1s',
          preAllocatedVUs: parseInt(__ENV.PRE_VUS || '50', 10),
          maxVUs: parseInt(__ENV.MAX_VUS || '300', 10),
          stages: [
            { target: 20, duration: '30s' },
            { target: 50, duration: '30s' },
            { target: 100, duration: '30s' },
          ],
        },
      },
      thresholds: defaultThresholds,
    };
  }

  // Default: Progressive ramping to find saturation point
  return {
    ...common,
    stages: [
      { duration: '15s', target: Math.max(2, Math.floor(MAX_VUS * 0.2)) }, // Warmup
      { duration: '25s', target: Math.max(5, Math.floor(MAX_VUS * 0.6)) }, // Moderate load
      { duration: '30s', target: MAX_VUS },                                // Peak stress
      { duration: '15s', target: Math.max(2, Math.floor(MAX_VUS * 0.2)) }, // Cool down
      { duration: '5s',  target: 0 },                                      // Ramp to 0
    ],
    thresholds: defaultThresholds,
  };
}

export const options = getOptions();

function randomDate(daysBack = 30) {
  const d = new Date(Date.now() - Math.floor(Math.random() * daysBack) * 86400000);
  return d.toISOString().split('T')[0];
}

export function setup() {
  console.log(`=======================================================`);
  console.log(` Moodila Real User Simulation Load Test`);
  console.log(` Target:   ${BASE_URL}`);
  console.log(` Scenario: ${SCENARIO_TYPE} (Max VUs / Target: ${MAX_VUS})`);
  console.log(` Sessions: Initializing ${USERS_COUNT} unique user accounts...`);
  console.log(` Mode:     Full User Lifecycle (Feed, Calendar, Profile, Writes)`);
  console.log(`=======================================================`);

  const sessions = [];

  for (let i = 0; i < USERS_COUNT; i++) {
    const creds = {
      email: `loadtest_${i}@moodila.test`,
      password: 'Password123!',
      username: `loadtest_${i}`,
      display_name: `Load Bot ${i}`,
    };
    const params = {
      headers: { 'Content-Type': 'application/json' },
      timeout: '10s',
    };

    let res = http.post(`${BASE_URL}/auth/register`, JSON.stringify(creds), params);
    if (res.status === 409 || res.status === 400) {
      res = http.post(
        `${BASE_URL}/auth/login`,
        JSON.stringify({ email: creds.email, password: creds.password }),
        params
      );
    }

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
          email: creds.email,
        });
      }
    }
  }

  console.log(`✅ Authenticated ${sessions.length}/${USERS_COUNT} test user sessions.`);

  if (sessions.length === 0) {
    console.warn(`⚠️ Warning: No authenticated sessions obtained. Requests will fallback to public routes.`);
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
      // 40%: Лента записей (тяжелый SQL с JOIN'ами дружбы, приватности, лайков)
      const res = http.get(`${BASE_URL}/feed?limit=10&include_self=true`, {
        headers,
        tags: { name: 'Feed' },
      });
      feedDuration.add(res.timings.duration);
      if (res.status === 429) rateLimitHits.add(1);
      const ok = check(res, { 'feed is 200': (r) => r.status === 200 });
      if (!ok) { errorCount.add(1); successRate.add(false); } else { successRate.add(true); }

    } else if (rand < 0.70) {
      // 30%: Календарь за текущий месяц (чтение диапазона дат + агрегации)
      const month = new Date().toISOString().slice(0, 7);
      const res = http.get(`${BASE_URL}/entries/summary?month=${month}`, {
        headers,
        tags: { name: 'Calendar' },
      });
      calendarDuration.add(res.timings.duration);
      if (res.status === 429) rateLimitHits.add(1);
      const ok = check(res, { 'calendar is 200': (r) => r.status === 200 });
      if (!ok) { errorCount.add(1); successRate.add(false); } else { successRate.add(true); }

    } else if (rand < 0.85) {
      // 15%: Профиль пользователя (чтение юзера, последних записей, друзей)
      const res = http.get(`${BASE_URL}/users/me`, {
        headers,
        tags: { name: 'Profile' },
      });
      profileDuration.add(res.timings.duration);
      if (res.status === 429) rateLimitHits.add(1);
      const ok = check(res, { 'profile is 200': (r) => r.status === 200 });
      if (!ok) { errorCount.add(1); successRate.add(false); } else { successRate.add(true); }

    } else {
      // 15%: Создание / обновление записи дня (случайные даты для реальных INSERT и UPDATE)
      const entryDate = randomDate(30);
      const writeHeaders = Object.assign({}, headers, { 'X-CSRF-Token': csrf });
      const payload = JSON.stringify({
        date: entryDate,
        mood: 1 + Math.floor(Math.random() * 5),
        tags: ['focus', 'diary'],
        text: `Mood updated during simulation at ${Date.now()}`,
      });

      const res = http.post(`${BASE_URL}/entries`, payload, {
        headers: writeHeaders,
        tags: { name: 'WriteEntry' },
      });
      entryWriteDuration.add(res.timings.duration);
      if (res.status === 429) rateLimitHits.add(1);
      const ok = check(res, { 'write entry is 200': (r) => r.status === 200 });
      if (!ok) {
        console.warn(`⚠️ WriteEntry failed (HTTP ${res.status}): ${res.body}`);
        errorCount.add(1);
        successRate.add(false);
      } else {
        successRate.add(true);
      }
    }
  } else {
    // Fallback if not logged in: features
    const res = http.get(`${BASE_URL}/features`, { tags: { name: 'Features' } });
    check(res, { 'features is 200': (r) => r.status === 200 });
  }

  // In arrival-rate mode, the executor controls the request pace.
  // In closed VU-based mode, simulate realistic pacing between user actions.
  if (SCENARIO_TYPE !== 'arrival') {
    sleep(0.3 + Math.random() * 0.5);
  }
}

function fmt(metric) {
  if (!metric || !metric.values) return 'N/A';
  const v = metric.values;
  const p50 = (v['p(50)'] != null ? v['p(50)'] : v.med) != null ? (v['p(50)'] != null ? v['p(50)'] : v.med).toFixed(1) : 'N/A';
  const p95 = v['p(95)'] != null ? v['p(95)'].toFixed(1) : 'N/A';
  const p99 = v['p(99)'] != null ? v['p(99)'].toFixed(1) : 'N/A';
  return `p50=${p50.padStart(5)}ms | p95=${p95.padStart(6)}ms | p99=${p99.padStart(6)}ms`;
}

// Pretty summary formatter
export function handleSummary(data) {
  const reqTotal = data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0;
  const reqRate = data.metrics.http_reqs ? data.metrics.http_reqs.values.rate.toFixed(1) : '0.0';
  const duration = data.metrics.http_req_duration ? data.metrics.http_req_duration.values : {};
  const failRate = data.metrics.http_req_failed ? (data.metrics.http_req_failed.values.rate * 100).toFixed(2) : '0.00';
  const limitsHit = data.metrics.rate_limit_hits ? data.metrics.rate_limit_hits.values.count : 0;

  const min = duration.min != null ? duration.min.toFixed(1) : 'N/A';
  const p50 = (duration['p(50)'] != null ? duration['p(50)'] : duration.med) != null
    ? (duration['p(50)'] != null ? duration['p(50)'] : duration.med).toFixed(1)
    : 'N/A';
  const p90 = duration['p(90)'] != null ? duration['p(90)'].toFixed(1) : 'N/A';
  const p95 = duration['p(95)'] != null ? duration['p(95)'].toFixed(1) : 'N/A';
  const p99 = duration['p(99)'] != null ? duration['p(99)'].toFixed(1) : 'N/A';
  const avg = duration.avg != null ? duration.avg.toFixed(1) : 'N/A';
  const max = duration.max != null ? duration.max.toFixed(1) : 'N/A';

  const activeUsers = Math.round(parseFloat(reqRate) * 3);
  const normalUsers = Math.round(parseFloat(reqRate) * 7);
  const passiveUsers = Math.round(parseFloat(reqRate) * 15);

  let diagnosis = '🟢 База данных и сервер работают стабильно без сбоев.';
  if (parseFloat(failRate) > 5) {
    diagnosis = '🔴 Высокий процент ошибок (>5%). Пул базы данных или процессор перегружен.';
  } else if (parseFloat(p95) > 1000) {
    diagnosis = '🟡 Задержки базы данных выросли: p95 > 1 сек из-за очереди запросов в PostgreSQL.';
  } else if (parseFloat(p95) > 400) {
    diagnosis = '🟠 Умеренная нагрузка на БД: p95 в районе 400-800 мс.';
  }

  const textSummary = `
================================================================================
          РЕЗУЛЬТАТЫ СТРЕСС-ТЕСТИРОВАНИЯ (РЕАЛЬНАЯ СИМУЛЯЦИЯ ПОЛЬЗОВАТЕЛЯ)
================================================================================
  Всего операций с БД:  ${reqTotal}
  Реальный RPS:         ${reqRate} req/s (бизнес-запросы в БД)
  Ошибок (HTTP != 2xx): ${failRate}%
  Rate Limit 429:       ${limitsHit}

--------------------------- ОБЩЕЕ ВРЕМЯ ОТВЕТА (Latency) -----------------------
  Минимум (Min):        ${min} ms
  Среднее (Avg):        ${avg} ms
  Медиана (p50):        ${p50} ms
  90-й перцентиль (p90): ${p90} ms
  95-й перцентиль (p95): ${p95} ms
  99-й перцентиль (p99): ${p99} ms
  Максимум (Max):       ${max} ms

-------------------- ДЕТАЛИЗАЦИЯ ПО ОПЕРАЦИЯМ В БАЗЕ ДАННЫХ --------------------
  • Лента друзей (Feed - 40%):    ${fmt(data.metrics.feed_duration)}
  • Календарь (Calendar - 30%):   ${fmt(data.metrics.calendar_duration)}
  • Профиль юзера (Profile - 15%): ${fmt(data.metrics.profile_duration)}
  • Запись дня (Write Entry - 15%): ${fmt(data.metrics.entry_write_duration)}

-------------------- ОЦЕНКА ОДНОВРЕМЕННЫХ ПОЛЬЗОВАТЕЛЕЙ (Concurrent) ----------
  Суперактивные (1 клик / 3 сек):       ~${activeUsers} чел. онлайн
  Обычное использование (1 клик / 7 сек): ~${normalUsers} чел. онлайн
  Спокойная сессия (1 клик / 15 сек):     ~${passiveUsers} чел. онлайн

--------------------------------- ЗАКЛЮЧЕНИЕ -----------------------------------
  ${diagnosis}
================================================================================
`;

  return {
    stdout: textSummary,
    'loadtest-summary.json': JSON.stringify(data, null, 2),
  };
}

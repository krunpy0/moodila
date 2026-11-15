import http from 'k6/http';
import { sleep } from 'k6';
import execution from 'k6/execution';
import { Counter, Rate, Trend } from 'k6/metrics';
import { actions, operations, outcomes, config, userSample, summarize, formatReport } from './model.mjs';

const c = config(__ENV);
const stand = JSON.parse(__ENV.STAND_METADATA || 'null');
const ready = new Counter('ready_users'), measured = new Counter('measured_users');
const finished = new Counter('finished_users'), windowUsers = new Counter('window_users');
const requestFinishes = new Counter('request_finishes'), actionFinishes = new Counter('action_finishes');
const requestsDrained = new Counter('requests_drained'), actionsDrained = new Counter('actions_drained');
const requestOutcomes = new Counter('request_outcomes');
const requestsStarted = new Counter('requests_started'), requestsCompleted = new Counter('requests_completed');
const requestDuration = new Trend('request_duration', true), requestOK = new Rate('request_ok');
const actionsStarted = new Counter('actions_started'), actionsCompleted = new Counter('actions_completed');
const actionDuration = new Trend('action_duration', true), actionOK = new Rate('action_ok');
const authOK = new Rate('auth_ok');
const generatorLag = new Trend('generator_lag', true);
const thresholds = { auth_ok: ['rate==1'] };
for (const op of operations) {
  thresholds[`request_duration{op:${op}}`] = [`p(95)<=${c.p95}`];
  thresholds[`request_ok{op:${op}}`] = [`rate>=${1 - c.errorRate}`];
  thresholds[`requests_completed{op:${op}}`] = ['count>=0'];
  thresholds[`request_finishes{op:${op}}`] = ['count>=0'];
  thresholds[`actions_completed{op:${op}}`] = ['count>=0'];
  thresholds[`action_duration{op:${op}}`] = ['p(95)>=0'];
  thresholds[`action_ok{op:${op}}`] = ['rate>=0'];
}
for (const outcome of outcomes) thresholds[`request_outcomes{outcome:${outcome}}`] = ['count>=0'];
for (let i = 0; i < Math.ceil(c.duration / 60); i++) {
  for (const name of ['window_users', 'request_finishes', 'action_finishes']) thresholds[`${name}{window:${i}}`] = ['count>=0'];
  thresholds[`actions_completed{window:${i}}`] = ['count>=0'];
  thresholds[`action_duration{window:${i}}`] = [`p(95)<=${c.actionP95}`];
  thresholds[`action_ok{window:${i}}`] = [`rate>=${1 - c.errorRate}`];
  for (const op of operations) {
    thresholds[`request_duration{op:${op},window:${i}}`] = [`p(95)<=${c.p95}`];
    thresholds[`request_ok{op:${op},window:${i}}`] = [`rate>=${1 - c.errorRate}`];
    thresholds[`requests_completed{op:${op},window:${i}}`] = ['count>=0'];
  }
}
export const options = {
  // A refresh plus a two-request action can take three 15-second timeouts.
  scenarios: { capacity: { executor: 'constant-vus', vus: c.ccu, duration: `${c.warmup + c.duration}s`, gracefulStop: '46s' } },
  noCookiesReset: true, thresholds, setupTimeout: '30s',
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

export function setup() {
  const res = http.get(`${c.baseUrl}/health`, { timeout: '10s', tags: { phase: 'setup', name: 'health' } });
  if (res.status !== 200 || res.json('db') !== 'connected') throw new Error('API/database is not ready');
  return { users: userSample(c.totalUsers, c.ccu, c.seed), fixtureDate: stand?.fixture?.date || new Date().toISOString().slice(0, 10) };
}

let bot, fixtureDate, csrf = '', refreshAt = 0, first = true, participated = false, ended = false, actionIndex = 0, cursor = '';
const visitedWindows = new Set();
const elapsed = () => (Date.now() - execution.scenario.startTime) / 1000;
const json = res => { try { return res.json(); } catch (_) { return null; } };
function recordFinish(metric, tags = {}) {
  const seconds = elapsed() - c.warmup;
  if (seconds >= 0 && seconds < c.duration) metric.add(1, { ...tags, window: String(Math.floor(seconds / 60)) });
}
function finishMeasurement() {
  if (!ended && elapsed() >= c.warmup + c.duration) { finished.add(1); ended = true; }
}

function authenticate(refresh = false) {
  const res = http.post(`${c.baseUrl}/auth/${refresh ? 'refresh' : 'login'}`, refresh ? null : JSON.stringify({
    email: `loadtest_${bot}@moodila.test`, password: 'Password123!',
  }), { headers: { 'Content-Type': 'application/json' }, timeout: '15s', tags: { phase: 'session', name: refresh ? 'refresh' : 'login' } });
  const body = json(res);
  const ok = res.status === 200 && typeof body?.csrf_token === 'string' && !!body.csrf_token;
  authOK.add(ok);
  if (ok) { csrf = body.csrf_token; refreshAt = Date.now() + 10 * 60 * 1000; }
  return ok;
}

function request(op, method, path, body, validate, track, window) {
  const tags = { op, window: String(window), name: op, phase: track ? 'measure' : 'warmup' };
  if (track) requestsStarted.add(1, tags);
  const start = Date.now();
  const res = http.request(method, `${c.baseUrl}${path}`, body == null ? null : JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'X-Time-Zone': 'UTC' }, timeout: '15s', tags,
  });
  const result = json(res), ok = res.status === 200 && !!validate(result);
  recordFinish(requestFinishes, { op });
  if (track) {
    if (elapsed() >= c.warmup + c.duration) requestsDrained.add(1);
    requestsCompleted.add(1, tags);
    requestDuration.add(Date.now() - start, tags);
    requestOK.add(ok, tags);
    const outcome = ok ? 'ok' : res.status === 0 ? 'transport_error' : res.status === 200 ? 'invalid_response'
      : res.status === 429 ? 'rate_limited' : res.status >= 500 ? 'http_5xx' : res.status >= 400 ? 'http_4xx' : 'http_other';
    requestOutcomes.add(1, { ...tags, outcome });
  }
  return { ok, body: result };
}

function perform(op, track, window) {
  const get = (name, path, validate) => request(name, 'GET', path, null, validate, track, window);
  const page = body => body && Array.isArray(body.items) && (body.next_cursor == null || typeof body.next_cursor === 'string');
  const month = new Date(Date.now() - (actionIndex % 12) * 30 * 86400000).toISOString().slice(0, 7);
  switch (op) {
    case 'feed': {
      const res = get(op, '/feed?limit=10&include_self=true', page);
      if (res.ok) cursor = res.body.next_cursor || '';
      return res.ok;
    }
    case 'pagination': {
      if (!cursor) {
        const firstPage = get('feed', '/feed?limit=10&include_self=true', page);
        if (!firstPage.ok) return false;
        if (!firstPage.body.next_cursor) return true;
        cursor = firstPage.body.next_cursor;
      }
      const res = get(op, `/feed?limit=10&include_self=true&cursor=${encodeURIComponent(cursor)}`, page);
      if (res.ok) cursor = res.body.next_cursor || '';
      return res.ok;
    }
    case 'calendar': {
      const summary = get(op, `/entries/summary?month=${month}`, body => body && Number.isInteger(body.entry_count));
      const entries = get(op, `/entries/me?month=${month}`, body => Array.isArray(body));
      return summary.ok && entries.ok;
    }
    case 'profile': return get(op, '/users/me', body => body && typeof body.user?.id === 'string').ok;
    case 'notifications': return get(op, '/notifications/unread-count', body => body && Number.isInteger(body.unread_count)).ok;
    case 'search': return get(op, '/entries/search?q=diary', body => body && Array.isArray(body.entries)).ok;
    case 'stats': {
      const summary = get(op, '/stats?scope=summary', body => body && Number.isInteger(body.total_entries));
      const series = get(op, '/stats?scope=series&period=month', body => body && Array.isArray(body.mood_series));
      return summary.ok && series.ok;
    }
    case 'write': {
      // Update a seeded day: repeated steps must not grow entries/notifications.
      const daysBack = bot % 5 === 0 ? actionIndex % 201 : (actionIndex % 15) * 24 + bot % 23;
      const date = new Date(Date.parse(`${fixtureDate}T00:00:00Z`) - daysBack * 86400000).toISOString().slice(0, 10);
      return request(op, 'POST', '/entries', { date, mood: 3, tags: ['work'], text: 'Daily diary entry for loadtest.' },
        body => body && typeof body.id === 'string' && body.date === date, track, window).ok;
    }
  }
  throw new Error(`Unknown action ${op}`);
}

export default function (data) {
  if (first) {
    first = false;
    bot = data.users[execution.vu.idInTest - 1];
    fixtureDate = data.fixtureDate;
    if (bot == null) throw new Error('Each VU requires its own seeded account');
    actionIndex = execution.vu.idInTest % actions.length;
    sleep((execution.vu.idInTest - 1) / c.ccu * c.warmup * 0.5);
    if (authenticate() && elapsed() < c.warmup) ready.add(1);
  }
  const now = elapsed();
  finishMeasurement();
  if (now >= c.warmup + c.duration) { sleep(1); return; }
  const track = now >= c.warmup, window = Math.floor(Math.max(0, now - c.warmup) / 60);
  if (track && !participated) { measured.add(1); participated = true; }
  if (track && !visitedWindows.has(window)) { windowUsers.add(1, { window: String(window) }); visitedWindows.add(window); }
  const op = actions[actionIndex++ % actions.length];
  const tags = { op, window: String(window) };
  if (track) actionsStarted.add(1, tags);
  const started = Date.now();
  const session = csrf && Date.now() < refreshAt ? true : authenticate(!!csrf);
  const ok = session && perform(op, track, window);
  recordFinish(actionFinishes);
  if (track) {
    if (elapsed() >= c.warmup + c.duration) actionsDrained.add(1);
    actionsCompleted.add(1, tags);
    actionDuration.add(Date.now() - started, tags);
    actionOK.add(ok, tags);
  }
  const pause = Math.min(c.think * (0.5 + Math.random()), Math.max(0, c.warmup + c.duration - elapsed())), sleepStarted = Date.now();
  sleep(pause);
  if (track) generatorLag.add(Math.max(0, Date.now() - sleepStarted - pause * 1000));
  finishMeasurement();
}

export function handleSummary(data) {
  const result = summarize(data, c);
  const report = {
    version: 3, generatedAt: new Date().toISOString(), config: c,
    revision: __ENV.REVISION || 'unknown', stand,
    result,
    // Never persist setup_data or cookies/tokens.
    metrics: data.metrics,
  };
  const reportPath = __ENV.REPORT_PATH || 'loadtest-result.json';
  const readable = formatReport(result, c);
  return {
    stdout: readable,
    [`${reportPath}.txt`]: readable,
    [reportPath]: JSON.stringify(report, null, 2),
  };
}

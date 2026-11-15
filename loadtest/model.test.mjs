import test from 'node:test';
import assert from 'node:assert/strict';
import { config, operations, userSample, summarize, formatReport } from './model.mjs';

function fixture() {
  const c = config({ SEPARATE_GENERATOR: 'true' });
  const metrics = {};
  const set = (name, values) => { metrics[name] = { values }; };
  set('generator_lag', { 'p(99)': 2 });
  set('auth_ok', { rate: 1 });
  for (const name of ['ready_users', 'measured_users', 'finished_users']) set(name, { count: c.ccu });
  for (const name of ['requests_started', 'requests_completed', 'actions_started', 'actions_completed']) set(name, { count: 1000 });
  set('request_finishes', { count: 1000 });
  set('action_finishes', { count: 1000 });
  for (const op of operations) {
    set(`requests_completed{op:${op}}`, { count: 100 });
    set(`request_duration{op:${op}}`, { 'p(95)': 50 });
    set(`request_ok{op:${op}}`, { rate: 1 });
  }
  for (let i = 0; i < c.duration / 60; i++) {
    set(`window_users{window:${i}}`, { count: c.ccu });
    set(`actions_completed{window:${i}}`, { count: 200 });
    set(`action_duration{window:${i}}`, { 'p(95)': 100 });
    set(`action_ok{window:${i}}`, { rate: 1 });
    for (const op of operations) {
      set(`requests_completed{op:${op},window:${i}}`, { count: 20 });
      set(`request_duration{op:${op},window:${i}}`, { 'p(95)': 50 });
      set(`request_ok{op:${op},window:${i}}`, { rate: 1 });
    }
  }
  return { c, data: { metrics, state: { testRunDurationMs: (c.duration + c.warmup) * 1000 } } };
}

test('seeded user sampling is unique, repeatable and does not alias active users', () => {
  const sample = userSample(20000, 200, 42);
  assert.deepEqual(sample, userSample(20000, 200, 42));
  assert.equal(new Set(sample).size, 200);
  assert.ok(sample.filter(i => i % 5 === 0).length > 20);
  assert.ok(sample.filter(i => i % 5 === 0).length < 60);
});

test('full healthy measurement passes without converting RPS into CCU', () => {
  const { c, data } = fixture();
  const result = summarize(data, c);
  assert.equal(result.status, 'passed');
  assert.equal(result.ccu, 25);
  assert.equal(result.rps, 1000 / 300);
});

test('same-machine generator with dedicated CPUs can establish capacity', () => {
  const { data } = fixture();
  const c = config({ ISOLATED_GENERATOR: 'true' });
  assert.equal(summarize(data, c).status, 'passed');
});

test('short quick assessment is preliminary and still enforces SLO', () => {
  const { data } = fixture();
  const c = config({ SCENARIO: 'quick', MEASURE_SECONDS: '30', WARMUP_SECONDS: '10', ISOLATED_GENERATOR: 'true' });
  data.state.testRunDurationMs = 40000;
  const result = summarize(data, c);
  assert.equal(result.status, 'passed');
  assert.equal(result.evidence, 'preliminary');
  data.metrics['request_duration{op:stats}'].values['p(95)'] = 301;
  assert.equal(summarize(data, c).status, 'failed');
  assert.throws(() => config({ SCENARIO: 'quick', MEASURE_SECONDS: '15' }));
});

for (const [name, mutate] of [
  ['manual interruption', ({ data }) => { data.state.testRunDurationMs = 90000; }],
  ['interruption during drain despite enough wall time', ({ data }) => { data.state.testRunDurationMs += 10000; data.metrics.finished_users.values.count--; }],
  ['dropped iterations', ({ data }) => { data.metrics.dropped_iterations = { values: { count: 1000 } }; }],
  ['generator scheduling lag', ({ data }) => { data.metrics.generator_lag.values['p(99)'] = 251; }],
  ['missing users', ({ data }) => { data.metrics.measured_users.values.count--; }],
  ['user disappearing in the final minute', ({ data }) => { data.metrics['window_users{window:4}'].values.count--; }],
  ['late authentication', ({ data }) => { data.metrics.ready_users.values.count--; }],
  ['unfinished requests', ({ data }) => { data.metrics.requests_started.values.count++; }],
  ['unfinished actions', ({ data }) => { data.metrics.actions_started.values.count++; }],
  ['too few samples', ({ data }) => { data.metrics['requests_completed{op:feed}'].values.count = 1; }],
  ['missing latency', ({ data }) => { delete data.metrics['request_duration{op:feed}']; }],
  ['missing time window', ({ data }) => { delete data.metrics['action_duration{window:4}']; }],
  ['unisolated generator', ({ c }) => { c.generatorIsolated = false; }],
  ['smoke run', ({ c }) => { c.smoke = true; }],
]) {
  test(`${name} cannot establish capacity`, () => {
    const f = fixture(); mutate(f);
    assert.equal(summarize(f.data, f.c).status, 'invalid');
  });
}

for (const [name, key, values] of [
  ['slow operation hidden among fast ones', 'request_duration{op:stats}', { 'p(95)': 301 }],
  ['operation degrading in final minute', 'request_duration{op:stats,window:4}', { 'p(95)': 301 }],
  ['refresh failure', 'auth_ok', { rate: 0.99 }],
  ['semantic errors with HTTP 200', 'request_ok{op:feed}', { rate: 0.98 }],
  ['slow final minute', 'action_duration{window:4}', { 'p(95)': 1501 }],
  ['errors in final minute', 'action_ok{window:4}', { rate: 0.98 }],
  ['self-throttled users', 'actions_completed{window:4}', { count: 1 }],
]) {
  test(`${name} fails the level`, () => {
    const { c, data } = fixture(); data.metrics[key].values = values;
    assert.equal(summarize(data, c).status, 'failed');
  });
}

test('partial run uses elapsed time and never invents an abort reason', () => {
  const { c, data } = fixture(); data.state.testRunDurationMs = 90000;
  const result = summarize(data, c);
  assert.equal(result.measuredSeconds, 30);
  assert.equal(result.rps, 1000 / 30);
  assert.equal(result.failures.length, 0);
  assert.ok(result.invalid.some(s => s.includes('interrupted')));
});

test('throughput excludes drained requests and detailed statistics preserve measured values', () => {
  const { c, data } = fixture();
  data.metrics.requests_completed.values.count = 1010;
  data.metrics.requests_started.values.count = 1010;
  data.metrics.request_finishes.values.count = 990;
  data.metrics.action_finishes.values.count = 980;
  data.metrics.request_duration = { values: { avg: 42, min: 2, med: 30, 'p(90)': 60, 'p(95)': 75, 'p(99)': 90, max: 500 } };
  data.metrics.request_ok = { values: { rate: 1009 / 1010, passes: 1009, fails: 1 } };
  data.metrics['request_outcomes{outcome:rate_limited}'] = { values: { count: 1 } };
  data.metrics['request_finishes{window:0}'] = { values: { count: 180 } };
  const result = summarize(data, c);
  assert.equal(result.status, 'passed');
  assert.equal(result.rps, 990 / 300);
  assert.equal(result.actionsPerSecond, 980 / 300);
  assert.equal(result.requests.samples, 1010);
  assert.equal(result.requests.completedInInterval, 990);
  assert.equal(result.requests.errors, 1);
  assert.equal(result.requests.p50Ms, 30);
  assert.equal(result.requests.p99Ms, 90);
  assert.equal(result.requests.outcomes.rate_limited, 1);
  assert.equal(result.windows[0].rps, 3);
  assert.equal(result.windows[0].users, c.ccu);
  assert.equal(result.windows[0].byOperation.feed.samples, 20);
  const readable = formatReport(result, c);
  assert.match(readable, /CCU 25: PASSED/);
  assert.match(readable, /p50\s+p90\s+p95\s+p99/);
  assert.match(readable, /rate_limited=1/);
  assert.equal(readable.includes('NaN'), false);
});

test('invalid configuration stops before sending traffic', () => {
  for (const env of [{ CCU: 'NaN' }, { CCU: '1.5' }, { CCU: '20001' }, { SCENARIO: 'ramp' }, { ERROR_THRESHOLD: '1' }, { THINK_SECONDS: '0' }, { SEED: '2147483647' }, { MEASURE_SECONDS: '301' }, { BASE_URL: 'http://user:password@localhost' }]) {
    assert.throws(() => config(env));
  }
});

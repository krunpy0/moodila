export const actions = ['feed', 'calendar', 'feed', 'notifications', 'pagination', 'calendar', 'feed', 'stats', 'feed', 'write', 'calendar', 'feed', 'pagination', 'profile', 'feed', 'stats', 'calendar', 'search', 'feed', 'notifications'];
export const operations = [...new Set(actions)];
export const outcomes = ['ok', 'invalid_response', 'transport_error', 'rate_limited', 'http_4xx', 'http_5xx', 'http_other'];

export function config(env) {
  const quick = env.SCENARIO === 'quick';
  const number = (key, fallback, min, integer = false) => {
    const value = Number(env[key] ?? fallback);
    if (!Number.isFinite(value) || value < min || (integer && !Number.isInteger(value))) throw new Error(`Invalid ${key}`);
    return value;
  };
  const c = {
    baseUrl: (env.BASE_URL || 'http://localhost:8080').replace(/\/$/, ''),
    ccu: number('CCU', 25, 1, true), totalUsers: number('TOTAL_SEEDED_USERS', 20000, 1, true),
    seed: number('SEED', 42, 1, true), warmup: number('WARMUP_SECONDS', 60, 1, true),
    duration: number('MEASURE_SECONDS', 300, 1, true), think: number('THINK_SECONDS', 7, 0.1),
    p95: number('P95_THRESHOLD', 300, 1), actionP95: number('ACTION_P95_THRESHOLD', 1500, 1),
    errorRate: number('ERROR_THRESHOLD', 0.01, 0), minSamples: number('MIN_SAMPLES', quick ? 5 : 20, 1, true),
    quick,
    generatorIsolated: env.ISOLATED_GENERATOR === 'true' || env.SEPARATE_GENERATOR === 'true', smoke: env.SCENARIO === 'smoke',
  };
  if (env.SCENARIO && !['ccu', 'quick', 'smoke'].includes(env.SCENARIO)) throw new Error('SCENARIO must be ccu, quick or smoke; RPS-to-CCU conversion was removed');
  if (c.ccu > c.totalUsers || c.errorRate >= 1 || c.seed > 2147483646) throw new Error('Invalid user pool, seed or error threshold');
  if (!/^https?:\/\/[^/?#@\s]+(?:\/[^?#\s]*)?$/.test(c.baseUrl)) throw new Error('Invalid BASE_URL');
  if (!c.smoke && !c.quick && c.duration % 60 !== 0) throw new Error('MEASURE_SECONDS must be a multiple of 60 for complete measurement windows');
  if (c.quick && c.duration < 30) throw new Error('Quick assessment requires >=30 measured seconds');
  return c;
}

// Seeded shuffle avoids aliasing the active-user rule (bot_idx % 5 === 0).
export function userSample(total, count, seed) {
  const users = Array.from({ length: total }, (_, i) => i);
  let state = seed;
  for (let i = total - 1; i > 0; i--) {
    state = (state * 16807) % 2147483647;
    const j = state % (i + 1);
    [users[i], users[j]] = [users[j], users[i]];
  }
  return users.slice(0, count);
}

export function summarize(data, c) {
  const metrics = data.metrics || {};
  const values = name => metrics[name]?.values || {};
  const count = name => values(name).count || 0;
  const invalid = [], failures = [];
  const elapsed = data.state?.testRunDurationMs / 1000;
  const complete = Number.isFinite(elapsed) && elapsed >= c.warmup + c.duration && count('finished_users') === c.ccu;
  if (!complete) invalid.push('Measurement interrupted or not every user finished the measurement interval');
  if (count('ready_users') !== c.ccu) invalid.push('Not every unique user authenticated before measurement');
  if (count('measured_users') !== c.ccu) invalid.push('Not every unique user participated in measurement');
  if (count('requests_started') !== count('requests_completed')) invalid.push('Requests were interrupted');
  if (count('actions_started') !== count('actions_completed')) invalid.push('User actions were interrupted');
  if (count('dropped_iterations')) invalid.push('Generator dropped iterations');
  if (!Number.isFinite(values('generator_lag')['p(99)']) || values('generator_lag')['p(99)'] > 250) invalid.push('Generator scheduling lag missing or p99 exceeds 250 ms');
  if (values('auth_ok').rate !== 1) failures.push('Authentication or session refresh failed');
  if (!c.generatorIsolated) invalid.push('Generator CPU isolation not established');
  if (c.smoke || (!c.quick && c.duration < 300)) invalid.push('Diagnostic run: capacity requires at least 300 measured seconds');
  const measuredSeconds = Number.isFinite(elapsed) ? Math.max(0, Math.min(c.duration, elapsed - c.warmup)) : 0;
  const perSecond = n => measuredSeconds ? n / measuredSeconds : null;
  const stats = (counter, trend, rate) => {
    const n = count(counter), latency = values(trend), success = values(rate);
    return {
      samples: n, errors: success.fails ?? null,
      errorRate: success.rate == null ? null : 1 - success.rate,
      avgMs: latency.avg ?? null, minMs: latency.min ?? null, p50Ms: latency.med ?? null,
      p90Ms: latency['p(90)'] ?? null, p95Ms: latency['p(95)'] ?? null,
      p99Ms: latency['p(99)'] ?? null, maxMs: latency.max ?? null,
    };
  };
  const byOperation = {};
  for (const op of operations) {
    const tag = `{op:${op}}`;
    const samples = count(`requests_completed${tag}`);
    const latency = values(`request_duration${tag}`)['p(95)'];
    const errors = values(`request_ok${tag}`).rate;
    byOperation[op] = {
      ...stats(`requests_completed${tag}`, `request_duration${tag}`, `request_ok${tag}`),
      rps: perSecond(count(`request_finishes${tag}`)),
      requestShare: count('requests_completed') ? samples / count('requests_completed') : null,
      actions: { ...stats(`actions_completed${tag}`, `action_duration${tag}`, `action_ok${tag}`),
        share: count('actions_completed') ? count(`actions_completed${tag}`) / count('actions_completed') : null },
    };
    if (samples < c.minSamples || !Number.isFinite(latency) || !Number.isFinite(errors)) invalid.push(`Insufficient samples: ${op}`);
    else {
      if (latency > c.p95) failures.push(`${op}: request p95 exceeds ${c.p95} ms`);
      if (1 - errors > c.errorRate + 1e-12) failures.push(`${op}: errors exceed ${c.errorRate}`);
    }
  }
  // A fast start must not hide degradation at the end of the run.
  const windows = [];
  for (let i = 0; i < Math.ceil(c.duration / 60); i++) {
    const seconds = Math.min(60, c.duration - i * 60), tag = `{window:${i}}`;
    const completed = count(`actions_completed${tag}`), p95 = values(`action_duration${tag}`)['p(95)'];
    const ok = values(`action_ok${tag}`).rate;
    const minimumActions = Math.floor(0.7 * c.ccu * seconds / (c.think + c.actionP95 / 1000));
    const observedSeconds = Math.max(0, Math.min(seconds, measuredSeconds - i * 60));
    const users = count(`window_users${tag}`);
    const byOperation = {};
    windows.push({ index: i, seconds, observedSeconds, users, requests: count(`request_finishes${tag}`),
      rps: observedSeconds ? count(`request_finishes${tag}`) / observedSeconds : null,
      actionsPerSecond: observedSeconds ? count(`action_finishes${tag}`) / observedSeconds : null,
      actions: completed, minimumActions, ...stats(`actions_completed${tag}`, `action_duration${tag}`, `action_ok${tag}`), byOperation });
    if (users !== c.ccu) invalid.push(`Not every user participated in window ${i}`);
    if (!Number.isFinite(p95) || !Number.isFinite(ok)) invalid.push(`Missing measurement window ${i}`);
    else {
      if (completed < minimumActions) failures.push(`Window ${i}: user activity fell below the model's minimum`);
      if (p95 > c.actionP95) failures.push(`Window ${i}: action p95 exceeds ${c.actionP95} ms`);
      if (1 - ok > c.errorRate + 1e-12) failures.push(`Window ${i}: action errors exceed ${c.errorRate}`);
    }
    for (const op of operations) {
      const suffix = `{op:${op},window:${i}}`;
      const n = count(`requests_completed${suffix}`), latency = values(`request_duration${suffix}`)['p(95)'];
      const success = values(`request_ok${suffix}`).rate;
      byOperation[op] = stats(`requests_completed${suffix}`, `request_duration${suffix}`, `request_ok${suffix}`);
      if (n < 5 || !Number.isFinite(latency) || !Number.isFinite(success)) invalid.push(`Insufficient samples: ${op} in window ${i}`);
      else if (latency > c.p95 || 1 - success > c.errorRate + 1e-12) failures.push(`Window ${i}: ${op} breached request SLO`);
    }
  }
  return {
    status: invalid.length ? 'invalid' : failures.length ? 'failed' : 'passed',
    ccu: c.ccu, evidence: c.smoke ? 'diagnostic' : c.quick ? 'preliminary' : 'sustained', complete, measuredSeconds,
    rps: perSecond(count('request_finishes')),
    actionsPerSecond: perSecond(count('action_finishes')),
    sessions: { requested: c.ccu, ready: count('ready_users'), participating: count('measured_users'), finished: count('finished_users') },
    requests: { ...stats('requests_completed', 'request_duration', 'request_ok'),
      completedInInterval: count('request_finishes'), drainedAfterInterval: count('requests_drained'), started: count('requests_started'),
      outcomes: Object.fromEntries(outcomes.map(outcome => [outcome, count(`request_outcomes{outcome:${outcome}}`)])) },
    actions: { ...stats('actions_completed', 'action_duration', 'action_ok'),
      completedInInterval: count('action_finishes'), drainedAfterInterval: count('actions_drained'), started: count('actions_started') },
    generatorLag: { p95Ms: values('generator_lag')['p(95)'] ?? null, p99Ms: values('generator_lag')['p(99)'] ?? null, maxMs: values('generator_lag').max ?? null },
    invalid, failures, byOperation, windows,
    interpretation: 'Active authenticated API sessions for this workload and think time; excludes browser rendering, idle accounts and media uploads; not a universal hardware limit',
  };
}

export function formatReport(result, c) {
  const n = value => Number.isFinite(value) ? value.toFixed(1) : '-';
  const pct = value => Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : '-';
  const table = rows => {
    const widths = rows[0].map((_, i) => Math.max(...rows.map(row => String(row[i]).length)));
    return rows.map(row => row.map((cell, i) => String(cell).padEnd(widths[i])).join('  ')).join('\n');
  };
  const session = result.sessions;
  return [
    `CCU ${c.ccu}: ${result.status.toUpperCase()} (${result.evidence}) | ${result.measuredSeconds.toFixed(1)}s measured | think ${c.think}s`,
    `Users: ${session.ready} ready / ${session.participating} participating / ${session.finished} finished (target ${session.requested})`,
    `Throughput: ${n(result.rps)} HTTP req/s | ${n(result.actionsPerSecond)} actions/s | ${result.requests.completedInInterval} HTTP completions in interval`,
    `Completed after interval: ${result.requests.drainedAfterInterval} HTTP requests / ${result.actions.drainedAfterInterval} actions (excluded from throughput)`,
    'Request latency by operation (ms; samples/errors are for actions started during measurement, including their drain):',
    table([
      ['Operation', 'Requests', 'Actions', 'RPS', 'Errors', 'Avg', 'p50', 'p90', 'p95', 'p99', 'Max'],
      ...Object.entries(result.byOperation).map(([op, s]) => [op, s.samples, s.actions.samples, n(s.rps), pct(s.errorRate), n(s.avgMs), n(s.p50Ms), n(s.p90Ms), n(s.p95Ms), n(s.p99Ms), n(s.maxMs)]),
    ]),
    'Measurement windows (HTTP RPS by completion time; action latency by start time):',
    table([
      ['Window', 'Users', 'HTTP req', 'RPS', 'Actions/s', 'Actions', 'Min actions', 'Action p95', 'Action p99', 'Errors'],
      ...result.windows.map(w => [w.index + 1, w.users, w.requests, n(w.rps), n(w.actionsPerSecond), w.actions, w.minimumActions, n(w.p95Ms), n(w.p99Ms), pct(w.errorRate)]),
    ]),
    `HTTP outcomes: ${Object.entries(result.requests.outcomes).map(([key, value]) => `${key}=${value}`).join(' | ')}`,
    `Generator scheduling lag: p99 ${n(result.generatorLag.p99Ms)} ms | max ${n(result.generatorLag.maxMs)} ms`,
    ...[...result.invalid, ...result.failures].map(reason => `  - ${reason}`),
    'Low sample counts give unstable tail percentiles; a passing run is an observed result, not a statistical guarantee.',
    result.interpretation, '',
  ].join('\n');
}

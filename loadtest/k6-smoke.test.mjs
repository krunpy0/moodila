import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('real k6 verifies sessions, contracts, warmup, drain and the native Windows runner', { skip: !process.env.K6, timeout: 60000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'moodila k6-'));
  const users = new Set(); let badCookies = 0, badCSRF = 0, writes = 0, malformed = false;
  let delayed = false, healthAt = 0;
  const server = createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('Content-Type', 'application/json');
    const send = body => res.end(JSON.stringify(body));
    if (url.pathname === '/health') { healthAt = Date.now(); return send({ db: 'connected' }); }
    if (url.pathname === '/auth/login') {
      const email = JSON.parse(raw).email; users.add(email);
      res.setHeader('Set-Cookie', [`access_token=${email}; HttpOnly; Path=/`, `refresh_token=${email}; HttpOnly; Path=/`]);
      return send({ csrf_token: email });
    }
    const cookie = (req.headers.cookie || '').match(/access_token=([^;]+)/)?.[1];
    if (!users.has(cookie)) { badCookies++; res.statusCode = 401; return send({ error: 'cookie missing' }); }
    if (delayed && Date.now() - healthAt >= 4000) await new Promise(resolve => setTimeout(resolve, 2000));
    switch (url.pathname) {
      case '/feed': return send({ items: [{ id: 'entry' }], next_cursor: 'cursor' });
      case '/entries/summary': return send(malformed ? { wrong: 'HTTP 200 with wrong schema' } : { entry_count: 15 });
      case '/entries/me': return send([]);
      case '/users/me': return send({ user: { id: cookie } });
      case '/notifications/unread-count': return send({ unread_count: 0 });
      case '/entries/search': return send({ entries: [] });
      case '/stats': return send({ total_entries: 15, mood_series: [] });
      case '/entries': {
        writes++;
        if (req.headers['x-csrf-token'] !== cookie) badCSRF++;
        return send({ id: 'entry', date: JSON.parse(raw).date });
      }
      default: res.statusCode = 404; send({ error: 'unexpected route' });
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const path = join(dir, 'report.json');
    const args = ['run', 'loadtest/load-test.js'];
    for (const [key, value] of Object.entries({ BASE_URL: `http://127.0.0.1:${server.address().port}`, CCU: 4, WARMUP_SECONDS: 1, MEASURE_SECONDS: 6, THINK_SECONDS: 0.1, MIN_SAMPLES: 1, SCENARIO: 'smoke', REPORT_PATH: path })) args.push('-e', `${key}=${value}`);
    const run = async (executable, argv) => {
      let output = '';
      const child = spawn(executable, argv, { cwd: new URL('..', import.meta.url), env: { ...process.env, K6_NO_USAGE_REPORT: 'true' } });
      child.stdout.on('data', chunk => { output += chunk; });
      child.stderr.on('data', chunk => { output += chunk; });
      const exit = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
      return { exit, output };
    };
    const { exit, output } = await run(process.env.K6, args);
    assert.equal(exit, 0, output);
    const report = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(users.size, 4); assert.equal(badCookies, 0); assert.equal(badCSRF, 0); assert.ok(writes > 0);
    assert.equal(report.result.status, 'invalid'); assert.equal(report.result.complete, true);
    assert.equal(report.metrics.ready_users.values.count, 4);
    assert.equal(report.metrics.measured_users.values.count, 4);
    assert.equal(report.metrics.finished_users.values.count, 4);
    assert.equal(report.result.windows[0].users, 4);
    assert.equal(report.result.rps, report.metrics.request_finishes.values.count / 6);
    assert.equal(report.result.requests.outcomes.ok, report.result.requests.samples);
    assert.equal(report.result.requests.errors, 0);
    assert.ok(report.result.byOperation.calendar.p99Ms >= 0);
    assert.ok(report.result.byOperation.calendar.actions.samples > 0);
    assert.equal(report.result.byOperation.calendar.actions.errorRate, 0);
    assert.match(await readFile(`${path}.txt`, 'utf8'), /Measurement windows/);
    assert.equal(report.metrics.request_ok.values.rate, 1);
    for (const op of Object.values(report.result.byOperation)) assert.ok(op.samples > 0);
    assert.equal('setup_data' in report, false);
    assert.equal(JSON.stringify(report).includes('access_token'), false);
    assert.ok(report.metrics.http_reqs.values.count > report.metrics.requests_completed.values.count);
    malformed = true;
    const bad = await run(process.env.K6, args);
    assert.equal(bad.exit, 99, bad.output);
    const badReport = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(badReport.metrics['request_ok{op:calendar}'].values.rate, 0.5);
    assert.ok(badReport.result.requests.outcomes.invalid_response > 0);
    assert.ok(badReport.result.failures.some(s => s.includes('calendar')));
    malformed = false;
    delayed = true;
    const slow = await run(process.env.K6, args);
    assert.equal(slow.exit, 99, slow.output);
    const slowReport = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(slowReport.result.complete, true);
    assert.equal(slowReport.result.sessions.finished, 4);
    assert.ok(slowReport.result.requests.drainedAfterInterval > 0);
    assert.ok(slowReport.result.actions.drainedAfterInterval > 0);
    assert.equal(slowReport.result.rps, slowReport.metrics.request_finishes.values.count / 6);
    delayed = false;
    if (process.platform === 'win32') {
      const manifest = join(dir, 'stand.json'), campaign = join(dir, 'campaign');
      await writeFile(manifest, JSON.stringify({ version: 2, fixture: { users: 20000, entries: 1363740 }, note: 'quotes and spaces survive' }));
      const q = s => `'${s.replaceAll("'", "''")}'`;
      const command = `& ./loadtest/run.ps1 -Smoke -BaseUrl http://127.0.0.1:${server.address().port} -Steps 4 -WarmupSeconds 1 -MeasureSeconds 6 -ThinkSeconds 0.1 -StandManifest ${q(manifest)} -K6 ${q(process.env.K6)} -OutputDir ${q(campaign)}`;
      const runner = await run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command]);
      assert.equal(runner.exit, 1, runner.output);
      const nativeReport = JSON.parse(await readFile(join(campaign, 'ccu-4-repeat-1.json'), 'utf8'));
      assert.equal(nativeReport.stand.note, 'quotes and spaces survive');
      assert.equal(nativeReport.result.complete, true);
      assert.equal(nativeReport.metrics.request_ok.values.rate, 1);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});

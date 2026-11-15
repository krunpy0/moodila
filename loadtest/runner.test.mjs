import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const execute = promisify(execFile);
const quote = s => `'${s.replaceAll("'", "''")}'`;

for (const mode of ['failed', 'invalid', 'no-report', 'passed', 'quick']) {
  test(`runner preserves verified levels when next level is ${mode}`, { skip: process.platform !== 'win32', timeout: 30000 }, async () => {
    const dir = await mkdtemp(join(tmpdir(), 'moodila-runner-'));
    try {
      const fake = join(dir, 'fake-k6.ps1'), manifest = join(dir, 'stand.json'), output = join(dir, 'results');
      await writeFile(manifest, JSON.stringify({ version: 2, fixture: { users: 20000, entries: 1363740 } }));
      await writeFile(fake, `
$settings = @{}
for ($i=0; $i -lt $args.Count; $i++) { if ($args[$i] -eq '-e') { $key, $value = $args[++$i] -split '=', 2; $settings[$key] = $value } }
$status = 'passed'
if ([int]$settings.CCU -ge 50) { $status = '${mode === 'quick' ? 'failed' : mode}' }
if ($status -eq 'no-report') { exit 2 }
@{ result = @{ status = $status; scenario = $settings.SCENARIO; warmup = [int]$settings.WARMUP_SECONDS; duration = [int]$settings.MEASURE_SECONDS } } | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $settings.REPORT_PATH -Encoding UTF8
if ($status -eq 'failed') { exit 99 }
exit 0
`);
      const command = `& ${quote(resolve('loadtest/run.ps1'))} ${mode === 'quick' ? '-Quick' : ''} -BaseUrl http://example.test:8080 -SeparateGenerator -Steps @(25,50,100) -StandManifest ${quote(manifest)} -K6 ${quote(fake)} -OutputDir ${quote(output)}`;
      let exit = 0;
      try { await execute('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command]); }
      catch (error) { exit = error.code; }
      const report = JSON.parse((await readFile(join(output, 'capacity.json'), 'utf8')).replace(/^\uFEFF/, ''));
      assert.equal(exit, mode === 'passed' ? 0 : 1);
      assert.equal(report.maxVerifiedCCU, mode === 'quick' ? null : mode === 'passed' ? 100 : mode === 'failed' ? 43 : 25);
      assert.equal(report.maxEstimatedCCU, mode === 'quick' ? 25 : null);
      assert.equal(report.firstFailedCCU, ['failed', 'quick'].includes(mode) ? 50 : null);
      assert.equal(report.invalidRun, ['invalid', 'no-report'].includes(mode));
      assert.equal(report.runs.length, mode === 'quick' ? 2 : mode === 'passed' ? 6 : mode === 'failed' ? 7 : 3);
      assert.equal(report.runs[0].ccu, 25);
      assert.equal(report.runs[0].result.scenario, mode === 'quick' ? 'quick' : 'ccu');
      assert.equal(report.runs[0].result.warmup, mode === 'quick' ? 10 : 60);
      assert.equal(report.runs[0].result.duration, mode === 'quick' ? 30 : 300);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
}

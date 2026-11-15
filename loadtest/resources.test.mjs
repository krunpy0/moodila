import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

test('resource budget defaults, overrides and CPU isolation', { skip: process.platform !== 'win32' }, async () => {
  const path = resolve('loadtest/resources.ps1').replaceAll("'", "''");
  const script = `
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. '${path}'
$valid = @(
  (Get-LoadtestResources -AvailableCpus 4 -ReserveGenerator),
  (Get-LoadtestResources -AvailableCpus 4 -Cpus 2 -Ram 2g -ReserveGenerator),
  (Get-LoadtestResources -AvailableCpus 4 -ApiMem 700m -ReserveGenerator),
  (Get-LoadtestResources -AvailableCpus 4 -ApiMem 450m -DbMem 450m),
  (Get-LoadtestResources -AvailableCpus 4 -Cpus 2 -Cpuset '1,3' -Ram 1.5g -ReserveGenerator)
)
$invalid = @(
  @{ Cpus = 0 }, @{ Cpus = 5 }, @{ Cpus = 4; ReserveGenerator = $true },
  @{ Cpus = 2; Cpuset = '0,0' }, @{ Cpus = 2; Cpuset = '0' }, @{ Cpuset = '4' },
  @{ Ram = '1t' }, @{ Ram = '-1g' }, @{ Ram = '1g'; ApiMem = '800m'; DbMem = '800m' },
  @{ Ram = '1g'; ApiMem = '2g' }
)
$rejected = @($invalid | ForEach-Object {
  try { $null = Get-LoadtestResources -AvailableCpus 4 @_ ; $false } catch { $true }
})
@{ valid = $valid; rejected = $rejected } | ConvertTo-Json -Depth 5
`;
  const { stdout } = await promisify(execFile)('powershell.exe', ['-NoProfile', '-Command', script]);
  const { valid, rejected } = JSON.parse(stdout);
  assert.equal(valid[0].Cpus, 1);
  assert.equal(valid[0].RamBytes, 1024 ** 3);
  assert.equal(valid[0].ApiBytes, 512 * 1024 ** 2);
  assert.equal(valid[0].DbBytes, 512 * 1024 ** 2);
  assert.equal(valid[0].Cpuset, '0');
  assert.equal(valid[0].GeneratorCpuset, '1,2,3');
  assert.equal(valid[1].Cpuset, '0,1');
  assert.equal(valid[1].GeneratorCpuset, '2,3');
  assert.equal(valid[1].ApiBytes + valid[1].DbBytes, 2 * 1024 ** 3);
  assert.equal(valid[2].DbBytes, 324 * 1024 ** 2);
  assert.equal(valid[3].ApiBytes + valid[3].DbBytes, 900 * 1024 ** 2);
  assert.equal(valid[4].GeneratorCpuset, '0,2');
  assert.equal(valid[4].RamBytes, 1.5 * 1024 ** 3);
  assert.equal(rejected.length, 10);
  assert.ok(rejected.every(Boolean));
});

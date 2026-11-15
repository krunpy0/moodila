[CmdletBinding()]
param (
    [switch]$PrepareStand,
    [string]$BaseUrl = '',
    [string]$StandManifest = '',
    [switch]$SeparateGenerator,
    [switch]$Smoke,
    [switch]$Quick,
    [int[]]$Steps = @(25, 50, 100, 200, 400, 800),
    [int]$WarmupSeconds = 60,
    [int]$MeasureSeconds = 300,
    [double]$ThinkSeconds = 7,
    [int]$Repeats = 2,
    [int]$Resolution = 10,
    [int]$Cpus = 1,
    [string]$Ram = '1g',
    [string]$Cpuset = '',
    [string]$ApiMem = '',
    [string]$DbMem = '',
    [string]$K6 = 'k6',
    [string]$OutputDir = '',
    [switch]$DisableRateLimit = $true
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$repo = Split-Path $PSScriptRoot -Parent
Set-Location $repo
$exitCode = 0
$localRun = -not $BaseUrl -and -not $PrepareStand
$generatorCpuset = ''
. (Join-Path $PSScriptRoot 'resources.ps1')
$isQuick = $Quick -and -not $Smoke
$thorough = -not $Quick -and -not $Smoke
if ($Quick -or $Smoke) {
    if (-not $PSBoundParameters.ContainsKey('Steps')) { $Steps = @(50, 200, 800) }
    if (-not $PSBoundParameters.ContainsKey('WarmupSeconds')) { $WarmupSeconds = 10 }
    if (-not $PSBoundParameters.ContainsKey('MeasureSeconds')) { $MeasureSeconds = 30 }
    if (-not $PSBoundParameters.ContainsKey('Repeats')) { $Repeats = 1 }
}

function Invoke-Checked([string]$Executable, [string[]]$Arguments) {
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Executable failed (exit $LASTEXITCODE)" }
}

try {
    if (-not $PrepareStand) {
        if ($WarmupSeconds -lt 1 -or $MeasureSeconds -lt 1 -or $ThinkSeconds -le 0 -or $Repeats -lt 1 -or $Resolution -lt 1) { throw 'Invalid timing/repeat/resolution parameters' }
        if (-not $Steps.Count -or ($Steps | Where-Object { $_ -lt 1 -or $_ -gt 20000 })) { throw 'CCU steps must be within 1..20000' }
        for ($i = 1; $i -lt $Steps.Count; $i++) { if ($Steps[$i] -le $Steps[$i - 1]) { throw 'CCU steps must be strictly increasing' } }
        if ($thorough -and ($MeasureSeconds -lt 300 -or $Repeats -lt 2 -or $MeasureSeconds % 60 -ne 0)) { throw 'Thorough capacity test requires >=300 measured seconds (multiple of 60) and >=2 repeats' }
        if ($isQuick -and $MeasureSeconds -lt 30) { throw 'Quick assessment requires >=30 measured seconds' }
    }
    if (-not $OutputDir) { $OutputDir = Join-Path $PSScriptRoot ('results/' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff')) }
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    $OutputDir = (Resolve-Path -LiteralPath $OutputDir).Path
    $revision = (& git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot determine Git revision' }
    $dirty = [bool](& git status --porcelain)

    if ($localRun -or $PrepareStand) {
        $cpuText = & docker info --format '{{.NCPU}}'
        if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop, then run this command again' }
        $cpuCount = [int]$cpuText
        $runningGenerator = & docker ps --filter 'name=^/moodila-k6-loadtest$' --format '{{.Names}}'
        if ($LASTEXITCODE -ne 0) { throw 'Cannot check running load tests' }
        if ($runningGenerator) { throw 'A test is already running. Stop its terminal with Ctrl+C before starting another test.' }
        $resources = Get-LoadtestResources -AvailableCpus $cpuCount -Cpus $Cpus -Ram $Ram -Cpuset $Cpuset -ApiMem $ApiMem -DbMem $DbMem -ReserveGenerator:$localRun
        $Cpuset = $resources.Cpuset
        $generatorCpuset = $resources.GeneratorCpuset
        $ApiMem = $resources.ApiBytes.ToString([Globalization.CultureInfo]::InvariantCulture)
        $DbMem = $resources.DbBytes.ToString([Globalization.CultureInfo]::InvariantCulture)
        Write-Host "Target: $Cpus vCPU on CPUs $Cpuset | RAM: $($resources.ApiBytes / 1MB) MiB API + $($resources.DbBytes / 1MB) MiB DB (budget $Ram)."
        if ($localRun) { Write-Host "k6: CPUs $generatorCpuset, separate 1 GiB RAM." }
    }
    if ($PrepareStand -or $localRun) {
        $env:CPUSET = $Cpuset
        $env:API_MEM = $ApiMem
        $env:DB_MEM = $DbMem
        $env:GOMAXPROCS = $Cpus.ToString()
        $env:DISABLE_RATE_LIMIT = $DisableRateLimit.IsPresent.ToString().ToLowerInvariant()
        Invoke-Checked -Executable docker -Arguments @('compose', '-f', 'docker-compose.loadtest.yml', 'up', '-d', '--build')
        $healthy = $false
        for ($i = 0; $i -lt 90; $i++) {
            try {
                $health = Invoke-RestMethod 'http://localhost:8080/health' -TimeoutSec 2
                if ($health.db -eq 'connected') { $healthy = $true; break }
            } catch { }
            Start-Sleep -Seconds 1
        }
        if (-not $healthy) { throw 'Loadtest API/database failed readiness check' }
        $api = (& docker inspect moodila-api-loadtest | ConvertFrom-Json)[0]
        $db = (& docker inspect moodila-postgres-loadtest | ConvertFrom-Json)[0]
        $seedHash = (Get-FileHash (Join-Path $PSScriptRoot 'seed.sql') -Algorithm SHA256).Hash
        $countsQuery = "SELECT json_build_object('date',CURRENT_DATE,'users',(SELECT count(*) FROM users),'entries',(SELECT count(*) FROM entries),'friendships',(SELECT count(*) FROM friendships),'comments',(SELECT count(*) FROM comments),'reactions',(SELECT count(*) FROM likes))"
        $reused = $false
        if ($isQuick -and $localRun -and (Test-Path (Join-Path $PSScriptRoot 'results'))) {
            $previousFile = Get-ChildItem (Join-Path $PSScriptRoot 'results') -Filter stand.json -Recurse | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
            if ($previousFile) {
                $previous = Get-Content -LiteralPath $previousFile.FullName -Raw | ConvertFrom-Json
                if ($previous.PSObject.Properties['seedHash'] -and $previous.seedHash -eq $seedHash -and $previous.apiImage -eq $api.Image -and $previous.dbImage -eq $db.Image) {
                    $countsJson = & docker exec moodila-postgres-loadtest psql -X -At -U postgres -d moodila_loadtest -c $countsQuery
                    if ($LASTEXITCODE -ne 0) { throw 'Cannot verify existing fixture' }
                    $counts = $countsJson | ConvertFrom-Json
                    if ($counts.users -eq 20000 -and $counts.entries -eq 1363740) {
                        $reused = $true; $counts.date = $previous.fixture.date
                        Write-Host 'Reusing existing test data (image, seed hash and row counts checked).'
                    }
                }
            }
        }
        if (-not $reused) {
            Get-Content (Join-Path $PSScriptRoot 'seed.sql') -Raw -Encoding UTF8 | & docker exec -i moodila-postgres-loadtest psql -X -v ON_ERROR_STOP=1 -U postgres -d moodila_loadtest
            if ($LASTEXITCODE -ne 0) { throw 'Seeding failed; no benchmark was started' }
            $countsJson = & docker exec moodila-postgres-loadtest psql -X -At -U postgres -d moodila_loadtest -c $countsQuery
            if ($LASTEXITCODE -ne 0) { throw 'Cannot verify fixture' }
            $counts = $countsJson | ConvertFrom-Json
        }
        if ($counts.users -ne 20000 -or $counts.entries -ne 1363740) { throw 'Unexpected fixture counts' }
        if ($api.HostConfig.CpusetCpus -ne $Cpuset -or $db.HostConfig.CpusetCpus -ne $Cpuset -or $api.HostConfig.Memory -ne $resources.ApiBytes -or $db.HostConfig.Memory -ne $resources.DbBytes -or $api.HostConfig.MemorySwap -ne $resources.ApiBytes -or $db.HostConfig.MemorySwap -ne $resources.DbBytes) { throw 'Container resource limits were not applied' }
        $manifest = [ordered]@{
            version = 2; preparedAt = [DateTime]::UtcNow.ToString('o'); revision = $revision; dirty = $dirty
            fixture = $counts; fixtureVersion = 2; rateLimitDisabled = $DisableRateLimit.IsPresent
            seedHash = $seedHash; fixtureReused = $reused
            requestedLimits = [ordered]@{ vcpu = $Cpus; ramBytes = $resources.RamBytes }
            apiImage = $api.Image; dbImage = $db.Image
            apiLimits = $api.HostConfig | Select-Object CpusetCpus, Memory, MemorySwap
            dbLimits = $db.HostConfig | Select-Object CpusetCpus, Memory, MemorySwap
        }
        $path = Join-Path $OutputDir 'stand.json'
        $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $path -Encoding UTF8
        Write-Host "Stand ready: $path. Test containers remain running."
        if ($localRun) { $StandManifest = $path; $BaseUrl = 'http://127.0.0.1:8080' }
    }
    if (-not $PrepareStand) {
        if (-not $BaseUrl) { throw '-BaseUrl is required; benchmark a dedicated test stand only' }
        $metadata = $null
        if ($StandManifest) {
            $metadata = Get-Content -LiteralPath $StandManifest -Raw | ConvertFrom-Json
            if ($metadata.version -ne 2 -or $metadata.fixture.users -ne 20000 -or $metadata.fixture.entries -ne 1363740) { throw 'Invalid stand manifest' }
        } elseif (-not $Smoke) { throw '-StandManifest is required for capacity measurements' }
        if (-not $Smoke -and -not ($localRun -or $SeparateGenerator)) { throw 'Capacity requires isolated generator CPUs (default local mode)' }
        if ($SeparateGenerator -and ([uri]$BaseUrl).IsLoopback) { throw 'Loopback URL cannot attest a separate generator' }
        if ($Smoke) { $Steps = @($Steps[0]); $Repeats = 1 }
        if ($localRun) {
            $metadata | Add-Member -NotePropertyName generator -NotePropertyValue ([ordered]@{ mode = 'local-docker'; cpuset = $generatorCpuset; memoryBytes = 1073741824 }) -Force
        }
        # JSON in native Windows argv can lose quotes; inherit it through the environment.
        $env:STAND_METADATA = if ($metadata) { $metadata | ConvertTo-Json -Depth 8 -Compress } else { 'null' }
        $runs = @(); $lastPassed = $null; $firstFailed = $null; $stoppedInvalid = $false
        $pending = New-Object 'System.Collections.Generic.Queue[int]'
        foreach ($step in $Steps) { $pending.Enqueue($step) }
        while ($pending.Count -gt 0) {
            $ccu = $pending.Dequeue()
            $stepWarmup = $WarmupSeconds
            if ($isQuick -and -not $PSBoundParameters.ContainsKey('WarmupSeconds')) { $stepWarmup = [math]::Max(10, [math]::Ceiling($ccu * 0.1)) }
            Write-Host "CCU $ccu | warmup ${stepWarmup}s + measurement ${MeasureSeconds}s x $Repeats | mode: $(if ($isQuick) { 'quick estimate' } else { 'confirmation' })"
            $stepPassed = $true
            for ($repeat = 1; $repeat -le $Repeats; $repeat++) {
                $reportPath = Join-Path $OutputDir "ccu-$ccu-repeat-$repeat.json"
                if (Test-Path -LiteralPath $reportPath) { throw "Refusing to overwrite $reportPath" }
                $scriptPath = if ($localRun) { '/scripts/load-test.js' } else { Join-Path $PSScriptRoot 'load-test.js' }
                $k6Args = @('run', $scriptPath)
                $settings = [ordered]@{
                    BASE_URL = $BaseUrl; CCU = $ccu; SCENARIO = $(if ($Smoke) { 'smoke' } elseif ($isQuick) { 'quick' } else { 'ccu' })
                    WARMUP_SECONDS = $stepWarmup; MEASURE_SECONDS = $MeasureSeconds
                    THINK_SECONDS = $ThinkSeconds.ToString([Globalization.CultureInfo]::InvariantCulture)
                    SEPARATE_GENERATOR = $SeparateGenerator.IsPresent.ToString().ToLowerInvariant()
                    ISOLATED_GENERATOR = $localRun.ToString().ToLowerInvariant()
                    REPORT_PATH = $(if ($localRun) { '/results/' + (Split-Path $reportPath -Leaf) } else { $reportPath }); REVISION = $revision
                }
                foreach ($key in $settings.Keys) { $k6Args += @('-e', "$key=$($settings[$key])") }
                if ($localRun) {
                    $dockerArgs = @('run', '--rm', '--name', 'moodila-k6-loadtest', '--cpuset-cpus', $generatorCpuset,
                        '--memory', '1g', '--memory-swap', '1g', '--network', 'container:moodila-api-loadtest',
                        '--env', 'STAND_METADATA', '--env', 'K6_NO_USAGE_REPORT=true',
                        '--mount', "type=bind,source=$PSScriptRoot,target=/scripts,readonly",
                        '--mount', "type=bind,source=$OutputDir,target=/results", 'grafana/k6:1.4.0') + $k6Args
                    & docker @dockerArgs
                } else { & $K6 @k6Args }
                $runExit = $LASTEXITCODE
                if (Test-Path -LiteralPath $reportPath) {
                    $result = (Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json).result
                } else {
                    $result = [pscustomobject]@{ status = 'invalid'; invalid = @("k6 exited $runExit without a report; capacity unknown") }
                }
                $runs += [ordered]@{ ccu = $ccu; repeat = $repeat; exitCode = $runExit; result = $result; report = $reportPath }
                if ($result.status -ne 'passed' -or $runExit -ne 0) {
                    $stepPassed = $false
                    if ($result.status -eq 'failed' -and $runExit -in @(0, 99)) { $firstFailed = $ccu }
                    else { $stoppedInvalid = $true }
                    break
                }
            }
            if ($stepPassed) { $lastPassed = $ccu }
            if ($stoppedInvalid) { break }
            if ($firstFailed) {
                $pending.Clear()
                if (-not $isQuick -and $lastPassed -and $firstFailed - $lastPassed -gt $Resolution) {
                    $pending.Enqueue([int][math]::Floor(($lastPassed + $firstFailed) / 2))
                }
            }
        }
        $summary = [ordered]@{
            version = 2; generatedAt = [DateTime]::UtcNow.ToString('o'); revision = $revision; dirty = $dirty; stand = $metadata
            mode = $(if ($isQuick) { 'quick' } elseif ($Smoke) { 'smoke' } else { 'thorough' })
            maxVerifiedCCU = $(if (-not $isQuick) { $lastPassed } else { $null })
            maxEstimatedCCU = $(if ($isQuick) { $lastPassed } else { $null })
            firstFailedCCU = $firstFailed; invalidRun = $stoppedInvalid
            resolutionCCU = $Resolution
            interpretation = $(if ($isQuick) { 'Preliminary assessment only: short single runs cannot establish sustained capacity. Run without -Quick to confirm the estimated level.' } else { 'Last level passing every repeat; first failed level brackets this workload only. If all levels pass, capacity is at least maxVerifiedCCU. Invalid runs do not establish an upper bound.' })
            runs = $runs
        }
        $summary | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath (Join-Path $OutputDir 'capacity.json') -Encoding UTF8
        Write-Host "$(if ($isQuick) { 'Estimated' } else { 'Verified' }) CCU: $lastPassed | First failed CCU: $firstFailed | Invalid run: $stoppedInvalid"
        Write-Host "Report: $(Join-Path $OutputDir 'capacity.json')"
        if ($firstFailed -or $stoppedInvalid) { $exitCode = 1 }
    }
} catch {
    Write-Error $_ -ErrorAction Continue
    $exitCode = 1
}
exit $exitCode

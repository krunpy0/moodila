param (
    [string]$Cpus = "",
    [string]$Mem = "",
    [string]$ApiCpus = "",
    [string]$DbCpus = "",
    [string]$ApiMem = "",
    [string]$DbMem = "",
    [string]$PostgresImage = "postgres:latest",
    [string]$DbDataVolume = "",
    [switch]$Seed,
    [switch]$Extended,
    [int]$VUs = 150,
    [int]$Users = 1500,
    [double]$LoginShare = 0.02,
    [string]$Duration = "1m",
    [string]$Scenario = "ramp",
    [string]$Steps = "10,25,50,100,150,200,300",
    [string]$StepDuration = "120",
    [string]$AuthToken = "",
    [switch]$KeepRunning
)

$ErrorActionPreference = "Stop"

# Helper to convert memory string (e.g. "1024M", "1G", "512MB") to MB
function Convert-ToMb ([string]$memStr) {
    if (-not $memStr) { return 0 }
    $clean = $memStr.Trim().ToUpper()
    if ($clean.EndsWith("GB") -or $clean.EndsWith("G")) {
        $num = [double]($clean -replace '[^0-9.]', '')
        return [int]($num * 1024)
    }
    if ($clean.EndsWith("MB") -or $clean.EndsWith("M")) {
        $num = [double]($clean -replace '[^0-9.]', '')
        return [int]$num
    }
    $num = [double]($clean -replace '[^0-9.]', '')
    return [int]$num
}

# 1. Calculate CPU limits for API and DB
if ($ApiCpus -and $DbCpus) {
    # Both explicitly given
} elseif ($ApiCpus -and -not $DbCpus) {
    $DbCpus = $ApiCpus
} elseif ($DbCpus -and -not $ApiCpus) {
    $ApiCpus = $DbCpus
} elseif ($Cpus) {
    $totalCpu = [double]$Cpus
    $apiVal = [Math]::Round($totalCpu * 0.5, 2)
    $dbVal = [Math]::Round($totalCpu - $apiVal, 2)
    $ApiCpus = "$apiVal"
    $DbCpus = "$dbVal"
} else {
    $ApiCpus = "0.25"
    $DbCpus = "0.25"
}

# 2. Calculate RAM limits for API and DB
if ($ApiMem -and $DbMem) {
    # Both explicitly given
} elseif ($ApiMem -and -not $DbMem) {
    $DbMem = $ApiMem
} elseif ($DbMem -and -not $ApiMem) {
    $ApiMem = $DbMem
} elseif ($Mem) {
    $totalMb = Convert-ToMb $Mem
    $halfMb = [int]($totalMb / 2)
    $ApiMem = "${halfMb}M"
    $DbMem = "${halfMb}M"
} else {
    $ApiMem = "512M"
    $DbMem = "512M"
}

# 3. Calculate optimal GOMAXPROCS for Go runtime
$apiCpuNum = [double]$ApiCpus
$gomaxprocs = [Math]::Max(1, [int][Math]::Ceiling($apiCpuNum))
$env:GOMAXPROCS = "$gomaxprocs"

# 4. Set environment variables for docker compose
$env:API_CPUS = $ApiCpus
$env:DB_CPUS = $DbCpus
$env:API_MEM = $ApiMem
$env:DB_MEM = $DbMem
$env:POSTGRES_IMAGE = $PostgresImage
if ($DbDataVolume) {
    $env:DB_DATA_VOLUME = $DbDataVolume
}

$testName = if ($Extended) { "Расширенный тест лимитов (Breakpoint)" } else { "Стандартный тест нагрузки" }
$scriptFile = if ($Extended) { "breakpoint-test.js" } else { "load-test.js" }
$totalCpus = [double]$ApiCpus + [double]$DbCpus

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Moodila Load Test: $testName" -ForegroundColor Cyan
Write-Host "  Аппаратные лимиты стенда:" -ForegroundColor Cyan
Write-Host "    • Go API:     $ApiCpus vCPU / $ApiMem (GOMAXPROCS=$gomaxprocs)" -ForegroundColor Cyan
Write-Host "    • PostgreSQL: $DbCpus vCPU / $DbMem (образ: $PostgresImage)" -ForegroundColor Cyan
Write-Host "    • Суммарно:   $totalCpus vCPU" -ForegroundColor Cyan
if ($Extended) {
    Write-Host "  Шаги нагрузки (VUs): $Steps (${StepDuration}s на шаг)" -ForegroundColor Cyan
} else {
    Write-Host "  Сценарий: $Scenario (до $VUs VUs, $Duration)" -ForegroundColor Cyan
}
Write-Host "==========================================================" -ForegroundColor Cyan

# Check if Docker daemon is running
docker info > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker daemon не запущен или недоступен. Пожалуйста, запустите Docker Desktop." -ForegroundColor Red
    exit 1
}

# Handle port 5432 and running containers
$script:stoppedDevDb = $false
$dbPort = "5432"
$runningDevDb = docker ps --filter "name=moodila-postgres$" --format "{{.Names}}" 2>$null
if ($runningDevDb -eq "moodila-postgres") {
    Write-Host "ℹ️  Обнаружен запущенный dev-контейнер 'moodila-postgres'. Временно останавливаем его..." -ForegroundColor Yellow
    docker stop moodila-postgres | Out-Null
    $script:stoppedDevDb = $true
} else {
    $portInUse = Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue
    if ($portInUse) {
        Write-Host "ℹ️  Порт 5432 занят внешним процессом на хосте. Мапим БД на порт 5433 хоста..." -ForegroundColor Gray
        $dbPort = "5433"
    }
}
$env:DB_PORT = $dbPort

Write-Host "`n[1/4] Starting Docker stack (API + PostgreSQL) with hardware limits..." -ForegroundColor Yellow
docker compose -f docker-compose.loadtest.yml up -d --build

# Wait for server and database to become healthy
Write-Host "`n[2/4] Waiting for backend and database at http://localhost:8080/health..." -ForegroundColor Yellow
$healthy = $false
for ($i = 0; $i -lt 45; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8080/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $healthJson = $response.Content | ConvertFrom-Json
            if ($healthJson.db -eq "connected") {
                $healthy = $true
                break
            }
        }
    } catch {
        # ignore while starting up
    }
    Start-Sleep -Seconds 1
}

if (-not $healthy) {
    Write-Host "❌ Backend or Database did not become healthy within 45 seconds." -ForegroundColor Red
    Write-Host "`n--- Logs: moodila-postgres-loadtest ---" -ForegroundColor Yellow
    docker logs moodila-postgres-loadtest --tail 25 2>$null
    Write-Host "`n--- Logs: moodila-api-loadtest ---" -ForegroundColor Yellow
    docker logs moodila-api-loadtest --tail 35 2>$null
    exit 1
}

Write-Host "✅ Backend is healthy and PostgreSQL is connected!" -ForegroundColor Green

# Optional DB seed
if ($Seed) {
    Write-Host "`n🌱 Seeding database with realistic loadtest data (loadtest/seed.sql)..." -ForegroundColor Yellow
    try {
        Get-Content "loadtest/seed.sql" -Raw | docker exec -i moodila-postgres-loadtest psql -U postgres -d moodila
        Write-Host "✅ Database seeded successfully!" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Warning: Seeding encountered an error: $_" -ForegroundColor Yellow
    }
}

# Check if k6 is installed locally
$k6Cmd = Get-Command "k6" -ErrorAction SilentlyContinue

Write-Host "`n[3/4] Launching k6 ($scriptFile)..." -ForegroundColor Yellow

# Prepare environment arguments
$extraEnv = @("-e", "STEPS=$Steps", "-e", "STEP_DURATION=$StepDuration")
if ($Scenario) {
    $extraEnv += @("-e", "SCENARIO=$Scenario")
}
if ($VUs -gt 0) {
    $extraEnv += @("-e", "MAX_VUS=$VUs")
}
if ($AuthToken) {
    $extraEnv += @("-e", "AUTH_TOKEN=$AuthToken")
}
if ($Users -gt 0) {
    $extraEnv += @("-e", "USERS=$Users")
}
if ($LoginShare -ge 0) {
    $extraEnv += @("-e", "LOGIN_SHARE=$LoginShare")
}

if ($k6Cmd) {
    # Run locally
    $k6Args = @("run", "loadtest/$scriptFile", "-e", "BASE_URL=http://localhost:8080") + $extraEnv
    & k6 $k6Args
} else {
    # Run via Docker grafana/k6
    Write-Host "ℹ️  k6 not found locally, running via Docker (grafana/k6)..." -ForegroundColor Gray
    $workDir = (Get-Location).Path.Replace('\', '/')
    $dockerK6Args = @(
        "run", "--rm", "-i",
        "-v", "${workDir}/loadtest:/scripts",
        "-w", "/scripts",
        "--add-host=host.docker.internal:host-gateway",
        "grafana/k6", "run", "/scripts/$scriptFile",
        "-e", "BASE_URL=http://host.docker.internal:8080"
    ) + $extraEnv
    & docker $dockerK6Args
}

Write-Host "`n[4/4] Finalizing..." -ForegroundColor Yellow
if (-not $KeepRunning) {
    Write-Host "Stopping load test containers..." -ForegroundColor Gray
    docker compose -f docker-compose.loadtest.yml down
} else {
    Write-Host "ℹ️  Containers kept running: 'moodila-api-loadtest', 'moodila-postgres-loadtest'." -ForegroundColor Cyan
    Write-Host "   Use 'docker compose -f docker-compose.loadtest.yml down' when done." -ForegroundColor Cyan
}

if ($script:stoppedDevDb) {
    Write-Host "Восстанавливаем dev-контейнер 'moodila-postgres'..." -ForegroundColor Gray
    docker start moodila-postgres | Out-Null
}

Write-Host "`nDone!" -ForegroundColor Green

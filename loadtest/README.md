# Moodila k6 Load Testing

Стресс-тестирование полного стека Moodila (Go API + PostgreSQL) в изолированных Docker-контейнерах с настраиваемыми аппаратными ограничениями CPU и RAM.

---

## Архитектура тестового стенда

1. **Go API (`moodila-api-loadtest`)**: Запускается в Docker с ограничениями `deploy.resources.limits` (`API_CPUS`, `API_MEM`). Rate Limiter отключен через `DISABLE_RATE_LIMIT=true`, а переменная `GOMAXPROCS` автоматически выставляется в соответствии с выделенным лимитом CPU.
2. **PostgreSQL (`moodila-postgres-loadtest`)**: Локальный контейнер PostgreSQL, разворачиваемый в той же Docker-сети с отдельными ограничениями `deploy.resources.limits` (`DB_CPUS`, `DB_MEM`). По умолчанию использует том `./docker-data/postgres` со всеми миграциями и данными. Образ настраивается через параметр `$PostgresImage` (по умолчанию `postgres:latest`).
3. **k6**: Запускается снаружи контейнеров (локально или через временный контейнер `grafana/k6`), чтобы генерация нагрузки не отнимала процессорное время и память у тестируемого сервера и базы данных.

---

## Быстрый запуск (PowerShell)

Скрипт `loadtest/run.ps1` автоматически запускает связку API + PostgreSQL с лимитами, дожидается полной готовности эндпоинта `/health` (проверяя `db: connected`), запускает k6 и корректно останавливает тестовые контейнеры:

### 1. Стандартный тест нагрузки (Ramping VUs)
```powershell
# Запуск со стандартным бюджетом (по умолчанию 0.25 vCPU / 512M RAM на API и 0.25 vCPU / 512M RAM на PostgreSQL):
.\loadtest\run.ps1

# Запуск с общим бюджетом сервера (делится 50/50 между API и БД: например, 0.5 CPU / 512M каждому):
.\loadtest\run.ps1 -Cpus 1 -Mem 1024M -VUs 50

# Точечные раздельные лимиты для API и БД:
.\loadtest\run.ps1 -ApiCpus 0.2 -DbCpus 0.8 -ApiMem 256M -DbMem 768M

# Использование собственного образа PostgreSQL:
.\loadtest\run.ps1 -PostgresImage "my-postgres:18"

# С предварительным заполнением базы реалистичными данными (50 ботов, 500 друзей, 10 000 записей):
.\loadtest\run.ps1 -Seed

# Быстрый smoke-тест (1 пользователь, 15 секунд):
.\loadtest\run.ps1 -Scenario smoke

# Стресс-тест авторизованных эндпоинтов с готовым JWT:
.\loadtest\run.ps1 -AuthToken "eyJh..." -VUs 20
```

### 2. Расширенный тест критических лимитов (`-Extended`)
Пошагово увеличивает количество одновременных пользователей (`5 -> 10 -> 20 -> 30 -> 50 -> 75 -> 100`) и находит две критические точки: **комфортный лимит (SLO)** и **физический максимум системы (Breaking Point)**:

```powershell
# Запуск теста поиска предела масштабирования:
.\loadtest\run.ps1 -Extended

# На мощностях 1 vCPU суммарно (0.5 vCPU API + 0.5 vCPU DB):
.\loadtest\run.ps1 -Extended -Cpus 1 -Mem 1024M

# С кастомными шагами нагрузки:
.\loadtest\run.ps1 -Extended -Steps "10,25,50,75,100,150" -StepDuration 20
```

---

## Ручной запуск (по шагам)

### 1. Запуск контейнеров с лимитами
```bash
API_CPUS=0.25 DB_CPUS=0.25 API_MEM=512M DB_MEM=512M docker compose -f docker-compose.loadtest.yml up --build -d
```

### 2. Мониторинг ресурсов в реальном времени
```bash
# Покажет утилизацию CPU, RAM, сетевой I/O и троттлинг для обоих контейнеров:
docker stats moodila-api-loadtest moodila-postgres-loadtest
```

### 3. Запуск k6

**Вариант А — через Docker (если k6 не установлен в системе):**
```bash
docker run --rm -i \
  -v "${PWD}/loadtest:/scripts" \
  --add-host=host.docker.internal:host-gateway \
  grafana/k6 run /scripts/load-test.js \
  -e BASE_URL=http://host.docker.internal:8080 \
  -e MAX_VUS=30 \
  -e SCENARIO=ramp
```

**Вариант Б — через установленный k6:**
```bash
# Установка k6 в Windows: winget install k6 --source winget
k6 run loadtest/load-test.js -e BASE_URL=http://localhost:8080 -e MAX_VUS=30
```

### 4. Остановка после завершения
```bash
docker compose -f docker-compose.loadtest.yml down
```

---

## Параметры скрипта `loadtest/run.ps1`

| Параметр | По умолчанию | Описание |
|---|---|---|
| `-Cpus` | `""` | Суммарный бюджет vCPU на весь стенд (делится 50/50 между API и БД) |
| `-Mem` | `""` | Суммарный бюджет RAM (например `1024M` или `1G`, делится 50/50) |
| `-ApiCpus` | `"0.25"` | Персональный лимит vCPU для Go API |
| `-DbCpus` | `"0.25"` | Персональный лимит vCPU для PostgreSQL |
| `-ApiMem` | `"512M"` | Персональный лимит RAM для Go API |
| `-DbMem` | `"512M"` | Персональный лимит RAM для PostgreSQL |
| `-PostgresImage` | `"postgres:latest"` | Имя Docker-образа базы данных |
| `-DbDataVolume` | `./docker-data/postgres` | Путь или имя тома данных для PostgreSQL |
| `-Seed` | `false` | Накатить `loadtest/seed.sql` перед началом теста |
| `-Extended` | `false` | Запуск Breakpoint-теста пошагового масштабирования |
| `-VUs` | `30` | Максимальное количество одновременных пользователей (VUs) |
| `-Duration` | `1m` | Длительность для сценария `constant` |
| `-Scenario` | `ramp` | Сценарий: `ramp`, `constant`, `smoke`, `arrival` |
| `-KeepRunning` | `false` | Не гасить контейнеры после окончания тестирования |

---

## 5. Наполнение базы реалистичными данными (Database Seed)

Чтобы запросы ленты (`/feed` с JOIN'ами дружбы, приватности, лайков и комментариев) давали реальную нагрузку, перед тестами рекомендуется залить сид (`seed.sql`):
* **50 аккаунтов** (`loadtest_0` .. `loadtest_49`, пароль: `Password123!`)
* **~20 взаимных друзей** на каждого бота (всего 500 связей дружбы)
* **~200 записей** на каждого пользователя (~10 000 записей за последние 200 дней)
* **Тысячи реакций и комментариев**, а также настройки приватности

**Как применить:**
- Через параметр скрипта: `.\loadtest\run.ps1 -Seed`
- Либо вручную в работающий контейнер:
  ```bash
  docker exec -i moodila-postgres-loadtest psql -U postgres -d moodila < loadtest/seed.sql
  ```

---

## Как интерпретировать статистику

* **RPS (req/s):** Количество бизнес-запросов, которое успевает обработать стенд при заданных ограничениях.
* **Latency p50 vs p95:** 
  * Если $p_{50} < 15$ ms, а $p_{95} > 500$ ms — явный признак исчерпания CPU-квоты (CFS Throttling в ядре Linux) или образования очереди запросов к PostgreSQL.
* **Ошибки (%):** Появление 5xx или тайм-аутов сигнализирует о достижении предела насыщения пула соединений (`pgxpool`) или нехватке памяти/CPU.
* **Rate Limit 429:** Должно быть строго `0` благодаря флагу `DISABLE_RATE_LIMIT=true`.

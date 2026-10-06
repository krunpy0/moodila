# Moodila k6 Load Testing & Real Capacity Benchmark

Стресс-тестирование полного стека **Moodila** (Go API + PostgreSQL) для нахождения **реального предела производительности** на сервере конфигурации **1 vCPU / 1 GB RAM**.

---

## Архитектура тестового стенда

1. **Go API (`moodila-api-loadtest`)**: Запускается в Docker с ограничениями `deploy.resources.limits` (`API_CPUS`, `API_MEM`). Rate Limiter отключен через `DISABLE_RATE_LIMIT=true`, а переменная `GOMAXPROCS` автоматически выставляется в соответствии с выделенным лимитом CPU.
2. **PostgreSQL (`moodila-postgres-loadtest`)**: База данных с настраиваемыми лимитами (`DB_CPUS`, `DB_MEM`). Наполняется реалистичным объемом данных (20 000 пользователей, степенной граф 30-200 друзей, 300 000 записей, реакции, комментарии и настройки приватности) с последующим `VACUUM ANALYZE`.
3. **k6 (Отдельная нагрузочная машина)**: Запускается **снаружи** тестируемого сервера, чтобы генерация нагрузки не отнимала вычислительные ресурсы у тестируемого сервера (1 vCPU / 1 GB RAM).

---

## Важно: Почему k6 нужно запускать с отдельной машины

Генератор нагрузки k6 в режиме `ramping-arrival-rate` на ступенях 50–300 req/s сам потребляет до 0.5–1.0 ядра CPU и сотни мегабайт оперативной памяти. Запуск k6 на том же сервере приведет к взаимной конкуренции за процессор, троттлингу ядра Linux (CFS quota) и искусственно завышенным задержкам p95/p99.

---

## Запуск k6 с отдельной машины

### Вариант 1: Через установленный k6
```bash
k6 run loadtest/load-test.js \
  -e BASE_URL=http://<IP_СЕРВЕРА>:8080 \
  -e STEPS=10,25,50,100,150,200,300 \
  -e STEP_DURATION=120s \
  -e USERS=200 \
  -e PRE_VUS=150 \
  -e MAX_VUS=1200
```

### Вариант 2: Через Docker (если k6 не установлен)
```bash
docker run --rm -i \
  -v "$PWD/loadtest:/scripts" \
  grafana/k6 run /scripts/load-test.js \
  -e BASE_URL=http://<IP_СЕРВЕРА>:8080 \
  -e STEPS=10,25,50,100,150,200,300 \
  -e STEP_DURATION=120s \
  -e USERS=200
```

---

## Команды мониторинга на сервере (параллельно с тестом)

Во время выполнения нагрузки запустите на самом сервере:

### 1. Мониторинг контейнеров в реальном времени
```bash
docker stats moodila-api-loadtest moodila-postgres-loadtest
```
Показывает утилизацию CPU, потребление RAM, лимиты, сетевой I/O.

### 2. Мониторинг операционной системы и CPU Steal
```bash
htop
```
Обратите внимание на:
* **% CPU** (упирается ли процесс в 100%)
* **% Steal Time (`st`)** (если хостинг VPS «ворует» процессорное время)
* **Память и Swap** (не начинается ли вытеснение страниц на диск)

### 3. Анализ запросов в PostgreSQL через `pg_stat_statements`

Сброс статистики перед началом теста:
```sql
SELECT pg_stat_statements_reset();
```

Топ-10 самых тяжелых запросов по суммарному времени CPU:
```sql
SELECT 
    substring(query, 1, 75) AS query_snippet,
    calls,
    round(total_exec_time::numeric, 1) AS total_ms,
    round(mean_exec_time::numeric, 2) AS mean_ms,
    round(max_exec_time::numeric, 2) AS max_ms,
    round((100 * total_exec_time / nullif(sum(total_exec_time) OVER (), 0))::numeric, 1) AS pct_cpu
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY total_exec_time DESC
LIMIT 10;
```

Мониторинг пула соединений:
```sql
SELECT count(*), state FROM pg_stat_activity WHERE datname = 'moodila' GROUP BY state;
```

---

## Наполнение базы реалистичными данными (Seeder)

Скрипт `loadtest/seed.sql` генерирует:
* **20 000 учетных записей** (`loadtest_0` .. `loadtest_19999`, пароль: `Password123!`)
* **30–200 друзей** на каждого пользователя (степенное распределение с хабами, ~670 000 принятых связей дружбы)
* **~300 000 записей дней** за последний год с тегами и настроениями
* Настройки приватности аккаунта (`user_friend_visibility`) и записей (`entry_friend_visibility`)
* Десятки тысяч реакций и комментариев
* Завершается `VACUUM ANALYZE` по всем затронутым таблицам для точной калибровки планировщика PostgreSQL.

### Как накатить сид:
```bash
# Через PowerShell скрипт:
.\loadtest\run.ps1 -Seed

# Или напрямую в PostgreSQL:
docker exec -i moodila-postgres-loadtest psql -U postgres -d moodila < loadtest/seed.sql
```

---

## Переменные окружения k6-скрипта

| Переменная | По умолчанию | Описание |
|---|---|---|
| `BASE_URL` | `http://localhost:8080` | URL тестируемого Go API |
| `STEPS` | `10,25,50,100,150,200,300` | Ступени целевого RPS (req/s) |
| `STEP_DURATION` | `120s` | Длительность каждой ступени (2 минуты) |
| `USERS` | `200` | Число предзагружаемых пользовательских сессий в `setup()` |
| `TOTAL_SEEDED_USERS` | `20000` | Общий диапазон тестовых ботов в БД для реальных логинов |
| `PRE_VUS` | `150` | Базовый запас предварительно выделенных виртуальных пользователей |
| `MAX_VUS` | `1200` | Верхний предел пула VUs в k6 (для предотвращения нехватки VUs) |
| `P95_THRESHOLD` | `300` | SLO порог по 95-му перцентилю задержки (мс) для `abortOnFail` |
| `ERROR_THRESHOLD` | `0.02` | SLO порог процента ошибок (2%) для `abortOnFail` |
| `DELAY_ABORT` | `15s` | Задержка оценки thresholds перед аварийным прерыванием теста |
| `SCENARIO` | `ramp` | `ramp` (ступенчатый стресс-тест) или `smoke` (быстрый 15с тест) |

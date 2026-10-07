# Architecture Overview

Документ описывает фактическую системную и программную архитектуру проекта **Moodila** на основе анализа кодовой базы.

---

## 1. Концептуальная архитектура (High-Level System Overview)

Moodila спроектирована как трехуровневое клиент-серверное веб-приложение:

```
┌────────────────────────────────────────────────────────┐
│                   Клиентский слой                     │
│  React 19 SPA / PWA (Vite 8 + TanStack React Query v5) │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / REST (JSON)
                            │ Cookies (credentials: 'include')
                            │ Headers: X-CSRF-Token, X-Time-Zone
                            ▼
┌────────────────────────────────────────────────────────┐
│                   Серверный слой                       │
│  Go 1.25 API (Gin Engine + Middleware Pipeline)        │
│  - Handlers (HTTP транспорт)                           │
│  - Repositories (pgxpool + Raw SQL)                    │
│  - Internal Services (Web Push, Storage, Mailer)       │
│  - In-Memory Cache (SummaryCache)                      │
└──────────────┬─────────────────────────┬───────────────┘
               │                         │
               ▼                         ▼
┌─────────────────────────────┐   ┌──────────────────────┐
│        База данных          │   │ Объектное хранилище  │
│   PostgreSQL 15+ (pgxpool)  │   │ S3 / Cloudflare R2   │
│   (Чистый SQL, без ORM)     │   │ (Медиафайлы: фото,   │
│                             │   │  аудиозаписи)        │
└─────────────────────────────┘   └──────────────────────┘
               ▲
               │ Фоновый бэкап (cron)
               ▼
┌─────────────────────────────┐
│     Google Drive API v3     │
│   (Резервные копии БД)      │
└─────────────────────────────┘
```

---

## 2. Слои бэкенда и границы ответственности

В бэкенде соблюдается прагматичное разделение ответственности без избыточных абстракций и без использования ORM:

```
[ HTTP Request ]
       │
       ▼
[ Middleware Pipeline ]  ──► Auth, CSRF, Admin, RateLimit, CORS, Logger, Sentry
       │
       ▼
[ HTTP Handlers ]        ──► internal/handlers/ (HTTP-парсинг, валидация DTO, статус-коды)
       │
       ├─────────────────────────┬─────────────────────────┐
       ▼                         ▼                         ▼
[ Repository Layer ]     [ Push Service ]          [ Storage Client ]
internal/repository/     internal/services/push/   internal/storage/
(pgxpool SQL, Models)    (VAPID Web Push)          (S3 Put/Presign/Delete)
       │                         │
       ▼                         │
[ PostgreSQL Database ]          ▼
                         [ Push Gateways ]
```

### 2.1. Точка входа и инициализация (`backend/cmd/api/main.go`)
- Загружает конфигурацию окружения (`internal/config`).
- Инициализирует мониторинг Sentry (если задан `SENTRY_DSN`).
- Запускает фоновый планировщик резервного копирования БД (`internal/backup`).
- Подключается к пулу соединений PostgreSQL (`internal/db.Connect`).
- Выполняет последовательные SQL-миграции (`internal/db.Migrate`).
- Инициализирует репозитории, почтовый клиент (`internal/mailer`), S3-хранилище (`internal/storage`) и Web Push сервис (`internal/services/push`).
- Настраивает Gin роутер, пайплайн middleware, регистрирует маршруты.
- Обрабатывает сигналы операционной системы (`SIGINT`, `SIGTERM`) для graceful shutdown с таймаутом 10 секунд.

### 2.2. Пайплайн Middleware (`backend/internal/middleware/`)
1. **`Logger` & `gin.Recovery()` / `sentrygin`**: Логирование HTTP-запросов и перехват паник с отправкой исключений в Sentry.
2. **`CORS`**: Разрешает кросс-доменные запросы с доверенных `CORS_ORIGIN`, пропуская необходимые заголовки (`Content-Type`, `X-CSRF-Token`, `X-Time-Zone`, `X-Mock-Date`).
3. **`RateLimit`**: Защита от abuse на базе Token Bucket (`golang.org/x/time/rate`). Раздельные лимиты для аутентификации (5 зап. / 12 сек. по IP), сброса пароля (1 зап. / 60 сек.), загрузки файлов (10 зап. / 4 сек.), мутаций (15 зап. / 2 сек.), чтения (30 зап. / 600 мс) и health-check. При `DISABLE_RATE_LIMIT=true` лимитеры отключаются (для нагрузочного тестирования).
4. **`Auth`**: Извлекает JWT из HTTP-Only cookie `access_token`. Валидирует подпись HMAC-SHA256, срок действия (15 минут), issuer (`moodshare`) и тип токена (`access`). Записывает в контекст Gin `userID`, `tokenVersion` и `csrfToken`. Возвращает заголовок ответа `X-CSRF-Token`.
5. **`CSRF`**: Для изменяющих состояние методов (`POST`, `PUT`, `PATCH`, `DELETE`) сравнивает заголовок `X-CSRF-Token` со значением `csrfToken`, зашитым в claims проверенного access-токена.
6. **`Admin`**: Проверяет флаг `is_admin` пользователя в БД (`users.ByID`). При отсутствии прав прерывает запрос со статусом `403 Forbidden`.

### 2.3. HTTP Handlers (`backend/internal/handlers/`)
Отвечают исключительно за прием входящих данных, базовую валидацию форматов (UUID, JSON, допустимые диапазоны полей), вызов методов репозитория/сервисов и формирование JSON-ответов с соответствующими HTTP-статусами. Handlers **не содержат сырых SQL-запросов**.

### 2.4. Репозитории и Data Access Layer (`backend/internal/repository/`)
Содержат всю работу с базой данных на чистом SQL через `pgxpool.Pool`.
- Отсутствие ORM позволяет писать высокооптимизированные запросы с использованием `CROSS JOIN LATERAL`, CTE (`WITH authors AS ...`), `unnest()`, оконных функций и составных индексов.
- В репозитории `Entries` встроен потокобезопасный in-memory кеш `SummaryCache` с автоматической инвалидацией по префиксу пользователя (`InvalidateUser(userID)`) при любых изменениях записей или приватности.

### 2.5. Выделенные сервисы (Services & Infrastructure)
- **`internal/services/push`**: Сервис Web Push (поддерживает VAPID RFC 8292, batch-отправку push-уведомлений по списку пользователей).
- **`internal/storage`**: Взаимодействие с S3-совместимым хранилищем. Генерирует подписанные токены загрузки, осуществляет стриминг и удаление файлов.
- **`internal/mailer`**: Отправка транзакционных писем через Resend SDK с HTML-шаблонами (в режиме `development` пишет ссылки сброса в консоль).
- **`internal/backup`**: CLI и фоновый cron-планировщик, выполняющий `pg_dump` и отправляющий сжатые дампы в Google Drive.

---

## 3. Основные сквозные потоки (End-to-End Data Flows)

### 3.1. Поток аутентификации и сессии (Authentication Flow)
1. Клиент отправляет учетные данные на `POST /auth/login` или `POST /auth/register`.
2. Сервер проверяет bcrypt-хеш пароля (или создает пользователя с дефолтным `token_version = 1`).
3. Сервер генерирует случайный 16-байтный hex `csrfToken`.
4. Сервер формирует два JWT:
   - `access_token` (TTL 15 мин, claims: `sub=userID`, `csrf=csrfToken`, `token_version=V`, `type=access`).
   - `refresh_token` (TTL 30 дней, claims: `sub=userID`, `token_version=V`, `type=refresh`).
5. Токены устанавливаются в браузерные куки:
   - `access_token` (HttpOnly, SameSite, Secure в production).
   - `refresh_token` (HttpOnly, SameSite, Secure в production).
   - `csrf_token` (HttpOnly=false, доступна клиенту).
6. При истечении `access_token` (401 Unauthorized) клиентский сетевой слой `api/client.js` прозрачно вызывает `POST /auth/refresh`, где проверяется `refresh_token` и актуальность `token_version` в БД. При несовпадении версий сессия принудительно сбрасывается.

### 3.2. Поток загрузки и обработки медиафайлов (Storage Flow)
В отличие от наивных схем прямой загрузки в S3, в Moodila реализован контролируемый flow со сжатием на стороне сервера:

```
[ Browser / App ]                     [ Go API ]                  [ S3 Storage ]
        │                                 │                              │
        │ 1. POST /storage/entry-photos/  │                              │
        │    upload-url (meta, size)      │                              │
        ├────────────────────────────────►│                              │
        │ 2. Return UploadURL with JWT    │                              │
        │◄────────────────────────────────┤                              │
        │                                 │                              │
        │ 3. PUT /storage/entry-photos/   │                              │
        │    upload/:token (binary stream)│                              │
        ├────────────────────────────────►│                              │
        │                                 │ 4. Validate JWT ticket       │
        │                                 │ 5. Downscale (max 1920px)    │
        │                                 │ 6. Recompress (JPEG q=80)    │
        │                                 │ 7. Put to S3                 │
        │                                 ├─────────────────────────────►│
        │                                 │ 8. S3 OK                     │
        │                                 │◄─────────────────────────────┤
        │ 9. 200 OK                       │                              │
        │◄────────────────────────────────┤                              │
```

- Клиент не общается напрямую с бакетом S3 для фото, что устраняет необходимость настройки сложных CORS-политик на стороне провайдера хранилища.
- Тяжелые мобильные фотографии сжимаются на лету, экономя место и сетевой трафик.
- Для аудиофайлов используется аналогичный двухшаговый тикетный флоу (`/storage/entry-audio/upload-url`).

### 3.3. Социальная лента (Feed Flow)
- Клиент запрашивает `GET /feed?limit=10&cursor=<base64>&include_self=<bool>`.
- Запрос проходит авторизацию и CSRF.
- Репозиторий `Feed.List` выполняет оптимизированный SQL-запрос с `WITH authors AS ... CROSS JOIN LATERAL (...)` с ограничением локальной выборки по автору и составной фильтрацией приватности.
- Реакции к записям подтягиваются вторым пакетом через `WHERE entry_id = ANY($1::uuid[])` и собираются в памяти Go.
- Возвращается список записей и непрозрачный Base64-курсор пагинации `(date|created_at|id)`.

---

## 4. Внешние сервисы и инфраструктурные зависимости

| Сервис | Протокол / Библиотека | Назначение в системе |
|---|---|---|
| **PostgreSQL 15+** | `jackc/pgx/v5` через `pgxpool` | Основное реляционное хранилище данных, транзакции, миграции |
| **S3 Storage** | AWS S3 / Cloudflare R2 / MinIO | Долгосрочное хранение фотографий записей, аватаров и аудиозаметок |
| **Resend** | `resend/resend-go` REST API | Транзакционная доставка email для восстановления пароля и удаления аккаунта |
| **Web Push (VAPID)** | `SherClockHolmes/webpush-go` (RFC 8292) | Фоновые пуш-уведомления браузера о лайках, комментариях, заявках и постах |
| **Google Drive** | `google.golang.org/api/drive/v3` | Автоматическая архивация дампов базы данных каждые 3 часа с ротацией 7 дней |
| **Sentry** | `getsentry/sentry-go` + `@sentry/react` | Трейсинг ошибок бэкенда и фронтенда, паник сервера и сбоев клиентского UI |

---

## 5. Архитектура развертывания (Production Deployment Mental Model)

- **Целевая среда:** Linux VPS (протестировано под нагрузкой на конфигурации 1 vCPU / 1 GB RAM).
- **Frontend:** Статический SPA-бандл (`frontend/dist`), собираемый с помощью Vite, обслуживаемый веб-сервером (Nginx или Caddy) с gzip/brotli сжатием и кешированием статики через Service Worker.
- **Backend:** Единый скомпилированный бинарный файл Go (`moodila`), запускаемый как systemd-сервис или через легковесный Docker-контейнер на базе `alpine:3.21`.
- **Reverse Proxy:** Nginx или Caddy проксирует запросы к Go API (порт `8080`), обеспечивает TLS-терминацию и передает заголовки `X-Forwarded-Proto`, `Host`, `X-Real-IP`.
- **CI/CD:** GitHub Actions (`.github/workflows/go.yml`) компилирует Go-бинарник и фронтенд, передает артефакты по SSH/SCP в `/opt/moodila/incoming/` и инициирует выполнение сценария `/opt/moodila/deploy.sh`.

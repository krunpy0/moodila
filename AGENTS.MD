# MOODILA — AI AGENT CONTEXT & WORKFLOW GUIDE

Краткий контекстный гайд для AI-агентов и разработчиков. Содержит ключевые правила работы с кодовой базой, карту системы, ограничения и указатели на подробную документацию.

Сверено с кодом: **9 ноября 2026 года**. Сначала проверяйте `git status --short`: не перезаписывайте чужие изменения.

---

## 1. О проекте (Project Summary)

**Moodila** — кроссплатформенное мобильное PWA-приложение (дневник настроения и дня) с социальной лентой, двухуровневой системой приватности, аналитикой и Web Push уведомлениями.
- **Backend:** Go REST API на базе Gin, работающий с PostgreSQL через пул `pgxpool` на чистом SQL (без ORM).
- **Frontend:** React 19 SPA / PWA (Vite 8, Tailwind CSS, TanStack React Query v5).
- **Целевая среда:** Linux VPS (1 vCPU / 1 GB RAM, целевой профиль; текущую производительность подтверждать измерениями).

---

## 2. Основной Tech Stack

| Слой | Технологии |
|---|---|
| **Backend** | Go 1.25, Gin, `jackc/pgx/v5` (pgxpool), JWT (HS256), Sentry Go |
| **Frontend** | React 19, Vite 8, React Router DOM 7, TanStack React Query v5, Tailwind CSS 3, Oxlint |
| **Database** | PostgreSQL 15+ (чистый SQL, Simple Protocol, без ORM) |
| **Storage & Media** | S3-compatible (AWS S3, Cloudflare R2, MinIO), серверный ресайз фото (JPEG 1920px) |
| **Integrations** | VAPID Web Push (RFC 8292), Resend Email, Google Drive API v3 (бэкапы) |

---

## 3. Навигационная карта: где что находится

| Сущность / Подсистема | Расположение в репозитории |
|---|---|
| **Frontend Root** | `frontend/` (`frontend/src/` — исходники, `frontend/public/` — статика/SW) |
| **Backend Root** | `backend/` (`cmd/` — исполняемые файлы, `internal/` — пакеты) |
| **API Handlers & Routes** | `backend/internal/handlers/`, маршруты сконфигурированы в `backend/cmd/api/main.go` |
| **Business Logic** | Распределена между `backend/internal/handlers/` и `backend/internal/repository/` |
| **Repository & SQL Queries**| `backend/internal/repository/` (чистый SQL, никакого ORM) |
| **Migrations & DB Schema** | `backend/migrations/` (файлы `0001_...sql` – `0025_...sql`, `migrations.go`) |
| **Domain Models** | `backend/internal/models/` |
| **Middleware (Auth, CSRF)** | `backend/internal/middleware/` |
| **Tests** | Unit/Integration в `backend/internal/**_test.go`; нагрузочные в `loadtest/` |
| **Deployment & CI/CD** | `.github/workflows/go.yml`, `backend/Dockerfile`, `docker-compose*.yml` |
| **Detailed Documentation** | `docs/` (`architecture.md`, `database.md`, `decisions/`, etc.) |

---

## 4. Архитектурные границы и принципы

1. **Разделение Handler / Repository:**
   - Хендлеры (`internal/handlers/`) отвечают только за HTTP транспорт, парсинг JSON/query, базовую валидацию и статус-коды.
   - Репозитории (`internal/repository/`) инкапсулируют всю работу с PostgreSQL. **В хендлерах не должно быть сырых SQL-запросов.**
2. **Никаких ORM:**
   - Все запросы пишутся вручную на чистом SQL через `pgxpool.Pool`.
   - Используется `QueryExecModeSimpleProtocol` для совместимости с PgBouncer / Supabase.
3. **Безопасность и Auth:**
   - Токены хранятся **только в `HttpOnly` Cookies** (`access_token`, `refresh_token`). Клиентский JS не имеет доступа к телу токенов.
   - Мутации защищённой группы маршрутов требуют `middleware.CSRF()` и `X-CSRF-Token`. Публичные auth POST находятся вне этой группы; `/notifications/mark-read` допускает запрос без заголовка при `Sec-Fetch-Site: same-origin`. Сверяйте границы в `main.go` и `middleware/csrf.go`.
   - Сессии версионируются через `users.token_version`. При смене пароля или выходе (`/auth/logout`) версия инкрементируется в БД, запрещая последующий refresh токенов с прежней положительной версией. `middleware.Auth` не сверяет версию с БД: уже выданный access JWT может работать до истечения (15 минут). Logout логирует ошибку инвалидации и всё равно очищает cookies.
4. **Медиафайлы и фоновые задачи:**
   - Загрузка фотографий проходит через API (`PUT /storage/entry-photos/upload/:token`), где JPEG/PNG декодируются, уменьшаются до 1920px и пережимаются в JPEG q=80. Разрешённые WebP/GIF идут без этой обработки; типы и ограничения проверяйте в `handlers/storage.go`.
   - Канальный семафор допускает 2 загрузки одновременно: слот захватывается до чтения тела и удерживается до завершения отправки в S3. Это не абсолютная защита от OOM. JPEG EXIF-ориентация нормализуется после уменьшения. Аудио также идёт через этот API upload endpoint, без перекодирования.
   - Браузерные Web Push рассылаются через фоновый пул воркеров без блокировки HTTP-хендлеров.

---

## 5. Важные правила и ограничения

- **Сохранение производительности ленты (Feed):**
  Лента построена на `WITH authors AS ... CROSS JOIN LATERAL (...)` и Keyset Cursor `(date, created_at, id)`. Никогда не заменяйте этот запрос на наивный плоский `JOIN entries` и не используйте `OFFSET`.
- **Правила изменения Database Schema:**
  - Никогда не изменяйте задним числом уже примененные миграции `0001`–`0025`.
  - Любые изменения структуры БД оформляются строго новым файлом (например, `0026_name.sql`; сначала проверьте последний номер в каталоге).
  - Миграции должны быть идемпотентными (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`) и выполняться в транзакции.
- **Каноническое правило приватности (Friend Visibility):**
  Запись видна зрителю только если:
  `(e.user_id = viewer) OR (friendship.status = 'accepted' AND e.is_hidden = false AND COALESCE(efv.is_hidden, ufv.hide_by_default, false) = false)`.
  При изменении записей или приватности сохраняйте инвалидацию кеша через существующий `Entries.InvalidateUserCache` / `SummaryCache.InvalidateUser`. `support_preference=no_discussion` запрещает новые комментарии на сервере; не ограничивайтесь отключением формы в UI.
- **Изоляция новых друзей:**
  При принятии дружбы (`friends.Respond` со статусом `accepted`) записи с кастомной видимостью автоматически скрываются для нового друга. Это транзакционная логика репозитория; миграция `0019` — backfill, а не триггер. Не удаляйте её.
- **Онбординг и анонсы:**
  Эндпоинт `/announcements/active-prompt` возвращает строго не более 1 активного объявления. Онбординг ограничен 7 днями с момента регистрации. Новые пользователи не видят исторические новости (`published_at >= u.created_at`).
- **Соблюдение стилей и UX:**
  Фронтенд ориентирован на мобильные устройства. При правке верстки учитывать safe-area insets (`pt-safe-top`, `pb-safe-bottom` для iPhone Dynamic Island и шторки).
- **Формирование Git Commit Message:**
  После любых изменений кода или документации обязательно предлагайте понятный, структурированный commit message в стиле Conventional Commits (`feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`, `perf: ...`).

---

## 6. Правила проверки изменений (Verification)

Перед сдачей задачи проверьте корректность:

1. **Линтинг фронтенда:**
   ```bash
   cd frontend && npm run lint
   ```
2. **Сборка фронтенда:**
   ```bash
   cd frontend && npm run build
   ```
3. **Компиляция бэкенда:**
   ```bash
   cd backend && go build ./cmd/api
   ```
4. **Тесты бэкенда:**
   ```bash
   cd backend && go test ./...
   ```
   Модульные тесты не требуют БД, но полный `go test ./...` включает интеграционные проверки:
   - `internal/db/schema_test.go` читает `DATABASE_URL` через `config.Load()` (включая локальный `.env`), требует доступную БД с историей миграций.
   - `internal/handlers/hidden_test.go` использует ту же настройку, применяет миграции, создаёт и удаляет тестовые аккаунты; при недоступной БД пропускается.
   - `internal/repository/entries_search_test.go` использует `SEARCH_TEST_DATABASE_URL` и ожидает актуальную схему.
   - `internal/repository/support_preference_test.go` использует `TEST_DATABASE_URL` и применяет миграции.
   - `internal/handlers/performance_test.go` использует `TEST_DATABASE_URL` с уже применёнными миграциями и проверяет число SQL-запросов статистики, формат ленты и поиск пользователей.
   Используйте отдельную тестовую БД. Не запускайте интеграционные тесты на production. Если БД недоступна, отдельно выполните `go test ./... -skip 'TestCheckSchema|TestHiddenEntriesE2E|TestEntrySearchDatabase|TestSupportPreferenceIntegration|TestPerformanceIntegration'` и явно сообщите о пропущенных проверках.

5. **Тесты frontend (Node.js, без Vitest):**
   ```bash
   cd frontend && node --test src/utils/*.test.js src/landing-preview/*.test.js
   ```

Для изменений только документации проверьте ссылки, пути и `git diff --check`. Не выдавайте наличие тестов или старые отчёты за результат текущего запуска. Workflow деплоя сейчас не выполняет lint и тесты.

---

## 7. Документация (Documentation Index)

Перед модификацией конкретной подсистемы обязательно прочтите соответствующий документ:

- **Архитектура системы и слои** → [docs/architecture.md](docs/architecture.md)
- **Структура репозитория и карта изменений** → [docs/codebase.md](docs/codebase.md)
- **Текущее состояние и ограничения** → [docs/current-state.md](docs/current-state.md)
- **База данных, индексы и SQL** → [docs/database.md](docs/database.md)
- **Аутентификация, токены и CSRF** → [docs/authentication.md](docs/authentication.md)
- **Социальная лента (Feed)** → [docs/features/feed.md](docs/features/feed.md)
- **Друзья и приватность** → [docs/features/friends.md](docs/features/friends.md)
- **Онбординг и анонсы** → [docs/features/onboarding.md](docs/features/onboarding.md)
- **Поиск по дневнику** → [docs/features/search.md](docs/features/search.md)
- **Предпочтение поддержки и комментарии** → [docs/features/support.md](docs/features/support.md)
- **Блокировки и жалобы** → [docs/features/moderation.md](docs/features/moderation.md)
- **Темы и стили** → [docs/themes.md](docs/themes.md)
- **Развертывание и CI/CD** → [docs/deployment.md](docs/deployment.md)
- **Архитектурные решения (ADR)** → [docs/decisions/README.md](docs/decisions/README.md)

> [!IMPORTANT]
> **Главное правило:**
> Перед внесением нетривиальных изменений изучите соответствующую документацию в `docs/` и исходный код. Если документация противоречит исходному коду, доверяйте исходному коду и при необходимости обновляйте документацию.

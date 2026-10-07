# MOODILA — AI AGENT CONTEXT & WORKFLOW GUIDE

Краткий контекстный гайд для AI-агентов и разработчиков. Содержит ключевые правила работы с кодовой базой, карту системы, ограничения и указатели на подробную документацию.

---

## 1. О проекте (Project Summary)

**Moodila** — кроссплатформенное мобильное PWA-приложение (дневник настроения и дня) с социальной лентой, двухуровневой системой приватности, аналитикой и Web Push уведомлениями.
- **Backend:** Go REST API на базе Gin, работающий с PostgreSQL через пул `pgxpool` на чистом SQL (без ORM).
- **Frontend:** React 19 SPA / PWA (Vite 8, Tailwind CSS, TanStack React Query v5).
- **Целевая среда:** Linux VPS (1 vCPU / 1 GB RAM, высокая производительность под нагрузкой).

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
| **Migrations & DB Schema** | `backend/migrations/` (файлы `0001_...sql` – `0020_...sql`, `migrations.go`) |
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
   - Все мутирующие запросы (`POST`, `PUT`, `PATCH`, `DELETE`) защищены `middleware.CSRF()` и требуют заголовок `X-CSRF-Token`.
   - Сессии версионируются через `users.token_version`. При смене пароля или выходе версия инкрементируется, мгновенно аннулируя старые JWT.
4. **Медиафайлы:**
   - Загрузка фотографий проходит через API (`PUT /storage/entry-photos/upload/:token`), где картинка валидируется, уменьшается до 1920px и пережимается в JPEG q=80 перед отправкой в S3.

---

## 5. Важные правила и ограничения

- **Сохранение производительности ленты (Feed):**
  Лента построена на `WITH authors AS ... CROSS JOIN LATERAL (...)` и Keyset Cursor `(date, created_at, id)`. Никогда не заменяйте этот запрос на наивный плоский `JOIN entries` и не используйте `OFFSET`.
- **Правила изменения Database Schema:**
  - Никогда не изменяйте задним числом уже примененные миграции `0001`–`0020`.
  - Любые изменения структуры БД оформляются строго новым файлом (например, `0021_name.sql`).
  - Миграции должны быть идемпотентными (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`) и выполняться в транзакции.
- **Каноническое правило приватности (Friend Visibility):**
  Запись видна зрителю только если:
  `(e.user_id = viewer) OR (friendship.status = 'accepted' AND e.is_hidden = false AND COALESCE(efv.is_hidden, ufv.hide_by_default, false) = false)`.
  При изменении записей или настроек приватности обязательно вызывать `SummaryCache.InvalidateUser(userID)`.
- **Изоляция новых друзей:**
  При принятии дружбы (`friends.Respond` со статусом `accepted`) записи с кастомной видимостью автоматически скрываются для нового друга. Не удаляйте этот триггер/логику.
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
   *(Примечание: тест `hidden_test.go` требует запущенной БД; дефект аргументов на строке 176 описан в `docs/current-state.md`).*

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
- **Развертывание и CI/CD** → [docs/deployment.md](docs/deployment.md)
- **Архитектурные решения (ADR)** → [docs/decisions/README.md](docs/decisions/README.md)

> [!IMPORTANT]
> **Главное правило:**
> Перед внесением нетривиальных изменений изучите соответствующую документацию в `docs/` и исходный код. Если документация противоречит исходному коду, доверяйте исходному коду и при необходимости обновляйте документацию.

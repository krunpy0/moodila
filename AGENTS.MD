# MOODSHARE — FULL PROJECT CONTEXT FOR AI AGENTS (LLM CONTEXT GUIDE)

Этот документ предоставляет полный архитектурный, технический и функциональный контекст проекта **MoodShare**. Используй его, чтобы понимать структуру кодовой базы, стек технологий, конвенции разработки и взаимосвязи компонентов.

---

## 1. Обзор проекта (Project Overview)

**MoodShare** — это мобильное веб-приложение (PWA на React + Vite + Tailwind CSS) для ведения дневника настроения и дня с социальной составляющей.

### Ключевые возможности:

- **Дневник настроения:** Ежедневные записи с выбором эмодзи (шкала 1–5), выбором тегов по категориям (_Positive_, _Neutral_, _Difficult_), текстовой заметкой, прикреплением фото и аудио-голосовых заметок (_Voice Notes_).
- **Календарь и аналитика (Summary):** Визуальный календарь по месяцам, подсчет доминирующего настроения, частого тега и статистики за месяц.
- **Социальная сеть друзей:** Поиск пользователей по username, система заявок в друзья (pending / accept / decline / cancel), удаление друзей.
- **Просмотр друзей:** Возможность смотреть календарь и открытые записи подтвержденных друзей.
- **Лента активности (Feed):** Общая лента нескрытых записей друзей с поддержкой лайков и комментариев.
- **Уведомления и анонсы (Notifications & Announcements):** Колокольчик с бейджем непрочитанных событий, модальный центр уведомлений, система системных анонсов (в том числе админ-панель для их управления).
- **Безопасность и аккаунт:** Авторизация JWT + CSRF, восстановление пароля через почту (Resend API), безопасная смена пароля и полное анонимизирующее удаление аккаунта (Account Deletion).
- **Резервное копирование:** Автоматический фоновый бэкап базы данных в Google Drive.

---

## 2. Технический стек (Tech Stack)

### Backend

- **Язык:** Go 1.24/1.25 (`go.mod`)
- **Web-фреймворк:** [Gin](https://github.com/gin-gonic/gin) (`v1.10.1`)
- **База данных:** PostgreSQL (управляемая через Supabase)
- **Драйвер БД:** [`pgx/v5`](https://github.com/jackc/pgx) (`pgxpool` + чистые SQL-запросы, без тяжелых ORM)
- **Аутентификация и безопасность:**
  - JWT (`github.com/golang-jwt/jwt/v5`)
  - Хеширование паролей: bcrypt (`golang.org/x/crypto`)
  - CSRF-защита для мутирующих запросов
  - Тьер-лимитирование запросов (Rate Limiting) через `golang.org/x/time/rate`
- **Файловое хранилище (Storage):** S3-совместимое хранилище (Supabase Storage / Cloudflare R2 / AWS S3 / MinIO). Прямая загрузка из браузера через подписанные PUT URL (`Presigned URLs`).
- **Интеграции:**
  - **Resend API:** отправка транзакционных писем (сброс пароля, удаление аккаунта).
  - **Google Drive API:** фоновое резервное копирование БД по расписанию.

### Frontend

- **Язык / Сборщик:** React 19 (`^19.2.7`), Vite 8 (`^8.1.1`), ES Modules
- **Роутинг:** React Router DOM 7 (`^7.18.1`)
- **Управление состоянием и кешированием API:** TanStack React Query v5 (`^5.101.4`)
- **Стилизация:** Tailwind CSS 3 (`^3.4.19`) + `index.css` + дизайн-токены
- **PWA:** `vite-plugin-pwa`
- **Линтинг:** Oxlint (`^1.71.0`)
- **Утилиты UI:** `react-easy-crop` (кроп аватаров)

---

## 3. Архитектура и структура директорий

```text
moodshare/
├── AGENTS.MD                        # Исходный бриф и чеклист фич проекта
├── backend/
│   ├── cmd/api/main.go              # Точка входа бэкенда: подключение БД, роуты, миграции, крон бэкапов
│   ├── internal/
│   │   ├── backup/                  # Фоновый планировщик резервного копирования БД в Google Drive
│   │   ├── config/                  # Чтение .env параметров (БД, S3, JWT, Resend, GDrive)
│   │   ├── db/                      # Инициализация pgxpool и встроенный SQL-мигратор
│   │   ├── handlers/                # HTTP-хендлеры Gin (auth, entries, friends, feed, notifications, storage, users, announcements)
│   │   ├── mailer/                  # Клиент отправки писем через Resend API (с fallback-логированием в dev)
│   │   ├── middleware/              # JWT Auth, CORS, Rate Limiters, CSRF, Admin check, Logging
│   │   ├── models/                  # Структуры данных Go (User, Entry, Friend, Feed, Notification, Announcement, Reset/Delete tokens)
│   │   └── repository/              # SQL-запросы к PostgreSQL по репозиторному паттерну
│   ├── migrations/                  # SQL-миграции (от 0001 до 0010, выполняются лексически при старте)
│   ├── go.mod / go.sum
│   └── README.md
├── frontend/
│   ├── public/                      # Статические ассеты, иконки PWA
│   ├── src/
│   │   ├── api/                     # Клиент API и обертки над fetch (auth.js, entries.js, feed.js, queries.js, ...)
│   │   ├── components/              # UI-компоненты (BottomNav, HeaderBell, NotificationCenterModal, VoiceNotePlayer, AvatarCropModal, ...)
│   │   ├── pages/                   # Страницы (Home, Calendar, AddEntry, Feed, Friends, Profile, Auth, Forgot/Reset/ConfirmDelete, Admin, Landing)
│   │   ├── utils/                   # Вспомогательные утилиты
│   │   ├── App.jsx / main.jsx
│   │   └── index.css                # Глобальные стили и Tailwind-директивы
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
└── design-reference/                # Референсы дизайна
    ├── DESIGN.md                    # Дизайн-система (цвета, шрифты, отступы, тени, паттерны)
    └── stitch_moodshare_social_journal/ # Исходные HTML/CSS стейты экранов
```

---

## 4. Схема базы данных и миграции (`backend/migrations/`)

1. **`0001_create_users.sql`** — Таблица `users`: `id`, `email`, `password_hash`, `username`, `display_name`, `avatar_url`, `created_at`.
2. **`0002_create_entries.sql`** — Таблица `entries`: `id`, `user_id`, `date`, `mood` (1–5), `tags` (`text[]`), `text`, `photo_url`, `is_hidden`, `created_at`.
3. **`0003_create_friendships.sql`** — Таблица `friendships`: `id`, `requester_id`, `addressee_id`, `status` (`pending`, `accepted`, `declined`), `created_at`, `updated_at`.
4. **`0004_create_likes.sql`** — Таблица `likes`: `id`, `entry_id`, `user_id`, `created_at`.
5. **`0005_create_comments_and_reactions.sql`** — Таблицы для комментариев к записям в ленте и реакций.
6. **`0006_create_notifications.sql`** — Таблица `notifications`: хранит события (заявки в друзья, лайки, комментарии) для бейджа и центра уведомлений.
7. **`0007_add_audio_to_entries.sql`** — Добавляет колонку `audio_url` в таблицу `entries` для голосовых заметок.
8. **`0008_create_announcements.sql`** — Таблицы анонсов (`announcements`) и прочитанных анонсов пользователями (`announcement_reads`).
9. **`0009_create_password_reset_tokens.sql`** — Таблица `password_reset_tokens` (одноразовые токены с TTL для сброса пароля).
10. **`0010_create_account_deletion_tokens.sql`** — Таблица `account_deletion_tokens` и колонка `deleted_at` в `users` (для soft-delete / анонимизации аккаунта).

---

## 5. Бэкенд: API, эндпоинты и безопасность

### Группы эндпоинтов:

- **Публичные эндпоинты (`/auth/*`, `/health`):**
  - `GET /health` — проверка статуса сервера и подключения к БД.
  - `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`.
  - `POST /auth/forgot-password`, `POST /auth/reset-password` — сброс пароля.
  - `POST /auth/account/delete-confirm` — публичное подтверждение удаления аккаунта по токену из письма.
- **Защищенные эндпоинты (`Authorization: Bearer <JWT>` + CSRF):**
  - `GET /auth/session` — валидация сессии.
  - `PATCH /auth/password` — смена пароля в профиле.
  - `POST /auth/account/delete-request` — запрос удаления аккаунта с отправкой письма-подтверждения.
  - **Записи (`/entries`):** `POST /entries` (создание/обновление), `DELETE /entries/:id`, `PATCH /entries/:id/visibility`, `GET /entries/me`, `GET /entries/friend/:friend_id`, `GET /entries/summary`.
  - **Хранилище (`/storage`):** получение Presigned URL для загрузки фото (`/storage/entry-photos/upload-url`) и аудио (`/storage/entry-audio/upload-url`), удаление объектов.
  - **Друзья (`/friends` & `/users`):** поиск `GET /users/search`, запросы дружбы `POST /friends/request`, `accept`, `decline`, `cancel`, `DELETE /friends/:id`, списки `GET /friends`, `GET /friends/pending`, просмотр профиля друга `GET /users/:id/profile`.
  - **Лента (`/feed`):** `GET /feed`, лайки `POST /feed/:entry_id/like`, комментарии `GET /POST /feed/:entry_id/comments`, `DELETE /feed/comments/:comment_id`.
  - **Уведомления (`/notifications`):** список, `GET /unread-count`, отметка прочитанными `POST /mark-read`.
  - **Анонсы (`/announcements`):** `GET /announcements/unread`, `POST /announcements/:id/read`.
- **Административные эндпоинты (`/admin/*`, требует middleware `Admin`):**
  - CRUD и управление анонсами: `GET/POST /admin/announcements`, `PATCH /admin/announcements/:id`, `POST /publish`, `POST /archive`.

### Безопасность и Rate Limiting:

В `cmd/api/main.go` настроены тьер-лимитеры по IP или `UserOrIPKey`:

- `authLimiter`: 5 зап. / 12 сек.
- `forgotLimiter`: 1 зап. / 60 сек.
- `passwordChangeLimiter`: 5 зап. / 60 сек.
- `uploadLimiter`: 10 зап. / 4 сек.
- `mutationLimiter`: 15 зап. / 2 сек.
- `readLimiter`: 30 зап. / 0.6 сек.

---

## 6. Фронтенд: Архитектура, страницы и состояние

- **Управление запросами и кешем:** Вся работа с API инкапсулирована в директории `src/api/` (через TanStack React Query). Кеш-ключи централизованы в `src/api/queryKeys.js`.
- **Ключевые страницы (`src/pages/`):**
  - `Home.jsx` — главный экран с приветствием, сводкой за неделю и карточкой статистики настроения.
  - `Calendar.jsx` — календарь месяца с переключателем просмотра своего календаря или календаря друга.
  - `AddEntry.jsx` — экран добавления/редактирования записи (выбор эмодзи, категорий тегов, текста, фото, запись аудио).
  - `Feed.jsx` — социальная лента активности друзей с лайками, комментариями и плеером аудиозаметок.
  - `Friends.jsx` / `FriendProfile.jsx` — поиск друзей, управление заявками, профиль друга.
  - `Profile.jsx` — профиль пользователя, смена аватара (с кропом через `AvatarCropModal`), настройки смены пароля (`ChangePasswordForm`) и Danger Zone для удаления аккаунта (`DeleteAccountModal`).
  - `Admin.jsx` — панель администратора для создания и публикации системных объявлений.

---

## 7. Дизайн-система и верстка (UI/UX Conventions)

1. **Mobile-First:** Вёрстка ориентирована на мобильный вьюпорт (`~380–420px`), адаптивна под десктоп (используется `DesktopSidebar` и центральный контейнер).
2. **Источник истины по стилям:**
   - **Первичный источник:** Статичные HTML-референсы в `design-reference/stitch_moodshare_social_journal/`.
   - **Вторичный источник:** `design-reference/DESIGN.md` (дизайн-система: палитры, тени, скругления, шрифты).
3. **Правило для ИИ-агентов:** Никогда не придумывать произвольные стили с нуля. Всегда опираться на токены Tailwind и правила из `DESIGN.md`.

---

## 8. Инструкции для ИИ-агентов при разработке (Rules for AI)

1. **Вертикальные срезы (Vertical Slice Development):**
   - При добавлении или изменении фичи реализуйте изменения сквозным образом: **Миграция БД -> Репозиторий Go -> Хендлер API -> API-клиент фронтенда -> UI Компонент/Страница -> Проверка E2E**.
2. **Работа с БД (Go Repository Pattern):**
   - Не использовать ORM. Писать SQL-запросы в пакете `internal/repository/` с использованием `pgxpool.Pool` и параметризованных запросов (`$1`, `$2`, ...).
   - Любые изменения схемы БД создавать исключительно через новый файл миграции в `backend/migrations/` (в лексическом порядке номеров, например `0011_...sql`).
3. **Безопасность API:**
   - Все мутирующие хендлеры (POST, PATCH, PUT, DELETE) должны быть защищены JWT-аутентификацией, CSRF-миддлварей и соответствующим Rate Limiter-ом.
4. **Фронтенд и состояние:**
   - Для всех сетевых запросов использовать хуки TanStack React Query (`src/api/queries.js`). Не писать `useEffect` с прямыми `fetch`-вызовами внутри UI-компонентов.
   - Обязательно инвалидировать соответствующие `queryKeys` при успешных мутациях.

```

```

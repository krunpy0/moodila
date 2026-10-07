# Database Architecture & Query Patterns

Документ описывает организацию реляционной базы данных **PostgreSQL 15+**, схему таблиц, стратегию индексирования, механизм миграций и специфику выполнения SQL-запросов в Moodila.

---

## 1. Общие принципы работы с БД

1. **Чистый SQL без ORM:** Все запросы пишутся вручную в слое `internal/repository/`. Это дает полный контроль над планами выполнения (`EXPLAIN ANALYZE`), позволяет использовать продвинутые возможности PostgreSQL (`CROSS JOIN LATERAL`, `UNNEST`, кортежные сравнения) и исключает накладные расходы на рефлексию.
2. **Пул соединений `pgxpool.Pool`:** Настроен в `internal/db/db.go`. Лимиты соединений по умолчанию: `minConns = 5`, `maxConns = 50` (настраиваются через переменные `DATABASE_MIN_CONNS` и `DATABASE_MAX_CONNS`).
3. **Simple Protocol (`QueryExecModeSimpleProtocol`):** Бэкенд намеренно использует простой протокол выполнения запросов. Это обеспечивает 100% совместимость с пулерами транзакций PgBouncer (включая Supabase Transaction Pooler), где подготовленные выражения (Prepared Statements) запрещены, и позволяет выполнять многооператорные SQL-миграции в одном вызове `Exec`.

---

## 2. Основные таблицы и связи

```
       ┌────────────────────────┐
       │         users          │
       └───────────┬────────────┘
                   │ 1
                   │
         ┌─────────┼─────────┬─────────────────────────┐
       N │       N │       N │                       N │
         ▼         ▼         ▼                         ▼
   ┌─────────┐ ┌────────┐ ┌───────────────┐ ┌──────────────────────┐
   │ entries │ │ likes  │ │  friendships  │ │user_friend_visibility│
   └────┬────┘ └────────┘ └───────────────┘ └──────────────────────┘
        │ 1
        │
   ┌────┴──────────────────────────┐
 N │                             N │
   ▼                               ▼
┌──────────┐            ┌───────────────────────┐
│ comments │            │entry_friend_visibility│
└──────────┘            └───────────────────────┘
```

### 2.1. `users` (Пользователи)
- **Первичный ключ:** `id UUID DEFAULT gen_random_uuid()`.
- **Поля:** `email` (UNIQUE), `username` (UNIQUE), `password_hash`, `display_name`, `avatar_url`, `is_admin` (BOOLEAN DEFAULT false), `token_version` (INT NOT NULL DEFAULT 1), `deleted_at` (TIMESTAMPTZ, мягкое удаление), `created_at`.
- **Особенности:** Поле `token_version` инкрементируется при смене пароля или выходе со всех устройств, что мгновенно инвалидирует все выданные ранее токены.

### 2.2. `entries` (Записи настроения и дня)
- **Первичный ключ:** `id UUID DEFAULT gen_random_uuid()`.
- **Поля:** `user_id` (FK `users` ON DELETE CASCADE), `date` (DATE NOT NULL), `mood` (SMALLINT 1–5), `tags` (TEXT[] NOT NULL DEFAULT '{}'), `text` (TEXT NOT NULL DEFAULT ''), `photo_url` (TEXT), `audio_url` (TEXT), `audio_duration` (INT), `is_hidden` (BOOLEAN NOT NULL DEFAULT false), `created_at`.
- **Ограничения:** `UNIQUE (user_id, date)`. Пользователь может иметь строго одну запись за конкретную календарную дату.

### 2.3. `friendships` (Связи дружбы)
- **Первичный ключ:** `id UUID DEFAULT gen_random_uuid()`.
- **Поля:** `requester_id` (FK `users`), `addressee_id` (FK `users`), `status` (TEXT: `pending`, `accepted`, `declined`), `created_at`, `updated_at`.
- **Ограничения:** `CHECK (requester_id <> addressee_id)`.
- **Уникальность пары:** Уникальный функциональный индекс `UNIQUE (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id))`. Предотвращает дублирующие и зеркальные записи дружбы между двумя пользователями.

### 2.4. `likes` и `comments` (Социальные взаимодействия)
- **`likes`:** `id`, `entry_id` (FK `entries` ON DELETE CASCADE), `user_id` (FK `users` ON DELETE CASCADE), `reaction` (TEXT NOT NULL DEFAULT '❤️'), `created_at`. Уникальность: `UNIQUE (entry_id, user_id, reaction)`.
- **`comments`:** `id`, `entry_id` (FK `entries` ON DELETE CASCADE), `user_id` (FK `users` ON DELETE CASCADE), `text` (TEXT), `created_at`.

### 2.5. Двухуровневая приватность: `user_friend_visibility` и `entry_friend_visibility`
- **`user_friend_visibility`:** Аккаунт-дефолты скрытия. Составной PK `(user_id, friend_id)`. Поле `hide_by_default BOOLEAN`.
- **`entry_friend_visibility`:** Постовые исключения/оверрайды. Составной PK `(entry_id, friend_id)`. Поле `is_hidden BOOLEAN`.

### 2.6. `announcements` и `announcement_user_state`
- **`announcements`:** Системные анонсы и онбординг. Поля: `title`, `body`, `severity` (`info`, `warning`, `critical`), `status` (`draft`, `published`, `archived`), `kind` (`standard`, `onboarding`), `display_type` (`modal`, `banner`, `feed_only`), `expires_at`, `cta_label`, `cta_url`, `is_pinned`, `published_at`.
- **`announcement_user_state`:** Состояния взаимодействия пользователя. Составной PK `(announcement_id, user_id)`. Поля: `dismissed_at` (пользователь закрыл прерывающий UI) и `read_at` (пользователь прочитал в инбоксе).

### 2.7. Служебные таблицы
- **`notification_settings`:** Персональные настройки пушей (`notify_reactions`, `notify_comments`, `notify_friend_requests`, `notify_new_posts`).
- **`push_subscriptions`:** Подписки браузеров на Web Push (`endpoint` UNIQUE, `p256dh`, `auth`).
- **`password_reset_tokens`** и **`account_deletion_tokens`:** Одноразовые токены с SHA-256 хешами и сроком жизни.
- **`schema_migrations`:** Таблица истории миграций (`version TEXT PRIMARY KEY`, `applied_at`).

---

## 3. Критически важные индексы

Индексы спроектированы под самые высоконагруженные сценарии (социальная лента, календарь, поиск):

1. **`idx_entries_user_date`** на `entries (user_id, date DESC, created_at DESC, id DESC)`:
   *Основной индекс системы.* Позволяет выполнять индексное сканирование (Index Scan) внутри `CROSS JOIN LATERAL` для ленты и покрывает выборку записей за месяц в календаре.
2. **`friendships_user_pair_idx`** на `friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id))`:
   Гарантирует уникальность пары и ускоряет проверку статуса дружбы.
3. **`friendships_requester_status_idx`** на `friendships (requester_id, status)` и **`friendships_addressee_status_idx`** на `friendships (addressee_id, status)`:
   Обеспечивают мгновенный сбор ID друзей в CTE `authors` через `UNION ALL` без полного сканирования таблицы связей.
4. **`idx_user_friend_visibility_friend`** на `user_friend_visibility (friend_id, user_id)`:
   Ускоряет проверку дефолтной приватности при фильтрации записей зрителя.
5. **`idx_entry_friend_visibility_entry`** и **`idx_entry_friend_visibility_friend`**:
   Индексы для проверки точечных оверрайдов записи.
6. **`idx_announcements_prompt`** на `announcements (status, kind, published_at, expires_at)`:
   Обеспечивает быстрое извлечение активного объявления/онбординга.

---

## 4. Пагинация и основные паттерны SQL-запросов

### 4.1. Keyset Cursor пагинация (Feed)
Пагинация ленты построена не на `OFFSET`, а на строгом сравнении кортежей (Keyset Pagination):
```sql
(e.date, e.created_at, e.id) < ($cursorDate, $cursorCreatedAt, $cursorID)
ORDER BY e.date DESC, e.created_at DESC, e.id DESC
LIMIT $limit + 1
```
Курсор передается между клиентом и сервером в виде строки Base64: `base64(date|created_at|id)`.

### 4.2. Архитектура выборки социальной ленты (`CROSS JOIN LATERAL`)
Вместо объединения таблицы друзей со всей многотысячной таблицей записей, запрос сначала находит список друзей в CTE `authors`, а затем для каждого автора выбирает ровно N записей:
```sql
WITH authors AS (
    SELECT addressee_id AS uid FROM friendships WHERE requester_id = $viewerID AND status = 'accepted'
    UNION ALL
    SELECT requester_id AS uid FROM friendships WHERE addressee_id = $viewerID AND status = 'accepted'
),
matching_entries AS (
    SELECT x.*
    FROM authors a
    CROSS JOIN LATERAL (
        SELECT e.id, e.user_id, e.date, e.mood, e.tags, e.text, e.photo_url, e.audio_url, e.audio_duration, e.created_at
        FROM entries e
        LEFT JOIN entry_friend_visibility efv ON efv.entry_id = e.id AND efv.friend_id = $viewerID
        LEFT JOIN user_friend_visibility ufv ON ufv.user_id = e.user_id AND ufv.friend_id = $viewerID
        WHERE e.user_id = a.uid
          AND e.is_hidden = false
          AND COALESCE(efv.is_hidden, ufv.hide_by_default, false) = false
        ORDER BY e.date DESC, e.created_at DESC, e.id DESC
        LIMIT $limit + 1
    ) x
    ORDER BY x.date DESC, x.created_at DESC, x.id DESC
    LIMIT $limit + 1
)
SELECT m.*, u.id, u.username, u.display_name, u.avatar_url,
       (SELECT COUNT(*)::int FROM comments c WHERE c.entry_id = m.id) AS comment_count
FROM matching_entries m
JOIN users u ON u.id = m.user_id
ORDER BY m.date DESC, m.created_at DESC, m.id DESC;
```

### 4.3. Канонический предикат приватности записи
Предикат, определяющий, имеет ли право зритель `viewer_id` видеть запись автора `e.user_id`:
```sql
(e.user_id = $viewer_id)
OR (
    f.status = 'accepted'
    AND e.is_hidden = false
    AND COALESCE(efv.is_hidden, ufv.hide_by_default, false) = false
)
```

### 4.4. Агрегация тегов месяца через UNNEST
Для получения самого частого тега пользователя за месяц используется LATERAL UNNEST:
```sql
SELECT tag
FROM entries
CROSS JOIN LATERAL UNNEST(entries.tags) AS tags(tag)
WHERE user_id = $userID AND date >= $startOfMonth AND date < $startOfNextMonth
GROUP BY tag
ORDER BY COUNT(*) DESC, LOWER(tag)
LIMIT 1;
```

---

## 5. Система миграций (`backend/migrations/`)

- Миграции хранятся в виде чистых SQL-файлов с 4-значным префиксом (`0001_create_users.sql` ... `0020_feed_performance_indexes.sql`).
- Все миграции встроены в бинарный файл через `embed.FS` (`backend/migrations/migrations.go`).
- При старте API или при запуске CLI `go run ./cmd/migrate` функция `db.Migrate` считывает директорию в лексикографическом порядке.
- Каждая новая миграция выполняется в **отдельной транзакции** вместе с записью в таблицу `schema_migrations`.
- **Правило внесения изменений:** Никогда не редактируйте примененные миграции с 0001 по 0020. Любые изменения схемы выполняются исключительно созданием нового файла с очередным порядковым номером (например, `0021_...sql`).

# Friends & Social Subsystem

Этот документ описывает социальный граф, жизненный цикл дружбы, механизмы изоляции приватных записей и взаимодействие пользователей в приложении **Moodila**.

---

## 1. Модель связей дружбы в базе данных

Дружба между двумя пользователями моделируется одной строкой в таблице `friendships`:

```sql
CREATE TABLE friendships (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (requester_id <> addressee_id)
);
```

### Гарантия симметричной уникальности
Чтобы исключить параллельное создание двух встречных заявок между пользователями A и B, используется уникальный функциональный индекс:
```sql
CREATE UNIQUE INDEX friendships_user_pair_idx
    ON friendships (
        LEAST(requester_id, addressee_id),
        GREATEST(requester_id, addressee_id)
    );
```
Благодаря этому пара `(A, B)` всегда идентична паре `(B, A)`.

---

## 2. Жизненный цикл заявки в друзья (Friend Request Lifecycle)

```
                     POST /friends/request
                            │
                            ▼
                    ┌───────────────┐
                    │    pending    │
                    └───┬───────┬───┘
   POST /friends/accept │       │ POST /friends/decline
                        ▼       ▼
               ┌────────────┐ ┌────────────┐
               │  accepted  │ │  declined  │
               └─────┬──────┘ └─────┬──────┘
DELETE /friends/:id  │              │ POST /friends/request (re-request)
                     ▼              ▼
                 [Удалено]     ┌────────────┐
                               │  pending   │
                               └────────────┘
```

1. **Поиск пользователей (`GET /users/search?q=...`):**
   - Фронтенд использует дебаунс 300 мс (`useDebounce`).
   - SQL ранжирует результаты: сначала точный префикс username, затем display_name, затем вхождение подстроки.
   - Исключает текущего пользователя и удаленные аккаунты (`deleted_at IS NULL`). Возвращает до 20 пользователей со статусом дружбы относительно текущего пользователя (`pending`, `accepted`, `declined` или `null`).
2. **Отправка заявки (`POST /friends/request`):**
   - Принимает `{"addressee_id": "<uuid>"}`.
   - Если записи о дружбе не было — создается строка со статусом `pending`.
   - Если ранее был статус `declined` — запись обновляется (`status = 'pending'`, `updated_at = now()`).
   - Получателю отправляется in-app уведомление и Web Push (если включено в настройках).
3. **Принятие заявки (`POST /friends/accept`):**
   - Принимает `{"friendship_id": "<uuid>"}`.
   - Статус переводится в `accepted`.
   - Инициатору заявки отправляется уведомление о принятии.
   - **Автоматическая изоляция приватных постов:** См. раздел 3.
4. **Отклонение заявки (`POST /friends/decline`):**
   - Статус переводится в `declined`.
5. **Отмена отправленной заявки (`POST /friends/cancel`):**
   - Инициатор удаляет свою заявку в статусе `pending` (`DELETE FROM friendships WHERE status = 'pending' AND requester_id = $1`).
6. **Удаление из друзей (`DELETE /friends/:id`):**
   - Удаляет дружбу в статусе `accepted`.
   - **Каскадная очистка приватности:** См. раздел 4.

---

## 3. Изоляция кастомных записей от новых друзей

> [!IMPORTANT]
> **Критическое бизнес-правило безопасности:**
> Когда пользователь принимает заявку в друзья, новый друг **не должен автоматически получить доступ** к историческим записям, для которых автор настраивал кастомную (точечную) видимость.

В методе `Friends.Respond` (`backend/internal/repository/friends.go`) при переходе дружбы в статус `accepted` выполняется автоматическое скрытие:

```go
// Автоматически скрываем для нового друга все существующие посты автора,
// у которых настроена кастомная видимость (entry_friend_visibility):
_, _ = r.Pool.Exec(ctx, `
    INSERT INTO entry_friend_visibility (entry_id, friend_id, is_hidden)
    SELECT e.id, $2, true
    FROM entries e
    WHERE e.user_id = $1
      AND EXISTS (SELECT 1 FROM entry_friend_visibility efv WHERE efv.entry_id = e.id)
    ON CONFLICT (entry_id, friend_id) DO NOTHING`,
    friendship.RequesterID, friendship.AddresseeID,
)
```
Аналогичный запрос выполняется и в обратную сторону для записей адресата. Это гарантирует, что записи с ограниченным кругом зрителей остаются скрытыми от новых друзей.

---

## 4. Каскадная очистка при разрыве дружбы (Unfriend Cleanup)

При удалении дружбы (`Friends.Delete`) в базе данных выполняется транзакционная подчистка всех связанных настроек видимости:

```sql
-- 1. Удаление дружбы
DELETE FROM friendships
WHERE status = 'accepted' AND (
    (id = $targetID AND (requester_id = $userID OR addressee_id = $userID))
    OR (
        LEAST(requester_id, addressee_id) = LEAST($userID::uuid, $targetID::uuid)
        AND GREATEST(requester_id, addressee_id) = GREATEST($userID::uuid, $targetID::uuid)
    )
);

-- 2. Удаление аккаунт-дефолтов между бывшими друзьями
DELETE FROM user_friend_visibility
WHERE (user_id = $u1 AND friend_id = $u2) OR (user_id = $u2 AND friend_id = $u1);

-- 3. Удаление постовых оверрайдов между бывшими друзьями
DELETE FROM entry_friend_visibility
WHERE (friend_id = $u1 AND entry_id IN (SELECT id FROM entries WHERE user_id = $u2))
   OR (friend_id = $u2 AND entry_id IN (SELECT id FROM entries WHERE user_id = $u1));
```
Это предотвращает накопление «мусорных» строк в таблицах видимости после распада дружбы.

---

## 5. Просмотр календарей и профилей друзей

### 5.1. Доступ к календарю друга (`GET /entries/friend/:friend_id?month=YYYY-MM`)
1. Вызывается проверка `CanViewFriend(ctx, userID, friendID)`. Если дружба не находится в статусе `accepted`, сервер немедленно возвращает `403 Forbidden`.
2. Вызывается репозиторий `VisibleByMonth(ctx, friendID, userID, month, nextMonth)`.
3. Возвращаются записи друга за указанный месяц с фильтрацией:
   - Исключаются глобально скрытые записи (`is_hidden = false`).
   - Исключаются записи, скрытые по дефолту или через точечный оверрайд.
   - Значения `is_hidden` и `has_custom_visibility` в ответе для зрителя маскируются как `false` в целях конфиденциальности автора.

### 5.2. Профиль друга (`GET /users/:id/profile`)
Возвращает профиль пользователя, текущий счетчик дней подряд (streak), общее количество дней ведения дневника и список последних открытых записей для зрителя.

---

## 6. Эндпоинты социального API

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/users/search?q=...` | Поиск пользователей по username и имени |
| `GET` | `/users/:id/profile` | Публичный профиль пользователя |
| `POST` | `/friends/request` | Отправка заявки в друзья (`{ "addressee_id": "..." }`) |
| `POST` | `/friends/accept` | Принятие заявки (`{ "friendship_id": "..." }`) |
| `POST` | `/friends/decline` | Отклонение заявки (`{ "friendship_id": "..." }`) |
| `POST` | `/friends/cancel` | Отмена своей заявки (`{ "target_id": "..." }`) |
| `DELETE`| `/friends/:id` | Удаление из друзей (по ID дружбы или ID друга) |
| `GET` | `/friends` | Список подтвержденных друзей |
| `GET` | `/friends/pending` | Список входящих заявок в друзья |
| `GET` | `/friends/visibility-defaults` | Настройки видимости по умолчанию для каждого друга |
| `PATCH`| `/friends/:id/visibility-default`| Установка скрытия по умолчанию (`{ "hide_by_default": bool }`)|
| `GET` | `/entries/friend/:friend_id` | Месячный календарь открытых записей друга |

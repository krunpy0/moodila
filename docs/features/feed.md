# Social Feed Architecture & Implementation

Этот документ содержит исчерпывающее техническое описание подсистемы социальной ленты (**Feed**) приложения **Moodila**: SQL-архитектуру, правила видимости, пагинацию, индексы, клиентское потребление и критические инварианты производительности.

---

## 1. Концепция ленты и правила видимости (Visibility Rules)

Лента представляет собой хронологический поток записей друзей пользователя, упорядоченный в обратном порядке (сначала самые свежие).

### 1.1. Кого видит зритель (`viewerID`)
1. **Друзья:** В ленту попадают только записи пользователей, с которыми у зрителя установлена подтвержденная дружба:
   `friendships.status = 'accepted'` (в любом направлении: `requester_id` или `addressee_id`).
2. **Собственные записи (`includeSelf`):** Опциональный флаг. Управляется тумблером в UI и сохраняется в `localStorage` (`moodshare_feed_include_self`).
   - Если `includeSelf = false` (по умолчанию): отображаются исключительно посты друзей.
   - Если `includeSelf = true`: к списку авторов добавляется сам зритель (`SELECT $1::uuid AS uid UNION ALL ...`).

### 1.2. Фильтрация приватности для каждой записи
Для того чтобы запись автора попала в ленту зрителю, она должна удовлетворять каноническому правилу приватности:

```sql
(a.uid = $viewerID)
OR (
    e.is_hidden = false
    AND COALESCE(efv.is_hidden, ufv.hide_by_default, false) = false
)
```

- **`e.is_hidden` (Глобальное скрытие):** Если автор отметил запись как скрытую (`is_hidden = true`), она исключается из ленты всех друзей без исключения. Сам автор при `includeSelf = true` свои скрытые записи видит.
- **`efv.is_hidden` (Постовой оверрайд в `entry_friend_visibility`):** Точечное правило автора для конкретного друга на эту запись. Имеет наивысший приоритет.
- **`ufv.hide_by_default` (Аккаунт-дефолт в `user_friend_visibility`):** Настройка по умолчанию между автором и другом. Используется, если нет точечного оверрайда на уровне записи.
- **`false` (Fallback):** Если нет ни оверрайда, ни дефолта, запись считается открытой для подтвержденного друга.

---

## 2. Пагинация и структура курсора (Keyset Cursor Pagination)

Лента использует курсорную пагинацию (Keyset / Seek Pagination). Использование `OFFSET` категорически запрещено из-за квадратичной деградации времени выполнения на глубоких страницах.

### 2.1. Формат и кодирование курсора
Курсор формируется как строка Base64, содержащая три разделителя:
```text
base64( <date> | <created_at_RFC3339Nano> | <entry_id> )
```
Пример:
```text
MjAyNi0xMC0wN3wyMDI2LTEwLTA3VDE0OjMwOjAwLjk4NzY1NFp8ZTFhMmIzYzQt...
```

### 2.2. Декодирование и применение в SQL
При наличии параметра `cursor` бэкенд декодирует его в три переменные: `cursorDate` (string `YYYY-MM-DD`), `cursorCreatedAt` (time.Time), `cursorID` (string UUID).

Условие фильтрации в SQL использует строгое сравнение кортежей PostgreSQL:
```sql
AND (e.date, e.created_at, e.id) < ($cursorDate, $cursorCreatedAt, $cursorID)
```

### 2.3. Сортировка и лимиты
- **Сортировка:** Строго детерминированная: `ORDER BY date DESC, created_at DESC, id DESC`.
- **Лимиты страницы:**
  - Дефолтный `limit = 10`.
  - Максимальный `limit = 50`.
  - Запрос в БД всегда запрашивает `limit + 1` записей.
  - Если получено больше `limit` строк, берется запись с индексом `limit - 1`, из ее полей генерируется `nextCursor`, а возвращаемый клиенту массив усекается до `limit`. Если возвращено `<= limit`, `nextCursor` возвращается пустым (достигнут конец ленты).

---

## 3. SQL-архитектура и оптимизация запроса

Запрос ленты в `backend/internal/repository/feed.go` является критическим для производительности всей системы и оптимизирован под работу на слабом CPU:

```sql
WITH authors AS (
    -- Список авторов для выборки:
    SELECT addressee_id AS uid FROM friendships WHERE requester_id = $1 AND status = 'accepted'
    UNION ALL
    SELECT requester_id AS uid FROM friendships WHERE addressee_id = $1 AND status = 'accepted'
    -- При includeSelf добавляется: UNION ALL SELECT $1::uuid AS uid
),
matching_entries AS (
    SELECT x.*
    FROM authors a
    CROSS JOIN LATERAL (
        SELECT e.id, e.user_id, e.date, e.mood, e.tags, e.text, e.photo_url, e.audio_url, e.audio_duration, e.created_at
        FROM entries e
        LEFT JOIN entry_friend_visibility efv ON efv.entry_id = e.id AND efv.friend_id = $1
        LEFT JOIN user_friend_visibility ufv ON ufv.user_id = e.user_id AND ufv.friend_id = $1
        WHERE e.user_id = a.uid
          AND e.is_hidden = false
          AND COALESCE(efv.is_hidden, ufv.hide_by_default, false) = false
          -- AND (e.date, e.created_at, e.id) < ($cursorDate, $cursorCreatedAt, $cursorID) [при наличии курсора]
        ORDER BY e.date DESC, e.created_at DESC, e.id DESC
        LIMIT $limit + 1
    ) x
    ORDER BY x.date DESC, x.created_at DESC, x.id DESC
    LIMIT $limit + 1
)
SELECT m.id, m.date::text, m.mood, m.tags, m.text, m.photo_url, m.audio_url, m.audio_duration, m.created_at,
       u.id, u.username, u.display_name, u.avatar_url,
       0 AS like_count,
       false AS liked_by_me,
       '' AS my_reaction,
       (SELECT COUNT(*)::int FROM comments c WHERE c.entry_id = m.id) AS comment_count
FROM matching_entries m
JOIN users u ON u.id = m.user_id
ORDER BY m.date DESC, m.created_at DESC, m.id DESC;
```

### 3.1. Почему `CROSS JOIN LATERAL` вместо плоского `JOIN`
- В плоском `JOIN` планировщик PostgreSQL вынужден был сканировать и сортировать сотни тысяч записей из таблицы `entries`, чтобы найти 10 самых свежих среди всех друзей. Это приводило к сбросу промежуточных результатов на диск и времени ответа > 1300 мс под нагрузкой.
- При `CROSS JOIN LATERAL` планировщик обращается к составному индексу каждого автора отдельно и берет не более 11 записей на каждого друга (Top-N per group). Объединение 10–50 авторов по 11 строк занимает считанные миллисекунды (~7.5 мс на базе из 300 000 записей).
- Эквивалентность выборки этого алгоритма верифицирована на 200 пользователях через CLI-утилиту `backend/cmd/verify_feed/main.go`.

---

## 4. Индексы базы данных, влияющие на ленту

Для стабильной работы ленты критически важны следующие индексы (созданы в миграциях `0003`, `0015` и `0020`):

1. **`idx_entries_user_date`** на `entries (user_id, date DESC, created_at DESC, id DESC)`:
   Обеспечивает обратное индексное сканирование (Index Scan Backward) внутри подзапроса `LATERAL` без сортировки в памяти.
2. **`friendships_requester_status_idx`** на `friendships (requester_id, status)` и **`friendships_addressee_status_idx`** на `friendships (addressee_id, status)`:
   Позволяют мгновенно извлечь список друзей в CTE `authors` через Index Scan.
3. **`idx_user_friend_visibility_friend`** на `user_friend_visibility (friend_id, user_id)`:
   Ускоряет соединение с таблицей дефолтов приватности по `friend_id = viewerID`.
4. **`idx_entry_friend_visibility_friend`** на `entry_friend_visibility (friend_id)`:
   Ускоряет соединение с постовыми оверрайдами по `friend_id = viewerID`.

---

## 5. Пакетная загрузка реакций (Batch Reactions Population)

Подсчет реакций **намеренно не включен в основной SQL-запрос ленты**, чтобы избежать тяжелых `GROUP BY` и блокировок строк.

После получения списка записей вызывается метод `populateReactions` (`internal/repository/feed.go`):
1. Собираются все `ID` записей текущей страницы.
2. Выполняется единственный плоский запрос:
   ```sql
   SELECT entry_id::text, user_id::text, reaction
   FROM likes
   WHERE entry_id = ANY($1::uuid[])
   ```
3. Реакции агрегируются в памяти Go:
   - Подсчитывается `totalCount` лайков.
   - Определяется, ставил ли текущий зритель реакцию (`likedByMe`, `myReactions`).
   - Группируются счетчики по эмодзи (`❤️`, `👏`, `💡`, `😁`, `🔥`) и сортируются по убыванию популярности.

---

## 6. Клиентское потребление ленты (Frontend Consumption)

- **React Query Hook:** `useInfiniteFeedQuery(limit = 10, includeSelf)` в `frontend/src/api/queries.js`.
  - Ключ запроса: `queryKeys.feed(includeSelf)`.
  - Функция получения страницы: `getFeed({ cursor: pageParam, limit, includeSelf })`.
  - Извлечение следующей страницы: `getNextPageParam: (lastPage) => lastPage.next_cursor || undefined`.
- **Infinite Scroll:** Реализован в `frontend/src/pages/Feed.jsx` через `IntersectionObserver` на невидимом элементе-стороже (`observerRef`) внизу списка.
- **Deep-linking (Переход к конкретной записи):** Если в URL присутствует параметр `?entry=<entryId>`, страница после загрузки данных автоматически выполняет плавный скролл к элементу `feed-entry-${targetEntryId}`.
- **Оптимистичные лайки:** При нажатии на реакцию мутация `useLikeEntryMutation` немедленно обновляет счетчик и локальное состояние реакции в кеше React Query, откатывая изменения при ошибке сети (`previousFeedQueries`).

---

## 7. Критические инварианты (Что нельзя менять)

> [!WARNING]
> Следующие элементы архитектуры ленты являются результатом тонкой оптимизации. Их изменение приведет к скрытым багам или катастрофической деградации производительности:

1. **Не заменяйте `CROSS JOIN LATERAL` на обычный `JOIN entries`:** На продакшен-объемах данных это приведет к зависанию запросов и потреблению 100% CPU.
2. **Не удаляйте `id` из кортежа курсора:** Кортеж `(date, created_at, id)` гарантирует строгую детерминированность. Без `id` записи с одинаковой датой и временем создания будут либо дублироваться, либо выпадать из пагинации.
3. **Не переносите расчет реакций в основной SELECT:** Подзапросы `(SELECT COUNT(*) FROM likes)` на каждую строку в основном запросе деградируют время выполнения.
4. **Не нарушайте порядок в `COALESCE`:** Порядок `COALESCE(efv.is_hidden, ufv.hide_by_default, false)` определяет бизнес-логику: точечный оверрайд записи всегда побеждает дефолт аккаунта.

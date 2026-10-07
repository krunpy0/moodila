# Onboarding & Announcements Subsystem

Этот документ описывает подсистему онбординга новых пользователей, доставки системных объявлений и жизненного цикла прерывающих интерфейсов в приложении **Moodila**.

---

## 1. Двухуровневый онбординг (Onboarding Architecture)

Процесс первого знакомства пользователя с приложением разделен на два независимых слоя:

```
┌────────────────────────────────────────────────────────┐
│             1. Клиентский роутинг первого визита       │
│           (RootRoute: Landing ──► Login ──► Home)      │
└───────────────────────────┬────────────────────────────┘
                            │ Регистрация / Вход
                            ▼
┌────────────────────────────────────────────────────────┐
│             2. Серверный онбординг и анонсы            │
│    (/announcements/active-prompt ──► AnnouncementQueue)│
│    - 7-дневное окно для обучающих подсказок            │
│    - Защита от старых исторических новостей            │
└────────────────────────────────────────────────────────┘
```

### 1.1. Клиентский роутинг первого визита (`frontend/src/pages/RootRoute.jsx`)
При входе на корневой URL (`/`) проверяется статус сессии и факт предыдущего взаимодействия:
- **Если пользователь уже авторизован:** немедленный редирект на `/home`.
- **Если не авторизован:**
  - Если приложение запущено в режиме PWA (`display-mode: standalone`) или пользователь уже посещал сайт ранее (`localStorage.getItem('ms_visited') === '1'`): редирект на форму входа `/login`.
  - Если это абсолютно первый визит в браузере: отображается промо-страница `/landing` с описанием ценности сервиса, скриншотами и призывами к регистрации. Факт визита фиксируется установкой маркера `ms_visited = '1'`.

---

## 2. Модель данных объявлений и состояний пользователя

В миграции `0018_rework_announcements.sql` подсистема была кардинально обновлена для поддержки управляемого онбординга:

### 2.1. Таблица `announcements`
```sql
ALTER TABLE announcements
    ADD COLUMN kind TEXT NOT NULL DEFAULT 'standard'
        CHECK (kind IN ('standard', 'onboarding')),
    ADD COLUMN display_type TEXT NOT NULL DEFAULT 'modal'
        CHECK (display_type IN ('modal', 'banner', 'feed_only')),
    ADD COLUMN expires_at TIMESTAMPTZ,
    ADD COLUMN cta_label TEXT,
    ADD COLUMN cta_url TEXT,
    ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT false;
```
- **`kind`:**
  - `standard` — обычные новостные анонсы, релизы, сервисные предупреждения.
  - `onboarding` — обучающие материалы, приветственные сообщения для новичков.
- **`display_type`:**
  - `banner` — плавающая компактная плашка в верхней части экрана.
  - `modal` — центрированное модальное окно поверх интерфейса.
  - `feed_only` — объявление не прерывает работу пользователя, отображается только в ленте/архиве.
- **`severity`:** `info`, `warning`, `critical`.
- **`status`:** `draft`, `published`, `archived`.
- **`expires_at`:** Опциональная дата автоматического истечения объявления.

### 2.2. Таблица `announcement_user_state`
Вместо бинарного флага «прочитано», состояния взаимодействия пользователя строго разделены:
```sql
CREATE TABLE announcement_user_state (
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dismissed_at    TIMESTAMPTZ,
    read_at         TIMESTAMPTZ,
    PRIMARY KEY (announcement_id, user_id)
);
```
- **`dismissed_at`:** Время, когда пользователь скрыл всплывающий UI (нажал крестик на баннере или закрыл окно). После этого объявление больше **никогда не показывается в прерывающем интерфейсе**, но остается доступным в инбоксе/архиве.
- **`read_at`:** Время, когда объявление было явно помечено прочитанным в инбоксе.

---

## 3. Правила видимости и публикации (Publishing & Visibility Rules)

В методе `Announcements.ActivePromptForUser` (`backend/internal/repository/announcements.go`) заложены строгие правила изоляции:

```sql
WHERE a.status = 'published'
  AND a.published_at IS NOT NULL AND a.published_at <= now()
  AND (a.expires_at IS NULL OR a.expires_at > now())
  AND a.display_type IN ('modal', 'banner')
  AND (aus.dismissed_at IS NULL)
  AND (
      (a.kind = 'standard' AND a.published_at >= u.created_at)
      OR
      (a.kind = 'onboarding' AND u.created_at >= now() - interval '7 days')
  )
```

### 3.1. 7-дневное окно для Onboarding (`kind = 'onboarding'`)
- Объявление с типом `onboarding` показывается пользователю **только в первые 7 дней** с момента его регистрации:
  `u.created_at >= now() - interval '7 days'`.
- Если новичок зарегистрировался более 7 дней назад и не успел ознакомиться с онбординг-подсказкой, она автоматически прекращает прерывать его сессию.

### 3.2. Изоляция истории для новичков (`kind = 'standard'`)
- Новые пользователи **не видят архивные системные новости**, выпущенные до их регистрации:
  `a.published_at >= u.created_at`.
- Это защищает новых пользователей от водопада старых всплывающих окон при первой авторизации.

### 3.3. Серверный инвариант: строго не более 1 активного промпта
Эндпоинт `GET /announcements/active-prompt` возвращает **строго не более 1 объекта** (`LIMIT 1`) по детерминированному приоритету:
1. `severity`: `critical` (3) > `warning` (2) > `info` (1).
2. `published_at DESC`: более свежие объявления при равной важности.
3. `id DESC`: стабильный детерминизм.

Пользователь никогда не столкнется с ситуацией, когда несколько модальных окон накладываются друг на друга.

---

## 4. Клиентский компонент `AnnouncementQueue` (`frontend/src/components/AnnouncementQueue.jsx`)

Компонент монтируется внутри `RequireAuth` в `frontend/src/App.jsx` и активен на всех защищенных страницах:

1. **Режим баннера (`display_type = 'banner'`):**
   - Отображается как плавающая плашка сверху: `fixed top-safe-4 inset-x-4 max-w-lg`.
   - Не перекрывает рабочую область, поддерживает темную и светлую темы с эффектом `backdrop-blur`.
   - Клик по крестику вызывает мутацию `useDismissAnnouncementMutation(id)` (`POST /announcements/:id/dismiss`). Баннер исчезает.
   - Клик по телу баннера открывает подробное модальное окно.
2. **Режим модального окна (`display_type = 'modal'`):**
   - Полноэкранный оверлей с анимацией появления.
   - Поддерживает клавиатурную навигацию (ESC, фокус-ловушка через `useModalKeyboard`).
   - Если `severity = 'critical'`, закрытие по ESC заблокировано — требуется явное действие.
3. **Целевое действие (CTA):**
   - Если заданы `cta_label` и `cta_url`, отображается кнопка действия.
   - Нажатие на CTA выполняет подтверждение (`POST /announcements/:id/acknowledge`), закрывает модалку и выполняет переход (внутренний роутинг через `navigate(url)` или внешняя ссылка через `window.open`).

---

## 5. Эндпоинты API объявлений и онбординга

| Метод | Путь | Назначение |
|---|---|---|
| `GET` | `/announcements/active-prompt` | Получение текущего активного прерывающего промпта (0 или 1 объект) |
| `GET` | `/announcements/inbox` | Список всех доступных пользователю объявлений со статусами `is_read`, `is_dismissed` |
| `POST`| `/announcements/:id/dismiss` | Скрытие прерывающего интерфейса (`dismissed_at = now()`) |
| `POST`| `/announcements/:id/acknowledge`| Подтверждение и прочтение (`dismissed_at = now()`, `read_at = now()`) |
| `POST`| `/announcements/:id/read` | Отметка прочитанным в инбоксе (`read_at = now()`) |
| `GET` | `/admin/announcements` | Админ-список объявлений со всеми статусами |
| `POST`| `/admin/announcements` | Создание объявления (требует прав админа) |
| `PATCH`|`/admin/announcements/:id` | Редактирование объявления |
| `POST`| `/admin/announcements/:id/publish` | Публикация объявления |
| `POST`| `/admin/announcements/:id/unpublish`| Снятие с публикации |
| `POST`| `/admin/announcements/:id/archive` | Перевод в архив |
| `DELETE`|`/admin/announcements/:id` | Удаление объявления |

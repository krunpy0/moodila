# Authentication & Authorization Architecture

Этот документ детально описывает фактическую подсистему аутентификации, авторизации и защиты от CSRF в проекте **Moodila**.

---

## 1. Концепция безопасности и хранения токенов

Moodila использует **Cookie-Based JWT аутентификацию с двойной защитой от CSRF и версионированием сессий**:

1. **Отказ от токенов в `localStorage`:** Токены доступа и обновления хранятся исключительно в cookies с флагом `HttpOnly`. Это полностью предотвращает кражу учетных данных через XSS-атаки в браузере.
2. **Встроенный в JWT токен CSRF:** При генерации `access_token` сервер создает криптографически стойкую 16-байтную случайную hex-строку и вшивает ее в claims токена (`csrf: "<hex>"`). Клиенту эта строка отдается в незащищенной cookie `csrf_token` (или в заголовке ответа `X-CSRF-Token`).
3. **Мгновенная инвалидация через `token_version`:** В таблице `users` хранится целочисленное поле `token_version` (по умолчанию `1`). Оно зашивается в claims каждого токена. При смене пароля или выходе со всех устройств счетчик инкрементируется (`UPDATE users SET token_version = token_version + 1`), что немедленно аннулирует все выданные ранее токены без необходимости вести черные списки в БД/Redis.

---

## 2. Структура Cookies и JWT Claims

### 2.1. Используемые Cookies
| Имя Cookie | Срок жизни (TTL) | HttpOnly | SameSite | Secure | Назначение |
|---|---|---|---|---|---|
| `access_token` | 15 минут | `true` | Настраивается (`Lax` / `None` / `Strict`) | `true` в prod, `false` в dev | Краткосрочный JWT для авторизации запросов |
| `refresh_token`| 30 дней | `true` | Настраивается (`Lax` / `None` / `Strict`) | `true` в prod, `false` в dev | Долгосрочный JWT для ротации токенов |
| `csrf_token` | 30 дней | `false` | Настраивается (`Lax` / `None` / `Strict`) | `true` в prod, `false` в dev | Токен для чтения JS-клиентом и передачи в заголовке |

### 2.2. Формат JWT Claims (`CustomClaims`)
```json
{
  "iss": "moodshare",
  "sub": "00000000-0000-0000-0000-000000000000",
  "iat": 1775574000,
  "exp": 1775574900,
  "type": "access",
  "csrf": "3f9a7b1c4e2d8a5f0e1b2c3d4e5f6a7b",
  "token_version": 1
}
```
- Для `refresh_token` поле `type` равно `"refresh"`, а срок действия (`exp`) составляет `now + 30 days`.

---

## 3. Middleware Pipeline

### 3.1. `middleware.Auth` (`backend/internal/middleware/auth.go`)
1. Считывает cookie `access_token`. Если значение отсутствует — возвращает `401 {"error": "missing token"}`.
2. Валидирует подпись HMAC-SHA256 ключом `JWT_SECRET`, issuer (`moodshare`) и срок действия.
3. Проверяет claim `type == "access"`. Если нет — возвращает `401 {"error": "invalid token type"}`.
4. Помещает в контекст Gin:
   - `c.Set("userID", claims.Subject)`
   - `c.Set("tokenVersion", claims.TokenVersion)`
   - `c.Set("csrfToken", claims.CSRF)`
5. Устанавливает заголовок ответа `X-CSRF-Token: claims.CSRF`.
6. Обогащает контекст Sentry (`hub.Scope().SetUser(...)`).

### 3.2. `middleware.CSRF` (`backend/internal/middleware/csrf.go`)
1. Проверяет HTTP-метод запроса.
2. Для безопасных методов (`GET`, `HEAD`, `OPTIONS`) проверка пропускается.
3. Для мутирующих методов (`POST`, `PUT`, `PATCH`, `DELETE`):
   - Считывает заголовок `X-CSRF-Token` из входящего запроса.
   - Извлекает `csrfToken` из контекста Gin (куда он попал из проверенного access-токена в `middleware.Auth`).
   - Если заголовок отсутствует или не совпадает с `csrfToken` из контекста — немедленно прерывает запрос: `403 {"error": "invalid or missing CSRF token"}`.

### 3.3. `middleware.Admin` (`backend/internal/middleware/admin.go`)
1. Вызывается для маршрутов `/admin/*`.
2. Извлекает `userID` из контекста.
3. Делает запрос в БД `users.ByID(ctx, userID)` и проверяет флаг `user.IsAdmin`.
4. Если `!user.IsAdmin` — возвращает `403 {"error": "admin access required"}`.

---

## 4. Сценарии аутентификации (Auth Flows)

### 4.1. Вход и регистрация (`/auth/login`, `/auth/register`)
1. Клиент передает JSON с `email` и `password`.
2. Сервер валидирует формат, сравнивает bcrypt-хеш.
3. Сервер генерирует случайный `csrfToken`, создает пару JWT (`access_token`, `refresh_token`) и выставляет браузерные куки.
4. В теле ответа клиенту возвращается объект пользователя и `csrf_token`.

### 4.2. Автоматическая ротация токенов (`POST /auth/refresh`)
1. Срабатывает при получении статуса `401 Unauthorized` в клиентском сетевом слое (`api/client.js`).
2. Сервер извлекает cookie `refresh_token` и валидирует подпись.
3. Сервер запрашивает пользователя из БД: `users.ByID(ctx, claims.Subject)`.
4. Сверяет версию токена: `if claims.TokenVersion != user.TokenVersion`. При несовпадении (пароль был изменен на другом устройстве) куки немедленно очищаются и возвращается `401 {"error": "session invalidated or user not found"}`.
5. При успехе сервер генерирует новые cookies `access_token` и `refresh_token` с обновленным CSRF-токеном.

### 4.3. Выход из системы (`POST /auth/logout`)
Сервер удаляет куки `access_token`, `refresh_token` и `csrf_token`, устанавливая `MaxAge = -1` и пустое значение.

### 4.4. Смена пароля (`PATCH /auth/password`)
1. Запрос требует авторизации и CSRF.
2. Проверяется старый пароль по bcrypt.
3. Пароль обновляется в БД, а поле `token_version` инкрементируется на `+1`.
4. Перевыпускаются куки с новой версией токена для текущего клиента, а все остальные сессии на других устройствах становятся невалидными.

### 4.5. Сброс забытого пароля через Email (Resend)
1. `POST /auth/forgot-password`: Генерируется случайный криптографический токен (32 байта). В таблицу `password_reset_tokens` записывается SHA-256 хеш токена со сроком жизни 30 минут. Клиенту на email отправляется ссылка вида `/reset-password?token=<hex>`.
2. `POST /auth/reset-password`: Сервер сверяет SHA-256 хеш токена, проверяет срок жизни и `used_at IS NULL`. После обновления пароля токен помечается использованным (`used_at = now()`), а `token_version` пользователя инкрементируется, завершая все активные сессии.

---

## 5. Поведение клиентского слоя (`frontend/src/api/client.js`)

- Все fetch-запросы выполняются с `credentials: 'include'`.
- CSRF-токен извлекается из `document.cookie` (`csrf_token`), заголовка ответа `X-CSRF-Token` или из тела ответа auth-запросов и сохраняется в памяти и `localStorage`.
- В каждый запрос подставляются заголовки:
  - `Content-Type: application/json`
  - `X-CSRF-Token: <token>`
  - `X-Time-Zone: <браузерный часовой пояс>`
- **Прозрачный Retry:** Если API возвращает `401` и запрос еще не был повторен (`!_isRetry`), клиент выполняет `refreshToken()`, обновляет `X-CSRF-Token` и повторяет оригинальный запрос.

---

## 6. Классификация эндпоинтов по требованиям к аутентификации

### Публичные эндпоинты (No Auth)
- `GET /health`
- `GET /app/features`, `GET /features`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/account/delete-confirm`
- `POST /auth/logout`

### Защищенные эндпоинты (`Auth` + `CSRF` для мутаций)
- Все маршруты `/entries/*` (`GET`, `POST`, `PATCH`, `DELETE`)
- Все маршруты `/friends/*` (`GET`, `POST`, `PATCH`, `DELETE`)
- Все маршруты `/feed/*` (`GET`, `POST`, `DELETE`)
- Все маршруты `/notifications/*` (`GET`, `POST`, `PATCH`, `DELETE`)
- Все маршруты `/storage/*` (`POST`, `PUT`)
- Все маршруты `/announcements/*` (`GET`, `POST`)
- `GET /auth/session`
- `PATCH /auth/password`, `POST /auth/account/delete-request`
- `GET /users/me`, `PATCH /users/me`, `GET /users/:id/profile`, `GET /users/search`, `GET /stats`

### Административные эндпоинты (`Auth` + `CSRF` + `Admin`)
- Все маршруты `/admin/announcements/*` (`GET`, `POST`, `PATCH`, `DELETE`)

# Production Deployment & Infrastructure

Этот документ описывает производственную инфраструктуру, процесс непрерывного развертывания (CI/CD) и правила конфигурирования сервисов **Moodila**.

---

## 1. Архитектура производственного контура

```
                Internet / Users
                       │
                       ▼
         [ Cloudflare DNS / CDN / SSL ]
                       │
                       ▼ HTTPS (Port 443)
┌────────────────────────────────────────────────────────┐
│                   Production VPS                       │
│             (Linux, 1 vCPU / 1 GB RAM)                 │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │             Reverse Proxy (Nginx / Caddy)        │  │
│  │   - SSL Termination (Let's Encrypt)              │  │
│  │   - Static assets (/opt/moodila/frontend/dist)   │  │
│  │   - Proxy pass /api, /auth, etc. ──► :8080       │  │
│  └──────────────────────────┬───────────────────────┘  │
│                             │ HTTP (Port 8080)         │
│                             ▼                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │       Moodila Go API (systemd / Docker)          │  │
│  │       Binary: /opt/moodila/bin/moodila           │  │
│  └──────────────┬─────────────────────────┬─────────┘  │
└─────────────────┼─────────────────────────┼────────────┘
                  │                         │
                  ▼                         ▼
┌─────────────────────────────┐   ┌──────────────────────┐
│     PostgreSQL 15+          │   │ S3 Storage (R2/S3)   │
│ (Managed / Supabase / Local)│   │ (Медиафайлы записей) │
└─────────────────────────────┘   └──────────────────────┘
                  │
                  ▼ (Cron каждые 3 часа)
┌─────────────────────────────┐
│     Google Drive Backups    │
└─────────────────────────────┘
```

---

## 2. Компоненты инфраструктуры

1. **Сервер:** Linux VPS (минимальные подтвержденные нагрузочным тестированием требования — 1 ядро vCPU и 1 GB оперативной памяти).
2. **Reverse Proxy:**
   - Обрабатывает SSL/TLS сертификаты.
   - Раздает статические файлы клиентского приложения из директории скомпилированного фронтенда.
   - Перенаправляет API-запросы на локальный порт `:8080` бэкенда с обязательной передачей заголовков:
     - `X-Forwarded-Proto https`
     - `X-Real-IP $remote_addr`
     - `Host $host`
3. **Менеджер процессов:**
   - Либо системный демон `systemd` с директивой `Restart=always` для скомпилированного бинарника Go.
   - Либо Docker-контейнер (`backend/Dockerfile`), запускаемый с ограничением памяти.
4. **База данных:** PostgreSQL 15+ (локальная установка или облачный экземпляр, например Supabase). Пул соединений обслуживается `pgxpool` в режиме простого протокола (`SimpleProtocol`).
5. **Файловое хранилище:** S3-совместимое хранилище (AWS S3, Cloudflare R2, MinIO) с настроенным публичным URL (`S3_PUBLIC_BASE_URL`).

---

## 3. Пайплайн CI/CD (`.github/workflows/go.yml`)

В проекте настроен автоматический деплой через GitHub Actions:

- **Триггер:** `push` в ветку `main`.
- **Шаги пайплайна:**
  1. **Checkout:** Получение исходного кода (`actions/checkout@v4`).
  2. **Сборка Frontend:**
     - Установка Node.js 22 (`actions/setup-node@v4`).
     - `npm ci` в папке `frontend`.
     - `npm run build` — генерация продакшен-бандла в `frontend/dist`.
     - Упаковка в архив: `tar -czf frontend.tar.gz -C frontend/dist .`.
  3. **Сборка Backend:**
     - Установка Go 1.25 (`actions/setup-go@v5`).
     - Загрузка модулей: `go mod download`.
     - Статическая компиляция бинарника для Linux без CGO:
       ```bash
       CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o moodila ./cmd/api
       ```
  4. **Доставка артефактов:**
     - Установка SSH-ключа из секрета `SSH_KEY` и добавление хоста в `known_hosts`.
     - Копирование скомпилированного бинарника `moodila` по `scp` в `/opt/moodila/incoming/`.
     - Копирование архива `frontend.tar.gz` по `scp` в `/opt/moodila/incoming/`.
  5. **Активация релиза:**
     - Выполнение скрипта развертывания на целевом сервере:
       ```bash
       ssh -p "${{ secrets.PORT || 22 }}" ${{ secrets.USER }}@${{ secrets.HOST }} "/opt/moodila/deploy.sh"
       ```

---

## 4. Конфигурация переменных окружения

### 4.1. Backend (`backend/.env`)
Все настройки считываются через `internal/config/config.go`:

| Переменная | Обязательность | Значение по умолчанию | Описание |
|---|---|---|---|
| `PORT` | Нет | `8080` | Локальный порт для прослушивания HTTP |
| `DATABASE_URL` | **Да** | — | Строка подключения к PostgreSQL |
| `JWT_SECRET` | **Да** (в prod) | `dev-secret-change-me` | Ключ подписи JWT токенов (HMAC-SHA256) |
| `CORS_ORIGIN` | Нет | `http://localhost:5173` | Разрешенные источники (через запятую) |
| `APIPublicURL` / `API_PUBLIC_URL` | Нет | `http://localhost:8080` | Публичный URL API для генерации ссылок загрузки |
| `APP_ENV` | Нет | `development` | Режим работы (`production` или `development`) |
| `COOKIE_SECURE` | Нет | `true` (если `APP_ENV=production`) | Флаг Secure для auth-кук |
| `COOKIE_SAMESITE`| Нет | `lax` | Режим SameSite (`lax`, `strict`, `none`) |
| `COOKIE_DOMAIN` | Нет | — | Домен для кук (при использовании поддоменов) |
| `S3_ENDPOINT` | Нет | — | Кастомный endpoint для Cloudflare R2 / MinIO |
| `S3_REGION` | Нет | `us-east-1` | Регион бакета |
| `S3_BUCKET` | Нет | `entry-photos` | Имя бакета S3 |
| `ACCESS_KEY_ID` | Для фото | — | Ключ доступа к S3 |
| `SECRET_ACCESS_KEY`| Для фото | — | Секретный ключ к S3 |
| `S3_PUBLIC_BASE_URL`| Для фото | — | Публичный базовый URL для показа загруженных фото |
| `S3_FORCE_PATH_STYLE`| Нет | `false` | Использовать Path-style адресацию (для MinIO) |
| `RESEND_API_KEY` | Для писем | — | API ключ сервиса Resend |
| `RESEND_FROM_EMAIL`| Нет | `onboarding@resend.dev`| Адрес отправителя |
| `APP_BASE_URL` | Нет | `http://localhost:5173` | URL фронтенда для ссылок сброса пароля |
| `VAPID_PUBLIC_KEY` | Для пушей | — | Публичный ключ VAPID |
| `VAPID_PRIVATE_KEY`| Для пушей | — | Приватный ключ VAPID |
| `VAPID_SUBSCRIBER` | Для пушей | `mailto:admin@moodila.app`| Контакт оператора пушей (RFC 8292) |
| `ENABLE_AUTO_BACKUP`| Нет | `true` | Включение автобэкапов в Google Drive |
| `GDRIVE_REFRESH_TOKEN`| Для бэкапов | — | OAuth2 Refresh Token для Google Drive |
| `GDRIVE_CLIENT_ID` | Для бэкапов | — | OAuth2 Client ID |
| `GDRIVE_CLIENT_SECRET`| Для бэкапов| — | OAuth2 Client Secret |
| `GDRIVE_FOLDER_ID` | Для бэкапов | — | ID целевой папки в Google Drive |
| `BACKUP_INTERVAL_HOURS`| Нет | `3` | Интервал создания резервных копий (часы) |
| `BACKUP_RETENTION_DAYS`| Нет | `7` | Срок хранения бэкапов (дни) |
| `SENTRY_DSN` | Нет | — | DSN проект в Sentry для мониторинга ошибок |
| `SENTRY_ENVIRONMENT`| Нет | Значение `APP_ENV` | Окружение в Sentry (`production`, etc.) |
| `DISABLE_RATE_LIMIT`| Нет | `false` | Отключение Rate Limiting (для нагрузочных тестов) |

### 4.2. Frontend (`frontend/.env`)
| Переменная | Описание |
|---|---|
| `VITE_API_URL` | URL бэкенд API (в prod обычно пустой или `/` при использовании единого домена через Reverse Proxy) |
| `VITE_SENTRY_RELEASE` | Версия релиза для связывания клиентских логов в Sentry |
| `SENTRY_AUTH_TOKEN` | Токен авторизации для загрузки Source Maps при сборке Vite |
| `SENTRY_ORG` / `SENTRY_PROJECT` | Организация и проект в Sentry |

---

## 5. Резервное копирование и восстановление

- **Автоматический бэкап:** Каждые 3 часа встроенный планировщик `internal/backup` запускает `pg_dump`, упаковывает дамп в gzip и загружает файл на Google Drive в указанную папку. Устаревшие файлы старше 7 дней удаляются автоматически.
- **Ручной запуск:** Для ручного создания и немедленной выгрузки резервной копии используется CLI-команда:
  ```bash
  cd backend && go run ./cmd/backup
  ```

# Codebase Map & Modification Guide

Этот документ представляет собой навигационную карту кодовой базы **Moodila**. Используйте его, чтобы быстро определить, какие файлы и директории отвечают за ту или иную подсистему и какие компоненты необходимо изменять при решении типовых задач.

---

## 1. Общая структура репозитория

```text
moodila/
├── AGENTS.MD                     # Компактный главный контекстный файл для AI-агентов
├── README.md                     # Документация проекта для разработчиков и развертывания
├── docker-compose.yml            # Локальный запуск PostgreSQL в Docker
├── docker-compose.loadtest.yml   # Стенд нагрузочного тестирования (Postgres + API с лимитами ресурсов)
├── .github/
│   └── workflows/go.yml          # CI/CD пайплайн (сборка, SCP на сервер, запуск deploy.sh)
├── backend/                      # Серверная часть на Go
├── frontend/                     # Клиентская часть (React 19 + Vite 8 + Tailwind CSS)
├── docs/                         # Полная проектная документация и ADR
├── loadtest/                     # Нагрузочное тестирование k6 (сценарии, сидер на 20k пользователей)
└── design-reference/             # Документация по дизайн-системе (DESIGN.md) и мокапы
```

---

## 2. Карта Backend (`backend/`)

```text
backend/
├── cmd/
│   ├── api/main.go               # Точка входа HTTP API, сборка DI, роутинг, graceful shutdown
│   ├── backup/main.go            # CLI-утилита для ручного запуска бэкапа БД
│   ├── migrate/main.go           # CLI-утилита для отдельного наката миграций
│   ├── token/main.go             # Генератор Google Drive OAuth2 Refresh Token
│   ├── verify_feed/main.go       # Верификатор эквивалентности алгоритмов ленты (200 пользователей)
│   └── verify_keys/main.go       # Проверка валидности VAPID-ключей для Web Push
├── internal/
│   ├── backup/                   # Резервное копирование PostgreSQL в Google Drive
│   │   ├── backup.go             # Фоновый планировщик, pg_dump, Drive API v3 uploader
│   │   └── backup_test.go
│   ├── config/                   # Конфигурация приложения
│   │   └── config.go             # Парсинг переменных окружения и .env файлов
│   ├── db/                       # Слой управления БД
│   │   ├── db.go                 # Инициализация pgxpool.Pool и встроенный runner миграций
│   │   └── schema_test.go        # Интеграционные тесты миграций
│   ├── handlers/                 # HTTP-хендлеры Gin (транспортный слой)
│   │   ├── announcements.go      # Публичные анонсы, активный промпт, инбокс, админ-управление
│   │   ├── auth.go               # Регистрация, логин, рефреш токенов, смена пароля, удаление
│   │   ├── entries.go            # Сохранение, удаление записей, видимость, сводка месяца
│   │   ├── features.go           # Доступность сезонных тем и фич (/app/features)
│   │   ├── feed.go               # Социальная лента, лайки/реакции, комментарии
│   │   ├── friends.go            # Поиск пользователей, заявки, управление дефолтами приватности
│   │   ├── health.go             # Проверка статуса сервера и подключения к БД (/health)
│   │   ├── notifications.go      # Ин-апп уведомления, счетчик непрочитанных, настройки
│   │   ├── push_notifications.go # VAPID публичный ключ, подписка/отписка на Web Push
│   │   ├── stats.go              # Аналитика настроения, корреляция тегов, инсайты
│   │   ├── storage.go            # Подписание токенов загрузки, сжатие фото (1920px JPEG), удаление
│   │   └── users.go              # Текущий профиль (/users/me), обновление аватара/имени, профиль друга
│   ├── mailer/                   # Почтовый клиент Resend
│   │   └── mailer.go             # Отправка писем сброса пароля и удаления аккаунта
│   ├── middleware/               # Сквозные middleware Gin
│   │   ├── admin.go              # Авторизация администратора (проверка users.is_admin)
│   │   ├── auth.go               # JWT аутентификация по HttpOnly cookie (access_token)
│   │   ├── csrf.go               # Защита от CSRF (сверка X-CSRF-Token с claims токена)
│   │   ├── middleware.go         # CORS и HTTP Request Logger
│   │   └── ratelimit.go          # Token Bucket rate limiter по IP или userID
│   ├── models/                   # Доменные структуры данных
│   │   ├── account_deletion.go
│   │   ├── announcement.go
│   │   ├── entry.go
│   │   ├── feed.go
│   │   ├── friend.go
│   │   ├── notification.go
│   │   ├── notification_settings.go
│   │   ├── password_reset.go
│   │   ├── push_subscription.go
│   │   ├── stats.go
│   │   └── user.go
│   ├── repository/               # Data Access Layer (Raw SQL через pgxpool)
│   │   ├── account_deletion.go   # Токены удаления аккаунтов и удаление записей пользователя
│   │   ├── announcements.go      # Запросы активных промптов, инбокса, учет прочтений
│   │   ├── entries.go            # CRUD записей, VisibleByMonth, SummaryCache
│   │   ├── feed.go               # Оптимизированная лента с LATERAL join, батч реакций
│   │   ├── friends.go            # Управление связями дружбы, видимость по умолчанию
│   │   ├── notification_settings.go # Настройки push-типов пользователя
│   │   ├── notifications.go      # Создание уведомлений, батч-рассылка по друзьям
│   │   ├── password_reset.go     # Одноразовые токены сброса пароля
│   │   ├── push_subscriptions.go # Управление подписками браузера на Web Push
│   │   ├── stats.go              # Агрегатные выборки трендов настроения, тепловых карт, тегов
│   │   └── users.go              # CRUD пользователей, валидация версий токенов
│   ├── services/
│   │   └── push/                 # Сервис Web Push
│   │       ├── push.go           # VAPID клиент, сборка полезной нагрузки пуша
│   │       └── vapid.go          # Загрузка и декодирование VAPID ключей
│   └── storage/                  # Клиент объектного хранилища S3
│       └── s3.go                 # Генерация presigned URL, стриминг Put, Delete
├── migrations/                   # SQL-миграции 0001–0020
│   └── migrations.go             # Встраивание файлов миграций через embed.FS
├── Dockerfile                    # Multi-stage production build (alpine:3.21)
└── go.mod / go.sum               # Модуль moodshare (Go 1.25)
```

---

## 3. Карта Frontend (`frontend/`)

```text
frontend/
├── public/                       # Статические ассеты PWA
│   ├── favicon.svg
│   ├── icons.svg                 # SVG спрайт иконок
│   ├── sw-push.js                # Service Worker для обработки push-уведомлений и кликов
│   └── manifest.webmanifest      # Манифест PWA
├── src/
│   ├── api/                      # Сетевой слой и интеграция с API
│   │   ├── client.js             # Базовый fetch-клиент (cookies credentials, авто-рефреш, CSRF)
│   │   ├── queryKeys.js          # Централизованная фабрика ключей React Query
│   │   ├── queries.js            # Кастомные хуки React Query (useQuery, useMutation, useInfiniteQuery)
│   │   ├── announcements.js      # API-вызовы подсистемы объявлений
│   │   ├── auth.js               # API-вызовы логина, регистрации, сессии, сброса пароля
│   │   ├── entries.js            # API-вызовы дневника (сохранение, удаление, видимость)
│   │   ├── features.js           # Запрос сезонных тем (/app/features)
│   │   ├── feed.js               # API-вызовы социальной ленты, лайков, комментариев
│   │   ├── friends.js            # API-вызовы друзей, поиска, видимости по умолчанию
│   │   ├── health.js             # Запрос /health
│   │   ├── notifications.js      # API-вызовы центра уведомлений
│   │   ├── push.js               # Регистрация Service Worker и подписка на Web Push
│   │   └── users.js              # Профиль пользователя, аватар, имя
│   ├── components/               # Переиспользуемые UI-компоненты
│   │   ├── AppLayout.jsx         # Оболочка с safe-area insets для iPhone notch / Dynamic Island
│   │   ├── BottomNav.jsx         # Нижняя панель навигации мобильного интерфейса
│   │   ├── DesktopSidebar.jsx    # Боковая панель для широких экранов
│   │   ├── HeaderBell.jsx        # Иконка колокольчика уведомлений с бейджем непрочитанных
│   │   ├── AnnouncementQueue.jsx # Плавающий баннер и модальные окна анонсов/онбординга
│   │   ├── FriendPrivacyModal.jsx# Модальное окно настройки приватности (дефолты и точечные)
│   │   ├── VoiceNotePlayer.jsx   # Аудио-плеер голосовых заметок через audioManager
│   │   ├── ReactionsModal.jsx    # Выбор эмодзи-реакций к записям
│   │   ├── AvatarCropModal.jsx   # Интерактивное кадрирование аватаров
│   │   ├── DatePickerModal.jsx   # Выбор даты дневника
│   │   ├── DeleteAccountModal.jsx# Запрос на удаление аккаунта
│   │   ├── NotificationCenterModal.jsx # Шторка уведомлений
│   │   ├── NotificationSettingsModal.jsx # Настройка категорий пушей
│   │   ├── PWAInstallPrompt.jsx  # Баннер предложения установки PWA
│   │   ├── SplashScreen.jsx      # Загрузочный экран
│   │   ├── ThemePickerModal.jsx  # Селектор тем оформления
│   │   └── skeleton/             # Скелетоны экранов (PageSkeletons, SkeletonText, etc.)
│   ├── context/                  # React Contexts
│   │   ├── LanguageContext.jsx   # Переключение языков (ru / en)
│   │   └── ThemeContext.jsx      # Управление темами (12 тем, сезонный календарь)
│   ├── hooks/                    # Вспомогательные хуки
│   │   ├── useDebounce.js        # Дебаунс ввода (поиск пользователей)
│   │   ├── useModalKeyboard.js   # Доступность модальных окон (ESC, Tab focus trap)
│   │   └── useSafeTap.js         # Предотвращение случайных кликов при скролле
│   ├── i18n/                     # Файлы локализации
│   │   ├── ru.js                 # Русские строки интерфейса
│   │   └── en.js                 # Английские строки интерфейса
│   ├── pages/                    # Экраны приложения (React Router lazy)
│   │   ├── Home.jsx              # Главный экран дневника (календарная полоса, запись за день)
│   │   ├── AddEntry.jsx          # Создание / редактирование записи настроения
│   │   ├── Calendar.jsx          # Месячный календарь (свой и друзей, инспектор дня)
│   │   ├── Feed.jsx              # Социальная лента с бесконечным скроллом
│   │   ├── Friends.jsx           # Список друзей, поиск, входящие заявки
│   │   ├── FriendProfile.jsx     # Профиль друга со статистикой и открытыми записями
│   │   ├── Stats.jsx             # Аналитика, графики, корреляция тегов, инсайты
│   │   ├── Profile.jsx           # Настройки профиля, темы, безопасность, экспорт
│   │   ├── Admin.jsx             # Панель администратора анонсов
│   │   ├── Landing.jsx           # Промо-лендинг для неавторизованных пользователей
│   │   ├── Auth.jsx              # Формы входа и регистрации
│   │   ├── ForgotPassword.jsx    # Запрос ссылки сброса пароля
│   │   ├── ResetPassword.jsx     # Ввод нового пароля по токену
│   │   ├── ConfirmAccountDeletion.jsx # Подтверждение удаления аккаунта
│   │   └── RootRoute.jsx         # Маршрутизатор первого захода (landing / login / home)
│   ├── utils/                    # Вспомогательные утилиты
│   │   ├── audioManager.js       # Единственный глобальный звуковой менеджер (остановка других плееров)
│   │   ├── cropImage.js          # Кадрирование изображений canvas
│   │   ├── haptics.js            # Тактильный отклик (Web Vibration API + iOS Audio Haptics)
│   │   ├── moods.js              # Цвета, названия и иконки 5 уровней настроения
│   │   ├── offlineStore.js       # IndexedDB / localStorage хранилище для работы офлайн
│   │   └── themes.js             # Определение 6 семейств тем (Classic, Forest, Ocean, etc.)
│   ├── App.jsx                   # Декларативная маршрутизация и провайдеры
│   ├── main.jsx                  # Точка входа React SPA
│   ├── sentry.js                 # Инициализация клиентского Sentry
│   └── index.css                 # Дизайн-токены, CSS-переменные тем, стили Tailwind
├── package.json                  # Скрипты dev, build, lint (oxlint)
├── tailwind.config.js            # Настройки шрифтов, радиусов, safe-area отступов
└── vite.config.js                # Vite плагины: React, PWA (Workbox), Sentry
```

---

## 4. Карта модификаций по функциональным задачам (Where to Make Changes)

В таблице указано, какие файлы и слои затрагиваются при решении типовых задач:

| Задача | Файлы бэкенда | Файлы фронтенда | База данных |
|---|---|---|---|
| **Изменение полей записи дневника** (новые атрибуты, эмодзи, вложения) | `internal/models/entry.go`<br>`internal/handlers/entries.go`<br>`internal/repository/entries.go` | `src/api/entries.js`<br>`src/api/queries.js`<br>`src/pages/AddEntry.jsx`<br>`src/pages/Home.jsx`<br>`src/pages/Calendar.jsx` | Новая миграция в `migrations/002X_...sql` |
| **Оптимизация или изменение алгоритма социальной ленты** | `internal/repository/feed.go`<br>`internal/handlers/feed.go`<br>`cmd/verify_feed/main.go` | `src/api/feed.js`<br>`src/pages/Feed.jsx`<br>`src/api/queries.js` | Индексы в `migrations/` при необходимости |
| **Изменение системы приватности или видимости** | `internal/repository/entries.go`<br>`internal/repository/friends.go`<br>`internal/handlers/friends.go` | `src/components/FriendPrivacyModal.jsx`<br>`src/pages/AddEntry.jsx`<br>`src/pages/Friends.jsx` | Таблицы `user_friend_visibility` и `entry_friend_visibility` |
| **Добавление нового типа уведомлений** | `internal/models/notification.go`<br>`internal/repository/notifications.go`<br>`internal/services/push/push.go` | `src/components/NotificationCenterModal.jsx`<br>`public/sw-push.js`<br>`src/i18n/ru.js`, `en.js` | Таблицы `notifications`, `notification_settings` |
| **Изменение системы объявлений и онбординга** | `internal/handlers/announcements.go`<br>`internal/repository/announcements.go` | `src/components/AnnouncementQueue.jsx`<br>`src/pages/Admin.jsx`<br>`src/api/announcements.js` | Таблицы `announcements`, `announcement_user_state` |
| **Добавление новой темы оформления** | `internal/handlers/features.go` | `src/utils/themes.js`<br>`src/index.css`<br>`src/components/ThemePickerModal.jsx` | Не затрагивает БД |
| **Изменение лимитов Rate Limiter** | `internal/middleware/ratelimit.go`<br>`cmd/api/main.go` | — | Не затрагивает БД |
| **Изменение пайплайна развертывания** | `Dockerfile`<br>`docker-compose*.yml` | `vite.config.js` | `.github/workflows/go.yml` |

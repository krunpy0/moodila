# Moodila

A self-hosted social mood tracker and micro-journaling Progressive Web App (PWA). Built with a Go REST API and a React 19 frontend.

## Features

- **Mood Tracking & Journaling:** 1–5 scale (Rad, Good, Meh, Bad, Awful), categorized tags (Positive, Neutral, Difficult), text notes, photo attachments via S3 presigned URLs, and voice memos.
- **Granular Privacy:** Global entry visibility toggling, per-friend default visibility presets, and per-entry privacy overrides.
- **Calendar:** Monthly visual overview for personal and friends' entries, dominant mood badges, top tags, and day-by-day modal inspection with swipe navigation.
- **Social & Feed:** Friend search and request workflow, reverse-chronological activity feed of friends' entries, emoji reactions, and threaded comments.
- **Analytics:** Trend graphs, weekday heatmaps, mood score distributions, and tag correlation insights over custom timeframes (week, month, year, all time).
- **Notifications & Push:** In-app notification center for friend activity, plus browser Web Push notifications via VAPID.
- **System Announcements:** Admin panel for drafting, publishing, and expiring broadcast banners displayed across client sessions.
- **Security:** JWT authentication with `token_version` for instant session revocation, CSRF protection, token-bucket rate limiting, and password reset flows via transactional email (Resend).
- **Automated Backups:** Background cron job dumping PostgreSQL via `pg_dump` and uploading snapshots to Google Drive with automatic retention pruning.
- **PWA & Offline Support:** Installable app shell, Service Worker caching via Workbox, full English and Russian localization, and persistent dark/light theme support.

## Tech Stack

### Backend
- **Language:** Go 1.24+
- **Framework:** Gin
- **Database:** PostgreSQL (raw SQL queries with `pgx/v5` connection pooling, no ORM)
- **Object Storage:** S3-compatible storage (AWS S3, Cloudflare R2, MinIO) via AWS SDK for Go v2
- **Push & Email:** `webpush-go` (VAPID), Resend Go SDK
- **Backups:** Google Drive API v3
- **Monitoring:** Sentry Go SDK

### Frontend
- **Framework:** React 19, Vite 8
- **Routing:** React Router 7
- **Server State:** TanStack React Query v5
- **Styling:** Tailwind CSS 3
- **PWA:** `vite-plugin-pwa` (Workbox)
- **Linter:** Oxlint
- **Monitoring:** Sentry React SDK

## Project Structure

```text
moodila/
├── backend/
│   ├── cmd/
│   │   ├── api/            # Main HTTP server entrypoint
│   │   ├── backup/         # Manual backup CLI runner
│   │   ├── migrate/        # Standalone database migration runner
│   │   ├── token/          # Google Drive OAuth2 token generator
│   │   └── verify_keys/    # VAPID keys verification tool
│   ├── internal/
│   │   ├── backup/         # Automated backup scheduler and Google Drive uploader
│   │   ├── config/         # Environment variable configuration
│   │   ├── db/             # Database connection pool and SQL migrator
│   │   ├── handlers/       # HTTP route handlers
│   │   ├── mailer/         # Resend email client and HTML templates
│   │   ├── middleware/     # Auth, CSRF, admin check, rate limiting, CORS, logger
│   │   ├── models/         # Domain data structures
│   │   ├── repository/     # SQL query layer and memory cache
│   │   ├── services/       # Web push notification service
│   │   └── storage/        # S3 presigned URL generator and object manager
│   ├── migrations/         # Sequential SQL migrations
│   └── .env.example        # Backend environment template
├── frontend/
│   ├── public/             # PWA assets, manifest, service worker scripts
│   ├── src/
│   │   ├── api/            # API client, React Query hooks, and endpoint modules
│   │   ├── components/     # UI components (modals, navigation, layout)
│   │   ├── context/        # React contexts (auth, theme, notifications)
│   │   ├── hooks/          # Custom utility hooks
│   │   ├── pages/          # Application views (feed, calendar, stats, profile, admin)
│   │   └── translations/   # en / ru localization strings
│   └── vite.config.js      # Vite, PWA, and build configuration
└── AGENTS.MD               # Detailed architecture reference for developers and agents
```

## Getting Started

### Prerequisites

- Go 1.24 or higher
- Node.js 20+ and npm
- PostgreSQL 15+ (local instance or cloud database such as Supabase / AWS RDS)
- Optional: S3-compatible bucket (for photo uploads), Google Drive API credentials (for backups), Resend API key (for emails)

### 1. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Copy the example environment file and configure your credentials:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` with your database and environment settings:
   ```env
   PORT=8080
   DATABASE_URL=postgresql://user:password@localhost:5432/moodila?sslmode=disable
   JWT_SECRET=replace_with_a_secure_random_string
   CORS_ORIGIN=http://localhost:5173
   APP_ENV=development
   ```

4. Run the API server:
   ```bash
   go run ./cmd/api
   ```

   On startup, database migrations in `backend/migrations/` are applied automatically in sequential order.

### 2. Frontend Setup

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. (Optional) Create a `.env` file in `frontend/` if your backend runs on a non-default host or port:
   ```env
   VITE_API_URL=http://localhost:8080
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser at `http://localhost:5173`.

## CLI Utilities

The backend contains dedicated CLI utilities in `backend/cmd/`:

- **Run migrations manually:**
  ```bash
  go run ./cmd/migrate
  ```

- **Run manual database backup:**
  ```bash
  go run ./cmd/backup
  ```

- **Generate Google Drive OAuth2 refresh token:**
  ```bash
  go run ./cmd/token
  ```

- **Verify VAPID push keys:**
  ```bash
  go run ./cmd/verify_keys
  ```

## Production Build

### Frontend
```bash
cd frontend
npm run build
```
Production assets are generated in `frontend/dist/`. Serve them using Nginx, Caddy, Cloudflare Pages, or Vercel.

### Backend
```bash
cd backend
go build -ldflags="-s -w" -o bin/api ./cmd/api
./bin/api
```

Make sure to set `APP_ENV=production`, configure a strong `JWT_SECRET`, and define valid `CORS_ORIGIN` values in production.

## License & Usage

Hosting, deployment, and operation of this project are permitted strictly for personal and non-commercial purposes. Commercial hosting, offering this application as a paid service (SaaS), or any form of monetization is not permitted.

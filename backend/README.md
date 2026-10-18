# Moodila — Backend (Go)

High-performance REST API powering **Moodila**. Built with Go 1.25 and Gin, using pure SQL queries through `pgxpool` with PostgreSQL (no ORM).

---

## Architecture & Features

- **Language & Runtime:** Go 1.25.0, Gin web framework.
- **Database:** PostgreSQL (15+) via `jackc/pgx/v5` connection pool with `QueryExecModeSimpleProtocol`.
- **Authentication & Security:**
  - Double JWT (`access_token` and `refresh_token`) stored strictly in `HttpOnly` cookies.
  - In-token CSRF verification (`X-CSRF-Token` required on mutating requests).
  - Instant session revocation via `token_version` on password changes and logout.
  - Per-endpoint token-bucket rate limiting.
- **Media Processing & S3 Storage:**
  - Photo uploads are routed through the API (`PUT /storage/entry-photos/upload/:token`).
  - The server decodes, validates, downscales to 1920px, and recompresses images to JPEG (quality 80) before streaming to S3-compatible storage (AWS S3, Cloudflare R2, MinIO).
  - CPU and memory usage are guarded by a concurrency semaphore to prevent out-of-memory errors on resource-constrained servers (1 vCPU / 1 GB RAM).
  - Voice memos are uploaded via signed upload tokens directly to object storage.
- **Notifications:**
  - In-app notification center for friend requests, post reactions, comments, and new posts (`new_post`).
  - Web Push notifications (VAPID RFC 8292) dispatched via an asynchronous background worker pool.
- **Automated Backups:**
  - Background scheduler dumps PostgreSQL via `pg_dump` and uploads encrypted snapshots to Google Drive with automated retention cleanup.

---

## Project Structure

```text
backend/
├── cmd/
│   ├── api/             # Main HTTP server entrypoint
│   ├── backup/          # Manual database backup CLI runner
│   ├── migrate/         # Standalone database migration runner
│   ├── token/           # Google Drive OAuth2 token generator
│   ├── verify_feed/     # Feed latency and consistency verifier
│   └── verify_keys/     # VAPID push keys validation tool
├── internal/
│   ├── backup/          # Automated backup scheduler and Google Drive client
│   ├── config/          # Environment variable parser and defaults
│   ├── db/              # pgxpool setup and SQL migration engine
│   ├── handlers/        # Gin HTTP route handlers
│   ├── mailer/          # Transactional email service (Resend)
│   ├── middleware/      # Auth, CSRF, admin check, rate limiting, CORS, logger
│   ├── models/          # Domain models and request/response DTOs
│   ├── repository/      # Pure SQL repositories and in-memory caches
│   ├── services/push/   # Web Push notification dispatcher and worker pool
│   └── storage/         # S3 client and image processing
└── migrations/          # Sequential, transactional SQL migrations (0001–0021)
```

---

## Local Development Setup

### 1. Prerequisites

- Go 1.25 or higher
- PostgreSQL 15+ (local, Docker, or managed instance)

### 2. Configure Environment

Copy the example environment configuration:

```bash
cp .env.example .env
```

Set your PostgreSQL connection string in `.env`:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/moodila
```

> **Note:** For local development over plain HTTP (`http://localhost:...`), ensure `COOKIE_SECURE=false`.

### 3. Run the Server

```bash
go run ./cmd/api
```

On startup, pending database migrations from `backend/migrations/` are automatically applied in sequential order.

### 4. Running Tests

- Run unit tests:
  ```bash
  go test ./...
  ```
- Run integration tests (requires running PostgreSQL specified by `DATABASE_URL`):
  ```bash
  go test -v ./internal/handlers -run TestHiddenEntriesE2E
  ```

---

## Key API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server and database health check |
| `GET` | `/app/features` | Seasonal themes and dynamic feature flags |
| `POST`| `/auth/register` | Register a new user account |
| `POST`| `/auth/login` | Authenticate user and issue HttpOnly cookies |
| `POST`| `/auth/refresh` | Rotate access token using refresh cookie |
| `POST`| `/auth/logout` | Revoke session and clear cookies |
| `GET` | `/auth/session` | Inspect current session and user info |
| `GET` | `/feed` | Friends' social feed with keyset pagination |
| `POST`| `/entries` | Create or update daily mood journal entry |
| `GET` | `/entries/me` | Fetch personal calendar entries for a month |
| `GET` | `/stats` | Aggregate mood statistics and analytics |
| `GET` | `/notifications` | User notifications list and unread count |
| `PUT` | `/storage/entry-photos/upload/:token` | Resizing and uploading entry photo |

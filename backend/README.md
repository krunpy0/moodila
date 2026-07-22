# MoodShare — Backend (Go)

REST API for MoodShare. Go standard-library HTTP server + Postgres (Supabase) via `pgx`.

## Structure

```
cmd/api/main.go        entrypoint: config, DB connect, migrations, HTTP server
internal/
  config/              env / .env loading
  db/                  pgx pool + SQL migrator
  handlers/            HTTP handlers, grouped by feature (health, ...)
  middleware/          CORS, request logging
  models/              structs mirroring the DB schema
migrations/            *.sql migrations, applied in lexical order at startup
```

## Setup

1. Copy env and add your Supabase connection string:

   ```
   cp .env.example .env
   # edit .env → DATABASE_URL=postgresql://postgres.<ref>:<pwd>@...pooler.supabase.com:5432/postgres
   ```

2. Run (uses the local Go toolchain; deps pinned for Go 1.24):

   ```
   GOTOOLCHAIN=local go run ./cmd/api
   ```

On startup the server connects to Postgres and applies any pending migrations.
If `DATABASE_URL` is unset or unreachable, the server still starts and `/health`
reports the DB status.

## Endpoints

- `GET /health` → `{"status":"ok","db":"connected|unavailable|not_configured","time":"..."}`

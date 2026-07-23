# MoodShare — Backend (Go)

REST API for MoodShare. Gin + Postgres (Supabase) via `pgx`.

## Photo storage (S3-compatible)

Photos are uploaded directly from the browser using a short-lived, presigned
S3 PUT URL. The API response remains `{"upload_url":"…","photo_url":"…"}`
for compatibility with the frontend.

Set `S3_BUCKET`, `ACCESS_KEY_ID`, and `SECRET_ACCESS_KEY`. Both keys are
required: the access key identifies the credential and the secret key signs the
upload URL. Set `S3_ENDPOINT` for any S3-compatible provider (R2, MinIO, B2,
etc.); leave it empty for AWS S3. `S3_PUBLIC_BASE_URL` should be the public
bucket or CDN origin used to display saved photos.

Configure bucket CORS to allow browser `PUT` requests from `CORS_ORIGIN` with
the `Content-Type` request header. The URLs stored in entries must be publicly
readable, typically through a public bucket or a CDN.

## Structure

```
cmd/api/main.go        entrypoint: config, DB connect, migrations, HTTP server
internal/
  config/              env / .env loading
  db/                  pgx pool + SQL migrator
  handlers/            HTTP handlers, grouped by feature (health, ...)
  middleware/          JWT auth, CORS, request logging
  repository/          SQL queries by entity
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
- `POST /auth/register` → create account and return JWT
- `POST /auth/login` → return JWT
- `GET /auth/session` → validate `Authorization: Bearer <token>`

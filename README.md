# Moodila

A cozy, private mood tracker and micro-journal for you and your close circle.

---

## What is Moodila?

**Moodila** is an intimate, self-hosted web app designed to help you check in with yourself, build emotional awareness, and stay connected with the people who matter most.

Unlike typical social media, Moodila has no algorithmic feeds, no follower counts, and no pressure to perform. It is a calm, personal space where you can record your days, observe how your mood shifts over time, and selectively share moments with close friends under your own privacy rules.

---

## ✨ Features

### For Everyday Journaling
- **Fast Mood Logging:** Check in with a single tap on a 5-point scale (from *Awful* to *Rad*).
- **Rich Entries:** Add written reflections, categorized tags (Positive, Neutral, Difficult), photos, or voice notes.
- **Visual Calendar:** Monthly overview showing dominant moods, top tags of the month, and smooth day-by-day browsing.
- **Meaningful Insights:** Clear charts, weekday heatmaps, and tag correlation trends to help you understand your emotional patterns over time.

### For Staying Connected
- **Calm, Chronological Feed:** See what your friends have been up to in a quiet, chronological feed without algorithms or ads.
- **Friendly Interactions:** React with emojis and leave comments on friends' shared days.
- **Gentle Notifications:** In-app notification center and optional Web Push alerts when friends interact with your entries.

### Thoughtful Privacy & Control
- **Private by Default:** You decide who sees every entry.
- **Two-Tier Privacy:** Set default visibility per friend, or override visibility on specific days.
- **New Friend Protection:** Historical entries with custom privacy rules stay hidden when accepting new friend requests.
- **Data Ownership:** Your entries, photos, and voice notes stay on your own server and database.

### Design & Experience
- **14 Expressive Themes:** 7 color palettes (Classic, Forest, Ocean, Lavender, Terracotta, Aurora, and Sakura) in both Light and Dark modes, plus seasonal dynamic themes.
- **Installable PWA:** Works on iOS, Android, and Desktop as an installable app with offline caching and safe-area support.
- **Bilingual:** Full English and Russian localization.

---

## 🛠️ Architecture & Tech Stack

Moodila is built to be fast, reliable, and lightweight, running smoothly even on a minimal VPS (1 vCPU / 1 GB RAM):

| Layer | Technologies | Highlights |
|---|---|---|
| **Backend** | Go 1.25, Gin, `pgxpool` | Pure SQL (no ORM overhead), token-bucket rate limiting, secure cookie sessions with CSRF |
| **Frontend** | React 19, Vite 8, Tailwind CSS | TanStack React Query v5 caching, Oxlint, mobile-first responsive layout |
| **Database** | PostgreSQL 15+ | Optimized LATERAL joins and keyset pagination for fast feed queries |
| **Storage** | S3-compatible (AWS S3, R2, MinIO) | Server-side image resizing (1920px JPEG) with concurrency throttling |
| **Integrations** | VAPID Web Push, Resend Email | Push worker pool, transactional emails for password resets |
| **Backups** | Google Drive API v3 | Automated scheduled database dumps with retention pruning |

---

## 🚀 Getting Started

### Prerequisites

- [Go 1.25+](https://go.dev/)
- [Node.js 20+](https://nodejs.org/) and `npm`
- [PostgreSQL 15+](https://www.postgresql.org/) (local installation or Docker)

---

### Step 1: Start PostgreSQL (Docker)

If you don't have a local PostgreSQL instance running, use the included Docker Compose configuration:

```bash
docker compose up -d postgres
```

This starts a local PostgreSQL instance on `localhost:5432` with user `postgres`, password `postgres`, and database `moodila`.

---

### Step 2: Set Up & Run the Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Copy the sample environment file:
   ```bash
   cp .env.example .env
   ```

3. Ensure `DATABASE_URL` in `backend/.env` points to your PostgreSQL instance:
   ```env
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/moodila
   ```
   *(For local plain HTTP development, `COOKIE_SECURE=false` is already recommended).*

4. Run the API:
   ```bash
   go run ./cmd/api
   ```
   Database migrations (`backend/migrations/`) are applied automatically on startup.

---

### Step 3: Set Up & Run the Frontend

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. (Optional) Copy `.env.example` if your backend runs on a different port:
   ```bash
   cp .env.example .env
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## ⚙️ Configuration Overview

All configuration is managed via environment variables. Refer to the respective example files for complete documentation and defaults:

- **[`backend/.env.example`](backend/.env.example):** Database connection, JWT secrets, CORS origins, S3 media storage credentials, Web Push (VAPID) keys, transactional email (Resend), and automated Google Drive backups.
- **[`frontend/.env.example`](frontend/.env.example):** Backend API URL and optional client-side monitoring.

---

## 📚 Documentation & Developer Guides

- **[AGENTS.md](AGENTS.md):** Architectural guide and workflows for developers and AI agents.
- **[docs/current-state.md](docs/current-state.md):** Detailed technical status of all subsystems, versions, and testing.
- **[docs/architecture.md](docs/architecture.md):** High-level system architecture and data flows.
- **[docs/database.md](docs/database.md):** Database schema, indexing strategies, and migration rules.
- **[docs/decisions/](docs/decisions/):** Architectural Decision Records (ADRs).
- **[docs/features/](docs/features/):** Detailed breakdowns of Feed, Friends & Privacy, and Announcements.

---

## 📄 License & Usage

Hosting, deployment, and operation of this project are permitted strictly for personal and non-commercial purposes. Commercial hosting, offering this application as a paid service (SaaS), or any form of monetization is not permitted.

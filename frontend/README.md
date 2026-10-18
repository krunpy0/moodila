# Moodila — Frontend (React 19 & PWA)

Modern, mobile-first Progressive Web App (PWA) client for **Moodila**. Built with React 19, Vite 8, Tailwind CSS, and TanStack React Query.

---

## Highlights

- **Mobile-First Experience:** Tailored for smartphones with safe-area inset handling (`pt-safe-top`, `pb-safe-bottom` for iOS notch, Dynamic Island, and home indicator).
- **Progressive Web App (PWA):** Installable on iOS, Android, and Desktop via `vite-plugin-pwa` with offline caching through Workbox and Service Worker push handling.
- **Fast 1-Click Logging:** Quick mood selection directly from the home screen.
- **Adaptive Aesthetics:** 14 color themes across 7 families (Classic, Forest, Ocean, Lavender, Terracotta, Aurora, Cherry blossom / Sakura) in Light and Dark modes, plus seasonal dynamic themes (e.g. Halloween).
- **Internationalization:** Full English (`en`) and Russian (`ru`) localization.
- **Tactile Feedback:** Haptic feedback using Web Vibration API on mobile devices with smart detection (automatically hidden on desktop).
- **Fast Linting:** Powered by Oxlint for near-instant linting in development and CI.

---

## Tech Stack

| Technology | Role |
|---|---|
| **React 19** (`19.2.7`) | UI library and components |
| **Vite 8** (`8.1.5`) | Bundler and rapid development server |
| **React Router DOM 7** (`7.18.1`) | Client-side routing with lazy-loaded views |
| **TanStack React Query v5** (`5.101.4`) | Server state caching, background refetching, and pagination |
| **Tailwind CSS 3** (`3.4.19`) | Utility-first styling with dynamic CSS variables for theming |
| **vite-plugin-pwa** (`1.3.0`) | Service worker generation and manifest management |
| **Oxlint** (`1.71.0`) | High-speed JavaScript/JSX static analysis |

---

## Project Structure

```text
frontend/
├── public/              # Static assets, web app manifest, icons, sound effects
├── src/
│   ├── api/             # API client, HTTP interceptors, CSRF handling, React Query hooks
│   ├── components/      # Reusable UI components (navigation, modals, widgets, theme picker)
│   ├── context/         # React Contexts (Auth, Theme, Language, Notifications)
│   ├── hooks/           # Custom utility hooks (haptics, media queries, keyboard shortcuts)
│   ├── pages/           # Route views (Home, Feed, Calendar, Stats, Profile, Admin)
│   ├── translations/    # Localization dictionaries (en.js, ru.js)
│   ├── utils/           # Helper functions (dates, seasonal logic, crop)
│   ├── App.jsx          # Root application layout and route declarations
│   └── main.jsx         # Vite entrypoint with Providers setup
└── vite.config.js       # Vite configuration, PWA plugin settings, build optimizations
```

---

## Getting Started

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment

Copy the example configuration:

```bash
cp .env.example .env
```

Ensure `VITE_API_URL` points to your backend:

```env
VITE_API_URL=http://localhost:8080
```

### 3. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## Available Scripts

- `npm run dev` — Launch Vite development server with Hot Module Replacement.
- `npm run build` — Build production-ready bundle into `dist/`.
- `npm run lint` — Run Oxlint static analysis on `src/`.
- `npm run preview` — Locally preview the production build in `dist/`.

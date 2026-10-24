# GreenGuard Dashboard

Project-wide context: [GreenGuard master context](../GREENGUARD_MASTER_CONTEXT.md).

Operator dashboard: Expo 57 / React Native Web / TypeScript frontend and an
Express / TypeScript / Mongoose backend. `frontend/App.tsx` selects Dashboard,
Analytics, Smart Bins and Reports using local navigation state.

## Start locally

Use pnpm in both Dashboard folders. With dependencies installed, run
`pnpm dev` in `backend` and `pnpm web`
in `frontend`. Copy each `.env.example` to `.env` only when `.env` does not
already exist. Set the backend's MONGODB_URI to the authorized database.

Backend PORT falls back to 3001 when omitted; `.env.example` sets 3003 to match
the frontend's default API URL. Expo prints its frontend URL on startup.
Public frontend environment variables are bundled at build time; restart or
re-export after changing them.

For the one-laptop workflow, configure MongoDB and install dependencies once:

```powershell
# D:\Coding\Prj\BKI\GreenGuard26\Dashboard\backend
Copy-Item .env.example .env
# Edit .env and set MONGODB_URI, then:
pnpm install

# D:\Coding\Prj\BKI\GreenGuard26\Dashboard\frontend
pnpm install

# D:\Coding\Prj\BKI\GreenGuard26\Dashboard
.\run-dashboard.bat

# D:\Coding\Prj\BKI\GreenGuard26\Trash-detection
.\demo-day.bat terminal
```

`run-dashboard.bat` repairs broken frontend dependencies when requested with
`run-dashboard.bat repair`, starts or reuses the backend and live-mode frontend
in visible monitoring windows, and opens the web Dashboard. It defaults to API
port 3003 and web port 8081. Service logs are copied to
`%TEMP%\greenguard-dashboard-local`.

## Presentation and live data

- EXPO_PUBLIC_DEMO_MODE=true (also the default when unset) keeps presentation
  data populated without a backend. Dashboard and Analytics do not poll in
  this mode. Presentation data is labelled.
- EXPO_PUBLIC_DEMO_MODE=false uses EXPO_PUBLIC_API_URL (default
  http://localhost:3003). Dashboard polls every second and Analytics every
  4 seconds. Requests have a 15-second timeout and support cancellation.
- Failed live refreshes retain the last complete snapshot and show a stale-data
  message with its last successful update time. Initial failure displays
  unavailable data. Partial failure never combines live and sample responses.
- Smart Bins and Reports remain presentation pages, labelled even in live mode.
  Their displayed actions do not establish fleet-management/report-export support.

`frontend/src/services/dashboardQueries.ts` owns polling/cache behavior;
`api.ts` owns HTTP requests and `demoData.ts` holds examples.

## Local demo ingestion

The Dashboard backend owns the laptop-demo write path. `demo-day.bat` checks the
live services, calls the parallel `full_demo.bat` workflow, and posts each
completed result once to `POST /api/dashboard/detections`; result-hold frames are
deduplicated and GreenPoint is not required. The
backend persists detection logs and collecting/completed recycling sessions in
MongoDB. Machine `0001` is created automatically when absent.

Each item resets a 10-second inactivity timer. On timeout, the backend finalizes
the session, calculates points, and stores a QR payload. A collecting session is
rescheduled on backend startup, so a restart does not permanently strand it.

Routes mounted in `backend/src/app.ts`:

- /api/dashboard: local detection ingestion, overview, live feed, quality,
  impact, machine/user lifetime, and event stream.
- /api/machines, /api/sessions, /api/stats: fleet/session/statistic reads.
- /health: process health, not full telemetry-ingestion readiness.

## Metric definitions

- Impact includes claimed sessions, grouped by creation time in UTC, representing
  recycling time rather than reward-claim time. Responses declare timeZone and
  periodBasis. Undated records contribute to lifetime impact and undatedItems,
  never an invented month.
- Legacy plastic_bottle maps to pet_clean; can maps to aluminum. Existing
  conversion factors remain unchanged and are estimates.
- unclaimedSessions counts unclaimed rewards. Legacy pendingSync is null:
  the database cannot establish a device's unsynchronized queue.
- Missing confidence/FPS/latency/purity samples return null, rendered as
  unavailable. Machine uptimePct is null until uptime history is available.
- Overview's today boundary and trend labels use UTC. Longer ranges include
  dates so identical clock times on different days are not merged.

Consumers must handle nullable measurements. In-repository consumers have been
updated; review external consumers before deploying this backend change.

## Verification

Run in both frontend and backend:

```powershell
pnpm typecheck
pnpm test
```

Frontend web build:

```powershell
pnpm exec expo export --platform web --output-dir .expo/verify-web
```

Backend production build: `pnpm build`, then `pnpm start` with environment
configured. Tests use Node's test runner and the installed TypeScript compiler,
with fixtures and no live database requests. Type checking excludes generated
dist and .expo output. Check desktop/narrow layouts, presentation navigation,
live initial failure, stale data and recovery before releasing. Web export
alone does not establish visual or device correctness.

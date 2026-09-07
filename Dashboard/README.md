# GreenGuard Dashboard

Operator dashboard: Expo 57 / React Native Web / TypeScript frontend and an
Express / TypeScript / Mongoose backend. `frontend/App.tsx` selects Dashboard,
Analytics, Smart Bins and Reports using local navigation state.

## Start locally

Use the package manager matching the checked-in lockfile for each folder.
With dependencies installed, run `npm run dev` in `backend` and `npm run web`
in `frontend`. Copy each `.env.example` to `.env` only when `.env` does not
already exist. Set the backend's MONGODB_URI to the authorized database.

Backend PORT falls back to 3001 when omitted; `.env.example` sets 3003 to match
the frontend's default API URL. Expo prints its frontend URL on startup.
Public frontend environment variables are bundled at build time; restart or
re-export after changing them.

## Presentation and live data

- EXPO_PUBLIC_DEMO_MODE=true (also the default when unset) keeps presentation
  data populated without a backend. Dashboard and Analytics do not poll in
  this mode. Presentation data is labelled.
- EXPO_PUBLIC_DEMO_MODE=false uses EXPO_PUBLIC_API_URL (default
  http://localhost:3003). Dashboard polls every 3.5 seconds and Analytics every
  4 seconds. Requests have a 15-second timeout and support cancellation.
- Failed live refreshes retain the last complete snapshot and show a stale-data
  message with its last successful update time. Initial failure displays
  unavailable data. Partial failure never combines live and sample responses.
- Smart Bins and Reports remain presentation pages, labelled even in live mode.
  Their displayed actions do not establish fleet-management/report-export support.

`frontend/src/services/dashboardQueries.ts` owns polling/cache behavior;
`api.ts` owns HTTP requests and `demoData.ts` holds examples.

## Backend ownership

This is a read-oriented backend. Models are schema mirrors: GreenPoint-Backend
owns their contracts and database writes. Do not add local telemetry ingestion
or change mirrored schema structure here.

Routes mounted in `backend/src/app.ts`:

- /api/dashboard: overview, live feed, quality, impact, machine/user lifetime,
  and event stream.
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
npm run typecheck
npm test
```

Frontend web build:

```powershell
npx expo export --platform web --output-dir .expo/verify-web
```

Backend production build: `npm run build`, then `npm start` with environment
configured. Tests use Node's test runner and the installed TypeScript compiler,
with fixtures and no live database requests. Type checking excludes generated
dist and .expo output. Check desktop/narrow layouts, presentation navigation,
live initial failure, stale data and recovery before releasing. Web export
alone does not establish visual or device correctness.

# GreenGuard Dashboard — Comprehensive Documentation

> **Last updated:** 2026-07-16
> **Codebase path:** `Dashboard/`
> **Platform:** Expo (React Native Web) · Express 4 · MongoDB Atlas (shared with app)

---

## 1. Product Overview

The **GreenGuard Dashboard** is a web-based monitoring and analytics platform for the GreenGuard smart recycling ecosystem. It is the administrative view into the system, allowing teams to monitor machine health, view recycling statistics, and manage contribution data in real time.

> **Important:** The Dashboard backend shares the **same MongoDB Atlas database** as the GreenPoint App backend. Metrics like total waste are calculated from the same `ContributionSession` data that the user app writes to.

| Layer | Stack | Port |
|---|---|---|
| Backend | Express 4 · TypeScript · MongoDB (Mongoose 8) | 3003 |
| Frontend | React Native (Expo Web) · TypeScript · expo-router | Website |

---

## 2. System Architecture

```
Dashboard/
├── backend/                       # Express + TypeScript API server (port 3003)
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── server.ts              # Entry: load .env → connectDB() → app.listen()
│       ├── app.ts                 # Express app: middleware, routes, health check
│       ├── config/
│       │   └── db.ts              # Mongoose connection to shared MongoDB Atlas
│       ├── types/
│       │   └── index.ts           # Shared TypeScript types and DTOs
│       ├── models/
│       │   ├── ContributionSession.ts  # Session model (same collection as app)
│       │   ├── Machine.ts              # Machine model (same collection as app)
│       │   └── User.ts                 # User model (read-only reference)
│       ├── controllers/
│       │   ├── machine.controller.ts   # Machine heartbeat & status
│       │   ├── session.controller.ts   # Contribution session queries & stats
│       │   └── stats.controller.ts     # Aggregated dashboard statistics
│       └── routes/
│           ├── machine.routes.ts       # Machine endpoints
│           ├── session.routes.ts       # Session endpoints
│           └── stats.routes.ts         # Stats endpoints
└── frontend/                      # Expo Web app (compiled to website)
    ├── app.json                   # Expo config
    ├── App.tsx                    # Root component
    ├── babel.config.js
    ├── index.ts                   # Expo entry point
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── components/
        │   ├── DashboardSidebar.tsx   # Navigation sidebar
        │   ├── DashboardTopNav.tsx    # Top navigation bar
        │   ├── KPICard.tsx            # Key metric display card
        │   ├── SectionCard.tsx        # Section wrapper card
        │   └── StatusBadge.tsx        # Machine online/offline badge
        ├── constants/
        │   └── mockData.ts            # Demo data for offline/dev mode
        ├── screens/
        │   ├── DashboardScreen.tsx    # Main overview with KPI cards
        │   ├── AnalyticsScreen.tsx    # Charts and trends
        │   ├── SmartBinsScreen.tsx    # Machine list and status
        │   └── ReportsScreen.tsx      # Contribution session reports
        ├── theme/
        │   ├── colors.ts              # Color palette
        │   ├── typography.ts          # Typography styles
        │   └── index.ts               # Theme exports
        └── types/
            └── dashboard.types.ts     # Dashboard TypeScript types
```

---

## 3. Database Schemas (Mongoose)

The Dashboard backend connects to the **same MongoDB Atlas database** as the GreenPoint App. It accesses the collections read-only for display purposes, and write-access only for machine heartbeat updates.

### 3.1 ContributionSession (shared with app)

```
Collection: contributionsessions
Fields (Dashboard reads, App writes):
  sessionCode     String    unique identifier
  machineId       ObjectId  ref: Machine
  items           [{
    itemType      String    "plastic_bottle" | "can"
    quantity      Number
    pointsPerItem Number
  }]
  totalPoints     Number
  claimTokenHash  String
  status          String    "unclaimed" | "claimed" | "expired" | "cancelled"
  claimedBy       ObjectId  ref: User (populated to get user info)
  claimedAt       Date
  expiresAt       Date
  timestamps      { createdAt, updatedAt }
```

> **Dashboard metrics note:** Total waste items displayed on the dashboard are computed as:
> - `totalBottles` = SUM of `quantity` where `itemType = "plastic_bottle"` across all sessions
> - `totalCans` = SUM of `quantity` where `itemType = "can"` across all sessions

### 3.2 Machine (shared with app)

```
Collection: machines
Fields (Dashboard reads + heartbeat writes):
  machineCode    String   unique
  name           String
  locationName   String
  locationType   String   "canteen" | "parking" | "library" | "classroom_area" | "other"
  status         String   "online" | "offline" | "maintenance" | "disabled"
  lastSeenAt     Date     updated on each heartbeat pulse
  totalSessions  Number
  timestamps     { createdAt, updatedAt }
```

> **Online/Offline detection:** A machine is considered **offline** if `lastSeenAt` is older than 30 seconds from current time.

### 3.3 User (shared with app — read-only reference)

```
Collection: users
Fields (Dashboard reads only — for enriching session data):
  displayName          String
  faculty              String
  phoneNumber          String
  totalPoints          Number
  lifetimeEarnedPoints Number
  totalBottles         Number
  totalCans            Number
  totalItems           Number
```

---

## 4. Machine Heartbeat System

The smart bins periodically send a pulse via Wi-Fi to the Dashboard backend to indicate they are alive and operational.

### Heartbeat Flow

```
[Jetson Nano — Periodic timer (e.g. every 10–15 seconds)]
    1. POST /api/machines/heartbeat
       Body: { machineCode, state, lastSessionId }
    2. Dashboard backend: Machine.findOneAndUpdate
       → status = "online"
       → lastSeenAt = now

[Dashboard Frontend — Polling every 5s]
    1. GET /api/machines
    2. For each machine: if (now - lastSeenAt > 30s) → show as OFFLINE
```

### Machine States

| State | Description |
|---|---|
| `online` | Heartbeat received within the last 30 seconds |
| `offline` | No heartbeat for > 30 seconds |
| `maintenance` | Admin-set state for scheduled downtime |
| `disabled` | Admin-set state, machine taken out of service |

---

## 5. Authentication & Authorization

| Variable | Details |
|---|---|
| **JWT Access Secret** | Shared with app backend via env var |
| **JWT Refresh Secret** | Shared with app backend via env var |
| **Access token TTL** | 15 minutes |
| **Refresh token TTL** | 7 days |

> **Note:** The Dashboard backend requires valid JWT tokens (Bearer auth) for all non-public endpoints, using the same secrets as the `app/backend`. Dashboard users log in through the same auth system as the GreenPoint App (admin role required for full access).

---

## 6. API Reference

**Base URL:** `http://localhost:3003`

### 6.1 Health Check

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/health` | None | Server health check |

**Response `200`:**
```json
{ "status": "ok", "ts": "2026-07-16T00:00:00.000Z" }
```

---

### 6.2 Machines (`/api/machines`)

#### `POST /api/machines/heartbeat`
Receive a heartbeat pulse from the Jetson Nano edge device. Updates machine status to online and refreshes `lastSeenAt`.

| Auth | Source |
|---|---|
| `x-machine-api-key` header | Jetson Nano smart bin |

**Request Body:**
```json
{
  "machineCode": "BK_BIN_01",
  "state": "IDLE | SORTING | ERROR",
  "lastSessionId": "session-id-string (optional)"
}
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Heartbeat recorded"
}
```

---

#### `GET /api/machines`
List all machines with their current status.

| Auth | Roles |
|---|---|
| Bearer | admin |

**Response `200`:**
```json
[
  {
    "machineCode": "BK_BIN_01",
    "name": "GreenGuard Bin #1",
    "locationName": "Canteen A — DHBK",
    "locationType": "canteen",
    "status": "online",
    "lastSeenAt": "2026-07-16T10:00:00.000Z",
    "totalSessions": 142,
    "isOnline": true
  }
]
```

---

#### `GET /api/machines/:machineId`
Get a specific machine with status and recent session count.

| Auth | Roles |
|---|---|
| Bearer | admin |

---

### 6.3 Sessions (`/api/sessions`)

#### `GET /api/sessions`
Get paginated list of contribution sessions with filters.

| Auth | Roles |
|---|---|
| Bearer | admin |

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| machineId | string | — | Filter by machine |
| status | string | — | Filter by session status |
| startDate | string | — | ISO date, filter `createdAt >= startDate` |
| endDate | string | — | ISO date, filter `createdAt <= endDate` |
| limit | number | 50 | Max results per page |
| offset | number | 0 | Skip count for pagination |

**Response `200`:**
```json
{
  "data": [
    {
      "sessionCode": "GP-SESSION-XXXX",
      "machineId": { "machineCode": "BK_BIN_01", "locationName": "Canteen A" },
      "items": [
        { "itemType": "plastic_bottle", "quantity": 2, "pointsPerItem": 10 },
        { "itemType": "can", "quantity": 1, "pointsPerItem": 8 }
      ],
      "totalPoints": 28,
      "status": "claimed",
      "claimedBy": { "displayName": "Nguyen Van A", "faculty": "CNTT" },
      "claimedAt": "2026-07-16T10:05:00.000Z",
      "createdAt": "2026-07-16T10:00:00.000Z"
    }
  ],
  "total": 500,
  "limit": 50,
  "offset": 0
}
```

---

#### `GET /api/sessions/latest`
Get the most recent contribution session across all machines. Used for live activity feed (polled every 5s).

| Auth | Roles |
|---|---|
| Bearer | admin |

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| machineId | string | Filter by specific machine (optional) |

**Response `200`:** Single populated session object or `null`

---

#### `GET /api/sessions/:sessionId`
Get a specific session with full population.

| Auth | Roles |
|---|---|
| Bearer | admin |

---

### 6.4 Stats (`/api/stats`)

#### `GET /api/stats/summary`
Get aggregated dashboard summary statistics. Computed from `ContributionSession` collection.

| Auth | Roles |
|---|---|
| Bearer | admin |

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| machineId | string | Filter by machine (optional, defaults to ALL) |
| startDate | string | ISO date range start (optional) |
| endDate | string | ISO date range end (optional) |

**Response `200`:**
```json
{
  "totalSessions": 500,
  "claimedSessions": 420,
  "unclaimedSessions": 30,
  "expiredSessions": 50,
  "totalItems": 1200,
  "totalBottles": 850,
  "totalCans": 350,
  "totalPointsDistributed": 11500,
  "avgItemsPerSession": 2.4,
  "claimRate": 0.84,
  "byMachine": [
    {
      "machineCode": "BK_BIN_01",
      "locationName": "Canteen A",
      "sessions": 142,
      "bottles": 200,
      "cans": 85
    }
  ]
}
```

---

#### `GET /api/stats/timeline`
Get session counts over time for charting purposes.

| Auth | Roles |
|---|---|
| Bearer | admin |

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| machineId | string | — | Filter by machine |
| period | string | week | `day`, `week`, `month`, `year` |
| granularity | string | day | `hour`, `day`, `week` |

**Response `200`:**
```json
{
  "labels": ["2026-07-10", "2026-07-11", "2026-07-12"],
  "sessions": [45, 62, 38],
  "bottles": [120, 180, 90],
  "cans": [40, 55, 35]
}
```

---

#### `GET /api/stats/top-users`
Get top recyclers for leaderboard display.

| Auth | Roles |
|---|---|
| Bearer | admin |

**Response `200`:**
```json
[
  {
    "displayName": "Nguyen Van A",
    "faculty": "CNTT",
    "totalItems": 85,
    "totalBottles": 60,
    "totalCans": 25,
    "lifetimeEarnedPoints": 820
  }
]
```

---

## 7. Key Workflows

### 7.1 Machine Heartbeat Monitoring Workflow

```
[Jetson Nano — repeating timer]
  POST /api/machines/heartbeat
    → Machine.findOneAndUpdate({ machineCode })
    → Set status = "online", lastSeenAt = now

[Dashboard frontend — polling every 5s]
  GET /api/machines
    → For each machine:
        if (Date.now() - lastSeenAt > 30_000) → mark as OFFLINE
    → Display colored status badge per machine (green = online, red = offline)
```

### 7.2 Live Session Feed Workflow

```
[Dashboard frontend — polling every 5s]
  GET /api/sessions/latest
    → Show most recent contribution session in "Live Activity" panel
    → Update KPI cards if new session since last poll

[Dashboard frontend — polling every 10s]
  GET /api/stats/summary
    → Update total waste counters (bottles + cans)
    → Update claim rate, total sessions, total points distributed
```

### 7.3 Contribution Session Data Flow

```
[Jetson Nano]
  1. Sorts items, generates JWT claim token locally
  2. Displays QR on LCD
  3. Background POST to app/backend /api/contributions (x-machine-api-key)
     → ContributionSession created in shared MongoDB Atlas

[GreenPoint App user]
  4. Scans QR → claims session → points credited
  5. ContributionSession.status → "claimed", claimedBy → userId

[Dashboard frontend]
  6. Reads same ContributionSessions from shared DB
  7. Displays session stats:
       totalBottles = SUM(items where itemType = "plastic_bottle")
       totalCans    = SUM(items where itemType = "can")
       claimedSessions = COUNT(status = "claimed")
```

---

## 8. Frontend Screens

| Screen | Description |
|---|---|
| **Dashboard** (`DashboardScreen`) | Main KPI overview: total sessions, total waste (bottles + cans), claim rate, active machines, live activity feed |
| **Analytics** (`AnalyticsScreen`) | Time-series charts of recycling trends, waste type breakdown, machine comparison |
| **Smart Bins** (`SmartBinsScreen`) | List of all machines, their location, real-time online/offline status, total sessions per machine |
| **Reports** (`ReportsScreen`) | Filterable, paginated table of contribution sessions with machine, user, items, and status details |

### Dashboard KPI Cards
- **Total Sessions** — Total number of contribution sessions created
- **Total Bottles** — Sum of all `plastic_bottle` quantities across sessions
- **Total Cans** — Sum of all `can` quantities across sessions
- **Claim Rate** — Percentage of sessions successfully claimed by a user
- **Active Machines** — Count of machines with heartbeat < 30s ago
- **Total Points Distributed** — Sum of all `totalPoints` from claimed sessions

---

## 9. Real-time Polling Strategy

The Dashboard uses **short-polling** via periodic API calls to keep data current without WebSockets.

| Data | Interval | Endpoint |
|---|---|---|
| Machine statuses | 5s | `GET /api/machines` |
| Latest session | 5s | `GET /api/sessions/latest` |
| Summary stats | 10s | `GET /api/stats/summary` |
| Session list | 30s (or manual) | `GET /api/sessions` |
| Timeline charts | 60s (or manual) | `GET /api/stats/timeline` |

**Offline threshold:** Machine considered offline if `lastSeenAt > 30 seconds` ago.

---

## 10. Environment Variables (Backend)

| Variable | Type | Default | Description |
|---|---|---|---|
| `NODE_ENV` | string | development | Runtime environment |
| `PORT` | number | 3003 | HTTP server port |
| `MONGODB_URI` | string | *required* | MongoDB connection string (SAME as app backend) |
| `JWT_ACCESS_SECRET` | string | *required* | JWT secret (SAME as app backend) |
| `JWT_REFRESH_SECRET` | string | *required* | JWT refresh secret (SAME as app backend) |
| `JWT_ACCESS_EXPIRES_IN` | string | 15m | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | string | 7d | Refresh token TTL |
| `FRONTEND_ORIGIN` | string | http://localhost:5173 | CORS allowed origin |

> **Critical:** `MONGODB_URI` must point to the same cluster as `app/backend` — this is the key requirement for the unified data architecture.

---

## 11. Technology Dependencies

### Backend
| Package | Version | Purpose |
|---|---|---|
| express | 4.x | HTTP framework |
| mongoose | 8.x | MongoDB ODM |
| cors | 2.x | Cross-origin resource sharing |
| dotenv | 16.x | Environment variable loading |
| jsonwebtoken | 9.x | JWT verification for admin auth |
| tsx | 4.x | Dev-time TypeScript runner |

### Frontend (React Native / Expo Web)
| Package | Version | Purpose |
|---|---|---|
| expo | ~57.x | App framework (compiled to web) |
| expo-router | ~57.x | File-based routing |
| expo-linear-gradient | ~57.x | Gradient UI |
| react-native | 0.86.x | Core framework |
| react-native-gifted-charts | ^1.x | Charts and data visualization |
| react-native-svg | 15.x | SVG support for charts |
| @tanstack/react-query | ^5.x | Data fetching and polling |
| axios | ^1.x | HTTP client |
| zustand | ^5.x | State management |
| lucide-react-native | ^1.x | Icon library |
| expo-maps | ~57.x | Map for machine locations |

---

## 12. Shared Database Architecture

Both `app/backend` and `Dashboard/backend` connect to the **same MongoDB Atlas cluster**:

```
MongoDB Atlas (Shared Cluster)
├── users              → Written by app/backend, read by dashboard/backend
├── contributionsessions → Written by app/backend, read by dashboard/backend
├── machines           → Written by BOTH (app: CRUD, dashboard: heartbeat updates)
├── pointtransactions  → Written by app/backend only
├── partners           → Written by app/backend only
├── rewards            → Written by app/backend only
├── uservouchers       → Written by app/backend only
├── milestones         → Written by app/backend only
├── usermilestones     → Written by app/backend only
├── campaigns          → Written by app/backend only
├── otps               → Written by app/backend only
└── auditlogs          → Written by app/backend only
```

> **Why two backends?** Separating the IoT telemetry/monitoring logic (Dashboard) from the user business logic (App) prevents heartbeat spam and analytics queries from affecting the latency of user-facing actions like QR claims and reward redemptions.

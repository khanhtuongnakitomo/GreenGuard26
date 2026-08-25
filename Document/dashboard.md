# GreenGuard Dashboard — Comprehensive Documentation

> **Last updated:** 2026-08-25  
> **Codebase path:** `GreenGuard26/Dashboard/`  
> **Platform:** Expo (React Native Web) · Express 4 + TypeScript · MongoDB Atlas (shared with GreenPoint-Backend)  
> **Backend Port:** 3003  

---

## 1. Product Overview

The **GreenGuard Dashboard** is a web-based administrative and analytics monitoring portal for the GreenGuard smart recycling ecosystem at DHBK. It allows operators and administrators to monitor machine fleet health, track recycling metrics (bottles, cans, cartons, and points), inspect contribution session histories, and view recycling trends.

> **Important:** The Dashboard backend connects directly to the **same MongoDB Atlas database** as the GreenPoint App backend (`GreenPoint-Backend`). Metrics like total waste, session counts, and claim rates are calculated from the shared `contributionsessions`, `machines`, and `users` collections.

| Layer | Stack | Port / Target | Status |
|---|---|---|---|
| **Backend** | Express 4 · TypeScript · Mongoose 8 | Port `3003` | Active API server |
| **Frontend** | React Native (Expo Web) · TypeScript · Gifted Charts | Web Browser (`expo start --web`) | 4 Screens UI (Mock Data ready for API wiring) |

---

## 2. System Architecture

```
Dashboard/
├── backend/                       # Express + TypeScript API server (port 3003)
│   ├── .env.example               # Environment variables template
│   ├── package.json               # express, mongoose, cors, dotenv, tsx
│   ├── tsconfig.json
│   └── src/
│       ├── server.ts              # Entry point: load .env → connectDB() → app.listen(3003)
│       ├── app.ts                 # Express app: cors, json middleware, routes, /health
│       ├── config/
│       │   └── db.ts              # Mongoose connection to shared MongoDB Atlas
│       ├── types/
│       │   └── index.ts           # Shared TypeScript interfaces & DTOs
│       ├── models/
│       │   ├── ContributionSession.ts  # Session model (shared collection with GreenPoint-Backend)
│       │   ├── Machine.ts              # Machine model (shared collection with GreenPoint-Backend)
│       │   └── User.ts                 # User model (read-only reference)
│       ├── controllers/
│       │   ├── machine.controller.ts   # Machine listing & detail queries
│       │   ├── session.controller.ts   # Session history & latest session feed
│       │   └── stats.controller.ts     # Aggregated summary statistics
│       └── routes/
│           ├── machine.routes.ts       # /api/machines endpoints
│           ├── session.routes.ts       # /api/sessions endpoints
│           └── stats.routes.ts         # /api/stats endpoints
└── frontend/                      # Expo Web app (React Native Web)
    ├── app.json                   # Expo config
    ├── App.tsx                    # Root component with state-driven navigation
    ├── babel.config.js
    ├── index.ts                   # Expo entry point
    ├── package.json               # Dependencies: expo, react-native, gifted-charts, lucide, zustand, axios, react-query
    ├── tsconfig.json
    └── src/
        ├── components/
        │   ├── DashboardSidebar.tsx   # Left navigation sidebar
        │   ├── DashboardTopNav.tsx    # Top search and user navbar
        │   ├── KPICard.tsx            # Key metric display card
        │   ├── SectionCard.tsx        # Styled section card container
        │   └── StatusBadge.tsx        # Machine online/offline badge
        ├── constants/
        │   └── mockData.ts            # UI presentation data
        ├── screens/
        │   ├── DashboardScreen.tsx    # Overview KPIs, classification trend, waste pie, recent items
        │   ├── AnalyticsScreen.tsx    # Trend charts, peak usage, accuracy, location rankings
        │   ├── SmartBinsScreen.tsx    # Bin fleet status, map grid, hardware telemetry
        │   └── ReportsScreen.tsx      # Quick report generation and report download history
        ├── theme/
        │   ├── colors.ts              # Design token color palette
        │   ├── typography.ts          # Typography system
        │   └── index.ts
        └── types/
            └── dashboard.types.ts     # Frontend domain types
```

---

## 3. Database Schemas (Mongoose)

The Dashboard backend connects to the **same MongoDB Atlas database** as `GreenPoint-Backend`.

### 3.1 ContributionSession (Shared Collection: `contributionsessions`)

```typescript
Collection: contributionsessions
Fields:
  sessionCode     String    required, unique, indexed (e.g. "GP-SESSION-XXXX")
  machineId       ObjectId  ref: "Machine", required, indexed
  machineName     String    optional cached name
  items           [{
    itemType      String    enum: ["plastic_bottle", "can", "carton"]
    quantity      Number    min: 1
    pointsPerItem Number
  }]
  totalItems      Number    min: 0
  totalPoints     Number    min: 0
  claimTokenHash  String    required, indexed
  status          String    enum: ["unclaimed", "claimed", "expired", "cancelled"], default: "unclaimed", indexed
  claimedBy       ObjectId  ref: "User", optional
  claimedAt       Date      optional
  expiresAt       Date      required, indexed
  timestamps      { createdAt, updatedAt }
```

> **Dashboard metrics computation:**
> - `plastic_bottle`: Sum of quantities where `itemType = "plastic_bottle"`
> - `can`: Sum of quantities where `itemType = "can"`
> - `carton`: Sum of quantities where `itemType = "carton"`
> - `totalItems`: Sum of all items or cached `totalItems`
> - `totalPointsAwarded`: Sum of `totalPoints` for sessions with `status = "claimed"`

### 3.2 Machine (Shared Collection: `machines`)

```typescript
Collection: machines
Fields:
  machineCode    String   required, unique, indexed (e.g. "0001" or "BK_BIN_01")
  name           String   required
  locationName   String   required
  locationType   String   default: "other" (e.g. "canteen", "parking", "library", "classroom_area", "other")
  apiKeyHash     String   required, select: false (for machine authentication)
  status         String   enum: ["online", "offline", "maintenance", "disabled"], default: "offline", indexed
  lastSeenAt     Date     timestamp of last heartbeat/telemetry pulse
  totalSessions  Number   default: 0
  bins           [{
    binType         String  ("plastic_bottle" | "can" | "carton")
    capacityPercent Number  0–100, default: 0
  }]
  timestamps     { createdAt, updatedAt }
```

> **Online/Offline detection:** A machine is considered **online** if `lastSeenAt` is within the last 30 seconds (`Date.now() - lastSeenAt <= 30000`).

### 3.3 User (Shared Collection: `users` — Read-only Reference)

```typescript
Collection: users
Fields (Enriched on session queries / aggregated user stats):
  phoneNumber             String   unique, indexed
  displayName             String   default: "Green User"
  avatar                  String   default: "default-avatar.png"
  role                    String   default: "user", indexed ("user" | "operator" | "admin" | "partner_admin")
  className               String   optional
  studentId               String   sparse, indexed
  totalPoints             Number   current redeemable balance
  lifetimeEarnedPoints    Number   all-time earned points
  lifetimeRedeemedPoints  Number   all-time spent points
  totalBottles            Number   user total bottles recycled
  totalCans               Number   user total cans recycled
  totalCarton             Number   user total cartons recycled
  totalItems              Number   user total items recycled
  currentStreak           Number
  longestStreak           Number
  lastContributionAt      Date
  membershipTier          String   ("green_member" | "silver" | "gold" | "platinum")
  timestamps              { createdAt, updatedAt }
```

---

## 4. Machine Telemetry & Heartbeat Architecture

The smart recycling kiosks (Jetson Nano / Windows demo) interact with the backend infrastructure through the following pattern:

1. **Heartbeat Ingestion:**
   - Physical machines send periodic heartbeats (every 10–15s) with `x-machine-api-key` or operator tokens.
   - In the ecosystem architecture, heartbeat ingestion is handled by `GreenPoint-Backend` at `POST /api/machines/:machineId/heartbeat` (updating `status = "online"` and `lastSeenAt = new Date()`).
2. **Dashboard Fleet Monitoring:**
   - The Dashboard backend queries the shared `machines` collection via `GET /api/machines` and `GET /api/machines/:machineCode`.
   - The Dashboard frontend evaluates `isOnline = (Date.now() - new Date(machine.lastSeenAt).getTime()) <= 30000`.

| State | Condition / Meaning |
|---|---|
| `online` | Heartbeat pulse received within the last 30 seconds |
| `offline` | No heartbeat received for > 30 seconds |
| `maintenance` | Machine flagged for maintenance downtime |
| `disabled` | Machine decommissioned or taken out of service |

---

## 5. Authentication & Environment Configuration

### 5.1 Authentication Status
- **Current State:** The `Dashboard/backend` service currently serves internal monitoring and aggregation endpoints without active JWT token validation middleware.
- **Unified Auth Ecosystem:** User and administrative authentication is managed centrally by `GreenPoint-Backend` (port 4000) using JWT access tokens (15m TTL) and refresh tokens (7d TTL).

### 5.2 Backend Environment Variables (`Dashboard/backend/.env`)

| Variable | Type | Default | Description |
|---|---|---|---|
| `PORT` | number | `3003` | Express server port |
| `NODE_ENV` | string | `development` | Runtime environment (`development` / `production`) |
| `MONGODB_URI` | string | *required* | MongoDB Atlas connection string (**MUST** point to shared cluster) |
| `JWT_ACCESS_SECRET` | string | *optional* | Shared JWT secret for future token verification |
| `JWT_REFRESH_SECRET`| string | *optional* | Shared JWT refresh secret |
| `FRONTEND_ORIGIN` | string | `*` | Allowed CORS origin |

---

## 6. API Reference (Dashboard Backend)

**Base URL:** `http://localhost:3003`

### 6.1 Health Check

#### `GET /health`
Liveness check for monitoring and uptime probes.

- **Auth:** None
- **Response `200 OK`:**
```json
{
  "status": "ok",
  "ts": "2026-08-25T10:00:00.000Z"
}
```

---

### 6.2 Machines (`/api/machines`)

#### `GET /api/machines`
List all machines registered in the database with their location, telemetry status, total sessions, and bin capacities.

- **Auth:** None
- **Response `200 OK`:**
```json
[
  {
    "_id": "664b1f...",
    "machineCode": "0001",
    "name": "GreenGuard Kiosk #1",
    "locationName": "Canteen A — DHBK",
    "locationType": "canteen",
    "status": "online",
    "lastSeenAt": "2026-08-25T10:14:30.000Z",
    "totalSessions": 142,
    "bins": [
      { "binType": "plastic_bottle", "capacityPercent": 65 },
      { "binType": "can", "capacityPercent": 40 },
      { "binType": "carton", "capacityPercent": 15 }
    ],
    "createdAt": "2026-08-01T00:00:00.000Z",
    "updatedAt": "2026-08-25T10:14:30.000Z"
  }
]
```

#### `GET /api/machines/:machineCode`
Get details of a specific machine identified by its `machineCode`.

- **Params:** `machineCode` (string, e.g. `0001`)
- **Response `200 OK`:** Machine object.
- **Response `404 Not Found`:** `{ "success": false, "message": "Machine 0001 not found" }`

---

### 6.3 Sessions (`/api/sessions`)

#### `GET /api/sessions`
Get paginated list of contribution sessions with filtering options.

- **Query Parameters:**
  - `machineCode` (string, optional): Filter by machine's code (e.g. `0001`).
  - `status` (string, optional): Filter by session status (`unclaimed` | `claimed` | `expired` | `cancelled`).
  - `itemType` (string, optional): Filter sessions containing item type (`plastic_bottle` | `can` | `carton`).
  - `startDate` (ISO string, optional): Filter sessions created on or after date.
  - `endDate` (ISO string, optional): Filter sessions created on or before date.
  - `limit` (number, default: `50`): Number of records per page.
  - `offset` (number, default: `0`): Skip count for pagination.

- **Response `200 OK`:**
```json
{
  "data": [
    {
      "_id": "664b2a...",
      "sessionCode": "GP-SESSION-172458",
      "machineId": {
        "_id": "664b1f...",
        "machineCode": "0001",
        "name": "GreenGuard Kiosk #1",
        "locationName": "Canteen A — DHBK"
      },
      "items": [
        { "itemType": "plastic_bottle", "quantity": 2, "pointsPerItem": 10 },
        { "itemType": "can", "quantity": 1, "pointsPerItem": 8 }
      ],
      "totalItems": 3,
      "totalPoints": 28,
      "status": "claimed",
      "claimedBy": "664b01...",
      "claimedAt": "2026-08-25T10:05:00.000Z",
      "expiresAt": "2026-08-25T10:15:00.000Z",
      "createdAt": "2026-08-25T10:00:00.000Z"
    }
  ],
  "total": 500,
  "limit": 50,
  "offset": 0
}
```

#### `GET /api/sessions/latest`
Get the single most recent contribution session across the entire fleet or for a specific machine. Used for live activity feeds (short-polled every 3–5 seconds).

- **Query Parameters:**
  - `machineCode` (string, optional): Filter by machine.
- **Response `200 OK`:** Latest populated session object or `null`.

---

### 6.4 Statistics (`/api/stats`)

#### `GET /api/stats/summary`
Get aggregated recycling statistics.

- **Query Parameters:**
  - `machineCode` (string, optional): Specify `machineCode` (e.g. `0001`) for single-machine stats, or omit/pass `ALL` for global fleet stats.

- **Response `200 OK`:**
```json
{
  "machineCode": "ALL",
  "totalSessions": 500,
  "totalItems": 1200,
  "byType": {
    "plastic_bottle": 850,
    "can": 350,
    "carton": 0
  },
  "claimedSessions": 420,
  "unclaimedSessions": 80,
  "claimRate": 0.84,
  "totalPointsAwarded": 11500
}
```

> **Note on Extended Analytics:** Time-series trends (`/api/stats/timeline`) and top recyclers leaderboard (`/api/stats/top-users`) are modeled for future backend expansion and are currently rendered using curated presentation data on the frontend (`src/constants/mockData.ts`).

---

## 7. Frontend UI & Screens

The Dashboard frontend is built with React Native Web (Expo) and features 4 comprehensive administrative screens:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ DashboardTopNav  (Title, Subtitle "Welcome back, Mark", Notifications, Profile) │
├──────────────┬──────────────────────────────────────────────────────────────┤
│ SIDEBAR      │ ACTIVE SCREEN CONTENT                                        │
│ • Dashboard  │                                                              │
│ • Analytics  │ 1. Dashboard: KPI Row, Bar Trend, Donut Pie, Recent Sessions │
│ • Smart Bins │ 2. Analytics: Multi-chart Trends, Peak Usage, Top Locations  │
│ • Reports    │ 3. Smart Bins: Campus Map, Fleet Status, Hardware Health     │
│ • Alerts     │ 4. Reports: Quick Report Generator, History Table & Downloads │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

### 7.1 Screen Breakdown

1. **Dashboard Screen (`DashboardScreen.tsx`):**
   - 4 KPI Cards: Total Recycled Items, AI Detection Accuracy, Active Smart Bins, Today's Classifications.
   - Classification Trend Bar Chart (Gifted Charts).
   - Compartment Utilization Progress Bars.
   - Waste Type Donut Chart (`plastic`, `metal`, `paper`, `others`).
   - Recent Classifications Table (real-time stream).
   - Smart Bin Status Quick List with Fill Level indicators.
   - Campaign Performance widget & System Alert Cards.

2. **Analytics Screen (`AnalyticsScreen.tsx`):**
   - 5 Analytics KPI Metrics (Classifications, Average Accuracy, Total Waste Kg, Active Bins, Today's Classifications).
   - Classification Trend with weekly/monthly filters.
   - Waste Type Distribution Breakdown.
   - Accuracy Trend Line Chart (area chart).
   - Peak Usage Hourly Bar Chart (6am – 8pm).
   - Top Locations Leaderboard (e.g. HCMUT Liners, CircleK).
   - Waste Type Distribution Over Time & Daily Average Breakdown.

3. **Smart Bins Fleet Screen (`SmartBinsScreen.tsx`):**
   - Interactive Campus Map coordinate visualization (HCMUT campus grid).
   - Fleet Overview Donut Counters (`Online`, `Offline`, `Error`, `Nearly Full`).
   - Searchable Bin Status Table with fill level indicators and status badges.
   - Selected Bin Hardware Inspector displaying live health of:
     - Camera Module
     - Jetson Nano Edge Computer
     - ESP32-S3 Microcontroller
     - Servo Motors
     - AI Computer Vision Model

4. **Reports Screen (`ReportsScreen.tsx`):**
   - Quick Report Generator for Daily, Weekly, Monthly, and Yearly reports.
   - Calendar date picker trigger.
   - Export format buttons (PDF / Excel).
   - Searchable Report History Table with file size, creation timestamp, and action buttons (Download, View, Delete).

---

## 8. Frontend Navigation & Data Architecture

- **Navigation Pattern:** State-driven screen switching in `App.tsx` (`useState<DashboardRoute>('dashboard')`) passing `onNavigate` callbacks to `DashboardSidebar`. This keeps the web dashboard lightweight and avoids complex routing overhead.
- **State Management & Data Fetching:** Configured with `@tanstack/react-query` `QueryClientProvider` and `axios` ready for polling API services.
- **Current Data State:** UI screens render complete, styled layouts using `src/constants/mockData.ts`. Wiring live queries to backend endpoints will replace mock constants seamlessly.

---

## 9. Technology Dependencies

### Backend Dependencies (`Dashboard/backend/package.json`)
| Package | Version | Purpose |
|---|---|---|
| `express` | `^4.19.2` | Core HTTP web framework |
| `mongoose` | `^8.3.4` | MongoDB Object Data Modeling (ODM) |
| `cors` | `^2.8.5` | Cross-Origin Resource Sharing middleware |
| `dotenv` | `^16.4.5` | Environment variable loader |
| `tsx` | `^4.8.2` | Fast dev TypeScript execution runner |
| `typescript` | `^5.4.5` | TypeScript compiler |

### Frontend Dependencies (`Dashboard/frontend/package.json`)
| Package | Version | Purpose |
|---|---|---|
| `expo` | `~57.0.2` | Expo React Native application framework |
| `react-native` | `0.86.0` | React Native core |
| `react-native-web` | `^0.21.2` | React Native web renderer |
| `react-native-gifted-charts` | `^1.4.77` | Bar charts, line charts, and donut pie charts |
| `react-native-svg` | `15.15.4` | SVG rendering for chart components |
| `lucide-react-native` | `^1.23.0` | Iconography (Cpu, Camera, Zap, FileText, etc.) |
| `@tanstack/react-query` | `^5.101.2` | Async state management and polling cache |
| `axios` | `^1.18.1` | HTTP API client |
| `zustand` | `^5.0.14` | Global state management |
| `expo-linear-gradient` | `~57.0.0` | Gradient backgrounds |

---

## 10. Summary of Key Architectural Decisions

1. **Shared MongoDB Cluster:** Eliminates data duplication and keeps admin analytics synchronized with mobile user QR claims and machine transactions.
2. **Dedicated Telemetry Backend:** Runs on port 3003 independently of `GreenPoint-Backend` (port 4000) so heavy admin aggregation queries and short-polling do not impact mobile app user latency.
3. **Cross-Platform React Native Web:** Shares styling paradigms, color tokens, and domain concepts with the student mobile app while presenting a desktop-optimized admin layout.

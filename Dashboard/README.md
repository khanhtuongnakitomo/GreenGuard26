# GreenGuard Dashboard — Architecture & Guide

> **Ecosystem:** GreenGuard / BKI Smart Recycling Ecosystem  
> **Platform:** React Native (Expo Web) · Express 4 + TypeScript · Shared MongoDB Atlas  
> **Backend Port:** 3003  

---

## 1. Overview

The **GreenGuard Dashboard** is the administrative and analytics monitoring web portal for the GreenGuard smart recycling system at DHBK. It provides real-time fleet health tracking for smart bin kiosks (Jetson Nano B01), recycling metrics (bottles, cans, cartons, points), session audits, and trend analytics.

> **Data Architecture:** The Dashboard backend connects to the **same MongoDB Atlas cluster** as the GreenPoint App backend (`GreenPoint-Backend`). It shares collections (`contributionsessions`, `machines`, `users`) while isolating telemetry traffic and aggregation queries from user-facing app actions.

---

## 2. Directory Structure

```
Dashboard/
├── backend/                       # Express + TypeScript API server (port 3003)
│   ├── .env.example               # Environment template
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── server.ts              # Entry: load .env → connectDB() → app.listen(3003)
│       ├── app.ts                 # Express: cors, json, mount routes, /health
│       ├── config/
│       │   └── db.ts              # Mongoose connection to shared MongoDB Atlas
│       ├── types/
│       │   └── index.ts           # Shared TypeScript interfaces & DTOs
│       ├── models/
│       │   ├── ContributionSession.ts  # Session model (shared with GreenPoint-Backend)
│       │   ├── Machine.ts              # Machine state & telemetry model
│       │   └── User.ts                 # User read-only reference
│       ├── controllers/
│       │   ├── machine.controller.ts   # Machine listing & details
│       │   ├── session.controller.ts   # Session queries & latest session feed
│       │   └── stats.controller.ts     # Aggregated summary statistics
│       └── routes/
│           ├── machine.routes.ts       # /api/machines
│           ├── session.routes.ts       # /api/sessions
│           └── stats.routes.ts         # /api/stats
└── frontend/                      # Expo Web app (React Native Web)
    ├── app.json                   # Expo configuration
    ├── App.tsx                    # Root component with state-driven navigation
    ├── babel.config.js
    ├── index.ts                   # Expo entry point
    ├── package.json               # Dependencies: expo, react-native, gifted-charts, lucide, react-query, axios, zustand
    ├── tsconfig.json
    └── src/
        ├── components/
        │   ├── DashboardSidebar.tsx   # Left navigation sidebar
        │   ├── DashboardTopNav.tsx    # Top search and user navbar
        │   ├── KPICard.tsx            # KPI metric display card
        │   ├── SectionCard.tsx        # Styled card container
        │   └── StatusBadge.tsx        # Machine online/offline badge
        ├── constants/
        │   └── mockData.ts            # UI presentation data
        ├── screens/
        │   ├── DashboardScreen.tsx    # Page 1: Overview KPIs, Waste Pie, Classification Trend
        │   ├── AnalyticsScreen.tsx    # Page 2: Time-series recycling trends & peak usage
        │   ├── SmartBinsScreen.tsx    # Page 3: Bin fleet status, map grid, hardware telemetry
        │   └── ReportsScreen.tsx      # Page 4: Contribution reports & export options
        ├── theme/
        │   ├── colors.ts              # Design token color palette
        │   ├── typography.ts          # Typography system
        │   └── index.ts
        └── types/
            └── dashboard.types.ts     # Frontend domain types
```

---

## 3. Backend API Reference

Base URL: `http://localhost:3003`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | None | Server liveness check (`status: "ok"`) |
| `GET` | `/api/machines` | None | List all smart machines with status & bin capacities |
| `GET` | `/api/machines/:machineCode` | None | Specific machine details & status by `machineCode` |
| `GET` | `/api/sessions` | None | Paginated sessions (filters: `machineCode`, `status`, `itemType`, `startDate`, `endDate`, `limit`, `offset`) |
| `GET` | `/api/sessions/latest` | None | Latest contribution session across fleet or per machine (filter: `machineCode`) |
| `GET` | `/api/stats/summary` | None | Aggregated summary statistics (`machineCode` = `ALL` or specific machine code) |

*Note: Telemetry heartbeat ingestion (`POST /api/machines/:machineId/heartbeat`) is processed through `GreenPoint-Backend` (port 4000) with API key validation.*

---

## 4. Running the Dashboard

### 4.1 Backend (Express + TypeScript)
```bash
cd GreenGuard26/Dashboard/backend
cp .env.example .env       # Configure MONGODB_URI
npm install
npm run dev                # Starts at http://localhost:3003
```

### 4.2 Frontend (Expo Web)
```bash
cd GreenGuard26/Dashboard/frontend
npm install
npx expo start --web       # Runs Expo Web dev server
```

---

## 5. Integration Status Note

- **Backend:** Implemented on port 3003 with Mongoose models connected to the shared MongoDB Atlas cluster, Express routes, and aggregation controllers.
- **Frontend:** Complete 4-screen UI implementation matching Figma design specifications with state-driven navigation (`App.tsx`). Screen views currently render presentation data from `src/constants/mockData.ts` and are structured for live backend wiring via TanStack React Query / Axios.

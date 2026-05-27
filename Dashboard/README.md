# GreenGuard Dashboard — Kiến trúc thư mục

> **Robot:** BK_BIN_01 · Smart Recycling Robot  
> **Stack:** React + Vite + TypeScript · Express + TypeScript · MongoDB Atlas

---

## Tổng quan cấu trúc

```
Dashboard/
├── backend/       # Express + TypeScript API server (port 3001)
├── frontend/      # React + Vite + TypeScript dashboard (port 5173)
└── docs/          # Tài liệu kiến trúc và feature
```

---

## `backend/` — Express + TypeScript API

```
backend/
├── .env.example               # Template biến môi trường (copy → .env)
├── package.json               # Dependencies: express, mongoose, cors, dotenv
├── tsconfig.json              # TS config: target ES2020, outDir dist/
│
└── src/
    ├── server.ts              # Entry point: load .env → connectDB() → app.listen()
    ├── app.ts                 # Express app: middleware + mount routes + health check
    │
    ├── config/
    │   └── db.ts              # Kết nối MongoDB Atlas qua mongoose
    │
    ├── types/
    │   └── index.ts           # Shared TypeScript types/interfaces:
    │                          #   DetectedType, TargetBin, SortCommand, SortingStatus,
    │                          #   MachineState, CreateDetectionDto, HeartbeatDto,
    │                          #   SummaryResponse, PaginatedResponse, ApiSuccess, ApiError
    │
    ├── models/
    │   ├── Detection.ts       # Mongoose model: 1 document = 1 lượt phân loại rác
    │   │                      #   eventId (unique) · machineId · detectedType · confidence
    │   │                      #   targetBin · sortCommand · sortingStatus · createdAt
    │   │                      #   Index: eventId (unique), machineId, {machineId, createdAt}
    │   ├── Machine.ts         # Mongoose model: trạng thái hiện tại của robot
    │   │                      #   machineId (unique) · currentState · lastSeenAt · lastEventId
    │   └── MachineHeartbeat.ts# Mongoose model: lịch sử heartbeat (append-only)
    │                          #   machineId · state · lastEventId · createdAt
    │
    ├── controllers/
    │   ├── detection.controller.ts   # POST /api/detections (upsert idempotent qua eventId)
    │   │                             # GET  /api/detections  (filter + pagination)
    │   │                             # GET  /api/detections/latest
    │   ├── machine.controller.ts     # POST /api/machines/heartbeat (upsert + append log)
    │   │                             # GET  /api/machines/:machineId (+ recentHeartbeats)
    │   └── stats.controller.ts       # GET  /api/stats/summary (MongoDB aggregation)
    │
    └── routes/
        ├── detection.routes.ts  # /api/detections → detection.controller
        ├── machine.routes.ts    # /api/machines   → machine.controller
        └── stats.routes.ts      # /api/stats      → stats.controller
```

### API Endpoints

| Method | Path | Caller | Mô tả |
|--------|------|--------|-------|
| `POST` | `/api/detections` | Jetson | Gửi detection event (idempotent) |
| `GET`  | `/api/detections` | Dashboard | Lịch sử phân loại (filter + pagination) |
| `GET`  | `/api/detections/latest` | Dashboard | Event gần nhất |
| `POST` | `/api/machines/heartbeat` | Jetson | Heartbeat định kỳ |
| `GET`  | `/api/machines/:machineId` | Dashboard | Trạng thái machine + log |
| `GET`  | `/api/stats/summary` | Dashboard | Thống kê tổng quan |
| `GET`  | `/health` | Monitoring | Health check |

### Chạy backend

```bash
cd backend
cp .env.example .env       # Điền MONGODB_URI
npm install
npm run dev                # tsx watch → hot reload, port 3001
```

---

## `frontend/` — React + Vite + TypeScript + Tailwind CSS

```
frontend/
├── .env.example               # VITE_API_BASE_URL, VITE_MACHINE_ID
├── index.html                 # HTML entry với SEO meta tags
├── package.json               # react, react-router-dom, @tanstack/react-query, recharts, axios
├── vite.config.ts             # Vite: @/ alias → src/, proxy /api → localhost:3001
├── tsconfig.json              # TS strict mode, path alias @/*
├── tsconfig.node.json         # TS config cho vite.config.ts
├── tailwind.config.js         # Tailwind content: src/**/*.{ts,tsx}
├── postcss.config.js          # PostCSS: tailwindcss + autoprefixer
│
└── src/
    ├── main.tsx               # React entry: ReactDOM.createRoot + QueryClientProvider
    ├── App.tsx                # Router: BrowserRouter + Routes + Sidebar + TopBar layout
    ├── index.css              # Tailwind directives + base styles
    │
    ├── types/
    │   └── index.ts           # Mirror types từ backend: Detection, Machine, Summary,
    │                          # DetectionFilters, PaginatedResponse, MachineState, ...
    │
    ├── utils/
    │   ├── constants.ts       # MACHINE_ID, POLL_INTERVALS, WASTE_TYPES, BINS, ...
    │   └── formatters.ts      # formatTime, formatTimeAgo, formatWasteType,
    │                          # formatConfidence, isOnline, machineStateLabel, ...
    │
    ├── api/
    │   └── client.ts          # Axios instance + typed API functions:
    │                          #   fetchDetections, fetchLatestDetection,
    │                          #   fetchSummary, fetchMachine
    │
    ├── hooks/                 # TanStack Query hooks (polling + cache)
    │   ├── useSummary.ts      # GET /api/stats/summary — poll 5s
    │   ├── useLatestEvent.ts  # GET /api/detections/latest — poll 3s
    │   ├── useDetections.ts   # GET /api/detections — poll 10s (optional)
    │   └── useMachine.ts      # GET /api/machines/:id — poll 5s
    │
    ├── components/
    │   ├── layout/
    │   │   ├── Sidebar.tsx    # Navigation: Overview / History / Machine Status
    │   │   └── TopBar.tsx     # Header: title + MachineStatusBadge live
    │   │
    │   ├── cards/
    │   │   ├── StatCard.tsx           # Metric card (label, value, unit, color)
    │   │   ├── LatestEvent.tsx        # Card event phân loại gần nhất
    │   │   └── MachineStatusBadge.tsx # ● Online/Offline + state pill + time ago
    │   │
    │   ├── charts/
    │   │   ├── WasteTypeChart.tsx     # Recharts BarChart: count theo loại rác
    │   │   ├── BinDistribution.tsx    # Recharts PieChart: phân bổ theo ngăn
    │   │   └── TimelineChart.tsx      # Recharts LineChart: detections theo giờ
    │   │
    │   └── table/
    │       ├── DetectionTable.tsx     # Bảng lịch sử + skeleton loader + status badge
    │       └── TableFilters.tsx       # Filter bar: type, status, date range
    │
    └── pages/
        ├── Dashboard.tsx      # Route "/" — Overview: StatCards + Charts + LatestEvent
        ├── History.tsx        # Route "/history" — Bảng lịch sử + filters + pagination
        └── Machine.tsx        # Route "/machine" — Machine info + status + heartbeat log
```

### Data flow

```
App mount
  │
  ├── Dashboard.tsx (/)
  │     ├── useSummary()        → GET /api/stats/summary        [poll 5s]
  │     ├── useLatestEvent()    → GET /api/detections/latest    [poll 3s]
  │     └── useDetections()     → GET /api/detections           [poll 10s]
  │
  ├── History.tsx (/history)
  │     └── useDetections(filters, offset)  → GET /api/detections?...  [manual refetch]
  │
  └── Machine.tsx (/machine)
        └── useMachine()        → GET /api/machines/BK_BIN_01  [poll 5s]
```

### Chạy frontend

```bash
cd frontend
cp .env.example .env       # Tuỳ chỉnh VITE_API_BASE_URL nếu cần
npm install
npm run dev                # Vite dev server → port 5173
```

---

## `docs/` — Tài liệu

```
docs/
├── dashboard-architecture.md  # Kiến trúc chi tiết React dashboard
└── GreenGuard-Soft-Feat.md    # Software & dashboard workflow toàn hệ thống
```

---

## Chạy cả hai cùng lúc (Demo)

```bash
# Terminal 1 — Backend
cd backend && npm run dev      # http://localhost:3001

# Terminal 2 — Frontend
cd frontend && npm run dev     # http://localhost:5173
```

> **Vite proxy** tự forward `/api/*` → `localhost:3001` nên không cần config CORS khi dev.

---

## MongoDB Atlas Collections

| Collection | Mô tả |
|---|---|
| `detections` | Mỗi lượt phân loại rác (eventId unique, compound index machineId+createdAt) |
| `machines` | Trạng thái hiện tại của từng robot (upsert theo machineId) |
| `machine_heartbeats` | Lịch sử heartbeat append-only (index machineId) |

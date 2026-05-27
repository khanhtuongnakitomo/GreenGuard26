# Dashboard Architecture — Robot Phân Loại Rác Thông Minh
> **Target:** Demo-grade React dashboard for `BK_BIN_01` smart recycling robot  
> **Stack:** React + Vite · Axios · Recharts · TanStack Query · Tailwind CSS  
> **Backend:** Express.js · MongoDB Atlas  

---

## 1. Mục tiêu kiến trúc

Dashboard này phục vụ hai đối tượng:

- **Operator / nhóm kỹ thuật** — cần biết robot đang làm gì ngay bây giờ.
- **Demo audience** — cần thấy dữ liệu rõ ràng, đẹp, dễ hiểu trong thời gian ngắn.

Demo-grade có nghĩa là:

- Mọi thứ phải chạy được thật, không mock.
- Không bị crash hoặc màn hình trắng khi mất kết nối.
- Không cần auth phức tạp — API key hoặc không có auth là đủ cho demo nội bộ.
- Cập nhật dữ liệu tự động, người xem không cần refresh thủ công.

---

## 2. Kiến trúc tổng quan

```text
┌─────────────────────────────────────────────────────┐
│                   React Dashboard                    │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  Overview   │  │   History    │  │  Machine   │  │
│  │    Page     │  │    Page      │  │ Status Page│  │
│  └──────┬──────┘  └──────┬───────┘  └─────┬──────┘  │
│         │                │                │          │
│  ┌──────▼────────────────▼────────────────▼──────┐  │
│  │              API Client Layer                  │  │
│  │         (Axios + TanStack Query)               │  │
│  └──────────────────────┬────────────────────────┘  │
└─────────────────────────│───────────────────────────┘
                          │ HTTP / polling 3–5s
┌─────────────────────────▼───────────────────────────┐
│                  Express Backend                     │
│                                                      │
│  /api/detections       /api/stats/summary            │
│  /api/detections/latest   /api/machines/:machineId   │
└──────────────────────────┬──────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │      MongoDB Atlas       │
              │  detections · machines   │
              │  machine_heartbeats      │
              └─────────────────────────┘
```

---

## 3. Cấu trúc thư mục dashboard

```text
dashboard/
├── public/
│   └── favicon.ico
├── src/
│   ├── api/
│   │   └── client.js             # Axios instance + all API calls
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.jsx
│   │   │   └── TopBar.jsx
│   │   ├── cards/
│   │   │   ├── StatCard.jsx      # Reusable stat card
│   │   │   ├── LatestEvent.jsx   # Latest detection card
│   │   │   └── MachineStatusBadge.jsx
│   │   ├── charts/
│   │   │   ├── WasteTypeChart.jsx    # Bar chart by waste type
│   │   │   ├── BinDistribution.jsx   # Pie/donut chart by bin
│   │   │   └── TimelineChart.jsx     # Detections over time
│   │   └── table/
│   │       ├── DetectionTable.jsx
│   │       └── TableFilters.jsx
│   ├── pages/
│   │   ├── Dashboard.jsx         # Overview page
│   │   ├── History.jsx           # Full history + filters
│   │   └── Machine.jsx           # Machine status detail
│   ├── hooks/
│   │   ├── useDetections.js
│   │   ├── useSummary.js
│   │   ├── useMachine.js
│   │   └── useLatestEvent.js
│   ├── utils/
│   │   ├── formatters.js         # Date, confidence, status formatting
│   │   └── constants.js          # MACHINE_ID, API_BASE_URL, etc.
│   ├── App.jsx
│   └── main.jsx
├── .env.example
├── package.json
└── vite.config.js
```

---

## 4. API Client Layer

### 4.1. Axios instance

File: `src/api/client.js`

```javascript
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const MACHINE_ID = import.meta.env.VITE_MACHINE_ID || 'BK_BIN_01';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
});

// Response interceptor — log errors, don't crash
api.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error('[API Error]', err.message);
    return Promise.reject(err);
  }
);

// ── API functions ──────────────────────────────────────

export const fetchDetections = (params = {}) =>
  api.get('/api/detections', { params: { machineId: MACHINE_ID, limit: 50, ...params } })
     .then((r) => r.data);

export const fetchLatestDetection = () =>
  api.get('/api/detections/latest', { params: { machineId: MACHINE_ID } })
     .then((r) => r.data);

export const fetchSummary = () =>
  api.get('/api/stats/summary', { params: { machineId: MACHINE_ID } })
     .then((r) => r.data);

export const fetchMachine = () =>
  api.get(`/api/machines/${MACHINE_ID}`)
     .then((r) => r.data);
```

---

### 4.2. TanStack Query hooks

File: `src/hooks/useSummary.js`

```javascript
import { useQuery } from '@tanstack/react-query';
import { fetchSummary } from '../api/client';

export function useSummary() {
  return useQuery({
    queryKey: ['summary'],
    queryFn: fetchSummary,
    refetchInterval: 5000,       // poll mỗi 5 giây
    staleTime: 3000,
    retry: 2,
  });
}
```

Tương tự cho `useDetections`, `useLatestEvent`, `useMachine` — chỉ khác `queryKey` và `queryFn`.

> **Tại sao TanStack Query thay vì `setInterval` thuần?**
> - Tự xử lý loading / error state.
> - Không gọi API khi tab đang bị ẩn (tránh lag khi demo).
> - Cache thông minh, UI không bị flash khi refetch.

---

## 5. Pages

### 5.1. Dashboard Overview (`/`)

**Mục tiêu:** Một cái nhìn toàn cảnh, 30 giây là hiểu hết.

**Layout:**

```text
┌─────────────────────────────────────────────────────────────┐
│  TopBar — "Smart Recycling Robot · BK_BIN_01"   [status●]  │
├──────┬──────────────────────────────────────────────────────┤
│      │  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────────┐  │
│      │  │ Total  │ │Plastic │ │  Can   │ │  Confidence  │  │
│ Side │  │Events  │ │Bottles │ │        │ │     Avg      │  │
│ bar  │  └────────┘ └────────┘ └────────┘ └──────────────┘  │
│      │                                                       │
│      │  ┌─────────────────────┐  ┌────────────────────────┐ │
│      │  │  Waste Type Chart   │  │   Latest Detection     │ │
│      │  │  (Bar chart)        │  │   Card                 │ │
│      │  └─────────────────────┘  └────────────────────────┘ │
│      │                                                       │
│      │  ┌─────────────────────────────────────────────────┐ │
│      │  │         Timeline Chart (last 24h)               │ │
│      │  └─────────────────────────────────────────────────┘ │
└──────┴──────────────────────────────────────────────────────┘
```

**Components sử dụng:**

| Component | Data source | Refresh |
|---|---|---|
| `StatCard` × 4 | `GET /api/stats/summary` | 5s |
| `WasteTypeChart` | `GET /api/stats/summary` | 5s |
| `LatestEvent` | `GET /api/detections/latest` | 3s |
| `TimelineChart` | `GET /api/detections` (aggregated) | 10s |

---

### 5.2. Detection History (`/history`)

**Mục tiêu:** Xem lại toàn bộ lịch sử phân loại, có thể lọc.

**Layout:**

```text
┌─────────────────────────────────────────────────────────────┐
│  TopBar                                                     │
├──────┬──────────────────────────────────────────────────────┤
│      │  ┌──────────────────────────────────────────────┐    │
│ Side │  │  Filters: [Type ▼] [Date range] [Status ▼]  │    │
│ bar  │  └──────────────────────────────────────────────┘    │
│      │                                                       │
│      │  ┌──────────────────────────────────────────────┐    │
│      │  │  Time    │ Type     │ Confidence│ Bin │Status │    │
│      │  │──────────┼──────────┼───────────┼─────┼───────│    │
│      │  │ 11:30:00 │ plastic  │ 0.91      │ 1   │  ✓   │    │
│      │  │ 11:28:12 │ aluminum │ 0.87      │ 2   │  ✓   │    │
│      │  │  ...     │  ...     │  ...      │ ... │ ...   │    │
│      │  └──────────────────────────────────────────────┘    │
│      │  [ Load more ]                                        │
└──────┴──────────────────────────────────────────────────────┘
```

**Filter state** (managed locally trong component):

```javascript
const [filters, setFilters] = useState({
  detectedType: '',   // 'plastic_bottle' | 'aluminum_can' | ...
  sortingStatus: '',  // 'success' | 'failed' | 'unknown'
  startDate: '',
  endDate: '',
});
```

Filter được gửi như query params đến `GET /api/detections`.

**Pagination:** Dùng `limit` + `offset`, hoặc `cursor` nếu backend hỗ trợ.

---

### 5.3. Machine Status (`/machine`)

**Mục tiêu:** Biết robot có đang online không, đang làm gì.

**Layout:**

```text
┌─────────────────────────────────────────────────────────────┐
│  TopBar                                                     │
├──────┬──────────────────────────────────────────────────────┤
│      │  ┌──────────────────────────────┐  ┌─────────────┐  │
│ Side │  │   Machine Info               │  │   Status    │  │
│ bar  │  │   ID: BK_BIN_01              │  │   ● ONLINE  │  │
│      │  │   Model: Jetson Nano B01     │  │   IDLE      │  │
│      │  │   Controller: ESP32-S3       │  └─────────────┘  │
│      │  └──────────────────────────────┘                   │
│      │                                                       │
│      │  ┌──────────────────────────────────────────────┐    │
│      │  │  Last heartbeat: 2026-05-27 11:31:00         │    │
│      │  │  Last event ID: BK_BIN_01-20260527-000001    │    │
│      │  │  Last seen: 2 seconds ago                    │    │
│      │  └──────────────────────────────────────────────┘    │
│      │                                                       │
│      │  ┌──────────────────────────────────────────────┐    │
│      │  │  Recent heartbeat log (last 10)              │    │
│      │  │  (table of state changes)                    │    │
│      │  └──────────────────────────────────────────────┘    │
└──────┴──────────────────────────────────────────────────────┘
```

**Online/Offline logic:**

```javascript
// Machine được coi là ONLINE nếu lastSeenAt < 30 giây trước
const isOnline = (lastSeenAt) => {
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  return diff < 30_000;
};
```

---

## 6. Component Design

### 6.1. StatCard

```jsx
// src/components/cards/StatCard.jsx
export function StatCard({ label, value, unit, color }) {
  return (
    <div className={`rounded-xl border p-5 shadow-sm bg-white`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>
        {value ?? '—'}
        {unit && <span className="text-sm font-normal ml-1">{unit}</span>}
      </p>
    </div>
  );
}
```

Dùng:

```jsx
<StatCard label="Total Detections" value={summary.total} color="text-blue-600" />
<StatCard label="Plastic Bottles"  value={summary.byType.plastic_bottle} color="text-green-600" />
<StatCard label="Avg Confidence"   value={(summary.avgConfidence * 100).toFixed(1)} unit="%" color="text-purple-600" />
```

---

### 6.2. WasteTypeChart (Recharts)

```jsx
// src/components/charts/WasteTypeChart.jsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function WasteTypeChart({ data }) {
  // data: [{ type: 'plastic_bottle', count: 42 }, ...]
  const chartData = data.map((d) => ({
    name: formatWasteType(d.type),
    count: d.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

---

### 6.3. DetectionTable

```jsx
// src/components/table/DetectionTable.jsx
const STATUS_STYLE = {
  success: 'bg-green-100 text-green-700',
  failed:  'bg-red-100 text-red-700',
  unknown: 'bg-gray-100 text-gray-600',
};

export function DetectionTable({ detections, loading }) {
  if (loading) return <TableSkeleton />;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left border-b text-gray-500">
          <th className="py-2 pr-4">Time</th>
          <th className="py-2 pr-4">Type</th>
          <th className="py-2 pr-4 text-right">Confidence</th>
          <th className="py-2 pr-4">Bin</th>
          <th className="py-2">Status</th>
        </tr>
      </thead>
      <tbody>
        {detections.map((d) => (
          <tr key={d.eventId} className="border-b last:border-0 hover:bg-gray-50">
            <td className="py-2 pr-4 text-gray-500">{formatTime(d.createdAt)}</td>
            <td className="py-2 pr-4">{formatWasteType(d.detectedType)}</td>
            <td className="py-2 pr-4 text-right font-mono">
              {(d.confidence * 100).toFixed(1)}%
            </td>
            <td className="py-2 pr-4">{d.targetBin}</td>
            <td className="py-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[d.sortingStatus]}`}>
                {d.sortingStatus}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

### 6.4. MachineStatusBadge

```jsx
// src/components/cards/MachineStatusBadge.jsx
const STATE_COLOR = {
  IDLE:    'bg-blue-100 text-blue-700',
  SORTING: 'bg-yellow-100 text-yellow-700',
  SYNCING: 'bg-purple-100 text-purple-700',
  ERROR:   'bg-red-100 text-red-700',
};

export function MachineStatusBadge({ state, lastSeenAt }) {
  const online = isOnline(lastSeenAt);

  return (
    <div className="flex items-center gap-3">
      <span className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-green-500' : 'bg-gray-400'}`} />
      <span className="text-sm font-medium">{online ? 'Online' : 'Offline'}</span>
      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATE_COLOR[state] ?? STATE_COLOR.IDLE}`}>
        {state}
      </span>
    </div>
  );
}
```

---

## 7. Utility functions

### 7.1. formatters.js

```javascript
// src/utils/formatters.js

export const formatTime = (iso) =>
  new Date(iso).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

export const formatTimeAgo = (iso) => {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)   return `${diff} seconds ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  return `${Math.floor(diff / 3600)} hours ago`;
};

export const formatWasteType = (type) => ({
  plastic_bottle: 'Plastic Bottle',
  aluminum_can:   'Aluminum Can',
  paper_carton:   'Paper Carton',
  unknown_object: 'Unknown',
}[type] ?? type);

export const isOnline = (lastSeenAt) =>
  Date.now() - new Date(lastSeenAt).getTime() < 30_000;
```

### 7.2. constants.js

```javascript
// src/utils/constants.js
export const MACHINE_ID = import.meta.env.VITE_MACHINE_ID || 'BK_BIN_01';

export const WASTE_TYPES = ['plastic_bottle', 'aluminum_can', 'paper_carton', 'unknown_object'];

export const BINS = ['bin_1', 'bin_2', 'bin_3', 'unknown_bin'];

export const SORTING_STATUSES = ['success', 'failed', 'unknown'];

export const POLL_INTERVALS = {
  summary:  5000,
  latest:   3000,
  machine:  5000,
  history:  10000,
};
```

---

## 8. App routing

```jsx
// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar }   from './components/layout/TopBar';
import Dashboard from './pages/Dashboard';
import History   from './pages/History';
import Machine   from './pages/Machine';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="flex h-screen bg-gray-50">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <TopBar />
            <main className="flex-1 overflow-y-auto p-6">
              <Routes>
                <Route path="/"        element={<Dashboard />} />
                <Route path="/history" element={<History />} />
                <Route path="/machine" element={<Machine />} />
                <Route path="*"        element={<Navigate to="/" />} />
              </Routes>
            </main>
          </div>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

---

## 9. Data flow diagram

```text
App mount
  │
  ├── Dashboard.jsx
  │     ├── useSummary()          → GET /api/stats/summary         (poll 5s)
  │     ├── useLatestEvent()      → GET /api/detections/latest      (poll 3s)
  │     └── useDetections({ limit: 50 })  → GET /api/detections    (poll 10s)
  │
  ├── History.jsx
  │     └── useDetections(filters)        → GET /api/detections?...  (manual refetch)
  │
  └── Machine.jsx
        └── useMachine()          → GET /api/machines/BK_BIN_01    (poll 5s)
```

---

## 10. Error và Loading states

Mỗi hook trả về `{ data, isLoading, isError, error }` từ TanStack Query.

Pattern chuẩn trong mỗi page:

```jsx
const { data: summary, isLoading, isError } = useSummary();

if (isLoading) return <LoadingSpinner />;
if (isError)   return <ErrorBanner message="Không thể kết nối backend" />;
```

**Skeleton loader cho table:**

```jsx
function TableSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="h-8 bg-gray-200 rounded" />
      ))}
    </div>
  );
}
```

**ErrorBanner:**

```jsx
function ErrorBanner({ message }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
      ⚠️ {message} — Đang thử lại...
    </div>
  );
}
```

---

## 11. Environment config

`.env.example`:

```dotenv
VITE_API_BASE_URL=http://localhost:3001
VITE_MACHINE_ID=BK_BIN_01
```

Cho demo trên cùng máy, backend và dashboard chạy song song:

```bash
# Terminal 1 — backend
cd backend && npm run dev     # port 3001

# Terminal 2 — dashboard
cd dashboard && npm run dev   # port 5173
```

Vite đã có proxy config để tránh CORS:

```javascript
// vite.config.js
export default {
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
};
```

---

## 12. Dependencies

```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "react-router-dom": "^6",
    "@tanstack/react-query": "^5",
    "axios": "^1",
    "recharts": "^2",
    "clsx": "^2"
  },
  "devDependencies": {
    "vite": "^5",
    "@vitejs/plugin-react": "^4",
    "tailwindcss": "^3",
    "autoprefixer": "^10",
    "postcss": "^8"
  }
}
```

---

## 13. Build order cho dashboard

```text
1.  npm create vite@latest dashboard -- --template react
2.  Cài dependencies (tanstack-query, axios, recharts, tailwind)
3.  Tạo src/utils/constants.js và formatters.js
4.  Tạo src/api/client.js — test các API function với console.log
5.  Tạo src/hooks/ — test từng hook riêng lẻ
6.  Build StatCard component và test với data giả
7.  Build DetectionTable component
8.  Build MachineStatusBadge
9.  Build WasteTypeChart với Recharts
10. Ghép vào Dashboard.jsx — test với backend thật
11. Build History.jsx với filters
12. Build Machine.jsx
13. Ghép Sidebar + TopBar + routing
14. Kiểm tra polling — quan sát network tab
15. Test khi backend offline — đảm bảo ErrorBanner hiện đúng
16. Demo run: mở dashboard, bật Jetson gửi event, xem live update
```

---

## 14. Demo checklist

Trước khi demo, kiểm tra:

- [ ] Backend đang chạy và MongoDB Atlas đã kết nối.
- [ ] Ít nhất 10–20 detection event đã có trong database.
- [ ] Dashboard load được `/` không có lỗi console.
- [ ] StatCards hiển thị số thật (không phải `—` hoặc `0`).
- [ ] Chart hiển thị ít nhất 2 loại rác khác nhau.
- [ ] Machine status hiện đúng `ONLINE` nếu Jetson đang gửi heartbeat.
- [ ] History page có thể lọc theo type và hiện kết quả đúng.
- [ ] Disconnect Wi-Fi / tắt backend: ErrorBanner hiện thay vì crash.
- [ ] Reconnect: dashboard tự recover và hiển thị lại dữ liệu.
```

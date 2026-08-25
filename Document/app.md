# GreenPoint App — Comprehensive Documentation

> **Last updated:** 2026-08-25
> **Codebase paths:** `GreenPoint-Backend/` · `FRONTEND_GREENPOINT/`
> **Platform:** React Native (Expo) · Express 4 · MongoDB Atlas

---

## 1. Product Overview

The **GreenPoint App** is a full-stack recycling rewards platform built for university campuses. Students and staff earn points by recycling plastic bottles and aluminum cans through AI-powered smart bins, then redeem points for vouchers from campus partners (parking, canteens, retailers).

| Layer | Directory | Stack | Port |
|---|---|---|---|
| Backend | `GreenPoint-Backend/` | Express 4 · TypeScript · MongoDB (Mongoose 8) · Zod | 4000 |
| Frontend | `FRONTEND_GREENPOINT/` | React Native (Expo) · TypeScript · Zustand · Axios · expo-router | Mobile App |

---

## 2. System Architecture

```
BKI/
├── GreenPoint-Backend/          # Express + TypeScript API server (Port 4000)
│   ├── .env
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── app.ts               # Express app: middleware, routes, health check
│       ├── server.ts            # Bootstrap: connects DB, starts HTTP server
│       ├── config/
│       │   ├── constants.ts     # Point rules, token expiry, default university
│       │   ├── db.ts            # Mongoose connection
│       │   └── env.ts           # Zod-validated environment variables
│       ├── middleware/
│       │   ├── auth.middleware.ts        # JWT Bearer token verification
│       │   ├── error.middleware.ts       # Global error handler (Zod + HttpError + generic)
│       │   ├── notFound.middleware.ts    # 404 catch-all
│       │   ├── role.middleware.ts        # Role-based access control
│       │   └── validate.middleware.ts   # Zod schema validation
│       ├── modules/             # 13 feature modules
│       │   ├── admin/           # Admin CRUD, stats, audit logs
│       │   ├── auth/            # Register, login, OTP, logout
│       │   ├── campaigns/       # Bonus multiplier campaigns
│       │   ├── contributions/   # Machine sessions + QR claim flow
│       │   ├── leaderboard/     # User & faculty rankings
│       │   ├── machines/        # Machine CRUD + heartbeat
│       │   ├── milestones/      # Achievement system
│       │   ├── operator/        # Voucher validation & usage
│       │   ├── partners/        # Campus partners catalog
│       │   ├── points/          # Point ledger
│       │   ├── rewards/         # Reward catalog & redemption
│       │   ├── users/           # User profiles & stats
│       │   └── vouchers/        # User wallet
│       ├── seeds/               # Dev data seeders
│       ├── types/
│       │   ├── common.types.ts  # AuthUser, ApiResponse<T>
│       │   ├── enums.ts         # UserRole, PointTransactionType, ItemType
│       │   └── express.d.ts     # Express Request augmentation (req.user)
│       └── utils/
│           ├── claimToken.ts    # JWT claim token sign + verify (shared secret)
│           ├── dateRange.ts     # Period → date range helper
│           ├── generateCode.ts  # nanoid-based code generators
│           ├── hash.ts          # bcrypt & SHA-256 hashing
│           ├── httpError.ts     # HttpError class
│           ├── pointRules.ts    # Point calculation per item type
│           ├── qrToken.ts       # Voucher QR token generation
│           └── token.ts         # JWT access/refresh token utilities
└── FRONTEND_GREENPOINT/         # Student mobile app (Expo)
    ├── app.json                 # Expo config
    ├── babel.config.js
    ├── index.ts                 # Expo entry point
    ├── package.json
    ├── tsconfig.json
    ├── pages/                   # Expo Router file-based routes
    │   ├── (auth)/
    │   │   ├── forgot-password.tsx
    │   │   ├── otp-verify.tsx
    │   │   ├── password-changed.tsx
    │   │   └── reset-password.tsx
    │   ├── history.tsx
    │   ├── impact.tsx
    │   └── rewards/
    │       └── voucher-claim.tsx
    └── src/
        ├── components/
        │   ├── common/          # NotificationProvider, shared UI
        │   ├── home/            # PointsBanner, RewardListItem, ScanQRBanner, StatCard
        │   ├── icons/           # AvatarIcon, BottleIcon, CalendarIcon, EarthIcon, PaperIcon
        │   ├── map/             # CollectionPointRow
        │   ├── navigation/      # BottomTabBar, WaveHeader
        │   ├── profile/         # HistoryRow, RankingCard
        │   └── rewards/         # DonutChart, RewardCard, TaskProgressRow
        ├── hooks/               # Data fetching hooks
        ├── services/            # Axios API clients
        ├── store/               # Zustand stores (authStore, notificationStore)
        ├── theme/               # colors.ts
        ├── types/               # TypeScript type definitions
        └── utils/               # Helper utilities
```

---

## 3. Database Schemas (Mongoose)

### 3.1 User

```
Collection: users
Fields:
  phoneNumber          String   required, unique, indexed
  passwordHash         String   select: false
  authMethods          [String] enum: ["password", "sms_otp"]
  displayName          String   required, default: "Green User"
  avatarUrl            String
  role                 String   enum: ["user", "operator", "admin", "partner_admin"], default: "user"
  university           String   default: "DHBK"
  faculty              String   indexed
  className            String
  studentId            String   sparse indexed
  totalPoints          Number   default: 0
  lifetimeEarnedPoints      Number   default: 0
  lifetimeRedeemedPoints    Number   default: 0
  totalBottles         Number   default: 0
  totalCans            Number   default: 0
  totalItems           Number   default: 0
  currentStreak        Number   default: 0
  longestStreak        Number   default: 0
  lastContributionAt   Date
  level                String   default: "Beginner Recycler"
  membershipTier       String   enum: ["green_member", "silver", "gold", "platinum"]
  status               String   enum: ["active", "inactive", "banned", "deleted"]
  isPhoneVerified      Boolean  default: false
  notificationSettings {
    rewardUpdates      Boolean  default: true
    campaignUpdates    Boolean  default: true
    milestoneUpdates   Boolean  default: true
  }
  lastLoginAt          Date
  timestamps           { createdAt, updatedAt }
```

### 3.2 OTP

```
Collection: otps
Fields:
  phoneNumber  String   required, indexed
  otpHash      String   required
  purpose      String   enum: ["login", "register", "reset_password"]
  expiresAt    Date     required, indexed
  consumedAt   Date
  attempts     Number   default: 0
  status       String   enum: ["active", "used", "expired"], default: "active"
  timestamps   { createdAt, updatedAt }
```

### 3.3 Machine

```
Collection: machines
Fields:
  machineCode    String   required, unique, indexed
  name           String
  locationName   String   required
  locationType   String   enum: ["canteen", "parking", "library", "classroom_area", "other"]
  apiKeyHash     String   required, select: false
  status         String   enum: ["online", "offline", "maintenance", "disabled"]
  lastSeenAt     Date
  totalSessions  Number   default: 0
  timestamps     { createdAt, updatedAt }
```

### 3.4 ContributionSession

```
Collection: contributionsessions
Fields:
  sessionCode     String    required, unique, indexed
  machineId       ObjectId  ref: Machine, required, indexed
  items           [{
    itemType      String    enum: ["plastic_bottle", "can"], required
    quantity      Number    required, min: 1
    pointsPerItem Number    required
  }]
  totalPoints     Number    required, min: 0
  claimTokenHash  String    required, indexed
  status          String    enum: ["unclaimed", "claimed", "expired", "cancelled"]
  claimedBy       ObjectId  ref: User
  claimedAt       Date
  expiresAt       Date      required, indexed
  timestamps      { createdAt, updatedAt }
```

> **Note:** The claim token stored here is the HMAC-SHA256 hash of the JWT, not the JWT itself. This allows the backend to look up the session from a scanned token without storing raw secrets.

### 3.5 PointTransaction

```
Collection: pointtransactions
Fields:
  userId                 ObjectId  ref: User, required, indexed
  type                   String    enum: ["earn", "redeem", "refund", "bonus", "adjustment"]
  points                 Number    required
  source                 String    enum: ["qr_claim", "reward_redeem", "campaign_bonus", "admin_adjustment", "refund"]
  description            String
  contributionSessionId  ObjectId  ref: ContributionSession
  rewardId               ObjectId  ref: Reward
  balanceAfter           Number    required
  timestamps             { createdAt, updatedAt }
```

### 3.6 Partner

```
Collection: partners
Fields:
  name         String  required
  type         String  enum: ["university", "brand", "retailer", "canteen", "parking"]
  logoUrl      String
  description  String
  status       String  enum: ["active", "inactive"], default: "active"
  timestamps   { createdAt, updatedAt }
```

### 3.7 Reward

```
Collection: rewards
Fields:
  partnerId          ObjectId  ref: Partner, required, indexed
  name               String    required
  description        String
  rewardType         String    enum: ["parking_ticket", "meal_voucher", "promo_code", "free_item", "discount"]
  pointsRequired     Number    required, min: 0
  valueVnd           Number    min: 0
  quantityTotal      Number
  quantityRemaining  Number
  validFrom          Date
  validUntil         Date
  terms              [String]  default: []
  status             String    enum: ["active", "inactive", "expired"]
  timestamps         { createdAt, updatedAt }
```

### 3.8 UserVoucher

```
Collection: uservouchers
Fields:
  userId          ObjectId  ref: User, required, indexed
  rewardId        ObjectId  ref: Reward, required, indexed
  partnerId       ObjectId  ref: Partner, required, indexed
  redeemCode      String    required, unique, indexed
  qrTokenHash     String    required
  pointsUsed      Number    required
  status          String    enum: ["unused", "used", "expired", "cancelled"]
  issuedAt        Date      default: now
  usedAt          Date
  expiresAt       Date      required, indexed
  usedLocation    String
  usedByOperator  ObjectId  ref: User
  timestamps      { createdAt, updatedAt }
```

### 3.9 Milestone

```
Collection: milestones
Fields:
  code           String  required, unique
  name           String  required
  description    String
  conditionType  String  enum: ["total_items", "total_bottles", "total_cans", "streak", "monthly_points"]
  targetValue    Number  required
  rewardPoints   Number  default: 0
  badgeIcon      String
  status         String  enum: ["active", "inactive"]
  timestamps     { createdAt, updatedAt }
```

### 3.10 UserMilestone

```
Collection: usermilestones
Fields:
  userId       ObjectId  ref: User, required, indexed
  milestoneId  ObjectId  ref: Milestone, required
  achievedAt   Date      default: now
  timestamps   { createdAt, updatedAt }
Compound unique index: { userId, milestoneId }
```

### 3.11 Campaign

```
Collection: campaigns
Fields:
  code             String  required, unique
  name             String  required
  description      String
  startsAt         Date    required
  endsAt           Date    required
  bonusMultiplier  Number  default: 1
  status           String  enum: ["active", "inactive", "ended"]
  timestamps       { createdAt, updatedAt }
```

### 3.12 AuditLog

```
Collection: auditlogs
Fields:
  actorId     ObjectId  ref: User
  action      String    required, indexed
  entityType  String
  entityId    String
  metadata    Mixed
  timestamps  { createdAt, updatedAt }
```

---

## 4. Authentication & Authorization

| Mechanism | Details |
|---|---|
| **Token type** | JWT Bearer in `Authorization` header |
| **Access token TTL** | 15 minutes (configurable) |
| **Refresh token TTL** | 7 days (configurable) |
| **Password hashing** | bcryptjs with configurable salt rounds |
| **OTP** | 6-digit numeric, bcrypt-hashed, expires in 5 min |
| **Machine API key** | bcrypt-hashed, passed via `x-machine-api-key` header |
| **Claim token** | HMAC-signed JWT, shared secret between Jetson and backend |
| **Roles** | `user`, `operator`, `admin`, `partner_admin` |

---

## 5. QR Claim Token System

This is the core linking mechanism between the physical recycling machine and the user's app account.

### How It Works

```
[Jetson Nano — After sort complete]
    1. Generate UUID v4 as contributionId
    2. Sign JWT locally with CLAIM_TOKEN_SECRET (shared env var)
       Payload: { contributionId, machineId, material, type: "CLAIM", iat, exp }
    3. Display JWT as QR code on LCD immediately (~1ms — no network wait)
    4. Background POST to /api/contributions (non-blocking thread)

[User — Scans QR with mobile app]
    5. App sends raw JWT to POST /api/contributions/claim (Bearer auth)
    6. Backend verifies JWT signature (free, no DB hit)
    7. Backend polls DB for up to 3s for background POST to land
    8. Atomic findOneAndUpdate where claimedBy = null (prevents race condition)
    9. Points credited → response returned to app
```

### Claim Token JWT Payload

```json
{
  "contributionId": "uuid-v4-string",
  "machineId": "BK_BIN_01",
  "material": "plastic_bottle",
  "type": "CLAIM",
  "iat": 1748342400,
  "exp": 1748343000
}
```

### Error States

| Scenario | HTTP Status | Message |
|---|---|---|
| Invalid signature | 400 | "QR code is invalid or expired" |
| Token expired | 400 | "QR code has expired" |
| Not found in DB yet | 404 | "Session not found — try again in a moment" (auto-retry) |
| Already claimed | 409 | "This QR code has already been claimed" |

---

## 6. API Reference

**Base URL:** `http://localhost:4000`

### 6.1 Health Check

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | None | Server health check |

**Response `200`:**
```json
{ "ok": true, "app": "GreenPoint API" }
```

---

### 6.2 Auth (`/api/auth`)

#### `POST /api/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "phoneNumber": "string (min 8)",
  "password": "string (min 6, optional)",
  "displayName": "string (default: 'Green User')",
  "role": "user | operator | admin | partner_admin (default: 'user')",
  "faculty": "string (optional)",
  "studentId": "string (optional)"
}
```

**Response `201`:**
```json
{
  "user": { /* User object without passwordHash */ },
  "accessToken": "JWT string",
  "refreshToken": "JWT string"
}
```

**Errors:** `409` Phone number already registered

---

#### `POST /api/auth/login`
Login with phone number and password.

**Request Body:**
```json
{
  "phoneNumber": "string (min 8)",
  "password": "string (min 1)"
}
```

**Response `200`:**
```json
{
  "user": { /* User object */ },
  "accessToken": "JWT string",
  "refreshToken": "JWT string"
}
```

**Errors:** `401` Invalid phone number or password

---

#### `POST /api/auth/request-otp`
Request an OTP sent to phone number.

**Request Body:**
```json
{
  "phoneNumber": "string (min 8)",
  "purpose": "login | register | reset_password (default: 'login')"
}
```

**Response `201`:**
```json
{
  "phoneNumber": "string",
  "expiresAt": "ISO date",
  "devOtp": "string (6-digit, dev environment only)"
}
```

---

#### `POST /api/auth/verify-otp`
Verify OTP code and receive auth tokens.

**Request Body:**
```json
{
  "phoneNumber": "string (min 8)",
  "otp": "string (4-8 chars)"
}
```

**Response `200`:**
```json
{
  "user": { /* User object */ },
  "accessToken": "JWT string",
  "refreshToken": "JWT string"
}
```

**Errors:** `401` OTP invalid or expired

---

#### `POST /api/auth/logout`
| Auth | Roles |
|---|---|
| Bearer | Any |

**Response `204`:** No content

---

#### `GET /api/auth/me`
Get current authenticated user profile.

| Auth | Roles |
|---|---|
| Bearer | Any |

**Response `200`:** Full User object

---

### 6.3 Users (`/api/users`)

> All routes require Bearer authentication.

#### `GET /api/users/me`
Get own user profile.

#### `PATCH /api/users/me`
Update own profile.

**Request Body:**
```json
{
  "displayName": "string (optional)",
  "avatarUrl": "URL string (optional)",
  "faculty": "string (optional)",
  "className": "string (optional)",
  "studentId": "string (optional)",
  "notificationSettings": {
    "rewardUpdates": "boolean (optional)",
    "campaignUpdates": "boolean (optional)",
    "milestoneUpdates": "boolean (optional)"
  }
}
```

#### `GET /api/users/me/summary`
Dashboard summary: user profile + recent transactions + impact stats.

#### `GET /api/users/me/history`
Full point transaction history (sorted newest first).

#### `GET /api/users/me/impact`
Environmental impact stats.

**Response `200`:**
```json
{
  "month": { "bottles": 0, "cans": 0, "points": 0 },
  "allTime": { "bottles": 0, "cans": 0, "items": 0, "points": 0 },
  "co2KgEstimate": 0.0
}
```

#### `GET /api/users/me/milestones`
User milestone achievement records with milestone details.

---

### 6.4 Machines (`/api/machines`)

> All routes require Bearer authentication + admin role (except heartbeat which allows operator too).

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/machines` | admin | List all machines |
| GET | `/api/machines/:machineId` | admin | Get machine by ID |
| POST | `/api/machines` | admin | Create a new machine |
| PATCH | `/api/machines/:machineId` | admin | Update machine properties |
| POST | `/api/machines/:machineId/heartbeat` | admin, operator | Machine heartbeat (status → online, lastSeenAt → now) |

**Create Machine Request Body:**
```json
{
  "machineCode": "string (optional, auto-generated)",
  "name": "string (optional)",
  "locationName": "string (required)",
  "locationType": "canteen | parking | library | classroom_area | other",
  "apiKey": "string (min 8)"
}
```

---

### 6.5 Contributions (`/api/contributions`)

#### `POST /api/contributions`
Create a contribution session from a recycling machine.

| Auth | Description |
|---|---|
| `x-machine-api-key` header | Machine creates session after sorting items |

**Request Body:**
```json
{
  "machineCode": "string",
  "items": [
    { "itemType": "plastic_bottle | can", "quantity": 1 }
  ]
}
```

**Response `201`:**
```json
{
  "session": { /* ContributionSession object */ },
  "claimToken": "GP-CLAIM-XXXXXXXXXXXX",
  "expiresAt": "ISO date"
}
```

---

#### `POST /api/contributions/claim`
User claims a contribution session by scanning the QR code.

| Auth | Roles |
|---|---|
| Bearer | Any |

**Request Body:**
```json
{
  "claimToken": "JWT string from QR code"
}
```

**Response `200`:**
```json
{
  "session": { /* Updated ContributionSession */ },
  "transaction": { /* PointTransaction (type: earn) */ },
  "milestones": [ /* Newly achieved milestones (may be empty) */ ],
  "pointsEarned": 20,
  "totalBalance": 150
}
```

**Errors:** `400` Invalid/expired token · `404` Not found (retry) · `409` Already claimed

---

#### `GET /api/contributions`
| Auth | Roles |
|---|---|
| Bearer | admin |

List all contributions (limit 100, populated with machine and user data).

---

#### `GET /api/contributions/:sessionId`
| Auth | Roles |
|---|---|
| Bearer | Any |

Get a specific contribution session.

---

### 6.6 Points (`/api/points`)

#### `GET /api/points/me`
| Auth | Roles |
|---|---|
| Bearer | Any |

**Response `200`:**
```json
{
  "totalPoints": 150,
  "lifetimeEarnedPoints": 200,
  "lifetimeRedeemedPoints": 50
}
```

#### `GET /api/points/me/transactions`
| Auth | Roles |
|---|---|
| Bearer | Any |

Full point ledger for authenticated user.

---

### 6.7 Partners (`/api/partners`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/partners` | None | List active partners (sorted by name) |
| GET | `/api/partners/:partnerId` | None | Get partner details |

---

### 6.8 Rewards (`/api/rewards`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/rewards` | None | List active rewards with partner info (sorted by points required) |
| GET | `/api/rewards/:rewardId` | None | Get reward details with partner info |
| POST | `/api/rewards/:rewardId/redeem` | Bearer | Redeem reward — deducts points, creates voucher |

**Redeem Response `200`:**
```json
{
  "reward": { /* Reward */ },
  "transaction": { /* PointTransaction (type: redeem) */ },
  "voucher": { /* UserVoucher */ },
  "qrToken": "GP-VOUCHER-XXXXXXXXXXXX"
}
```

**Errors:** `402` Not enough points · `409` Out of stock / not active · `410` Expired

---

### 6.9 Wallet (`/api/wallet`)

> All routes require Bearer authentication.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/wallet` | List user's vouchers (populated with reward + partner) |
| GET | `/api/wallet/:voucherId` | Get voucher detail (must belong to authenticated user) |

---

### 6.10 Operator (`/api/operator`)

> All routes require Bearer + `operator` or `admin` role.

#### `POST /api/operator/vouchers/validate`
Validate a voucher for usability (status, expiry check).

**Request Body:**
```json
{
  "redeemCode": "string (optional)",
  "qrToken": "string (optional)"
}
```

**Response `200`:** Voucher object (populated with reward and partner)

**Errors:** `409` Already used · `410` Expired

---

#### `POST /api/operator/vouchers/use`
Mark a voucher as used.

**Request Body:**
```json
{
  "redeemCode": "string (optional)",
  "qrToken": "string (optional)",
  "usedLocation": "string (optional)"
}
```

**Response `200`:** Updated voucher object

---

#### `GET /api/operator/history`
| Roles |
|---|
| operator, admin |

List vouchers used by this operator (populated).

---

### 6.11 Admin (`/api/admin`)

> All routes require Bearer + `admin` role.

#### `GET /api/admin/overview`
Platform-wide dashboard statistics.

**Response `200`:**
```json
{
  "users": 150,
  "machines": 5,
  "partners": 8,
  "rewards": 20,
  "vouchersIssued": 300,
  "sessions": 500,
  "campaigns": 3,
  "pointTransactions": [ { "_id": "earn", "points": 5000, "count": 200 } ],
  "recentAuditLogs": [ /* Last 20 audit logs */ ]
}
```

#### Report Endpoints
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/reports/contributions` | List contributions (limit 500, populated) |
| GET | `/api/admin/reports/rewards` | List rewards (limit 500, populated) |
| GET | `/api/admin/reports/users` | List users (limit 500) |
| GET | `/api/admin/reports/partners` | List partners (limit 500) |

#### Partner Management
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/admin/partners` | Create partner |
| PATCH | `/api/admin/partners/:partnerId` | Update partner |
| DELETE | `/api/admin/partners/:partnerId` | Soft-delete (status → inactive) |

#### Reward Management
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/admin/rewards` | Create reward |
| PATCH | `/api/admin/rewards/:rewardId` | Update reward |
| DELETE | `/api/admin/rewards/:rewardId` | Soft-delete (status → inactive) |

#### Point Adjustment
**`POST /api/admin/users/:userId/points/adjust`**

**Request Body:**
```json
{
  "points": 50,
  "description": "Compensation for system error"
}
```

#### Milestone Management
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/admin/milestones` | Create milestone |
| PATCH | `/api/admin/milestones/:milestoneId` | Update milestone |

#### Campaign Management
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/admin/campaigns` | Create campaign |
| PATCH | `/api/admin/campaigns/:campaignId` | Update campaign |
| DELETE | `/api/admin/campaigns/:campaignId` | Soft-delete (status → inactive) |

---

### 6.12 Milestones (`/api/milestones`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/milestones` | None | List active milestones (sorted by target value) |
| GET | `/api/milestones/me` | Bearer | User milestone progress with current values vs targets |

**`GET /api/milestones/me` Response `200`:**
```json
[
  {
    "milestone": { /* Milestone object */ },
    "achieved": false,
    "currentValue": 15
  }
]
```

---

### 6.13 Leaderboard (`/api/leaderboard`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/leaderboard/users` | None | Top 50 users by earned points |
| GET | `/api/leaderboard/faculties` | None | Faculty ranking by total points and bottles |
| GET | `/api/leaderboard/campaigns/:campaignId` | None | Campaign-specific leaderboard |

**Query Params (users endpoint):**

| Param | Default | Values |
|---|---|---|
| period | month | week, month, year, all |

---

### 6.14 Campaigns (`/api/campaigns`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/campaigns` | None | List active campaigns (within date range) |
| GET | `/api/campaigns/:campaignId` | None | Get campaign by ID |

---

## 7. Key Business Workflows

### 7.1 Recycling → Points Flow

```
Machine sorts items
  → Jetson signs JWT locally (CLAIM_TOKEN_SECRET shared secret)
  → QR displayed on LCD immediately
  → Background POST /api/contributions (x-machine-api-key auth)
      → ContributionSession created in MongoDB
      → claimTokenHash stored (not the raw JWT)

User opens app → navigates to Scan tab
  → Scans QR code from bin LCD
  → App sends raw JWT to POST /api/contributions/claim (Bearer)
  → Backend verifies JWT signature (no DB hit)
  → Backend polls DB up to 3s for session to land
  → Atomic findOneAndUpdate (claimedBy = null condition — prevents double-claim)
  → Points credited → PointTransaction created → User counters updated
      → totalBottles / totalCans / totalItems incremented
  → Milestones auto-checked → bonus points if newly unlocked
  → Response: { pointsEarned, totalBalance, milestones }
```

### 7.2 Reward Redemption Flow

```
User browses GET /api/rewards
  → Sees reward catalog filtered by partner, type, points required

User redeems POST /api/rewards/:rewardId/redeem (Bearer)
  → Validates: enough points + reward active + in stock + not expired
  → PointTransaction created (type: "redeem")
  → User.totalPoints decremented
  → Reward.quantityRemaining decremented
  → UserVoucher created with unique redeemCode + qrTokenHash
  → Response: { reward, transaction, voucher, qrToken }

User presents voucher at partner
  → Operator opens app → Operator Portal
  → Scans voucher QR or enters redeemCode
  → POST /api/operator/vouchers/validate → confirms valid
  → POST /api/operator/vouchers/use → marks as "used"
  → AuditLog created for the operator action
```

### 7.3 Auth Flow

```
New user:
  POST /api/auth/register → account created → tokens returned

Returning user (password):
  POST /api/auth/login → tokens returned

Returning user (OTP):
  POST /api/auth/request-otp → OTP sent to phone
  POST /api/auth/verify-otp → tokens returned

Token expiry:
  Access token expires (15m) → use refresh token
  Refresh token expires (7d) → re-login required
```

---

## 8. Frontend Screens

| Screen | Route | Description |
|---|---|---|
| Login | `/login` | Phone + password login |
| OTP Verify | `/(auth)/otp-verify` | OTP code entry |
| Forgot Password | `/(auth)/forgot-password` | Phone entry for reset |
| Reset Password | `/(auth)/reset-password` | New password entry |
| Home | `/home` | Points summary, scan QR banner, active rewards, stat cards |
| Scan | `/scan` | Camera QR scanner for claiming contributions |
| Impact | `/impact` | Environmental impact: CO₂ saved, bottles/cans recycled |
| History | `/history` | Point transaction history |
| Rewards | `/rewards` | Browse and redeem rewards |
| Voucher Claim | `/rewards/voucher-claim` | Reward redemption confirmation |
| Wallet | `/wallet` | View redeemed vouchers |
| Profile | `/profile` | User profile settings, leaderboard rank, milestones |
| Operator | `/operator` | Voucher validation portal for operators |
| Admin | `/admin` | Platform-wide stats overview for admins |

---

## 9. Environment Variables (Backend)

| Variable | Type | Default | Description |
|---|---|---|---|
| `NODE_ENV` | string | development | Runtime environment |
| `PORT` | number | 4000 | HTTP server port |
| `MONGODB_URI` | string | *required* | MongoDB connection string |
| `JWT_ACCESS_SECRET` | string | *required (min 12)* | Access token signing secret |
| `JWT_REFRESH_SECRET` | string | *required (min 12)* | Refresh token signing secret |
| `JWT_ACCESS_EXPIRES_IN` | string | 15m | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | string | 7d | Refresh token TTL |
| `BCRYPT_SALT_ROUNDS` | number | 10 | bcrypt cost factor |
| `CLAIM_TOKEN_SECRET` | string | *required (min 32)* | Shared HMAC secret with Jetson Nano |
| `CLAIM_TOKEN_EXPIRY` | number | 600 | QR claim token TTL in seconds (10 min) |
| `OTP_EXPIRES_MINUTES` | number | 5 | OTP TTL |
| `FRONTEND_ORIGIN` | string | http://localhost:5173 | CORS allowed origin |

---

## 10. Technology Dependencies

### Backend
| Package | Version | Purpose |
|---|---|---|
| express | 4.x | HTTP framework |
| mongoose | 8.x | MongoDB ODM |
| zod | 3.x | Schema validation |
| jsonwebtoken | 9.x | JWT signing and verification |
| bcryptjs | 2.x | Password, OTP, API key hashing |
| nanoid | 3.x | Unique code generation |
| helmet | 7.x | Security headers |
| cors | 2.x | Cross-origin resource sharing |
| morgan | 1.x | HTTP request logging |
| dotenv | 16.x | Environment variable loading |
| express-async-errors | 3.x | Async error propagation |
| tsx | 4.x | Dev-time TypeScript runner |

### Frontend (React Native / Expo)
| Package | Version | Purpose |
|---|---|---|
| expo | ~55.x | Mobile app framework |
| expo-router | ~55.x | File-based routing |
| expo-camera | ~55.x | QR code scanning |
| expo-linear-gradient | ~55.x | Gradient UI elements |
| react-native | ~0.83.x | Core mobile framework |
| zustand | ^5.x | State management |
| axios | ^1.x | HTTP client |
| @tanstack/react-query | ^5.x | Data fetching and caching |
| react-native-maps | ^1.x | Campus map for machine locations |
| react-hook-form | ^7.x | Form management |
| yup | ^1.x | Form validation |
| react-native-reanimated | ^4.x | Animations |
| react-native-gesture-handler | ~2.x | Touch gestures |

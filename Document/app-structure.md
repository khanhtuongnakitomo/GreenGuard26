# GreenPoint App — Architecture Documentation

> **Last updated:** 2026-06-17  
> **Codebase path:** `app/`

---

## 1. Overview

The **GreenPoint App** is a full-stack recycling rewards platform built for university campuses. Users earn points by recycling plastic bottles and aluminum cans through smart recycling machines, then redeem points for vouchers from campus partners (parking, canteens, retailers).

| Layer    | Stack                                          | Port  |
| -------- | ---------------------------------------------- | ----- |
| Backend  | Express 4 · TypeScript · MongoDB (Mongoose 8)  | 4000  |
| Frontend | React 18 · Vite · TypeScript · Zustand · Axios | 5173  |

---

## 2. File Structure

```
app/
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── app.ts                        # Express app setup, middleware, route mounting
│       ├── server.ts                     # Bootstrap: connects DB, starts HTTP server
│       ├── config/
│       │   ├── constants.ts              # Point rules, token expiry, default university
│       │   ├── db.ts                     # Mongoose connection
│       │   └── env.ts                    # Zod-validated environment variables
│       ├── middleware/
│       │   ├── auth.middleware.ts         # JWT Bearer token verification
│       │   ├── error.middleware.ts        # Global error handler (Zod + HttpError + generic)
│       │   ├── notFound.middleware.ts     # 404 catch-all
│       │   ├── role.middleware.ts         # Role-based access control
│       │   └── validate.middleware.ts     # Zod schema validation (body/params/query)
│       ├── modules/
│       │   ├── admin/
│       │   │   ├── admin.controller.ts   # Admin dashboard & CRUD handlers
│       │   │   ├── admin.routes.ts       # Admin route definitions (all admin-only)
│       │   │   ├── admin.service.ts      # Overview stats, reports
│       │   │   ├── admin.validation.ts   # Re-exports schemas from other modules
│       │   │   └── auditLog.model.ts     # AuditLog Mongoose schema
│       │   ├── auth/
│       │   │   ├── auth.controller.ts    # Register, login, OTP, logout, me
│       │   │   ├── auth.routes.ts        # Public + protected auth routes
│       │   │   ├── auth.service.ts       # Password & OTP authentication logic
│       │   │   ├── auth.validation.ts    # Zod schemas for auth endpoints
│       │   │   └── otp.model.ts          # OTP Mongoose schema
│       │   ├── campaigns/
│       │   │   ├── campaign.controller.ts
│       │   │   ├── campaign.model.ts     # Campaign Mongoose schema
│       │   │   ├── campaign.routes.ts    # Public campaign listing
│       │   │   ├── campaign.service.ts
│       │   │   └── campaign.validation.ts
│       │   ├── contributions/
│       │   │   ├── contribution.controller.ts
│       │   │   ├── contribution.model.ts # ContributionSession + ContributionItem schemas
│       │   │   ├── contribution.routes.ts
│       │   │   ├── contribution.service.ts # Session creation from machine, user claim flow
│       │   │   └── contribution.validation.ts
│       │   ├── leaderboard/
│       │   │   ├── leaderboard.controller.ts
│       │   │   ├── leaderboard.routes.ts  # Public leaderboard endpoints
│       │   │   ├── leaderboard.service.ts # User & faculty rankings via aggregation
│       │   │   └── leaderboard.validation.ts
│       │   ├── machines/
│       │   │   ├── machine.controller.ts
│       │   │   ├── machine.model.ts      # Machine Mongoose schema
│       │   │   ├── machine.routes.ts     # Admin-only machine CRUD + heartbeat
│       │   │   ├── machine.service.ts
│       │   │   └── machine.validation.ts
│       │   ├── milestones/
│       │   │   ├── milestone.controller.ts
│       │   │   ├── milestone.model.ts    # Milestone definition schema
│       │   │   ├── milestone.routes.ts   # Public milestone listing + user progress
│       │   │   ├── milestone.service.ts  # Progress tracking, auto-grant after contribution
│       │   │   ├── milestone.validation.ts
│       │   │   └── userMilestone.model.ts # User↔Milestone achievement junction
│       │   ├── operator/
│       │   │   ├── operator.controller.ts
│       │   │   ├── operator.routes.ts    # Operator voucher validation & usage
│       │   │   ├── operator.service.ts
│       │   │   └── operator.validation.ts # Re-exports from voucher validation
│       │   ├── partners/
│       │   │   ├── partner.controller.ts
│       │   │   ├── partner.model.ts      # Partner Mongoose schema
│       │   │   ├── partner.routes.ts     # Public partner listing
│       │   │   ├── partner.service.ts
│       │   │   └── partner.validation.ts
│       │   ├── points/
│       │   │   ├── point.controller.ts
│       │   │   ├── point.routes.ts       # User point balance & transaction history
│       │   │   ├── point.service.ts      # Point ledger management (earn/redeem/adjust)
│       │   │   ├── point.validation.ts
│       │   │   └── pointTransaction.model.ts # PointTransaction Mongoose schema
│       │   ├── rewards/
│       │   │   ├── reward.controller.ts
│       │   │   ├── reward.model.ts       # Reward Mongoose schema
│       │   │   ├── reward.routes.ts      # Public listing + authenticated redemption
│       │   │   ├── reward.service.ts     # Availability validation, redemption flow
│       │   │   └── reward.validation.ts
│       │   ├── users/
│       │   │   ├── user.controller.ts
│       │   │   ├── user.model.ts         # User Mongoose schema (core entity)
│       │   │   ├── user.routes.ts        # Authenticated user profile & stats
│       │   │   ├── user.service.ts       # Profile, summary, impact, milestone queries
│       │   │   └── user.validation.ts
│       │   └── vouchers/
│       │       ├── voucher.controller.ts
│       │       ├── voucher.model.ts      # UserVoucher Mongoose schema
│       │       ├── voucher.routes.ts     # Authenticated wallet endpoints
│       │       ├── voucher.service.ts    # Voucher creation, validation, mark-as-used
│       │       └── voucher.validation.ts
│       ├── seeds/
│       │   ├── runSeeds.ts               # Seed orchestrator
│       │   ├── seedMachines.ts
│       │   ├── seedMilestones.ts
│       │   ├── seedPartners.ts
│       │   ├── seedRewards.ts
│       │   └── seedUsers.ts
│       ├── types/
│       │   ├── common.types.ts           # AuthUser, ApiResponse<T>
│       │   ├── enums.ts                  # UserRole, PointTransactionType, ItemType, etc.
│       │   └── express.d.ts              # Express Request augmentation (req.user)
│       └── utils/
│           ├── dateRange.ts              # Period → date range helper
│           ├── generateCode.ts           # nanoid-based code generators
│           ├── hash.ts                   # bcrypt & SHA-256 hashing utilities
│           ├── httpError.ts              # HttpError class for structured errors
│           ├── pointRules.ts             # Point calculation per item type
│           ├── pointRules.test.ts        # Unit test for point rules
│           ├── qrToken.ts               # QR claim & voucher token generation
│           └── token.ts                  # JWT access/refresh token utilities
├── frontend/
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── vite-env.d.ts
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx                      # React DOM render entry
│       ├── app/
│       │   ├── App.tsx                   # Root component with routing
│       │   ├── providers.tsx             # Context providers wrapper
│       │   └── router.tsx                # Route path constants
│       ├── components/
│       │   ├── common/                   # Button, Card
│       │   ├── home/                     # ImpactStatCard, MilestoneProgressCard, PointsSummaryCard, RewardStack, ScanQRCard
│       │   ├── layout/                   # BottomNav, MobileShell, PageHeader
│       │   ├── rewards/                  # PartnerFilter, RewardCard
│       │   ├── scan/                     # ClaimResultModal, QRScanner
│       │   └── wallet/                   # VoucherCard
│       ├── pages/
│       │   ├── admin/                    # AdminOverviewPage
│       │   ├── auth/                     # LoginPage
│       │   ├── operator/                 # OperatorPage
│       │   └── user/                     # HomePage, ImpactPage, ProfilePage, RewardsPage, ScanPage, WalletPage
│       ├── services/
│       │   ├── apiClient.ts              # Axios instance with auth interceptor
│       │   ├── admin.api.ts              # Admin API calls
│       │   ├── auth.api.ts               # Auth API calls (login, getMe)
│       │   ├── contribution.api.ts       # Contribution session & claim API
│       │   ├── operator.api.ts           # Operator voucher management API
│       │   ├── rewards.api.ts            # Rewards listing & redemption API
│       │   ├── user.api.ts               # User summary, impact, history API
│       │   └── wallet.api.ts             # Wallet listing API
│       ├── store/
│       │   ├── authStore.ts              # Zustand auth state (token, user)
│       │   └── uiStore.ts               # Zustand UI state
│       ├── styles/
│       │   ├── global.css                # Global CSS styles
│       │   └── theme.ts                  # Theme constants
│       └── types/
│           ├── contribution.types.ts
│           ├── reward.types.ts
│           ├── user.types.ts
│           └── voucher.types.ts
├── docs/
│   └── api/
│       └── openapi.yaml                  # OpenAPI specification
├── package.json                          # Monorepo root (npm workspaces)
├── SYSTEM_ARCHITECTURE.md
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
└── SECURITY.md
```

---

## 3. Directory & File Responsibilities

### 3.1 `backend/src/config/`

| File           | Purpose |
| -------------- | ------- |
| `env.ts`       | Loads `.env` via `dotenv`, validates with **Zod** schema. Exports typed `env` object with `PORT`, `MONGODB_URI`, JWT secrets, salt rounds, token expiry values, and `FRONTEND_ORIGIN`. |
| `db.ts`        | Connects to MongoDB via Mongoose. Enables `strictQuery`. |
| `constants.ts` | Business constants: point rules per item type (`plastic_bottle: 10`, `can: 8`), token expiry config, default university (`"DHBK"`). |

### 3.2 `backend/src/middleware/`

| File                     | Purpose |
| ------------------------ | ------- |
| `auth.middleware.ts`     | Extracts `Bearer` token from `Authorization` header, verifies JWT, attaches decoded `AuthUser` to `req.user`. Returns `401` on missing/invalid token. |
| `role.middleware.ts`     | Factory function `requireRole(...roles)` — checks if `req.user.role` is in the allowed list. Returns `403` on mismatch. |
| `validate.middleware.ts` | Generic Zod validation middleware. Accepts a Zod schema, validates `{ body, params, query }`, replaces parsed values on the request. Passes `ZodError` to error handler on failure. |
| `error.middleware.ts`    | Global Express error handler. Handles `ZodError` (→ `400`), `HttpError` (→ custom status), and unknown errors (→ `500`). |
| `notFound.middleware.ts` | Catch-all `404` for unmatched routes. |

### 3.3 `backend/src/modules/` (Feature Modules)

Each module follows the pattern: **model → service → controller → validation → routes**.

| Module           | Description |
| ---------------- | ----------- |
| **auth**         | User registration (password + OTP), password login, OTP login, JWT token issuance, current user retrieval. Contains `OtpModel`. |
| **users**        | Authenticated user profile management, summary (with recent transactions), point history, environmental impact stats, milestone progress. Contains `UserModel` (the core entity). |
| **machines**     | Admin CRUD for recycling machines, heartbeat tracking. Contains `MachineModel`. |
| **contributions**| Core recycling flow: machine creates session → user scans QR → claims points. Contains `ContributionSessionModel`. |
| **points**       | Point ledger system: earn, redeem, refund, bonus, adjustment transactions. Contains `PointTransactionModel`. |
| **partners**     | Public listing of campus partners (brands, canteens, etc.). Contains `PartnerModel`. |
| **rewards**      | Reward catalog, availability validation, redemption flow (deducts points, creates voucher). Contains `RewardModel`. |
| **vouchers**     | User wallet: voucher creation, listing, detail, validation, usage marking. Contains `UserVoucherModel`. |
| **operator**     | Operator portal: voucher validation via QR/code, mark-as-used, usage history. Creates audit logs. |
| **admin**        | Admin dashboard: overview stats, CRUD for partners/rewards/milestones/campaigns, point adjustments. Contains `AuditLogModel`. |
| **milestones**   | Achievement system: define milestones, auto-check after contribution, award bonus points. Contains `MilestoneModel` + `UserMilestoneModel`. |
| **leaderboard**  | User & faculty rankings by points earned, with period filtering (week/month/year/all). |
| **campaigns**    | Time-bounded campaigns with bonus multipliers. Contains `CampaignModel`. |

### 3.4 `backend/src/utils/`

| File              | Purpose |
| ----------------- | ------- |
| `httpError.ts`    | `HttpError` class extending `Error` with `statusCode` and optional `details`. |
| `token.ts`        | JWT utilities: `generateAccessToken`, `generateRefreshToken`, `verifyAccessToken`. |
| `hash.ts`         | bcrypt wrappers for password, OTP, and API key hashing/comparison. SHA-256 for opaque tokens. |
| `qrToken.ts`      | Generates claim tokens (`GP-CLAIM-xxx`) and voucher QR tokens (`GP-VOUCHER-xxx`). Hashes with SHA-256. |
| `generateCode.ts` | nanoid-based generators for session codes, redeem codes, machine codes, campaign codes. |
| `pointRules.ts`   | `calculateContributionItems()` — maps item types to point values per `POINT_RULES` config. |
| `dateRange.ts`    | Converts period strings (`week`, `month`, `year`, `all`) to `{ start, end }` date ranges. |

### 3.5 `backend/src/types/`

| File              | Purpose |
| ----------------- | ------- |
| `enums.ts`        | Shared enums: `USER_ROLES` (`user`, `operator`, `admin`, `partner_admin`), `POINT_TRANSACTION_TYPES`, `POINT_TRANSACTION_SOURCES`, `ITEM_TYPES`. |
| `common.types.ts` | `AuthUser` (JWT payload shape) and `ApiResponse<T>` generic wrapper. |
| `express.d.ts`    | Augments Express `Request` interface with optional `user?: AuthUser`. |

### 3.6 `backend/src/seeds/`

Seed scripts for development data: `seedUsers`, `seedMachines`, `seedPartners`, `seedRewards`, `seedMilestones`. Orchestrated by `runSeeds.ts`.

### 3.7 `frontend/src/`

| Directory     | Purpose |
| ------------- | ------- |
| `app/`        | Root `App.tsx` with React Router setup, `providers.tsx` for context, `router.tsx` for route constants. |
| `components/` | Reusable UI components organized by feature area (common, home, layout, rewards, scan, wallet). |
| `pages/`      | Page-level components organized by role: `auth/`, `user/` (6 pages), `operator/`, `admin/`. |
| `services/`   | API layer — Axios client with Bearer token interceptor + per-feature API functions. |
| `store/`      | **Zustand** stores: `authStore` (token + user state), `uiStore` (UI preferences). |
| `styles/`     | Global CSS and theme constants. |
| `types/`      | Frontend TypeScript type definitions for contributions, rewards, users, vouchers. |

---

## 4. Data Models (Mongoose Schemas)

### 4.1 User

```
Collection: users
Fields:
  phoneNumber        String   required, unique, indexed
  passwordHash       String   select: false
  authMethods        [String] enum: ["password", "sms_otp"]
  displayName        String   required, default: "Green User"
  avatarUrl          String
  role               String   enum: ["user", "operator", "admin", "partner_admin"], default: "user"
  university         String   default: "DHBK"
  faculty            String   indexed
  className          String
  studentId          String   sparse indexed
  totalPoints        Number   default: 0
  lifetimeEarnedPoints    Number   default: 0
  lifetimeRedeemedPoints  Number   default: 0
  totalBottles       Number   default: 0
  totalCans          Number   default: 0
  totalItems         Number   default: 0
  currentStreak      Number   default: 0
  longestStreak      Number   default: 0
  lastContributionAt Date
  level              String   default: "Beginner Recycler"
  membershipTier     String   enum: ["green_member", "silver", "gold", "platinum"]
  status             String   enum: ["active", "inactive", "banned", "deleted"]
  isPhoneVerified    Boolean  default: false
  notificationSettings {
    rewardUpdates      Boolean  default: true
    campaignUpdates    Boolean  default: true
    milestoneUpdates   Boolean  default: true
  }
  lastLoginAt        Date
  timestamps         { createdAt, updatedAt }
```

### 4.2 OTP

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

### 4.3 Machine

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

### 4.4 ContributionSession

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

### 4.5 PointTransaction

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

### 4.6 Partner

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

### 4.7 Reward

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

### 4.8 UserVoucher

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

### 4.9 Milestone

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

### 4.10 UserMilestone

```
Collection: usermilestones
Fields:
  userId       ObjectId  ref: User, required, indexed
  milestoneId  ObjectId  ref: Milestone, required
  achievedAt   Date      default: now
  timestamps   { createdAt, updatedAt }
Compound unique index: { userId, milestoneId }
```

### 4.11 Campaign

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

### 4.12 AuditLog

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

## 5. API Reference (Swagger-Style)

**Base URL:** `http://localhost:4000/api`

### 5.1 Health Check

| Method | Endpoint       | Auth | Description        |
| ------ | -------------- | ---- | ------------------ |
| GET    | `/api/health`  | None | Server health check |

**Response `200`:**
```json
{ "ok": true, "app": "GreenPoint API" }
```

---

### 5.2 Auth (`/api/auth`)

#### `POST /api/auth/register`

Register a new user.

| Auth | Roles |
| ---- | ----- |
| None | N/A   |

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

| Auth | Roles |
| ---- | ----- |
| None | N/A   |

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

Request an OTP code sent to phone.

| Auth | Roles |
| ---- | ----- |
| None | N/A   |

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
  "devOtp": "string (6-digit, dev only)"
}
```

---

#### `POST /api/auth/verify-otp`

Verify OTP and receive auth tokens.

| Auth | Roles |
| ---- | ----- |
| None | N/A   |

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

**Errors:** `401` OTP invalid/expired

---

#### `POST /api/auth/logout`

| Auth   | Roles |
| ------ | ----- |
| Bearer | Any   |

**Response `204`:** No content

---

#### `GET /api/auth/me`

Get current authenticated user profile.

| Auth   | Roles |
| ------ | ----- |
| Bearer | Any   |

**Response `200`:** Full User object

---

### 5.3 Users (`/api/users`)

> All routes require `Bearer` authentication.

#### `GET /api/users/me`

| Roles | Description |
| ----- | ----------- |
| Any   | Get own user profile |

**Response `200`:** User object

---

#### `PATCH /api/users/me`

| Roles | Description |
| ----- | ----------- |
| Any   | Update own profile |

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

**Response `200`:** Updated User object

---

#### `GET /api/users/me/summary`

| Roles | Description |
| ----- | ----------- |
| Any   | Dashboard summary: user + recent transactions + impact stats |

---

#### `GET /api/users/me/history`

| Roles | Description |
| ----- | ----------- |
| Any   | Full point transaction history (sorted newest first) |

---

#### `GET /api/users/me/impact`

| Roles | Description |
| ----- | ----------- |
| Any   | Environmental impact: monthly stats, all-time totals, CO₂ estimate |

**Response `200`:**
```json
{
  "month": { "bottles": 0, "cans": 0, "points": 0 },
  "allTime": { "bottles": 0, "cans": 0, "items": 0, "points": 0 },
  "co2KgEstimate": 0.0
}
```

---

#### `GET /api/users/me/milestones`

| Roles | Description |
| ----- | ----------- |
| Any   | User milestone achievement records (populated with milestone details) |

---

### 5.4 Machines (`/api/machines`)

> All routes require `Bearer` authentication + `admin` role (except heartbeat which also allows `operator`).

#### `GET /api/machines`

| Roles | Description |
| ----- | ----------- |
| admin | List all machines |

---

#### `GET /api/machines/:machineId`

| Roles | Description |
| ----- | ----------- |
| admin | Get machine by ID |

---

#### `POST /api/machines`

| Roles | Description |
| ----- | ----------- |
| admin | Create a new machine |

**Request Body:**
```json
{
  "machineCode": "string (optional, auto-generated)",
  "name": "string (optional)",
  "locationName": "string (required)",
  "locationType": "canteen | parking | library | classroom_area | other",
  "apiKey": "string (min 8)"
}
```

**Response `201`:** Machine object

---

#### `PATCH /api/machines/:machineId`

| Roles | Description |
| ----- | ----------- |
| admin | Update machine properties |

**Request Body:**
```json
{
  "name": "string (optional)",
  "locationName": "string (optional)",
  "locationType": "string enum (optional)",
  "status": "online | offline | maintenance | disabled (optional)"
}
```

---

#### `POST /api/machines/:machineId/heartbeat`

| Roles          | Description |
| -------------- | ----------- |
| admin, operator | Machine heartbeat |

**Response `200`:** Updated Machine object (status → online, lastSeenAt → now)

---

### 5.5 Contributions (`/api/contributions`)

#### `POST /api/contributions`

Create a contribution session from a recycling machine. **No Bearer auth** — uses `x-machine-api-key` header.

| Auth              | Description |
| ----------------- | ----------- |
| `x-machine-api-key` header | Machine creates session after detecting items |

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

| Auth   | Roles |
| ------ | ----- |
| Bearer | Any   |

**Request Body:**
```json
{
  "claimToken": "GP-CLAIM-XXXXXXXXXXXX"
}
```

**Response `200`:**
```json
{
  "session": { /* Updated ContributionSession */ },
  "transaction": { /* PointTransaction */ },
  "milestones": [ /* Newly achieved milestones */ ]
}
```

**Errors:** `404` Not found · `409` Already claimed · `410` Expired

---

#### `GET /api/contributions`

| Auth   | Roles |
| ------ | ----- |
| Bearer | admin |

List all contributions (limit 100, populated).

---

#### `GET /api/contributions/:sessionId`

| Auth   | Roles |
| ------ | ----- |
| Bearer | Any   |

Get a specific contribution session.

---

### 5.6 Points (`/api/points`)

#### `GET /api/points/me`

| Auth   | Roles |
| ------ | ----- |
| Bearer | Any   |

**Response `200`:**
```json
{
  "totalPoints": 150,
  "lifetimeEarnedPoints": 200,
  "lifetimeRedeemedPoints": 50
}
```

---

#### `GET /api/points/me/transactions`

| Auth   | Roles |
| ------ | ----- |
| Bearer | Any   |

Full transaction ledger for the authenticated user.

---

### 5.7 Partners (`/api/partners`)

#### `GET /api/partners`

| Auth | Description |
| ---- | ----------- |
| None | List active partners (sorted by name) |

---

#### `GET /api/partners/:partnerId`

| Auth | Description |
| ---- | ----------- |
| None | Get partner details |

---

### 5.8 Rewards (`/api/rewards`)

#### `GET /api/rewards`

| Auth | Description |
| ---- | ----------- |
| None | List active rewards with partner info (sorted by points required) |

---

#### `GET /api/rewards/:rewardId`

| Auth | Description |
| ---- | ----------- |
| None | Get reward details with partner info |

---

#### `POST /api/rewards/:rewardId/redeem`

| Auth   | Roles |
| ------ | ----- |
| Bearer | Any   |

Redeem a reward. Deducts points, creates voucher, returns QR token.

**Response `200`:**
```json
{
  "reward": { /* Reward */ },
  "transaction": { /* PointTransaction (type: redeem) */ },
  "voucher": { /* UserVoucher */ },
  "qrToken": "GP-VOUCHER-XXXXXXXXXXXX"
}
```

**Errors:** `402` Not enough points · `409` Not active / out of stock · `410` Expired

---

### 5.9 Wallet (`/api/wallet`)

> All routes require `Bearer` authentication.

#### `GET /api/wallet`

| Roles | Description |
| ----- | ----------- |
| Any   | List user's vouchers (populated with reward + partner) |

---

#### `GET /api/wallet/:voucherId`

| Roles | Description |
| ----- | ----------- |
| Any   | Get voucher detail (must belong to authenticated user) |

---

### 5.10 Operator (`/api/operator`)

> All routes require `Bearer` + `operator` or `admin` role.

#### `POST /api/operator/vouchers/validate`

Validate a voucher for usability (check status, expiry).

**Request Body:**
```json
{
  "redeemCode": "string (optional)",
  "qrToken": "string (optional)"
}
```

**Response `200`:** Voucher object (populated)

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

| Roles          | Description |
| -------------- | ----------- |
| operator, admin | Vouchers used by this operator (populated) |

---

### 5.11 Admin (`/api/admin`)

> All routes require `Bearer` + `admin` role.

#### `GET /api/admin/overview`

Platform-wide dashboard stats.

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

---

#### `GET /api/admin/reports/contributions`

| Description |
| ----------- |
| List contributions (limit 500, populated) |

#### `GET /api/admin/reports/rewards`

| Description |
| ----------- |
| List rewards (limit 500, populated) |

#### `GET /api/admin/reports/users`

| Description |
| ----------- |
| List users (limit 500) |

#### `GET /api/admin/reports/partners`

| Description |
| ----------- |
| List partners (limit 500) |

---

#### Partner Management

| Method | Endpoint                    | Description |
| ------ | --------------------------- | ----------- |
| POST   | `/api/admin/partners`       | Create partner |
| PATCH  | `/api/admin/partners/:partnerId` | Update partner |
| DELETE | `/api/admin/partners/:partnerId` | Soft-delete partner (status → inactive) |

#### Reward Management

| Method | Endpoint                    | Description |
| ------ | --------------------------- | ----------- |
| POST   | `/api/admin/rewards`        | Create reward |
| PATCH  | `/api/admin/rewards/:rewardId` | Update reward |
| DELETE | `/api/admin/rewards/:rewardId` | Soft-delete reward (status → inactive) |

#### Point Adjustment

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| POST   | `/api/admin/users/:userId/points/adjust` | Admin adjust user points |

**Request Body:**
```json
{
  "points": 50,
  "description": "Compensation for system error"
}
```

#### Milestone Management

| Method | Endpoint                    | Description |
| ------ | --------------------------- | ----------- |
| POST   | `/api/admin/milestones`     | Create milestone |
| PATCH  | `/api/admin/milestones/:milestoneId` | Update milestone |

#### Campaign Management

| Method | Endpoint                    | Description |
| ------ | --------------------------- | ----------- |
| POST   | `/api/admin/campaigns`      | Create campaign |
| PATCH  | `/api/admin/campaigns/:campaignId` | Update campaign |
| DELETE | `/api/admin/campaigns/:campaignId` | Soft-delete campaign (status → inactive) |

---

### 5.12 Milestones (`/api/milestones`)

#### `GET /api/milestones`

| Auth | Description |
| ---- | ----------- |
| None | List active milestones (sorted by target value) |

---

#### `GET /api/milestones/me`

| Auth   | Roles |
| ------ | ----- |
| Bearer | Any   |

User milestone progress with current values vs targets.

**Response `200`:**
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

### 5.13 Leaderboard (`/api/leaderboard`)

#### `GET /api/leaderboard/users`

| Auth  | Description |
| ----- | ----------- |
| None  | Top 50 users by earned points |

**Query Parameters:**
| Param  | Type   | Default | Values |
| ------ | ------ | ------- | ------ |
| period | string | month   | week, month, year, all |

---

#### `GET /api/leaderboard/faculties`

| Auth | Description |
| ---- | ----------- |
| None | Faculty ranking by total points & bottles |

---

#### `GET /api/leaderboard/campaigns/:campaignId`

| Auth | Description |
| ---- | ----------- |
| None | Campaign-specific leaderboard |

---

### 5.14 Campaigns (`/api/campaigns`)

#### `GET /api/campaigns`

| Auth | Description |
| ---- | ----------- |
| None | List active campaigns (within date range) |

---

#### `GET /api/campaigns/:campaignId`

| Auth | Description |
| ---- | ----------- |
| None | Get campaign by ID |

---

## 6. Authentication & Authorization

| Mechanism | Details |
| --------- | ------- |
| **Token type** | JWT Bearer token in `Authorization` header |
| **Access token** | Default expiry: `15m` |
| **Refresh token** | Default expiry: `7d` |
| **Password hashing** | bcryptjs with configurable salt rounds |
| **OTP** | 6-digit numeric, bcrypt-hashed, expires in 5m |
| **API Key (machines)** | bcrypt-hashed, passed via `x-machine-api-key` header |
| **Roles** | `user`, `operator`, `admin`, `partner_admin` |

---

## 7. Environment Variables

| Variable                    | Type   | Default            | Description |
| --------------------------- | ------ | ------------------ | ----------- |
| `NODE_ENV`                  | string | development        | Runtime environment |
| `PORT`                      | number | 4000               | HTTP server port |
| `MONGODB_URI`               | string | *required*         | MongoDB connection string |
| `JWT_ACCESS_SECRET`         | string | *required* (min 12)| Access token signing secret |
| `JWT_REFRESH_SECRET`        | string | *required* (min 12)| Refresh token signing secret |
| `JWT_ACCESS_EXPIRES_IN`     | string | 15m                | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN`    | string | 7d                 | Refresh token TTL |
| `BCRYPT_SALT_ROUNDS`        | number | 10                 | bcrypt cost factor |
| `CLAIM_TOKEN_EXPIRES_MINUTES` | number | 15              | QR claim token TTL |
| `OTP_EXPIRES_MINUTES`       | number | 5                  | OTP TTL |
| `FRONTEND_ORIGIN`           | string | http://localhost:5173 | CORS allowed origin |

---

## 8. Frontend Routes

| Path        | Page Component    | Description |
| ----------- | ----------------- | ----------- |
| `/login`    | LoginPage         | Phone + password login |
| `/home`     | HomePage          | Dashboard with points summary, scan QR, rewards stack |
| `/scan`     | ScanPage          | QR scanner for claiming contributions |
| `/impact`   | ImpactPage        | Environmental impact stats |
| `/rewards`  | RewardsPage       | Browse and redeem rewards |
| `/wallet`   | WalletPage        | View redeemed vouchers |
| `/profile`  | ProfilePage       | User profile settings |
| `/operator` | OperatorPage      | Operator voucher validation portal |
| `/admin`    | AdminOverviewPage | Admin dashboard with stats overview |

---

## 9. Key Business Flows

### 9.1 Recycling → Points Flow

```
Machine detects items → POST /api/contributions (machine API key)
  → Session created with claimToken + QR code
  → User scans QR → POST /api/contributions/claim (Bearer)
    → Points earned (PointTransaction type: "earn")
    → User counters updated (totalBottles, totalCans, totalItems)
    → Milestones auto-checked → bonus points if unlocked
```

### 9.2 Reward Redemption Flow

```
User browses → GET /api/rewards
  → User redeems → POST /api/rewards/:rewardId/redeem (Bearer)
    → Points deducted (PointTransaction type: "redeem")
    → UserVoucher created with QR code
    → User presents voucher → Operator validates → POST /api/operator/vouchers/use
      → Voucher marked "used", audit log created
```

---

## 10. Technology Dependencies

### Backend
| Package               | Version | Purpose |
| --------------------- | ------- | ------- |
| express               | 4.x     | HTTP framework |
| mongoose              | 8.x     | MongoDB ODM |
| zod                   | 3.x     | Schema validation |
| jsonwebtoken          | 9.x     | JWT signing/verification |
| bcryptjs              | 2.x     | Password/OTP/API key hashing |
| nanoid                | 3.x     | Unique code generation |
| helmet                | 7.x     | Security headers |
| cors                  | 2.x     | Cross-origin resource sharing |
| morgan                | 1.x     | HTTP request logging |
| dotenv                | 16.x   | Environment variable loading |
| express-async-errors  | 3.x     | Async error propagation |
| tsx                   | 4.x     | Dev-time TypeScript runner |

### Frontend
| Package          | Version | Purpose |
| ---------------- | ------- | ------- |
| react            | 18.x   | UI framework |
| react-router-dom | 6.x    | Client-side routing |
| axios            | 1.x    | HTTP client |
| zustand          | 4.x    | State management |
| lucide-react     | 0.x    | Icon library |
| clsx             | 2.x    | Conditional class names |
| vite             | 8.x    | Build tooling |

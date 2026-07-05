# GreenPoint Backend — Complete Documentation

> **Tech Stack:** Node.js · Express · TypeScript · MongoDB / Mongoose · Zod validation · JWT auth
> **Entry point:** `server.ts` → `app.ts`
> **Base URL:** `/api`
> **Default Port:** `4000`

---

## Table of Contents

- [File Architecture](#file-architecture)
- [NPM Scripts](#npm-scripts)
- [Environment Variables](#environment-variables)
- [Dependencies](#dependencies)
- [Authentication and Middleware](#authentication-and-middleware)
- [Database Schemas (All Models)](#database-schemas-all-models)
  - [User](#1-user)
  - [Otp](#2-otp)
  - [Machine](#3-machine)
  - [ContributionSession](#4-contributionsession)
  - [PointTransaction](#5-pointtransaction)
  - [Partner](#6-partner)
  - [Reward](#7-reward)
  - [UserVoucher](#8-uservoucher)
  - [Milestone](#9-milestone)
  - [UserMilestone](#10-usermilestone)
  - [Campaign](#11-campaign)
  - [AuditLog](#12-auditlog)
- [API Endpoints (Full Reference)](#api-endpoints-full-reference)
  - [Health Check](#health-check)
  - [Auth /api/auth](#auth-apiauth)
  - [Users /api/users](#users-apiusers)
  - [Machines /api/machines](#machines-apimachines)
  - [Contributions /api/contributions](#contributions-apicontributions)
  - [Points /api/points](#points-apipoints)
  - [Partners /api/partners](#partners-apipartners)
  - [Rewards /api/rewards](#rewards-apirewards)
  - [Wallet / Vouchers /api/wallet](#wallet--vouchers-apiwallet)
  - [Operator /api/operator](#operator-apioperator)
  - [Admin /api/admin](#admin-apiadmin)
  - [Milestones /api/milestones](#milestones-apimilestones)
  - [Leaderboard /api/leaderboard](#leaderboard-apileaderboard)
  - [Campaigns /api/campaigns](#campaigns-apicampaigns)
- [Services (Business Logic)](#services-business-logic)
- [Utilities](#utilities)
- [Enums and Constants](#enums-and-constants)

---

## File Architecture

```text
backend/
├── .env.example           # Template for required environment variables
├── package.json
├── tsconfig.json
└── src/
    ├── server.ts              # Bootstrap: connects DB, starts HTTP server
    ├── app.ts                 # Express app: middleware chain + route registry
    ├── config/
    │   ├── env.ts             # Zod-validated environment variables (incl. QR_SIGNING_SECRET)
    │   ├── constants.ts       # POINT_RULES (plastic_bottle:10, can:8, carton:6), TOKEN_EXPIRY
    │   └── db.ts              # MongoDB connection via Mongoose
    ├── middleware/
    │   ├── auth.middleware.ts      # JWT Bearer token extraction → req.user
    │   ├── role.middleware.ts      # requireRole(...roles) guard
    │   ├── validate.middleware.ts  # Zod schema validation (body/params/query)
    │   ├── error.middleware.ts     # Global error handler (ZodError, HttpError, 500)
    │   └── notFound.middleware.ts  # 404 fallback
    ├── types/
    │   ├── enums.ts           # USER_ROLES, POINT_TRANSACTION_TYPES/SOURCES, ITEM_TYPES
    │   ├── common.types.ts    # AuthUser, ApiResponse<T>
    │   └── express.d.ts       # Augments Express.Request with `user?: AuthUser`
    ├── utils/
    │   ├── token.ts           # generateAccessToken, generateRefreshToken, verifyAccessToken
    │   ├── hash.ts            # hashOpaqueToken, hashPassword, comparePassword, hashOtp, compareOtp, hashApiKey, compareApiKey
    │   ├── qrToken.ts         # generateClaimToken, generateVoucherQrToken, hashQrToken, normalizeScannedToken
    │   ├── qrPayload.ts       # buildSignedQrPayload, verifyQrSignature (HMAC-SHA256 signed JSON)
    │   ├── generateCode.ts    # generateSessionCode, generateRedeemCode, generateMachineCode, generateCampaignCode
    │   ├── pointRules.ts      # getPointsPerItem, calculateContributionItems
    │   ├── pointRules.test.ts # Node built-in test runner tests for point rules
    │   ├── membershipTier.ts  # calculateMembershipTier(totalItems) → tier string
    │   ├── dateRange.ts       # getDateRange(period) → { start, end }
    │   └── httpError.ts       # HttpError class (statusCode, message, details)
    ├── seeds/                 # Database seed data (run with `npm run seed`)
    └── modules/               # Feature modules (routes / controller / service / model / validation)
        ├── admin/             # + admin.analytics.ts + admin.analytics.validation.ts
        ├── auth/
        ├── campaigns/
        ├── contributions/
        ├── leaderboard/
        ├── machines/
        ├── milestones/
        ├── operator/
        ├── partners/
        ├── points/
        ├── rewards/
        ├── users/
        └── vouchers/
```

Each module typically contains:

| File | Purpose |
|------|---------|
| `*.model.ts` | Mongoose schema & model export |
| `*.routes.ts` | Express Router with middleware + endpoint definitions |
| `*.controller.ts` | Thin handlers that delegate to service and send response |
| `*.service.ts` | Business logic, cross-module orchestration |
| `*.validation.ts` | Zod schemas for request validation |

---

## NPM Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `tsx watch src/server.ts` | Development server with hot reload |
| `build` | `npm run clean && tsc` | Compile TypeScript to `dist/` |
| `start` | `node dist/server.js` | Run compiled production build |
| `typecheck` | `tsc --noEmit` | Type check without emitting files |
| `test` | `node --import tsx --test src/utils/pointRules.test.ts` | Run unit tests (Node built-in test runner) |
| `seed` | `tsx src/seeds/runSeeds.ts` | Seed the database |
| `clean` | _(inline)_ | Remove `dist/` directory |

---

## Environment Variables

All variables are validated at startup via Zod (`config/env.ts`). The app will **not start** if required variables are missing or invalid.

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `NODE_ENV` | string | `"development"` | No | Toggles morgan log format |
| `PORT` | number | `4000` | No | HTTP server port |
| `MONGODB_URI` | string | — | **Yes** | MongoDB connection URI |
| `JWT_ACCESS_SECRET` | string (min 12) | — | **Yes** | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | string (min 12) | — | **Yes** | Secret for signing refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` | string | `"15m"` | No | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | string | `"7d"` | No | Refresh token TTL |
| `BCRYPT_SALT_ROUNDS` | number | `10` | No | bcrypt cost factor |
| `CLAIM_TOKEN_EXPIRES_MINUTES` | number | `15` | No | Minutes before a contribution claim token expires |
| `OTP_EXPIRES_MINUTES` | number | `5` | No | Minutes before an OTP expires |
| `FRONTEND_ORIGIN` | string | `"http://localhost:3000"` | No | CORS allowed origin |
| `QR_SIGNING_SECRET` | string (min 16) | `"dev_qr_signing_secret_1234567890"` | No | HMAC-SHA256 secret for signing QR payloads |

---

## Dependencies

### Runtime

| Package | Version | Purpose |
|---------|---------|---------|
| `bcryptjs` | ^2.4.3 | Password / OTP / API key hashing |
| `cors` | ^2.8.5 | Cross-Origin Resource Sharing |
| `dotenv` | ^16.4.5 | `.env` file loading |
| `express` | ^4.19.2 | HTTP framework |
| `express-async-errors` | ^3.1.1 | Patches async route handlers to forward errors to `next()` |
| `helmet` | ^7.1.0 | Security HTTP headers |
| `jsonwebtoken` | ^9.0.2 | JWT sign / verify |
| `mongoose` | ^8.3.4 | MongoDB ODM |
| `morgan` | ^1.10.0 | HTTP request logging |
| `nanoid` | ^3.3.7 | Random ID/code generation (v3 CommonJS) |
| `zod` | ^3.23.8 | Schema validation |

### Dev

| Package | Purpose |
|---------|---------|
| `tsx` | TypeScript execution / watch mode |
| `typescript` | TypeScript compiler |
| `@types/*` | Type definitions for runtime packages |

---

## Authentication and Middleware

### Auth Flow

1. **Register** → Creates user, returns `{ user, accessToken, refreshToken }`
2. **Login (password)** → Validates credentials, returns tokens
3. **Login (OTP)** → `request-otp` → `verify-otp` → auto-creates user if not exists, returns tokens
4. All protected routes require `Authorization: Bearer <accessToken>` header

### Middleware Stack (applied in order in `app.ts`)

| Middleware | Scope | Description |
|-----------|-------|-------------|
| `helmet()` | Global | Security headers |
| `cors()` | Global | CORS with `FRONTEND_ORIGIN`, credentials enabled |
| `express.json()` | Global | JSON body parser |
| `morgan()` | Global | Request logging |
| `authMiddleware` | Per-route | Extracts JWT from `Bearer` token → sets `req.user` |
| `requireRole(...roles)` | Per-route | Checks `req.user.role` against allowed roles |
| `validate(schema)` | Per-route | Validates `req.body`, `req.params`, `req.query` via Zod |
| `notFoundMiddleware` | Global (tail) | Returns 404 for unmatched routes |
| `errorMiddleware` | Global (tail) | Catches `ZodError` → 400, `HttpError` → status, else → 500 |

### JWT Payload (`AuthUser`)

```ts
{
  id: string;          // MongoDB ObjectId
  role: UserRole;      // "user" | "operator" | "admin" | "partner_admin"
  displayName: string;
  phoneNumber: string;
}
```

---

## Database Schemas (All Models)

> All schemas use `{ timestamps: true }` which adds `createdAt` and `updatedAt` fields automatically.

---

### 1. User

**Collection:** `users`
**File:** `modules/users/user.model.ts`

| Field | Type | Required | Default | Constraints | Description |
|-------|------|----------|---------|-------------|-------------|
| `phoneNumber` | String | Yes | — | `unique`, `index`, `trim` | Primary login identifier |
| `passwordHash` | String | No | — | `select: false` | bcrypt hash (hidden from queries by default) |
| `authMethods` | \[String\] | No | `["sms_otp"]` | enum: `"password"`, `"sms_otp"` | Allowed authentication methods |
| `displayName` | String | Yes | `"Green User"` | `trim` | Display name |
| `avatar` | String | No | `"default-avatar.png"` | — | Avatar filename or URL |
| `role` | String | No | `"user"` | enum: `USER_ROLES`, `index` | `"user"` / `"operator"` / `"admin"` / `"partner_admin"` |
| `className` | String | No | — | — | Class name |
| `studentId` | String | No | — | `sparse index` | Student ID number |
| `totalPoints` | Number | No | `0` | `min: 0` | Current spendable point balance (cached) |
| `lifetimeEarnedPoints` | Number | No | `0` | `min: 0` | All-time earned points |
| `lifetimeRedeemedPoints` | Number | No | `0` | `min: 0` | All-time redeemed/spent points |
| `totalBottles` | Number | No | `0` | `min: 0` | Total plastic bottles recycled |
| `totalCans` | Number | No | `0` | `min: 0` | Total cans recycled |
| `totalCarton` | Number | No | `0` | `min: 0` | Total cartons recycled |
| `totalItems` | Number | No | `0` | `min: 0` | Total items recycled (bottles + cans + cartons) |
| `currentStreak` | Number | No | `0` | `min: 0` | Current consecutive-day streak |
| `longestStreak` | Number | No | `0` | `min: 0` | Best streak ever achieved |
| `lastContributionAt` | Date | No | — | — | Timestamp of last contribution claim |
| `membershipTier` | String | No | `"green_member"` | enum: `"green_member"`, `"silver"`, `"gold"`, `"platinum"` | Loyalty tier (auto-computed after each claim) |
| `notificationSettings` | Object | No | `{}` | Subdocument (no `_id`) | Notification preferences |
| `notificationSettings.rewardUpdates` | Boolean | No | `true` | — | Receive reward notifications |
| `notificationSettings.campaignUpdates` | Boolean | No | `true` | — | Receive campaign notifications |
| `notificationSettings.milestoneUpdates` | Boolean | No | `true` | — | Receive milestone notifications |

> **Note:** The User model does NOT have `university`, `faculty`, `level`, `status`, `isPhoneVerified`, or `lastLoginAt` fields.

---

### 2. Otp

**Collection:** `otps`
**File:** `modules/auth/otp.model.ts`

| Field | Type | Required | Default | Constraints | Description |
|-------|------|----------|---------|-------------|-------------|
| `phoneNumber` | String | Yes | — | `index` | Target phone number |
| `otpHash` | String | Yes | — | — | bcrypt hash of the 6-digit OTP |
| `purpose` | String | No | `"login"` | enum: `"login"`, `"register"`, `"reset_password"` | Why the OTP was issued |
| `expiresAt` | Date | Yes | — | `index` | Expiration timestamp |
| `consumedAt` | Date | No | — | — | When OTP was successfully used |
| `attempts` | Number | No | `0` | — | Number of verification attempts |
| `status` | String | No | `"active"` | enum: `"active"`, `"used"`, `"expired"` | OTP lifecycle state |

---

### 3. Machine

**Collection:** `machines`
**File:** `modules/machines/machine.model.ts`

**Subdocument — BinCapacity (no `_id`):**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `binType` | String | Yes | enum: `"plastic_bottle"`, `"can"`, `"carton"` | Which recycling bin |
| `capacityPercent` | Number | No | `min: 0`, `max: 100`, default `0` | Bin fill percentage (0–100) |

**Machine fields:**

| Field | Type | Required | Default | Constraints | Description |
|-------|------|----------|---------|-------------|-------------|
| `machineCode` | String | Yes | — | `unique`, `index`, regex: 4-digit numeric `0001`–`9999` | Unique machine code (4 digits, e.g. `"0001"`) |
| `name` | String | Yes | — | — | Human-friendly machine name |
| `locationName` | String | Yes | — | — | Physical location description |
| `locationType` | String | No | `"other"` | enum: `"canteen"`, `"parking"`, `"library"`, `"classroom_area"`, `"other"` | Location category |
| `apiKeyHash` | String | Yes | — | `select: false` | bcrypt-hashed API key for machine-to-server auth |
| `status` | String | No | `"offline"` | enum: `"online"`, `"offline"`, `"maintenance"`, `"disabled"`, `index` | Current operational status |
| `lastSeenAt` | Date | No | — | — | Last heartbeat timestamp |
| `totalSessions` | Number | No | `0` | — | Count of sessions created by this machine |
| `bins` | \[BinCapacity\] | No | `[]` | — | Current bin fill levels reported by machine |

---

### 4. ContributionSession

**Collection:** `contributionsessions`
**File:** `modules/contributions/contribution.model.ts`

**Subdocument — ContributionItem (no `_id`):**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `itemType` | String | Yes | enum: `"plastic_bottle"`, `"can"`, `"carton"` |
| `quantity` | Number | Yes | `min: 1` |
| `pointsPerItem` | Number | Yes | — |

**ContributionSession fields:**

| Field | Type | Required | Default | Constraints | Description |
|-------|------|----------|---------|-------------|-------------|
| `sessionCode` | String | Yes | — | `unique`, `index` | Unique session code (e.g. `SESSION-XXXXXXXX`) |
| `machineId` | ObjectId → Machine | Yes | — | `index` | Machine that created the session |
| `machineName` | String | No | — | — | Snapshot of machine name at session creation |
| `items` | \[ContributionItem\] | Yes | — | — | Array of recycled items |
| `totalItems` | Number | Yes | — | `min: 0` | Sum of all item quantities in this session |
| `totalPoints` | Number | Yes | — | `min: 0` | Total points for the session |
| `claimTokenHash` | String | Yes | — | `index` | SHA-256 hash of the QR claim token |
| `status` | String | No | `"unclaimed"` | enum: `"unclaimed"`, `"claimed"`, `"expired"`, `"cancelled"`, `index` | Claim state |
| `claimedBy` | ObjectId → User | No | — | — | User who claimed the session |
| `claimedAt` | Date | No | — | — | Claim timestamp |
| `expiresAt` | Date | Yes | — | `index` | Claim window expiration |

---

### 5. PointTransaction

**Collection:** `pointtransactions`
**File:** `modules/points/pointTransaction.model.ts`

| Field | Type | Required | Default | Constraints | Description |
|-------|------|----------|---------|-------------|-------------|
| `userId` | ObjectId → User | Yes | — | `index` | User this transaction belongs to |
| `type` | String | Yes | — | enum: `POINT_TRANSACTION_TYPES` | `"earn"` / `"redeem"` / `"refund"` / `"bonus"` / `"adjustment"` |
| `points` | Number | Yes | — | — | Positive = credit, negative = debit |
| `source` | String | Yes | — | enum: `POINT_TRANSACTION_SOURCES` | `"qr_claim"` / `"reward_redeem"` / `"campaign_bonus"` / `"admin_adjustment"` / `"refund"` |
| `description` | String | No | — | — | Human-readable description |
| `contributionSessionId` | ObjectId → ContributionSession | No | — | — | Linked contribution (for earn) |
| `rewardId` | ObjectId → Reward | No | — | — | Linked reward (for redeem) |
| `balanceAfter` | Number | Yes | — | — | User's point balance after this transaction |

---

### 6. Partner

**Collection:** `partners`
**File:** `modules/partners/partner.model.ts`

| Field | Type | Required | Default | Constraints | Description |
|-------|------|----------|---------|-------------|-------------|
| `name` | String | Yes | — | — | Partner name |
| `type` | String | Yes | — | enum: `"university"`, `"brand"`, `"retailer"`, `"canteen"`, `"parking"` | Partner category |
| `logoUrl` | String | No | — | — | Logo image URL |
| `description` | String | No | — | — | Partner description |
| `status` | String | No | `"active"` | enum: `"active"`, `"inactive"`, `index` | Active state |

---

### 7. Reward

**Collection:** `rewards`
**File:** `modules/rewards/reward.model.ts`

| Field | Type | Required | Default | Constraints | Description |
|-------|------|----------|---------|-------------|-------------|
| `partnerId` | ObjectId → Partner | Yes | — | `index` | The partner offering this reward |
| `name` | String | Yes | — | — | Reward name |
| `description` | String | No | — | — | Reward description |
| `rewardType` | String | Yes | — | enum: `"parking_ticket"`, `"meal_voucher"`, `"promo_code"`, `"free_item"`, `"discount"` | Reward category |
| `pointsRequired` | Number | Yes | — | `min: 0` | Cost in points |
| `valueVnd` | Number | No | — | `min: 0` | Monetary value in VND |
| `quantityTotal` | Number | No | — | — | Total quantity issued |
| `quantityRemaining` | Number | No | — | — | Remaining available quantity |
| `validFrom` | Date | No | — | — | Availability start date |
| `validUntil` | Date | No | — | — | Availability end date |
| `terms` | \[String\] | No | `[]` | — | Terms and conditions |
| `status` | String | No | `"active"` | enum: `"active"`, `"inactive"`, `"expired"`, `index` | Reward status |

---

### 8. UserVoucher

**Collection:** `uservouchers`
**File:** `modules/vouchers/voucher.model.ts`

| Field | Type | Required | Default | Constraints | Description |
|-------|------|----------|---------|-------------|-------------|
| `userId` | ObjectId → User | Yes | — | `index` | Owner of the voucher |
| `rewardId` | ObjectId → Reward | Yes | — | `index` | Which reward was redeemed |
| `partnerId` | ObjectId → Partner | Yes | — | `index` | Partner providing the reward |
| `redeemCode` | String | Yes | — | `unique`, `index` | Human-readable code (e.g. `GP-XXXXXXXX`) |
| `qrTokenHash` | String | Yes | — | — | SHA-256 hash of the QR token for scanning |
| `pointsUsed` | Number | Yes | — | — | Points spent on this voucher |
| `status` | String | No | `"unused"` | enum: `"unused"`, `"used"`, `"expired"`, `"cancelled"`, `index` | Voucher lifecycle state |
| `issuedAt` | Date | No | `Date.now` | — | When the voucher was created |
| `usedAt` | Date | No | — | — | When the voucher was used |
| `expiresAt` | Date | Yes | — | `index` | Expiration timestamp (default: 30 days from issuance) |
| `usedLocation` | String | No | — | — | Where the voucher was used |
| `usedByOperator` | ObjectId → User | No | — | — | Operator who marked it as used |

---

### 9. Milestone

**Collection:** `milestones`
**File:** `modules/milestones/milestone.model.ts`

| Field | Type | Required | Default | Constraints | Description |
|-------|------|----------|---------|-------------|-------------|
| `code` | String | Yes | — | `unique` | Unique milestone identifier |
| `name` | String | Yes | — | — | Milestone display name |
| `description` | String | No | — | — | Milestone description |
| `conditionType` | String | Yes | — | enum: `"total_items"`, `"total_bottles"`, `"total_cans"`, `"total_carton"`, `"streak"`, `"monthly_points"` | What stat to evaluate |
| `targetValue` | Number | Yes | — | — | Threshold to achieve milestone |
| `rewardPoints` | Number | No | `0` | — | Bonus points awarded on achievement |
| `badgeIcon` | String | No | — | — | Icon/badge URL |
| `status` | String | No | `"active"` | enum: `"active"`, `"inactive"` | Whether milestone is available |

> **Note:** Milestone schema only has 5 conditionType values in the model (`"total_items"`, `"total_bottles"`, `"total_cans"`, `"streak"`, `"monthly_points"`). The `"total_carton"` conditionType is handled by the service's `getConditionValue()` helper but not listed in the schema enum — this is a gap to be aware of.

---

### 10. UserMilestone

**Collection:** `usermilestones`
**File:** `modules/milestones/userMilestone.model.ts`

| Field | Type | Required | Default | Constraints | Description |
|-------|------|----------|---------|-------------|-------------|
| `userId` | ObjectId → User | Yes | — | `index` | User who achieved |
| `milestoneId` | ObjectId → Milestone | Yes | — | — | Achieved milestone |
| `achievedAt` | Date | No | `Date.now` | — | When it was achieved |

**Unique Compound Index:** `{ userId: 1, milestoneId: 1 }` — prevents duplicate achievements.

---

### 11. Campaign

**Collection:** `campaigns`
**File:** `modules/campaigns/campaign.model.ts`

| Field | Type | Required | Default | Constraints | Description |
|-------|------|----------|---------|-------------|-------------|
| `code` | String | Yes | — | `unique` | Unique campaign code |
| `name` | String | Yes | — | — | Campaign name |
| `description` | String | No | — | — | Campaign description |
| `startsAt` | Date | Yes | — | — | Start date |
| `endsAt` | Date | Yes | — | — | End date |
| `bonusMultiplier` | Number | No | `1` | — | Points multiplier during campaign |
| `status` | String | No | `"active"` | enum: `"active"`, `"inactive"`, `"ended"`, `index` | Campaign state |

---

### 12. AuditLog

**Collection:** `auditlogs`
**File:** `modules/admin/auditLog.model.ts`

| Field | Type | Required | Default | Constraints | Description |
|-------|------|----------|---------|-------------|-------------|
| `actorId` | ObjectId → User | No | — | — | Who performed the action |
| `action` | String | Yes | — | `index` | Action identifier (e.g. `"voucher.used"`) |
| `entityType` | String | No | — | — | Model name affected (e.g. `"UserVoucher"`) |
| `entityId` | String | No | — | — | ID of the affected document |
| `metadata` | Mixed | No | — | — | Arbitrary extra data |

---

## API Endpoints (Full Reference)

### Legend

| Symbol | Meaning |
|--------|---------|
| PUBLIC | Public — no auth required |
| AUTH | Requires `Authorization: Bearer <token>` (`authMiddleware`) |
| ADMIN | Requires `admin` role |
| OPERATOR | Requires `operator` or `admin` role |
| MACHINE | Requires `x-machine-api-key` header — no JWT |

---

### Health Check

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health` | PUBLIC | Returns `{ ok: true, app: "GreenPoint API" }` |

---

### Auth (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/register` | PUBLIC | Register with phone + optional password |
| `POST` | `/api/auth/login` | PUBLIC | Login with phone + password |
| `POST` | `/api/auth/request-otp` | PUBLIC | Request OTP for phone |
| `POST` | `/api/auth/verify-otp` | PUBLIC | Verify OTP, login/register |
| `POST` | `/api/auth/logout` | AUTH | Logout (no-op, returns 204) |
| `GET` | `/api/auth/me` | AUTH | Get current user profile |

#### `POST /api/auth/register` — PUBLIC

**Request Body:**
```json
{
  "phoneNumber": "0912345678",
  "password": "secret123",
  "displayName": "Green User",
  "role": "user"
}
```
- `phoneNumber` — string, min 8 chars, **required**
- `password` — string, min 6 chars, optional
- `displayName` — string, min 1 char, default `"Green User"`
- `role` — optional, default `"user"`

**Response (201):** `{ user, accessToken, refreshToken }`
**Errors:** `409` — Phone number already registered.

---

#### `POST /api/auth/request-otp` — PUBLIC

**Response (201):**
```json
{
  "phoneNumber": "0912345678",
  "expiresAt": "2026-06-28T19:00:00.000Z",
  "devOtp": "123456"
}
```
> `devOtp` is **always returned** in the response (for development). In production, send via SMS instead.

---

### Users (`/api/users`)

> All routes require `authMiddleware` (AUTH).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/users/me` | AUTH | Get full user profile |
| `PATCH` | `/api/users/me` | AUTH | Update profile (`displayName`, `avatarUrl`, `faculty`, `className`, `studentId`, `notificationSettings`) |
| `GET` | `/api/users/me/summary` | AUTH | Profile + last 5 transactions + impact stats |
| `GET` | `/api/users/me/history` | AUTH | All point transactions (newest first) |
| `GET` | `/api/users/me/impact` | AUTH | Environmental impact stats |
| `GET` | `/api/users/me/milestones` | AUTH | Raw milestone achievement records |

#### `GET /api/users/me/impact` — AUTH Response

```json
{
  "month": { "bottles": 12, "cans": 5, "cartons": 3, "points": 160 },
  "allTime": { "bottles": 100, "cans": 40, "cartons": 15, "items": 155, "points": 1320 },
  "co2KgEstimate": 5.27
}
```

> `co2KgEstimate = user.totalItems × 0.034`, rounded to 2 decimal places.

---

### Machines (`/api/machines`)

> All routes require `authMiddleware` (AUTH).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/machines` | AUTH + ADMIN | List all machines |
| `GET` | `/api/machines/:machineId` | AUTH + ADMIN | Get single machine by ID |
| `POST` | `/api/machines` | AUTH + ADMIN | Create a new machine |
| `PATCH` | `/api/machines/:machineId` | AUTH + ADMIN | Update machine fields |
| `POST` | `/api/machines/:machineId/heartbeat` | AUTH + OPERATOR | Update status/lastSeen/bins |

#### `POST /api/machines` — AUTH + ADMIN

**Request Body:**
```json
{
  "machineCode": "0001",
  "name": "Library Entrance",
  "locationName": "Main Library Ground Floor",
  "locationType": "library",
  "apiKey": "mySecretKey123"
}
```
- `machineCode` — string, min 3, optional (auto-generated if omitted)
- `name` — string, min 1, **required**
- `locationName` — string, min 1, **required**
- `locationType` — optional, default `"other"`
- `apiKey` — string, min 8, **required** (stored as bcrypt hash, never returned)

**Response (201):** `Machine` object (without `apiKeyHash`).

---

#### `POST /api/machines/:machineId/heartbeat` — AUTH + OPERATOR

Reports current bin levels; sets machine `status: "online"` and updates `lastSeenAt`.

**Request Body (all optional):**
```json
{
  "bins": [
    { "binType": "plastic_bottle", "capacityPercent": 75 },
    { "binType": "can", "capacityPercent": 30 },
    { "binType": "carton", "capacityPercent": 50 }
  ]
}
```
- `bins` — optional array; if omitted, only `status` and `lastSeenAt` are updated

**Response (200):** Updated `Machine` object.

---

### Contributions (`/api/contributions`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/contributions` | MACHINE | Create contribution session |
| `POST` | `/api/contributions/claim` | AUTH | Claim a session by QR token |
| `GET` | `/api/contributions` | AUTH + ADMIN | List last 100 sessions |
| `GET` | `/api/contributions/:sessionId` | AUTH | Get single session |

#### `POST /api/contributions` — MACHINE

**Headers:** `x-machine-api-key: {apiKey}` — **required**. No JWT needed.

**Request Body:**
```json
{
  "machineCode": "0001",
  "items": [
    { "itemType": "plastic_bottle", "quantity": 5 },
    { "itemType": "can", "quantity": 3 },
    { "itemType": "carton", "quantity": 2 }
  ]
}
```

**Response (201):**
```json
{
  "session": {},
  "qrPayload": "{"claimToken":"GP-CLAIM-...","totalItems":10,"totalPoints":74,...,"signature":"abc..."}",
  "expiresAt": "2026-06-28T19:15:00.000Z"
}
```

> `qrPayload` is a **JSON string** containing the claim token plus an HMAC-SHA256 signature (from `buildSignedQrPayload`). The raw claim token is embedded inside; the machine uses this JSON blob as the QR code data. Only the SHA-256 hash of the claim token is stored on the server.

**Point calculation:**
- `plastic_bottle` × 10 pts
- `can` × 8 pts
- `carton` × 6 pts

**Logic:**
1. Validates `machineCode` + `x-machine-api-key` via bcrypt; rejects if `status === "disabled"`
2. Calculates items and total points
3. Generates `sessionCode` and `claimToken` (`GP-CLAIM-...`), stores SHA-256 hash
4. Snapshots `machine.name` into `machineName`
5. Increments `machine.totalSessions`, sets `lastSeenAt` and `status: "online"`
6. Returns signed QR payload

---

#### `POST /api/contributions/claim` — AUTH

**Request Body:**
```json
{ "claimToken": "GP-CLAIM-XXXXXXXXXXXXXXXX" }
```

**Response (200):**
```json
{
  "session": {},
  "transaction": {},
  "milestones": []
}
```

**Logic:**
1. SHA-256 hashes `claimToken`, finds session by `claimTokenHash`
2. Checks `status === "unclaimed"` and not expired
3. Creates `earn` transaction (`source: "qr_claim"`), updates `totalBottles`, `totalCans`, `totalCarton`, `totalItems`, `lastContributionAt`
4. Auto-computes and updates `membershipTier` via `calculateMembershipTier(totalItems)`
5. Marks session as `"claimed"`
6. Runs milestone check; awards `bonus` pts (`source: "campaign_bonus"`) for newly achieved milestones
7. Returns `milestones` array of newly created `UserMilestone` records

**Errors:** `404` — not found, `409` — already claimed, `410` — expired.

---

### Points (`/api/points`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/points/me` | AUTH | Current balance + lifetime totals |
| `GET` | `/api/points/me/transactions` | AUTH | Full transaction history (newest first) |

---

### Partners (`/api/partners`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/partners` | PUBLIC | List active partners |
| `GET` | `/api/partners/:partnerId` | PUBLIC | Get single partner |

---

### Rewards (`/api/rewards`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/rewards` | PUBLIC | List active rewards (with partner info) |
| `GET` | `/api/rewards/:rewardId` | PUBLIC | Get single reward (with partner info) |
| `POST` | `/api/rewards/:rewardId/redeem` | AUTH | Redeem reward for voucher |

#### `POST /api/rewards/:rewardId/redeem` — AUTH

**Response (201):**
```json
{
  "reward": {},
  "transaction": {},
  "voucher": {},
  "qrToken": "GP-VOUCHER-XXXXXXXXXXXXXXXX"
}
```

> `qrToken` format: `GP-VOUCHER-` + 16 random chars. Returned once for QR display; only SHA-256 hash stored.

**Errors:** `402` — not enough points, `404` — not found, `409` — not active / out of stock, `410` — expired.

---

### Wallet / Vouchers (`/api/wallet`)

> All routes require AUTH.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/wallet` | AUTH | List all user vouchers (with reward→partner) |
| `GET` | `/api/wallet/:voucherId` | AUTH | Get single voucher detail |

---

### Operator (`/api/operator`)

> All routes require AUTH + OPERATOR.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/operator/vouchers/validate` | AUTH + OPERATOR | Validate voucher (no mark-as-used) |
| `POST` | `/api/operator/vouchers/use` | AUTH + OPERATOR | Mark voucher as used |
| `GET` | `/api/operator/history` | AUTH + OPERATOR | History of vouchers used by this operator |

---

### Admin (`/api/admin`)

> All routes require AUTH + ADMIN.

#### Reports

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/overview` | Dashboard overview: counts, point totals, last 20 audit logs |
| `GET` | `/api/admin/reports/contributions` | Last 500 contribution sessions |
| `GET` | `/api/admin/reports/rewards` | Last 500 rewards |
| `GET` | `/api/admin/reports/users` | Last 500 users |
| `GET` | `/api/admin/reports/partners` | Last 500 partners |

#### Analytics

| Method | Path | Query Params | Description |
|--------|------|-------------|-------------|
| `GET` | `/api/admin/analytics/machines` | `startDate?`, `endDate?` | Sessions/items/points grouped by machine |
| `GET` | `/api/admin/analytics/volume-trend` | `startDate?`, `endDate?`, `period?` | Collection volume over time |
| `GET` | `/api/admin/analytics/trash-types` | `startDate?`, `endDate?` | Item breakdown by type |

**Analytics Query Params:**
- `startDate` — ISO 8601 datetime string, optional
- `endDate` — ISO 8601 datetime string, optional
- `period` — `"daily"` / `"weekly"` / `"monthly"`, optional (for volume-trend only)

**`GET /api/admin/analytics/machines` Response:**
```json
[
  { "_id": "machineObjectId", "machineName": "Library", "sessions": 42, "totalItems": 310, "totalPoints": 2840 }
]
```

**`GET /api/admin/analytics/volume-trend` Response:**
```json
[
  { "_id": "2026-07-01", "items": 250, "points": 2100, "sessions": 35 }
]
```

**`GET /api/admin/analytics/trash-types` Response:**
```json
[
  { "_id": "plastic_bottle", "totalQuantity": 1200, "totalPoints": 12000 },
  { "_id": "can", "totalQuantity": 800, "totalPoints": 6400 },
  { "_id": "carton", "totalQuantity": 300, "totalPoints": 1800 }
]
```

#### Partner Management

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/admin/partners` | Create partner |
| `PATCH` | `/api/admin/partners/:partnerId` | Update partner |
| `DELETE` | `/api/admin/partners/:partnerId` | Soft-delete (sets `status: "inactive"`) |

#### Reward Management

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/admin/rewards` | Create reward |
| `PATCH` | `/api/admin/rewards/:rewardId` | Update reward |
| `DELETE` | `/api/admin/rewards/:rewardId` | Soft-delete (sets `status: "inactive"`) |

#### Points Adjustment

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `POST` | `/api/admin/users/:userId/points/adjust` | `{ points, description }` | Manual point adjustment |

> Throws `400` if balance would go negative.

#### Milestone Management

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/admin/milestones` | Create milestone |
| `PATCH` | `/api/admin/milestones/:milestoneId` | Update milestone |

#### Campaign Management

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/admin/campaigns` | Create campaign |
| `PATCH` | `/api/admin/campaigns/:campaignId` | Update campaign |
| `DELETE` | `/api/admin/campaigns/:campaignId` | Soft-delete |

---

### Milestones (`/api/milestones`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/milestones` | PUBLIC | List active milestones |
| `GET` | `/api/milestones/me` | AUTH | Progress on all milestones for current user |

#### `GET /api/milestones/me` — AUTH Response

```json
[
  { "milestone": {}, "achieved": true, "currentValue": 75 },
  { "milestone": {}, "achieved": false, "currentValue": 30 }
]
```

**Condition mapping:**

| conditionType | User field |
|---------------|-----------|
| `total_items` | `user.totalItems` |
| `total_bottles` | `user.totalBottles` |
| `total_cans` | `user.totalCans` |
| `total_carton` | `user.totalCarton` |
| `streak` | `user.currentStreak` |
| `monthly_points` (fallback) | `user.lifetimeEarnedPoints` |

---

### Leaderboard (`/api/leaderboard`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/leaderboard/users` | PUBLIC | User leaderboard by earned points |
| `GET` | `/api/leaderboard/campaigns/:campaignId` | PUBLIC | Campaign leaderboard (stub) |

> **The `/faculties` endpoint has been removed.** Only two leaderboard routes exist.

#### `GET /api/leaderboard/users` — PUBLIC

**Query Params:** `period` — `"week"` / `"month"` / `"year"` / `"all"`, default `"month"`

**Response:**
```json
[
  {
    "_id": "userId...",
    "points": 1500,
    "user": { "displayName": "Nguyen Van A", "totalBottles": 120 }
  }
]
```

> Note: `user.faculty` is **no longer projected** in the leaderboard response.

---

### Campaigns (`/api/campaigns`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/campaigns` | PUBLIC | List active campaigns (within date range) |
| `GET` | `/api/campaigns/:campaignId` | PUBLIC | Get single campaign |

---

## Services (Business Logic)

### Auth Service (`auth.service.ts`)

| Function | Description |
|----------|-------------|
| `createUserWithPassword(input)` | Registers user; hashes password if provided; sets `authMethods`; returns tokens |
| `validatePasswordLogin(phone, password)` | Validates credentials, returns tokens |
| `createOtp(phone, purpose)` | Expires old OTPs, generates 6-digit OTP, stores bcrypt hash, always returns raw OTP |
| `verifyOtpAndLogin(phone, otp)` | Verifies OTP hash, marks as used, auto-creates user if new, returns tokens |
| `getCurrentUser(userId)` | Fetches user by ID, throws 404 if not found |

### User Service (`user.service.ts`)

| Function | Description |
|----------|-------------|
| `findUserById(userId)` | Finds user or throws 404 |
| `updateUserProfile(userId, patch)` | Partial update with `runValidators: true` |
| `getUserSummary(userId)` | Returns user + last 5 point transactions + impact stats |
| `getUserPointHistory(userId)` | All point transactions, sorted newest first |
| `getUserImpactStats(userId)` | Monthly breakdown (bottles/cans/cartons/points from sessions this month) + all-time stats + CO2 estimate |
| `getUserMilestoneProgress(userId)` | Returns user milestones (populated), sorted by `achievedAt` descending |

### Machine Service (`machine.service.ts`)

| Function | Description |
|----------|-------------|
| `createMachine(input)` | Creates machine with bcrypt-hashed API key; initial status `"offline"` |
| `getMachines()` | Lists all machines sorted by `createdAt` descending |
| `getMachineById(machineId)` | Gets machine by ID, throws 404 if not found |
| `updateMachine(machineId, patch)` | Updates machine fields, throws 404 if not found |
| `updateMachineHeartbeat(machineId, bins?)` | Sets `status: "online"`, `lastSeenAt: now`; optionally updates `bins` array |
| `validateMachineApiKey(machineCode, apiKey)` | Finds machine by code (`+apiKeyHash`), rejects if `disabled` or key mismatch |

### Contribution Service (`contribution.service.ts`)

| Function | Description |
|----------|-------------|
| `createSessionFromMachine(input)` | Validates API key, calculates points, generates session + signed QR payload; returns `{ session, qrPayload, expiresAt }` |
| `claimSessionForUser(userId, claimToken)` | Hashes token, validates claim, creates earn transaction, updates all user counters, computes membershipTier, triggers milestones |
| `getContributionSession(sessionId)` | Gets session with populated `machineId` and `claimedBy` |
| `listContributions()` | Last 100 sessions (populated), sorted by `createdAt` descending |
| `expireOldSessions()` | Batch-expires unclaimed sessions past `expiresAt` |

### Point Service (`point.service.ts`)

| Function | Description |
|----------|-------------|
| `createPointTransaction(input)` | Core: validates non-negative balance (throws 400), updates `totalPoints`, `lifetimeEarnedPoints`, `lifetimeRedeemedPoints`, creates record with `balanceAfter` |
| `createEarnTransaction(input)` | Shorthand: `type: "earn"`, `source: "qr_claim"` |
| `createRedeemTransaction(input)` | Shorthand: `type: "redeem"`, `source: "reward_redeem"` |
| `createAdjustmentTransaction(userId, points, desc)` | Shorthand: `type: "adjustment"`, `source: "admin_adjustment"` |
| `getMyPointTransactions(userId)` | All transactions for user, sorted newest first |
| `recalculateUserPointBalance(userId)` | Recomputes balance from all transactions; sets to `Math.max(0, balance)` |

### Reward Service (`reward.service.ts`)

| Function | Description |
|----------|-------------|
| `listActiveRewards()` | Active rewards, populated with partner, sorted by `pointsRequired` asc |
| `getRewardById(rewardId)` | Gets reward with partner info, throws 404 |
| `validateRewardAvailability(rewardId)` | Checks status, date range, stock; throws 409/410 |
| `redeemRewardForUser(userId, rewardId)` | Full redemption: validates, checks balance, creates redeem tx, creates voucher, decrements stock |
| `createReward(input)` | Admin: creates reward |
| `updateReward(rewardId, patch)` | Admin: updates reward, throws 404 |
| `deleteReward(rewardId)` | Admin: soft-deletes (`status: "inactive"`) |

### Voucher Service (`voucher.service.ts`)

| Function | Description |
|----------|-------------|
| `createUserVoucher(input)` | Creates voucher with `GP-XXXXXXXX` redeem code and SHA-256 `qrTokenHash`; default 30-day expiry |
| `getUserWallet(userId)` | Lists vouchers with nested populate, sorted by `issuedAt` desc |
| `getVoucherDetail(userId, voucherId)` | Gets single voucher for user, throws 404 |
| `getVoucherByCodeOrToken(input)` | Finds by `redeemCode` or SHA-256 of `qrToken`; throws 400 if neither provided |
| `validateVoucherUsability(input)` | Checks `"unused"` (409) and not expired (auto-marks `"expired"`, 410) |
| `markVoucherAsUsed(input)` | Validates + sets `status: "used"`, `usedAt`, `usedByOperator`, `usedLocation` |
| `expireOldVouchers()` | Batch-expires unused vouchers past `expiresAt` |

### Operator Service (`operator.service.ts`)

| Function | Description |
|----------|-------------|
| `validateVoucher(input)` | Delegates to `validateVoucherUsability` |
| `useVoucher(input)` | Marks as used + creates `AuditLog` (`action: "voucher.used"`, `metadata: { usedLocation }`) |
| `getOperatorHistory(operatorId)` | Vouchers used by this operator, populated, sorted by `usedAt` desc |

### Milestone Service (`milestone.service.ts`)

| Function | Description |
|----------|-------------|
| `getMilestones()` | Active milestones sorted by `targetValue` asc |
| `createMilestone(input)` | Admin: creates milestone |
| `updateMilestone(id, patch)` | Admin: updates milestone, throws 404 |
| `getUserMilestoneProgress(userId)` | All active milestones with `achieved` flag and `currentValue` (parallel queries) |
| `checkMilestonesAfterContribution(userId)` | Auto-awards milestones; grants `bonus` pts (`source: "campaign_bonus"`) for each new achievement; returns new `UserMilestone` records |

### Leaderboard Service (`leaderboard.service.ts`)

| Function | Description |
|----------|-------------|
| `getUserLeaderboard(period)` | Aggregates `"earn"`/`"bonus"` transactions by period; top 50 with `displayName`, `totalBottles` |
| `getCampaignLeaderboard(campaignId)` | Returns `{ campaignId, users: <monthly leaderboard> }` — stub |

### Campaign Service (`campaign.service.ts`)

| Function | Description |
|----------|-------------|
| `getActiveCampaigns()` | Active + within date range, sorted by `startsAt` desc |
| `getCampaignById(id)` | Single campaign, throws 404 |
| `createCampaign(input)` | Admin: creates campaign |
| `updateCampaign(id, patch)` | Admin: updates campaign, throws 404 |
| `deleteCampaign(id)` | Admin: soft-deletes via `updateCampaign` |

### Admin Service (`admin.service.ts`)

| Function | Description |
|----------|-------------|
| `getOverview()` | Parallel counts + point aggregation + last 20 audit logs |
| `getContributionReport()` | Last 500 contributions (populated) |
| `getRewardReport()` | Last 500 rewards (populated) |
| `getUserReport()` | Last 500 users |
| `getPartnerReport()` | Last 500 partners |

### Admin Analytics (`admin.analytics.ts`)

| Function | Description |
|----------|-------------|
| `getContributionsByMachine(startDate?, endDate?)` | Aggregates sessions grouped by `machineId`: returns `machineName`, `sessions`, `totalItems`, `totalPoints` per machine |
| `getCollectionVolumeTrend(period, startDate?, endDate?)` | Aggregates sessions by date bucket (`daily`=`%Y-%m-%d`, `weekly`=`%Y-%U`, `monthly`=`%Y-%m`): returns `items`, `points`, `sessions` per period |
| `getTrashTypeBreakdown(startDate?, endDate?)` | Unwinds session items, groups by `itemType`: returns `totalQuantity` and `totalPoints` per type |

### Partner Service (`partner.service.ts`)

| Function | Description |
|----------|-------------|
| `getPartners()` | Active partners sorted by name |
| `getPartnerById(id)` | Single partner, throws 404 |
| `createPartner(input)` | Creates partner |
| `updatePartner(id, patch)` | Updates partner, throws 404 |
| `disablePartner(id)` | Sets `status: "inactive"` |

---

## Utilities

### Token (`utils/token.ts`)

| Function | Description |
|----------|-------------|
| `generateAccessToken(user)` | Signs JWT with `JWT_ACCESS_SECRET` |
| `generateRefreshToken(user)` | Signs JWT with `JWT_REFRESH_SECRET` |
| `verifyAccessToken(token)` | Verifies and returns `AuthUser` |

### Hash (`utils/hash.ts`)

| Function | Description |
|----------|-------------|
| `hashOpaqueToken(value)` | SHA-256 via Node.js `crypto` (fast, for token lookups) |
| `hashPassword(password)` | bcrypt hash |
| `comparePassword(password, hash)` | bcrypt compare |
| `hashOtp(otp)` | bcrypt hash for OTP |
| `compareOtp(otp, hash)` | bcrypt compare |
| `hashApiKey(apiKey)` | bcrypt hash for machine API keys |
| `compareApiKey(apiKey, hash)` | bcrypt compare |

> **Strategy:** bcrypt for brute-force-resistant hashing (passwords, OTPs, API keys). SHA-256 for fast server-side lookup of opaque random tokens (claim tokens, voucher QR tokens).

### QR Token (`utils/qrToken.ts`)

| Function | Description |
|----------|-------------|
| `generateClaimToken()` | `GP-CLAIM-` + 16 random chars (unambiguous alphabet) |
| `generateVoucherQrToken()` | `GP-VOUCHER-` + 16 random chars |
| `hashQrToken(token)` | Trims whitespace then SHA-256 hashes via `hashOpaqueToken` |
| `normalizeScannedToken(token)` | Trims leading/trailing whitespace |

### QR Payload (`utils/qrPayload.ts`)

| Function | Description |
|----------|-------------|
| `buildSignedQrPayload(data)` | Serializes `{ claimToken, totalItems, totalPoints, items, expiresAt }` to JSON, appends HMAC-SHA256 `signature` using `QR_SIGNING_SECRET`, returns the full JSON string |
| `verifyQrSignature(raw)` | Parses JSON, recomputes signature, returns `QrPayloadData` if valid or `null` if tampered |

### Membership Tier (`utils/membershipTier.ts`)

| Function | Description |
|----------|-------------|
| `calculateMembershipTier(totalItems)` | Returns tier based on total items recycled |

**Tier thresholds (based on `totalItems`):**

| Tier | Min Items |
|------|----------|
| `platinum` | 100 |
| `gold` | 50 |
| `silver` | 20 |
| `green_member` | 0 |

### Code Generator (`utils/generateCode.ts`)

Uses `nanoid` v3 with alphabet `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (no ambiguous characters). All codes use **8-character** random suffixes.

| Function | Output Format |
|----------|--------------|
| `generateSessionCode()` | `SESSION-XXXXXXXX` |
| `generateRedeemCode()` | `GP-XXXXXXXX` |
| `generateMachineCode()` | `MACHINE-XXXXXXXX` |
| `generateCampaignCode()` | `CAMPAIGN-XXXXXXXX` |

### Point Rules (`utils/pointRules.ts`)

| Function | Description |
|----------|-------------|
| `getPointsPerItem(itemType)` | Returns `10` (bottle), `8` (can), or `6` (carton) |
| `calculateContributionItems(items)` | Adds `pointsPerItem` to each item; computes `totalPoints` |

### Date Range (`utils/dateRange.ts`)

`Period` type: `"week" | "month" | "year" | "all"`

| Function | Description |
|----------|-------------|
| `getDateRange(period)` | Returns `{}` for `"all"`, or `{ start, end }` for other periods |

---

## Enums and Constants

### Item Types

```ts
const ITEM_TYPES = ["plastic_bottle", "can", "carton"] as const;
```

### Point Values (`config/constants.ts`)

| Item | Points |
|------|--------|
| `plastic_bottle` | 10 |
| `can` | 8 |
| `carton` | 6 |

### User Roles

```ts
const USER_ROLES = ["user", "operator", "admin", "partner_admin"] as const;
```

### Point Transaction Types

```ts
const POINT_TRANSACTION_TYPES = ["earn", "redeem", "refund", "bonus", "adjustment"] as const;
```

### Point Transaction Sources

```ts
const POINT_TRANSACTION_SOURCES = ["qr_claim", "reward_redeem", "campaign_bonus", "admin_adjustment", "refund"] as const;
```

> `"campaign_bonus"` is also used as the source for milestone bonus transactions.

### Membership Tier Thresholds

| Tier | Minimum `totalItems` |
|------|--------------------|
| `green_member` | 0 |
| `silver` | 20 |
| `gold` | 50 |
| `platinum` | 100 |

### Other Constants

| Constant | Description |
|----------|-------------|
| `TOKEN_EXPIRY.claimMinutes` | From `CLAIM_TOKEN_EXPIRES_MINUTES` env (default: 15) |
| `TOKEN_EXPIRY.otpMinutes` | From `OTP_EXPIRES_MINUTES` env (default: 5) |

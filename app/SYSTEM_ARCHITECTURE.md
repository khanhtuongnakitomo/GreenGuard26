# GreenPoint System Architecture

GreenPoint is a full-stack recycling rewards application. It has a React frontend for users, operators, and admins, plus a TypeScript/Express backend that owns authentication, machine sessions, point ledger rules, rewards, vouchers, and reporting.

## High-Level Architecture

```text
Smart Bin / Machine
  -> Backend API
  -> MongoDB

User / Operator / Admin Browser
  -> React Frontend
  -> Backend API
  -> MongoDB
```

The backend is the source of truth. The frontend must not be trusted to calculate points, validate machines, validate QR claim tokens, validate voucher state, or adjust reward inventory.

## Core Product Flow

```text
1. Machine detects recycled items.
2. Machine calls POST /api/contributions with its API key.
3. Backend validates the machine and creates a contribution session.
4. User scans or enters the claim token.
5. Backend validates the token and creates a PointTransaction.
6. User redeems a reward.
7. Backend deducts points and creates a voucher.
8. Operator validates and uses the voucher.
9. Admins review reports and manage catalog data.
```

The most important backend invariant:

```text
Every point balance change must create a PointTransaction.
User.totalPoints is only a cached balance.
```

## Runtime Components

```text
frontend/
  React + TypeScript + Vite
  React Router for pages
  Zustand for client state
  Axios for API calls

backend/
  Node.js + Express + TypeScript
  Mongoose for MongoDB access
  Zod for request validation
  JWT for authentication
  bcryptjs for password, OTP, and API-key hashing
```

## Backend Route Surface

```text
/api/health
/api/auth
/api/users
/api/machines
/api/contributions
/api/points
/api/partners
/api/rewards
/api/wallet
/api/operator
/api/admin
/api/milestones
/api/leaderboard
/api/campaigns
```

## Backend Module Pattern

Most backend modules follow this structure:

```text
routes -> controller -> service -> model
```

Responsibilities:

```text
routes        HTTP paths, auth middleware, role middleware, validation middleware
controller    request parsing and response status/body
service       business rules and database operations
model         Mongoose schema, indexes, persistence constraints
validation    Zod request schemas
```

## Backend File Architecture

```text
backend/
  package.json
  tsconfig.json
  .env.example
  src/
    app.ts
    server.ts
    config/
      constants.ts
      db.ts
      env.ts
    middleware/
      auth.middleware.ts
      error.middleware.ts
      notFound.middleware.ts
      role.middleware.ts
      validate.middleware.ts
    modules/
      admin/
      auth/
      campaigns/
      contributions/
      leaderboard/
      machines/
      milestones/
      operator/
      partners/
      points/
      rewards/
      users/
      vouchers/
    seeds/
      runSeeds.ts
      seedMachines.ts
      seedMilestones.ts
      seedPartners.ts
      seedRewards.ts
      seedUsers.ts
    types/
      common.types.ts
      enums.ts
      express.d.ts
    utils/
      dateRange.ts
      generateCode.ts
      hash.ts
      httpError.ts
      pointRules.ts
      qrToken.ts
      token.ts
```

## Frontend File Architecture

```text
frontend/
  package.json
  tsconfig.json
  tsconfig.node.json
  vite.config.ts
  index.html
  .env.example
  src/
    main.tsx
    app/
      App.tsx
      providers.tsx
      router.tsx
    components/
      common/
      home/
      layout/
      rewards/
      scan/
      wallet/
    pages/
      admin/
      auth/
      operator/
      user/
    services/
      admin.api.ts
      apiClient.ts
      auth.api.ts
      contribution.api.ts
      operator.api.ts
      rewards.api.ts
      user.api.ts
      wallet.api.ts
    store/
      authStore.ts
      uiStore.ts
    styles/
      global.css
      theme.ts
    types/
      contribution.types.ts
      reward.types.ts
      user.types.ts
      voucher.types.ts
```

## Root Project Files

```text
app/
  .editorconfig
  .gitignore
  .prettierrc
  CHANGELOG.md
  CONTRIBUTING.md
  README.md
  SECURITY.md
  SYSTEM_ARCHITECTURE.md
  package.json
  docs/
    api/
      openapi.yaml
  .github/
    workflows/
      ci.yml
  backend/
  frontend/
```

## Security Boundaries

```text
Passwords are hashed.
OTPs are hashed.
Machine API keys are hashed.
Contribution claim tokens are hashed at rest.
Voucher QR tokens are hashed at rest.
Admin routes require admin role.
Operator routes require operator or admin role.
User routes require JWT authentication.
Auth responses must not serialize passwordHash.
```

## Environment Configuration

Backend required environment:

```text
PORT
MONGODB_URI
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
JWT_ACCESS_EXPIRES_IN
JWT_REFRESH_EXPIRES_IN
BCRYPT_SALT_ROUNDS
CLAIM_TOKEN_EXPIRES_MINUTES
OTP_EXPIRES_MINUTES
FRONTEND_ORIGIN
```

Frontend required environment:

```text
VITE_API_URL
```

Local default API URL:

```text
http://localhost:3003/api
```

## Professionalization Status

Present:

```text
Modular backend
Typed frontend
Central API client
Environment examples
Build scripts
CI build workflow
Security and contribution docs
OpenAPI starter document
Repository ignore rules
Editor and formatter defaults
```

Still recommended:

```text
Automated backend unit tests
Automated API integration tests
Frontend component tests
End-to-end tests for claim and redeem flows
ESLint package installation and lint script
Prettier package installation and format script
Rate limiting on auth and OTP routes
Refresh-token persistence and revocation
Structured logging with request IDs
Dockerfiles and docker-compose for local MongoDB
Full OpenAPI coverage for every route
```

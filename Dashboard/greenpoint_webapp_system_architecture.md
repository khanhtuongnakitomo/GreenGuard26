# GreenPoint WebApp — System Architecture, UI Design Notes & User Schema

## 1. Tổng quan sản phẩm

GreenPoint là webapp reward cho hệ thống thùng rác thông minh. Người dùng tái chế chai nhựa/lon tại máy, máy tạo QR code, người dùng scan QR để nhận điểm, sau đó dùng điểm để đổi voucher/phần thưởng từ các partner như ĐHBK, CocaCola, AquaFina, Circle K hoặc các đơn vị liên kết khác.

Core flow của app:

```text
Recycle → Scan QR → Earn Points → Redeem Rewards → Use Voucher
```

App nên được định vị như một **Green Wallet for Recycling**:

- Home page tập trung vào điểm và hành động scan QR.
- Reward page hoạt động như marketplace theo partner.
- Wallet page chứa digital voucher/pass.
- Impact page hiển thị đóng góp cá nhân.
- Backend xử lý theo hướng ledger + voucher validation, không chỉ CRUD đơn giản.

---

## 2. Product architecture tổng thể

App nên chia thành 4 phần lớn:

```text
1. User WebApp
   - Sinh viên/người dùng scan QR, nhận điểm, xem impact, đổi voucher.

2. Operator WebApp
   - Nhân viên bãi xe/căn tin scan hoặc nhập voucher code để xác nhận voucher đã dùng.

3. Admin Dashboard
   - Quản lý partner, reward, user, machine, campaign, report.

4. Backend API
   - Xử lý auth, QR claim, point transaction, reward redeem, voucher validation, leaderboard.
```

Luồng tổng thể:

```text
Smart Bin / Machine
→ tạo contribution session
→ hiển thị QR

User WebApp
→ scan QR
→ gửi claimToken về Backend
→ Backend cộng điểm
→ User đổi điểm lấy reward

Reward Marketplace
→ ĐHBK / CocaCola / AquaFina / Circle K
→ User nhận voucher trong Wallet

Operator
→ scan voucher QR hoặc nhập code
→ xác nhận voucher đã dùng
```

---

## 3. Frontend architecture

### 3.1. Frontend stack đề xuất

```text
React
TypeScript
React Router
TanStack Query hoặc RTK Query
Zustand hoặc Redux Toolkit
TailwindCSS
Recharts
QR Scanner library
```

### 3.2. App roles

```ts
"user"      // sinh viên/người dùng thường
"operator"  // nhân viên bãi xe/căn tin xác nhận voucher
"admin"     // người quản lý hệ thống
```

Phase sau có thể thêm:

```ts
"partner_admin"
```

---

## 4. Frontend page structure

### 4.1. User App routes

```text
/login
/verify-otp
/home
/scan
/impact
/rewards
/rewards/:partnerId
/wallet
/wallet/:voucherId
/history
/leaderboard
/milestones
/profile
```

### 4.2. Operator routes

```text
/operator/login
/operator/redeem
/operator/redeem/:voucherCode
/operator/history
```

### 4.3. Admin routes

```text
/admin/overview
/admin/users
/admin/partners
/admin/rewards
/admin/vouchers
/admin/machines
/admin/contributions
/admin/campaigns
/admin/leaderboard
/admin/reports
```

---

## 5. UI design notes từ mockup hiện tại

UI hiện tại đang đi theo hướng **Google Wallet style**:

```text
White background
Rounded cards
Soft shadow
Card/pass stack
Green theme
Large primary action
Bottom navigation
Reward wallet feeling
```

### 5.1. Theme màu đề xuất

```text
Primary green: #16A34A hoặc #159947
Dark green: #064E3B
Light green background: #ECFDF5
Soft border: #D1FAE5
Text dark: #0F172A
Muted text: #64748B
Warning/yellow: #F59E0B
Reward red: #EF4444
Reward blue: #2563EB
```

### 5.2. UI patterns nên giữ

#### Big point card

Card lớn đầu trang nên có:

```text
Avatar
Tên user
Tổng điểm
Thống kê tháng này
Membership badge
Eco illustration
```

Mục tiêu: người dùng mở app là thấy ngay **điểm hiện tại**.

#### Scan QR card

Nút scan phải là CTA lớn nhất:

```text
Scan QR
to claim points
```

Nên đặt ở Home và cả bottom tab.

#### My Impact cards

Ba card nhỏ:

```text
Month
Year
All time
```

Nên hiển thị:

```text
Bottles
Cans
Points
CO₂ estimate
```

MVP chỉ cần bottles/cans/points.

#### Reward wallet stack

Reward nên hiển thị kiểu pass/card stack:

```text
ĐHBK - Digital parking ticket 2k
ĐHBK - Lunch voucher 35k
CocaCola - Promo code
AquaFina - Free drink at Circle K
```

Cách này hợp với product vì app bản chất là **wallet chứa voucher**.

#### Milestone card

Nên giữ card:

```text
Next milestone: 50 bottles
34 / 50 bottles
Progress bar
```

Đây là gamification nhẹ, dễ hiểu.

---

## 6. Frontend component structure

```text
src/
├── app/
│   ├── App.tsx
│   ├── router.tsx
│   └── providers.tsx
│
├── pages/
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   └── VerifyOtpPage.tsx
│   │
│   ├── user/
│   │   ├── HomePage.tsx
│   │   ├── ScanPage.tsx
│   │   ├── ImpactPage.tsx
│   │   ├── RewardsPage.tsx
│   │   ├── WalletPage.tsx
│   │   ├── HistoryPage.tsx
│   │   ├── LeaderboardPage.tsx
│   │   ├── MilestonesPage.tsx
│   │   └── ProfilePage.tsx
│   │
│   ├── operator/
│   │   └── RedeemVoucherPage.tsx
│   │
│   └── admin/
│       ├── AdminOverviewPage.tsx
│       ├── AdminRewardsPage.tsx
│       ├── AdminPartnersPage.tsx
│       ├── AdminUsersPage.tsx
│       └── AdminReportsPage.tsx
│
├── components/
│   ├── layout/
│   │   ├── MobileShell.tsx
│   │   ├── BottomNav.tsx
│   │   └── PageHeader.tsx
│   │
│   ├── home/
│   │   ├── PointsSummaryCard.tsx
│   │   ├── ScanQRCard.tsx
│   │   ├── ImpactStatCard.tsx
│   │   ├── RewardStack.tsx
│   │   └── MilestoneProgressCard.tsx
│   │
│   ├── rewards/
│   │   ├── RewardCard.tsx
│   │   ├── PartnerFilter.tsx
│   │   └── VoucherCard.tsx
│   │
│   ├── scan/
│   │   ├── QRScanner.tsx
│   │   └── ClaimResultModal.tsx
│   │
│   └── common/
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Badge.tsx
│       └── EmptyState.tsx
│
├── services/
│   ├── auth.api.ts
│   ├── user.api.ts
│   ├── contribution.api.ts
│   ├── rewards.api.ts
│   ├── wallet.api.ts
│   ├── leaderboard.api.ts
│   └── admin.api.ts
│
├── store/
│   ├── authStore.ts
│   └── uiStore.ts
│
├── types/
│   ├── user.types.ts
│   ├── reward.types.ts
│   ├── contribution.types.ts
│   └── voucher.types.ts
│
└── styles/
    └── theme.ts
```

---

## 7. Backend architecture

### 7.1. Backend stack đề xuất

```text
Express
TypeScript
MongoDB Atlas
Mongoose
JWT Auth
bcrypt
OTP service
```

### 7.2. Backend folder structure

```text
backend/
├── src/
│   ├── app.ts
│   ├── server.ts
│   │
│   ├── config/
│   │   ├── db.ts
│   │   ├── env.ts
│   │   └── constants.ts
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── otp.model.ts
│   │   │   └── auth.validation.ts
│   │   │
│   │   ├── users/
│   │   │   ├── user.model.ts
│   │   │   ├── user.routes.ts
│   │   │   ├── user.controller.ts
│   │   │   └── user.service.ts
│   │   │
│   │   ├── machines/
│   │   ├── contributions/
│   │   ├── points/
│   │   ├── partners/
│   │   ├── rewards/
│   │   ├── vouchers/
│   │   ├── milestones/
│   │   ├── leaderboard/
│   │   ├── campaigns/
│   │   └── admin/
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── role.middleware.ts
│   │   ├── error.middleware.ts
│   │   └── validate.middleware.ts
│   │
│   ├── utils/
│   │   ├── token.ts
│   │   ├── qrToken.ts
│   │   ├── points.ts
│   │   └── dateRange.ts
│   │
│   └── types/
│       └── express.d.ts
│
├── package.json
└── .env.example
```

---

## 8. Backend modules

### 8.1. Auth module

Chức năng:

```text
Register
Login bằng password
Request OTP
Verify OTP
Refresh token
Logout
```

API:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/request-otp
POST /api/auth/verify-otp
POST /api/auth/logout
GET  /api/auth/me
```

### 8.2. Contribution module

Đây là module xử lý QR claim từ máy.

Machine tạo session:

```text
POST /api/contributions
```

User claim điểm:

```text
POST /api/contributions/claim
```

Logic:

```text
Machine tạo contribution session
→ Backend tạo claimToken
→ Machine hiển thị QR
→ User scan QR
→ Backend validate token
→ Cộng điểm
→ Session đổi thành claimed
```

### 8.3. Points module

Điểm không nên chỉ lưu trong `user.totalPoints` rồi cộng/trừ trực tiếp. Nên có ledger:

```text
PointTransaction
```

Lý do:

```text
Dễ audit
Dễ kiểm tra tranh chấp
Dễ rollback/refund
Dễ xem lịch sử
```

User `totalPoints` có thể là cached value, nhưng nguồn sự thật nên là transaction ledger.

### 8.4. Rewards module

Chức năng:

```text
List rewards
Filter by partner
Filter by type
Redeem reward
Check reward quantity
```

API:

```text
GET  /api/rewards
GET  /api/rewards/:id
POST /api/rewards/:id/redeem
```

### 8.5. Wallet / Voucher module

Chức năng:

```text
Xem voucher đã đổi
Xem voucher detail
Operator validate voucher
Operator mark voucher as used
```

API:

```text
GET  /api/wallet
GET  /api/wallet/:voucherId
POST /api/vouchers/validate
POST /api/vouchers/use
```

### 8.6. Partner module

Partner gồm:

```text
ĐHBK
CocaCola
AquaFina
Circle K
Canteen
Parking operator
```

API admin:

```text
GET    /api/admin/partners
POST   /api/admin/partners
PATCH  /api/admin/partners/:id
DELETE /api/admin/partners/:id
```

### 8.7. Leaderboard module

Leaderboard cần support:

```text
User leaderboard
Faculty leaderboard
Monthly leaderboard
All-time leaderboard
Campaign leaderboard
```

API:

```text
GET /api/leaderboard/users?period=month
GET /api/leaderboard/faculties?period=month
GET /api/leaderboard/campaigns/:campaignId
```

---

## 9. Main data flow

### 9.1. User scan QR nhận điểm

```text
1. Machine xác nhận có chai/lon hợp lệ.
2. Machine gửi contribution data lên backend.
3. Backend tạo contribution session và claimToken.
4. Machine hiển thị QR chứa claimToken.
5. User mở app scan QR.
6. Frontend gửi claimToken lên backend.
7. Backend kiểm tra token:
   - tồn tại
   - chưa claim
   - chưa hết hạn
   - machine hợp lệ
8. Backend cộng điểm.
9. Backend tạo point transaction.
10. Backend cập nhật contribution session = claimed.
11. Frontend hiển thị nhận điểm thành công.
```

### 9.2. User đổi reward

```text
1. User vào Reward Marketplace.
2. User chọn reward.
3. Backend kiểm tra:
   - user đủ điểm
   - reward còn số lượng
   - reward còn hiệu lực
4. Backend trừ điểm.
5. Backend tạo point transaction type = redeem.
6. Backend tạo UserVoucher.
7. User thấy voucher trong Wallet.
```

### 9.3. Operator xác nhận voucher

```text
1. User mở voucher.
2. Operator scan QR hoặc nhập redeem code.
3. Backend kiểm tra:
   - voucher tồn tại
   - chưa dùng
   - chưa hết hạn
4. Operator xác nhận sử dụng.
5. Backend cập nhật voucher = used.
6. User không thể dùng lại voucher đó.
```

---

## 10. Database collections

Nên có các collection chính:

```text
users
otps
machines
contribution_sessions
point_transactions
partners
rewards
user_vouchers
milestones
user_milestones
campaigns
audit_logs
```

---

## 11. User schema

Đây là schema user nên có cho app.

### 11.1. User fields

```ts
type User = {
  _id: ObjectId;

  // Auth identity
  phoneNumber: string;
  passwordHash?: string;
  authMethods: ("password" | "sms_otp")[];

  // Basic profile
  displayName: string;
  avatarUrl?: string;
  role: "user" | "operator" | "admin" | "partner_admin";

  // University profile
  university?: "ĐHBK" | string;
  faculty?: string;
  className?: string;
  studentId?: string;

  // Points summary
  totalPoints: number;
  lifetimeEarnedPoints: number;
  lifetimeRedeemedPoints: number;

  // Recycling summary cache
  totalBottles: number;
  totalCans: number;
  totalItems: number;

  // Gamification
  currentStreak: number;
  longestStreak: number;
  lastContributionAt?: Date;
  level?: string;
  membershipTier?: "green_member" | "silver" | "gold" | "platinum";

  // Account status
  status: "active" | "inactive" | "banned" | "deleted";
  isPhoneVerified: boolean;

  // Preferences
  notificationSettings: {
    rewardUpdates: boolean;
    campaignUpdates: boolean;
    milestoneUpdates: boolean;
  };

  // Security / audit
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};
```

### 11.2. User Mongoose schema đề xuất

```ts
import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema(
  {
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      required: false,
      select: false,
    },

    authMethods: {
      type: [String],
      enum: ["password", "sms_otp"],
      default: ["sms_otp"],
    },

    displayName: {
      type: String,
      required: true,
      trim: true,
      default: "Green User",
    },

    avatarUrl: {
      type: String,
      required: false,
    },

    role: {
      type: String,
      enum: ["user", "operator", "admin", "partner_admin"],
      default: "user",
      index: true,
    },

    university: {
      type: String,
      default: "ĐHBK",
    },

    faculty: {
      type: String,
      required: false,
      index: true,
    },

    className: {
      type: String,
      required: false,
    },

    studentId: {
      type: String,
      required: false,
      sparse: true,
      index: true,
    },

    totalPoints: {
      type: Number,
      default: 0,
      min: 0,
    },

    lifetimeEarnedPoints: {
      type: Number,
      default: 0,
      min: 0,
    },

    lifetimeRedeemedPoints: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalBottles: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalCans: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalItems: {
      type: Number,
      default: 0,
      min: 0,
    },

    currentStreak: {
      type: Number,
      default: 0,
      min: 0,
    },

    longestStreak: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastContributionAt: {
      type: Date,
    },

    level: {
      type: String,
      default: "Beginner Recycler",
    },

    membershipTier: {
      type: String,
      enum: ["green_member", "silver", "gold", "platinum"],
      default: "green_member",
    },

    status: {
      type: String,
      enum: ["active", "inactive", "banned", "deleted"],
      default: "active",
      index: true,
    },

    isPhoneVerified: {
      type: Boolean,
      default: false,
    },

    notificationSettings: {
      rewardUpdates: {
        type: Boolean,
        default: true,
      },
      campaignUpdates: {
        type: Boolean,
        default: true,
      },
      milestoneUpdates: {
        type: Boolean,
        default: true,
      },
    },

    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export const UserModel = mongoose.model("User", UserSchema);
```

### 11.3. Vì sao User schema cần các field này?

| Field | Lý do |
|---|---|
| `phoneNumber` | Định danh chính cho SMS login |
| `passwordHash` | Hỗ trợ login bằng mật khẩu |
| `authMethods` | Biết user dùng OTP, password hoặc cả hai |
| `displayName` | Hiển thị trên app và leaderboard |
| `role` | Phân quyền user/operator/admin |
| `faculty` | Dùng cho leaderboard theo khoa |
| `studentId` | Dùng nếu sau này verify sinh viên ĐHBK |
| `totalPoints` | Hiển thị nhanh trên Home |
| `lifetimeEarnedPoints` | Thống kê tổng điểm từng kiếm |
| `lifetimeRedeemedPoints` | Thống kê tổng điểm đã dùng |
| `totalBottles`, `totalCans` | Hiển thị My Impact |
| `currentStreak` | Gamification |
| `membershipTier` | Badge như Green Member |
| `status` | Khóa user gian lận hoặc inactive |
| `notificationSettings` | Dùng cho notification sau này |

---

## 12. Other core schemas

### 12.1. Partner schema

```ts
const PartnerSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: ["university", "brand", "retailer", "canteen", "parking"],
      required: true,
    },

    logoUrl: String,

    description: String,

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);
```

### 12.2. Reward schema

```ts
const RewardSchema = new Schema(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
    },

    description: String,

    rewardType: {
      type: String,
      enum: [
        "parking_ticket",
        "meal_voucher",
        "promo_code",
        "free_item",
        "discount",
      ],
      required: true,
    },

    pointsRequired: {
      type: Number,
      required: true,
      min: 0,
    },

    valueVnd: {
      type: Number,
      min: 0,
    },

    quantityTotal: Number,

    quantityRemaining: Number,

    validFrom: Date,

    validUntil: Date,

    terms: {
      type: [String],
      default: [],
    },

    status: {
      type: String,
      enum: ["active", "inactive", "expired"],
      default: "active",
    },
  },
  { timestamps: true }
);
```

### 12.3. ContributionSession schema

```ts
const ContributionSessionSchema = new Schema(
  {
    sessionCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    machineId: {
      type: Schema.Types.ObjectId,
      ref: "Machine",
      required: true,
      index: true,
    },

    items: [
      {
        itemType: {
          type: String,
          enum: ["plastic_bottle", "can"],
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        pointsPerItem: {
          type: Number,
          required: true,
        },
      },
    ],

    totalPoints: {
      type: Number,
      required: true,
      min: 0,
    },

    claimTokenHash: {
      type: String,
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["unclaimed", "claimed", "expired", "cancelled"],
      default: "unclaimed",
      index: true,
    },

    claimedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    claimedAt: Date,

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);
```

### 12.4. PointTransaction schema

```ts
const PointTransactionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["earn", "redeem", "refund", "bonus", "adjustment"],
      required: true,
    },

    points: {
      type: Number,
      required: true,
    },

    source: {
      type: String,
      enum: [
        "qr_claim",
        "reward_redeem",
        "campaign_bonus",
        "admin_adjustment",
        "refund",
      ],
      required: true,
    },

    description: String,

    contributionSessionId: {
      type: Schema.Types.ObjectId,
      ref: "ContributionSession",
    },

    rewardId: {
      type: Schema.Types.ObjectId,
      ref: "Reward",
    },
  },
  { timestamps: true }
);
```

### 12.5. UserVoucher schema

```ts
const UserVoucherSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    rewardId: {
      type: Schema.Types.ObjectId,
      ref: "Reward",
      required: true,
      index: true,
    },

    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
      index: true,
    },

    redeemCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    qrTokenHash: {
      type: String,
      required: true,
    },

    pointsUsed: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["unused", "used", "expired", "cancelled"],
      default: "unused",
      index: true,
    },

    issuedAt: {
      type: Date,
      default: Date.now,
    },

    usedAt: Date,

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    usedLocation: String,

    usedByOperator: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);
```

---

## 13. API contract tối giản cho MVP

### Auth

```text
POST /api/auth/request-otp
POST /api/auth/verify-otp
POST /api/auth/login
GET  /api/auth/me
```

### User Home

```text
GET /api/users/me
GET /api/users/me/summary
GET /api/users/me/history
```

### Scan QR / Claim

```text
POST /api/contributions
POST /api/contributions/claim
```

### Rewards

```text
GET  /api/rewards
GET  /api/rewards/:id
POST /api/rewards/:id/redeem
```

### Wallet

```text
GET  /api/wallet
GET  /api/wallet/:voucherId
```

### Operator

```text
POST /api/operator/vouchers/validate
POST /api/operator/vouchers/use
```

### Leaderboard

```text
GET /api/leaderboard/users?period=month
GET /api/leaderboard/faculties?period=month
```

---

## 14. MVP build plan

### Phase 1 — User core

Build trước:

```text
Login
Home
Scan QR
Claim points
Point history
Reward list
Redeem reward
Wallet
```

### Phase 2 — Operator

Build:

```text
Operator login
Validate voucher
Use voucher
Operator history
```

### Phase 3 — Admin

Build:

```text
Admin overview
Manage partner
Manage rewards
View users
View contributions
View redemptions
```

### Phase 4 — Gamification

Build:

```text
My Impact
Milestones
Leaderboard
Faculty challenge
Campaign
```

---

## 15. Điểm cần chú ý khi build

### 15.1. Không lưu điểm chỉ bằng một field

Không nên chỉ có:

```ts
user.totalPoints += 50;
```

Phải có thêm:

```text
PointTransaction
```

Vì nếu user khiếu nại, mình còn có lịch sử.

### 15.2. QR claim không được chứa điểm trực tiếp

Không nên:

```text
QR = 50 points
```

Nên:

```text
QR = claimToken
```

Backend tự kiểm tra session.

### 15.3. Voucher không được dùng lại

Voucher cần có trạng thái:

```text
unused
used
expired
cancelled
```

Một voucher chỉ được chuyển từ `unused` sang `used` đúng một lần.

### 15.4. User summary có thể cache

Home page cần load nhanh, nên các field như:

```text
totalPoints
totalBottles
totalCans
```

có thể cache trong `users`.

Nhưng vẫn nên có transaction/event làm source of truth.

---

## 16. Final recommended architecture

```text
React TypeScript WebApp
│
├── User App
│   ├── Home
│   ├── Scan QR
│   ├── Rewards
│   ├── Wallet
│   ├── Impact
│   └── Profile
│
├── Operator App
│   └── Validate Voucher
│
└── Admin Dashboard
    ├── Users
    ├── Partners
    ├── Rewards
    ├── Machines
    └── Reports

        ↓ HTTP API

Express TypeScript Backend
│
├── Auth Module
├── User Module
├── Contribution Module
├── Point Transaction Module
├── Reward Module
├── Voucher Module
├── Partner Module
├── Leaderboard Module
└── Admin Module

        ↓

MongoDB Atlas
│
├── users
├── machines
├── contribution_sessions
├── point_transactions
├── partners
├── rewards
├── user_vouchers
├── milestones
├── campaigns
└── audit_logs
```

---

## 17. Kết luận

Với UI hiện tại, hướng đúng nhất là xây dựng GreenPoint như một **Green Wallet for Recycling**.

Thiết kế app nên giữ cảm giác:

```text
Eco-friendly
Clean
Rounded card
Soft shadow
Wallet/pass stack
Scan-first interaction
Reward marketplace
```

Backend nên được thiết kế theo tư duy:

```text
QR claim token
Point ledger
Voucher validation
Partner reward marketplace
Admin/operator workflow
```

Làm chắc các flow này trước, app sẽ có giá trị thật và dễ mở rộng sang milestone, leaderboard, campaign và partner analytics.

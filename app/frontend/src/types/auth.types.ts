/**
 * GreenGuard — TypeScript Types: Auth
 */

export interface SignInCredentials {
  phoneNumber: string;
  password: string;
  agreedToTerms: boolean;
}

export interface SignUpCredentials {
  phoneNumber: string;
  password: string;
  displayName: string;
  agreedToTerms: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUserDto {
  _id: string;
  phoneNumber: string;
  displayName: string;
  avatar?: string;
  role: string;
  totalPoints: number;
  lifetimeEarnedPoints: number;
  lifetimeRedeemedPoints: number;
  totalBottles: number;
  totalCans: number;
  totalCarton?: number;
  totalItems: number;
  membershipTier: string;
  className?: string;
  studentId?: string;
  currentStreak?: number;
  longestStreak?: number;
  lastContributionAt?: string;
  notificationSettings?: {
    rewardUpdates: boolean;
    campaignUpdates: boolean;
    milestoneUpdates: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  user: AuthUserDto;
  accessToken: string;
  refreshToken: string;
}

export interface OtpRequestResponse {
  phoneNumber: string;
  expiresAt: string;
  devOtp?: string;
}

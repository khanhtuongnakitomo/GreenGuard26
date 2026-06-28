/**
 * GreenGuard — TypeScript Types: Auth
 */

export interface SignInCredentials {
  email: string;
  password: string;
  agreedToTerms: boolean;
}

export interface SignUpCredentials {
  email: string;
  password: string;
  username: string;
  agreedToTerms: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  tokens: AuthTokens;
  userId: string;
}

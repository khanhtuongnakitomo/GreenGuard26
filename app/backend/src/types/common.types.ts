import type { UserRole } from "./enums";

export type AuthUser = {
  id: string;
  role: UserRole;
  displayName: string;
  phoneNumber: string;
};

export type ApiResponse<T> = {
  data: T;
};

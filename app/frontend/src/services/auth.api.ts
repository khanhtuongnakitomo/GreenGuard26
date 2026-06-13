import { apiClient } from "./apiClient";

export async function login(phoneNumber: string, password: string) {
  const { data } = await apiClient.post("/auth/login", { phoneNumber, password });
  return data;
}

export async function getMe() {
  const { data } = await apiClient.get("/auth/me");
  return data;
}

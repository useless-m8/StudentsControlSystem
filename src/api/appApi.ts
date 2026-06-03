import { apiClient } from "./axios";
import type { AppData } from "../types/app";
import type { AuthResponse } from "../types/student";

export type RegisterGroupOption = {
  id: number;
  name: string;
  specialityId: number;
  specialityName: string;
};

export type RegisterEducationFormOption = {
  id: number;
  name: string;
};

export type RegisterPayload = {
  login: string;
  password: string;
  lastName: string;
  firstName: string;
  middleName: string;
  admissionYear: number;
  educationFormId: number;
  groupId: number;
};

export async function loadAppData() {
  const response = await apiClient.get<AppData>("/app-data");
  return response.data;
}

export async function login(loginValue: string, password: string) {
  const response = await apiClient.post<AuthResponse>("/auth/login", {
    login: loginValue,
    password,
  });
  return response.data;
}

export async function register(payload: RegisterPayload) {
  const response = await apiClient.post<AuthResponse>("/auth/register", payload);
  return response.data;
}

export async function loadRegisterOptions() {
  const response = await apiClient.get<{
    groups: RegisterGroupOption[];
    educationForms: RegisterEducationFormOption[];
  }>("/auth/register-options");
  return response.data;
}

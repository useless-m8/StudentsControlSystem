import { apiClient } from "./axios";
import type { Role, User } from "../types/student";

export type UserPayload = {
  login: string;
  lastName: string;
  firstName: string;
  middleName: string;
  password?: string;
  role: Role;
  groupId: number | null;
  groupIds: number[];
  disciplineId: number | null;
  disciplineIds: number[];
};

export async function loadUsers() {
  const response = await apiClient.get<User[]>("/users");
  return response.data;
}

export async function createUser(payload: UserPayload) {
  const response = await apiClient.post<User>("/users", payload);
  return response.data;
}

export async function updateUser(id: number, payload: UserPayload) {
  const response = await apiClient.put<User>(`/users/${id}`, payload);
  return response.data;
}

export async function deleteUser(id: number) {
  await apiClient.delete(`/users/${id}`);
}

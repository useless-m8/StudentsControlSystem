import { apiClient } from "./axios";
import type { StudentGroup } from "../types/group";

export async function createGroup(group: Omit<StudentGroup, "id">) {
  const response = await apiClient.post<StudentGroup>("/groups", group);
  return response.data;
}

export async function updateGroup(id: number, group: Omit<StudentGroup, "id">) {
  const response = await apiClient.put<StudentGroup>(`/groups/${id}`, group);
  return response.data;
}

export async function deleteGroup(id: number) {
  await apiClient.delete(`/groups/${id}`);
}

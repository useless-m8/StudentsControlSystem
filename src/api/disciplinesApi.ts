import { apiClient } from "./axios";
import type { NamedItem } from "../types/student";

export type DirectoryKind = "specialities" | "educationForms" | "disciplines";

export async function createDirectoryItem(kind: DirectoryKind, name: string) {
  const response = await apiClient.post<NamedItem>(`/directories/${kind}`, { name });
  return response.data;
}

export async function updateDirectoryItem(kind: DirectoryKind, id: number, name: string) {
  const response = await apiClient.put<NamedItem>(`/directories/${kind}/${id}`, { name });
  return response.data;
}

export async function deleteDirectoryItem(kind: DirectoryKind, id: number) {
  await apiClient.delete(`/directories/${kind}/${id}`);
}

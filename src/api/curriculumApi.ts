import { apiClient } from "./axios";
import type { Curriculum } from "../types/curriculum";

export async function createCurriculumItem(item: Curriculum) {
  const response = await apiClient.post<Curriculum>("/curriculum", item);
  return response.data;
}

export async function updateCurriculumItem(id: number, item: Curriculum) {
  const response = await apiClient.put<Curriculum>(`/curriculum/${id}`, item);
  return response.data;
}

export async function deleteCurriculumItem(id: number) {
  await apiClient.delete(`/curriculum/${id}`);
}

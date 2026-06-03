import { apiClient } from "./axios";
import type { PerformanceRecord } from "../types/perfomance";

export async function createPerformanceRecord(record: PerformanceRecord) {
  const response = await apiClient.post<PerformanceRecord>("/performance", record);
  return response.data;
}

export async function updatePerformanceRecord(id: number, record: PerformanceRecord) {
  const response = await apiClient.put<PerformanceRecord>(`/performance/${id}`, record);
  return response.data;
}

export async function deletePerformanceRecord(id: number) {
  await apiClient.delete(`/performance/${id}`);
}

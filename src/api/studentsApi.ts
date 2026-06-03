import { apiClient } from "./axios";
import type { Student } from "../types/student";

export async function createStudent(student: Student) {
  const response = await apiClient.post<Student>("/students", student);
  return response.data;
}

export async function updateStudent(id: number, student: Student) {
  const response = await apiClient.put<Student>(`/students/${id}`, student);
  return response.data;
}

export async function deleteStudent(id: number) {
  await apiClient.delete(`/students/${id}`);
}

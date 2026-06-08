export type Role = "admin" | "education_staff" | "teacher";

export type User = {
  id: number;
  login: string;
  lastName: string;
  firstName: string;
  middleName: string;
  role: Role;
  groupId: number | null;
  groupIds: number[];
  studentId: number | null;
  disciplineId: number | null;
  disciplineIds: number[];
};

export type AuthResponse = {
  user: User;
  token: string;
};

export type NamedItem = {
  id: number;
  name: string;
};

export type Student = {
  id: number;
  lastName: string;
  firstName: string;
  middleName: string;
  admissionYear: number;
  educationFormId: number;
  groupId: number;
};

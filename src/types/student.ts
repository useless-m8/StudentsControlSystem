export type Role = "admin" | "user";

export type User = {
  id: number;
  login: string;
  role: Role;
  groupId: number | null;
  studentId: number | null;
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

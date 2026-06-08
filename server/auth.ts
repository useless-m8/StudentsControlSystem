import jwt from "jsonwebtoken";

export type Role = "admin" | "education_staff" | "teacher";

export type AuthUser = {
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

export function createAuthToken(user: AuthUser, secret: string) {
  return jwt.sign(user, secret, { expiresIn: "8h" });
}

export function verifyAuthToken(token: string, secret: string) {
  return jwt.verify(token, secret) as AuthUser;
}

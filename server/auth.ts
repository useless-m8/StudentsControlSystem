import jwt from "jsonwebtoken";

export type Role = "admin" | "user";

export type AuthUser = {
  id: number;
  login: string;
  role: Role;
  groupId: number | null;
  studentId: number | null;
};

export function createAuthToken(user: AuthUser, secret: string) {
  return jwt.sign(user, secret, { expiresIn: "8h" });
}

export function verifyAuthToken(token: string, secret: string) {
  return jwt.verify(token, secret) as AuthUser;
}

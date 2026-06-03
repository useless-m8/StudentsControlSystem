import type { AuthUser } from "./auth.js";

export type DataScope = {
  groupScope: number | null;
  studentScope: number | null;
};

export function getDataScope(user: AuthUser): DataScope {
  if (user.role === "admin") {
    return {
      groupScope: null,
      studentScope: null,
    };
  }

  return {
    groupScope: user.groupId,
    studentScope: user.studentId,
  };
}

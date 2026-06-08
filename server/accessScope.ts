import type { AuthUser } from "./auth.js";

export type DataScope = {
  groupScope: number[] | null;
  studentScope: number | null;
  disciplineScope: number[] | null;
};

export function getDataScope(user: AuthUser): DataScope {
  if (user.role === "admin" || user.role === "education_staff") {
    return {
      groupScope: null,
      studentScope: null,
      disciplineScope: null,
    };
  }

  if (user.role === "teacher") {
    return {
      groupScope: user.groupIds.length > 0 ? user.groupIds : [-1],
      studentScope: null,
      disciplineScope: user.disciplineIds.length > 0 ? user.disciplineIds : [-1],
    };
  }

  return {
    groupScope: null,
    studentScope: null,
    disciplineScope: null,
  };
}

import { describe, expect, it } from "vitest";
import { getDataScope } from "../../server/accessScope.js";
import type { AuthUser } from "../../server/auth.js";

describe("Server / Разграничение доступа", () => {
  it("администратор видит все группы и всех студентов", () => {
    const admin: AuthUser = {
      id: 1,
      login: "admin",
      role: "admin",
      groupId: null,
      studentId: null,
    };

    expect(getDataScope(admin)).toEqual({
      groupScope: null,
      studentScope: null,
    });
  });

  it("студент ограничивается своей группой", () => {
    const student: AuthUser = {
      id: 2,
      login: "ivanov",
      role: "user",
      groupId: 3,
      studentId: 7,
    };

    expect(getDataScope(student).groupScope).toBe(3);
  });

  it("студент ограничивается своей записью студента", () => {
    const student: AuthUser = {
      id: 2,
      login: "ivanov",
      role: "user",
      groupId: 3,
      studentId: 7,
    };

    expect(getDataScope(student).studentScope).toBe(7);
  });

  it("не подставляет чужую группу для администратора даже если groupId задан", () => {
    const admin: AuthUser = {
      id: 1,
      login: "admin",
      role: "admin",
      groupId: 99,
      studentId: 100,
    };

    expect(getDataScope(admin).groupScope).toBeNull();
  });

  it("корректно возвращает пустой studentScope для пользователя без связанной записи", () => {
    const student: AuthUser = {
      id: 3,
      login: "new-student",
      role: "user",
      groupId: 4,
      studentId: null,
    };

    expect(getDataScope(student)).toEqual({
      groupScope: 4,
      studentScope: null,
    });
  });
});

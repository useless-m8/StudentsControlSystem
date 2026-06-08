import { describe, expect, it } from "vitest";
import { createAuthToken, verifyAuthToken, type AuthUser } from "../../server/auth.js";

const user: AuthUser = {
  id: 10,
  login: "teacher",
  lastName: "Кузнецов",
  firstName: "Андрей",
  middleName: "Викторович",
  role: "teacher",
  groupId: 1,
  groupIds: [1, 2],
  studentId: null,
  disciplineId: 2,
  disciplineIds: [2, 3],
};

describe("Server / JWT авторизация", () => {
  it("создает JWT и восстанавливает из него id пользователя", () => {
    const token = createAuthToken(user, "test-secret");
    const decoded = verifyAuthToken(token, "test-secret");

    expect(decoded.id).toBe(user.id);
  });

  it("сохраняет роль пользователя в JWT", () => {
    const token = createAuthToken(user, "test-secret");
    const decoded = verifyAuthToken(token, "test-secret");

    expect(decoded.role).toBe("teacher");
  });

  it("сохраняет привязку преподавателя к дисциплинам в JWT", () => {
    const token = createAuthToken(user, "test-secret");
    const decoded = verifyAuthToken(token, "test-secret");

    expect(decoded.disciplineIds).toEqual([2, 3]);
  });

  it("сохраняет привязку преподавателя к группам в JWT", () => {
    const token = createAuthToken(user, "test-secret");
    const decoded = verifyAuthToken(token, "test-secret");

    expect(decoded.groupIds).toEqual([1, 2]);
  });

  it("не принимает токен, подписанный другим секретом", () => {
    const token = createAuthToken(user, "test-secret");

    expect(() => verifyAuthToken(token, "wrong-secret")).toThrow();
  });

  it("не принимает поврежденный токен", () => {
    expect(() => verifyAuthToken("broken.token.value", "test-secret")).toThrow();
  });
});

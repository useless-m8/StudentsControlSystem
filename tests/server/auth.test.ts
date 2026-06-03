import { describe, expect, it } from "vitest";
import { createAuthToken, verifyAuthToken, type AuthUser } from "../../server/auth.js";

const user: AuthUser = {
  id: 10,
  login: "student",
  role: "user",
  groupId: 2,
  studentId: 15,
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

    expect(decoded.role).toBe("user");
  });

  it("сохраняет привязку к группе и студенту в JWT", () => {
    const token = createAuthToken(user, "test-secret");
    const decoded = verifyAuthToken(token, "test-secret");

    expect(decoded.groupId).toBe(2);
    expect(decoded.studentId).toBe(15);
  });

  it("не принимает токен, подписанный другим секретом", () => {
    const token = createAuthToken(user, "test-secret");

    expect(() => verifyAuthToken(token, "wrong-secret")).toThrow();
  });

  it("не принимает поврежденный токен", () => {
    expect(() => verifyAuthToken("broken.token.value", "test-secret")).toThrow();
  });
});

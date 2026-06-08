import { describe, expect, it } from "vitest";
import { getDataScope } from "../../server/accessScope.js";
import type { AuthUser } from "../../server/auth.js";

describe("Server / access scope", () => {
  it("admin sees all groups, students and disciplines", () => {
    const admin: AuthUser = {
      id: 1,
      login: "admin",
      lastName: "Системный",
      firstName: "Администратор",
      middleName: "",
      role: "admin",
      groupId: null,
      groupIds: [],
      studentId: null,
      disciplineId: null,
      disciplineIds: [],
    };

    expect(getDataScope(admin)).toEqual({
      groupScope: null,
      studentScope: null,
      disciplineScope: null,
    });
  });

  it("education staff is not limited by a discipline or group", () => {
    const staff: AuthUser = {
      id: 2,
      login: "staff",
      lastName: "Смирнова",
      firstName: "Мария",
      middleName: "Алексеевна",
      role: "education_staff",
      groupId: 4,
      groupIds: [4],
      studentId: 10,
      disciplineId: 5,
      disciplineIds: [5],
    };

    expect(getDataScope(staff)).toEqual({
      groupScope: null,
      studentScope: null,
      disciplineScope: null,
    });
  });

  it("teacher is limited by assigned disciplines", () => {
    const teacher: AuthUser = {
      id: 3,
      login: "teacher",
      lastName: "Кузнецов",
      firstName: "Андрей",
      middleName: "Викторович",
      role: "teacher",
      groupId: 4,
      groupIds: [4, 6],
      studentId: null,
      disciplineId: 5,
      disciplineIds: [5, 8],
    };

    expect(getDataScope(teacher).disciplineScope).toEqual([5, 8]);
  });

  it("teacher is limited by assigned groups", () => {
    const teacher: AuthUser = {
      id: 3,
      login: "teacher",
      lastName: "Кузнецов",
      firstName: "Андрей",
      middleName: "Викторович",
      role: "teacher",
      groupId: 4,
      groupIds: [4, 6],
      studentId: null,
      disciplineId: 5,
      disciplineIds: [5],
    };

    expect(getDataScope(teacher).groupScope).toEqual([4, 6]);
  });

  it("teacher without assigned scope does not get broad access", () => {
    const teacher: AuthUser = {
      id: 3,
      login: "teacher",
      lastName: "Кузнецов",
      firstName: "Андрей",
      middleName: "Викторович",
      role: "teacher",
      groupId: null,
      groupIds: [],
      studentId: null,
      disciplineId: null,
      disciplineIds: [],
    };

    expect(getDataScope(teacher)).toEqual({
      groupScope: [-1],
      studentScope: null,
      disciplineScope: [-1],
    });
  });

  it("does not apply user scope to admin even when ids are set", () => {
    const admin: AuthUser = {
      id: 1,
      login: "admin",
      lastName: "Системный",
      firstName: "Администратор",
      middleName: "",
      role: "admin",
      groupId: 99,
      groupIds: [99],
      studentId: 100,
      disciplineId: 7,
      disciplineIds: [7],
    };

    expect(getDataScope(admin)).toEqual({
      groupScope: null,
      studentScope: null,
      disciplineScope: null,
    });
  });
});

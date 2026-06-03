import { describe, expect, it } from "vitest";
import type { AppData } from "../../src/types/app";
import { buildReportRows, filterStudentsByGroup } from "../../src/pages/reportUtils";

const data: AppData = {
  educationForms: [{ id: 1, name: "Очная" }],
  specialities: [{ id: 1, name: "Информационные системы" }],
  disciplines: [
    { id: 1, name: "Базы данных" },
    { id: 2, name: "Математика" },
  ],
  groups: [
    { id: 1, name: "ИС-22", specialityId: 1 },
    { id: 2, name: "ИС-23", specialityId: 1 },
  ],
  students: [
    {
      id: 1,
      lastName: "Иванов",
      firstName: "Иван",
      middleName: "Петрович",
      admissionYear: 2022,
      educationFormId: 1,
      groupId: 1,
    },
    {
      id: 2,
      lastName: "Петрова",
      firstName: "Анна",
      middleName: "Сергеевна",
      admissionYear: 2023,
      educationFormId: 1,
      groupId: 2,
    },
    {
      id: 3,
      lastName: "Сидоров",
      firstName: "Павел",
      middleName: "Игоревич",
      admissionYear: 2024,
      educationFormId: 1,
      groupId: 1,
    },
  ],
  curriculum: [],
  performance: [
    { id: 1, studentId: 1, disciplineId: 1, studyYear: 2024, semester: 1, grade: "5" },
    { id: 2, studentId: 1, disciplineId: 2, studyYear: 2024, semester: 1, grade: "3" },
    { id: 3, studentId: 1, disciplineId: 2, studyYear: 2024, semester: 2, grade: "Незачет" },
    { id: 4, studentId: 2, disciplineId: 1, studyYear: 2024, semester: 1, grade: "2" },
  ],
};

describe("Client / Отчеты по успеваемости", () => {
  it("возвращает всех студентов при фильтре all", () => {
    expect(filterStudentsByGroup(data, "all")).toHaveLength(3);
  });

  it("фильтрует студентов по конкретной группе", () => {
    const students = filterStudentsByGroup(data, "1");

    expect(students.map((student) => student.lastName)).toEqual(["Иванов", "Сидоров"]);
  });

  it("возвращает пустой список для несуществующей группы", () => {
    expect(filterStudentsByGroup(data, "999")).toHaveLength(0);
  });

  it("считает количество оценок студента", () => {
    const [row] = buildReportRows(data, [data.students[0]]);

    expect(row.recordsCount).toBe(3);
  });

  it("считает средний балл только по числовым оценкам", () => {
    const [row] = buildReportRows(data, [data.students[0]]);

    expect(row.averageGrade).toBe("4.00");
  });

  it("считает незачет как задолженность", () => {
    const [row] = buildReportRows(data, [data.students[0]]);

    expect(row.debts).toBe(1);
  });

  it("считает двойку как задолженность и числовую оценку", () => {
    const [row] = buildReportRows(data, [data.students[1]]);

    expect(row.averageGrade).toBe("2.00");
    expect(row.debts).toBe(1);
  });

  it("показывает прочерк среднего балла, если оценок нет", () => {
    const [row] = buildReportRows(data, [data.students[2]]);

    expect(row.recordsCount).toBe(0);
    expect(row.averageGrade).toBe("-");
    expect(row.debts).toBe(0);
  });
});

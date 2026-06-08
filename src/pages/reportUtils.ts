import type { AppData } from "../types/app";
import type { Student } from "../types/student";

export type ReportRow = {
  student: Student;
  recordsCount: number;
  averageGrade: string;
  debts: number;
};

export type ReportSummary = {
  studentsCount: number;
  disciplinesCount: number;
  gradesCount: number;
};

export function filterStudentsByGroup(data: AppData, selectedGroupId: string) {
  return data.students.filter((student) => {
    return selectedGroupId === "all" || student.groupId === Number(selectedGroupId);
  });
}

export function buildReportSummary(data: AppData, students: Student[]): ReportSummary {
  const studentIds = new Set(students.map((student) => student.id));
  const records = data.performance.filter((record) => studentIds.has(record.studentId));
  const disciplineIds = new Set(records.map((record) => record.disciplineId));

  return {
    studentsCount: students.length,
    disciplinesCount: disciplineIds.size,
    gradesCount: records.length,
  };
}

export function buildReportRows(data: AppData, students: Student[]): ReportRow[] {
  return students.map((student) => {
    const records = data.performance.filter((record) => record.studentId === student.id);
    const numericGrades = records
      .map((record) => Number(record.grade))
      .filter((grade) => !Number.isNaN(grade));
    const averageGrade = numericGrades.length
      ? (numericGrades.reduce((sum, grade) => sum + grade, 0) / numericGrades.length).toFixed(2)
      : "-";
    const debts = records.filter((record) => record.grade === "2" || record.grade === "Незачет").length;

    return {
      student,
      recordsCount: records.length,
      averageGrade,
      debts,
    };
  });
}

import type { Curriculum } from "./curriculum";
import type { Discipline, EducationForm, Speciality } from "./discipline";
import type { StudentGroup } from "./group";
import type { PerformanceRecord } from "./perfomance";
import type { Student } from "./student";

export type AppData = {
  educationForms: EducationForm[];
  specialities: Speciality[];
  disciplines: Discipline[];
  groups: StudentGroup[];
  students: Student[];
  curriculum: Curriculum[];
  performance: PerformanceRecord[];
};

export const emptyData: AppData = {
  educationForms: [],
  specialities: [],
  disciplines: [],
  groups: [],
  students: [],
  curriculum: [],
  performance: [],
};

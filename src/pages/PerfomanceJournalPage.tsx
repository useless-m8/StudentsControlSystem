import { useState } from "react";
import { createPerformanceRecord, deletePerformanceRecord, updatePerformanceRecord } from "../api/perfomanceApi";
import { getErrorMessage } from "../api/axios";
import { Button } from "../components/Button";
import { DataTable } from "../components/DataTable";
import { Header } from "../components/Header";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import type { AppData } from "../types/app";
import type { Curriculum } from "../types/curriculum";
import type { PerformanceRecord } from "../types/perfomance";

type PerfomanceJournalPageProps = {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  isAdmin: boolean;
};

type GroupFilter = number | "all";

const numericGrades = ["5", "4", "3", "2"];
const passFailGrades = ["Зачет", "Незачет"];

export function PerfomanceJournalPage({ data, setData, isAdmin }: PerfomanceJournalPageProps) {
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const [form, setForm] = useState<PerformanceRecord>({
    id: 0,
    studentId: data.students[0]?.id || 1,
    disciplineId: data.disciplines[0]?.id || 1,
    studyYear: new Date().getFullYear(),
    semester: 1,
    grade: "5",
  });
  const [editingId, setEditingId] = useState<number | null>(null);

  function getStudentSpecialityId(studentId: number) {
    const student = data.students.find((item) => item.id === studentId);
    const group = data.groups.find((item) => item.id === student?.groupId);
    return group?.specialityId || null;
  }

  function getCurriculumOptions(studentId: number, disciplineId: number) {
    const specialityId = getStudentSpecialityId(studentId);
    if (!specialityId) return [];

    return data.curriculum
      .filter((item) => item.specialityId === specialityId && item.disciplineId === disciplineId)
      .sort((left, right) => left.semester - right.semester);
  }

  function getReportType(studentId: number, disciplineId: number, semester: number) {
    return getCurriculumOptions(studentId, disciplineId).find((item) => item.semester === semester)?.reportType || null;
  }

  function getGradeOptions(reportType: string | null) {
    return reportType === "Зачет" ? passFailGrades : numericGrades;
  }

  function normalizeForm(nextForm: PerformanceRecord) {
    const curriculumOptions = getCurriculumOptions(nextForm.studentId, nextForm.disciplineId);
    const semesterExists = curriculumOptions.some((item) => item.semester === nextForm.semester);
    const formWithSemester = curriculumOptions.length > 0 && !semesterExists
      ? { ...nextForm, semester: curriculumOptions[0].semester }
      : nextForm;
    const reportType = getReportType(
      formWithSemester.studentId,
      formWithSemester.disciplineId,
      formWithSemester.semester
    );
    const gradeOptions = getGradeOptions(reportType);

    return gradeOptions.includes(formWithSemester.grade)
      ? formWithSemester
      : { ...formWithSemester, grade: gradeOptions[0] };
  }

  function updateForm(patch: Partial<PerformanceRecord>) {
    setForm((prev) => normalizeForm({ ...prev, ...patch }));
  }

  const filteredStudents = groupFilter === "all"
    ? data.students
    : data.students.filter((student) => student.groupId === groupFilter);
  const filteredPerformance = data.performance.filter((record) => {
    if (groupFilter === "all") return true;
    const student = data.students.find((item) => item.id === record.studentId);
    return student?.groupId === groupFilter;
  });
  const curriculumOptions = getCurriculumOptions(form.studentId, form.disciplineId);
  const currentReportType = getReportType(form.studentId, form.disciplineId, form.semester);
  const gradeOptions = getGradeOptions(currentReportType);
  const canSubmit = filteredStudents.length > 0 && data.disciplines.length > 0 && Boolean(currentReportType);

  function handleGroupFilterChange(value: string) {
    const nextFilter: GroupFilter = value === "all" ? "all" : Number(value);
    const nextStudents = nextFilter === "all"
      ? data.students
      : data.students.filter((student) => student.groupId === nextFilter);

    setGroupFilter(nextFilter);
    if (nextStudents.length > 0 && !nextStudents.some((student) => student.id === form.studentId)) {
      updateForm({ studentId: nextStudents[0].id });
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    try {
      if (editingId) {
        const saved = await updatePerformanceRecord(editingId, form);
        setData((prev) => ({
          ...prev,
          performance: prev.performance.map((item) => (item.id === editingId ? saved : item)),
        }));
      } else {
        const saved = await createPerformanceRecord(form);
        setData((prev) => ({ ...prev, performance: [...prev.performance, saved] }));
      }
      setEditingId(null);
    } catch (error) {
      alert(getErrorMessage(error));
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Удалить оценку?")) return;
    try {
      await deletePerformanceRecord(id);
      setData((prev) => ({ ...prev, performance: prev.performance.filter((item) => item.id !== id) }));
    } catch (error) {
      alert(getErrorMessage(error));
    }
  }

  function getRecordReportType(record: PerformanceRecord) {
    return getReportType(record.studentId, record.disciplineId, record.semester);
  }

  function getRecordDiscipline(record: PerformanceRecord) {
    return data.disciplines.find((item) => item.id === record.disciplineId);
  }

  function getRecordStudent(record: PerformanceRecord) {
    return data.students.find((item) => item.id === record.studentId);
  }

  function handleEdit(record: PerformanceRecord) {
    setForm(normalizeForm(record));
    setEditingId(record.id);
  }

  return (
    <section>
      <Header
        title="Журнал успеваемости"
        text="Оценки заполняются с учетом семестра и формы отчетности из учебного плана."
      />

      <div className="filters">
        <label className="field-stack">
          <span>Группа</span>
          <Select value={groupFilter} onChange={(event) => handleGroupFilterChange(event.target.value)}>
            <option value="all">Все группы</option>
            {data.groups.map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </Select>
        </label>
      </div>

      {isAdmin && (
        <>
          {curriculumOptions.length === 0 && (
            <div className="notice">Для выбранного студента и дисциплины нет записи в учебном плане.</div>
          )}
          <form className="card form-grid" onSubmit={handleSubmit}>
            <label className="field-stack">
              <span>Студент</span>
              <Select value={form.studentId} onChange={(event) => updateForm({ studentId: Number(event.target.value) })}>
                {filteredStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.lastName} {student.firstName} {student.middleName}
                  </option>
                ))}
              </Select>
            </label>
            <label className="field-stack">
              <span>Дисциплина</span>
              <Select value={form.disciplineId} onChange={(event) => updateForm({ disciplineId: Number(event.target.value) })}>
                {data.disciplines.map((discipline) => (
                  <option key={discipline.id} value={discipline.id}>{discipline.name}</option>
                ))}
              </Select>
            </label>
            <label className="field-stack">
              <span>Учебный год</span>
              <Input type="number" placeholder="Например, 2026" value={form.studyYear} onChange={(event) => updateForm({ studyYear: Number(event.target.value) })} />
            </label>
            <label className="field-stack">
              <span>Семестр</span>
              <Select
                value={curriculumOptions.length > 0 ? form.semester : ""}
                disabled={curriculumOptions.length === 0}
                onChange={(event) => updateForm({ semester: Number(event.target.value) })}
              >
                {curriculumOptions.length === 0 ? (
                  <option value="">Нет доступных семестров</option>
                ) : (
                  curriculumOptions.map((item: Curriculum) => (
                    <option key={item.id} value={item.semester}>{item.semester}</option>
                  ))
                )}
              </Select>
            </label>
            <label className="field-stack">
              <span>Форма отчетности</span>
              <Input value={currentReportType || "Не найдена"} disabled />
            </label>
            <label className="field-stack">
              <span>Оценка</span>
              <Select value={form.grade} onChange={(event) => updateForm({ grade: event.target.value })}>
                {gradeOptions.map((grade) => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </Select>
            </label>
            <Button type="submit" disabled={!canSubmit}>{editingId ? "Сохранить" : "Добавить оценку"}</Button>
          </form>
        </>
      )}

      <DataTable empty={filteredPerformance.length === 0} emptyText="Оценок нет" colSpan={isAdmin ? 7 : 6}>
        <thead>
          <tr>
            <th>Студент</th>
            <th>Дисциплина</th>
            <th>Учебный год</th>
            <th>Семестр</th>
            <th>Отчетность</th>
            <th>Оценка</th>
            {isAdmin && <th>Действия</th>}
          </tr>
        </thead>
        <tbody>
          {filteredPerformance.map((record) => {
            const student = getRecordStudent(record);
            const discipline = getRecordDiscipline(record);
            const reportType = getRecordReportType(record);
            const isBadGrade = record.grade === "2" || record.grade === "Незачет";
            return (
              <tr key={record.id}>
                <td>{student ? `${student.lastName} ${student.firstName} ${student.middleName}` : "-"}</td>
                <td>{discipline?.name || "-"}</td>
                <td>{record.studyYear}</td>
                <td>{record.semester}</td>
                <td>{reportType || "-"}</td>
                <td><span className={isBadGrade ? "bad-grade" : "grade"}>{record.grade}</span></td>
                {isAdmin && (
                  <td className="actions">
                    <Button onClick={() => handleEdit(record)}>Изменить</Button>
                    <Button variant="danger" onClick={() => void handleDelete(record.id)}>Удалить</Button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </DataTable>
    </section>
  );
}

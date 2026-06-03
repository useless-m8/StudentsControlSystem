import { useState } from "react";
import { createPerformanceRecord, deletePerformanceRecord, updatePerformanceRecord } from "../api/perfomanceApi";
import { getErrorMessage } from "../api/axios";
import { Button } from "../components/Button";
import { DataTable } from "../components/DataTable";
import { Header } from "../components/Header";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import type { AppData } from "../types/app";
import type { PerformanceRecord } from "../types/perfomance";

type PerfomanceJournalPageProps = {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  isAdmin: boolean;
};

export function PerfomanceJournalPage({ data, setData, isAdmin }: PerfomanceJournalPageProps) {
  const [form, setForm] = useState<PerformanceRecord>({
    id: 0,
    studentId: data.students[0]?.id || 1,
    disciplineId: data.disciplines[0]?.id || 1,
    studyYear: new Date().getFullYear(),
    semester: 1,
    grade: "5",
  });
  const [editingId, setEditingId] = useState<number | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
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

  return (
    <section>
      <Header title="Журнал успеваемости" text="Добавление оценок по студентам, дисциплинам, учебному году и семестру." />
      {isAdmin && (
        <form className="card form-grid" onSubmit={handleSubmit}>
          <Select value={form.studentId} onChange={(event) => setForm({ ...form, studentId: Number(event.target.value) })}>
            {data.students.map((student) => <option key={student.id} value={student.id}>{student.lastName} {student.firstName} {student.middleName}</option>)}
          </Select>
          <Select value={form.disciplineId} onChange={(event) => setForm({ ...form, disciplineId: Number(event.target.value) })}>
            {data.disciplines.map((discipline) => <option key={discipline.id} value={discipline.id}>{discipline.name}</option>)}
          </Select>
          <Input type="number" placeholder="Учебный год" value={form.studyYear} onChange={(event) => setForm({ ...form, studyYear: Number(event.target.value) })} />
          <Input type="number" placeholder="Семестр" value={form.semester} onChange={(event) => setForm({ ...form, semester: Number(event.target.value) })} />
          <Select value={form.grade} onChange={(event) => setForm({ ...form, grade: event.target.value })}>
            <option value="5">5</option>
            <option value="4">4</option>
            <option value="3">3</option>
            <option value="2">2</option>
            <option value="Зачет">Зачет</option>
            <option value="Незачет">Незачет</option>
          </Select>
          <Button type="submit">{editingId ? "Сохранить" : "Добавить оценку"}</Button>
        </form>
      )}

      <DataTable empty={data.performance.length === 0} emptyText="Оценок нет" colSpan={isAdmin ? 6 : 5}>
        <thead>
          <tr>
            <th>Студент</th>
            <th>Дисциплина</th>
            <th>Учебный год</th>
            <th>Семестр</th>
            <th>Оценка</th>
            {isAdmin && <th>Действия</th>}
          </tr>
        </thead>
        <tbody>
          {data.performance.map((record) => {
            const student = data.students.find((item) => item.id === record.studentId);
            const discipline = data.disciplines.find((item) => item.id === record.disciplineId);
            const isBadGrade = record.grade === "2" || record.grade === "Незачет";
            return (
              <tr key={record.id}>
                <td>{student?.lastName} {student?.firstName} {student?.middleName}</td>
                <td>{discipline?.name}</td>
                <td>{record.studyYear}</td>
                <td>{record.semester}</td>
                <td><span className={isBadGrade ? "bad-grade" : "grade"}>{record.grade}</span></td>
                {isAdmin && (
                  <td className="actions">
                    <Button onClick={() => { setForm(record); setEditingId(record.id); }}>Изменить</Button>
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

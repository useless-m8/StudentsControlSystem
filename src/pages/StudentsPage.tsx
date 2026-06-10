import { useState } from "react";
import { createStudent, deleteStudent, updateStudent } from "../api/studentsApi";
import { getErrorMessage } from "../api/axios";
import { Button } from "../components/Button";
import { DataTable } from "../components/DataTable";
import { Header } from "../components/Header";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import type { AppData } from "../types/app";
import type { Student } from "../types/student";

type StudentsPageProps = {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  isAdmin: boolean;
};

export function StudentsPage({ data, setData, isAdmin }: StudentsPageProps) {
  const emptyForm: Student = {
    id: 0,
    lastName: "",
    firstName: "",
    middleName: "",
    admissionYear: new Date().getFullYear(),
    educationFormId: data.educationForms[0]?.id || 1,
    groupId: data.groups[0]?.id || 1,
  };
  const [form, setForm] = useState<Student>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [specialityFilter, setSpecialityFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");

  const filteredGroups = specialityFilter === "all"
    ? data.groups
    : data.groups.filter((group) => group.specialityId === Number(specialityFilter));

  const filteredStudents = data.students.filter((student) => {
    const group = data.groups.find((item) => item.id === student.groupId);
    const fullName = `${student.lastName} ${student.firstName} ${student.middleName}`.toLowerCase();

    return (
      fullName.includes(search.toLowerCase()) &&
      (specialityFilter === "all" || group?.specialityId === Number(specialityFilter)) &&
      (groupFilter === "all" || student.groupId === Number(groupFilter))
    );
  });

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function handleSpecialityFilterChange(value: string) {
    setSpecialityFilter(value);
    if (value !== "all") {
      const groupStillAvailable = data.groups.some((group) => (
        group.id === Number(groupFilter) &&
        group.specialityId === Number(value)
      ));

      if (!groupStillAvailable) {
        setGroupFilter("all");
      }
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.lastName.trim() || !form.firstName.trim()) {
      alert("Введите фамилию и имя студента");
      return;
    }

    try {
      if (editingId) {
        const saved = await updateStudent(editingId, form);
        setData((prev) => ({
          ...prev,
          students: prev.students.map((student) => (student.id === editingId ? saved : student)),
        }));
      } else {
        const saved = await createStudent(form);
        setData((prev) => ({ ...prev, students: [...prev.students, saved] }));
      }
      resetForm();
    } catch (error) {
      alert(getErrorMessage(error));
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Удалить студента?")) return;
    try {
      await deleteStudent(id);
      setData((prev) => ({
        ...prev,
        students: prev.students.filter((student) => student.id !== id),
        performance: prev.performance.filter((record) => record.studentId !== id),
      }));
    } catch (error) {
      alert(getErrorMessage(error));
    }
  }

  return (
    <section>
      <Header title="Студенты" text="Добавление, изменение, поиск и фильтрация студентов." />

      {isAdmin && (
        <form className="card form-grid" onSubmit={handleSubmit}>
          <label className="field-stack">
            <span>Фамилия</span>
            <Input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
          </label>
          <label className="field-stack">
            <span>Имя</span>
            <Input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
          </label>
          <label className="field-stack">
            <span>Отчество</span>
            <Input value={form.middleName} onChange={(event) => setForm({ ...form, middleName: event.target.value })} />
          </label>
          <label className="field-stack">
            <span>Год поступления</span>
            <Input type="number" value={form.admissionYear} onChange={(event) => setForm({ ...form, admissionYear: Number(event.target.value) })} />
          </label>
          <label className="field-stack">
            <span>Форма обучения</span>
            <Select value={form.educationFormId} onChange={(event) => setForm({ ...form, educationFormId: Number(event.target.value) })}>
              {data.educationForms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </label>
          <label className="field-stack">
            <span>Группа</span>
            <Select value={form.groupId} onChange={(event) => setForm({ ...form, groupId: Number(event.target.value) })}>
              {data.groups.map((group) => {
                const speciality = data.specialities.find((item) => item.id === group.specialityId);
                return <option key={group.id} value={group.id}>{group.name} — {speciality?.name}</option>;
              })}
            </Select>
          </label>
          <div className="form-actions">
            <Button type="submit">{editingId ? "Сохранить" : "Добавить студента"}</Button>
            {editingId && <Button type="button" variant="secondary" onClick={resetForm}>Отмена</Button>}
          </div>
        </form>
      )}

      {!isAdmin && <div className="notice">Доступен только просмотр данных.</div>}

      <div className="filters">
        <Input placeholder="Поиск по ФИО" value={search} onChange={(event) => setSearch(event.target.value)} />
        <Select value={specialityFilter} onChange={(event) => handleSpecialityFilterChange(event.target.value)}>
          <option value="all">Все специальности</option>
          {data.specialities.map((speciality) => (
            <option key={speciality.id} value={speciality.id}>{speciality.name}</option>
          ))}
        </Select>
        <Select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
          <option value="all">Все группы</option>
          {filteredGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </Select>
      </div>

      <DataTable empty={filteredStudents.length === 0} emptyText="Студенты не найдены" colSpan={isAdmin ? 6 : 5}>
        <thead>
          <tr>
            <th>ФИО</th>
            <th>Год поступления</th>
            <th>Форма обучения</th>
            <th>Специальность</th>
            <th>Группа</th>
            {isAdmin && <th>Действия</th>}
          </tr>
        </thead>
        <tbody>
          {filteredStudents.map((student) => {
            const group = data.groups.find((item) => item.id === student.groupId);
            const speciality = data.specialities.find((item) => item.id === group?.specialityId);
            const educationForm = data.educationForms.find((item) => item.id === student.educationFormId);
            return (
              <tr key={student.id}>
                <td>{student.lastName} {student.firstName} {student.middleName}</td>
                <td>{student.admissionYear}</td>
                <td>{educationForm?.name}</td>
                <td>{speciality?.name || "-"}</td>
                <td>{group?.name}</td>
                {isAdmin && (
                  <td className="actions">
                    <Button onClick={() => { setForm(student); setEditingId(student.id); }}>Изменить</Button>
                    <Button variant="danger" onClick={() => void handleDelete(student.id)}>Удалить</Button>
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

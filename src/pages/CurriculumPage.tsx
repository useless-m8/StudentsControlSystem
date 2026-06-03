import { useState } from "react";
import { createCurriculumItem, deleteCurriculumItem, updateCurriculumItem } from "../api/curriculumApi";
import { getErrorMessage } from "../api/axios";
import { Button } from "../components/Button";
import { DataTable } from "../components/DataTable";
import { Header } from "../components/Header";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import type { AppData } from "../types/app";
import type { Curriculum } from "../types/curriculum";

type CurriculumPageProps = {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  isAdmin: boolean;
};

export function CurriculumPage({ data, setData, isAdmin }: CurriculumPageProps) {
  const [form, setForm] = useState<Curriculum>({
    id: 0,
    specialityId: data.specialities[0]?.id || 1,
    disciplineId: data.disciplines[0]?.id || 1,
    semester: 1,
    hours: 72,
    reportType: "Экзамен",
  });
  const [editingId, setEditingId] = useState<number | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (editingId) {
        const saved = await updateCurriculumItem(editingId, form);
        setData((prev) => ({
          ...prev,
          curriculum: prev.curriculum.map((item) => (item.id === editingId ? saved : item)),
        }));
      } else {
        const saved = await createCurriculumItem(form);
        setData((prev) => ({ ...prev, curriculum: [...prev.curriculum, saved] }));
      }
      setEditingId(null);
    } catch (error) {
      alert(getErrorMessage(error));
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Удалить запись учебного плана?")) return;
    try {
      await deleteCurriculumItem(id);
      setData((prev) => ({ ...prev, curriculum: prev.curriculum.filter((item) => item.id !== id) }));
    } catch (error) {
      alert(getErrorMessage(error));
    }
  }

  return (
    <section>
      <Header title="Учебный план" text="Дисциплины, семестры, часы и формы отчетности по специальностям." />
      {isAdmin && (
        <form className="card form-grid" onSubmit={handleSubmit}>
          <Select value={form.specialityId} onChange={(event) => setForm({ ...form, specialityId: Number(event.target.value) })}>
            {data.specialities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
          <Select value={form.disciplineId} onChange={(event) => setForm({ ...form, disciplineId: Number(event.target.value) })}>
            {data.disciplines.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
          <Input type="number" placeholder="Семестр" value={form.semester} onChange={(event) => setForm({ ...form, semester: Number(event.target.value) })} />
          <Input type="number" placeholder="Часы" value={form.hours} onChange={(event) => setForm({ ...form, hours: Number(event.target.value) })} />
          <Select value={form.reportType} onChange={(event) => setForm({ ...form, reportType: event.target.value })}>
            <option value="Экзамен">Экзамен</option>
            <option value="Зачет">Зачет</option>
            <option value="Курсовая работа">Курсовая работа</option>
          </Select>
          <Button type="submit">{editingId ? "Сохранить" : "Добавить запись"}</Button>
        </form>
      )}

      <DataTable empty={data.curriculum.length === 0} emptyText="Записей нет" colSpan={isAdmin ? 6 : 5}>
        <thead>
          <tr>
            <th>Специальность</th>
            <th>Дисциплина</th>
            <th>Семестр</th>
            <th>Часы</th>
            <th>Отчетность</th>
            {isAdmin && <th>Действия</th>}
          </tr>
        </thead>
        <tbody>
          {data.curriculum.map((item) => (
            <tr key={item.id}>
              <td>{data.specialities.find((speciality) => speciality.id === item.specialityId)?.name}</td>
              <td>{data.disciplines.find((discipline) => discipline.id === item.disciplineId)?.name}</td>
              <td>{item.semester}</td>
              <td>{item.hours}</td>
              <td>{item.reportType}</td>
              {isAdmin && (
                <td className="actions">
                  <Button onClick={() => { setForm(item); setEditingId(item.id); }}>Изменить</Button>
                  <Button variant="danger" onClick={() => void handleDelete(item.id)}>Удалить</Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </DataTable>
    </section>
  );
}

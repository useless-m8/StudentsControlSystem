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

const emptyCurriculumForm: Curriculum = {
  id: 0,
  specialityId: 1,
  disciplineId: 1,
  semester: 1,
  reportType: "Экзамен",
};

export function CurriculumPage({ data, setData, isAdmin }: CurriculumPageProps) {
  const [form, setForm] = useState<Curriculum>({
    ...emptyCurriculumForm,
    specialityId: data.specialities[0]?.id || 1,
    disciplineId: data.disciplines[0]?.id || 1,
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
      setForm({
        ...emptyCurriculumForm,
        specialityId: data.specialities[0]?.id || 1,
        disciplineId: data.disciplines[0]?.id || 1,
      });
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
      <Header
        title="Учебный план"
        text="Дисциплины, семестры и формы отчетности по специальностям."
      />
      {isAdmin && (
        <form className="card form-grid" onSubmit={handleSubmit}>
          <label className="field-stack">
            <span>Специальность</span>
            <Select value={form.specialityId} onChange={(event) => setForm({ ...form, specialityId: Number(event.target.value) })}>
              {data.specialities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </label>
          <label className="field-stack">
            <span>Дисциплина</span>
            <Select value={form.disciplineId} onChange={(event) => setForm({ ...form, disciplineId: Number(event.target.value) })}>
              {data.disciplines.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </label>
          <label className="field-stack">
            <span>Семестр</span>
            <Input type="number" placeholder="Например, 1" value={form.semester} onChange={(event) => setForm({ ...form, semester: Number(event.target.value) })} />
          </label>
          <label className="field-stack">
            <span>Форма отчетности</span>
            <Select value={form.reportType} onChange={(event) => setForm({ ...form, reportType: event.target.value })}>
              <option value="Экзамен">Экзамен</option>
              <option value="Зачет">Зачет</option>
              <option value="Курсовая работа">Курсовая работа</option>
            </Select>
          </label>
          <Button type="submit">{editingId ? "Сохранить" : "Добавить запись"}</Button>
          {editingId && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditingId(null);
                setForm({
                  ...emptyCurriculumForm,
                  specialityId: data.specialities[0]?.id || 1,
                  disciplineId: data.disciplines[0]?.id || 1,
                });
              }}
            >
              Отмена
            </Button>
          )}
        </form>
      )}

      <DataTable empty={data.curriculum.length === 0} emptyText="Записей нет" colSpan={isAdmin ? 5 : 4}>
        <thead>
          <tr>
            <th>Специальность</th>
            <th>Дисциплина</th>
            <th>Семестр</th>
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

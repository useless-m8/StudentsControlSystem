import { useState } from "react";
import { createGroup, deleteGroup, updateGroup } from "../api/groupsApi";
import { getErrorMessage } from "../api/axios";
import { Button } from "../components/Button";
import { DataTable } from "../components/DataTable";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import type { AppData } from "../types/app";

type GroupsPageProps = {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  isAdmin: boolean;
};

export function GroupsPage({ data, setData, isAdmin }: GroupsPageProps) {
  const [name, setName] = useState("");
  const [specialityId, setSpecialityId] = useState(data.specialities[0]?.id || 1);
  const [editingId, setEditingId] = useState<number | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    try {
      const payload = { name, specialityId };
      if (editingId) {
        const saved = await updateGroup(editingId, payload);
        setData((prev) => ({
          ...prev,
          groups: prev.groups.map((group) => (group.id === editingId ? saved : group)),
        }));
      } else {
        const saved = await createGroup(payload);
        setData((prev) => ({ ...prev, groups: [...prev.groups, saved] }));
      }
      setName("");
      setSpecialityId(data.specialities[0]?.id || 1);
      setEditingId(null);
    } catch (error) {
      alert(getErrorMessage(error));
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Удалить группу?")) return;
    try {
      await deleteGroup(id);
      setData((prev) => ({ ...prev, groups: prev.groups.filter((group) => group.id !== id) }));
    } catch (error) {
      alert(getErrorMessage(error));
    }
  }

  return (
    <div className="card directory-card">
      <h2>Группы</h2>
      {isAdmin && (
        <form className="directory-form" onSubmit={handleSubmit}>
          <Input placeholder="Название группы" value={name} onChange={(event) => setName(event.target.value)} />
          <Select value={specialityId} onChange={(event) => setSpecialityId(Number(event.target.value))}>
            {data.specialities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
          <Button type="submit">{editingId ? "Сохранить" : "Добавить"}</Button>
        </form>
      )}

      <DataTable empty={data.groups.length === 0} emptyText="Групп нет" colSpan={isAdmin ? 3 : 2}>
        <thead>
          <tr>
            <th>Группа</th>
            <th>Специальность</th>
            {isAdmin && <th>Действия</th>}
          </tr>
        </thead>
        <tbody>
          {data.groups.map((group) => {
            const speciality = data.specialities.find((item) => item.id === group.specialityId);
            return (
              <tr key={group.id}>
                <td>{group.name}</td>
                <td>{speciality?.name}</td>
                {isAdmin && (
                  <td className="actions">
                    <Button onClick={() => { setName(group.name); setSpecialityId(group.specialityId); setEditingId(group.id); }}>Изменить</Button>
                    <Button variant="danger" onClick={() => void handleDelete(group.id)}>Удалить</Button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </DataTable>
    </div>
  );
}

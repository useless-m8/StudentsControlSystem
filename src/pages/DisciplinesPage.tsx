import { useState } from "react";
import {
  createDirectoryItem,
  deleteDirectoryItem,
  type DirectoryKind,
  updateDirectoryItem,
} from "../api/disciplinesApi";
import { getErrorMessage } from "../api/axios";
import { Button } from "../components/Button";
import { DataTable } from "../components/DataTable";
import { Input } from "../components/Input";
import type { AppData } from "../types/app";
import type { NamedItem } from "../types/student";

type DirectorySectionProps = {
  title: string;
  kind: DirectoryKind;
  items: NamedItem[];
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  isAdmin: boolean;
};

export function DirectorySection({ title, kind, items, setData, isAdmin }: DirectorySectionProps) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    try {
      if (editingId) {
        const saved = await updateDirectoryItem(kind, editingId, name);
        setData((prev) => ({
          ...prev,
          [kind]: prev[kind].map((item) => (item.id === editingId ? saved : item)),
        }));
      } else {
        const saved = await createDirectoryItem(kind, name);
        setData((prev) => ({ ...prev, [kind]: [...prev[kind], saved] }));
      }
      setName("");
      setEditingId(null);
    } catch (error) {
      alert(getErrorMessage(error));
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Удалить запись?")) return;
    try {
      await deleteDirectoryItem(kind, id);
      setData((prev) => ({ ...prev, [kind]: prev[kind].filter((item) => item.id !== id) }));
    } catch (error) {
      alert(getErrorMessage(error));
    }
  }

  return (
    <div className="card directory-card">
      <h2>{title}</h2>
      {isAdmin && (
        <form className="directory-form" onSubmit={handleSubmit}>
          <Input placeholder="Название" value={name} onChange={(event) => setName(event.target.value)} />
          <Button type="submit">{editingId ? "Сохранить" : "Добавить"}</Button>
          {editingId && <Button type="button" variant="secondary" onClick={() => { setName(""); setEditingId(null); }}>Отмена</Button>}
        </form>
      )}

      <DataTable empty={items.length === 0} emptyText="Записей нет" colSpan={isAdmin ? 2 : 1}>
        <thead>
          <tr>
            <th>Название</th>
            {isAdmin && <th>Действия</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              {isAdmin && (
                <td className="actions">
                  <Button onClick={() => { setName(item.name); setEditingId(item.id); }}>Изменить</Button>
                  <Button variant="danger" onClick={() => void handleDelete(item.id)}>Удалить</Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}

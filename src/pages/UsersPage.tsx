import { useEffect, useState } from "react";
import { createUser, deleteUser, loadUsers, updateUser, type UserPayload } from "../api/usersApi";
import { getErrorMessage } from "../api/axios";
import { Button } from "../components/Button";
import { DataTable } from "../components/DataTable";
import { Header } from "../components/Header";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import type { AppData } from "../types/app";
import type { Role, User } from "../types/student";

type UsersPageProps = {
  data: AppData;
};

type MultiSelectItem = {
  id: number;
  name: string;
};

type MultiSelectDropdownProps = {
  label: string;
  placeholder: string;
  items: MultiSelectItem[];
  selectedIds: number[];
  disabled: boolean;
  onChange: (ids: number[]) => void;
};

const roleLabels: Record<Role, string> = {
  admin: "Администратор",
  education_staff: "Сотрудник учебного отдела",
  teacher: "Преподаватель",
};

const emptyForm: UserPayload = {
  login: "",
  lastName: "",
  firstName: "",
  middleName: "",
  password: "",
  role: "education_staff",
  groupId: null,
  groupIds: [],
  disciplineId: null,
  disciplineIds: [],
};

function MultiSelectDropdown({ label, placeholder, items, selectedIds, disabled, onChange }: MultiSelectDropdownProps) {
  const selectedItems = items.filter((item) => selectedIds.includes(item.id));
  const summary = selectedItems.length > 0
    ? selectedItems.map((item) => item.name).join(", ")
    : placeholder;

  function toggleItem(id: number) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((selectedId) => selectedId !== id));
      return;
    }

    onChange([...selectedIds, id]);
  }

  return (
    <div className="field-stack">
      <span>{label}</span>
      <details className="multi-select" onToggle={(event) => {
        if (disabled && event.currentTarget.open) {
          event.currentTarget.open = false;
        }
      }}>
        <summary className={disabled ? "disabled" : ""}>
          <span>{summary}</span>
          <small>{selectedItems.length > 0 ? selectedItems.length : ""}</small>
        </summary>
        <div className="multi-select-menu">
          {items.map((item) => (
            <label key={item.id} className="multi-select-option">
              <input
                type="checkbox"
                checked={selectedIds.includes(item.id)}
                disabled={disabled}
                onChange={() => toggleItem(item.id)}
              />
              <span>{item.name}</span>
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}

export function UsersPage({ data }: UsersPageProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState<UserPayload>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    loadUsers()
      .then(setUsers)
      .catch((error: unknown) => alert(getErrorMessage(error)));
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    try {
      if (editingId) {
        const saved = await updateUser(editingId, form);
        setUsers((prev) => prev.map((user) => (user.id === editingId ? saved : user)));
      } else {
        const saved = await createUser(form);
        setUsers((prev) => [...prev, saved]);
      }

      setForm(emptyForm);
      setEditingId(null);
    } catch (error) {
      alert(getErrorMessage(error));
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Удалить пользователя?")) return;

    try {
      await deleteUser(id);
      setUsers((prev) => prev.filter((user) => user.id !== id));
    } catch (error) {
      alert(getErrorMessage(error));
    }
  }

  return (
    <section>
      <Header title="Пользователи" text="Настройка учетных записей и ролей доступа." />

      <form className="card form-grid" onSubmit={handleSubmit}>
        <Input placeholder="Логин" value={form.login} onChange={(event) => setForm({ ...form, login: event.target.value })} />
        <Input placeholder="Фамилия" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
        <Input placeholder="Имя" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
        <Input placeholder="Отчество" value={form.middleName} onChange={(event) => setForm({ ...form, middleName: event.target.value })} />
        <Input
          type="password"
          placeholder={editingId ? "Новый пароль, если нужно" : "Пароль"}
          value={form.password || ""}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
        />
        <Select
          value={form.role}
          onChange={(event) => {
            const role = event.target.value as Role;
            setForm({
              ...form,
              role,
              groupId: role === "teacher" ? form.groupId : null,
              groupIds: role === "teacher" ? form.groupIds : [],
              disciplineId: role === "teacher" ? form.disciplineId : null,
              disciplineIds: role === "teacher" ? form.disciplineIds : [],
            });
          }}
        >
          <option value="education_staff">Сотрудник учебного отдела</option>
          <option value="teacher">Преподаватель</option>
          <option value="admin">Администратор</option>
        </Select>
        <MultiSelectDropdown
          label="Группы преподавателя"
          placeholder="Выберите группы"
          items={data.groups}
          selectedIds={form.groupIds}
          disabled={form.role !== "teacher"}
          onChange={(groupIds) => setForm({ ...form, groupIds, groupId: groupIds[0] || null })}
        />
        <MultiSelectDropdown
          label="Дисциплины преподавателя"
          placeholder="Выберите дисциплины"
          items={data.disciplines}
          selectedIds={form.disciplineIds}
          disabled={form.role !== "teacher"}
          onChange={(disciplineIds) => setForm({ ...form, disciplineIds, disciplineId: disciplineIds[0] || null })}
        />
        <Button type="submit">{editingId ? "Сохранить" : "Создать пользователя"}</Button>
        {editingId && <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>Отмена</Button>}
      </form>

      <DataTable empty={users.length === 0} emptyText="Пользователей нет" colSpan={6}>
        <thead>
          <tr>
            <th>Логин</th>
            <th>ФИО</th>
            <th>Роль</th>
            <th>Группы</th>
            <th>Дисциплины</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const groupIds = user.groupIds.length > 0 ? user.groupIds : (user.groupId ? [user.groupId] : []);
            const disciplineIds = user.disciplineIds.length > 0 ? user.disciplineIds : (user.disciplineId ? [user.disciplineId] : []);
            const groups = data.groups.filter((item) => groupIds.includes(item.id));
            const disciplines = data.disciplines.filter((item) => disciplineIds.includes(item.id));
            return (
              <tr key={user.id}>
                <td>{user.login}</td>
                <td>{[user.lastName, user.firstName, user.middleName].filter(Boolean).join(" ") || "-"}</td>
                <td>{roleLabels[user.role]}</td>
                <td>{groups.map((group) => group.name).join(", ") || "-"}</td>
                <td>{disciplines.map((discipline) => discipline.name).join(", ") || "-"}</td>
                <td className="actions">
                  <Button onClick={() => {
                    setForm({
                      login: user.login,
                      lastName: user.lastName,
                      firstName: user.firstName,
                      middleName: user.middleName,
                      password: "",
                      role: user.role,
                      groupId: user.groupId,
                      groupIds,
                      disciplineId: user.disciplineId,
                      disciplineIds,
                    });
                    setEditingId(user.id);
                  }}>Изменить</Button>
                  <Button variant="danger" onClick={() => void handleDelete(user.id)}>Удалить</Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>
    </section>
  );
}

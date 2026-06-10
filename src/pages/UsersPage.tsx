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
  currentUser: User;
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

export function UsersPage({ data, currentUser }: UsersPageProps) {
  const defaultForm = currentUser.role === "education_staff" ? { ...emptyForm, role: "teacher" as Role } : emptyForm;
  const isEducationStaff = currentUser.role === "education_staff";
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState<UserPayload>(defaultForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    loadUsers()
      .then(setUsers)
      .catch((error: unknown) => alert(getErrorMessage(error)));
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isEducationStaff && !editingId) return;

    const payload = isEducationStaff ? { ...form, role: "teacher" as Role } : form;

    try {
      if (editingId) {
        const saved = await updateUser(editingId, payload);
        setUsers((prev) => prev.map((user) => (user.id === editingId ? saved : user)));
      } else {
        const saved = await createUser(payload);
        setUsers((prev) => [...prev, saved]);
      }

      setForm(defaultForm);
      setEditingId(null);
    } catch (error) {
      alert(getErrorMessage(error));
    }
  }

  const visibleUsers = isEducationStaff ? users.filter((user) => user.role === "teacher") : users;
  const selectedTeacher = editingId ? users.find((user) => user.id === editingId) : null;
  const selectedTeacherName = selectedTeacher
    ? [selectedTeacher.lastName, selectedTeacher.firstName, selectedTeacher.middleName].filter(Boolean).join(" ") || "Преподаватель"
    : "";
  const colSpan = isEducationStaff ? 4 : 6;

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

      {isEducationStaff && !editingId ? (
        <div className="notice">Выберите преподавателя в таблице, чтобы назначить ему группы и дисциплины.</div>
      ) : (
      <form className="card form-grid" onSubmit={handleSubmit}>
        {isEducationStaff ? (
          <div className="field-stack">
            <span>Преподаватель</span>
            <strong>{selectedTeacherName}</strong>
          </div>
        ) : (
          <>
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
          </>
        )}
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
        <Button type="submit">{isEducationStaff ? "Сохранить назначения" : (editingId ? "Сохранить" : "Создать пользователя")}</Button>
        {editingId && <Button type="button" variant="secondary" onClick={() => {
          setForm(defaultForm);
          setEditingId(null);
        }}>Отмена</Button>}
      </form>
      )}

      <DataTable empty={visibleUsers.length === 0} emptyText="Пользователей нет" colSpan={colSpan}>
        <thead>
          <tr>
            {!isEducationStaff && <th>Логин</th>}
            <th>ФИО</th>
            {!isEducationStaff && <th>Роль</th>}
            <th>Группы</th>
            <th>Дисциплины</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {visibleUsers.map((user) => {
            const groupIds = user.groupIds.length > 0 ? user.groupIds : (user.groupId ? [user.groupId] : []);
            const disciplineIds = user.disciplineIds.length > 0 ? user.disciplineIds : (user.disciplineId ? [user.disciplineId] : []);
            const groups = data.groups.filter((item) => groupIds.includes(item.id));
            const disciplines = data.disciplines.filter((item) => disciplineIds.includes(item.id));
            const isCurrentUser = user.id === currentUser.id;
            const canEditUser = currentUser.role === "admin" || user.role === "teacher";
            const canDeleteUser = currentUser.role === "admin" && !isCurrentUser;
            return (
              <tr key={user.id}>
                {!isEducationStaff && <td>{user.login}</td>}
                <td>{[user.lastName, user.firstName, user.middleName].filter(Boolean).join(" ") || "-"}</td>
                {!isEducationStaff && <td>{roleLabels[user.role]}</td>}
                <td>{groups.map((group) => group.name).join(", ") || "-"}</td>
                <td>{disciplines.map((discipline) => discipline.name).join(", ") || "-"}</td>
                <td className="actions">
                  <Button disabled={!canEditUser} onClick={() => {
                    if (!canEditUser) return;
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
                  {!isEducationStaff && (
                    isCurrentUser && currentUser.role === "admin" ? (
                      <Button type="button" variant="secondary" disabled>Текущий пользователь</Button>
                    ) : canDeleteUser ? (
                      <Button variant="danger" onClick={() => void handleDelete(user.id)}>Удалить</Button>
                    ) : (
                      <Button type="button" variant="secondary" disabled>Удаление недоступно</Button>
                    )
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>
    </section>
  );
}

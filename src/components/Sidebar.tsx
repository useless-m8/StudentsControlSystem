import type { Page } from "../app/router";
import type { User } from "../types/student";

type SidebarProps = {
  currentUser: User;
  page: Page;
  onPageChange: (page: Page) => void;
  onLogout: () => void;
};

const menu: { page: Page; label: string; adminOnly?: boolean }[] = [
  { page: "students", label: "Студенты" },
  { page: "directories", label: "Справочники" },
  { page: "curriculum", label: "Учебный план" },
  { page: "performance", label: "Журнал успеваемости" },
  { page: "reports", label: "Отчеты" },
  { page: "users", label: "Пользователи", adminOnly: true },
];

const roleLabels: Record<User["role"], string> = {
  admin: "Администратор",
  education_staff: "Сотрудник учебного отдела",
  teacher: "Преподаватель",
};

export function Sidebar({ currentUser, page, onPageChange, onLogout }: SidebarProps) {
  const visibleMenu = menu.filter((item) => !item.adminOnly || currentUser.role === "admin");
  const fullName = [currentUser.lastName, currentUser.firstName, currentUser.middleName].filter(Boolean).join(" ");

  return (
    <aside className="sidebar">
      <div className="app-brand">
        <span>Учет студентов</span>
        <strong>Учебная часть</strong>
      </div>

      <div className="user-box">
        <span>Пользователь:</span>
        <strong>{fullName || currentUser.login}</strong>
        {fullName && <small>Логин: {currentUser.login}</small>}
        <small>Роль: {roleLabels[currentUser.role]}</small>
      </div>

      <nav className="menu">
        {visibleMenu.map((item) => (
          <button
            key={item.page}
            className={page === item.page ? "active" : ""}
            onClick={() => onPageChange(item.page)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <button className="logout-button" onClick={onLogout}>
        Выйти
      </button>
    </aside>
  );
}

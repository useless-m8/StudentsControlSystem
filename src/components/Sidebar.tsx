import type { Page } from "../app/router";
import type { User } from "../types/student";

type SidebarProps = {
  currentUser: User;
  page: Page;
  onPageChange: (page: Page) => void;
  onLogout: () => void;
};

const menu: { page: Page; label: string; userManagementOnly?: boolean }[] = [
  { page: "students", label: "Студенты" },
  { page: "directories", label: "Учебные данные" },
  { page: "curriculum", label: "Учебный план" },
  { page: "performance", label: "Журнал успеваемости" },
  { page: "reports", label: "Отчеты" },
  { page: "users", label: "Пользователи", userManagementOnly: true },
];

export function Sidebar({ currentUser, page, onPageChange, onLogout }: SidebarProps) {
  const canManageUsers = currentUser.role === "admin" || currentUser.role === "education_staff";
  const visibleMenu = menu.filter((item) => !item.userManagementOnly || canManageUsers);
  const fullName = [currentUser.lastName, currentUser.firstName, currentUser.middleName].filter(Boolean).join(" ");

  return (
    <aside className="sidebar">
      <div className="app-brand">
        <strong>Учет студентов</strong>
      </div>

      <div className="user-box">
        <span>Пользователь:</span>
        <strong>{fullName || currentUser.login}</strong>
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

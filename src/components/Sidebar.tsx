import type { Page } from "../app/router";
import type { User } from "../types/student";

type SidebarProps = {
  currentUser: User;
  page: Page;
  onPageChange: (page: Page) => void;
  onLogout: () => void;
};

const menu: { page: Page; label: string }[] = [
  { page: "students", label: "Студенты" },
  { page: "directories", label: "Справочники" },
  { page: "curriculum", label: "Учебный план" },
  { page: "performance", label: "Журнал успеваемости" },
  { page: "reports", label: "Отчеты" },
];

export function Sidebar({ currentUser, page, onPageChange, onLogout }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="user-box">
        <span>Пользователь:</span>
        <strong>{currentUser.login}</strong>
        <small>Роль: {currentUser.role}</small>
      </div>

      <nav className="menu">
        {menu.map((item) => (
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

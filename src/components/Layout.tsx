import type { ReactNode } from "react";
import type { Page } from "../app/router";
import type { User } from "../types/student";
import { Sidebar } from "./Sidebar";

type LayoutProps = {
  currentUser: User;
  page: Page;
  onPageChange: (page: Page) => void;
  onLogout: () => void;
  children: ReactNode;
};

export function Layout({ currentUser, page, onPageChange, onLogout, children }: LayoutProps) {
  return (
    <div className="app">
      <Sidebar
        currentUser={currentUser}
        page={page}
        onPageChange={onPageChange}
        onLogout={onLogout}
      />
      <main className="content">{children}</main>
    </div>
  );
}

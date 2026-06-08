import { useEffect, useState } from "react";
import { loadAppData } from "../api/appApi";
import { getErrorMessage, setAuthToken } from "../api/axios";
import { Layout } from "../components/Layout";
import { CurriculumPage } from "../pages/CurriculumPage";
import { DirectoriesPage } from "../pages/DirectoriesPage";
import { PerfomanceJournalPage } from "../pages/PerfomanceJournalPage";
import { ReportsPage } from "../pages/ReportsPage";
import { StudentFormPage } from "../pages/StudentFormPage";
import { StudentsPage } from "../pages/StudentsPage";
import { UsersPage } from "../pages/UsersPage";
import { emptyData, type AppData } from "../types/app";
import type { User } from "../types/student";
import type { Page } from "./router";

type Session = {
  user: User;
  token: string;
};

function readSavedSession() {
  const saved = localStorage.getItem("session");
  if (!saved) return null;

  try {
    return JSON.parse(saved) as Session;
  } catch {
    localStorage.removeItem("session");
    return null;
  }
}

export default function App() {
  const [page, setPage] = useState<Page>("students");
  const [session, setSession] = useState<Session | null>(() => {
    const saved = readSavedSession();
    setAuthToken(saved?.token || null);
    return saved;
  });
  const [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(Boolean(session));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) {
      localStorage.removeItem("session");
      setAuthToken(null);
      return;
    }

    localStorage.setItem("session", JSON.stringify(session));
    setAuthToken(session.token);

    let active = true;
    loadAppData()
      .then((loadedData) => {
        if (active) {
          setData(loadedData);
          setError("");
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(getErrorMessage(loadError));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [session]);

  if (!session) {
    return (
      <StudentFormPage
        onAuth={(nextSession) => {
          setLoading(true);
          setSession(nextSession);
        }}
      />
    );
  }

  const currentUser = session.user;
  const isAdmin = currentUser.role === "admin";
  const canEditStudents = currentUser.role === "admin" || currentUser.role === "education_staff";
  const canManageAcademic = currentUser.role === "admin" || currentUser.role === "education_staff";
  const canEditPerformance = canManageAcademic || currentUser.role === "teacher";

  function logout() {
    setData(emptyData);
    setLoading(false);
    setSession(null);
  }

  return (
    <Layout
      currentUser={currentUser}
      page={page}
      onPageChange={setPage}
      onLogout={logout}
    >
      {error && <div className="notice">Ошибка API: {error}</div>}
      {loading ? (
        <div className="card">Загрузка данных из PostgreSQL...</div>
      ) : (
        <>
          {page === "students" && <StudentsPage data={data} setData={setData} isAdmin={canEditStudents} />}
          {page === "directories" && <DirectoriesPage data={data} setData={setData} isAdmin={canManageAcademic} />}
          {page === "curriculum" && <CurriculumPage data={data} setData={setData} isAdmin={canManageAcademic} />}
          {page === "performance" && <PerfomanceJournalPage data={data} setData={setData} isAdmin={canEditPerformance} />}
          {page === "reports" && <ReportsPage data={data} />}
          {page === "users" && isAdmin && <UsersPage data={data} />}
        </>
      )}
    </Layout>
  );
}

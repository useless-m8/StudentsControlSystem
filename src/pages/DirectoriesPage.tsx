import { useState } from "react";
import { Header } from "../components/Header";
import type { AppData } from "../types/app";
import { DirectorySection } from "./DisciplinesPage";
import { GroupsPage } from "./GroupsPage";

type DirectoriesPageProps = {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  isAdmin: boolean;
};

type DirectoryTab = "specialities" | "groups" | "educationForms" | "disciplines";

const tabs: { id: DirectoryTab; label: string }[] = [
  { id: "specialities", label: "Специальности" },
  { id: "groups", label: "Группы" },
  { id: "educationForms", label: "Формы обучения" },
  { id: "disciplines", label: "Дисциплины" },
];

export function DirectoriesPage({ data, setData, isAdmin }: DirectoriesPageProps) {
  const [activeTab, setActiveTab] = useState<DirectoryTab>("specialities");

  return (
    <section>
      <Header
        title="Учебные данные"
        text="Управление специальностями, группами, формами обучения и дисциплинами."
      />
      {!isAdmin && <div className="notice">Доступен только просмотр учебных данных.</div>}

      <div className="directory-tabs" role="tablist" aria-label="Разделы учебных данных">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "specialities" && (
        <DirectorySection title="Специальности" kind="specialities" items={data.specialities} setData={setData} isAdmin={isAdmin} />
      )}
      {activeTab === "groups" && <GroupsPage data={data} setData={setData} isAdmin={isAdmin} />}
      {activeTab === "educationForms" && (
        <DirectorySection title="Формы обучения" kind="educationForms" items={data.educationForms} setData={setData} isAdmin={isAdmin} />
      )}
      {activeTab === "disciplines" && (
        <DirectorySection title="Дисциплины" kind="disciplines" items={data.disciplines} setData={setData} isAdmin={isAdmin} />
      )}
    </section>
  );
}

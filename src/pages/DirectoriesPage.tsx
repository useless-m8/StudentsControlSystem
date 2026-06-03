import { Header } from "../components/Header";
import type { AppData } from "../types/app";
import { DirectorySection } from "./DisciplinesPage";
import { GroupsPage } from "./GroupsPage";

type DirectoriesPageProps = {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  isAdmin: boolean;
};

export function DirectoriesPage({ data, setData, isAdmin }: DirectoriesPageProps) {
  return (
    <section>
      <Header
        title="Справочники"
        text="Управление специальностями, формами обучения, дисциплинами и группами."
      />
      {!isAdmin && <div className="notice">У вас роль пользователя. Доступен только просмотр справочников.</div>}

      <div className="directories-grid">
        <DirectorySection title="Специальности" kind="specialities" items={data.specialities} setData={setData} isAdmin={isAdmin} />
        <DirectorySection title="Формы обучения" kind="educationForms" items={data.educationForms} setData={setData} isAdmin={isAdmin} />
        <DirectorySection title="Дисциплины" kind="disciplines" items={data.disciplines} setData={setData} isAdmin={isAdmin} />
        <GroupsPage data={data} setData={setData} isAdmin={isAdmin} />
      </div>
    </section>
  );
}

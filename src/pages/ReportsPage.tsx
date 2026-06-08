import { useMemo, useState } from "react";
import { DataTable } from "../components/DataTable";
import { Header } from "../components/Header";
import { Select } from "../components/Select";
import type { AppData } from "../types/app";
import { buildReportRows, buildReportSummary, filterStudentsByGroup } from "./reportUtils";

type ReportsPageProps = {
  data: AppData;
};

export function ReportsPage({ data }: ReportsPageProps) {
  const [selectedGroupId, setSelectedGroupId] = useState("all");

  const filteredStudents = useMemo(
    () => filterStudentsByGroup(data, selectedGroupId),
    [data, selectedGroupId]
  );

  const reportRows = useMemo(() => {
    return buildReportRows(data, filteredStudents);
  }, [data, filteredStudents]);

  const reportSummary = useMemo(() => {
    return buildReportSummary(data, filteredStudents);
  }, [data, filteredStudents]);

  return (
    <section>
      <Header title="Отчеты" text="Сводная информация по успеваемости студентов с фильтрацией по группам." />

      <div className="filters">
        <Select value={selectedGroupId} onChange={(event) => setSelectedGroupId(event.target.value)}>
          <option value="all">Все группы</option>
          {data.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </Select>
      </div>

      <div className="stats">
        <div className="stat-card"><span>Студентов</span><strong>{reportSummary.studentsCount}</strong></div>
        <div className="stat-card"><span>Дисциплин с оценками</span><strong>{reportSummary.disciplinesCount}</strong></div>
        <div className="stat-card"><span>Оценок</span><strong>{reportSummary.gradesCount}</strong></div>
      </div>

      <DataTable empty={reportRows.length === 0} emptyText="Нет данных для отчета" colSpan={5}>
        <thead>
          <tr>
            <th>Студент</th>
            <th>Группа</th>
            <th>Количество оценок</th>
            <th>Средний балл</th>
            <th>Задолженности</th>
          </tr>
        </thead>
        <tbody>
          {reportRows.map((row) => {
            const group = data.groups.find((item) => item.id === row.student.groupId);
            return (
              <tr key={row.student.id}>
                <td>{row.student.lastName} {row.student.firstName} {row.student.middleName}</td>
                <td>{group?.name}</td>
                <td>{row.recordsCount}</td>
                <td>{row.averageGrade}</td>
                <td>{row.debts}</td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>
    </section>
  );
}

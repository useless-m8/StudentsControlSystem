import type { ReactNode } from "react";

type DataTableProps = {
  children: ReactNode;
  empty: boolean;
  emptyText: string;
  colSpan: number;
};

export function DataTable({ children, empty, emptyText, colSpan }: DataTableProps) {
  return (
    <div className="card">
      <table>
        {children}
        {empty && (
          <tbody>
            <tr>
              <td colSpan={colSpan} className="empty">
                {emptyText}
              </td>
            </tr>
          </tbody>
        )}
      </table>
    </div>
  );
}

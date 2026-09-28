import type { ReactNode } from 'react';

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
  numeric?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  selectedKey?: string | null;
  onSelect?: (row: T) => void;
  emptyMessage: string;
  testId?: string;
}

export function DataTable<T>({ columns, rows, rowKey, selectedKey, onSelect, emptyMessage, testId }: DataTableProps<T>) {
  if (rows.length === 0) {
    return <div className="state">{emptyMessage}</div>;
  }
  return (
    <table className="data" data-testid={testId}>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.header} className={column.numeric ? 'num' : undefined}>
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const key = rowKey(row);
          const classes = [onSelect ? 'clickable' : '', key === selectedKey ? 'selected' : ''].join(' ').trim();
          return (
            <tr key={key} className={classes || undefined} onClick={onSelect ? () => { onSelect(row); } : undefined} data-row-key={key}>
              {columns.map((column) => (
                <td key={column.header} className={column.numeric ? 'num' : undefined}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

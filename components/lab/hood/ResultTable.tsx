import type { ReactNode } from "react";
import styles from "./Hood.module.css";

type Cell = string | number | null | Uint8Array | undefined;

interface ResultTableProps {
  columns: string[];
  rows: Cell[][];
  caption: string;
  /** Optional custom rendering for a cell. */
  renderCell?: (column: string, value: Cell) => ReactNode;
  maxHeight?: number;
}

function show(value: Cell): string {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Uint8Array) return `<${value.length} bytes>`;
  if (typeof value === "number" && !Number.isInteger(value)) return value.toFixed(3);
  return String(value);
}

export function ResultTable({ columns, rows, caption, renderCell, maxHeight }: ResultTableProps) {
  return (
    <div className={styles.resultScroll} style={maxHeight ? { maxHeight } : undefined}>
      <table className={styles.result}>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={Math.max(1, columns.length)} className={styles.empty}>
                No rows.
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              // Rows have no stable id; the order is the query's.
              // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional query output
              <tr key={rowIndex}>
                {columns.map((column, columnIndex) => {
                  const value = row[columnIndex];
                  return (
                    <td key={column} data-type={typeof value === "number" ? "number" : undefined}>
                      {renderCell ? renderCell(column, value) : show(value)}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export { show as showCell };

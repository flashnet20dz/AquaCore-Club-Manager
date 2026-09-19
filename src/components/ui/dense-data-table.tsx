"use client";

import React, { useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "center" | "right";
  isNumeric?: boolean;
  sortable?: boolean;
  render?: (row: T, index: number) => React.ReactNode;
}

export interface DenseDataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  emptyMessage?: string;
  className?: string;
}

export function DenseDataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = "لا توجد بيانات للعرض",
  className,
}: DenseDataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortAsc) {
        setSortAsc(false);
      } else {
        setSortKey(null);
      }
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const sortedData = React.useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a: any, b: any) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      if (typeof valA === "number" && typeof valB === "number") {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [data, sortKey, sortAsc]);

  return (
    <div className={cn("w-full overflow-x-auto rounded-near-md border border-[#3a3a48] bg-[#111118]", className)}>
      <table className="table-dense">
        <thead>
          <tr>
            {columns.map((col) => {
              const isSorted = sortKey === col.key;
              return (
                <th
                  key={col.key}
                  className={cn(
                    col.align === "center" && "text-center",
                    col.align === "left" && "text-left",
                    col.align === "right" && "text-right",
                    col.sortable && "cursor-pointer select-none hover:text-[#f1f5f9] motion-fast"
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className={cn("inline-flex items-center gap-1.5", col.align === "center" && "justify-center")}>
                    <span>{col.header}</span>
                    {col.sortable && (
                      <span className="text-[#7a7d8a]">
                        {isSorted ? (
                          sortAsc ? <ChevronUp className="h-3.5 w-3.5 text-[#3b82f6]" /> : <ChevronDown className="h-3.5 w-3.5 text-[#3b82f6]" />
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 opacity-40 hover:opacity-100" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-8 text-[#7a7d8a]">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedData.map((row, idx) => (
              <tr key={keyExtractor(row, idx)}>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      col.align === "center" && "text-center",
                      col.align === "left" && "text-left",
                      col.align === "right" && "text-right",
                      col.isNumeric && "font-mono-data"
                    )}
                  >
                    {col.render ? col.render(row, idx) : (row as any)[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

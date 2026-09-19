"use client";

import React from "react";
import {
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface DataPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  className?: string;
}

export function DataPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [24, 48, 96],
  itemLabel = "منخرط",
  className,
}: DataPaginationProps) {
  if (totalItems === 0) return null;

  const startItem = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // حساب أرقام الصفحات المعروضة مع نقاط الاختصار
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      if (start > 2) pages.push("ellipsis");
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push("ellipsis");

      pages.push(totalPages);
    }
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm text-xs select-none",
        className
      )}
      dir="rtl"
    >
      {/* ملخص العداد والصفحة */}
      <div className="flex items-center gap-3 text-muted-foreground w-full sm:w-auto justify-between sm:justify-start">
        <div className="flex items-center gap-1 font-medium">
          <span>عرض</span>
          <span className="font-bold text-foreground font-mono">
            {startItem} - {endItem}
          </span>
          <span>من أصل</span>
          <span className="font-bold text-primary font-mono">
            {totalItems}
          </span>
          <span>{itemLabel}</span>
        </div>

        {/* محدد حجم الصفحة */}
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span className="hidden md:inline text-[11px]">في الصفحة:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => onPageSizeChange(Number(val))}
            >
              <SelectTrigger className="h-8 w-16 text-xs font-mono font-bold bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((sz) => (
                  <SelectItem key={sz} value={String(sz)} className="text-xs font-mono">
                    {sz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* أزرار التنقل بين الصفحات */}
      <div className="flex items-center gap-1 flex-wrap justify-center w-full sm:w-auto">
        {/* الصفحة الأولى */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg"
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
          title="الصفحة الأولى"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>

        {/* الصفحة السابقة */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          title="الصفحة السابقة"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* أرقام الصفحات */}
        <div className="flex items-center gap-1 px-1">
          {pages.map((p, idx) => {
            if (p === "ellipsis") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1.5 text-muted-foreground font-bold tracking-widest text-xs"
                >
                  …
                </span>
              );
            }
            const isActive = p === currentPage;
            return (
              <Button
                key={p}
                variant={isActive ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-8 min-w-8 px-2 rounded-lg font-mono font-bold text-xs transition",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs scale-105"
                    : "hover:bg-accent/70"
                )}
                onClick={() => onPageChange(p)}
              >
                {p}
              </Button>
            );
          })}
        </div>

        {/* الصفحة التالية */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          title="الصفحة التالية"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* الصفحة الأخيرة */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          title="الصفحة الأخيرة"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

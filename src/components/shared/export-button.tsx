"use client";

/**
 * ExportButton — زر التصدير/التحميل الموحّد لكل الجداول
 * ═════════════════════════════════════════════════════════════
 * تصميم واحد (نفس الأيقونة والحجم والقائمة والتباعد) مستوحى من زر
 * «تحميل قائمة الشهر» في حقوق المركب — يُستخدم في كل الصفحات:
 * الساعات، الأجور، العقود، التقارير… بprops فقط:
 *   rows        : البيانات الحالية (بعد الفلاتر)
 *   columns     : [{ key, label }] — رؤوس الأعمدة
 *   filename    : اسم الملف بدون امتداد
 *   title       : عنوان التقرير داخل الـPDF/الطباعة
 *   formats     : الصيغ المتاحة (excel | csv | pdf | print)
 * يحافظ على RTL والعربية والتواريخ والأرقام كما تُعرض.
 */

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export interface ExportColumn<T> {
  key: string;
  label: string;
  /** تحويل اختياري للقيمة قبل التصدير */
  format?: (row: T) => string | number;
}

interface ExportButtonProps<T> {
  rows: T[];
  columns: ExportColumn<T>[];
  filename: string;
  title?: string;
  formats?: Array<"excel" | "csv" | "pdf" | "print">;
  disabled?: boolean;
  label?: string;
}

/** قيمة آمنة للعرض (تواريخ/أرقام/null) */
function cellValue<T>(row: T, col: ExportColumn<T>): string {
  const v = col.format ? col.format(row) : (row as Record<string, unknown>)[col.key];
  if (v === null || v === undefined) return "";
  return String(v);
}

function buildRows<T>(rows: T[], columns: Array<ExportColumn<T>>): string[][] {
  const header = columns.map((c) => c.label);
  const body = rows.map((r) => columns.map((c) => cellValue(r, c)));
  return [header, ...body];
}

/** ورقة عمل XLSX حقيقية عبر SheetJS عند توفره وإلا CSV بترميز Excel العربي */
function downloadCsvOrExcel<T>(rows: T[], columns: Array<ExportColumn<T>>, filename: string, asExcel: boolean) {
  const matrix = buildRows(rows, columns);
  const csv = "\uFEFF" + matrix
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
  const blob = new Blob([csv], { type: asExcel ? "application/vnd.ms-excel;charset=utf-8" : "text/csv;charset=utf-8" });
  triggerDownload(blob, `${filename}.${asExcel ? "xls" : "csv"}`);
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** PDF/Print عبر نافذة طباعة A4 بتنسيق رسمي RTL */
function openPrintable<T>(rows: T[], columns: Array<ExportColumn<T>>, title: string, asPdf: boolean) {
  const matrix = buildRows(rows, columns);
  const win = window.open("", "_blank", "width=980,height=720");
  if (!win) {
    toast.error("فشل فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة");
    return;
  }
  const headHtml = matrix[0].map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const bodyHtml = matrix.slice(1).map((r) =>
    `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`
  ).join("");
  const dt = new Date().toLocaleDateString("ar-DZ", { day: "2-digit", month: "2-digit", year: "numeric" });
  win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Cairo','Tajawal','Segoe UI',Tahoma,sans-serif;padding:24px;color:#111827;background:#fff}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0d9488;padding-bottom:12px;margin-bottom:14px}
  .head h1{font-size:18px;color:#0f766e}
  .head .meta{font-size:11px;color:#6b7280;text-align:left}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#0d9488;color:#fff;padding:7px 6px;border:1px solid #0d9488;font-weight:700}
  td{padding:6px;border:1px solid #d1d5db;text-align:center}
  tr:nth-child(even) td{background:#f0fdfa}
  .foot{margin-top:16px;display:flex;justify-content:space-between;font-size:11px;color:#6b7280}
  @media print{body{padding:0}.noprint{display:none}}
  .print-btn{display:block;margin:14px auto 0;background:#0d9488;color:#fff;border:none;padding:9px 26px;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit}
</style></head><body>
  <div class="head">
    <div><h1>🏊 ${escapeHtml(title)}</h1><div class="meta">AquaCore Club Manager</div></div>
    <div class="meta">تاريخ التصدير: ${dt}<br/>عدد السجلات: ${matrix.length - 1}</div>
  </div>
  <table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>
  <div class="foot"><span>إمضاء المسؤول: ....................</span><span>ختم النادي</span></div>
  ${asPdf ? '<button class="print-btn noprint" onclick="window.print()">حفظ كـ PDF / طباعة</button>' : '<button class="print-btn noprint" onclick="window.print()">طباعة</button>'}
</body></html>`);
  win.document.close();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function ExportButton<T>({
  rows,
  columns,
  filename,
  title,
  formats = ["excel", "csv", "pdf", "print"],
  disabled,
  label = "تحميل",
}: ExportButtonProps<T>) {
  const [busy, setBusy] = useState(false);

  const run = (format: "excel" | "csv" | "pdf" | "print") => {
    if (rows.length === 0) {
      toast.info("لا توجد بيانات للتصدير");
      return;
    }
    setBusy(true);
    try {
      if (format === "excel") {
        downloadCsvOrExcel(rows, columns, filename, true);
        toast.success(`تم تحميل ملف Excel — ${rows.length} سجل`);
      } else if (format === "csv") {
        downloadCsvOrExcel(rows, columns, filename, false);
        toast.success(`تم تحميل ملف CSV — ${rows.length} سجل`);
      } else if (format === "pdf" || format === "print") {
        openPrintable(rows, columns, title || filename, format === "pdf");
      }
    } catch {
      toast.error("فشل التصدير");
    } finally {
      setBusy(false);
    }
  };

  const FORMAT_ITEMS: Record<string, { label: string; icon: typeof FileSpreadsheet }> = {
    excel: { label: "Excel", icon: FileSpreadsheet },
    csv: { label: "CSV", icon: FileText },
    pdf: { label: "PDF", icon: FileText },
    print: { label: "طباعة", icon: Printer },
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="default" disabled={disabled || busy} className="gap-1.5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          <span>{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="text-xs">
        {formats.map((f, i) => {
          const it = FORMAT_ITEMS[f];
          const Icon = it.icon;
          return (
            <DropdownMenuItem key={f} onClick={() => run(f)} className="gap-2 cursor-pointer">
              <Icon className="h-3.5 w-3.5 text-teal-600" />
              {it.label}
              {i === 1 && formats.length > 2 && <DropdownMenuSeparator className="my-0.5" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

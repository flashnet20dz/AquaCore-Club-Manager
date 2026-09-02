"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Loader2, AlertTriangle, Printer, FileSpreadsheet,
  FileType, Calendar, Wallet, TrendingUp, TrendingDown, Users, Receipt,
  Clock, ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type ReportType = "summary" | "wages" | "income";

interface TxForReport {
  id: string;
  type: "income" | "expense";
  category: string;
  subCategory?: string | null;
  amount: number;
  date: string;
  paymentMethod: string;
  payeeName?: string | null;
  payeeId?: string | null;
  subscriberId?: string | null;
  reference?: string | null;
  note?: string | null;
}

interface EmployeeForReport {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  hourRate: number;
  userId?: string | null;
}

interface WorkHourForReport {
  id: string;
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  note?: string | null;
  user: { id: string; name: string };
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  subscription: "اشتراك",
  renewal: "تجديد",
  insurance: "تأمين",
  compound: "حقوق المركب",
  other_income: "مدخول آخر",
  wages: "أجور عمال",
  compound_rights: "حقوق المركب",
  office_supplies: "لوازم مكتبية",
  other_expense: "دفعات أخرى",
};

const POSITION_LABELS: Record<string, string> = {
  guard: "حارس سباحة",
  coach: "مدرب",
  admin: "إداري",
  maintenance: "صيانة",
  cleaner: "عامل نظافة",
  seasonal: "موسمي",
  other: "أخرى",
};

const REPORT_TYPES: { value: ReportType; label: string; icon: typeof FileText }[] = [
  { value: "summary", label: "الملخص الشهري", icon: FileText },
  { value: "wages", label: "تقرير الأجور", icon: Users },
  { value: "income", label: "تفصيل المداخيل", icon: TrendingUp },
];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function formatDA(n: number): string {
  return new Intl.NumberFormat("fr-DZ").format(Math.round(n)) + " دج";
}

function formatNum(n: number): string {
  return new Intl.NumberFormat("fr-DZ").format(Math.round(n));
}

function formatDate(s: string): string {
  try {
    return new Date(s).toLocaleDateString("ar-DZ", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return s;
  }
}

function toDateInputValue(d: Date): string {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function firstDayOfMonth(): string {
  const d = new Date();
  return toDateInputValue(new Date(d.getFullYear(), d.getMonth(), 1));
}

function lastDayOfMonth(): string {
  const d = new Date();
  return toDateInputValue(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

function firstDayOfLastMonth(): string {
  const d = new Date();
  return toDateInputValue(new Date(d.getFullYear(), d.getMonth() - 1, 1));
}

function lastDayOfLastMonth(): string {
  const d = new Date();
  return toDateInputValue(new Date(d.getFullYear(), d.getMonth(), 0));
}

function hoursBetween(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (e <= s) return 0;
  return Math.round(((e - s) / 3600000) * 10) / 10;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export function FinancialReports() {
  // Period
  const [dateFrom, setDateFrom] = useState<string>(firstDayOfMonth());
  const [dateTo, setDateTo] = useState<string>(lastDayOfMonth());
  const [reportType, setReportType] = useState<ReportType>("summary");

  // Data
  const [transactions, setTransactions] = useState<TxForReport[]>([]);
  const [employees, setEmployees] = useState<EmployeeForReport[]>([]);
  const [workHours, setWorkHours] = useState<WorkHourForReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!dateFrom || !dateTo) {
      toast.error("يرجى تحديد الفترة الزمنية");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Build query for financial transactions in the period (high limit for full report)
      const txQuery = new URLSearchParams({
        dateFrom,
        dateTo,
        page: "1",
        limit: "10000",
      });
      const txRes = await fetch(`/api/financial/transactions?${txQuery.toString()}`, { cache: "no-store" });
      if (!txRes.ok) throw new Error("HTTP " + txRes.status);
      const txData = await txRes.json();
      setTransactions(txData.transactions || []);

      // For wages report, also fetch employees + workhours
      if (reportType === "wages") {
        const [empRes, whRes] = await Promise.all([
          fetch("/api/employees", { cache: "no-store" }),
          fetch("/api/workhours", { cache: "no-store" }),
        ]);
        const empData = await empRes.json();
        const whData = await whRes.json();
        setEmployees(empData.employees || []);
        setWorkHours(whData.workHours || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, reportType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Period filter (client-side for workhours since API only takes month) ───
  const periodStart = useMemo(() => new Date(dateFrom + "T00:00:00"), [dateFrom]);
  const periodEnd = useMemo(() => new Date(dateTo + "T23:59:59"), [dateTo]);

  const periodTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const d = new Date(t.date);
      return d >= periodStart && d <= periodEnd;
    });
  }, [transactions, periodStart, periodEnd]);

  // ─── Summary calculations ───
  const summary = useMemo(() => {
    const income = periodTransactions.filter((t) => t.type === "income");
    const expense = periodTransactions.filter((t) => t.type === "expense");
    const totalIncome = income.reduce((s, t) => s + t.amount, 0);
    const totalExpense = expense.reduce((s, t) => s + t.amount, 0);

    const incomeByCat: Record<string, number> = {};
    const expenseByCat: Record<string, number> = {};
    for (const t of income) {
      incomeByCat[t.category] = (incomeByCat[t.category] || 0) + t.amount;
    }
    for (const t of expense) {
      expenseByCat[t.category] = (expenseByCat[t.category] || 0) + t.amount;
    }

    return {
      totalIncome,
      totalExpense,
      net: totalIncome - totalExpense,
      incomeCount: income.length,
      expenseCount: expense.length,
      incomeByCat,
      expenseByCat,
    };
  }, [periodTransactions]);

  // ─── Wages calculations ───
  const wagesData = useMemo(() => {
    if (reportType !== "wages") return [];
    // Filter workhours in period + approved + present
    const whInPeriod = workHours.filter((w) => {
      const d = new Date(w.date);
      return d >= periodStart && d <= periodEnd && w.status === "approved";
    });

    // For each employee: compute total hours (parse breakMinutes from note JSON)
    const empHoursMap = new Map<string, number>();
    for (const wh of whInPeriod) {
      // Skip absences (workStatus !== "present")
      let workStatus = "present";
      let breakMinutes = 0;
      try {
        if (wh.note && wh.note.startsWith("{")) {
          const meta = JSON.parse(wh.note);
          workStatus = meta.workStatus || "present";
          breakMinutes = meta.breakMinutes || 0;
        }
      } catch {}
      if (workStatus !== "present") continue;

      const emp = employees.find((e) => e.userId === wh.userId);
      if (!emp) continue;
      const hours = hoursBetween(wh.startTime, wh.endTime) - breakMinutes / 60;
      empHoursMap.set(emp.id, (empHoursMap.get(emp.id) || 0) + Math.max(0, hours));
    }

    // Wage transactions in the period (expense, category=wages)
    const wageTxns = periodTransactions.filter((t) => t.type === "expense" && t.category === "wages");

    // Match wages to employees
    return employees.map((emp) => {
      const hours = empHoursMap.get(emp.id) || 0;
      const calculatedWage = Math.round(hours * emp.hourRate);
      // Match by payeeId (== emp.id) OR payeeName (firstName + lastName)
      const fullName = `${emp.firstName} ${emp.lastName}`;
      const paid = wageTxns
        .filter((t) => t.payeeId === emp.id || (t.payeeName && t.payeeName.trim() === fullName.trim()))
        .reduce((s, t) => s + t.amount, 0);
      const remaining = calculatedWage - paid;
      return {
        employee: emp,
        hours,
        calculatedWage,
        paid,
        remaining,
      };
    }).filter((r) => r.hours > 0 || r.paid > 0); // only show employees with activity
  }, [reportType, workHours, employees, periodTransactions, periodStart, periodEnd]);

  const wagesTotals = useMemo(() => {
    return wagesData.reduce(
      (acc, r) => ({
        hours: acc.hours + r.hours,
        calculatedWage: acc.calculatedWage + r.calculatedWage,
        paid: acc.paid + r.paid,
        remaining: acc.remaining + r.remaining,
      }),
      { hours: 0, calculatedWage: 0, paid: 0, remaining: 0 }
    );
  }, [wagesData]);

  // ─── Income detail ───
  const incomeDetail = useMemo(() => {
    return periodTransactions
      .filter((t) => t.type === "income")
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [periodTransactions]);

  // ─── Export helpers ───
  const periodLabel = `${formatDate(dateFrom)} — ${formatDate(dateTo)}`;
  const reportTitle = REPORT_TYPES.find((r) => r.value === reportType)?.label || "";

  const downloadCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadDoc = (filename: string, htmlContent: string) => {
    const fullHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<title>${filename}</title>
<style>
  body { font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, sans-serif; padding: 24px; color: #111827; }
  h1 { text-align: center; font-size: 22px; margin-bottom: 4px; }
  h2 { text-align: center; font-size: 16px; color: #6b7280; font-weight: 500; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: right; font-size: 13px; }
  th { background: #f3f4f6; font-weight: 700; }
  .totals { background: #ecfdf5; font-weight: 700; }
  .signature { margin-top: 40px; display: flex; justify-content: space-between; }
  .sig-box { text-align: center; }
  .sig-line { width: 160px; border-top: 1px solid #9ca3af; margin-top: 40px; padding-top: 4px; font-size: 12px; color: #6b7280; }
</style>
</head>
<body>${htmlContent}</body>
</html>`;
    const blob = new Blob(["\uFEFF" + fullHtml], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    if (reportType === "summary") {
      const rows: (string | number)[][] = [];
      rows.push(["المداخيل", "المصاريف", "الصافي"]);
      rows.push([summary.totalIncome, summary.totalExpense, summary.net]);
      rows.push([]);
      rows.push(["تفصيل المداخيل"]);
      rows.push(["الفئة", "المبلغ"]);
      Object.entries(summary.incomeByCat).forEach(([k, v]) =>
        rows.push([CATEGORY_LABELS[k] || k, v])
      );
      rows.push([]);
      rows.push(["تفصيل المصاريف"]);
      rows.push(["الفئة", "المبلغ"]);
      Object.entries(summary.expenseByCat).forEach(([k, v]) =>
        rows.push([CATEGORY_LABELS[k] || k, v])
      );
      downloadCSV(`financial-summary-${dateFrom}-to-${dateTo}.csv`, [], rows);
    } else if (reportType === "wages") {
      const rows = wagesData.map((r) => [
        `${r.employee.firstName} ${r.employee.lastName}`,
        POSITION_LABELS[r.employee.position] || r.employee.position,
        r.hours,
        r.employee.hourRate,
        r.calculatedWage,
        r.paid,
        r.remaining,
      ]);
      rows.push(["المجموع", "", wagesTotals.hours, "", wagesTotals.calculatedWage, wagesTotals.paid, wagesTotals.remaining]);
      downloadCSV(
        `wages-report-${dateFrom}-to-${dateTo}.csv`,
        ["الموظف", "المنصب", "الساعات", "سعر الساعة", "الأجر المحتسب", "المدفوع", "المتبقي"],
        rows
      );
    } else {
      const rows = incomeDetail.map((t) => [
        formatDate(t.date),
        CATEGORY_LABELS[t.category] || t.category,
        t.amount,
        t.payeeName || "",
        t.reference || "",
        t.note || "",
      ]);
      rows.push(["المجموع", "", summary.totalIncome, "", "", ""]);
      downloadCSV(
        `income-detail-${dateFrom}-to-${dateTo}.csv`,
        ["التاريخ", "الفئة", "المبلغ", "الجهة", "المرجع", "ملاحظات"],
        rows
      );
    }
    toast.success("تم تصدير التقرير بصيغة Excel/CSV");
  };

  const handleExportWord = () => {
    const html = `
      <h1>تقرير ${reportTitle}</h1>
      <h2>الفترة: ${periodLabel}</h2>
      ${buildReportTableHTML()}
      <div class="signature">
        <div class="sig-box"><div>توقيع المحاسب</div><div class="sig-line"></div></div>
        <div class="sig-box"><div>الختم</div><div class="sig-line"></div></div>
      </div>
    `;
    downloadDoc(`financial-${reportType}-report-${dateFrom}.doc`, html);
    toast.success("تم تصدير التقرير بصيغة Word");
  };

  const handlePrintPDF = () => {
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) {
      toast.error("فشل فتح نافذة الطباعة. الرجاء السماح بالنوافذ المنبثقة.");
      return;
    }
    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<title>تقرير ${reportTitle}</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, sans-serif; color: #111827; padding: 24px; }
  .header { text-align: center; border-bottom: 3px solid #0ea5e9; padding-bottom: 12px; margin-bottom: 20px; }
  .club-name { font-size: 22px; font-weight: 800; color: #0c4a6e; }
  .report-title { font-size: 18px; font-weight: 700; margin-top: 4px; color: #1f2937; }
  .period { font-size: 13px; color: #6b7280; margin-top: 4px; }
  .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
  .stat-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; text-align: center; }
  .stat-box .label { font-size: 11px; color: #6b7280; }
  .stat-box .value { font-size: 18px; font-weight: 800; margin-top: 4px; }
  .stat-box.income { background: #ecfdf5; border-color: #10b981; }
  .stat-box.income .value { color: #047857; }
  .stat-box.expense { background: #fef2f2; border-color: #f43f5e; }
  .stat-box.expense .value { color: #be123c; }
  .stat-box.net { background: #eff6ff; border-color: #0ea5e9; }
  .stat-box.net .value { color: #0c4a6e; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: right; font-size: 12px; }
  th { background: #f3f4f6; font-weight: 700; }
  .totals td { background: #fef3c7; font-weight: 700; }
  .signature { margin-top: 48px; display: flex; justify-content: space-between; }
  .sig-box { text-align: center; }
  .sig-line { width: 160px; border-top: 1px solid #9ca3af; margin-top: 40px; padding-top: 4px; font-size: 12px; color: #6b7280; }
  .stamp-area { width: 110px; height: 110px; border: 2px dashed #d1d5db; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #9ca3af; margin: 0 auto; }
  .print-btn { background: #0ea5e9; color: white; border: none; padding: 10px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; margin: 16px auto; display: block; }
  .print-btn:hover { background: #0284c7; }
  @media print { .no-print { display: none; } body { padding: 0; } }
</style>
</head>
<body>
  <div class="header">
    <div class="club-name">نادي السباحة</div>
    <div class="report-title">تقرير ${reportTitle}</div>
    <div class="period">الفترة: ${periodLabel}</div>
  </div>
  ${buildReportTableHTML(true)}
  <div class="signature">
    <div class="sig-box">
      <div>توقيع المحاسب</div>
      <div class="sig-line"></div>
    </div>
    <div class="sig-box">
      <div>الختم</div>
      <div class="stamp-area">ختم النادي</div>
    </div>
  </div>
  <button class="print-btn no-print" onclick="window.print()">طباعة / حفظ PDF</button>
</body>
</html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  function buildReportTableHTML(forPrint = false): string {
    if (reportType === "summary") {
      const incomeRows = Object.entries(summary.incomeByCat)
        .map(([k, v]) => `<tr><td>${CATEGORY_LABELS[k] || k}</td><td>${formatNum(v)} دج</td></tr>`)
        .join("");
      const expenseRows = Object.entries(summary.expenseByCat)
        .map(([k, v]) => `<tr><td>${CATEGORY_LABELS[k] || k}</td><td>${formatNum(v)} دج</td></tr>`)
        .join("");
      const statsHTML = forPrint ? `
        <div class="stats-grid">
          <div class="stat-box income"><div class="label">إجمالي المداخيل</div><div class="value">${formatNum(summary.totalIncome)} دج</div></div>
          <div class="stat-box expense"><div class="label">إجمالي المصاريف</div><div class="value">${formatNum(summary.totalExpense)} دج</div></div>
          <div class="stat-box net"><div class="label">الصافي</div><div class="value">${formatNum(summary.net)} دج</div></div>
        </div>` : `
        <p><strong>إجمالي المداخيل:</strong> ${formatNum(summary.totalIncome)} دج</p>
        <p><strong>إجمالي المصاريف:</strong> ${formatNum(summary.totalExpense)} دج</p>
        <p><strong>الصافي:</strong> ${formatNum(summary.net)} دج</p>`;
      return `
        ${statsHTML}
        <h3>تفصيل المداخيل حسب الفئة</h3>
        <table><thead><tr><th>الفئة</th><th>المبلغ</th></tr></thead><tbody>${incomeRows || '<tr><td colspan="2">لا توجد</td></tr>'}</tbody></table>
        <h3>تفصيل المصاريف حسب الفئة</h3>
        <table><thead><tr><th>الفئة</th><th>المبلغ</th></tr></thead><tbody>${expenseRows || '<tr><td colspan="2">لا توجد</td></tr>'}</tbody></table>
      `;
    }
    if (reportType === "wages") {
      const rows = wagesData
        .map((r) => `<tr>
          <td>${r.employee.firstName} ${r.employee.lastName}</td>
          <td>${POSITION_LABELS[r.employee.position] || r.employee.position}</td>
          <td>${r.hours}</td>
          <td>${formatNum(r.employee.hourRate)} دج</td>
          <td>${formatNum(r.calculatedWage)} دج</td>
          <td>${formatNum(r.paid)} دج</td>
          <td>${formatNum(r.remaining)} دج</td>
        </tr>`).join("");
      return `
        <table>
          <thead><tr>
            <th>الموظف</th><th>المنصب</th><th>الساعات</th><th>سعر الساعة</th>
            <th>الأجر المحتسب</th><th>المدفوع</th><th>المتبقي</th>
          </tr></thead>
          <tbody>${rows || '<tr><td colspan="7">لا توجد بيانات</td></tr>'}</tbody>
          <tfoot class="totals"><tr>
            <td colspan="2">المجموع</td>
            <td>${wagesTotals.hours}</td>
            <td>—</td>
            <td>${formatNum(wagesTotals.calculatedWage)} دج</td>
            <td>${formatNum(wagesTotals.paid)} دج</td>
            <td>${formatNum(wagesTotals.remaining)} دج</td>
          </tr></tfoot>
        </table>
      `;
    }
    // income detail
    const rows = incomeDetail
      .map((t) => `<tr>
        <td>${formatDate(t.date)}</td>
        <td>${CATEGORY_LABELS[t.category] || t.category}</td>
        <td>${formatNum(t.amount)} دج</td>
        <td>${t.payeeName || "—"}</td>
        <td>${t.reference || "—"}</td>
      </tr>`).join("");
    return `
      <table>
        <thead><tr><th>التاريخ</th><th>الفئة</th><th>المبلغ</th><th>الجهة</th><th>المرجع</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5">لا توجد مداخيل في هذه الفترة</td></tr>'}</tbody>
        <tfoot class="totals"><tr><td colspan="2">المجموع</td><td>${formatNum(summary.totalIncome)} دج</td><td colspan="2"></td></tr></tfoot>
      </table>
    `;
  }

  // ─── Render ───
  return (
    <div dir="rtl" className="space-y-4 pb-2">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-primary/10 p-2">
            <ScrollText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">التقارير المالية</h2>
            <p className="text-xs text-muted-foreground">إنشاء وتصدير تقارير احترافية للفترات المحددة</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={loading}>
            <FileSpreadsheet className="h-4 w-4" />
            <span className="hidden sm:inline">Excel</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportWord} disabled={loading}>
            <FileType className="h-4 w-4" />
            <span className="hidden sm:inline">Word</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrintPDF} disabled={loading}>
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
        </div>
      </div>

      {/* Period + type selector */}
      <Card>
        <CardContent className="p-4">
          {/* ★ فترات سريعة: اليوم / هذا الأسبوع / الشهر / الشهر الماضي / مخصصة */}
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            <span className="text-[11px] text-muted-foreground ml-1">فترات سريعة:</span>
            {([
              { label: "اليوم", from: toDateInputValue(new Date()), to: toDateInputValue(new Date()) },
              { label: "هذا الأسبوع", from: toDateInputValue(new Date(Date.now() - 6 * 86400000)), to: toDateInputValue(new Date()) },
              { label: "هذا الشهر", from: firstDayOfMonth(), to: lastDayOfMonth() },
              { label: "الشهر الماضي", from: firstDayOfLastMonth(), to: lastDayOfLastMonth() },
            ] as const).map((p) => (
              <button
                key={p.label}
                onClick={() => { setDateFrom(p.from); setDateTo(p.to); }}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-bold transition border",
                  dateFrom === p.from && dateTo === p.to
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                من تاريخ
              </Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                إلى تاريخ
              </Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">نوع التقرير</Label>
              <div className="grid grid-cols-3 gap-2">
                {REPORT_TYPES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setReportType(r.value)}
                    className={cn(
                      "h-9 rounded-md border-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-all",
                      reportType === r.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    <r.icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{r.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report body */}
      {loading ? (
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-rose-600" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchData}>
              إعادة المحاولة
            </Button>
          </CardContent>
        </Card>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={reportType}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {reportType === "summary" && (
              <SummaryReport
                summary={summary}
                periodLabel={periodLabel}
              />
            )}
            {reportType === "wages" && (
              <WagesReport
                rows={wagesData}
                totals={wagesTotals}
                periodLabel={periodLabel}
              />
            )}
            {reportType === "income" && (
              <IncomeDetailReport
                rows={incomeDetail}
                total={summary.totalIncome}
                periodLabel={periodLabel}
              />
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-reports
// ─────────────────────────────────────────────────────────────
function SummaryReport({
  summary,
  periodLabel,
}: {
  summary: {
    totalIncome: number;
    totalExpense: number;
    net: number;
    incomeCount: number;
    expenseCount: number;
    incomeByCat: Record<string, number>;
    expenseByCat: Record<string, number>;
  };
  periodLabel: string;
}) {
  const isEmpty = summary.incomeCount === 0 && summary.expenseCount === 0;

  if (isEmpty) {
    return <EmptyReport periodLabel={periodLabel} message="لا توجد عمليات مالية في هذه الفترة" />;
  }

  const incomeByCatArr = Object.entries(summary.incomeByCat).sort((a, b) => b[1] - a[1]);
  const expenseByCatArr = Object.entries(summary.expenseByCat).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      {/* Top stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatBox
          icon={TrendingUp}
          label="إجمالي المداخيل"
          value={formatDA(summary.totalIncome)}
          tone="emerald"
          sub={`${summary.incomeCount} عملية`}
        />
        <StatBox
          icon={TrendingDown}
          label="إجمالي المصاريف"
          value={formatDA(summary.totalExpense)}
          tone="rose"
          sub={`${summary.expenseCount} عملية`}
        />
        <StatBox
          icon={Wallet}
          label="الصافي"
          value={formatDA(summary.net)}
          tone={summary.net >= 0 ? "sky" : "rose"}
          sub={summary.net >= 0 ? "ربح" : "خسارة"}
        />
      </div>

      {/* Category breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              المداخيل حسب الفئة
            </CardTitle>
            <CardDescription>تفصيلي لكل فئة</CardDescription>
          </CardHeader>
          <CardContent>
            {incomeByCatArr.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">لا توجد مداخيل</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-xs">الفئة</TableHead>
                    <TableHead className="text-xs text-left">المبلغ</TableHead>
                    <TableHead className="text-xs text-left">النسبة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomeByCatArr.map(([k, v]) => {
                    const pct = summary.totalIncome > 0 ? (v / summary.totalIncome) * 100 : 0;
                    return (
                      <TableRow key={k} className="border-border/40">
                        <TableCell className="text-sm text-foreground">
                          {CATEGORY_LABELS[k] || k}
                        </TableCell>
                        <TableCell className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400 text-left">
                          {formatDA(v)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground text-left tabular-nums">
                          {pct.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="border-t-2 border-border bg-muted/30">
                    <TableCell className="text-sm font-bold">المجموع</TableCell>
                    <TableCell className="text-sm font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400 text-left">
                      {formatDA(summary.totalIncome)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground text-left">100%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-4 w-4 text-rose-500" />
              المصاريف حسب الفئة
            </CardTitle>
            <CardDescription>تفصيلي لكل فئة</CardDescription>
          </CardHeader>
          <CardContent>
            {expenseByCatArr.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">لا توجد مصاريف</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-xs">الفئة</TableHead>
                    <TableHead className="text-xs text-left">المبلغ</TableHead>
                    <TableHead className="text-xs text-left">النسبة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenseByCatArr.map(([k, v]) => {
                    const pct = summary.totalExpense > 0 ? (v / summary.totalExpense) * 100 : 0;
                    return (
                      <TableRow key={k} className="border-border/40">
                        <TableCell className="text-sm text-foreground">
                          {CATEGORY_LABELS[k] || k}
                        </TableCell>
                        <TableCell className="text-sm font-bold tabular-nums text-rose-600 dark:text-rose-400 text-left">
                          {formatDA(v)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground text-left tabular-nums">
                          {pct.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="border-t-2 border-border bg-muted/30">
                    <TableCell className="text-sm font-bold">المجموع</TableCell>
                    <TableCell className="text-sm font-extrabold tabular-nums text-rose-600 dark:text-rose-400 text-left">
                      {formatDA(summary.totalExpense)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground text-left">100%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function WagesReport({
  rows,
  totals,
  periodLabel,
}: {
  rows: Array<{
    employee: EmployeeForReport;
    hours: number;
    calculatedWage: number;
    paid: number;
    remaining: number;
  }>;
  totals: { hours: number; calculatedWage: number; paid: number; remaining: number };
  periodLabel: string;
}) {
  if (rows.length === 0) {
    return <EmptyReport periodLabel={periodLabel} message="لا توجد بيانات أجور أو ساعات عمل في هذه الفترة" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-primary" />
          تقرير أجور العمال
        </CardTitle>
        <CardDescription>
          الفترة: {periodLabel} — {rows.length} موظف
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-[65vh] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur-sm">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs">الموظف</TableHead>
                <TableHead className="text-xs hidden sm:table-cell">المنصب</TableHead>
                <TableHead className="text-xs text-left">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    الساعات
                  </span>
                </TableHead>
                <TableHead className="text-xs text-left hidden md:table-cell">سعر الساعة</TableHead>
                <TableHead className="text-xs text-left">الأجر المحتسب</TableHead>
                <TableHead className="text-xs text-left">المدفوع</TableHead>
                <TableHead className="text-xs text-left">المتبقي</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.employee.id} className="border-border/40">
                  <TableCell className="text-sm font-medium text-foreground">
                    {r.employee.firstName} {r.employee.lastName}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                    <Badge variant="outline" className="text-[10px]">
                      {POSITION_LABELS[r.employee.position] || r.employee.position}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-left text-foreground">
                    {r.hours}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-muted-foreground text-left hidden md:table-cell">
                    {formatNum(r.employee.hourRate)} دج
                  </TableCell>
                  <TableCell className="text-sm font-bold tabular-nums text-left text-foreground">
                    {formatDA(r.calculatedWage)}
                  </TableCell>
                  <TableCell className="text-sm font-bold tabular-nums text-left text-emerald-600 dark:text-emerald-400">
                    {formatDA(r.paid)}
                  </TableCell>
                  <TableCell className={cn(
                    "text-sm font-bold tabular-nums text-left",
                    r.remaining > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                  )}>
                    {formatDA(r.remaining)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 border-border bg-muted/30">
                <TableCell className="text-sm font-bold" colSpan={2}>المجموع</TableCell>
                <TableCell className="text-sm font-bold tabular-nums text-left">{totals.hours}</TableCell>
                <TableCell className="text-xs text-muted-foreground text-left hidden md:table-cell">—</TableCell>
                <TableCell className="text-sm font-extrabold tabular-nums text-left">
                  {formatDA(totals.calculatedWage)}
                </TableCell>
                <TableCell className="text-sm font-extrabold tabular-nums text-left text-emerald-600 dark:text-emerald-400">
                  {formatDA(totals.paid)}
                </TableCell>
                <TableCell className={cn(
                  "text-sm font-extrabold tabular-nums text-left",
                  totals.remaining > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                )}>
                  {formatDA(totals.remaining)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function IncomeDetailReport({
  rows,
  total,
  periodLabel,
}: {
  rows: TxForReport[];
  total: number;
  periodLabel: string;
}) {
  if (rows.length === 0) {
    return <EmptyReport periodLabel={periodLabel} message="لا توجد مداخيل في هذه الفترة" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="h-4 w-4 text-emerald-500" />
          تفصيل المداخيل
        </CardTitle>
        <CardDescription>
          الفترة: {periodLabel} — {rows.length} عملية — الإجمالي: {formatDA(total)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-[65vh] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur-sm">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs">#</TableHead>
                <TableHead className="text-xs">التاريخ</TableHead>
                <TableHead className="text-xs">الفئة</TableHead>
                <TableHead className="text-xs text-left">المبلغ</TableHead>
                <TableHead className="text-xs hidden md:table-cell">الجهة / المنخرط</TableHead>
                <TableHead className="text-xs hidden lg:table-cell">طريقة الدفع</TableHead>
                <TableHead className="text-xs hidden lg:table-cell">المرجع</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t, idx) => (
                <TableRow key={t.id} className="border-border/40">
                  <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(t.date)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                      {CATEGORY_LABELS[t.category] || t.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm font-bold tabular-nums text-left text-emerald-600 dark:text-emerald-400">
                    {formatDA(t.amount)}
                  </TableCell>
                  <TableCell className="text-xs text-foreground hidden md:table-cell">
                    {t.payeeName || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">
                    {t.paymentMethod === "cash" ? "نقدي" : t.paymentMethod === "bank" ? "بنك" : t.paymentMethod === "cheque" ? "شيك" : t.paymentMethod}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">
                    {t.reference || "—"}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 border-border bg-muted/30">
                <TableCell colSpan={3} className="text-sm font-bold">المجموع</TableCell>
                <TableCell className="text-sm font-extrabold tabular-nums text-left text-emerald-600 dark:text-emerald-400">
                  {formatDA(total)}
                </TableCell>
                <TableCell colSpan={3} className="text-xs text-muted-foreground"></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
  tone,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "emerald" | "rose" | "sky" | "amber" | "violet";
  sub?: string;
}) {
  const toneClasses = {
    emerald: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
    rose: "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400",
    sky: "bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-400",
    amber: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400",
    violet: "bg-violet-500/10 border-violet-500/30 text-violet-700 dark:text-violet-400",
  }[tone];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn("rounded-xl border p-4 flex items-center gap-3", toneClasses)}
    >
      <span className={cn("rounded-lg p-2 bg-card/50", toneClasses)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-lg font-extrabold tabular-nums leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );
}

function EmptyReport({ periodLabel, message }: { periodLabel: string; message: string }) {
  return (
    <Card>
      <CardContent className="py-12 flex flex-col items-center gap-3">
        <div className="rounded-full bg-muted p-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="font-semibold text-foreground">{message}</p>
        <p className="text-xs text-muted-foreground">الفترة: {periodLabel}</p>
        <p className="text-xs text-muted-foreground max-w-md text-center">
          جرّب توسيع نطاق الفترة أو تغيير نوع التقرير. يمكنك أيضاً تسجيل عمليات جديدة من تبويب الدفعات.
        </p>
      </CardContent>
    </Card>
  );
}

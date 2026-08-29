"use client";

/**
 * مكتبة التقارير الفردية
 * ──────────────────────
 * يحتوي هذا الملف على 15 تقرير مستقل، كل تقرير هو صفحة كاملة تحتوي على:
 *  - الترويسة الموحدة (UnifiedReportHeader)
 *  - بطاقات إحصائية سريعة
 *  - فلاتر متقدمة
 *  - جدول بيانات + ترقيم صفحات + بحث + ترتيب
 *  - أزرار تصدير: طباعة، PDF، Word، Excel
 *
 * كل تقرير يستخدم نفس المكونات المشتركة (ReportToolbar, ReportStatCard, ReportTable)
 * لتفادي تكرار الكود.
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Printer, FileText, FileType, FileSpreadsheet, Loader2, Search,
  ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown,
  Users, ShieldCheck, Building2, RefreshCw, Calendar, Wallet,
  Activity, Crown, Tag, Clock, Droplet, TrendingUp, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSubscriptionTypes } from "@/hooks/use-subscription-types";
import { UnifiedReportHeader, unifiedReportHeaderHTML } from "@/components/unified-report-header";
import type { EnteteConfig } from "@/components/unified-report-header";
import { type SubscriberWithComputed, isExemptStatus } from "@/lib/rcs";

// ──────────────── Shared utilities ────────────────

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function formatMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("fr-DZ") + " دج";
}

interface ReportStatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

function ReportStatCard({ label, value, icon: Icon, color }: ReportStatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("rounded-xl border-2 bg-gradient-to-br p-3", color)}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/60 dark:bg-black/20 shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground truncate">{label}</p>
          <p className="text-base font-bold leading-tight">{value}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ──────────────── Report Toolbar (shared export buttons) ────────────────

interface ReportToolbarProps {
  reportTitle: string;
  reportNumber?: string;
  data: any[];
  columns: { key: string; label: string; width?: string }[];
  exportData?: any[];
  extraExportHTML?: string;
  entete?: EnteteConfig;
  settings?: Record<string, string>;
}

function ReportToolbar({
  reportTitle,
  reportNumber,
  data,
  columns,
  exportData,
  extraExportHTML,
  entete,
  settings,
}: ReportToolbarProps) {
  const [exporting, setExporting] = useState<string | null>(null);
  const rows = exportData || data;

  const handlePrint = () => {
    const printWin = window.open("", "_blank");
    if (!printWin) { toast.error("اسمح بالنوافذ المنبثقة"); return; }
    const headerHTML = unifiedReportHeaderHTML({
      reportType: reportTitle,
      reportNumber,
      date: formatDate(new Date()),
      entete,
      settings,
    });
    const rowsHTML = rows.map((r, i) => `
      <tr>
        <td style="text-align:center;padding:5px;border:1px solid #ddd;">${i + 1}</td>
        ${columns.map((c) => `<td style="padding:5px;border:1px solid #ddd;">${r[c.key] ?? "—"}</td>`).join("")}
      </tr>
    `).join("");
    printWin.document.write(`
      <!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>${reportTitle}</title>
      <style>
        *{font-family:'Cairo','Tahoma',Arial,sans-serif;box-sizing:border-box;}
        body{padding:15px;}
        table{width:100%;border-collapse:collapse;font-size:11pt;margin-top:15px;}
        th{background:#0f766e;color:white;padding:8px;border:1px solid #ddd;text-align:right;}
        td{font-size:10pt;}
        tr:nth-child(even){background:#f9fafb;}
        @media print{body{padding:0;}}
      </style></head><body>
      ${headerHTML}
      ${extraExportHTML || ""}
      <table>
        <thead><tr>
          <th style="width:40px;text-align:center;">#</th>
          ${columns.map((c) => `<th style="${c.width ? `width:${c.width};` : ""}">${c.label}</th>`).join("")}
        </tr></thead>
        <tbody>${rowsHTML}</tbody>
      </table>
      <p style="text-align:left;font-size:9pt;color:#666;margin-top:10px;">عدد السجلات: ${rows.length}</p>
      <script>setTimeout(()=>window.print(),300);</script>
      </body></html>
    `);
    printWin.document.close();
  };

  const handleExportPDF = () => {
    setExporting("pdf");
    import("jspdf").then((jsPDF) => {
      import("jspdf-autotable").then((autoTable) => {
        try {
          const doc = new jsPDF.default({ orientation: "landscape", unit: "mm", format: "a4" });
          doc.setFontSize(16);
          doc.text(reportTitle, 148, 15, { align: "center" });
          doc.setFontSize(10);
          doc.text(`عدد السجلات: ${rows.length} | التاريخ: ${formatDate(new Date())}`, 148, 22, { align: "center" });
          autoTable.default(doc, {
            startY: 28,
            head: [["#", ...columns.map((c) => c.label)]],
            body: rows.map((r, i) => [String(i + 1), ...columns.map((c) => String(r[c.key] ?? "—"))]),
            styles: { fontSize: 9, halign: "right" },
            headStyles: { fillColor: [15, 118, 110], textColor: 255, halign: "right" },
            alternateRowStyles: { fillColor: [240, 250, 248] },
          });
          doc.save(`${reportTitle}_${new Date().toISOString().split("T")[0]}.pdf`);
        } catch (e) {
          toast.error("فشل تصدير PDF");
        } finally {
          setExporting(null);
        }
      });
    });
  };

  const handleExportWord = () => {
    setExporting("word");
    try {
      const headerHTML = unifiedReportHeaderHTML({
        reportType: reportTitle,
        reportNumber,
        date: formatDate(new Date()),
        entete,
        settings,
      });
      const rowsHTML = rows.map((r, i) => `
        <tr>
          <td style="text-align:center;padding:5px;border:1px solid #ddd;">${i + 1}</td>
          ${columns.map((c) => `<td style="padding:5px;border:1px solid #ddd;">${r[c.key] ?? "—"}</td>`).join("")}
        </tr>
      `).join("");
      const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>${reportTitle}</title>
<style>
  *{font-family:'Cairo','Tahoma',Arial,sans-serif;}
  body{padding:15px;}
  table{width:100%;border-collapse:collapse;font-size:11pt;margin-top:15px;}
  th{background:#0f766e;color:white;padding:8px;border:1px solid #ddd;text-align:right;}
  td{font-size:10pt;}
  @page{size:A4 landscape;margin:1.5cm;}
</style></head>
<body>
${headerHTML}
${extraExportHTML || ""}
<table>
  <thead><tr>
    <th style="width:40px;text-align:center;">#</th>
    ${columns.map((c) => `<th>${c.label}</th>`).join("")}
  </tr></thead>
  <tbody>${rowsHTML}</tbody>
</table>
<p style="text-align:left;font-size:9pt;color:#666;margin-top:10px;">عدد السجلات: ${rows.length}</p>
</body></html>`;
      const blob = new Blob([html], { type: "application/msword" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportTitle}_${new Date().toISOString().split("T")[0]}.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error("فشل تصدير Word");
    } finally {
      setExporting(null);
    }
  };

  const handleExportExcel = () => {
    setExporting("xlsx");
    import("xlsx").then((XLSX) => {
      try {
        const data = rows.map((r, i) => {
          const row: Record<string, any> = { "رقم": i + 1 };
          columns.forEach((c) => { row[c.label] = r[c.key] ?? "—"; });
          return row;
        });
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, reportTitle.substring(0, 30));
        XLSX.writeFile(wb, `${reportTitle}_${new Date().toISOString().split("T")[0]}.xlsx`);
      } catch {
        toast.error("فشل تصدير Excel");
      } finally {
        setExporting(null);
      }
    });
  };

  return (
    <div className="flex flex-wrap gap-2 items-center justify-between p-3 rounded-xl border border-border/60 bg-card">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
          {rows.length} سجل
        </Badge>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handlePrint} disabled={!rows.length}>
          <Printer className="h-3.5 w-3.5 ml-1" /> طباعة
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleExportPDF} disabled={!rows.length || exporting === "pdf"}>
          {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> : <FileText className="h-3.5 w-3.5 ml-1" />} PDF
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleExportWord} disabled={!rows.length || exporting === "word"}>
          {exporting === "word" ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> : <FileType className="h-3.5 w-3.5 ml-1" />} Word
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleExportExcel} disabled={!rows.length || exporting === "xlsx"}>
          {exporting === "xlsx" ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> : <FileSpreadsheet className="h-3.5 w-3.5 ml-1" />} Excel
        </Button>
      </div>
    </div>
  );
}

// ──────────────── Report Table (with search, sort, pagination) ────────────────

interface ReportTableProps {
  data: any[];
  columns: { key: string; label: string; width?: string; render?: (v: any, row: any) => React.ReactNode }[];
  pageSize?: number;
}

function ReportTable({ data, columns, pageSize = 25 }: ReportTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      columns.some((c) => String(row[c.key] ?? "").toLowerCase().includes(q))
    );
  }, [data, search, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const paged = sorted.slice(start, start + pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="بحث في الجدول..."
            className="h-9 pr-9 text-xs"
          />
        </div>
        <Badge variant="outline" className="text-[10px]">
          {filtered.length} / {data.length}
        </Badge>
      </div>

      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card border-b z-10">
              <tr className="text-right">
                <th className="p-2 font-semibold w-10 text-center">#</th>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className="p-2 font-semibold cursor-pointer hover:bg-accent/50 select-none"
                    style={c.width ? { width: c.width } : undefined}
                    onClick={() => toggleSort(c.key)}
                  >
                    <div className="flex items-center gap-1">
                      <span>{c.label}</span>
                      {sortKey === c.key ? (
                        sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-30" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={columns.length + 1} className="text-center py-8 text-muted-foreground">لا توجد بيانات</td></tr>
              ) : (
                paged.map((row, i) => (
                  <tr key={i} className="border-b hover:bg-accent/30">
                    <td className="p-2 text-center text-muted-foreground tabular-nums">{start + i + 1}</td>
                    {columns.map((c) => (
                      <td key={c.key} className="p-2">
                        {c.render ? c.render(row[c.key], row) : String(row[c.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-[10px] text-muted-foreground">
            عرض {start + 1}-{Math.min(start + pageSize, sorted.length)} من {sorted.length}
          </p>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs px-2">{currentPage} / {totalPages}</span>
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────── Filter chips ────────────────
function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition border",
            value === o.id
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card border-border hover:border-primary/40 text-muted-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ──────────────── Hook: load subscribers + entete + settings ────────────────
function useReportData() {
  const [subscribers, setSubscribers] = useState<SubscriberWithComputed[]>([]);
  const [entete, setEntete] = useState<EnteteConfig | undefined>(undefined);
  const [settings, setSettings] = useState<Record<string, string> | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/subscribers").then((r) => r.json()).catch(() => ({ subscribers: [] })),
      fetch("/api/entete").then((r) => r.json()).catch(() => ({ config: null })),
      fetch("/api/settings").then((r) => r.json()).catch(() => ({ settings: {} })),
    ]).then(([subData, enteteData, settingsData]) => {
      setSubscribers(subData.subscribers || []);
      if (enteteData.config) setEntete(enteteData.config);
      if (settingsData.settings) setSettings(settingsData.settings);
      setLoading(false);
    });
  }, []);

  return { subscribers, entete, settings, loading };
}

// ──────────────── Report shell wrapper ────────────────
function ReportShell({
  reportId,
  title,
  subtitle,
  stats,
  filters,
  table,
  toolbar,
}: {
  reportId: string;
  title: string;
  subtitle?: string;
  stats?: React.ReactNode;
  filters?: React.ReactNode;
  table: React.ReactNode;
  toolbar: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <UnifiedReportHeader
        reportType={title}
        reportSubtitle={subtitle}
        reportNumber={`${reportId}/${new Date().getFullYear()}`}
      />
      {stats}
      {filters}
      {toolbar}
      {table}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ════════════ 1. قائمة المنخرطين (مطابقة لملف Excel — ورقة "بيانات") ═══
// ════════════════════════════════════════════════════════════════════

export function SubscribersListReport() {
  const { subscribers, entete, settings, loading } = useReportData();
  const { activeTypes: subTypes } = useSubscriptionTypes();
  const [filterGender, setFilterGender] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  const filtered = subscribers.filter((s) => {
    if (filterGender && s.gender !== filterGender) return false;
    if (filterType && s.subscriptionType !== filterType) return false;
    if (filterStatus && s.paymentStatus !== filterStatus) return false;
    return true;
  });

  const stats = {
    total: filtered.length,
    males: filtered.filter((s) => s.gender === "ذكر").length,
    females: filtered.filter((s) => s.gender === "أنثى").length,
    totalFees: filtered.reduce((sum, s) => sum + (s.totalAmount || 0), 0),
  };

  // مطابقة لأعمدة ملف Excel — ورقة "بيانات" (19 عمود)
  const columns = [
    { key: "fileNumber", label: "رقم الملف", width: "90px" },
    { key: "lastName", label: "اللقب", width: "120px" },
    { key: "firstName", label: "الاسم", width: "140px" },
    { key: "birthDate", label: "تاريخ الميلاد", width: "110px", render: (v: any) => formatDate(v) },
    { key: "gender", label: "الجنس", width: "60px" },
    { key: "age", label: "العمر", width: "55px" },
    { key: "bloodType", label: "فصيلة الدم", width: "80px", render: (v: any) => v || "—" },
    { key: "subscriptionType", label: "نوع الاشتراك", width: "90px" },
    { key: "lastPaymentDate", label: "تاريخ آخر دفعة", width: "110px", render: (v: any) => formatDate(v) },
    { key: "expiryDate", label: "تاريخ الانتهاء", width: "110px", render: (v: any) => formatDate(v) },
    { key: "paymentStatus", label: "حالة الدفع", width: "95px" },
    { key: "subscriptionFee", label: "رسوم الاشتراك", width: "100px", render: (v: any) => formatMoney(v) },
    { key: "insuranceFee", label: "مصاريف التأمين", width: "100px", render: (v: any) => formatMoney(v) },
    { key: "compoundRights", label: "حقوق المركب", width: "95px", render: (v: any) => formatMoney(v) },
    { key: "totalAmount", label: "المبلغ الإجمالي", width: "105px", render: (v: any) => formatMoney(v) },
    { key: "renewalStatus", label: "حالة التجديد", width: "95px", render: (v: any) => (
      <span className={cn(
        "px-1.5 py-0.5 rounded text-[10px] font-semibold",
        v?.includes("ساري") ? "bg-green-500/15 text-green-700" :
        v?.includes("منتهي") ? "bg-red-500/15 text-red-700" :
        v?.includes("قريب") ? "bg-amber-500/15 text-amber-700" :
        "bg-muted text-muted-foreground"
      )}>{v || "—"}</span>
    ) },
    { key: "swimmingDays", label: "أيام السباحة", width: "130px", render: (v: any) => v || "—" },
    { key: "timeSlot", label: "التوقيت", width: "100px", render: (v: any) => v || "—" },
  ];

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <ReportShell
      reportId="قائمة-المنخرطين"
      title="قائمة المنخرطين"
      subtitle="قائمة شاملة بكل المنخرطين — مطابقة لملف Excel (ورقة بيانات)"
      stats={
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <ReportStatCard label="إجمالي المنخرطين" value={stats.total} icon={Users} color="from-teal-500/15 to-teal-500/5 border-teal-500/30" />
          <ReportStatCard label="ذكور" value={stats.males} icon={Users} color="from-blue-500/15 to-blue-500/5 border-blue-500/30" />
          <ReportStatCard label="إناث" value={stats.females} icon={Users} color="from-pink-500/15 to-pink-500/5 border-pink-500/30" />
          <ReportStatCard label="إجمالي الرسوم" value={formatMoney(stats.totalFees)} icon={Wallet} color="from-amber-500/15 to-amber-500/5 border-amber-500/30" />
        </div>
      }
      filters={
        <div className="rounded-xl border border-border/60 bg-card p-3 space-y-2">
          <p className="text-xs font-bold text-muted-foreground">الفلاتر</p>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="text-[10px] block mb-1">الجنس</label>
              <FilterChips
                value={filterGender as any}
                onChange={setFilterGender as any}
                options={[{ id: "", label: "الكل" }, { id: "ذكر", label: "ذكر" }, { id: "أنثى", label: "أنثى" }]}
              />
            </div>
            <div>
              <label className="text-[10px] block mb-1">نوع الاشتراك</label>
              <FilterChips
                value={filterType as any}
                onChange={setFilterType as any}
                options={[
                  { id: "", label: "الكل" },
                  ...subTypes.map((t) => ({ id: t.code, label: t.name })),
                ]}
              />
            </div>
            <div>
              <label className="text-[10px] block mb-1">الحالة</label>
              <FilterChips
                value={filterStatus as any}
                onChange={setFilterStatus as any}
                options={[
                  { id: "", label: "الكل" },
                  { id: "مدفوع", label: "مدفوع" },
                  { id: "لم يدفع", label: "لم يدفع" },
                  { id: "تأمين فقط", label: "تأمين فقط" },
                  { id: "اشتراك 300", label: "اشتراك 300" },
                ]}
              />
            </div>
          </div>
        </div>
      }
      table={<ReportTable data={filtered as any[]} columns={columns} />}
      toolbar={
        <ReportToolbar
          reportTitle="قائمة المنخرطين"
          reportNumber={`قائمة-المنخرطين/${new Date().getFullYear()}`}
          data={filtered as any[]}
          columns={columns}
          entete={entete}
          settings={settings}
        />
      }
    />
  );
}

// ════════════════════════════════════════════════════════════════════
// ════════════ 2. قائمة التأمين (مطابقة لملف Excel — ورقة "قائمة_التأمين") ═
// ════════════════════════════════════════════════════════════════════

export function InsuranceListReport() {
  const { subscribers, entete, settings, loading } = useReportData();
  const [filter, setFilter] = useState<"all" | "insured" | "uninsured">("all");

  const filtered = subscribers.filter((s) => {
    if (filter === "insured") return (s.insuranceFee ?? 0) > 0;
    if (filter === "uninsured") return !s.insuranceFee || s.insuranceFee === 0;
    return true;
  });

  const stats = {
    total: filtered.length,
    insured: filtered.filter((s) => (s.insuranceFee ?? 0) > 0).length,
    uninsured: filtered.filter((s) => !s.insuranceFee || s.insuranceFee === 0).length,
  };

  // مطابقة لأعمدة ملف Excel — ورقة "قائمة_التأمين"
  // الأعمدة: اللقب | الاسم | تاريخ الميلاد | الحالة التأمينية
  const columns = [
    { key: "lastName", label: "اللقب", width: "150px" },
    { key: "firstName", label: "الاسم", width: "180px" },
    { key: "birthDate", label: "تاريخ الميلاد", width: "130px", render: (v: any) => formatDate(v) },
    {
      key: "insuranceFee",
      label: "الحالة التأمينية",
      width: "130px",
      render: (v: any) => {
        const isInsured = (v ?? 0) > 0;
        return (
          <span className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-bold",
            isInsured ? "bg-green-500/15 text-green-700 border border-green-500/30" : "bg-red-500/15 text-red-700 border border-red-500/30"
          )}>
            {isInsured ? "✅ مؤمن" : "⚠️ غير مؤمن"}
          </span>
        );
      },
    },
  ];

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <ReportShell
      reportId="قائمة-التأمين"
      title="قائمة التأمين"
      subtitle="قائمة بالاسم واللقب وتاريخ الميلاد — مطابقة لملف Excel ومتوافقة مع متطلبات الجهة المؤمنة"
      stats={
        <div className="grid grid-cols-3 gap-2">
          <ReportStatCard label="إجمالي المنخرطين" value={stats.total} icon={Users} color="from-emerald-500/15 to-emerald-500/5 border-emerald-500/30" />
          <ReportStatCard label="✅ مؤمنون" value={stats.insured} icon={ShieldCheck} color="from-green-500/15 to-green-500/5 border-green-500/30" />
          <ReportStatCard label="⚠️ غير مؤمنين" value={stats.uninsured} icon={ShieldCheck} color="from-red-500/15 to-red-500/5 border-red-500/30" />
        </div>
      }
      filters={
        <div className="rounded-xl border border-border/60 bg-card p-3">
          <p className="text-xs font-bold text-muted-foreground mb-2">الفلترة</p>
          <FilterChips
            value={filter}
            onChange={setFilter}
            options={[
              { id: "all", label: "الكل" },
              { id: "insured", label: "المؤمنون فقط" },
              { id: "uninsured", label: "غير المؤمنين" },
            ]}
          />
        </div>
      }
      table={<ReportTable data={filtered as any[]} columns={columns} />}
      toolbar={
        <ReportToolbar
          reportTitle="قائمة التأمين"
          reportNumber={`قائمة-التأمين/${new Date().getFullYear()}`}
          data={filtered as any[]}
          columns={columns}
          entete={entete}
          settings={settings}
        />
      }
    />
  );
}

// ════════════════════════════════════════════════════════════════════
// ════════════ 3. حقوق المركب (مطابقة لملف Excel — ورقة "حقوق_المركب") ═══
// ════════════════════════════════════════════════════════════════════

export function CompoundRightsReport() {
  const { subscribers, entete, settings, loading } = useReportData();

  // مطابقة لملف Excel: جميع المنخرطين الذين رسمهم ≥ 1300 دج واشتراكهم ساري
  // في Excel المبلغ ثابت 1000 دج (حقوق المركب)، لكن المنظومة تحسب ديناميكياً
  // ★ Exclude exempt subscribers from the 1300+ paid list (they have fee=0)
  const filtered = subscribers.filter((s) =>
    (s.subscriptionFee ?? 0) >= 1300 &&
    !isExemptStatus(s.paymentStatus) &&
    s.paymentStatus !== "لم يدفع"
  );

  const stats = {
    total: filtered.length,
    totalFees: filtered.reduce((sum, s) => sum + (s.compoundRights || 1000), 0),
    avgFee: filtered.length ? Math.round(filtered.reduce((sum, s) => sum + (s.compoundRights || 1000), 0) / filtered.length) : 0,
  };

  // مطابقة لأعمدة ملف Excel — ورقة "حقوق_المركب"
  // الأعمدة: اللقب | الاسم | المبلغ
  // ملاحظة: أضفنا عمود المبلغ الإجمالي للاستفادة من البيانات المتوفرة
  const columns = [
    { key: "lastName", label: "اللقب", width: "150px" },
    { key: "firstName", label: "الاسم", width: "180px" },
    {
      key: "compoundRights",
      label: "المبلغ",
      width: "120px",
      render: (v: any) => formatMoney(v || 1000),
    },
    { key: "subscriptionType", label: "نوع الاشتراك", width: "100px" },
    { key: "lastPaymentDate", label: "تاريخ الدفع", width: "120px", render: (v: any) => formatDate(v) },
  ];

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <ReportShell
      reportId="حقوق-المركب"
      title="حقوق دخول المركب"
      subtitle="المنخرطون الذين رسم اشتراكهم ≥ 1300 دج — مطابقة لملف Excel (ورقة حقوق_المركب)"
      stats={
        <div className="grid grid-cols-3 gap-2">
          <ReportStatCard label="عدد المستفيدين" value={stats.total} icon={Users} color="from-sky-500/15 to-sky-500/5 border-sky-500/30" />
          <ReportStatCard label="إجمالي الرسوم" value={formatMoney(stats.totalFees)} icon={Wallet} color="from-amber-500/15 to-amber-500/5 border-amber-500/30" />
          <ReportStatCard label="متوسط الرسم" value={formatMoney(stats.avgFee)} icon={Building2} color="from-teal-500/15 to-teal-500/5 border-teal-500/30" />
        </div>
      }
      table={<ReportTable data={filtered as any[]} columns={columns} />}
      toolbar={
        <ReportToolbar
          reportTitle="حقوق دخول المركب"
          reportNumber={`حقوق-المركب/${new Date().getFullYear()}`}
          data={filtered as any[]}
          columns={columns}
          entete={entete}
          settings={settings}
        />
      }
    />
  );
}

// ════════════════════════════════════════════════════════════════════
// ════════════ 4. قائمة التجديدات ═══════════════════════════════════
// ════════════════════════════════════════════════════════════════════

export function RenewalsReport() {
  const { subscribers, entete, settings, loading } = useReportData();
  const [period, setPeriod] = useState<"today" | "week" | "month" | "all">("all");

  const filtered = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart);
    monthStart.setMonth(monthStart.getMonth() - 1);

    return subscribers.filter((s) => {
      if (!s.lastPaymentDate) return false;
      const d = new Date(s.lastPaymentDate);
      if (period === "today") return d >= todayStart;
      if (period === "week") return d >= weekStart;
      if (period === "month") return d >= monthStart;
      return true;
    });
  }, [subscribers, period]);

  const stats = {
    total: filtered.length,
    totalRevenue: filtered.reduce((sum, s) => sum + (s.totalAmount || 0), 0),
    uniqueTypes: new Set(filtered.map((s) => s.subscriptionType)).size,
  };

  const columns = [
    { key: "fileNumber", label: "رقم الملف", width: "100px" },
    { key: "lastName", label: "اللقب" },
    { key: "firstName", label: "الاسم" },
    { key: "subscriptionType", label: "النوع", width: "80px" },
    { key: "lastPaymentDate", label: "تاريخ التجديد", width: "120px", render: (v: any) => formatDate(v) },
    { key: "expiryDate", label: "تاريخ الانتهاء", width: "120px", render: (v: any) => formatDate(v) },
    { key: "totalAmount", label: "المبلغ", width: "100px", render: (v: any) => formatMoney(v) },
  ];

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <ReportShell
      reportId="قائمة-التجديدات"
      title="قائمة التجديدات"
      subtitle="سجل تجديدات الاشتراكات حسب الفترة"
      stats={
        <div className="grid grid-cols-3 gap-2">
          <ReportStatCard label="عدد التجديدات" value={stats.total} icon={RefreshCw} color="from-fuchsia-500/15 to-fuchsia-500/5 border-fuchsia-500/30" />
          <ReportStatCard label="إجمالي الإيرادات" value={formatMoney(stats.totalRevenue)} icon={Wallet} color="from-amber-500/15 to-amber-500/5 border-amber-500/30" />
          <ReportStatCard label="أنواع الاشتراك" value={stats.uniqueTypes} icon={Tag} color="from-cyan-500/15 to-cyan-500/5 border-cyan-500/30" />
        </div>
      }
      filters={
        <div className="rounded-xl border border-border/60 bg-card p-3">
          <p className="text-xs font-bold text-muted-foreground mb-2">الفترة</p>
          <FilterChips
            value={period}
            onChange={setPeriod}
            options={[
              { id: "all", label: "الكل" },
              { id: "today", label: "اليوم" },
              { id: "week", label: "هذا الأسبوع" },
              { id: "month", label: "هذا الشهر" },
            ]}
          />
        </div>
      }
      table={<ReportTable data={filtered as any[]} columns={columns} />}
      toolbar={
        <ReportToolbar
          reportTitle="قائمة التجديدات"
          reportNumber={`تجديدات/${new Date().getFullYear()}`}
          data={filtered as any[]}
          columns={columns}
          entete={entete}
          settings={settings}
        />
      }
    />
  );
}

// ════════════════════════════════════════════════════════════════════
// ════════════ 5. سجل الحضور ════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════

export function AttendanceReport() {
  const { entete, settings, loading } = useReportData();
  const [attendances, setAttendances] = useState<any[]>([]);
  const [period, setPeriod] = useState<"today" | "week" | "month" | "all">("all");
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    fetch("/api/attendance")
      .then((r) => r.json())
      .then((d) => setAttendances(d.attendances || d.records || []))
      .catch(() => {})
      .finally(() => setDataLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart);
    monthStart.setMonth(monthStart.getMonth() - 1);

    return attendances.filter((a) => {
      const d = new Date(a.date || a.checkInTime);
      if (period === "today") return d >= todayStart;
      if (period === "week") return d >= weekStart;
      if (period === "month") return d >= monthStart;
      return true;
    });
  }, [attendances, period]);

  const stats = {
    total: filtered.length,
    uniqueSubs: new Set(filtered.map((a) => a.subscriberId)).size,
    today: filtered.filter((a) => {
      const d = new Date(a.date || a.checkInTime);
      const today = new Date();
      return d.toDateString() === today.toDateString();
    }).length,
  };

  const columns = [
    { key: "subscriberName", label: "المنخرط" },
    { key: "date", label: "التاريخ", width: "110px", render: (v: any) => formatDate(v) },
    { key: "checkInTime", label: "وقت الدخول", width: "100px", render: (v: any) => v ? new Date(v).toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" }) : "—" },
    { key: "checkOutTime", label: "وقت الخروج", width: "100px", render: (v: any) => v ? new Date(v).toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" }) : "—" },
    { key: "method", label: "الطريقة", width: "100px" },
    { key: "coachId", label: "المدرب", width: "100px" },
  ];

  if (loading || dataLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <ReportShell
      reportId="سجل-الحضور"
      title="سجل الحضور"
      subtitle="سجلات الحضور اليومية للمنخرطين"
      stats={
        <div className="grid grid-cols-3 gap-2">
          <ReportStatCard label="إجمالي السجلات" value={stats.total} icon={Calendar} color="from-amber-500/15 to-amber-500/5 border-amber-500/30" />
          <ReportStatCard label="منخرطون فريدون" value={stats.uniqueSubs} icon={Users} color="from-teal-500/15 to-teal-500/5 border-teal-500/30" />
          <ReportStatCard label="حضور اليوم" value={stats.today} icon={Activity} color="from-blue-500/15 to-blue-500/5 border-blue-500/30" />
        </div>
      }
      filters={
        <div className="rounded-xl border border-border/60 bg-card p-3">
          <p className="text-xs font-bold text-muted-foreground mb-2">الفترة</p>
          <FilterChips
            value={period}
            onChange={setPeriod}
            options={[
              { id: "all", label: "الكل" },
              { id: "today", label: "اليوم" },
              { id: "week", label: "هذا الأسبوع" },
              { id: "month", label: "هذا الشهر" },
            ]}
          />
        </div>
      }
      table={<ReportTable data={filtered} columns={columns} />}
      toolbar={
        <ReportToolbar
          reportTitle="سجل الحضور"
          reportNumber={`حضور/${new Date().getFullYear()}`}
          data={filtered}
          columns={columns}
          entete={entete}
          settings={settings}
        />
      }
    />
  );
}

// ════════════════════════════════════════════════════════════════════
// ════════════ 6. التقرير المالي ════════════════════════════════════
// ════════════════════════════════════════════════════════════════════

export function FinancialReport() {
  const { subscribers, entete, settings, loading } = useReportData();

  const stats = {
    totalSubs: subscribers.length,
    // ★ Exclude exempt from paid count (they are a separate category)
    paid: subscribers.filter((s) => !isExemptStatus(s.paymentStatus) && s.paymentStatus !== "لم يدفع").length,
    totalSubscriptionFees: subscribers.reduce((sum, s) => sum + (s.subscriptionFee || 0), 0),
    totalInsuranceFees: subscribers.reduce((sum, s) => sum + (s.insuranceFee || 0), 0),
    totalCompoundRights: subscribers.reduce((sum, s) => sum + (s.compoundRights || 0), 0),
    totalRevenue: subscribers.reduce((sum, s) => sum + (s.totalAmount || 0), 0),
  };
  const expenses = Math.round(stats.totalRevenue * 0.6);
  const balance = stats.totalRevenue - expenses;

  const rows = [
    { item: "رسوم الاشتراكات", amount: stats.totalSubscriptionFees, type: "إيراد" },
    { item: "رسوم التأمين", amount: stats.totalInsuranceFees, type: "إيراد" },
    { item: "حقوق المركب", amount: stats.totalCompoundRights, type: "إيراد" },
    { item: "إجمالي الإيرادات", amount: stats.totalRevenue, type: "إجمالي" },
    { item: "مصاريف تقديرية (60%)", amount: expenses, type: "مصروف" },
    { item: "الرصيد الصافي", amount: balance, type: "رصيد" },
  ];

  const columns = [
    { key: "item", label: "البند" },
    { key: "type", label: "النوع", width: "100px" },
    { key: "amount", label: "المبلغ", width: "150px", render: (v: any) => formatMoney(v) },
  ];

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <ReportShell
      reportId="التقرير-المالي"
      title="التقرير المالي"
      subtitle="ملخص الإيرادات والمصاريف والرصيد الصافي"
      stats={
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <ReportStatCard label="إجمالي الاشتراكات" value={formatMoney(stats.totalSubscriptionFees)} icon={Wallet} color="from-teal-500/15 to-teal-500/5 border-teal-500/30" />
          <ReportStatCard label="إجمالي التأمين" value={formatMoney(stats.totalInsuranceFees)} icon={ShieldCheck} color="from-emerald-500/15 to-emerald-500/5 border-emerald-500/30" />
          <ReportStatCard label="إجمالي الإيرادات" value={formatMoney(stats.totalRevenue)} icon={TrendingUp} color="from-blue-500/15 to-blue-500/5 border-blue-500/30" />
          <ReportStatCard label="الرصيد الصافي" value={formatMoney(balance)} icon={Wallet} color={balance >= 0 ? "from-green-500/15 to-green-500/5 border-green-500/30" : "from-red-500/15 to-red-500/5 border-red-500/30"} />
        </div>
      }
      table={<ReportTable data={rows} columns={columns} pageSize={50} />}
      toolbar={
        <ReportToolbar
          reportTitle="التقرير المالي"
          reportNumber={`مالي/${new Date().getFullYear()}`}
          data={rows}
          columns={columns}
          entete={entete}
          settings={settings}
        />
      }
    />
  );
}

// ════════════════════════════════════════════════════════════════════
// ════════════ 7. تقرير الاشتراكات المنتهية ═════════════════════════
// ════════════════════════════════════════════════════════════════════

export function ExpiredSubscriptionsReport() {
  const { subscribers, entete, settings, loading } = useReportData();
  const [filter, setFilter] = useState<"expired" | "7days" | "30days" | "all">("all");

  const filtered = useMemo(() => {
    const now = new Date();
    const in7 = new Date(now); in7.setDate(in7.getDate() + 7);
    const in30 = new Date(now); in30.setDate(in30.getDate() + 30);

    return subscribers.filter((s) => {
      if (!s.expiryDate) return false;
      const exp = new Date(s.expiryDate);
      if (filter === "expired") return exp < now;
      if (filter === "7days") return exp >= now && exp <= in7;
      if (filter === "30days") return exp >= now && exp <= in30;
      return exp < in30;
    });
  }, [subscribers, filter]);

  const stats = {
    total: filtered.length,
    expired: subscribers.filter((s) => s.expiryDate && new Date(s.expiryDate) < new Date()).length,
    in7: subscribers.filter((s) => {
      if (!s.expiryDate) return false;
      const exp = new Date(s.expiryDate);
      const now = new Date();
      const in7 = new Date(now); in7.setDate(in7.getDate() + 7);
      return exp >= now && exp <= in7;
    }).length,
    in30: subscribers.filter((s) => {
      if (!s.expiryDate) return false;
      const exp = new Date(s.expiryDate);
      const now = new Date();
      const in30 = new Date(now); in30.setDate(in30.getDate() + 30);
      return exp >= now && exp <= in30;
    }).length,
  };

  const columns = [
    { key: "fileNumber", label: "رقم الملف", width: "100px" },
    { key: "lastName", label: "اللقب" },
    { key: "firstName", label: "الاسم" },
    { key: "subscriptionType", label: "النوع", width: "80px" },
    { key: "lastPaymentDate", label: "تاريخ الدفع", width: "120px", render: (v: any) => formatDate(v) },
    { key: "expiryDate", label: "تاريخ الانتهاء", width: "120px", render: (v: any) => formatDate(v) },
  ];

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <ReportShell
      reportId="اشتراكات-منتهية"
      title="تقرير الاشتراكات المنتهية"
      subtitle="المنتهية + التي ستنتهي خلال 7 أيام + التي ستنتهي خلال 30 يوماً"
      stats={
        <div className="grid grid-cols-3 gap-2">
          <ReportStatCard label="منتهية" value={stats.expired} icon={Calendar} color="from-red-500/15 to-red-500/5 border-red-500/30" />
          <ReportStatCard label="تنتهي خلال 7 أيام" value={stats.in7} icon={Calendar} color="from-orange-500/15 to-orange-500/5 border-orange-500/30" />
          <ReportStatCard label="تنتهي خلال 30 يوماً" value={stats.in30} icon={Calendar} color="from-amber-500/15 to-amber-500/5 border-amber-500/30" />
        </div>
      }
      filters={
        <div className="rounded-xl border border-border/60 bg-card p-3">
          <p className="text-xs font-bold text-muted-foreground mb-2">الفلترة</p>
          <FilterChips
            value={filter}
            onChange={setFilter}
            options={[
              { id: "all", label: "الكل" },
              { id: "expired", label: "المنتهية" },
              { id: "7days", label: "خلال 7 أيام" },
              { id: "30days", label: "خلال 30 يوماً" },
            ]}
          />
        </div>
      }
      table={<ReportTable data={filtered as any[]} columns={columns} />}
      toolbar={
        <ReportToolbar
          reportTitle="تقرير الاشتراكات المنتهية"
          reportNumber={`اشتراكات-منتهية/${new Date().getFullYear()}`}
          data={filtered as any[]}
          columns={columns}
          entete={entete}
          settings={settings}
        />
      }
    />
  );
}

// ════════════════════════════════════════════════════════════════════
// ════════════ 8. تقرير الغياب ══════════════════════════════════════
// ════════════════════════════════════════════════════════════════════

export function AbsenceReport() {
  const { subscribers, entete, settings, loading } = useReportData();
  const [attendances, setAttendances] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    fetch("/api/attendance")
      .then((r) => r.json())
      .then((d) => setAttendances(d.attendances || d.records || []))
      .catch(() => {})
      .finally(() => setDataLoading(false));
  }, []);

  const rows = useMemo(() => {
    const now = new Date();
    return subscribers.map((s) => {
      const subAtt = attendances.filter((a) => a.subscriberId === s.id);
      const lastAtt = subAtt.length ? new Date(subAtt[subAtt.length - 1].date || subAtt[subAtt.length - 1].checkInTime) : null;
      const daysSinceLast = lastAtt ? Math.floor((now.getTime() - lastAtt.getTime()) / (1000 * 60 * 60 * 24)) : null;
      const attendanceRate = subAtt.length > 0 ? Math.min(100, Math.round((subAtt.length / 30) * 100)) : 0;
      return {
        fileNumber: s.fileNumber,
        lastName: s.lastName,
        firstName: s.firstName,
        subscriptionType: s.subscriptionType,
        lastAttendance: lastAtt ? formatDate(lastAtt) : "—",
        daysAbsent: daysSinceLast ?? "—",
        attendanceCount: subAtt.length,
        attendanceRate: attendanceRate + "%",
      };
    }).filter((r) => r.daysAbsent !== "—" && (r.daysAbsent as number) > 7);
  }, [subscribers, attendances]);

  const stats = {
    total: rows.length,
    avgAbsence: rows.length ? Math.round(rows.reduce((sum, r) => sum + (r.daysAbsent as number || 0), 0) / rows.length) : 0,
    critical: rows.filter((r) => (r.daysAbsent as number) > 30).length,
  };

  const columns = [
    { key: "fileNumber", label: "رقم الملف", width: "100px" },
    { key: "lastName", label: "اللقب" },
    { key: "firstName", label: "الاسم" },
    { key: "lastAttendance", label: "آخر حضور", width: "120px" },
    { key: "daysAbsent", label: "أيام الغياب", width: "100px" },
    { key: "attendanceCount", label: "عدد الحضور", width: "100px" },
    { key: "attendanceRate", label: "نسبة الحضور", width: "100px" },
  ];

  if (loading || dataLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <ReportShell
      reportId="تقرير-الغياب"
      title="تقرير الغياب"
      subtitle="المنخرطون الغائبون أكثر من 7 أيام + إحصائيات الحضور"
      stats={
        <div className="grid grid-cols-3 gap-2">
          <ReportStatCard label="عدد الغائبين" value={stats.total} icon={Activity} color="from-red-500/15 to-red-500/5 border-red-500/30" />
          <ReportStatCard label="متوسط الغياب" value={`${stats.avgAbsence} يوم`} icon={Calendar} color="from-orange-500/15 to-orange-500/5 border-orange-500/30" />
          <ReportStatCard label="غياب حرج (>30 يوم)" value={stats.critical} icon={Activity} color="from-rose-500/15 to-rose-500/5 border-rose-500/30" />
        </div>
      }
      table={<ReportTable data={rows} columns={columns} />}
      toolbar={
        <ReportToolbar
          reportTitle="تقرير الغياب"
          reportNumber={`غياب/${new Date().getFullYear()}`}
          data={rows}
          columns={columns}
          entete={entete}
          settings={settings}
        />
      }
    />
  );
}

// ════════════════════════════════════════════════════════════════════
// ════════════ 9. تقرير الفئات العمرية ══════════════════════════════
// ════════════════════════════════════════════════════════════════════

export function AgeCategoriesReport() {
  const { subscribers, entete, settings, loading } = useReportData();

  const categories = [
    { id: "M<13", label: "ذكور أقل من 13", filter: (s: any) => s.gender === "ذكر" && s.age < 13 },
    { id: "F<13", label: "إناث أقل من 13", filter: (s: any) => s.gender === "أنثى" && s.age < 13 },
    { id: "M≥13", label: "ذكور 13 سنة فأكثر", filter: (s: any) => s.gender === "ذكر" && s.age >= 13 },
    { id: "F≥13", label: "إناث 13 سنة فأكثر", filter: (s: any) => s.gender === "أنثى" && s.age >= 13 },
  ];

  const rows = categories.map((c) => ({
    category: c.label,
    count: subscribers.filter(c.filter).length,
    percentage: subscribers.length ? Math.round((subscribers.filter(c.filter).length / subscribers.length) * 100) + "%" : "0%",
  }));

  const columns = [
    { key: "category", label: "الفئة العمرية" },
    { key: "count", label: "العدد", width: "100px" },
    { key: "percentage", label: "النسبة", width: "100px" },
  ];

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <ReportShell
      reportId="الفئات-العمرية"
      title="تقرير الفئات العمرية"
      subtitle="توزيع المنخرطين على 4 فئات عمرية بحد 13 سنة"
      stats={
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {rows.map((r, i) => (
            <ReportStatCard key={i} label={r.category} value={r.count} icon={Crown}
              color={["from-blue-500/15 to-blue-500/5 border-blue-500/30", "from-pink-500/15 to-pink-500/5 border-pink-500/30", "from-indigo-500/15 to-indigo-500/5 border-indigo-500/30", "from-rose-500/15 to-rose-500/5 border-rose-500/30"][i]} />
          ))}
        </div>
      }
      table={<ReportTable data={rows} columns={columns} pageSize={50} />}
      toolbar={
        <ReportToolbar
          reportTitle="تقرير الفئات العمرية"
          reportNumber={`فئات-عمرية/${new Date().getFullYear()}`}
          data={rows}
          columns={columns}
          entete={entete}
          settings={settings}
        />
      }
    />
  );
}

// ════════════════════════════════════════════════════════════════════
// ════════════ 10. تقرير أنواع الاشتراك ═════════════════════════════
// ════════════════════════════════════════════════════════════════════

export function SubscriptionTypesReport() {
  const { subscribers, entete, settings, loading } = useReportData();
  const { activeTypes: subTypes } = useSubscriptionTypes();

  // ديناميكي — من قاعدة البيانات عبر الـ hook
  const rows = subTypes.map((t) => {
    const count = subscribers.filter((s) => s.subscriptionType === t.code).length;
    return {
      type: t.name === t.code ? t.name : `${t.name} (${t.code})`,
      count,
      percentage: subscribers.length ? Math.round((count / subscribers.length) * 100) + "%" : "0%",
    };
  }).sort((a, b) => b.count - a.count);

  const columns = [
    { key: "type", label: "نوع الاشتراك" },
    { key: "count", label: "عدد المنخرطين", width: "150px" },
    { key: "percentage", label: "النسبة", width: "100px" },
  ];

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <ReportShell
      reportId="أنواع-الاشتراك"
      title="تقرير أنواع الاشتراك"
      subtitle="عدد المنخرطين حسب نوع الاشتراك"
      stats={
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {rows.slice(0, 4).map((r, i) => (
            <ReportStatCard key={i} label={r.type} value={r.count} icon={Tag}
              color={["from-teal-500/15 to-teal-500/5 border-teal-500/30", "from-cyan-500/15 to-cyan-500/5 border-cyan-500/30", "from-blue-500/15 to-blue-500/5 border-blue-500/30", "from-indigo-500/15 to-indigo-500/5 border-indigo-500/30"][i]} />
          ))}
        </div>
      }
      table={<ReportTable data={rows} columns={columns} pageSize={50} />}
      toolbar={
        <ReportToolbar
          reportTitle="تقرير أنواع الاشتراك"
          reportNumber={`أنواع-اشتراك/${new Date().getFullYear()}`}
          data={rows}
          columns={columns}
          entete={entete}
          settings={settings}
        />
      }
    />
  );
}

// ════════════════════════════════════════════════════════════════════
// ════════════ 11. تقرير أيام السباحة ═══════════════════════════════
// ════════════════════════════════════════════════════════════════════

export function SwimmingDaysReport() {
  const { subscribers, entete, settings, loading } = useReportData();

  const daysMap = new Map<string, number>();
  subscribers.forEach((s) => {
    if (s.swimmingDays) {
      daysMap.set(s.swimmingDays, (daysMap.get(s.swimmingDays) || 0) + 1);
    }
  });

  const rows = Array.from(daysMap.entries())
    .map(([day, count]) => ({
      day,
      count,
      percentage: subscribers.length ? Math.round((count / subscribers.length) * 100) + "%" : "0%",
    }))
    .sort((a, b) => b.count - a.count);

  const columns = [
    { key: "day", label: "أيام السباحة" },
    { key: "count", label: "عدد المنخرطين", width: "150px" },
    { key: "percentage", label: "النسبة", width: "100px" },
  ];

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <ReportShell
      reportId="أيام-السباحة"
      title="تقرير أيام السباحة"
      subtitle="عدد المنخرطين حسب كل يوم سباحة"
      stats={
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {rows.slice(0, 4).map((r, i) => (
            <ReportStatCard key={i} label={r.day} value={r.count} icon={Calendar}
              color={["from-indigo-500/15 to-indigo-500/5 border-indigo-500/30", "from-blue-500/15 to-blue-500/5 border-blue-500/30", "from-cyan-500/15 to-cyan-500/5 border-cyan-500/30", "from-teal-500/15 to-teal-500/5 border-teal-500/30"][i]} />
          ))}
        </div>
      }
      table={<ReportTable data={rows} columns={columns} pageSize={50} />}
      toolbar={
        <ReportToolbar
          reportTitle="تقرير أيام السباحة"
          reportNumber={`أيام-سباحة/${new Date().getFullYear()}`}
          data={rows}
          columns={columns}
          entete={entete}
          settings={settings}
        />
      }
    />
  );
}

// ════════════════════════════════════════════════════════════════════
// ════════════ 12. تقرير أوقات السباحة ══════════════════════════════
// ════════════════════════════════════════════════════════════════════

export function SwimmingTimesReport() {
  const { subscribers, entete, settings, loading } = useReportData();

  const slotsMap = new Map<string, number>();
  subscribers.forEach((s) => {
    if (s.timeSlot) {
      slotsMap.set(s.timeSlot, (slotsMap.get(s.timeSlot) || 0) + 1);
    }
  });

  const rows = Array.from(slotsMap.entries())
    .map(([slot, count]) => ({
      slot,
      count,
      percentage: subscribers.length ? Math.round((count / subscribers.length) * 100) + "%" : "0%",
    }))
    .sort((a, b) => b.count - a.count);

  const columns = [
    { key: "slot", label: "توقيت السباحة" },
    { key: "count", label: "عدد المنخرطين", width: "150px" },
    { key: "percentage", label: "النسبة", width: "100px" },
  ];

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <ReportShell
      reportId="أوقات-السباحة"
      title="تقرير أوقات السباحة"
      subtitle="عدد المنخرطين حسب كل توقيت سباحة"
      stats={
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {rows.slice(0, 4).map((r, i) => (
            <ReportStatCard key={i} label={r.slot} value={r.count} icon={Clock}
              color={["from-blue-500/15 to-blue-500/5 border-blue-500/30", "from-cyan-500/15 to-cyan-500/5 border-cyan-500/30", "from-indigo-500/15 to-indigo-500/5 border-indigo-500/30", "from-violet-500/15 to-violet-500/5 border-violet-500/30"][i]} />
          ))}
        </div>
      }
      table={<ReportTable data={rows} columns={columns} pageSize={50} />}
      toolbar={
        <ReportToolbar
          reportTitle="تقرير أوقات السباحة"
          reportNumber={`أوقات-سباحة/${new Date().getFullYear()}`}
          data={rows}
          columns={columns}
          entete={entete}
          settings={settings}
        />
      }
    />
  );
}

// ════════════════════════════════════════════════════════════════════
// ════════════ 13. تقرير فصائل الدم ═════════════════════════════════
// ════════════════════════════════════════════════════════════════════

export function BloodTypesReport() {
  const { subscribers, entete, settings, loading } = useReportData();

  const bloodMap = new Map<string, number>();
  subscribers.forEach((s) => {
    if (s.bloodType) {
      bloodMap.set(s.bloodType, (bloodMap.get(s.bloodType) || 0) + 1);
    }
  });

  const rows = Array.from(bloodMap.entries())
    .map(([type, count]) => ({
      type,
      count,
      percentage: subscribers.length ? Math.round((count / subscribers.length) * 100) + "%" : "0%",
    }))
    .sort((a, b) => b.count - a.count);

  const columns = [
    { key: "type", label: "فصيلة الدم" },
    { key: "count", label: "عدد المنخرطين", width: "150px" },
    { key: "percentage", label: "النسبة", width: "100px" },
  ];

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <ReportShell
      reportId="فصائل-الدم"
      title="تقرير فصائل الدم"
      subtitle="إحصائيات توزيع المنخرطين حسب فصيلة الدم"
      stats={
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {rows.slice(0, 4).map((r, i) => (
            <ReportStatCard key={i} label={`فصيلة ${r.type}`} value={r.count} icon={Droplet}
              color={["from-rose-500/15 to-rose-500/5 border-rose-500/30", "from-red-500/15 to-red-500/5 border-red-500/30", "from-pink-500/15 to-pink-500/5 border-pink-500/30", "from-orange-500/15 to-orange-500/5 border-orange-500/30"][i]} />
          ))}
        </div>
      }
      table={<ReportTable data={rows} columns={columns} pageSize={50} />}
      toolbar={
        <ReportToolbar
          reportTitle="تقرير فصائل الدم"
          reportNumber={`فصائل-دم/${new Date().getFullYear()}`}
          data={rows}
          columns={columns}
          entete={entete}
          settings={settings}
        />
      }
    />
  );
}

// ════════════════════════════════════════════════════════════════════
// ════════════ 14. تقرير الأعمار ════════════════════════════════════
// ════════════════════════════════════════════════════════════════════

export function AgesReport() {
  const { subscribers, entete, settings, loading } = useReportData();

  const ageMap = new Map<number, number>();
  subscribers.forEach((s) => {
    if (s.age != null) {
      ageMap.set(s.age, (ageMap.get(s.age) || 0) + 1);
    }
  });

  const rows = Array.from(ageMap.entries())
    .map(([age, count]) => ({ age: `${age} سنة`, count, percentage: subscribers.length ? Math.round((count / subscribers.length) * 100) + "%" : "0%" }))
    .sort((a, b) => parseInt(a.age) - parseInt(b.age));

  const columns = [
    { key: "age", label: "العمر" },
    { key: "count", label: "عدد المنخرطين", width: "150px" },
    { key: "percentage", label: "النسبة", width: "100px" },
  ];

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <ReportShell
      reportId="تقرير-الأعمار"
      title="تقرير الأعمار"
      subtitle="إحصائيات توزيع المنخرطين حسب العمر"
      stats={
        <div className="grid grid-cols-3 gap-2">
          <ReportStatCard label="أصغر منخرط" value={rows.length ? rows[0].age : "—"} icon={Users} color="from-lime-500/15 to-lime-500/5 border-lime-500/30" />
          <ReportStatCard label="أكبر منخرط" value={rows.length ? rows[rows.length - 1].age : "—"} icon={Users} color="from-emerald-500/15 to-emerald-500/5 border-emerald-500/30" />
          <ReportStatCard label="عدد الفئات" value={rows.length} icon={Users} color="from-teal-500/15 to-teal-500/5 border-teal-500/30" />
        </div>
      }
      table={<ReportTable data={rows} columns={columns} pageSize={50} />}
      toolbar={
        <ReportToolbar
          reportTitle="تقرير الأعمار"
          reportNumber={`أعمار/${new Date().getFullYear()}`}
          data={rows}
          columns={columns}
          entete={entete}
          settings={settings}
        />
      }
    />
  );
}

// ════════════════════════════════════════════════════════════════════
// ════════════ 15. تقرير المدربين ═══════════════════════════════════
// ════════════════════════════════════════════════════════════════════

export function CoachesReport() {
  const { subscribers, entete, settings, loading } = useReportData();
  const [coaches, setCoaches] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setCoaches((d.users || []).filter((u: any) => u.role === "coach" || u.role === "admin")))
      .catch(() => {})
      .finally(() => setDataLoading(false));
  }, []);

  const rows = coaches.map((c) => {
    const count = subscribers.filter((s) => s.timeSlot === c.timeSlot || s.swimmingDays === c.swimmingDays).length;
    return {
      name: `${c.lastName || ""} ${c.firstName || ""}`.trim() || c.username,
      role: c.role === "admin" ? "مدير" : "مدرب",
      subscriberCount: count,
    };
  });

  const columns = [
    { key: "name", label: "المدرب" },
    { key: "role", label: "الدور", width: "100px" },
    { key: "subscriberCount", label: "عدد المنخرطين", width: "150px" },
  ];

  if (loading || dataLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <ReportShell
      reportId="تقرير-المدربين"
      title="تقرير المدربين"
      subtitle="عدد المنخرطين لكل مدرب"
      stats={
        <div className="grid grid-cols-3 gap-2">
          <ReportStatCard label="عدد المدربين" value={coaches.length} icon={Users} color="from-purple-500/15 to-purple-500/5 border-purple-500/30" />
          <ReportStatCard label="إجمالي المنخرطين" value={subscribers.length} icon={Users} color="from-teal-500/15 to-teal-500/5 border-teal-500/30" />
          <ReportStatCard label="متوسط لكل مدرب" value={coaches.length ? Math.round(subscribers.length / coaches.length) : 0} icon={Users} color="from-indigo-500/15 to-indigo-500/5 border-indigo-500/30" />
        </div>
      }
      table={<ReportTable data={rows} columns={columns} pageSize={50} />}
      toolbar={
        <ReportToolbar
          reportTitle="تقرير المدربين"
          reportNumber={`مدربين/${new Date().getFullYear()}`}
          data={rows}
          columns={columns}
          entete={entete}
          settings={settings}
        />
      }
    />
  );
}

// ──────────────── Report Registry ────────────────
export const REPORT_REGISTRY: Record<string, { title: string; component: React.ComponentType }> = {
  "subscribers-list": { title: "قائمة المنخرطين", component: SubscribersListReport },
  "insurance-list": { title: "قائمة التأمين", component: InsuranceListReport },
  "compound-rights": { title: "حقوق دخول المركب", component: CompoundRightsReport },
  "renewals": { title: "قائمة التجديدات", component: RenewalsReport },
  "attendance": { title: "سجل الحضور", component: AttendanceReport },
  "financial": { title: "التقرير المالي", component: FinancialReport },
  "expired": { title: "الاشتراكات المنتهية", component: ExpiredSubscriptionsReport },
  "absence": { title: "تقرير الغياب", component: AbsenceReport },
  "age-categories": { title: "الفئات العمرية", component: AgeCategoriesReport },
  "subscription-types": { title: "أنواع الاشتراك", component: SubscriptionTypesReport },
  "swimming-days": { title: "أيام السباحة", component: SwimmingDaysReport },
  "swimming-times": { title: "أوقات السباحة", component: SwimmingTimesReport },
  "blood-types": { title: "فصائل الدم", component: BloodTypesReport },
  "ages": { title: "تقرير الأعمار", component: AgesReport },
  "coaches": { title: "تقرير المدربين", component: CoachesReport },
};

// ──────────────── Report Viewer (single page) ────────────────
export function ReportViewer({ reportId, onBack }: { reportId: string; onBack: () => void }) {
  const entry = REPORT_REGISTRY[reportId];
  if (!entry) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">التقرير غير موجود: {reportId}</p>
        <Button onClick={onBack} variant="outline">رجوع لمركز التقارير</Button>
      </div>
    );
  }
  const Component = entry.component;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronRight className="h-4 w-4 ml-1" /> رجوع لمركز التقارير
        </Button>
        <h2 className="font-bold text-base">{entry.title}</h2>
      </div>
      <Component />
    </div>
  );
}

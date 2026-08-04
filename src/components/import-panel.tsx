"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, XCircle,
  Eye, ArrowRight, Database, Search, Filter, X, ChevronLeft, ChevronRight,
  CheckSquare, Square, Trash2, Download, RefreshCw, AlertTriangle,
  Check, Edit2, Save, Phone, Droplet, Calendar, Clock, Tag, Wallet,
  Users, ShieldCheck, Building2, TrendingUp, FileWarning, ListChecks,
  Copy, FileDown, Eye as EyeIcon, Highlighter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSubscriptionTypes } from "@/hooks/use-subscription-types";

// ──────────────── Types ────────────────
interface ErrorDetail {
  type: "critical" | "warning";
  message: string;
  column: string;
  columnLabel: string;
  value: string;
  expected?: string;
}

interface PreviewRow {
  row: number;
  lastName: string;
  firstName: string;
  birthDate: string | null;
  birthDateDisplay: string;
  gender: string | null;
  bloodType: string | null;
  subscriptionType: string | null;
  lastPaymentDate: Date | null;
  lastPaymentDisplay: string;
  paymentStatus: string | null;
  swimmingDays: string | null;
  timeSlot: string | null;
  phone: string | null;
  errors: string[];
  warnings: string[];
  errorDetails?: ErrorDetail[];
  status: "valid" | "warning" | "error";
  computed: {
    age: number;
    subscriptionFee: number | null;
    insuranceFee: number | null;
    compoundRights: number | null;
    totalAmount: number | null;
  };
  rightsRule: string;
}

interface PreviewResult {
  preview: boolean;
  totalRows: number;
  validRows: number;
  errorRows: number;
  warnings: number;
  detectedColumns: Record<string, string | null>;
  sample: PreviewRow[];
  errorSamples: PreviewRow[];
  allRows?: PreviewRow[];
  summary: {
    totalFees: number;
    totalInsurance: number;
    totalCompound: number;
    totalRevenue: number;
  };
  renewalPreview?: {
    found: boolean;
    totalRows: number;
    renewedCount: number;
    sample: Array<{ fileNumber: string; name: string; renewalDate: string | null; amount: number; status: string }>;
  };
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  duplicates: number;
  conflictedCount?: number;
  renewalsImported?: number;
  renewalsSkipped?: number;
  renewalErrors?: Array<{ row: number; name: string; error: string }>;
  totalRows: number;
  errors: Array<{ row: number; name: string; error: string }>;
}

type TabKey = "all" | "valid" | "warnings" | "errors";
type SortKey = "row" | "lastName" | "birthDate" | "subscriptionFee" | "totalAmount";

// ──────────────── Main Component ────────────────
export function ImportPanel() {
  const { activeTypes: subTypes } = useSubscriptionTypes();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number; errors: number } | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [filterGender, setFilterGender] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterPayment, setFilterPayment] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("row");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  const [drawerRow, setDrawerRow] = useState<PreviewRow | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  // ─── Error panel state ───
  const [highlightedRow, setHighlightedRow] = useState<number | null>(null);
  const [errorSearch, setErrorSearch] = useState("");
  const [errorFilter, setErrorFilter] = useState<"all" | "critical" | "warning">("all");
  const [errorDrawerRow, setErrorDrawerRow] = useState<PreviewRow | null>(null);
  const tableRowRefs = useRef<{ [key: number]: HTMLTableRowElement | null }>({});

  // ─── Scroll to row in main table ───
  const scrollToRow = useCallback((rowNum: number) => {
    setHighlightedRow(rowNum);
    setActiveTab("all");
    setSearch("");
    // حساب الصفحة الصحيحة
    const rowIndex = rows.findIndex((r) => r.row === rowNum);
    if (rowIndex >= 0) {
      const newPage = Math.floor(rowIndex / pageSize) + 1;
      setPage(newPage);
      // scroll بعد تحديث الصفحة
      setTimeout(() => {
        const el = tableRowRefs.current[rowNum];
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-4", "ring-blue-500", "ring-offset-2");
          setTimeout(() => {
            el.classList.remove("ring-4", "ring-blue-500", "ring-offset-2");
          }, 3000);
        }
      }, 300);
    }
  }, [rows, pageSize]);

  // ─── File selection ───
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith(".xlsx") && !f.name.endsWith(".xls") && !f.name.endsWith(".xlsm")) {
      toast.error("يجب أن يكون الملف بصيغة Excel (.xlsx أو .xls أو .xlsm)");
      return;
    }
    setFile(f);
    setPreview(null);
    setRows([]);
    setSelectedRows(new Set());
    setExcludedRows(new Set());
  };

  // ─── Download template ───
  const handleDownloadTemplate = () => {
    // قالب Excel بصيغة AquaCore — مطابق لمنظومة_اشتراكات_RCS_v5
    const templateData = [
      ["نظام إدارة اشتراكات  —  AquaCore Club Manager"],
      [],
      ["رقم الملف", "اللقب", "الاسم", "تاريخ الميلاد", "الجنس", "العمر", "فصيلة الدم", "نوع الاشتراك", "تاريخ آخر دفعة", "تاريخ انتهاء الاشتراك", "حالة الدفع", "رسوم الاشتراك", "مصاريف التأمين", "حقوق المركب", "المبلغ الإجمالي", "حالة التجديد", "أيام السباحة", "التوقيت", "عدد أشهر الاشتراك", "البادئة", "مفتاح شهر التسجيل", "ترتيب ضمن الشهر", "مفتاح مركب", "رقم الهاتف (واتساب)"],
      ["AQC001", "مثال", "محمد", "2014-05-07", "ذكر", 12, "A+", "/", "2026-01-15", "2026-02-15", "مدفوع", 1300, 500, 1000, 1800, "✅ ساري", "الأحد والأربعاء", "10:00-11:00", 1, "AQC", "2026-01", 1, "2026-01-1", "0555000000"],
    ];

    // إنشاء ملف Excel باستخدام مكتبة xlsx (موجودة في المشروع)
    import("xlsx").then((XLSX) => {
      const ws = XLSX.utils.aoa_to_sheet(templateData);
      // ضبط عرض الأعمدة
      ws["!cols"] = Array.from({ length: 24 }, () => ({ wch: 15 }));
      // ضبط دمج الخلايا للعنوان
      ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 23 } }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "بيانات");

      // أضف ورقة إعدادات الأنواع
      const typesData = [
        ["إعدادات أنواع الاشتراك"],
        [],
        ["كود النوع", "البادئة", "رسوم الاشتراك (تحت 14)", "رسوم الاشتراك (14+)", "رسوم التأمين", "حقوق المركب", "ملاحظات"],
        ["/", "AQC", 1300, 1500, 500, 1000, "اشتراك عادي"],
        ["DJS", "AQC", 300, 500, 500, 0, "الاشتراك والتأمين فقط"],
      ];
      const wsTypes = XLSX.utils.aoa_to_sheet(typesData);
      wsTypes["!cols"] = Array.from({ length: 7 }, () => ({ wch: 18 }));
      wsTypes["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
      XLSX.utils.book_append_sheet(wb, wsTypes, "إعدادات_الأنواع");

      XLSX.writeFile(wb, "AquaCore_قالب_الاستيراد.xlsx");
      toast.success("تم تحميل القالب");
    });
  };

  // ─── Preview / Analyze ───
  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("dryRun", "true");

      const res = await fetch("/api/import", { method: "POST", body: formData });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          res.status === 401 ? "يجب تسجيل الدخول أولاً"
          : res.status === 403 ? "غير مصرح لك بالاستيراد"
          : res.status === 413 ? "حجم الملف كبير جداً (الحد الأقصى 4MB)"
          : `استجابة غير صالحة من الخادم (${res.status})`
        );
      }

      const data: PreviewResult = await res.json();
      if (!res.ok) throw new Error((data as any).error || "فشل التحليل");

      setPreview(data);
      // استخدام allRows إن وجدت، وإلا sample
      const allRows = data.allRows || data.sample || [];
      setRows(allRows);
      // تحديد جميع الصفوف الصالحة افتراضياً
      const validRowSet = new Set<number>(
        allRows.filter((r) => r.status === "valid" || r.status === "warning").map((r) => r.row)
      );
      setSelectedRows(validRowSet);
      toast.success(`تم تحليل الملف: ${data.validRows} صف صالح من ${data.totalRows}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "فشل التحليل";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ─── Import ───
  const handleImport = async (selectedOnly: boolean = false) => {
    if (!file) return;
    const rowsToImportCount = selectedOnly ? selectedRows.size : rows.filter(r => r.status !== "error" && !excludedRows.has(r.row)).length;
    if (rowsToImportCount === 0) {
      toast.error("لا توجد صفوف للاستيراد");
      return;
    }

    setImporting(true);
    setImportProgress({ done: 0, total: rowsToImportCount, errors: 0 });

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (selectedOnly && selectedRows.size > 0) {
        formData.append("selectedRows", JSON.stringify(Array.from(selectedRows)));
      }

      const res = await fetch("/api/import", { method: "POST", body: formData });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          res.status === 401 ? "يجب تسجيل الدخول أولاً"
          : res.status === 403 ? "غير مصرح لك بالاستيراد"
          : res.status === 413 ? "حجم الملف كبير جداً"
          : `استجابة غير صالحة من الخادم (${res.status})`
        );
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الاستيراد");

      setImportProgress({ done: data.imported, total: rowsToImportCount, errors: data.skipped });
      const dupMsg = data.duplicates > 0 ? ` • ${data.duplicates} مكرر تم تجاهله` : "";
      const renewalMsg = data.renewalsImported > 0 ? ` • ${data.renewalsImported} تجديد تم استيراده` : "";
      const skipMsg = data.skipped > 0 ? ` • ${data.skipped} صف فشل` : "";
      const errMsg = data.errors?.length > 0 ? ` • ${data.errors.length} خطأ` : "";
      toast.success(`تم استيراد ${data.imported} منخرط${dupMsg}${renewalMsg}${skipMsg}${errMsg}`);

      // اعرض أول 3 أخطاء إذا وجدت
      if (data.errors?.length > 0) {
        data.errors.slice(0, 3).forEach((err: { row: number; name: string; error: string }) => {
          toast.error(`صف ${err.row}: ${err.name} — ${err.error}`);
        });
      }

      setTimeout(() => {
        setFile(null);
        setPreview(null);
        setRows([]);
        setSelectedRows(new Set());
        setExcludedRows(new Set());
        setImportProgress(null);
        if (inputRef.current) inputRef.current.value = "";
        window.location.reload();
      }, 3000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "فشل الاستيراد";
      toast.error(msg);
      setImportProgress(null);
    } finally {
      setImporting(false);
    }
  };

  // ─── Download error report (CSV) ───
  const handleDownloadErrors = () => {
    const errorRows = rows.filter((r) => r.status === "error" || r.status === "warning");
    if (errorRows.length === 0) {
      toast.info("لا توجد أخطاء أو تحذيرات");
      return;
    }
    const csv = [
      ["الصف", "اللقب", "الاسم", "النوع", "الحالة", "العمود", "القيمة", "المتوقع", "المشاكل"],
      ...errorRows.flatMap((r) => {
        const details = r.errorDetails || [];
        if (details.length === 0) {
          return [[r.row, r.lastName, r.firstName, r.subscriptionType || "", r.status === "error" ? "خطأ" : "تحذير", "", "", "", [...r.errors, ...r.warnings].join(" | ")]];
        }
        return details.map((d) => [
          r.row,
          r.lastName,
          r.firstName,
          r.subscriptionType || "",
          d.type === "critical" ? "🟥 خطأ" : "🟨 تحذير",
          d.columnLabel,
          d.value,
          d.expected || "",
          d.message,
        ]);
      }),
    ].map((row) => row.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `تقرير_أخطاء_الاستيراد_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تنزيل تقرير الأخطاء (CSV)");
  };

  // ─── Export errors to Excel ───
  const handleExportErrorsExcel = async () => {
    const errorRows = rows.filter((r) => r.status === "error" || r.status === "warning");
    if (errorRows.length === 0) {
      toast.info("لا توجد أخطاء أو تحذيرات");
      return;
    }
    const XLSX = await import("xlsx");
    const data: Record<string, any>[] = errorRows.flatMap((r): Record<string, any>[] => {
      const details = r.errorDetails || [];
      if (details.length === 0) {
        return [{
          "الصف": r.row,
          "اللقب": r.lastName,
          "الاسم": r.firstName,
          "الحالة": r.status === "error" ? "🟥 خطأ" : "🟨 تحذير",
          "المشاكل": [...r.errors, ...r.warnings].join(" | "),
        }];
      }
      return details.map((d) => ({
        "الصف": r.row,
        "اللقب": r.lastName,
        "الاسم": r.firstName,
        "الحالة": d.type === "critical" ? "🟥 خطأ" : "🟨 تحذير",
        "العمود": d.columnLabel,
        "القيمة الموجودة": d.value,
        "القيمة المتوقعة": d.expected || "",
        "سبب الخطأ": d.message,
      }));
    });
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 6 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 18 }, { wch: 20 }, { wch: 25 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "تقرير الأخطاء");
    XLSX.writeFile(wb, `تقرير_أخطاء_الاستيراد_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("تم تصدير تقرير الأخطاء (Excel)");
  };

  // ─── Export errors to PDF ───
  const handleExportErrorsPDF = async () => {
    const errorRows = rows.filter((r) => r.status === "error" || r.status === "warning");
    if (errorRows.length === 0) {
      toast.info("لا توجد أخطاء أو تحذيرات");
      return;
    }
    const jsPDF = (await import("jspdf")).default;
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(16);
    doc.text("تقرير أخطاء الاستيراد", 148, 15, { align: "center" });
    doc.setFontSize(10);
    doc.text(`عدد الصفوف: ${errorRows.length} | التاريخ: ${new Date().toLocaleDateString("ar-DZ")}`, 148, 22, { align: "center" });
    autoTable(doc, {
      startY: 28,
      head: [["الصف", "اللقب", "الاسم", "الحالة", "العمود", "القيمة", "المتوقع", "السبب"]],
      body: errorRows.flatMap((r) => {
        const details = r.errorDetails || [];
        if (details.length === 0) {
          return [[String(r.row), r.lastName, r.firstName, r.status === "error" ? "خطأ" : "تحذير", "", "", "", [...r.errors, ...r.warnings].join(" | ")]];
        }
        return details.map((d) => [String(r.row), r.lastName, r.firstName, d.type === "critical" ? "خطأ" : "تحذير", d.columnLabel, d.value, d.expected || "", d.message]);
      }),
      styles: { fontSize: 8, halign: "right" },
      headStyles: { fillColor: [220, 38, 38], textColor: 255, halign: "right" },
    });
    doc.save(`تقرير_أخطاء_الاستيراد_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("تم تصدير تقرير الأخطاء (PDF)");
  };

  // ─── Copy errors list to clipboard ───
  const handleCopyErrors = async () => {
    const errorRows = rows.filter((r) => r.status === "error" || r.status === "warning");
    if (errorRows.length === 0) {
      toast.info("لا توجد أخطاء أو تحذيرات");
      return;
    }
    const text = errorRows.map((r) => {
      const details = r.errorDetails || [];
      const issues = details.length > 0
        ? details.map((d) => `[${d.type === "critical" ? "خطأ" : "تحذير"}] ${d.columnLabel}: ${d.message}`).join("\n  ")
        : [...r.errors, ...r.warnings].join("\n  ");
      return `صف ${r.row}: ${r.lastName} ${r.firstName}\n  ${issues}`;
    }).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("تم نسخ قائمة الأخطاء");
    } catch {
      toast.error("فشل النسخ");
    }
  };

  // ─── Filtered error rows for error panel ───
  const errorRowsForPanel = useMemo(() => {
    let result = rows.filter((r) => r.status === "error" || r.status === "warning");
    if (errorFilter === "critical") {
      result = result.filter((r) => r.errorDetails?.some((d) => d.type === "critical"));
    } else if (errorFilter === "warning") {
      result = result.filter((r) => r.status === "warning" && !r.errorDetails?.some((d) => d.type === "critical"));
    }
    if (errorSearch) {
      const q = errorSearch.toLowerCase();
      result = result.filter((r) =>
        r.lastName.toLowerCase().includes(q) ||
        r.firstName.toLowerCase().includes(q) ||
        String(r.row).includes(q)
      );
    }
    return result;
  }, [rows, errorFilter, errorSearch]);

  // ─── Filtering + Sorting ───
  const filteredRows = useMemo(() => {
    let result = [...rows];

    // Tab filter
    if (activeTab === "valid") result = result.filter((r) => r.status === "valid");
    else if (activeTab === "warnings") result = result.filter((r) => r.status === "warning");
    else if (activeTab === "errors") result = result.filter((r) => r.status === "error");

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) =>
        r.lastName.toLowerCase().includes(q) ||
        r.firstName.toLowerCase().includes(q) ||
        (r.phone || "").includes(q)
      );
    }

    // Filters
    if (filterGender) result = result.filter((r) => r.gender === filterGender);
    if (filterType) result = result.filter((r) => r.subscriptionType === filterType);
    if (filterPayment) result = result.filter((r) => r.paymentStatus === filterPayment);

    // Sort
    result.sort((a, b) => {
      let av: any = a[sortKey];
      let bv: any = b[sortKey];
      if (sortKey === "subscriptionFee" || sortKey === "totalAmount") {
        av = a.computed[sortKey] || 0;
        bv = b.computed[sortKey] || 0;
      }
      if (sortKey === "birthDate") {
        av = a.birthDate ? new Date(a.birthDate).getTime() : 0;
        bv = b.birthDate ? new Date(b.birthDate).getTime() : 0;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [rows, activeTab, search, filterGender, filterType, filterPayment, sortKey, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * pageSize;
  const pagedRows = filteredRows.slice(startIdx, startIdx + pageSize);

  useEffect(() => { setPage(1); }, [activeTab, search, filterGender, filterType, filterPayment]);

  // ─── Selection ───
  const toggleSelect = (rowNum: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowNum)) next.delete(rowNum);
      else next.add(rowNum);
      return next;
    });
  };
  const toggleExclude = (rowNum: number) => {
    setExcludedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowNum)) next.delete(rowNum);
      else next.add(rowNum);
      return next;
    });
  };
  const selectAllVisible = () => {
    const next = new Set(selectedRows);
    pagedRows.forEach((r) => { if (r.status !== "error") next.add(r.row); });
    setSelectedRows(next);
  };
  const deselectAll = () => setSelectedRows(new Set());
  const selectAllValid = () => {
    setSelectedRows(new Set(rows.filter((r) => r.status !== "error").map((r) => r.row)));
    setExcludedRows(new Set());
  };

  // ─── Drawer edit ───
  const openDrawer = (row: PreviewRow) => {
    setDrawerRow(row);
    setEditMode(false);
    setEditForm({
      lastName: row.lastName,
      firstName: row.firstName,
      phone: row.phone || "",
      bloodType: row.bloodType || "",
      swimmingDays: row.swimmingDays || "",
      timeSlot: row.timeSlot || "",
      gender: row.gender || "",
      subscriptionType: row.subscriptionType || "",
      paymentStatus: row.paymentStatus || "",
    });
  };
  const handleSaveEdit = () => {
    if (!drawerRow) return;
    setRows((prev) => prev.map((r) =>
      r.row === drawerRow.row
        ? {
            ...r,
            ...editForm,
            warnings: [
              !editForm.phone ? "رقم الهاتف غير موجود" : null,
              !editForm.bloodType ? "فصيلة الدم غير موجودة" : null,
              !editForm.swimmingDays ? "أيام السباحة فارغة" : null,
              !editForm.timeSlot ? "التوقيت غير محدد" : null,
            ].filter(Boolean) as string[],
            status: r.errors.length > 0 ? "error" : (
              !editForm.phone || !editForm.bloodType || !editForm.swimmingDays || !editForm.timeSlot ? "warning" : "valid"
            ),
          }
        : r
    ));
    setEditMode(false);
    toast.success("تم تحديث البيانات");
  };

  // ─── Stats ───
  const stats = useMemo(() => {
    const valid = rows.filter((r) => r.status === "valid").length;
    const warnings = rows.filter((r) => r.status === "warning").length;
    const errors = rows.filter((r) => r.status === "error").length;
    const totalFees = rows.filter(r => r.status !== "error").reduce((s, r) => s + (r.computed.subscriptionFee || 0), 0);
    const totalInsurance = rows.filter(r => r.status !== "error").reduce((s, r) => s + (r.computed.insuranceFee || 0), 0);
    const totalCompound = rows.filter(r => r.status !== "error").reduce((s, r) => s + (r.computed.compoundRights || 0), 0);
    const totalRevenue = rows.filter(r => r.status !== "error").reduce((s, r) => s + (r.computed.totalAmount || 0), 0);
    return { valid, warnings, errors, totalFees, totalInsurance, totalCompound, totalRevenue };
  }, [rows]);

  // ═══════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4">
      {/* Upload card */}
      {!preview && (
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h3 className="font-bold text-base mb-1 flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" /> استيراد المنخرطين من Excel
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            ارفع ملف Excel يحتوي على بيانات المنخرطين. سيتم تحليل جميع الصفوف وعرضها للمراجعة قبل الاستيراد.
          </p>

          <div
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-2xl p-8 text-center hover:border-primary/50 hover:bg-accent/40 transition cursor-pointer"
          >
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.xlsm" onChange={handleFileSelect} className="hidden" />
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 text-primary/60" />
            {file ? (
              <div>
                <p className="font-semibold text-sm">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-sm mb-1">اضغط لاختيار ملف Excel</p>
                <p className="text-xs text-muted-foreground">يدعم صيغ .xlsx و .xls و .xlsm</p>
              </div>
            )}
          </div>

          {/* زر تحميل القالب */}
          {!file && (
            <div className="mt-4 flex justify-center">
              <Button onClick={handleDownloadTemplate} variant="outline" size="sm">
                <Download className="h-4 w-4 ml-1" />
                تحميل قالب Excel فارغ
              </Button>
            </div>
          )}

          {file && (
            <div className="flex items-center gap-2 mt-4 justify-center flex-wrap">
              <Button onClick={handlePreview} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4 ml-1" />}
                معاينة وتحليل
              </Button>
              <Button onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ""; }} variant="ghost">
                إزالة الملف
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ════════════ Review Interface (after preview) ════════════ */}
      <AnimatePresence>
        {preview && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* ═══ 1. Top Summary Stats ═══ */}
            <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-teal-500/5 to-transparent p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" /> نتائج التحليل والمراجعة
                </h3>
                <Button variant="ghost" size="sm" onClick={() => { setPreview(null); setRows([]); }}>
                  <X className="h-4 w-4 ml-1" /> إغلاق
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                <StatCard label="إجمالي الصفوف" value={preview.totalRows} icon={Database} color="from-sky-500/15 to-sky-500/5 border-sky-500/30 text-sky-700" />
                <StatCard label="صالحة" value={stats.valid} icon={CheckCircle2} color="from-emerald-500/15 to-emerald-500/5 border-emerald-500/30 text-emerald-700" />
                <StatCard label="تحذيرات" value={stats.warnings} icon={AlertTriangle} color="from-amber-500/15 to-amber-500/5 border-amber-500/30 text-amber-700" />
                <StatCard label="أخطاء" value={stats.errors} icon={XCircle} color="from-rose-500/15 to-rose-500/5 border-rose-500/30 text-rose-700" />
                <StatCard label="رسوم الاشتراك" value={`${stats.totalFees.toLocaleString()} دج`} icon={Wallet} color="from-teal-500/15 to-teal-500/5 border-teal-500/30 text-teal-700" small />
                <StatCard label="إجمالي التأمين" value={`${stats.totalInsurance.toLocaleString()} دج`} icon={ShieldCheck} color="from-blue-500/15 to-blue-500/5 border-blue-500/30 text-blue-700" small />
                <StatCard label="حقوق المركب" value={`${stats.totalCompound.toLocaleString()} دج`} icon={Building2} color="from-violet-500/15 to-violet-500/5 border-violet-500/30 text-violet-700" small />
                <StatCard label="الإيرادات المتوقعة" value={`${stats.totalRevenue.toLocaleString()} دج`} icon={TrendingUp} color="from-amber-500/15 to-amber-500/5 border-amber-500/30 text-amber-700" small />
              </div>
            </div>

            {/* ═══ معاينة ورقة التجديد ═══ */}
            {preview?.renewalPreview?.found && (
              <div className="rounded-xl border-2 border-sky-500/30 bg-sky-500/5 p-3 space-y-2">
                <h4 className="font-bold text-xs text-sky-800 dark:text-sky-200 flex items-center gap-1.5">
                  <RefreshCw className="h-4 w-4" /> ورقة التجديد
                </h4>
                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="text-sky-700">
                    <strong>{preview.renewalPreview.totalRows}</strong> إجمالي السجلات
                  </span>
                  <span className="text-emerald-700">
                    <strong>{preview.renewalPreview.renewedCount}</strong> منخرط مجدد
                  </span>
                  <span className="text-muted-foreground">
                    سيتم إنشاء سجلات تجديد تلقائياً عند الاستيراد
                  </span>
                </div>
                {preview.renewalPreview.sample.length > 0 && (
                  <div className="mt-2 rounded-lg border border-sky-500/20 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-sky-500/10">
                        <tr>
                          <th className="p-1.5 text-right">رقم الملف</th>
                          <th className="p-1.5 text-right">الاسم</th>
                          <th className="p-1.5 text-right">تاريخ التجديد</th>
                          <th className="p-1.5 text-right">المبلغ</th>
                          <th className="p-1.5 text-right">الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.renewalPreview.sample.map((s, i) => (
                          <tr key={i} className="border-t border-sky-500/10">
                            <td className="p-1.5 font-mono">{s.fileNumber}</td>
                            <td className="p-1.5">{s.name}</td>
                            <td className="p-1.5">{s.renewalDate || "—"}</td>
                            <td className="p-1.5">{s.amount > 0 ? `${s.amount} دج` : "—"}</td>
                            <td className="p-1.5">{s.status || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ═══ 2. Tabs (الكل / صالحة / تحذيرات / أخطاء) ═══ */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
              <TabsList className="w-full flex-wrap h-auto">
                <TabsTrigger value="all" className="text-xs flex-1 gap-1">
                  <ListChecks className="h-3.5 w-3.5" /> الكل ({rows.length})
                </TabsTrigger>
                <TabsTrigger value="valid" className="text-xs flex-1 gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> صالحة ({stats.valid})
                </TabsTrigger>
                <TabsTrigger value="warnings" className="text-xs flex-1 gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> تحذيرات ({stats.warnings})
                </TabsTrigger>
                <TabsTrigger value="errors" className="text-xs flex-1 gap-1">
                  <XCircle className="h-3.5 w-3.5" /> أخطاء ({stats.errors})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-3 space-y-3">
                {/* ═══ 3. Toolbar: Search + Filters + Sort ═══ */}
                <div className="rounded-xl border border-border/60 bg-card p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="🔍 بحث بالاسم أو الهاتف..."
                        className="h-9 pr-9 text-xs"
                      />
                    </div>

                    {/* Filters */}
                    <select value={filterGender} onChange={(e) => setFilterGender(e.target.value)} className="h-9 text-xs rounded border bg-card px-2">
                      <option value="">كل الأجناس</option>
                      <option value="ذكر">ذكر</option>
                      <option value="أنثى">أنثى</option>
                    </select>

                    <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="h-9 text-xs rounded border bg-card px-2">
                      <option value="">كل الأنواع</option>
                      {subTypes.map((t) => (
                        <option key={t.code} value={t.code}>{t.name === t.code ? t.name : `${t.name} (${t.code})`}</option>
                      ))}
                    </select>

                    <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)} className="h-9 text-xs rounded border bg-card px-2">
                      <option value="">كل الحالات</option>
                      <option value="مدفوع">مدفوع</option>
                      <option value="لم يدفع">لم يدفع</option>
                      <option value="تأمين فقط">تأمين فقط</option>
                      <option value="اشتراك 300">اشتراك 300</option>
                    </select>

                    {/* Sort */}
                    <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="h-9 text-xs rounded border bg-card px-2">
                      <option value="row">ترتيب: الصف</option>
                      <option value="lastName">ترتيب: الاسم</option>
                      <option value="birthDate">ترتيب: الميلاد</option>
                      <option value="subscriptionFee">ترتيب: الرسوم</option>
                      <option value="totalAmount">ترتيب: الإجمالي</option>
                    </select>
                    <Button size="sm" variant="outline" className="h-9 px-2" onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}>
                      {sortDir === "asc" ? "↑" : "↓"}
                    </Button>
                  </div>

                  {/* Bulk actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                    <Badge variant="outline" className="text-[10px]">
                      {filteredRows.length} صف | {selectedRows.size} محدد
                    </Badge>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={selectAllVisible}>
                      <CheckSquare className="h-3 w-3 ml-1" /> تحديد الصفحة
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={selectAllValid}>
                      <CheckSquare className="h-3 w-3 ml-1" /> تحديد كل الصالحة
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={deselectAll}>
                      <Square className="h-3 w-3 ml-1" /> إلغاء التحديد
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs text-rose-600" onClick={() => { selectedRows.forEach(toggleExclude); }}>
                      <Trash2 className="h-3 w-3 ml-1" /> استبعاد المحدد
                    </Button>
                  </div>
                </div>

                {/* ═══ 4. Data Table ═══ */}
                <div className="rounded-xl border border-border/60 overflow-hidden">
                  <div className="overflow-auto max-h-[55vh]">
                    <table className="w-full text-xs min-w-[1400px]">
                      <thead className="sticky top-0 z-10 bg-card shadow-sm">
                        <tr className="border-b text-right">
                          <th className="p-2 font-semibold w-10 text-center">✓</th>
                          <th className="p-2 font-semibold whitespace-nowrap w-10">#</th>
                          <th className="p-2 font-semibold whitespace-nowrap">اللقب</th>
                          <th className="p-2 font-semibold whitespace-nowrap">الاسم</th>
                          <th className="p-2 font-semibold whitespace-nowrap w-14">الجنس</th>
                          <th className="p-2 font-semibold whitespace-nowrap w-24">الميلاد</th>
                          <th className="p-2 font-semibold whitespace-nowrap w-12">العمر</th>
                          <th className="p-2 font-semibold whitespace-nowrap w-16">النوع</th>
                          <th className="p-2 font-semibold whitespace-nowrap w-32">أيام السباحة</th>
                          <th className="p-2 font-semibold whitespace-nowrap w-24">التوقيت</th>
                          <th className="p-2 font-semibold whitespace-nowrap w-20">الرسوم</th>
                          <th className="p-2 font-semibold whitespace-nowrap w-16">التأمين</th>
                          <th className="p-2 font-semibold whitespace-nowrap w-20">الإجمالي</th>
                          <th className="p-2 font-semibold whitespace-nowrap w-24">الهاتف</th>
                          <th className="p-2 font-semibold whitespace-nowrap w-20">الحالة</th>
                          <th className="p-2 font-semibold whitespace-nowrap w-32">ملاحظات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedRows.length === 0 ? (
                          <tr><td colSpan={16} className="text-center py-8 text-muted-foreground">لا توجد بيانات</td></tr>
                        ) : (
                          pagedRows.map((r) => (
                            <tr
                              key={r.row}
                              ref={(el) => { tableRowRefs.current[r.row] = el; }}
                              onClick={() => openDrawer(r)}
                              className={cn(
                                "border-b hover:bg-accent/40 cursor-pointer transition",
                                r.status === "error" && "bg-rose-500/5",
                                r.status === "warning" && "bg-amber-500/5",
                                excludedRows.has(r.row) && "opacity-40 line-through",
                                !selectedRows.has(r.row) && r.status !== "error" && "opacity-70",
                                highlightedRow === r.row && "ring-4 ring-blue-500 ring-offset-2"
                              )}
                            >
                              <td className="p-2 text-center" onClick={(e) => { e.stopPropagation(); if (r.status !== "error") toggleSelect(r.row); }}>
                                {r.status !== "error" && (
                                  <button className="inline-flex">
                                    {selectedRows.has(r.row) ? (
                                      <CheckSquare className="h-4 w-4 text-primary" />
                                    ) : (
                                      <Square className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </button>
                                )}
                              </td>
                              <td className="p-2 text-muted-foreground whitespace-nowrap">{r.row}</td>
                              <td className="p-2 font-semibold whitespace-nowrap">{r.lastName}</td>
                              <td className="p-2 whitespace-nowrap">{r.firstName}</td>
                              <td className="p-2 whitespace-nowrap">{r.gender || "—"}</td>
                              <td className="p-2 whitespace-nowrap font-mono">{r.birthDateDisplay || "—"}</td>
                              <td className="p-2 text-center tabular-nums">{r.computed.age || "—"}</td>
                              <td className="p-2 whitespace-nowrap">{r.subscriptionType || "—"}</td>
                              <td className="p-2 whitespace-nowrap text-[10px]">{r.swimmingDays || "—"}</td>
                              <td className="p-2 whitespace-nowrap font-mono">{r.timeSlot || "—"}</td>
                              <td className="p-2 tabular-nums whitespace-nowrap">{r.computed.subscriptionFee ?? "—"}</td>
                              <td className="p-2 tabular-nums whitespace-nowrap">{r.computed.insuranceFee ?? "—"}</td>
                              <td className="p-2 tabular-nums font-bold text-amber-700 whitespace-nowrap">{r.computed.totalAmount ?? "—"}</td>
                              <td className="p-2 whitespace-nowrap font-mono" dir="ltr">{r.phone || "—"}</td>
                              <td className="p-2 whitespace-nowrap">
                                <StatusBadge status={r.status} />
                              </td>
                              <td className="p-2 text-[10px] text-muted-foreground">
                                {r.errors.length > 0 ? r.errors[0] : r.warnings.length > 0 ? r.warnings[0] : "—"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Sticky footer: Pagination */}
                  <div className="sticky bottom-0 bg-card border-t p-2 flex items-center justify-between flex-wrap gap-2">
                    <p className="text-[10px] text-muted-foreground">
                      عرض {startIdx + 1}-{Math.min(startIdx + pageSize, filteredRows.length)} من {filteredRows.length}
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
                </div>
              </TabsContent>
            </Tabs>

            {/* ═══ 5. Error Details Panel — المنخرطون الذين يحتوي سجلهم على أخطاء ═══ */}
            {(stats.errors > 0 || stats.warnings > 0) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border-2 border-rose-500/30 bg-rose-500/5 p-4 space-y-3"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-bold text-base flex items-center gap-2 text-rose-700">
                    <FileWarning className="h-5 w-5" /> المنخرطون الذين يحتوي سجلهم على أخطاء
                    <Badge variant="outline" className="text-[10px] bg-rose-500/15 text-rose-700 border-rose-500/30">
                      {errorRowsForPanel.length} منخرط
                    </Badge>
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant={errorFilter === "all" ? "default" : "outline"}
                      className="h-7 text-xs"
                      onClick={() => setErrorFilter("all")}
                    >
                      عرض الكل ({stats.errors + stats.warnings})
                    </Button>
                    <Button
                      size="sm"
                      variant={errorFilter === "critical" ? "default" : "outline"}
                      className="h-7 text-xs"
                      onClick={() => setErrorFilter("critical")}
                    >
                      🟥 الحرج فقط ({stats.errors})
                    </Button>
                    <Button
                      size="sm"
                      variant={errorFilter === "warning" ? "default" : "outline"}
                      className="h-7 text-xs"
                      onClick={() => setErrorFilter("warning")}
                    >
                      🟨 التحذيرات ({stats.warnings})
                    </Button>
                  </div>
                </div>

                {/* Search + Export buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={errorSearch}
                      onChange={(e) => setErrorSearch(e.target.value)}
                      placeholder="🔍 بحث بالاسم أو رقم السطر..."
                      className="h-9 pr-9 text-xs"
                    />
                  </div>
                  <Button size="sm" variant="outline" className="h-9 text-xs" onClick={handleExportErrorsExcel}>
                    <FileDown className="h-3.5 w-3.5 ml-1" /> Excel
                  </Button>
                  <Button size="sm" variant="outline" className="h-9 text-xs" onClick={handleExportErrorsPDF}>
                    <FileDown className="h-3.5 w-3.5 ml-1" /> PDF
                  </Button>
                  <Button size="sm" variant="outline" className="h-9 text-xs" onClick={handleCopyErrors}>
                    <Copy className="h-3.5 w-3.5 ml-1" /> نسخ
                  </Button>
                  <Button size="sm" variant="outline" className="h-9 text-xs" onClick={handleDownloadErrors}>
                    <Download className="h-3.5 w-3.5 ml-1" /> CSV
                  </Button>
                </div>

                {/* Error list */}
                <div className="rounded-xl border border-border/60 overflow-hidden">
                  <div className="overflow-y-auto max-h-[400px]">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 z-10 bg-card shadow-sm">
                        <tr className="border-b text-right">
                          <th className="p-2 font-semibold w-12">الصف</th>
                          <th className="p-2 font-semibold">الاسم الكامل</th>
                          <th className="p-2 font-semibold w-20">النوع</th>
                          <th className="p-2 font-semibold w-24">نوع الخطأ</th>
                          <th className="p-2 font-semibold w-28">العمود</th>
                          <th className="p-2 font-semibold w-28">القيمة الموجودة</th>
                          <th className="p-2 font-semibold w-32">القيمة المتوقعة</th>
                          <th className="p-2 font-semibold">سبب الخطأ</th>
                          <th className="p-2 font-semibold w-16 text-center">إجراء</th>
                        </tr>
                      </thead>
                      <tbody>
                        {errorRowsForPanel.length === 0 ? (
                          <tr><td colSpan={9} className="text-center py-6 text-muted-foreground">لا توجد أخطاء مطابقة</td></tr>
                        ) : (
                          errorRowsForPanel.flatMap((r) => {
                            const details = r.errorDetails || [];
                            const rows = details.length > 0 ? details : [{ type: r.status === "error" ? "critical" : "warning", message: [...r.errors, ...r.warnings].join(" | "), column: "", columnLabel: "—", value: "—", expected: "—" }];
                            return rows.map((d, i) => (
                              <tr
                                key={`${r.row}-${i}`}
                                onClick={() => setErrorDrawerRow(r)}
                                className={cn(
                                  "border-b hover:bg-accent/40 cursor-pointer",
                                  d.type === "critical" ? "bg-rose-500/5" : "bg-amber-500/5"
                                )}
                              >
                                <td className="p-2 text-muted-foreground tabular-nums">{r.row}</td>
                                <td className="p-2 font-semibold whitespace-nowrap">
                                  {r.lastName} {r.firstName}
                                </td>
                                <td className="p-2">{r.subscriptionType || "—"}</td>
                                <td className="p-2">
                                  {d.type === "critical" ? (
                                    <Badge variant="outline" className="text-[10px] bg-rose-500/15 text-rose-700 border-rose-500/30">🟥 خطأ</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] bg-amber-500/15 text-amber-700 border-amber-500/30">🟨 تحذير</Badge>
                                  )}
                                </td>
                                <td className="p-2 text-[10px]">{d.columnLabel}</td>
                                <td className="p-2 font-mono text-[10px] truncate max-w-[100px]" title={d.value}>{d.value}</td>
                                <td className="p-2 font-mono text-[10px] text-emerald-700 truncate max-w-[120px]" title={d.expected}>{d.expected || "—"}</td>
                                <td className="p-2 text-[10px]">{d.message}</td>
                                <td className="p-2 text-center">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={(e) => { e.stopPropagation(); scrollToRow(r.row); }}
                                    title="تمييز في الجدول"
                                  >
                                    <Highlighter className="h-3 w-3 text-blue-500" />
                                  </Button>
                                </td>
                              </tr>
                            ));
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground text-center">
                  💡 اضغط على أي صف لعرض التفاصيل الكاملة • اضغط على أيقونة التمييز للانتقال إلى السطر في الجدول
                </p>
              </motion.div>
            )}

            {/* ═══ 6. Bottom Action Bar ═══ */}
            <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                  <Users className="h-3 w-3 ml-1" /> {selectedRows.size} محدد للاستيراد
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setPreview(null); setRows([]); }}>
                  <X className="h-4 w-4 ml-1" /> إلغاء
                </Button>
                <Button variant="outline" size="sm" onClick={handlePreview} disabled={loading}>
                  <RefreshCw className="h-4 w-4 ml-1" /> إعادة تحليل
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadErrors}>
                  <Download className="h-4 w-4 ml-1" /> تقرير الأخطاء
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleImport(true)} disabled={importing || selectedRows.size === 0}>
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare className="h-4 w-4 ml-1" />}
                  استيراد المحدد ({selectedRows.size})
                </Button>
                <Button size="sm" onClick={() => handleImport(false)} disabled={importing || stats.valid + stats.warnings === 0}>
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4 ml-1" />}
                  استيراد جميع الصفوف الصالحة ({stats.valid + stats.warnings})
                </Button>
              </div>
            </div>

            {/* ═══ 6. Progress Bar during import ═══ */}
            <AnimatePresence>
              {importProgress && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="fixed bottom-4 left-4 right-4 z-50 rounded-2xl border-2 border-primary/40 bg-card p-4 shadow-2xl"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-sm flex items-center gap-2">
                      <Database className="h-4 w-4 text-primary animate-pulse" /> جاري الاستيراد...
                    </h4>
                    <span className="text-xs text-muted-foreground">
                      {importProgress.done} / {importProgress.total}
                      {importProgress.errors > 0 && ` | أخطاء: ${importProgress.errors}`}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${(importProgress.done / importProgress.total) * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 text-center">
                    {importProgress.done < importProgress.total
                      ? `المتبقي: ${importProgress.total - importProgress.done} منخرط`
                      : "اكتمل الاستيراد! جاري التحديث..."}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Drawer: Row details ═══ */}
      <Sheet open={!!drawerRow} onOpenChange={(o) => !o && setDrawerRow(null)}>
        <SheetContent side="left" className="w-full sm:max-w-md p-0 overflow-y-auto">
          {drawerRow && (
            <>
              <SheetHeader className="px-4 py-3 border-b bg-gradient-to-l from-teal-600 to-sky-700 text-white">
                <SheetTitle className="flex items-center justify-between text-base">
                  <span>{drawerRow.lastName} {drawerRow.firstName}</span>
                  <div className="flex items-center gap-1">
                    <StatusBadge status={drawerRow.status} light />
                    <Button size="sm" variant="ghost" className="text-white hover:bg-white/20 h-8 w-8 p-0" onClick={() => setDrawerRow(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </SheetTitle>
              </SheetHeader>

              <div className="p-4 space-y-3">
                {/* Errors/Warnings */}
                {drawerRow.errors.length > 0 && (
                  <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-2 space-y-1">
                    <p className="text-xs font-bold text-rose-700">⚠️ أخطاء:</p>
                    {drawerRow.errors.map((e, i) => <p key={i} className="text-xs text-rose-700">• {e}</p>)}
                  </div>
                )}
                {drawerRow.warnings.length > 0 && (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2 space-y-1">
                    <p className="text-xs font-bold text-amber-700">⚠️ تحذيرات:</p>
                    {drawerRow.warnings.map((w, i) => <p key={i} className="text-xs text-amber-700">• {w}</p>)}
                  </div>
                )}

                {/* Editable form */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-muted-foreground">بيانات المنخرط</p>
                    {!editMode ? (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditMode(true)}>
                        <Edit2 className="h-3 w-3 ml-1" /> تعديل
                      </Button>
                    ) : (
                      <Button size="sm" className="h-7 text-xs" onClick={handleSaveEdit}>
                        <Save className="h-3 w-3 ml-1" /> حفظ
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Field label="اللقب" value={drawerRow.lastName} editMode={editMode} editValue={editForm.lastName} onChange={(v) => setEditForm({ ...editForm, lastName: v })} />
                    <Field label="الاسم" value={drawerRow.firstName} editMode={editMode} editValue={editForm.firstName} onChange={(v) => setEditForm({ ...editForm, firstName: v })} />
                    <Field label="الجنس" value={drawerRow.gender || "—"} editMode={editMode} editValue={editForm.gender} onChange={(v) => setEditForm({ ...editForm, gender: v })} type="select" options={["ذكر", "أنثى"]} />
                    <Field label="نوع الاشتراك" value={drawerRow.subscriptionType || "—"} editMode={editMode} editValue={editForm.subscriptionType} onChange={(v) => setEditForm({ ...editForm, subscriptionType: v })} type="select" options={subTypes.length > 0 ? subTypes.map(t => t.code) : ["/", "OPOW", "DJS", "FCS", "RCS", "POLICE", "MJ"]} />
                    <Field label="حالة الدفع" value={drawerRow.paymentStatus || "—"} editMode={editMode} editValue={editForm.paymentStatus} onChange={(v) => setEditForm({ ...editForm, paymentStatus: v })} type="select" options={["مدفوع", "لم يدفع", "تأمين فقط", "اشتراك 300"]} />
                    <Field label="الهاتف" value={drawerRow.phone || "—"} editMode={editMode} editValue={editForm.phone} onChange={(v) => setEditForm({ ...editForm, phone: v })} icon={Phone} />
                    <Field label="فصيلة الدم" value={drawerRow.bloodType || "—"} editMode={editMode} editValue={editForm.bloodType} onChange={(v) => setEditForm({ ...editForm, bloodType: v })} type="select" options={["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]} icon={Droplet} />
                    <Field label="أيام السباحة" value={drawerRow.swimmingDays || "—"} editMode={editMode} editValue={editForm.swimmingDays} onChange={(v) => setEditForm({ ...editForm, swimmingDays: v })} icon={Calendar} />
                    <Field label="التوقيت" value={drawerRow.timeSlot || "—"} editMode={editMode} editValue={editForm.timeSlot} onChange={(v) => setEditForm({ ...editForm, timeSlot: v })} icon={Clock} />
                  </div>
                </div>

                {/* Financial (read-only) */}
                <div className="rounded-lg bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-bold text-muted-foreground">المالية (محسوبة تلقائياً)</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><p className="text-muted-foreground">رسوم الاشتراك</p><p className="font-bold">{drawerRow.computed.subscriptionFee?.toLocaleString() || "—"} دج</p></div>
                    <div><p className="text-muted-foreground">مصاريف التأمين</p><p className="font-bold">{drawerRow.computed.insuranceFee?.toLocaleString() || "—"} دج</p></div>
                    <div><p className="text-muted-foreground">حقوق المركب</p><p className="font-bold text-teal-700">{drawerRow.computed.compoundRights?.toLocaleString() || "—"} دج</p></div>
                    <div><p className="text-muted-foreground">المبلغ الإجمالي</p><p className="font-bold text-amber-700">{drawerRow.computed.totalAmount?.toLocaleString() || "—"} دج</p></div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t">
                  {drawerRow.status !== "error" && (
                    <Button
                      size="sm"
                      variant={selectedRows.has(drawerRow.row) ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => toggleSelect(drawerRow.row)}
                    >
                      {selectedRows.has(drawerRow.row) ? <Check className="h-4 w-4 ml-1" /> : <CheckSquare className="h-4 w-4 ml-1" />}
                      {selectedRows.has(drawerRow.row) ? "محدد" : "تحديد"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={excludedRows.has(drawerRow.row) ? "default" : "outline"}
                    className={cn("flex-1", !excludedRows.has(drawerRow.row) && "text-rose-600")}
                    onClick={() => toggleExclude(drawerRow.row)}
                  >
                    <Trash2 className="h-4 w-4 ml-1" />
                    {excludedRows.has(drawerRow.row) ? "مستبعد" : "استبعاد"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ═══ Error Details Drawer ═══ */}
      <ErrorDetailsDrawer row={errorDrawerRow} onClose={() => setErrorDrawerRow(null)} onHighlight={scrollToRow} />
    </div>
  );
}

// ──────────────── Error Details Drawer Component ────────────────
function ErrorDetailsDrawer({ row, onClose, onHighlight }: {
  row: PreviewRow | null;
  onClose: () => void;
  onHighlight: (rowNum: number) => void;
}) {
  if (!row) return null;
  const details = row.errorDetails || [];
  const criticalErrors = details.filter((d) => d.type === "critical");
  const warnings = details.filter((d) => d.type === "warning");

  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="left" className="w-full sm:max-w-lg p-0 overflow-y-auto">
        <SheetHeader className="px-4 py-3 border-b bg-gradient-to-l from-rose-600 to-orange-700 text-white">
          <SheetTitle className="flex items-center justify-between text-base">
            <span>{row.lastName} {row.firstName}</span>
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/20 h-8 w-8 p-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </SheetTitle>
        </SheetHeader>

        <div className="p-4 space-y-3">
          {/* ملخص الأخطاء */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-2 text-center">
              <p className="text-2xl font-bold text-rose-700">{criticalErrors.length}</p>
              <p className="text-[10px] text-rose-700">🟥 أخطاء حرجة</p>
            </div>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2 text-center">
              <p className="text-2xl font-bold text-amber-700">{warnings.length}</p>
              <p className="text-[10px] text-amber-700">🟨 تحذيرات</p>
            </div>
            <div className="rounded-lg bg-muted/30 border border-border p-2 text-center">
              <p className="text-2xl font-bold">{details.length}</p>
              <p className="text-[10px] text-muted-foreground">إجمالي</p>
            </div>
          </div>

          {/* زر التمييز في الجدول */}
          <Button
            className="w-full"
            variant="outline"
            onClick={() => { onHighlight(row.row); onClose(); }}
          >
            <Highlighter className="h-4 w-4 ml-1" /> تمييز السطر في جدول المعاينة
          </Button>

          {/* بيانات المنخرط */}
          <div className="rounded-lg bg-card border border-border/60 p-3">
            <p className="text-xs font-bold mb-2">بيانات المنخرط</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><p className="text-muted-foreground">الصف</p><p className="font-semibold">{row.row}</p></div>
              <div><p className="text-muted-foreground">اللقب</p><p className="font-semibold">{row.lastName || "—"}</p></div>
              <div><p className="text-muted-foreground">الاسم</p><p className="font-semibold">{row.firstName || "—"}</p></div>
              <div><p className="text-muted-foreground">الجنس</p><p className="font-semibold">{row.gender || "—"}</p></div>
              <div><p className="text-muted-foreground">الميلاد</p><p className="font-semibold">{row.birthDateDisplay || "—"}</p></div>
              <div><p className="text-muted-foreground">فصيلة الدم</p><p className="font-semibold">{row.bloodType || "—"}</p></div>
              <div><p className="text-muted-foreground">نوع الاشتراك</p><p className="font-semibold">{row.subscriptionType || "—"}</p></div>
              <div><p className="text-muted-foreground">حالة الدفع</p><p className="font-semibold">{row.paymentStatus || "—"}</p></div>
              <div><p className="text-muted-foreground">الهاتف</p><p className="font-semibold font-mono" dir="ltr">{row.phone || "—"}</p></div>
              <div><p className="text-muted-foreground">التوقيت</p><p className="font-semibold">{row.timeSlot || "—"}</p></div>
            </div>
          </div>

          {/* قائمة الأخطاء التفصيلية */}
          <div className="space-y-2">
            <p className="text-xs font-bold">جميع الأخطاء والتحذيرات ({details.length})</p>
            {details.length === 0 ? (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-center">
                <Check className="h-6 w-6 mx-auto text-emerald-600 mb-1" />
                <p className="text-xs text-emerald-700 font-semibold">لا توجد أخطاء</p>
              </div>
            ) : (
              details.map((d, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-lg border p-2.5 space-y-1",
                    d.type === "critical"
                      ? "bg-rose-500/10 border-rose-500/30"
                      : "bg-amber-500/10 border-amber-500/30"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {d.type === "critical" ? (
                      <Badge variant="outline" className="text-[10px] bg-rose-500/15 text-rose-700 border-rose-500/30">🟥 خطأ يمنع الاستيراد</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-amber-500/15 text-amber-700 border-amber-500/30">🟨 تحذير</Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">العمود: {d.columnLabel}</span>
                  </div>
                  <p className="text-xs font-semibold">{d.message}</p>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <div>
                      <span className="text-muted-foreground">القيمة الموجودة: </span>
                      <span className="font-mono bg-muted/50 px-1 rounded">{d.value}</span>
                    </div>
                    {d.expected && (
                      <div>
                        <span className="text-muted-foreground">القيمة المتوقعة: </span>
                        <span className="font-mono text-emerald-700 bg-emerald-500/10 px-1 rounded">{d.expected}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ──────────────── Helper Components ────────────────
function StatCard({ label, value, icon: Icon, color, small }: {
  label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; color: string; small?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn("rounded-xl border-2 bg-gradient-to-br p-2.5", color)}
    >
      <div className="flex items-center gap-1.5">
        <Icon className={cn(small ? "h-3.5 w-3.5" : "h-4 w-4", "shrink-0")} />
        <p className={cn("font-bold leading-tight truncate", small ? "text-xs" : "text-lg")}>{value}</p>
      </div>
      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{label}</p>
    </motion.div>
  );
}

function StatusBadge({ status, light }: { status: "valid" | "warning" | "error"; light?: boolean }) {
  if (status === "valid") return <Badge variant="outline" className={cn("text-[10px]", light ? "bg-green-500/20 text-white border-white/30" : "bg-green-500/15 text-green-700 border-green-500/30")}>🟢 صالح</Badge>;
  if (status === "warning") return <Badge variant="outline" className={cn("text-[10px]", light ? "bg-amber-500/20 text-white border-white/30" : "bg-amber-500/15 text-amber-700 border-amber-500/30")}>🟡 تحذير</Badge>;
  return <Badge variant="outline" className={cn("text-[10px]", light ? "bg-rose-500/20 text-white border-white/30" : "bg-rose-500/15 text-rose-700 border-rose-500/30")}>🔴 خطأ</Badge>;
}

function Field({ label, value, editMode, editValue, onChange, type = "text", options, icon: Icon }: {
  label: string; value: string; editMode: boolean; editValue: string; onChange: (v: string) => void;
  type?: "text" | "select"; options?: string[]; icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </p>
      {!editMode ? (
        <p className="text-xs font-semibold p-1.5 rounded bg-muted/30 border border-transparent">{value}</p>
      ) : type === "select" ? (
        <select value={editValue} onChange={(e) => onChange(e.target.value)} className="w-full h-8 text-xs rounded border bg-card px-2">
          <option value="">—</option>
          {options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <Input value={editValue} onChange={(e) => onChange(e.target.value)} className="h-8 text-xs" />
      )}
    </div>
  );
}

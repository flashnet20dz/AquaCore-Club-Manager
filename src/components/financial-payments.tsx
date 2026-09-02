"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, Filter, X, Pencil, Trash2, Printer, Download,
  Loader2, ChevronRight, ChevronLeft, ArrowUpDown, ArrowUp, ArrowDown,
  Wallet, AlertTriangle, Inbox, FileSpreadsheet, CheckSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  FinancialTransactionDialog,
  type TransactionData,
  type TxType,
} from "@/components/financial-transaction-dialog";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface Transaction {
  id: string;
  type: TxType;
  category: string;
  subCategory?: string | null;
  amount: number;
  date: string;
  paymentMethod: string;
  payeeName?: string | null;
  payeeId?: string | null;
  reference?: string | null;
  note?: string | null;
  createdById?: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string } | null;
}

interface TransactionsResponse {
  transactions: Transaction[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  stats: { totalIncome: number; totalExpense: number; balance: number };
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

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "نقدي",
  bank: "بنك",
  cheque: "شيك",
};

const INCOME_CATEGORIES = [
  { value: "subscription", label: "اشتراك" },
  { value: "renewal", label: "تجديد" },
  { value: "insurance", label: "تأمين" },
  { value: "compound", label: "حقوق المركب" },
  { value: "other_income", label: "مدخول آخر" },
];

const EXPENSE_CATEGORIES = [
  { value: "wages", label: "أجور عمال" },
  { value: "insurance", label: "تأمين" },
  { value: "compound_rights", label: "حقوق المركب" },
  { value: "office_supplies", label: "لوازم مكتبية" },
  { value: "other_expense", label: "دفعات أخرى" },
];

const PAGE_SIZES = [10, 20, 50];

type SortField = "date" | "amount";
type SortDir = "asc" | "desc";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function formatDA(n: number): string {
  return new Intl.NumberFormat("fr-DZ").format(Math.round(n)) + " دج";
}

function formatDate(s: string): string {
  try {
    return new Date(s).toLocaleDateString("ar-DZ", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return s;
  }
}

function formatDateTime(s: string): string {
  try {
    return new Date(s).toLocaleString("ar-DZ", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return s;
  }
}

function toDateInputValue(d: Date): string {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
interface FinancialPaymentsProps {
  /** ترشيح مبدئي للنوع عند القدوم من بطاقة النظرة العامة */
  initialType?: "income" | "expense";
  /** أزرار إضافية في شريط الأدوات (مثل: أجور العمال — بصلاحيتها الخاصة) */
  headerActions?: React.ReactNode;
  /** تغيّر قيمته ⇒ إعادة جلب القيود (بعد تسديد أجر مثلاً) */
  refreshSignal?: number;
}

export function FinancialPayments({ initialType, headerActions, refreshSignal }: FinancialPaymentsProps = {}) {
  // Filters
  // ★ ملاحظة: قيمة «الكل» = "all" وليس "" — Radix Select يمنع value فارغاً
  // (كان يُسقط الصفحة كلها بخطأ Select.Item عند فتح قسم المركز المالي)
  // ★ initialType: ترشيح مبدئي عند القدوم من بطاقة الدورة المالية (قبض/صرف)
  const [typeFilter, setTypeFilter] = useState<string>(initialType ?? "all"); // "all" | "income" | "expense"
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [searchPayee, setSearchPayee] = useState<string>("");

  // Pagination & sort
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Data
  const [data, setData] = useState<TransactionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentBalance, setCurrentBalance] = useState(0);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<TransactionData | null>(null);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Bulk delete dialog
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteReason, setBulkDeleteReason] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Filter bar collapse on mobile
  const [showFilters, setShowFilters] = useState(true);

  // Build query string
  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    if (paymentMethodFilter !== "all") params.set("paymentMethod", paymentMethodFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (searchPayee.trim()) params.set("payeeName", searchPayee.trim());
    params.set("page", String(page));
    params.set("limit", String(pageSize));
    return params.toString();
  }, [typeFilter, categoryFilter, paymentMethodFilter, dateFrom, dateTo, searchPayee, page, pageSize]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/financial/transactions?${buildQuery()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = (await res.json()) as TransactionsResponse;
      setData(json);
      setCurrentBalance(json.stats.balance);
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // إعادة الجلب عند طلب خارجي (بعد تسديد أجر من الحوار الجانبي)
  useEffect(() => {
    if (refreshSignal !== undefined && refreshSignal > 0) fetchData();
  }, [refreshSignal]);

  // Reset selection when page/filter changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, pageSize, typeFilter, categoryFilter, paymentMethodFilter, dateFrom, dateTo, searchPayee]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [typeFilter, categoryFilter, paymentMethodFilter, dateFrom, dateTo, searchPayee]);

  // Derived categories based on type filter
  const categories = useMemo(() => {
    if (typeFilter === "income") return INCOME_CATEGORIES;
    if (typeFilter === "expense") return EXPENSE_CATEGORIES;
    // ★ إزالة التكرار: «تأمين» موجودة في القائمتين — مفتاح React مزدوج يفسد القائمة
    const merged = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];
    return merged.filter((c, i) => merged.findIndex((x) => x.value === c.value) === i);
  }, [typeFilter]);

  // Reset category filter if not in current categories list
  useEffect(() => {
    if (categoryFilter !== "all" && !categories.find((c) => c.value === categoryFilter)) {
      setCategoryFilter("all");
    }
  }, [categories, categoryFilter]);

  // Sort data client-side (the API returns by date desc; we apply client sort on the page)
  const sortedTransactions = useMemo(() => {
    if (!data?.transactions) return [];
    const arr = [...data.transactions];
    arr.sort((a, b) => {
      let av: number, bv: number;
      if (sortField === "amount") {
        av = a.amount;
        bv = b.amount;
      } else {
        av = new Date(a.date).getTime();
        bv = new Date(b.date).getTime();
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return arr;
  }, [data, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (sortedTransactions.length === 0) return;
    const allSelected = sortedTransactions.every((t) => selectedIds.has(t.id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedTransactions.map((t) => t.id)));
    }
  };

  const handleClearFilters = () => {
    setTypeFilter("all");
    setCategoryFilter("all");
    setPaymentMethodFilter("all");
    setDateFrom("");
    setDateTo("");
    setSearchPayee("");
  };

  const hasActiveFilters = typeFilter !== "all" || categoryFilter !== "all" || paymentMethodFilter !== "all" || dateFrom || dateTo || searchPayee.trim();

  const handleOpenCreate = () => {
    setEditingTx(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (tx: Transaction) => {
    setEditingTx({
      id: tx.id,
      type: tx.type,
      category: tx.category,
      subCategory: tx.subCategory,
      amount: tx.amount,
      date: tx.date,
      paymentMethod: tx.paymentMethod,
      payeeName: tx.payeeName,
      payeeId: tx.payeeId,
      reference: tx.reference,
      note: tx.note,
    });
    setDialogOpen(true);
  };

  const handleSaved = () => {
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteReason.trim().length < 3) {
      toast.error("سبب الحذف يجب أن يكون 3 أحرف على الأقل");
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/financial/transactions/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: deleteReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الحذف");
      toast.success("تم حذف العملية");
      setDeleteTarget(null);
      setDeleteReason("");
      fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحذف");
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (bulkDeleteReason.trim().length < 3) {
      toast.error("سبب الحذف يجب أن يكون 3 أحرف على الأقل");
      return;
    }
    setBulkDeleting(true);
    let success = 0;
    let failed = 0;
    for (const id of Array.from(selectedIds)) {
      try {
        const res = await fetch(`/api/financial/transactions/${id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: bulkDeleteReason.trim() }),
        });
        if (res.ok) success++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setBulkDeleting(false);
    setBulkDeleteOpen(false);
    setBulkDeleteReason("");
    setSelectedIds(new Set());
    fetchData();
    if (failed === 0) {
      toast.success(`تم حذف ${success} عملية بنجاح`);
    } else {
      toast.warning(`تم حذف ${success}، فشل ${failed} عملية`);
    }
  };

  const handlePrintReceipt = (tx: Transaction) => {
    const win = window.open("", "_blank", "width=800,height=600");
    if (!win) {
      toast.error("فشل فتح نافذة الطباعة. الرجاء السماح بالنوافذ المنبثقة.");
      return;
    }
    const typeLabel = tx.type === "income" ? "إيصال استلام" : "إيصال صرف";
    const typeColor = tx.type === "income" ? "#10b981" : "#f43f5e";
    const amountStr = new Intl.NumberFormat("fr-DZ").format(tx.amount);
    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<title>${typeLabel} — ${tx.reference || tx.id.slice(-6)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, sans-serif; padding: 32px; color: #1f2937; background: #fff; }
  .receipt { max-width: 600px; margin: 0 auto; border: 2px solid ${typeColor}; border-radius: 12px; padding: 28px; }
  .header { text-align: center; border-bottom: 2px dashed #e5e7eb; padding-bottom: 16px; margin-bottom: 20px; }
  .title { font-size: 22px; font-weight: 800; color: ${typeColor}; }
  .subtitle { font-size: 13px; color: #6b7280; margin-top: 4px; }
  .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed #f3f4f6; font-size: 14px; }
  .row .label { color: #6b7280; font-weight: 500; }
  .row .value { font-weight: 700; color: #111827; }
  .amount-box { background: ${typeColor}15; border: 1px solid ${typeColor}40; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center; }
  .amount-box .label { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
  .amount-box .amount { font-size: 28px; font-weight: 800; color: ${typeColor}; }
  .footer { margin-top: 32px; display: flex; justify-content: space-between; align-items: flex-end; }
  .signature { font-size: 12px; color: #6b7280; text-align: center; }
  .signature .line { width: 140px; border-top: 1px solid #9ca3af; margin-top: 32px; padding-top: 4px; }
  .stamp-area { width: 120px; height: 120px; border: 2px dashed #d1d5db; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #9ca3af; }
  @media print { body { padding: 0; } .no-print { display: none; } }
  .print-btn { background: ${typeColor}; color: white; border: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; margin: 16px auto; display: block; }
  .print-btn:hover { opacity: 0.9; }
</style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="title">${typeLabel}</div>
      <div class="subtitle">رقم المرجع: ${tx.reference || "—"}</div>
    </div>
    <div class="row"><span class="label">نوع العملية</span><span class="value">${tx.type === "income" ? "مدخول" : "مصروف"}</span></div>
    <div class="row"><span class="label">الفئة</span><span class="value">${CATEGORY_LABELS[tx.category] || tx.category}</span></div>
    <div class="row"><span class="label">التاريخ</span><span class="value">${formatDateTime(tx.date)}</span></div>
    <div class="row"><span class="label">طريقة الدفع</span><span class="value">${PAYMENT_METHOD_LABELS[tx.paymentMethod] || tx.paymentMethod}</span></div>
    ${tx.payeeName ? `<div class="row"><span class="label">${tx.type === "income" ? "الدافع" : "المستفيد"}</span><span class="value">${tx.payeeName}</span></div>` : ""}
    ${tx.note ? `<div class="row"><span class="label">ملاحظات</span><span class="value">${tx.note}</span></div>` : ""}
    <div class="amount-box">
      <div class="label">المبلغ</div>
      <div class="amount">${amountStr} دج</div>
    </div>
    <div class="footer">
      <div class="signature">
        <div>توقيع المحاسب</div>
        <div class="line"></div>
      </div>
      <div class="stamp-area">ختم النادي</div>
    </div>
  </div>
  <button class="print-btn no-print" onclick="window.print()">طباعة</button>
</body>
</html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  const handleExportCSV = () => {
    if (!data || data.transactions.length === 0) {
      toast.error("لا توجد بيانات للتصدير");
      return;
    }
    // Use selected if any, else full page
    const list = selectedIds.size > 0
      ? data.transactions.filter((t) => selectedIds.has(t.id))
      : data.transactions;

    const headers = ["التاريخ", "النوع", "الفئة", "المبلغ", "طريقة الدفع", "الجهة", "المرجع", "ملاحظات"];
    const rows = list.map((t) => [
      formatDate(t.date),
      t.type === "income" ? "مدخول" : "مصروف",
      CATEGORY_LABELS[t.category] || t.category,
      String(t.amount),
      PAYMENT_METHOD_LABELS[t.paymentMethod] || t.paymentMethod,
      t.payeeName || "",
      t.reference || "",
      (t.note || "").replace(/[\r\n]+/g, " "),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    // BOM for Arabic support in Excel
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financial-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`تم تصدير ${list.length} عملية إلى CSV`);
  };

  // ─── Render ───
  const totalIncome = data?.stats.totalIncome || 0;
  const totalExpense = data?.stats.totalExpense || 0;
  const balance = data?.stats.balance || 0;

  return (
    <div dir="rtl" className="space-y-4 pb-2">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-primary/10 p-2">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">المعاملات المالية</h2>
            <p className="text-xs text-muted-foreground">
              دفتر القيود الموحّد — إجمالي الصفحة: مدخول{" "}
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">{formatDA(totalIncome)}</span>
              {" • "}مصروف{" "}
              <span className="text-rose-600 dark:text-rose-400 font-bold">{formatDA(totalExpense)}</span>
              {" • "}الرصيد{" "}
              <span className={cn("font-bold", balance < 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground")}>
                {formatDA(balance)}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {headerActions}
          <Button variant="outline" size="sm" onClick={() => setShowFilters((s) => !s)} className="lg:hidden">
            <Filter className="h-4 w-4" />
            فلاتر
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={loading || !data}>
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">تصدير CSV</span>
          </Button>
          <Button size="sm" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4" />
            تسجيل دفعة جديدة
          </Button>
        </div>
      </div>

      {/* Filters bar */}
      <AnimatePresence initial={false}>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-visible"
          >
            <Card className="p-3 sm:p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                {/* Type */}
                <div className="space-y-1">
                  <Label className="text-xs">النوع</Label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="الكل" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      <SelectItem value="income">مدخول</SelectItem>
                      <SelectItem value="expense">مصروف</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Category */}
                <div className="space-y-1">
                  <Label className="text-xs">الفئة</Label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="الكل" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Payment method */}
                <div className="space-y-1">
                  <Label className="text-xs">طريقة الدفع</Label>
                  <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="الكل" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      <SelectItem value="cash">نقدي</SelectItem>
                      <SelectItem value="bank">بنك</SelectItem>
                      <SelectItem value="cheque">شيك</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date from */}
                <div className="space-y-1">
                  <Label className="text-xs">من تاريخ</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-9"
                  />
                </div>

                {/* Date to */}
                <div className="space-y-1">
                  <Label className="text-xs">إلى تاريخ</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-9"
                  />
                </div>

                {/* Search by payee */}
                <div className="space-y-1">
                  <Label className="text-xs">بحث بالجهة</Label>
                  <div className="relative">
                    <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      type="text"
                      value={searchPayee}
                      onChange={(e) => setSearchPayee(e.target.value)}
                      placeholder="اسم..."
                      className="h-9 pr-8"
                    />
                  </div>
                </div>
              </div>

              {hasActiveFilters && (
                <div className="flex items-center justify-end mt-3">
                  <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                    <X className="h-3.5 w-3.5" />
                    مسح الفلاتر
                  </Button>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk actions bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 flex flex-wrap items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2 text-sm">
              <CheckSquare className="h-4 w-4 text-primary" />
              <span className="font-semibold">{selectedIds.size} عملية محددة</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <FileSpreadsheet className="h-3.5 w-3.5" />
                تصدير المحدد
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                حذف المحدد
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                <X className="h-3.5 w-3.5" />
                إلغاء التحديد
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transactions table */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <AlertTriangle className="h-8 w-8 text-rose-600" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchData}>
              إعادة المحاولة
            </Button>
          </div>
        ) : !data || sortedTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <div className="rounded-full bg-muted p-4">
              <Inbox className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground">لا توجد عمليات</p>
            <p className="text-xs text-muted-foreground max-w-md text-center">
              {hasActiveFilters
                ? "لا توجد عمليات مطابقة للفلاتر الحالية. جرّب تعديل الفلاتر أو مسحها."
                : "ابدأ بتسجيل أول دفعة مالية لعرضها هنا."}
            </p>
            {hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                <X className="h-3.5 w-3.5" />
                مسح الفلاتر
              </Button>
            ) : (
              <Button size="sm" onClick={handleOpenCreate}>
                <Plus className="h-3.5 w-3.5" />
                تسجيل دفعة
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="max-h-[65vh] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur-sm z-10">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={sortedTransactions.length > 0 && sortedTransactions.every((t) => selectedIds.has(t.id))}
                        onCheckedChange={toggleSelectAll}
                        aria-label="تحديد الكل"
                      />
                    </TableHead>
                    <TableHead className="w-10 text-xs">#</TableHead>
                    <TableHead className="text-xs">النوع</TableHead>
                    <TableHead className="text-xs">الفئة</TableHead>
                    <TableHead
                      className="text-xs cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort("amount")}
                    >
                      <span className="inline-flex items-center gap-1">
                        المبلغ
                        {sortField === "amount" ? (
                          sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-50" />
                        )}
                      </span>
                    </TableHead>
                    <TableHead
                      className="text-xs cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort("date")}
                    >
                      <span className="inline-flex items-center gap-1">
                        التاريخ
                        {sortField === "date" ? (
                          sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-50" />
                        )}
                      </span>
                    </TableHead>
                    <TableHead className="text-xs hidden md:table-cell">الجهة</TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">طريقة الدفع</TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">المرجع</TableHead>
                    <TableHead className="text-xs text-left">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTransactions.map((tx, idx) => {
                    const isSelected = selectedIds.has(tx.id);
                    return (
                      <TableRow
                        key={tx.id}
                        className={cn(
                          "border-border/40 transition-colors",
                          isSelected && "bg-primary/5"
                        )}
                      >
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(tx.id)}
                            aria-label={`تحديد ${tx.id}`}
                          />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {(page - 1) * pageSize + idx + 1}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              "text-[10px]",
                              tx.type === "income"
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                : "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
                            )}
                          >
                            {tx.type === "income" ? "مدخول" : "مصروف"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-foreground">
                          {CATEGORY_LABELS[tx.category] || tx.category}
                        </TableCell>
                        <TableCell className={cn(
                          "text-xs font-bold tabular-nums",
                          tx.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        )}>
                          {tx.type === "income" ? "+" : "-"}
                          {formatDA(tx.amount)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(tx.date)}
                        </TableCell>
                        <TableCell className="text-xs text-foreground hidden md:table-cell">
                          {tx.payeeName || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">
                          {PAYMENT_METHOD_LABELS[tx.paymentMethod] || tx.paymentMethod}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">
                          {tx.reference || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-0.5 justify-end">
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handlePrintReceipt(tx)}
                                  >
                                    <Printer className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">طباعة الإيصال</TooltipContent>
                              </UITooltip>

                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleOpenEdit(tx)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">تعديل</TooltipContent>
                              </UITooltip>

                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                                    onClick={() => {
                                      setDeleteTarget(tx);
                                      setDeleteReason("");
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">حذف</TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination footer */}
            <div className="border-t border-border bg-muted/30 p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>عرض</span>
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                  <SelectTrigger className="h-7 w-16 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map((s) => (
                      <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span>من أصل {data.pagination.total} عملية</span>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                  السابق
                </Button>
                <span className="text-xs text-muted-foreground tabular-nums px-2">
                  {page} / {Math.max(1, data.pagination.totalPages)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  disabled={page >= data.pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  التالي
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Transaction dialog */}
      <FinancialTransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        transaction={editingTx}
        currentBalance={currentBalance}
        onSaved={handleSaved}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setDeleteReason(""); } }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              تأكيد حذف العملية
            </AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف العملية نهائياً وإعادة حساب الرصيد. لا يمكن التراجع عن هذا الإجراء.
              {deleteTarget && (
                <span className="block mt-2 text-xs font-semibold text-foreground">
                  {deleteTarget.type === "income" ? "مدخول" : "مصروف"} — {CATEGORY_LABELS[deleteTarget.category]} — {formatDA(deleteTarget.amount)}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">سبب الحذف (إلزامي، 3 أحرف على الأقل)</Label>
            <Textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="مثال: خطأ في إدخال المبلغ / عملية مكررة..."
              rows={3}
              disabled={deleting}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting || deleteReason.trim().length < 3}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري الحذف...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  حذف نهائي
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete dialog */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              حذف {selectedIds.size} عملية محددة
            </AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف جميع العمليات المحددة نهائياً. سيُطبّق نفس السبب على كل عملية. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">سبب الحذف الجماعي (إلزامي)</Label>
            <Textarea
              value={bulkDeleteReason}
              onChange={(e) => setBulkDeleteReason(e.target.value)}
              placeholder="مثال: عمليات مكررة / تصفية سجلات قديمة..."
              rows={3}
              disabled={bulkDeleting}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleBulkDelete(); }}
              disabled={bulkDeleting || bulkDeleteReason.trim().length < 3}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {bulkDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري الحذف...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  حذف {selectedIds.size} عملية
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

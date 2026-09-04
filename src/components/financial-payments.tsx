"use client";

/**
 * FinancialPayments — جدول المعاملات المالية الاحترافي (دفتر القيود الموحّد)
 * ═════════════════════════════════════════════════════════════════════════
 *  كل شيء خادمي (المراحل 25-28): فرز بالرؤوس + بحث موحّد ?q= (debounce 350ms)
 *  + فلاتر (نوع/فئة/حالة/طريقة دفع/تواريخ) + Pagination — لا فرز عميل للصفحة.
 *  • رقم العملية FIN بارز (القديم بلا رقم يعرض «—» مع tooltip «قيد قديم»)
 *  • بطاقات إحصاء من stats الاستجابة (وفق الفلاتر الحالية — النشطة فقط)
 *  • تفاصيل الصف → حوار كامل مع Timeline سجل التدقيق + طباعة إيصال بالمبلغ حروفاً
 *  • تصدير عبر ExportButton المشترك — يجلب كل الصفحات المفلترة (limit=200، سقف 20 صفحة)
 *  • Preset من بطاقات النظرة العامة: localStorage rcs-financial-ledger-preset
 *  • إلغاء ناعم بسبب إلزامي (نفس نمط wages-section) — الخادم يحمي 403/409
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, Filter, X, Pencil, Eye, Printer,
  Loader2, ChevronRight, ChevronLeft, ArrowUpDown, ArrowUp, ArrowDown,
  Wallet, AlertTriangle, Inbox, XCircle, TrendingUp, TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  Tooltip as UITooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { notifyFinancialUpdated } from "@/lib/financial-events";
import {
  FinancialTransactionDialog,
  type TransactionData,
  type TxType,
} from "@/components/financial-transaction-dialog";
import { ExportButton, type ExportColumn } from "@/components/shared/export-button";
import { TransactionDetailsDialog } from "@/components/financial/transaction-details-dialog";
import { categoryLabel, paymentMethodLabel, typeLabel } from "@/components/financial/labels";
import { openReceiptPrint } from "@/components/financial/receipt";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface Transaction {
  id: string;
  number: string | null;
  seq: number | null;
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
  subscriberId?: string | null;
  employeeId?: string | null;
  createdById?: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string } | null;
  // ★ الإلغاء الناعم — الملغاة تبقى في السجل بوضع «ملغاة»
  status?: string; // active | cancelled
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  cancelledByName?: string | null;
}

interface TransactionsResponse {
  transactions: Transaction[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  stats: {
    totalIncome: number; totalExpense: number; balance: number;
    incomeCount?: number; expenseCount?: number;
    cancelledTotal?: number; cancelledCount?: number;
  };
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
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
  { value: "maintenance", label: "صيانة" },
  { value: "equipment", label: "معدات" },
  { value: "office_supplies", label: "لوازم مكتبية" },
  { value: "other_expense", label: "دفعات أخرى" },
];

const ALL_CATEGORIES = new Set(
  [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].map((c) => c.value)
);

const PAGE_SIZES = [25, 50, 100];
const DEFAULT_LIMIT = 50;

type SortField = "date" | "amount" | "category" | "type" | "payeeName" | "seq";
type SortDir = "asc" | "desc";

const SORTABLE_HEADS: Array<{ field: SortField; label: string }> = [
  { field: "date", label: "التاريخ" },
  { field: "amount", label: "المبلغ" },
  { field: "category", label: "الفئة" },
  { field: "type", label: "النوع" },
  { field: "payeeName", label: "الجهة" },
  { field: "seq", label: "رقم العملية" },
];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function formatDA(n: number): string {
  return new Intl.NumberFormat("fr-DZ").format(Math.round(n)) + " دج";
}

function formatDayMonth(s: string): string {
  try {
    return new Date(s).toLocaleDateString("ar-DZ", { day: "2-digit", month: "2-digit" });
  } catch {
    return s;
  }
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
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return s;
  }
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
  /** ★ مزامنة الفترة من رأس المركز: تغيّر nonce ⇒ ضبط نطاق التاريخ تلقائياً */
  syncRange?: { from: string; to: string; nonce: number };
}

export function FinancialPayments({ initialType, headerActions, refreshSignal, syncRange }: FinancialPaymentsProps = {}) {
  // Filters — قيمة «الكل» = "all" وليس "" (Radix Select يمنع value فارغاً)
  const [typeFilter, setTypeFilter] = useState<string>(initialType ?? "all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  // ★ الحالة: النشطة افتراضياً — «ملغاة» لعرض سجل الإلغاءات — «الكل» للسجل الكامل
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // ★ بحث موحّد خادمي مع debounce 350ms (المرحلة 26)
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");

  // Pagination & sort — خادمية بالكامل (المرحلتان 27-28)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_LIMIT);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Data
  const [data, setData] = useState<TransactionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** رصيد الدفتر الكامل (بلا فلاتر) — لمعاينة القيد الجديد */
  const [ledgerBalance, setLedgerBalance] = useState(0);

  // Club name للإيصال
  const [clubName, setClubName] = useState<string | undefined>(undefined);

  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<TransactionData | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Cancel dialog (إلغاء ناعم من الصف)
  const [cancelTarget, setCancelTarget] = useState<Transaction | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Export — كل النتائج المفلترة (سقف 20 صفحة × 200)
  const [exportRows, setExportRows] = useState<Transaction[] | null>(null);
  const [exportLoading, setExportLoading] = useState(true);

  // Filter bar collapse on mobile
  const [showFilters, setShowFilters] = useState(true);

  // ─── Preset من بطاقات النظرة العامة (مرة واحدة عند التحميل) ───
  const presetApplied = useRef(false);
  useEffect(() => {
    if (presetApplied.current) return;
    presetApplied.current = true;
    try {
      const raw = localStorage.getItem("rcs-financial-ledger-preset");
      if (raw) {
        localStorage.removeItem("rcs-financial-ledger-preset");
        const p = JSON.parse(raw) as { type?: string; category?: string };
        if (p.type === "income" || p.type === "expense") setTypeFilter(p.type);
        if (p.category && ALL_CATEGORIES.has(p.category)) setCategoryFilter(p.category);
      }
    } catch {
      // تجاهل JSON تالف
    }
  }, []);

  // ★ مزامنة الفترة من رأس المركز — تغيير الفترة يضبط نطاق تاريخ الدفتر تلقائياً
  const syncedNonce = useRef(0);
  useEffect(() => {
    if (!syncRange || syncRange.nonce === 0) return;
    if (syncedNonce.current === syncRange.nonce) return;
    syncedNonce.current = syncRange.nonce;
    setDateFrom(syncRange.from);
    setDateTo(syncRange.to);
    setPage(1);
  }, [syncRange]);

  // ─── اسم النادي للإيصالات ───
  useEffect(() => {
    let alive = true;
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j?.settings?.clubName) setClubName(String(j.settings.clubName));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // ─── Debounce البحث: 350ms ───
  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ─── معاملات الفلاتر (مشتركة بين القائمة والتصدير) ───
  const filterParams = useMemo(() => {
    const p = new URLSearchParams();
    if (typeFilter !== "all") p.set("type", typeFilter);
    if (categoryFilter !== "all") p.set("category", categoryFilter);
    if (paymentMethodFilter !== "all") p.set("paymentMethod", paymentMethodFilter);
    if (statusFilter !== "all") p.set("status", statusFilter);
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    return p;
  }, [typeFilter, categoryFilter, paymentMethodFilter, statusFilter, dateFrom, dateTo]);

  // ─── جلب القائمة (فرز/بحث/فلاتر/صفحات خادمية) ───
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams(filterParams);
      if (q) p.set("q", q);
      p.set("page", String(page));
      p.set("limit", String(pageSize));
      p.set("sortField", sortField);
      p.set("sortDir", sortDir);
      const res = await fetch(`/api/financial/transactions?${p.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = (await res.json()) as TransactionsResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, [filterParams, q, page, pageSize, sortField, sortDir]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── رصيد الدفتر الكامل (بلا فلاتر) — لمعاينة القيد الجديد ───
  const fetchLedgerBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/financial/transactions?page=1&limit=1&status=active", { cache: "no-store" });
      const j = await res.json();
      if (res.ok && j?.stats) setLedgerBalance(j.stats.balance || 0);
    } catch {
      // غير حرج
    }
  }, []);

  useEffect(() => {
    fetchLedgerBalance();
  }, [fetchLedgerBalance]);

  // إعادة الجلب عند طلب خارجي (بعد تسديد أجر من الحوار الجانبي)
  useEffect(() => {
    if (refreshSignal !== undefined && refreshSignal > 0) {
      fetchData();
      fetchLedgerBalance();
    }
  }, [refreshSignal]);

  // Reset page عند تغيير أي فلتر/بحث/فرز
  useEffect(() => {
    setPage(1);
  }, [typeFilter, categoryFilter, paymentMethodFilter, statusFilter, dateFrom, dateTo, q, sortField, sortDir, pageSize]);

  // ─── التصدير: جلب كل الصفحات المفلترة خلفياً (limit=200، سقف 20 صفحة) ───
  useEffect(() => {
    const ctrl = new AbortController();
    setExportLoading(true);
    const t = setTimeout(async () => {
      try {
        const p = new URLSearchParams(filterParams);
        if (q) p.set("q", q);
        p.set("sortField", sortField);
        p.set("sortDir", sortDir);
        p.set("limit", "200");
        const firstRes = await fetch(`/api/financial/transactions?${p.toString()}&page=1`, {
          signal: ctrl.signal, cache: "no-store",
        });
        const first = await firstRes.json();
        let rows: Transaction[] = first.transactions || [];
        const totalPages = Math.min(first.pagination?.totalPages || 1, 20);
        if (first.pagination?.totalPages > 20) {
          toast.info("التصدير يغطي أول 4000 عملية من النتائج المفلترة");
        }
        if (totalPages > 1) {
          const rest = await Promise.all(
            Array.from({ length: totalPages - 1 }, (_, i) =>
              fetch(`/api/financial/transactions?${p.toString()}&page=${i + 2}`, {
                signal: ctrl.signal, cache: "no-store",
              }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
            )
          );
          for (const part of rest) if (part?.transactions) rows = rows.concat(part.transactions);
        }
        setExportRows(rows);
      } catch {
        // aborted أو فشل — تُعاد المحاولة عند تغيير الفلاتر
      } finally {
        setExportLoading(false);
      }
    }, 500);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [filterParams, q, sortField, sortDir]);

  // ─── Derived ───
  const categories = useMemo(() => {
    if (typeFilter === "income") return INCOME_CATEGORIES;
    if (typeFilter === "expense") return EXPENSE_CATEGORIES;
    const merged = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];
    return merged.filter((c, i) => merged.findIndex((x) => x.value === c.value) === i);
  }, [typeFilter]);

  // Reset category filter if not in current categories list
  useEffect(() => {
    if (categoryFilter !== "all" && !categories.find((c) => c.value === categoryFilter)) {
      setCategoryFilter("all");
    }
  }, [categories, categoryFilter]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const handleClearFilters = () => {
    setTypeFilter("all");
    setCategoryFilter("all");
    setPaymentMethodFilter("all");
    setStatusFilter("active");
    setDateFrom("");
    setDateTo("");
    setSearchInput("");
    setQ("");
  };

  const hasActiveFilters =
    typeFilter !== "all" || categoryFilter !== "all" || paymentMethodFilter !== "all" ||
    statusFilter !== "active" || !!dateFrom || !!dateTo || !!q;

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

  const openDetails = (id: string) => {
    setDetailsId(id);
    setDetailsOpen(true);
  };

  const refreshAll = useCallback(() => {
    fetchData();
    fetchLedgerBalance();
  }, [fetchData, fetchLedgerBalance]);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    if (cancelReason.trim().length < 3) {
      toast.error("سبب الإلغاء إلزامي (3 أحرف على الأقل)");
      return;
    }
    setCancelling(true);
    try {
      const res = await fetch(`/api/financial/transactions/${cancelTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "فشل الإلغاء");
      toast.success("تم إلغاء العملية — تبقى في السجل بوضع «ملغاة» ولا تدخل في الرصيد");
      notifyFinancialUpdated();
      setCancelTarget(null);
      setCancelReason("");
      refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الإلغاء");
    } finally {
      setCancelling(false);
    }
  };

  // ─── أعمدة التصدير (كل النتائج المفلترة لا الصفحة فقط) ───
  const exportColumns: ExportColumn<Transaction>[] = [
    { key: "number", label: "رقم العملية", format: (t) => t.number || "قيد قديم" },
    { key: "date", label: "التاريخ", format: (t) => formatDate(t.date) },
    { key: "type", label: "النوع", format: (t) => typeLabel(t.type) },
    { key: "category", label: "الفئة", format: (t) => categoryLabel(t.category) },
    { key: "payeeName", label: "الجهة", format: (t) => t.payeeName || "" },
    { key: "paymentMethod", label: "طريقة الدفع", format: (t) => paymentMethodLabel(t.paymentMethod) },
    { key: "amount", label: "المبلغ (دج)", format: (t) => (t.type === "income" ? "+" : "-") + String(t.amount) },
    { key: "status", label: "الحالة", format: (t) => (t.status === "cancelled" ? "ملغاة" : "نشطة") },
    { key: "reference", label: "المرجع", format: (t) => t.reference || "" },
    { key: "note", label: "الملاحظة", format: (t) => (t.note || "").replace(/[\r\n]+/g, " ") },
  ];

  const searchPending = searchInput.trim() !== q;

  // ─── Render ───
  const totalIncome = data?.stats.totalIncome || 0;
  const totalExpense = data?.stats.totalExpense || 0;
  const balance = data?.stats.balance || 0;
  const incomeCount = data?.stats.incomeCount || 0;
  const expenseCount = data?.stats.expenseCount || 0;
  const cancelledCount = data?.stats.cancelledCount || 0;
  const cancelledTotal = data?.stats.cancelledTotal || 0;

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
              دفتر القيود الموحّد — ترقيم تسلسلي FIN + سجل تدقيق لكل قيد
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {headerActions}
          <Button variant="outline" size="sm" onClick={() => setShowFilters((s) => !s)} className="lg:hidden">
            <Filter className="h-4 w-4" />
            فلاتر
          </Button>
          <ExportButton
            rows={exportRows ?? []}
            columns={exportColumns}
            filename={`financial-ledger-${new Date().toISOString().slice(0, 10)}`}
            title="دفتر المعاملات المالية"
            disabled={exportLoading || !exportRows || exportRows.length === 0}
            label={exportLoading ? "تحضير التصدير…" : "تصدير"}
          />
          <Button size="sm" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4" />
            قيد جديد
          </Button>
        </div>
      </div>

      {/* بطاقات إحصاء الفلاتر الحالية (من stats الاستجابة) */}
      {loading && !data ? (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[74px] rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard
              icon={TrendingUp}
              label="مداخيل الفلاتر"
              value={formatDA(totalIncome)}
              sub={`${incomeCount} عملية`}
              cls="border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
              icon={TrendingDown}
              label="مصاريف الفلاتر"
              value={formatDA(totalExpense)}
              sub={`${expenseCount} عملية`}
              cls="border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400"
            />
            <StatCard
              icon={Wallet}
              label="صافي الفلاتر"
              value={formatDA(balance)}
              sub={balance < 0 ? "رصيد سالب" : "رصيد النشطة"}
              cls={cn(
                "border-teal-500/30 bg-teal-500/5",
                balance < 0 ? "text-rose-600 dark:text-rose-400" : "text-teal-700 dark:text-teal-400"
              )}
            />
            <StatCard
              icon={XCircle}
              label="ملغاة (خارج الرصيد)"
              value={formatDA(cancelledTotal)}
              sub={`${cancelledCount} عملية`}
              cls={cn(
                cancelledCount > 0
                  ? "border-amber-500/40 bg-amber-500/5 text-amber-600 dark:text-amber-400"
                  : "border-border bg-muted/30 text-muted-foreground"
              )}
            />
          </div>
          <p className="text-[10px] text-muted-foreground px-1">الإحصاءات وفق الفلاتر الحالية — العمليات النشطة فقط.</p>
        </div>
      )}

      {/* بحث موحّد */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="ابحث: اسم، رقم ملف، رقم عملية FIN، مرجع، مبلغ…"
          className="h-11 pr-9 pl-9 bg-card"
        />
        {searchPending ? (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-600 animate-spin" />
        ) : searchInput ? (
          <button
            type="button"
            aria-label="مسح البحث"
            onClick={() => setSearchInput("")}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {/* Filters bar — خادمية */}
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

                {/* Status */}
                <div className="space-y-1">
                  <Label className="text-xs">الحالة</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="نشطة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">نشطة</SelectItem>
                      <SelectItem value="cancelled">ملغاة</SelectItem>
                      <SelectItem value="all">الكل</SelectItem>
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
                      <SelectItem value="bank">تحويل</SelectItem>
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
              </div>

              <div className="flex items-center justify-end mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  disabled={!hasActiveFilters}
                >
                  <X className="h-3.5 w-3.5" />
                  مسح الفلاتر
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* الجدول / البطاقات */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2" aria-busy="true">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-11 w-full rounded-md" />
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
        ) : !data || data.transactions.length === 0 ? (
          <EmptyState hasFilters={hasActiveFilters || !!q} onClear={handleClearFilters} onCreate={handleOpenCreate} />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block max-h-[62vh] overflow-y-auto elegant-scroll">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur-sm z-10">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-xs">
                      <SortHead field="seq" label="رقم العملية" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    </TableHead>
                    <TableHead className="text-xs">
                      <SortHead field="date" label="التاريخ" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    </TableHead>
                    <TableHead className="text-xs">
                      <SortHead field="type" label="النوع" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    </TableHead>
                    <TableHead className="text-xs">
                      <SortHead field="category" label="الفئة" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    </TableHead>
                    <TableHead className="text-xs">
                      <SortHead field="payeeName" label="الجهة" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    </TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">طريقة الدفع</TableHead>
                    <TableHead className="text-xs">
                      <SortHead field="amount" label="المبلغ" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    </TableHead>
                    <TableHead className="text-xs">الحالة</TableHead>
                    <TableHead className="text-xs text-left">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.transactions.map((tx) => {
                    const isCancelled = tx.status === "cancelled";
                    const isIncome = tx.type === "income";
                    return (
                      <TableRow
                        key={tx.id}
                        tabIndex={0}
                        className={cn(
                          "border-border/40 transition-colors cursor-pointer",
                          isCancelled && "opacity-55 hover:opacity-85"
                        )}
                        onClick={() => openDetails(tx.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openDetails(tx.id);
                          }
                        }}
                      >
                        {/* رقم العملية FIN */}
                        <TableCell>
                          {tx.number ? (
                            <span
                              className="font-bold text-teal-700 dark:text-teal-400 text-xs tabular-nums tracking-wide"
                              style={{ fontFamily: "'Courier New', ui-monospace, monospace" }}
                              dir="ltr"
                            >
                              {tx.number}
                            </span>
                          ) : (
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs text-muted-foreground cursor-help">—</span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                قيد قديم — سُجّل قبل تفعيل الترقيم التسلسلي FIN
                              </TooltipContent>
                            </UITooltip>
                          )}
                        </TableCell>
                        {/* التاريخ dd/mm */}
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap tabular-nums" title={formatDate(tx.date)}>
                          {formatDayMonth(tx.date)}
                        </TableCell>
                        {/* النوع */}
                        <TableCell>
                          <Badge
                            className={cn(
                              "text-[10px]",
                              isIncome
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                : "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
                            )}
                          >
                            {typeLabel(tx.type)}
                          </Badge>
                        </TableCell>
                        {/* الفئة */}
                        <TableCell className="text-xs text-foreground whitespace-nowrap">
                          {categoryLabel(tx.category)}
                        </TableCell>
                        {/* الجهة */}
                        <TableCell className="text-xs text-foreground max-w-[160px] xl:max-w-[220px]">
                          <span className="line-clamp-1" title={tx.payeeName || undefined}>
                            {tx.payeeName || "—"}
                          </span>
                        </TableCell>
                        {/* طريقة الدفع */}
                        <TableCell className="text-xs text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                          {paymentMethodLabel(tx.paymentMethod)}
                        </TableCell>
                        {/* المبلغ */}
                        <TableCell className="text-xs font-bold tabular-nums whitespace-nowrap">
                          <span className={cn(isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400", isCancelled && "line-through decoration-2")}>
                            {isIncome ? "+" : "−"}
                            {formatDA(tx.amount)}
                          </span>
                        </TableCell>
                        {/* الحالة */}
                        <TableCell>
                          {isCancelled ? (
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <Badge variant="outline" className="text-[9px] gap-0.5 bg-muted text-muted-foreground border-border cursor-help">
                                    <XCircle className="h-2.5 w-2.5" /> ملغاة
                                  </Badge>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-56 text-xs">
                                <p className="font-bold">عملية ملغاة — خارج الرصيد</p>
                                {tx.cancellationReason && <p>السبب: {tx.cancellationReason}</p>}
                                {tx.cancelledAt && <p>وقت الإلغاء: {formatDateTime(tx.cancelledAt)}</p>}
                                {tx.cancelledByName && <p>ألغاها: {tx.cancelledByName}</p>}
                              </TooltipContent>
                            </UITooltip>
                          ) : (
                            <Badge variant="outline" className="text-[9px] gap-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                              نشطة
                            </Badge>
                          )}
                        </TableCell>
                        {/* الإجراءات */}
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-0.5 justify-end">
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  aria-label="تفاصيل العملية"
                                  onClick={() => openDetails(tx.id)}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">تفاصيل + سجل التدقيق</TooltipContent>
                            </UITooltip>

                            {!isCancelled && (
                              <>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      aria-label="طباعة الإيصال"
                                      onClick={() => {
                                        const win = openReceiptPrint(tx, clubName);
                                        if (win === false) toast.error("فشل فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة");
                                      }}
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
                                      className="h-8 w-8"
                                      aria-label="تعديل"
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
                                      className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                                      aria-label="إلغاء العملية"
                                      onClick={() => {
                                        setCancelTarget(tx);
                                        setCancelReason("");
                                      }}
                                    >
                                      <XCircle className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">إلغاء العملية (تبقى في السجل — لا تدخل في الرصيد)</TooltipContent>
                                </UITooltip>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile stacked cards */}
            <div className="md:hidden divide-y divide-border/50">
              {data.transactions.map((tx) => {
                const isCancelled = tx.status === "cancelled";
                const isIncome = tx.type === "income";
                return (
                  <div
                    key={tx.id}
                    role="button"
                    tabIndex={0}
                    className={cn("p-3 space-y-2 active:bg-muted/40", isCancelled && "opacity-60")}
                    onClick={() => openDetails(tx.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openDetails(tx.id);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {tx.number ? (
                        <span
                          className="font-bold text-teal-700 dark:text-teal-400 text-[11px] tabular-nums"
                          style={{ fontFamily: "'Courier New', ui-monospace, monospace" }}
                          dir="ltr"
                        >
                          {tx.number}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">— قيد قديم</span>
                      )}
                      <span className="text-[11px] text-muted-foreground tabular-nums">{formatDate(tx.date)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("text-base font-extrabold tabular-nums", isCancelled && "line-through decoration-2")}>
                        <span className={isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                          {isIncome ? "+" : "−"}
                          {formatDA(tx.amount)}
                        </span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          className={cn(
                            "text-[10px]",
                            isIncome
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                              : "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
                          )}
                        >
                          {typeLabel(tx.type)}
                        </Badge>
                        {isCancelled && (
                          <Badge variant="outline" className="text-[9px] bg-muted text-muted-foreground border-border">
                            ملغاة
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-foreground font-semibold">{categoryLabel(tx.category)}</span>
                      {tx.payeeName && <span className="line-clamp-1 max-w-full">{tx.payeeName}</span>}
                      <span>• {paymentMethodLabel(tx.paymentMethod)}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-0.5" onClick={(e) => e.stopPropagation()}>
                      <Button variant="outline" size="sm" className="flex-1 h-10 min-h-[44px]" onClick={() => openDetails(tx.id)}>
                        <Eye className="h-4 w-4" />
                        تفاصيل
                      </Button>
                      {!isCancelled && (
                        <>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 min-h-[44px]"
                            aria-label="طباعة الإيصال"
                            onClick={() => {
                              const win = openReceiptPrint(tx, clubName);
                              if (win === false) toast.error("فشل فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة");
                            }}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 min-h-[44px] text-rose-600 border-rose-500/40 hover:bg-rose-500/10"
                            aria-label="إلغاء العملية"
                            onClick={() => {
                              setCancelTarget(tx);
                              setCancelReason("");
                            }}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination footer — خادمية */}
            <div className="border-t border-border bg-muted/30 p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>عرض</span>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="h-7 w-16 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map((s) => (
                      <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span>من أصل <b className="tabular-nums text-foreground">{data.pagination.total}</b> عملية</span>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                  السابق
                </Button>
                <span className="text-xs text-muted-foreground tabular-nums px-2">
                  صفحة {page} من {Math.max(1, data.pagination.totalPages)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
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

      {/* حوار القيد الجديد/التعديل */}
      <FinancialTransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        transaction={editingTx}
        currentBalance={ledgerBalance}
        onSaved={refreshAll}
      />

      {/* حوار تفاصيل العملية + Timeline + الإيصال */}
      <TransactionDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        transactionId={detailsId}
        clubName={clubName}
        onChanged={refreshAll}
      />

      {/* تأكيد الإلغاء الناعم من الصف — سبب إلزامي (نفس نمط wages-section) */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) { setCancelTarget(null); setCancelReason(""); } }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              تأكيد إلغاء العملية
            </AlertDialogTitle>
            <AlertDialogDescription>
              لن تُحذف العملية: تبقى في الدفتر بوضع «ملغاة» وتُستبعد من الرصيد فوراً. الإجراء موثّق في سجل التدقيق.
              {cancelTarget && (
                <span className="block mt-2 text-xs font-semibold text-foreground">
                  {cancelTarget.number || "قيد قديم"} — {typeLabel(cancelTarget.type)} — {categoryLabel(cancelTarget.category)} — {formatDA(cancelTarget.amount)}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">سبب الإلغاء (إلزامي، 3 أحرف على الأقل)</Label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="مثال: خطأ في إدخال المبلغ / عملية مكررة..."
              rows={3}
              disabled={cancelling}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>رجوع</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleCancel(); }}
              disabled={cancelling || cancelReason.trim().length < 3}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {cancelling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري الإلغاء...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  إلغاء العملية
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SortHead — رأس عمود قابل للنقر (فرز خادمي مع سهم الاتجاه)
// ─────────────────────────────────────────────────────────────
function SortHead({
  field,
  label,
  sortField,
  sortDir,
  onSort,
}: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const active = sortField === field;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onSort(field); }}
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-1 transition-colors hover:text-foreground",
        active && "text-foreground font-semibold"
      )}
      aria-label={`فرز حسب ${label}`}
    >
      {label}
      {active ? (
        sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-teal-600" /> : <ArrowDown className="h-3 w-3 text-teal-600" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// StatCard — بطاقة إحصاء مختصرة
// ─────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  cls,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  sub: string;
  cls: string;
}) {
  return (
    <div className={cn("rounded-xl border p-3 flex items-center gap-3 min-w-0", cls)}>
      <div className="rounded-lg bg-background/60 p-2 shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground truncate">{label}</p>
        <p className="text-sm font-extrabold tabular-nums truncate">{value}</p>
        <p className="text-[10px] text-muted-foreground tabular-nums">{sub}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EmptyState — حالة فارغة تصف ما يمكن البحث عنه
// ─────────────────────────────────────────────────────────────
function EmptyState({
  hasFilters,
  onClear,
  onCreate,
}: {
  hasFilters: boolean;
  onClear: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 px-4">
      <div className="rounded-full bg-muted p-4">
        <Inbox className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="font-semibold text-foreground">
        {hasFilters ? "لا توجد نتائج مطابقة" : "الدفتر فارغ"}
      </p>
      {hasFilters ? (
        <>
          <p className="text-xs text-muted-foreground max-w-lg text-center leading-relaxed">
            يمكنك البحث عن: اسم الجهة، رقم ملف المنخرط، اسم العامل، رقم العملية (FIN-…)،
            المرجع، نص الملاحظات، أو المبلغ الرقمي — أو عدّل الفلاتر.
          </p>
          <Button variant="outline" size="sm" onClick={onClear}>
            <X className="h-3.5 w-3.5" />
            مسح الفلاتر والبحث
          </Button>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground max-w-md text-center">
            ابدأ بتسجيل أول قيد مالي — كل مدخول ومصروف يُرقّم تلقائياً FIN-سنة-رقم.
          </p>
          <Button size="sm" onClick={onCreate}>
            <Plus className="h-3.5 w-3.5" />
            قيد جديد
          </Button>
        </>
      )}
    </div>
  );
}

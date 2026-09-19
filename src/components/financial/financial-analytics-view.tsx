"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PieChart as PieChartIcon, TrendingUp, TrendingDown, Wallet, ShieldCheck,
  Building2, Users, RefreshCw, Layers, ArrowUpRight, ArrowDownRight,
  Filter, CheckCircle2, ChevronLeft, CreditCard, Banknote, Calendar,
  Download, Eye, ArrowRightLeft, FileSpreadsheet, Loader2, Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ExportButton } from "@/components/shared/export-button";
import { TransactionDetailsDialog } from "@/components/financial/transaction-details-dialog";
import { onFinancialUpdated } from "@/lib/financial-events";

interface MethodStat {
  method: string;
  amount: number;
  count: number;
}

interface CategoryRow {
  key: string;
  label: string;
  amount: number;
  count: number;
  percentage: number;
  methods: MethodStat[];
}

interface DrillDownData {
  category: string;
  label: string;
  totalAmount: number;
  totalCount: number;
  bySubscriptionType: Array<{ type: string; count: number; amount: number }>;
  transactions: Array<{
    id: string;
    seq: number | null;
    number: string;
    type: string;
    category: string;
    amount: number;
    date: string;
    payeeName: string | null;
    paymentMethod: string;
    reference: string | null;
    note: string | null;
    subscriberFileNumber?: string | null;
    subscriptionType?: string | null;
  }>;
}

interface AnalyticsPayload {
  period: string;
  totalIncome: number;
  totalExpense: number;
  netCash: number;
  incomeTransactionsCount: number;
  expenseTransactionsCount: number;
  incomeCategories: CategoryRow[];
  expenseCategories: CategoryRow[];
  categoryDetails?: DrillDownData | null;
}

const PERIODS = [
  { key: "all", label: "كامل الدفتر (تاريخي)" },
  { key: "month", label: "هذا الشهر" },
  { key: "week", label: "هذا الأسبوع" },
  { key: "today", label: "اليوم" },
  { key: "year", label: "هذه السنة" },
];

export function FinancialAnalyticsView({ role }: { role: string }) {
  const [period, setPeriod] = useState("all");
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Drill-down State
  const [activeDrillDownCategory, setActiveDrillDownCategory] = useState<string | null>(null);
  const [drillDownData, setDrillDownData] = useState<DrillDownData | null>(null);
  const [drillDownLoading, setDrillDownLoading] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);

  const fetchData = useCallback(async (isSilent = false) => {
    if (isSilent) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch(`/api/financial/analytics?period=${period}`, { cache: "no-store" });
      if (!res.ok) throw new Error("فشل تحميل بيانات التحليل المالي");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      toast.error(err.message || "خطأ أثناء جلب التحليل المالي");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => onFinancialUpdated(() => fetchData(true)), [fetchData]);

  // Handle drill down into a category
  const openCategoryDrillDown = async (categoryKey: string) => {
    setActiveDrillDownCategory(categoryKey);
    setDrillDownLoading(true);
    try {
      const res = await fetch(`/api/financial/analytics?period=${period}&category=${categoryKey}`, { cache: "no-store" });
      if (!res.ok) throw new Error("تعذر جلب تفاصيل الصنف");
      const json = await res.json();
      setDrillDownData(json.categoryDetails);
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء فتح تفاصيل الصنف");
    } finally {
      setDrillDownLoading(false);
    }
  };

  const incomeSum = data?.incomeCategories.reduce((acc, c) => acc + c.amount, 0) ?? 0;
  const expenseSum = data?.expenseCategories.reduce((acc, c) => acc + c.amount, 0) ?? 0;
  const incomeBalanced = data ? incomeSum === data.totalIncome : true;
  const expenseBalanced = data ? expenseSum === data.totalExpense : true;

  // Export rows for Detailed Financial Analysis
  const exportRows = [
    ...(data?.incomeCategories.map((c) => ({
      type: "مدخول",
      category: c.label,
      amount: `${c.amount.toLocaleString()} دج`,
      percentage: `${c.percentage}%`,
      count: c.count,
    })) || []),
    ...(data?.expenseCategories.map((c) => ({
      type: "مصروف",
      category: c.label,
      amount: `${c.amount.toLocaleString()} دج`,
      percentage: `${c.percentage}%`,
      count: c.count,
    })) || []),
  ];

  return (
    <div dir="rtl" className="space-y-6">
      {/* ═══ Header ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card border border-border/70 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
              <PieChartIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-foreground">التحليل المالي التفصيلي</h3>
              <p className="text-xs text-muted-foreground">
                من أين جاءت الأموال؟ وأين صُرفت؟ ومصدر كل مبلغ بدقة 100% من دفتر العمليات
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period selector */}
          <div className="flex items-center bg-muted/70 border border-border/60 rounded-xl p-1 text-xs">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-bold transition-all",
                  period === p.key
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <ExportButton
            rows={exportRows}
            columns={[
              { key: "type", label: "النوع" },
              { key: "category", label: "الصنف" },
              { key: "amount", label: "المبلغ" },
              { key: "percentage", label: "النسبة" },
              { key: "count", label: "عدد العمليات" },
            ]}
            filename={`التحليل-المالي-${period}`}
            title="تقرير التحليل المالي التفصيلي — AquaCore"
            disabled={loading || exportRows.length === 0}
            label="تصدير التحليل"
          />

          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="h-8 gap-1 text-xs"
          >
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            تحديث
          </Button>
        </div>
      </div>

      {/* ═══ Summary Cards (Guaranteed 100% Match) ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Total Income */}
        <Card className="border-emerald-500/30 bg-emerald-500/5 rounded-near-md elevation-1 hover:elevation-2 motion-fast transition-all">
          <CardHeader className="pb-1 pt-3.5 px-4 flex flex-row items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">إجمالي المداخيل المحصلة</span>
            <ArrowDownRight className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {loading ? (
              <div className="h-8 w-32 shimmer-placeholder rounded-near-xs" />
            ) : (
              <>
                <div className="text-2xl font-mono-data font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {(data?.totalIncome ?? 0).toLocaleString()} <span className="text-xs font-normal">دج</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  <span>{data?.incomeTransactionsCount ?? 0} عملية قبض مسجلة بالدفتر</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Total Expense */}
        <Card className="border-rose-500/30 bg-rose-500/5 rounded-near-md elevation-1 hover:elevation-2 motion-fast transition-all">
          <CardHeader className="pb-1 pt-3.5 px-4 flex flex-row items-center justify-between">
            <span className="text-xs font-bold text-rose-800 dark:text-rose-300">إجمالي المصاريف المسددة</span>
            <ArrowUpRight className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {loading ? (
              <div className="h-8 w-32 shimmer-placeholder rounded-near-xs" />
            ) : (
              <>
                <div className="text-2xl font-mono-data font-black text-rose-700 dark:text-rose-400 tabular-nums">
                  {(data?.totalExpense ?? 0).toLocaleString()} <span className="text-xs font-normal">دج</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-rose-800/80 dark:text-rose-300/80">
                  <CheckCircle2 className="h-3 w-3 text-rose-600" />
                  <span>{data?.expenseTransactionsCount ?? 0} عملية صرف مسجلة بالدفتر</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Net Cash Flow */}
        <Card className="border-teal-500/30 bg-teal-500/5 rounded-near-md elevation-1 hover:elevation-2 motion-fast transition-all">
          <CardHeader className="pb-1 pt-3.5 px-4 flex flex-row items-center justify-between">
            <span className="text-xs font-bold text-teal-800 dark:text-teal-300">صافي التدفق المالي للفترة</span>
            <Wallet className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {loading ? (
              <div className="h-8 w-32 shimmer-placeholder rounded-near-xs" />
            ) : (
              <>
                <div className="text-2xl font-mono-data font-black text-teal-700 dark:text-teal-400 tabular-nums">
                  {(data?.netCash ?? 0).toLocaleString()} <span className="text-xs font-normal">دج</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  المداخيل − المصاريف (الرصيد الفعلي المتحقق)
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ Detailed Income Breakdown ═══ */}
      <Card className="border-border/80 rounded-near-lg elevation-1">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                تحليل مصادر المداخيل (من أين جاءت الأموال؟)
              </CardTitle>
              <CardDescription className="text-xs">
                تقسيم محاسبي كامل للمداخيل — انقر على أي صنف للتفصيل والوصول للعملية المالية الأصلية
              </CardDescription>
            </div>
            <Badge variant="outline" className={cn("text-xs gap-1 py-1 font-bold", incomeBalanced ? "border-emerald-500/50 text-emerald-700 bg-emerald-500/10" : "border-rose-500 text-rose-700")}>
              <CheckCircle2 className="h-3 w-3" />
              {incomeBalanced ? "مجموع الأصناف = الإجمالي تماماً (100%)" : "فارق في المجموع"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : data?.incomeCategories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              لا توجد عمليات قبض مسجلة في هذه الفترة
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data?.incomeCategories.map((cat) => (
                <div
                  key={cat.key}
                  onClick={() => openCategoryDrillDown(cat.key)}
                  className="rounded-near-md border border-border/70 hover:border-emerald-500/50 hover:bg-emerald-500/5 motion-fast transition-all p-3.5 cursor-pointer group space-y-2 elevation-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-near-xs bg-emerald-500/15 text-emerald-600 flex items-center justify-center font-bold text-xs">
                        {cat.key === "subscription" ? "📋" : cat.key === "renewal" ? "🔄" : cat.key === "insurance" ? "🛡️" : cat.key === "compound" || cat.key === "compound_rights" ? "🏛️" : "💰"}
                      </div>
                      <div>
                        <h4 className="font-black text-xs sm:text-sm text-foreground group-hover:text-emerald-700 transition">
                          {cat.label}
                        </h4>
                        <span className="text-[11px] text-muted-foreground">{cat.count} عملية قبض</span>
                      </div>
                    </div>

                    <div className="text-left">
                      <div className="font-mono-data font-bold text-sm sm:text-base text-foreground tabular-nums">
                        {cat.amount.toLocaleString()} <span className="text-xs font-normal">دج</span>
                      </div>
                      <Badge variant="secondary" className="rounded-near-xs text-[10px] font-bold px-1.5 py-0">
                        {cat.percentage}% من المداخيل
                      </Badge>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <Progress value={cat.percentage} className="h-2 rounded-near-xs bg-emerald-950/10 dark:bg-emerald-500/10" />
                  </div>

                  {/* Methods breakdown chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] text-muted-foreground">
                    {cat.methods.map((m) => (
                      <span key={m.method} className="bg-muted px-2 py-0.5 rounded-near-xs font-mono-data">
                        {m.method === "cash" ? "نقدي" : m.method === "bank" ? "بنك" : "شيك"}: {m.amount.toLocaleString()} دج ({m.count})
                      </span>
                    ))}
                    <span className="mr-auto text-emerald-600 font-bold group-hover:underline inline-flex items-center gap-0.5">
                      تفاصيل العمليات ←
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ Detailed Expense Breakdown ═══ */}
      <Card className="border-border/80 rounded-near-lg elevation-1">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-rose-600" />
                تحليل المصاريف (أين صُرفت الأموال؟)
              </CardTitle>
              <CardDescription className="text-xs">
                الأجور، الصيانة، المشتريات، الخدمات، والمصاريف الإدارية — كل مصروف مرتبط بعملية مالية
              </CardDescription>
            </div>
            <Badge variant="outline" className={cn("text-xs gap-1 py-1 font-bold", expenseBalanced ? "border-rose-500/50 text-rose-700 bg-rose-500/10" : "border-rose-500 text-rose-700")}>
              <CheckCircle2 className="h-3 w-3" />
              {expenseBalanced ? "مجموع الأصناف = إجمالي المصاريف تماماً (100%)" : "فارق في المجموع"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 w-full shimmer-placeholder rounded-near-md" />
              ))}
            </div>
          ) : data?.expenseCategories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              لا توجد عمليات صرف مسجلة في هذه الفترة
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data?.expenseCategories.map((cat) => (
                <div
                  key={cat.key}
                  onClick={() => openCategoryDrillDown(cat.key)}
                  className="rounded-near-md border border-border/70 hover:border-rose-500/50 hover:bg-rose-500/5 motion-fast transition-all p-3.5 cursor-pointer group space-y-2 elevation-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-near-xs bg-rose-500/15 text-rose-600 flex items-center justify-center font-bold text-xs">
                        {cat.key === "wages" ? "👥" : cat.key === "maintenance" ? "🔧" : cat.key === "equipment" || cat.key === "purchases" ? "📦" : cat.key === "administrative" || cat.key === "office_supplies" ? "📑" : "💸"}
                      </div>
                      <div>
                        <h4 className="font-black text-xs sm:text-sm text-foreground group-hover:text-rose-700 transition">
                          {cat.label}
                        </h4>
                        <span className="text-[11px] text-muted-foreground">{cat.count} عملية صرف</span>
                      </div>
                    </div>

                    <div className="text-left">
                      <div className="font-mono-data font-bold text-sm sm:text-base text-foreground tabular-nums">
                        {cat.amount.toLocaleString()} <span className="text-xs font-normal">دج</span>
                      </div>
                      <Badge variant="secondary" className="rounded-near-xs text-[10px] font-bold px-1.5 py-0">
                        {cat.percentage}% من المصاريف
                      </Badge>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <Progress value={cat.percentage} className="h-2 rounded-near-xs bg-rose-950/10 dark:bg-rose-500/10" />
                  </div>

                  {/* Methods breakdown chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] text-muted-foreground">
                    {cat.methods.map((m) => (
                      <span key={m.method} className="bg-muted px-2 py-0.5 rounded-near-xs font-mono-data">
                        {m.method === "cash" ? "نقدي" : m.method === "bank" ? "بنك" : "شيك"}: {m.amount.toLocaleString()} دج ({m.count})
                      </span>
                    ))}
                    <span className="mr-auto text-rose-600 font-bold group-hover:underline inline-flex items-center gap-0.5">
                      تفاصيل العمليات ←
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ Drill-Down Dialog: Category -> Source -> Original FinancialTransaction ═══ */}
      <Dialog open={Boolean(activeDrillDownCategory)} onOpenChange={(open) => !open && setActiveDrillDownCategory(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-4 sm:p-6" dir="rtl">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base sm:text-lg font-black flex items-center gap-2">
                <Layers className="h-5 w-5 text-teal-600" />
                تفاصيل الصنف: {drillDownData?.label || activeDrillDownCategory}
              </DialogTitle>
              {drillDownData && (
                <Badge className="bg-teal-600 text-white font-black text-xs px-3 py-1">
                  إجمالي الصنف: {drillDownData.totalAmount.toLocaleString()} دج ({drillDownData.totalCount} عملية)
                </Badge>
              )}
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              المسار: الإجمالي ← الصنف ← مصدر المبلغ ← العملية المالية الأصلية
            </DialogDescription>
          </DialogHeader>

          {drillDownLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin text-teal-600" />
              <p className="text-xs">جاري جلب القيود المالية الأصلية...</p>
            </div>
          ) : drillDownData ? (
            <div className="flex-1 overflow-y-auto space-y-4 py-2">
              {/* Subscription Types breakdown if available */}
              {drillDownData.bySubscriptionType.length > 0 && (
                <div className="rounded-near-md border border-border/70 bg-muted/30 p-3 space-y-2">
                  <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-teal-600" /> التوزيع حسب نوع الاشتراك
                  </h5>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {drillDownData.bySubscriptionType.map((st) => (
                      <div key={st.type} className="rounded-near-sm bg-card border p-2 text-xs">
                        <div className="text-muted-foreground text-[11px] truncate">{st.type}</div>
                        <div className="font-mono-data font-bold text-foreground tabular-nums">{st.amount.toLocaleString()} دج</div>
                        <div className="text-[10px] text-muted-foreground font-mono-data">{st.count} مشترك</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Underlying Financial Transactions List */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>العمليات المالية الأصلية ({drillDownData.transactions.length})</span>
                  <span className="text-[10px] text-muted-foreground">انقر على أي عملية لعرض تفاصيلها وسندها</span>
                </h5>

                <div className="space-y-1.5">
                  {drillDownData.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      onClick={() => setSelectedTxId(tx.id)}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-near-md border border-border/70 hover:border-teal-500/50 hover:bg-accent/40 motion-fast transition-all cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono-data text-[11px] font-bold text-muted-foreground shrink-0">
                          {tx.number}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-foreground truncate">
                            {tx.payeeName || (tx.subscriberFileNumber ? `منخرط #${tx.subscriberFileNumber}` : "جهة غير مسماة")}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate font-mono-data">
                            {new Date(tx.date).toLocaleDateString("ar-DZ")} • {tx.paymentMethod === "cash" ? "نقدي" : tx.paymentMethod === "bank" ? "بنك" : "شيك"} {tx.note ? `• ${tx.note}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <span className="font-mono-data font-bold text-xs sm:text-sm tabular-nums text-foreground">
                          {tx.amount.toLocaleString()} دج
                        </span>
                        <div className="text-[10px] text-teal-600 font-bold flex items-center gap-0.5 justify-end">
                          <Eye className="h-3 w-3" /> عرض القيد
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Transaction Details Dialog */}
      <TransactionDetailsDialog
        transactionId={selectedTxId}
        open={Boolean(selectedTxId)}
        onOpenChange={(open) => !open && setSelectedTxId(null)}
        onChanged={() => fetchData(true)}
      />
    </div>
  );
}

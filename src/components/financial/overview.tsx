"use client";

/**
 * FinancialOverview — لوحة القيادة المالية (نظرة عامة)
 * ═════════════════════════════════════════════════════════════
 * القلب التحليلي للمركز المالي — بخبرة تسيير مالي:
 *   1) بطاقات الرصيد العام (داخل/خارج/رصيد/مستحقات/التزامات مدفوعة)
 *   1-b) إيرادات المنخرطين — نفس أرقام لوحة التحكم (رسوم الاشتراكات/التأمين/المركب/الإيرادات)
 *        عبر DashboardRevenueBlock الذي يستدعي /api/stats — نفس مصدر لوحة التحكم حرفياً
 *   2) بطاقات الدورة المالية الذكية (تسجيلات/أعباء/تسديدات) بأرقام حية
 *   3) مؤشرات KPI بمقارنة الشهر السابق (نسب التغير)
 *   4) التدفق النقدي 6 أشهر + توزيع المداخيل والأعباء (دونات)
 *   5) طرق الدفع + مؤشرات ذكية (نسبة الأعباء، تغطية الرصيد، توقع الشهر)
 *   6) أكبر المصاريف + آخر القيود
 *
 * كل الأرقام من /api/financial/dashboard — المصدر: دفتر التسديدات.
 */

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  UserPlus, ReceiptText, ArrowRightLeft, TrendingUp, TrendingDown,
  Activity, Wallet, CalendarDays, PiggyBank, Gauge, Loader2,
  RefreshCw, AlertTriangle, ChevronLeft, Inbox, Landmark, Banknote, ScrollText,
  ArrowDownCircle, ArrowUpCircle, Hourglass, BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { DashboardRevenueBlock } from "@/components/financial/dashboard-revenue";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface OverviewData {
  balance: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    incomeByCategory: Record<string, number>;
    expenseByCategory: Record<string, number>;
  };
  lastTransactions: Array<{
    id: string;
    type: "income" | "expense";
    category: string;
    amount: number;
    date: string;
    payeeName?: string | null;
  }>;
  monthlyComparison: {
    thisMonthIncome: number;
    lastMonthIncome: number;
    thisMonthExpense: number;
    lastMonthExpense: number;
    incomeChangePct: number;
    expenseChangePct: number;
    netThisMonth: number;
  };
  topExpenses: Array<{
    id: string;
    category: string;
    amount: number;
    date: string;
    payeeName?: string | null;
    note?: string | null;
  }>;
  periodIncome: { today: number; week: number; month: number; year: number };
  chartData: Array<{ month: string; income: number; expense: number }>;
  /** المستحقات (من نفس API اللوحة) */
  dues?: Record<string, { label: string; collected: number; paid: number; remaining: number }>;
  duesTotalRemaining?: number;
  monthIncomeByCategory: Record<string, number>;
  monthExpenseByCategory: Record<string, number>;
  paymentMethods: Array<{ method: string; amount: number; count: number }>;
  movementsThisMonth: number;
}

export type OverviewNavSection = "overview" | "transactions" | "reports";

interface FinancialOverviewProps {
  onNavigateSection?: (section: OverviewNavSection, ledgerType?: "income" | "expense") => void;
}

// ─────────────────────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  subscription: "تسجيل اشتراك",
  renewal: "تجديد اشتراك",
  insurance: "تأمين",
  compound: "حقوق المركب",
  other_income: "مدخول آخر",
  wages: "أجور عمال",
  compound_rights: "حقوق المركب (مصروف)",
  office_supplies: "لوازم مكتبية",
  other_expense: "مصروف آخر",
};

const METHOD_LABELS: Record<string, string> = {
  cash: "نقدي",
  bank: "تحويل بنكي",
  cheque: "شيك",
};

const DONUT_COLORS = ["#14b8a6", "#10b981", "#f59e0b", "#f43f5e", "#a855f7", "#06b6d4", "#84cc16", "#ec4899"];

function formatDA(n: number): string {
  return new Intl.NumberFormat("fr-DZ").format(Math.round(n)) + " دج";
}

function formatShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "م";
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + "ك";
  return String(Math.round(n));
}

function formatDate(s: string): string {
  try {
    return new Date(s).toLocaleDateString("ar-DZ", { day: "2-digit", month: "2-digit" });
  } catch {
    return s;
  }
}

function sumCategories(map: Record<string, number>, keys: string[]): number {
  return keys.reduce((s, k) => s + (map[k] || 0), 0);
}

function topCategory(map: Record<string, number>): { key: string; label: string; amount: number } | null {
  let best: { key: string; amount: number } | null = null;
  for (const [k, v] of Object.entries(map)) {
    if (!best || v > best.amount) best = { key: k, amount: v };
  }
  return best ? { key: best.key, label: CATEGORY_LABELS[best.key] || best.key, amount: best.amount } : null;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export function FinancialOverview({ onNavigateSection }: FinancialOverviewProps) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/financial/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل تحميل البيانات المالية");
      toast.error("تعذر تحميل المعطيات المالية");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // تحديث ذكي عند رجوع التركيز للنافذة
    const onFocus = () => fetchData(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchData]);

  if (loading) return <OverviewSkeleton />;
  if (error || !data) {
    return (
      <Card className="border-rose-300/50 bg-rose-500/5">
        <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
          <AlertTriangle className="h-8 w-8 text-rose-500" />
          <p className="text-sm font-bold text-rose-700 dark:text-rose-300">تعذر تحميل البيانات المالية</p>
          <Button size="sm" variant="outline" onClick={() => fetchData()}>
            <RefreshCw className="h-4 w-4" /> إعادة المحاولة
          </Button>
        </CardContent>
      </Card>
    );
  }

  const mc = data.monthlyComparison;
  const monthIncome = mc.thisMonthIncome;
  const monthExpense = mc.thisMonthExpense;

  // بطاقات الدورة المالية — أرقام حية من الدفتر
  const registrations = sumCategories(data.monthIncomeByCategory, ["renewal", "subscription"]);
  const insTotal = sumCategories(data.monthIncomeByCategory, ["insurance"]);
  const compoundTotal = sumCategories(data.monthIncomeByCategory, ["compound"]);
  const chargesTop = topCategory(data.monthExpenseByCategory);

  // المؤشرات الذكية
  const now = new Date();
  const daysElapsed = now.getDate();
  const daysTotal = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const chargeRatio = monthIncome > 0 ? (monthExpense / monthIncome) * 100 : monthExpense > 0 ? 100 : 0;
  const avgDailyIncome = monthIncome / daysElapsed;
  const monthForecast = avgDailyIncome * daysTotal;
  const expenseCoverage = monthExpense > 0 ? data.balance.balance / monthExpense : 0;

  const incomeDonut = Object.entries(data.monthIncomeByCategory)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ key: k, label: CATEGORY_LABELS[k] || k, value: v }));
  const expenseDonut = Object.entries(data.monthExpenseByCategory)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ key: k, label: CATEGORY_LABELS[k] || k, value: v }));

  const chartData = data.chartData.map((c) => ({
    ...c,
    net: c.income - c.expense,
  }));

  return (
    <div className="space-y-4">
      {/* ═══ 0) بطاقات الرصيد العام — نظام محاسبي حقيقي ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        <BalanceCard icon={ArrowDownCircle} label="إجمالي الأموال الداخلة" value={formatDA(data.balance.totalIncome)} tone="emerald" />
        <BalanceCard icon={ArrowUpCircle} label="إجمالي الأموال الخارجة" value={formatDA(data.balance.totalExpense)} tone="rose" />
        <BalanceCard
          icon={Landmark}
          label="الرصيد الحالي"
          value={formatDA(data.balance.balance)}
          tone={data.balance.balance < 0 ? "rose" : "teal"}
          strong
        />
        <BalanceCard
          icon={Hourglass}
          label="المبالغ المستحقة"
          value={formatDA(data.duesTotalRemaining ?? 0)}
          tone={(data.duesTotalRemaining ?? 0) > 0 ? "amber" : "emerald"}
          onClick={() => onNavigateSection?.("dues" as OverviewNavSection)}
          cta="فتح المستحقات"
        />
        <BalanceCard
          icon={BadgeCheck}
          label="المبالغ المدفوعة (التزامات)"
          value={formatDA((data.dues?.insurance.paid ?? 0) + (data.dues?.compound.paid ?? 0) + (data.dues?.wages.paid ?? 0))}
          tone="slate"
        />
      </div>

      {/* ═══ 0-b) إيرادات المنخرطين — نفس أرقام لوحة التحكم (نفس المصدر /api/stats) ═══ */}
      <DashboardRevenueBlock
        ledger={{
          subscriptions: (data.balance.incomeByCategory.subscription || 0) + (data.balance.incomeByCategory.renewal || 0),
          insurance: data.balance.incomeByCategory.insurance || 0,
          compound: data.balance.incomeByCategory.compound || 0,
        }}
      />

      {/* ═══ 1) بطاقات الدورة المالية الذكية ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ConceptCard
          icon={UserPlus}
          title="التسجيلات"
          subtitle="اشتراكات وتجديدات المنخرطين — تُرحَّل تلقائياً من التجديد إلى الدفتر"
          value={formatDA(registrations)}
          detail={`تأمين ${formatShort(insTotal)} • مركب ${formatShort(compoundTotal)}`}
          tone="emerald"
          cta="عرض في الدفتر"
          onClick={() => onNavigateSection?.("transactions", "income")}
        />
        <ConceptCard
          icon={ReceiptText}
          title="الأعباء"
          subtitle="أجور العمال، اللوازم والمصاريف التشغيلية للنادي"
          value={formatDA(monthExpense)}
          detail={chargesTop ? `أعلى بند: ${chargesTop.label} (${formatShort(chargesTop.amount)})` : "لا مصاريف بعد"}
          tone="amber"
          cta="عرض المصاريف في الدفتر"
          onClick={() => onNavigateSection?.("transactions", "expense")}
        />
        <ConceptCard
          icon={ArrowRightLeft}
          title="التسديدات"
          subtitle="دفتر الحركة المالية الكامل — قبض وصرف بفلاتره"
          value={`${data.movementsThisMonth} حركة`}
          detail={`صافي الشهر: ${formatShort(mc.netThisMonth)} دج`}
          tone="teal"
          cta="فتح الدفتر"
          onClick={() => onNavigateSection?.("transactions")}
        />
      </div>

      {/* ═══ 2) مؤشرات KPI بمقارنة الشهر السابق ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Wallet} label="قبض اليوم" value={formatDA(data.periodIncome.today)} tone="teal" hint={`هذا الأسبوع: ${formatShort(data.periodIncome.week)} دج`} />
        <KpiCard
          icon={TrendingUp} label="مداخيل الشهر" value={formatDA(monthIncome)} tone="emerald"
          delta={mc.incomeChangePct} deltaGoodWhenPositive
          hint={`الشهر الماضي: ${formatShort(mc.lastMonthIncome)} دج`}
        />
        <KpiCard
          icon={TrendingDown} label="أعباء الشهر" value={formatDA(monthExpense)} tone="rose"
          delta={mc.expenseChangePct} deltaGoodWhenPositive={false}
          hint={`الشهر الماضي: ${formatShort(mc.lastMonthExpense)} دج`}
        />
        <KpiCard
          icon={Activity} label="صافي الشهر" value={formatDA(mc.netThisMonth)}
          tone={mc.netThisMonth >= 0 ? "emerald" : "rose"}
          hint={mc.netThisMonth >= 0 ? "فائض يُعاد استثماره ✓" : "عجز — راقب الأعباء"}
        />
      </div>

      {/* ═══ 3) التدفق النقدي + مداخيل الشهر ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gauge className="h-4 w-4 text-teal-600" /> التدفق النقدي — آخر 6 أشهر
            </CardTitle>
            <CardDescription className="text-[11px]">مداخيل مقابل أعباء + خط الصافي (بالدينار)</CardDescription>
          </CardHeader>
          <CardContent className="h-64 pr-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={0} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatShort(Number(v))} width={52} />
                <Tooltip
                  formatter={(value, name) => [
                    formatDA(Number(value)),
                    name === "income" ? "مداخيل" : name === "expense" ? "أعباء" : "الصافي",
                  ]}
                  contentStyle={{ direction: "rtl", borderRadius: 12, fontSize: 12, border: "1px solid #e2e8f0" }}
                />
                <Bar dataKey="income" name="income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={26} />
                <Bar dataKey="expense" name="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={26} />
                <Line type="monotone" dataKey="net" name="net" stroke="#14b8a6" strokeWidth={2.5} dot={{ r: 3, fill: "#14b8a6" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <CategoryDonutCard
          title="مداخيل الشهر حسب الفئة"
          items={incomeDonut}
          total={monthIncome}
          emptyText="لا مداخيل مسجّلة هذا الشهر"
        />
      </div>

      {/* ═══ 4) الأعباء + طرق الدفع ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <CategoryDonutCard
          title="الأعباء (مصاريف) الشهر حسب الفئة"
          items={expenseDonut}
          total={monthExpense}
          emptyText="لا مصاريف مسجّلة هذا الشهر"
        />

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Banknote className="h-4 w-4 text-teal-600" /> طرق الدفع — هذا الشهر
            </CardTitle>
            <CardDescription className="text-[11px]">توزيع الحركة المالية حسب وسيلة التحصيل</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.paymentMethods.length === 0 ? (
              <EmptyHint text="لا حركات هذا الشهر" />
            ) : (
              (() => {
                const totalMethods = data.paymentMethods.reduce((s, m) => s + m.amount, 0) || 1;
                return [...data.paymentMethods]
                  .sort((a, b) => b.amount - a.amount)
                  .map((m) => {
                    const pct = Math.round((m.amount / totalMethods) * 100);
                    return (
                      <div key={m.method} className="space-y-1">
                        <div className="flex items-center justify-between text-xs gap-2">
                          <span className="font-bold">{METHOD_LABELS[m.method] || m.method}</span>
                          <span className="tabular-nums text-muted-foreground truncate">
                            {formatDA(m.amount)} • {m.count} عملية • {pct}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              m.method === "cash" && "bg-teal-500",
                              m.method === "bank" && "bg-emerald-500",
                              m.method !== "cash" && m.method !== "bank" && "bg-amber-500"
                            )}
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                      </div>
                    );
                  });
              })()
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ 5) المؤشرات الذكية ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <InsightTile
          icon={Gauge}
          title="نسبة الأعباء من المداخيل"
          main={monthIncome > 0 ? `${Math.round(chargeRatio)}%` : "—"}
          progress={Math.min(chargeRatio, 100)}
          tone={chargeRatio <= 70 ? "ok" : chargeRatio <= 90 ? "warn" : "danger"}
          note={chargeRatio <= 70 ? "توازن صحي ✓" : chargeRatio <= 90 ? "مراقبة مستحبة" : "خطر — الأعباء تلتهم المداخيل"}
        />
        <InsightTile
          icon={CalendarDays}
          title="متوسط المدخول اليومي"
          main={formatDA(avgDailyIncome)}
          note={`على ${daysElapsed} يوم من أصل ${daysTotal} يوم`}
        />
        <InsightTile
          icon={TrendingUp}
          title="توقع مداخيل نهاية الشهر"
          main={formatDA(monthForecast)}
          note="بإيقاع التحصيل الحالي"
        />
        <InsightTile
          icon={PiggyBank}
          title="تغطية الرصيد للأعباء"
          main={monthExpense > 0 ? `${expenseCoverage.toFixed(1)} شهر` : "—"}
          tone={expenseCoverage >= 3 ? "ok" : expenseCoverage >= 1 ? "warn" : "danger"}
          note={
            monthExpense > 0
              ? expenseCoverage >= 3
                ? "احتياطي مريح ✓"
                : expenseCoverage >= 1
                  ? "احتياطي محدود"
                  : "احتياطي حرج — أقل من شهر"
              : "سجّل الأعباء لحساب التغطية"
          }
        />
      </div>

      {/* ═══ 6) أكبر المصاريف + آخر القيود ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-rose-500" /> أكبر المصاريف
            </CardTitle>
            <CardDescription className="text-[11px]">أعلى 5 دفعات صرف في سجل النادي</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.topExpenses.length === 0 ? (
              <EmptyHint text="لا مصاريف مسجّلة بعد" />
            ) : (
              data.topExpenses.map((t, i) => (
                <div key={t.id} className="flex items-center gap-2.5 rounded-xl border border-border/60 p-2.5">
                  <span className={cn(
                    "h-6 w-6 shrink-0 rounded-lg text-[11px] font-extrabold flex items-center justify-center",
                    i === 0 ? "bg-rose-500/15 text-rose-600" : "bg-muted text-muted-foreground"
                  )}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">{CATEGORY_LABELS[t.category] || t.category}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {t.payeeName || t.note || "—"} • {formatDate(t.date)}
                    </p>
                  </div>
                  <span className="text-sm font-extrabold tabular-nums text-rose-600 shrink-0">
                    {formatDA(t.amount)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ScrollText className="h-4 w-4 text-teal-600" /> آخر القيود المحاسبية
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                className="text-teal-700 dark:text-teal-300 h-7 px-2 text-[11px]"
                onClick={() => onNavigateSection?.("transactions")}
              >
                فتح الدفتر <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
            </div>
            <CardDescription className="text-[11px]">أحدث 10 حركات من دفتر التسديدات</CardDescription>
          </CardHeader>
          <CardContent>
            {data.lastTransactions.length === 0 ? (
              <EmptyHint text="لا حركات بعد — سجّل أول قيد من الدفتر" />
            ) : (
              <div className="divide-y divide-border/60">
                {data.lastTransactions.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 py-2">
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      t.type === "income" ? "bg-emerald-500" : "bg-rose-500"
                    )} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate">
                        {CATEGORY_LABELS[t.category] || t.category}
                        {t.payeeName ? <span className="font-normal text-muted-foreground"> — {t.payeeName}</span> : null}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(t.date)}</p>
                    </div>
                    <span className={cn(
                      "text-xs font-extrabold tabular-nums shrink-0",
                      t.type === "income" ? "text-emerald-600" : "text-rose-600"
                    )}>
                      {t.type === "income" ? "+" : "−"}{formatDA(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* قراءة ختامية ذكية */}
      <SmartFooterNote registrations={registrations} monthIncome={monthIncome} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────
const TONES = {
  emerald: { chip: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400", border: "border-t-emerald-500", cta: "text-emerald-700 dark:text-emerald-300" },
  amber: { chip: "bg-amber-500/12 text-amber-600 dark:text-amber-400", border: "border-t-amber-500", cta: "text-amber-700 dark:text-amber-300" },
  teal: { chip: "bg-teal-500/12 text-teal-600 dark:text-teal-400", border: "border-t-teal-500", cta: "text-teal-700 dark:text-teal-300" },
} as const;

// ─────────────────────────────────────────────────────────────
// بطاقة الرصيد العام (الجزء العلوي — نظام محاسبي)
// ─────────────────────────────────────────────────────────────
function BalanceCard({ icon: Icon, label, value, tone, strong, onClick, cta }: {
  icon: typeof Wallet;
  label: string;
  value: string;
  tone: "emerald" | "rose" | "teal" | "amber" | "slate";
  strong?: boolean;
  onClick?: () => void;
  cta?: string;
}) {
  const tones: Record<string, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
    rose: "border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300",
    teal: "border-teal-500/30 bg-teal-500/5 text-teal-700 dark:text-teal-300",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
    slate: "border-border/60 bg-card text-foreground",
  };
  const clickable = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={cn(
        "rounded-xl border p-3 text-right transition flex flex-col gap-1",
        tones[tone],
        clickable ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer" : "cursor-default"
      )}
    >
      <span className="text-[10px] font-semibold flex items-center gap-1.5 opacity-90 truncate">
        <Icon className="h-3.5 w-3.5 shrink-0" /> {label}
      </span>
      <span className={cn("font-extrabold tabular-nums leading-none", strong ? "text-lg sm:text-xl" : "text-base sm:text-lg")}>
        {value}
      </span>
      {cta && <span className="text-[10px] font-bold opacity-70 flex items-center gap-0.5">{cta} <ChevronLeft className="h-3 w-3" /></span>}
    </button>
  );
}

function ConceptCard({
  icon: Icon, title, subtitle, value, detail, tone, cta, onClick,
}: {
  icon: typeof UserPlus;
  title: string;
  subtitle: string;
  value: string;
  detail: string;
  tone: keyof typeof TONES;
  cta: string;
  onClick?: () => void;
}) {
  const t = TONES[tone];
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={cn(
        "text-right rounded-2xl border border-border/70 border-t-2 bg-card p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        t.border
      )}
      aria-label={`${title}: ${value} — ${cta}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-extrabold flex items-center gap-1.5">
            <Icon className={cn("h-4 w-4", t.chip.split(" ")[1])} /> {title}
          </p>
          <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">{subtitle}</p>
        </div>
        <span className={cn("h-8 w-8 shrink-0 rounded-xl flex items-center justify-center", t.chip)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-lg font-extrabold tabular-nums leading-none">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1 truncate">{detail}</p>
      <p className={cn("mt-2 text-[11px] font-bold flex items-center gap-0.5", t.cta)}>
        {cta} <ChevronLeft className="h-3.5 w-3.5" />
      </p>
    </motion.button>
  );
}

function KpiCard({
  icon: Icon, label, value, tone, delta, deltaGoodWhenPositive = true, hint,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  tone: "teal" | "emerald" | "rose";
  delta?: number;
  deltaGoodWhenPositive?: boolean;
  hint?: string;
}) {
  const chipCls = {
    teal: "bg-teal-500/12 text-teal-600 dark:text-teal-400",
    emerald: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    rose: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
  }[tone];

  const hasDelta = typeof delta === "number" && delta !== 0;
  const deltaPositive = (delta ?? 0) > 0;
  const deltaGood = deltaPositive === deltaGoodWhenPositive;

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
        <span className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", chipCls)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-1.5 text-base sm:text-lg font-extrabold tabular-nums leading-none truncate">{value}</p>
      <div className="mt-1.5 flex items-center gap-1.5 min-h-[18px]">
        {hasDelta && (
          <span className={cn(
            "text-[10px] font-bold px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5",
            deltaGood ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
          )}>
            {deltaPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(Math.round(delta! * 10) / 10)}%
          </span>
        )}
        {hint && <span className="text-[10px] text-muted-foreground truncate">{hint}</span>}
      </div>
    </Card>
  );
}

function CategoryDonutCard({
  title, items, total, emptyText,
}: {
  title: string;
  items: Array<{ key: string; label: string; value: number }>;
  total: number;
  emptyText: string;
}) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4 text-teal-600" /> {title}
        </CardTitle>
        <CardDescription className="text-[11px]">الإجمالي: {formatDA(total)}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="h-48 flex items-center justify-center">
            <EmptyHint text={emptyText} />
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="h-40 w-40 shrink-0 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={items}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={45}
                    outerRadius={68}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {items.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [formatDA(Number(value)), ""]}
                    contentStyle={{ direction: "rtl", borderRadius: 12, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[9px] text-muted-foreground">الإجمالي</span>
                <span className="text-xs font-extrabold tabular-nums">{formatShort(total)}</span>
              </div>
            </div>
            <ul className="flex-1 w-full space-y-1.5 min-w-0 max-h-40 overflow-y-auto">
              {items.map((it, i) => {
                const pct = total > 0 ? Math.round((it.value / total) * 100) : 0;
                return (
                  <li key={it.key} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2.5 w-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                    />
                    <span className="font-bold truncate flex-1">{it.label}</span>
                    <span className="tabular-nums text-muted-foreground shrink-0">
                      {formatShort(it.value)} • {pct}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InsightTile({
  icon: Icon, title, main, note, progress, tone,
}: {
  icon: typeof Gauge;
  title: string;
  main: string;
  note: string;
  progress?: number;
  tone?: "ok" | "warn" | "danger";
}) {
  return (
    <Card className="p-3.5">
      <div className="flex items-center gap-2">
        <span className={cn(
          "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
          tone === "danger" ? "bg-rose-500/12 text-rose-600"
            : tone === "warn" ? "bg-amber-500/12 text-amber-600"
            : "bg-teal-500/12 text-teal-600"
        )}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="text-[11px] font-bold text-muted-foreground">{title}</p>
      </div>
      <p className="mt-2 text-lg font-extrabold tabular-nums leading-none">{main}</p>
      {typeof progress === "number" && (
        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full",
              tone === "danger" ? "bg-rose-500" : tone === "warn" ? "bg-amber-500" : "bg-emerald-500"
            )}
            style={{ width: `${Math.max(Math.min(progress, 100), 2)}%` }}
          />
        </div>
      )}
      <p className={cn(
        "mt-1.5 text-[10px]",
        tone === "danger" ? "text-rose-600 font-bold" : "text-muted-foreground"
      )}>
        {note}
      </p>
    </Card>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-4 text-center">
      <Inbox className="h-6 w-6 text-muted-foreground/50" />
      <p className="text-[11px] text-muted-foreground">{text}</p>
    </div>
  );
}

function SmartFooterNote({
  registrations, monthIncome,
}: {
  registrations: number;
  monthIncome: number;
}) {
  if (monthIncome <= 0) return null;
  const regPct = Math.round((registrations / monthIncome) * 100);
  return (
    <div className="rounded-2xl border border-teal-500/25 bg-teal-500/5 p-3 flex items-start gap-2.5">
      <Landmark className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" />
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        <span className="font-extrabold text-foreground">قراءة المدير المالي: </span>
        التسجيلات (اشتراكات وتجديدات) تمثل <span className="font-extrabold text-teal-700 dark:text-teal-300">{regPct}%</span> من مداخيل هذا الشهر
        والباقي تأمين وحقوق مركب ومداخيل أخرى. كل دفعة تُسجَّل في أي شاشة تُرحَّل تلقائياً إلى دفتر التسديدات —
        فالأرقام هنا حصيلة النادي الكاملة بلا ازدواج محاسبي.
      </p>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <Skeleton className="lg:col-span-3 h-72 rounded-xl" />
        <Skeleton className="lg:col-span-2 h-72 rounded-xl" />
      </div>
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" /> جاري تحميل المعطيات المالية…
      </div>
    </div>
  );
}

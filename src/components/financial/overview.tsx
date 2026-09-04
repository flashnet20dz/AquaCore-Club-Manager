"use client";

/**
 * FinancialOverview — لوحة القيادة المالية (نظرة عامة) — النظام المالي الموحّد
 * ═════════════════════════════════════════════════════════════
 * المصدر الوحيد: /api/financial/dashboard (?period=today|week|month|lastmonth|year|custom&from&to)
 *
 *   1) مبدّل فترة أعلى القسم — كل KPIs الفترة تتغير معه (skeleton أثناء التحميل)
 *   2) شبكة البطاقات الرئيسية: الرصيد | المتاح الحقيقي (بعد الالتزامات) | مداخيل الفترة
 *      | مصاريف الفترة | صافي الحركة | المستحقات للنادي | الالتزامات | الملغاة
 *   3) بطاقة معادلة الرصيد: افتتاحي + مداخيل − مصاريف = ختامي
 *   4) KPIs الفترة: عدد العمليات | متوسط العملية | أكبر مصروف | أكبر مصدر دخل
 *   5) تحليل مصادر الدخل والمصاريف (فئات قابلة للنقر → فلتر الدفتر عبر localStorage)
 *   6) إيرادات المنخرطين (DashboardRevenueBlock — نفس أرقام لوحة التحكم)
 *   7) ودجت سلامة الحسابات (فحص + إعادة بناء للمدير)
 *   8) حركة اليوم (كشف يومي بمنتقي تاريخ)
 *   9) المقارنة الشهرية بقيم الشهرين + التدفق النقدي 6 أشهر + دونات الفئات
 *  10) طرق الدفع + أكبر المصاريف/المداخيل + آخر القيود (بأرقام FIN) + قراءة المدير المالي
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  Wallet, Landmark, Activity, ArrowDownCircle, ArrowUpCircle, Hourglass,
  HandCoins, Ban, ArrowRightLeft, TrendingUp, TrendingDown, ReceiptText,
  Calculator, Gauge, Banknote, ScrollText, Inbox, ChevronLeft, RefreshCw,
  Loader2, AlertTriangle, CalendarDays, CalendarRange, Calendar, CalendarMinus,
  CalendarCheck, CalendarClock, Sparkles, BadgeCheck, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { DashboardRevenueBlock } from "@/components/financial/dashboard-revenue";
import { IntegrityWidget, type InlineIntegrity } from "@/components/financial/integrity-widget";
import { DayStatementCard } from "@/components/financial/day-statement";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type PeriodKey = "today" | "week" | "month" | "lastmonth" | "year" | "custom";

interface CategoryStat { amount: number; count: number }

interface TxEntry {
  id: string;
  number?: string | null;
  seq?: number;
  type: "income" | "expense";
  category: string;
  amount: number;
  date: string;
  payeeName?: string | null;
  paymentMethod?: string | null;
  note?: string | null;
}

interface PeriodBlock {
  openingBalance: number;
  income: number;
  expense: number;
  net: number;
  closingBalance: number;
  count: number;
  avgAmount: number;
  largestExpense: TxEntry | null;
  largestIncome: TxEntry | null;
  incomeByCategory: Record<string, CategoryStat>;
  expenseByCategory: Record<string, CategoryStat>;
}

interface OverviewData {
  balance: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    incomeByCategory: Record<string, number>;
    expenseByCategory: Record<string, number>;
  };
  lastTransactions: TxEntry[];
  monthlyComparison: {
    thisMonthIncome: number;
    lastMonthIncome: number;
    thisMonthExpense: number;
    lastMonthExpense: number;
    incomeChangePct: number;
    expenseChangePct: number;
    netThisMonth: number;
  };
  topExpenses: TxEntry[];
  topIncome: TxEntry[];
  periodIncome: { today: number; week: number; month: number; year: number };
  chartData: Array<{ month: string; income: number; expense: number }>;
  duesTotalRemaining?: number;
  receivables?: { subscription: number; insurance: number; compound: number; total: number };
  payables?: { wages: number; total: number };
  realAvailable?: number;
  integrity?: InlineIntegrity;
  period?: PeriodBlock;
  cancelled?: { total: number; count: number };
  periodRange?: { from: string; to: string };
  monthIncomeByCategory: Record<string, number>;
  monthExpenseByCategory: Record<string, number>;
  paymentMethods: Array<{ method: string; amount: number; count: number }>;
  movementsThisMonth: number;
}

export type OverviewNavSection = "overview" | "dues" | "transactions" | "reports";

interface FinancialOverviewProps {
  /** دور المستخدم الحالي — يُستخدم لإظهار «إعادة بناء الرصيد» للمدير فقط */
  role?: string;
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

/** هوية بصرية teal/emerald — بلا أزرق أو بنفسجي */
const DONUT_COLORS = ["#14b8a6", "#10b981", "#f59e0b", "#f43f5e", "#84cc16", "#f97316", "#22c55e", "#eab308"];

const PERIODS: Array<{ key: PeriodKey; label: string; icon: typeof Calendar }> = [
  { key: "today", label: "اليوم", icon: CalendarDays },
  { key: "week", label: "هذا الأسبوع", icon: CalendarRange },
  { key: "month", label: "هذا الشهر", icon: Calendar },
  { key: "lastmonth", label: "الشهر الماضي", icon: CalendarMinus },
  { key: "year", label: "هذه السنة", icon: CalendarCheck },
  { key: "custom", label: "فترة مخصصة", icon: CalendarClock },
];

const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: "اليوم",
  week: "هذا الأسبوع",
  month: "هذا الشهر",
  lastmonth: "الشهر الماضي",
  year: "هذه السنة",
  custom: "الفترة المخصصة",
};

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

function todayISO(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** رقم مالي مقروء FIN-2026-000001 — يُعرض LTR داخل واجهة RTL */
function FinBadge({ number }: { number?: string | null }) {
  if (!number) return null;
  return (
    <span dir="ltr" className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground tabular-nums shrink-0">
      {number}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export function FinancialOverview({ role, onNavigateSection }: FinancialOverviewProps) {
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [customFrom, setCustomFrom] = useState<string>(() => daysAgoISO(6));
  const [customTo, setCustomTo] = useState<string>(todayISO);
  const [appliedCustom, setAppliedCustom] = useState<{ from: string; to: string } | null>(null);
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** يُرفع بعد إعادة بناء الرصيد أو أي تغيير خارجي → إعادة جلب شاملة */
  const [reloadTick, setReloadTick] = useState(0);

  const fetchData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ period });
      if (period === "custom" && appliedCustom) {
        params.set("from", appliedCustom.from);
        params.set("to", appliedCustom.to);
      }
      const res = await fetch(`/api/financial/dashboard?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل تحميل البيانات المالية");
      toast.error("تعذر تحميل المعطيات المالية");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, appliedCustom, reloadTick]);

  useEffect(() => {
    fetchData();
    // تحديث فوري عند رجوع التركيز للنافذة + عند العودة للقسم (إعادة تركيب المكون)
    const onFocus = () => fetchData(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchData]);

  const selectPeriod = (p: PeriodKey) => {
    if (p === "custom" && !appliedCustom) setAppliedCustom({ from: customFrom, to: customTo });
    setPeriod(p);
  };

  const applyCustom = () => {
    if (!customFrom || !customTo) { toast.error("اختر تاريخي البداية والنهاية"); return; }
    if (customFrom > customTo) { toast.error("تاريخ البداية يجب أن يسبق تاريخ النهاية"); return; }
    setAppliedCustom({ from: customFrom, to: customTo });
    setPeriod("custom");
  };

  /** النقر على فئة دخل/مصروف → فلترة الدفتر (يقرأ الوكيل المفتاح ويطبّق الفلتر) */
  const selectLedgerCategory = useCallback((type: "income" | "expense", category: string) => {
    try {
      localStorage.setItem("rcs-financial-ledger-preset", JSON.stringify({ type, category }));
    } catch { /* تجاهل */ }
    onNavigateSection?.("transactions");
  }, [onNavigateSection]);

  // ─── المشتقات ───
  const p: PeriodBlock = data?.period ?? {
    openingBalance: 0, income: 0, expense: 0, net: 0, closingBalance: 0, count: 0, avgAmount: 0,
    largestExpense: null, largestIncome: null, incomeByCategory: {}, expenseByCategory: {},
  };
  const mc = data?.monthlyComparison;
  const payablesTotal = data?.payables?.total ?? 0;
  const realAvailable = data?.realAvailable ?? ((data?.balance.balance ?? 0) - payablesTotal);
  const periodLabel = PERIOD_LABELS[period];
  const rangeText = data?.periodRange
    ? `من ${formatDate(data.periodRange.from)} إلى ${formatDate(data.periodRange.to)}`
    : null;

  const incomeCats = Object.entries(p.incomeByCategory)
    .filter(([, s]) => s.amount > 0)
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([k, s]) => ({ key: k, label: CATEGORY_LABELS[k] || k, amount: s.amount, count: s.count }));
  const expenseCats = Object.entries(p.expenseByCategory)
    .filter(([, s]) => s.amount > 0)
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([k, s]) => ({ key: k, label: CATEGORY_LABELS[k] || k, amount: s.amount, count: s.count }));

  const incomeDonutTotal = incomeCats.reduce((s, c) => s + c.amount, 0);
  const expenseDonutTotal = expenseCats.reduce((s, c) => s + c.amount, 0);

  const chartData = (data?.chartData ?? []).map((c) => ({ ...c, net: c.income - c.expense }));

  const switcher = (
    <div className="rounded-2xl border border-border/60 bg-card p-2 shadow-sm space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-extrabold text-muted-foreground px-1 flex items-center gap-1 shrink-0">
          <CalendarClock className="h-3.5 w-3.5" /> الفترة:
        </span>
        <div className="flex flex-wrap items-center gap-1 flex-1" role="tablist" aria-label="اختيار فترة التحليل المالي">
          {PERIODS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              role="tab"
              aria-selected={period === key}
              onClick={() => selectPeriod(key)}
              className={cn(
                "h-11 px-3 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-all",
                period === key
                  ? "bg-teal-600 text-white shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => fetchData(true)}
          disabled={refreshing}
          aria-label="تحديث البيانات"
          title="تحديث البيانات"
          className="h-11 w-11 p-0 text-teal-700 dark:text-teal-300 shrink-0"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {/* مدخلات الفترة المخصصة */}
      {period === "custom" && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-muted/40 border border-border/50 p-2">
          <span className="text-[11px] font-bold text-muted-foreground">من</span>
          <input
            type="date"
            value={customFrom}
            max={todayISO()}
            onChange={(e) => setCustomFrom(e.target.value)}
            aria-label="تاريخ بداية الفترة المخصصة"
            className="h-11 rounded-lg border border-input bg-background px-2 text-xs font-bold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <span className="text-[11px] font-bold text-muted-foreground">إلى</span>
          <input
            type="date"
            value={customTo}
            max={todayISO()}
            onChange={(e) => setCustomTo(e.target.value)}
            aria-label="تاريخ نهاية الفترة المخصصة"
            className="h-11 rounded-lg border border-input bg-background px-2 text-xs font-bold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            size="sm"
            onClick={applyCustom}
            className="h-11 px-4 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white gap-1"
          >
            <CalendarCheck className="h-3.5 w-3.5" /> تطبيق
          </Button>
        </div>
      )}
    </div>
  );

  if (loading || !data) {
    return (
      <div dir="rtl" className="space-y-4">
        {switcher}
        <OverviewSkeleton />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div dir="rtl" className="space-y-4">
        {switcher}
        <Card className="border-rose-300/50 bg-rose-500/5">
          <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="h-8 w-8 text-rose-500" />
            <p className="text-sm font-bold text-rose-700 dark:text-rose-300">تعذر تحميل البيانات المالية</p>
            <Button size="sm" variant="outline" onClick={() => fetchData()}>
              <RefreshCw className="h-4 w-4" /> إعادة المحاولة
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-4">
      {switcher}

      {/* ═══ 1) شبكة البطاقات الرئيسية (المرحلة 18) ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        <MainCard icon={Landmark} label="الرصيد الحالي" value={formatDA(data.balance.balance)} tone={data.balance.balance < 0 ? "rose" : "teal"} hint="إجمالي الدفتر — العمليات النشطة" strong />
        <MainCard
          icon={Wallet}
          label="المتاح الحقيقي"
          value={formatDA(realAvailable)}
          tone={realAvailable < 0 ? "rose" : "emerald"}
          hint={`بعد الالتزامات ${formatDA(payablesTotal)}`}
          title={payablesTotal > 0 ? `الرصيد ${formatDA(data.balance.balance)} ناقص الالتزامات ${formatDA(payablesTotal)}` : "لا التزامات مستحقة حالياً"}
          strong
        />
        <MainCard icon={ArrowDownCircle} label="إجمالي المداخيل" value={formatDA(p.income)} tone="emerald" hint={periodLabel} />
        <MainCard icon={ArrowUpCircle} label="إجمالي المصاريف" value={formatDA(p.expense)} tone="rose" hint={periodLabel} />
        <MainCard icon={Activity} label="صافي الحركة" value={formatDA(p.net)} tone={p.net >= 0 ? "emerald" : "rose"} hint={`${p.count} عملية خلال ${periodLabel}`} />
        <MainCard
          icon={Hourglass}
          label="المستحقات للنادي"
          value={formatDA(data.receivables?.total ?? 0)}
          tone="amber"
          hint="من حالات اشتراك المنخرطين — ليست إيراداً"
          onClick={() => onNavigateSection?.("dues")}
          cta="فتح المستحقات"
        />
        <MainCard
          icon={HandCoins}
          label="الالتزامات على النادي"
          value={formatDA(payablesTotal)}
          tone="amber"
          hint={payablesTotal > 0 ? `أجور مستحقة: ${formatShort(data.payables?.wages ?? 0)} دج` : "لا التزامات حالياً"}
        />
        <MainCard
          icon={Ban}
          label="العمليات الملغاة"
          value={String(data.cancelled?.count ?? 0)}
          tone="slate"
          hint={`إجمالي مبالغ ملغاة: ${formatShort(data.cancelled?.total ?? 0)} دج`}
        />
      </div>

      {/* ═══ 2) بطاقة معادلة الرصيد (المرحلة 14) ═══ */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-extrabold flex items-center gap-2">
              <Calculator className="h-4 w-4 text-teal-600" />
              معادلة الرصيد — {periodLabel}
            </p>
            {rangeText && (
              <span className="text-[10px] font-bold text-muted-foreground rounded-full bg-muted px-2 py-0.5 tabular-nums">
                {rangeText}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-stretch gap-1.5">
            <EqTile label="رصيد بداية الفترة" value={formatDA(p.openingBalance)} tone="slate" />
            <Op sign="+" />
            <EqTile label="المداخيل" value={formatDA(p.income)} tone="emerald" />
            <Op sign="−" />
            <EqTile label="المصاريف" value={formatDA(p.expense)} tone="rose" />
            <Op sign="=" />
            <EqTile label="رصيد نهاية الفترة" value={formatDA(p.closingBalance)} tone="teal" strong />
          </div>
        </CardContent>
      </Card>

      {/* ═══ 3) KPIs الفترة (المرحلة 19) ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={ArrowRightLeft} label="عدد العمليات" value={String(p.count)} tone="teal" hint={rangeText ?? periodLabel} />
        <KpiCard icon={Gauge} label="متوسط العملية" value={formatDA(p.avgAmount)} tone="slate" hint={`خلال ${periodLabel}`} />
        <KpiCard
          icon={ReceiptText}
          label="أكبر مصروف"
          value={p.largestExpense ? formatDA(p.largestExpense.amount) : "—"}
          tone="rose"
          sub={
            p.largestExpense ? (
              <span className="truncate">
                {p.largestExpense.payeeName || CATEGORY_LABELS[p.largestExpense.category] || p.largestExpense.category}{" "}
                <FinBadge number={p.largestExpense.number} />
              </span>
            ) : "لا مصاريف في الفترة"
          }
        />
        <KpiCard
          icon={Sparkles}
          label="أكبر مصدر دخل"
          value={p.largestIncome ? formatDA(p.largestIncome.amount) : "—"}
          tone="emerald"
          sub={
            p.largestIncome ? (
              <span className="truncate">
                {p.largestIncome.payeeName || CATEGORY_LABELS[p.largestIncome.category] || p.largestIncome.category}{" "}
                <FinBadge number={p.largestIncome.number} />
              </span>
            ) : "لا مداخيل في الفترة"
          }
        />
      </div>

      {/* ═══ 4) تحليل مصادر الدخل والمصاريف — فئات قابلة للنقر (المرحلتان 22 و23) ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <CategoryAnalysis
          title="تحليل مصادر الدخل"
          subtitle="اضغط على أي فئة لفتحها مُصفّاة في دفتر القيود"
          tone="income"
          items={incomeCats}
          total={incomeDonutTotal}
          emptyText="لا مداخيل مسجّلة في هذه الفترة"
          onSelect={(category) => selectLedgerCategory("income", category)}
        />
        <CategoryAnalysis
          title="تحليل المصاريف"
          subtitle="اضغط على أي فئة لفتحها مُصفّاة في دفتر القيود"
          tone="expense"
          items={expenseCats}
          total={expenseDonutTotal}
          emptyText="لا مصاريف مسجّلة في هذه الفترة"
          onSelect={(category) => selectLedgerCategory("expense", category)}
        />
      </div>

      {/* ═══ 5) إيرادات المنخرطين — من نفس بيانات الدفتر ═══ */}
      <DashboardRevenueBlock
        totalIncome={data.balance.totalIncome}
        subscription={(data.balance.incomeByCategory.subscription || 0) + (data.balance.incomeByCategory.renewal || 0)}
        insurance={data.balance.incomeByCategory.insurance || 0}
        compound={data.balance.incomeByCategory.compound || 0}
        otherIncome={data.balance.incomeByCategory.other_income || 0}
        counts={{
          subscription: p.incomeByCategory.subscription?.count ?? 0,
          renewal: p.incomeByCategory.renewal?.count ?? 0,
          insurance: p.incomeByCategory.insurance?.count ?? 0,
          compound: p.incomeByCategory.compound?.count ?? 0,
        }}
        movementsCount={p.count}
        receivables={data.receivables}
      />

      {/* ═══ 6) سلامة الحسابات (المرحلة 31) ═══ */}
      <IntegrityWidget
        role={role}
        inline={data.integrity ?? null}
        onChanged={() => setReloadTick((t) => t + 1)}
      />

      {/* ═══ 7) حركة اليوم — كشف يومي (المرحلة 20) ═══ */}
      <DayStatementCard refreshSignal={reloadTick} />

      {/* ═══ 8) المقارنة الشهرية بقيم الشهرين (المرحلة 21) ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={Wallet}
          label="قبض اليوم"
          value={formatDA(data.periodIncome.today)}
          tone="teal"
          hint={`هذا الأسبوع: ${formatShort(data.periodIncome.week)} دج • هذه السنة: ${formatShort(data.periodIncome.year)} دج`}
        />
        {mc && (
          <KpiCard
            icon={TrendingUp}
            label="مداخيل الشهر"
            value={formatDA(mc.thisMonthIncome)}
            tone="emerald"
            delta={mc.incomeChangePct}
            deltaGoodWhenPositive
            hint={`الشهر الماضي: ${formatDA(mc.lastMonthIncome)}`}
          />
        )}
        {mc && (
          <KpiCard
            icon={TrendingDown}
            label="أعباء الشهر"
            value={formatDA(mc.thisMonthExpense)}
            tone="rose"
            delta={mc.expenseChangePct}
            deltaGoodWhenPositive={false}
            hint={`الشهر الماضي: ${formatDA(mc.lastMonthExpense)}`}
          />
        )}
        {mc && (
          <KpiCard
            icon={Activity}
            label="صافي الشهر"
            value={formatDA(mc.netThisMonth)}
            tone={mc.netThisMonth >= 0 ? "emerald" : "rose"}
            hint={mc.netThisMonth >= 0 ? "فائض يُعاد استثماره ✓" : "عجز — راقب الأعباء"}
          />
        )}
      </div>

      {/* ═══ 9) التدفق النقدي 6 أشهر + دونات الفئات (من بيانات الفترة) ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-teal-600" /> التدفق النقدي — آخر 6 أشهر
            </CardTitle>
            <CardDescription className="text-[11px]">مداخيل مقابل مصاريف + خط الصافي (بالدينار)</CardDescription>
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
                    name === "income" ? "مداخيل" : name === "expense" ? "مصاريف" : "الصافي",
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
          title={`دونات المداخيل — ${periodLabel}`}
          items={incomeCats}
          total={incomeDonutTotal}
          emptyText="لا مداخيل في هذه الفترة"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <CategoryDonutCard
          title={`دونات المصاريف — ${periodLabel}`}
          items={expenseCats}
          total={expenseDonutTotal}
          emptyText="لا مصاريف في هذه الفترة"
        />

        {/* ═══ طرق الدفع — الفترة المختارة ═══ */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Banknote className="h-4 w-4 text-teal-600" /> طرق الدفع — {periodLabel}
            </CardTitle>
            <CardDescription className="text-[11px]">توزيع الحركة المالية حسب وسيلة التحصيل</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.paymentMethods.length === 0 ? (
              <EmptyHint text="لا حركات في هذه الفترة" />
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

      {/* ═══ 10) أكبر المصاريف + أكبر المداخيل (عمودان) ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <TopListCard
          title="أكبر المصاريف"
          icon={ReceiptText}
          iconClass="text-rose-500"
          items={data.topExpenses}
          emptyText="لا مصاريف مسجّلة بعد"
          onOpenLedger={() => selectLedgerCategory("expense", "other_expense")}
          openLabel="كل المصاريف"
        />
        <TopListCard
          title="أكبر المداخيل"
          icon={BadgeCheck}
          iconClass="text-emerald-600"
          items={data.topIncome}
          emptyText="لا مداخيل مسجّلة بعد"
          onOpenLedger={() => selectLedgerCategory("income", "other_income")}
          openLabel="كل المداخيل"
        />
      </div>

      {/* ═══ آخر القيود — بأرقام FIN ═══ */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-teal-600" /> آخر القيود المحاسبية
            </CardTitle>
            <Button
              size="sm"
              variant="ghost"
              className="text-teal-700 dark:text-teal-300 h-9 px-2 text-[11px]"
              onClick={() => onNavigateSection?.("transactions")}
            >
              فتح الدفتر <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          </div>
          <CardDescription className="text-[11px]">أحدث 10 حركات من دفتر القيود الموحّد</CardDescription>
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
                    <p className="text-xs font-bold truncate flex items-center gap-1.5">
                      {CATEGORY_LABELS[t.category] || t.category}
                      {t.payeeName ? <span className="font-normal text-muted-foreground truncate">— {t.payeeName}</span> : null}
                    </p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                      <FinBadge number={t.number} />
                      {formatDate(t.date)}
                      {t.paymentMethod ? ` • ${METHOD_LABELS[t.paymentMethod] || t.paymentMethod}` : ""}
                    </p>
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

      {/* قراءة ختامية ذكية — حسب الفترة المختارة */}
      <SmartFooterNote
        registrations={(p.incomeByCategory.subscription?.amount ?? 0) + (p.incomeByCategory.renewal?.amount ?? 0)}
        periodIncome={p.income}
        periodLabel={periodLabel}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

/** بطاقة رئيسية من شبكة المرحلة 18 — أيقونة + قيمة دلالية + تلميح */
function MainCard({ icon: Icon, label, value, tone, hint, title, strong, onClick, cta }: {
  icon: typeof Wallet;
  label: string;
  value: string;
  tone: "emerald" | "rose" | "teal" | "amber" | "slate";
  hint?: string;
  title?: string;
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
    <motion.div
      whileHover={clickable ? { y: -2 } : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } } : undefined}
      title={title || hint}
      className={cn(
        "rounded-2xl border p-3 text-right transition flex flex-col gap-1 min-h-[76px]",
        tones[tone],
        clickable ? "hover:shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : "cursor-default"
      )}
    >
      <span className="text-[10px] font-semibold flex items-center gap-1.5 opacity-90 truncate">
        <Icon className="h-3.5 w-3.5 shrink-0" /> {label}
      </span>
      <span className={cn("font-extrabold tabular-nums leading-none", strong ? "text-lg sm:text-xl" : "text-base sm:text-lg")}>
        {value}
      </span>
      {hint && <span className="text-[9px] font-medium opacity-70 truncate">{hint}</span>}
      {cta && <span className="text-[10px] font-bold opacity-80 flex items-center gap-0.5">{cta} <ChevronLeft className="h-3 w-3" /></span>}
    </motion.div>
  );
}

/** بطاقة المعادلة الأفقية — أرقام tabular-nums */
function EqTile({ label, value, tone, strong }: {
  label: string;
  value: string;
  tone: "slate" | "emerald" | "rose" | "teal";
  strong?: boolean;
}) {
  const tones: Record<string, string> = {
    slate: "border-border/60 bg-muted/40 text-foreground",
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    rose: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    teal: "border-teal-500/40 bg-teal-500/15 text-teal-800 dark:text-teal-200",
  };
  return (
    <div className={cn("min-w-[110px] flex-1 rounded-xl border p-2.5 text-center", tones[tone])}>
      <span className="text-[9px] font-bold opacity-80 block truncate">{label}</span>
      <p className={cn("font-extrabold tabular-nums leading-none mt-1", strong ? "text-base sm:text-xl" : "text-xs sm:text-base")}>
        {value}
      </p>
    </div>
  );
}

function Op({ sign }: { sign: string }) {
  return (
    <span className="self-center text-lg font-extrabold text-muted-foreground select-none px-0.5" aria-hidden>
      {sign}
    </span>
  );
}

function KpiCard({
  icon: Icon, label, value, tone, delta, deltaGoodWhenPositive = true, hint, sub,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  tone: "teal" | "emerald" | "rose" | "amber" | "slate";
  delta?: number;
  deltaGoodWhenPositive?: boolean;
  hint?: string;
  sub?: string | ReactNode;
}) {
  const chipCls = {
    teal: "bg-teal-500/12 text-teal-600 dark:text-teal-400",
    emerald: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    rose: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
    amber: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
    slate: "bg-muted text-muted-foreground",
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
            "text-[10px] font-bold px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5 shrink-0",
            deltaGood ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
          )}>
            {deltaPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(Math.round(delta! * 10) / 10)}%
          </span>
        )}
        {sub ? (
          <span className="text-[10px] text-muted-foreground truncate flex items-center gap-1 min-w-0">{sub}</span>
        ) : hint ? (
          <span className="text-[10px] text-muted-foreground truncate">{hint}</span>
        ) : null}
      </div>
    </Card>
  );
}

/** تحليل فئات قابل للنقر (المرحلتان 22 و23) — اسم/قيمة/نسبة بشريط تقدم/عدد عمليات */
function CategoryAnalysis({ title, subtitle, tone, items, total, emptyText, onSelect }: {
  title: string;
  subtitle: string;
  tone: "income" | "expense";
  items: Array<{ key: string; label: string; amount: number; count: number }>;
  total: number;
  emptyText: string;
  onSelect: (category: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={cn("text-sm flex items-center gap-2", tone === "income" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
          {tone === "income" ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
          {title}
        </CardTitle>
        <CardDescription className="text-[11px]">{subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyHint text={emptyText} />
        ) : (
          <div className="space-y-1.5">
            {items.map((it) => {
              const pct = total > 0 ? Math.round((it.amount / total) * 100) : 0;
              return (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => onSelect(it.key)}
                  title={`فتح «${it.label}» مُصفّاة في دفتر القيود`}
                  className="w-full text-right rounded-xl border border-border/60 p-2.5 min-h-[44px] hover:bg-muted/50 hover:border-teal-500/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold truncate">{it.label}</span>
                    <span className="tabular-nums shrink-0">
                      <span className={cn("font-extrabold", tone === "income" ? "text-emerald-600" : "text-rose-600")}>
                        {formatDA(it.amount)}
                      </span>
                      <span className="text-muted-foreground"> • {it.count} عملية • {pct}%</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", tone === "income" ? "bg-emerald-500" : "bg-rose-500")}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryDonutCard({
  title, items, total, emptyText,
}: {
  title: string;
  items: Array<{ key: string; label: string; amount: number; count: number }>;
  total: number;
  emptyText: string;
}) {
  const donutItems = items.map((it) => ({ label: it.label, value: it.amount }));
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4 text-teal-600" /> {title}
        </CardTitle>
        <CardDescription className="text-[11px]">الإجمالي: {formatDA(total)}</CardDescription>
      </CardHeader>
      <CardContent>
        {donutItems.length === 0 ? (
          <div className="h-48 flex items-center justify-center">
            <EmptyHint text={emptyText} />
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="h-40 w-40 shrink-0 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutItems}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={45}
                    outerRadius={68}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {donutItems.map((_, i) => (
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
            <ul className="flex-1 w-full space-y-1.5 min-w-0 max-h-40 overflow-y-auto nice-scroll">
              {items.map((it, i) => {
                const pct = total > 0 ? Math.round((it.amount / total) * 100) : 0;
                return (
                  <li key={it.key} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2.5 w-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                    />
                    <span className="font-bold truncate flex-1">{it.label}</span>
                    <span className="tabular-nums text-muted-foreground shrink-0">
                      {formatShort(it.amount)} • {it.count} ع • {pct}%
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

/** أكبر المصاريف / أكبر المداخيل — عمودان بأرقام FIN */
function TopListCard({ title, icon: Icon, iconClass, items, emptyText, onOpenLedger, openLabel }: {
  title: string;
  icon: typeof ReceiptText;
  iconClass: string;
  items: TxEntry[];
  emptyText: string;
  onOpenLedger: () => void;
  openLabel: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <span className={iconClass}><Icon className="h-4 w-4" /></span>
            {title}
          </CardTitle>
          {items.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="text-teal-700 dark:text-teal-300 h-9 px-2 text-[11px]"
              onClick={onOpenLedger}
            >
              {openLabel} <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <CardDescription className="text-[11px]">أعلى 5 قيود في سجل النادي</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <EmptyHint text={emptyText} />
        ) : (
          items.slice(0, 5).map((t, i) => (
            <div key={t.id} className="flex items-center gap-2.5 rounded-xl border border-border/60 p-2.5">
              <span className={cn(
                "h-6 w-6 shrink-0 rounded-lg text-[11px] font-extrabold flex items-center justify-center",
                i === 0 ? "bg-amber-500/15 text-amber-600" : "bg-muted text-muted-foreground"
              )}>
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate flex items-center gap-1.5">
                  {CATEGORY_LABELS[t.category] || t.category}
                  <FinBadge number={t.number} />
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {t.payeeName || t.note || "—"} • {formatDate(t.date)}
                </p>
              </div>
              <span className={cn(
                "text-sm font-extrabold tabular-nums shrink-0",
                t.type === "expense" ? "text-rose-600" : "text-emerald-600"
              )}>
                {formatDA(t.amount)}
              </span>
            </div>
          ))
        )}
      </CardContent>
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
  registrations, periodIncome, periodLabel,
}: {
  registrations: number;
  periodIncome: number;
  periodLabel: string;
}) {
  if (periodIncome <= 0) {
    return (
      <div className="rounded-2xl border border-teal-500/25 bg-teal-500/5 p-3 flex items-start gap-2.5">
        <Landmark className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-extrabold text-foreground">قراءة المدير المالي: </span>
          لا مداخيل مسجّلة في {periodLabel} حتى الآن — كل دفعة تُسجَّل في أي شاشة (تجديد، تأمين، مركب، أجور، قيد يدوي)
          تُرحَّل تلقائياً إلى دفتر القيود، فالأرقام هنا حصيلة النادي الكاملة بلا ازدواج محاسبي.
        </p>
      </div>
    );
  }
  const regPct = Math.round((registrations / periodIncome) * 100);
  return (
    <div className="rounded-2xl border border-teal-500/25 bg-teal-500/5 p-3 flex items-start gap-2.5">
      <Landmark className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" />
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        <span className="font-extrabold text-foreground">قراءة المدير المالي: </span>
        خلال {periodLabel}، التسجيلات (اشتراكات وتجديدات) تمثل{" "}
        <span className="font-extrabold text-teal-700 dark:text-teal-300">{regPct}%</span>{" "}
        من المداخيل ({formatDA(registrations)} من أصل {formatDA(periodIncome)})
        والباقي تأمين وحقوق مركب ومداخيل أخرى. كل دفعة تُسجَّل في أي شاشة تُرحَّل تلقائياً إلى دفتر القيود —
        فالأرقام هنا حصيلة النادي الكاملة بلا ازدواج محاسبي.
      </p>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[76px] rounded-2xl" />)}
      </div>
      <Skeleton className="h-28 rounded-2xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
      </div>
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" /> جاري تحميل المعطيات المالية…
      </div>
    </div>
  );
}

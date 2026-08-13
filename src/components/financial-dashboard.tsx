"use client";

import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, TrendingDown, Wallet, Calendar, AlertTriangle,
  RefreshCw, Loader2, ArrowUpRight, ArrowDownRight, ArrowRight,
  Coins, CalendarDays, CalendarRange, CalendarClock, Receipt,
  Trophy, ChevronLeft, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface DashboardData {
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
    paymentMethod?: string;
    reference?: string | null;
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
  periodIncome: {
    today: number;
    week: number;
    month: number;
    year: number;
  };
  chartData: Array<{ month: string; income: number; expense: number }>;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  subscription: "اشتراك",
  renewal: "تجديد",
  insurance: "تأمين",
  other_income: "مدخول آخر",
  wages: "أجور عمال",
  compound_rights: "حقوق المركب",
  office_supplies: "لوازم مكتبية",
  other_expense: "دفعات أخرى",
};

const PIE_COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f43f5e", "#6366f1"];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function formatDA(n: number): string {
  return new Intl.NumberFormat("fr-DZ").format(Math.round(n)) + " دج";
}

function formatShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "م دج";
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + "ك دج";
  return n + " دج";
}

function formatDate(s: string): string {
  try {
    return new Date(s).toLocaleDateString("ar-DZ", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return s;
  }
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
interface FinancialDashboardProps {
  /** Optional callback when user wants to navigate to payments tab */
  onViewAllTransactions?: () => void;
}

export function FinancialDashboard({ onViewAllTransactions }: FinancialDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/financial/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل تحميل البيانات");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    toast.promise(fetchData(true), {
      loading: "جاري التحديث...",
      success: "تم تحديث البيانات",
      error: "فشل التحديث",
    });
  };

  // ─── Loading state ───
  if (loading) {
    return (
      <div dir="rtl" className="space-y-4">
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  // ─── Error state ───
  if (error || !data) {
    return (
      <div dir="rtl" className="flex flex-col items-center justify-center gap-4 py-16">
        <div className="rounded-full bg-rose-500/15 p-4">
          <AlertTriangle className="h-8 w-8 text-rose-600" />
        </div>
        <div className="text-center">
          <p className="font-bold text-foreground">تعذّر تحميل لوحة المعلومات</p>
          <p className="text-sm text-muted-foreground mt-1">{error || "خطأ غير معروف"}</p>
        </div>
        <Button onClick={() => fetchData()} variant="outline">
          <RefreshCw className="h-4 w-4" />
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  // ─── Empty state ───
  const isEmpty =
    data.balance.totalIncome === 0 &&
    data.balance.totalExpense === 0 &&
    data.lastTransactions.length === 0;

  const balance = data.balance.balance;
  const balanceTone =
    balance < 0 ? "danger" : balance < 5000 ? "warn" : "ok";

  const incomeByCatArr = Object.entries(data.balance.incomeByCategory)
    .map(([k, v]) => ({ name: CATEGORY_LABELS[k] || k, value: v }))
    .sort((a, b) => b.value - a.value);

  const expenseByCatArr = Object.entries(data.balance.expenseByCategory)
    .map(([k, v]) => ({ name: CATEGORY_LABELS[k] || k, value: v }))
    .sort((a, b) => b.value - a.value);

  return (
    <div dir="rtl" className="space-y-4 pb-2">
      {/* ─── Balance Alert Bar (sticky) ─── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "sticky top-0 z-30 rounded-xl border p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm backdrop-blur-md",
          balanceTone === "danger" && "border-rose-500/50 bg-rose-500/15",
          balanceTone === "warn" && "border-amber-500/50 bg-amber-500/15",
          balanceTone === "ok" && "border-emerald-500/50 bg-emerald-500/15"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "rounded-lg p-2 shrink-0",
            balanceTone === "danger" && "bg-rose-500/20",
            balanceTone === "warn" && "bg-amber-500/20",
            balanceTone === "ok" && "bg-emerald-500/20"
          )}>
            <Wallet className={cn(
              "h-5 w-5",
              balanceTone === "danger" && "text-rose-700 dark:text-rose-400",
              balanceTone === "warn" && "text-amber-700 dark:text-amber-400",
              balanceTone === "ok" && "text-emerald-700 dark:text-emerald-400"
            )} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">الرصيد الحالي</p>
            <p className={cn(
              "text-xl sm:text-2xl font-extrabold tabular-nums leading-none",
              balanceTone === "danger" && "text-rose-700 dark:text-rose-400",
              balanceTone === "warn" && "text-amber-700 dark:text-amber-400",
              balanceTone === "ok" && "text-emerald-700 dark:text-emerald-400"
            )}>
              {formatDA(balance)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {balanceTone === "danger" && (
            <Badge className="bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30">
              <AlertTriangle className="h-3 w-3" /> رصيد سالب
            </Badge>
          )}
          {balanceTone === "warn" && (
            <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30">
              <AlertTriangle className="h-3 w-3" /> رصيد منخفض
            </Badge>
          )}
          {balanceTone === "ok" && (
            <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
              <TrendingUp className="h-3 w-3" /> وضع مالي جيد
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-background/50"
          >
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">تحديث</span>
          </Button>
        </div>
      </motion.div>

      {isEmpty ? (
        <EmptyState onRefresh={() => fetchData()} />
      ) : (
        <>
          {/* ─── 6 Stat Cards ─── */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.05 } },
            }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
          >
            <StatCard
              icon={TrendingUp}
              label="إجمالي المداخيل"
              value={formatDA(data.balance.totalIncome)}
              tone="emerald"
              delay={0}
            />
            <StatCard
              icon={TrendingDown}
              label="إجمالي المصاريف"
              value={formatDA(data.balance.totalExpense)}
              tone="rose"
              delay={0.05}
            />
            <StatCard
              icon={Wallet}
              label="الرصيد الحالي"
              value={formatDA(balance)}
              tone="sky"
              big
              delay={0.1}
            />
            <StatCard
              icon={Coins}
              label="مداخيل هذا الشهر"
              value={formatDA(data.monthlyComparison.thisMonthIncome)}
              tone="teal"
              delay={0.15}
            />
            <StatCard
              icon={Receipt}
              label="مصاريف هذا الشهر"
              value={formatDA(data.monthlyComparison.thisMonthExpense)}
              tone="amber"
              delay={0.2}
            />
            <StatCard
              icon={Activity}
              label="صافي هذا الشهر"
              value={formatDA(data.monthlyComparison.netThisMonth)}
              tone="violet"
              delay={0.25}
            />
          </motion.div>

          {/* ─── Monthly Comparison ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ComparisonCard
              title="مداخيل هذا الشهر"
              icon={TrendingUp}
              tone="emerald"
              thisValue={data.monthlyComparison.thisMonthIncome}
              lastValue={data.monthlyComparison.lastMonthIncome}
              changePct={data.monthlyComparison.incomeChangePct}
              goodWhenUp
            />
            <ComparisonCard
              title="مصاريف هذا الشهر"
              icon={TrendingDown}
              tone="rose"
              thisValue={data.monthlyComparison.thisMonthExpense}
              lastValue={data.monthlyComparison.lastMonthExpense}
              changePct={data.monthlyComparison.expenseChangePct}
              goodWhenUp={false}
            />
          </div>

          {/* ─── Period income mini-cards ─── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <PeriodMiniCard icon={Calendar} label="مدخول اليوم" value={data.periodIncome.today} tone="sky" />
            <PeriodMiniCard icon={CalendarRange} label="مدخول الأسبوع" value={data.periodIncome.week} tone="teal" />
            <PeriodMiniCard icon={CalendarDays} label="مدخول الشهر" value={data.periodIncome.month} tone="emerald" />
            <PeriodMiniCard icon={CalendarClock} label="مدخول السنة" value={data.periodIncome.year} tone="violet" />
          </div>

          {/* ─── Charts row 1 ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* LineChart: income vs expense over 6 months */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-primary" />
                  تطور المداخيل والمصاريف (6 أشهر)
                </CardTitle>
                <CardDescription>مقارنة شهرية بين الإيرادات والمصروفات</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data.chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} reversed />
                    <YAxis tick={{ fontSize: 11 }} orientation="right" tickFormatter={formatShort} />
                    <Tooltip
                      contentStyle={{
                        direction: "rtl",
                        borderRadius: "12px",
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--popover))",
                        color: "hsl(var(--popover-foreground))",
                      }}
                      formatter={((v: number, name: string) => [formatDA(v), name === "income" ? "مدخول" : "مصروف"]) as never}
                    />
                    <Legend formatter={(v) => (v === "income" ? "مدخول" : "مصروف")} />
                    <Line
                      type="monotone"
                      dataKey="income"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#10b981" }}
                      activeDot={{ r: 6 }}
                      name="income"
                    />
                    <Line
                      type="monotone"
                      dataKey="expense"
                      stroke="#f43f5e"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#f43f5e" }}
                      activeDot={{ r: 6 }}
                      name="expense"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* PieChart: expense by category */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingDown className="h-4 w-4 text-rose-500" />
                  توزيع المصاريف حسب الفئة
                </CardTitle>
                <CardDescription>نسبة كل فئة من إجمالي المصاريف</CardDescription>
              </CardHeader>
              <CardContent>
                {expenseByCatArr.length === 0 ? (
                  <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                    لا توجد مصاريف بعد
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <ResponsiveContainer width="100%" height={220} minHeight={220}>
                      <PieChart>
                        <Pie
                          data={expenseByCatArr}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          innerRadius={40}
                          label={(e: { percent?: number }) => e.percent ? `${(e.percent * 100).toFixed(0)}%` : ""}
                          labelLine={false}
                        >
                          {expenseByCatArr.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            direction: "rtl",
                            borderRadius: "12px",
                            border: "1px solid hsl(var(--border))",
                            background: "hsl(var(--popover))",
                            color: "hsl(var(--popover-foreground))",
                          }}
                          formatter={((v: number) => [formatDA(v), "المبلغ"]) as never}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 w-full space-y-1.5 max-h-[220px] overflow-y-auto">
                      {expenseByCatArr.map((c, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span
                            className="h-3 w-3 rounded-sm shrink-0"
                            style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                          <span className="flex-1 truncate text-foreground">{c.name}</span>
                          <span className="font-bold tabular-nums text-foreground">{formatDA(c.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ─── BarChart: income by category ─── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                المداخيل حسب الفئة
              </CardTitle>
              <CardDescription>تفصيل المداخيل لكل نوع</CardDescription>
            </CardHeader>
            <CardContent>
              {incomeByCatArr.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                  لا توجد مداخيل بعد
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={incomeByCatArr} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} reversed />
                    <YAxis tick={{ fontSize: 11 }} orientation="right" tickFormatter={formatShort} />
                    <Tooltip
                      contentStyle={{
                        direction: "rtl",
                        borderRadius: "12px",
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--popover))",
                        color: "hsl(var(--popover-foreground))",
                      }}
                      formatter={((v: number) => [formatDA(v), "المبلغ"]) as never}
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} name="value">
                      {incomeByCatArr.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* ─── Last transactions + Top expenses ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Last 10 transactions */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Receipt className="h-4 w-4 text-primary" />
                  آخر العمليات (10)
                </CardTitle>
                {onViewAllTransactions && (
                  <Button size="sm" variant="ghost" onClick={onViewAllTransactions} className="text-primary">
                    عرض الكل
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {data.lastTransactions.length === 0 ? (
                  <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                    لا توجد عمليات بعد
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto -mx-2">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="text-xs">النوع</TableHead>
                          <TableHead className="text-xs">الفئة</TableHead>
                          <TableHead className="text-xs text-left">المبلغ</TableHead>
                          <TableHead className="text-xs">التاريخ</TableHead>
                          <TableHead className="text-xs hidden sm:table-cell">الجهة</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.lastTransactions.map((t) => (
                          <TableRow key={t.id} className="border-border/40">
                            <TableCell>
                              <Badge
                                className={cn(
                                  "text-[10px]",
                                  t.type === "income"
                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                    : "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
                                )}
                              >
                                {t.type === "income" ? "مدخول" : "مصروف"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-foreground">
                              {CATEGORY_LABELS[t.category] || t.category}
                            </TableCell>
                            <TableCell className={cn(
                              "text-xs font-bold tabular-nums text-left",
                              t.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                            )}>
                              {t.type === "income" ? "+" : "-"}
                              {formatDA(t.amount)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{formatDate(t.date)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                              {t.payeeName || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top 5 expenses */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  أعلى 5 مصاريف
                </CardTitle>
                <CardDescription>الأكبر قيمةً</CardDescription>
              </CardHeader>
              <CardContent>
                {data.topExpenses.length === 0 ? (
                  <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                    لا توجد مصاريف بعد
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {data.topExpenses.map((e, i) => (
                      <TooltipProvider key={e.id}>
                        <UITooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2 rounded-lg border border-border/40 p-2 hover:bg-muted/40 transition-colors cursor-default">
                              <span className={cn(
                                "shrink-0 grid place-items-center h-6 w-6 rounded-md text-[10px] font-bold",
                                i === 0 && "bg-amber-500/20 text-amber-700 dark:text-amber-400",
                                i === 1 && "bg-slate-400/20 text-slate-600 dark:text-slate-300",
                                i === 2 && "bg-orange-700/20 text-orange-700 dark:text-orange-400",
                                i > 2 && "bg-muted text-muted-foreground"
                              )}>
                                {i + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate">
                                  {CATEGORY_LABELS[e.category] || e.category}
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {e.payeeName || formatDate(e.date)}
                                </p>
                              </div>
                              <span className="text-xs font-bold tabular-nums text-rose-600 dark:text-rose-400 shrink-0">
                                {formatDA(e.amount)}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="text-xs">
                            <p>{e.payeeName || "—"} • {formatDate(e.date)}</p>
                            {e.note && <p className="opacity-80 mt-1">{e.note}</p>}
                          </TooltipContent>
                        </UITooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  big = false,
  delay = 0,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "emerald" | "rose" | "sky" | "teal" | "amber" | "violet";
  big?: boolean;
  delay?: number;
}) {
  const toneClasses: Record<string, string> = {
    emerald: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
    rose: "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400",
    sky: "bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-400",
    teal: "bg-teal-500/10 border-teal-500/30 text-teal-700 dark:text-teal-400",
    amber: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400",
    violet: "bg-violet-500/10 border-violet-500/30 text-violet-700 dark:text-violet-400",
  };
  const iconBg: Record<string, string> = {
    emerald: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
    rose: "bg-rose-500/20 text-rose-700 dark:text-rose-400",
    sky: "bg-sky-500/20 text-sky-700 dark:text-sky-400",
    teal: "bg-teal-500/20 text-teal-700 dark:text-teal-400",
    amber: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
    violet: "bg-violet-500/20 text-violet-700 dark:text-violet-400",
  };

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ delay }}
      className={cn(
        "rounded-xl border p-3 sm:p-4 flex flex-col gap-2 bg-card hover:shadow-md transition-shadow",
        toneClasses[tone],
        big && "sm:col-span-1 lg:col-span-1 sm:row-span-1"
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn("rounded-md p-1.5", iconBg[tone])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div>
        <p className={cn(
          "font-extrabold tabular-nums leading-tight",
          big ? "text-xl sm:text-2xl" : "text-base sm:text-lg"
        )}>
          {value}
        </p>
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-1">{label}</p>
      </div>
    </motion.div>
  );
}

function ComparisonCard({
  title,
  icon: Icon,
  tone,
  thisValue,
  lastValue,
  changePct,
  goodWhenUp,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "emerald" | "rose";
  thisValue: number;
  lastValue: number;
  changePct: number;
  goodWhenUp: boolean;
}) {
  const isUp = changePct >= 0;
  const isGood = goodWhenUp ? isUp : !isUp;

  const toneClasses = {
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-500/30" },
    rose: { bg: "bg-rose-500/10", text: "text-rose-700 dark:text-rose-400", border: "border-rose-500/30" },
  }[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("rounded-xl border p-4 bg-card", toneClasses.border)}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={cn("rounded-md p-1.5", toneClasses.bg, toneClasses.text)}>
            <Icon className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
        </div>
        <Badge
          className={cn(
            "text-[10px]",
            isGood
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
              : "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
          )}
        >
          {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {Math.abs(changePct).toFixed(1)}%
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className={cn("rounded-lg p-2.5", toneClasses.bg)}>
          <p className="text-[10px] text-muted-foreground mb-0.5">هذا الشهر</p>
          <p className={cn("text-lg font-bold tabular-nums", toneClasses.text)}>
            {formatDA(thisValue)}
          </p>
        </div>
        <div className="rounded-lg p-2.5 bg-muted/40">
          <p className="text-[10px] text-muted-foreground mb-0.5">الشهر الماضي</p>
          <p className="text-lg font-bold tabular-nums text-foreground">
            {formatDA(lastValue)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground">
        <ArrowRight className="h-3 w-3" />
        <span>الفرق: {formatDA(Math.abs(thisValue - lastValue))}</span>
        <span className={isGood ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
          ({isGood ? "إيجابي" : "سلبي"})
        </span>
      </div>
    </motion.div>
  );
}

function PeriodMiniCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "sky" | "teal" | "emerald" | "violet";
}) {
  const toneClasses = {
    sky: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30",
    teal: "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/30",
    emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    violet: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30",
  }[tone];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn("rounded-xl border p-3 flex items-center gap-3 bg-card", toneClasses)}
    >
      <span className={cn("rounded-md p-2 bg-card/50", toneClasses)}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground truncate">{label}</p>
        <p className="text-sm font-bold tabular-nums">{formatDA(value)}</p>
      </div>
    </motion.div>
  );
}

function EmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center gap-4 py-16"
    >
      <div className="rounded-full bg-muted p-6">
        <Wallet className="h-10 w-10 text-muted-foreground" />
      </div>
      <div className="text-center max-w-md">
        <p className="font-bold text-foreground text-lg">لا توجد بيانات مالية بعد</p>
        <p className="text-sm text-muted-foreground mt-1">
          ابدأ بتسجيل أول عملية مالية (مدخول أو مصروف) لعرض الإحصائيات والرسوم البيانية هنا.
        </p>
      </div>
      <Button onClick={onRefresh} variant="outline">
        <RefreshCw className="h-4 w-4" />
        تحديث
      </Button>
    </motion.div>
  );
}

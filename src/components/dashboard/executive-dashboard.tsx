"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Wallet, Landmark, TrendingUp, TrendingDown, ArrowRightLeft,
  Users, UserCheck, RefreshCw, Clock, Waves, ShieldCheck,
  Building2, Ban, ChevronLeft, ArrowUpRight, ArrowDownRight,
  Activity, Sparkles, CheckCircle2, AlertTriangle, FileText,
  CreditCard, Banknote, Calendar, Zap, Eye, BarChart3,
} from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/components/financial/labels";

interface ExecutiveDashboardProps {
  sessionUser: { name: string; role: string } | null;
  finSummary: any;
  stats: any;
  activities: any[];
  onNavigateTab: (tab: string) => void;
  onQuickTx: () => void;
  onRefreshFinancial: () => void;
  finPeriod: "today" | "week" | "month";
  onFinPeriodChange: (p: "today" | "week" | "month") => void;
}

export function ExecutiveDashboard({
  sessionUser,
  finSummary,
  stats,
  activities,
  onNavigateTab,
  onQuickTx,
  onRefreshFinancial,
  finPeriod,
  onFinPeriodChange,
}: ExecutiveDashboardProps) {
  // Chart Granularity: "day" | "week" | "month" | "year"
  const [chartRange, setChartRange] = useState<"day" | "week" | "month" | "year">("month");
  const [activityTab, setActivityTab] = useState<"all" | "financial" | "subscribers" | "renewals">("all");

  // ─── Section A: Financial KPIs ───
  const currentBalance = finSummary?.balance.balance ?? 0;
  const totalIncome = finSummary?.balance.totalIncome ?? 0;
  const totalExpense = finSummary?.balance.totalExpense ?? 0;
  const receivables = finSummary?.receivables?.total ?? 0;
  const payables = finSummary?.payables?.total ?? 0;
  const cancelledTotal = finSummary?.cancelled?.total ?? 0;
  const cancelledCount = finSummary?.cancelled?.count ?? 0;

  // ─── Section B: Cash Flow Chart Data ───
  const chartData = useMemo(() => {
    if (!finSummary) return [];

    if (chartRange === "month" || chartRange === "year") {
      // Use 6-month historical trend
      if (finSummary.chartData && finSummary.chartData.length > 0) {
        return finSummary.chartData.map((d: any) => ({
          name: d.month,
          income: d.income,
          expense: d.expense,
          net: d.income - d.expense,
        }));
      }
    }

    // Use flow buckets if available
    if (finSummary.flow?.buckets && finSummary.flow.buckets.length > 0) {
      return finSummary.flow.buckets.map((b: any) => ({
        name: b.label,
        income: b.income,
        expense: b.expense,
        net: b.net,
      }));
    }

    return [];
  }, [finSummary, chartRange]);

  // ─── Section C: Income Sources (100% Balanced) ───
  const incomeCategories = useMemo(() => {
    if (!finSummary?.balance?.incomeByCategory) return [];
    const catMap = finSummary.balance.incomeByCategory as Record<string, number>;
    const entries = Object.entries(catMap).map(([key, amount]) => {
      const pct = totalIncome > 0 ? Math.round((amount / totalIncome) * 1000) / 10 : 0;
      return {
        key,
        label: CATEGORY_LABELS[key] || key,
        amount,
        percentage: pct,
      };
    });
    return entries.sort((a, b) => b.amount - a.amount);
  }, [finSummary, totalIncome]);

  const incomeSumOfCategories = incomeCategories.reduce((acc, c) => acc + c.amount, 0);
  const isIncomeBalanced = totalIncome === incomeSumOfCategories;

  // ─── Section D: Operational Stats ───
  const totalSubscribers = stats?.total ?? 0;
  const activePaidSubscribers = stats?.paid ?? 0;
  const renewedCount = stats?.byRenewalStatus?.find((r: any) => r.status === "سارية")?.count ?? 0;
  const expiringCount = stats?.byRenewalStatus?.find((r: any) => r.status === "قريبة الانتهاء")?.count ?? 0;
  const expiredCount = stats?.byRenewalStatus?.find((r: any) => r.status === "منتهية")?.count ?? 0;
  const todaySessions = stats?.pool?.todaySessions ?? 0;
  const todayWorkHours = stats?.pool?.todayWorkHours ?? 0;
  const activeWorkers = stats?.workers?.activeEmployees ?? stats?.pool?.activeLifeguardsToday ?? 0;
  const approvedHoursMonth = stats?.workers?.approvedHoursMonth ?? 0;

  // ─── Section E: Filtered Activities ───
  const filteredActivities = useMemo(() => {
    if (activityTab === "all") return activities.slice(0, 8);
    if (activityTab === "financial") {
      return activities.filter((a) => a.type?.includes("financial") || a.type?.includes("wage") || a.type?.includes("payment")).slice(0, 8);
    }
    if (activityTab === "renewals") {
      return activities.filter((a) => a.type?.includes("renewal")).slice(0, 8);
    }
    return activities.filter((a) => a.type?.includes("subscriber") || a.type?.includes("registration")).slice(0, 8);
  }, [activities, activityTab]);

  return (
    <div dir="rtl" className="space-y-6">
      {/* ═══ Header Banner ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-teal-700 via-sky-800 to-indigo-900 p-6 text-white shadow-lg"
      >
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
                لوحة التحكم التنفيذية — ماذا يحدث في النادي الآن؟
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black">مرحباً {sessionUser?.name}</h2>
            <p className="text-xs sm:text-sm text-white/80 max-w-xl">
              نظرة عامة فورية على الحركة المالية، الأداء التشغيلي، واشتراكات المنخرطين من مصدر الحقيقة المالي الموحد
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              size="sm"
              onClick={onQuickTx}
              className="bg-white text-teal-900 hover:bg-white/90 font-bold text-xs h-9 gap-1.5 shadow-sm"
            >
              <ArrowRightLeft className="h-4 w-4" /> حركة سريعة
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onNavigateTab("financial-hub")}
              className="bg-white/10 hover:bg-white/20 text-white border-white/30 font-bold text-xs h-9 gap-1.5"
            >
              <Landmark className="h-4 w-4" /> المركز المالي ←
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ═══ SECTION A: المؤشرات المالية الرئيسية (Financial KPIs) ═══ */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-foreground flex items-center gap-2">
            <Landmark className="h-4 w-4 text-teal-600" />
            المؤشرات المالية الرئيسية (الدفتر المالي الموحد)
          </h3>
          <button
            onClick={() => onNavigateTab("financial-hub")}
            className="text-xs font-bold text-teal-600 hover:underline flex items-center gap-0.5"
          >
            عرض التفاصيل المحاسبية ←
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* 1: الرصيد الحالي */}
          <div className="rounded-2xl border border-teal-500/30 bg-teal-500/10 p-3.5 space-y-1">
            <span className="text-[11px] font-bold text-teal-800 dark:text-teal-300 truncate block">
              الرصيد الحالي (الدفتر)
            </span>
            <div className="text-xl sm:text-2xl font-black text-teal-700 dark:text-teal-400 tabular-nums">
              {currentBalance.toLocaleString()} <span className="text-xs font-normal">دج</span>
            </div>
            <span className="text-[10px] text-muted-foreground block">
              السيولة المتاحة فعلياً
            </span>
          </div>

          {/* 2: إجمالي المداخيل */}
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-1">
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 truncate block">
              إجمالي المداخيل
            </span>
            <div className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
              {totalIncome.toLocaleString()} <span className="text-xs font-normal">دج</span>
            </div>
            <span className="text-[10px] text-muted-foreground block">
              المحصل من جميع الفئات
            </span>
          </div>

          {/* 3: إجمالي المصاريف */}
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 space-y-1">
            <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300 truncate block">
              إجمالي المصاريف
            </span>
            <div className="text-xl sm:text-2xl font-black text-rose-700 dark:text-rose-400 tabular-nums">
              {totalExpense.toLocaleString()} <span className="text-xs font-normal">دج</span>
            </div>
            <span className="text-[10px] text-muted-foreground block">
              أجور، صيانة، نفقات
            </span>
          </div>

          {/* 4: المستحقات للنادي */}
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-1">
            <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 truncate block">
              مستحقات على المنخرطين
            </span>
            <div className="text-xl sm:text-2xl font-black text-amber-700 dark:text-amber-400 tabular-nums">
              {receivables.toLocaleString()} <span className="text-xs font-normal">دج</span>
            </div>
            <span className="text-[10px] text-muted-foreground block">
              اشتراكات غير محصلة
            </span>
          </div>

          {/* 5: الالتزامات على النادي */}
          <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-3.5 space-y-1">
            <span className="text-[11px] font-bold text-indigo-800 dark:text-indigo-300 truncate block">
              التزامات وأجور معلقة
            </span>
            <div className="text-xl sm:text-2xl font-black text-indigo-700 dark:text-indigo-400 tabular-nums">
              {payables.toLocaleString()} <span className="text-xs font-normal">دج</span>
            </div>
            <span className="text-[10px] text-muted-foreground block">
              أجور عمال مستحقة
            </span>
          </div>

          {/* 6: العمليات الملغاة */}
          <div className="rounded-2xl border border-slate-500/30 bg-slate-500/10 p-3.5 space-y-1">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate block">
              العمليات الملغاة
            </span>
            <div className="text-xl sm:text-2xl font-black text-slate-600 dark:text-slate-400 tabular-nums">
              {cancelledTotal.toLocaleString()} <span className="text-xs font-normal">دج</span>
            </div>
            <span className="text-[10px] text-muted-foreground block">
              {cancelledCount} قيود مستبعدة
            </span>
          </div>
        </div>
      </section>

      {/* ═══ SECTION B & C: الحركة المالية + مصادر المداخيل ═══ */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* SECTION B: Cash Flow Chart (7 cols) */}
        <Card className="lg:col-span-7 border-border/80 shadow-xs">
          <CardHeader className="pb-2 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-black flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-teal-600" />
                  الحركة والتدفق المالي (المداخيل، المصاريف، الصافي)
                </CardTitle>
                <CardDescription className="text-xs">
                  مقارنة السيولة المتدفقة والخارجة لتحديد فائض/عجز النادي
                </CardDescription>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="flex items-center bg-muted/60 border border-border/60 rounded-lg p-0.5 text-[11px]">
                  {(["day", "week", "month", "year"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setChartRange(r)}
                      className={cn(
                        "px-2 py-0.5 rounded-md font-bold transition",
                        chartRange === r ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {r === "day" ? "يوم" : r === "week" ? "أسبوع" : r === "month" ? "شهر" : "سنة"}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => onNavigateTab("financial-hub")}
                  className="text-xs text-teal-600 hover:underline font-bold"
                  title="عرض دفتر القيود"
                >
                  الدفتر ←
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="h-64 w-full">
              {chartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                  لا توجد حركات كافية لرسم المخطط في هذه الفترة
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(val: any, name?: any) => [
                        `${Number(val).toLocaleString()} دج`,
                        name === "income" ? "المداخيل" : name === "expense" ? "المصاريف" : "الصافي",
                      ]}
                    />
                    <Bar dataKey="income" name="income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="expense" name="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Line type="monotone" dataKey="net" name="net" stroke="#0d9488" strokeWidth={2.5} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="flex items-center justify-center gap-6 pt-2 text-xs border-t mt-2">
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold">
                <span className="h-3 w-3 rounded-sm bg-emerald-500 inline-block" /> المداخيل
              </span>
              <span className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-bold">
                <span className="h-3 w-3 rounded-sm bg-rose-500 inline-block" /> المصاريف
              </span>
              <span className="flex items-center gap-1.5 text-teal-700 dark:text-teal-400 font-bold">
                <span className="h-3 w-3 rounded-full bg-teal-600 inline-block" /> الصافي
              </span>
            </div>
          </CardContent>
        </Card>

        {/* SECTION C: Income Sources (5 cols) */}
        <Card className="lg:col-span-5 border-border/80 shadow-xs">
          <CardHeader className="pb-2 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-black flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  مصادر المداخيل (تطابق 100%)
                </CardTitle>
                <CardDescription className="text-xs">
                  الاشتراكات، التجديدات، التأمين، وحقوق المركب
                </CardDescription>
              </div>
              <button
                onClick={() => onNavigateTab("financial-hub")}
                className="text-xs text-teal-600 hover:underline font-bold"
              >
                التحليل الكامل ←
              </button>
            </div>
          </CardHeader>

          <CardContent className="pt-3 space-y-3">
            {incomeCategories.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                لا توجد مداخيل مسجلة
              </div>
            ) : (
              incomeCategories.map((cat) => (
                <div key={cat.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      {cat.key === "subscription" ? "📋" : cat.key === "renewal" ? "🔄" : cat.key === "insurance" ? "🛡️" : cat.key === "compound" || cat.key === "compound_rights" ? "🏛️" : "💰"}
                      {cat.label}
                    </span>
                    <span className="font-black text-foreground tabular-nums">
                      {cat.amount.toLocaleString()} دج ({cat.percentage}%)
                    </span>
                  </div>
                  <Progress value={cat.percentage} className="h-2 bg-muted" />
                </div>
              ))
            )}

            <div className="pt-2 border-t flex items-center justify-between text-xs">
              <span className="font-extrabold text-foreground">الإجمالي الشامل المحصل:</span>
              <span className="font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                {totalIncome.toLocaleString()} دج
              </span>
            </div>
            {isIncomeBalanced && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>مجموع المصادر يطابق إجمالي الدفتر تماماً وبلا أي تقدير.</span>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ═══ SECTION D: الإحصائيات التشغيلية (Operational Stats) ═══ */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-teal-600" />
            الإحصائيات التشغيلية (المسبح والمنخرطون والعمال)
          </h3>
          <div className="flex items-center gap-3 text-xs">
            <button onClick={() => onNavigateTab("subscribers")} className="text-teal-600 hover:underline font-bold">
              المنخرطون ←
            </button>
            <button onClick={() => onNavigateTab("attendance")} className="text-teal-600 hover:underline font-bold">
              الحضور ←
            </button>
            <button onClick={() => onNavigateTab("work-hours")} className="text-teal-600 hover:underline font-bold">
              ساعات العمل ←
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          <div className="rounded-2xl border border-border/70 bg-card p-3 space-y-1">
            <span className="text-[10px] text-muted-foreground block truncate">إجمالي المنخرطين</span>
            <div className="text-xl font-black text-foreground tabular-nums">{totalSubscribers}</div>
            <span className="text-[10px] text-teal-600 font-bold block">ملفات مسجلة</span>
          </div>

          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1">
            <span className="text-[10px] text-muted-foreground block truncate">المشتركون النشطون</span>
            <div className="text-xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">{activePaidSubscribers}</div>
            <span className="text-[10px] text-emerald-600 font-bold block">اشتراك ساري</span>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-3 space-y-1">
            <span className="text-[10px] text-muted-foreground block truncate">التجديدات السارية</span>
            <div className="text-xl font-black text-sky-600 tabular-nums">{renewedCount}</div>
            <span className="text-[10px] text-muted-foreground block">مجدد هذا الشهر</span>
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
            <span className="text-[10px] text-muted-foreground block truncate">تجديدات قريبة الانتهاء</span>
            <div className="text-xl font-black text-amber-600 tabular-nums">{expiringCount}</div>
            <span className="text-[10px] text-amber-700 font-bold block">بحاجة للتجديد</span>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-3 space-y-1">
            <span className="text-[10px] text-muted-foreground block truncate">جلسات اليوم</span>
            <div className="text-xl font-black text-foreground tabular-nums">{todaySessions}</div>
            <span className="text-[10px] text-teal-600 font-bold block">جلسة مسبح</span>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-3 space-y-1">
            <span className="text-[10px] text-muted-foreground block truncate">عدد العمال</span>
            <div className="text-xl font-black text-foreground tabular-nums">{activeWorkers}</div>
            <span className="text-[10px] text-muted-foreground block">موظف / مدرب</span>
          </div>

          <div className="rounded-2xl border border-teal-500/30 bg-teal-500/5 p-3 space-y-1">
            <span className="text-[10px] text-muted-foreground block truncate">ساعات العمل</span>
            <div className="text-xl font-black text-teal-700 dark:text-teal-400 tabular-nums">{approvedHoursMonth} سا</div>
            <span className="text-[10px] text-teal-700 font-bold block">ساعات معتمدة</span>
          </div>
        </div>
      </section>

      {/* ═══ SECTION E: آخر النشاطات (Recent Activities) ═══ */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-2 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-black flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                آخر النشاطات والحركات بالنادي
              </CardTitle>
              <CardDescription className="text-xs">
                متابعة لحظية لآخر العمليات المالية، التسجيلات، التجديدات، ودفعات الأجور
              </CardDescription>
            </div>

            <div className="flex items-center gap-1 bg-muted/60 border border-border/60 rounded-xl p-1 text-xs">
              <button
                onClick={() => setActivityTab("all")}
                className={cn("px-2.5 py-1 rounded-lg font-bold transition", activityTab === "all" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground")}
              >
                الكل
              </button>
              <button
                onClick={() => setActivityTab("financial")}
                className={cn("px-2.5 py-1 rounded-lg font-bold transition", activityTab === "financial" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground")}
              >
                المالية
              </button>
              <button
                onClick={() => setActivityTab("subscribers")}
                className={cn("px-2.5 py-1 rounded-lg font-bold transition", activityTab === "subscribers" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground")}
              >
                التسجيلات
              </button>
              <button
                onClick={() => setActivityTab("renewals")}
                className={cn("px-2.5 py-1 rounded-lg font-bold transition", activityTab === "renewals" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground")}
              >
                التجديدات
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-3">
          {filteredActivities.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              لا توجد نشاطات مسجلة مؤخراً
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filteredActivities.map((act) => (
                <div
                  key={act.id}
                  className="flex items-start gap-2.5 p-2.5 rounded-xl border border-border/60 hover:bg-accent/40 transition text-xs"
                >
                  <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5 font-bold">
                    {act.type?.includes("financial") ? "💰" : act.type?.includes("renewal") ? "🔄" : "👤"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground/90 leading-tight line-clamp-2">
                      {act.description}
                    </p>
                    <span className="text-[10px] text-muted-foreground mt-0.5 block">
                      {new Date(act.createdAt).toLocaleString("ar-DZ", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 pt-2 border-t flex items-center justify-between text-xs">
            <span className="text-muted-foreground">عرض المزيد من التفاصيل التاريخية:</span>
            <div className="flex items-center gap-3">
              <button onClick={() => onNavigateTab("financial-hub")} className="text-teal-600 font-bold hover:underline">
                دفتر العمليات المالية ←
              </button>
              <button onClick={() => onNavigateTab("renewal")} className="text-teal-600 font-bold hover:underline">
                سجل التجديدات ←
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

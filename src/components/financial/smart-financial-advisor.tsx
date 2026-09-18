"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Coins,
  Scale,
  Activity,
  ArrowUpRight,
  Info,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface SmartAdvisorProps {
  balance: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    incomeByCategory: Record<string, number>;
    expenseByCategory: Record<string, number>;
  };
  monthlyComparison?: {
    thisMonthIncome: number;
    lastMonthIncome: number;
    thisMonthExpense: number;
    lastMonthExpense: number;
    netThisMonth: number;
  };
  realAvailable?: number;
  receivables?: {
    subscription: number;
    insurance: number;
    compound: number;
    total: number;
  };
  payables?: {
    wages: number;
    total: number;
  };
}

function formatDA(n: number): string {
  return new Intl.NumberFormat("fr-DZ").format(Math.round(n)) + " دج";
}

export function SmartFinancialAdvisor({
  balance,
  monthlyComparison,
  realAvailable = balance.balance,
  receivables,
  payables,
}: SmartAdvisorProps) {
  const analysis = useMemo(() => {
    const totalInc = balance.totalIncome || 0;
    const totalExp = balance.totalExpense || 0;
    const net = balance.balance || 0;

    // Monthly baseline
    const thisMonthExp = monthlyComparison?.thisMonthExpense || totalExp || 1;
    const thisMonthInc = monthlyComparison?.thisMonthIncome || totalInc || 0;
    const netMonth = monthlyComparison?.netThisMonth ?? (thisMonthInc - thisMonthExp);

    // Monthly fixed expenses estimate (Wages + compound rights + maintenance)
    const wagesExp = balance.expenseByCategory["wages"] || 0;
    const compoundExp = balance.expenseByCategory["compound_rights"] || 0;
    const maintExp = balance.expenseByCategory["maintenance"] || 0;
    const fixedExpensesEstimate = Math.max(1, wagesExp + compoundExp + maintExp || (thisMonthExp * 0.7));

    // Subscription & renewal income
    const subIncome =
      (balance.incomeByCategory["subscription"] || 0) +
      (balance.incomeByCategory["renewal"] || 0);

    // Break-even coverage ratio (%)
    const breakEvenRatio = Math.min(250, Math.round((subIncome / fixedExpensesEstimate) * 100));

    // Runway months (how long real available cash lasts based on this month's burn rate)
    const effectiveBurn = Math.max(1000, thisMonthExp > 0 ? thisMonthExp : totalExp / 3);
    const runwayMonths = Math.max(0, Number((realAvailable / effectiveBurn).toFixed(1)));

    // Runway status tone
    let runwayTone: "safe" | "warning" | "danger" = "safe";
    if (runwayMonths < 1) runwayTone = "danger";
    else if (runwayMonths < 2.5) runwayTone = "warning";

    // Receivable risk
    const totalReceivables = receivables?.total || 0;
    const receivableRatio = thisMonthInc > 0 ? Math.round((totalReceivables / thisMonthInc) * 100) : 0;

    // Expense concentration
    const highestExpenseCat = Object.entries(balance.expenseByCategory).sort(
      ([, a], [, b]) => b - a
    )[0];
    const highestExpensePct =
      highestExpenseCat && totalExp > 0
        ? Math.round((highestExpenseCat[1] / totalExp) * 100)
        : 0;

    // Net Margin %
    const marginPct = totalInc > 0 ? Math.round((net / totalInc) * 100) : 0;

    // Executive bullets
    const insights: Array<{
      type: "success" | "warning" | "info";
      title: string;
      text: string;
    }> = [];

    if (netMonth >= 0) {
      insights.push({
        type: "success",
        title: "فائض تشغيلي إيجابي",
        text: `يحقق النادي فائضاً نقدياً بمقدار ${formatDA(netMonth)} هذا الشهر بهامش ربحية ${marginPct}%. التدفقات كافية لتغطية التكاليف الحالية.`,
      });
    } else {
      insights.push({
        type: "warning",
        title: "عجز تشغيلي مؤقت",
        text: `المصاريف تتجاوز المداخيل بمقدار ${formatDA(Math.abs(netMonth))} هذا الشهر. يُنصح بتسريع وتيرة تحصيل الاشتراكات المتأخرة.`,
      });
    }

    if (runwayMonths >= 3) {
      insights.push({
        type: "success",
        title: "احتياطي سيولة متين",
        text: `السيولة الصافية الحالية (${formatDA(realAvailable)}) تكفي لتغطية المصاريف التشغيلية لمدة ${runwayMonths} شهراً دون مدخول إضافي.`,
      });
    } else if (runwayMonths >= 1) {
      insights.push({
        type: "warning",
        title: "مدرج سيولة متوسط",
        text: `الاحتياطي النقدي يغطي نحو ${runwayMonths} شهر من المصاريف. يستحسن ضبط وتيرة المصاريف الرأسمالية.`,
      });
    } else {
      insights.push({
        type: "warning",
        title: "تنبيه سيولة نقدية",
        text: `السيولة الحرة (${formatDA(realAvailable)}) تغطي أقل من شهر من المصاريف بعد خصم الالتزامات. الأولوية للتحصيل النقدي الفوري.`,
      });
    }

    if (totalReceivables > 15000) {
      insights.push({
        type: "warning",
        title: "مستحقات معلقة قابلة للتحصيل",
        text: `توجد ديون واشتراكات غير مسددة بقيمة ${formatDA(totalReceivables)} (${receivableRatio}% من مداخيل الشهر). تحصيلها سيرفع الرصيد بشكل مباشر.`,
      });
    }

    if (highestExpensePct >= 50 && highestExpenseCat) {
      insights.push({
        type: "info",
        title: "تركز في بنود الصرف",
        text: `بند (${highestExpenseCat[0] === "wages" ? "أجور العمال" : highestExpenseCat[0]}) يستحوذ على ${highestExpensePct}% من إجمالي المصاريف.`,
      });
    }

    return {
      breakEvenRatio,
      runwayMonths,
      runwayTone,
      marginPct,
      insights,
      totalReceivables,
    };
  }, [balance, monthlyComparison, realAvailable, receivables, payables]);

  return (
    <Card className="overflow-hidden border-teal-500/25 bg-gradient-to-br from-card via-card to-teal-950/10 shadow-sm">
      <CardHeader className="p-4 sm:p-5 border-b border-border/50 bg-muted/20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-teal-600/10 border border-teal-500/30 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm sm:text-base font-extrabold flex items-center gap-2">
                المحلل المالي الذكي ومؤشرات السلامة
                <Badge variant="outline" className="text-[10px] border-teal-500/30 text-teal-600 dark:text-teal-400 bg-teal-500/5">
                  تحليل لحظي
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                قراءة تنفيذية آلية لسيولة النادي ونقطة التعادل ومدرج الأمان
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* ─── 3 بطاقات مؤشرات ذكية ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* مؤشر نقطة التعادل */}
          <div className="p-3.5 rounded-xl border border-border/70 bg-background/60 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                <Scale className="h-4 w-4 text-sky-500" />
                تغطية المصاريف الثابتة
              </span>
              <span className={cn(
                "font-bold tabular-nums text-xs px-1.5 py-0.5 rounded",
                analysis.breakEvenRatio >= 100
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              )}>
                {analysis.breakEvenRatio}%
              </span>
            </div>
            <Progress value={Math.min(100, analysis.breakEvenRatio)} className="h-2" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              {analysis.breakEvenRatio >= 100
                ? "✓ إيرادات الاشتراكات تغطي بالكامل الأجور وحقوق المركب."
                : "الحاجة إلى توسيع قاعدة الاشتراكات لتغطية الالتزامات الثابتة."}
            </p>
          </div>

          {/* مدرج السيولة */}
          <div className="p-3.5 rounded-xl border border-border/70 bg-background/60 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                <Activity className="h-4 w-4 text-teal-500" />
                مدرج السيولة والأمان
              </span>
              <span className={cn(
                "font-bold tabular-nums text-xs px-1.5 py-0.5 rounded",
                analysis.runwayTone === "safe"
                  ? "bg-teal-500/10 text-teal-600 dark:text-teal-400"
                  : analysis.runwayTone === "warning"
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              )}>
                {analysis.runwayMonths} أشهر
              </span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  analysis.runwayTone === "safe" ? "bg-teal-500" : analysis.runwayTone === "warning" ? "bg-amber-500" : "bg-rose-500"
                )}
                style={{ width: `${Math.min(100, (analysis.runwayMonths / 6) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              المدة التقديرية لصمود الخزينة بالرصيد المتاح حالياً دون مدخول.
            </p>
          </div>

          {/* هامش الأداء والتحصيل */}
          <div className="p-3.5 rounded-xl border border-border/70 bg-background/60 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                <Coins className="h-4 w-4 text-amber-500" />
                هامش الربحية الإجمالي
              </span>
              <span className={cn(
                "font-bold tabular-nums text-xs px-1.5 py-0.5 rounded",
                analysis.marginPct >= 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              )}>
                {analysis.marginPct}%
              </span>
            </div>
            <Progress
              value={Math.max(0, Math.min(100, analysis.marginPct))}
              className="h-2"
            />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              نسبة الفائض النقدي المتبقي بعد تسوية كافة مصاريف النادي.
            </p>
          </div>
        </div>

        {/* ─── الملاحظات التنفيذية الذكية ─── */}
        <div className="space-y-2 pt-1">
          <div className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            التوجيهات والتوصيات المالية:
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {analysis.insights.map((insight, idx) => (
              <div
                key={idx}
                className={cn(
                  "p-3 rounded-lg border text-xs flex items-start gap-2.5 transition-colors",
                  insight.type === "success"
                    ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-950 dark:text-emerald-100"
                    : insight.type === "warning"
                    ? "border-amber-500/25 bg-amber-500/5 text-amber-950 dark:text-amber-100"
                    : "border-sky-500/20 bg-sky-500/5 text-sky-950 dark:text-sky-100"
                )}
              >
                {insight.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : insight.type === "warning" ? (
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <Info className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="font-bold text-xs">{insight.title}</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                    {insight.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Calculator,
  TrendingUp,
  Users,
  Banknote,
  Percent,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface SimulatorProps {
  currentMonthlyIncome?: number;
  currentMonthlyExpense?: number;
  totalSubscribers?: number;
}

function formatDA(n: number): string {
  return new Intl.NumberFormat("fr-DZ").format(Math.round(n)) + " دج";
}

export function FinancialSimulator({
  currentMonthlyIncome = 150000,
  currentMonthlyExpense = 80000,
  totalSubscribers = 50,
}: SimulatorProps) {
  // Simulator states
  const [memberDelta, setMemberDelta] = useState<number>(20); // +20 members
  const [avgPrice, setAvgPrice] = useState<number>(3000); // 3000 DZD
  const [expenseModPct, setExpenseModPct] = useState<number>(0); // 0% change

  const baselineNet = currentMonthlyIncome - currentMonthlyExpense;

  const simulation = useMemo(() => {
    // Additional income from member change
    const deltaIncome = memberDelta * avgPrice;
    const projectedIncome = Math.max(0, currentMonthlyIncome + deltaIncome);

    // Modified expenses
    const projectedExpense = Math.max(
      0,
      Math.round(currentMonthlyExpense * (1 + expenseModPct / 100))
    );

    const projectedMonthlyNet = projectedIncome - projectedExpense;
    const monthlyNetGain = projectedMonthlyNet - baselineNet;
    const yearlyNetGain = monthlyNetGain * 12;

    return {
      projectedIncome,
      projectedExpense,
      projectedMonthlyNet,
      monthlyNetGain,
      yearlyNetGain,
    };
  }, [
    currentMonthlyIncome,
    currentMonthlyExpense,
    memberDelta,
    avgPrice,
    expenseModPct,
    baselineNet,
  ]);

  const resetDefaults = () => {
    setMemberDelta(20);
    setAvgPrice(3000);
    setExpenseModPct(0);
  };

  return (
    <Card className="overflow-hidden border-sky-500/20 bg-gradient-to-br from-card via-card to-sky-950/10 shadow-sm">
      <CardHeader className="p-4 sm:p-5 border-b border-border/50 bg-muted/20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-sky-600/10 border border-sky-500/30 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm sm:text-base font-extrabold flex items-center gap-2">
                محاكي النمو والتوقعات المالية
                <Badge variant="outline" className="text-[10px] border-sky-500/30 text-sky-600 dark:text-sky-400 bg-sky-500/5">
                  أداة اتخاذ القرار
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                اختبر أثر زيادة المشتركين وتعديل الأسعار وترشيد المصاريف على الفائض المالي
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetDefaults}
            className="h-8 text-xs text-muted-foreground gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            إعادة ضبط
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-6">
        {/* ─── المزالق التفاعلية ─── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* مزلاق عدد المشتركين */}
          <div className="space-y-2.5 p-3.5 rounded-xl border border-border/60 bg-background/50">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                <Users className="h-4 w-4 text-sky-500" />
                تغيير عدد المشتركين
              </span>
              <span className="font-bold tabular-nums text-foreground bg-muted px-2 py-0.5 rounded">
                {memberDelta > 0 ? `+${memberDelta}` : memberDelta} مشترك
              </span>
            </div>
            <Slider
              value={[memberDelta]}
              min={-50}
              max={100}
              step={5}
              onValueChange={(val) => setMemberDelta(val[0])}
              className="py-1 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>-50</span>
              <span>0</span>
              <span>+100</span>
            </div>
          </div>

          {/* مزلاق متوسط سعر الاشتراك */}
          <div className="space-y-2.5 p-3.5 rounded-xl border border-border/60 bg-background/50">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                <Banknote className="h-4 w-4 text-teal-500" />
                متوسط سعر الاشتراك
              </span>
              <span className="font-bold tabular-nums text-foreground bg-muted px-2 py-0.5 rounded">
                {formatDA(avgPrice)}
              </span>
            </div>
            <Slider
              value={[avgPrice]}
              min={1500}
              max={7000}
              step={250}
              onValueChange={(val) => setAvgPrice(val[0])}
              className="py-1 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>1,500 دج</span>
              <span>4,000 دج</span>
              <span>7,000 دج</span>
            </div>
          </div>

          {/* مزلاق المصاريف التشغيلية */}
          <div className="space-y-2.5 p-3.5 rounded-xl border border-border/60 bg-background/50">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                <Percent className="h-4 w-4 text-amber-500" />
                تعديل المصاريف
              </span>
              <span className="font-bold tabular-nums text-foreground bg-muted px-2 py-0.5 rounded">
                {expenseModPct > 0 ? `+${expenseModPct}%` : `${expenseModPct}%`}
              </span>
            </div>
            <Slider
              value={[expenseModPct]}
              min={-30}
              max={30}
              step={5}
              onValueChange={(val) => setExpenseModPct(val[0])}
              className="py-1 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>-30% (ترشيد)</span>
              <span>0%</span>
              <span>+30% (توسع)</span>
            </div>
          </div>
        </div>

        {/* ─── بطاقات الأثر والنتائج ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* المداخيل المتوقعة */}
          <div className="p-4 rounded-xl border border-border/70 bg-background/80 space-y-1">
            <p className="text-[11px] text-muted-foreground">المداخيل الشهرية المتوقعة</p>
            <p className="text-lg sm:text-xl font-black tabular-nums text-sky-600 dark:text-sky-400">
              {formatDA(simulation.projectedIncome)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              الحالي: {formatDA(currentMonthlyIncome)}
            </p>
          </div>

          {/* الصافي الشهري الجديد */}
          <div className="p-4 rounded-xl border border-border/70 bg-background/80 space-y-1">
            <p className="text-[11px] text-muted-foreground">الصافي الشهري المتوقع</p>
            <p className={cn(
              "text-lg sm:text-xl font-black tabular-nums",
              simulation.projectedMonthlyNet >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            )}>
              {formatDA(simulation.projectedMonthlyNet)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              الحالي: {formatDA(baselineNet)}
            </p>
          </div>

          {/* الأثر التراكمي السنوي */}
          <div className="p-4 rounded-xl border border-teal-500/30 bg-teal-500/5 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-teal-700 dark:text-teal-300 font-semibold">
                الفارق الصافي السنوي
              </p>
              <Zap className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            </div>
            <p className={cn(
              "text-lg sm:text-xl font-black tabular-nums",
              simulation.yearlyNetGain >= 0
                ? "text-teal-600 dark:text-teal-400"
                : "text-rose-600 dark:text-rose-400"
            )}>
              {simulation.yearlyNetGain > 0 ? "+" : ""}{formatDA(simulation.yearlyNetGain)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {simulation.yearlyNetGain >= 0 ? "عائد سنوي إضافي للخزينة" : "انخفاض سنوي متوقع"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

/**
 * DashboardRevenueBlock — إيرادات المنخرطين من دفتر القيود حصراً
 * ═════════════════════════════════════════════════════════════
 * ★ المرحلة 5: أُزيل الاعتماد على /api/stats نهائياً.
 * كل الأرقام هنا من /api/financial/dashboard (دفتر FinancialTransaction — النشط فقط)
 * وتُمرَّر من النظرة العامة كـ props — لا جلب ثانٍ ولا حساب موازٍ:
 *
 *   المركز المالي  ←  نفس الدفتر  →  لوحة التحكم
 *
 * يشمل: التسجيلات (اشتراك+تجديد) • التأمين • حقوق المركب • إجمالي المداخيل
 * + رقائق: مدخول آخر / مستحقات غير محصّلة (من حالات الاشتراك — ليست إيراداً) / عدد الحركات
 */

import {
  Wallet, ShieldCheck, Waves, Banknote, Users, Landmark, UserRound, ArrowRightLeft,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export interface DashboardRevenueProps {
  /** إجمالي المداخيل من الدفتر (كل الفئات النشطة) */
  totalIncome: number;
  /** قيود subscription + renewal */
  subscription: number;
  /** قيود insurance */
  insurance: number;
  /** قيود compound */
  compound: number;
  /** قيود other_income */
  otherIncome: number;
  /** عدد عمليات كل فئة في الفترة المعروضة (للعرض) */
  counts?: { subscription: number; renewal: number; insurance: number; compound: number };
  /** إجمالي حركات الفترة */
  movementsCount?: number;
  /** مستحقات غير محصّلة — من حالات اشتراك المنخرطين (ليست إيراداً) */
  receivables?: { subscription: number; insurance: number; compound: number; total: number };
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function formatDA(n: number): string {
  return new Intl.NumberFormat("fr-DZ").format(Math.round(n)) + " دج";
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export function DashboardRevenueBlock({
  totalIncome,
  subscription,
  insurance,
  compound,
  otherIncome,
  counts,
  movementsCount,
  receivables,
}: DashboardRevenueProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
            <Users className="h-4 w-4 text-teal-600" />
            إيرادات المنخرطين — من الدفتر المالي
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 px-2 py-0.5 text-[10px] font-bold">
              <Landmark className="h-3 w-3" /> مصدر واحد للحقيقة
            </span>
          </CardTitle>
        </div>
        <CardDescription className="text-[11px]">
          كل رقم يُقرأ من دفتر القيود (العمليات النشطة) — نفس مصدر المركز المالي ولوحة التحكم والتقارير بلا أي حساب موازٍ
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* بطاقات الإيرادات — من الدفتر */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <RevenueTile
            icon={Wallet}
            label="التسجيلات (اشتراك+تجديد)"
            value={formatDA(subscription)}
            sublabel={counts ? `${counts.subscription + counts.renewal} عملية` : undefined}
            tone="teal"
          />
          <RevenueTile
            icon={ShieldCheck}
            label="التأمين المحصّل"
            value={formatDA(insurance)}
            sublabel={counts ? `${counts.insurance} عملية` : undefined}
            tone="emerald"
          />
          <RevenueTile
            icon={Waves}
            label="حقوق المركب المحصّلة"
            value={formatDA(compound)}
            sublabel={counts ? `${counts.compound} عملية` : undefined}
            tone="amber"
          />
          <RevenueTile
            icon={Banknote}
            label="إجمالي المداخيل"
            value={formatDA(totalIncome)}
            sublabel="اشتراكات + تأمين + مركب + أخرى"
            tone="strong"
          />
        </div>

        {/* رقائق الحصيلة */}
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <CountChip icon={Wallet} label="مدخول آخر" value={formatDA(otherIncome)} tone="slate" />
          {typeof movementsCount === "number" && (
            <CountChip icon={ArrowRightLeft} label="حركات الفترة" value={movementsCount} tone="teal" />
          )}
          {receivables && (
            <CountChip
              icon={UserRound}
              label="مستحقات غير محصّلة (منخرطون)"
              value={formatDA(receivables.total)}
              tone="amber"
            />
          )}
        </div>

        {/* توضيح المحاسبي */}
        <div className="rounded-xl border border-border/60 bg-muted/40 p-2.5 flex items-start gap-2">
          <Landmark className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            <span className="font-extrabold text-foreground">مصدر واحد للحقيقة: </span>
            تسجيل منخرط جديد مدفوع، تجديد، تأمين، حقوق مركب، أجور عمال، ومصاريف — كلها تُرحَّل تلقائياً إلى نفس الدفتر،
            وكل صفحة في النظام تقرأ من عندها. «مستحقات غير محصّلة» تُحسب من حالات اشتراك المنخرطين وتُعرض كالتزامات
            عليهم — ليست إيراداً حتى تُقيد دفعتها فعلياً.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────
function RevenueTile({
  icon: Icon, label, value, sublabel, tone,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  sublabel?: string;
  tone: "teal" | "emerald" | "amber" | "strong";
}) {
  const tones: Record<string, string> = {
    teal: "border-teal-500/30 bg-teal-500/5 text-teal-700 dark:text-teal-300",
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
    strong: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  };
  return (
    <div className={cn("rounded-xl border p-3 flex flex-col gap-1", tones[tone])}>
      <span className="text-[10px] font-semibold flex items-center gap-1.5 opacity-90 truncate">
        <Icon className="h-3.5 w-3.5 shrink-0" /> {label}
      </span>
      <span className={cn("font-extrabold tabular-nums leading-none", tone === "strong" ? "text-base sm:text-lg" : "text-sm sm:text-base")}>
        {value}
      </span>
      {sublabel && <span className="text-[10px] opacity-70 truncate">{sublabel}</span>}
    </div>
  );
}

function CountChip({
  icon: Icon, label, value, tone,
}: {
  icon: typeof UserRound;
  label: string;
  value: string | number;
  tone: "emerald" | "amber" | "teal" | "slate";
}) {
  const tones: Record<string, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
    teal: "border-teal-500/30 bg-teal-500/5 text-teal-700 dark:text-teal-300",
    slate: "border-border/60 bg-card text-foreground",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-bold", tones[tone])}>
      <Icon className="h-3 w-3 shrink-0" /> {label}: <span className="tabular-nums">{value}</span>
    </span>
  );
}

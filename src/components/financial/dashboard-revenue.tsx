"use client";

/**
 * DashboardRevenueBlock — إيرادات المنخرطين كما تظهر في لوحة التحكم
 * ═════════════════════════════════════════════════════════════
 * المطلوب: «المركز المالي يأخذ المعلومات من لوحة التحكم مثل رسوم
 * الاشتراكات والإيرادات — كل هذه المعلومات جاهزة في الصفحة».
 *
 * الضمانة الوحيدة لتطابق الأرقام 100%: نفس المصدر حرفياً.
 * هذا المكوّن يستدعي /api/stats — نفس الواجهة التي تغذّي لوحة التحكم —
 * فالأرقام متطابقة بالبناء (نفس الحساب، نفس اللحظة) بلا أي حساب مكرر:
 *   رسوم الاشتراكات • رسوم التأمين • حقوق المركب • إجمالي الإيرادات
 *   + المسددون / لم يسددوا / المعفون + متوسط الدفعة + إجمالي المنخرطين
 *
 * سطر المطابقة أسفل البطاقة يعرض نظيرها النقدي من دفتر القيود
 * (الذي يمرَّر من النظرة العامة) — لأن أرقام لوحة التحكم تُحسب من
 * حالات اشتراك المنخرطين بينما الدفتر يوثّق النقد المقيد فعلياً.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Wallet, ShieldCheck, Waves, Banknote, RefreshCw, Loader2,
  AlertTriangle, Users, LineChart, UserCheck, UserX, UserRound, Gauge, Landmark,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface StatsFinancial {
  totalSubscriptionFees: number;
  totalInsuranceFees: number;
  totalCompoundRights: number;
  totalRevenue: number;
  avgPayment: number;
}

interface StatsPayload {
  total: number;
  paid: number;
  unpaid: number;
  exempt: number;
  financial: StatsFinancial;
}

/** نظير الأرقام في دفتر القيود (النقد المقيد فعلياً) — يُمرَّر من النظرة العامة */
export interface LedgerMirror {
  /** قيود subscription + renewal */
  subscriptions: number;
  /** قيود insurance */
  insurance: number;
  /** قيود compound */
  compound: number;
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
export function DashboardRevenueBlock({ ledger }: { ledger?: LedgerMirror }) {
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      // ★ نفس مصدر لوحة التحكم حرفياً — التطابق مضمون بالبناء لا بالمصادفة
      const res = await fetch("/api/stats", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      setStats({
        total: json.total ?? 0,
        paid: json.paid ?? 0,
        unpaid: json.unpaid ?? 0,
        exempt: json.exempt ?? 0,
        financial: {
          totalSubscriptionFees: json.financial?.totalSubscriptionFees ?? 0,
          totalInsuranceFees: json.financial?.totalInsuranceFees ?? 0,
          totalCompoundRights: json.financial?.totalCompoundRights ?? 0,
          totalRevenue: json.financial?.totalRevenue ?? 0,
          avgPayment: json.financial?.avgPayment ?? 0,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل التحميل");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // تحديث صامت عند رجوع التركيز — نفس نمط النظرة العامة
    const onFocus = () => fetchStats(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchStats]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
            <Users className="h-4 w-4 text-teal-600" />
            إيرادات المنخرطين — كما في لوحة التحكم
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 px-2 py-0.5 text-[10px] font-bold">
              <LineChart className="h-3 w-3" /> نفس المصدر
            </span>
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            className="text-teal-700 dark:text-teal-300 h-7 px-2 text-[11px]"
            onClick={() => fetchStats(true)}
            disabled={refreshing}
            aria-label="تحديث إيرادات المنخرطين"
          >
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            تحديث
          </Button>
        </div>
        <CardDescription className="text-[11px]">
          رسوم الاشتراكات والتأمين وحقوق المركب — تُحسب من حالات اشتراك المنخرطين (نفس مصدر لوحة التحكم) وجاهزة هنا مباشرة
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <div className="rounded-xl border border-rose-300/50 bg-rose-500/5 p-4 flex flex-col items-center gap-2 text-center">
            <AlertTriangle className="h-6 w-6 text-rose-500" />
            <p className="text-xs font-bold text-rose-700 dark:text-rose-300">تعذر تحميل إيرادات المنخرطين</p>
            <Button size="sm" variant="outline" onClick={() => fetchStats()}>
              <RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة
            </Button>
          </div>
        ) : loading || !stats ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
            <Skeleton className="h-7 w-2/3 rounded-lg" />
          </div>
        ) : (
          <>
            {/* بطاقات الإيرادات — نفس أرقام لوحة التحكم */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <RevenueTile
                icon={Wallet}
                label="رسوم الاشتراكات"
                value={formatDA(stats.financial.totalSubscriptionFees)}
                sublabel={`${stats.paid} منخرط مسدد`}
                tone="teal"
              />
              <RevenueTile
                icon={ShieldCheck}
                label="رسوم التأمين"
                value={formatDA(stats.financial.totalInsuranceFees)}
                sublabel="لكل منخرط مسدد"
                tone="emerald"
              />
              <RevenueTile
                icon={Waves}
                label="حقوق المركب"
                value={formatDA(stats.financial.totalCompoundRights)}
                sublabel="مستثناة من الإجمالي"
                tone="amber"
              />
              <RevenueTile
                icon={Banknote}
                label="إجمالي الإيرادات"
                value={formatDA(stats.financial.totalRevenue)}
                sublabel="اشتراكات + تأمين"
                tone="strong"
              />
            </div>

            {/* رقائق الحصيلة — المسددون / الديون / المعفون */}
            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              <CountChip icon={UserCheck} label="المسددون" value={stats.paid} tone="emerald" />
              <CountChip icon={UserX} label="لم يسددوا" value={stats.unpaid} tone="amber" />
              <CountChip icon={UserRound} label="المعفون" value={stats.exempt} tone="slate" />
              <CountChip icon={Gauge} label="متوسط الدفعة" value={formatDA(stats.financial.avgPayment)} tone="teal" />
              <CountChip icon={Users} label="إجمالي المنخرطين" value={stats.total} tone="slate" />
            </div>

            {/* مطابقة مع الدفتر — الشفافية المحاسبية */}
            {ledger && (
              <div className="rounded-xl border border-border/60 bg-muted/40 p-2.5 flex items-start gap-2">
                <Landmark className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  <span className="font-extrabold text-foreground">مطابقة مع الدفتر — النقد المقيد فعلياً: </span>
                  اشتراكات وتجديدات {formatDA(ledger.subscriptions)} • تأمين {formatDA(ledger.insurance)} • حقوق مركب {formatDA(ledger.compound)}.
                  أرقام لوحة التحكم أعلاه تُحسب من حالات اشتراك المنخرطين، بينما الدفتر يوثّق النقد المتحصل فعلياً —
                  وأي فرق بينهما يعني دفعات لم تُقيَّد بعد في الدفتر.
                </p>
              </div>
            )}
          </>
        )}
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
  icon: typeof UserCheck;
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

"use client";

/**
 * FinancialHub — المركز المالي الموحّد
 * ═════════════════════════════════════════════════════════════
 * يدمج في صفحة واحدة احترافية (بلا تكرار):
 *   1) نظرة عامة       — لوحة المالية الكاملة (رصيد/مقارنات/رسوم بيانية)
 *   2) الصندوق وتقرير Z — ورديات الدرج + طباعة Z + ترحيل آلي لدفتر التسديدات
 *   3) الأعباء والتسديدات — تسجيل الأعباء + دفتر الحركات المالي الكامل
 *   4) التقارير          — ملخص/أجور/تفصيل المداخيل مع التصدير
 *
 * الفلسفة المحاسبية: مصدر واحد للحقيقة (دفتر التسديدات) — عمليات
 * الصندوق اليدوية تُرحَّل تلقائياً إليه، فلا يوجد دفتران منفصلان.
 * كل قسم يظهر فقط لمن يملك صلاحيته.
 */

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Landmark, LayoutDashboard, Coins, ArrowRightLeft, FileText,
  RefreshCw, Loader2, Wallet, TrendingUp, TrendingDown, Activity,
  Lock, Unlock, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { hasPermission } from "@/lib/roles";

import { FinancialDashboard } from "@/components/financial-dashboard";
import { FinancialPayments } from "@/components/financial-payments";
import { FinancialReports } from "@/components/financial-reports";
import { ChargesPanel } from "@/components/charges-panel";
import { CashRegister } from "@/components/cash-register";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type HubSection = "overview" | "cash" | "charges" | "reports";

interface DashboardSummary {
  balance: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
  };
  monthlyComparison: {
    thisMonthIncome: number;
    thisMonthExpense: number;
    netThisMonth: number;
  };
  periodIncome: { today: number; week: number; month: number; year: number };
}

interface ShiftSnapshot {
  open: boolean;
  openedAt: string | null;
  openingBalance: number;
  operations: Array<{ id: string; type: "income" | "expense"; amount: number }>;
}

interface FinancialHubProps {
  role: string;
  subscribers: Parameters<typeof ChargesPanel>[0]["subscribers"];
  /** التنقل من عناصر أخرى (لوحة المالية → التسديدات) */
}

const SHIFT_KEY = "aquacore-cash-shift";
const SECTION_KEY = "rcs-financial-hub-section";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function formatDA(n: number): string {
  return new Intl.NumberFormat("fr-DZ").format(Math.round(n)) + " دج";
}

function formatShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "م";
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + "ك";
  return String(Math.round(n));
}

function readShiftSnapshot(): ShiftSnapshot | null {
  try {
    const raw = localStorage.getItem(SHIFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ShiftSnapshot;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export function FinancialHub({ role, subscribers }: FinancialHubProps) {
  const perms = {
    overview: hasPermission(role, "financialDashboard"),
    cash: hasPermission(role, "financialDashboard"),
    charges: hasPermission(role, "charges") || hasPermission(role, "financialPayments"),
    reports: hasPermission(role, "financialReports"),
  };

  const firstAllowed: HubSection =
    perms.overview ? "overview" : perms.charges ? "charges" : perms.reports ? "reports" : "overview";

  const [section, setSection] = useState<HubSection>(firstAllowed);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shiftSnap, setShiftSnap] = useState<ShiftSnapshot | null>(null);

  // استرجاع القسم المحفوظ (مع ضمان الصلاحية)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SECTION_KEY) as HubSection | null;
      if (saved && perms[saved]) setSection(saved);
    } catch {}
    setShiftSnap(readShiftSnapshot());
  }, []);

  const fetchSummary = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetch("/api/financial/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      setSummary(await res.json());
    } catch {
      // الرأس يبقى بدون أرقام — الأقسام الداخلية تعرض أخطاءها الخاصة
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const switchSection = useCallback((s: HubSection) => {
    setSection(s);
    setShiftSnap(readShiftSnapshot());
    try { localStorage.setItem(SECTION_KEY, s); } catch {}
    // تحديث ذكي: الأرقام الحية عند العودة لنظرة عامة
    if (s === "overview") fetchSummary(true);
  }, [fetchSummary]);

  // مزامنة حالة الصندوق عند رجوع التركيز للنافذة
  useEffect(() => {
    const onFocus = () => setShiftSnap(readShiftSnapshot());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const refreshAll = () => {
    fetchSummary(true);
    toast.promise(Promise.resolve(), { success: "تم تحديث المركز المالي" });
  };

  const expectedDrawer = shiftSnap
    ? shiftSnap.openingBalance +
      shiftSnap.operations.filter((o) => o.type === "income").reduce((s, o) => s + o.amount, 0) -
      shiftSnap.operations.filter((o) => o.type === "expense").reduce((s, o) => s + o.amount, 0)
    : 0;

  const SECTIONS: Array<{ id: HubSection; label: string; icon: typeof LayoutDashboard; hint: string; show: boolean }> = [
    { id: "overview", label: "نظرة عامة", icon: LayoutDashboard, hint: "الرصيد والرسوم البيانية والمقارنات", show: perms.overview },
    { id: "cash", label: "الصندوق وتقرير Z", icon: Coins, hint: "ورديات الدرج والطباعة", show: perms.cash },
    { id: "charges", label: "الأعباء والتسديدات", icon: ArrowRightLeft, hint: "تسجيل الأعباء ودفتر الحركات", show: perms.charges },
    { id: "reports", label: "التقارير", icon: FileText, hint: "ملخص وأجور ومداخيل", show: perms.reports },
  ];
  const visibleSections = SECTIONS.filter((s) => s.show);

  const balance = summary?.balance.balance ?? 0;
  const balanceTone = balance < 0 ? "danger" : balance < 5000 ? "warn" : "ok";

  return (
    <div dir="rtl" className="space-y-4">
      {/* ═══ رأس المركز — الهوية والأرقام الحية ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-teal-600/30 bg-gradient-to-l from-teal-700 via-teal-600 to-sky-700 p-4 sm:p-5 text-white shadow-md"
      >
        <div className="absolute inset-0 opacity-10" aria-hidden>
          <svg className="absolute bottom-0 left-0 w-full h-2/3" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M0,60 C150,100 350,0 600,60 C850,120 1050,20 1200,60 L1200,120 L0,120 Z" fill="white" />
          </svg>
        </div>
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur border border-white/20 flex items-center justify-center shrink-0">
              <Landmark className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold leading-tight">المركز المالي</h2>
              <p className="text-[11px] sm:text-xs text-white/80">
                كل العمليات المالية للنادي — التسجيلات والأعباء والتسديدات — في مكان واحد
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {loading ? (
              <Skeleton className="h-9 w-36 bg-white/20" />
            ) : (
              <div className="text-left">
                <p className="text-[10px] sm:text-[11px] text-white/75">الرصيد الحالي</p>
                <p className="text-xl sm:text-2xl font-extrabold tabular-nums leading-none">
                  {formatDA(balance)}
                </p>
              </div>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={refreshAll}
              disabled={refreshing}
              className="text-white hover:bg-white/15 border border-white/25 h-9"
              aria-label="تحديث المركز المالي"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* رقائق المؤشرات الحية */}
        <div className="relative mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl bg-white/15" />)
          ) : (
            <>
              <KpiChip icon={TrendingUp} label="مداخيل الشهر" value={summary ? formatShort(summary.monthlyComparison.thisMonthIncome) : "—"} tone="emerald" />
              <KpiChip icon={TrendingDown} label="مصاريف الشهر" value={summary ? formatShort(summary.monthlyComparison.thisMonthExpense) : "—"} tone="rose" />
              <KpiChip icon={Activity} label="صافي الشهر" value={summary ? formatShort(summary.monthlyComparison.netThisMonth) : "—"} tone="sky" />
              <KpiChip icon={Wallet} label="مدخول اليوم" value={summary ? formatShort(summary.periodIncome.today) : "—"} tone="teal" />
              <KpiChip
                icon={shiftSnap?.open ? Unlock : Lock}
                label={shiftSnap?.open ? "الصندوق مفتوح" : "الصندوق مغلق"}
                value={shiftSnap?.open ? formatShort(expectedDrawer) : "—"}
                tone={shiftSnap?.open ? "amber" : "slate"}
              />
              <div className={cn(
                "rounded-xl border p-2 flex flex-col justify-center gap-0.5 backdrop-blur-sm",
                balanceTone === "danger" && "bg-rose-500/20 border-rose-300/40",
                balanceTone === "warn" && "bg-amber-500/20 border-amber-300/40",
                balanceTone === "ok" && "bg-emerald-500/20 border-emerald-300/40"
              )}>
                <span className="text-[10px] text-white/80 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> الوضع المالي
                </span>
                <span className="text-sm font-extrabold">
                  {balanceTone === "danger" ? "رصيد سالب" : balanceTone === "warn" ? "رصيد منخفض" : "جيد ✓"}
                </span>
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* ═══ مبدّل الأقسام ═══ */}
      <div className="sticky top-[52px] z-20 -mx-1 px-1">
        <div
          role="tablist"
          aria-label="أقسام المركز المالي"
          className="flex gap-1.5 p-1 rounded-2xl bg-muted/70 border border-border/60 overflow-x-auto backdrop-blur supports-[backdrop-filter]:bg-muted/50"
        >
          {visibleSections.map((s) => {
            const Icon = s.icon;
            const active = section === s.id;
            return (
              <button
                key={s.id}
                role="tab"
                aria-selected={active}
                title={s.hint}
                onClick={() => switchSection(s.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all shrink-0",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/80"
                )}
              >
                <Icon className="h-4 w-4" />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ محتوى الأقسام ═══ */}
      {section === "overview" && perms.overview && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} key="overview">
          <FinancialDashboard onViewAllTransactions={() => switchSection("charges")} />
        </motion.section>
      )}

      {section === "cash" && perms.cash && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} key="cash" className="space-y-3">
          <MoneyFlowExplainer />
          <CashRegister onLedgerChanged={() => { setShiftSnap(readShiftSnapshot()); fetchSummary(true); }} />
        </motion.section>
      )}

      {section === "charges" && perms.charges && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} key="charges" className="space-y-4">
          <MoneyFlowExplainer />
          {hasPermission(role, "charges") && <ChargesPanel subscribers={subscribers} />}
          {hasPermission(role, "financialPayments") && (
            <div className="space-y-2">
              <h3 className="font-bold text-sm flex items-center gap-2 text-primary">
                <ArrowRightLeft className="h-4 w-4" /> دفتر التسديدات — كل الحركات المالية (قبض وصرف)
              </h3>
              <FinancialPayments />
            </div>
          )}
        </motion.section>
      )}

      {section === "reports" && perms.reports && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} key="reports">
          <FinancialReports />
        </motion.section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// رقاقة مؤشر
// ─────────────────────────────────────────────────────────────
function KpiChip({ icon: Icon, label, value, tone }: {
  icon: typeof Wallet;
  label: string;
  value: string;
  tone: "emerald" | "rose" | "sky" | "teal" | "amber" | "slate";
}) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-500/20 border-emerald-300/40",
    rose: "bg-rose-500/20 border-rose-300/40",
    sky: "bg-sky-500/20 border-sky-300/40",
    teal: "bg-teal-400/20 border-teal-200/40",
    amber: "bg-amber-500/20 border-amber-300/40",
    slate: "bg-white/10 border-white/25",
  };
  return (
    <div className={cn("rounded-xl border p-2 flex flex-col justify-center gap-0.5 backdrop-blur-sm", tones[tone])}>
      <span className="text-[10px] text-white/85 flex items-center gap-1 truncate">
        <Icon className="h-3 w-3 shrink-0" /> {label}
      </span>
      <span className="text-sm font-extrabold tabular-nums">{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// شريط توضيح الدورة المالية — وضوح المصطلحات الثلاثة
// ─────────────────────────────────────────────────────────────
export function MoneyFlowExplainer() {
  const items = [
    { icon: TrendingUp, title: "التسجيلات", desc: "مداخيل اشتراكات وتأمين المنخرطين — تُقيَّد تلقائياً من التجديد والاستقبال", tone: "emerald" },
    { icon: Coins, title: "الأعباء", desc: "أجور العمال من ساعات العمل، اللوازم، والمصاريف التشغيلية — تُدخل يدوياً", tone: "amber" },
    { icon: ArrowRightLeft, title: "التسديدات", desc: "دفتر كل الحركة المالية (قبض/صرف) بفلاتره وإيصالاته وتصديره", tone: "sky" },
  ] as const;
  const toneCls: Record<string, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
    sky: "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300",
  };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <div key={it.title} className={cn("rounded-xl border p-2.5 flex items-start gap-2", toneCls[it.tone])}>
            <Icon className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-extrabold">{it.title}</p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">{it.desc}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

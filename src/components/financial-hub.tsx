"use client";

/**
 * FinancialHub — المركز المالي
 * ═════════════════════════════════════════════════════════════
 * صفحة تقارير ومعاملات مالية واحدة — بسيطة وبلا تكرار:
 *   1) نظرة عامة          — اللوحة التحليلية والمؤشرات الذكية
 *   2) المعاملات المالية  — دفتر القيود الموحّد (مصدر الحقيقة الوحيد)
 *   3) التقارير           — ملخص/أجور/مداخيل مع التصدير
 *
 * ما حُذف ولماذا (تفادي التكرار):
 *   ✗ الصندوق وتقرير Z     — وردية الدرج كانت مصدر بيانات منفصلاً (localStorage)؛
 *                             كل قيد يُسجَّل الآن مباشرة في الدفتر من «قيد جديد».
 *   ✗ قسم الأعباء والتسديدات القديم — كان يكرّر ما في صفحاته المتخصصة:
 *                             التأمين (تبويب التأمين)، حقوق المركب (تبويب حقوق المركب)،
 *                             سجل التسديدات (هذا الدفتر نفسه) — وبطاقتين بنفس الاسم «حقوق المركب».
 *   ✓ بقي فريد: أداة «أجور العمال» (ساعات العمل × الأجر — تسديد يُرحَّل للدفتر تلقائياً).
 *
 * الفلسفة المحاسبية: أي دفعة من أي شاشة (تجديد، تأمين، مركب، أجر، قيد يدوي)
 * تظهر في هذا الدفتر تلقائياً — أرقام المركز هي الحصيلة الكاملة بلا ازدواج.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Landmark, LayoutDashboard, ArrowRightLeft, FileText, Wallet,
  RefreshCw, Loader2, AlertTriangle, Activity, ShieldCheck, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { hasPermission } from "@/lib/roles";
import { ExportButton } from "@/components/shared/export-button";
import { onFinancialUpdated, notifyFinancialUpdated } from "@/lib/financial-events";

import { FinancialOverview, type OverviewNavSection, type PeriodKey } from "@/components/financial/overview";
import { DuesSection } from "@/components/financial/dues-section";
import { FinancialPayments } from "@/components/financial-payments";
import { FinancialReports } from "@/components/financial-reports";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type HubSection = OverviewNavSection | "dues";

interface HubSummary {
  balance: { totalIncome: number; totalExpense: number; balance: number };
  monthlyComparison: { netThisMonth: number; thisMonthIncome: number; thisMonthExpense: number };
  periodIncome: { today: number; week: number; month: number; year: number };
  movementsThisMonth: number;
}

interface FinancialHubProps {
  role: string;
}

const SECTION_KEY = "rcs-financial-hub-section";

// ★ فترات المبدّل الموحّد في رأس المركز (المرحلة 2/3)
const HUB_PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: "today", label: "اليوم" },
  { key: "week", label: "الأسبوع" },
  { key: "month", label: "الشهر" },
  { key: "lastmonth", label: "الشهر الماضي" },
  { key: "year", label: "السنة" },
  { key: "custom", label: "مخصص" },
];

interface SyncRange { from: string; to: string; nonce: number }

/** نطاق التواريخ (YYYY-MM-DD) لكل فترة ثابتة — لمزامنة الدفتر والتقارير مع الفترة المختارة */
function periodRangeISO(p: PeriodKey): { from: string; to: string } | null {
  if (p === "custom") return null; // التواريخ المخصصة يديرها قسم النظرة العامة بنفسه
  const now = new Date();
  const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const today = iso(now);
  if (p === "today") return { from: today, to: today };
  if (p === "week") {
    const s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    return { from: iso(s), to: today };
  }
  if (p === "lastmonth") {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const e = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: iso(s), to: iso(e) };
  }
  if (p === "year") return { from: iso(new Date(now.getFullYear(), 0, 1)), to: today };
  return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
}

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

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export function FinancialHub({ role }: FinancialHubProps) {
  const perms = {
    overview: hasPermission(role, "financialDashboard"),
    dues: hasPermission(role, "financialDashboard"),
    transactions: hasPermission(role, "financialPayments"),
    reports: hasPermission(role, "financialReports"),
  };

  const firstAllowed: HubSection =
    perms.overview ? "overview" : perms.transactions ? "transactions" : perms.reports ? "reports" : "overview";

  const [section, setSection] = useState<HubSection>(firstAllowed);
  const [summary, setSummary] = useState<HubSummary | null>(null);
  const [loading, setLoading] = useState(perms.overview);
  const [refreshing, setRefreshing] = useState(false);
  /** ترشيح مبدئي للدفتر عند القدوم من بطاقة (قبض/صرف) */
  const [ledgerPreset, setLedgerPreset] = useState<"income" | "expense" | undefined>(undefined);
  /** إشارة تحديث الدفتر بعد تسديد أجر */
  const [ledgerRefresh, setLedgerRefresh] = useState(0);
  /** ★ فترة التحليل الموحّدة — يديرها رأس المركز وتُمرّر للنظرة العامة وتُزامن الدفتر/التقارير */
  const [hubPeriod, setHubPeriod] = useState<PeriodKey>("month");
  const [rangeNonce, setRangeNonce] = useState(0);
  /** نافذة فحص سلامة الحسابات (من «المزيد») */
  const [integrityOpen, setIntegrityOpen] = useState(false);

  const changeHubPeriod = useCallback((p: PeriodKey) => {
    setHubPeriod(p);
    setRangeNonce((n) => n + 1);
  }, []);

  // استرجاع القسم المحفوظ (مع ضمان الصلاحية)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SECTION_KEY) as HubSection | null;
      if (saved && perms[saved]) setSection(saved);
    } catch {}
  }, []);

  const fetchSummary = useCallback(async (silent = false) => {
    if (!perms.overview) return;
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

  // ★ مزامنة فورية: أي عملية مالية في أي صفحة تُحدّث أرقام الرأس بلا تحديث يدوي
  useEffect(() => onFinancialUpdated(() => fetchSummary(true)), [fetchSummary]);

  const switchSection = useCallback((s: HubSection) => {
    setSection(s);
    try { localStorage.setItem(SECTION_KEY, s); } catch {}
    // تحديث ذكي: أرقام النظرة العامة عند العودة إليها، وتحديث الدفتر
    // عند العودة إليه (بعد أي تسديد من قسم المستحقات أو صفحة أخرى)
    if (s === "overview") fetchSummary(true);
    if (s === "transactions") setLedgerRefresh((n) => n + 1);
  }, [fetchSummary]);

  /** تنقل ذكي من بطاقات النظرة العامة (مع ترشيح مبدئي للدفتر) */
  const handleNavigateSection = useCallback((s: HubSection, ledgerType?: "income" | "expense") => {
    if (s === "transactions") setLedgerPreset(ledgerType);
    switchSection(s);
  }, [switchSection]);

  const refreshAll = () => {
    fetchSummary(true);
    setLedgerRefresh((n) => n + 1);
    toast.success("تم تحديث المركز المالي");
  };

  const SECTIONS: Array<{ id: HubSection; label: string; icon: typeof LayoutDashboard; hint: string; show: boolean }> = [
    { id: "overview", label: "نظرة عامة", icon: LayoutDashboard, hint: "بطاقات الرصيد واللوحة التحليلية والمؤشرات", show: perms.overview },
    { id: "dues", label: "المستحقات", icon: Wallet, hint: "التأمين وحقوق المركب وأجور العمال والديون — مع التسديد", show: perms.dues },
    { id: "transactions", label: "المعاملات المالية", icon: ArrowRightLeft, hint: "دفتر القيود الكامل — كل مدخول ومصروف", show: perms.transactions },
    { id: "reports", label: "التقارير", icon: FileText, hint: "ملخص وأجور ومداخيل مع التصدير", show: perms.reports },
  ];
  const visibleSections = SECTIONS.filter((s) => s.show);

  const balance = summary?.balance.balance ?? 0;
  const balanceTone = balance < 0 ? "danger" : balance < 5000 ? "warn" : "ok";

  // ★ نطاق المزامنة المُمرّر للدفتر والتقارير (يتغير مع كل تغيير فترة)
  const syncRange = useMemo<SyncRange | null>(() => {
    const r = periodRangeISO(hubPeriod);
    return r ? { ...r, nonce: rangeNonce } : null;
  }, [hubPeriod, rangeNonce]);

  // صفوف «الملخص المالي السريع» لزر التحميل في الرأس
  const statementRows = summary
    ? [
        { item: "الرصيد الحالي (الدفتر)", value: formatDA(summary.balance.balance) },
        { item: "مداخيل هذا الشهر", value: formatDA(summary.monthlyComparison.thisMonthIncome) },
        { item: "مصاريف هذا الشهر", value: formatDA(summary.monthlyComparison.thisMonthExpense) },
        { item: "صافي هذا الشهر", value: formatDA(summary.monthlyComparison.netThisMonth) },
        { item: "قبض اليوم", value: formatDA(summary.periodIncome.today) },
        { item: "قبض هذا الأسبوع", value: formatDA(summary.periodIncome.week) },
        { item: "قبض هذه السنة", value: formatDA(summary.periodIncome.year) },
        { item: "عدد حركات هذا الشهر", value: String(summary.movementsThisMonth) },
      ]
    : [];

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
                تقارير ومعاملات مالية — كل تفاصيل النادي في دفتر واحد بلا ازدواج
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {perms.overview && (
              loading ? (
                <Skeleton className="h-9 w-36 bg-white/20" />
              ) : (
                <div className="text-left">
                  <p className="text-[10px] sm:text-[11px] text-white/75">الرصيد الحالي (الدفتر)</p>
                  <p className="text-xl sm:text-2xl font-extrabold tabular-nums leading-none">
                    {formatDA(balance)}
                  </p>
                </div>
              )
            )}
            {perms.overview && (
              <ExportButton
                rows={statementRows}
                columns={[
                  { key: "item", label: "البند" },
                  { key: "value", label: "القيمة" },
                ]}
                filename="الملخص-المالي"
                title="الملخص المالي السريع — المركز المالي"
                disabled={loading || statementRows.length === 0}
                label="تحميل"
              />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/15 border border-white/25 h-9 gap-1"
                  aria-label="المزيد من أدوات المركز المالي"
                >
                  المزيد <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="text-xs">
                <DropdownMenuItem onClick={() => setIntegrityOpen(true)} className="gap-2 cursor-pointer">
                  <ShieldCheck className="h-3.5 w-3.5 text-teal-600" /> فحص سلامة الحسابات
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
        <div className="relative mt-3 grid grid-cols-3 gap-2">
          {perms.overview && loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl bg-white/15" />)
          ) : (
            <>
              {perms.overview && (
                <KpiChip
                  icon={Activity}
                  label="صافي الشهر"
                  value={summary ? formatShort(summary.monthlyComparison.netThisMonth) : "—"}
                  tone={(summary?.monthlyComparison.netThisMonth ?? 0) >= 0 ? "emerald" : "rose"}
                />
              )}
              {perms.overview && (
                <KpiChip
                  icon={ArrowRightLeft}
                  label="حركات هذا الشهر"
                  value={summary ? `${summary.movementsThisMonth}` : "—"}
                  tone="teal"
                />
              )}
              {perms.overview && (
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
              )}
            </>
          )}
        </div>

        {/* ★ مبدّل الفترة الموحّد في الرأس — يحدّث النظرة العامة ويزامن الدفتر والتقارير */}
        {perms.overview && (
          <div className="relative mt-2.5 flex flex-wrap items-center gap-1" role="tablist" aria-label="فترة التحليل المالي الموحّدة">
            {HUB_PERIODS.map(({ key, label }) => (
              <button
                key={key}
                role="tab"
                aria-selected={hubPeriod === key}
                onClick={() => changeHubPeriod(key)}
                className={cn(
                  "h-9 px-3 rounded-lg text-[11px] font-bold inline-flex items-center whitespace-nowrap transition-all",
                  hubPeriod === key
                    ? "bg-white text-teal-800 shadow-sm"
                    : "bg-white/10 text-white/90 hover:bg-white/20 border border-white/15"
                )}
              >
                {label}
              </button>
            ))}
            <span className="hidden sm:block text-[10px] text-white/70 mr-auto">
              تغيير الفترة يحدّث النظرة العامة ويزامن الدفتر والتقارير
            </span>
          </div>
        )}
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
          <FinancialOverview role={role} onNavigateSection={handleNavigateSection} controlledPeriod={hubPeriod} onControlledPeriodChange={changeHubPeriod} />
        </motion.section>
      )}

      {section === "dues" && perms.dues && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} key="dues">
          <DuesSection onChanged={() => fetchSummary(true)} />
        </motion.section>
      )}

      {section === "transactions" && perms.transactions && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} key={`transactions-${ledgerPreset ?? "all"}`} className="space-y-2">
          <SectionHint
            text="مصدر الحقيقة الوحيد: كل مدخول ومصروف يظهر هنا تلقائياً — التسجيلات من التجديد، التأمين وحقوق المركب من صفحاتهما، وأجور العمال والقيود اليدوية من «قيد جديد»."
          />
          <FinancialPayments initialType={ledgerPreset} refreshSignal={ledgerRefresh} syncRange={syncRange ?? undefined} />
        </motion.section>
      )}

      {section === "reports" && perms.reports && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} key="reports">
          <FinancialReports syncRange={syncRange ?? undefined} />
        </motion.section>
      )}

      {/* فحص سلامة الحسابات (من «المزيد») */}
      <IntegrityDialog
        open={integrityOpen}
        onOpenChange={setIntegrityOpen}
        role={role}
        onChanged={() => {
          fetchSummary(true);
          notifyFinancialUpdated();
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// رقاقة مؤشر
// ─────────────────────────────────────────────────────────────
function KpiChip({ icon: Icon, label, value, tone }: {
  icon: typeof Activity;
  label: string;
  value: string;
  tone: "emerald" | "rose" | "teal";
}) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-500/20 border-emerald-300/40",
    rose: "bg-rose-500/20 border-rose-300/40",
    teal: "bg-teal-400/20 border-teal-200/40",
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
// تلميح تعريفي أعلى القسم — سطر واحد واضح
// ─────────────────────────────────────────────────────────────
function SectionHint({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-teal-500/25 bg-teal-500/5 px-3 py-2 flex items-start gap-2">
      <Landmark className="h-3.5 w-3.5 text-teal-600 mt-0.5 shrink-0" />
      <p className="text-[11px] leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// فحص سلامة الحسابات — من «المزيد» (المرحلة 2/26)
// ─────────────────────────────────────────────────────────────
interface IntegrityPayload {
  summary: {
    matches: boolean;
    cacheBalance: number;
    ledgerBalance: number;
    balanceDiff: number;
    totalIncomeDiff: number;
    totalExpenseDiff: number;
    unsequencedCount: number;
    checkedAt: string;
  };
  categoryDiffs: Array<{ type: string; category: string; cache: number; ledger: number; diff: number }>;
}

function IntegrityDialog({ open, onOpenChange, role, onChanged }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: string;
  onChanged?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [result, setResult] = useState<IntegrityPayload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/financial/integrity", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      setResult(await res.json());
    } catch {
      toast.error("تعذر فحص سلامة الحسابات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const rebuild = async () => {
    setRebuilding(true);
    try {
      const res = await fetch("/api/financial/integrity", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "فشل");
      if (json.after) setResult(json.after as IntegrityPayload);
      toast.success(json.message || "تمت إعادة مزامنة الرصيد");
      onChanged?.();
      notifyFinancialUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل إعادة المزامنة");
    } finally {
      setRebuilding(false);
    }
  };

  const isAdmin = role === "admin" || role === "superadmin";
  const fmt = (n: number) => new Intl.NumberFormat("fr-DZ").format(Math.round(n)) + " دج";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-teal-600" /> فحص سلامة الحسابات
          </DialogTitle>
          <DialogDescription className="text-xs">
            مطابقة الرصيد المخزّن (FinancialBalance) مع الحقيقة المحسوبة من دفتر القيود.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> جارٍ الفحص…
          </div>
        ) : result ? (
          <div className="space-y-2 text-xs">
            <div className={cn(
              "rounded-xl border p-3 flex items-center gap-2 font-extrabold",
              result.summary.matches
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            )}>
              {result.summary.matches ? "✓ الحسابات متطابقة" : "⚠ يوجد اختلاف"}
              {result.summary.unsequencedCount > 0 && (
                <span className="text-[10px] font-bold opacity-80">• {result.summary.unsequencedCount} قيد قديم بلا رقم</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-border/60 p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground">الرصيد المخزّن</p>
                <p className="font-extrabold tabular-nums mt-0.5">{fmt(result.summary.cacheBalance)}</p>
              </div>
              <div className="rounded-xl border border-border/60 p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground">الرصيد المحسوب</p>
                <p className="font-extrabold tabular-nums mt-0.5">{fmt(result.summary.ledgerBalance)}</p>
              </div>
              <div className={cn("rounded-xl border p-2.5 text-center", result.summary.balanceDiff !== 0 ? "border-amber-500/40 bg-amber-500/5" : "border-border/60")}>
                <p className="text-[10px] text-muted-foreground">الفرق</p>
                <p className="font-extrabold tabular-nums mt-0.5">{fmt(result.summary.balanceDiff)}</p>
              </div>
            </div>
            {result.categoryDiffs.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-2.5 space-y-1">
                <p className="font-bold text-[11px]">فروق الفئات ({result.categoryDiffs.length}):</p>
                {result.categoryDiffs.slice(0, 5).map((d, i) => (
                  <p key={i} className="text-[10px] text-muted-foreground tabular-nums">
                    {d.type === "income" ? "مدخول" : "مصروف"} / {d.category}: مخزّن {fmt(d.cache)} ↔ دفتر {fmt(d.ledger)}
                  </p>
                ))}
              </div>
            )}
            {isAdmin && (
              <Button onClick={rebuild} disabled={rebuilding} className="w-full h-11 gap-1.5 bg-teal-600 hover:bg-teal-700 text-white">
                {rebuilding ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                إعادة مزامنة الرصيد من الدفتر
              </Button>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

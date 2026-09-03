"use client";

/**
 * WagesSection — قسم «أجور العمال» الاحترافي
 * ═════════════════════════════════════════════════════════════
 * قسم منفصل وواضح عن جدول Pointage — يُستخدم في صفحتين بنفس المكوّن
 * (صفحة ساعات العمل + المركز المالي) فيضمن التزامن بلا أي ازدواج:
 *
 *  • الفترة: حسب الشهر (أوت 2026) أو حسب تاريخ (من → إلى)
 *  • الحساب من Pointage الفعلي (ساعات العمل المعتمدة) — لا أرقام يدوية:
 *    أيام العمل، الحصص، مجموع الساعات، سعر الساعة، الإجمالي، المدفوع، المتبقي
 *  • حالة الدفع: غير مدفوع / مدفوع جزئياً / مدفوع بالكامل
 *  • «تسديد الأجر»: حوار واحد (العامل، الفترة، المستحق، المدفوع سابقاً،
 *    المتبقي، المبلغ، تاريخ الدفع، الطريقة، ملاحظات)
 *  • التسديد ينشئ قيداً مالياً واحداً (POST /api/wages) يظهر فوراً في
 *    المركز المالي — والإلغاء من أي صفحة يحذف نفس القيد (Single Source of Truth)
 *  • «إلغاء التسديد» في حالة الخطأ: زر واضح في سجل التسديدات (للمدير فقط —
 *    الصلاحية تُصدَر من الخادم viewer.canVoid) → DELETE /api/wages/[id] بسبب إلزامي
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Wallet, Users, Clock, CalendarDays, CalendarRange, Loader2, Banknote,
  BadgeCheck, CircleDashed, CircleAlert, ChevronRight, ChevronLeft, History, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { toLocalYMD } from "@/lib/wall-clock";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface WagePaymentRow {
  id: string;
  amount: number;
  method: string;
  paidAt: string;
  note: string | null;
  periodLabel: string;
  transactionId: string | null;
  legacy?: boolean;
}

interface WorkerWage {
  userId: string;
  name: string;
  role: string;
  position: string | null;
  hourRate: number;
  daysWorked: number;
  sessions: number;
  totalHours: number;
  gross: number;
  paid: number;
  remaining: number;
  status: "unpaid" | "partial" | "paid";
  payments: WagePaymentRow[];
}

interface WagesResponse {
  period: { from: string; to: string; label: string };
  workers: WorkerWage[];
  totals: { gross: number; paid: number; remaining: number };
  /** صلاحية الإلغاء تُصدَر من الخادم (admin/superadmin فقط) */
  viewer?: { canVoid: boolean };
}

interface WagesSectionProps {
  /** يُستدعى بعد كل تسديد/إلغاء — لتحديث المركز المالي وغيره (مزامنة فورية) */
  onChanged?: () => void;
  /** نسخة مدمجة داخل حوار المركز المالي */
  compact?: boolean;
  /** تغيّر قيمته ⇒ إعادة حساب (بعد تسجيل/حذف ساعات جديدة من جدول النقاط) */
  refreshSignal?: number;
}

const AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير",
  superadmin: "مدير عام",
  assistant: "مساعد إداري",
  lifeguard: "حارس سباحة",
  accountant: "محاسب",
  observer: "مراقب",
};

const METHOD_LABELS: Record<string, string> = { cash: "نقدي", bank: "بنك", cheque: "شيك" };

const STATUS_UI: Record<string, { label: string; cls: string; icon: typeof BadgeCheck }> = {
  paid: { label: "مدفوع بالكامل", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", icon: BadgeCheck },
  partial: { label: "مدفوع جزئياً", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30", icon: CircleAlert },
  unpaid: { label: "غير مدفوع", cls: "bg-rose-500/15 text-rose-700 border-rose-500/30", icon: CircleDashed },
};

function formatDA(n: number): string {
  return new Intl.NumberFormat("fr-DZ").format(Math.round(n)) + " دج";
}

function monthName(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${AR_MONTHS[(m || 1) - 1]} ${y}`;
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-DZ", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return iso; }
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthRange(ym: string): { from: string; to: string } {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, "0")}` };
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export function WagesSection({ onChanged, compact, refreshSignal }: WagesSectionProps) {
  const [mode, setMode] = useState<"month" | "range">("month");
  const [currentMonth, setCurrentMonth] = useState(() => toLocalYMD().slice(0, 7));
  const [rangeFrom, setRangeFrom] = useState(() => monthRange(toLocalYMD().slice(0, 7)).from);
  const [rangeTo, setRangeTo] = useState(() => monthRange(toLocalYMD().slice(0, 7)).to);
  const [applied, setApplied] = useState<{ from: string; to: string }>(() => monthRange(toLocalYMD().slice(0, 7)));

  const [data, setData] = useState<WagesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // حوار التسديد
  const [payTarget, setPayTarget] = useState<WorkerWage | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payDate, setPayDate] = useState(toLocalYMD());
  const [payNote, setPayNote] = useState("");
  const [paying, setPaying] = useState(false);

  // حوار الإلغاء
  const [voidTarget, setVoidTarget] = useState<(WagePaymentRow & { workerName?: string }) | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/wages?from=${applied.from}&to=${applied.to}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "فشل التحميل");
      if (json.retry) throw new Error("جارٍ تهيئة جدول الأجور — أعد المحاولة بعد ثوانٍ");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل التحميل");
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // إعادة الحساب فور تسجيل/حذف/اعتماد ساعات جديدة من جدول النقاط
  useEffect(() => {
    if (refreshSignal !== undefined && refreshSignal > 0) fetchData();
  }, [refreshSignal]);

  const applyMonth = (ym: string) => {
    setCurrentMonth(ym);
    setRangeFrom(monthRange(ym).from);
    setRangeTo(monthRange(ym).to);
    setApplied(monthRange(ym));
  };

  const handlePay = async () => {
    if (!payTarget) return;
    const amt = parseInt(payAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("أدخل مبلغاً صحيحاً");
      return;
    }
    if (amt > payTarget.remaining) {
      toast.error(`المبلغ أكبر من المتبقي (${formatDA(payTarget.remaining)})`);
      return;
    }
    setPaying(true);
    try {
      const res = await fetch("/api/wages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: payTarget.userId,
          from: applied.from,
          to: applied.to,
          amount: amt,
          method: payMethod,
          paidAt: payDate,
          note: payNote,
          source: "workhours",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "فشل التسديد");
      if (json.retry) throw new Error("جارٍ تهيئة جدول الأجور — أعد المحاولة بعد ثوانٍ");
      toast.success(`تم تسديد ${formatDA(amt)} — القيد المالي أُنشئ ومزامَن مع المركز المالي ✓`);
      setPayTarget(null);
      setPayNote("");
      await fetchData();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التسديد");
    } finally {
      setPaying(false);
    }
  };

  const handleVoid = async () => {
    if (!voidTarget) return;
    if (voidTarget.legacy) {
      toast.error("السجلات القديمة تُدار من الدفتر المالي");
      return;
    }
    if (voidReason.trim().length < 3) {
      toast.error("سبب الإلغاء إلزامي (3 أحرف على الأقل)");
      return;
    }
    setVoiding(true);
    try {
      const res = await fetch(`/api/wages/${voidTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: voidReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "فشل الإلغاء");
      toast.success("تم إلغاء التسديد وحذف قيده المالي من المركز");
      setVoidTarget(null);
      setVoidReason("");
      await fetchData();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الإلغاء");
    } finally {
      setVoiding(false);
    }
  };

  const periodLabel = data?.period.label ?? (mode === "month" ? monthName(currentMonth) : `${rangeFrom} → ${rangeTo}`);
  const totals = data?.totals ?? { gross: 0, paid: 0, remaining: 0 };
  // ★ إلغاء التسديد في حالة الخطأ — للمدير فقط (الصلاحية من الخادم لا من الواجهة)
  const canVoid = data?.viewer?.canVoid ?? false;
  const activeWorkers = useMemo(() => data?.workers.filter((w) => w.totalHours > 0 || w.paid > 0) ?? [], [data]);
  const allPayments = useMemo(() => {
    const rows = activeWorkers.flatMap((w) => w.payments.map((p) => ({ ...p, workerName: w.name })));
    return rows.sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1));
  }, [activeWorkers]);

  return (
    <div className={cn("space-y-3", compact && "space-y-2")} id="wages-section">
      {/* ═══ رأس القسم ═══ */}
      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-l from-amber-500/10 via-card to-card p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/25">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-amber-900 dark:text-amber-200">أجور العمال</h3>
              <p className="text-[11px] text-muted-foreground">
                محسوبة من نقاط الحضور الفعلية — التسديد ينشئ قيداً مالياً واحداً مشتركاً مع المركز المالي
              </p>
            </div>
          </div>
          {/* اختيار الفترة */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex rounded-xl border border-border overflow-hidden">
              <button
                onClick={() => setMode("month")}
                aria-pressed={mode === "month"}
                className={cn("px-3 py-1.5 text-xs font-bold flex items-center gap-1 transition", mode === "month" ? "bg-amber-600 text-white" : "bg-background text-muted-foreground hover:bg-accent")}
              >
                <CalendarDays className="h-3.5 w-3.5" /> حسب الشهر
              </button>
              <button
                onClick={() => setMode("range")}
                aria-pressed={mode === "range"}
                className={cn("px-3 py-1.5 text-xs font-bold flex items-center gap-1 transition", mode === "range" ? "bg-amber-600 text-white" : "bg-background text-muted-foreground hover:bg-accent")}
              >
                <CalendarRange className="h-3.5 w-3.5" /> حسب تاريخ
              </button>
            </div>
            {mode === "month" ? (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => applyMonth(shiftMonth(currentMonth, 1))} aria-label="الشهر التالي">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-bold min-w-[110px] text-center tabular-nums">{monthName(currentMonth)}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => applyMonth(shiftMonth(currentMonth, -1))} aria-label="الشهر السابق">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} className="h-8 w-[130px] text-xs" aria-label="من تاريخ" />
                <span className="text-xs text-muted-foreground">إلى</span>
                <Input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} className="h-8 w-[130px] text-xs" aria-label="إلى تاريخ" />
                <Button
                  size="sm" className="h-8 bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => {
                    if (!rangeFrom || !rangeTo || rangeFrom > rangeTo) { toast.error("فترة غير صحيحة"); return; }
                    setApplied({ from: rangeFrom, to: rangeTo });
                  }}
                >
                  عرض
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ بطاقات الملخص ═══ */}
      <div className="grid grid-cols-3 gap-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[72px] rounded-xl" />)
        ) : (
          <>
            <SummaryChip icon={Wallet} label="إجمالي المستحق" value={totals.gross} tone="amber" />
            <SummaryChip icon={BadgeCheck} label="المدفوع" value={totals.paid} tone="emerald" />
            <SummaryChip icon={Banknote} label="المتبقي" value={totals.remaining} tone={totals.remaining > 0 ? "rose" : "emerald"} />
          </>
        )}
      </div>

      {/* ═══ جدول العمال ═══ */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
          </div>
        ) : error ? (
          <div className="p-6 text-center text-sm text-rose-600">{error}</div>
        ) : activeWorkers.length === 0 ? (
          <div className="text-center py-10">
            <Users className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">لا توجد ساعات عمل مسجلة في هذه الفترة</p>
            <p className="text-[11px] text-muted-foreground mt-1">سجّل حضور العمال في جدول النقاط ليظهر حساب الأجور هنا</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/60 border-b-2 border-amber-500/20 text-foreground">
                    <th className="p-2 text-right min-w-[130px]">العامل</th>
                    <th className="p-2 text-center">الوظيفة</th>
                    <th className="p-2 text-center w-14">أيام</th>
                    <th className="p-2 text-center w-14">حصص</th>
                    <th className="p-2 text-center w-16">ساعات</th>
                    <th className="p-2 text-center w-20">سعر الساعة</th>
                    <th className="p-2 text-center w-24">الإجمالي</th>
                    <th className="p-2 text-center w-24">المدفوع</th>
                    <th className="p-2 text-center w-24">المتبقي</th>
                    <th className="p-2 text-center w-28">حالة الدفع</th>
                    <th className="p-2 text-center w-24">تسديد</th>
                  </tr>
                </thead>
                <tbody>
                  {activeWorkers.map((w) => {
                    const st = STATUS_UI[w.status];
                    const StIcon = st.icon;
                    return (
                      <motion.tr key={w.userId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-border/40 hover:bg-muted/40">
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-amber-500/15 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0">
                              {w.name.charAt(0)}
                            </div>
                            <p className="font-semibold truncate">{w.name}</p>
                          </div>
                        </td>
                        <td className="p-2 text-center text-xs text-muted-foreground">{w.position || ROLE_LABELS[w.role] || w.role}</td>
                        <td className="p-2 text-center font-semibold tabular-nums">{w.daysWorked}</td>
                        <td className="p-2 text-center tabular-nums">{w.sessions}</td>
                        <td className="p-2 text-center font-bold text-teal-700 tabular-nums">{w.totalHours}</td>
                        <td className="p-2 text-center text-xs tabular-nums">{w.hourRate} دج</td>
                        <td className="p-2 text-center font-bold text-amber-700 tabular-nums">{formatDA(w.gross)}</td>
                        <td className="p-2 text-center text-emerald-700 tabular-nums font-semibold">{w.paid > 0 ? formatDA(w.paid) : "—"}</td>
                        <td className={cn("p-2 text-center font-bold tabular-nums", w.remaining > 0 ? "text-rose-600" : "text-emerald-600")}>
                          {w.remaining > 0 ? formatDA(w.remaining) : "✓ 0"}
                        </td>
                        <td className="p-2 text-center">
                          <Badge variant="outline" className={cn("text-[9px] gap-0.5", st.cls)}>
                            <StIcon className="h-2.5 w-2.5" /> {st.label}
                          </Badge>
                        </td>
                        <td className="p-2 text-center">
                          {w.remaining > 0 ? (
                            <Button
                              size="sm" className="h-8 bg-amber-600 hover:bg-amber-700 text-white gap-1"
                              onClick={() => { setPayTarget(w); setPayAmount(String(w.remaining)); setPayMethod("cash"); setPayDate(toLocalYMD()); setPayNote(""); }}
                            >
                              <Banknote className="h-3.5 w-3.5" /> تسديد الأجر
                            </Button>
                          ) : (
                            <span className="text-emerald-600 text-xs">✓ مسدَّد</span>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/60 font-bold border-t-2 border-amber-500/20">
                    <td colSpan={6} className="p-2 text-right text-xs">الإجمالي — الفترة: {periodLabel}</td>
                    <td className="p-2 text-center text-amber-700 tabular-nums">{formatDA(totals.gross)}</td>
                    <td className="p-2 text-center text-emerald-700 tabular-nums">{formatDA(totals.paid)}</td>
                    <td className="p-2 text-center text-rose-600 tabular-nums">{formatDA(totals.remaining)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border/40">
              {activeWorkers.map((w) => {
                const st = STATUS_UI[w.status];
                const StIcon = st.icon;
                return (
                  <div key={w.userId} className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-amber-500/15 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0">{w.name.charAt(0)}</div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">{w.name}</p>
                          <p className="text-[10px] text-muted-foreground">{w.position || ROLE_LABELS[w.role] || w.role}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn("text-[9px] gap-0.5 shrink-0", st.cls)}>
                        <StIcon className="h-2.5 w-2.5" /> {st.label}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 text-center">
                      <MiniStat label="أيام" value={String(w.daysWorked)} />
                      <MiniStat label="حصص" value={String(w.sessions)} />
                      <MiniStat label="ساعات" value={String(w.totalHours)} />
                      <MiniStat label="سعر/سا" value={`${w.hourRate}`} />
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <MiniStat label="الإجمالي" value={formatDA(w.gross)} tone="amber" />
                      <MiniStat label="المدفوع" value={formatDA(w.paid)} tone="emerald" />
                      <MiniStat label="المتبقي" value={formatDA(w.remaining)} tone={w.remaining > 0 ? "rose" : "emerald"} />
                    </div>
                    {w.remaining > 0 && (
                      <Button
                        size="sm" className="w-full h-9 bg-amber-600 hover:bg-amber-700 text-white gap-1"
                        onClick={() => { setPayTarget(w); setPayAmount(String(w.remaining)); setPayMethod("cash"); setPayDate(toLocalYMD()); setPayNote(""); }}
                      >
                        <Banknote className="h-4 w-4" /> تسديد الأجر
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ═══ سجل تسديدات الفترة + إلغاء الخطأ ═══ */}
      {activeWorkers.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="p-3 border-b space-y-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-bold text-sm flex items-center gap-1.5">
                <History className="h-4 w-4 text-muted-foreground" /> سجل تسديدات الفترة
              </h4>
              <Badge variant="secondary" className="text-[10px]">{allPayments.length} تسديد</Badge>
            </div>
            {canVoid && allPayments.length > 0 && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <XCircle className="h-3 w-3 text-rose-500" />
                أخطأت في تسديد؟ اضغط «إلغاء» بجانب العملية — يُحذف قيدها من المركز المالي فوراً وتُحدَّث كل الأرقام (موثّق في سجل التدقيق).
              </p>
            )}
          </div>
          {allPayments.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              لا توجد تسديدات في هذه الفترة بعد — بعد التسديد تجد كل العملية هنا ويمكن إلغاء أي خطأ منها.
            </div>
          ) : (
            <div className="divide-y divide-border/40 max-h-56 overflow-y-auto">
              {allPayments.map((p) => (
                <div key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{p.workerName}{p.legacy && <span className="text-[9px] text-muted-foreground"> (سجل قديم)</span>}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {fmtDateTime(p.paidAt)} • {METHOD_LABELS[p.method] || p.method} • القيد: {p.transactionId ? p.transactionId.slice(-8) : "—"}
                      {p.note ? ` • ${p.note}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 tabular-nums shrink-0">
                    {formatDA(p.amount)}
                  </Badge>
                  {canVoid && !p.legacy && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setVoidTarget(p); setVoidReason(""); }}
                      className="h-7 px-2.5 text-xs gap-1 shrink-0 text-rose-600 border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-700"
                      title="إلغاء هذا التسديد (يحذف قيده من المركز المالي)"
                      aria-label={`إلغاء تسديد ${formatDA(p.amount)} للعامل ${p.workerName}`}
                    >
                      <XCircle className="h-3.5 w-3.5" /> إلغاء
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ حوار تسديد الأجر ═══ */}
      <Dialog open={!!payTarget} onOpenChange={(o) => !o && setPayTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Banknote className="h-5 w-5 text-amber-600" /> تسديد الأجر
            </DialogTitle>
            <DialogDescription className="text-xs">
              ينشئ القيد المالي فوراً في المركز المالي — نفس العملية من أي صفحة، بلا ازدواج.
              في حالة الخطأ يمكن إلغاء هذا التسديد من «سجل التسديدات» بالأسفل.
            </DialogDescription>
          </DialogHeader>
          {payTarget && (
            <div className="space-y-3">
              {/* ملخص الحساب */}
              <div className="rounded-xl bg-muted/40 p-3 space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">العامل</span>
                  <span className="font-bold">{payTarget.name}{payTarget.position ? ` — ${payTarget.position}` : ""}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">الفترة</span>
                  <span className="font-bold text-xs">{periodLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">الحساب</span>
                  <span className="text-xs">{payTarget.totalHours} سا × {payTarget.hourRate} دج</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">إجمالي المستحق</span>
                  <span className="font-bold text-amber-700 tabular-nums">{formatDA(payTarget.gross)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">المدفوع سابقاً</span>
                  <span className="font-bold text-emerald-700 tabular-nums">{formatDA(payTarget.paid)}</span>
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t">
                  <span className="font-semibold">المتبقي</span>
                  <span className="font-extrabold text-rose-600 tabular-nums">{formatDA(payTarget.remaining)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">المبلغ المراد دفعه (دج) *</Label>
                  <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="h-9" min={1} max={payTarget.remaining} aria-label="المبلغ" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">طريقة الدفع</Label>
                  <Select value={payMethod} onValueChange={setPayMethod}>
                    <SelectTrigger className="h-9" aria-label="طريقة الدفع"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(METHOD_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">تاريخ الدفع</Label>
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="h-9" aria-label="تاريخ الدفع" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">ملاحظات</Label>
                <Textarea value={payNote} onChange={(e) => setPayNote(e.target.value)} rows={2} placeholder="مثال: تسديد نصف الأجر..." className="text-sm" aria-label="ملاحظات" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPayTarget(null)}>إلغاء</Button>
            <Button onClick={handlePay} disabled={paying} className="bg-amber-600 hover:bg-amber-700 text-white">
              {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4 ml-1" />}
              تأكيد الدفع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ حوار إلغاء التسديد ═══ */}
      <AlertDialog open={!!voidTarget} onOpenChange={(o) => !o && setVoidTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base">
              <XCircle className="h-5 w-5 text-rose-600" /> إلغاء تسديد الأجر
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              سيُحذف سجل التسديد <strong>{voidTarget ? formatDA(voidTarget.amount) : ""}</strong>
              {voidTarget?.workerName ? ` للعامل ${voidTarget.workerName}` : ""} مع قيده المالي من المركز المالي معاً (عملية واحدة).
              هذا الإجراء موثّق في سجل التدقيق.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">سبب الإلغاء *</Label>
            <Input autoFocus value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="مثال: خطأ في المبلغ..." className="h-9" aria-label="سبب الإلغاء" />
            <p className="text-[11px] text-muted-foreground">سيُحذف القيد من دفتر المعاملات ويُعاد المبلغ إلى المتبقي للعامل تلقائياً.</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>رجوع</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleVoid(); }}
              disabled={voiding || voidReason.trim().length < 3}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {voiding ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 ml-1" />}
              تأكيد الإلغاء
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function SummaryChip({ icon: Icon, label, value, tone }: {
  icon: typeof Wallet; label: string; value: number; tone: "amber" | "emerald" | "rose";
}) {
  const tones: Record<string, string> = {
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-200",
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200",
    rose: "border-rose-500/30 bg-rose-500/5 text-rose-800 dark:text-rose-200",
  };
  return (
    <div className={cn("rounded-xl border p-2.5 flex flex-col justify-center gap-0.5", tones[tone])}>
      <span className="text-[10px] flex items-center gap-1 opacity-80"><Icon className="h-3 w-3" /> {label}</span>
      <span className="text-sm sm:text-base font-extrabold tabular-nums">{formatDA(value)}</span>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "amber" | "emerald" | "rose" }) {
  const tones: Record<string, string> = {
    amber: "text-amber-700 dark:text-amber-300",
    emerald: "text-emerald-700 dark:text-emerald-300",
    rose: "text-rose-600 dark:text-rose-400",
  };
  return (
    <div className="rounded-lg bg-muted/50 p-1.5">
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className={cn("text-xs font-bold tabular-nums truncate", tone && tones[tone])}>{value}</p>
    </div>
  );
}

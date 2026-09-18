"use client";

/**
 * DayStatementCard — حركة اليوم (المرحلة 20)
 * ═════════════════════════════════════════════════════════════
 * منتقي تاريخ (افتراضي: اليوم) → GET /api/financial/dashboard?day=YYYY-MM-DD
 *   - بطاقة معادلة اليوم: رصيد افتتاحي + داخل − خارج = رصيد ختامي
 *   - قائمة عمليات اليوم (max-h-64 overflow-y-auto بشريط تمرير أنيق)
 */

import { useCallback, useEffect, useState } from "react";
import { onFinancialUpdated } from "@/lib/financial-events";
import {
  CalendarDays, Loader2, AlertTriangle, RefreshCw,
  ArrowDownCircle, ArrowUpCircle, Landmark, Inbox, ArrowRightLeft, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface DayTx {
  id: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  date: string;
  payeeName?: string | null;
  paymentMethod?: string | null;
  note?: string | null;
}

interface DayStatement {
  date: string;
  openingBalance: number;
  dayIncome: number;
  dayExpense: number;
  closingBalance: number;
  transactions: DayTx[];
}

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
  bank: "بنكي",
  cheque: "شيك",
};

function formatDA(n: number): string {
  return new Intl.NumberFormat("fr-DZ").format(Math.round(n)) + " دج";
}

function formatShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "م";
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + "ك";
  return String(Math.round(n));
}

/** تاريخ اليوم بالتوقيت المحلي بصيغة YYYY-MM-DD */
function todayLocalISO(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function dayLabel(iso: string): string {
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("ar-DZ", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export function DayStatementCard({ refreshSignal = 0 }: { refreshSignal?: number }) {
  const [day, setDay] = useState<string>(todayLocalISO);
  const [data, setData] = useState<DayStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDay = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/financial/dashboard?day=${day}`, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      setData((json?.dayStatement as DayStatement) ?? null);
    } catch {
      setError("تعذر تحميل كشف اليوم");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [day]);

  useEffect(() => {
    fetchDay();
  }, [fetchDay, refreshSignal]);

  // ★ مزامنة فورية: أي عملية مالية تُحدّث كشف اليوم بلا تحديث يدوي
  useEffect(() => onFinancialUpdated(() => fetchDay(true)), [fetchDay]);

  const txs = data?.transactions ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4 text-teal-600" /> حركة اليوم — كشف حساب يومي
            </CardTitle>
            <CardDescription className="text-[11px]">
              افتتاحي + داخل − خارج = ختامي، مع كل عمليات اليوم المختار
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="relative">
              <CalendarDays className="h-3.5 w-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="date"
                value={day}
                max={todayLocalISO()}
                onChange={(e) => { if (e.target.value) setDay(e.target.value); }}
                aria-label="اختيار تاريخ الكشف اليومي"
                className="h-11 rounded-lg border border-input bg-background pl-2 pr-8 text-xs font-bold tabular-nums shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => fetchDay(true)}
              disabled={refreshing}
              aria-label="تحديث كشف اليوم"
              className="h-11 w-11 p-0 text-teal-700 dark:text-teal-300"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
            <Skeleton className="h-24 rounded-xl" />
          </div>
        ) : error || !data ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <AlertTriangle className="h-6 w-6 text-rose-500" />
            <p className="text-xs font-bold text-rose-700 dark:text-rose-300">{error || "لا بيانات"}</p>
            <Button size="sm" variant="outline" onClick={() => fetchDay()} className="h-9">
              <RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة
            </Button>
          </div>
        ) : (
          <>
            {/* معادلة اليوم */}
            <div className="rounded-xl border border-teal-500/25 bg-teal-500/5 p-2.5">
              <p className="text-[10px] font-bold text-teal-700 dark:text-teal-300 mb-2">
                كشف يوم {dayLabel(data.date)}
              </p>
              <div className="flex flex-wrap items-stretch gap-1.5">
                <DayTile label="افتتاحي" value={formatShort(data.openingBalance)} tone="slate" />
                <Op sign="+" />
                <DayTile label="داخل" value={formatShort(data.dayIncome)} tone="emerald" icon={ArrowDownCircle} />
                <Op sign="−" />
                <DayTile label="خارج" value={formatShort(data.dayExpense)} tone="rose" icon={ArrowUpCircle} />
                <Op sign="=" />
                <DayTile label="ختامي" value={formatShort(data.closingBalance)} tone="teal" icon={Landmark} strong />
              </div>
            </div>

            {/* عمليات اليوم */}
            {txs.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 py-4 text-center">
                <Inbox className="h-6 w-6 text-muted-foreground/50" />
                <p className="text-[11px] text-muted-foreground">لا حركات في هذا اليوم</p>
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-xl border border-border/60 nice-scroll">
                <div className="divide-y divide-border/60">
                  {txs.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 px-2.5 py-2">
                      <span className={cn(
                        "h-1.5 w-1.5 rounded-full shrink-0",
                        t.type === "income" ? "bg-emerald-500" : "bg-rose-500"
                      )} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate">
                          {CATEGORY_LABELS[t.category] || t.category}
                          {t.payeeName ? <span className="font-normal text-muted-foreground"> — {t.payeeName}</span> : null}
                        </p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <ArrowRightLeft className="h-3 w-3" />
                          {t.paymentMethod ? (METHOD_LABELS[t.paymentMethod] || t.paymentMethod) : "—"}
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
function DayTile({ label, value, tone, icon: Icon, strong }: {
  label: string;
  value: string;
  tone: "slate" | "emerald" | "rose" | "teal";
  icon?: typeof Landmark;
  strong?: boolean;
}) {
  const tones: Record<string, string> = {
    slate: "border-border/60 bg-card text-foreground",
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    rose: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    teal: "border-teal-500/40 bg-teal-500/15 text-teal-800 dark:text-teal-200",
  };
  return (
    <div className={cn("min-w-[86px] flex-1 rounded-lg border p-2 text-center", tones[tone])}>
      <span className="text-[9px] font-bold flex items-center justify-center gap-1 opacity-80">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </span>
      <p className={cn("font-extrabold tabular-nums leading-none mt-1", strong ? "text-sm sm:text-base" : "text-xs sm:text-sm")}>
        {value}
      </p>
    </div>
  );
}

function Op({ sign }: { sign: string }) {
  return (
    <span className="self-center text-base font-extrabold text-muted-foreground select-none px-0.5">
      {sign}
    </span>
  );
}

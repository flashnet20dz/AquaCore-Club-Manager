"use client";

/**
 * DuesSection — قسم «المستحقات والتسديد» في المركز المالي
 * ═════════════════════════════════════════════════════════════
 * لكل نوع مستحق: إجمالي المستحق / المدفوع / المتبقي / حالة الدفع + زر تسديد.
 * الأرقام كلها من الدفتر (FinancialBalance) ومن Pointage للأجور — بلا قيم ثابتة.
 *
 * ★ الدفع من هنا ينشئ نفس العملية المالية التي تُنشأ من الصفحة الخاصة:
 *   - التأمين / حقوق المركب / اللوازم / الديون → نافذة القيد الموحّد نفسها
 *     (FinancialTransactionDialog) → قيد واحد في الدفتر
 *   - أجور العمال → نفس مكوّن WagesSection المستخدم في صفحة ساعات العمل
 *     (POST /api/wages) → WagePayment + قيد واحد مرتبط 1:1
 * فلا يُنشأ قيد ثانٍ مهما كانت صفحة الدفع (Single Source of Truth).
 */

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck, Building2, Users, BookOpen, HandCoins, Loader2,
  BadgeCheck, CircleAlert, CircleDashed, RefreshCw, Wallet, Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FinancialTransactionDialog } from "@/components/financial-transaction-dialog";
import { WagesSection } from "@/components/wages/wages-section";

interface DueRow {
  label: string;
  collected: number;
  paid: number;
  remaining: number;
}

interface DuesData {
  insurance: DueRow;
  compound: DueRow;
  wages: DueRow;
  officeSupplies: DueRow;
  otherDebt: DueRow;
}

interface DuesSectionProps {
  /** يُستدعى بعد أي تسديد — لتحديث بطاقات النظرة العامة والرصيد في الرأس */
  onChanged?: () => void;
}

type PayKind = "insurance" | "compound_rights" | "office_supplies" | "other_expense";

interface PayPreset {
  type: "expense";
  category: PayKind;
  payeeName: string;
  note: string;
}

function formatDA(n: number): string {
  return new Intl.NumberFormat("fr-DZ").format(Math.round(n)) + " دج";
}

const PAYEE_HINTS: Record<PayKind, string> = {
  insurance: "صندوق التأمين",
  compound_rights: "ديوان المركب",
  office_supplies: "المورد",
  other_expense: "جهة الاستفادة",
};

const KIND_META: Record<PayKind, { icon: typeof ShieldCheck; cls: string }> = {
  insurance: { icon: ShieldCheck, cls: "bg-emerald-500/15 text-emerald-700" },
  compound_rights: { icon: Building2, cls: "bg-teal-500/15 text-teal-700" },
  office_supplies: { icon: BookOpen, cls: "bg-violet-500/15 text-violet-700" },
  other_expense: { icon: HandCoins, cls: "bg-rose-500/15 text-rose-700" },
};

export function DuesSection({ onChanged }: DuesSectionProps) {
  const [data, setData] = useState<DuesData | null>(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // نافذة القيد الموحّد (نفس نافذة الدفتر — preset حسب نوع المستحق)
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payPreset, setPayPreset] = useState<PayPreset | null>(null);

  // نافذة أجور العمال (نفس مكوّن صفحة ساعات العمل)
  const [wagesOpen, setWagesOpen] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetch("/api/financial/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      setData(json.dues ?? null);
      setBalance(json.balance?.balance ?? 0);
    } catch {
      toast.error("تعذر تحميل المستحقات");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openPay = (kind: PayKind, label: string) => {
    setPayPreset({
      type: "expense",
      category: kind,
      payeeName: PAYEE_HINTS[kind],
      note: `تسديد ${label} — من المركز المالي`,
    });
    setPayDialogOpen(true);
  };

  const rows: Array<{ key: string; icon: typeof ShieldCheck; cls: string; title: string; subtitle: string; row: DueRow | null; pay?: () => void; wages?: boolean }> = data ? [
    {
      key: "insurance", icon: ShieldCheck, cls: KIND_META.insurance.cls,
      title: "التأمين", subtitle: "المحصَّل من المنخرطين مقابل المُسلَّم لصندوق التأمين",
      row: data.insurance, pay: () => openPay("insurance", "التأمين"),
    },
    {
      key: "compound", icon: Building2, cls: KIND_META.compound_rights.cls,
      title: "حقوق المركب", subtitle: "1000 دج لكل منخرط مؤهَّل — المستحق لديوان المركب",
      row: data.compound, pay: () => openPay("compound_rights", "حقوق المركب"),
    },
    {
      key: "wages", icon: Users, cls: "bg-amber-500/15 text-amber-700",
      title: "أجور العمال", subtitle: "محسوبة من ساعات العمل المسجلة — نفس نظام صفحة ساعات العمل",
      row: data.wages, wages: true,
    },
    {
      key: "office", icon: BookOpen, cls: KIND_META.office_supplies.cls,
      title: "الأدوات المكتبية", subtitle: "مصاريف اللوازم المسجلة في الدفتر",
      row: data.officeSupplies, pay: () => openPay("office_supplies", "الأدوات المكتبية"),
    },
    {
      key: "other", icon: HandCoins, cls: KIND_META.other_expense.cls,
      title: "ديون أخرى", subtitle: "دفعات ومصاريف أخرى مسجلة في الدفتر",
      row: data.otherDebt, pay: () => openPay("other_expense", "ديون أخرى"),
    },
  ] : [];

  function statusOf(remaining: number, total: number): { label: string; cls: string; icon: typeof BadgeCheck } {
    if (remaining <= 0) return { label: "مسدَّد بالكامل", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", icon: BadgeCheck };
    if (total > 0 && remaining < total) return { label: "مسدَّد جزئياً", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30", icon: CircleAlert };
    return { label: "غير مسدَّد", cls: "bg-rose-500/15 text-rose-700 border-rose-500/30", icon: CircleDashed };
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-teal-500/25 bg-teal-500/5 px-3 py-2 flex items-start gap-2">
        <Landmark className="h-3.5 w-3.5 text-teal-600 mt-0.5 shrink-0" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          المستحقات محسوبة من الدفتر نفسه — أي تسديد من هنا أو من صفحته الخاصة ينشئ العملية المالية نفسها (قيد واحد، بلا ازدواج).
        </p>
      </div>

      {/* رأس + تحديث */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm flex items-center gap-1.5">
          <Wallet className="h-4 w-4 text-teal-600" /> المستحقات والالتزامات
        </h3>
        <Button size="sm" variant="ghost" onClick={() => fetchData(true)} disabled={refreshing} aria-label="تحديث المستحقات">
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {rows.map((r, i) => {
            const Icon = r.icon;
            const st = r.row ? statusOf(r.row.remaining, r.row.collected) : null;
            const StIcon = st?.icon ?? BadgeCheck;
            return (
              <motion.div
                key={r.key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className="p-3.5 hover:shadow-sm transition">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0", r.cls)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm">{r.title}</p>
                        {st && (
                          <Badge variant="outline" className={cn("text-[9px] gap-0.5", st.cls)}>
                            <StIcon className="h-2.5 w-2.5" /> {st.label}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{r.subtitle}</p>
                    </div>

                    {/* الأرقام */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center min-w-[240px]">
                      <MiniAmount label="المستحق" value={r.row?.collected ?? 0} tone="amber" />
                      <MiniAmount label="المدفوع" value={r.row?.paid ?? 0} tone="emerald" />
                      <MiniAmount label="المتبقي" value={r.row?.remaining ?? 0} tone={(r.row?.remaining ?? 0) > 0 ? "rose" : "emerald"} />
                    </div>

                    {/* زر التسديد */}
                    {r.wages ? (
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white gap-1 shrink-0" onClick={() => setWagesOpen(true)}>
                        <Users className="h-3.5 w-3.5" /> تسديد أجور
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="gap-1 shrink-0" onClick={r.pay}>
                        <Wallet className="h-3.5 w-3.5" /> تسديد
                      </Button>
                    )}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* نافذة القيد الموحّد — نفس نافذة الدفتر تماماً (لا عملية ثانية) */}
      <FinancialTransactionDialog
        open={payDialogOpen}
        onOpenChange={setPayDialogOpen}
        currentBalance={balance}
        preset={payPreset}
        onSaved={() => {
          fetchData(true);
          onChanged?.();
          toast.success("تم التسديد — القيد في الدفتر ومزامَن مع كل الصفحات ✓");
        }}
      />

      {/* نافذة أجور العمال — نفس مكوّن صفحة ساعات العمل (لا عملية ثانية) */}
      <Dialog open={wagesOpen} onOpenChange={setWagesOpen}>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-amber-600" /> تسديد أجور العمال
            </DialogTitle>
            <DialogDescription className="text-xs">
              نفس نظام صفحة ساعات العمل — التسديد يُنشئ قيداً واحداً مرتبطاً بالعامل وبالفترة.
            </DialogDescription>
          </DialogHeader>
          <WagesSection compact onChanged={() => { fetchData(true); onChanged?.(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MiniAmount({ label, value, tone }: { label: string; value: number; tone: "amber" | "emerald" | "rose" }) {
  const tones: Record<string, string> = {
    amber: "text-amber-700 dark:text-amber-300",
    emerald: "text-emerald-700 dark:text-emerald-300",
    rose: "text-rose-600 dark:text-rose-400",
  };
  return (
    <div className="rounded-lg bg-muted/50 px-2 py-1.5">
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className={cn("text-xs font-bold tabular-nums", tones[tone])}>{formatDA(value)}</p>
    </div>
  );
}

"use client";

/**
 * WorkerWagesDialog — أداة «أجور العمال»
 * ═════════════════════════════════════════════════════════════
 * الجزء الفريد المُنقَذ من قسم الأعباء القديم (بلا تكرار):
 *   • يحسب مستحقات كل عامل من ساعات العمل المعتمدة × أجر الساعة
 *   • يطرح ما سُدِّد له سابقاً (دفعات salary) ليبقى «المتبقي» دقيقاً
 *   • التسديد يمر عبر POST /api/payments (category=salary) فيُرحَّل
 *     تلقائياً إلى دفتر المعاملات المالية كمصروف «أجور عمال» باسم العامل
 *
 * أزرار العمل: زر واحد في شريط أدوات الدفتر → حوار واحد مركّز.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users, Loader2, Plus, Wallet, BadgeCheck, Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────
// Types & constants
// ─────────────────────────────────────────────────────────────
interface WorkerRow {
  id: string;
  name: string;
  role: string;
  phone: string | null;
}

interface WorkHourRecord {
  userId: string;
  status: string;
  startTime: string;
  endTime: string;
}

interface SalaryPayment {
  userId: string | null;
  amount: number;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير",
  assistant: "مساعد إداري",
  lifeguard: "حارس سباحة",
  observer: "مراقب",
  accountant: "محاسب",
};

const ROLE_ICONS: Record<string, string> = {
  admin: "👑",
  assistant: "💼",
  lifeguard: "🏊",
  observer: "👁️",
  accountant: "💰",
};

const METHOD_LABELS: Record<string, string> = {
  cash: "نقدي",
  bank: "بنك",
  cheque: "شيك",
};

function formatDA(n: number): string {
  return new Intl.NumberFormat("fr-DZ").format(Math.round(n)) + " دج";
}

interface WorkerWagesDialogProps {
  onSaved?: () => void;
}

// ─────────────────────────────────────────────────────────────
// Component (زر + حوار في مكوّن واحد)
// ─────────────────────────────────────────────────────────────
export function WorkerWagesDialog({ onSaved }: WorkerWagesDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [workHours, setWorkHours] = useState<WorkHourRecord[]>([]);
  const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>([]);
  const [workHourRate, setWorkHourRate] = useState(200);

  // نموذج التسديد
  const [payWorkerId, setPayWorkerId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, whRes, settingsRes, payRes] = await Promise.all([
        fetch("/api/users", { cache: "no-store" }),
        fetch("/api/workhours", { cache: "no-store" }),
        fetch("/api/settings", { cache: "no-store" }),
        fetch("/api/payments", { cache: "no-store" }),
      ]);
      const usersData = await usersRes.json();
      const whData = await whRes.json();
      const settingsData = await settingsRes.json();
      const payData = await payRes.json();
      setWorkers((usersData.users || []).filter((u: WorkerRow & { pending?: boolean }) => u.role !== "admin" && !u.pending));
      setWorkHours(whData.workHours || []);
      setSalaryPayments((payData.payments || []).filter((p: SalaryPayment & { category: string }) => p.category === "salary"));
      setWorkHourRate(parseInt(settingsData.settings?.workHourRate || "200") || 200);
    } catch {
      toast.error("فشل تحميل بيانات العمال");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  /** ساعات معتمدة لكل عامل */
  const getWorkerStats = useCallback((workerId: string) => {
    const approved = workHours.filter((w) => w.userId === workerId && w.status === "approved");
    const totalHours = approved.reduce((sum, w) => {
      const s = new Date(w.startTime).getTime();
      const e = new Date(w.endTime).getTime();
      return sum + Math.round(((e - s) / 3600000) * 10) / 10;
    }, 0);
    const dues = Math.round(totalHours * workHourRate);
    const paid = salaryPayments.filter((p) => p.userId === workerId).reduce((s, p) => s + p.amount, 0);
    return { totalHours, dues, paid, balance: dues - paid };
  }, [workHours, workHourRate, salaryPayments]);

  const grandRemaining = useMemo(
    () => workers.reduce((s, w) => s + Math.max(0, getWorkerStats(w.id).balance), 0),
    [workers, getWorkerStats]
  );

  const openPayForm = (workerId: string) => {
    const stats = getWorkerStats(workerId);
    setPayWorkerId(workerId);
    setAmount(String(Math.max(0, stats.balance) || ""));
    setMethod("cash");
    setNote("");
  };

  const handlePay = async () => {
    if (!payWorkerId) return;
    if (!amount || parseInt(amount) <= 0) {
      toast.error("أدخل مبلغاً صحيحاً");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "salary",
          amount,
          method,
          userId: payWorkerId,
          note: note.trim() || "تسديد أجر",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل التسديد");
      toast.success("تم التسديد — ورُحِّل القيد إلى دفتر المعاملات ✓");
      setPayWorkerId(null);
      await loadData();
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التسديد");
    } finally {
      setSaving(false);
    }
  };

  const payWorker = payWorkerId ? workers.find((w) => w.id === payWorkerId) : null;

  return (
    <>
      {/* الزر — يوضع في شريط أدوات الدفتر */}
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Users className="h-4 w-4" />
        <span className="hidden sm:inline">أجور العمال</span>
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setPayWorkerId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-amber-600" /> أجور العمال
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              المستحق محسوب من ساعات العمل المعتمدة × {workHourRate} دج/سا — التسديد يُرحَّل تلقائياً إلى دفتر المعاملات كمصروف «أجور عمال».
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : workers.length === 0 ? (
            <div className="text-center py-8 rounded-xl bg-muted/30">
              <Users className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">لا يوجد عمال — أضف مستخدمين من تبويب «المستخدمون».</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* ملخص علوي */}
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5" /> إجمالي المتبقي لجميع العمال
                </span>
                <span className="text-sm font-extrabold tabular-nums text-amber-800 dark:text-amber-200">
                  {formatDA(grandRemaining)}
                </span>
              </div>

              {/* قائمة العمال */}
              <div className="space-y-2 max-h-[46vh] overflow-y-auto pl-1 scrollbar-thin" role="list" aria-label="قائمة العمال">
                {workers.map((w) => {
                  const st = getWorkerStats(w.id);
                  const isPaying = payWorkerId === w.id;
                  return (
                    <div
                      key={w.id}
                      className={cn(
                        "rounded-xl border p-3 transition",
                        isPaying ? "border-amber-500/50 bg-amber-500/5" : "border-border/60 hover:bg-accent/40"
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <Avatar className="h-9 w-9 rounded-lg shrink-0">
                          <AvatarFallback className="rounded-md text-xs font-bold bg-amber-500/15 text-amber-700">
                            {w.name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-sm truncate">{w.name}</p>
                            <Badge variant="outline" className="text-[9px] h-4 px-1 bg-amber-500/10 text-amber-700 border-amber-500/30">
                              {ROLE_ICONS[w.role] || "👤"} {ROLE_LABELS[w.role] || w.role}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1 text-[11px]">
                            <span className="text-muted-foreground">ساعات العمل: <strong className="tabular-nums text-teal-700 dark:text-teal-300">{st.totalHours} سا</strong></span>
                            <span className="text-muted-foreground">المستحق: <strong className="tabular-nums">{formatDA(st.dues)}</strong></span>
                            <span className="text-muted-foreground">المسدد: <strong className="tabular-nums text-emerald-700 dark:text-emerald-300">{formatDA(st.paid)}</strong></span>
                            <span className="text-muted-foreground">المتبقي: <strong className={cn("tabular-nums", st.balance > 0 ? "text-rose-600" : "text-emerald-600")}>{formatDA(st.balance)}</strong></span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={st.balance > 0 ? "default" : "outline"}
                          className="h-8 shrink-0 gap-1"
                          onClick={() => (isPaying ? setPayWorkerId(null) : openPayForm(w.id))}
                          aria-label={`تسديد مستحقات ${w.name}`}
                        >
                          {isPaying ? <BadgeCheck className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                          {isPaying ? "إغلاق" : "تسديد"}
                        </Button>
                      </div>

                      {/* نموذج التسديد المدمج */}
                      {isPaying && (
                        <div className="mt-3 pt-3 border-t border-amber-500/20 space-y-2.5">
                          <div className="grid grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold">المبلغ (دج)</Label>
                              <Input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="h-9"
                                placeholder="0"
                                aria-label="مبلغ التسديد"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold">طريقة الدفع</Label>
                              <Select value={method} onValueChange={setMethod}>
                                <SelectTrigger className="h-9 w-full" aria-label="طريقة الدفع">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(METHOD_LABELS).map(([v, l]) => (
                                    <SelectItem key={v} value={v}>{l}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold">ملاحظة (اختياري)</Label>
                            <Input
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              className="h-9"
                              placeholder="مثال: أجر نصف شهر..."
                              aria-label="ملاحظة"
                            />
                          </div>
                          <Button size="sm" className="w-full gap-1.5 bg-amber-600 hover:bg-amber-700" onClick={handlePay} disabled={saving}>
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                            تسجيل التسديد وترحيله للدفتر
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

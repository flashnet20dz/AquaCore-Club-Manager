"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  RefreshCw,
  Calendar,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Snowflake,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { SubscriberWithComputed } from "@/lib/rcs";

interface Renewal {
  id: string;
  renewalDate: string;
  expiryDate: string;
  months: number;
  amount: number;
  paymentStatus: string;
  note: string | null;
  subscriber: {
    id: string;
    fileNumber: string;
    lastName: string;
    firstName: string;
    phone: string | null;
  };
}

interface RenewalPanelProps {
  subscribers: SubscriberWithComputed[];
  onRefresh?: () => void;
}

export function RenewalPanel({ subscribers, onRefresh }: RenewalPanelProps) {
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [loading, setLoading] = useState(true);
  const [renewalModal, setRenewalModal] = useState<{ open: boolean; subscriber: SubscriberWithComputed | null }>({
    open: false,
    subscriber: null,
  });
  const [filter, setFilter] = useState<"all" | "expiring" | "expired" | "frozen">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchRenewals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/renewals");
      const data = await res.json();
      setRenewals(data.renewals || []);
    } catch {
      toast.error("تعذر تحميل التجديدات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRenewals();
  }, [fetchRenewals]);

  // Categorize subscribers
  const expiringSoon = subscribers.filter((s) => s.renewalStatus === "⚠️ قريب الانتهاء");
  const expired = subscribers.filter((s) => s.renewalStatus === "⛔ منتهي - يتطلب تجديد");
  const frozen = subscribers.filter((s) => s.renewalStatus === "🔒 مجمدة");
  const active = subscribers.filter((s) => s.renewalStatus === "✅ ساري");

  const filteredSubs = (() => {
    let result = subscribers;
    if (filter === "expiring") result = expiringSoon;
    else if (filter === "expired") result = expired;
    else if (filter === "frozen") result = frozen;
    // 🔑 فلتر البحث برقم الملف أو الاسم أو اللقب
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((s) =>
        s.fileNumber?.toLowerCase().includes(q) ||
        s.lastName?.toLowerCase().includes(q) ||
        s.firstName?.toLowerCase().includes(q) ||
        `${s.lastName} ${s.firstName}`.toLowerCase().includes(q)
      );
    }
    return result;
  })();

  const sendWhatsApp = (sub: SubscriberWithComputed) => {
    if (!sub.phone) {
      toast.error("لا يوجد رقم هاتف لهذا المنخرط");
      return;
    }
    const msg = `مرحباً ${sub.lastName} ${sub.firstName}،%0A%0Aاشتراكك في نادي RCS ${
      sub.renewalStatus === "⛔ منتهي - يتطلب تجديد" ? "منتهي" : "قريب الانتهاء"
    }.%0A${sub.expiryDate ? `تاريخ الانتهاء: ${new Date(sub.expiryDate).toISOString().split("T")[0].replace(/-/g,"/")}` : ""}%0A%0Aيرجى التجديد في أقرب وقت لتجنب تجميد الاشتراك.%0A%0Aشكراً.%0Aنادي RCS للسباحة`;
    window.open(`https://wa.me/213${sub.phone.replace(/^0/, "")}?text=${msg}`, "_blank");
  };

  const sendBulkWhatsApp = (list: SubscriberWithComputed[]) => {
    if (list.length === 0) return;
    const withPhone = list.filter((s) => s.phone);
    if (withPhone.length === 0) {
      toast.error("لا توجد أرقام هاتف في هذه القائمة");
      return;
    }
    // Open the first one with a summary
    const first = withPhone[0];
    const msg = `مرحباً،%0A%0Aتذكير: اشتراكك في نادي RCS يحتاج إلى تجديد.%0A%0Aيرجى التواصل مع الإدارة.%0A%0Aعدد المنخرطين الذين يحتاجون تجديد: ${withPhone.length}`;
    window.open(`https://wa.me/213${first.phone!.replace(/^0/, "")}?text=${msg}`, "_blank");
    toast.info(`تم فتح WhatsApp لـ ${first.lastName} ${first.firstName} (${withPhone.length} منخرط يحتاجون تجديد)`);
  };

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <RenewalStat
          icon={CheckCircle2}
          label="سارية"
          count={active.length}
          color="emerald"
          onClick={() => setFilter(filter === "all" ? "all" : "all")}
        />
        <RenewalStat
          icon={Clock}
          label="قريبة الانتهاء"
          count={expiringSoon.length}
          color="amber"
          active={filter === "expiring"}
          onClick={() => setFilter(filter === "expiring" ? "all" : "expiring")}
        />
        <RenewalStat
          icon={XCircle}
          label="منتهية"
          count={expired.length}
          color="rose"
          active={filter === "expired"}
          onClick={() => setFilter(filter === "expired" ? "all" : "expired")}
        />
        <RenewalStat
          icon={Snowflake}
          label="مجمدة"
          count={frozen.length}
          color="slate"
          active={filter === "frozen"}
          onClick={() => setFilter(filter === "frozen" ? "all" : "frozen")}
        />
      </div>

      {/* Subscribers needing renewal */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        {/* 🔑 بحث برقم الملف أو الاسم */}
        <div className="mb-3">
          <Input
            placeholder="بحث برقم الملف أو الاسم أو اللقب..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" />
            {filter === "expiring" ? "قريبة الانتهاء (خلال 5 أيام)"
              : filter === "expired" ? "اشتراكات منتهية"
              : filter === "frozen" ? "اشتراكات مجمدة"
              : "جميع الاشتراكات"}
            <Badge variant="secondary">{filteredSubs.length}</Badge>
          </h3>
          {(filter === "expiring" || filter === "expired") && filteredSubs.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => sendBulkWhatsApp(filteredSubs)}>
              <MessageCircle className="h-3.5 w-3.5 ml-1" /> تذكير جماعي
            </Button>
          )}
        </div>

        <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1 -mr-1">
          {filteredSubs.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">لا يوجد منخرطون في هذه الفئة</p>
          ) : (
            filteredSubs.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition"
              >
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg text-xs font-bold shrink-0",
                  s.renewalStatus === "✅ ساري" ? "bg-emerald-500/15 text-emerald-700"
                  : s.renewalStatus === "⚠️ قريب الانتهاء" ? "bg-amber-500/15 text-amber-700"
                  : s.renewalStatus === "⛔ منتهي - يتطلب تجديد" ? "bg-rose-500/15 text-rose-700"
                  : "bg-slate-500/15 text-slate-700"
                )}>
                  {s.renewalStatus === "✅ ساري" ? <CheckCircle2 className="h-5 w-5" />
                  : s.renewalStatus === "⚠️ قريب الانتهاء" ? <Clock className="h-5 w-5" />
                  : s.renewalStatus === "⛔ منتهي - يتطلب تجديد" ? <XCircle className="h-5 w-5" />
                  : <Snowflake className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{s.lastName} {s.firstName}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{s.fileNumber}</span>
                    {s.expiryDate && (
                      <>
                        <span>•</span>
                        <span>انتهاء: {new Date(s.expiryDate).toISOString().split("T")[0].replace(/-/g,"/")}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {s.phone && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-emerald-600 hover:bg-emerald-500/10"
                      onClick={() => sendWhatsApp(s)}
                      title="تذكير عبر WhatsApp"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={() => setRenewalModal({ open: true, subscriber: s })}
                  >
                    <Plus className="h-3.5 w-3.5 ml-1" /> تجديد
                  </Button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Recent renewals history */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" /> آخر التجديدات
        </h3>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : renewals.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">لا توجد تجديدات بعد</p>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1 -mr-1">
            {renewals.slice(0, 20).map((r) => (
              <div key={r.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition text-sm">
                <RefreshCw className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{r.subscriber.lastName} {r.subscriber.firstName}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.renewalDate).toISOString().split("T")[0].replace(/-/g,"/")} → {new Date(r.expiryDate).toISOString().split("T")[0].replace(/-/g,"/")} ({r.months} شهر)
                  </p>
                </div>
                <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
                  {r.amount.toLocaleString("en-US")} دج
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Renewal Modal */}
      <RenewalModal
        open={renewalModal.open}
        onOpenChange={(open) => setRenewalModal({ open, subscriber: renewalModal.subscriber })}
        subscriber={renewalModal.subscriber}
        onSaved={() => { fetchRenewals(); onRefresh?.(); }}
      />
    </div>
  );
}

function RenewalStat({ icon: Icon, label, count, color, active, onClick }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  color: "emerald" | "amber" | "rose" | "slate";
  active?: boolean;
  onClick?: () => void;
}) {
  const colors = {
    emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    amber: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    rose: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    slate: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
  };
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-2xl border-2 p-3 flex items-center gap-2 transition",
        colors[color],
        active ? "ring-2 ring-offset-2 ring-offset-background" : "hover:scale-[1.02]"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <div className="text-right">
        <p className="text-2xl font-extrabold leading-none tabular-nums">{count}</p>
        <p className="text-[10px] opacity-80 mt-0.5">{label}</p>
      </div>
    </button>
  );
}

function RenewalModal({ open, onOpenChange, subscriber, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriber: SubscriberWithComputed | null;
  onSaved: () => void;
}) {
  const [months, setMonths] = useState("1");
  const [amount, setAmount] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("مدفوع");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && subscriber) {
      setMonths("1");
      // Default amount: subscriptionFee + insurance for 1 month
      const defaultAmount = (subscriber.subscriptionFee ?? 0) + (subscriber.insuranceFee ?? 0);
      setAmount(String(defaultAmount || ""));
      setPaymentStatus("مدفوع");
      setNote("");
    }
  }, [open, subscriber]);

  const handleSubmit = async () => {
    if (!subscriber || !amount) return;
    setSaving(true);
    try {
      const res = await fetch("/api/renewals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriberId: subscriber.id,
          months: parseInt(months) || 1,
          amount: parseInt(amount),
          paymentStatus,
          note: note || null,
        }),
      });
      if (!res.ok) throw new Error("فشل");
      toast.success(`تم تجديد اشتراك ${subscriber.lastName} ${subscriber.firstName} لمدة ${months} شهر`);
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error("فشل التجديد");
    } finally {
      setSaving(false);
    }
  };

  if (!subscriber) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            تجديد اشتراك
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="font-bold">{subscriber.lastName} {subscriber.firstName}</p>
            <p className="text-xs text-muted-foreground font-mono">{subscriber.fileNumber}</p>
            {subscriber.expiryDate && (
              <p className="text-xs mt-1">
                الانتهاء الحالي: <span className="font-semibold">{new Date(subscriber.expiryDate).toISOString().split("T")[0].replace(/-/g,"/")}</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">عدد الأشهر</Label>
              <Select value={months} onValueChange={(v) => {
                setMonths(v);
                const base = (subscriber.subscriptionFee ?? 0) + (subscriber.insuranceFee ?? 0);
                setAmount(String(base * parseInt(v)));
              }}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 6, 12].map((m) => (
                    <SelectItem key={m} value={String(m)}>{m} شهر</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">المبلغ (دج)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-10" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">حالة الدفع</Label>
            <Select value={paymentStatus} onValueChange={setPaymentStatus}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="مدفوع">مدفوع</SelectItem>
                <SelectItem value="لم يدفع">لم يدفع</SelectItem>
                <SelectItem value="تأمين فقط">تأمين فقط</SelectItem>
                <SelectItem value="اشتراك 300">اشتراك 300</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">ملاحظة (اختياري)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظات إضافية..." className="h-10" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSubmit} disabled={saving || !amount}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 ml-1" />}
            تجديد الاشتراك
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

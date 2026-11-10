"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Loader2, Phone, MessageCircle, Calendar, Clock, Wallet, RefreshCw, Activity as ActivityIcon, AlertTriangle, FileSignature,
  Waves, ArrowRightLeft, Plus, CreditCard, ShieldCheck, Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { notifyClick } from "@/lib/sounds";
import type { SubscriberWithComputed } from "@/lib/rcs";
import { ContractTab } from "@/components/contract-tab";
import { ExternalLink } from "lucide-react";
import { formatDate, formatDateTime, formatTime } from "@/lib/date-utils";
import { usePools } from "@/hooks/use-pools";

interface RecordData {
  subscriber: {
    id: string;
    fileNumber: string;
    lastName: string;
    firstName: string;
    phone: string | null;
    paymentStatus: string;
    subscriptionType: string;
    timeSlot: string | null;
    swimmingDays: string | null;
    lastPaymentDate: string | null;
    pool?: { id: string; name: string; code: string; color?: string | null } | null;
    enrollments?: Array<{
      id: string;
      poolId: string;
      fileNumber: string;
      subscriptionType: string;
      paymentStatus: string;
      swimmingDays: string | null;
      timeSlot: string | null;
      status: string;
      pool: { id: string; name: string; code: string; color?: string | null };
      cards: Array<{ id: string; cardNumber: string; cardUid: string; status: string; issueDate: string }>;
    }>;
    transfers?: Array<{
      id: string;
      oldFileNumber: string;
      newFileNumber: string;
      createdAt: string;
      reason: string | null;
      sourcePool?: { id: string; name: string; code: string };
      targetPool?: { id: string; name: string; code: string };
    }>;
  };
  renewals: Array<{
    id: string;
    renewalDate: string;
    expiryDate: string;
    amount: number;
    paymentStatus: string;
    note: string | null;
  }>;
  poolEnrollmentRenewals?: Array<{
    id: string;
    renewedAt: string;
    newExpiryDate: string;
    amount: number;
    months: number;
    paymentMethod: string;
    subscriptionType: string;
    pool?: { id: string; name: string; code: string };
  }>;
  attendances: Array<{
    id: string;
    date: string;
    checkInTime: string;
    checkOutTime: string | null;
    method: string;
  }>;
  payments: Array<{
    id: string;
    category: string;
    amount: number;
    method: string;
    date: string;
    note: string | null;
  }>;
  activities: Array<{
    id: string;
    type: string;
    description: string;
    createdAt: string;
  }>;
  stats: {
    totalVisits: number;
    attendanceLast30: number;
    absent3Weeks: boolean;
    totalPayments: number;
    renewalCount: number;
  };
}

interface SubscriberRecordModalProps {
  subscriber: SubscriberWithComputed | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubscriberRecordModal({ subscriber, open, onOpenChange }: SubscriberRecordModalProps) {
  const { pools, isMultiPool } = usePools();
  const [data, setData] = useState<RecordData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [selectedPoolId, setSelectedPoolId] = useState("");
  const [selectedSubType, setSelectedSubType] = useState("RCS");
  const [transferReNumber, setTransferReNumber] = useState(true);
  const [transferReason, setTransferReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadRecord = () => {
    if (!subscriber) return;
    setLoading(true);
    fetch(`/api/subscribers/${subscriber.id}/record`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); })
      .catch(() => toast.error("تعذر تحميل السجل"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!subscriber || !open) {
      setData(null);
      return;
    }
    loadRecord();
  }, [subscriber, open]);

  const handleEnrollInPool = async () => {
    if (!subscriber || !selectedPoolId) {
      toast.error("يرجى اختيار المسبح المستهدف");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/subscribers/${subscriber.id}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poolId: selectedPoolId,
          subscriptionType: selectedSubType || subscriber.subscriptionType,
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "فشل تسجيل الانخراط");
      toast.success(`تم تسجيل الانخراط بنجاح! رقم الملف الجديد: ${resData.enrollment.fileNumber}`);
      setShowEnrollDialog(false);
      loadRecord();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل التسجيل");
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransferPool = async () => {
    if (!subscriber || !selectedPoolId) {
      toast.error("يرجى اختيار المسبح المراد النقل إليه");
      return;
    }
    setActionLoading(true);
    try {
      const sourcePoolId = data?.subscriber?.pool?.id || data?.subscriber?.enrollments?.[0]?.poolId || "";
      const res = await fetch(`/api/subscribers/${subscriber.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePoolId,
          targetPoolId: selectedPoolId,
          keepFileNumber: !transferReNumber,
          reason: transferReason || null,
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "فشل عملية النقل");
      toast.success(resData.message || "تم نقل المنخرط بنجاح");
      setShowTransferDialog(false);
      loadRecord();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل النقل");
    } finally {
      setActionLoading(false);
    }
  };

  const openWhatsApp = () => {
    if (!subscriber?.phone) return;
    notifyClick();
    let phone = subscriber.phone.replace(/\D/g, "");
    if (phone.startsWith("0")) phone = "213" + phone.slice(1);
    else if (!phone.startsWith("213")) phone = "213" + phone;
    const msg = `مرحباً ${subscriber.firstName} ${subscriber.lastName} (${subscriber.fileNumber})، نادي RCS للسباحة.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // 🆕 بوابة المنخرط — إنشاء ونسخ وفتح الرابط الموقّع (بطاقة رقمية)
  const openPortal = async () => {
    if (!subscriber) return;
    notifyClick();
    try {
      const res = await fetch("/api/member-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriberId: subscriber.id }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "تعذر إنشاء الرابط"); return; }
      const abs = `${window.location.origin}${data.url}`;
      try {
        await navigator.clipboard.writeText(abs);
        toast.success("تم نسخ رابط البوابة — شاركه مع المنخرط عبر واتساب");
      } catch {
        toast.info(abs);
      }
      window.open(abs, "_blank");
    } catch {
      toast.error("خطأ في الاتصال");
    }
  };

  if (!subscriber) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-x-3 gap-y-2 pl-8 sm:pl-0">
            <div className="h-10 w-10 rounded-xl overflow-hidden shrink-0 relative bg-muted">
              {subscriber.photoPath && (
                <img
                  src={`/api/subscribers/${subscriber.id}/photo?size=thumbnail&raw=1`}
                  alt={`${subscriber.lastName} ${subscriber.firstName}`}
                  className="absolute inset-0 h-full w-full object-cover rounded-xl"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <div className={cn(
                "absolute inset-0 flex items-center justify-center rounded-lg text-sm font-bold",
                subscriber.gender === "ذكر" ? "bg-sky-500/15 text-sky-700" : "bg-pink-500/15 text-pink-700"
              )}>
                {subscriber.lastName[0]}{subscriber.firstName[0]}
              </div>
            </div>
            <div className="flex-1 min-w-[120px]">
              <p className="text-base font-bold break-words">{subscriber.lastName} {subscriber.firstName}</p>
              <p className="text-xs text-muted-foreground font-mono">{subscriber.fileNumber} • {subscriber.age} سنة</p>
            </div>
            <div className="flex gap-1.5 w-full sm:w-auto">
              {subscriber.phone && (
                <button
                  onClick={openWhatsApp}
                  className="flex flex-1 sm:flex-none items-center justify-center gap-1 px-3 py-2 sm:py-1.5 rounded-lg bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 transition text-xs font-semibold"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </button>
              )}
              <button
                onClick={openPortal}
                className="flex flex-1 sm:flex-none items-center justify-center gap-1 px-3 py-2 sm:py-1.5 rounded-lg bg-teal-500/15 text-teal-700 hover:bg-teal-500/25 transition text-xs font-semibold"
                title="نسخ وفتح رابط بوابة المنخرط (بطاقة رقمية + سجل حضور)"
              >
                <ExternalLink className="h-3.5 w-3.5" /> البوابة
              </button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatBox icon={Calendar} label="إجمالي الزيارات" value={data.stats.totalVisits} color="text-teal-600 bg-teal-500/10" />
              <StatBox icon={Clock} label="آخر 30 يوم" value={data.stats.attendanceLast30} color="text-sky-600 bg-sky-500/10" />
              <StatBox icon={RefreshCw} label="عدد التجديدات" value={data.stats.renewalCount} color="text-amber-600 bg-amber-500/10" />
              <StatBox icon={Wallet} label="إجمالي المدفوعات" value={`${data.stats.totalPayments.toLocaleString("en-US")} دج`} color="text-emerald-600 bg-emerald-500/10" />
            </div>

            {/* Absence alert */}
            {data.stats.absent3Weeks && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-300"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="text-sm font-semibold">تنبيه: غياب 3 أسابيع متتالية — ينبغي التواصل مع المنخرط</span>
              </motion.div>
            )}

            {/* Tabs */}
            <Tabs defaultValue={isMultiPool ? "pools" : "payments"}>
              <TabsList className="w-full flex-wrap h-auto gap-1">
                <TabsTrigger value="pools" className="flex-1 min-w-[88px] text-xs px-2"><Waves className="h-3.5 w-3.5 ml-1 hidden sm:inline" /> المسابح ({data.subscriber.enrollments?.length || 1})</TabsTrigger>
                <TabsTrigger value="payments" className="flex-1 min-w-[88px] text-xs px-2"><Wallet className="h-3.5 w-3.5 ml-1 hidden sm:inline" /> المدفوعات</TabsTrigger>
                <TabsTrigger value="renewals" className="flex-1 min-w-[88px] text-xs px-2"><RefreshCw className="h-3.5 w-3.5 ml-1 hidden sm:inline" /> التجديدات</TabsTrigger>
                <TabsTrigger value="attendance" className="flex-1 min-w-[88px] text-xs px-2"><Calendar className="h-3.5 w-3.5 ml-1 hidden sm:inline" /> الحضور</TabsTrigger>
                <TabsTrigger value="activity" className="flex-1 min-w-[88px] text-xs px-2"><ActivityIcon className="h-3.5 w-3.5 ml-1 hidden sm:inline" /> النشاط</TabsTrigger>
                <TabsTrigger value="contract" className="flex-1 min-w-[88px] text-xs px-2"><FileSignature className="h-3.5 w-3.5 ml-1 hidden sm:inline" /> العقد</TabsTrigger>
              </TabsList>

              <TabsContent value="pools" className="mt-3 max-h-80 overflow-y-auto space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border/50">
                  <span className="text-xs font-bold text-muted-foreground">
                    اشتراكات المنخرط التشغيلية عبر المسابح
                  </span>
                  {isMultiPool && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => { setSelectedPoolId(""); setShowEnrollDialog(true); }}
                        className="px-2.5 py-1 text-xs rounded-lg bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 flex items-center gap-1 font-semibold transition cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" /> تسجيل بمسبح إضافي
                      </button>
                      <button
                        onClick={() => { setSelectedPoolId(""); setShowTransferDialog(true); }}
                        className="px-2.5 py-1 text-xs rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 flex items-center gap-1 font-semibold transition cursor-pointer"
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" /> نقل لمسبح آخر
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {(data.subscriber.enrollments && data.subscriber.enrollments.length > 0
                    ? data.subscriber.enrollments
                    : [{
                        id: "default",
                        poolId: data.subscriber.pool?.id || "default",
                        fileNumber: data.subscriber.fileNumber,
                        subscriptionType: data.subscriber.subscriptionType,
                        paymentStatus: data.subscriber.paymentStatus,
                        swimmingDays: data.subscriber.swimmingDays,
                        timeSlot: data.subscriber.timeSlot,
                        status: "active",
                        pool: data.subscriber.pool || { id: "default", name: "المسبح الرئيسي", code: "MAIN", color: "#0284c7" },
                        cards: [],
                      }]
                  ).map((en) => {
                    const pColor = en.pool?.color || "#0284c7";
                    const activeCard = en.cards?.find((c) => c.status === "active");
                    return (
                      <div key={en.id} className="p-3 rounded-xl border border-border/60 bg-muted/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: pColor }} />
                            <span className="font-bold text-sm">{en.pool?.name || "المسبح"}</span>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30">
                              رقم الملف: {en.fileNumber}
                            </span>
                          </div>
                          <Badge variant={en.status === "active" ? "default" : "secondary"} className="text-[10px]">
                            {en.status === "active" ? "انخراط نشط" : "مؤرشف"}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1 text-muted-foreground">
                          <div>
                            <span className="block text-[10px] text-muted-foreground/70">النوع:</span>
                            <span className="font-semibold text-foreground">{en.subscriptionType}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-muted-foreground/70">الدفع:</span>
                            <span className="font-semibold text-foreground">{en.paymentStatus}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-muted-foreground/70">الأيام:</span>
                            <span className="font-semibold text-foreground">{en.swimmingDays || "—"}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-muted-foreground/70">الفوج:</span>
                            <span className="font-semibold text-foreground">{en.timeSlot || "—"}</span>
                          </div>
                        </div>

                        {activeCard && (
                          <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground border-t border-border/40 font-mono">
                            <CreditCard className="h-3 w-3 text-sky-400" />
                            <span>بطاقة {activeCard.cardNumber}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted">UID: {activeCard.cardUid.slice(0, 16)}…</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* سجل النقل والتحويلات إن وُجد */}
                {data.subscriber.transfers && data.subscriber.transfers.length > 0 && (
                  <div className="pt-2 border-t border-border/40 space-y-1.5">
                    <span className="text-[11px] font-bold text-muted-foreground block">
                      سجل التحويلات بين المسابح:
                    </span>
                    {data.subscriber.transfers.map((t) => (
                      <div key={t.id} className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between">
                        <span>نقل من {t.sourcePool?.name || "مسبح"} إلى {t.targetPool?.name || "مسبح"} ({t.oldFileNumber} → {t.newFileNumber})</span>
                        <span className="text-[10px] text-muted-foreground">{formatDate(t.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="payments" className="mt-3 max-h-72 overflow-y-auto">
                {data.payments.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-6">لا توجد مدفوعات</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.payments.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 text-sm">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600">
                          <Wallet className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold font-mono-data">{p.category} — {p.amount.toLocaleString("en-US")} دج</p>
                          <p className="text-xs text-muted-foreground font-mono-data">
                            {formatDate(p.date)} • {p.method}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="renewals" className="mt-3 max-h-72 overflow-y-auto">
                {data.poolEnrollmentRenewals && data.poolEnrollmentRenewals.length > 0 ? (
                  <div className="space-y-1.5">
                    {data.poolEnrollmentRenewals.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 text-sm">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/15 text-amber-600">
                          <RefreshCw className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold font-mono-data">{r.amount.toLocaleString("en-US")} دج ({r.months} شهر)</p>
                            {r.pool && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 font-bold border border-sky-500/20">
                                {r.pool.name}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono-data">
                            بتاريخ: {formatDate(r.renewedAt)} • ينتهي: {formatDate(r.newExpiryDate)} • {r.paymentMethod}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : data.renewals.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-6">لا توجد تجديدات</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.renewals.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 text-sm">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/15 text-amber-600">
                          <RefreshCw className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold font-mono-data">{r.amount.toLocaleString("en-US")} دج — {r.paymentStatus}</p>
                          <p className="text-xs text-muted-foreground font-mono-data">
                            تجديد: {formatDate(r.renewalDate)} → ينتهي: {formatDate(r.expiryDate)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="attendance" className="mt-3 max-h-72 overflow-y-auto">
                {data.attendances.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-6">لا يوجد حضور مسجل</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.attendances.slice(0, 30).map((a) => (
                      <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 text-sm">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-500/15 text-violet-600">
                          <Calendar className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0 font-mono-data">
                          <p className="font-semibold">{formatDate(a.date)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatTime(a.checkInTime)}
                            {a.checkOutTime && ` → ${formatTime(a.checkOutTime)}`}
                            {" • "}{a.method === "qr" ? "QR" : "يدوي"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="activity" className="mt-3 max-h-72 overflow-y-auto">
                {data.activities.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-6">لا توجد أنشطة</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.activities.map((a) => (
                      <div key={a.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/40 text-sm">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-500/15 text-sky-600 shrink-0">
                          <ActivityIcon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs">{a.description}</p>
                          <p className="text-[10px] text-muted-foreground font-mono-data">{formatDateTime(a.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="contract" className="mt-3 max-h-72 overflow-y-auto">
                {subscriber && (
                  <ContractTab
                    subscriberId={subscriber.id}
                    subscriberName={`${subscriber.firstName} ${subscriber.lastName}`}
                  />
                )}
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground py-6">تعذر تحميل السجل</p>
        )}
      </DialogContent>
    </Dialog>

    {/* نافذة تسجيل انخراط إضافي بمسبح آخر */}
    <Dialog open={showEnrollDialog} onOpenChange={setShowEnrollDialog}>
      <DialogContent className="sm:max-w-md p-6 bg-slate-900 border border-slate-800 text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Waves className="h-5 w-5 text-sky-400" />
            تسجيل المنخرط في مسبح إضافي
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground">
            سيتم إنشاء انخراط تشغيلي مستقل للمنخرط <strong>{subscriber?.firstName} {subscriber?.lastName}</strong> مع توليد رقم ملف وبطاقة عضوية جديدة خاصة بهذا المسبح.
          </p>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">اختر المسبح المستهدف *</label>
            <select
              value={selectedPoolId}
              onChange={(e) => setSelectedPoolId(e.target.value)}
              className="w-full h-9 rounded-lg bg-slate-800 border border-slate-700 px-3 text-xs text-white"
            >
              <option value="">-- اختر المسبح --</option>
              {pools.filter((p) => p.active).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.fileNumberPrefix ? `(بادئة: ${p.fileNumberPrefix}-)` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">نوع الاشتراك في هذا المسبح</label>
            <input
              value={selectedSubType}
              onChange={(e) => setSelectedSubType(e.target.value)}
              placeholder="RCS"
              className="w-full h-9 rounded-lg bg-slate-800 border border-slate-700 px-3 text-xs text-white uppercase font-mono"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => setShowEnrollDialog(false)}
            className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={actionLoading || !selectedPoolId}
            onClick={handleEnrollInPool}
            className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            تأكيد التسجيل
          </button>
        </div>
      </DialogContent>
    </Dialog>

    {/* نافذة نقل المنخرط إلى مسبح آخر */}
    <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
      <DialogContent className="sm:max-w-md p-6 bg-slate-900 border border-slate-800 text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-amber-400" />
            نقل المنخرط إلى مسبح آخر
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground">
            سيتم نقل المنخرط <strong>{subscriber?.firstName} {subscriber?.lastName}</strong> مع توثيق الحركة في سجل التحويلات.
          </p>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">المسبح الجديد المستهدف *</label>
            <select
              value={selectedPoolId}
              onChange={(e) => setSelectedPoolId(e.target.value)}
              className="w-full h-9 rounded-lg bg-slate-800 border border-slate-700 px-3 text-xs text-white"
            >
              <option value="">-- اختر المسبح الجديد --</option>
              {pools.filter((p) => p.active && p.id !== (subscriber as any)?.poolId).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.fileNumberPrefix ? `(بادئة: ${p.fileNumberPrefix}-)` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="transferReNumber"
              checked={transferReNumber}
              onChange={(e) => setTransferReNumber(e.target.checked)}
              className="rounded border-slate-700 bg-slate-800 text-sky-500"
            />
            <label htmlFor="transferReNumber" className="text-xs font-semibold cursor-pointer">
              توليد رقم ملف جديد مطابق لبادئة المسبح الجديد (موصى به)
            </label>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">سبب النقل (اختياري)</label>
            <input
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              placeholder="مثال: طلب تغيير القاعة أو الانتقال السكني"
              className="w-full h-9 rounded-lg bg-slate-800 border border-slate-700 px-3 text-xs text-white"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => setShowTransferDialog(false)}
            className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={actionLoading || !selectedPoolId}
            onClick={handleTransferPool}
            className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            تأكيد عملية النقل
          </button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

function StatBox({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 p-2.5 text-center">
      <div className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md mb-1", color)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <p className="text-base font-extrabold tabular-nums leading-none">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

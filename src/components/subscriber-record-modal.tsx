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
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { notifyClick } from "@/lib/sounds";
import type { SubscriberWithComputed } from "@/lib/rcs";
import { ContractTab } from "@/components/contract-tab";

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
  };
  renewals: Array<{
    id: string;
    renewalDate: string;
    expiryDate: string;
    amount: number;
    paymentStatus: string;
    note: string | null;
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
  const [data, setData] = useState<RecordData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!subscriber || !open) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/subscribers/${subscriber.id}/record`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); })
      .catch(() => toast.error("تعذر تحميل السجل"))
      .finally(() => setLoading(false));
  }, [subscriber, open]);

  const openWhatsApp = () => {
    if (!subscriber?.phone) return;
    notifyClick();
    let phone = subscriber.phone.replace(/\D/g, "");
    if (phone.startsWith("0")) phone = "213" + phone.slice(1);
    else if (!phone.startsWith("213")) phone = "213" + phone;
    const msg = `مرحباً ${subscriber.firstName} ${subscriber.lastName} (${subscriber.fileNumber})، نادي RCS للسباحة.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  if (!subscriber) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
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
            <div className="flex-1">
              <p className="text-base font-bold">{subscriber.lastName} {subscriber.firstName}</p>
              <p className="text-xs text-muted-foreground font-mono">{subscriber.fileNumber} • {subscriber.age} سنة</p>
            </div>
            {subscriber.phone && (
              <button
                onClick={openWhatsApp}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 transition text-xs font-semibold"
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </button>
            )}
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
            <Tabs defaultValue="payments">
              <TabsList className="w-full">
                <TabsTrigger value="payments" className="flex-1"><Wallet className="h-3.5 w-3.5 ml-1" /> المدفوعات</TabsTrigger>
                <TabsTrigger value="renewals" className="flex-1"><RefreshCw className="h-3.5 w-3.5 ml-1" /> التجديدات</TabsTrigger>
                <TabsTrigger value="attendance" className="flex-1"><Calendar className="h-3.5 w-3.5 ml-1" /> الحضور</TabsTrigger>
                <TabsTrigger value="activity" className="flex-1"><ActivityIcon className="h-3.5 w-3.5 ml-1" /> النشاط</TabsTrigger>
                <TabsTrigger value="contract" className="flex-1"><FileSignature className="h-3.5 w-3.5 ml-1" /> العقد</TabsTrigger>
              </TabsList>

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
                          <p className="font-semibold">{p.category} — {p.amount.toLocaleString("en-US")} دج</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(p.date).toLocaleDateString("ar-DZ")} • {p.method}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="renewals" className="mt-3 max-h-72 overflow-y-auto">
                {data.renewals.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-6">لا توجد تجديدات</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.renewals.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 text-sm">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/15 text-amber-600">
                          <RefreshCw className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold">{r.amount.toLocaleString("en-US")} دج — {r.paymentStatus}</p>
                          <p className="text-xs text-muted-foreground">
                            تجديد: {new Date(r.renewalDate).toLocaleDateString("ar-DZ")} → ينتهي: {new Date(r.expiryDate).toLocaleDateString("ar-DZ")}
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
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold">{new Date(a.date).toLocaleDateString("ar-DZ")}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(a.checkInTime).toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" })}
                            {a.checkOutTime && ` → ${new Date(a.checkOutTime).toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" })}`}
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
                          <p className="text-[10px] text-muted-foreground">{new Date(a.createdAt).toLocaleString("ar-DZ")}</p>
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

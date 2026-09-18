"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, Building2, ShieldCheck, Users, Plus, Trash2, Loader2,
  CheckCircle2, Receipt, Calendar, TrendingDown, TrendingUp,
  Banknote, Coins, FileText, Download, Search, Printer, FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ResponsiveGrid } from "@/components/responsive-grid";
import { toast } from "sonner";
import type { SubscriberWithComputed } from "@/lib/rcs";

interface Payment {
  id: string;
  category: string;
  amount: number;
  method: string;
  receiptNumber: string | null;
  date: string;
  note: string | null;
  status: string;
  subscriber: { id: string; fileNumber: string; lastName: string; firstName: string } | null;
  user: { id: string; name: string; role: string } | null;
}

interface Worker {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  pending: boolean;
}

interface ChargesPanelProps {
  subscribers: SubscriberWithComputed[];
}

const CATEGORY_INFO: Record<string, { label: string; icon: typeof Wallet; color: string; bgColor: string }> = {
  compound: { label: "حقوق المركب", icon: Building2, color: "text-sky-700", bgColor: "bg-sky-500/15" },
  insurance: { label: "حقوق التأمين", icon: ShieldCheck, color: "text-emerald-700", bgColor: "bg-emerald-500/15" },
  salary: { label: "مستحقات العمال", icon: Users, color: "text-amber-700", bgColor: "bg-amber-500/15" },
  subscription: { label: "رسوم الاشتراك", icon: Receipt, color: "text-teal-700", bgColor: "bg-teal-500/15" },
  other: { label: "أخرى", icon: Wallet, color: "text-violet-700", bgColor: "bg-violet-500/15" },
};

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير",
  assistant: "مساعد إداري",
  lifeguard: "حارس سباحة",
  observer: "مراقب",
};

const ROLE_ICONS: Record<string, string> = {
  admin: "👑",
  assistant: "💼",
  lifeguard: "🏊",
  observer: "👁️",
};

export function ChargesPanel({ subscribers: initialSubs }: ChargesPanelProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"compound" | "insurance" | "salary" | "history" | "compoundRights">("compound");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState<string>("compound");
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("");
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [workHours, setWorkHours] = useState<any[]>([]);
  const [workHourRate, setWorkHourRate] = useState(200);

  // Local subscribers for insurance selection
  const [subs] = useState<SubscriberWithComputed[]>(initialSubs);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [payRes, usersRes, whRes, settingsRes] = await Promise.all([
        fetch("/api/payments", { cache: "no-store" }),
        fetch("/api/users", { cache: "no-store" }),
        fetch("/api/workhours", { cache: "no-store" }),
        fetch("/api/settings", { cache: "no-store" }),
      ]);
      const payData = await payRes.json();
      const usersData = await usersRes.json();
      const whData = await whRes.json();
      const settingsData = await settingsRes.json();
      setPayments(payData.payments || []);
      setWorkers((usersData.users || []).filter((u: Worker) => u.role !== "admin" && !u.pending));
      setWorkHours(whData.workHours || []);
      setWorkHourRate(parseInt(settingsData.settings?.workHourRate || "200") || 200);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute totals
  const totals = {
    compound: payments.filter((p) => p.category === "compound").reduce((s, p) => s + p.amount, 0),
    insurance: payments.filter((p) => p.category === "insurance").reduce((s, p) => s + p.amount, 0),
    salary: payments.filter((p) => p.category === "salary").reduce((s, p) => s + p.amount, 0),
    total: payments.reduce((s, p) => s + p.amount, 0),
  };

  // Worker totals
  const getWorkerTotal = (workerId: string) => {
    return payments.filter((p) => p.category === "salary" && p.userId === workerId).reduce((s, p) => s + p.amount, 0);
  };

  // Worker work hours + dues
  const getWorkerHours = (workerId: string) => {
    const approved = workHours.filter((w) => w.userId === workerId && w.status === "approved");
    const totalHours = approved.reduce((sum, w) => {
      const s = new Date(w.startTime).getTime();
      const e = new Date(w.endTime).getTime();
      return sum + Math.round((e - s) / 3600000 * 10) / 10;
    }, 0);
    const dues = totalHours * workHourRate;
    const paid = getWorkerTotal(workerId);
    return { totalHours, dues, paid, balance: dues - paid };
  };

  const handleOpenModal = (category: string, workerId?: string) => {
    setModalCategory(category);
    setSelectedWorkerId(workerId || "");
    setSelectedSubIds([]);
    setAmount(category === "compound" ? "1000" : category === "insurance" ? "500" : "");
    setNote("");
    setModalOpen(true);
  };

  const handleToggleSub = (id: string) => {
    setSelectedSubIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const handleSavePayment = async () => {
    if (!amount || parseInt(amount) <= 0) {
      toast.error("أدخل مبلغاً صحيحاً");
      return;
    }
    setSaving(true);
    try {
      if (modalCategory === "insurance" && selectedSubIds.length > 0) {
        let success = 0;
        for (const subId of selectedSubIds) {
          const res = await fetch("/api/payments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category: "insurance", amount, method: "cash", subscriberId: subId, note: note || "تأمين" }),
          });
          if (res.ok) success++;
        }
        toast.success(`تم تسديد تأمين ${success} منخرط`);
      } else if (modalCategory === "salary" && selectedWorkerId) {
        const res = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: "salary", amount, method: "cash", userId: selectedWorkerId, note: note || "مستحقات" }),
        });
        if (!res.ok) throw new Error();
        toast.success("تم تسديد المستحقات");
      } else {
        const res = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: modalCategory, amount, method: "cash", note: note || null }),
        });
        if (!res.ok) throw new Error();
        toast.success("تم تسجيل التسديد");
      }
      setModalOpen(false);
      fetchData();
    } catch {
      toast.error("فشل التسجيل");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/payments?id=${id}`, { method: "DELETE" });
      toast.success("تم الحذف");
      fetchData();
    } catch {
      toast.error("فشل الحذف");
    }
  };

  const handleExport = async (category: string) => {
    setExporting(true);
    try {
      const res = await fetch(`/api/export?format=word&type=${category}&sigs=president,branch`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `RCS_${category}_${new Date().toISOString().split("T")[0]}.doc`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تصدير الملف");
    } catch {
      toast.error("فشل التصدير");
    } finally {
      setExporting(false);
    }
  };

  const filteredSubs = subs.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.lastName.toLowerCase().includes(q) || s.firstName.toLowerCase().includes(q) || s.fileNumber.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/30">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-amber-800 dark:text-amber-200">الأعباء والتسديدات</h2>
            <p className="text-xs text-muted-foreground">إدارة المصاريف والمدفوعات — حقوق المركب، التأمين، مستحقات العمال</p>
          </div>
        </div>
      </div>

      {/* Summary cards — auto-fit (1 col mobile, 2 tablet, 4 desktop) */}
      <ResponsiveGrid minCardWidth={140} gap={12}>
        <SummaryCard
          icon={Building2}
          label="حقوق المركب"
          amount={totals.compound}
          color="bg-sky-600"
          active={activeSection === "compound"}
          onClick={() => setActiveSection("compound")}
        />
        <SummaryCard
          icon={ShieldCheck}
          label="حقوق التأمين"
          amount={totals.insurance}
          color="bg-emerald-600"
          active={activeSection === "insurance"}
          onClick={() => setActiveSection("insurance")}
        />
        <SummaryCard
          icon={Users}
          label="مستحقات العمال"
          amount={totals.salary}
          color="bg-amber-600"
          active={activeSection === "salary"}
          onClick={() => setActiveSection("salary")}
        />
        <SummaryCard
          icon={Building2}
          label="حقوق المركب"
          amount={subs.filter(s => (s.totalAmount ?? 0) >= 1300 && s.renewalStatus === "✅ ساري").length * 1000}
          color="bg-teal-600"
          active={activeSection === "compoundRights"}
          onClick={() => setActiveSection("compoundRights")}
        />
        <SummaryCard
          icon={Receipt}
          label="إجمالي التسديدات"
          amount={totals.total}
          color="bg-violet-600"
          active={activeSection === "history"}
          onClick={() => setActiveSection("history")}
        />
      </ResponsiveGrid>

      {/* === Section: حقوق المركب === */}
      {activeSection === "compound" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Building2 className="h-5 w-5 text-sky-600" /> دفع حقوق المركب
              </h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleExport("compound")} disabled={exporting}>
                  <Download className="h-3.5 w-3.5 ml-1" /> تصدير Word
                </Button>
                <Button size="sm" onClick={() => handleOpenModal("compound")}>
                  <Plus className="h-4 w-4 ml-1" /> تسديد جديد
                </Button>
              </div>
            </div>
            <div className="rounded-xl bg-sky-500/5 border border-sky-500/20 p-3 text-sm text-sky-800 dark:text-sky-200 mb-4">
              💡 كل منخرط مجموعه ≥1300 دج يدفع <strong>1000 دج</strong> كحقوق للمركب. يتم تسجيل كل دفعة على حدة.
            </div>
            <PaymentList
              payments={payments.filter((p) => p.category === "compound")}
              onDelete={handleDelete}
              emptyMessage="لا توجد تسديدات لحقوق المركب بعد"
            />
          </div>
        </motion.div>
      )}

      {/* === Section: حقوق التأمين === */}
      {activeSection === "insurance" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="font-bold text-base flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" /> دفع حقوق التأمين
              </h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleExport("insurance")} disabled={exporting}>
                  <Download className="h-3.5 w-3.5 ml-1" /> تصدير Word
                </Button>
                <Button size="sm" onClick={() => handleOpenModal("insurance")}>
                  <Plus className="h-4 w-4 ml-1" /> تأمين منخرطين
                </Button>
              </div>
            </div>
            <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3 text-sm text-emerald-800 dark:text-emerald-200 mb-4">
              💡 اختر المنخرطين لتأمينهم (500 دج لكل منخرط). يمكن تحديد عدة منخرطين دفعة واحدة.
            </div>

            {/* Quick search */}
            <div className="relative mb-3">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="بحث بالاسم أو رقم الملف..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10 h-10" />
            </div>

            {/* Subscribers grid for selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto mb-4 pr-1 -mr-1">
              {filteredSubs.slice(0, 30).map((s) => {
                const isSelected = selectedSubIds.includes(s.id);
                const isInsured = payments.some((p) => p.category === "insurance" && p.subscriberId === s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => !isInsured && handleToggleSub(s.id)}
                    disabled={isInsured}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg border text-sm transition text-right",
                      isInsured
                        ? "bg-emerald-50 border-emerald-200 opacity-70 cursor-not-allowed"
                        : isSelected
                        ? "bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30"
                        : "border-border hover:bg-accent"
                    )}
                  >
                    <div className={cn(
                      "h-4 w-4 rounded border-2 flex items-center justify-center shrink-0",
                      isInsured ? "bg-emerald-500 border-emerald-500 text-white"
                      : isSelected ? "bg-emerald-500 border-emerald-500 text-white"
                      : "border-border"
                    )}>
                      {(isInsured || isSelected) && <CheckCircle2 className="h-3 w-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{s.lastName} {s.firstName}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{s.fileNumber}</p>
                    </div>
                    {isInsured && <Badge className="text-[9px] h-4 px-1 bg-emerald-500/15 text-emerald-700">مؤمن</Badge>}
                  </button>
                );
              })}
            </div>

            {selectedSubIds.length > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 p-3 mb-3">
                <span className="text-sm font-semibold text-emerald-700">
                  {selectedSubIds.length} منخرط محدد — المبلغ: {(parseInt(amount || "0") * selectedSubIds.length).toLocaleString("en-US")} دج
                </span>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSavePayment} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4 ml-1" />}
                  تأمين المحدد ({selectedSubIds.length})
                </Button>
              </div>
            )}

            <PaymentList
              payments={payments.filter((p) => p.category === "insurance")}
              onDelete={handleDelete}
              emptyMessage="لا توجد تسديدات للتأمين بعد"
            />
          </div>
        </motion.div>
      )}

      {/* === Section: مستحقات العمال === */}
      {activeSection === "salary" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Users className="h-5 w-5 text-amber-600" /> مستحقات العمال
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              قائمة العاملين في النادي. اضغط على "تسديد مستحقات" لكل عامل لتسجيل دفعته.
            </p>

            {workers.length === 0 ? (
              <div className="text-center py-8 rounded-xl bg-muted/30">
                <Users className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">لا يوجد عمال. أضف مستخدمين من تبويب "المستخدمون".</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {workers.map((w, i) => {
                  const wh = getWorkerHours(w.id);
                  const totalPaid = wh.paid;
                  const workerPayments = payments.filter((p) => p.category === "salary" && p.userId === w.id);
                  return (
                    <motion.div
                      key={w.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="rounded-xl border border-border/60 p-3 hover:shadow-md transition"
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <Avatar className="h-10 w-10 rounded-lg shrink-0">
                          <AvatarFallback className="rounded-md text-xs font-bold bg-amber-500/15 text-amber-700">
                            {w.name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{w.name}</p>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[10px] h-4 px-1 bg-amber-500/10 text-amber-700 border-amber-500/30">
                              {ROLE_ICONS[w.role] || "👤"} {ROLE_LABELS[w.role] || w.role}
                            </Badge>
                          </div>
                          {w.phone && <p className="text-xs text-muted-foreground mt-0.5" dir="ltr">{w.phone}</p>}
                        </div>
                      </div>

                      {/* Work hours + dues */}
                      <div className="rounded-lg bg-muted/40 p-2 space-y-1 mb-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">ساعات العمل:</span>
                          <span className="font-bold tabular-nums text-teal-700 dark:text-teal-300">{wh.totalHours} سا</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">المستحق ({workHourRate} دج/سا):</span>
                          <span className="font-bold tabular-nums text-blue-700 dark:text-blue-300">{wh.dues.toLocaleString("en-US")} دج</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">المسدد:</span>
                          <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{wh.paid.toLocaleString("en-US")} دج</span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-1 border-t">
                          <span className="font-semibold text-muted-foreground">المتبقي:</span>
                          <span className={`font-bold tabular-nums ${wh.balance > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                            {wh.balance.toLocaleString("en-US")} دج
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-muted-foreground">عدد الدفعات:</span>
                        <span className="font-bold tabular-nums">{workerPayments.length}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-8 text-xs"
                        onClick={() => handleOpenModal("salary", w.id)}
                      >
                        <Plus className="h-3.5 w-3.5 ml-1" /> تسديد مستحقات
                      </Button>

                      {/* Recent payments for this worker */}
                      {workerPayments.length > 0 && (
                        <div className="mt-2 pt-2 border-t space-y-1 max-h-32 overflow-y-auto">
                          {workerPayments.slice(0, 5).map((p) => (
                            <div key={p.id} className="flex items-center justify-between text-[10px] group">
                              <span className="text-muted-foreground">{new Date(p.date).toISOString().split("T")[0].replace(/-/g, "/")}</span>
                              <span className="font-semibold">{p.amount.toLocaleString("en-US")} دج</span>
                              <button onClick={() => handleDelete(p.id)} className="opacity-0 group-hover:opacity-100 text-rose-500">
                                <Trash2 className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* === Section: حقوق المركب (قائمة المنخرطين المؤهلين) === */}
      {activeSection === "compoundRights" && (
        <CompoundRightsSection subscribers={subs} />
      )}

      {/* === Section: سجل التسديدات === */}
      {activeSection === "history" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" /> سجل التسديدات الكامل
              </h3>
              <Badge variant="secondary">{payments.length} تسديد</Badge>
            </div>
            <PaymentList
              payments={payments}
              onDelete={handleDelete}
              emptyMessage="لا توجد تسديدات بعد"
            />
          </div>
        </motion.div>
      )}

      {/* === Payment Modal === */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {(() => {
                const info = CATEGORY_INFO[modalCategory];
                const Icon = info?.icon || Wallet;
                return <><Icon className="h-5 w-5 text-primary" /> {info?.label || "تسديد"}</>;
              })()}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Worker name for salary */}
            {modalCategory === "salary" && selectedWorkerId && (
              <div className="rounded-xl bg-muted/40 p-3">
                {(() => {
                  const w = workers.find((x) => x.id === selectedWorkerId);
                  return w ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-9 w-9 rounded-lg">
                        <AvatarFallback className="rounded-md text-xs font-bold bg-amber-500/15 text-amber-700">{w.name[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-sm">{w.name}</p>
                        <p className="text-xs text-muted-foreground">{ROLE_ICONS[w.role]} {ROLE_LABELS[w.role]}</p>
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            {/* Subscriber count for insurance */}
            {modalCategory === "insurance" && selectedSubIds.length > 0 && (
              <div className="rounded-xl bg-emerald-500/10 p-3 text-sm">
                <p className="font-semibold text-emerald-700">سيتم تأمين {selectedSubIds.length} منخرط</p>
                <p className="text-xs text-muted-foreground mt-1">المبلغ الإجمالي: {(parseInt(amount || "0") * selectedSubIds.length).toLocaleString("en-US")} دج</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">
                {modalCategory === "insurance" ? "مبلغ التأمين لكل منخرط (دج)" : "المبلغ (دج)"}
              </Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-10"
                placeholder={modalCategory === "insurance" ? "500" : modalCategory === "compound" ? "1000" : "0"}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">ملاحظة (اختياري)</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="ملاحظات إضافية..."
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>إلغاء</Button>
            <Button onClick={handleSavePayment} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 ml-1" />}
              تسجيل التسديد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ──────────────── Helper Components ────────────────

function SummaryCard({ icon: Icon, label, amount, color, onClick, active }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  amount: number;
  color: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-2xl border-2 p-4 flex items-center gap-3 transition text-right text-white",
        color,
        active ? "ring-2 ring-offset-2 ring-offset-background ring-white border-white" : "border-transparent hover:scale-[1.02] opacity-90 hover:opacity-100"
      )}
    >
      <Icon className="h-6 w-6 shrink-0" />
      <div>
        <p className="text-lg font-extrabold tabular-nums leading-none">{amount.toLocaleString("en-US")}</p>
        <p className="text-[10px] opacity-80 mt-0.5">دج</p>
        <p className="text-xs mt-1">{label}</p>
      </div>
    </button>
  );
}

function PaymentList({ payments, onDelete, emptyMessage }: {
  payments: Payment[];
  onDelete: (id: string) => void;
  emptyMessage: string;
}) {
  if (payments.length === 0) {
    return (
      <div className="text-center py-8 rounded-xl bg-muted/30">
        <Receipt className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }
  return (
    <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1 -mr-1">
      <AnimatePresence initial={false}>
        {payments.map((p, i) => {
          const info = CATEGORY_INFO[p.category];
          const Icon = info?.icon || Wallet;
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition text-sm group"
            >
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", info?.bgColor)}>
                <Icon className={cn("h-4 w-4", info?.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">
                  {p.subscriber ? `${p.subscriber.lastName} ${p.subscriber.firstName}` : p.user?.name || info?.label}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{new Date(p.date).toISOString().split("T")[0].replace(/-/g, "/")}</span>
                  {p.note && <><span>•</span><span className="truncate">{p.note}</span></>}
                </div>
              </div>
              <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 shrink-0">
                {p.amount.toLocaleString("en-US")} دج
              </Badge>
              <button
                onClick={() => onDelete(p.id)}
                className="opacity-0 group-hover:opacity-100 transition p-1 text-muted-foreground hover:text-rose-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ════════════ Compound Rights Section ════════════
// Shows subscribers who qualify for compound access:
//   1. Total amount >= 1300 DZD
//   2. Subscription is currently active (not expired/frozen)
function CompoundRightsSection({ subscribers }: { subscribers: SubscriberWithComputed[] }) {
  const [period, setPeriod] = useState<"current" | "previous" | "all">("current");
  const [search, setSearch] = useState("");

  const formatDate = (d: string | Date | null) => {
    if (!d) return "—";
    const date = new Date(d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${y}/${m}/${day}`;
  };

  // Filter: total >= 1300 AND subscription active
  const qualified = subscribers.filter((s) => {
    const total = s.totalAmount ?? 0;
    const isActive = s.renewalStatus === "✅ ساري";
    if (total < 1300) return false;
    if (!isActive) return false;

    // Period filter
    if (period === "current") {
      const now = new Date();
      if (s.lastPaymentDate) {
        const payDate = new Date(s.lastPaymentDate);
        return payDate.getMonth() === now.getMonth() && payDate.getFullYear() === now.getFullYear();
      }
      return false;
    }
    if (period === "previous") {
      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      if (s.lastPaymentDate) {
        const payDate = new Date(s.lastPaymentDate);
        return payDate.getMonth() === prev.getMonth() && payDate.getFullYear() === prev.getFullYear();
      }
      return false;
    }
    return true; // all
  });

  // Search filter
  const filtered = qualified.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.lastName.toLowerCase().includes(q) ||
      s.firstName.toLowerCase().includes(q) ||
      s.fileNumber.toLowerCase().includes(q)
    );
  });

  const totalAmount = filtered.length * 1000;

  const handleExportExcel = () => {
    import("xlsx").then((XLSX) => {
      const data = filtered.map((s, i) => ({
        "رقم": i + 1,
        "رقم الانخراط": s.fileNumber,
        "اللقب": s.lastName,
        "الاسم": s.firstName,
        "مبلغ الاشتراك": s.subscriptionFee ?? 0,
        "تاريخ الدفع": formatDate(s.lastPaymentDate),
        "المبلغ الإجمالي": s.totalAmount ?? 0,
        "حقوق المركب": 1000,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      ws["!cols"] = [{ wch: 6 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "حقوق المركب");
      XLSX.writeFile(wb, `حقوق_المركب_${new Date().toISOString().split("T")[0]}.xlsx`);
    });
  };

  const handlePrint = () => {
    const printWin = window.open("", "_blank");
    if (!printWin) return;
    const rows = filtered.map((s, i) => `
      <tr>
        <td style="text-align:center;padding:6px;border:1px solid #ddd;">${i + 1}</td>
        <td style="padding:6px;border:1px solid #ddd;">${s.lastName} ${s.firstName}</td>
        <td style="text-align:center;padding:6px;border:1px solid #ddd;">${s.subscriptionFee ?? 0} دج</td>
        <td style="text-align:center;padding:6px;border:1px solid #ddd;">${formatDate(s.lastPaymentDate)}</td>
      </tr>
    `).join("");
    printWin.document.write(`
      <!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>حقوق المركب</title>
      <style>
        *{font-family:'Cairo','Tahoma',Arial,sans-serif;}
        body{padding:20px;}
        h2{text-align:center;color:#0f766e;margin-bottom:10px;}
        table{width:100%;border-collapse:collapse;font-size:12pt;}
        th{background:#0f766e;color:white;padding:8px;border:1px solid #ddd;}
        td{font-size:11pt;}
        .summary{margin:15px 0;padding:10px;background:#f0fdfa;border-radius:8px;font-size:11pt;}
        @media print{body{padding:0;}}
      </style></head><body>
      <h2>قائمة حقوق ديوان المركب</h2>
      <div class="summary">
        <strong>عدد المنخرطين:</strong> ${filtered.length} |
        <strong>حقوق المركب (1000 دج/منخرط):</strong> ${totalAmount.toLocaleString("en-US")} دج |
        <strong>الفترة:</strong> ${period === "current" ? "الشهر الحالي" : period === "previous" ? "الشهر السابق" : "الكل"}
      </div>
      <table>
        <thead><tr>
          <th style="width:40px;">#</th>
          <th>الاسم واللقب</th>
          <th style="width:120px;">مبلغ الاشتراك</th>
          <th style="width:120px;">تاريخ الدفع</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <script>setTimeout(()=>window.print(),300);</script>
      </body></html>
    `);
    printWin.document.close();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="rounded-2xl border-2 border-teal-500/30 bg-teal-500/5 p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-teal-600" />
            <h3 className="font-bold text-base">حقوق ديوان المركب</h3>
            <Badge variant="outline" className="text-[10px] bg-teal-500/10 text-teal-700 border-teal-500/30">
              {filtered.length} منخرط مؤهّل
            </Badge>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">إجمالي حقوق المركب</p>
            <p className="font-extrabold text-lg text-teal-700 dark:text-teal-300 tabular-nums">
              {totalAmount.toLocaleString("en-US")} دج
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-card p-2.5 text-xs text-muted-foreground">
          <strong className="text-foreground">شرط الظهور:</strong> إجمالي الاشتراك ≥ 1300 دج + الاشتراك ساري خلال الفترة المحددة.
          المنخرطون الذين انتهى اشتراكهم يُستثنون تلقائياً.
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Period filter */}
          {([
            { id: "current", label: "الشهر الحالي" },
            { id: "previous", label: "الشهر السابق" },
            { id: "all", label: "جميع الأشهر" },
          ] as const).map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition border",
                period === p.id
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-card border-border hover:border-teal-500/40 text-muted-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم أو رقم الانخراط..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pr-10 text-sm"
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border/60 overflow-hidden max-h-[400px] overflow-y-auto scrollbar-thin">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card border-b">
              <tr className="text-right">
                <th className="p-2 font-semibold w-10">#</th>
                <th className="p-2 font-semibold">رقم الانخراط</th>
                <th className="p-2 font-semibold">الاسم واللقب</th>
                <th className="p-2 font-semibold">مبلغ الاشتراك</th>
                <th className="p-2 font-semibold">تاريخ الدفع</th>
                <th className="p-2 font-semibold">حالة الاشتراك</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">
                  لا يوجد منخرطون مؤهلون في هذه الفترة
                </td></tr>
              ) : (
                filtered.map((s, i) => (
                  <tr key={s.id} className="border-b hover:bg-accent/30">
                    <td className="p-2 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="p-2 font-mono">{s.fileNumber}</td>
                    <td className="p-2 font-semibold">{s.lastName} {s.firstName}</td>
                    <td className="p-2 tabular-nums">{s.subscriptionFee ?? 0} دج</td>
                    <td className="p-2 font-mono">{formatDate(s.lastPaymentDate)}</td>
                    <td className="p-2">
                      <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                        ✅ ساري
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Export buttons */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={handlePrint} disabled={filtered.length === 0} className="border-teal-500/30 text-teal-700 hover:bg-teal-500/10">
            <Printer className="h-3.5 w-3.5 ml-1" /> طباعة
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportExcel} disabled={filtered.length === 0} className="border-teal-500/30 text-teal-700 hover:bg-teal-500/10">
            <FileSpreadsheet className="h-3.5 w-3.5 ml-1" /> Excel
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

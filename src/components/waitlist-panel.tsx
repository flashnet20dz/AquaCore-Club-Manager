"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Clock, ListPlus, Loader2, Phone, Plus, RefreshCw, Trash2,
  UserCheck, XCircle, Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSwimConfig } from "@/hooks/use-swim-config";

interface WaitlistEntry {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  desiredSwimmingDays: string;
  desiredTimeSlot: string;
  status: "waiting" | "notified" | "converted" | "cancelled";
  note: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  waiting: "بالانتظار", notified: "تم الإشعار (يوجد مكان)", converted: "تحوّل لمشترك", cancelled: "ملغى",
};
const STATUS_COLORS: Record<string, string> = {
  waiting: "bg-amber-100 text-amber-700 border-amber-200",
  notified: "bg-sky-100 text-sky-700 border-sky-200",
  converted: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200",
};

export function WaitlistPanel() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/waitlist");
      const data = await res.json();
      setEntries(data.entries || []);
    } catch {
      toast.error("تعذّر تحميل قائمة الانتظار");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = entries.filter((e) => statusFilter === "all" || e.status === statusFilter);
  const waitingCount = entries.filter((e) => e.status === "waiting").length;
  const notifiedCount = entries.filter((e) => e.status === "notified").length;

  const act = async (id: string, action: string, extra?: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/waitlist/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      if (!res.ok) throw new Error();
      toast.success("تم التحديث");
      load();
    } catch {
      toast.error("تعذّر التنفيذ");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذا الطلب نهائياً؟")) return;
    try {
      const res = await fetch(`/api/waitlist/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("تم الحذف");
      load();
    } catch {
      toast.error("تعذّر الحذف");
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ListPlus className="h-5 w-5 text-primary" /> قائمة الانتظار
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            عندما تكون حصة ممتلئة، أضف الشخص هنا. لما يتحرّر مكان (حذف/تغيير حصة منخرط)، ينبّهك النظام تلقائياً بأول واحد بالدور.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 ml-1" /> إضافة للانتظار
          </Button>
        </div>
      </div>

      {notifiedCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sky-800 text-sm">
          <Bell className="h-4 w-4 shrink-0" />
          يوجد <strong>{notifiedCount}</strong> شخص تم إشعاره بمكان شاغر — تواصل معه لتأكيد الانضمام.
        </div>
      )}

      <div className="flex items-center gap-2">
        <Label className="text-sm">الحالة:</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل ({entries.length})</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v} ({entries.filter((e) => e.status === k).length})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {waitingCount > 0 && <Badge variant="outline" className="text-xs">{waitingCount} بالانتظار</Badge>}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : visible.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">لا يوجد أحد بقائمة الانتظار</div>
        ) : (
          visible.map((e, i) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              className="rounded-xl border bg-card p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{e.firstName} {e.lastName}</span>
                  {e.phone && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {e.phone}
                    </span>
                  )}
                  <Badge className={cn("text-xs border", STATUS_COLORS[e.status])}>{STATUS_LABELS[e.status]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  الحصة المطلوبة: {e.desiredSwimmingDays} — {e.desiredTimeSlot}
                  <span className="mx-1">·</span>
                  منذ {new Date(e.createdAt).toLocaleDateString("ar")}
                </p>
                {e.note && <p className="text-xs text-muted-foreground">ملاحظة: {e.note}</p>}
              </div>
              <div className="flex items-center gap-2">
                {(e.status === "waiting" || e.status === "notified") && (
                  <>
                    <Button size="sm" variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                      onClick={() => act(e.id, "convert")}>
                      <UserCheck className="h-3.5 w-3.5 ml-1" /> تحوّل لمشترك
                    </Button>
                    <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => act(e.id, "cancel")}>
                      <XCircle className="h-3.5 w-3.5 ml-1" /> إلغاء
                    </Button>
                  </>
                )}
                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => remove(e.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <AddWaitlistDialog open={addOpen} onOpenChange={setAddOpen} onCreated={load} />
    </div>
  );
}

function AddWaitlistDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  // 🔗 أيام/توقيتات متزامنة مع الإعدادات (تبويب المنخرطون)
  const { dayNames, slotLabels } = useSwimConfig();
  const [swimmingDays, setSwimmingDays] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // قيمة مشتقة (بدل effect): الافتراضي أول عنصر متزامن
  const effectiveDays = swimmingDays || dayNames[0] || "";
  const effectiveSlot = timeSlot || slotLabels[0] || "";

  const submit = async () => {
    if (!firstName || !lastName) { toast.error("الاسم مطلوب"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName, lastName, phone: phone || undefined,
          desiredSwimmingDays: effectiveDays, desiredTimeSlot: effectiveSlot, note: note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(
        data.currentOccupancy >= data.maxCapacity
          ? `تمت الإضافة — الحصة ممتلئة فعلاً (${data.currentOccupancy}/${data.maxCapacity})`
          : `تمت الإضافة — يوجد مكان متاح حالياً (${data.currentOccupancy}/${data.maxCapacity})! راجع بسرعة`
      );
      onOpenChange(false);
      setFirstName(""); setLastName(""); setPhone(""); setNote("");
      onCreated();
    } catch (e: any) {
      toast.error(e?.message || "تعذّرت الإضافة");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Clock className="h-4 w-4" /> إضافة لقائمة الانتظار</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>الاسم *</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>اللقب *</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>الهاتف</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" /></div>
          <div className="space-y-1.5">
            <Label>مجموعة الأيام المطلوبة</Label>
            <Select value={effectiveDays} onValueChange={setSwimmingDays}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{dayNames.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>التوقيت المطلوب</Label>
            <Select value={effectiveSlot} onValueChange={setTimeSlot}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{slotLabels.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>ملاحظة</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null} إضافة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

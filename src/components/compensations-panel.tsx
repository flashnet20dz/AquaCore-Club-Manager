"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CalendarOff,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
  Users,
  XCircle,
  Trash2,
  ChevronDown,
  ChevronLeft,
  Filter,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  SWIMMING_DAYS,
  TIME_SLOTS,
  SUBSCRIPTION_TYPES,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_COLORS,
  SUBSCRIPTION_TYPE_COLORS,
} from "@/lib/rcs";

// ═══════════════════════════════════════════════════════════
// أنواع البيانات
// ═══════════════════════════════════════════════════════════
interface CompSubscriber {
  id: string;
  fileNumber: string;
  firstName: string;
  lastName: string;
  phone: string | null;
}

interface Compensation {
  id: string;
  status: "pending" | "scheduled" | "used" | "expired" | "cancelled" | "partial";
  originalDate: string;
  originalSwimmingDays: string | null;
  originalTimeSlot: string | null;
  // ★ عدد الحصص الملغاة + المعوَّضة + تاريخ الانتهاء
  cancelledSessionsCount?: number;
  compensatedCount?: number;
  expiryDate?: string | null;
  compensationDate: string | null;
  compensationSwimmingDays: string | null;
  compensationTimeSlot: string | null;
  note: string | null;
  subscriber: CompSubscriber;
}

interface PoolClosure {
  id: string;
  date: string;
  startDate?: string | null;
  endDate?: string | null;
  swimmingDays: string | null;
  timeSlot: string | null;
  reason: string;
  note: string | null;
  compensations: Compensation[];
}

const STATUS_LABELS: Record<string, string> = {
  pending: "لم يُعوَّض",
  partial: "تعويض جزئي",
  scheduled: "محدَّد موعد",
  used: "تم التعويض",
  expired: "منتهي الصلاحية",
  cancelled: "ملغى",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800",
  partial: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800",
  scheduled: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-800",
  used: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800",
  expired: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-900/50 dark:text-slate-400 dark:border-slate-700",
  cancelled: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800",
};

// ═══════════════════════════════════════════════════════════
// المكوّن الرئيسي
// ═══════════════════════════════════════════════════════════
export function CompensationsPanel() {
  const [closures, setClosures] = useState<PoolClosure[]>([]);
  const [loading, setLoading] = useState(true);
  const [newClosureOpen, setNewClosureOpen] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState<Compensation | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkScheduleOpen, setBulkScheduleOpen] = useState(false);
  const [bulkActing, setBulkActing] = useState(false);
  // ★ Closures list section + delete
  const [showClosuresList, setShowClosuresList] = useState(false);
  const [deleteClosureId, setDeleteClosureId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadClosures = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pool-closures");
      const data = await res.json();
      setClosures(data.closures || []);
    } catch {
      toast.error("تعذّر تحميل بيانات الإغلاقات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClosures();
  }, [loadClosures]);

  // كل التعويضات مسطّحة من كل الإغلاقات، مع فلترة الحالة
  const allCompensations = closures
    .flatMap((c) => c.compensations.map((comp) => ({ ...comp, closure: c })))
    .filter((c) => statusFilter === "all" || c.status === statusFilter)
    .sort((a, b) => new Date(b.originalDate).getTime() - new Date(a.originalDate).getTime());

  const pendingCount = closures.flatMap((c) => c.compensations).filter((c) => c.status === "pending").length;

  // التحديد الجماعي يشمل فقط الحالات القابلة للتصرف (pending/scheduled)
  // ★ selectables: pending + partial + scheduled (all actionable states)
  const selectableCompensations = allCompensations.filter((c) => c.status === "pending" || c.status === "partial" || c.status === "scheduled");
  const allSelected = selectableCompensations.length > 0 && selectableCompensations.every((c) => selectedIds.has(c.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableCompensations.map((c) => c.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ★ حذف إغلاق مسجل (في حالة الخطأ)
  const confirmDeleteClosure = async () => {
    if (!deleteClosureId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/pool-closures/${deleteClosureId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذّر الحذف");
      toast.success("تم حذف الإغلاق وتعويضاته غير المستخدمة");
      setDeleteClosureId(null);
      await loadClosures();
    } catch (e: any) {
      toast.error(e?.message || "تعذّر حذف الإغلاق");
    } finally {
      setDeleting(false);
    }
  };

  const bulkCancel = async () => {
    if (!confirm(`هل تريد إلغاء ${selectedIds.size} تعويض محدَّد؟`)) return;
    setBulkActing(true);
    try {
      const res = await fetch("/api/compensations/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), action: "cancel" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`تم إلغاء ${data.cancelled} تعويض`);
      setSelectedIds(new Set());
      loadClosures();
    } catch (e: any) {
      toast.error(e?.message || "تعذّر الإلغاء الجماعي");
    } finally {
      setBulkActing(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* رأس القسم */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CalendarOff className="h-5 w-5 text-primary" />
            إغلاق المسبح وتعويض المنخرطين
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            سجّل إغلاق المسبح للصيانة، وسيكتشف النظام تلقائياً المنخرطين المتأثرين وينشئ لهم تعويضات.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadClosures} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          {closures.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowClosuresList(!showClosuresList)}
            >
              <CalendarDays className="h-4 w-4 ml-1" />
              الإغلاقات المسجلة ({closures.length})
              <ChevronDown className={cn("h-3 w-3 mr-1 transition-transform", showClosuresList && "rotate-180")} />
            </Button>
          )}
          <Button size="sm" onClick={() => setNewClosureOpen(true)}>
            <Plus className="h-4 w-4 ml-1" />
            تسجيل إغلاق جديد
          </Button>
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          يوجد <strong>{pendingCount}</strong> تعويض بانتظار تحديد حصة بديلة.
        </div>
      )}

      {/* فلتر الحالة + التحديد الجماعي */}
      <div className="flex items-center gap-3 flex-wrap">
        <Label className="text-sm">الحالة:</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectableCompensations.length > 0 && (
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
            تحديد الكل ({selectableCompensations.length})
          </label>
        )}
      </div>

      {/* شريط الإجراءات الجماعية */}
      {someSelected && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2"
        >
          <Badge variant="secondary" className="text-xs">{selectedIds.size} محدَّد</Badge>
          <Button size="sm" onClick={() => setBulkScheduleOpen(true)} disabled={bulkActing}>
            <Clock className="h-3.5 w-3.5 ml-1" /> تعويض جماعي (نفس الحصة للجميع)
          </Button>
          <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={bulkCancel} disabled={bulkActing}>
            {bulkActing ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> : <XCircle className="h-3.5 w-3.5 ml-1" />}
            إلغاء المحدَّد
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            إلغاء التحديد
          </Button>
        </motion.div>
      )}

      {/* ★ قائمة الإغلاقات المسجلة (قابلة للحذف عند الخطأ) */}
      {showClosuresList && closures.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              الإغلاقات المسجلة ({closures.length})
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setShowClosuresList(false)}>
              إخفاء
            </Button>
          </div>
          <ScrollArea className="max-h-80">
            <div className="divide-y">
              {closures.map((closure) => {
                const affectedCount = closure.compensations.length;
                const pendingCount = closure.compensations.filter((c) => c.status === "pending").length;
                const partialCount = closure.compensations.filter((c) => c.status === "partial").length;
                const usedCount = closure.compensations.filter((c) => c.status === "used").length;
                const expiredCount = closure.compensations.filter((c) => c.status === "expired").length;
                const hasUsed = usedCount > 0;
                // ★ total cancelled sessions across all compensations in this closure
                const totalCancelled = closure.compensations.reduce((s, c) => s + (c.cancelledSessionsCount || 1), 0);
                const totalCompensated = closure.compensations.reduce((s, c) => s + (c.compensatedCount || 0), 0);
                const isMultiDay = closure.startDate && closure.endDate &&
                  new Date(closure.endDate).getTime() - new Date(closure.startDate).getTime() > 86400000;
                return (
                  <div key={closure.id} className="p-3 flex items-start justify-between gap-3 hover:bg-muted/20 transition-colors">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">
                          {isMultiDay
                            ? `${new Date(closure.startDate!).toLocaleDateString("ar")} ← ${new Date(closure.endDate!).toLocaleDateString("ar")}`
                            : new Date(closure.date).toLocaleDateString("ar", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                        </span>
                        {isMultiDay && <Badge variant="outline" className="text-xs bg-primary/10 text-primary">إغلاق متعدد</Badge>}
                        <Badge variant="outline" className="text-xs">{closure.swimmingDays || "كل الأيام"}</Badge>
                        {closure.timeSlot && <Badge variant="outline" className="text-xs">{closure.timeSlot}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        السبب: {closure.reason}
                        {closure.note && <span className="mr-1">· {closure.note}</span>}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {affectedCount} متأثر</span>
                        {totalCancelled > affectedCount && (
                          <span className="flex items-center gap-1 text-amber-700"><CalendarOff className="h-3 w-3" /> {totalCancelled} حصة ملغاة</span>
                        )}
                        {totalCompensated > 0 && (
                          <span className="text-emerald-600">{totalCompensated}/{totalCancelled} معوَّض</span>
                        )}
                        {pendingCount > 0 && <span className="text-rose-600">{pendingCount} لم يُعوَّض</span>}
                        {partialCount > 0 && <span className="text-amber-600">{partialCount} جزئي</span>}
                        {usedCount > 0 && <span className="text-emerald-600">{usedCount} مكتمل</span>}
                        {expiredCount > 0 && <span className="text-slate-500">{expiredCount} منتهي</span>}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 shrink-0"
                      onClick={() => setDeleteClosureId(closure.id)}
                      title={hasUsed ? "حذف الإغلاق (التعويضات المستخدمة ستبقى محفوظة)" : "حذف الإغلاق وتعويضاته"}
                    >
                      <Trash2 className="h-3.5 w-3.5 ml-1" />
                      حذف
                    </Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* قائمة التعويضات */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : allCompensations.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            لا توجد تعويضات حالياً
          </div>
        ) : (
          allCompensations.map((comp, i) => (
            <motion.div
              key={comp.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="rounded-xl border bg-card p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {(comp.status === "pending" || comp.status === "scheduled") && (
                  <Checkbox
                    checked={selectedIds.has(comp.id)}
                    onCheckedChange={() => toggleSelectOne(comp.id)}
                    className="mt-1 shrink-0"
                  />
                )}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">
                      {comp.subscriber.firstName} {comp.subscriber.lastName}
                    </span>
                    <Badge variant="outline" className="text-xs">{comp.subscriber.fileNumber}</Badge>
                    <Badge className={cn("text-xs border", STATUS_COLORS[comp.status])}>
                      {STATUS_LABELS[comp.status]}
                    </Badge>
                    {/* ★ عدد الحصص الملغاة vs المعوَّضة */}
                    {comp.cancelledSessionsCount && comp.cancelledSessionsCount > 1 && (
                      <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                        {comp.compensatedCount || 0}/{comp.cancelledSessionsCount} معوَّض
                      </Badge>
                    )}
                    {/* ★ تنبيه قرب انتهاء الصلاحية */}
                    {comp.expiryDate && (comp.status === "pending" || comp.status === "partial" || comp.status === "scheduled") && (
                      <ExpiryBadge expiryDate={comp.expiryDate} />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    الحصة الأصلية: {new Date(comp.originalDate).toLocaleDateString("ar")} —{" "}
                    {comp.originalSwimmingDays || "—"} / {comp.originalTimeSlot || "—"}
                    <span className="mx-1">·</span>
                    سبب الإغلاق: {comp.closure.reason}
                  </p>
                  {comp.compensationDate && (
                    <p className="text-xs text-emerald-700 flex items-center gap-1">
                      <CalendarCheck className="h-3 w-3" />
                      الحصة التعويضية: {new Date(comp.compensationDate).toLocaleDateString("ar")} —{" "}
                      {comp.compensationTimeSlot}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {comp.status === "pending" && (
                  <Button size="sm" onClick={() => setScheduleTarget(comp)}>
                    <Clock className="h-3.5 w-3.5 ml-1" />
                    تحديد حصة تعويضية
                  </Button>
                )}
                {comp.status === "scheduled" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                      onClick={() => markUsed(comp.id, loadClosures)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 ml-1" />
                      تم الحضور
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setScheduleTarget(comp)}>
                      تغيير الموعد
                    </Button>
                  </>
                )}
                {(comp.status === "pending" || comp.status === "scheduled") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-rose-600 hover:bg-rose-50"
                    onClick={() => cancelCompensation(comp.id, loadClosures)}
                  >
                    <XCircle className="h-3.5 w-3.5 ml-1" />
                    إلغاء
                  </Button>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* نافذة تسجيل إغلاق جديد */}
      <NewClosureDialog
        open={newClosureOpen}
        onOpenChange={setNewClosureOpen}
        onCreated={loadClosures}
      />

      {/* نافذة تحديد الحصة التعويضية */}
      {scheduleTarget && (
        <ScheduleDialog
          compensation={scheduleTarget}
          onClose={() => setScheduleTarget(null)}
          onScheduled={() => {
            setScheduleTarget(null);
            loadClosures();
          }}
        />
      )}

      {/* نافذة التعويض الجماعي */}
      {bulkScheduleOpen && (
        <BulkScheduleDialog
          count={selectedIds.size}
          onClose={() => setBulkScheduleOpen(false)}
          onSubmit={async (payload) => {
            setBulkActing(true);
            try {
              const res = await fetch("/api/compensations/bulk", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: Array.from(selectedIds), action: "schedule", ...payload }),
              });
              const data = await res.json();
              if (!res.ok) {
                toast.error(data.error || "تعذّر التعويض الجماعي");
                return;
              }
              toast.success(`تم تحديد الحصة التعويضية لـ ${data.scheduled} منخرط(ة)`);
              setBulkScheduleOpen(false);
              setSelectedIds(new Set());
              loadClosures();
            } catch {
              toast.error("تعذّر التعويض الجماعي");
            } finally {
              setBulkActing(false);
            }
          }}
          submitting={bulkActing}
        />
      )}

      {/* ★ نافذة تأكيد حذف الإغلاق */}
      <AlertDialog open={!!deleteClosureId} onOpenChange={(o) => !o && setDeleteClosureId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
              تأكيد حذف الإغلاق
            </AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف سجل الإغلاق وكل تعويضاته غير المستخدمة (بانتظار/محددة).
              التعويضات التي تم استخدامها (استُبدلت بحصة فعلية) ستبقى محفوظة كأرشيف.
              <strong className="block mt-2 text-rose-600">لا يمكن التراجع عن هذا الإجراء.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDeleteClosure(); }}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {deleting ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <Trash2 className="h-4 w-4 ml-1" />}
              حذف الإغلاق
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// إجراءات مساعدة
// ═══════════════════════════════════════════════════════════
async function markUsed(id: string, refresh: () => void) {
  try {
    const res = await fetch(`/api/compensations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "use" }),
    });
    if (!res.ok) throw new Error();
    toast.success("تم تسجيل حضور الحصة التعويضية");
    refresh();
  } catch {
    toast.error("تعذّر تسجيل الحضور");
  }
}

async function cancelCompensation(id: string, refresh: () => void) {
  if (!confirm("هل تريد إلغاء هذا التعويض؟")) return;
  try {
    const res = await fetch(`/api/compensations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    if (!res.ok) throw new Error();
    toast.success("تم إلغاء التعويض");
    refresh();
  } catch {
    toast.error("تعذّر الإلغاء");
  }
}

// ═══════════════════════════════════════════════════════════
// نافذة: تسجيل إغلاق مسبح جديد
// ═══════════════════════════════════════════════════════════
function NewClosureDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  // ★ فترة الإغلاق: من تاريخ إلى تاريخ (لو endDate فارغ = إغلاق يوم واحد)
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [swimmingDays, setSwimmingDays] = useState<string>("__all__");
  const [timeSlot, setTimeSlot] = useState<string>("__all__");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [validityDays, setValidityDays] = useState(60);
  const [submitting, setSubmitting] = useState(false);

  // ─── تعويض جماعي حسب تاريخ التسجيل + نوع الاشتراك + حالة الدفع ───
  const [showBulkFilter, setShowBulkFilter] = useState(true);
  const [registeredOnOrBefore, setRegisteredOnOrBefore] = useState("");
  const [registeredOnOrAfter, setRegisteredOnOrAfter] = useState("");
  // ★ Multi-select filters: subscription types + payment statuses
  const [selectedSubscriptionTypes, setSelectedSubscriptionTypes] = useState<string[]>([]);
  const [selectedPaymentStatuses, setSelectedPaymentStatuses] = useState<string[]>([]);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewCancelledSessions, setPreviewCancelledSessions] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const hasAnyFilter =
    swimmingDays !== "__all__" || timeSlot !== "__all__" ||
    !!registeredOnOrBefore || !!registeredOnOrAfter ||
    selectedSubscriptionTypes.length > 0 || selectedPaymentStatuses.length > 0;

  const buildParams = () => {
    const params = new URLSearchParams();
    if (swimmingDays !== "__all__") params.set("swimmingDays", swimmingDays);
    if (timeSlot !== "__all__") params.set("timeSlot", timeSlot);
    if (registeredOnOrBefore) params.set("registeredOnOrBefore", registeredOnOrBefore);
    if (registeredOnOrAfter) params.set("registeredOnOrAfter", registeredOnOrAfter);
    // ★ comma-separated multi-filters
    if (selectedSubscriptionTypes.length > 0) params.set("subscriptionTypes", selectedSubscriptionTypes.join(","));
    if (selectedPaymentStatuses.length > 0) params.set("paymentStatuses", selectedPaymentStatuses.join(","));
    // ★ date range for cancelled sessions count
    if (startDate && endDate) {
      params.set("startDate", startDate);
      params.set("endDate", endDate);
    } else if (startDate) {
      params.set("date", startDate);
    }
    return params;
  };

  // ★ toggle helpers for multi-select
  const toggleSubscriptionType = (type: string) => {
    setSelectedSubscriptionTypes((prev) => prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]);
    setPreviewCount(null);
  };
  const togglePaymentStatus = (status: string) => {
    setSelectedPaymentStatuses((prev) => prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]);
    setPreviewCount(null);
  };

  const preview = async () => {
    setPreviewLoading(true);
    setPreviewCount(null);
    setPreviewCancelledSessions(null);
    try {
      const res = await fetch(`/api/pool-closures/preview?${buildParams().toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreviewCount(data.total);
      setPreviewCancelledSessions(data.totalCancelledSessions ?? null);
    } catch (e: any) {
      toast.error(e?.message || "تعذّرت المعاينة");
    } finally {
      setPreviewLoading(false);
    }
  };

  const submit = async () => {
    if (!startDate || !reason) {
      toast.error("تاريخ بداية الإغلاق والسبب مطلوبان");
      return;
    }
    if (endDate && new Date(endDate) < new Date(startDate)) {
      toast.error("تاريخ النهاية يجب أن يكون بعد تاريخ البداية");
      return;
    }
    if (!hasAnyFilter && !confirm("لم تحدد أي تصفية — هذا سيعوّض كل المنخرطين بدون استثناء. متابعة؟")) {
      return;
    }
    setSubmitting(true);
    try {
      // ★ لو endDate فارغ، نرسل date فقط (إغلاق يوم واحد للتوافق)
      const payload: Record<string, unknown> = {
        swimmingDays: swimmingDays === "__all__" ? null : swimmingDays,
        timeSlot: timeSlot === "__all__" ? null : timeSlot,
        reason,
        note: note || undefined,
        registeredOnOrBefore: registeredOnOrBefore || undefined,
        registeredOnOrAfter: registeredOnOrAfter || undefined,
        subscriptionTypes: selectedSubscriptionTypes.length > 0 ? selectedSubscriptionTypes : undefined,
        paymentStatuses: selectedPaymentStatuses.length > 0 ? selectedPaymentStatuses : undefined,
        validityDays,
      };
      if (endDate) {
        payload.startDate = startDate;
        payload.endDate = endDate;
      } else {
        payload.date = startDate;
      }

      const res = await fetch("/api/pool-closures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const cancelledMsg = data.totalCancelledSessions ? ` (${data.totalCancelledSessions} حصة ملغاة)` : "";
      toast.success(`تم تسجيل الإغلاق — تأثر ${data.affectedCount} منخرط(ة)${cancelledMsg}`);
      onOpenChange(false);
      setStartDate(""); setEndDate(""); setSwimmingDays("__all__"); setTimeSlot("__all__"); setReason(""); setNote("");
      setValidityDays(60);
      setRegisteredOnOrBefore(""); setRegisteredOnOrAfter(""); setPreviewCount(null);
      setSelectedSubscriptionTypes([]); setSelectedPaymentStatuses([]);
      onCreated();
    } catch (e: any) {
      toast.error(e?.message || "تعذّر تسجيل الإغلاق");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarOff className="h-4 w-4" />
            تسجيل إغلاق المسبح للصيانة
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* ★ فترة الإغلاق: من تاريخ إلى تاريخ */}
          <div className="space-y-1.5">
            <Label>فترة الإغلاق *</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">من تاريخ (بداية الإغلاق)</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPreviewCount(null); }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">إلى تاريخ (نهاية الإغلاق — اختياري)</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPreviewCount(null); }}
                  placeholder="لإغلاق يوم واحد اتركه فارغاً"
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {endDate
                ? "إغلاق متعدد الأيام — سيُحسب عدد الحصص الملغاة فعلياً لكل فوج حسب جدوله."
                : "إغلاق يوم واحد — اترك «إلى تاريخ» فارغاً."}
            </p>
          </div>

          {/* ★ مهلة الاستخدام */}
          <div className="space-y-1.5">
            <Label>مهلة استخدام التعويض (أيام)</Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={validityDays}
              onChange={(e) => setValidityDays(Number(e.target.value) || 60)}
              className="h-8"
            />
            <p className="text-[10px] text-muted-foreground">
              تنتهي صلاحية الحصة التعويضية بعد {validityDays} يوماً من تاريخ الإلغاء.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>مجموعة الأيام المتأثرة</Label>
            <Select value={swimmingDays} onValueChange={(v) => { setSwimmingDays(v); setPreviewCount(null); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">كل المجموعات (إغلاق شامل لليوم)</SelectItem>
                {SWIMMING_DAYS.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>التوقيت المتأثر</Label>
            <Select value={timeSlot} onValueChange={(v) => { setTimeSlot(v); setPreviewCount(null); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">كل التوقيتات</SelectItem>
                {TIME_SLOTS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>سبب الإغلاق *</Label>
            <Input
              placeholder="مثال: صيانة دورية لفلاتر المسبح"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>ملاحظة (اختياري)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>

          {/* ─── ★ معايير تحديد المنخرطين المعنيين بالتعويض ─── */}
          <div className="rounded-lg border border-primary/20 bg-primary/5">
            <button
              type="button"
              onClick={() => setShowBulkFilter(!showBulkFilter)}
              className="w-full flex items-center justify-between p-2.5 text-xs font-semibold"
            >
              <span className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-primary" />
                معايير تحديد المنخرطين المعنيين بالتعويض
              </span>
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showBulkFilter && "rotate-180")} />
            </button>
            {showBulkFilter && (
              <div className="p-3 pt-0 space-y-4">
                <p className="text-[11px] text-muted-foreground">
                  حدد المنخرطين المعنيين بالتعويض: نوع الاشتراك، حالة الدفع، وفترة التسجيل.
                  كل المعايير مجتمعة بـ AND — اتركها فارغة لتعويض كل المنخرطين.
                </p>

                {/* ★ أنواع الاشتراك المعنية */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold flex items-center gap-1">
                    <Filter className="h-3 w-3" />
                    أنواع الاشتراك المعنية
                    {selectedSubscriptionTypes.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-4">{selectedSubscriptionTypes.length} محدد</Badge>
                    )}
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {SUBSCRIPTION_TYPES.map((type) => {
                      const selected = selectedSubscriptionTypes.includes(type as string);
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => toggleSubscriptionType(type as string)}
                          className={cn(
                            "px-2 py-1 rounded-md text-[11px] border transition-all",
                            selected
                              ? cn(SUBSCRIPTION_TYPE_COLORS[type as string] || "bg-primary/15 text-primary border-primary/30", "ring-1 ring-primary/30")
                              : "bg-background text-muted-foreground border-border hover:border-primary/30"
                          )}
                        >
                          {type}
                        </button>
                      );
                    })}
                    {selectedSubscriptionTypes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setSelectedSubscriptionTypes([]); setPreviewCount(null); }}
                        className="px-2 py-1 rounded-md text-[11px] text-rose-600 hover:bg-rose-50"
                      >
                        مسح
                      </button>
                    )}
                  </div>
                </div>

                {/* ★ حالة الاشتراكات */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold flex items-center gap-1">
                    <Filter className="h-3 w-3" />
                    حالة الاشتراكات
                    {selectedPaymentStatuses.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-4">{selectedPaymentStatuses.length} محدد</Badge>
                    )}
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {PAYMENT_STATUSES.map((status) => {
                      const selected = selectedPaymentStatuses.includes(status);
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => togglePaymentStatus(status)}
                          className={cn(
                            "px-2 py-1 rounded-md text-[11px] border transition-all",
                            selected
                              ? cn(PAYMENT_STATUS_COLORS[status] || "bg-primary/15 text-primary border-primary/30", "ring-1 ring-primary/30")
                              : "bg-background text-muted-foreground border-border hover:border-primary/30"
                          )}
                        >
                          {status}
                        </button>
                      );
                    })}
                    {selectedPaymentStatuses.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setSelectedPaymentStatuses([]); setPreviewCount(null); }}
                        className="px-2 py-1 rounded-md text-[11px] text-rose-600 hover:bg-rose-50"
                      >
                        مسح
                      </button>
                    )}
                  </div>
                </div>

                {/* ★ المنخرطون المسجلون من تاريخ ... إلى يوم الغلق */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" />
                    المنخرطون المسجلون (من تاريخ إلى يوم الغلق)
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">مسجَّل ابتداءً من</Label>
                      <Input
                        type="date"
                        value={registeredOnOrAfter}
                        onChange={(e) => { setRegisteredOnOrAfter(e.target.value); setPreviewCount(null); }}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">مسجَّل حتى يوم الغلق</Label>
                      <Input
                        type="date"
                        value={registeredOnOrBefore}
                        onChange={(e) => { setRegisteredOnOrBefore(e.target.value); setPreviewCount(null); }}
                        className="h-8 text-xs"
                        placeholder="يوم الغلق"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    اترك "حتى يوم الغلق" فارغاً لتعويض كل المنخرطين المسجلين من تاريخ البداية حتى الآن.
                  </p>
                </div>

                {/* ملخص المعايير النشطة */}
                {hasAnyFilter && (
                  <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                    <span className="text-muted-foreground">المعايير النشطة:</span>
                    {swimmingDays !== "__all__" && <Badge variant="outline" className="text-[10px] h-4">{swimmingDays}</Badge>}
                    {timeSlot !== "__all__" && <Badge variant="outline" className="text-[10px] h-4">{timeSlot}</Badge>}
                    {selectedSubscriptionTypes.map((t) => <Badge key={t} variant="outline" className="text-[10px] h-4">{t}</Badge>)}
                    {selectedPaymentStatuses.map((s) => <Badge key={s} variant="outline" className="text-[10px] h-4">{s}</Badge>)}
                    {(registeredOnOrAfter || registeredOnOrBefore) && (
                      <Badge variant="outline" className="text-[10px] h-4">
                        {registeredOnOrAfter || "..."} ← {registeredOnOrBefore || "الآن"}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── معاينة عدد المتأثرين ─── */}
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={preview} disabled={previewLoading}>
              {previewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> : <Users className="h-3.5 w-3.5 ml-1" />}
              معاينة عدد المتأثرين
            </Button>
            {previewCount !== null && (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  سيتأثر {previewCount} منخرط(ة)
                </Badge>
                {previewCancelledSessions !== null && previewCancelledSessions > 0 && (
                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                    {previewCancelledSessions} حصة ملغاة متوقعة
                  </Badge>
                )}
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2 flex items-start gap-1.5">
            <Users className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            سيتم تلقائياً تحديد كل المنخرطين المطابقين لكل الشروط المحدَّدة أعلاه (حصة + تاريخ تسجيل)،
            وإنشاء تعويض لكل واحد منهم بحالة "بانتظار التحديد".
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
            تسجيل الإغلاق وإنشاء التعويضات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════
// نافذة: تحديد الحصة التعويضية
// ═══════════════════════════════════════════════════════════
function ScheduleDialog({
  compensation,
  onClose,
  onScheduled,
}: {
  compensation: Compensation;
  onClose: () => void;
  onScheduled: () => void;
}) {
  const [date, setDate] = useState("");
  const [swimmingDays, setSwimmingDays] = useState<string>(
    compensation.originalSwimmingDays || SWIMMING_DAYS[0]
  );
  const [timeSlot, setTimeSlot] = useState<string>(compensation.originalTimeSlot || TIME_SLOTS[0]);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!date || !timeSlot) {
      toast.error("التاريخ والتوقيت مطلوبان");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/compensations/${compensation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "schedule",
          compensationDate: date,
          compensationSwimmingDays: swimmingDays,
          compensationTimeSlot: timeSlot,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "تعذّر التحديد");
        return;
      }
      toast.success("تم تحديد الحصة التعويضية وإشعار المنخرط");
      onScheduled();
    } catch {
      toast.error("تعذّر التحديد");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            تحديد حصة تعويضية — {compensation.subscriber.firstName} {compensation.subscriber.lastName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>تاريخ الحصة التعويضية *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>مجموعة الأيام</Label>
            <Select value={swimmingDays} onValueChange={setSwimmingDays}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SWIMMING_DAYS.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>التوقيت *</Label>
            <Select value={timeSlot} onValueChange={setTimeSlot}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            سيتحقق النظام تلقائياً من توفر مكان في هذه الحصة قبل التأكيد.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
            تأكيد الحصة التعويضية
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════
// نافذة: التعويض الجماعي (نفس الحصة لكل المحدَّدين دفعة واحدة)
// ═══════════════════════════════════════════════════════════
function BulkScheduleDialog({
  count,
  onClose,
  onSubmit,
  submitting,
}: {
  count: number;
  onClose: () => void;
  onSubmit: (payload: { compensationDate: string; compensationSwimmingDays: string; compensationTimeSlot: string }) => void;
  submitting: boolean;
}) {
  const [date, setDate] = useState("");
  const [swimmingDays, setSwimmingDays] = useState<string>(SWIMMING_DAYS[0]);
  const [timeSlot, setTimeSlot] = useState<string>(TIME_SLOTS[0]);

  const submit = () => {
    if (!date || !timeSlot) {
      toast.error("التاريخ والتوقيت مطلوبان");
      return;
    }
    onSubmit({ compensationDate: date, compensationSwimmingDays: swimmingDays, compensationTimeSlot: timeSlot });
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            تعويض جماعي — {count} منخرط(ة) محدَّدين
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-md p-2">
            سيتم تحديد <strong>نفس</strong> الحصة التعويضية التالية لكل الأشخاص المحدَّدين دفعة واحدة.
            سيتحقق النظام من توفر مكان كافٍ للجميع قبل التأكيد — إذا السعة غير كافية، لن تُنفَّذ العملية إطلاقاً.
          </p>
          <div className="space-y-1.5">
            <Label>تاريخ الحصة التعويضية *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>مجموعة الأيام</Label>
            <Select value={swimmingDays} onValueChange={setSwimmingDays}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SWIMMING_DAYS.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>التوقيت *</Label>
            <Select value={timeSlot} onValueChange={setTimeSlot}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
            تأكيد التعويض الجماعي ({count})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════
// ★ ExpiryBadge — تنبيه قرب انتهاء صلاحية التعويض
// ═══════════════════════════════════════════════════════════
function ExpiryBadge({ expiryDate }: { expiryDate: string }) {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);

  if (daysLeft < 0) {
    return (
      <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-500 border-slate-200">
        منتهية الصلاحية
      </Badge>
    );
  }
  if (daysLeft <= 7) {
    return (
      <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200 animate-pulse">
        ⚠️ ينتهي خلال {daysLeft} يوم
      </Badge>
    );
  }
  if (daysLeft <= 30) {
    return (
      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
        ينتهي خلال {daysLeft} يوم
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] bg-muted/50 text-muted-foreground">
      صالح حتى {expiry.toLocaleDateString("ar")}
    </Badge>
  );
}

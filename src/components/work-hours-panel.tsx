"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Clock, Plus, CheckCircle2, XCircle, Trash2, Loader2, Calendar, Hourglass, Check, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface WorkHour {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "pending" | "approved" | "rejected";
  note: string | null;
  approvedAt: string | null;
  user: { id: string; name: string; email: string; role: string };
}

interface WorkHoursPanelProps {
  userRole: string;
  currentUserId: string;
}

export function WorkHoursPanel({ userRole, currentUserId }: WorkHoursPanelProps) {
  const [workHours, setWorkHours] = useState<WorkHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().split("T")[0], startTime: "09:00", endTime: "11:00", note: "" });
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const canApprove = ["admin", "assistant"].includes(userRole);
  const isLifeguard = userRole === "lifeguard";

  const fetchWorkHours = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/workhours");
      const data = await res.json();
      if (res.ok) setWorkHours(data.workHours || []);
      else toast.error(data.error);
    } catch {
      toast.error("تعذر التحميل");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWorkHours(); }, [fetchWorkHours]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { offlineFetch } = await import("@/hooks/use-offline-mutation");
      const res = await offlineFetch("/api/workhours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.offline) {
        toast.success("✓ تم تسجيل ساعات العمل محلياً — سيُزامن عند عودة الاتصال");
      } else {
        toast.success("تم تسجيل ساعات العمل");
      }
      setModalOpen(false);
      setForm({ date: new Date().toISOString().split("T")[0], startTime: "09:00", endTime: "11:00", note: "" });
      fetchWorkHours();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (id: string, status: "approved" | "rejected") => {
    try {
      const res = await fetch(`/api/workhours/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast.success(status === "approved" ? "تمت الموافقة" : "تم الرفض");
      fetchWorkHours();
    } catch {
      toast.error("فشل");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/workhours/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("تم الحذف");
      fetchWorkHours();
    } catch {
      toast.error("فشل");
    }
  };

  // Calculate duration in hours
  const calcDuration = (start: string, end: string): number => {
    const s = new Date(start);
    const e = new Date(end);
    return Math.round((e.getTime() - s.getTime()) / 3600000 * 10) / 10;
  };

  // Stats
  const pending = workHours.filter((w) => w.status === "pending");
  const approved = workHours.filter((w) => w.status === "approved");
  const rejected = workHours.filter((w) => w.status === "rejected");
  const totalHours = approved.reduce((sum, w) => sum + calcDuration(w.startTime, w.endTime), 0);

  const filtered = filterStatus === "all" ? workHours : workHours.filter((w) => w.status === filterStatus);

  const statusInfo: Record<string, { label: string; color: string; icon: typeof Clock }> = {
    pending: { label: "بانتظار الموافقة", color: "bg-amber-500/15 text-amber-700 border-amber-500/30", icon: Hourglass },
    approved: { label: "موافق عليها", color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", icon: CheckCircle2 },
    rejected: { label: "مرفوضة", color: "bg-rose-500/15 text-rose-700 border-rose-500/30", icon: XCircle },
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <Hourglass className="h-4 w-4 text-amber-600 mb-1" />
          <p className="text-2xl font-extrabold tabular-nums">{pending.length}</p>
          <p className="text-xs text-muted-foreground">بانتظار الموافقة</p>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 mb-1" />
          <p className="text-2xl font-extrabold tabular-nums">{approved.length}</p>
          <p className="text-xs text-muted-foreground">موافق عليها</p>
        </div>
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
          <XCircle className="h-4 w-4 text-rose-600 mb-1" />
          <p className="text-2xl font-extrabold tabular-nums">{rejected.length}</p>
          <p className="text-xs text-muted-foreground">مرفوضة</p>
        </div>
        <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 p-3">
          <Clock className="h-4 w-4 text-teal-600 mb-1" />
          <p className="text-2xl font-extrabold tabular-nums">{totalHours}</p>
          <p className="text-xs text-muted-foreground">ساعات مؤكدة</p>
        </div>
      </div>

      {/* Add button + filter */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> سجل ساعات العمل
            {isLifeguard && <span className="text-xs text-muted-foreground font-normal">(سجلاتك)</span>}
          </h3>
          <div className="flex items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-9 rounded-lg border border-border bg-card px-2 text-sm"
            >
              <option value="all">الكل</option>
              <option value="pending">بانتظار الموافقة</option>
              <option value="approved">موافق عليها</option>
              <option value="rejected">مرفوضة</option>
            </select>
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4 ml-1" /> تسجيل ساعات
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">لا توجد سجلات</p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 -mr-1">
            {filtered.map((w, i) => {
              const info = statusInfo[w.status];
              const hours = calcDuration(w.startTime, w.endTime);
              const isOwn = w.user.id === currentUserId;
              return (
                <motion.div
                  key={w.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition",
                    w.status === "approved" ? "bg-emerald-50/50 border-emerald-200/50 dark:bg-emerald-900/10"
                    : w.status === "rejected" ? "bg-rose-50/50 border-rose-200/50 dark:bg-rose-900/10"
                    : "bg-amber-50/50 border-amber-200/50 dark:bg-amber-900/10"
                  )}
                >
                  <Avatar className="h-9 w-9 rounded-lg shrink-0">
                    <AvatarFallback className="rounded-md text-xs font-bold bg-primary/15 text-primary">
                      {w.user.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{w.user.name}</p>
                      {!isOwn && canApprove && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1">
                          {w.user.role === "lifeguard" ? "🏊" : w.user.role === "admin" ? "👑" : "💼"}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(w.date).toISOString().split("T")[0].replace(/-/g,"/")}</span>
                      <span>•</span>
                      <Clock className="h-3 w-3" />
                      <span dir="ltr">
                        {new Date(w.startTime).toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" })}
                        {" - "}
                        {new Date(w.endTime).toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span>•</span>
                      <Badge variant="outline" className="text-[9px] h-4 px-1 bg-teal-500/10 text-teal-700 border-teal-500/30">
                        {hours} سا
                      </Badge>
                    </div>
                    {w.note && <p className="text-xs text-muted-foreground mt-1 italic">"{w.note}"</p>}
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] h-5", info.color)}>
                    <info.icon className="h-3 w-3 ml-1" />
                    {info.label}
                  </Badge>
                  {/* Actions */}
                  {canApprove && w.status === "pending" && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-600 hover:bg-emerald-500/10" onClick={() => handleApprove(w.id, "approved")}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-500/10" onClick={() => handleApprove(w.id, "rejected")}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {(isOwn || canApprove) && (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(w.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> تسجيل ساعات عمل
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">التاريخ *</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-10" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">ساعة البداية *</Label>
                <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="h-10" dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">ساعة النهاية *</Label>
                <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="h-10" dir="ltr" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">ملاحظات</Label>
              <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} placeholder="ملاحظات إضافية..." className="text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 ml-1" />}
              تسجيل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

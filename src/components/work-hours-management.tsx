"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Clock, Plus, Search, Download, Printer, RefreshCw, Users, CheckCircle2,
  XCircle, Calendar, Wallet, TrendingUp, FileText, Loader2, ChevronLeft, ChevronRight,
  User, Trash2, Check, X, Settings2, DollarSign, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface WorkHour {
  id: string;
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  workStatus: string;
  absenceReason: string | null;
  status: string;
  note: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar: string | null;
    position: string | null;
    hourlyRate: number;
  };
}

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
  position: string | null;
  hourlyRate: number;
  avatar: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  present: "حاضر",
  absent: "غائب",
  leave: "عطلة",
  sick: "مرضي",
  vacation: "عطلة سنوية",
  "half-day": "نصف دوام",
};

const STATUS_COLORS: Record<string, string> = {
  present: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  absent: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  leave: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  sick: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  vacation: "bg-violet-500/15 text-violet-700 border-violet-500/30",
  "half-day": "bg-teal-500/15 text-teal-700 border-teal-500/30",
};

const APPROVAL_LABELS: Record<string, string> = {
  pending: "بانتظار الموافقة",
  approved: "موافق عليه",
  rejected: "مرفوض",
};

// 🔑 حساب ساعات العمل من startTime و endTime و breakMinutes
function calcWorkHours(startTime: string, endTime: string, breakMinutes: number = 0): number {
  const start = new Date(startTime);
  let end = new Date(endTime);
  if (end <= start) {
    end = new Date(end);
    end.setDate(end.getDate() + 1);
  }
  const diffMs = end.getTime() - start.getTime();
  const totalMinutes = diffMs / (1000 * 60);
  const workMinutes = totalMinutes - breakMinutes;
  return Math.max(0, workMinutes / 60);
}

function formatDate(d: string | Date): string {
  const date = new Date(d);
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function formatTime(d: string | Date): string {
  const date = new Date(d);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function WorkHoursManagement() {
  const [workHours, setWorkHours] = useState<WorkHour[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterStaff, setFilterStaff] = useState<string>("all");
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rateSaving, setRateSaving] = useState(false);
  const [editingRate, setEditingRate] = useState<{ userId: string; name: string; hourlyRate: number; position: string } | null>(null);

  // Form state
  const [form, setForm] = useState({
    targetUserId: "",
    date: new Date().toISOString().split("T")[0],
    startTime: "08:00",
    endTime: "17:00",
    breakMinutes: 0,
    workStatus: "present",
    absenceReason: "",
    note: "",
  });

  const fetchWorkHours = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workhours?month=${currentMonth}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setWorkHours(data.workHours || []);
      }
    } catch {
      toast.error("تعذر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setStaff(data.users || []);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchWorkHours();
    fetchStaff();
  }, [fetchWorkHours, fetchStaff]);

  // Stats
  const stats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const todayRecords = workHours.filter((w) => new Date(w.date).toISOString().split("T")[0] === today);
    const presentToday = todayRecords.filter((w) => w.workStatus === "present").length;
    const absentToday = todayRecords.filter((w) => w.workStatus === "absent").length;
    const totalHoursMonth = workHours
      .filter((w) => w.workStatus === "present")
      .reduce((sum, w) => sum + calcWorkHours(w.startTime, w.endTime, w.breakMinutes), 0);
    const totalWages = workHours
      .filter((w) => w.workStatus === "present" && w.user.hourlyRate > 0)
      .reduce((sum, w) => sum + calcWorkHours(w.startTime, w.endTime, w.breakMinutes) * w.user.hourlyRate, 0);
    const overtimeHours = workHours
      .filter((w) => w.workStatus === "present")
      .reduce((sum, w) => {
        const hours = calcWorkHours(w.startTime, w.endTime, w.breakMinutes);
        return sum + Math.max(0, hours - 8);
      }, 0);

    return {
      totalStaff: staff.length,
      presentToday,
      absentToday,
      totalHoursMonth: Math.round(totalHoursMonth),
      totalWages: Math.round(totalWages),
      overtimeHours: Math.round(overtimeHours),
      absentDays: workHours.filter((w) => w.workStatus === "absent").length,
    };
  }, [workHours, staff]);

  // Filtered records
  const filtered = useMemo(() => {
    let result = workHours;
    if (filterStatus !== "all") result = result.filter((w) => w.workStatus === filterStatus);
    if (filterStaff !== "all") result = result.filter((w) => w.userId === filterStaff);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((w) =>
        w.user.name.toLowerCase().includes(q) ||
        (w.user.position || "").toLowerCase().includes(q) ||
        (w.note || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [workHours, filterStatus, filterStaff, search]);

  const handleSave = async () => {
    if (!form.targetUserId) {
      toast.error("اختر العامل");
      return;
    }
    if (!form.date) {
      toast.error("التاريخ مطلوب");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/workhours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("تم تسجيل ساعات العمل");
      setDialogOpen(false);
      setForm({
        targetUserId: "",
        date: new Date().toISOString().split("T")[0],
        startTime: "08:00",
        endTime: "17:00",
        breakMinutes: 0,
        workStatus: "present",
        absenceReason: "",
        note: "",
      });
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
      if (!res.ok) throw new Error("فشل");
      toast.success(status === "approved" ? "تمت الموافقة" : "تم الرفض");
      fetchWorkHours();
    } catch {
      toast.error("فشل");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    try {
      const res = await fetch(`/api/workhours/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("فشل");
      toast.success("تم الحذف");
      fetchWorkHours();
    } catch {
      toast.error("فشل");
    }
  };

  // 🔑 تحديد سعر الساعة لكل عامل
  const handleSaveRate = async () => {
    if (!editingRate) return;
    setRateSaving(true);
    try {
      const res = await fetch(`/api/users/${editingRate.userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hourlyRate: editingRate.hourlyRate,
          position: editingRate.position,
        }),
      });
      if (!res.ok) throw new Error("فشل");
      toast.success("تم حفظ سعر الساعة");
      setRateDialogOpen(false);
      setEditingRate(null);
      fetchStaff();
    } catch {
      toast.error("فشل الحفظ");
    } finally {
      setRateSaving(false);
    }
  };

  // 🔑 جدول ملخص ساعات العمل والراتب لكل عامل
  const staffSummary = useMemo(() => {
    return staff.map((s) => {
      const records = workHours.filter((w) => w.userId === s.id && w.workStatus === "present");
      const totalHours = records.reduce((sum, w) => sum + calcWorkHours(w.startTime, w.endTime, w.breakMinutes), 0);
      const overtime = records.reduce((sum, w) => {
        const h = calcWorkHours(w.startTime, w.endTime, w.breakMinutes);
        return sum + Math.max(0, h - 8);
      }, 0);
      const totalWage = totalHours * (s.hourlyRate || 0);
      const presentDays = records.length;
      const absentDays = workHours.filter((w) => w.userId === s.id && w.workStatus === "absent").length;
      return {
        ...s,
        totalHours: Math.round(totalHours * 10) / 10,
        overtime: Math.round(overtime * 10) / 10,
        totalWage: Math.round(totalWage),
        presentDays,
        absentDays,
      };
    });
  }, [staff, workHours]);

  const goToPrevMonth = () => {
    const [y, m] = currentMonth.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const goToNextMonth = () => {
    const [y, m] = currentMonth.split("-").map(Number);
    const d = new Date(y, m, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const monthName = useMemo(() => {
    const [y, m] = currentMonth.split("-").map(Number);
    const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    return `${months[m - 1]} ${y}`;
  }, [currentMonth]);

  const isAbsence = form.workStatus === "absent" || form.workStatus === "leave" || form.workStatus === "sick" || form.workStatus === "vacation";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Clock className="h-6 w-6 text-teal-600" />
            <div>
              <h2 className="text-xl font-bold text-teal-900">إدارة ساعات العمل</h2>
              <p className="text-xs text-muted-foreground">تسجيل ومتابعة دوام العمال — حساب الساعات والأجور</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => setDialogOpen(true)} className="bg-teal-600 hover:bg-teal-700 text-white">
              <Plus className="h-4 w-4 ml-1" /> إضافة سجل
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRateDialogOpen(true)} className="border-amber-400 text-amber-700 hover:bg-amber-50">
              <DollarSign className="h-4 w-4 ml-1" /> أسعار الساعة
            </Button>
            <Button size="sm" variant="outline" onClick={fetchWorkHours}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        <StatCard icon={Users} label="العمال" value={stats.totalStaff} color="from-blue-500 to-blue-600" />
        <StatCard icon={CheckCircle2} label="حاضر اليوم" value={stats.presentToday} color="from-emerald-500 to-emerald-600" />
        <StatCard icon={XCircle} label="غائب اليوم" value={stats.absentToday} color="from-rose-500 to-rose-600" />
        <StatCard icon={Clock} label="ساعات الشهر" value={stats.totalHoursMonth} color="from-teal-500 to-teal-600" />
        <StatCard icon={Wallet} label="الأجور (دج)" value={stats.totalWages} color="from-amber-500 to-amber-600" />
        <StatCard icon={TrendingUp} label="ساعات إضافية" value={stats.overtimeHours} color="from-violet-500 to-violet-600" />
        <StatCard icon={Calendar} label="أيام الغياب" value={stats.absentDays} color="from-slate-500 to-slate-600" />
      </div>

      {/* Month selector + Filters */}
      <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="icon" onClick={goToPrevMonth} className="rounded-xl">
            <ChevronRight className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">الشهر المحدد</p>
            <p className="text-lg font-bold text-teal-900">{monthName}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={goToNextMonth} className="rounded-xl">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم أو الوظيفة..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10 h-9" />
          </div>
          <Select value={filterStaff} onValueChange={setFilterStaff}>
            <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="العامل" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل العمال</SelectItem>
              {staff.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[120px] h-9"><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="present">حاضر</SelectItem>
              <SelectItem value="absent">غائب</SelectItem>
              <SelectItem value="leave">عطلة</SelectItem>
              <SelectItem value="sick">مرضي</SelectItem>
              <SelectItem value="vacation">عطلة سنوية</SelectItem>
              <SelectItem value="half-day">نصف دوام</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-teal-800 text-white">
                <th className="p-2 text-right w-8">#</th>
                <th className="p-2 text-right min-w-[120px]">العامل</th>
                <th className="p-2 text-right w-24">التاريخ</th>
                <th className="p-2 text-center w-16">الدخول</th>
                <th className="p-2 text-center w-16">الخروج</th>
                <th className="p-2 text-center w-16">استراحة</th>
                <th className="p-2 text-center w-16">ساعات</th>
                <th className="p-2 text-center w-20">إضافي</th>
                <th className="p-2 text-center w-24">الأجر</th>
                <th className="p-2 text-center w-20">الحالة</th>
                <th className="p-2 text-center w-20">الموافقة</th>
                <th className="p-2 text-center w-20">عمليات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={12} className="text-center py-12 text-muted-foreground">لا توجد سجلات</td></tr>
              ) : (
                filtered.map((w, i) => {
                  const hours = w.workStatus === "present" ? calcWorkHours(w.startTime, w.endTime, w.breakMinutes) : 0;
                  const overtime = Math.max(0, hours - 8);
                  const wage = hours * (w.user.hourlyRate || 0);
                  return (
                    <motion.tr
                      key={w.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.01, 0.3) }}
                      className={cn("border-b transition hover:bg-teal-50/40 bg-slate-50")}
                    >
                      <td className="p-2 text-center text-muted-foreground">{i + 1}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-teal-500/15 flex items-center justify-center text-teal-700 font-bold text-xs shrink-0">
                            {w.user.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{w.user.name}</p>
                            <p className="text-[10px] text-muted-foreground">{w.user.position || w.user.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-2 text-center text-xs">{formatDate(w.date)}</td>
                      <td className="p-2 text-center font-mono text-xs">{w.workStatus === "present" ? formatTime(w.startTime) : "—"}</td>
                      <td className="p-2 text-center font-mono text-xs">{w.workStatus === "present" ? formatTime(w.endTime) : "—"}</td>
                      <td className="p-2 text-center text-xs">{w.breakMinutes > 0 ? `${w.breakMinutes}د` : "—"}</td>
                      <td className="p-2 text-center font-bold text-teal-700">{hours > 0 ? hours.toFixed(1) : "—"}</td>
                      <td className="p-2 text-center text-violet-600 font-semibold">{overtime > 0 ? `+${overtime.toFixed(1)}` : "—"}</td>
                      <td className="p-2 text-center font-semibold text-amber-600">{wage > 0 ? `${Math.round(wage)} دج` : "—"}</td>
                      <td className="p-2 text-center">
                        <Badge variant="outline" className={cn("text-[9px]", STATUS_COLORS[w.workStatus])}>
                          {STATUS_LABELS[w.workStatus] || w.workStatus}
                        </Badge>
                      </td>
                      <td className="p-2 text-center">
                        {w.status === "approved" ? (
                          <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                            <Check className="h-2.5 w-2.5 ml-0.5" /> موافق
                          </Badge>
                        ) : w.status === "rejected" ? (
                          <Badge variant="outline" className="text-[9px] bg-rose-500/10 text-rose-700 border-rose-500/30">
                            <X className="h-2.5 w-2.5 ml-0.5" /> مرفوض
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-700 border-amber-500/30">
                            معلّق
                          </Badge>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {w.status === "pending" && (
                            <>
                              <button onClick={() => handleApprove(w.id, "approved")} className="p-1 rounded hover:bg-emerald-50 text-emerald-600" title="موافقة">
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => handleApprove(w.id, "rejected")} className="p-1 rounded hover:bg-rose-50 text-rose-600" title="رفض">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          <button onClick={() => handleDelete(w.id)} className="p-1 rounded hover:bg-rose-50 text-rose-600" title="حذف">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add record dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-teal-600" /> إضافة سجل ساعات عمل
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* العامل */}
            <div>
              <Label className="text-xs font-semibold">العامل *</Label>
              <Select value={form.targetUserId} onValueChange={(v) => setForm({ ...form, targetUserId: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="اختر العامل..." /></SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.position ? `— ${s.position}` : ""} {s.hourlyRate > 0 ? `(${s.hourlyRate} دج/سا)` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* التاريخ + الحالة */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">التاريخ *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-9" />
              </div>
              <div>
                <Label className="text-xs font-semibold">الحالة</Label>
                <Select value={form.workStatus} onValueChange={(v) => setForm({ ...form, workStatus: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">حاضر</SelectItem>
                    <SelectItem value="absent">غائب</SelectItem>
                    <SelectItem value="leave">عطلة</SelectItem>
                    <SelectItem value="sick">مرضي</SelectItem>
                    <SelectItem value="vacation">عطلة سنوية</SelectItem>
                    <SelectItem value="half-day">نصف دوام</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* أوقات الدوام — تظهر فقط للحضور */}
            {!isAbsence && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs font-semibold">الدخول</Label>
                  <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="h-9" />
                </div>
                <div>
                  <Label className="text-xs font-semibold">الخروج</Label>
                  <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="h-9" />
                </div>
                <div>
                  <Label className="text-xs font-semibold">استراحة (دقيقة)</Label>
                  <Input type="number" min={0} max={240} value={form.breakMinutes} onChange={(e) => setForm({ ...form, breakMinutes: +e.target.value })} className="h-9" />
                </div>
              </div>
            )}

            {/* سبب الغياب */}
            {isAbsence && (
              <div>
                <Label className="text-xs font-semibold">سبب الغياب</Label>
                <Input value={form.absenceReason} onChange={(e) => setForm({ ...form, absenceReason: e.target.value })} placeholder="مثال: مرض، عطلة..." className="h-9" />
              </div>
            )}

            {/* معاينة الساعات */}
            {!isAbsence && (
              <div className="rounded-lg bg-teal-500/5 border border-teal-500/20 p-2 text-xs">
                <span className="text-muted-foreground">ساعات العمل: </span>
                <span className="font-bold text-teal-700">
                  {calcWorkHours(
                    `${form.date}T${form.startTime}`,
                    `${form.date}T${form.endTime}`,
                    form.breakMinutes
                  ).toFixed(1)} ساعة
                </span>
                {(() => {
                  const selectedStaff = staff.find((s) => s.id === form.targetUserId);
                  if (!selectedStaff || !selectedStaff.hourlyRate) return null;
                  const hours = calcWorkHours(`${form.date}T${form.startTime}`, `${form.date}T${form.endTime}`, form.breakMinutes);
                  return (
                    <>
                      <span className="text-muted-foreground"> | الأجر: </span>
                      <span className="font-bold text-amber-600">{Math.round(hours * selectedStaff.hourlyRate)} دج</span>
                    </>
                  );
                })()}
              </div>
            )}

            {/* ملاحظات */}
            <div>
              <Label className="text-xs font-semibold">ملاحظات</Label>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="ملاحظات إضافية..." className="h-9" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-teal-600 hover:bg-teal-700 text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 ml-1" />}
              تسجيل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🔑 جدول ملخص ساعات العمل والراتب */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-50/30 overflow-hidden">
        <div className="p-4 border-b border-amber-500/20">
          <h3 className="font-bold text-sm flex items-center gap-2 text-amber-900">
            <Wallet className="h-4 w-4 text-amber-600" /> ملخص ساعات العمل والراتب — {monthName}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-amber-500/10 text-amber-900">
                <th className="p-2 text-right w-8">#</th>
                <th className="p-2 text-right min-w-[120px]">العامل</th>
                <th className="p-2 text-right">الوظيفة</th>
                <th className="p-2 text-center">سعر الساعة</th>
                <th className="p-2 text-center">أيام الحضور</th>
                <th className="p-2 text-center">أيام الغياب</th>
                <th className="p-2 text-center">مجموع الساعات</th>
                <th className="p-2 text-center">ساعات إضافية</th>
                <th className="p-2 text-center font-bold">الراتب الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {staffSummary.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">لا يوجد عمال</td></tr>
              ) : (
                staffSummary.map((s, i) => (
                  <tr key={s.id} className={cn("border-b border-amber-500/10 hover:bg-amber-50/40 bg-amber-50/10")}>
                    <td className="p-2 text-center text-muted-foreground">{i + 1}</td>
                    <td className="p-2 font-semibold">{s.name}</td>
                    <td className="p-2 text-xs text-muted-foreground">{s.position || s.role}</td>
                    <td className="p-2 text-center font-semibold text-amber-700">
                      {s.hourlyRate > 0 ? `${s.hourlyRate} دج` : <span className="text-rose-500 text-xs">غير محدد</span>}
                    </td>
                    <td className="p-2 text-center font-semibold text-emerald-600">{s.presentDays}</td>
                    <td className="p-2 text-center font-semibold text-rose-500">{s.absentDays}</td>
                    <td className="p-2 text-center font-bold text-teal-700">{s.totalHours > 0 ? `${s.totalHours} سا` : "—"}</td>
                    <td className="p-2 text-center font-semibold text-violet-600">{s.overtime > 0 ? `+${s.overtime} سا` : "—"}</td>
                    <td className="p-2 text-center font-bold text-amber-700 text-base">
                      {s.totalWage > 0 ? `${s.totalWage.toLocaleString()} دج` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {staffSummary.length > 0 && (
              <tfoot>
                <tr className="bg-amber-500/15 font-bold text-amber-900">
                  <td colSpan={5} className="p-2 text-right">الإجمالي</td>
                  <td className="p-2 text-center">{staffSummary.reduce((s, x) => s + x.absentDays, 0)}</td>
                  <td className="p-2 text-center text-teal-700">{staffSummary.reduce((s, x) => s + x.totalHours, 0).toFixed(1)} سا</td>
                  <td className="p-2 text-center text-violet-600">+{staffSummary.reduce((s, x) => s + x.overtime, 0).toFixed(1)} سا</td>
                  <td className="p-2 text-center text-amber-700 text-base">{staffSummary.reduce((s, x) => s + x.totalWage, 0).toLocaleString()} دج</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 🔑 نافذة تحديد سعر الساعة */}
      <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-amber-600" /> تحديد سعر الساعة لكل عامل
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {staff.map((s) => (
              <div key={s.id} className="flex items-center gap-2 p-3 rounded-lg border bg-card hover:bg-accent/40 transition">
                <div className="w-10 h-10 rounded-full bg-teal-500/15 flex items-center justify-center text-teal-700 font-bold shrink-0">
                  {s.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{s.name}</p>
                  <p className="text-[10px] text-muted-foreground">{s.position || s.role}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={s.hourlyRate || 0}
                    onChange={(e) => {
                      const rate = +e.target.value;
                      setStaff((prev) => prev.map((x) => x.id === s.id ? { ...x, hourlyRate: rate } : x));
                    }}
                    className="h-8 w-24 text-center text-sm"
                    min={0}
                    step={50}
                  />
                  <span className="text-xs text-muted-foreground shrink-0">دج/سا</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0"
                  onClick={async () => {
                    setEditingRate({ userId: s.id, name: s.name, hourlyRate: s.hourlyRate || 0, position: s.position || "" });
                    await handleSaveRate();
                  }}
                  disabled={rateSaving}
                >
                  <Save className="h-3.5 w-3.5 ml-1" /> حفظ
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRateDialogOpen(false)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={cn("rounded-xl p-3 text-white bg-gradient-to-br", color)}>
      <Icon className="h-4 w-4 mb-1" />
      <p className="text-lg font-extrabold tabular-nums leading-none">{value.toLocaleString()}</p>
      <p className="text-[10px] opacity-90 mt-1">{label}</p>
    </div>
  );
}

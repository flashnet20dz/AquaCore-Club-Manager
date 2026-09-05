"use client";

/**
 * pool-schedule.tsx — جدول أيام وساعات استغلال المسبح (المرحلة 4 — §8/§9/§14)
 * ═══════════════════════════════════════════════════════════════════════════
 * المصدر الوحيد للجلسات: الإعدادات (SwimmingTimeSlot + Setting poolOperatingDays).
 * هذه الصفحة تقرأ فقط — أي تعديل هنا يمر عبر نفس APIs الإعدادات، فينعكس
 * فوراً على Registration وPointage وساعات العمل (invalidateSwimConfig).
 *
 * الأقسام:
 *  أ) أيام استغلال المسبح — مفاتيح أسبوعية تُحفظ فورياً (Setting: poolOperatingDays)
 *  ب) جدول الجلسات — اليوم/الجلسة/البداية/النهاية/الحالة/العمال/الإجراءات
 *     + إضافة/تعديل/حذف/تفعيل-تعطيل + تعيين العمال لكل جلسة (§9)
 *  ج) Pointage يومي — تاريخ → جلسات اليوم → العمال المعيّنون → حاضر/متأخر/غائب
 *     يُسجّل عبر /api/workhours/bulk (سجل لكل حصة — يغذي الأجور تلقائياً) (§14/§15)
 *
 * الأوقات نصوص "HH:mm" حرفية (ساعة الحائط) — لا تحويل توقيت في أي مكان.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Waves, Clock, Plus, Pencil, Trash2, Users, Loader2, Check, RefreshCw,
  CalendarClock, UserCheck, UserX, AlertCircle, Power,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { toLocalYMD, formatWallDate, formatWallTime } from "@/lib/wall-clock";
import { ExportButton } from "@/components/shared/export-button";
import { useSwimConfig, invalidateSwimConfig, type SwimSlotOption } from "@/hooks/use-swim-config";
import {
  POOL_DAYS, POOL_DAY_LABELS, ALL_DAY_KEYS, dayKeyFromDate, sessionsForDay,
  slotDurationHours, isOperatingDay, type PoolSlot,
} from "@/lib/pool-schedule";

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface SlotAssignment {
  id: string;
  userId: string;
  slotId: string | null;
  dayOfWeek: string;
  timeSlot: string;
  attendanceStatus: string;
  user: { id: string; name: string; email: string; role: string };
  slot?: { id: string; name: string; startTime: string; endTime: string; dayOfWeek: string | null; active: boolean } | null;
}

interface WorkHourLite {
  id: string;
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  workStatus: string;
  status: string;
  user: { id: string; name: string };
}

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير",
  superadmin: "مدير عام",
  assistant: "مساعد",
  accountant: "محاسب",
  lifeguard: "حارس",
  observer: "مراقب",
};

export function PoolSchedule({ role }: { role?: string }) {
  const isAdmin = role === "admin" || role === "superadmin";
  const { slots: swimSlots, loading: slotsLoading } = useSwimConfig();

  // ─── أيام الاستغلال ───
  const [operatingDays, setOperatingDays] = useState<string[]>([...ALL_DAY_KEYS]);
  const [operatingDaysLoaded, setOperatingDaysLoaded] = useState(false);
  const [savingDayKey, setSavingDayKey] = useState<string | null>(null);

  // ─── التعيينات ───
  const [assignments, setAssignments] = useState<SlotAssignment[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [assignSlot, setAssignSlot] = useState<PoolSlot | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);

  // ─── حوار إضافة/تعديل حصة ───
  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [slotEditing, setSlotEditing] = useState<PoolSlot | null>(null);
  const [slotDay, setSlotDay] = useState<string>("general");
  const [slotForm, setSlotForm] = useState({ name: "", startTime: "09:00", endTime: "10:00" });
  const [slotSaving, setSlotSaving] = useState(false);
  const [togglingSlot, setTogglingSlot] = useState<string | null>(null);

  // ─── فلتر اليوم للجدول ───
  const [tableDayFilter, setTableDayFilter] = useState<string>("all");

  // ─── Pointage يومي ───
  const [pointageDate, setPointageDate] = useState<string>(() => toLocalYMD());
  const [workHours, setWorkHours] = useState<WorkHourLite[]>([]);
  const [whMonth, setWhMonth] = useState<string>(() => toLocalYMD().slice(0, 7));
  const [whLoading, setWhLoading] = useState(false);
  const [pointageBusy, setPointageBusy] = useState<string | null>(null); // `${userId}:${slotId}`

  const fetchAssignments = useCallback(async () => {
    try {
      const res = await fetch("/api/guard-assignments", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments || []);
      }
    } catch { /* silent */ }
  }, []);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setStaff(data.users || []);
      }
    } catch { /* silent */ }
  }, []);

  const fetchWorkHours = useCallback(async (month: string) => {
    setWhLoading(true);
    try {
      const res = await fetch(`/api/workhours?month=${month}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setWorkHours(data.workHours || []);
      }
    } catch { /* silent */ } finally {
      setWhLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
    fetchStaff();
  }, [fetchAssignments, fetchStaff]);

  // ★ تحميل أيام استغلال المسبح من الإعدادات (المصدر الرسمي)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { settings?: Record<string, string> } | null) => {
        if (cancelled) return;
        const raw = data?.settings?.poolOperatingDays;
        if (typeof raw === "string" && raw) {
          try {
            const arr: unknown = JSON.parse(raw);
            if (Array.isArray(arr)) {
              setOperatingDays(arr.filter((k): k is string => typeof k === "string" && ALL_DAY_KEYS.includes(k)));
            }
          } catch { /* إعداد تالف → يبقى الافتراضي */ }
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setOperatingDaysLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  // سجلات الشهر الحالي للنقاط — يعاد الجلب عند تغيّر التاريخ خارج الشهر
  useEffect(() => {
    const m = pointageDate.slice(0, 7);
    if (m !== whMonth) {
      setWhMonth(m);
      fetchWorkHours(m);
    }
  }, [pointageDate, whMonth, fetchWorkHours]);

  useEffect(() => {
    fetchWorkHours(whMonth);
  }, []);

  // ─── حفظ أيام الاستغلال (فوري) ───
  const toggleDay = async (key: string) => {
    if (!isAdmin) return;
    const prev = operatingDays;
    const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
    setOperatingDays(next);
    setSavingDayKey(key);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { poolOperatingDays: JSON.stringify(next) } }),
      });
      if (!res.ok) throw new Error("فشل");
      toast.success("تم حفظ أيام استغلال المسبح");
    } catch {
      setOperatingDays(prev);
      toast.error("تعذر حفظ الأيام");
    } finally {
      setSavingDayKey(null);
    }
  };

  // ─── حصة: إضافة/تعديل ───
  const openSlotAdd = (dayKey: string) => {
    setSlotEditing(null);
    setSlotDay(dayKey);
    setSlotForm({ name: "", startTime: "09:00", endTime: "10:00" });
    setSlotDialogOpen(true);
  };

  const openSlotEdit = (s: PoolSlot) => {
    setSlotEditing(s);
    setSlotDay(s.dayOfWeek || "general");
    setSlotForm({ name: s.name, startTime: s.startTime, endTime: s.endTime });
    setSlotDialogOpen(true);
  };

  const handleSlotSave = async () => {
    if (!slotForm.startTime || !slotForm.endTime) {
      toast.error("حدد وقت البداية والنهاية");
      return;
    }
    setSlotSaving(true);
    try {
      const name = slotForm.name.trim();
      const payload: Record<string, unknown> = {
        startTime: slotForm.startTime,
        endTime: slotForm.endTime,
        dayOfWeek: slotDay === "general" ? null : slotDay,
      };
      if (name) payload.name = name;
      const res = slotEditing
        ? await fetch(`/api/swimming-slots/${slotEditing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/swimming-slots", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "فشل الحفظ");
      toast.success(slotEditing ? "تم تحديث الحصة — ستنعكس فوراً على التسجيل والنقاط وساعات العمل" : "تمت إضافة الحصة");
      setSlotDialogOpen(false);
      invalidateSwimConfig();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحفظ");
    } finally {
      setSlotSaving(false);
    }
  };

  const handleSlotDelete = async (id: string) => {
    if (!confirm("تعطيل هذه الحصة؟ ستُخفى من كل الصفحات لكن السجل يبقى محفوظاً مع سجلات ساعات العمل القديمة بأوقاتها.")) return;
    try {
      const res = await fetch(`/api/swimming-slots/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("فشل");
      toast.success("تم تعطيل الحصة — السجل محفوظ");
      invalidateSwimConfig();
      fetchAssignments();
    } catch {
      toast.error("فشل التعطيل");
    }
  };

  /** تفعيل/تعطيل حصة — المعطّلة تختفي من كل الصفحات دون حذف (§4) */
  const handleSlotToggle = async (s: PoolSlot) => {
    setTogglingSlot(s.id);
    try {
      const res = await fetch(`/api/swimming-slots/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !s.active }),
      });
      if (!res.ok) throw new Error();
      toast.success(!s.active ? "تم تفعيل الحصة" : "تم تعطيل الحصة — تختفي من التسجيل والنقاط وساعات العمل");
      invalidateSwimConfig();
    } catch {
      toast.error("فشل التبديل");
    } finally {
      setTogglingSlot(null);
    }
  };

  // ─── تعيين العمال على حصة ───
  const slotAssignments = (slotId: string) => assignments.filter((a) => a.slotId === slotId);

  const openAssign = (s: PoolSlot) => {
    setAssignSlot(s);
    setAssignDialogOpen(true);
  };

  const toggleAssign = async (s: PoolSlot, userId: string) => {
    const existing = slotAssignments(s.id).find((a) => a.userId === userId);
    setAssignSaving(true);
    try {
      if (existing) {
        const res = await fetch(`/api/guard-assignments?id=${existing.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("فشل");
        toast.success("تمت إزالة التعيين");
      } else {
        const res = await fetch("/api/guard-assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slotId: s.id, userId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as { error?: string }).error || "فشل");
        toast.success("تم تعيين العامل على الحصة");
      }
      await fetchAssignments();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل");
    } finally {
      setAssignSaving(false);
    }
  };

  // ─── Pointage: حالة عامل في حصة معيّنة لتاريخ النقاط ───
  const pointageDayKey = useMemo(() => dayKeyFromDate(pointageDate), [pointageDate]);
  const pointageDayOpen = isOperatingDay(operatingDays, pointageDayKey);
  const daySessions = useMemo(
    () => (isAdmin ? sessionsForDay(swimSlots as PoolSlot[], pointageDayKey) : []),
    [swimSlots, pointageDayKey, isAdmin]
  );

  /** هل هذا العامل مسجّل في هذه الحصة بتاريخ النقاط؟ */
  const recordFor = (userId: string, slot: PoolSlot): WorkHourLite | undefined => {
    return workHours.find((w) => {
      if (w.userId !== userId) return false;
      const d = formatWallDate(w.date);
      if (d !== pointageDate.split("-").reverse().join("/")) return false;
      const start = formatWallTime(w.startTime);
      return start === slot.startTime;
    });
  };

  /** تسجيل حضور عامل في حصة — سجل واحد لكل حصة عبر /api/workhours/bulk */
  const markPointage = async (userId: string, slot: PoolSlot, present: boolean, late = false) => {
    setPointageBusy(`${userId}:${slot.id}`);
    try {
      const res = await fetch("/api/workhours/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          date: pointageDate,
          slotIds: [slot.id],
          note: late ? "تسجيل حضور — متأخر" : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "فشل التسجيل");
      if (present) {
        toast.success(`تم تسجيل ${late ? "حضور (متأخر)" : "حضور"} — ${slot.startTime}-${slot.endTime}`);
      } else {
        toast.success("تم تخطي التسجيل — لن يُحتسب في الأجور");
      }
      fetchWorkHours(whMonth);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل");
    } finally {
      setPointageBusy(null);
    }
  };

  // ─── الجدول الموحّد: صفوف (يوم × حصة) ───
  interface ScheduleRow { dayKey: string; dayLabel: string; slot: PoolSlot }
  const scheduleRows: ScheduleRow[] = useMemo(() => {
    const rows: ScheduleRow[] = [];
    for (const d of POOL_DAYS) {
      if (tableDayFilter !== "all" && tableDayFilter !== d.key) continue;
      for (const s of sessionsForDay(swimSlots as PoolSlot[], d.key, { activeOnly: false })) {
        rows.push({ dayKey: d.key, dayLabel: d.label, slot: s });
      }
    }
    return rows;
  }, [swimSlots, tableDayFilter]);

  const exportRows = scheduleRows.map((r) => ({
    day: r.dayLabel,
    session: r.slot.name,
    start: r.slot.startTime,
    end: r.slot.endTime,
    hours: slotDurationHours(r.slot.startTime, r.slot.endTime),
    status: r.slot.active ? "نشطة" : "معطّلة",
    workers: slotAssignments(r.slot.id).map((a) => a.user.name).join("، ") || "—",
  }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Waves className="h-6 w-6 text-teal-600" />
            <div>
              <h2 className="text-xl font-bold text-teal-900">جدول أيام وساعات استغلال المسبح</h2>
              <p className="text-xs text-muted-foreground">
                المصدر الموحّد للجلسات — أي تعديل هنا ينعكس تلقائياً على التسجيل والنقاط وساعات العمل
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {isAdmin && (
              <Button size="sm" onClick={() => openSlotAdd("general")} className="bg-teal-600 hover:bg-teal-700 text-white">
                <Plus className="h-4 w-4 ml-1" /> إضافة جلسة
              </Button>
            )}
            <ExportButton
              rows={exportRows}
              filename={`جدول-المسبح-${toLocalYMD()}`}
              title="جدول أيام وساعات استغلال المسبح"
              formats={["excel", "csv", "pdf", "print"]}
              columns={[
                { key: "day", label: "اليوم" },
                { key: "session", label: "الجلسة" },
                { key: "start", label: "البداية" },
                { key: "end", label: "النهاية" },
                { key: "hours", label: "الساعات" },
                { key: "status", label: "الحالة" },
                { key: "workers", label: "العمال المعيّنون" },
              ]}
            />
            <Button size="sm" variant="outline" onClick={() => { invalidateSwimConfig(); fetchAssignments(); fetchStaff(); }}>
              <RefreshCw className={cn("h-4 w-4", slotsLoading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      {/* أ) أيام استغلال المسبح */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5 text-teal-600" /> أيام تشغيل المسبح الأسبوعية
        </Label>
        <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label="أيام تشغيل المسبح">
          {POOL_DAYS.map((d) => {
            const on = operatingDays.includes(d.key);
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => toggleDay(d.key)}
                disabled={!isAdmin || !operatingDaysLoaded || savingDayKey !== null}
                aria-pressed={on}
                className={cn(
                  "h-8 min-w-[44px] px-3 rounded-full border text-xs font-semibold transition-all",
                  on
                    ? "bg-teal-600 text-white border-teal-600 shadow-sm hover:bg-teal-700"
                    : "bg-background text-muted-foreground border-border hover:border-teal-400 hover:text-teal-700"
                )}
              >
                {on && <Check className="inline h-3 w-3 ml-1 -mt-0.5" />}
                {d.label}
              </button>
            );
          })}
          {(!operatingDaysLoaded || savingDayKey) && (
            <Loader2 className="h-4 w-4 animate-spin text-teal-600 self-center" />
          )}
        </div>
      </div>

      {/* ب) جدول الجلسات الموحّد */}
      <div className="rounded-2xl border border-teal-500/30 bg-card overflow-hidden">
        <div className="p-4 border-b border-teal-500/20 flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-teal-600" /> جلسات السباحة
          </h3>
          <Select value={tableDayFilter} onValueChange={setTableDayFilter}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue placeholder="كل الأيام" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأيام</SelectItem>
              {POOL_DAYS.map((d) => (
                <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 text-foreground border-b-2 border-primary/20">
                <th className="p-2 text-right">اليوم</th>
                <th className="p-2 text-right">الجلسة</th>
                <th className="p-2 text-center">البداية</th>
                <th className="p-2 text-center">النهاية</th>
                <th className="p-2 text-center">الساعات</th>
                <th className="p-2 text-center">الحالة</th>
                <th className="p-2 text-right">العمال المعيّنون</th>
                <th className="p-2 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {slotsLoading ? (
                <tr><td colSpan={8} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" /></td></tr>
              ) : scheduleRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-muted-foreground text-sm">
                    لا توجد جلسات — {isAdmin ? "أضف جلسة من الزر أعلاه" : "أضف الجلسات من إعدادات المسبح"}
                  </td>
                </tr>
              ) : (
                scheduleRows.map((r, i) => {
                  const assigned = slotAssignments(r.slot.id);
                  const dayEnabled = isOperatingDay(operatingDays, r.dayKey);
                  return (
                    <motion.tr
                      key={`${r.dayKey}-${r.slot.id}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.02, 0.2) }}
                      className={cn("border-b border-border/40 hover:bg-muted/30", !r.slot.active && "opacity-50")}
                    >
                      <td className="p-2 font-semibold">
                        {r.dayLabel}
                        {!dayEnabled && <Badge variant="outline" className="mr-1 text-[9px] h-4 px-1 text-muted-foreground">مغلق</Badge>}
                        {!r.slot.dayOfWeek && <Badge variant="outline" className="mr-1 text-[9px] h-4 px-1">عامة</Badge>}
                      </td>
                      <td className="p-2">{r.slot.name}</td>
                      <td className="p-2 text-center font-mono" dir="ltr">{r.slot.startTime}</td>
                      <td className="p-2 text-center font-mono" dir="ltr">{r.slot.endTime}</td>
                      <td className="p-2 text-center font-bold text-teal-700">
                        {slotDurationHours(r.slot.startTime, r.slot.endTime) % 1 === 0
                          ? slotDurationHours(r.slot.startTime, r.slot.endTime)
                          : slotDurationHours(r.slot.startTime, r.slot.endTime).toFixed(1)} سا
                      </td>
                      <td className="p-2 text-center">
                        {r.slot.active ? (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30">نشطة</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-slate-500/10 text-slate-500 border-slate-500/30">معطّلة</Badge>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          {assigned.length === 0 ? (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          ) : (
                            assigned.map((a) => (
                              <Badge key={a.id} variant="secondary" className="text-[10px] h-5">
                                <Users className="h-2.5 w-2.5 ml-0.5" />
                                {a.user.name}
                              </Badge>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center justify-center gap-1">
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => openAssign(r.slot)}
                                aria-label="تعيين عمال"
                                title="تعيين عمال"
                                className="p-1.5 rounded hover:bg-teal-500/10 text-teal-700"
                              >
                                <Users className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleSlotToggle(r.slot)}
                                aria-label={r.slot.active ? "تعطيل" : "تفعيل"}
                                title={r.slot.active ? "تعطيل" : "تفعيل"}
                                disabled={togglingSlot === r.slot.id}
                                className="p-1.5 rounded hover:bg-amber-500/10 text-amber-600"
                              >
                                {togglingSlot === r.slot.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
                              </button>
                              <button onClick={() => openSlotEdit(r.slot)} aria-label="تعديل" title="تعديل" className="p-1.5 rounded hover:bg-accent text-teal-700">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => handleSlotDelete(r.slot.id)} aria-label="حذف" title="حذف" className="p-1.5 rounded hover:bg-rose-500/10 text-rose-500">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          {!isAdmin && assigned.length === 0 && <span className="text-[11px] text-muted-foreground">—</span>}
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

      {/* ج) Pointage يومي — للمدير */}
      {isAdmin && (
        <div className="rounded-2xl border border-amber-500/30 bg-card overflow-hidden">
          <div className="p-4 border-b border-amber-500/20 flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-amber-600" /> Pointage — تسجيل حضور العمال حسب الجلسات
            </h3>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={pointageDate}
                onChange={(e) => setPointageDate(e.target.value)}
                className="h-8 w-[160px] text-xs"
              />
            </div>
          </div>
          <div className="p-4 space-y-3">
            {!pointageDayOpen ? (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-600 font-semibold text-center">
                🔒 المسبح مغلق في يوم {POOL_DAY_LABELS[pointageDayKey || ""] || pointageDayKey} حسب إعدادات أيام التشغيل.
              </div>
            ) : daySessions.length === 0 ? (
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 text-center">
                لا توجد جلسات مفعّلة لهذا اليوم — أضف جلسات من الجدول أعلاه.
              </p>
            ) : (
              daySessions.map((slot) => {
                const assigned = slotAssignments(slot.id);
                const dur = slotDurationHours(slot.startTime, slot.endTime);
                return (
                  <div key={slot.id} className="rounded-xl border border-border/60 p-3">
                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-teal-600" />
                        <span className="text-xs font-bold">{slot.name}</span>
                        <span className="font-mono text-[11px] text-muted-foreground" dir="ltr">{slot.startTime}-{slot.endTime}</span>
                        <Badge variant="outline" className="text-[9px] h-4 px-1">{dur % 1 === 0 ? dur : dur.toFixed(1)} سا</Badge>
                      </div>
                      {assigned.length === 0 && (
                        <button onClick={() => openAssign(slot)} className="text-[10px] font-bold px-2 py-1 rounded-md border border-teal-500/40 text-teal-700 hover:bg-teal-500/10 transition">
                          تعيين عمال لهذه الجلسة
                        </button>
                      )}
                    </div>
                    {assigned.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">لا يوجد عمال معيّنون على هذه الجلسة.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {assigned.map((a) => {
                          const rec = recordFor(a.userId, slot);
                          const busy = pointageBusy === `${a.userId}:${slot.id}`;
                          return (
                            <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border bg-background p-2">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold truncate">{a.user.name}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {ROLE_LABELS[a.user.role] || a.user.role}
                                  {rec && (
                                    <span className="mr-1 text-teal-700 font-semibold">
                                      • مسجّل {formatWallTime(rec.startTime)}-{formatWallTime(rec.endTime)}
                                      {rec.status === "approved" ? " ✓" : " (معلّق)"}
                                    </span>
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  size="sm"
                                  className="h-7 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white"
                                  disabled={busy || Boolean(rec)}
                                  onClick={() => markPointage(a.userId, slot, true)}
                                >
                                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3 ml-0.5" />}
                                  حاضر
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[10px] border-amber-500/40 text-amber-700 hover:bg-amber-500/10"
                                  disabled={busy || Boolean(rec)}
                                  onClick={() => markPointage(a.userId, slot, true, true)}
                                >
                                  <AlertCircle className="h-3 w-3 ml-0.5" />
                                  متأخر
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[10px] border-rose-500/40 text-rose-600 hover:bg-rose-500/10"
                                  disabled={busy || Boolean(rec)}
                                  onClick={() => markPointage(a.userId, slot, false)}
                                >
                                  <UserX className="h-3 w-3 ml-0.5" />
                                  غائب
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <p className="text-[10px] text-muted-foreground">
              «حاضر/متأخر» يُنشئ سجل ساعات عمل لكل جلسة بأوقاتها الحرفية — يغذي حساب الأجور والمركز المالي تلقائياً. «غائب» لا يسجل ساعات.
            </p>
          </div>
        </div>
      )}

      {/* حوار إضافة/تعديل جلسة */}
      <Dialog open={slotDialogOpen} onOpenChange={setSlotDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Waves className="h-5 w-5 text-teal-600" />
              {slotEditing ? "تعديل جلسة" : "إضافة جلسة سباحة"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold">اسم الجلسة (اختياري)</Label>
              <Input
                value={slotForm.name}
                onChange={(e) => setSlotForm({ ...slotForm, name: e.target.value })}
                placeholder="حصة سباحة"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">اليوم</Label>
              <Select value={slotDay} onValueChange={setSlotDay}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">كل الأيام (عامة)</SelectItem>
                  {POOL_DAYS.map((d) => (
                    <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">وقت البداية</Label>
                <Input
                  type="time"
                  dir="ltr"
                  value={slotForm.startTime}
                  onChange={(e) => setSlotForm({ ...slotForm, startTime: e.target.value })}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">وقت النهاية</Label>
                <Input
                  type="time"
                  dir="ltr"
                  value={slotForm.endTime}
                  onChange={(e) => setSlotForm({ ...slotForm, endTime: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              تُحفظ الأوقات كما تُدخل (ساعة الحائط HH:mm) — بدون أي تحويل توقيت. سجلات ساعات العمل القديمة تحتفظ بأوقاتها الأصلية.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSlotDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSlotSave} disabled={slotSaving} className="bg-teal-600 hover:bg-teal-700 text-white">
              {slotSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 ml-1" />}
              {slotEditing ? "حفظ" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حوار تعيين العمال على جلسة */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-teal-600" />
              تعيين العمال — {assignSlot?.name}
              {assignSlot && (
                <span className="font-mono text-xs text-muted-foreground" dir="ltr">
                  {assignSlot.startTime}-{assignSlot.endTime}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 max-h-[55vh] overflow-y-auto">
            {staff.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">لا يوجد عمال — أضف مستخدمين أولاً.</p>
            ) : (
              staff.map((s) => {
                const assigned = assignSlot ? slotAssignments(assignSlot.id).some((a) => a.userId === s.id) : false;
                return (
                  <label
                    key={s.id}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition hover:bg-accent/40",
                      assigned ? "border-teal-500/40 bg-teal-500/5" : "border-border/60"
                    )}
                  >
                    <Checkbox
                      checked={assigned}
                      disabled={assignSaving}
                      onCheckedChange={() => assignSlot && toggleAssign(assignSlot, s.id)}
                      aria-label={`تعيين ${s.name}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">{ROLE_LABELS[s.role] || s.role}</p>
                    </div>
                    {assigned && <Check className="h-4 w-4 text-teal-600 shrink-0" />}
                  </label>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

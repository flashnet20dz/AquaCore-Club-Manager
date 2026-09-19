"use client";

/**
 * pool-schedule.tsx — جدول جلسات استغلال المسبح المتزامن مع الأفواج المزدوجة
 * ══════════════════════════════════════════════════════════════════════════════
 * نظام العمل الحقيقي للمسبح:
 * 1. العمل بالأفواج المزدوجة (الأحد والأربعاء، السبت والثلاثاء، الاثنين والخميس...).
 * 2. التوقيت المشترك الموحد (Shared Timings): الجلسات تُقام بنفس التوقيت تماماً
 *    في كلا اليومين بدون تكرار صفوف مربكة.
 * 3. خياران للعرض:
 *    - عرض البطاقات الزمنية التنفيذية (Visual Period Cards Mode)
 *    - عرض الجدول التنفيذي الموحد (Executive Master Table Mode)
 * 4. Pointage يومي ذكي يتعرف تلقائياً على الفوج المزدوج المجدول لذلك اليوم.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Waves, Clock, Plus, Pencil, Trash2, Users, Loader2, Check, RefreshCw,
  CalendarClock, UserCheck, UserX, AlertCircle, Power, LayoutGrid,
  TableProperties, Sparkles, Filter, Calendar, ShieldCheck, Sun,
  Sunrise, Sunset, Moon, CheckCircle2
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
import { useSwimConfig, invalidateSwimConfig } from "@/hooks/use-swim-config";
import {
  POOL_DAYS, POOL_DAY_LABELS, ALL_DAY_KEYS, dayKeyFromDate, sessionsForDay,
  slotDurationHours, isOperatingDay, getSlotPeriod, DAY_PERIODS, DayPeriodKey,
  findGroupByDayKey, type PoolSlot,
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
  lifeguard: "حارس مسبح",
  observer: "مراقب",
  coach: "مدرب سباحة",
};

export function PoolSchedule({ role }: { role?: string }) {
  const isAdmin = role === "admin" || role === "superadmin";
  const {
    slots: swimSlots,
    activeGroups,
    loading: configLoading,
    refresh: refreshConfig
  } = useSwimConfig();

  // ─── أيام الاستغلال الأسبوعية ───
  const [operatingDays, setOperatingDays] = useState<string[]>([...ALL_DAY_KEYS]);
  const [operatingDaysLoaded, setOperatingDaysLoaded] = useState(false);
  const [savingDayKey, setSavingDayKey] = useState<string | null>(null);

  // ─── التعيينات وطاقم العمل ───
  const [assignments, setAssignments] = useState<SlotAssignment[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [assignSlot, setAssignSlot] = useState<PoolSlot | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);

  // ─── وضع العرض وفلتر الأفواج المزدوجة ───
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // ─── حوار إضافة/تعديل جلسة ───
  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [slotEditing, setSlotEditing] = useState<PoolSlot | null>(null);
  const [slotGroupTarget, setSlotGroupTarget] = useState<string>("general");
  const [slotForm, setSlotForm] = useState({ name: "", startTime: "09:00", endTime: "10:00" });
  const [slotSaving, setSlotSaving] = useState(false);
  const [togglingSlot, setTogglingSlot] = useState<string | null>(null);

  // ─── Pointage يومي ───
  const [pointageDate, setPointageDate] = useState<string>(() => toLocalYMD());
  const [workHours, setWorkHours] = useState<WorkHourLite[]>([]);
  const [whMonth, setWhMonth] = useState<string>(() => toLocalYMD().slice(0, 7));
  const [pointageBusy, setPointageBusy] = useState<string | null>(null);

  // ─── جلب البيانات ───
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
    try {
      const res = await fetch(`/api/workhours?month=${month}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setWorkHours(data.workHours || []);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchAssignments();
    fetchStaff();
  }, [fetchAssignments, fetchStaff]);

  // جلب أيام التشغيل من الإعدادات
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
              setOperatingDays(arr.filter((k): k is string => typeof k === "string"));
            }
          } catch { /* ignore */ }
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setOperatingDaysLoaded(true); });
    return () => { cancelled = true; };
  }, []);

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

  // ─── حفظ أيام الاستغلال ───
  const toggleDay = async (key: string) => {
    if (!isAdmin) return;
    const prev = operatingDays;
    const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
    setOperatingDays(next);
    setSavingDayKey(key);
    try {
      const res = await fetch("/api/swimming-days", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operatingDays: next }),
      });
      if (!res.ok) throw new Error("فشل");
      invalidateSwimConfig();
      toast.success("تم حفظ أيام استغلال المسبح وتحديث النظام");
    } catch {
      setOperatingDays(prev);
      toast.error("تعذر حفظ الأيام");
    } finally {
      setSavingDayKey(null);
    }
  };

  // ─── الحصص المشتركة للأفواج ───
  const activePoolSlots = useMemo(() => {
    return (swimSlots as PoolSlot[]) || [];
  }, [swimSlots]);

  // الفوج المختار حالياً
  const currentSelectedGroup = useMemo(() => {
    if (selectedGroupId === "all") return null;
    return activeGroups.find((g) => g.id === selectedGroupId) || null;
  }, [selectedGroupId, activeGroups]);

  // فلترة الحصص حسب الفوج المزدوج والفترة الزمنية
  const filteredSlots = useMemo(() => {
    let result = [...activePoolSlots];

    // فلتر الفوج المزدوج
    if (currentSelectedGroup) {
      const groupDayKeys = currentSelectedGroup.dayKeys.map((k) => {
        const found = POOL_DAYS.find((d) => d.jsDay === k);
        return found ? found.key : "";
      }).filter(Boolean);

      result = result.filter((slot) => {
        // إذا الحصة مخصصة لفوج محدد
        if (slot.dayOfWeek === currentSelectedGroup.id) return true;
        // إذا الحصة مخصصة لأحد أيام الفوج
        if (slot.dayOfWeek && groupDayKeys.includes(slot.dayOfWeek)) return true;
        // إذا الحصة عامة (بدون تحديد يوم) وكانت تطابق توقيتات الفوج أو الفوج لا يحصر توقيتات
        if (!slot.dayOfWeek) {
          if (!currentSelectedGroup.matchingSlots || currentSelectedGroup.matchingSlots.length === 0) {
            return true;
          }
          const label = `${slot.startTime}-${slot.endTime}`;
          return currentSelectedGroup.matchingSlots.includes(label);
        }
        return false;
      });
    }

    // فلتر الفترة الزمنية
    if (selectedPeriod !== "all") {
      result = result.filter((slot) => getSlotPeriod(slot.startTime) === selectedPeriod);
    }

    // ترتيب الحصص حسب وقت البداية
    return result.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [activePoolSlots, currentSelectedGroup, selectedPeriod]);

  // تعيين العمال لحصة
  const slotAssignments = useCallback((slotId: string) => {
    return assignments.filter((a) => a.slotId === slotId);
  }, [assignments]);

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
        toast.success("تم تعيين الحارس/المدرب على الحصة");
      }
      await fetchAssignments();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل");
    } finally {
      setAssignSaving(false);
    }
  };

  // إضافة وتعديل حصة
  const openSlotAdd = () => {
    setSlotEditing(null);
    setSlotGroupTarget(selectedGroupId === "all" ? "general" : selectedGroupId);
    setSlotForm({ name: "", startTime: "09:00", endTime: "10:00" });
    setSlotDialogOpen(true);
  };

  const openSlotEdit = (s: PoolSlot) => {
    setSlotEditing(s);
    setSlotGroupTarget(s.dayOfWeek || "general");
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
        dayOfWeek: slotGroupTarget === "general" ? null : slotGroupTarget,
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

      toast.success(slotEditing ? "تم تحديث الجلسة بنجاح" : "تمت إضافة الجلسة المزدوجة");
      setSlotDialogOpen(false);
      invalidateSwimConfig();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحفظ");
    } finally {
      setSlotSaving(false);
    }
  };

  const handleSlotDelete = async (id: string) => {
    if (!confirm("تعطيل هذه الجلسة؟ ستبقى السجلات القديمة لساعات العمل محفوظة.")) return;
    try {
      const res = await fetch(`/api/swimming-slots/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("فشل");
      toast.success("تم تعطيل الجلسة بنجاح");
      invalidateSwimConfig();
      fetchAssignments();
    } catch {
      toast.error("فشل التعطيل");
    }
  };

  const handleSlotToggle = async (s: PoolSlot) => {
    setTogglingSlot(s.id);
    try {
      const res = await fetch(`/api/swimming-slots/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !s.active }),
      });
      if (!res.ok) throw new Error();
      toast.success(!s.active ? "تم تفعيل الجلسة" : "تم إيقاف الجلسة مؤقتاً");
      invalidateSwimConfig();
    } catch {
      toast.error("فشل التبديل");
    } finally {
      setTogglingSlot(null);
    }
  };

  // ─── Pointage يومي ذكي ───
  const pointageDayKey = useMemo(() => dayKeyFromDate(pointageDate), [pointageDate]);
  const pointageDayOpen = isOperatingDay(operatingDays, pointageDayKey);
  const pointageMatchedGroup = useMemo(() => {
    return findGroupByDayKey(activeGroups, pointageDayKey);
  }, [activeGroups, pointageDayKey]);

  const daySessions = useMemo(
    () => (isAdmin ? sessionsForDay(swimSlots as PoolSlot[], pointageDayKey) : []),
    [swimSlots, pointageDayKey, isAdmin]
  );

  const recordFor = (userId: string, slot: PoolSlot): WorkHourLite | undefined => {
    return workHours.find((w) => {
      if (w.userId !== userId) return false;
      const d = formatWallDate(w.date);
      if (d !== pointageDate.split("-").reverse().join("/")) return false;
      const start = formatWallTime(w.startTime);
      return start === slot.startTime;
    });
  };

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
        toast.success("تم تخطي التسجيل لهذا الحارس");
      }
      fetchWorkHours(whMonth);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل");
    } finally {
      setPointageBusy(null);
    }
  };

  // ─── إحصائيات سريعة للجدول ───
  const totalWeeklyHours = useMemo(() => {
    const activeDaysCount = POOL_DAYS.filter((d) => isOperatingDay(operatingDays, d.key)).length;
    const dailyHours = filteredSlots
      .filter((s) => s.active)
      .reduce((sum, s) => sum + slotDurationHours(s.startTime, s.endTime), 0);

    if (currentSelectedGroup) {
      const daysCount = currentSelectedGroup.days.filter((dayName) => {
        const dObj = POOL_DAYS.find((d) => d.label === dayName);
        return dObj ? isOperatingDay(operatingDays, dObj.key) : true;
      }).length;
      return dailyHours * Math.max(1, daysCount);
    }
    return dailyHours * (activeDaysCount || 6);
  }, [filteredSlots, currentSelectedGroup, operatingDays]);

  // تصدير البيانات للطباعة والإكسل
  const exportRows = useMemo(() => {
    return filteredSlots.map((s) => {
      const assigned = slotAssignments(s.id);
      const groupName = currentSelectedGroup
        ? currentSelectedGroup.name
        : s.dayOfWeek
        ? POOL_DAY_LABELS[s.dayOfWeek] || s.dayOfWeek
        : "مشتركة لجميع الأفواج";

      return {
        group: groupName,
        session: s.name || `حصة ${s.startTime}`,
        time: `${s.startTime} - ${s.endTime}`,
        duration: `${slotDurationHours(s.startTime, s.endTime)} سا`,
        status: s.active ? "نشطة ومتاحة" : "معطّلة مؤقتاً",
        staff: assigned.map((a) => `${a.user.name} (${ROLE_LABELS[a.user.role] || a.user.role})`).join("، ") || "بدون تعيين",
      };
    });
  }, [filteredSlots, currentSelectedGroup, slotAssignments]);

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* 1. ترويسة الصفحة الاحترافية مع بطاقات المؤشرات السريعة */}
      <div className="relative overflow-hidden rounded-3xl border border-teal-500/30 bg-gradient-to-br from-card via-card to-teal-500/5 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 shadow-inner">
              <Waves className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                  جدول جلسات السباحة والأفواج المزدوجة
                </h1>
                <Badge className="bg-teal-600 text-white text-xs px-2.5 py-0.5">
                  توقيت مشترك موحد
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                تنظيم حصص السباحة بنظام <strong>الأيام المزدوجة المشتركة</strong> كما يعمل المسبح عملياً. كل جلسة تطبق تلقائياً على اليومين المزدوجين بنفس التوقيت وتتزامن مع استمارة التسجيل والحضور.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start lg:self-auto">
            {isAdmin && (
              <Button
                size="sm"
                onClick={openSlotAdd}
                className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5 shadow-sm font-bold text-xs"
              >
                <Plus className="h-4 w-4" />
                إضافة جلسة مشتركة
              </Button>
            )}

            <ExportButton
              rows={exportRows}
              filename={`جدول-جلسات-المسبح-${toLocalYMD()}`}
              title="جدول جلسات السباحة بتوقيت موحد"
              formats={["excel", "pdf", "print", "csv"]}
              columns={[
                { key: "group", label: "الفوج المزدوج" },
                { key: "session", label: "الجلسة" },
                { key: "time", label: "التوقيت المشترك" },
                { key: "duration", label: "المدة" },
                { key: "status", label: "الحالة" },
                { key: "staff", label: "طاقم الحراسة والتدريب" },
              ]}
            />

            {/* أزرار التبديل بين وضع البطاقات والجدول */}
            <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border/80">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  viewMode === "cards"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="عرض البطاقات حسب الفترات"
              >
                <LayoutGrid className="h-3.5 w-3.5 text-teal-600" />
                <span className="hidden sm:inline">بطاقات زمنية</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  viewMode === "table"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="عرض الجدول الموحد"
              >
                <TableProperties className="h-3.5 w-3.5 text-teal-600" />
                <span className="hidden sm:inline">جدول تنفيذي</span>
              </button>
            </div>

            <Button
              size="icon"
              variant="outline"
              onClick={() => {
                refreshConfig(true);
                fetchAssignments();
                fetchStaff();
                toast.success("تم تحديث الجدول");
              }}
              className="h-9 w-9 rounded-xl shrink-0"
              title="تحديث البيانات"
            >
              <RefreshCw className={cn("h-4 w-4 text-teal-600", configLoading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* كروت المؤشرات الأربعة السريعة */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-5 border-t border-border/60">
          <div className="p-3.5 rounded-2xl bg-card/60 border border-border/60 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center shrink-0">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">الأفواج المزدوجة المتاحة</p>
              <p className="text-lg font-black text-foreground">{activeGroups.length} <span className="text-xs font-normal text-muted-foreground">أفواج نشطة</span></p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-card/60 border border-border/60 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">الجلسات المبرمجة</p>
              <p className="text-lg font-black text-foreground">{filteredSlots.length} <span className="text-xs font-normal text-muted-foreground">جلسة مشتركة</span></p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-card/60 border border-border/60 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">ساعات الاستغلال الأسبوعية</p>
              <p className="text-lg font-black text-foreground">{totalWeeklyHours.toFixed(0)} <span className="text-xs font-normal text-muted-foreground">ساعة / أسبوع</span></p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-card/60 border border-border/60 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">طاقم الحراسة والمدربين</p>
              <p className="text-lg font-black text-foreground">{staff.length} <span className="text-xs font-normal text-muted-foreground">أعضاء طاقم</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. شريط اختيار الأفواج المزدوجة حسب الاختيار (الميزة المطلوبة) */}
      <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Label className="text-xs font-bold text-foreground flex items-center gap-2">
            <Filter className="h-4 w-4 text-teal-600" />
            <span>اختر الفوج المزدوج لعرض جلساته بتوقيت مشترك:</span>
          </Label>
          <span className="text-[11px] text-muted-foreground">
            كل فوج يجمع يومين بتوقيتات حصص موحدة
          </span>
        </div>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="أفواج السباحة المزدوجة">
          <button
            type="button"
            onClick={() => setSelectedGroupId("all")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all shadow-sm",
              selectedGroupId === "all"
                ? "bg-teal-600 text-white border-teal-600 shadow-teal-600/20"
                : "bg-background text-foreground border-border hover:bg-muted"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>كل الأفواج المشتركة</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-1">
              {activePoolSlots.length}
            </Badge>
          </button>

          {activeGroups.map((group) => {
            const isSelected = selectedGroupId === group.id;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setSelectedGroupId(group.id)}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all shadow-sm",
                  isSelected
                    ? "bg-teal-600 text-white border-teal-600 shadow-teal-600/20"
                    : "bg-background text-foreground border-border hover:border-teal-500/40 hover:bg-muted/40"
                )}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: group.color || "#0d9488" }}
                />
                <span>فوج {group.name}</span>
                <span className="text-[10px] opacity-80 px-1 py-0.5 rounded bg-black/10">
                  {group.days.join(" + ")}
                </span>
              </button>
            );
          })}
        </div>

        {/* بطاقة الفوج المختار (Spotlight Banner) */}
        {currentSelectedGroup ? (
          <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-2">
            <div className="flex items-center gap-3">
              <div
                className="h-9 w-9 rounded-xl text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm"
                style={{ backgroundColor: currentSelectedGroup.color || "#0d9488" }}
              >
                {currentSelectedGroup.shortName || "فوج"}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-foreground">
                    فوج {currentSelectedGroup.name} (توقيت موحد مشترك)
                  </h3>
                  <div className="flex items-center gap-1">
                    {currentSelectedGroup.days.map((dayName) => {
                      const dObj = POOL_DAYS.find((d) => d.label === dayName);
                      const isDayOpen = dObj ? isOperatingDay(operatingDays, dObj.key) : true;
                      return (
                        <Badge
                          key={dayName}
                          variant="outline"
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5",
                            isDayOpen
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                              : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30"
                          )}
                        >
                          {dayName}: {isDayOpen ? "مفتوح" : "مغلق"}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  جميع الحصص المدرجة أدناه تعمل في نفس الساعات المشتركة تماماً لكل من <strong>{currentSelectedGroup.days.join(" و ")}</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-teal-800 dark:text-teal-300 bg-card px-3 py-1.5 rounded-xl border border-teal-500/20 self-start sm:self-auto shrink-0">
              <Clock className="h-3.5 w-3.5 text-teal-600" />
              <span>{filteredSlots.length} جلسات مشتركة</span>
            </div>
          </div>
        ) : (
          /* شريط أيام الاستغلال الأسبوعية العامة */
          <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-border/60">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-3.5 w-3.5 text-teal-600" />
              <span className="text-xs font-semibold text-muted-foreground">أيام تشغيل المسبح المعتمدة في النادي:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {POOL_DAYS.map((d) => {
                const on = isOperatingDay(operatingDays, d.key);
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => toggleDay(d.key)}
                    disabled={!isAdmin || !operatingDaysLoaded || savingDayKey !== null}
                    className={cn(
                      "px-2.5 py-0.5 rounded-lg text-[11px] font-bold border transition-all",
                      on
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                        : "bg-muted/40 text-muted-foreground border-transparent opacity-60 line-through"
                    )}
                    title={on ? "مفتوح (انقر للتعطيل)" : "مغلق (انقر للتفعيل)"}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. فلتر الفترات اليومية (صباحية / ظهيرة / مسائية / ليلية) */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          <button
            type="button"
            onClick={() => setSelectedPeriod("all")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shrink-0",
              selectedPeriod === "all"
                ? "bg-teal-600 text-white border-teal-600"
                : "bg-card text-muted-foreground border-border hover:bg-muted"
            )}
          >
            كل الفترات ({filteredSlots.length})
          </button>
          {(Object.keys(DAY_PERIODS) as DayPeriodKey[]).map((pKey) => {
            const period = DAY_PERIODS[pKey];
            const count = filteredSlots.filter((s) => getSlotPeriod(s.startTime) === pKey).length;
            const isSelected = selectedPeriod === pKey;
            return (
              <button
                key={pKey}
                type="button"
                onClick={() => setSelectedPeriod(pKey)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 shrink-0",
                  isSelected
                    ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                    : "bg-card text-foreground border-border hover:bg-muted"
                )}
              >
                {pKey === "morning" && <Sunrise className="h-3.5 w-3.5 text-amber-500" />}
                {pKey === "midday" && <Sun className="h-3.5 w-3.5 text-sky-500" />}
                {pKey === "evening" && <Sunset className="h-3.5 w-3.5 text-teal-500" />}
                {pKey === "night" && <Moon className="h-3.5 w-3.5 text-indigo-500" />}
                <span>{period.label}</span>
                <span className="text-[10px] opacity-70 font-mono">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="text-xs text-muted-foreground">
          عرض <strong className="text-foreground">{filteredSlots.length}</strong> جلسة مشتركة
        </div>
      </div>

      {/* 4. محتوى الجلسات: بطاقات زمنية أو جدول تنفيذي */}
      {filteredSlots.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/80 p-12 text-center bg-card/50">
          <Clock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="text-base font-bold text-foreground">لا توجد جلسات سباحة مطابقة لهذا الفلتر</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {isAdmin ? "يمكنك إضافة جلسة سباحة جديدة وتعيينها لهذا الفوج المزدوج من الزر أدناه." : "لم يقم مدير النادي بإضافة جلسات لهذا الفوج بعد."}
          </p>
          {isAdmin && (
            <Button size="sm" onClick={openSlotAdd} className="mt-4 bg-teal-600 hover:bg-teal-700 text-white gap-1 text-xs">
              <Plus className="h-4 w-4" /> إضافة أول جلسة
            </Button>
          )}
        </div>
      ) : viewMode === "cards" ? (
        /* ─── وضع البطاقات الزمنية التنفيذية ─── */
        <div className="space-y-6">
          {(["morning", "midday", "evening", "night"] as DayPeriodKey[]).map((pKey) => {
            const periodInfo = DAY_PERIODS[pKey];
            const slotsInPeriod = filteredSlots.filter((s) => getSlotPeriod(s.startTime) === pKey);
            if (slotsInPeriod.length === 0) return null;

            return (
              <div key={pKey} className="space-y-3">
                {/* ترويسة الفترة */}
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn("p-1.5 rounded-lg border", periodInfo.badgeColor)}>
                      {pKey === "morning" && <Sunrise className="h-4 w-4" />}
                      {pKey === "midday" && <Sun className="h-4 w-4" />}
                      {pKey === "evening" && <Sunset className="h-4 w-4" />}
                      {pKey === "night" && <Moon className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-foreground">{periodInfo.label}</h3>
                        <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-4">
                          {periodInfo.range}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{periodInfo.sublabel}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground">
                    {slotsInPeriod.length} جلسات
                  </span>
                </div>

                {/* شبكة بطاقات الحصص في هذه الفترة */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {slotsInPeriod.map((slot) => {
                    const assigned = slotAssignments(slot.id);
                    const dur = slotDurationHours(slot.startTime, slot.endTime);
                    const isToggling = togglingSlot === slot.id;

                    return (
                      <motion.div
                        key={slot.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "rounded-2xl border bg-card p-4 transition-all hover:shadow-md flex flex-col justify-between gap-3 relative overflow-hidden",
                          slot.active ? "border-border/80" : "border-border/40 opacity-60 bg-muted/20"
                        )}
                      >
                        {/* خط علوي ملون للحالة */}
                        <div
                          className={cn(
                            "absolute top-0 right-0 left-0 h-1",
                            slot.active ? "bg-teal-500" : "bg-muted"
                          )}
                        />

                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-mono text-lg font-black text-teal-700 dark:text-teal-400 tracking-tight" dir="ltr">
                                {slot.startTime} - {slot.endTime}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Badge variant="secondary" className="text-[10px] font-semibold h-4 px-1.5">
                                  {dur % 1 === 0 ? dur : dur.toFixed(1)} سا
                                </Badge>
                                {slot.dayOfWeek ? (
                                  <Badge variant="outline" className="text-[10px] px-1.5 h-4 text-teal-700 border-teal-500/30">
                                    {POOL_DAY_LABELS[slot.dayOfWeek] || slot.dayOfWeek}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] px-1.5 h-4 bg-teal-500/5 text-teal-600 border-teal-500/20">
                                    مشتركة لكل الأفواج
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleSlotToggle(slot)}
                              disabled={isToggling || !isAdmin}
                              className={cn(
                                "p-1.5 rounded-xl border transition-all text-xs font-bold",
                                slot.active
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
                                  : "border-border bg-muted text-muted-foreground hover:bg-muted/80"
                              )}
                              title={slot.active ? "انقر للإيقاف المؤقت" : "انقر للتفعيل"}
                            >
                              {isToggling ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Power className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>

                          <h4 className="font-bold text-sm text-foreground mt-2">
                            {slot.name || `حصة ${slot.startTime}`}
                          </h4>

                          {/* بيان الأيام المزدوجة المشتركة */}
                          <div className="mt-2 p-2 rounded-xl bg-muted/40 border border-border/50 text-[11px] text-muted-foreground flex items-center justify-between">
                            <span>الأيام المطبقة:</span>
                            <span className="font-bold text-foreground">
                              {currentSelectedGroup ? currentSelectedGroup.days.join(" و ") : "تطبق على اليومين المزدوجين للفوج"}
                            </span>
                          </div>

                          {/* طاقم الحراسة المعين */}
                          <div className="mt-2.5">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                                <Users className="h-3 w-3 text-teal-600" />
                                طاقم الحراسة والتدريب:
                              </span>
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => openAssign(slot)}
                                  className="text-[10px] font-bold text-teal-600 hover:underline"
                                >
                                  {assigned.length > 0 ? "تعديل الطاقم" : "+ تعيين"}
                                </button>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-1 min-h-[26px]">
                              {assigned.length === 0 ? (
                                <span className="text-[11px] text-muted-foreground italic">لم يعيّن أي حارس بعد</span>
                              ) : (
                                assigned.map((a) => (
                                  <Badge
                                    key={a.id}
                                    variant="secondary"
                                    className="text-[10px] h-5 gap-1 bg-teal-500/10 text-teal-800 dark:text-teal-200 border border-teal-500/20"
                                  >
                                    <CheckCircle2 className="h-2.5 w-2.5 text-teal-600" />
                                    <span>{a.user.name}</span>
                                    <span className="text-[9px] text-muted-foreground">({ROLE_LABELS[a.user.role] || a.user.role})</span>
                                  </Badge>
                                ))
                              )}
                            </div>
                          </div>
                        </div>

                        {/* أزرار الإجراءات السفلية */}
                        {isAdmin && (
                          <div className="flex items-center justify-end gap-1 pt-2 border-t border-border/50">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openSlotEdit(slot)}
                              className="h-7 px-2 text-xs font-semibold text-teal-700 hover:bg-teal-500/10 gap-1"
                            >
                              <Pencil className="h-3 w-3" />
                              تعديل
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSlotDelete(slot.id)}
                              className="h-7 px-2 text-xs font-semibold text-rose-600 hover:bg-rose-500/10 gap-1"
                            >
                              <Trash2 className="h-3 w-3" />
                              تعطيل
                            </Button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ─── وضع الجدول التنفيذي الموحد ─── */
        <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead>
                <tr className="bg-muted/60 text-muted-foreground border-b border-border/70 font-bold">
                  <th className="p-3 text-right">الفوج واليومان المشتركان</th>
                  <th className="p-3 text-right">الجلسة والفترة</th>
                  <th className="p-3 text-center">التوقيت المشترك</th>
                  <th className="p-3 text-center">المدة</th>
                  <th className="p-3 text-center">الحالة</th>
                  <th className="p-3 text-right">طاقم الحراسة المعيّن</th>
                  {isAdmin && <th className="p-3 text-center">الإجراءات</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredSlots.map((slot) => {
                  const assigned = slotAssignments(slot.id);
                  const dur = slotDurationHours(slot.startTime, slot.endTime);
                  const period = DAY_PERIODS[getSlotPeriod(slot.startTime)];

                  return (
                    <tr
                      key={slot.id}
                      className={cn(
                        "hover:bg-muted/30 transition-colors",
                        !slot.active && "opacity-60 bg-muted/10"
                      )}
                    >
                      {/* الفوج واليومان المشتركان */}
                      <td className="p-3 font-semibold">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-teal-500 shrink-0" />
                          <div>
                            <p className="font-bold text-foreground">
                              {currentSelectedGroup ? `فوج ${currentSelectedGroup.name}` : slot.dayOfWeek ? POOL_DAY_LABELS[slot.dayOfWeek] || slot.dayOfWeek : "مشتركة لجميع الأفواج"}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {currentSelectedGroup ? currentSelectedGroup.days.join(" + ") : "توقيت موحد لكلا اليومين"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* اسم الجلسة والفترة */}
                      <td className="p-3">
                        <p className="font-bold text-foreground">{slot.name || `حصة ${slot.startTime}`}</p>
                        <span className="text-[10px] text-muted-foreground">{period.label}</span>
                      </td>

                      {/* التوقيت المشترك */}
                      <td className="p-3 text-center font-mono font-bold text-teal-700 dark:text-teal-400 text-sm" dir="ltr">
                        {slot.startTime} - {slot.endTime}
                      </td>

                      {/* المدة */}
                      <td className="p-3 text-center font-bold">
                        {dur % 1 === 0 ? dur : dur.toFixed(1)} سا
                      </td>

                      {/* الحالة */}
                      <td className="p-3 text-center">
                        {slot.active ? (
                          <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px]">
                            نشطة
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-[10px]">
                            معطّلة
                          </Badge>
                        )}
                      </td>

                      {/* طاقم الحراسة */}
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {assigned.length === 0 ? (
                            <span className="text-[11px] text-muted-foreground italic">بدون تعيين</span>
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

                      {/* الإجراءات */}
                      {isAdmin && (
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => openAssign(slot)}
                              className="p-1.5 rounded-lg hover:bg-teal-500/10 text-teal-600"
                              title="تعيين عمال"
                            >
                              <Users className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSlotToggle(slot)}
                              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                              title={slot.active ? "تعطيل" : "تفعيل"}
                            >
                              <Power className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openSlotEdit(slot)}
                              className="p-1.5 rounded-lg hover:bg-teal-500/10 text-teal-700"
                              title="تعديل"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSlotDelete(slot.id)}
                              className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500"
                              title="حذف"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. تسجيل الحضور اليومي الذكي (Pointage) — متزامن مع الأفواج المزدوجة */}
      {isAdmin && (
        <div className="rounded-3xl border border-amber-500/30 bg-card overflow-hidden shadow-sm">
          <div className="p-5 border-b border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-transparent to-transparent flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">
                  Pointage — تسجيل حضور العمال والمنقذين حسب جلسات اليوم
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  يتعرف النظام تلقائياً على الفوج المزدوج المجدول لتاريخ اليوم ويعرض جلساته المعتمدة
                </p>
              </div>
            </div>

            {/* محدد التاريخ مع إظهار الفوج المتطابق */}
            <div className="flex items-center gap-2 bg-card p-1.5 rounded-2xl border border-border/80">
              <Input
                type="date"
                value={pointageDate}
                onChange={(e) => setPointageDate(e.target.value)}
                className="h-8 w-[150px] text-xs font-mono font-bold"
              />
              {pointageMatchedGroup && (
                <Badge
                  className="text-[11px] font-bold py-1 px-2 text-white"
                  style={{ backgroundColor: pointageMatchedGroup.color || "#0d9488" }}
                >
                  فوج {pointageMatchedGroup.name}
                </Badge>
              )}
            </div>
          </div>

          <div className="p-5 space-y-4">
            {!pointageDayOpen ? (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-700 dark:text-rose-300 font-bold text-center">
                🔒 المسبح مغلق في يوم {POOL_DAY_LABELS[pointageDayKey || ""] || pointageDayKey} حسب جدول أيام التشغيل المعتمدة.
              </div>
            ) : daySessions.length === 0 ? (
              <div className="rounded-2xl bg-muted/40 p-6 text-center text-xs text-muted-foreground">
                لا توجد جلسات سباحة مفعّلة لهذا اليوم.
              </div>
            ) : (
              daySessions.map((slot) => {
                const assigned = slotAssignments(slot.id);
                const dur = slotDurationHours(slot.startTime, slot.endTime);

                return (
                  <div key={slot.id} className="rounded-2xl border border-border/70 p-4 bg-muted/10 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-teal-600" />
                        <span className="font-bold text-sm text-foreground">{slot.name || `حصة ${slot.startTime}`}</span>
                        <span className="font-mono text-xs font-bold text-teal-700 dark:text-teal-400" dir="ltr">
                          {slot.startTime} - {slot.endTime}
                        </span>
                        <Badge variant="outline" className="text-[10px] font-semibold h-4 px-1.5">
                          {dur % 1 === 0 ? dur : dur.toFixed(1)} سا
                        </Badge>
                      </div>

                      {assigned.length === 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openAssign(slot)}
                          className="text-[11px] h-7 text-teal-700 hover:bg-teal-500/10"
                        >
                          + تعيين عمال لهذه الجلسة
                        </Button>
                      )}
                    </div>

                    {assigned.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">لا يوجد عمال أو منقذين مسندين لهذه الجلسة بعد.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {assigned.map((a) => {
                          const rec = recordFor(a.userId, slot);
                          const busy = pointageBusy === `${a.userId}:${slot.id}`;

                          return (
                            <div
                              key={a.id}
                              className={cn(
                                "flex items-center justify-between gap-2 rounded-xl border p-2.5 transition-all",
                                rec
                                  ? "border-emerald-500/40 bg-emerald-500/5 shadow-sm"
                                  : "border-border/70 bg-card"
                              )}
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-bold truncate text-foreground">{a.user.name}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {ROLE_LABELS[a.user.role] || a.user.role}
                                  {rec && (
                                    <span className="mr-1 text-emerald-600 dark:text-emerald-400 font-bold">
                                      • مسجّل ({formatWallTime(rec.startTime)}-{formatWallTime(rec.endTime)}) ✓
                                    </span>
                                  )}
                                </p>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  size="sm"
                                  className="h-7 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                  disabled={busy || Boolean(rec)}
                                  onClick={() => markPointage(a.userId, slot, true)}
                                >
                                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3 ml-0.5" />}
                                  حاضر
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 font-bold"
                                  disabled={busy || Boolean(rec)}
                                  onClick={() => markPointage(a.userId, slot, true, true)}
                                >
                                  <AlertCircle className="h-3 w-3 ml-0.5" />
                                  متأخر
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[10px] border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 font-bold"
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
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              * تسجيل الحضور هنا ينشئ فوراً سجل ساعات عمل رسمي معتمد يغذي حساب أجور العمال والمركز المالي بدون أي إدخال يدوي مكرر.
            </p>
          </div>
        </div>
      )}

      {/* حوار إضافة / تعديل جلسة سباحة مشتركة */}
      <Dialog open={slotDialogOpen} onOpenChange={setSlotDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Waves className="h-5 w-5 text-teal-600" />
              <span>{slotEditing ? "تعديل جلسة سباحة" : "إضافة جلسة سباحة مشتركة"}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-bold">اسم الجلسة (اختياري)</Label>
              <Input
                value={slotForm.name}
                onChange={(e) => setSlotForm({ ...slotForm, name: e.target.value })}
                placeholder="مثال: حصة الصباح 1"
                className="h-9 text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-bold">الفوج المزدوج المخصص (توقيت مشترك)</Label>
              <Select value={slotGroupTarget} onValueChange={setSlotGroupTarget}>
                <SelectTrigger className="h-9 text-xs mt-1 font-semibold">
                  <SelectValue placeholder="اختر الفوج" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="general">عامة لجميع الأفواج المزدوجة (توقيت موحد)</SelectItem>
                  {activeGroups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      فوج {g.name} ({g.days.join(" + ")})
                    </SelectItem>
                  ))}
                  {POOL_DAYS.map((d) => (
                    <SelectItem key={d.key} value={d.key}>
                      يوم {d.label} فقط
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">
                عند اختيار فوج مزدوج، ستُطبق هذه الجلسة في كلا اليومين بنفس التوقيت الموحد.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">وقت البداية</Label>
                <Input
                  type="time"
                  dir="ltr"
                  value={slotForm.startTime}
                  onChange={(e) => setSlotForm({ ...slotForm, startTime: e.target.value })}
                  className="h-9 font-mono text-center font-bold text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-bold">وقت النهاية</Label>
                <Input
                  type="time"
                  dir="ltr"
                  value={slotForm.endTime}
                  onChange={(e) => setSlotForm({ ...slotForm, endTime: e.target.value })}
                  className="h-9 font-mono text-center font-bold text-xs mt-1"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-xs text-teal-800 dark:text-teal-200">
              ⏱️ مدة الجلسة المحسوبة: <strong>{slotDurationHours(slotForm.startTime, slotForm.endTime)} ساعة</strong>. تُحفظ الأوقات بدقة وتتزامن فورياً مع نموذج تسجيل المنخرط والنقاط.
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-start">
            <Button variant="outline" onClick={() => setSlotDialogOpen(false)} className="text-xs">
              إلغاء
            </Button>
            <Button
              onClick={handleSlotSave}
              disabled={slotSaving}
              className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold gap-1"
            >
              {slotSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {slotEditing ? "حفظ التعديلات" : "إضافة الجلسة المشتركة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حوار تعيين العمال والمنقذين */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-teal-600" />
              <span>تعيين طاقم الحراسة والتدريب</span>
            </DialogTitle>
            {assignSlot && (
              <p className="text-xs text-muted-foreground mt-1">
                الجلسة: <strong className="text-foreground">{assignSlot.name || "حصة سباحة"}</strong> ({assignSlot.startTime} - {assignSlot.endTime})
              </p>
            )}
          </DialogHeader>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto py-2">
            {staff.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                لا يوجد مستخدمين أو عمال مسجلين في النظام.
              </p>
            ) : (
              staff.map((s) => {
                const isAssigned = assignSlot
                  ? slotAssignments(assignSlot.id).some((a) => a.userId === s.id)
                  : false;

                return (
                  <label
                    key={s.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all",
                      isAssigned
                        ? "border-teal-500/40 bg-teal-500/10 shadow-sm"
                        : "border-border/70 hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isAssigned}
                        disabled={assignSaving}
                        onCheckedChange={() => assignSlot && toggleAssign(assignSlot, s.id)}
                      />
                      <div>
                        <p className="text-xs font-bold text-foreground">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground">{ROLE_LABELS[s.role] || s.role} • {s.email}</p>
                      </div>
                    </div>

                    {isAssigned && (
                      <Badge className="bg-teal-600 text-white text-[10px] px-2 py-0.5">
                        معيّن
                      </Badge>
                    )}
                  </label>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)} className="text-xs">
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

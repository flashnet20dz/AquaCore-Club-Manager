"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Clock, Plus, Search, Download, Printer, RefreshCw, Users, CheckCircle2,
  XCircle, Calendar, Wallet, TrendingUp, FileText, Loader2, ChevronLeft, ChevronRight,
  User, Trash2, Check, X, Settings2, DollarSign, Save, Waves, CalendarClock, Pencil,
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatWallTime, formatWallDate, toLocalYMD } from "@/lib/wall-clock";
import { ExportButton } from "@/components/shared/export-button";
import { WagesSection } from "@/components/wages/wages-section";
import { useSwimConfig, invalidateSwimConfig, type SwimSlotOption } from "@/hooks/use-swim-config";
import {
  POOL_DAYS, POOL_DAY_LABELS, ALL_DAY_KEYS, dayKeyFromDate, slotDurationHours,
} from "@/lib/pool-schedule";

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
  rejectionReason?: string | null;
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

// ★ ملخص الخادم: يُحسب في GET /api/workhours بفلتر DB صريح
//   status notIn (rejected, cancelled) — القاعدة الموحّدة:
//   الملغى/المرفوض لا يدخل في أي حساب تشغيلي (يبقى للعرض والتدقيق فقط)
interface SummaryRow {
  userId: string;
  presentDays: number;
  absentDays: number;
  totalHours: number;
  overtime: number;
  totalWage: number;
}
interface MonthSummary {
  rule: string;
  perUser: SummaryRow[];
  totals: {
    totalHours: number;
    overtime: number;
    totalWage: number;
    presentDays: number;
    absentDays: number;
  };
}

// ★ القاعدة الموحّدة: السجل النشط (pending/approved) يدخل في الحسابات —
//   الملغى/المرفوض لا يدخل إطلاقاً (مطابق لفلتر الخادم — نفس الدلالة في المكانين)
const isActiveRecord = (w: { status: string }) => w.status !== "cancelled" && w.status !== "rejected";

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

// ★ المرحلة 5 (§9): دورة حياة السجل — مسودة → اعتماد/رفض/إلغاء
const APPROVAL_LABELS: Record<string, string> = {
  pending: "مسودة (بانتظار الاعتماد)",
  approved: "موافق عليه",
  rejected: "مرفوض",
  cancelled: "ملغى",
};

// ═════════ ★ أيام وساعات استغلال المسبح ═════════
// ★ المصدر الموحّد: POOL_DAYS / dayKeyFromDate / slotDurationHours من
//   src/lib/pool-schedule.ts — نفس المصدر المستخدم في جدول المسبح والنقاط.

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
  // ★ التواريخ مخزّنة wall-clock UTC — تُقرأ بمكوّنات UTC (بلا انحراف)
  return formatWallDate(d);
}

function formatTime(d: string | Date): string {
  // ★ الأوقات مخزّنة wall-clock UTC — تُقرأ بمكوّنات UTC (جذر إصلاح +1h)
  return formatWallTime(d);
}

export function WorkHoursManagement({ role }: { role?: string }) {
  // ★ دور المستخدم يُمرَّر من page.tsx (sessionUser.role) — قسم المسبح للمدير فقط
  const isAdmin = role === "admin" || role === "superadmin";
  const [workHours, setWorkHours] = useState<WorkHour[]>([]);
  const [monthSummary, setMonthSummary] = useState<MonthSummary | null>(null);
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
  /** إشارة إعادة حساب أجور العمال بعد أي تغيير في ساعات النقاط */
  const [wagesRefresh, setWagesRefresh] = useState(0);
  // ★ المرحلة 5 (§10): اعتماد/رفض عدة سجلات دفعة واحدة
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState("");

  // ═══ ★ المسبح: حصص السباحة (مصدر موحّد عبر useSwimConfig) + أيام الاستغلال ═══
  const { slots: swimSlots } = useSwimConfig();
  const [operatingDays, setOperatingDays] = useState<string[]>([...ALL_DAY_KEYS]); // افتراضي عند غياب المفتاح: كل الأيام
  const [operatingDaysLoaded, setOperatingDaysLoaded] = useState(false);
  const [savingDayKey, setSavingDayKey] = useState<string | null>(null);
  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [slotEditing, setSlotEditing] = useState<SwimSlotOption | null>(null);
  const [slotDay, setSlotDay] = useState<string>("general");
  const [slotForm, setSlotForm] = useState({ name: "", startTime: "09:00", endTime: "10:00" });
  const [slotSaving, setSlotSaving] = useState(false);
  // ★ منتقي الحصص المتعدد في نموذج «إضافة سجل» — عدة حصص للعامل في نفس اليوم بسجل واحد
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);

  // Form state
  const [form, setForm] = useState({
    targetUserId: "",
    date: toLocalYMD(),
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
        setMonthSummary(data.summary || null);
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

  // ★ تحميل أيام استغلال المسبح من الإعدادات (للمدير) — غياب المفتاح = كل الأيام مفعّلة
  useEffect(() => {
    if (!isAdmin) return;
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
  }, [isAdmin]);

  // ★ إعادة ضبط منتقي الحصص عند تغيير التاريخ (حصص اليوم تتبدل)
  useEffect(() => {
    setSelectedSlotIds([]);
  }, [form.date]);

  // Stats
  const stats = useMemo(() => {
    const today = toLocalYMD();
    // ★ الملغى/المرفوض لا يحسب حاضراً/غائباً اليوم (سجل لغاء = سجل معدوم تشغيلياً)
    const todayRecords = workHours.filter(
      (w) => isActiveRecord(w) && new Date(w.date).toISOString().split("T")[0] === today
    );
    const presentToday = todayRecords.filter((w) => w.workStatus === "present").length;
    const absentToday = todayRecords.filter((w) => w.workStatus === "absent").length;
    // ★ الماليات من ملخص الخادم (محسوب بفلتر DB — الملغى/المرفوض مستثنى من الاستعلام)
    //   والاحتياط (استجابة قديمة بلا ملخص) بنفس القاعدة يدوياً — نفس الدلالة
    const fbHours = workHours
      .filter((w) => isActiveRecord(w) && w.workStatus === "present")
      .reduce((sum, w) => sum + calcWorkHours(w.startTime, w.endTime, w.breakMinutes), 0);
    const fbWages = workHours
      .filter((w) => isActiveRecord(w) && w.workStatus === "present" && w.user.hourlyRate > 0)
      .reduce((sum, w) => sum + calcWorkHours(w.startTime, w.endTime, w.breakMinutes) * w.user.hourlyRate, 0);
    const fbOvertime = workHours
      .filter((w) => isActiveRecord(w) && w.workStatus === "present")
      .reduce((sum, w) => {
        const hours = calcWorkHours(w.startTime, w.endTime, w.breakMinutes);
        return sum + Math.max(0, hours - 8);
      }, 0);

    return {
      totalStaff: staff.length,
      presentToday,
      absentToday,
      totalHoursMonth: Math.round(monthSummary?.totals.totalHours ?? fbHours),
      totalWages: Math.round(monthSummary?.totals.totalWage ?? fbWages),
      overtimeHours: Math.round(monthSummary?.totals.overtime ?? fbOvertime),
      absentDays: monthSummary?.totals.absentDays ?? workHours.filter((w) => isActiveRecord(w) && w.workStatus === "absent").length,
    };
  }, [workHours, staff, monthSummary]);

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
    const withSessions = !isAbsence && selectedSlots.length > 0;
    setSaving(true);
    try {
      if (withSessions) {
        // ★ تسجيل متعدد الحصص بطلب واحد ذرّي — /api/workhours/bulk
        // الحصص من إعدادات المسبح (المصدر الموحّد)؛ الخادم يمنع التكرار ويسجّل لقطة كل حصة
        try {
          const res = await fetch("/api/workhours/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: form.targetUserId,
              date: form.date,
              slotIds: selectedSlots.map((s) => s.id),
              breakMinutes: form.breakMinutes,
              note: form.note ? form.note.trim() : undefined,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || "فشل التسجيل");
          const skippedCount = Array.isArray(data.skipped) ? data.skipped.length : 0;
          if (data.created > 0) {
            toast.success(
              `تم تسجيل ${data.created} حصة${skippedCount > 0 ? ` — تجاهل ${skippedCount} مكررة` : ""} (${Number(data.totalHours || selectedSlotsTotalHours).toFixed(1).replace(/\.0$/, "")} ساعة)`
            );
            setWagesRefresh((n) => n + 1);
            setDialogOpen(false);
            setSelectedSlotIds([]);
            setForm({
              targetUserId: "",
              date: toLocalYMD(),
              startTime: "08:00",
              endTime: "17:00",
              breakMinutes: 0,
              workStatus: "present",
              absenceReason: "",
              note: "",
            });
            fetchWorkHours();
          } else {
            toast.error(data.message || "كل الحصص المختارة مسجّلة مسبقاً لنفس العامل في نفس اليوم");
          }
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "فشل التسجيل");
        }
      } else {
        const res = await fetch("/api/workhours", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast.success("تم تسجيل ساعات العمل");
        setWagesRefresh((n) => n + 1);
        setDialogOpen(false);
        setForm({
          targetUserId: "",
          date: toLocalYMD(),
          startTime: "08:00",
          endTime: "17:00",
          breakMinutes: 0,
          workStatus: "present",
          absenceReason: "",
          note: "",
        });
        fetchWorkHours();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (id: string, status: "approved" | "rejected" | "cancelled", reason?: string) => {
    try {
      const res = await fetch(`/api/workhours/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "فشل");
      toast.success(
        status === "approved" ? "تم اعتماد السجل" : status === "rejected" ? "تم رفض السجل" : "تم إلغاء السجل — يبقى في السجل بوضع ملغى"
      );
      fetchWorkHours();
      setWagesRefresh((n) => n + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    try {
      const res = await fetch(`/api/workhours/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("فشل");
      toast.success("تم الحذف");
      fetchWorkHours();
      setWagesRefresh((n) => n + 1);
    } catch {
      toast.error("فشل");
    }
  };

  // ═══ ★ المرحلة 5 (§10): اعتماد/رفض جماعي ═══
  const toggleSelectAll = () => {
    const approvable = filtered.filter((w) => w.status === "pending").map((w) => w.id);
    setSelectedIds((prev) => (prev.length === approvable.length && prev.length > 0 ? [] : approvable));
  };

  const bulkApprove = async () => {
    if (selectedIds.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/workhours/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, action: "approved" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "فشل الاعتماد");
      toast.success(`تم اعتماد ${json.updated} سجل${json.skipped?.length ? ` — تُسطِر ${json.skipped.length}` : ""}`);
      setSelectedIds([]);
      fetchWorkHours();
      setWagesRefresh((n) => n + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الاعتماد");
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkReject = async () => {
    if (selectedIds.length === 0 || bulkRejectReason.trim().length < 3) {
      toast.error("سبب الرفض إلزامي (3 أحرف على الأقل)");
      return;
    }
    setBulkBusy(true);
    try {
      const res = await fetch("/api/workhours/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, action: "rejected", reason: bulkRejectReason.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "فشل الرفض");
      toast.success(`تم رفض ${json.updated} سجل — السبب محفوظ في التدقيق`);
      setBulkRejectOpen(false);
      setBulkRejectReason("");
      setSelectedIds([]);
      fetchWorkHours();
      setWagesRefresh((n) => n + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الرفض");
    } finally {
      setBulkBusy(false);
    }
  };

  // ═══ ★ المسبح: حفظ الأيام + حصص السباحة ═══

  /** تبديل يوم استغلال — حفظ فوري في Setting بمفتاح poolOperatingDays (JSON array) */
  const toggleDay = async (key: string) => {
    const prev = operatingDays;
    const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
    setOperatingDays(next); // تفاؤلي — رجوع عند الفشل
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

  const openSlotAdd = (dayKey: string) => {
    setSlotEditing(null);
    setSlotDay(dayKey);
    setSlotForm({ name: "", startTime: "09:00", endTime: "10:00" });
    setSlotDialogOpen(true);
  };

  const openSlotEdit = (s: SwimSlotOption) => {
    setSlotEditing(s);
    setSlotDay(s.dayOfWeek || "general");
    setSlotForm({ name: s.name, startTime: s.startTime, endTime: s.endTime });
    setSlotDialogOpen(true);
  };

  /** إضافة/تعديل حصة — الأوقات نصوص "HH:mm" حرفية (بلا أي تحويل توقيت) */
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
      if (name) payload.name = name; // فارغ → الخادم يستخدم الافتراضي «حصة سباحة»
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
      toast.success(slotEditing ? "تم تحديث الحصة" : "تمت إضافة الحصة");
      setSlotDialogOpen(false);
      invalidateSwimConfig(); // إعادة جلب فورية هنا وفي كل المكوّنات (نموذج المنخرط، الانتظار…)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحفظ");
    } finally {
      setSlotSaving(false);
    }
  };

  const handleSlotDelete = async (id: string) => {
    if (!confirm("تعطيل هذه الحصة؟ ستُخفى من منتقي الحصص في نموذج النقاط لكن السجل يبقى محفوظاً مع تاريخ ساعات العمل.")) return;
    try {
      const res = await fetch(`/api/swimming-slots/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("فشل");
      toast.success("تم تعطيل الحصة — السجل محفوظ");
      invalidateSwimConfig();
    } catch {
      toast.error("فشل التعطيل");
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
  // ★ المصدر الوحيد: ملخص الخادم (GET /api/workhours?month=) — محسوب بفلتر DB
  //   status notIn(rejected, cancelled): إلغاء سجل يُسقطه من الإجمالي فوراً
  //   14س/5600 دج → إلغاء 1س/400 → 13س/5200 دج (السجل الملغى يبقى معروضاً بالأعلى)
  const staffSummary = useMemo(() => {
    return staff.map((s) => {
      const row = monthSummary?.perUser.find((x) => x.userId === s.id);
      if (row) {
        return {
          ...s,
          totalHours: row.totalHours,
          overtime: row.overtime,
          totalWage: row.totalWage,
          presentDays: row.presentDays,
          absentDays: row.absentDays,
        };
      }
      // احتياط (استجابة قديمة بلا ملخص) — نفس قاعدة الخادم يدوياً
      const records = workHours.filter(
        (w) => w.userId === s.id && isActiveRecord(w) && w.workStatus === "present"
      );
      const totalHours = records.reduce((sum, w) => sum + calcWorkHours(w.startTime, w.endTime, w.breakMinutes), 0);
      const overtime = records.reduce((sum, w) => {
        const h = calcWorkHours(w.startTime, w.endTime, w.breakMinutes);
        return sum + Math.max(0, h - 8);
      }, 0);
      const totalWage = totalHours * (s.hourlyRate || 0);
      const presentDays = records.length;
      const absentDays = workHours.filter(
        (w) => w.userId === s.id && isActiveRecord(w) && w.workStatus === "absent"
      ).length;
      return {
        ...s,
        totalHours: Math.round(totalHours * 10) / 10,
        overtime: Math.round(overtime * 10) / 10,
        totalWage: Math.round(totalWage),
        presentDays,
        absentDays,
      };
    });
  }, [staff, workHours, monthSummary]);

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

  // ★ حصص اليوم المختار في نموذج النقاط (حصص dayOfWeek=المفتاح + العامة dayOfWeek=null)
  const formDayKey = useMemo(() => dayKeyFromDate(form.date), [form.date]);
  const formDayOpen = !operatingDaysLoaded || operatingDays.length === 0 || operatingDays.includes(formDayKey || "");
  const pointageSlots = useMemo(() => {
    if (!formDayKey || !formDayOpen) return [];
    return swimSlots
      .filter((s) => s.active && (s.dayOfWeek === formDayKey || !s.dayOfWeek))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [swimSlots, formDayKey, formDayOpen]);

  const toggleSlot = (id: string) => {
    setSelectedSlotIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const selectAllSlots = () => setSelectedSlotIds(pointageSlots.map((s) => s.id));
  const clearSelectedSlots = () => setSelectedSlotIds([]);

  /** الحصص المختارة مرتبة زمنياً */
  const selectedSlots = useMemo(
    () =>
      selectedSlotIds
        .map((id) => pointageSlots.find((s) => s.id === id))
        .filter((s): s is SwimSlotOption => Boolean(s))
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [selectedSlotIds, pointageSlots]
  );

  /** إجمالي ساعات الحصص المختارة (مع خصم الاستراحة لكل حصة) */
  const selectedSlotsTotalHours = useMemo(
    () => selectedSlots.reduce((sum, s) => sum + Math.max(0, slotDurationHours(s.startTime, s.endTime) - (form.breakMinutes || 0) / 60), 0),
    [selectedSlots, form.breakMinutes]
  );

  // ★ مجموعات عرض حصص المسبح: مجموعة عامة + يوم لكل يوم من الأيام السبعة
  const poolGroups: Array<{ key: string; label: string; general?: boolean }> = [
    { key: "general", label: "حصص عامة — تظهر كل الأيام", general: true },
    ...POOL_DAYS.map((d) => ({ key: d.key, label: d.label })),
  ];

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
            <Button size="sm" onClick={() => { setSelectedSlotIds([]); setDialogOpen(true); }} className="bg-teal-600 hover:bg-teal-700 text-white">
              <Plus className="h-4 w-4 ml-1" /> إضافة سجل
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRateDialogOpen(true)} className="border-amber-400 text-amber-700 hover:bg-amber-50">
              <DollarSign className="h-4 w-4 ml-1" /> أسعار الساعة
            </Button>
            <Button size="sm" variant="outline" onClick={fetchWorkHours}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            <ExportButton
              rows={filtered}
              filename={`ساعات-العمل-${currentMonth}`}
              title="سجل ساعات عمل العمال"
              formats={["excel", "csv", "pdf", "print"]}
              disabled={loading}
              columns={[
                { key: "name", label: "العامل", format: (w) => w.user.name },
                { key: "position", label: "الوظيفة", format: (w) => w.user.position || w.user.role },
                { key: "date", label: "التاريخ", format: (w) => formatDate(w.date) },
                { key: "in", label: "الدخول", format: (w) => (w.workStatus === "present" ? formatTime(w.startTime) : "—") },
                { key: "out", label: "الخروج", format: (w) => (w.workStatus === "present" ? formatTime(w.endTime) : "—") },
                { key: "brk", label: "استراحة (د)", format: (w) => (w.breakMinutes > 0 ? String(w.breakMinutes) : "—") },
                { key: "hours", label: "الساعات", format: (w) => (w.workStatus === "present" ? calcWorkHours(w.startTime, w.endTime, w.breakMinutes).toFixed(1) : "—") },
                { key: "state", label: "الحالة", format: (w) => (STATUS_LABELS[w.workStatus] || w.workStatus) },
                { key: "approval", label: "الاعتماد", format: (w) => (APPROVAL_LABELS[w.status] || w.status) },
                { key: "note", label: "ملاحظات", format: (w) => (w.note || "") },
              ]}
            />
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

      {/* ★ المرحلة 5 (§10): شريط الاعتماد الجماعي */}
      {isAdmin && selectedIds.length > 0 && (
        <div className="rounded-2xl border border-teal-500/40 bg-teal-500/5 p-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-teal-600" />
            <span className="font-semibold">تم تحديد {selectedIds.length} سجل (مسودة) للاعتماد الجماعي</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={bulkApprove} disabled={bulkBusy} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Check className="h-4 w-4 ml-1" /> اعتماد المحدد
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkRejectOpen(true)} disabled={bulkBusy} className="border-rose-400 text-rose-700 hover:bg-rose-50">
              <X className="h-4 w-4 ml-1" /> رفض المحدد
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])} disabled={bulkBusy}>
              إلغاء التحديد
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 text-foreground border-b-2 border-primary/20">
                {isAdmin && (
                  <th className="p-2 text-center w-8">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-teal-600"
                      checked={selectedIds.length > 0 && selectedIds.length === filtered.filter((w) => w.status === "pending").length}
                      onChange={toggleSelectAll}
                      aria-label="تحديد كل المسودات"
                      title="تحديد كل السجلات بانتظار الاعتماد"
                    />
                  </th>
                )}
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
                <tr><td colSpan={isAdmin ? 13 : 12} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={isAdmin ? 13 : 12} className="text-center py-12 text-muted-foreground">لا توجد سجلات</td></tr>
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
                      className={cn("border-b border-border/40 transition hover:bg-muted/40")}
                    >
                      {isAdmin && (
                        <td className="p-2 text-center">
                          {w.status === "pending" && (
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 accent-teal-600"
                              checked={selectedIds.includes(w.id)}
                              onChange={(e) =>
                                setSelectedIds((prev) => (e.target.checked ? [...prev, w.id] : prev.filter((x) => x !== w.id)))
                              }
                              aria-label={`تحديد سجل ${w.user.name}`}
                            />
                          )}
                        </td>
                      )}
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
                          <Badge
                            variant="outline"
                            className="text-[9px] bg-rose-500/10 text-rose-700 border-rose-500/30"
                            title={w.rejectionReason || undefined}
                          >
                            <X className="h-2.5 w-2.5 ml-0.5" /> مرفوض
                          </Badge>
                        ) : w.status === "cancelled" ? (
                          <Badge
                            variant="outline"
                            className="text-[9px] bg-zinc-500/10 text-zinc-600 border-zinc-500/30"
                            title={w.rejectionReason || undefined}
                          >
                            ملغى
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-700 border-amber-500/30">
                            مسودة
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
                              <button onClick={() => handleApprove(w.id, "rejected", prompt("سبب الرفض (إلزامي):") || "")} className="p-1 rounded hover:bg-rose-50 text-rose-600" title="رفض بسبب">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          {(w.status === "approved" || w.status === "rejected") && (
                            <button
                              onClick={() => handleApprove(w.id, "cancelled", prompt("سبب إلغاء السجل (إلزامي):") || "")}
                              className="p-1 rounded hover:bg-zinc-100 text-zinc-600"
                              title="إلغاء ناعم — يبقى في السجل بوضع ملغى"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {w.status === "pending" && (
                            <button onClick={() => handleDelete(w.id)} className="p-1 rounded hover:bg-rose-50 text-rose-600" title="حذف المسودة">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
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
              <>
                {/* ★ منتقي الحصص المتعدد — من المصدر الموحّد (إعدادات المسبح) حسب يوم التاريخ */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <Label className="text-xs font-semibold">الحصص — اختيار متعدد</Label>
                    {pointageSlots.length > 0 && (
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={selectAllSlots} className="text-[10px] font-bold px-2 py-1 rounded-md border border-teal-500/40 text-teal-700 hover:bg-teal-500/10 transition">
                          تحديد الكل
                        </button>
                        <button type="button" onClick={clearSelectedSlots} disabled={selectedSlotIds.length === 0} className="text-[10px] font-bold px-2 py-1 rounded-md border border-border text-muted-foreground hover:bg-muted transition disabled:opacity-40">
                          إلغاء التحديد
                        </button>
                      </div>
                    )}
                  </div>

                  {!formDayOpen ? (
                    <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-2.5 text-xs text-rose-600 font-semibold text-center">
                      🔒 المسبح مغلق في يوم {POOL_DAY_LABELS[formDayKey || ""] || formDayKey} حسب إعدادات أيام الاستغلال — سجّل الحضور كإدخال يدوي أو غيّر الإعدادات.
                    </div>
                  ) : pointageSlots.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg p-2">
                      لا توجد حصص مفعّلة ليوم {POOL_DAY_LABELS[formDayKey || ""] || formDayKey} — استخدم الإدخال اليدوي بالأسفل أو أضف حصصاً من قسم إعدادات المسبح.
                    </p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {pointageSlots.map((s) => {
                          const picked = selectedSlotIds.includes(s.id);
                          const dur = slotDurationHours(s.startTime, s.endTime);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => toggleSlot(s.id)}
                              aria-pressed={picked}
                              className={cn(
                                "text-right rounded-xl border-2 p-2 transition-all select-none min-h-[52px]",
                                picked
                                  ? "border-teal-500 bg-teal-500/10 shadow-sm"
                                  : "border-border bg-background hover:border-teal-500/40 hover:bg-muted/30"
                              )}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className={cn(
                                  "w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0",
                                  picked ? "bg-teal-600 border-teal-600" : "border-muted-foreground/40"
                                )}>
                                  {picked && <Check className="h-3 w-3 text-white" />}
                                </span>
                                <span className={cn("text-[11px] font-bold truncate", picked ? "text-teal-800" : "text-foreground")}>
                                  {s.name}{!s.dayOfWeek ? " (عامة)" : ""}
                                </span>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-0.5 pr-5 tabular-nums">
                                {s.startTime} - {s.endTime} • {dur % 1 === 0 ? dur : dur.toFixed(1)} سا
                              </p>
                            </button>
                          );
                        })}
                      </div>

                      {/* إجماليات الحصص المختارة */}
                      {selectedSlots.length > 0 && (
                        <div className="mt-2 rounded-lg bg-teal-500/5 border border-teal-500/25 p-2 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            عدد الحصص: <span className="font-extrabold text-teal-700">{selectedSlots.length}</span>
                          </span>
                          <span className="text-muted-foreground">
                            إجمالي ساعات العمل:{" "}
                            <span className="font-extrabold text-teal-700">
                              {selectedSlotsTotalHours % 1 === 0 ? selectedSlotsTotalHours : selectedSlotsTotalHours.toFixed(1)} ساعة
                            </span>
                          </span>
                          {(() => {
                            const st = staff.find((x) => x.id === form.targetUserId);
                            if (!st || !st.hourlyRate) return null;
                            return (
                              <span className="text-muted-foreground">
                                الأجر: <span className="font-extrabold text-amber-600">{Math.round(selectedSlotsTotalHours * st.hourlyRate).toLocaleString()} دج</span>
                              </span>
                            );
                          })()}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* الإدخال اليدوي — يظهر فقط بلا حصص مختارة */}
                {selectedSlots.length === 0 && (
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
              </>
            )}

            {/* سبب الغياب */}
            {isAbsence && (
              <div>
                <Label className="text-xs font-semibold">سبب الغياب</Label>
                <Input value={form.absenceReason} onChange={(e) => setForm({ ...form, absenceReason: e.target.value })} placeholder="مثال: مرض، عطلة..." className="h-9" />
              </div>
            )}

            {/* معاينة الساعات — للإدخال اليدوي فقط (للحصص تظهر الإجماليات أعلاه) */}
            {!isAbsence && selectedSlots.length === 0 && (
              <div className="rounded-lg bg-teal-500/5 border border-teal-500/20 p-2 text-xs">
                <span className="text-muted-foreground">ساعات العمل: </span>
                <span className="font-bold text-teal-700">
                  {calcWorkHours(
                    `${form.date}T${form.startTime}Z`,
                    `${form.date}T${form.endTime}Z`,
                    form.breakMinutes
                  ).toFixed(1)} ساعة
                </span>
                {(() => {
                  const selectedStaff = staff.find((s) => s.id === form.targetUserId);
                  if (!selectedStaff || !selectedStaff.hourlyRate) return null;
                  const hours = calcWorkHours(`${form.date}T${form.startTime}Z`, `${form.date}T${form.endTime}Z`, form.breakMinutes);
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
              {selectedSlots.length > 0 ? `تسجيل ${selectedSlots.length} حصة` : "تسجيل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🔑 جدول ملخص ساعات العمل والراتب */}
      <div className="rounded-2xl border border-amber-500/30 bg-card overflow-hidden">
        <div className="p-4 border-b border-amber-500/20">
          <h3 className="font-bold text-sm flex items-center gap-2 text-foreground">
            <Wallet className="h-4 w-4 text-amber-600" /> ملخص ساعات العمل والراتب — {monthName}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 text-foreground border-b-2 border-amber-500/20">
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
                  <tr key={s.id} className={cn("border-b border-border/40 transition hover:bg-muted/40")}>
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
                <tr className="bg-muted/60 font-bold text-foreground border-t-2 border-amber-500/20">
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

      {/* ═══ ★ أيام وساعات استغلال المسبح — للمدير فقط (admin/superadmin) ═══ */}
      {isAdmin && (
        <div className="rounded-2xl border border-teal-500/30 bg-card overflow-hidden">
          <div className="p-4 border-b border-teal-500/20 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Waves className="h-4 w-4 text-teal-600" />
              <h3 className="font-bold text-sm text-foreground">أيام وساعات استغلال المسبح</h3>
            </div>
            <Badge variant="outline" className="text-[10px] bg-teal-500/10 text-teal-700 border-teal-500/30">
              {swimSlots.filter((s) => s.active).length} حصة
            </Badge>
          </div>
          <div className="p-4 space-y-4">
            <p className="text-[11px] text-muted-foreground">
              حدّد أيام فتح المسبح وحصص السباحة لكل يوم — تُستخدم تلقائياً لملء أوقات النقاط عند اختيار التاريخ في نموذج «إضافة سجل».
            </p>

            {/* أ. أيام العمل الأسبوعية — تُحفظ في Setting: poolOperatingDays */}
            <div>
              <Label className="text-xs font-semibold">أيام العمل الأسبوعية</Label>
              <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label="أيام العمل الأسبوعية">
                {POOL_DAYS.map((d) => {
                  const on = operatingDays.includes(d.key);
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => toggleDay(d.key)}
                      disabled={!operatingDaysLoaded || savingDayKey !== null}
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

            {/* ب. حصص السباحة لكل يوم — إضافة/تعديل/حذف */}
            <div className="space-y-2">
              {poolGroups.map((g) => {
                const groupSlots = swimSlots.filter((s) => (g.general ? !s.dayOfWeek : s.dayOfWeek === g.key));
                const dayEnabled = g.general || operatingDays.includes(g.key);
                return (
                  <div key={g.key} className={cn("rounded-xl border p-3", dayEnabled ? "border-border/60" : "border-dashed border-border/40")}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {g.general ? (
                          <CalendarClock className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                        ) : (
                          <Clock className={cn("h-3.5 w-3.5 shrink-0", dayEnabled ? "text-teal-600" : "text-muted-foreground")} />
                        )}
                        <span className={cn("text-xs font-bold truncate", !dayEnabled && "text-muted-foreground")}>{g.label}</span>
                        {!g.general && !dayEnabled && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0 text-muted-foreground">مغلق</Badge>
                        )}
                        <Badge variant="secondary" className="text-[9px] h-4 px-1.5 shrink-0">{groupSlots.length}</Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[11px] text-teal-700 hover:bg-teal-500/10 shrink-0"
                        onClick={() => openSlotAdd(g.key)}
                      >
                        <Plus className="h-3 w-3 ml-0.5" /> إضافة حصة
                      </Button>
                    </div>
                    {groupSlots.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground/80 py-0.5">لا توجد حصص بعد.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {groupSlots.map((s) => (
                          <div key={s.id} className="flex items-center gap-1 rounded-lg border bg-muted/30 pr-2 pl-1 py-1">
                            <span className="text-[11px] font-semibold max-w-[150px] truncate">{s.name}</span>
                            <span className="font-mono text-[10px] text-muted-foreground" dir="ltr">{s.startTime}–{s.endTime}</span>
                            <button onClick={() => openSlotEdit(s)} aria-label={`تعديل ${s.name}`} title="تعديل" className="p-1 rounded hover:bg-accent text-teal-700">
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button onClick={() => handleSlotDelete(s.id)} aria-label={`حذف ${s.name}`} title="حذف" className="p-1 rounded hover:bg-rose-500/10 text-rose-500">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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

      {/* ★ حوار إضافة/تعديل حصة سباحة — الأوقات نصوص "HH:mm" حرفية */}
      <Dialog open={slotDialogOpen} onOpenChange={setSlotDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Waves className="h-5 w-5 text-teal-600" />
              {slotEditing ? "تعديل حصة سباحة" : "إضافة حصة سباحة"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold">اسم الفئة/الفوج (اختياري)</Label>
              <Input
                value={slotForm.name}
                onChange={(e) => setSlotForm({ ...slotForm, name: e.target.value })}
                placeholder="حصة سباحة"
                className="h-9"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">اتركه فارغاً لاستخدام الافتراضي «حصة سباحة».</p>
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
              تُحفظ الأوقات كما تُدخل (ساعة الحائط) — بدون تحويل توقيت — وتظهر لاحقاً في نموذج النقاط حسب اليوم.
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

      {/* ★ المرحلة 5 (§10): حوار سبب الرفض الجماعي */}
      <Dialog open={bulkRejectOpen} onOpenChange={setBulkRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <X className="h-4 w-4 text-rose-600" /> رفض {selectedIds.length} سجل — السبب إلزامي
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">سبب الرفض *</Label>
            <Textarea
              value={bulkRejectReason}
              onChange={(e) => setBulkRejectReason(e.target.value)}
              rows={3}
              className="text-xs"
              placeholder="مثال: تسجيل خاطئ للوقت / لم يحضر الحصة..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setBulkRejectOpen(false)}>إلغاء</Button>
            <Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white" onClick={bulkReject} disabled={bulkBusy}>
              {bulkBusy && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              تأكيد الرفض
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ★ قسم أجور العمال — منفصل تماماً عن جدول Pointage
          الحساب من ساعات العمل الفعلية المسجلة، والتسديد يُنشئ قيداً مالياً واحداً
          مشتركاً مع المركز المالي (بلا ازدواج) */}
      <WagesSection refreshSignal={wagesRefresh} />
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

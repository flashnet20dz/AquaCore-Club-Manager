"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Calendar, Plus, Pencil, Trash2, RefreshCw, Loader2, Check,
  Clock, Waves, Layers, ShieldCheck, AlertCircle, X, Wrench, CalendarDays
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  WEEK_DAYS_MAP,
  DEFAULT_SWIMMING_GROUPS,
  type SwimmingDayGroup,
} from "@/lib/swimming-groups";
import { seedSwimConfigCache } from "@/hooks/use-swim-config";

interface SwimDay {
  id: string;
  name: string;
  shortName: string;
  color: string;
  active: boolean;
  sortOrder: number;
}

interface SwimSlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  active: boolean;
  sortOrder: number;
}

const PRESET_COLORS = [
  "#0d9488", // Teal
  "#0284c7", // Sky
  "#8b5cf6", // Violet
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Rose
  "#6366f1", // Indigo
  "#ec4899", // Pink
];

/** أقرب تاريخ قادم ليوم أسبوعي معين (0=الأحد … 6=السبت) بصيغة YYYY-MM-DD محلية */
function nextOccurrenceOf(dayKey: number): string {
  const today = new Date();
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = (dayKey - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function SwimmingScheduleHub() {
  const [loading, setLoading] = useState(true);
  const [savingDays, setSavingDays] = useState(false);
  const [days, setDays] = useState<SwimDay[]>([]);
  const [operatingDays, setOperatingDays] = useState<string[]>(["0", "1", "2", "3", "4", "5"]);
  const [groups, setGroups] = useState<SwimmingDayGroup[]>(DEFAULT_SWIMMING_GROUPS);
  const [slots, setSlots] = useState<SwimSlot[]>([]);

  // Dialog State for Paired Group
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SwimmingDayGroup | null>(null);

  // ═══ نافذة إغلاق يوم محدد للصيانة (بتاريخ) — المدير يختار اليوم/الفوج المتأثر ═══
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [maintenanceDate, setMaintenanceDate] = useState("");
  const [maintenanceScope, setMaintenanceScope] = useState<string>("all");
  const [maintenanceReason, setMaintenanceReason] = useState("صيانة المسبح");
  const [maintenanceExtend, setMaintenanceExtend] = useState(true);
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);

  const [groupForm, setGroupForm] = useState<{
    name: string;
    shortName: string;
    color: string;
    selectedDayKeys: number[];
    matchingSlots: string[];
    active: boolean;
  }>({
    name: "",
    shortName: "",
    color: "#0d9488",
    selectedDayKeys: [0, 3], // الأحد والأربعاء
    matchingSlots: [],
    active: true,
  });

  // Fetch all config
  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [daysRes, slotsRes] = await Promise.all([
        fetch("/api/swimming-days").catch(() => null),
        fetch("/api/swimming-slots").catch(() => null),
      ]);
      if (daysRes?.ok) {
        const data = await daysRes.json();
        if (data.days) setDays(data.days);
        if (Array.isArray(data.operatingDays)) {
          setOperatingDays(data.operatingDays);
          lastSavedDaysRef.current = data.operatingDays;
        }
        if (Array.isArray(data.groups)) setGroups(data.groups);
      }
      if (slotsRes?.ok) {
        const sData = await slotsRes.json();
        if (sData.slots) setSlots(sData.slots);
      }
    } catch {
      toast.error("تعذر تحميل إعدادات السباحة");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // 1. تبديل أيام تشغيل المسبح (السبعة) — ⚡ استجابة فورية مع حفظ مؤجل مجمّع
  //    - التبديل يظهر لحظياً في الواجهة (optimistic) ولا يُقفل بقية الأزرار
  //    - النقرات السريعة تُجمَّع: يُحفظ آخر حالة فقط بعد 450ms من آخر نقرة
  //    - الحفظ الناجح يبذّر الكاش فوراً لكل الشاشات المفتوحة بلا إعادة جلب شبكية
  const lastSavedDaysRef = useRef<string[] | null>(null);
  const saveDaysTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistOperatingDays = useCallback(async (next: string[]) => {
    try {
      const res = await fetch("/api/swimming-days", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operatingDays: next }),
      });
      if (!res.ok) throw new Error("فشل");
      lastSavedDaysRef.current = next;
      seedSwimConfigCache({ operatingDays: next });
      toast.success("تم حفظ أيام تشغيل المسبح", { id: "op-days-save" });
    } catch {
      // استعادة آخر حالة محفوظة فعلاً
      const revert = lastSavedDaysRef.current;
      if (revert) {
        setOperatingDays(revert);
        seedSwimConfigCache({ operatingDays: revert });
      } else {
        fetchAll();
      }
      toast.error("تعذر حفظ أيام التشغيل — تمت استعادة الحالة السابقة");
    } finally {
      setSavingDays(false);
    }
  }, [fetchAll]);

  const toggleOperatingDay = (key: number) => {
    const keyStr = String(key);
    const next = operatingDays.includes(keyStr)
      ? operatingDays.filter((k) => k !== keyStr)
      : [...operatingDays, keyStr];

    // انعكاس فوري في الواجهة — بلا انتظار الشبكة
    setOperatingDays(next);
    setSavingDays(true);

    if (saveDaysTimer.current) clearTimeout(saveDaysTimer.current);
    saveDaysTimer.current = setTimeout(() => {
      void persistOperatingDays(next);
    }, 450);
  };

  // 2. إدارة وتعديل الأفواج المزدوجة
  const openAddGroup = () => {
    setEditingGroup(null);
    setGroupForm({
      name: "الأحد والأربعاء",
      shortName: "أح+أر",
      color: "#0d9488",
      selectedDayKeys: [0, 3],
      matchingSlots: [],
      active: true,
    });
    setGroupDialogOpen(true);
  };

  const openEditGroup = (g: SwimmingDayGroup) => {
    setEditingGroup(g);
    setGroupForm({
      name: g.name,
      shortName: g.shortName || "",
      color: g.color || "#0d9488",
      selectedDayKeys: g.dayKeys || [0, 3],
      matchingSlots: g.matchingSlots || [],
      active: g.active,
    });
    setGroupDialogOpen(true);
  };

  const handleDaySelectInModal = (key: number) => {
    const prev = groupForm.selectedDayKeys;
    const exists = prev.includes(key);
    let next: number[];
    if (exists) {
      if (prev.length === 1) return; // لا تترك الفوج فارغاً
      next = prev.filter((k) => k !== key);
    } else {
      next = [...prev, key].sort((a, b) => a - b);
    }

    // توليد الاسم التلقائي بناء على الأيام المختارة
    const dayNames = next.map((k) => WEEK_DAYS_MAP.find((w) => w.key === k)?.name || "");
    const autoName = dayNames.join(" و");
    const autoShort = next.map((k) => WEEK_DAYS_MAP.find((w) => w.key === k)?.short || "").join("+");

    setGroupForm((f) => ({
      ...f,
      selectedDayKeys: next,
      name: autoName || f.name,
      shortName: autoShort || f.shortName,
    }));
  };

  const handleSaveGroup = async () => {
    if (!groupForm.name.trim()) {
      toast.error("يرجى إدخال اسم الفوج");
      return;
    }
    if (groupForm.selectedDayKeys.length === 0) {
      toast.error("اختر يوماً واحداً على الأقل للفوج");
      return;
    }

    const dayNames = groupForm.selectedDayKeys.map(
      (k) => WEEK_DAYS_MAP.find((w) => w.key === k)?.name || ""
    );

    let updated: SwimmingDayGroup[];
    if (editingGroup) {
      updated = groups.map((g) =>
        g.id === editingGroup.id
          ? {
              ...g,
              name: groupForm.name.trim(),
              shortName: groupForm.shortName.trim(),
              color: groupForm.color,
              days: dayNames,
              dayKeys: groupForm.selectedDayKeys,
              matchingSlots: groupForm.matchingSlots,
              active: groupForm.active,
            }
          : g
      );
    } else {
      const newGroup: SwimmingDayGroup = {
        id: `group-${Date.now()}`,
        name: groupForm.name.trim(),
        shortName: groupForm.shortName.trim(),
        color: groupForm.color,
        days: dayNames,
        dayKeys: groupForm.selectedDayKeys,
        matchingSlots: groupForm.matchingSlots,
        active: groupForm.active,
        sortOrder: groups.length,
        isCustom: true,
      };
      updated = [...groups, newGroup];
    }

    setGroups(updated);
    try {
      const res = await fetch("/api/swimming-days", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups: updated }),
      });
      if (!res.ok) throw new Error("فشل");
      toast.success(editingGroup ? "تم تحديث الفوج بنجاح" : "تمت إضافة الفوج المزدوج الجديد");
      setGroupDialogOpen(false);
      seedSwimConfigCache({ groups: updated });
    } catch {
      toast.error("تعذر حفظ الفوج");
      fetchAll();
    }
  };

  const toggleGroupActive = async (id: string, active: boolean) => {
    const updated = groups.map((g) => (g.id === id ? { ...g, active } : g));
    setGroups(updated);
    try {
      await fetch("/api/swimming-days", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups: updated }),
      });
      toast.success(active ? "تم تفعيل الفوج في التسجيل" : "تم تعطيل الفوج من التسجيل");
      seedSwimConfigCache({ groups: updated });
    } catch {
      toast.error("تعذر تحديث الفوج");
      fetchAll();
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الفوج المزدوج؟")) return;
    const updated = groups.filter((g) => g.id !== id);
    setGroups(updated);
    try {
      await fetch("/api/swimming-days", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups: updated }),
      });
      toast.success("تم حذف الفوج بنجاح");
      seedSwimConfigCache({ groups: updated });
    } catch {
      toast.error("تعذر الحذف");
      fetchAll();
    }
  };

  const handleRestoreDefaults = async () => {
    if (!confirm("استعادة الأفواج وأيام التشغيل الافتراضية؟")) return;
    try {
      const res = await fetch("/api/swimming-days", { method: "PUT" });
      if (!res.ok) throw new Error("فشل");
      const data = await res.json().catch(() => null);
      toast.success("تمت استعادة الأفواج وأيام التشغيل الافتراضية");
      if (Array.isArray(data?.groups)) seedSwimConfigCache({ groups: data.groups });
      if (Array.isArray(data?.operatingDays)) seedSwimConfigCache({ operatingDays: data.operatingDays });
      fetchAll();
    } catch {
      toast.error("تعذرت الاستعادة");
    }
  };

  const activeSlotLabels = useMemo(() => {
    return slots
      .filter((s) => s.active)
      .map((s) => (s.name && s.name.includes("-") ? s.name : `${s.startTime}-${s.endTime}`));
  }, [slots]);

  // ═══ فتح نافذة إغلاق يوم للصيانة مع تاريخ محدد مسبقاً ═══
  const openMaintenanceDialog = (prefillDate?: string) => {
    // التاريخ الافتراضي: اليوم بتوقيت محلي (YYYY-MM-DD)
    const today = new Date();
    const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    setMaintenanceDate(prefillDate || ymd);
    setMaintenanceScope("all");
    setMaintenanceReason("صيانة المسبح");
    setMaintenanceExtend(true);
    setMaintenanceOpen(true);
  };

  // ═══ تسجيل إغلاق يوم الصيانة عبر نظام pool-closures (تعويضات + إشعارات آلية) ═══
  const handleMaintenanceSubmit = async () => {
    if (!maintenanceDate) {
      toast.error("يرجى تحديد تاريخ الإغلاق");
      return;
    }
    if (!maintenanceReason.trim()) {
      toast.error("يرجى إدخال سبب الإغلاق");
      return;
    }
    setMaintenanceBusy(true);
    try {
      const res = await fetch("/api/pool-closures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: maintenanceDate,
          reason: maintenanceReason.trim(),
          // النطاق: فوج مزدوج محدد بالاسم أو كل المنخرطين
          swimmingDays: maintenanceScope === "all" ? undefined : maintenanceScope,
          createCompensations: true,
          extendSubscriptionDays: maintenanceExtend,
          unexpiredOnly: true,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "تعذر تسجيل إغلاق الصيانة");
        return;
      }
      const scopeLabel = maintenanceScope === "all" ? "كل الأفواج" : maintenanceScope;
      toast.success(
        `تم تسجيل إغلاق المسبح بتاريخ ${maintenanceDate} — النطاق: ${scopeLabel} (${data?.affectedCount ?? 0} منخرط متأثر)`,
        { duration: 6000 }
      );
      setMaintenanceOpen(false);
    } catch {
      toast.error("تعذر الاتصال بالخادم");
    } finally {
      setMaintenanceBusy(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* ═══ 1. الترويسة الرئيسية ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl border border-teal-500/30 bg-gradient-to-l from-teal-500/10 via-card to-card">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-teal-500/15 text-teal-600 flex items-center justify-center shrink-0">
            <Waves className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-foreground">مركز تشغيل المسبح والأفواج المزدوجة</h3>
              <Badge variant="outline" className="bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/30 text-xs">
                متزامن لحظياً
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              المصدر الموحد لأيام فتح المسبح، وأفواج الأيام المزدوجة (مثال: السبت والثلاثاء)، ومزامنتها فوراً مع نموذج التسجيل.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRestoreDefaults}
            className="text-xs gap-1.5 h-9"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            استعادة الافتراضي
          </Button>
          <Button
            size="sm"
            onClick={openAddGroup}
            className="text-xs gap-1.5 h-9 bg-teal-600 hover:bg-teal-700 text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            إضافة فوج مزدوج جديد
          </Button>
        </div>
      </div>

      {/* ═══ 2. أيام فتح وتشغيل المسبح الأسبوعية ═══ */}
      <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-teal-600" />
            <h4 className="font-bold text-sm">أيام فتح وتشغيل المسبح الأسبوعية (7 أيام)</h4>
            {savingDays && (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-semibold">
                <Loader2 className="h-3 w-3 animate-spin" /> جاري الحفظ…
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-muted-foreground">
              {operatingDays.length} أيام مفتوحة • {7 - operatingDays.length} عطلة وصيانة
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openMaintenanceDialog()}
              className="text-[11px] gap-1.5 h-8 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
            >
              <Wrench className="h-3.5 w-3.5" />
              إغلاق يوم محدد بتاريخ للصيانة
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          انقر على أي يوم لتغيير حالته فوراً (مفتوح للسباحة أو عطلة أسبوعية ثابتة). لتصفية يوم واحد بتاريخ محدد (صيانة استثنائية) أو إغلاق يخص فوجاً مزدوجاً بعينه، استخدم زر <span className="font-bold text-amber-600">«إغلاق يوم محدد بتاريخ للصيانة»</span> — أو أيقونة المفتاح على كل يوم.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 pt-1">
          {WEEK_DAYS_MAP.map((w) => {
            const isOpen = operatingDays.includes(String(w.key));
            return (
              <button
                key={w.key}
                type="button"
                onClick={() => toggleOperatingDay(w.key)}
                className={cn(
                  "relative flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer group",
                  isOpen
                    ? "bg-teal-500/10 border-teal-500/40 hover:bg-teal-500/15 shadow-sm"
                    : "bg-muted/40 border-dashed border-border/70 hover:bg-muted text-muted-foreground"
                )}
              >
                {/* اختصار: إغلاق هذا اليوم بتاريخ محدد للصيانة */}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`إغلاق ${w.name} بتاريخ محدد للصيانة`}
                  onClick={(e) => {
                    e.stopPropagation();
                    openMaintenanceDialog(nextOccurrenceOf(w.key));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      openMaintenanceDialog(nextOccurrenceOf(w.key));
                    }
                  }}
                  className="absolute top-1 left-1 p-1 rounded-md text-muted-foreground/60 hover:text-amber-600 hover:bg-amber-500/10 transition-colors"
                  title={`إغلاق ${w.name} بتاريخ محدد للصيانة`}
                >
                  <Wrench className="h-3 w-3" />
                </span>

                <span className="text-xs font-bold text-foreground group-hover:scale-105 transition-transform">
                  {w.name}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                  {w.short}
                </span>
                <div className="mt-2 flex items-center gap-1">
                  {isOpen ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-700 dark:text-teal-400">
                      <Check className="h-3 w-3" /> مفتوح
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                      <X className="h-3 w-3" /> عطلة أسبوعية
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ 3. أفواج ومجموعات السباحة المزدوجة والاختيارية ═══ */}
      <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <h4 className="font-bold text-sm">أفواج ومجموعات السباحة (الأيام المزدوجة والمخصصة)</h4>
            <Badge variant="secondary" className="text-xs font-mono">
              {groups.length} أفواج
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            تظهر هذه الأفواج تلقائياً كخيارات أساسية في نموذج تسجيل منخرط جديد
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
            لا توجد أفواج مضافة بعد. اضغط «إضافة فوج مزدوج جديد» لإنشاء فوج مثل (السبت والثلاثاء).
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {groups.map((g) => {
              // التحقق إن كانت أيام الفوج مفتوحة حالياً
              const allDaysOpen = g.dayKeys.every((k) => operatingDays.includes(String(k)));

              return (
                <div
                  key={g.id}
                  className={cn(
                    "relative rounded-xl border p-3.5 space-y-3 transition-all",
                    g.active ? "bg-card border-border/70 shadow-sm" : "bg-muted/20 border-border/40 opacity-75"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="h-3 w-3 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: g.color || "#0d9488" }}
                      />
                      <div className="min-w-0">
                        <h5 className="font-bold text-sm text-foreground truncate">{g.name}</h5>
                        {g.shortName && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            رمز: {g.shortName}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Switch
                        checked={g.active}
                        onCheckedChange={(c) => toggleGroupActive(g.id, c)}
                        title={g.active ? "الفوج نشط في التسجيل" : "الفوج معطل"}
                      />
                      <button
                        onClick={() => openEditGroup(g)}
                        className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-muted"
                        title="تعديل الفوج"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(g.id)}
                        className="p-1 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
                        title="حذف الفوج"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* شارات الأيام المكونة للفوج */}
                  <div className="flex flex-wrap gap-1">
                    {g.days.map((d, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="text-[11px] bg-accent/40 border-border/60 py-0.5 px-2"
                      >
                        {d}
                      </Badge>
                    ))}
                    {!allDaysOpen && (
                      <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 py-0.5">
                        <Wrench className="h-2.5 w-2.5 ml-1" />
                        أحد أيامه مغلق أسبوعياً — يبقى ظاهراً في التسجيل
                      </Badge>
                    )}
                  </div>

                  {/* الحصص المتطابقة المخصصة */}
                  <div className="border-t border-border/50 pt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-teal-600" />
                      التوقيتات المتطابقة:
                    </span>
                    {g.matchingSlots && g.matchingSlots.length > 0 ? (
                      <span className="font-semibold text-foreground">
                        {g.matchingSlots.length} حصص مخصصة
                      </span>
                    ) : (
                      <span className="text-[11px]">كل حصص المسبح</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ 4. نافذة إنشاء / تعديل فوج مزدوج ═══ */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Layers className="h-4 w-4 text-teal-600" />
              {editingGroup ? "تعديل فوج السباحة" : "إضافة فوج مزدوج جديد"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* أ. تحديد أيام الفوج بنقرتين */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                أيام الفوج (انقر لتحديد اليومين أو الأيام):
              </Label>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                {WEEK_DAYS_MAP.map((w) => {
                  const selected = groupForm.selectedDayKeys.includes(w.key);
                  return (
                    <button
                      key={w.key}
                      type="button"
                      onClick={() => handleDaySelectInModal(w.key)}
                      className={cn(
                        "py-2 px-1 rounded-lg border text-xs font-semibold transition-all text-center",
                        selected
                          ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                          : "bg-background border-border text-foreground hover:border-teal-500/50"
                      )}
                    >
                      {w.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                مثال: اختر «الأحد» و«الأربعاء» لإنشاء فوج الأحد والأربعاء، أو «السبت» و«الثلاثاء».
              </p>
            </div>

            {/* ب. اسم الفوج والاختصار */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">اسم الفوج المعتمد *</Label>
                <Input
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  placeholder="مثال: السبت والثلاثاء"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">الرمز المختصر</Label>
                <Input
                  value={groupForm.shortName}
                  onChange={(e) => setGroupForm({ ...groupForm, shortName: e.target.value })}
                  placeholder="مثال: سب+ثل"
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            {/* ج. اختيار اللون المميز للفوج */}
            <div className="space-y-1.5">
              <Label className="text-xs">لون شارة الفوج</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setGroupForm({ ...groupForm, color: c })}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition-transform",
                      groupForm.color === c ? "border-foreground scale-110 shadow-sm" : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <Input
                  type="color"
                  value={groupForm.color}
                  onChange={(e) => setGroupForm({ ...groupForm, color: e.target.value })}
                  className="h-7 w-10 p-0 border-0 cursor-pointer"
                />
              </div>
            </div>

            {/* د. تحديد الحصص المتطابقة لهذا الفوج */}
            <div className="space-y-1.5 border-t border-border/60 pt-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-teal-600" />
                  الحصص اليومية المتماثلة المتاحة لهذا الفوج:
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  (اختياري: إن لم تحدد شيئاً تتاح كل الحصص)
                </span>
              </div>
              <div className="max-h-36 overflow-y-auto rounded-xl border border-border/60 p-2 space-y-1">
                {activeSlotLabels.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-2">لا توجد حصص سباحة مضافة بعد.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {activeSlotLabels.map((slot) => {
                      const isChecked = groupForm.matchingSlots.includes(slot);
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => {
                            const next = isChecked
                              ? groupForm.matchingSlots.filter((s) => s !== slot)
                              : [...groupForm.matchingSlots, slot];
                            setGroupForm({ ...groupForm, matchingSlots: next });
                          }}
                          className={cn(
                            "py-1 px-2 rounded-lg border text-[11px] font-mono transition-all text-center flex items-center justify-between",
                            isChecked
                              ? "bg-teal-500/15 border-teal-500/50 text-teal-700 dark:text-teal-300 font-bold"
                              : "bg-muted/30 border-border/60 text-muted-foreground hover:bg-muted"
                          )}
                        >
                          <span dir="ltr">{slot}</span>
                          {isChecked && <Check className="h-3 w-3 text-teal-600 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* هـ. تفعيل الفوج */}
            <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3 border border-border/60">
              <div>
                <Label className="text-xs font-semibold">تفعيل الفوج في شاشة التسجيل</Label>
                <p className="text-[10px] text-muted-foreground">
                  يظهر فوراً في نافذة «+ منخرط جديد» لموظفي الاستقبال
                </p>
              </div>
              <Switch
                checked={groupForm.active}
                onCheckedChange={(c) => setGroupForm({ ...groupForm, active: c })}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setGroupDialogOpen(false)} className="text-xs">
              إلغاء
            </Button>
            <Button onClick={handleSaveGroup} className="text-xs bg-teal-600 hover:bg-teal-700 text-white">
              {editingGroup ? "حفظ التعديلات" : "إضافة الفوج"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ 5. نافذة إغلاق يوم محدد بتاريخ للصيانة ═══ */}
      <Dialog open={maintenanceOpen} onOpenChange={setMaintenanceOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Wrench className="h-4 w-4 text-amber-600" />
              إغلاق يوم محدد بتاريخ للصيانة
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <p className="text-[11px] text-muted-foreground leading-relaxed rounded-xl bg-amber-500/10 border border-amber-500/30 p-2.5">
              هذا الإغلاق <strong>استثنائي لتاريخ واحد</strong> (لا يلغي العطلة الأسبوعية الثابتة) — تُسجَّل تعويضات آلية لكل منخرط متأثر، ويختار المدير النطاق المتأثر: كل الأفواج أو فوج مزدوج محدد.
            </p>

            {/* أ. التاريخ */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-amber-600" />
                تاريخ إغلاق الصيانة *
              </Label>
              <Input
                type="date"
                value={maintenanceDate}
                onChange={(e) => setMaintenanceDate(e.target.value)}
                className="h-10 text-xs"
                dir="ltr"
              />
            </div>

            {/* ب. النطاق المتأثر */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">النطاق المتأثر (أنا أختار):</Label>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pl-1">
                <button
                  type="button"
                  onClick={() => setMaintenanceScope("all")}
                  className={cn(
                    "w-full text-right px-3 py-2 rounded-lg border text-xs font-semibold transition-all",
                    maintenanceScope === "all"
                      ? "bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-400"
                      : "bg-background border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  كل المنخرطين — كل الأفواج
                </button>
                {groups.filter((g) => g.active).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setMaintenanceScope(g.name)}
                    className={cn(
                      "w-full text-right px-3 py-2 rounded-lg border text-xs font-semibold transition-all flex items-center gap-2",
                      maintenanceScope === g.name
                        ? "bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-400"
                        : "bg-background border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: g.color || "#0d9488" }} />
                    فوج: {g.name}
                  </button>
                ))}
              </div>
            </div>

            {/* ج. السبب */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">سبب الإغلاق:</Label>
              <Input
                value={maintenanceReason}
                onChange={(e) => setMaintenanceReason(e.target.value)}
                placeholder="مثال: صيانة المسبح"
                className="h-9 text-xs"
              />
            </div>

            {/* د. تمديد الاشتراكات */}
            <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3 border border-border/60">
              <div>
                <Label className="text-xs font-semibold">تمديد الاشتراكات تلقائياً</Label>
                <p className="text-[10px] text-muted-foreground">
                  يستأنف اشتراك المتأثرين بعدد أيام الإغلاق
                </p>
              </div>
              <Switch
                checked={maintenanceExtend}
                onCheckedChange={(c) => setMaintenanceExtend(c)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setMaintenanceOpen(false)} className="text-xs" disabled={maintenanceBusy}>
              إلغاء
            </Button>
            <Button
              onClick={handleMaintenanceSubmit}
              disabled={maintenanceBusy}
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
            >
              {maintenanceBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
              تسجيل الإغلاق والتعويضات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, CheckCircle2, Clock, QrCode, Search, Trash2, Users, Loader2,
  TrendingUp, X, Flame, Filter, Activity, AlertCircle, Shuffle, Zap, Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { QRScanner } from "@/components/qr-scanner";
import { notifySuccess, notifyWarning, notifyClick, notifyError } from "@/lib/sounds";
import type { SubscriberWithComputed } from "@/lib/rcs";

interface Attendance {
  id: string;
  date: string;
  checkInTime: string;
  checkOutTime: string | null;
  method: string;
  note: string | null;
  subscriber: {
    id: string;
    fileNumber: string;
    lastName: string;
    firstName: string;
    gender: string;
  };
}

interface LiveData {
  todayCount: number;
  currentlyInPool: number;
  byGroup: Record<string, { total: number; inPool: number }>;
  currentlyInPoolList: Array<{
    id: string;
    checkInTime: string;
    subscriber: { id: string; fileNumber: string; lastName: string; firstName: string; timeSlot: string | null };
  }>;
}

interface HeatmapData {
  matrix: number[][];
  dayNames: string[];
  max: number;
  bySlot: Record<string, number>;
  total: number;
}

interface AttendancePanelProps {
  subscribers: SubscriberWithComputed[];
  onRefresh?: () => void;
}

export function AttendancePanel({ subscribers, onRefresh }: AttendancePanelProps) {
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [live, setLive] = useState<LiveData | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [manualSubId, setManualSubId] = useState("");
  const [filterGroup, setFilterGroup] = useState("all");
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showByTime, setShowByTime] = useState(false); // ★ عرض الحضور حسب الوقت
  const [bulkSlot, setBulkSlot] = useState(""); // ★ فوج للتسجيل الجماعي
  const [bulkLoading, setBulkLoading] = useState(false); // ★ loading للتسجيل الجماعي
  const [customTime, setCustomTime] = useState(""); // ★ وقت مخصص للتسجيل
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ★ debounce للبحث — يقلل إعادة العرض
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance?date=${selectedDate}`);
      const data = await res.json();
      setAttendances(data.attendances || []);
    } catch {
      toast.error("تعذر تحميل سجل الحضور");
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch("/api/attendance/live");
      const data = await res.json();
      setLive(data);
    } catch { /* ignore */ }
  }, []);

  const fetchHeatmap = useCallback(async () => {
    try {
      const res = await fetch("/api/attendance/live?mode=heatmap&days=90");
      const data = await res.json();
      setHeatmap(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);
  useEffect(() => {
    fetchLive();
    const t = setInterval(fetchLive, 60000); // ★ زيادة الفاصل إلى 60s (كان 30s) للأداء
    return () => clearInterval(t);
  }, [fetchLive]);
  useEffect(() => {
    if (showHeatmap && !heatmap) fetchHeatmap();
  }, [showHeatmap, heatmap, fetchHeatmap]);

  const handleManualCheckIn = async (subscriberId: string) => {
    if (!subscriberId) return;
    try {
      const { offlineFetch } = await import("@/hooks/use-offline-mutation");
      const body: Record<string, unknown> = { subscriberId, method: "manual" };
      // ★ وقت مخصص إن قُدم — يدعم صيغتين:
      //   - "HH:MM" → يحوّل إلى اليوم HH:MM:00
      //   - "HH:MM-HH:MM" (مثل 10:00-11:00) → يأخذ وقت البداية (HH:MM)
      if (customTime) {
        const clean = customTime.trim();
        // صيغة نطاق زمني: 10:00-11:00 → خذ 10:00
        const rangeMatch = clean.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
        // صيغة وقت بسيط: 10:00
        const simpleMatch = clean.match(/^(\d{1,2}):(\d{2})$/);
        if (rangeMatch) {
          const h = rangeMatch[1].padStart(2, "0");
          const m = rangeMatch[2];
          const today = new Date();
          const iso = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(h), parseInt(m), 0).toISOString();
          body.checkInTime = iso;
        } else if (simpleMatch) {
          const h = simpleMatch[1].padStart(2, "0");
          const m = simpleMatch[2];
          const today = new Date();
          const iso = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(h), parseInt(m), 0).toISOString();
          body.checkInTime = iso;
        }
        // إن لم تطابق أي صيغة، لا نرسل checkInTime (يُستخدم الآن)
      }
      const res = await offlineFetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error?.includes("تم تسجيل")) {
          notifyWarning();
          toast.warning("تم تسجيل الحضور مسبقاً لهذا المنخرط اليوم");
        } else {
          notifyError();
          toast.error(data.error || "فشل");
        }
      } else if (data.offline) {
        notifySuccess();
        toast.success("✓ تم تسجيل الحضور محلياً — سيُزامن عند عودة الاتصال");
      } else {
        // Play sound based on status
        if (data.status === "expired" || data.status === "frozen") {
          notifyWarning();
          toast.warning(`⚠️ ${data.renewalStatus} — ${data.attendance.subscriber.lastName} ${data.attendance.subscriber.firstName}`);
        } else {
          notifySuccess();
          toast.success(`✓ تم تسجيل حضور ${data.attendance.subscriber.lastName} ${data.attendance.subscriber.firstName}`);
        }
        fetchAttendance();
        fetchLive();
        onRefresh?.();
      }
      setManualSubId("");
      setSearch("");
      searchInputRef.current?.focus();
    } catch {
      notifyError();
      toast.error("خطأ في الاتصال");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/attendance?id=${id}`, { method: "DELETE" });
      notifyClick();
      toast.success("تم حذف سجل الحضور");
      fetchAttendance();
      fetchLive();
    } catch {
      toast.error("فشل الحذف");
    }
  };

  // ★ التسجيل الجماعي لفوج محدد (time slot)
  const handleBulkCheckIn = async () => {
    if (!bulkSlot) {
      toast.error("اختر فوجاً للتسجيل الجماعي");
      return;
    }
    setBulkLoading(true);
    try {
      const body: Record<string, unknown> = { timeSlot: bulkSlot, date: selectedDate };
      // ★ وقت مخصص للتسجيل الجماعي (نفس منطق handleManualCheckIn)
      if (customTime) {
        const clean = customTime.trim();
        const rangeMatch = clean.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
        const simpleMatch = clean.match(/^(\d{1,2}):(\d{2})$/);
        if (rangeMatch || simpleMatch) {
          const h = (rangeMatch ? rangeMatch[1] : simpleMatch[1]).padStart(2, "0");
          const m = rangeMatch ? rangeMatch[2] : simpleMatch[2];
          const today = new Date();
          const iso = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(h), parseInt(m), 0).toISOString();
          body.checkInTime = iso;
        }
      }
      const res = await fetch("/api/attendance/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.checkedIn > 0) {
          notifySuccess();
          toast.success(`✓ تم تسجيل ${data.checkedIn} منخرط من فوج ${bulkSlot}`);
        } else if (data.alreadyPresent > 0) {
          notifyWarning();
          toast.warning(`جميع منخري فوج ${bulkSlot} مسجّلون مسبقاً (${data.alreadyPresent})`);
        } else {
          toast.info("لا يوجد منخروطون في هذا الفوج");
        }
        fetchAttendance();
        fetchLive();
        onRefresh?.();
      } else {
        notifyError();
        toast.error(data.error || "فشل التسجيل الجماعي");
      }
    } catch {
      notifyError();
      toast.error("خطأ في الاتصال");
    } finally {
      setBulkLoading(false);
    }
  };

  // ★ تسجيل عشوائي — يختار منخرطاً عشوائياً من غير الحاضرين
  const handleRandomCheckIn = async () => {
    const absent = filtered.filter((s) => !presentIds.has(s.id));
    if (absent.length === 0) {
      toast.info("كل المنخرطين مسجّلون بالفعل");
      return;
    }
    const random = absent[Math.floor(Math.random() * absent.length)];
    toast.info(`🎲 اختيار عشوائي: ${random.lastName} ${random.firstName}`);
    await handleManualCheckIn(random.id);
  };

  // ★ memoized filtered — يقلل إعادة الحساب عند كل render
  const filtered = useMemo(() => {
    if (!debouncedSearch) return filterGroup === "all" ? subscribers : subscribers.filter((s) => s.timeSlot === filterGroup);
    const q = debouncedSearch.toLowerCase();
    return subscribers.filter((s) => {
      const matches = s.lastName.toLowerCase().includes(q) ||
        s.firstName.toLowerCase().includes(q) ||
        s.fileNumber.toLowerCase().includes(q) ||
        (s.phone || "").includes(q);
      return matches && (filterGroup === "all" || s.timeSlot === filterGroup);
    });
  }, [subscribers, debouncedSearch, filterGroup]);

  // ★ memoized presentIds — يُعاد بناؤه فقط عند تغيّر attendances
  const presentIds = useMemo(() => new Set(attendances.map((a) => a.subscriber.id)), [attendances]);

  // ★ memoized attendance grouped by time — لعرض "حسب الوقت"
  const attendanceByTime = useMemo(() => {
    const groups: Record<string, Attendance[]> = {};
    for (const a of attendances) {
      // حدّد فوج المنخرط من timeSlot (إن وُجد)
      const sub = subscribers.find((s) => s.id === a.subscriber.id);
      const slot = sub?.timeSlot || "بدون فوج";
      if (!groups[slot]) groups[slot] = [];
      groups[slot].push(a);
    }
    // رتّب الفواني ترتيباً زمنياً
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [attendances, subscribers]);

  // Stats for today
  const todayCount = attendances.length;
  const qrCount = useMemo(() => attendances.filter((a) => a.method === "qr").length, [attendances]);
  const manualCount = useMemo(() => attendances.filter((a) => a.method === "manual").length, [attendances]);
  const absentCount = subscribers.length - todayCount;

  const groups = useMemo(
    () => Array.from(new Set(subscribers.map((s) => s.timeSlot).filter(Boolean))) as string[],
    [subscribers]
  );

  return (
    <div className="space-y-4">
      {/* Live counter banner */}
      {live && live.currentlyInPool > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-emerald-500/40 bg-gradient-to-l from-emerald-500/15 to-transparent p-4 flex items-center gap-4"
        >
          <div className="relative">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              <Flame className="h-6 w-6" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
            </span>
          </div>
          <div className="flex-1">
            <p className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300">
              في المسبح الآن: {live.currentlyInPool} شخص
            </p>
            <p className="text-xs text-muted-foreground">
              من أصل {live.todayCount} مسجَّل اليوم
              {Object.entries(live.byGroup).filter(([_, v]) => v.inPool > 0).map(([slot, v]) =>
                ` • فوج ${slot}: ${v.inPool}`
              ).join("")}
            </p>
          </div>
        </motion.div>
      )}

      {/* Top bar */}
      <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="font-bold text-base">سجل الحضور اليومي</h2>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setShowHeatmap(!showHeatmap)} size="sm">
              <TrendingUp className="h-4 w-4 ml-1" /> {showHeatmap ? "إخفاء الخريطة" : "خريطة الازدحام"}
            </Button>
            {/* ★ زر عرض الحضور حسب الوقت */}
            <Button variant="outline" onClick={() => setShowByTime(!showByTime)} size="sm"
              className={showByTime ? "bg-primary/10 border-primary/40 text-primary" : ""}>
              <Clock className="h-4 w-4 ml-1" /> {showByTime ? "إخفاء الترتيب" : "حسب الوقت"}
            </Button>
            <Button onClick={() => setScannerOpen(true)} className="h-9">
              <QrCode className="h-4 w-4 ml-1" /> مسح QR
            </Button>
          </div>
        </div>

        {/* Date + group filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-10 w-44"
          />
          <Badge variant="outline" className="h-7">
            {new Date(selectedDate).toLocaleDateString("ar-DZ", { weekday: "long", day: "numeric", month: "long" })}
          </Badge>
          <Select
            value={filterGroup}
            onValueChange={(v) => {
              setFilterGroup(v);
              // ★ مزامنة: تغيير فلتر الفوج يحدّث أيضاً الفوج المختار للتسجيل الجماعي
              setBulkSlot(v === "all" ? "" : v);
            }}
          >
            <SelectTrigger className="h-10 w-44">
              <Filter className="h-3.5 w-3.5 ml-1" />
              <SelectValue placeholder="كل الأفواج" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأفواج</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ★ التسجيل الجماعي + العشوائي + الوقت المخصص */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {/* ★ التسجيل الجماعي لفوج — يفلتر القائمة اليدوية أيضاً */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-2.5 flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary shrink-0" />
            <Select
              value={bulkSlot}
              onValueChange={(v) => {
                setBulkSlot(v);
                // ★ مزامنة: تحديد فوج هنا يفلتر القائمة اليدوية حسبه أيضاً
                setFilterGroup(v);
              }}
            >
              <SelectTrigger className="h-8 flex-1 border-primary/30">
                <SelectValue placeholder="تسجيل جماعي لفوج..." />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleBulkCheckIn} disabled={!bulkSlot || bulkLoading} className="h-8 px-3">
              {bulkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "تسجيل الكل"}
            </Button>
          </div>

          {/* وقت مخصص للتسجيل — من اليمين لليسار (مثال: 10:00-11:00) */}
          <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-2.5 flex items-center gap-2">
            <Timer className="h-4 w-4 text-violet-600 shrink-0" />
            <Input
              type="text"
              inputMode="numeric"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
              placeholder="10:00-11:00"
              className="h-8 flex-1 border-violet-500/30 font-mono text-center"
              dir="rtl"
              maxLength={11}
            />
            {customTime && (
              <Button size="sm" variant="ghost" onClick={() => setCustomTime("")} className="h-8 px-2 text-violet-600">
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* ★ مؤشر الفلترة + إعادة تعيين */}
        {filterGroup !== "all" && (
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/30">
              <Filter className="h-3 w-3 ml-1" /> فلترة حسب الفوج: {filterGroup}
            </Badge>
            <span className="text-muted-foreground">
              ({filtered.length} منخرط في هذا الفوج — {filtered.filter((s) => !presentIds.has(s.id)).length} غير حاضر)
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setFilterGroup("all"); setBulkSlot(""); }}
              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3 ml-1" /> إلغاء الفلترة
            </Button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatPill icon={Users} label="حاضرون" value={todayCount} color="emerald" />
          <StatPill icon={QrCode} label="عبر QR" value={qrCount} color="violet" />
          <StatPill icon={CheckCircle2} label="يدوي" value={manualCount} color="amber" />
          <StatPill icon={X} label="غائبون" value={absentCount} color="rose" />
        </div>
      </div>

      {/* Heatmap */}
      {showHeatmap && heatmap && (
        <HeatmapView data={heatmap} />
      )}

      {/* ★ عرض الحضور حسب الوقت — قائمة مجمّعة حسب الفوج */}
      {showByTime && (
        <AttendanceByTimeView
          groups={attendanceByTime}
          loading={loading}
          onDelete={handleDelete}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Manual check-in */}
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" /> تسجيل حضور يدوي
            {filterGroup !== "all" && (
              <Badge variant="secondary" className="text-[10px]">فوج: {filterGroup}</Badge>
            )}
          </h3>
          <div className="relative mb-3">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              autoFocus
              placeholder="ابحث بالاسم أو رقم الملف أو الهاتف... (Enter يسجّل الحضور إذا تبقّت نتيجة واحدة)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filtered.length === 1) {
                  const only = filtered[0];
                  if (!presentIds.has(only.id)) handleManualCheckIn(only.id);
                }
              }}
              className="pr-10 h-10"
            />
          </div>
          <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1 -mr-1">
            {filtered.slice(0, 50).map((s) => {
              const isPresent = presentIds.has(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => !isPresent && handleManualCheckIn(s.id)}
                  disabled={isPresent}
                  className={cn(
                    "w-full flex items-center gap-2 p-2 rounded-lg border text-right transition",
                    isPresent
                      ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 opacity-70 cursor-not-allowed"
                      : "hover:bg-accent hover:border-primary/40 border-border"
                  )}
                >
                  <Avatar className="h-8 w-8 rounded-lg shrink-0">
                    <AvatarFallback className={cn(
                      "rounded-md text-xs font-bold",
                      s.gender === "ذكر" ? "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300"
                      : "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300"
                    )}>
                      {s.lastName[0]}{s.firstName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{s.lastName} {s.firstName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{s.fileNumber} {s.timeSlot && `• ${s.timeSlot}`}</p>
                  </div>
                  {isPresent ? (
                    <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
                      <CheckCircle2 className="h-3 w-3 ml-1" /> حاضر
                    </Badge>
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">لا توجد نتائج</p>
            )}
          </div>
        </div>

        {/* Today's list */}
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> حاضرو اليوم ({attendances.length})
          </h3>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : attendances.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
              لا يوجد حضور مسجل لهذا اليوم
            </div>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1 -mr-1">
              <AnimatePresence initial={false}>
                {attendances.map((a, i) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: i * 0.02 }}
                    className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition group"
                  >
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold shrink-0",
                      a.subscriber.gender === "ذكر" ? "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300"
                      : "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300"
                    )}>
                      {a.subscriber.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {a.subscriber.lastName} {a.subscriber.firstName}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="font-mono">{new Date(a.checkInTime).toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" })}</span>
                        <span>•</span>
                        <Badge variant="outline" className={cn(
                          "h-4 text-[9px] px-1",
                          a.method === "qr" ? "bg-violet-500/15 text-violet-700 border-violet-500/30"
                          : "bg-amber-500/15 text-amber-700 border-amber-500/30"
                        )}>
                          {a.method === "qr" ? "QR" : "يدوي"}
                        </Badge>
                        {a.note && <span className="text-orange-600 text-[10px]">{a.note}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="opacity-0 group-hover:opacity-100 transition p-1 hover:bg-rose-500/10 rounded text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* QR Scanner */}
      <QRScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onCheckIn={() => { fetchAttendance(); fetchLive(); onRefresh?.(); }}
      />
    </div>
  );
}

function StatPill({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: "emerald" | "violet" | "amber" | "rose";
}) {
  const colors = {
    emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    violet: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    amber: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    rose: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  };
  return (
    <div className={cn("rounded-xl p-2.5 flex items-center gap-2", colors[color])}>
      <Icon className="h-4 w-4 shrink-0" />
      <div>
        <p className="text-lg font-extrabold leading-none tabular-nums">{value}</p>
        <p className="text-[10px] opacity-80 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function HeatmapView({ data }: { data: HeatmapData }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const colorFor = (v: number) => {
    if (v === 0) return "bg-muted/30";
    const ratio = v / (data.max || 1);
    if (ratio < 0.25) return "bg-emerald-500/30";
    if (ratio < 0.5) return "bg-emerald-500/50";
    if (ratio < 0.75) return "bg-amber-500/60";
    return "bg-rose-500/70";
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="rounded-2xl border border-border/60 bg-card p-4 overflow-x-auto"
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" /> خريطة الازدحام (آخر 90 يوم)
        </h3>
        <div className="flex items-center gap-2 text-xs">
          <span>أقل</span>
          <div className="flex gap-0.5">
            <div className="h-3 w-3 rounded bg-muted/30" />
            <div className="h-3 w-3 rounded bg-emerald-500/30" />
            <div className="h-3 w-3 rounded bg-emerald-500/50" />
            <div className="h-3 w-3 rounded bg-amber-500/60" />
            <div className="h-3 w-3 rounded bg-rose-500/70" />
          </div>
          <span>أكثر</span>
        </div>
      </div>

      <div className="min-w-[600px]">
        <table className="w-full text-[10px]">
          <thead>
            <tr>
              <th className="text-right p-1 w-20">اليوم / الساعة</th>
              {hours.filter((h) => h >= 6 && h <= 22).map((h) => (
                <th key={h} className="p-1 text-center font-mono">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.matrix.map((row, dow) => (
              <tr key={dow}>
                <td className="p-1 text-right font-semibold text-xs">{data.dayNames[dow]}</td>
                {hours.filter((h) => h >= 6 && h <= 22).map((h) => {
                  const v = row[h];
                  return (
                    <td key={h} className="p-0.5">
                      <div
                        className={cn("h-7 rounded flex items-center justify-center font-mono text-[9px] font-bold", colorFor(v))}
                        title={`${data.dayNames[dow]} ${h}:00 — ${v} حضور`}
                      >
                        {v > 0 ? v : ""}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Best slot summary */}
      <div className="mt-3 pt-3 border-t">
        <h4 className="text-xs font-bold mb-2 text-muted-foreground">التوزيع حسب الفوج:</h4>
        <div className="flex flex-wrap gap-2">
          {Object.entries(data.bySlot).sort((a, b) => b[1] - a[1]).map(([slot, count]) => (
            <Badge key={slot} variant="outline" className="text-xs">
              {slot}: <span className="font-bold tabular-nums mr-1">{count}</span>
            </Badge>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ═════════════════════════════════════════════════════════════
// ★ AttendanceByTimeView — عرض الحضور مجمّعاً حسب الفوج (time slot)
// يعرض كل فوج + عدد الحاضرين فيه + قائمتهم بترتيب زمني
// ═════════════════════════════════════════════════════════════
function AttendanceByTimeView({
  groups,
  loading,
  onDelete,
}: {
  groups: [string, Attendance[]][];
  loading: boolean;
  onDelete: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-4 text-center">
        <Clock className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">لا يوجد حضور لهذا اليوم</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="rounded-2xl border border-border/60 bg-card p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" /> الحضور حسب الفوج ({groups.length} أفواج)
        </h3>
        <Badge variant="outline" className="text-[10px]">
          {groups.reduce((s, [_, list]) => s + list.length, 0)} حضور
        </Badge>
      </div>

      <div className="space-y-2">
        {groups.map(([slot, list]) => (
          <div key={slot} className="rounded-xl border border-border/40 overflow-hidden">
            {/* رأس الفوج */}
            <div className="flex items-center justify-between bg-primary/5 px-3 py-2 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-primary" />
                <span className="font-bold text-sm font-mono" dir="ltr">{slot}</span>
              </div>
              <Badge variant="secondary" className="text-[10px]">{list.length} منخرط</Badge>
            </div>
            {/* قائمة الحاضرين في الفوج — مرتبة زمنياً */}
            <div className="divide-y divide-border/30">
              {list
                .slice()
                .sort((a, b) => new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime())
                .map((a) => (
                  <div key={a.id} className="flex items-center gap-2 p-2 hover:bg-muted/40 transition group">
                    <span className="text-xs font-mono text-muted-foreground tabular-nums w-12 shrink-0" dir="ltr">
                      {new Date(a.checkInTime).toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {a.subscriber.lastName} {a.subscriber.firstName}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn(
                      "h-4 text-[9px] px-1 shrink-0",
                      a.method === "qr" ? "bg-violet-500/15 text-violet-700 border-violet-500/30"
                      : "bg-amber-500/15 text-amber-700 border-amber-500/30"
                    )}>
                      {a.method === "qr" ? "QR" : "يدوي"}
                    </Badge>
                    {a.note && <span className="text-orange-600 text-[10px] shrink-0">{a.note}</span>}
                    <button
                      onClick={() => onDelete(a.id)}
                      className="opacity-0 group-hover:opacity-100 transition p-1 hover:bg-rose-500/10 rounded text-rose-500 shrink-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Clock, Play, Square, Calendar, Users, Wallet, TrendingUp,
  Loader2, CheckCircle2, XCircle, AlertCircle, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface GuardAssignment {
  id: string;
  dayOfWeek: string;
  timeSlot: string;
  groupName: string | null;
  assignmentType: string;
  attendanceStatus: string;
  actualStartTime: string | null;
  actualEndTime: string | null;
  note: string | null;
  user: {
    id: string;
    name: string;
    hourlyRate: number;
    position: string | null;
    avatar: string | null;
  };
}

const DAYS = ["الأحد والأربعاء", "الاثنين والخميس", "الثلاثاء والجمعة", "كل الأيام"];
const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function getTodayName(): string {
  const today = new Date().getDay(); // 0=Sunday
  return DAY_NAMES[today];
}

function isTodayMatching(dayOfWeek: string): boolean {
  if (dayOfWeek === "كل الأيام") return true;
  const todayName = getTodayName();
  if (dayOfWeek === "الأحد والأربعاء") return todayName === "الأحد" || todayName === "الأربعاء";
  if (dayOfWeek === "الاثنين والخميس") return todayName === "الإثنين" || todayName === "الخميس";
  if (dayOfWeek === "الثلاثاء والجمعة") return todayName === "الثلاثاء" || todayName === "الجمعة";
  return false;
}

function calcDuration(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(0, (e - s) / (1000 * 60 * 60));
}

function formatTime(d: string | null): string {
  if (!d) return "—";
  const date = new Date(d);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  scheduled: { label: "مجدولة", color: "bg-slate-500/15 text-slate-700 border-slate-500/30", icon: Clock },
  started: { label: "جارية", color: "bg-sky-500/15 text-sky-700 border-sky-500/30", icon: Play },
  completed: { label: "منتهية", color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", icon: CheckCircle2 },
  absent: { label: "غائب", color: "bg-rose-500/15 text-rose-700 border-rose-500/30", icon: XCircle },
  late: { label: "متأخر", color: "bg-amber-500/15 text-amber-700 border-amber-500/30", icon: AlertCircle },
};

export function PointagePanel() {
  const [assignments, setAssignments] = useState<GuardAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/guard-assignments", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments || []);
      }
    } catch {
      toast.error("تعذر تحميل التعيينات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  // 🔑 حصص اليوم فقط (للحارس)
  const todayAssignments = useMemo(() => {
    return assignments.filter((a) => isTodayMatching(a.dayOfWeek));
  }, [assignments]);

  // إحصائيات
  const stats = useMemo(() => {
    const completed = todayAssignments.filter((a) => a.attendanceStatus === "completed");
    const totalHoursToday = completed.reduce((s, a) => s + calcDuration(a.actualStartTime, a.actualEndTime), 0);
    const totalWage = completed.reduce((s, a) => {
      const hours = calcDuration(a.actualStartTime, a.actualEndTime);
      return s + hours * (a.user.hourlyRate || 0);
    }, 0);
    // ساعات الشهر (كل التعيينات المكتملة)
    const allCompleted = assignments.filter((a) => a.attendanceStatus === "completed");
    const monthHours = allCompleted.reduce((s, a) => s + calcDuration(a.actualStartTime, a.actualEndTime), 0);
    const monthWage = allCompleted.reduce((s, a) => {
      const hours = calcDuration(a.actualStartTime, a.actualEndTime);
      return s + hours * (a.user.hourlyRate || 0);
    }, 0);

    return {
      totalToday: todayAssignments.length,
      completedToday: completed.length,
      remainingToday: todayAssignments.filter((a) => a.attendanceStatus === "scheduled").length,
      hoursToday: totalHoursToday,
      wageToday: Math.round(totalWage),
      hoursMonth: monthHours,
      wageMonth: Math.round(monthWage),
    };
  }, [todayAssignments, assignments]);

  const handleStart = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/guard-assignments?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      if (!res.ok) throw new Error("فشل");
      toast.success("تم بدء الحصة");
      fetchAssignments();
    } catch {
      toast.error("فشل بدء الحصة");
    } finally {
      setActionLoading(null);
    }
  };

  const handleEnd = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/guard-assignments?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end" }),
      });
      if (!res.ok) throw new Error("فشل");
      toast.success("تم إنهاء الحصة");
      fetchAssignments();
    } catch {
      toast.error("فشل إنهاء الحصة");
    } finally {
      setActionLoading(null);
    }
  };

  const todayName = getTodayName();
  const todayDate = new Date().toLocaleDateString("ar-DZ");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-6 w-6 text-teal-600" />
          <div>
            <h2 className="text-xl font-bold text-teal-900">Pointage — تسجيل الحضور</h2>
            <p className="text-xs text-muted-foreground">{todayName}، {todayDate}</p>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        <StatCard icon={Calendar} label="حصص اليوم" value={stats.totalToday} color="from-blue-500 to-blue-600" />
        <StatCard icon={CheckCircle2} label="منجزة" value={stats.completedToday} color="from-emerald-500 to-emerald-600" />
        <StatCard icon={Clock} label="متبقية" value={stats.remainingToday} color="from-amber-500 to-amber-600" />
        <StatCard icon={Clock} label="ساعات اليوم" value={stats.hoursToday.toFixed(1)} color="from-teal-500 to-teal-600" />
        <StatCard icon={Wallet} label="أجر اليوم" value={`${stats.wageToday} دج`} color="from-orange-500 to-orange-600" />
        <StatCard icon={TrendingUp} label="ساعات الشهر" value={stats.hoursMonth.toFixed(1)} color="from-violet-500 to-violet-600" />
        <StatCard icon={Wallet} label="أجر الشهر" value={`${stats.wageMonth} دج`} color="from-sky-500 to-sky-600" />
      </div>

      {/* Today's sessions */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-teal-600" /> حصصي اليوم
          </h3>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          </div>
        ) : todayAssignments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">لا توجد حصص مجدولة اليوم</p>
          </div>
        ) : (
          <div className="divide-y">
            {todayAssignments.map((a, i) => {
              const status = STATUS_CONFIG[a.attendanceStatus] || STATUS_CONFIG.scheduled;
              const StatusIcon = status.icon;
              const hours = a.attendanceStatus === "completed"
                ? calcDuration(a.actualStartTime, a.actualEndTime)
                : 0;
              const wage = hours * (a.user.hourlyRate || 0);

              // تحديد ما إذا كانت الحصة جارية الآن (ضمن وقت timeSlot)
              const [slotStart, slotEnd] = a.timeSlot.split("-");
              const now = new Date();
              const currentStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
              const isWithinSlot = currentStr >= slotStart && currentStr <= slotEnd;
              const isBeforeSlot = currentStr < slotStart;

              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.3) }}
                  className="p-4 hover:bg-accent/40 transition"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    {/* Left: session info */}
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                        a.attendanceStatus === "completed" ? "bg-emerald-500/15" :
                        a.attendanceStatus === "started" ? "bg-sky-500/15" :
                        "bg-muted"
                      )}>
                        <StatusIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{a.timeSlot}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.groupName || "بدون فوج"} • {a.dayOfWeek}
                        </p>
                      </div>
                    </div>

                    {/* Middle: times */}
                    <div className="flex items-center gap-4 text-xs">
                      <div className="text-center">
                        <p className="text-muted-foreground">الدخول</p>
                        <p className="font-mono font-bold">{formatTime(a.actualStartTime)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">الخروج</p>
                        <p className="font-mono font-bold">{formatTime(a.actualEndTime)}</p>
                      </div>
                      {hours > 0 && (
                        <div className="text-center">
                          <p className="text-muted-foreground">المدة</p>
                          <p className="font-bold text-teal-700">{hours.toFixed(1)} سا</p>
                        </div>
                      )}
                      {wage > 0 && (
                        <div className="text-center">
                          <p className="text-muted-foreground">الأجر</p>
                          <p className="font-bold text-amber-600">{Math.round(wage)} دج</p>
                        </div>
                      )}
                    </div>

                    {/* Right: status + actions */}
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("text-[9px]", status.color)}>
                        {status.label}
                      </Badge>

                      {a.attendanceStatus === "scheduled" && (
                        <Button
                          size="sm"
                          onClick={() => handleStart(a.id)}
                          disabled={actionLoading === a.id || isBeforeSlot}
                          className="h-8 bg-sky-600 hover:bg-sky-700 text-white"
                          title={isBeforeSlot ? "الحصة لم تبدأ بعد" : "بدء الحصة"}
                        >
                          {actionLoading === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 ml-1" />}
                          بدء
                        </Button>
                      )}
                      {a.attendanceStatus === "started" && (
                        <Button
                          size="sm"
                          onClick={() => handleEnd(a.id)}
                          disabled={actionLoading === a.id}
                          className="h-8 bg-rose-600 hover:bg-rose-700 text-white"
                        >
                          {actionLoading === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5 ml-1" />}
                          إنهاء
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* All assignments (this month) */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-teal-600" /> كل تعييناتي
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-teal-800 text-white">
                <th className="p-2 text-right">اليوم</th>
                <th className="p-2 text-center">التوقيت</th>
                <th className="p-2 text-center">الفوج</th>
                <th className="p-2 text-center">النوع</th>
                <th className="p-2 text-center">الحالة</th>
                <th className="p-2 text-center">الدخول</th>
                <th className="p-2 text-center">الخروج</th>
                <th className="p-2 text-center">المدة</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" /></td></tr>
              ) : assignments.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">لا توجد تعيينات</td></tr>
              ) : (
                assignments.map((a, i) => {
                  const status = STATUS_CONFIG[a.attendanceStatus] || STATUS_CONFIG.scheduled;
                  const hours = calcDuration(a.actualStartTime, a.actualEndTime);
                  return (
                    <tr key={a.id} className={cn("border-b hover:bg-accent/40", i % 2 === 0 ? "bg-white" : "bg-gray-50/50")}>
                      <td className="p-2 text-right">{a.dayOfWeek}</td>
                      <td className="p-2 text-center font-mono">{a.timeSlot}</td>
                      <td className="p-2 text-center">{a.groupName || "—"}</td>
                      <td className="p-2 text-center text-xs">
                        {a.assignmentType === "primary" ? "رئيسي" : a.assignmentType === "assistant" ? "مساعد" : "بديل"}
                      </td>
                      <td className="p-2 text-center">
                        <Badge variant="outline" className={cn("text-[9px]", status.color)}>{status.label}</Badge>
                      </td>
                      <td className="p-2 text-center font-mono text-xs">{formatTime(a.actualStartTime)}</td>
                      <td className="p-2 text-center font-mono text-xs">{formatTime(a.actualEndTime)}</td>
                      <td className="p-2 text-center font-bold text-teal-700">{hours > 0 ? `${hours.toFixed(1)} سا` : "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className={cn("rounded-xl p-3 text-white bg-gradient-to-br", color)}>
      <Icon className="h-4 w-4 mb-1" />
      <p className="text-lg font-extrabold tabular-nums leading-none">{value}</p>
      <p className="text-[10px] opacity-90 mt-1">{label}</p>
    </div>
  );
}

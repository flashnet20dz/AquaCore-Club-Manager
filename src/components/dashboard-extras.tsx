"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  LifeBuoy, Flame, Trophy, Target, CalendarDays, Sparkles, Loader2,
  MessageCircle, RefreshCw, TrendingUp, TrendingDown, Users, Printer,
  ChevronDown, UserSearch, X, SendHorizontal, RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChurnItem {
  subscriberId: string; name: string; fileNumber: string;
  phone: string | null; daysAbsent: number;
  expiryDate: string | null; daysLeft: number | null;
  risk: "high" | "medium";
}
interface ScheduleCell {
  slot: string; count: number; capacity: number;
  subscribers: { id: string; name: string; fileNumber: string }[];
}
interface Extras {
  churn: ChurnItem[];
  heatmap: number[][];
  heatHoursStart: number;
  topDays: { date: string; count: number }[];
  goals: { target: number; achieved: number; prevMonth: number; monthName: string };
  schedule: { day: string; total: number; capacity: number; slots: ScheduleCell[] }[];
  roster: { id: string; name: string; days: number[]; slot: string }[];
}

const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

type SlotStatus = "free" | "near" | "full" | "none";
const slotStatus = (count: number, capacity: number): SlotStatus => {
  if (capacity <= 0) return "none";
  const ratio = count / capacity;
  if (ratio >= 1) return "full";
  if (ratio >= 0.8) return "near";
  return "free";
};
const STATUS_DOT: Record<SlotStatus, string> = {
  free: "bg-teal-500", near: "bg-amber-500", full: "bg-rose-500", none: "bg-muted-foreground/40",
};
const STATUS_TEXT: Record<SlotStatus, string> = {
  free: "text-teal-600 dark:text-teal-400", near: "text-amber-600 dark:text-amber-400", full: "text-rose-500", none: "text-muted-foreground",
};
const STATUS_BAR: Record<SlotStatus, string> = {
  free: "bg-teal-500", near: "bg-amber-500", full: "bg-rose-500", none: "bg-muted-foreground/40",
};
const dayBadgeClass = (d: { total: number; capacity: number }) => {
  if (d.total === 0) return "bg-muted text-muted-foreground";
  if (d.capacity > 0) {
    const r = d.total / d.capacity;
    if (r >= 1) return "bg-rose-500/15 text-rose-600 dark:text-rose-400";
    if (r >= 0.8) return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  } else if (d.total >= 30) {
    return "bg-rose-500/15 text-rose-600 dark:text-rose-400";
  }
  return "bg-teal-500/15 text-teal-700 dark:text-teal-400";
};

const CHAT_SUGGESTIONS = [
  "حلّل أداء النادي وقدّم توصيات",
  "كم منخرطاً لم يدفع بعد؟",
  "ما إيرادات هذا الشهر مقارنة بالشهر الماضي؟",
  "ما أكثر الفترات ازدحاماً في الأسبوع؟",
  "كم منخرطاً غائب لأكثر من 3 أسابيع؟",
];

export function DashboardExtras() {
  const [data, setData] = useState<Extras | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [target, setTarget] = useState("");
  const [savingTarget, setSavingTarget] = useState(false);
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);
  const [pickQuery, setPickQuery] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [chat, setChat] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = chatBoxRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [chat, chatLoading]);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/dashboard-extras", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d && !d.error) {
          setData(d);
          setTarget(d.goals?.target ? String(d.goals.target) : "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openWhatsApp = async (ids: string[], includePortal: boolean) => {
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriberIds: ids, includePortal }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "تعذر الإرسال"); return; }
      const links = (data.results || []).filter((r: { url?: string }) => r.url).map((r: { url?: string }) => r.url);
      if (data.mode === "cloud") {
        toast.success(`أُرسلت ${data.sent} رسالة آلياً عبر WhatsApp Business`);
      } else if (links.length > 0) {
        toast.info(`فتح ${Math.min(links.length, 5)} محادثة — أكمل الإرسال من واتساب`);
        links.slice(0, 5).forEach((url: string, i: number) =>
          setTimeout(() => window.open(url, "_blank"), i * 350)
        );
      } else {
        toast.warning("لا توجد أرقام هاتف صالحة");
      }
    } catch {
      toast.error("خطأ في الاتصال");
    }
  };

  const saveTarget = async () => {
    const val = Number(target);
    if (isNaN(val) || val < 0) { toast.error("أدخل رقماً صحيحاً"); return; }
    setSavingTarget(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { monthlyRevenueTarget: String(val) } }),
      });
      if (res.ok) { toast.success("تم حفظ الهدف الشهري"); load(); }
      else { const d = await res.json(); toast.error(d.error || "تعذر الحفظ (للمدير فقط)"); }
    } catch { toast.error("خطأ في الاتصال"); }
    finally { setSavingTarget(false); }
  };

  const sendChat = async (preset?: string) => {
    const q = (preset ?? chatInput).trim();
    if (!q || chatLoading) return;
    const next = [...chat, { role: "user" as const, content: q }];
    setChat(next);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-12) }),
      });
      const d = await res.json();
      if (res.ok && d.answer) {
        setChat([...next, { role: "assistant", content: d.answer }]);
      } else {
        toast.error(d.error || "تعذر الإجابة");
        setChat(next);
      }
    } catch {
      toast.error("خطأ في الاتصال");
      setChat(next);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
      </div>
    );
  }
  if (!data) return null;

  const maxHeat = Math.max(1, ...data.heatmap.flat());
  const goalPct = data.goals.target > 0 ? Math.min(100, Math.round((data.goals.achieved / data.goals.target) * 100)) : 0;
  const maxTop = Math.max(1, ...data.topDays.map((d) => d.count));
  const highRisk = data.churn.filter((c) => c.risk === "high");
  const pickedSub = (data.roster || []).find((r) => r.id === pickedId) || null;
  const pickMatches = pickQuery.trim()
    ? (data.roster || []).filter((r) => r.name.includes(pickQuery.trim())).slice(0, 30)
    : [];

  return (
    <div className="space-y-4 mt-4">
      {/* ═══ 1) أنقذ هؤلاء — مؤشر التسرب ═══ */}
      <Card className="border-rose-200/60 dark:border-rose-900/40 overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-l from-rose-500/10 to-transparent">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <LifeBuoy className="h-5 w-5 text-rose-500" />
              أنقذ هؤلاء — مؤشر التسرب
              <Badge className="bg-rose-500/15 text-rose-600 border-0">{data.churn.length} منخرط</Badge>
              {highRisk.length > 0 && (
                <Badge variant="outline" className="border-rose-300 text-rose-600">{highRisk.length} خطر مرتفع</Badge>
              )}
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-8" onClick={load}>
                <RefreshCw className="h-3.5 w-3.5 ml-1" /> تحديث
              </Button>
              {data.churn.length > 0 && (
                <Button
                  size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={bulkSending}
                  onClick={async () => {
                    setBulkSending(true);
                    await openWhatsApp(data.churn.map((c) => c.subscriberId), true);
                    setBulkSending(false);
                  }}
                >
                  {bulkSending ? <Loader2 className="h-3.5 w-3.5 ml-1 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5 ml-1" />}
                  واتساب جماعي + البوابة
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-3">
          {data.churn.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              🎉 ممتاز! لا يوجد منخرطون في خطر التسرب حالياً
            </p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {data.churn.map((c) => (
                <div key={c.subscriberId} className="flex items-center gap-2 p-2.5 rounded-xl border border-border/50 hover:bg-accent/40 transition">
                  <span className={cn(
                    "h-2.5 w-2.5 rounded-full shrink-0",
                    c.risk === "high" ? "bg-rose-500" : "bg-amber-500"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {c.fileNumber} • غائب {c.daysAbsent >= 999 ? "منذ البداية" : `${c.daysAbsent} يوماً`}
                      {c.daysLeft !== null && (c.daysLeft < 0
                        ? ` • منتهي منذ ${Math.abs(c.daysLeft)} يوم`
                        : ` • ينتهي بعد ${c.daysLeft} يوم`)}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn(
                    "shrink-0 hidden sm:inline-flex",
                    c.risk === "high" ? "border-rose-300 text-rose-600" : "border-amber-300 text-amber-600"
                  )}>
                    {c.risk === "high" ? "خطر مرتفع" : "متابعة"}
                  </Badge>
                  {c.phone && (
                    <Button
                      size="sm" variant="outline" className="h-7 shrink-0 text-emerald-700 border-emerald-200 hover:bg-emerald-500/10"
                      disabled={sendingTo === c.subscriberId}
                      onClick={async () => {
                        setSendingTo(c.subscriberId);
                        await openWhatsApp([c.subscriberId], true);
                        setSendingTo(null);
                      }}
                    >
                      {sendingTo === c.subscriberId ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3" />}
                      تواصل
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ═══ 2) خريطة حرارة الحضور ═══ */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Flame className="h-5 w-5 text-amber-500" /> خريطة حرارة الحضور
              <span className="text-xs font-normal text-muted-foreground">(آخر 60 يوماً)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto pb-1">
              <div className="min-w-[420px] space-y-1">
                {data.heatmap.map((row, dow) => (
                  <div key={dow} className="flex items-center gap-1">
                    <span className="w-12 text-[10px] text-muted-foreground shrink-0">{DAY_NAMES[dow]}</span>
                    <div className="flex gap-0.5 flex-1">
                      {row.map((count, h) => (
                        <div
                          key={h}
                          title={`${DAY_NAMES[dow]} ${data.heatHoursStart + h}:00 — ${count} حضور`}
                          className="flex-1 h-5 rounded-[3px] transition hover:ring-1 hover:ring-teal-400"
                          style={{
                            backgroundColor: count === 0
                              ? "rgb(128 128 128 / 0.08)"
                              : `rgba(13, 148, 136, ${0.15 + (count / maxHeat) * 0.85})`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-1 pt-1">
                  <span className="w-12 shrink-0" />
                  <div className="flex gap-0.5 flex-1">
                    {Array.from({ length: 14 }).map((_, h) => (
                      <span key={h} className="flex-1 text-center text-[8px] text-muted-foreground">
                        {(data.heatHoursStart + h) % 2 === 0 ? data.heatHoursStart + h : ""}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* ═══ 3) أفضل 5 أيام ═══ */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-5 w-5 text-amber-500" /> أفضل 5 أيام إقبالاً
                <span className="text-xs font-normal text-muted-foreground">(آخر 90 يوماً)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.topDays.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">لا توجد بيانات حضور بعد</p>
              ) : data.topDays.map((d, i) => (
                <div key={d.date} className="flex items-center gap-2">
                  <span className="w-5 text-xs font-bold text-muted-foreground">{i + 1}</span>
                  <span className="w-24 text-xs font-medium shrink-0">
                    {new Date(d.date).toLocaleDateString("ar-DZ", { weekday: "short", day: "numeric", month: "short" })}
                  </span>
                  <div className="flex-1 h-4 rounded-full bg-muted/60 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(d.count / maxTop) * 100}%` }}
                      transition={{ duration: 0.6, delay: i * 0.08 }}
                      className="h-full rounded-full bg-gradient-to-l from-teal-500 to-emerald-400"
                    />
                  </div>
                  <span className="w-8 text-xs font-bold tabular-nums text-teal-600">{d.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ═══ 4) الهدف الشهري ═══ */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-5 w-5 text-teal-600" /> هدف {data.goals.monthName}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-extrabold tabular-nums">
                    {data.goals.achieved.toLocaleString("en-US")} <span className="text-sm font-normal text-muted-foreground">دج</span>
                  </p>
                  <p className={cn(
                    "text-xs flex items-center gap-1 mt-0.5",
                    data.goals.achieved >= data.goals.prevMonth ? "text-emerald-600" : "text-rose-600"
                  )}>
                    {data.goals.achieved >= data.goals.prevMonth ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    الشهر الماضي: {data.goals.prevMonth.toLocaleString("en-US")} دج
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Input
                    value={target} onChange={(e) => setTarget(e.target.value)} inputMode="numeric"
                    placeholder="الهدف" className="h-8 w-28 text-sm"
                  />
                  <Button size="sm" variant="outline" className="h-8" disabled={savingTarget} onClick={saveTarget}>
                    {savingTarget ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "حفظ"}
                  </Button>
                </div>
              </div>
              {data.goals.target > 0 && (
                <div className="space-y-1">
                  <Progress value={goalPct} className="h-2.5" />
                  <p className="text-xs text-muted-foreground text-left">
                    {goalPct}% من {data.goals.target.toLocaleString("en-US")} دج
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ═══ 5) الجدول الأسبوعي — سعة الحصص (بالتوقيت حسب الأيام لكل منخرط) ═══ */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-5 w-5 text-teal-600" /> الجدول الأسبوعي — سعة الحصص
            <span className="text-xs font-normal text-muted-foreground">(بالتوقيت — حسب الأيام لكل منخرط)</span>
          </CardTitle>
          <Button size="sm" variant="outline" className="h-8" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5 ml-1" /> طباعة
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* ─── ابحث عن منخرط: أبرز جدوله عبر أيام الأسبوع ─── */}
          <div className="rounded-xl border border-teal-500/25 bg-teal-500/5 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs font-bold flex items-center gap-1.5">
                <UserSearch className="h-4 w-4 text-teal-600" />
                جدول منخرط حسب الأيام والتوقيت
              </p>
              {pickedSub && (
                <Button
                  size="sm" variant="ghost" className="h-7 text-xs"
                  onClick={() => { setPickedId(null); setPickQuery(""); }}
                >
                  <X className="h-3.5 w-3.5 ml-1" /> إلغاء الإبراز
                </Button>
              )}
            </div>
            {!pickedSub ? (
              <div className="relative">
                <Input
                  value={pickQuery}
                  onChange={(e) => setPickQuery(e.target.value)}
                  placeholder="اكتب اسم المنخرط لعرض أيامه وتوقيته…"
                  className="h-9 bg-background"
                  aria-label="البحث عن منخرط"
                />
                {pickQuery.trim().length > 0 && (
                  <div className="absolute z-20 mt-1 inset-x-0 rounded-xl border bg-popover shadow-lg max-h-48 overflow-y-auto">
                    {pickMatches.length === 0 ? (
                      <p className="px-3 py-2.5 text-xs text-muted-foreground text-center">لا توجد نتائج مطابقة</p>
                    ) : pickMatches.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className="w-full text-right px-3 py-2 text-sm hover:bg-accent flex items-center justify-between gap-2 transition"
                        onClick={() => setPickedId(r.id)}
                      >
                        <span className="truncate font-medium">{r.name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0" dir="ltr">{r.slot}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge className="bg-teal-600 text-white border-0 text-xs">{pickedSub.name}</Badge>
                <span className="text-[11px] text-muted-foreground">أيام السباحة:</span>
                {(pickedSub.days.length ? pickedSub.days : [0, 1, 2, 3, 4, 5, 6]).map((d) => (
                  <Badge key={d} variant="outline" className="text-[10px]">{DAY_NAMES[d]}</Badge>
                ))}
                <span className="text-[11px] text-muted-foreground">— التوقيت:</span>
                <Badge variant="outline" className="text-[10px] border-teal-400 text-teal-700 dark:text-teal-400" dir="ltr">
                  {pickedSub.slot}
                </Badge>
              </div>
            )}
          </div>

          {/* ─── شبكة الأيام: كل فترة قابلة للتوسيع لعرض منخرطيها ─── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 items-start">
            {data.schedule.map((d, di) => (
              <div
                key={d.day}
                className={cn(
                  "rounded-xl border p-2.5 space-y-1.5 transition",
                  pickedSub && !pickedSub.days.includes(di) ? "border-border/40 opacity-40" : "border-border/60"
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold">{d.day}</p>
                  <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums", dayBadgeClass(d))}>
                    {d.total || "—"}{d.total > 0 && d.capacity > 0 ? `/${d.capacity}` : ""}
                  </span>
                </div>
                {d.slots.length === 0 && (
                  <p className="text-[10px] text-muted-foreground">لا حصص</p>
                )}
                {d.slots.map((s) => {
                  const key = `${di}|${s.slot}`;
                  const st = slotStatus(s.count, s.capacity);
                  const isExpanded = expandedSlot === key;
                  const isMine = pickedSub ? pickedSub.slot === s.slot && pickedSub.days.includes(di) : false;
                  const dimmed = Boolean(pickedSub) && !isMine;
                  return (
                    <div key={key} className={cn("space-y-1 transition", dimmed && "opacity-40")}>
                      <button
                        type="button"
                        onClick={() => setExpandedSlot(isExpanded ? null : key)}
                        aria-expanded={isExpanded}
                        aria-label={`${s.slot} — ${s.count} منخرط`}
                        className={cn(
                          "w-full text-right rounded-lg border px-1.5 py-1 transition hover:bg-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500",
                          isExpanded ? "bg-accent/60 border-teal-400/50" : "border-transparent",
                          isMine && "ring-2 ring-teal-500 bg-teal-500/10"
                        )}
                      >
                        <span className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-medium truncate flex items-center gap-1">
                            {s.slot !== "غير محدد" && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", STATUS_DOT[st])} />}
                            <span dir="ltr">{s.slot}</span>
                          </span>
                          <span className={cn("text-[10px] font-bold tabular-nums shrink-0 flex items-center gap-0.5", STATUS_TEXT[st])}>
                            {s.count}{s.capacity > 0 ? `/${s.capacity}` : ""}
                            <ChevronDown className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-180")} />
                          </span>
                        </span>
                        {s.capacity > 0 && (
                          <span className="block mt-1 h-1 rounded-full bg-muted/70 overflow-hidden">
                            <span
                              className={cn("block h-full rounded-full transition-all", STATUS_BAR[st])}
                              style={{ width: `${Math.min(100, (s.count / s.capacity) * 100)}%` }}
                            />
                          </span>
                        )}
                      </button>
                      {isExpanded && (
                        <div className="rounded-lg bg-muted/40 border border-border/50 p-1.5 space-y-0.5 max-h-44 overflow-y-auto">
                          {s.subscribers.map((sub) => (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => { setPickedId(sub.id); setPickQuery(""); }}
                              title="انقر لإبراز جدول هذا المنخرط"
                              className="w-full text-right flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-accent/70 transition focus:outline-none focus-visible:ring-1 focus-visible:ring-teal-500"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-teal-500/70 shrink-0" />
                              <span className="text-[10px] font-medium truncate flex-1">{sub.name}</span>
                              <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">{sub.fileNumber}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-teal-500" /> متاح</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> قريب من الامتلاء (80٪+)</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> ممتلئ</span>
            <span className="flex items-center gap-1"><ChevronDown className="h-3 w-3" /> انقر على الفترة لعرض أسماء منخرطيها</span>
          </div>
        </CardContent>
      </Card>

      {/* ═══ 6) المساعد الذكي — محادثة أسئلة وأجوبة حسب إحصائيات النادي ═══ */}
      <Card className="border-teal-200/60 dark:border-teal-900/40">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-teal-600" /> المساعد الذكي
              <span className="text-xs font-normal text-muted-foreground">(اسأله عن أي شيء في ناديك — يجيب حسب إحصائياته)</span>
            </CardTitle>
            {chat.length > 0 && (
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setChat([])}>
                <RotateCcw className="h-3.5 w-3.5 ml-1" /> محادثة جديدة
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            ref={chatBoxRef}
            className="rounded-xl border bg-muted/20 p-3 space-y-2.5 max-h-96 overflow-y-auto min-h-[140px]"
            aria-live="polite"
            aria-label="محادثة المساعد الذكي"
          >
            {chat.length === 0 && (
              <div className="text-center py-4 space-y-3">
                <p className="text-xs text-muted-foreground">جرّب أحد هذه الأسئلة أو اكتب سؤالك أدناه:</p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {CHAT_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => sendChat(s)}
                      className="text-[11px] rounded-full border border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-300 px-3 py-1.5 hover:bg-teal-500/20 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chat.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-start" : "justify-end")}>
                <div
                  className={cn(
                    "px-3 py-2 text-sm whitespace-pre-wrap leading-7",
                    m.role === "user"
                      ? "bg-teal-600 text-white rounded-2xl rounded-tl-md max-w-[85%]"
                      : "bg-background border rounded-2xl rounded-tr-md max-w-[92%]"
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-end">
                <div className="bg-background border rounded-2xl rounded-tr-md px-4 py-3 flex items-center gap-1" aria-label="المساعد يكتب…">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-bounce"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendChat();
                }
              }}
              placeholder="اكتب سؤالك… مثال: كم منخرطاً لم يدفع هذا الشهر؟"
              disabled={chatLoading}
              aria-label="سؤالك للمساعد الذكي"
            />
            <Button
              size="icon"
              className="h-9 w-9 shrink-0 bg-teal-600 hover:bg-teal-700 text-white"
              disabled={chatLoading || !chatInput.trim()}
              onClick={() => sendChat()}
              aria-label="إرسال السؤال"
            >
              {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

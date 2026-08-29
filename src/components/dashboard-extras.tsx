"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  LifeBuoy, Flame, Trophy, Target, CalendarDays, Sparkles, Loader2,
  MessageCircle, RefreshCw, TrendingUp, TrendingDown, Users, Printer,
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
interface Extras {
  churn: ChurnItem[];
  heatmap: number[][];
  heatHoursStart: number;
  topDays: { date: string; count: number }[];
  goals: { target: number; achieved: number; prevMonth: number; monthName: string };
  schedule: { day: string; total: number; slots: { slot: string; count: number }[] }[];
}

const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export function DashboardExtras() {
  const [data, setData] = useState<Extras | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [target, setTarget] = useState("");
  const [savingTarget, setSavingTarget] = useState(false);
  const [insights, setInsights] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);

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

  const askAI = async () => {
    setAiLoading(true); setInsights("");
    try {
      const res = await fetch("/api/ai/insights", { method: "POST" });
      const d = await res.json();
      if (res.ok) setInsights(d.insights);
      else toast.error(d.error || "تعذر التحليل");
    } catch { toast.error("خطأ في الاتصال"); }
    finally { setAiLoading(false); }
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

      {/* ═══ 5) الجدول الأسبوعي — سعة الحصص ═══ */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-5 w-5 text-teal-600" /> الجدول الأسبوعي — سعة الحصص
            <span className="text-xs font-normal text-muted-foreground">(حسب توزيع المنخرطين)</span>
          </CardTitle>
          <Button size="sm" variant="outline" className="h-8" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5 ml-1" /> طباعة
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {data.schedule.map((d) => (
              <div key={d.day} className="rounded-xl border border-border/60 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold">{d.day}</p>
                  <span className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                    d.total === 0 ? "bg-muted text-muted-foreground"
                      : d.total >= 30 ? "bg-rose-500/15 text-rose-600"
                      : d.total >= 16 ? "bg-amber-500/15 text-amber-600"
                      : "bg-teal-500/15 text-teal-700"
                  )}>
                    {d.total || "—"}
                  </span>
                </div>
                {d.slots.slice(0, 3).map((s) => (
                  <div key={s.slot} className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="truncate">{s.slot}</span>
                    <span className={cn("font-bold tabular-nums", s.count >= 12 ? "text-rose-500" : "text-teal-600")}>{s.count}</span>
                  </div>
                ))}
                {d.slots.length > 3 && (
                  <p className="text-[9px] text-muted-foreground">+{d.slots.length - 3} فترات أخرى</p>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-teal-500" /> متاح</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> قريب من الامتلاء</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> ممتلئ</span>
          </div>
        </CardContent>
      </Card>

      {/* ═══ 6) المساعد الذكي ═══ */}
      <Card className="border-teal-200/60 dark:border-teal-900/40">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-teal-600" /> المساعد الذكي
            </CardTitle>
            <Button size="sm" className="h-8 bg-teal-600 hover:bg-teal-700 text-white" disabled={aiLoading} onClick={askAI}>
              {aiLoading ? <Loader2 className="h-3.5 w-3.5 ml-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 ml-1" />}
              حلّل أداء النادي
            </Button>
          </div>
        </CardHeader>
        {insights && (
          <CardContent>
            <div className="rounded-xl bg-teal-500/5 border border-teal-500/20 p-4 text-sm leading-7 whitespace-pre-wrap">
              {insights}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

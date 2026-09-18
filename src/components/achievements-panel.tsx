"use client";

/**
 * ═══════════════════════════════════════════════════════════════
 *  الإنجازات والمكافآت — لوحة التحفيز (Gamification Panel)
 * ═══════════════════════════════════════════════════════════════
 *  منصة التتويج (أفضل 3) + لوحة الترتيب + توزيع المستويات + كتالوج
 *  الأوسمة (على مستوى النادي أو منخرط محدد بالنقر على صف).
 *  تعتمد على: /api/achievements و /api/achievements?subscriberId=
 */

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Activity,
  Award,
  CalendarCheck,
  Crown,
  Flame,
  Lock,
  Medal,
  RefreshCw,
  Sparkles,
  Star,
  TrendingUp,
  TriangleAlert,
  Trophy,
  Users,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ─── أنواع استجابة الـ API ─────────────────────────────────────

interface LevelInfo {
  label: string;
  color: string;
}

interface LeaderEntry {
  subscriberId: string;
  name: string;
  fileNumber: string;
  total: number;
  monthlyTotal: number;
  currentStreak: number;
  level: LevelInfo;
  badges: { id: string; label: string; icon: string }[];
}

interface DistributionRow {
  level: string;
  count: number;
  color: string;
}

interface ClubStats {
  totalSubscribers: number;
  activeThisWeek: number;
  avgAttendance: number;
}

interface CatalogBadge {
  id: string;
  label: string;
  icon: string;
  description: string;
  threshold: number;
  unlockedCount: number;
  unlockRate: number;
}

interface AchievementsData {
  enabled?: boolean;
  leaderboard: LeaderEntry[];
  distribution: DistributionRow[];
  stats: ClubStats;
  myTop: LeaderEntry[];
  badgeCatalog: CatalogBadge[];
}

interface DetailBadge {
  id: string;
  label: string;
  icon: string;
  description: string;
  unlocked: boolean;
  progress: number;
  next: number | null;
  value: number;
}

interface DetailData {
  enabled?: boolean;
  subscriber: { id: string; name: string; fileNumber: string };
  achievements: {
    total: number;
    currentStreak: number;
    longestStreak: number;
    monthlyTotal: number;
    level: LevelInfo;
    badges: DetailBadge[];
  } | null;
}

// ─── أيقونات الأوسمة (أسماء lucide من الـ API → مكونات) ────────

const BADGE_ICONS: Record<string, LucideIcon> = {
  Award,
  CalendarCheck,
  Medal,
  Crown,
  Star,
  Flame,
  Zap,
  Waves,
};

function BadgeIcon({ name, className }: { name: string; className?: string }) {
  const Icon = BADGE_ICONS[name] ?? Award;
  return <Icon className={className} aria-hidden="true" />;
}

// ─── تنسيقات المساعدات ─────────────────────────────────────────

const MEDALS = [
  {
    rank: "🥇",
    label: "المركز الأول",
    card:
      "border-amber-300/70 bg-gradient-to-br from-amber-50 via-yellow-50 to-white dark:border-amber-500/30 dark:from-amber-500/10 dark:via-yellow-500/5 dark:to-transparent lg:-translate-y-2 shadow-lg shadow-amber-500/10",
    circle:
      "bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 text-amber-950 shadow-lg shadow-amber-500/40",
  },
  {
    rank: "🥈",
    label: "المركز الثاني",
    card:
      "border-slate-300/70 bg-gradient-to-br from-slate-50 to-white dark:border-slate-600/40 dark:from-slate-500/10 dark:to-transparent",
    circle:
      "bg-gradient-to-br from-slate-200 via-slate-300 to-slate-500 text-slate-800 shadow-md shadow-slate-400/30",
  },
  {
    rank: "🥉",
    label: "المركز الثالث",
    card:
      "border-orange-300/60 bg-gradient-to-br from-orange-50 to-white dark:border-orange-500/30 dark:from-orange-500/10 dark:to-transparent",
    circle:
      "bg-gradient-to-br from-orange-300 via-orange-400 to-amber-700 text-orange-950 shadow-md shadow-orange-500/30",
  },
] as const;

const RANK_EMOJIS = ["🥇", "🥈", "🥉"];

/** ألوان أشرطة التوزيع لكل مستوى (فئات ثابتة يولّدها Tailwind وقت البناء) */
const LEVEL_BAR_CLASSES: Record<string, string> = {
  "مبتدئ": "[&_[data-slot=progress-indicator]]:bg-slate-500",
  "متوسط": "[&_[data-slot=progress-indicator]]:bg-sky-500",
  "متقدم": "[&_[data-slot=progress-indicator]]:bg-violet-500",
  "بطل": "[&_[data-slot=progress-indicator]]:bg-amber-500",
};

const SCROLLBAR_CLASSES =
  "[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700";

// ─── شارة المستوى ──────────────────────────────────────────────

function LevelBadge({ level, className }: { level: LevelInfo; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-bold", className)}
      style={{
        color: level.color,
        borderColor: `${level.color}66`,
        backgroundColor: `${level.color}1A`,
      }}
    >
      {level.label}
    </Badge>
  );
}

// ─── المكوّن الرئيسي ───────────────────────────────────────────

export function AchievementsPanel() {
  const [data, setData] = useState<AchievementsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/achievements", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `فشل التحميل (${res.status})`);
      }
      setData((await res.json()) as AchievementsData);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "خطأ غير متوقع";
      setError(msg);
      toast.error("تعذر تحميل الإنجازات", { description: msg });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openSubscriber = useCallback(
    async (subscriberId: string, name: string) => {
      setSelected({ id: subscriberId, name });
      setDetail(null);
      setDetailLoading(true);
      try {
        const res = await fetch(
          `/api/achievements?subscriberId=${encodeURIComponent(subscriberId)}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `فشل التحميل (${res.status})`);
        }
        setDetail((await res.json()) as DetailData);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "خطأ غير متوقع";
        toast.error("تعذر تحميل إنجازات المنخرط", { description: msg });
        setSelected(null);
      } finally {
        setDetailLoading(false);
      }
    },
    []
  );

  const clearSelection = useCallback(() => {
    setSelected(null);
    setDetail(null);
  }, []);

  // ─── حالات العرض ─────────────────────────────────────────────

  if (loading && !data) return <LoadingSkeleton />;
  if (error && !data) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return null;

  // 🧩 الميزة معطلة من الإعدادات ← الميزات — بطاقة إشعار بدل اللوحة
  if (data.enabled === false) {
    return (
      <div className="flex flex-col gap-4" dir="rtl">
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6 text-center space-y-2">
          <div className="text-4xl">🏆</div>
          <h3 className="font-bold text-base text-amber-700 dark:text-amber-300">نظام الإنجازات معطّل حالياً</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            قام الإداري بإيقاف الميزة. يمكنك تفعيلها في أي وقت من:
            الإعدادات ← تبويب «🧩 الميزات» ← «الإنجازات والتحفيز».
          </p>
        </div>
      </div>
    );
  }

  const podium = data.myTop ?? [];
  const isEmpty = data.leaderboard.length === 0;

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {/* ─── الترويسة ─── */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30">
            <Trophy className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">
              🏆 الإنجازات والمكافآت
            </h2>
            <p className="text-sm text-muted-foreground">
              لوحة شرف المنخرطين — المستويات والأوسمة والسلاسل الأسبوعية
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
          className="min-h-[44px] sm:min-h-0"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden="true" />
          تحديث
        </Button>
      </motion.section>

      {/* ─── بطاقات الإحصائيات ─── */}
      <section
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        aria-label="إحصائيات عامة"
      >
        {[
          {
            label: "إجمالي المنخرطين",
            value: data.stats.totalSubscribers,
            hint: "بموازير نشطة",
            icon: Users,
            tone: "bg-sky-100 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400",
          },
          {
            label: "نشط هذا الأسبوع",
            value: data.stats.activeThisWeek,
            hint: "حضور واحد على الأقل",
            icon: Activity,
            tone: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
          },
          {
            label: "متوسط الحضور",
            value: data.stats.avgAttendance,
            hint: "حصة لكل منخرط (6 أشهر)",
            icon: TrendingUp,
            tone: "bg-violet-100 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400",
          },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 * i }}
          >
            <Card className="gap-0 py-4">
              <CardContent className="flex items-center gap-4 px-4">
                <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", s.tone)}>
                  <s.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-extrabold tabular-nums">{s.value}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{s.hint}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </section>

      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          {/* ─── منصة التتويج (أفضل 3) ─── */}
          <section aria-label="منصة التتويج" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {podium.map((entry, i) => {
              const medal = MEDALS[i] ?? MEDALS[2];
              return (
                <motion.div
                  key={entry.subscriberId}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
                  whileHover={{ y: -3 }}
                >
                  <Card className={cn("relative h-full", medal.card)}>
                    {i === 0 && (
                      <Crown
                        className="absolute left-3 top-3 h-5 w-5 text-amber-500/70"
                        aria-hidden="true"
                      />
                    )}
                    <CardContent className="flex h-full flex-col items-center gap-3 p-6 text-center">
                      <div className={cn("flex h-14 w-14 items-center justify-center rounded-full", medal.circle)}>
                        <Medal className="h-7 w-7" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-muted-foreground">{medal.label} {medal.rank}</p>
                        <p className="mt-0.5 truncate text-lg font-extrabold">{entry.name}</p>
                        <p className="text-xs text-muted-foreground" dir="ltr">{entry.fileNumber}</p>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-4xl font-black tabular-nums" style={{ color: entry.level.color }}>
                          {entry.total}
                        </span>
                        <span className="text-xs text-muted-foreground">حصة حضور</span>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        <LevelBadge level={entry.level} />
                        {entry.currentStreak > 0 && (
                          <Badge
                            variant="outline"
                            className="border-orange-300/60 bg-orange-50 font-bold text-orange-600 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-400"
                          >
                            <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                            {entry.currentStreak} {entry.currentStreak === 1 ? "أسبوع" : "أسابيع"} متتالية
                          </Badge>
                        )}
                      </div>
                      {entry.badges.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                          {entry.badges.slice(0, 6).map((b) => (
                            <span
                              key={b.id}
                              title={b.label}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
                            >
                              <BadgeIcon name={b.icon} className="h-3.5 w-3.5" />
                            </span>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </section>

          {/* ─── لوحة الترتيب ─── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-4 w-4 text-amber-500" aria-hidden="true" />
                  لوحة الترتيب — أفضل 10
                </CardTitle>
                <CardDescription>
                  انقر على أي صف لعرض أوسمة ذلك المنخرط وتقدمه بالتفصيل
                </CardDescription>
              </CardHeader>
              <CardContent className="p-2 sm:p-4">
                <div className={cn("max-h-96 overflow-y-auto overflow-x-auto rounded-lg border", SCROLLBAR_CLASSES)}>
                  <Table className="min-w-[640px]">
                    <TableCaption className="sr-only">لوحة ترتيب المنخرطين حسب الحضور</TableCaption>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow>
                        <TableHead className="w-14 text-center">#</TableHead>
                        <TableHead>الاسم</TableHead>
                        <TableHead className="text-center">رقم الملف</TableHead>
                        <TableHead className="text-center">الحضور</TableHead>
                        <TableHead className="text-center">السلسلة</TableHead>
                        <TableHead className="text-center">المستوى</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.leaderboard.map((entry, i) => (
                        <TableRow
                          key={entry.subscriberId}
                          tabIndex={0}
                          title={`عرض إنجازات ${entry.name}`}
                          onClick={() => openSubscriber(entry.subscriberId, entry.name)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openSubscriber(entry.subscriberId, entry.name);
                            }
                          }}
                          className={cn(
                            "cursor-pointer select-none",
                            selected?.id === entry.subscriberId && "bg-amber-50/70 dark:bg-amber-500/10"
                          )}
                        >
                          <TableCell className="text-center text-sm font-bold tabular-nums">
                            {i < 3 ? RANK_EMOJIS[i] : i + 1}
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate font-semibold">
                            {entry.name}
                          </TableCell>
                          <TableCell className="text-center text-xs tabular-nums text-muted-foreground" dir="ltr">
                            {entry.fileNumber}
                          </TableCell>
                          <TableCell className="text-center font-bold tabular-nums">{entry.total}</TableCell>
                          <TableCell className="text-center">
                            {entry.currentStreak > 0 ? (
                              <span className="inline-flex items-center gap-1 font-bold text-orange-500">
                                <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                                {entry.currentStreak}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <LevelBadge level={entry.level} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* ─── توزيع المستويات ─── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.25 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-violet-500" aria-hidden="true" />
                  توزيع المستويات
                </CardTitle>
                <CardDescription>كم منخرطاً وصل لكل مستوى حسب إجمالي الحضور</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 p-4 pt-0 sm:p-6 sm:pt-0">
                {data.distribution.map((row) => {
                  const maxCount = Math.max(...data.distribution.map((r) => r.count), 1);
                  const pct = Math.round((row.count / maxCount) * 100);
                  return (
                    <div key={row.level} className="flex items-center gap-3">
                      <span className="flex w-20 shrink-0 items-center gap-1.5 text-sm font-bold">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                        {row.level}
                      </span>
                      <Progress
                        value={pct}
                        aria-label={`${row.level}: ${row.count} منخرط`}
                        className={cn("h-2.5 flex-1 -scale-x-100", LEVEL_BAR_CLASSES[row.level])}
                      />
                      <span className="w-10 shrink-0 text-left text-sm font-extrabold tabular-nums" style={{ color: row.color }}>
                        {row.count}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </motion.section>
        </>
      )}

      {/* ─── كتالوج الأوسمة ─── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.3 }}
      >
        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Medal className="h-4 w-4 text-amber-500" aria-hidden="true" />
                  كتالوج الأوسمة
                </CardTitle>
                <CardDescription className="mt-1">
                  {detail
                    ? `أوسمة ${detail.subscriber.name} وتقدمها نحو الأوسمة المقفلة`
                    : "نسبة المنخرطين الذين فتحوا كل وسام على مستوى النادي"}
                </CardDescription>
              </div>
              {selected && (
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  عرض كتالوج النادي
                </Button>
              )}
            </div>
            {selected && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200/70 bg-amber-50/60 px-3 py-2 text-sm dark:border-amber-500/20 dark:bg-amber-500/5">
                <BadgeIcon name={detail?.achievements?.badges.find((b) => b.unlocked)?.icon ?? "Award"} className="h-4 w-4 text-amber-500" />
                <span className="font-bold">العرض الحالي: {selected.name}</span>
                {detail?.achievements && (
                  <span className="text-xs text-muted-foreground">
                    — إجمالي الحضور {detail.achievements.total} حصة • أطول سلسلة {detail.achievements.longestStreak}{" "}
                    {detail.achievements.longestStreak === 1 ? "أسبوع" : "أسابيع"}
                  </span>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            {detailLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {buildCatalogItems(data, detail).map((item) => (
                  <BadgeCatalogCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.section>
    </div>
  );
}

// ─── عناصر مساعدة ──────────────────────────────────────────────

interface CatalogItem {
  id: string;
  label: string;
  icon: string;
  description: string;
  unlocked: boolean;
  progress: number;
  caption: string;
}

function buildCatalogItems(data: AchievementsData, detail: DetailData | null): CatalogItem[] {
  if (detail) {
    return detail.achievements?.badges.map((b) => ({
      id: b.id,
      label: b.label,
      icon: b.icon,
      description: b.description,
      unlocked: b.unlocked,
      progress: b.progress,
      caption: b.unlocked
        ? "مفتوح ✓"
        : b.next
          ? `التقدم: ${b.value} / ${b.next}`
          : "—",
    })) ?? [];
  }
  return data.badgeCatalog.map((b) => ({
    id: b.id,
    label: b.label,
    icon: b.icon,
    description: b.description,
    unlocked: b.unlockedCount > 0,
    progress: b.unlockRate,
    caption:
      b.unlockedCount > 0
        ? `فتحه ${b.unlockedCount} منخرطاً (${b.unlockRate}%)`
        : "لم يفتحه أحد بعد",
  }));
}

function BadgeCatalogCard({ item }: { item: CatalogItem }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-all",
        item.unlocked
          ? "border-amber-300/70 bg-gradient-to-br from-amber-50/80 to-white shadow-sm dark:border-amber-500/25 dark:from-amber-500/10 dark:to-transparent"
          : "border-dashed border-slate-300 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-900/40"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
            item.unlocked
              ? "bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 text-white shadow"
              : "bg-slate-200 text-slate-400 grayscale dark:bg-slate-800 dark:text-slate-500"
          )}
        >
          <BadgeIcon name={item.icon} className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className={cn("text-sm font-bold", !item.unlocked && "text-slate-500 dark:text-slate-400")}>
              {item.label}
            </p>
            {item.unlocked ? (
              <Badge
                variant="outline"
                className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
              >
                مفتوح
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-slate-300 text-slate-400 dark:border-slate-700"
              >
                <Lock className="h-3 w-3" aria-hidden="true" />
                مقفل
              </Badge>
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <Progress
          value={item.progress}
          aria-label={`${item.label}: ${item.progress}%`}
          className={cn(
            "h-1.5 -scale-x-100",
            item.unlocked
              ? "[&_[data-slot=progress-indicator]]:bg-emerald-500"
              : "[&_[data-slot=progress-indicator]]:bg-slate-400"
          )}
        />
        <p className="text-[11px] font-medium text-muted-foreground">{item.caption}</p>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6" dir="rtl" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div dir="rtl" className="flex items-center justify-center py-10">
      <Card className="w-full max-w-md border-destructive/30">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400">
            <TriangleAlert className="h-7 w-7" aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-bold">تعذر تحميل الإنجازات</p>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          </div>
          <Button onClick={onRetry} className="min-h-[44px]">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            إعادة المحاولة
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState() {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }}>
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-500 dark:bg-amber-500/10 dark:text-amber-400">
            <Sparkles className="h-8 w-8" aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-bold">لا توجد بيانات كافية بعد</p>
            <p className="mt-1 text-sm text-muted-foreground">
              سجل الحضور أولاً — ستظهر منصة التتويج ولوحة الترتيب تلقائياً مع أول تسجيلات
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default AchievementsPanel;

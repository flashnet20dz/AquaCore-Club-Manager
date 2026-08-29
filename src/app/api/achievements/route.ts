import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { rateLimit, incrementRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  computeAchievements,
  getLevelForTotal,
  ACHIEVEMENT_LEVELS,
  BADGE_CATALOG,
  startOfWeek,
} from "@/lib/achievements";

// 🔒 حد المعدل: 60 طلباً كحد أقصى لكل IP في الدقيقة
const RL_OPTIONS = { max: 60, windowMs: 60 * 1000 };

export async function GET(req: NextRequest) {
  try {
    const rlKey = `achievements:${getClientIp(req)}`;
    const rl = rateLimit(rlKey, RL_OPTIONS);
    if (rl.blocked) {
      const retrySec = rl.lockoutRemaining || RL_OPTIONS.windowMs / 1000;
      return NextResponse.json(
        { error: `عدد كبير من الطلبات. أعد المحاولة بعد ${Math.ceil(retrySec / 60) || 1} دقيقة.` },
        { status: 429, headers: { "Retry-After": String(Math.ceil(retrySec)) } }
      );
    }
    incrementRateLimit(rlKey, RL_OPTIONS);

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const clubFilter =
      currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };

    // ─── وضع المنخرط الواحد: /api/achievements?subscriberId=... ───
    const subscriberId = req.nextUrl.searchParams.get("subscriberId");
    if (subscriberId) {
      const subscriber = await db.subscriber.findFirst({
        where: { id: subscriberId, ...clubFilter, deletedAt: null },
        select: { id: true, firstName: true, lastName: true, fileNumber: true },
      });
      if (!subscriber) {
        return NextResponse.json({ error: "المنخرط غير موجود" }, { status: 404 });
      }

      const attendances = await db.attendance.findMany({
        where: { subscriberId, ...clubFilter },
        select: { date: true },
        orderBy: { date: "asc" },
      });

      const achievements = computeAchievements({
        attendances: attendances.map((a) => a.date),
      });

      return NextResponse.json({
        subscriber: {
          id: subscriber.id,
          name: `${subscriber.lastName} ${subscriber.firstName}`.trim(),
          fileNumber: subscriber.fileNumber,
        },
        achievements,
      });
    }

    // ─── الوضع العام: لوحة الترتيب + التوزيع + الإحصائيات ───
    // آخر 6 أشهر فقط لأداء أفضل (السلاسل والشهادات الحديثة هي المؤثرة)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const [subscribers, attendanceRecords] = await Promise.all([
      db.subscriber.findMany({
        where: { ...clubFilter, deletedAt: null },
        select: { id: true, firstName: true, lastName: true, fileNumber: true },
      }),
      db.attendance.findMany({
        where: { ...clubFilter, date: { gte: sixMonthsAgo } },
        select: { subscriberId: true, date: true },
        orderBy: { date: "asc" },
      }),
    ]);

    // تجميع تواريخ الحضور لكل منخرط
    const bySubscriber = new Map<string, Date[]>();
    for (const rec of attendanceRecords) {
      const list = bySubscriber.get(rec.subscriberId);
      if (list) list.push(rec.date);
      else bySubscriber.set(rec.subscriberId, [rec.date]);
    }

    // نشط هذا الأسبوع: منخرط لديه حضور واحد على الأقل منذ الاثنين
    const currentWeekStart = startOfWeek(new Date()).getTime();
    let activeThisWeek = 0;
    for (const dates of bySubscriber.values()) {
      if (dates.some((d) => startOfWeek(d).getTime() === currentWeekStart)) {
        activeThisWeek++;
      }
    }

    const entries = subscribers.map((s) => {
      const ach = computeAchievements({
        attendances: bySubscriber.get(s.id) ?? [],
      });
      return {
        subscriberId: s.id,
        name: `${s.lastName} ${s.firstName}`.trim(),
        fileNumber: s.fileNumber,
        total: ach.total,
        monthlyTotal: ach.monthlyTotal,
        currentStreak: ach.currentStreak,
        level: ach.level,
        badges: ach.badges
          .filter((b) => b.unlocked)
          .map((b) => ({ id: b.id, label: b.label, icon: b.icon })),
      };
    });

    entries.sort(
      (a, b) =>
        b.total - a.total ||
        b.currentStreak - a.currentStreak ||
        b.monthlyTotal - a.monthlyTotal ||
        a.name.localeCompare(b.name, "ar")
    );

    const leaderboard = entries.slice(0, 10);
    const myTop = entries.slice(0, 3);

    const distribution = ACHIEVEMENT_LEVELS.map((l) => ({
      level: l.label,
      count: entries.filter((e) => getLevelForTotal(e.total).label === l.label)
        .length,
      color: l.color,
    }));

    const badgeCatalog = BADGE_CATALOG.map((def) => {
      const unlockedCount = entries.filter((e) =>
        e.badges.some((b) => b.id === def.id)
      ).length;
      return {
        id: def.id,
        label: def.label,
        icon: def.icon,
        description: def.description,
        threshold: def.threshold,
        unlockedCount,
        unlockRate: entries.length
          ? Math.round((unlockedCount / entries.length) * 100)
          : 0,
      };
    });

    const totalSubscribers = subscribers.length;
    const stats = {
      totalSubscribers,
      activeThisWeek,
      avgAttendance: totalSubscribers
        ? Math.round((attendanceRecords.length / totalSubscribers) * 10) / 10
        : 0,
    };

    return NextResponse.json({
      leaderboard,
      distribution,
      stats,
      myTop,
      badgeCatalog,
    });
  } catch (e) {
    console.error("Achievements:", e);
    return NextResponse.json({ error: "خطأ داخلي في الخادم" }, { status: 500 });
  }
}

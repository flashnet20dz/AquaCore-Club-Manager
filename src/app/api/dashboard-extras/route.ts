import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { calculateExpiryDate, getTypeConfig, parseSwimmingDays } from "@/lib/rcs";

/**
 * GET /api/dashboard-extras
 * بيانات لوحة التحكم 2.0:
 *  - churn: قائمة "أنقذ هؤلاء" (منخرطون غائبون بخطر تسرب)
 *  - heatmap: خريطة حرارة الحضور (يوم × ساعة) آخر 60 يوماً
 *  - topDays: أفضل 5 أيام إقبالاً (آخر 90 يوماً)
 *  - goals: الهدف الشهري مقابل المحقق
 *  - weeklySchedule: توزيع المنخرطين على الأيام والفترات (سعة الحصص)
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }
    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const clubId = currentUser.clubId;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ─── 1) المنخرطون + آخر حضور ───
    const subscribers = await db.subscriber.findMany({
      where: { ...clubFilter, deletedAt: null },
      select: {
        id: true, clubId: true, firstName: true, lastName: true, fileNumber: true,
        phone: true, paymentStatus: true, lastPaymentDate: true, subscriptionType: true,
        swimmingDays: true, timeSlot: true,
      },
    });

    const since120 = new Date(today);
    since120.setDate(since120.getDate() - 120);

    const lastAtt = await db.attendance.groupBy({
      by: ["subscriberId"],
      where: { ...(clubId ? { clubId } : {}), date: { gte: since120 } },
      _max: { date: true },
    });
    const lastAttMap = new Map(lastAtt.map((r) => [r.subscriberId, r._max.date]));

    const dayMs = 86400000;
    const churn = subscribers
      .map((s) => {
        const last = lastAttMap.get(s.id);
        const daysAbsent = last ? Math.floor((today.getTime() - new Date(last).getTime()) / dayMs) : 999;
        const expiry = s.lastPaymentDate
          ? calculateExpiryDate(new Date(s.lastPaymentDate), getTypeConfig(s.subscriptionType).durationDays)
          : null;
        const daysLeft = expiry ? Math.ceil((expiry.getTime() - today.getTime()) / dayMs) : null;

        let risk: "high" | "medium" | null = null;
        if (daysAbsent >= 21) risk = "high";
        else if (daysAbsent >= 14) risk = "medium";
        if (s.paymentStatus === "لم يدفع") risk = risk === "high" ? "high" : "medium";
        if (daysLeft !== null && daysLeft < 0 && daysLeft > -30 && risk === null) risk = "medium";

        return {
          subscriberId: s.id,
          name: `${s.lastName} ${s.firstName}`,
          fileNumber: s.fileNumber,
          phone: s.phone,
          daysAbsent,
          expiryDate: expiry ? expiry.toISOString().split("T")[0] : null,
          daysLeft,
          risk,
        };
      })
      .filter((s) => s.risk !== null)
      .sort((a, b) => (b.risk === "high" ? 1 : 0) - (a.risk === "high" ? 1 : 0) || b.daysAbsent - a.daysAbsent)
      .slice(0, 20);

    // ─── 2) خريطة الحرارة (اليوم × ساعة 8-22) آخر 60 يوماً ───
    const since60 = new Date(today);
    since60.setDate(since60.getDate() - 60);
    const heatRaw = await db.attendance.findMany({
      where: { ...(clubId ? { clubId } : {}), date: { gte: since60 } },
      select: { date: true, checkInTime: true },
    });
    const HEAT_HOURS = 14; // 8:00 → 21:00
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(HEAT_HOURS).fill(0));
    for (const a of heatRaw) {
      const d = new Date(a.checkInTime || a.date);
      const dow = d.getDay(); // 0=الأحد
      const h = d.getHours();
      if (h >= 8 && h < 8 + HEAT_HOURS) heatmap[dow][h - 8]++;
    }

    // ─── 3) أفضل 5 أيام (آخر 90 يوماً) ───
    const since90 = new Date(today);
    since90.setDate(since90.getDate() - 90);
    const topRaw = await db.attendance.groupBy({
      by: ["date"],
      where: { ...(clubId ? { clubId } : {}), date: { gte: since90 } },
      _count: { _all: true },
      orderBy: { _count: { date: "desc" } },
      take: 5,
    });
    const topDays = topRaw.map((r) => ({
      date: new Date(r.date).toISOString().split("T")[0],
      count: r._count._all,
    }));

    // ─── 4) الأهداف: إيراد الشهر الحالي مقابل الهدف ───
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const targetSetting = clubId
      ? await db.setting.findFirst({ where: { clubId, key: "monthlyRevenueTarget" } })
      : null;
    const target = Number(targetSetting?.value || 0);

    const monthPayments = await db.payment.aggregate({
      where: {
        ...(clubId ? { clubId } : {}),
        date: { gte: monthStart },
      },
      _sum: { amount: true },
    });
    const prevPayments = await db.payment.aggregate({
      where: {
        ...(clubId ? { clubId } : {}),
        date: { gte: prevMonthStart, lt: monthStart },
      },
      _sum: { amount: true },
    });

    // ─── 5) الجدول الأسبوعي: توزيع المنخرطين (يوم × فترة) ───
    const DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    const schedule: { day: string; slots: { slot: string; count: number }[]; total: number }[] = DAYS.map((day) => ({
      day, slots: [], total: 0,
    }));
    for (const s of subscribers) {
      const days = parseSwimmingDays(s.swimmingDays);
      const slot = s.timeSlot || "غير محدد";
      for (const d of days) {
        if (d < 0 || d > 6) continue;
        const found = schedule[d].slots.find((x) => x.slot === slot);
        if (found) found.count++;
        else schedule[d].slots.push({ slot, count: 1 });
        schedule[d].total++;
      }
    }
    for (const day of schedule) day.slots.sort((a, b) => b.count - a.count);

    return NextResponse.json({
      churn,
      heatmap,
      heatHoursStart: 8,
      topDays,
      goals: {
        target,
        achieved: monthPayments._sum.amount || 0,
        prevMonth: prevPayments._sum.amount || 0,
        monthName: monthStart.toLocaleDateString("ar-DZ", { month: "long", year: "numeric" }),
      },
      schedule,
    });
  } catch (e) {
    console.error("GET dashboard-extras:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * GET /api/attendance/live
 * Returns:
 *  - currentlyInPool: count of subscribers who checked in today but not out
 *  - byGroup: count of currently-in-pool subscribers grouped by timeSlot
 *  - todayCount: total check-ins today
 * GET /api/attendance/heatmap?days=90
 * Returns:
 *  - matrix[dayOfWeek][hour] = count of check-ins in last N days
 */
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") || "live";
    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };

    if (mode === "heatmap") {
      const days = parseInt(url.searchParams.get("days") || "90", 10);
      const since = new Date();
      since.setDate(since.getDate() - days);
      since.setHours(0, 0, 0, 0);

      const records = await db.attendance.findMany({
        where: { ...clubFilter, checkInTime: { gte: since } },
        select: { checkInTime: true, subscriber: { select: { timeSlot: true } } },
      });

      // Matrix: 7 days × 24 hours
      const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
      const matrix: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
      const bySlot: Record<string, number> = {};

      for (const r of records) {
        const d = new Date(r.checkInTime);
        const dow = d.getDay();        // 0=Sunday
        const hour = d.getHours();     // 0-23
        matrix[dow][hour]++;
        const slot = r.subscriber.timeSlot || "غير محدد";
        bySlot[slot] = (bySlot[slot] || 0) + 1;
      }

      // Find max for normalization
      let max = 0;
      for (const row of matrix) for (const v of row) if (v > max) max = v;

      return NextResponse.json({
        matrix,
        dayNames,
        max,
        bySlot,
        total: records.length,
        days,
      });
    }

    // mode === "live"
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todays = await db.attendance.findMany({
      where: {
        ...clubFilter,
        checkInTime: { gte: todayStart, lte: todayEnd },
      },
      include: { subscriber: true },
    });

    const currentlyInPool = todays.filter((a) => !a.checkOutTime);
    const byGroup: Record<string, { total: number; inPool: number }> = {};
    for (const a of currentlyInPool) {
      const slot = a.subscriber.timeSlot || "غير محدد";
      if (!byGroup[slot]) byGroup[slot] = { total: 0, inPool: 0 };
      byGroup[slot].inPool++;
    }
    for (const a of todays) {
      const slot = a.subscriber.timeSlot || "غير محدد";
      if (!byGroup[slot]) byGroup[slot] = { total: 0, inPool: 0 };
      byGroup[slot].total++;
    }

    return NextResponse.json({
      todayCount: todays.length,
      currentlyInPool: currentlyInPool.length,
      byGroup,
      currentlyInPoolList: currentlyInPool.map((a) => ({
        id: a.id,
        checkInTime: a.checkInTime,
        subscriber: {
          id: a.subscriber.id,
          fileNumber: a.subscriber.fileNumber,
          lastName: a.subscriber.lastName,
          firstName: a.subscriber.firstName,
          timeSlot: a.subscriber.timeSlot,
        },
      })),
    });
  } catch (e) {
    console.error("GET attendance/live:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * GET /api/reports/monthly?year=2026&month=7
 * Returns monthly summary as JSON. The frontend renders it as PDF (print) or it can be downloaded.
 *
 * Stats included:
 *  - Total revenue (subscription + insurance)
 *  - New subscribers this month
 *  - Renewals this month
 *  - Best time slot
 *  - Attendance count
 *  - Top attendees
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const yearParam = url.searchParams.get("year");
    const monthParam = url.searchParams.get("month");

    const now = new Date();
    const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam, 10) - 1 : now.getMonth(); // 0-indexed

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 1);

    const monthName = new Date(year, month, 1).toLocaleDateString("ar-DZ", { month: "long", year: "numeric" });

    // Fetch data
    const [newSubscribers, renewals, payments, attendances] = await Promise.all([
      db.subscriber.findMany({
        where: { createdAt: { gte: monthStart, lt: monthEnd } },
        select: { id: true, fileNumber: true, lastName: true, firstName: true, subscriptionType: true, paymentStatus: true, createdAt: true },
      }),
      db.renewal.findMany({
        where: { renewalDate: { gte: monthStart, lt: monthEnd } },
        include: { subscriber: { select: { fileNumber: true, lastName: true, firstName: true } } },
      }),
      db.payment.findMany({
        where: { date: { gte: monthStart, lt: monthEnd } },
        include: { subscriber: { select: { fileNumber: true, lastName: true, firstName: true } } },
      }),
      db.attendance.findMany({
        where: { checkInTime: { gte: monthStart, lt: monthEnd } },
        include: { subscriber: { select: { id: true, fileNumber: true, lastName: true, firstName: true, timeSlot: true } } },
      }),
    ]);

    // Revenue
    const revenue = payments.reduce((s, p) => s + p.amount, 0);
    const renewalsRevenue = renewals.reduce((s, r) => s + r.amount, 0);

    // Best time slot (by attendance)
    const slotCounts: Record<string, number> = {};
    for (const a of attendances) {
      const slot = a.subscriber.timeSlot || "غير محدد";
      slotCounts[slot] = (slotCounts[slot] || 0) + 1;
    }
    const bestSlot = Object.entries(slotCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

    // Top attendees
    const attendeeCounts: Record<string, { count: number; name: string; fileNumber: string }> = {};
    for (const a of attendances) {
      const key = a.subscriber.id;
      if (!attendeeCounts[key]) {
        attendeeCounts[key] = {
          count: 0,
          name: `${a.subscriber.lastName} ${a.subscriber.firstName}`,
          fileNumber: a.subscriber.fileNumber,
        };
      }
      attendeeCounts[key].count++;
    }
    const topAttendees = Object.values(attendeeCounts).sort((a, b) => b.count - a.count).slice(0, 5);

    // Payment breakdown by category
    const paymentsByCategory: Record<string, number> = {};
    for (const p of payments) {
      paymentsByCategory[p.category] = (paymentsByCategory[p.category] || 0) + p.amount;
    }

    return NextResponse.json({
      monthName,
      year,
      month: month + 1,
      period: { start: monthStart.toISOString().split("T")[0], end: new Date(monthEnd.getTime() - 1).toISOString().split("T")[0] },
      summary: {
        revenue,
        renewalsRevenue,
        newSubscribers: newSubscribers.length,
        renewals: renewals.length,
        attendanceCount: attendances.length,
        paymentsCount: payments.length,
        bestSlot,
      },
      newSubscribersList: newSubscribers,
      renewalsList: renewals,
      paymentsByCategory,
      slotCounts,
      topAttendees,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("GET monthly report:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

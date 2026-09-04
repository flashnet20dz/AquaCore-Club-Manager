import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ensureRuntimeColumns } from "@/lib/runtime-schema";
import { financialNumber } from "@/lib/financial-posting";

/**
 * GET /api/reports/monthly?year=2026&month=7
 * ملخص شهري — ★ المال من دفتر FinancialTransaction حصراً (المرحلة 4):
 * لا يوجد أي حساب إيراد من جدول Payment أو المنخرطين.
 *
 * Stats included:
 *  - المداخيل/المصاريف/الصافي (الدفتر، النشط فقط)
 *  - المداخيل حسب الفئة (دفتر)
 *  - منخرطون جدد + تجديدات + حضور (إحصائيات تشغيلية)
 */
export async function GET(req: NextRequest) {
  try {
    await ensureRuntimeColumns();
    const user = await getCurrentUser();
    if (!user || !user.clubId) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

    const url = new URL(req.url);
    const yearParam = url.searchParams.get("year");
    const monthParam = url.searchParams.get("month");

    const now = new Date();
    const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam, 10) - 1 : now.getMonth(); // 0-indexed

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 1);

    const monthName = new Date(year, month, 1).toLocaleDateString("ar-DZ", { month: "long", year: "numeric" });
    const clubFilter = user.role === "superadmin" ? {} : { clubId: user.clubId };

    const [newSubscribers, renewals, attendances, incomeAgg, expenseAgg, incomeByCat, expenseByCat, recentTx] =
      await Promise.all([
        db.subscriber.findMany({
          where: { ...clubFilter, createdAt: { gte: monthStart, lt: monthEnd } },
          select: { id: true, fileNumber: true, lastName: true, firstName: true, subscriptionType: true, paymentStatus: true, createdAt: true },
        }),
        db.renewal.findMany({
          where: { ...clubFilter, renewalDate: { gte: monthStart, lt: monthEnd } },
          include: { subscriber: { select: { fileNumber: true, lastName: true, firstName: true } } },
        }),
        db.attendance.findMany({
          where: { ...clubFilter, checkInTime: { gte: monthStart, lt: monthEnd } },
          include: { subscriber: { select: { id: true, fileNumber: true, lastName: true, firstName: true, timeSlot: true } } },
        }),
        // ★ المال من الدفتر حصراً
        db.financialTransaction.aggregate({ where: { ...clubFilter, status: "active", type: "income", date: { gte: monthStart, lt: monthEnd } }, _sum: { amount: true }, _count: true }),
        db.financialTransaction.aggregate({ where: { ...clubFilter, status: "active", type: "expense", date: { gte: monthStart, lt: monthEnd } }, _sum: { amount: true }, _count: true }),
        db.financialTransaction.groupBy({ by: ["category"], where: { ...clubFilter, status: "active", type: "income", date: { gte: monthStart, lt: monthEnd } }, _sum: { amount: true }, _count: true }),
        db.financialTransaction.groupBy({ by: ["category"], where: { ...clubFilter, status: "active", type: "expense", date: { gte: monthStart, lt: monthEnd } }, _sum: { amount: true } }),
        db.financialTransaction.findMany({
          where: { ...clubFilter, status: "active", date: { gte: monthStart, lt: monthEnd } },
          orderBy: [{ date: "desc" }],
          take: 10,
          select: { id: true, seq: true, type: true, category: true, amount: true, date: true, payeeName: true },
        }).catch(() => []),
      ]);

    const revenue = incomeAgg._sum.amount || 0;
    const expense = expenseAgg._sum.amount || 0;
    const renewalIncome = incomeByCat.find((g) => g.category === "renewal")?._sum.amount || 0;

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

    // ★ توزيع الفئات من الدفتر (بدل Payment)
    const paymentsByCategory: Record<string, number> = {};
    for (const g of incomeByCat) paymentsByCategory[g.category] = g._sum.amount || 0;
    const expensesByCategory: Record<string, number> = {};
    for (const g of expenseByCat) expensesByCategory[g.category] = g._sum.amount || 0;

    return NextResponse.json({
      monthName,
      year,
      month: month + 1,
      period: { start: monthStart.toISOString().split("T")[0], end: new Date(monthEnd.getTime() - 1).toISOString().split("T")[0] },
      summary: {
        // ★ أرقام الدفتر — مطابقة للمركز المالي حتماً
        revenue,
        expense,
        net: revenue - expense,
        renewalsRevenue: renewalIncome,
        incomeCount: incomeAgg._count || 0,
        expenseCount: expenseAgg._count || 0,
        newSubscribers: newSubscribers.length,
        renewals: renewals.length,
        attendanceCount: attendances.length,
        bestSlot,
      },
      newSubscribersList: newSubscribers,
      renewalsList: renewals,
      paymentsByCategory,
      expensesByCategory,
      latestTransactions: (recentTx as Array<{ id: string; seq: number | null; type: string; category: string; amount: number; date: Date; payeeName: string | null }>).map((t) => ({
        ...t,
        number: financialNumber(t.seq, t.date),
      })),
      slotCounts,
      topAttendees,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("GET monthly report:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

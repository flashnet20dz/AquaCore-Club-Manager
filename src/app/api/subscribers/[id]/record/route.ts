import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * GET /api/subscribers/[id]/record
 * Returns the full record: subscriber info, renewals, attendances, payments, activities.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const subscriber = await db.subscriber.findFirst({ where: { id, ...clubFilter } });
    if (!subscriber) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }

    const [renewals, attendances, payments, activities] = await Promise.all([
      db.renewal.findMany({
        where: { subscriberId: id, ...clubFilter },
        orderBy: { renewalDate: "desc" },
      }),
      db.attendance.findMany({
        where: { subscriberId: id, ...clubFilter },
        orderBy: { date: "desc" },
        take: 100,
      }),
      db.payment.findMany({
        where: { subscriberId: id, ...clubFilter },
        orderBy: { date: "desc" },
      }),
      db.activity.findMany({
        where: { subscriberId: id, ...clubFilter },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    // Compute attendance stats
    const now = new Date();
    const last30Days = new Date(now);
    last30Days.setDate(last30Days.getDate() - 30);
    const attendanceLast30 = attendances.filter((a) => new Date(a.date) >= last30Days).length;

    // Check for 3-week absence streak
    const last3Weeks = new Date(now);
    last3Weeks.setDate(last3Weeks.getDate() - 21);
    const attendanceLast3Weeks = attendances.filter((a) => new Date(a.date) >= last3Weeks).length;
    const absent3Weeks = attendanceLast3Weeks === 0 && subscriber.lastPaymentDate !== null;

    return NextResponse.json({
      subscriber,
      renewals,
      attendances,
      payments,
      activities,
      stats: {
        totalVisits: attendances.length,
        attendanceLast30,
        absent3Weeks,
        totalPayments: payments.reduce((s, p) => s + p.amount, 0),
        renewalCount: renewals.length,
      },
    });
  } catch (e) {
    console.error("GET subscriber record:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

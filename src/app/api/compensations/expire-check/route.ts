import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { deriveCompensationStatus } from "@/lib/rcs";

/**
 * POST /api/compensations/expire-check
 * يفحص كل التعويضات النشطة (pending/partial/scheduled) ويحدّث حالتها إلى "expired"
 * لو انتهت صلاحيتها (expiryDate < now) ولم تكتمل.
 *
 * يمكن استدعاؤه يدوياً أو عبر cron job.
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const now = new Date();

    // ابحث عن التعويضات التي انتهت صلاحيتها ولم تكتمل
    const expired = await db.compensation.findMany({
      where: {
        ...clubFilter,
        expiryDate: { lt: now },
        status: { in: ["pending", "partial", "scheduled"] },
      },
      select: { id: true, clubId: true, subscriberId: true, cancelledSessionsCount: true, compensatedCount: true },
    });

    let updated = 0;
    const historyEntries: { clubId: string; compensationId: string; action: string; description: string; userId: string | null }[] = [];

    for (const comp of expired) {
      const derived = deriveCompensationStatus(
        comp.cancelledSessionsCount,
        comp.compensatedCount,
        now,
        "pending"
      );
      if (derived === "expired") {
        await db.compensation.update({
          where: { id: comp.id },
          data: { status: "expired" },
        });
        historyEntries.push({
          clubId: comp.clubId,
          compensationId: comp.id,
          action: "expired",
          description: `انتهت صلاحية التعويض تلقائياً (${comp.compensatedCount}/${comp.cancelledSessionsCount} معوَّض)`,
          userId: currentUser.id,
        });
        updated++;
      }
    }

    // سجّل التغييرات
    if (historyEntries.length > 0) {
      await db.compensationHistory.createMany({
        data: historyEntries.map((h) => ({ ...h, newValue: JSON.stringify({ status: "expired" }) })),
      });
    }

    return NextResponse.json({ success: true, expiredCount: updated, checked: expired.length });
  } catch (error) {
    console.error("POST /api/compensations/expire-check error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

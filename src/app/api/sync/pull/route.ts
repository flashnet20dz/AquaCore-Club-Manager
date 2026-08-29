import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/sync/pull?since=<ISO timestamp>
 * يرجع كل التغييرات الخاصة بنادي معيّن منذ آخر مزامنة، مفلترة بـ clubId فقط.
 */
export async function GET(req: NextRequest) {
  try {
    const apiKey = req.headers.get("X-Club-Api-Key");
    if (!apiKey) {
      return NextResponse.json({ error: "مفتاح المزامنة مفقود" }, { status: 401 });
    }

    const club = await db.club.findUnique({ where: { syncApiKey: apiKey } });
    if (!club) {
      return NextResponse.json({ error: "مفتاح المزامنة غير صالح" }, { status: 401 });
    }

    const sinceParam = req.nextUrl.searchParams.get("since");
    const since = sinceParam ? new Date(sinceParam) : new Date(0);

    const [subscribers, payments, renewals, attendances, compensations, poolClosures] =
      await Promise.all([
        db.subscriber.findMany({ where: { clubId: club.id, updatedAt: { gt: since } } }),
        db.payment.findMany({ where: { clubId: club.id, createdAt: { gt: since } } }),
        db.renewal.findMany({ where: { clubId: club.id, createdAt: { gt: since } } }),
        db.attendance.findMany({ where: { clubId: club.id, createdAt: { gt: since } } }),
        db.compensation.findMany({ where: { clubId: club.id, updatedAt: { gt: since } } }),
        db.poolClosure.findMany({ where: { clubId: club.id, createdAt: { gt: since } } }),
      ]);

    return NextResponse.json({
      subscribers,
      payments,
      renewals,
      attendances,
      compensations,
      poolClosures,
      serverTime: new Date().toISOString(),
    });
  } catch (e) {
    console.error("GET /api/sync/pull:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

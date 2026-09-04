import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * GET /api/compensations?status=pending&subscriberId=...
 * قائمة التعويضات، مع إمكانية الفلترة بالحالة أو بالمنخرط.
 */
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const subscriberId = url.searchParams.get("subscriberId");

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const where: Record<string, unknown> = { ...clubFilter };
    if (status) where.status = status;
    if (subscriberId) where.subscriberId = subscriberId;

    const compensations = await db.compensation.findMany({
      where,
      include: { subscriber: true, closure: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ compensations });
  } catch (e) {
    console.error("GET compensations:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

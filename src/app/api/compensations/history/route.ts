import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * GET /api/compensations/history?closureId=&compensationId=&limit=
 * يرجع سجل تدقيق التعويضات (من سوّى شنو ومتى).
 */
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const url = new URL(req.url);
    const closureId = url.searchParams.get("closureId");
    const compensationId = url.searchParams.get("compensationId");
    const limit = Math.min(200, parseInt(url.searchParams.get("limit") || "50"));

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const where: Record<string, unknown> = { ...clubFilter };
    if (closureId) where.closureId = closureId;
    if (compensationId) where.compensationId = compensationId;

    const history = await db.compensationHistory.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ history });
  } catch (error) {
    console.error("GET /api/compensations/history error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

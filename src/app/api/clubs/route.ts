import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * GET /api/clubs — SuperAdmin: list all clubs
 */
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const clubs = await db.club.findMany({
      include: {
        users: { select: { id: true, name: true, email: true, role: true } },
        subscriptions: { orderBy: { createdAt: "desc" }, take: 1 },
        requests: { where: { status: "pending" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });

    // Compute days remaining for each club
    const result = clubs.map((club) => {
      const sub = club.subscriptions[0];
      let daysRemaining = 0;
      let subStatus = "none";
      if (sub) {
        const now = new Date();
        const end = new Date(sub.endDate);
        daysRemaining = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        subStatus = daysRemaining > 0 ? sub.status : "expired";
      }
      return {
        ...club,
        subscription: sub ? { type: sub.type, startDate: sub.startDate, endDate: sub.endDate, status: subStatus } : null,
        daysRemaining,
        hasPendingRequest: club.requests.length > 0,
      };
    });

    return NextResponse.json({ clubs: result });
  } catch (e) {
    console.error("GET clubs:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

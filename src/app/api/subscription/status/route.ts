import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { computeSubscriptionStatus } from "@/lib/subscription-state";

/**
 * GET /api/subscription/status
 * يحسب حالة اشتراك النادي الحالي (trial/active/grace/locked).
 * يُستخدم من الواجهة لعرض البوابة عند انتهاء الاشتراك.
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.clubId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const club = await db.club.findUnique({
      where: { id: currentUser.clubId },
      select: {
        id: true,
        name: true,
        status: true,
        trialStartedAt: true,
        trialEndDate: true,
        graceEndDate: true,
        hardwareFingerprint: true,
      },
    });

    if (!club) {
      return NextResponse.json({ error: "النادي غير موجود" }, { status: 404 });
    }

    const activeSub = await db.clubSubscription.findFirst({
      where: { clubId: club.id, status: "active" },
      orderBy: { createdAt: "desc" },
    });

    const status = computeSubscriptionStatus(club, activeSub);

    return NextResponse.json({
      ...status,
      club: { id: club.id, name: club.name },
      subscription: activeSub ? {
        id: activeSub.id,
        type: activeSub.type,
        startDate: activeSub.startDate,
        endDate: activeSub.endDate,
        status: activeSub.status,
      } : null,
      trial: club.trialStartedAt ? {
        startedAt: club.trialStartedAt,
        endDate: club.trialEndDate,
      } : null,
      hardwareFingerprint: club.hardwareFingerprint,
    });
  } catch (e) {
    console.error("GET /api/subscription/status error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

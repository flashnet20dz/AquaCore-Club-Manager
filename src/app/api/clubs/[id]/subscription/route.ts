import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * POST /api/clubs/[id]/subscription
 * SuperAdmin: create/renew/change subscription
 * Body: { action: "create"|"renew"|"change"|"extend"|"end"|"suspend"|"reactivate", type, months }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action, type, months } = body;

    const now = new Date();

    // Get current subscription
    const currentSub = await db.clubSubscription.findFirst({
      where: { clubId: id },
      orderBy: { createdAt: "desc" },
    });

    if (action === "create" || action === "renew") {
      const subType = type || "monthly";
      const endDate = new Date(now);
      if (subType === "yearly") {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + (months || 1));
      }

      // Deactivate old subscription
      if (currentSub) {
        await db.clubSubscription.update({
          where: { id: currentSub.id },
          data: { status: "cancelled" },
        });
      }

      const newSub = await db.clubSubscription.create({
        data: {
          clubId: id,
          type: subType,
          startDate: now,
          endDate,
          status: "active",
          lastRenewalDate: now,
        },
      });

      await db.subscriptionHistory.create({
        data: {
          subscriptionId: newSub.id,
          action: action === "create" ? "created" : "renewed",
          oldType: currentSub?.type || null,
          newType: subType,
          oldEndDate: currentSub?.endDate || null,
          newEndDate: endDate,
        },
      });

      // Activate club
      await db.club.update({ where: { id }, data: { status: "active" } });

      return NextResponse.json({ success: true, subscription: newSub });
    }

    if (action === "change") {
      if (!currentSub) return NextResponse.json({ error: "لا يوجد اشتراك حالي" }, { status: 400 });
      const newType = type || (currentSub.type === "monthly" ? "yearly" : "monthly");

      const newEndDate = new Date(currentSub.startDate);
      if (newType === "yearly") {
        newEndDate.setFullYear(newEndDate.getFullYear() + 1);
      } else {
        newEndDate.setMonth(newEndDate.getMonth() + 1);
      }

      const updated = await db.clubSubscription.update({
        where: { id: currentSub.id },
        data: { type: newType, endDate: newEndDate, lastRenewalDate: now },
      });

      await db.subscriptionHistory.create({
        data: {
          subscriptionId: currentSub.id,
          action: "changed",
          oldType: currentSub.type,
          newType,
          oldEndDate: currentSub.endDate,
          newEndDate,
        },
      });

      return NextResponse.json({ success: true, subscription: updated });
    }

    if (action === "extend") {
      if (!currentSub) return NextResponse.json({ error: "لا يوجد اشتراك حالي" }, { status: 400 });
      const extMonths = months || 1;
      const baseDate = currentSub.endDate > now ? new Date(currentSub.endDate) : new Date(now);
      const newEndDate = new Date(baseDate);
      newEndDate.setMonth(newEndDate.getMonth() + extMonths);

      const updated = await db.clubSubscription.update({
        where: { id: currentSub.id },
        data: { endDate: newEndDate, status: "active", lastRenewalDate: now },
      });

      await db.subscriptionHistory.create({
        data: {
          subscriptionId: currentSub.id,
          action: "extended",
          oldEndDate: currentSub.endDate,
          newEndDate,
          note: `تمديد ${extMonths} شهر`,
        },
      });

      await db.club.update({ where: { id }, data: { status: "active" } });

      return NextResponse.json({ success: true, subscription: updated });
    }

    if (action === "end") {
      if (!currentSub) return NextResponse.json({ error: "لا يوجد اشتراك حالي" }, { status: 400 });
      await db.clubSubscription.update({
        where: { id: currentSub.id },
        data: { status: "cancelled", endDate: now },
      });
      await db.club.update({ where: { id }, data: { status: "expired" } });
      await db.subscriptionHistory.create({
        data: { subscriptionId: currentSub.id, action: "ended" },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "suspend") {
      if (!currentSub) return NextResponse.json({ error: "لا يوجد اشتراك حالي" }, { status: 400 });
      await db.clubSubscription.update({
        where: { id: currentSub.id },
        data: { status: "suspended" },
      });
      await db.club.update({ where: { id }, data: { status: "suspended" } });
      await db.subscriptionHistory.create({
        data: { subscriptionId: currentSub.id, action: "suspended" },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "reactivate") {
      if (!currentSub) return NextResponse.json({ error: "لا يوجد اشتراك حالي" }, { status: 400 });
      await db.clubSubscription.update({
        where: { id: currentSub.id },
        data: { status: "active" },
      });
      await db.club.update({ where: { id }, data: { status: "active" } });
      await db.subscriptionHistory.create({
        data: { subscriptionId: currentSub.id, action: "reactivated" },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  } catch (e) {
    console.error("Subscription action:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

/**
 * GET /api/clubs/[id]/subscription — get subscription history
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const subscriptions = await db.clubSubscription.findMany({
      where: { clubId: id },
      include: { history: { orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ subscriptions });
  } catch (e) {
    console.error("GET subscription:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

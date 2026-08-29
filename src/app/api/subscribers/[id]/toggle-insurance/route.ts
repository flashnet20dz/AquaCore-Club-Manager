import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// PATCH /api/subscribers/[id]/toggle-insurance
// Toggles isInsured status and records a payment if newly insured
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || !["admin", "assistant", "superadmin"].includes(user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const clubFilter = user.role === "superadmin" ? {} : { clubId: user.clubId! };
    const sub = await db.subscriber.findFirst({ where: { id, ...clubFilter } });
    if (!sub) {
      return NextResponse.json({ error: "المنخرط غير موجود" }, { status: 404 });
    }

    // Check current insured status by looking for an insurance payment
    const existingInsurance = await db.payment.findFirst({
      where: { subscriberId: id, category: "insurance", ...clubFilter },
    });

    if (existingInsurance) {
      // Remove insurance (delete payment)
      await db.payment.delete({ where: { id: existingInsurance.id } });
      await db.activity.create({
        data: {
          clubId: sub.clubId,
          subscriberId: id,
          userId: user.id,
          type: "payment",
          description: `إلغاء تأمين المنخرط: ${sub.lastName} ${sub.firstName}`,
        },
      });
      return NextResponse.json({ success: true, isInsured: false, memberId: id });
    } else {
      // Add insurance (create payment of 500 DA)
      await db.payment.create({
        data: {
          clubId: sub.clubId,
          subscriberId: id,
          category: "insurance",
          amount: 500,
          method: "cash",
          note: "تأمين",
          userId: user.id,
        },
      });
      await db.activity.create({
        data: {
          clubId: sub.clubId,
          subscriberId: id,
          userId: user.id,
          type: "payment",
          description: `تأمين المنخرط: ${sub.lastName} ${sub.firstName}`,
        },
      });
      return NextResponse.json({ success: true, isInsured: true, memberId: id });
    }
  } catch (e) {
    console.error("Toggle insurance:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

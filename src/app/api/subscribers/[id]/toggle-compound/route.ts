import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { postLedgerEntry, deleteLedgerByReferencesTx } from "@/lib/financial-posting";

/**
 * PATCH /api/subscribers/[id]/toggle-compound
 * تبديل حالة حقوق المركب للمنخرط
 * - إنشاء/حذف دفعة حقوق مركب (compound)
 */
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

    // تحقق من وجود دفعة حقوق مركب
    const existingCompound = await db.payment.findFirst({
      where: { subscriberId: id, category: "compound", ...clubFilter },
    });

    if (existingCompound) {
      // ★ حذف دفعة حقوق المركب + القيد المرحّل في الدفتر المالي (ذرّياً)
      await db.$transaction(async (tx) => {
        await tx.payment.delete({ where: { id: existingCompound.id } });
        await deleteLedgerByReferencesTx(tx, sub.clubId, [
          `payment:${existingCompound.id}`,
          `bulk-comp:${id}`,
        ]);
        await tx.activity.create({
          data: {
            clubId: sub.clubId,
            subscriberId: id,
            userId: user.id,
            type: "payment",
            description: `إلغاء حقوق المركب للمنخرط: ${sub.lastName} ${sub.firstName}`,
          },
        });
      });
      return NextResponse.json({ success: true, hasCompound: false, memberId: id });
    } else {
      // ★ إنشاء دفعة حقوق المركب (افتراضي 1000 دج) + ترحيل تلقائي للدفتر (ذرّياً)
      await db.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            clubId: sub.clubId,
            subscriberId: id,
            category: "compound",
            amount: 1000,
            method: "cash",
            note: "حقوق المركب",
            userId: user.id,
          },
        });
        await postLedgerEntry(tx, {
          clubId: sub.clubId,
          type: "income",
          category: "compound",
          amount: 1000,
          paymentMethod: "cash",
          payeeName: `${sub.lastName} ${sub.firstName}`.trim(),
          subscriberId: id,
          reference: `payment:${payment.id}`,
          note: "حقوق المركب — تلقائي",
          createdById: user.id,
        });
        await tx.activity.create({
          data: {
            clubId: sub.clubId,
            subscriberId: id,
            userId: user.id,
            type: "payment",
            description: `تحصيل حقوق المركب للمنخرط: ${sub.lastName} ${sub.firstName}`,
          },
        });
      });
      return NextResponse.json({ success: true, hasCompound: true, memberId: id });
    }
  } catch (e) {
    console.error("Toggle compound:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

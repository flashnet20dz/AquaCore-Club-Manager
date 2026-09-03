import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { postLedgerEntry, cancelLedgerByReferencesTx } from "@/lib/financial-posting";
import { ensureRuntimeColumns } from "@/lib/runtime-schema";

// PATCH /api/subscribers/[id]/toggle-insurance
// Toggles isInsured status and records a payment if newly insured
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureRuntimeColumns();
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
      // ★ إلغاء التأمين: حذف الدفعة التشغيلية + إلغاء القيد المرحّل ناعماً في الدفتر (ذرّياً)
      await db.$transaction(async (tx) => {
        await tx.payment.delete({ where: { id: existingInsurance.id } });
        // المرجع قد يكون من التأمين الفردي (payment:) أو الجماعي (bulk-ins:)
        await cancelLedgerByReferencesTx(tx, sub.clubId, [
          `payment:${existingInsurance.id}`,
          `bulk-ins:${id}`,
        ], {
          cancelledById: user.id,
          reason: `إلغاء تأمين المنخرط ${sub.lastName} ${sub.firstName}`,
        });
        await tx.activity.create({
          data: {
            clubId: sub.clubId,
            subscriberId: id,
            userId: user.id,
            type: "payment",
            description: `إلغاء تأمين المنخرط: ${sub.lastName} ${sub.firstName}`,
          },
        });
      });
      return NextResponse.json({ success: true, isInsured: false, memberId: id });
    } else {
      // ★ إضافة التأمين: دفعة 500 دج + ترحيل تلقائي للدفتر المالي (ذرّياً)
      await db.$transaction(async (tx) => {
        const payment = await tx.payment.create({
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
        await postLedgerEntry(tx, {
          clubId: sub.clubId,
          type: "income",
          category: "insurance",
          amount: 500,
          paymentMethod: "cash",
          payeeName: `${sub.lastName} ${sub.firstName}`.trim(),
          subscriberId: id,
          reference: `payment:${payment.id}`,
          note: "تأمين منخرط — تلقائي",
          createdById: user.id,
        });
        await tx.activity.create({
          data: {
            clubId: sub.clubId,
            subscriberId: id,
            userId: user.id,
            type: "payment",
            description: `تأمين المنخرط: ${sub.lastName} ${sub.firstName}`,
          },
        });
      });
      return NextResponse.json({ success: true, isInsured: true, memberId: id });
    }
  } catch (e) {
    console.error("Toggle insurance:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

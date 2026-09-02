/**
 * /api/wages/[id] DELETE — إلغاء تسديد أجر (Void)
 * ═════════════════════════════════════════════════════════════
 * يحذف سجل WagePayment + القيد المالي المرتبط (1:1) مع إعادة حساب
 * الرصيد كاملاً — ذرّياً — مع سبب إلزامي وسجل تدقيق.
 * صلاحية: admin/superadmin فقط (Backend — لا اعتماد على الواجهة).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { recomputeBalanceTx } from "@/lib/financial-posting";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح — إلغاء التسديد للمدير فقط" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = (body?.reason || "").trim();
    if (reason.length < 3) {
      return NextResponse.json({ error: "سبب الإلغاء إلزامي (3 أحرف على الأقل)" }, { status: 400 });
    }

    const wp = await db.wagePayment.findFirst({
      where: { id, ...(currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! }) },
      include: {
        user: { select: { name: true } },
      },
    });
    if (!wp) return NextResponse.json({ error: "تسديد الأجر غير موجود" }, { status: 404 });

    await db.$transaction(async (tx) => {
      // 1) حذف سجل التسديد
      await tx.wagePayment.delete({ where: { id: wp.id } });
      // 2) حذف القيد المالي المرتبط (نفس العملية — لا بقايا)
      if (wp.transactionId) {
        await tx.financialTransaction.delete({ where: { id: wp.transactionId } }).catch(() => undefined);
      }
      // 3) إعادة حساب الرصيد من الصفر (الأدق بعد الحذف)
      await recomputeBalanceTx(tx, wp.clubId);
      // 4) تدقيق
      await tx.auditLog.create({
        data: {
          clubId: wp.clubId,
          userId: currentUser.id,
          action: "wage_payment_void",
          entityType: "WagePayment",
          entityId: wp.id,
          description: `إلغاء تسديد أجر ${wp.amount} دج للعامل ${wp.user.name} — الفترة ${wp.periodLabel} — السبب: ${reason}`,
          metadata: JSON.stringify({ amount: wp.amount, period: wp.periodLabel, reason, transactionId: wp.transactionId }),
        },
      }).catch(() => undefined);
    });

    return NextResponse.json({ success: true, message: "تم إلغاء التسديد وحذف قيده المالي" });
  } catch (e) {
    console.error("DELETE wage:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal" }, { status: 500 });
  }
}

/**
 * /api/wages/[id] DELETE — إلغاء تسديد أجر عامل (إلغاء ناعم — Void)
 * ═════════════════════════════════════════════════════════════
 * ★ لا حذف فعلي: WagePayment وقيده المالي المرتبط (1:1) يتحولان إلى
 * status=cancelled مع cancelledAt/cancelledById/cancellationReason —
 * يبقيان ظاهرين في السجل بوضع «ملغى» ولا يدخلان في المدفوع/الرصيد.
 * يعمل من الصفحتين (ساعات العمل والمركز المالي) على نفس السجل —
 * فإلغاؤه من أي جهة يظهر «ملغى» في الأخرى فوراً.
 * سبب إلزامي + AuditLog. صلاحية: admin/superadmin فقط (Backend).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { recomputeBalanceTx } from "@/lib/financial-posting";
import { ensureRuntimeColumns } from "@/lib/runtime-schema";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureRuntimeColumns();
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

    // ★ منع الإلغاء المزدوج (idempotency)
    if (wp.status === "cancelled") {
      return NextResponse.json({ error: "هذا التسديد ملغى مسبقاً" }, { status: 409 });
    }

    await db.$transaction(async (tx) => {
      // 1) إلغاء سجل التسديد (ناعم — يبقى في السجل بوضع «ملغى»)
      await tx.wagePayment.update({
        where: { id: wp.id },
        data: {
          status: "cancelled",
          cancelledAt: new Date(),
          cancelledById: currentUser.id,
          cancellationReason: reason,
        },
      });

      // 2) إلغاء القيد المالي المرتبط (نفس العملية — لا بقايا ولا حذف)
      if (wp.transactionId) {
        await tx.financialTransaction.updateMany({
          where: { id: wp.transactionId, status: "active" },
          data: {
            status: "cancelled",
            cancelledAt: new Date(),
            cancelledById: currentUser.id,
            cancellationReason: `إلغاء تسديد أجر ${wp.user.name} — ${reason}`,
          },
        });
      }

      // 3) إعادة حساب الرصيد من القيود النشطة فقط
      await recomputeBalanceTx(tx, wp.clubId);

      // 4) تدقيق: من ألغى / متى / السبب / القيمة الأصلية
      await tx.auditLog.create({
        data: {
          clubId: wp.clubId,
          userId: currentUser.id,
          action: "wage_payment_void",
          entityType: "WagePayment",
          entityId: wp.id,
          description: `إلغاء تسديد أجر ${wp.amount} دج للعامل ${wp.user.name} — الفترة ${wp.periodLabel} — السبب: ${reason}`,
          metadata: JSON.stringify({
            amount: wp.amount, originalValue: wp.amount, period: wp.periodLabel,
            reason, transactionId: wp.transactionId,
            cancelledAt: new Date().toISOString(), createdAt: wp.createdAt.toISOString(),
          }),
        },
      }).catch(() => undefined);
    });

    return NextResponse.json({
      success: true,
      message: "تم إلغاء التسديد — يبقى في السجل بوضع «ملغى» ولا يدخل في المدفوع ولا الرصيد",
    });
  } catch (e) {
    console.error("DELETE wage:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal" }, { status: 500 });
  }
}

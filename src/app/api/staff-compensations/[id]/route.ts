import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/session";
import { ensureRuntimeColumns } from "@/lib/runtime-schema";
import { recomputeBalanceTx } from "@/lib/financial-posting";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureRuntimeColumns();
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasPermission(currentUser.role, "staffCompensations")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const comp = await db.staffCompensation.findFirst({
      where: { id, ...clubFilter },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, position: true, hourRate: true, phone: true, userId: true } },
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!comp) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // ★ Lifeguards can only view their own
    if (currentUser.role === "lifeguard" && comp.userId !== currentUser.id && comp.employee?.userId !== currentUser.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    return NextResponse.json({ compensation: comp });
  } catch (error) {
    console.error("GET /api/staff-compensations/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasPermission(currentUser.role, "staffCompensationsManage")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const existing = await db.staffCompensation.findFirst({ where: { id, ...clubFilter } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // ★ الأرشيف محفوظ للتاريخ فقط — لا تعديل بعد الأرشفة (التدقيق النهائي)
    if (existing.archivedAt) {
      return NextResponse.json({ error: "التعويض مؤرشف — لا يمكن تعديله" }, { status: 409 });
    }

    // Recalculate total if any financial fields changed
    const workHours = body.workHours != null ? Number(body.workHours) : existing.workHours;
    const hourRate = body.hourRate != null ? Number(body.hourRate) : existing.hourRate;
    const baseAmount = body.baseAmount != null ? Number(body.baseAmount) : (body.workHours != null || body.hourRate != null ? workHours * hourRate : existing.baseAmount);
    const overtimeAmount = body.overtimeAmount != null ? Number(body.overtimeAmount) : existing.overtimeAmount;
    const bonusAmount = body.bonusAmount != null ? Number(body.bonusAmount) : existing.bonusAmount;
    const deductions = body.deductions != null ? Number(body.deductions) : existing.deductions;
    const totalAmount = baseAmount + overtimeAmount + bonusAmount - deductions;

    // Rebuild period label if month/year changed
    let periodLabel = existing.periodLabel;
    if (body.month || body.year) {
      const monthNames = ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
      periodLabel = `${monthNames[(body.month || existing.month) - 1]} ${body.year || existing.year}`;
    }

    const updated = await db.staffCompensation.update({
      where: { id },
      data: {
        employeeId: body.employeeId !== undefined ? (body.employeeId || null) : existing.employeeId,
        userId: body.userId !== undefined ? (body.userId || null) : existing.userId,
        personName: body.personName ?? existing.personName,
        personPosition: body.personPosition ?? existing.personPosition,
        month: body.month != null ? Number(body.month) : existing.month,
        year: body.year != null ? Number(body.year) : existing.year,
        periodLabel,
        workHours,
        hourRate,
        baseAmount,
        overtimeHours: body.overtimeHours != null ? Number(body.overtimeHours) : existing.overtimeHours,
        overtimeAmount,
        bonusAmount,
        deductions,
        totalAmount,
        paymentStatus: body.paymentStatus ?? existing.paymentStatus,
        paymentDate: body.paymentDate !== undefined ? (body.paymentDate ? new Date(body.paymentDate) : null) : existing.paymentDate,
        paymentMethod: body.paymentMethod !== undefined ? (body.paymentMethod || null) : existing.paymentMethod,
        compensationType: body.compensationType ?? existing.compensationType,
        note: body.note !== undefined ? (body.note || null) : existing.note,
        approvedById: body.paymentStatus === "paid" && existing.approvedById == null ? currentUser.id : existing.approvedById,
        approvedAt: body.paymentStatus === "paid" && existing.approvedAt == null ? new Date() : existing.approvedAt,
      },
    });

    await db.activity.create({
      data: {
        clubId: existing.clubId,
        userId: currentUser.id,
        type: "update",
        description: `تم تحديث تعويض ${existing.personName} — ${totalAmount} دج`,
      },
    });

    return NextResponse.json({ compensation: updated });
  } catch (error) {
    console.error("PUT /api/staff-compensations/[id] error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureRuntimeColumns();
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasPermission(currentUser.role, "staffCompensationsManage")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const existing = await db.staffCompensation.findFirst({ where: { id, ...clubFilter } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // ★ التدقيق النهائي — أرشفة ناعمة لا حذف فعلي:
    // السجل يبقى في قاعدة البيانات (archivedAt محدّد) محفوظاً للتاريخ والتدقيق،
    // ويُستثنى من القوائم النشطة والإحصاءات. القيود المالية المرتبطة به تُلغى
    // ناعماً (تبقى في الدفتر بوضع «ملغاة») والرصيد يُعاد حسابه من الدفتر النشط.
    if (existing.archivedAt) {
      return NextResponse.json({ success: true, archived: true, alreadyArchived: true });
    }
    const reason = req.nextUrl.searchParams.get("reason")?.trim() || "أرشفة تعويض";

    let cancelledTransactions = 0;
    await db.$transaction(async (tx) => {
      await tx.staffCompensation.update({
        where: { id },
        data: {
          archivedAt: new Date(),
          archivedById: currentUser.id,
          archiveReason: reason,
        },
      });
      const cancelled = await tx.financialTransaction.updateMany({
        where: { staffCompensationId: id, status: "active" },
        data: {
          status: "cancelled",
          cancelledAt: new Date(),
          cancelledById: currentUser.id,
          cancellationReason: `أرشفة التعويض — ${existing.personName}${existing.periodLabel ? ` — ${existing.periodLabel}` : ""}`.trim(),
        },
      });
      cancelledTransactions = cancelled.count;
      if (cancelledTransactions > 0) {
        await recomputeBalanceTx(tx, existing.clubId);
      }
    });

    await db.activity.create({
      data: {
        clubId: existing.clubId,
        userId: currentUser.id,
        type: "delete",
        description: `تمت أرشفة تعويض ${existing.personName} — ${existing.periodLabel ?? ""} (محفوظ في الأرشيف)${cancelledTransactions > 0 ? ` — أُلغى ${cancelledTransactions} قيد مالي مرتبط` : ""}`.trim(),
      },
    });
    await db.auditLog.create({
      data: {
        clubId: existing.clubId,
        userId: currentUser.id,
        action: "staff_compensation_archive",
        entityType: "StaffCompensation",
        entityId: id,
        description: `أرشفة ناعمة لتعويض ${existing.personName} — السجل محفوظ بدون حذف`,
        metadata: JSON.stringify({
          reason,
          oldValue: { totalAmount: existing.totalAmount, paymentStatus: existing.paymentStatus },
          cancelledTransactions,
        }),
      },
    }).catch(() => undefined);

    return NextResponse.json({ success: true, archived: true, cancelledTransactions });
  } catch (error) {
    console.error("DELETE /api/staff-compensations/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

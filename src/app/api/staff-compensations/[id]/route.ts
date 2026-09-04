import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/session";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasPermission(currentUser.role, "staffCompensationsManage")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const existing = await db.staffCompensation.findFirst({ where: { id, ...clubFilter } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.staffCompensation.delete({ where: { id } });

    await db.activity.create({
      data: {
        clubId: existing.clubId,
        userId: currentUser.id,
        type: "delete",
        description: `تم حذف تعويض ${existing.personName} — ${existing.periodLabel}`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/staff-compensations/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

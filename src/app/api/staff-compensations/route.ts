import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/session";

/**
 * GET /api/staff-compensations
 * Returns staff compensation records with filters + stats.
 *
 * Permissions:
 *   - admin/assistant: see all compensations in their club
 *   - lifeguard: see only their own compensations
 *   - superadmin: see all compensations across clubs
 */
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasPermission(currentUser.role, "staffCompensations")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const url = new URL(req.url);
    const search = url.searchParams.get("search") || "";
    const paymentStatus = url.searchParams.get("paymentStatus") || "";
    const personPosition = url.searchParams.get("personPosition") || "";
    const compensationType = url.searchParams.get("compensationType") || "";
    const month = url.searchParams.get("month"); // "YYYY-MM"
    const year = url.searchParams.get("year");
    const employeeId = url.searchParams.get("employeeId");

    // Build where clause
    const isSuperadmin = currentUser.role === "superadmin";
    const clubFilter = isSuperadmin ? {} : { clubId: currentUser.clubId! };

    const where: Record<string, unknown> = { ...clubFilter };

    // ★ Lifeguards can only see their own compensations
    if (currentUser.role === "lifeguard") {
      where.OR = [
        { userId: currentUser.id },
        { employee: { userId: currentUser.id } },
      ];
    }

    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (personPosition) where.personPosition = personPosition;
    if (compensationType) where.compensationType = compensationType;
    if (employeeId) where.employeeId = employeeId;

    if (month) {
      const [y, m] = month.split("-").map(Number);
      where.year = y;
      where.month = m;
    } else if (year) {
      where.year = parseInt(year);
    }

    if (search) {
      where.OR = [
        ...(Array.isArray(where.OR) ? where.OR : []),
        { personName: { contains: search, mode: "insensitive" } },
      ];
    }

    const [records, total] = await Promise.all([
      db.staffCompensation.findMany({
        where,
        orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
        take: 500,
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, position: true, hourRate: true, phone: true } },
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
      db.staffCompensation.count({ where }),
    ]);

    // ★ Compute stats
    const allForStats = isSuperadmin
      ? await db.staffCompensation.findMany({ where: {}, select: { totalAmount: true, paymentStatus: true } })
      : await db.staffCompensation.findMany({ where: { clubId: currentUser.clubId! }, select: { totalAmount: true, paymentStatus: true } });

    const stats = {
      totalRecords: allForStats.length,
      totalAmount: allForStats.reduce((s, r) => s + r.totalAmount, 0),
      paidCount: allForStats.filter((r) => r.paymentStatus === "paid").length,
      paidAmount: allForStats.filter((r) => r.paymentStatus === "paid").reduce((s, r) => s + r.totalAmount, 0),
      unpaidCount: allForStats.filter((r) => r.paymentStatus === "unpaid").length,
      unpaidAmount: allForStats.filter((r) => r.paymentStatus === "unpaid").reduce((s, r) => s + r.totalAmount, 0),
      processingCount: allForStats.filter((r) => r.paymentStatus === "processing").length,
      processingAmount: allForStats.filter((r) => r.paymentStatus === "processing").reduce((s, r) => s + r.totalAmount, 0),
    };

    return NextResponse.json({
      compensations: records,
      pagination: { total, limit: 500 },
      stats,
    });
  } catch (error) {
    console.error("GET /api/staff-compensations error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/staff-compensations
 * Create a new staff compensation record.
 *
 * Auto-calculates totalAmount = baseAmount + overtimeAmount + bonusAmount - deductions
 * baseAmount = workHours * hourRate (if not provided manually)
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasPermission(currentUser.role, "staffCompensationsManage")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await req.json();

    // Validate required fields
    if (!body.personName || !body.month || !body.year) {
      return NextResponse.json({ error: "بيانات ناقصة: الاسم، الشهر، السنة مطلوبة" }, { status: 400 });
    }

    const workHours = Number(body.workHours) || 0;
    const hourRate = Number(body.hourRate) || 200;
    const baseAmount = body.baseAmount != null ? Number(body.baseAmount) : workHours * hourRate;
    const overtimeHours = Number(body.overtimeHours) || 0;
    const overtimeAmount = Number(body.overtimeAmount) || 0;
    const bonusAmount = Number(body.bonusAmount) || 0;
    const deductions = Number(body.deductions) || 0;

    // ★ Auto-calculate total
    const totalAmount = baseAmount + overtimeAmount + bonusAmount - deductions;

    // Determine clubId — superadmin must specify, others use their own
    const clubId = currentUser.role === "superadmin" ? body.clubId : currentUser.clubId;
    if (!clubId) {
      return NextResponse.json({ error: "clubId مطلوب" }, { status: 400 });
    }

    // Build period label
    const monthNames = ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    const periodLabel = `${monthNames[body.month - 1]} ${body.year}`;

    const compensation = await db.staffCompensation.create({
      data: {
        clubId,
        employeeId: body.employeeId || null,
        userId: body.userId || null,
        personName: body.personName,
        personPosition: body.personPosition || "guard",
        month: Number(body.month),
        year: Number(body.year),
        periodLabel,
        workHours,
        hourRate,
        baseAmount,
        overtimeHours,
        overtimeAmount,
        bonusAmount,
        deductions,
        totalAmount,
        paymentStatus: body.paymentStatus || "unpaid",
        paymentDate: body.paymentDate ? new Date(body.paymentDate) : null,
        paymentMethod: body.paymentMethod || null,
        compensationType: body.compensationType || "monthly",
        note: body.note || null,
        createdById: currentUser.id,
      },
    });

    await db.activity.create({
      data: {
        clubId,
        userId: currentUser.id,
        type: "create",
        description: `تم إنشاء تعويض مالي لـ ${body.personName} — ${periodLabel} — ${totalAmount} دج`,
      },
    });

    return NextResponse.json({ compensation }, { status: 201 });
  } catch (error) {
    console.error("POST /api/staff-compensations error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
  }
}

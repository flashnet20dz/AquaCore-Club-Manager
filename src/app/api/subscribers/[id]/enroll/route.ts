import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { auditLogWithRequest } from "@/lib/audit";
import { createPoolEnrollmentService } from "@/lib/multi-pool";
import { normalizePaymentStatus, isExemptStatus } from "@/lib/rcs";

/**
 * POST /api/subscribers/[id]/enroll
 * تسجيل منخرط حالي في مسبح إضافي (انخراط متعدد لنفس الشخص) عبر createPoolEnrollmentService
 * Body: { poolId, subscriptionType, paymentStatus, lastPaymentDate, swimmingDays, timeSlot, customFileNumber, notes }
 */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.clubId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const clubId = currentUser.clubId;
    const { id: subscriberId } = await params;

    const body = await req.json();
    const {
      poolId,
      subscriptionType,
      paymentStatus,
      lastPaymentDate,
      swimmingDays,
      timeSlot,
      customFileNumber,
      notes,
    } = body;

    if (!poolId) {
      return NextResponse.json({ error: "poolId مطلوب" }, { status: 400 });
    }
    if (!subscriptionType) {
      return NextResponse.json({ error: "نوع الاشتراك مطلوب" }, { status: 400 });
    }

    const normalizedStatus = normalizePaymentStatus(paymentStatus || "مدفوع") || "مدفوع";

    const result = await createPoolEnrollmentService({
      clubId,
      poolId,
      subscriberId,
      subscriptionType,
      paymentStatus: normalizedStatus,
      lastPaymentDate: lastPaymentDate ? new Date(lastPaymentDate) : null,
      isExempt: isExemptStatus(normalizedStatus),
      swimmingDays: swimmingDays || null,
      timeSlot: timeSlot || null,
      customFileNumber: customFileNumber || null,
      notes: notes || null,
    });

    await auditLogWithRequest(req, currentUser, {
      action: "create",
      entityType: "PoolEnrollment",
      entityId: result.enrollment.id,
      description: `انخراط منخرط في مسبح ${result.pool.name} برقم ${result.enrollment.fileNumber}`,
    });

    return NextResponse.json({
      message: "تم تسجيل المنخرط في المسبح بنجاح",
      enrollment: result.enrollment,
      card: result.card,
    }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/subscribers/[id]/enroll error:", error);
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    const status = msg.includes("مسجل بالفعل") || msg.includes("نشطاً بالفعل") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

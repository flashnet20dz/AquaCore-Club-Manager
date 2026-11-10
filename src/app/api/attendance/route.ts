import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateRenewalStatus, calculateExpiryDate } from "@/lib/rcs";
import { getCurrentUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const subscriberId = url.searchParams.get("subscriberId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const poolId = url.searchParams.get("poolId");

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const where: Record<string, unknown> = { ...clubFilter };
    if (poolId && poolId !== "all") where.poolId = poolId;
    if (date) {
      const d = new Date(date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      where.date = { gte: d, lt: next };
    } else if (from && to) {
      where.date = { gte: new Date(from), lte: new Date(to) };
    }
    if (subscriberId) where.subscriberId = subscriberId;

    const attendances = await db.attendance.findMany({
      where,
      include: {
        subscriber: true,
        pool: { select: { id: true, name: true, code: true, color: true } },
        enrollment: { select: { id: true, fileNumber: true, subscriptionType: true } },
      },
      orderBy: { checkInTime: "desc" },
    });

    return NextResponse.json({ attendances });
  } catch (e) {
    console.error("GET attendance:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await req.json();
    const { subscriberId, method, date, note, checkInTime, poolId: rawRequestedPoolId, enrollmentId: requestedEnrollmentId } = body;
    const requestedPoolId = rawRequestedPoolId && rawRequestedPoolId !== "all" ? rawRequestedPoolId : null;

    if (!subscriberId) {
      return NextResponse.json({ error: "subscriberId required" }, { status: 400 });
    }

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const sub = await db.subscriber.findFirst({
      where: { id: subscriberId, ...clubFilter },
      include: {
        enrollments: {
          where: { status: "active" },
          select: {
            id: true,
            poolId: true,
            fileNumber: true,
            subscriptionType: true,
            paymentStatus: true,
            lastPaymentDate: true,
            expiryDate: true,
            pool: { select: { id: true, name: true, isDefault: true } },
          },
        },
      },
    });
    if (!sub) return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });

    // تحديد المسبح والانخراط
    let targetPoolId = requestedPoolId || null;
    let targetEnrollmentId = requestedEnrollmentId || null;
    let selectedEnrollment: any = null;

    if (sub.enrollments && sub.enrollments.length > 0) {
      if (requestedPoolId) {
        selectedEnrollment = sub.enrollments.find((e: any) => e.poolId === requestedPoolId);
      } else if (requestedEnrollmentId) {
        selectedEnrollment = sub.enrollments.find((e: any) => e.id === requestedEnrollmentId);
      } else if (sub.enrollments.length === 1) {
        selectedEnrollment = sub.enrollments[0];
      } else {
        // إذا كان مسجلاً في عدة مسابح بدون تحديد: نفضل المسبح الافتراضي
        selectedEnrollment = sub.enrollments.find((e: any) => e.pool?.isDefault) || sub.enrollments[0];
      }

      if (selectedEnrollment) {
        targetPoolId = selectedEnrollment.poolId;
        targetEnrollmentId = selectedEnrollment.id;
      }
    }
    if (!targetPoolId) targetPoolId = sub.poolId;

    // Compute renewal status to allow/deny check-in
    const effectivePaymentStatus = selectedEnrollment?.paymentStatus || sub.paymentStatus;
    const effectiveLastPayment = selectedEnrollment?.lastPaymentDate || sub.lastPaymentDate;
    const expiry = selectedEnrollment?.expiryDate || calculateExpiryDate(effectiveLastPayment);
    const renewalStatus = calculateRenewalStatus(effectivePaymentStatus as never, expiry);
    const isExpired = renewalStatus.includes("منتهي") && effectivePaymentStatus !== "معفى";
    const isFrozen = renewalStatus.includes("مجمدة");

    const today = date ? new Date(date) : new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await db.attendance.findUnique({
      where: { clubId_subscriberId_date: { clubId: sub.clubId, subscriberId, date: today } },
    });

    if (existing) {
      return NextResponse.json({
        error: "تم تسجيل الحضور اليوم",
        attendance: existing,
        status: "duplicate",
      }, { status: 409 });
    }

    // ★ وقت تسجيل الحضور: استخدم checkInTime المخصص إن قُدم، وإلا الآن
    const checkIn = checkInTime ? new Date(checkInTime) : new Date();
    const attendance = await db.attendance.create({
      data: {
        clubId: sub.clubId,
        subscriberId,
        poolId: targetPoolId || undefined,
        enrollmentId: targetEnrollmentId || undefined,
        date: today,
        checkInTime: checkIn,
        method: method || "manual",
        note: note || (isExpired ? "منتهي — يحتاج تجديد" : isFrozen ? "مجمد — لم يدفع" : null),
      },
      include: {
        subscriber: true,
        pool: { select: { id: true, name: true, code: true, color: true } },
        enrollment: { select: { id: true, fileNumber: true, subscriptionType: true } },
      },
    });

    await db.activity.create({
      data: {
        clubId: sub.clubId,
        subscriberId,
        type: "attendance",
        description: `حضر ${sub.lastName} ${sub.firstName} حصة اليوم`,
      },
    });

    // Return status info so frontend can play the right sound
    return NextResponse.json({
      attendance,
      status: isExpired ? "expired" : isFrozen ? "frozen" : "valid",
      renewalStatus,
    }, { status: 201 });
  } catch (e) {
    console.error("POST attendance:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const existing = await db.attendance.findFirst({ where: { id, ...clubFilter } });
    if (!existing) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }
    await db.attendance.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE attendance:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await req.json();
    const { id, checkOut } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const existing = await db.attendance.findFirst({ where: { id, ...clubFilter } });
    if (!existing) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }

    const attendance = await db.attendance.update({
      where: { id },
      data: checkOut ? { checkOutTime: new Date() } : {},
    });

    return NextResponse.json({ attendance });
  } catch (e) {
    console.error("PATCH attendance:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

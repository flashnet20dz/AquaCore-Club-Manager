import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getTypeConfig } from "@/lib/rcs";
import { resolveCardOrFileNumberService } from "@/lib/multi-pool";

/**
 * POST /api/qr-checkin
 * body: { fileNumber, cardUid, poolId }
 *
 * المنظومة الذكية للتحقق من QR والبطاقات (Enterprise Multi-Pool):
 *   1. الأولوية الأولى: رمز الأمان المشفر cardUid (AQCR-...) — دقيق وآمن 100%
 *   2. الأولوية الثانية: رقم الملف مع سياق المسبح
 *   3. حماية الغموض: إذا مسح رقم ملف عام مشترك بين أكثر من مسبح بدون سياق،
 *      يرفض الطلب بـ ambiguous: true ويطلب تحديد المسبح لمنع الخطأ في الحضور.
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await req.json();
    const { fileNumber, cardUid, poolId: rawRequestedPoolId } = body;
    const requestedPoolId = rawRequestedPoolId && rawRequestedPoolId !== "all" ? rawRequestedPoolId : null;
    const identifier = (cardUid || fileNumber || "").trim();

    if (!identifier) {
      return NextResponse.json({ error: "رقم الملف أو رمز البطاقة مطلوب" }, { status: 400 });
    }

    const targetClubId = currentUser.role === "superadmin"
      ? (body.clubId || currentUser.clubId)
      : currentUser.clubId;

    if (!targetClubId) {
      return NextResponse.json({ error: "لا يوجد نادي مرتبط" }, { status: 400 });
    }

    // ════ 1) حل معرّف البطاقة أو رقم الملف عبر الخدمة المركزية ════
    const resolved = await resolveCardOrFileNumberService(
      targetClubId,
      identifier,
      requestedPoolId || null,
      db
    );

    if (resolved.ambiguous) {
      return NextResponse.json({
        error: resolved.message,
        ambiguous: true,
        candidateEnrollments: resolved.candidateEnrollments,
      }, { status: 409 });
    }

    if (!resolved.found || !resolved.subscriber) {
      return NextResponse.json({
        error: resolved.message || "رمز البطاقة أو رقم الملف غير موجود أو ملغى",
      }, { status: 404 });
    }

    const sub = resolved.subscriber;
    const card = resolved.card;
    const enrollment = resolved.enrollment;
    const poolId = resolved.pool?.id || enrollment?.poolId || sub.poolId;

    if (card && card.status !== "active") {
      return NextResponse.json({
        error: `البطاقة غير نشطة (${card.status === "revoked" ? "ملغاة إدارياً" : "منتهية"})`,
      }, { status: 403 });
    }

    // ════ 2) التحقق من صلاحية الانخراط والاشتراك ════
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const effectivePaymentStatus = enrollment?.paymentStatus || sub.paymentStatus;
    const effectiveLastPayment = enrollment?.lastPaymentDate || sub.lastPaymentDate;
    const effectiveSubType = enrollment?.subscriptionType || sub.subscriptionType;

    let expiryDate: Date | null = enrollment?.expiryDate || null;
    if (!expiryDate && effectiveLastPayment) {
      const durationDays = getTypeConfig(effectiveSubType).durationDays;
      expiryDate = new Date(effectiveLastPayment);
      expiryDate.setDate(expiryDate.getDate() + durationDays);
    }

    let status: "ok" | "expired" | "no_payment" = "ok";
    if (effectivePaymentStatus === "لم يدفع") {
      status = "no_payment";
    } else if (effectivePaymentStatus !== "معفى" && expiryDate && expiryDate < today) {
      status = "expired";
    }

    // ════ 3) التحقق من الحضور المسبق اليوم ════
    const existing = await db.attendance.findUnique({
      where: { clubId_subscriberId_date: { clubId: targetClubId, subscriberId: sub.id, date: today } },
    });

    if (existing) {
      return NextResponse.json({
        success: false,
        alreadyCheckedIn: true,
        subscriber: sub,
        attendance: existing,
        pool: resolved.pool,
        enrollment,
      });
    }

    // ════ 4) إنشاء سجل الحضور المرتبط بالمسبح والانخراط ════
    const checkIn = new Date();
    const attendance = await db.attendance.create({
      data: {
        clubId: targetClubId,
        subscriberId: sub.id,
        poolId: poolId || undefined,
        enrollmentId: enrollment?.id || undefined,
        date: today,
        checkInTime: checkIn,
        method: cardUid ? "qr" : "barcode",
        note: status !== "ok" ? `حضور مع تحفظ: ${status === "expired" ? "اشتراك منتهي" : "لم يدفع"}` : null,
      },
      select: {
        id: true,
        checkInTime: true,
        method: true,
        note: true,
        date: true,
        poolId: true,
        enrollmentId: true,
      },
    });

    // تسجيل النشاط في الخلفية
    db.activity.create({
      data: {
        clubId: targetClubId,
        subscriberId: sub.id,
        type: "attendance",
        description: `حضر ${sub.lastName} ${sub.firstName} عبر QR في ${resolved.pool?.name || "المسبح"}${card ? ` [بطاقة ${card.cardNumber}]` : ""}`,
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      subscriber: sub,
      enrollment,
      poolId,
      pool: resolved.pool,
      attendance,
      status,
      expiryDate,
    }, { status: 201 });
  } catch (e) {
    console.error("QR checkin error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

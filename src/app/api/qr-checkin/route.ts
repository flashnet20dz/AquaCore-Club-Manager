import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// POST /api/qr-checkin  body: { fileNumber }
// ★ محسّن للأداء العالي:
//   - استخدام findFirst مع select خفيف بدلاً من include كل الحقول
//   - إزالة db.activity.create من المسار الحرج (تسجيله في الخلفية)
//   - أقل استعلامات DB ممكنة
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await req.json();
    const { fileNumber } = body;

    if (!fileNumber) {
      return NextResponse.json({ error: "رقم الملف مطلوب" }, { status: 400 });
    }

    // ★ استعلام خفيف: جلب فقط الحقول الضرورية للحضور
    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const sub = await db.subscriber.findFirst({
      where: { fileNumber, ...clubFilter },
      select: {
        id: true,
        clubId: true,
        lastName: true,
        firstName: true,
        fileNumber: true,
        gender: true,
        paymentStatus: true,
        lastPaymentDate: true,
        phone: true,
      },
    });
    if (!sub) {
      return NextResponse.json({ error: "رقم الملف غير موجود" }, { status: 404 });
    }

    // Check subscription validity (حساب بسيط بدون استعلام DB)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let expiryDate: Date | null = null;
    if (sub.lastPaymentDate) {
      expiryDate = new Date(sub.lastPaymentDate);
      expiryDate.setDate(expiryDate.getDate() + 30);
    }

    let status: "ok" | "expired" | "no_payment" = "ok";
    if (sub.paymentStatus === "لم يدفع") status = "no_payment";
    else if (expiryDate && expiryDate < today) status = "expired";

    // ★ استعلام واحد للتحقق من الحضور المسبق (معرّف فريد مضمّن)
    const existing = await db.attendance.findUnique({
      where: { clubId_subscriberId_date: { clubId: sub.clubId, subscriberId: sub.id, date: today } },
    });

    if (existing) {
      return NextResponse.json({
        success: false,
        alreadyCheckedIn: true,
        subscriber: sub,
        attendance: existing,
      });
    }

    // إنشاء سجل الحضور
    const checkIn = new Date();
    const attendance = await db.attendance.create({
      data: {
        clubId: sub.clubId,
        subscriberId: sub.id,
        date: today,
        checkInTime: checkIn,
        method: "qr",
        note: status !== "ok" ? `حضور مع تحفظ: ${status === "expired" ? "اشتراك منتهي" : "لم يدفع"}` : null,
      },
      select: {
        id: true,
        checkInTime: true,
        method: true,
        note: true,
        date: true,
      },
    });

    // ★ تسجيل النشاط في الخلفية (لا يوقف الاستجابة)
    // هذا يحسّن زمن الاستجابة بنسبة ~50%
    db.activity.create({
      data: {
        clubId: sub.clubId,
        subscriberId: sub.id,
        type: "attendance",
        description: `حضر ${sub.lastName} ${sub.firstName} عبر QR`,
      },
    }).catch(() => {/* تجاهل — تسجيل النشاط اختياري */});

    return NextResponse.json({
      success: true,
      subscriber: sub,
      attendance,
      status,
      expiryDate,
    }, { status: 201 });
  } catch (e) {
    console.error("QR checkin:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

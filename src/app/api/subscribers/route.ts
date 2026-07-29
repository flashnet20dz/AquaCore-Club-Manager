import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { recordSyncOutbox } from "@/lib/sync-outbox";
import {
  computeSubscriberFields,
  generateFileNumber,
  type Gender,
  type SubscriptionType,
  type PaymentStatus,
} from "@/lib/rcs";

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

    const url = new URL(req.url);
    const search = url.searchParams.get("search") || "";
    const paymentStatus = url.searchParams.get("paymentStatus") || "";
    const subscriptionType = url.searchParams.get("subscriptionType") || "";
    const gender = url.searchParams.get("gender") || "";
    const renewalStatus = url.searchParams.get("renewalStatus") || "";

    // 🔑 تحميل كل المنخرطين افتراضياً (not just 100)
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.min(10000, Math.max(1, parseInt(limitParam))) : 10000;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId };
    if (search) {
      where.OR = [
        { lastName: { contains: search } },
        { firstName: { contains: search } },
        { fileNumber: { contains: search } },
        { phone: { contains: search } },
      ];
    }
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (subscriptionType) where.subscriptionType = subscriptionType;
    if (gender) where.gender = gender;

    // 🔑 الترتيب الافتراضي حسب رقم الملف (تصاعدي) — خاصية دائمة
    const sortBy = url.searchParams.get("sortBy") || "fileNumber";
    const sortOrder = (url.searchParams.get("sortOrder") || "asc") as "asc" | "desc";

    // 🔒 Pagination: اجلب العدد الإجمالي + الصفحة الحالية
    const [subscribers, total] = await Promise.all([
      db.subscriber.findMany({
        where,
        orderBy: sortBy === "fileNumber" ? { fileNumber: sortOrder } : { createdAt: sortOrder },
        take: limit,
        skip,
      }),
      db.subscriber.count({ where }),
    ]);

    const computed = subscribers.map((s) => ({
      ...s,
      ...computeSubscriberFields(s),
    }));

    let filtered = computed;
    if (renewalStatus === "سارية") {
      filtered = computed.filter((s) => s.renewalStatus === "✅ ساري");
    } else if (renewalStatus === "قريبة") {
      filtered = computed.filter((s) => s.renewalStatus === "⚠️ قريب الانتهاء");
    } else if (renewalStatus === "منتهية") {
      filtered = computed.filter((s) => s.renewalStatus === "⛔ منتهي - يتطلب تجديد");
    } else if (renewalStatus === "مجمدة") {
      filtered = computed.filter((s) => s.renewalStatus === "🔒 مجمدة");
    }

    return NextResponse.json({
      subscribers: filtered,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + subscribers.length < total,
      },
    });
  } catch (error) {
    console.error("GET /api/subscribers error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.clubId) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

    const body = await req.json();

    if (!body.lastName || !body.firstName || !body.birthDate || !body.gender || !body.subscriptionType || !body.paymentStatus) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const count = await db.subscriber.count({ where: { clubId: currentUser.clubId } });

    // التحقق من نوع الاشتراك و numberingGroup
    const subType = await db.subscriptionType.findFirst({
      where: { clubId: currentUser.clubId, code: body.subscriptionType },
      select: { givesMembershipNumber: true, freeSubscription: true, numberingGroup: true },
    });

    let fileNumber: string;
    if (subType && !subType.givesMembershipNumber) {
      // النوع لا يمنح رقم عضوية — استخدم الكود نفسه
      fileNumber = body.subscriptionType;
    } else {
      // النوع يمنح رقم عضوية — استخدم numberingGroup + عداد
      const group = subType?.numberingGroup || "RCS";
      // البحث عن أكبر رقم موجود في هذه المجموعة
      const existingSubs = await db.subscriber.findMany({
        where: { clubId: currentUser.clubId },
        select: { fileNumber: true },
      });
      let maxNum = 0;
      for (const sub of existingSubs) {
        const match = sub.fileNumber.match(new RegExp(`^${group}(\\d+)$`));
        if (match) {
          const num = parseInt(match[1]);
          if (num > maxNum) maxNum = num;
        }
      }
      // تجربة أرقام حتى نجد واحداً غير مستخدم
      let attempts = 0;
      fileNumber = `${group}${String(maxNum + 1).padStart(3, "0")}`;
      while (attempts < 100) {
        const conflict = existingSubs.some(s => s.fileNumber === fileNumber);
        if (!conflict) break;
        maxNum++;
        fileNumber = `${group}${String(maxNum + 1).padStart(3, "0")}`;
        attempts++;
      }
    }

    const subscriber = await db.subscriber.create({
      data: {
        clubId: currentUser.clubId,
        fileNumber,
        lastName: body.lastName,
        firstName: body.firstName,
        birthDate: new Date(body.birthDate),
        gender: body.gender as Gender,
        bloodType: body.bloodType || null,
        subscriptionType: body.subscriptionType as SubscriptionType,
        lastPaymentDate: body.lastPaymentDate ? new Date(body.lastPaymentDate) : null,
        paymentStatus: body.paymentStatus as PaymentStatus,
        swimmingDays: body.swimmingDays || null,
        timeSlot: body.timeSlot || null,
        phone: body.phone || null,
      },
    });

    await db.activity.create({
      data: {
        clubId: currentUser.clubId,
        subscriberId: subscriber.id,
        type: "create",
        description: `تم تسجيل منخرط جديد: ${subscriber.lastName} ${subscriber.firstName} (${fileNumber})`,
      },
    });

    await recordSyncOutbox({
      clubId: currentUser.clubId,
      modelName: "subscriber",
      recordId: subscriber.id,
      operation: "create",
      payload: subscriber,
    });

    const fields = computeSubscriberFields(subscriber);
    return NextResponse.json({ subscriber: { ...subscriber, ...fields } }, { status: 201 });
  } catch (error) {
    console.error("POST /api/subscribers error:", error);
    const errMsg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

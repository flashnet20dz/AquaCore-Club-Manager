import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { recordSyncOutbox } from "@/lib/sync-outbox";
import {
  computeSubscriberFields,
  computeSubscriberFieldsDynamic,
  generateFileNumber,
  type Gender,
  type SubscriptionType,
  type PaymentStatus,
  type SubscriptionTypeConfig,
  normalizePaymentStatus,
  isExemptStatus,
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

    // ★ جلب أنواع الاشتراك من قاعدة البيانات لحساب الرسوم الصحيحة
    const dbTypes = await db.subscriptionType.findMany({
      where: currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! },
    });
    const typesMap: Record<string, SubscriptionTypeConfig> = {};
    for (const t of dbTypes) {
      typesMap[t.code] = {
        code: t.code,
        name: t.name,
        subscriptionFee: t.subscriptionFee,
        insuranceFee: t.insuranceFee,
        compoundRights: t.compoundRights,
        durationDays: t.durationDays,
        givesMembershipNumber: t.givesMembershipNumber,
        requiresInsurance: t.requiresInsurance,
        requiresCompoundFee: t.requiresCompoundFee,
        renewableMonthly: t.renewableMonthly,
        freeSubscription: t.freeSubscription,
      };
    }
    const getTypeConfigFor = (code: string): SubscriptionTypeConfig | undefined => typesMap[code];

    const computed = subscribers.map((s) => {
      const typeConfig = getTypeConfigFor(s.subscriptionType as string);
      return {
        ...s,
        ...(typeConfig ? computeSubscriberFieldsDynamic(s as any, typeConfig) : computeSubscriberFields(s as any)),
      };
    });

    let filtered = computed;
    if (renewalStatus === "سارية") {
      filtered = computed.filter((s) => s.renewalStatus === "✅ ساري");
    } else if (renewalStatus === "قريبة") {
      filtered = computed.filter((s) => s.renewalStatus === "⚠️ قريب الانتهاء");
    } else if (renewalStatus === "منتهية") {
      filtered = computed.filter((s) => s.renewalStatus === "⛔ منتهي - يتطلب تجديد");
    } else if (renewalStatus === "مجمدة") {
      filtered = computed.filter((s) => s.renewalStatus === "🔒 مجمدة");
    } else if (renewalStatus === "معفى") {
      // ★ Filter by exempt flag (EXEMPT subscribers)
      filtered = computed.filter((s) => s.isExempt);
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

    // ★ Normalize payment status — accepts معفى/معفاة/EXEMPT/EXEMPTED → "معفى"
    const normalizedStatus = normalizePaymentStatus(body.paymentStatus);
    if (!normalizedStatus) {
      return NextResponse.json({
        error: `حالة دفع غير صالحة: "${body.paymentStatus}". القيم المقبولة: مدفوع، لم يدفع، تأمين فقط، اشتراك 300، معفى`,
      }, { status: 400 });
    }

    const count = await db.subscriber.count({ where: { clubId: currentUser.clubId } });

    // التحقق من نوع الاشتراك و numberingGroup + جلب الإعدادات الكاملة
    const subType = await db.subscriptionType.findFirst({
      where: { clubId: currentUser.clubId, code: body.subscriptionType },
    });

    let fileNumber: string;
    // ★ إذا قدم المستخدم رقم ملف يدوياً، استخدمه
    if (body.fileNumber && body.fileNumber.trim()) {
      fileNumber = body.fileNumber.trim();
    } else if (subType && !subType.givesMembershipNumber) {
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
        // ★ EXEMPT subscribers may not have a payment date — that's fine
        lastPaymentDate: body.lastPaymentDate ? new Date(body.lastPaymentDate) : null,
        paymentStatus: normalizedStatus as PaymentStatus,
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
        description: isExemptStatus(normalizedStatus)
          ? `تم تسجيل منخرط معفى: ${subscriber.lastName} ${subscriber.firstName} (${fileNumber})`
          : `تم تسجيل منخرط جديد: ${subscriber.lastName} ${subscriber.firstName} (${fileNumber})`,
      },
    });

    await recordSyncOutbox({
      clubId: currentUser.clubId,
      modelName: "subscriber",
      recordId: subscriber.id,
      operation: "create",
      payload: subscriber,
    });

    // ★ حساب الحقول باستخدام إعدادات نوع الاشتراك من قاعدة البيانات
    const postTypeConfig = subType ? {
      code: subType.code, name: subType.name,
      subscriptionFee: subType.subscriptionFee, insuranceFee: subType.insuranceFee,
      compoundRights: subType.compoundRights, durationDays: subType.durationDays,
      givesMembershipNumber: subType.givesMembershipNumber, requiresInsurance: subType.requiresInsurance,
      requiresCompoundFee: subType.requiresCompoundFee, renewableMonthly: subType.renewableMonthly,
      freeSubscription: subType.freeSubscription,
    } as SubscriptionTypeConfig : undefined;
    const fields = postTypeConfig
      ? computeSubscriberFieldsDynamic(subscriber as any, postTypeConfig)
      : computeSubscriberFields(subscriber as any);
    return NextResponse.json({ subscriber: { ...subscriber, ...fields } }, { status: 201 });
  } catch (error) {
    console.error("POST /api/subscribers error:", error);
    const errMsg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

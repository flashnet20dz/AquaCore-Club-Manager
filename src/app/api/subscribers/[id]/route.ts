import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeSubscriberFields, computeSubscriberFieldsDynamic, normalizePaymentStatus, type SubscriptionTypeConfig } from "@/lib/rcs";
import { getCurrentUser } from "@/lib/session";
import { recordSyncOutbox } from "@/lib/sync-outbox";
import { checkWaitlistPromotion } from "@/lib/waitlist";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;
    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const subscriber = await db.subscriber.findFirst({ where: { id, ...clubFilter } });
    if (!subscriber) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // ★ جلب إعدادات نوع الاشتراك من قاعدة البيانات
    const subType = subscriber.clubId ? await db.subscriptionType.findFirst({
      where: { clubId: subscriber.clubId, code: subscriber.subscriptionType },
    }) : null;
    const typeConfig = subType ? {
      code: subType.code, name: subType.name,
      subscriptionFee: subType.subscriptionFee, insuranceFee: subType.insuranceFee,
      compoundRights: subType.compoundRights, durationDays: subType.durationDays,
      givesMembershipNumber: subType.givesMembershipNumber, requiresInsurance: subType.requiresInsurance,
      requiresCompoundFee: subType.requiresCompoundFee, renewableMonthly: subType.renewableMonthly,
      freeSubscription: subType.freeSubscription,
    } as SubscriptionTypeConfig : undefined;
    const fields = typeConfig
      ? computeSubscriberFieldsDynamic(subscriber as any, typeConfig)
      : computeSubscriberFields(subscriber as any);
    return NextResponse.json({ subscriber: { ...subscriber, ...fields } });
  } catch (error) {
    console.error("GET /api/subscribers/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const existing = await db.subscriber.findFirst({ where: { id, ...clubFilter } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // ★ Normalize payment status if provided (accepts معفى/EXEMPT/...)
    let normalizedStatus: string | undefined;
    if (body.paymentStatus) {
      normalizedStatus = normalizePaymentStatus(body.paymentStatus) || undefined;
      if (!normalizedStatus) {
        return NextResponse.json({
          error: `حالة دفع غير صالحة: "${body.paymentStatus}". القيم المقبولة: مدفوع، لم يدفع، تأمين فقط، اشتراك 300، معفى`,
        }, { status: 400 });
      }
    }

    // بناء بيانات التحديث — لا نرسل fileNumber إلا إذا تغير النوع فعلاً
    let updateData: any = {
      lastName: body.lastName ?? existing.lastName,
      firstName: body.firstName ?? existing.firstName,
      birthDate: body.birthDate ? new Date(body.birthDate) : existing.birthDate,
      gender: body.gender ?? existing.gender,
      bloodType: body.bloodType !== undefined ? (body.bloodType || null) : existing.bloodType,
      subscriptionType: body.subscriptionType ?? existing.subscriptionType,
      lastPaymentDate: body.lastPaymentDate !== undefined
        ? (body.lastPaymentDate ? new Date(body.lastPaymentDate) : null)
        : existing.lastPaymentDate,
      // ★ Use normalized status (accepts معفى/معفاة/EXEMPT/EXEMPTED → "معفى")
      paymentStatus: normalizedStatus ?? existing.paymentStatus,
      swimmingDays: body.swimmingDays !== undefined ? (body.swimmingDays || null) : existing.swimmingDays,
      timeSlot: body.timeSlot !== undefined ? (body.timeSlot || null) : existing.timeSlot,
      phone: body.phone !== undefined ? (body.phone || null) : existing.phone,
    };

    // ═══ توليد رقم ملف جديد فقط إذا تغير نوع الاشتراك فعلاً ═══
    // التحقق: هل النوع الجديد موجود في body AND مختلف عن النوع القديم؟
    const newTypeCode = body.subscriptionType;
    const oldTypeCode = existing.subscriptionType;
    const typeActuallyChanged = newTypeCode && newTypeCode !== oldTypeCode;

    if (typeActuallyChanged) {
      console.log(`[UPDATE] Type changed: ${oldTypeCode} → ${newTypeCode} for subscriber ${existing.fileNumber}`);
      const newType = await db.subscriptionType.findFirst({
        where: { clubId: existing.clubId, code: newTypeCode },
        select: { givesMembershipNumber: true, numberingGroup: true },
      });

      if (newType && !newType.givesMembershipNumber) {
        // النوع الجديد لا يمنح رقم عضوية — استبدل رقم الملف بالكود
        updateData.fileNumber = newTypeCode;
        console.log(`[UPDATE] New fileNumber (no membership): ${newTypeCode}`);
      } else if (newType && newType.givesMembershipNumber) {
        // النوع الجديد يمنح رقم عضوية — ولّد رقماً جديداً
        const group = newType.numberingGroup || "RCS";
        // استثناء السجل الحالي من قائمة التحقق
        const existingSubs = await db.subscriber.findMany({
          where: { clubId: existing.clubId, id: { not: id } },
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
        // تجربة أرقام حتى نجد واحداً غير مستخدم (مع استثناء السجل الحالي)
        let attempts = 0;
        let newFileNumber = `${group}${String(maxNum + 1).padStart(3, "0")}`;
        while (attempts < 100) {
          const conflict = existingSubs.some(s => s.fileNumber === newFileNumber);
          if (!conflict) break;
          maxNum++;
          newFileNumber = `${group}${String(maxNum + 1).padStart(3, "0")}`;
          attempts++;
        }
        updateData.fileNumber = newFileNumber;
        console.log(`[UPDATE] New fileNumber (generated): ${newFileNumber} (group: ${group}, max: ${maxNum})`);
      }
      // إذا لم يوجد النوع في DB — لا نغير fileNumber
    }
    // إذا لم يتغير النوع: لا نضع fileNumber في updateData إطلاقاً → يبقى كما هو

    const subscriber = await db.subscriber.update({
      where: { id },
      data: updateData,
    });

    await db.activity.create({
      data: {
        clubId: existing.clubId,
        subscriberId: subscriber.id,
        type: "update",
        description: `تم تحديث بيانات ${subscriber.lastName} ${subscriber.firstName}`,
      },
    });

    await recordSyncOutbox({
      clubId: existing.clubId,
      modelName: "subscriber",
      recordId: subscriber.id,
      operation: "update",
      payload: subscriber,
    });

    // إذا تغيّرت حصة المنخرط (أو انتهى اشتراكه) — الحصة القديمة تحرّرت مكاناً محتملاً
    const slotChanged =
      existing.swimmingDays !== subscriber.swimmingDays || existing.timeSlot !== subscriber.timeSlot;
    if (slotChanged) {
      await checkWaitlistPromotion(existing.clubId, existing.swimmingDays, existing.timeSlot);
    }

    // ★ حساب الحقول باستخدام إعدادات نوع الاشتراك من قاعدة البيانات
    const putSubType = subscriber.clubId ? await db.subscriptionType.findFirst({
      where: { clubId: subscriber.clubId, code: subscriber.subscriptionType },
    }) : null;
    const putTypeConfig = putSubType ? {
      code: putSubType.code, name: putSubType.name,
      subscriptionFee: putSubType.subscriptionFee, insuranceFee: putSubType.insuranceFee,
      compoundRights: putSubType.compoundRights, durationDays: putSubType.durationDays,
      givesMembershipNumber: putSubType.givesMembershipNumber, requiresInsurance: putSubType.requiresInsurance,
      requiresCompoundFee: putSubType.requiresCompoundFee, renewableMonthly: putSubType.renewableMonthly,
      freeSubscription: putSubType.freeSubscription,
    } as SubscriptionTypeConfig : undefined;
    const fields = putTypeConfig
      ? computeSubscriberFieldsDynamic(subscriber as any, putTypeConfig)
      : computeSubscriberFields(subscriber as any);
    return NextResponse.json({ subscriber: { ...subscriber, ...fields } });
  } catch (error) {
    console.error("PUT /api/subscribers/[id] error:", error);
    const errMsg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;
    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const sub = await db.subscriber.findFirst({ where: { id, ...clubFilter } });
    if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.activity.create({
      data: {
        clubId: sub.clubId,
        type: "delete",
        description: `تم حذف المنخرط ${sub.lastName} ${sub.firstName} (${sub.fileNumber})`,
      },
    });

    // 🔑 احذف صورة Cloudinary إن وُجدت (قبل حذف السجل)
    try {
      const photo = await db.subscriberPhoto.findUnique({
        where: { subscriberId: id },
        select: { cloudinaryPublicId: true },
      });
      if (photo?.cloudinaryPublicId) {
        const { deleteImage } = await import("@/lib/cloudinary");
        await deleteImage(photo.cloudinaryPublicId);
      }
    } catch (e) {
      console.warn("Failed to delete Cloudinary image:", e);
    }

    await db.subscriber.delete({ where: { id } });

    await recordSyncOutbox({
      clubId: sub.clubId,
      modelName: "subscriber",
      recordId: sub.id,
      operation: "delete",
      payload: { id: sub.id, clubId: sub.clubId },
    });

    await checkWaitlistPromotion(sub.clubId, sub.swimmingDays, sub.timeSlot);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/subscribers/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import {
  countCancelledSessionsInRange,
  calculateCompensationExpiryDate,
} from "@/lib/rcs";

/**
 * GET /api/pool-closures
 * يرجع كل عمليات إغلاق المسبح (الأحدث أولاً) مع عدد المتأثرين لكل واحدة.
 */
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };

    const closures = await db.poolClosure.findMany({
      where: clubFilter,
      include: {
        compensations: {
          include: { subscriber: true },
        },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ closures });
  } catch (e) {
    console.error("GET pool-closures:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

/**
 * POST /api/pool-closures
 * ينشئ إغلاقاً للمسبح، ويكتشف تلقائياً كل المنخرطين الذين يطابقون معايير التصفية،
 * وينشئ لهم سجلات تعويض (status = pending).
 *
 * body: {
 *   date, reason, note?,
 *   swimmingDays?, timeSlot?,              // تصفية حسب الحصة المعتادة (اختياري)
 *   registeredOnOrBefore?, registeredOnOrAfter?,  // تصفية حسب تاريخ التسجيل (اختياري، ISO date)
 *   subscriptionTypes?: string[],          // ★ تصفية حسب نوع الاشتراك (متعدد)
 *   paymentStatuses?: string[],            // ★ تصفية حسب حالة الدفع (متعدد)
 * }
 * - كل معايير التصفية اختيارية ومجتمعة بـ AND. إذا كلها فارغة = يشمل كل المنخرطين.
 * - مثال "تعويض جماعي": ترك swimmingDays/timeSlot فارغين، وتحديد registeredOnOrBefore
 *   فقط → يعوّض كل المنخرطين المسجلين في أو قبل ذلك التاريخ، بغض النظر عن حصتهم.
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await req.json();
    const {
      date, startDate, endDate,
      swimmingDays, timeSlot, reason, note,
      registeredOnOrBefore, registeredOnOrAfter,
      subscriptionTypes, paymentStatuses,
      validityDays,
    } = body;

    if (!reason) {
      return NextResponse.json({ error: "سبب الإغلاق مطلوب" }, { status: 400 });
    }

    // ★ دعم فترة الإغلاق: startDate + endDate (أو date للتوافق مع القديم)
    let closureStart: Date;
    let closureEnd: Date;
    if (startDate && endDate) {
      closureStart = new Date(startDate);
      closureStart.setHours(0, 0, 0, 0);
      closureEnd = new Date(endDate);
      closureEnd.setHours(23, 59, 59, 999);
      if (closureEnd < closureStart) {
        return NextResponse.json({ error: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية" }, { status: 400 });
      }
    } else if (date) {
      // توافق مع القديم: إغلاق يوم واحد
      closureStart = new Date(date);
      closureStart.setHours(0, 0, 0, 0);
      closureEnd = new Date(date);
      closureEnd.setHours(23, 59, 59, 999);
    } else {
      return NextResponse.json({ error: "تاريخ الإغلاق (أو فترة الإغلاق) مطلوب" }, { status: 400 });
    }

    const clubId = currentUser.role === "superadmin" ? body.clubId : currentUser.clubId!;
    if (!clubId) {
      return NextResponse.json({ error: "النادي غير محدد" }, { status: 400 });
    }

    const closureDate = closureStart; // للتوافق: date = startDate
    const validity = Number(validityDays) || 60; // مهلة افتراضية 60 يوماً

    // 1) أنشئ سجل الإغلاق (مع فترة الإغلاق + الفلاتر المحفوظة)
    const closure = await db.poolClosure.create({
      data: {
        clubId,
        date: closureDate,
        startDate: closureStart,
        endDate: closureEnd,
        swimmingDays: swimmingDays || null,
        timeSlot: timeSlot || null,
        reason,
        note: note || null,
        createdById: currentUser.id,
        // ★ حفظ الفلاتر للسجل
        subscriptionTypesFilter: Array.isArray(subscriptionTypes) && subscriptionTypes.length > 0
          ? JSON.stringify(subscriptionTypes) : null,
        paymentStatusesFilter: Array.isArray(paymentStatuses) && paymentStatuses.length > 0
          ? JSON.stringify(paymentStatuses) : null,
        registeredOnOrAfter: registeredOnOrAfter ? new Date(registeredOnOrAfter) : null,
        registeredOnOrBefore: registeredOnOrBefore ? new Date(registeredOnOrBefore) : null,
      },
    });

    // 2) اكتشف المنخرطين المتأثرين حسب كل معايير التصفية المُحدَّدة (AND)
    const where: Record<string, unknown> = { clubId };
    if (swimmingDays) where.swimmingDays = swimmingDays;
    if (timeSlot) where.timeSlot = timeSlot;

    // ★ تصفية حسب تاريخ التسجيل (من تاريخ إلى يوم الغلق)
    if (registeredOnOrBefore || registeredOnOrAfter) {
      const createdAtFilter: Record<string, Date> = {};
      if (registeredOnOrBefore) {
        const end = new Date(registeredOnOrBefore);
        end.setHours(23, 59, 59, 999);
        createdAtFilter.lte = end;
      }
      if (registeredOnOrAfter) {
        const start = new Date(registeredOnOrAfter);
        start.setHours(0, 0, 0, 0);
        createdAtFilter.gte = start;
      }
      where.createdAt = createdAtFilter;
    }

    // ★ تصفية حسب نوع الاشتراك (متعدد)
    if (Array.isArray(subscriptionTypes) && subscriptionTypes.length > 0) {
      where.subscriptionType = { in: subscriptionTypes };
    }

    // ★ تصفية حسب حالة الدفع (متعدد)
    if (Array.isArray(paymentStatuses) && paymentStatuses.length > 0) {
      where.paymentStatus = { in: paymentStatuses };
    }

    const affectedSubscribers = await db.subscriber.findMany({ where });

    // 3) ★ أنشئ سجل تعويض pending لكل منخرط متأثر
    //    مع حساب عدد الحصص الملغاة الفعلية لكل منخرط (من جدول فوجه)
    if (affectedSubscribers.length > 0) {
      // احسب cancelledSessionsCount لكل منخرط
      const compensationData = affectedSubscribers.map((s) => {
        // ★ عدد الحصص الملغاة = عدد أيام فوجه ضمن فترة الإغلاق
        const cancelledCount = countCancelledSessionsInRange(
          closureStart,
          closureEnd,
          s.swimmingDays
        );
        // ★ تاريخ انتهاء الصلاحية = originalDate + validityDays
        const expiry = calculateCompensationExpiryDate(closureStart, validity);
        return {
          clubId,
          closureId: closure.id,
          subscriberId: s.id,
          originalDate: closureDate,
          originalSwimmingDays: s.swimmingDays,
          originalTimeSlot: s.timeSlot,
          status: "pending",
          cancelledSessionsCount: Math.max(1, cancelledCount),
          compensatedCount: 0,
          expiryDate: expiry,
        };
      });

      await db.compensation.createMany({ data: compensationData });

      // ★ سجل تدقيق: إنشاء تعويضات
      await db.compensationHistory.create({
        data: {
          clubId,
          closureId: closure.id,
          action: "created",
          description: `إنشاء ${compensationData.length} تعويض لفترة ${closureStart.toLocaleDateString("ar")} ← ${closureEnd.toLocaleDateString("ar")} (${reason})`,
          newValue: JSON.stringify({
            count: compensationData.length,
            totalCancelledSessions: compensationData.reduce((s, c) => s + c.cancelledSessionsCount, 0),
            validityDays: validity,
          }),
          userId: currentUser.id,
        },
      });

      // 4) إشعار لكل منخرط متأثر
      const isMultiDay = closureEnd.getTime() - closureStart.getTime() > 86400000;
      await db.notification.createMany({
        data: affectedSubscribers.map((s) => {
          const comp = compensationData.find((c) => c.subscriberId === s.id)!;
          return {
            clubId,
            type: "pool_closure",
            title: "إغلاق المسبح للصيانة",
            message: isMultiDay
              ? `تم إغلاق المسبح من ${closureStart.toLocaleDateString("ar")} إلى ${closureEnd.toLocaleDateString("ar")} بسبب: ${reason}. سيتم تعويض ${comp.cancelledSessionsCount} حصة ملغاة للمنخرط ${s.firstName} ${s.lastName}.`
              : `تم إغلاق حصة "${s.swimmingDays ?? ""} — ${s.timeSlot ?? ""}" بتاريخ ${closureDate.toLocaleDateString("ar")} بسبب: ${reason}. سيتم تعويض المنخرط ${s.firstName} ${s.lastName} بحصة بديلة.`,
            link: `/dashboard/compensations?subscriberId=${s.id}`,
          };
        }),
      });

      const totalCancelledSessions = compensationData.reduce((s, c) => s + c.cancelledSessionsCount, 0);

      await db.activity.create({
        data: {
          clubId,
          type: "pool_closure",
          description: isMultiDay
            ? `إغلاق مسبح للصيانة من ${closureStart.toLocaleDateString("ar")} إلى ${closureEnd.toLocaleDateString("ar")} — تأثر ${affectedSubscribers.length} منخرط(ة) بـ ${totalCancelledSessions} حصة ملغاة`
            : `إغلاق مسبح للصيانة بتاريخ ${closureDate.toLocaleDateString("ar")} — تأثر ${affectedSubscribers.length} منخرط(ة)`,
          userId: currentUser.id,
          metadata: JSON.stringify({
            closureId: closure.id, reason, count: affectedSubscribers.length,
            totalCancelledSessions,
            registeredOnOrBefore: registeredOnOrBefore || null,
            registeredOnOrAfter: registeredOnOrAfter || null,
          }),
        },
      });
    }

    return NextResponse.json({
      closure,
      affectedCount: affectedSubscribers.length,
      totalCancelledSessions: affectedSubscribers.length > 0
        ? (await db.compensation.aggregate({
            where: { closureId: closure.id },
            _sum: { cancelledSessionsCount: true },
          }))._sum.cancelledSessionsCount || 0
        : 0,
    });
  } catch (e) {
    console.error("POST pool-closures:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

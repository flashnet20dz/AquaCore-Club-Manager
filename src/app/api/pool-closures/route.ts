import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import {
  countCancelledSessionsInRange,
  calculateCompensationExpiryDate,
} from "@/lib/rcs";
import { formatDate } from "@/lib/date-utils";

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
      extendSubscriptionDays = false,
      createCompensations = true,
      selectedSubscriberIds,
      unexpiredOnly = false,
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

    // 🔧 إصلاح off-by-one: الفترة 00:00:00 → 23:59:59.999 = 0.99999 يوم
    // القديمة: round(0.99999)+1 = 2 لليوم الواحد → كانت تُمدد الاشتراكات يوماً زائداً
    const closureDays = Math.max(1, Math.round((closureEnd.getTime() - closureStart.getTime()) / 86400000));
    const closureDaysMs = closureDays * 86400000;
    const reopenDate = new Date(closureEnd.getTime() + 86400000);
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

    if (Array.isArray(subscriptionTypes) && subscriptionTypes.length > 0) {
      where.subscriptionType = { in: subscriptionTypes };
    }

    if (Array.isArray(paymentStatuses) && paymentStatuses.length > 0) {
      where.paymentStatus = { in: paymentStatuses };
    }

    const dbTypes = await db.subscriptionType.findMany({
      where: clubId ? { clubId } : {},
      select: { code: true, durationDays: true },
    });
    const durationMap = new Map(dbTypes.map((t) => [t.code, t.durationDays || 30]));

    const candidateSubscribers = await db.subscriber.findMany({
      where,
      include: {
        renewals: {
          orderBy: { expiryDate: "desc" },
          take: 1,
        },
      },
    });

    // Determine target subscribers (selection / unexpiredOnly filtering)
    let affectedSubscribers = candidateSubscribers;

    if (Array.isArray(selectedSubscriberIds) && selectedSubscriberIds.length > 0) {
      const idSet = new Set(selectedSubscriberIds);
      affectedSubscribers = candidateSubscribers.filter((s) => idSet.has(s.id));
    } else if (unexpiredOnly) {
      affectedSubscribers = candidateSubscribers.filter((s) => {
        const duration = durationMap.get(s.subscriptionType) || 30;
        let curExpiry: Date | null = null;
        if (s.renewals && s.renewals.length > 0 && s.renewals[0].expiryDate) {
          curExpiry = new Date(s.renewals[0].expiryDate);
        } else if (s.lastPaymentDate) {
          curExpiry = new Date(s.lastPaymentDate);
          curExpiry.setDate(curExpiry.getDate() + duration);
        } else if (s.createdAt) {
          curExpiry = new Date(s.createdAt);
          curExpiry.setDate(curExpiry.getDate() + duration);
        }
        return curExpiry ? curExpiry >= closureStart : false;
      });
    }

    // 3) ★ ميزة استئناف أيام بعد الفتح (تمديد تاريخ انتهاء الاشتراك بعدد أيام الإغلاق)
    let extendedSubscribersCount = 0;
    if (extendSubscriptionDays && affectedSubscribers.length > 0) {
      for (const s of affectedSubscribers) {
        if (s.lastPaymentDate) {
          const updatedLastPayment = new Date(new Date(s.lastPaymentDate).getTime() + closureDaysMs);
          await db.subscriber.update({
            where: { id: s.id },
            data: { lastPaymentDate: updatedLastPayment },
          });
        }

        if (s.renewals && s.renewals.length > 0) {
          const latest = s.renewals[0];
          if (latest.expiryDate) {
            const updatedExpiry = new Date(new Date(latest.expiryDate).getTime() + closureDaysMs);
            await db.renewal.update({
              where: { id: latest.id },
              data: { expiryDate: updatedExpiry },
            });
          }
        }
        extendedSubscribersCount++;
      }
    }

    // 4) ★ أنشئ سجل تعويض pending لكل منخرط متأثر (إذا كان createCompensations مفعلاً)
    let totalCancelledSessions = 0;
    if (createCompensations && affectedSubscribers.length > 0) {
      const compensationData = affectedSubscribers.map((s) => {
        const cancelledCount = countCancelledSessionsInRange(
          closureStart,
          closureEnd,
          s.swimmingDays
        );
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
      totalCancelledSessions = compensationData.reduce((s, c) => s + c.cancelledSessionsCount, 0);

      // سجل تدقيق التعويضات
      await db.compensationHistory.create({
        data: {
          clubId,
          closureId: closure.id,
          action: "created",
          description: `تسجيل إغلاق: ${affectedSubscribers.length} منخرط (${closureDays} يوم إغلاق) — ${extendSubscriptionDays ? `تم تمديد الاشتراكات +${closureDays} يوم` : "بدون تمديد"} — ${reason}`,
          newValue: JSON.stringify({
            count: compensationData.length,
            totalCancelledSessions,
            validityDays: validity,
            extendedSubscribersCount,
            closureDays,
            reopenDate,
          }),
          userId: currentUser.id,
        },
      });
    }

    // 5) إشعارات وسجل النشاط
    if (affectedSubscribers.length > 0) {
      const isMultiDay = closureDays > 1;
      await db.notification.createMany({
        data: affectedSubscribers.map((s) => ({
          clubId,
          type: "pool_closure",
          title: "إغلاق المسبح للصيانة وتعديل الاشتراكات",
          message: isMultiDay
            ? `إغلاق المسبح من ${formatDate(closureStart)} إلى ${formatDate(closureEnd)} (${closureDays} أيام) بسبب: ${reason}.${extendSubscriptionDays ? ` تم استئناف وتمديد اشتراكك تلقائياً بـ ${closureDays} أيام إضافية.` : ""}`
            : `إغلاق المسبح بتاريخ ${formatDate(closureDate)} بسبب: ${reason}.${extendSubscriptionDays ? ` تم استئناف وتمديد اشتراكك بـ ${closureDays} يوم.` : ""}`,
          link: `/dashboard/compensations?subscriberId=${s.id}`,
        })),
      });

      await db.activity.create({
        data: {
          clubId,
          type: "pool_closure",
          description: `تسجيل إغلاق مسبح للصيانة (${closureDays} أيام) — ${affectedSubscribers.length} منخرط متأثر${extendSubscriptionDays ? ` (تم تمديد صلاحية ${extendedSubscribersCount} اشتراك بـ ${closureDays} يوم)` : ""}`,
          userId: currentUser.id,
          metadata: JSON.stringify({
            closureId: closure.id,
            reason,
            affectedCount: affectedSubscribers.length,
            extendedSubscribersCount,
            closureDays,
            reopenDate,
            totalCancelledSessions,
          }),
        },
      });
    }

    return NextResponse.json({
      closure,
      closureDays,
      reopenDate,
      affectedCount: affectedSubscribers.length,
      extendedSubscribersCount,
      totalCancelledSessions,
    });
  } catch (e) {
    console.error("POST pool-closures:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

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
      date, swimmingDays, timeSlot, reason, note,
      registeredOnOrBefore, registeredOnOrAfter,
      subscriptionTypes, paymentStatuses,
    } = body;

    if (!date || !reason) {
      return NextResponse.json({ error: "التاريخ وسبب الإغلاق مطلوبان" }, { status: 400 });
    }

    const clubId = currentUser.role === "superadmin" ? body.clubId : currentUser.clubId!;
    if (!clubId) {
      return NextResponse.json({ error: "النادي غير محدد" }, { status: 400 });
    }

    const closureDate = new Date(date);

    // 1) أنشئ سجل الإغلاق
    const closure = await db.poolClosure.create({
      data: {
        clubId,
        date: closureDate,
        swimmingDays: swimmingDays || null,
        timeSlot: timeSlot || null,
        reason,
        note: note || null,
        createdById: currentUser.id,
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
        // نهاية اليوم المحدَّد، عشان "في أو قبل" يشمل نفس اليوم كامل
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

    // 3) أنشئ سجل تعويض pending لكل منخرط متأثر
    if (affectedSubscribers.length > 0) {
      await db.compensation.createMany({
        data: affectedSubscribers.map((s) => ({
          clubId,
          closureId: closure.id,
          subscriberId: s.id,
          originalDate: closureDate,
          originalSwimmingDays: s.swimmingDays,
          originalTimeSlot: s.timeSlot,
          status: "pending",
        })),
      });

      // 4) إشعار لكل منخرط متأثر (يظهر في جرس الإشعارات + يمكن ربطه لاحقاً بواتساب)
      await db.notification.createMany({
        data: affectedSubscribers.map((s) => ({
          clubId,
          type: "pool_closure",
          title: "إغلاق المسبح للصيانة",
          message: `تم إغلاق حصة "${s.swimmingDays ?? ""} — ${s.timeSlot ?? ""}" بتاريخ ${closureDate.toLocaleDateString("ar")} بسبب: ${reason}. سيتم تعويض المنخرط ${s.firstName} ${s.lastName} بحصة بديلة.`,
          link: `/dashboard/compensations?subscriberId=${s.id}`,
        })),
      });

      await db.activity.create({
        data: {
          clubId,
          type: "pool_closure",
          description: `إغلاق مسبح للصيانة بتاريخ ${closureDate.toLocaleDateString("ar")} — تأثر ${affectedSubscribers.length} منخرط(ة)`,
          userId: currentUser.id,
          metadata: JSON.stringify({
            closureId: closure.id, reason, count: affectedSubscribers.length,
            registeredOnOrBefore: registeredOnOrBefore || null,
            registeredOnOrAfter: registeredOnOrAfter || null,
          }),
        },
      });
    }

    return NextResponse.json({
      closure,
      affectedCount: affectedSubscribers.length,
    });
  } catch (e) {
    console.error("POST pool-closures:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

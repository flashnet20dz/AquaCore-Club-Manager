import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { countCancelledSessionsInRange } from "@/lib/rcs";

/**
 * GET /api/pool-closures/preview?swimmingDays=&timeSlot=&registeredOnOrBefore=&registeredOnOrAfter=&subscriptionTypes=&paymentStatuses=
 * يرجع عدد وقائمة المنخرطين اللي راح يتأثروا بنفس معايير التصفية المستخدمة
 * في POST /api/pool-closures — بدون إنشاء أي شيء فعلياً. يُستخدم للمعاينة
 * قبل تأكيد عملية تعويض جماعي (bulk).
 *
 * ★ subscriptionTypes و paymentStatuses: comma-separated lists, e.g.
 *   subscriptionTypes=/,OPOW,DJS
 *   paymentStatuses=مدفوع,تأمين فقط
 */
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const url = req.nextUrl;
    const swimmingDays = url.searchParams.get("swimmingDays");
    const timeSlot = url.searchParams.get("timeSlot");
    const registeredOnOrBefore = url.searchParams.get("registeredOnOrBefore");
    const registeredOnOrAfter = url.searchParams.get("registeredOnOrAfter");
    // ★ comma-separated multi-filters
    const subscriptionTypesParam = url.searchParams.get("subscriptionTypes");
    const paymentStatusesParam = url.searchParams.get("paymentStatuses");

    const clubId = currentUser.role === "superadmin"
      ? url.searchParams.get("clubId") || currentUser.clubId
      : currentUser.clubId;

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

    // ★ تصفية حسب نوع الاشتراك (متعدد — comma-separated)
    if (subscriptionTypesParam) {
      const types = subscriptionTypesParam.split(",").map((s) => s.trim()).filter(Boolean);
      if (types.length > 0) {
        where.subscriptionType = { in: types };
      }
    }

    // ★ تصفية حسب حالة الدفع (متعدد — comma-separated)
    if (paymentStatusesParam) {
      const statuses = paymentStatusesParam.split(",").map((s) => s.trim()).filter(Boolean);
      if (statuses.length > 0) {
        where.paymentStatus = { in: statuses };
      }
    }

    const subscribers = await db.subscriber.findMany({
      where,
      select: {
        id: true, fileNumber: true, firstName: true, lastName: true,
        swimmingDays: true, timeSlot: true, createdAt: true,
        subscriptionType: true, paymentStatus: true,
      },
      orderBy: { createdAt: "asc" },
      take: 500, // سقف عرض معقول، العدد الكلي منفصل بالأسفل
    });

    const total = await db.subscriber.count({ where });

    // ★ لو وُجدت فترة إغلاق (startDate + endDate)، احسب عدد الحصص الملغاة لكل منخرط
    const startDateParam = url.searchParams.get("startDate") || url.searchParams.get("date");
    const endDateParam = url.searchParams.get("endDate") || url.searchParams.get("date");
    let totalCancelledSessions = 0;
    let subscribersWithCounts: typeof subscribers | unknown[] = subscribers;
    if (startDateParam && endDateParam) {
      const start = new Date(startDateParam);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDateParam);
      end.setHours(23, 59, 59, 999);
      subscribersWithCounts = subscribers.map((s) => {
        const count = countCancelledSessionsInRange(start, end, s.swimmingDays);
        totalCancelledSessions += Math.max(1, count);
        return { ...s, cancelledSessionsCount: Math.max(1, count) };
      });
    }

    return NextResponse.json({
      total,
      subscribers: subscribersWithCounts,
      // ★ إجمالي الحصص الملغاة المتوقعة (لو وُجدت فترة)
      totalCancelledSessions: totalCancelledSessions > 0 ? totalCancelledSessions : undefined,
    });
  } catch (e) {
    console.error("GET /api/pool-closures/preview:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

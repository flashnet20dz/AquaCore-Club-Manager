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

    const onlyUnexpired = url.searchParams.get("unexpiredOnly") !== "false"; // Default true

    // Fetch subscription types for accurate durationDays
    const dbTypes = await db.subscriptionType.findMany({
      where: clubId ? { clubId } : {},
      select: { code: true, durationDays: true },
    });
    const durationMap = new Map(dbTypes.map((t) => [t.code, t.durationDays || 30]));

    const subscribers = await db.subscriber.findMany({
      where: {
        ...where,
        deletedAt: null,
      },
      select: {
        id: true,
        fileNumber: true,
        firstName: true,
        lastName: true,
        phone: true,
        swimmingDays: true,
        timeSlot: true,
        createdAt: true,
        lastPaymentDate: true,
        subscriptionType: true,
        paymentStatus: true,
        renewals: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { expiryDate: true },
        },
      },
      orderBy: { fileNumber: "asc" },
      take: 1000,
    });

    const startDateParam = url.searchParams.get("startDate") || url.searchParams.get("date");
    const endDateParam = url.searchParams.get("endDate") || url.searchParams.get("date");

    let closureStart = new Date();
    closureStart.setHours(0, 0, 0, 0);
    let closureEnd = new Date();
    closureEnd.setHours(23, 59, 59, 999);

    if (startDateParam) {
      closureStart = new Date(startDateParam);
      closureStart.setHours(0, 0, 0, 0);
    }
    if (endDateParam) {
      closureEnd = new Date(endDateParam);
      closureEnd.setHours(23, 59, 59, 999);
    } else if (startDateParam) {
      closureEnd = new Date(startDateParam);
      closureEnd.setHours(23, 59, 59, 999);
    }

    const closureDays = Math.max(1, Math.round((closureEnd.getTime() - closureStart.getTime()) / 86400000) + 1);
    const reopenDate = new Date(closureEnd.getTime() + 86400000);

    let totalCancelledSessions = 0;
    let unexpiredCount = 0;

    const mappedSubscribers = subscribers.map((s) => {
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

      // Check if subscription has not expired before closure start
      const isUnexpired = curExpiry ? curExpiry >= closureStart : false;
      if (isUnexpired) unexpiredCount++;

      // New proposed expiry date after reopening (+closureDays)
      let newExpiry: Date | null = null;
      if (curExpiry) {
        newExpiry = new Date(curExpiry.getTime() + closureDays * 86400000);
      }

      const cancelledCount = countCancelledSessionsInRange(closureStart, closureEnd, s.swimmingDays);
      totalCancelledSessions += Math.max(0, cancelledCount);

      return {
        id: s.id,
        fileNumber: s.fileNumber,
        firstName: s.firstName,
        lastName: s.lastName,
        fullName: `${s.lastName} ${s.firstName}`.trim(),
        phone: s.phone,
        swimmingDays: s.swimmingDays,
        timeSlot: s.timeSlot,
        subscriptionType: s.subscriptionType,
        paymentStatus: s.paymentStatus,
        currentExpiryDate: curExpiry ? curExpiry.toISOString() : null,
        newExpiryDate: newExpiry ? newExpiry.toISOString() : null,
        isUnexpired,
        cancelledSessionsCount: Math.max(1, cancelledCount),
      };
    });

    const finalSubscribers = onlyUnexpired
      ? mappedSubscribers.filter((s) => s.isUnexpired)
      : mappedSubscribers;

    return NextResponse.json({
      total: subscribers.length,
      unexpiredCount,
      displayedCount: finalSubscribers.length,
      closureDays,
      reopenDate: reopenDate.toISOString(),
      totalCancelledSessions,
      subscribers: finalSubscribers,
    });
  } catch (e) {
    console.error("GET /api/pool-closures/preview:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

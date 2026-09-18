import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { calculateExpiryDate, calculateRenewalStatus } from "@/lib/rcs";

/**
 * POST /api/attendance/bulk
 * تسجيل حضور جماعي لكل منخرطي فوج (time slot) معين في يوم محدد.
 *
 * Body:
 *   { timeSlot?: string,       // فلترة حسب فوج محدد
 *     subscriberIds?: string[],// أو قائمة محددة من المنخرطين
 *     date?: string,           // تاريخ محدد (افتراضياً اليوم)
 *     method?: "manual" | "bulk" }
 *
 * Returns:
 *   { checkedIn: number, alreadyPresent: number, skipped: number, errors: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await req.json();
    const { timeSlot, subscriberIds, date, method, checkInTime } = body;

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const clubId = currentUser.clubId || (currentUser.role === "superadmin" ? null : null);

    // تحديد التاريخ (اليوم افتراضياً)
    const today = date ? new Date(date) : new Date();
    today.setHours(0, 0, 0, 0);

    // تحديد قائمة المنخرطين المراد تسجيلهم
    let targetSubs;
    if (subscriberIds && Array.isArray(subscriberIds) && subscriberIds.length > 0) {
      // قائمة محددة من IDs
      targetSubs = await db.subscriber.findMany({
        where: { id: { in: subscriberIds }, ...clubFilter },
        select: { id: true, clubId: true, lastName: true, firstName: true, paymentStatus: true, lastPaymentDate: true },
      });
    } else if (timeSlot) {
      // كل منخرطي فوج محدد
      targetSubs = await db.subscriber.findMany({
        where: { timeSlot: timeSlot, ...clubFilter },
        select: { id: true, clubId: true, lastName: true, firstName: true, paymentStatus: true, lastPaymentDate: true },
      });
    } else {
      return NextResponse.json({
        error: "timeSlot أو subscriberIds مطلوب",
      }, { status: 400 });
    }

    if (targetSubs.length === 0) {
      return NextResponse.json({
        checkedIn: 0,
        alreadyPresent: 0,
        skipped: 0,
        message: "لا يوجد منخروطون في هذا الفوج",
      });
    }

    // جلب IDs الحاضرين بالفعل اليوم لتخطّيهم
    const alreadyPresent = await db.attendance.findMany({
      where: {
        date: today,
        subscriberId: { in: targetSubs.map((s) => s.id) },
        ...clubFilter,
      },
      select: { subscriberId: true },
    });
    const presentIds = new Set(alreadyPresent.map((a) => a.subscriberId));

    // فلترة فقط من لم يُسجّل بعد
    const toCheckIn = targetSubs.filter((s) => !presentIds.has(s.id));

    let checkedIn = 0;
    let skipped = 0;
    const errors: string[] = [];
    // ★ وقت تسجيل الحضور: استخدم checkInTime المخصص إن قُدم، وإلا الآن
    const now = checkInTime ? new Date(checkInTime) : new Date();

    // تسجيل جماعي — نستخدم createMany للأداء العالي
    const records = toCheckIn.map((s) => {
      const expiry = calculateExpiryDate(s.lastPaymentDate);
      const renewalStatus = calculateRenewalStatus(s.paymentStatus as never, expiry);
      const isExpired = renewalStatus.includes("منتهي");
      const isFrozen = renewalStatus.includes("مجمدة");
      return {
        clubId: s.clubId,
        subscriberId: s.id,
        date: today,
        checkInTime: now,
        method: method || "bulk",
        note: isExpired ? "منتهي — يحتاج تجديد" : isFrozen ? "مجمد — لم يدفع" : null,
      };
    });

    if (records.length > 0) {
      try {
        // إنشاء سجلات الحضور دفعة واحدة
        const result = await db.attendance.createMany({
          data: records,
          // SQLite-generated client omits skipDuplicates from its types (and rejects it at runtime);
          // production PostgreSQL client supports it — `as never` keeps runtime unchanged.
          skipDuplicates: true as never,
        });
        checkedIn = result.count;

        // سجل نشاط واحد للتسجيل الجماعي (بدلاً من نشاط لكل منخرط)
        if (clubId && checkedIn > 0) {
          await db.activity.create({
            data: {
              clubId,
              type: "attendance",
              description: `تسجيل جماعي لـ ${checkedIn} منخرط ${timeSlot ? `فوج ${timeSlot}` : ""} بتاريخ ${today.toLocaleDateString("ar-DZ")}`,
            },
          });
        }
      } catch (e) {
        // إذا فشل createMany (مثلاً قيد فريد)، جرّب فردياً
        for (const r of records) {
          try {
            await db.attendance.create({ data: r });
            checkedIn++;
          } catch {
            skipped++;
          }
        }
      }
    }

    return NextResponse.json({
      checkedIn,
      alreadyPresent: presentIds.size,
      skipped,
      errors,
      total: targetSubs.length,
      message: `تم تسجيل ${checkedIn} منخرط جديد${presentIds.size > 0 ? ` (${presentIds.size} كانوا مسجّلين مسبقاً)` : ""}`,
    }, { status: 201 });
  } catch (e) {
    console.error("POST attendance/bulk error:", e);
    return NextResponse.json({
      error: "فشل التسجيل الجماعي: " + (e instanceof Error ? e.message : "خطأ غير متوقع"),
    }, { status: 500 });
  }
}

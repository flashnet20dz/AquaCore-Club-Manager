import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * PATCH /api/compensations/[id]
 *
 * ثلاثة استخدامات حسب body.action:
 *
 * 1) action = "schedule"  — تحديد حصة تعويضية بديلة للمنخرط
 *    body: { action: "schedule", compensationDate, compensationSwimmingDays, compensationTimeSlot }
 *    يتحقق من سعة الحصة الجديدة قبل التأكيد.
 *
 * 2) action = "use"       — تسجيل حضور المنخرط فعلياً للحصة التعويضية
 *    body: { action: "use" }
 *    ينشئ سجل Attendance (isCompensation=true) ويربطه بالتعويض، status="used".
 *
 * 3) action = "cancel"    — إلغاء التعويض (مثلاً المنخرط لم يعد بحاجة له)
 *    body: { action: "cancel", note? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;
    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };

    const compensation = await db.compensation.findFirst({
      where: { id, ...clubFilter },
      include: { subscriber: true },
    });
    if (!compensation) {
      return NextResponse.json({ error: "التعويض غير موجود" }, { status: 404 });
    }

    const body = await req.json();
    const clubId = compensation.clubId;

    // ═══════════════ 1) تحديد حصة تعويضية ═══════════════
    if (body.action === "schedule") {
      const { compensationDate, compensationSwimmingDays, compensationTimeSlot } = body;
      if (!compensationDate || !compensationTimeSlot) {
        return NextResponse.json({ error: "التاريخ والتوقيت مطلوبان" }, { status: 400 });
      }

      const newDate = new Date(compensationDate);

      // فحص السعة: كم منخرط أصلاً مسجَّل + كم تعويض آخر مُحدَّد لنفس المجموعة/التوقيت في نفس اليوم؟
      const slot = await db.swimmingTimeSlot.findFirst({
        where: { clubId, name: compensationTimeSlot },
      });
      const maxCapacity = slot?.maxCapacity ?? 30;

      const regularCount = await db.subscriber.count({
        where: {
          clubId,
          swimmingDays: compensationSwimmingDays || undefined,
          timeSlot: compensationTimeSlot,
        },
      });

      const otherCompensationsCount = await db.compensation.count({
        where: {
          clubId,
          id: { not: id },
          status: "scheduled",
          compensationDate: newDate,
          compensationTimeSlot,
        },
      });

      const currentOccupancy = regularCount + otherCompensationsCount;
      if (currentOccupancy >= maxCapacity) {
        return NextResponse.json(
          {
            error: `الحصة ممتلئة (${currentOccupancy}/${maxCapacity}). اختر توقيتاً أو يوماً آخر.`,
            full: true,
            currentOccupancy,
            maxCapacity,
          },
          { status: 409 }
        );
      }

      const updated = await db.compensation.update({
        where: { id },
        data: {
          status: "scheduled",
          compensationDate: newDate,
          compensationSwimmingDays: compensationSwimmingDays || null,
          compensationTimeSlot,
          notifiedAt: new Date(),
        },
      });

      // ★ سجل تدقيق: تحديد موعد تعويضي
      await db.compensationHistory.create({
        data: {
          clubId,
          compensationId: id,
          action: "scheduled",
          description: `تحديد حصة تعويضية بتاريخ ${newDate.toLocaleDateString("ar")} — ${compensationTimeSlot}`,
          oldValue: JSON.stringify({ status: compensation.status, compensationDate: compensation.compensationDate }),
          newValue: JSON.stringify({ status: "scheduled", compensationDate: newDate.toISOString(), compensationTimeSlot }),
          userId: currentUser.id,
        },
      });

      await db.notification.create({
        data: {
          clubId,
          type: "compensation_scheduled",
          title: "تم تحديد حصة تعويضية",
          message: `تم تحديد حصة تعويضية للمنخرط ${compensation.subscriber.firstName} ${compensation.subscriber.lastName} بتاريخ ${newDate.toLocaleDateString("ar")} — ${compensationTimeSlot}.`,
          link: `/dashboard/compensations`,
        },
      });

      return NextResponse.json({ compensation: updated });
    }

    // ═══════════════ 2) تسجيل الاستخدام الفعلي (الحضور) ═══════════════
    if (body.action === "use") {
      if (compensation.status !== "scheduled") {
        return NextResponse.json(
          { error: "يجب تحديد موعد الحصة التعويضية أولاً قبل تسجيل الحضور" },
          { status: 400 }
        );
      }
      if (!compensation.compensationDate) {
        return NextResponse.json({ error: "لا يوجد تاريخ محدد للتعويض" }, { status: 400 });
      }

      const attendance = await db.attendance.create({
        data: {
          clubId,
          subscriberId: compensation.subscriberId,
          date: compensation.compensationDate,
          checkInTime: new Date(),
          method: "compensation",
          isCompensation: true,
          note: `حصة تعويضية عن إغلاق بتاريخ ${compensation.originalDate.toLocaleDateString("ar")}`,
        },
      });

      // ★ زيادة compensatedCount وتحديث الحالة المشتقة
      const newCompensatedCount = (compensation.compensatedCount || 0) + 1;
      // لو وصل للعدد الكامل → used، وإلا → partial
      const newStatus = newCompensatedCount >= compensation.cancelledSessionsCount ? "used" : "partial";

      const updated = await db.compensation.update({
        where: { id },
        data: {
          status: newStatus,
          usedAt: new Date(),
          attendanceId: attendance.id,
          compensatedCount: newCompensatedCount,
        },
      });

      // ★ سجل تدقيق: استخدام الحصة التعويضية
      await db.compensationHistory.create({
        data: {
          clubId,
          compensationId: id,
          action: "used",
          description: `حضور الحصة التعويضية (${newCompensatedCount}/${compensation.cancelledSessionsCount}) — ${compensation.compensationDate?.toLocaleDateString("ar")}`,
          oldValue: JSON.stringify({ status: compensation.status, compensatedCount: compensation.compensatedCount }),
          newValue: JSON.stringify({ status: newStatus, compensatedCount: newCompensatedCount, attendanceId: attendance.id }),
          userId: currentUser.id,
        },
      });

      await db.activity.create({
        data: {
          clubId,
          subscriberId: compensation.subscriberId,
          type: "compensation_used",
          description: `استُخدمت الحصة التعويضية من طرف ${compensation.subscriber.firstName} ${compensation.subscriber.lastName}`,
          userId: currentUser.id,
        },
      });

      return NextResponse.json({ compensation: updated });
    }

    // ═══════════════ 3) إلغاء التعويض ═══════════════
    if (body.action === "cancel") {
      const updated = await db.compensation.update({
        where: { id },
        data: { status: "cancelled", note: body.note || compensation.note },
      });

      // ★ سجل تدقيق: إلغاء التعويض
      await db.compensationHistory.create({
        data: {
          clubId,
          compensationId: id,
          action: "cancelled",
          description: body.note ? `إلغاء التعويض: ${body.note}` : "إلغاء التعويض",
          oldValue: JSON.stringify({ status: compensation.status }),
          newValue: JSON.stringify({ status: "cancelled", note: body.note || null }),
          userId: currentUser.id,
        },
      });

      return NextResponse.json({ compensation: updated });
    }

    return NextResponse.json({ error: "action غير معروف" }, { status: 400 });
  } catch (e) {
    console.error("PATCH compensations/[id]:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

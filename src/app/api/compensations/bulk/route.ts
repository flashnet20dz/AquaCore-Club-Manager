import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * PATCH /api/compensations/bulk
 *
 * body: { ids: string[], action: "schedule" | "cancel", note?,
 *         compensationDate?, compensationSwimmingDays?, compensationTimeSlot? }
 *
 * - action = "cancel"   → يلغي كل التعويضات المحدَّدة (pending/scheduled فقط، يتجاهل الباقي بهدوء).
 * - action = "schedule" → يحدّد نفس الحصة التعويضية (تاريخ/أيام/توقيت) لكل التعويضات
 *   المحدَّدة دفعة واحدة، مع التحقق من السعة الكلية (منتظمين + مُجدوَلين سابقاً + هذا الدُفعة)
 *   قبل ما يأكد أي شيء — إذا السعة ما تكفي كل المحدَّدين، يرفض العملية كاملة (كل شيء أو لا شيء)
 *   حتى ما يصير تعويض جزئي مربك.
 */
export async function PATCH(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await req.json();
    const { ids, action } = body as { ids: string[]; action: "schedule" | "cancel" };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "لم تحدد أي تعويض" }, { status: 400 });
    }

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };

    const compensations = await db.compensation.findMany({
      where: { id: { in: ids }, ...clubFilter },
      include: { subscriber: true },
    });

    if (compensations.length === 0) {
      return NextResponse.json({ error: "لم يُعثر على أي تعويض مطابق" }, { status: 404 });
    }

    const clubId = compensations[0].clubId;

    // ═══════════════ إلغاء جماعي ═══════════════
    if (action === "cancel") {
      const cancellable = compensations.filter((c) => c.status === "pending" || c.status === "scheduled");
      if (cancellable.length === 0) {
        return NextResponse.json({ error: "لا يوجد تعويض قابل للإلغاء ضمن المحدَّد" }, { status: 400 });
      }
      await db.compensation.updateMany({
        where: { id: { in: cancellable.map((c) => c.id) } },
        data: { status: "cancelled", note: body.note || undefined },
      });
      return NextResponse.json({ cancelled: cancellable.length, skipped: compensations.length - cancellable.length });
    }

    // ═══════════════ تعويض جماعي (تحديد نفس الحصة للجميع) ═══════════════
    if (action === "schedule") {
      const { compensationDate, compensationSwimmingDays, compensationTimeSlot } = body;
      if (!compensationDate || !compensationTimeSlot) {
        return NextResponse.json({ error: "التاريخ والتوقيت مطلوبان" }, { status: 400 });
      }

      const schedulable = compensations.filter((c) => c.status === "pending" || c.status === "scheduled");
      if (schedulable.length === 0) {
        return NextResponse.json({ error: "لا يوجد تعويض قابل للتحديد ضمن المحدَّد" }, { status: 400 });
      }

      const newDate = new Date(compensationDate);

      // فحص السعة الكلية: منتظمون + مُجدوَلون سابقاً بنفس الحصة (باستثناء المحدَّدين حالياً) + كل من سيُضاف الآن
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

      const otherScheduledCount = await db.compensation.count({
        where: {
          clubId,
          id: { notIn: schedulable.map((c) => c.id) },
          status: "scheduled",
          compensationDate: newDate,
          compensationTimeSlot,
        },
      });

      const projectedOccupancy = regularCount + otherScheduledCount + schedulable.length;
      if (projectedOccupancy > maxCapacity) {
        return NextResponse.json(
          {
            error: `السعة لا تكفي لكل المحدَّدين (${schedulable.length} شخص). المتاح حالياً: ${Math.max(0, maxCapacity - regularCount - otherScheduledCount)} مكان فقط من أصل ${maxCapacity}.`,
            full: true,
            available: Math.max(0, maxCapacity - regularCount - otherScheduledCount),
            requested: schedulable.length,
          },
          { status: 409 }
        );
      }

      await db.compensation.updateMany({
        where: { id: { in: schedulable.map((c) => c.id) } },
        data: {
          status: "scheduled",
          compensationDate: newDate,
          compensationSwimmingDays: compensationSwimmingDays || null,
          compensationTimeSlot,
          notifiedAt: new Date(),
        },
      });

      await db.notification.createMany({
        data: schedulable.map((c) => ({
          clubId,
          type: "compensation_scheduled",
          title: "تم تحديد حصة تعويضية",
          message: `تم تحديد حصة تعويضية للمنخرط ${c.subscriber.firstName} ${c.subscriber.lastName} بتاريخ ${newDate.toLocaleDateString("ar")} — ${compensationTimeSlot}.`,
          link: `/dashboard/compensations`,
        })),
      });

      return NextResponse.json({ scheduled: schedulable.length, skipped: compensations.length - schedulable.length });
    }

    return NextResponse.json({ error: "action غير معروف" }, { status: 400 });
  } catch (e) {
    console.error("PATCH /api/compensations/bulk:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

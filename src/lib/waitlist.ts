import { db } from "@/lib/db";

/**
 * يُستدعى بعد أي حدث يُحرِّر مكاناً بحصة معيّنة (حذف منخرط، أو تغيير حصته
 * لغير هذي المجموعة/التوقيت). يبحث عن أقدم طلب "waiting" بنفس الحصة،
 * ولو لقى، يحوّله لـ "notified" وينشئ إشعاراً للموظفين بوجود مكان شاغر.
 * لا يحوّل تلقائياً لمشترك فعلي — ده قرار بشري (زر "تحويل لمشترك" بالواجهة).
 */
export async function checkWaitlistPromotion(
  clubId: string,
  swimmingDays: string | null | undefined,
  timeSlot: string | null | undefined
) {
  if (!swimmingDays || !timeSlot) return;

  try {
    const next = await db.waitlist.findFirst({
      where: { clubId, desiredSwimmingDays: swimmingDays, desiredTimeSlot: timeSlot, status: "waiting" },
      orderBy: { createdAt: "asc" },
    });
    if (!next) return;

    await db.waitlist.update({
      where: { id: next.id },
      data: { status: "notified", notifiedAt: new Date() },
    });

    await db.notification.create({
      data: {
        clubId,
        type: "waitlist_opening",
        title: "مكان شاغر بقائمة الانتظار",
        message: `تحرَّر مكان بحصة "${swimmingDays} — ${timeSlot}". ${next.firstName} ${next.lastName} هو التالي بقائمة الانتظار — تواصل معه لتأكيد الانضمام.`,
        link: `/dashboard/waitlist`,
      },
    });
  } catch (e) {
    console.warn("[waitlist] promotion check failed:", e);
  }
}

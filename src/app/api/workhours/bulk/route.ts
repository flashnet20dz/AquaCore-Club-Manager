import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/session";
import { parseWallDateTime } from "@/lib/wall-clock";
import { dayKeyFromDate, slotDurationHours, type PoolSlot } from "@/lib/pool-schedule";

/**
 * POST /api/workhours/bulk — تسجيل عدة حصص دفعة واحدة (المرحلة 4 — §11)
 * ═══════════════════════════════════════════════════════════════════════
 * Body: { userId, date: "YYYY-MM-DD", slotIds: string[], note?, breakMinutes? }
 *
 * - الحصص تُقرأ من إعدادات المسبح (SwimmingTimeSlot) — المصدر الموحّد.
 *   لا يُقبل slotId لا ينتمي للنادي أو معطّل.
 * - لكل حصة يُنشأ سجل WorkHours مستقل بأوقاتها الحرفية (wall-clock UTC)
 *   مع لقطة {slotId, name, startTime, endTime} في note JSON (§27 تاريخية).
 * - الحصص المكررة (نفس العامل+اليوم+نفس وقت البداية) تُتخطى ولا تفشل العملية (§13).
 * - المسبح المغلق في ذلك اليوم يرفض الطلب كله (نفس قاعدة /api/workhours).
 * - كل شيء داخل معاملة واحدة: إما كل الحصص غير المكررة تُسجَّل أو لا شيء.
 *
 * Response: { created, skipped, totalHours, records: [...] }
 */

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasPermission(currentUser.role, "workHours")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const clubId = currentUser.clubId!;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }

    const userId: string =
      typeof body.userId === "string" && body.userId
        ? body.userId
        : typeof body.targetUserId === "string" && body.targetUserId
          ? body.targetUserId
          : currentUser.id;
    const date: string = typeof body.date === "string" ? body.date : "";
    const rawSlotIds: unknown = body.slotIds ?? body.slotId;
    const slotIds: string[] = Array.isArray(rawSlotIds)
      ? rawSlotIds.filter((x): x is string => typeof x === "string" && Boolean(x))
      : typeof rawSlotIds === "string" && rawSlotIds
        ? [rawSlotIds]
        : [];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "التاريخ مطلوب بصيغة YYYY-MM-DD" }, { status: 400 });
    }
    if (slotIds.length === 0) {
      return NextResponse.json({ error: "اختر حصة واحدة على الأقل" }, { status: 400 });
    }
    if (slotIds.length > 30) {
      return NextResponse.json({ error: "عدد الحصص كبير جداً (الحد 30)" }, { status: 400 });
    }

    const breakMinutes = Number.isFinite(+body.breakMinutes) ? Math.max(0, Math.floor(+body.breakMinutes)) : 0;
    const textNote = typeof body.note === "string" ? body.note.trim() : "";

    // العامل داخل النادي
    const worker = await db.user.findFirst({
      where: { id: userId, clubId },
      select: { id: true, name: true },
    });
    if (!worker) return NextResponse.json({ error: "العامل غير موجود" }, { status: 404 });

    // ★ حارس يوم الاستغلال (نفس منطق /api/workhours POST)
    const recordDayKey = dayKeyFromDate(date);
    const opDaysRaw = await db.setting.findFirst({ where: { clubId, key: "poolOperatingDays" } });
    if (opDaysRaw?.value && recordDayKey) {
      try {
        const opDays: unknown = JSON.parse(opDaysRaw.value);
        if (Array.isArray(opDays) && opDays.length > 0 && !opDays.includes(recordDayKey)) {
          return NextResponse.json(
            { error: "المسبح مغلق في هذا اليوم حسب إعدادات أيام الاستغلال" },
            { status: 400 }
          );
        }
      } catch { /* إعداد تالف → نتجاهل */ }
    }

    // الحصص المطلوبة — من الإعدادات فقط، نشطة، ولهذا اليوم أو عامة
    const slots = await db.swimmingTimeSlot.findMany({
      where: { clubId, id: { in: slotIds }, active: true },
    });
    const slotMap = new Map<string, PoolSlot>(slots.map((s) => [s.id, s as unknown as PoolSlot]));
    for (const id of slotIds) {
      const s = slotMap.get(id);
      if (!s) {
        return NextResponse.json({ error: "إحدى الحصص غير موجودة أو معطّلة في إعدادات المسبح" }, { status: 404 });
      }
      if (s.dayOfWeek && recordDayKey && s.dayOfWeek !== recordDayKey) {
        return NextResponse.json(
          { error: `الحصة ${s.name} لا تنتمي إلى يوم هذا التاريخ` },
          { status: 400 }
        );
      }
    }

    // حصص العامل المسجّلة مسبقاً في نفس اليوم (منع التكرار على وقت البداية)
    const dayStart = parseWallDateTime(date, "00:00");
    const existing = await db.workHours.findMany({
      where: {
        clubId,
        userId,
        date: dayStart,
        status: { not: "rejected" },
      },
      select: { startTime: true },
    });
    const takenStarts = new Set(existing.map((e) => new Date(e.startTime).getTime()));

    // بناء الصفوف: غير المكررة فقط
    const toCreate: Array<{
      clubId: string; userId: string; date: Date; startTime: Date; endTime: Date;
      note: string; status: string; approvedById: string | null; approvedAt: Date | null;
    }> = [];
    const skipped: Array<{ slotId: string; name: string; reason: "duplicate" }> = [];
    let totalHours = 0;

    const sortedSlots = slotIds
      .map((id) => slotMap.get(id)!)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    for (const s of sortedSlots) {
      const startDt = parseWallDateTime(date, s.startTime);
      if (takenStarts.has(startDt.getTime())) {
        skipped.push({ slotId: s.id, name: s.name, reason: "duplicate" });
        continue;
      }
      takenStarts.add(startDt.getTime());
      let endDt = parseWallDateTime(date, s.endTime);
      if (endDt <= startDt) endDt = new Date(endDt.getTime() + 86_400_000);

      const dur = Math.max(0, slotDurationHours(s.startTime, s.endTime) - breakMinutes / 60);
      totalHours += dur;

      const meta = {
        breakMinutes,
        workStatus: "present",
        absenceReason: null,
        textNote: textNote,
        session: { slotId: s.id, name: s.name, startTime: s.startTime, endTime: s.endTime },
      };

      const isAdmin = currentUser.role === "admin" || currentUser.role === "superadmin";
      toCreate.push({
        clubId,
        userId,
        date: dayStart,
        startTime: startDt,
        endTime: endDt,
        note: JSON.stringify(meta),
        status: isAdmin ? "approved" : "pending",
        approvedById: isAdmin ? currentUser.id : null,
        approvedAt: isAdmin ? new Date() : null,
      });
    }

    if (toCreate.length === 0) {
      return NextResponse.json(
        {
          created: 0,
          skipped,
          totalHours: 0,
          message: "كل الحصص المختارة مسجّلة مسبقاً لهذا العامل في هذا التاريخ",
        },
        { status: 200 }
      );
    }

    const created = await db.$transaction(async (tx) => {
      const rows: Array<{ id: string; startTime: Date; endTime: Date }> = [];
      for (const data of toCreate) {
        const r = await tx.workHours.create({ data, select: { id: true, startTime: true, endTime: true } });
        rows.push(r);
      }
      return rows;
    });

    return NextResponse.json(
      {
        created: created.length,
        skipped,
        totalHours: Math.round(totalHours * 100) / 100,
        records: created.map((r) => ({ id: r.id, startTime: r.startTime, endTime: r.endTime })),
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("POST workhours/bulk:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal" }, { status: 500 });
  }
}

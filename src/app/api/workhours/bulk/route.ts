import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/session";
import { parseWallDateTime } from "@/lib/wall-clock";
import { dayKeyFromDate, slotDurationHours, type PoolSlot } from "@/lib/pool-schedule";
import { checkContractAllowsWork } from "@/lib/work-contract-guard";
import { ensureRuntimeColumns } from "@/lib/runtime-schema";
import { runTx, ensureSqliteConcurrency } from "@/lib/tx-safe";

/**
 * POST /api/workhours/bulk — تسجيل عدة حصص دفعة واحدة (المرحلة 4 — §11)
 * ═══════════════════════════════════════════════════════════════════════
 * Body: { userId, date: "YYYY-MM-DD", slotIds: string[], note?, breakMinutes? }
 *
 * - الحصص تُقرأ من إعدادات المسبح (SwimmingTimeSlot) — المصدر الموحّد.
 *   لا يُقبل slotId لا ينتمي للنادي أو معطّل.
 * - لكل حصة يُنشأ سجل WorkHours مستقل بأوقاتها الحرفية (wall-clock UTC)
 *   مع لقطة {slotId, name, startTime, endTime} في note JSON (§27 تاريخية)
 *   وربط slotId + لقطة سعر الساعة rateSnapshot (المرحلة 5: §6/§23).
 * - الحصص المكررة (نفس العامل+اليوم+نفس وقت البداية) تُتخطى ولا تفشل العملية (§13).
 * - المسبح المغلق في ذلك اليوم يرفض الطلب كله (نفس قاعدة /api/workhours).
 * - ★ المرحلة 5 (§24): عقد منتهٍ يرفض الطلب (تجاوز المدير allowAfterContractEnd=true).
 * - كل شيء داخل معاملة واحدة: إما كل الحصص غير المكررة تُسجَّل أو لا شيء.
 *
 * ★ إصلاح «Unable to start a transaction in the given time» (P2028) + التكرار:
 *  - معمارية القراءة الواحدة + الكتابة الذرّية واحدة محفوظة كما هي (لا معاملة
 *    لكل حصة، ولا رفع مهلة لإخفاء السبب — بل غلاف runTx المُبرَّر أدناه).
 *  - المعاملة عبر runTx: maxWait=10s (صحوة Neon الباردة/طابور الاتصالات على
 *    الويب — وبديل WAL على سطح المكتب) + إعادة محاولة على فشل البدء العابر
 *    (P2028 = لم يُنفَّذ شيء → إعادة آمنة) + تسجيل تشخيصي.
 *  - إعادة فحص التكرار داخل المعاملة نفسها (يغلق نافذة السباق بين الطلبين).
 *  - فريد جزئي DB-level (WorkHours_active_user_date_start_key): السباق
 *    المتزامن الحقيقي يوقفه الفهرس (P2002) → محاولة كاملة واحدة إضافية ترى
 *    صفوف الطلب الآخر → استجابة «مكرر» نظيفة. لا 8 سجلات أبداً.
 *
 * Response: { created, skipped, totalHours, records: [...] }
 */

export async function POST(req: NextRequest) {
  try {
    ensureSqliteConcurrency(); // WAL + busy_timeout (جذر تزامن سطح المكتب)
    await ensureRuntimeColumns();
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

    const allowAfterContractEnd = body?.allowAfterContractEnd === true;
    const isAdminRole = currentUser.role === "admin" || currentUser.role === "superadmin";

    // ★ المرحلة 5 (§24): حماية العقد — لا تسجيل بعد انتهاء العقد إلا بتجاوز صريح
    if (!allowAfterContractEnd) {
      const guard = await checkContractAllowsWork(clubId, userId, date);
      if (!guard.ok) {
        return NextResponse.json(
          { error: guard.message, contractGuard: true },
          { status: isAdminRole ? 409 : 403 }
        );
      }
    }

    // ★ المرحلة 5 (§23): لقطة سعر الساعة وقت التسجيل (لكل السجلات المُنشأة الآن)
    const empForRate = await db.employee.findFirst({
      where: { clubId, userId, status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "desc" },
      select: { hourRate: true },
    });
    let rateSnapshot: number | null = empForRate?.hourRate ?? null;
    if (rateSnapshot === null) {
      const defRate = await db.setting.findFirst({ where: { clubId, key: "workHourRate" } });
      rateSnapshot = parseInt(defRate?.value || "200") || 200;
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
        status: { notIn: ["rejected", "cancelled"] },
      },
      select: { startTime: true },
    });
    const takenStarts = new Set(existing.map((e) => new Date(e.startTime).getTime()));

    const skipped: Array<{ slotId: string; name: string; reason: "duplicate" }> = [];

    const sortedSlots = slotIds
      .map((id) => slotMap.get(id)!)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    // بناء الصفوف: غير المكررة فقط (فحص تمهيدي سريع — الفحص الحاسم داخل المعاملة)
    const toCreate: Array<{
      clubId: string; userId: string; date: Date; startTime: Date; endTime: Date;
      note: string; status: string; approvedById: string | null; approvedAt: Date | null;
      slotId: string; rateSnapshot: number | null; hours: number;
    }> = [];

    for (const s of sortedSlots) {
      const startDt = parseWallDateTime(date, s.startTime);
      if (takenStarts.has(startDt.getTime())) {
        skipped.push({ slotId: s.id, name: s.name, reason: "duplicate" });
        continue;
      }
      takenStarts.add(startDt.getTime());
      let endDt = parseWallDateTime(date, s.endTime);
      if (endDt <= startDt) endDt = new Date(endDt.getTime() + 86_400_000);

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
        slotId: s.id,
        rateSnapshot,
        hours: Math.max(0, slotDurationHours(s.startTime, s.endTime) - breakMinutes / 60),
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

    // ─── المعاملة الذرّية الواحدة (قراءة واحدة + كتابة واحدة — لا معاملة لكل حصة) ───
    // السباق المتزامن الحقيقي: الفهرس الفريد الجزئي يرفض الازدواج (P2002) →
    // محاولة كاملة واحدة إضافية ترى صفوف الطلب الآخر → استجابة «مكرر» نظيفة.
    interface BulkOutcome {
      rows: Array<{ id: string; startTime: Date; endTime: Date }>;
      skippedInTx: Array<{ slotId: string; name: string; reason: "duplicate" }>;
      hours: number;
    }
    let outcome: BulkOutcome | null = null;
    for (let flowAttempt = 0; flowAttempt < 2 && !outcome; flowAttempt++) {
      try {
        outcome = await runTx<BulkOutcome>(
          async (tx) => {
            // ★ إعادة فحص التكرار داخل المعاملة (يغلق نافذة السباق TOCTOU)
            const fresh = await tx.workHours.findMany({
              where: { clubId, userId, date: dayStart, status: { notIn: ["rejected", "cancelled"] } },
              select: { startTime: true },
            });
            const freshTaken = new Set(fresh.map((e) => new Date(e.startTime).getTime()));

            const rows: Array<{ id: string; startTime: Date; endTime: Date }> = [];
            const skippedInTx: Array<{ slotId: string; name: string; reason: "duplicate" }> = [];
            let hours = 0;
            for (const data of toCreate) {
              if (freshTaken.has(data.startTime.getTime())) {
                skippedInTx.push({
                  slotId: data.slotId,
                  name: slotMap.get(data.slotId)?.name || data.slotId,
                  reason: "duplicate",
                });
                continue;
              }
              freshTaken.add(data.startTime.getTime());
              // hours حقل حسابي داخلي — يُستبعد قبل تمرير الصف إلى Prisma
              const { hours: rowHours, ...rowData } = data;
              const r = await tx.workHours.create({
                data: rowData,
                select: { id: true, startTime: true, endTime: true },
              });
              rows.push(r);
              hours += rowHours;
            }
            return { rows, skippedInTx, hours };
          },
          "workhours-bulk"
        );
      } catch (e) {
        const isUniqueRace = (e as { code?: string })?.code === "P2002";
        if (isUniqueRace && flowAttempt === 0) {
          console.warn("workhours/bulk: سباق فريد متزامن (P2002) — إعادة فحص كاملة واحدة");
          await new Promise((r) => setTimeout(r, 150));
          continue; // المحاولة الثانية ترى صفوف الطلب الآخر → تخطٍّ نظيف
        }
        throw e;
      }
    }

    if (!outcome) {
      return NextResponse.json({ error: "تعذر إتمام التسجيل — أعد المحاولة" }, { status: 409 });
    }

    return NextResponse.json(
      {
        created: outcome.rows.length,
        skipped: [...skipped, ...outcome.skippedInTx],
        totalHours: Math.round(outcome.hours * 100) / 100,
        records: outcome.rows.map((r) => ({ id: r.id, startTime: r.startTime, endTime: r.endTime })),
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("POST workhours/bulk:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal" }, { status: 500 });
  }
}

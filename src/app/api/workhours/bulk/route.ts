import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/session";
import { parseWallDateTime } from "@/lib/wall-clock";
import { dayKeyFromDate, slotDurationHours, type PoolSlot } from "@/lib/pool-schedule";
import { checkContractAllowsWork } from "@/lib/work-contract-guard";
import { ensureRuntimeColumns } from "@/lib/runtime-schema";
import { runTx, ensureSqliteConcurrency } from "@/lib/tx-safe";

/**
 * POST /api/workhours/bulk — تسجيل ساعات عمل لعمال متعددين وحصص متعددة دفعة واحدة
 * ═════════════════════════════════════════════════════════════════════════════════
 * يدعم:
 * 1) اختيار عامل واحد أو عدة عمال: userIds: string[] (أو userId للتوافق القديم)
 * 2) اختيار حصة واحدة أو عدة حصص: slotIds: string[]
 * 3) عملية ذرّية حقيقية (Atomic - All or Nothing):
 *    إما يتم تسجيل كل السجلات لجميع العمال والحصص بنجاح، أو لا يُنشأ أي سجل إطلاقاً.
 * 4) منع التكرار الصارم على مستوى الخادم وقاعدة البيانات:
 *    (نفس النادي + نفس العامل + نفس التاريخ + نفس الحصة أو نفس وقت البدء)
 * 5) لا تنشئ أي عملية مالية (WorkHours = ساعات مستحقة فقط، الدفع الفعلي يتم لاحقاً عبر المركز المالي والأجور)
 */

export async function POST(req: NextRequest) {
  try {
    ensureSqliteConcurrency(); // WAL + busy_timeout للتزامن
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

    // 1) استخراج قائمة العمال (دعم الاختيار المتعدد مع التوافق التام مع المفرد القديم)
    const rawUserIds: unknown = body.userIds ?? body.targetUserIds ?? body.userId ?? body.targetUserId;
    const userIds: string[] = Array.from(
      new Set(
        (Array.isArray(rawUserIds)
          ? rawUserIds
          : typeof rawUserIds === "string" && rawUserIds
            ? [rawUserIds]
            : [currentUser.id]
        ).filter((x): x is string => typeof x === "string" && Boolean(x.trim()))
      )
    );

    if (userIds.length === 0) {
      return NextResponse.json({ error: "اختر عاملاً واحداً على الأقل" }, { status: 400 });
    }
    if (userIds.length > 50) {
      return NextResponse.json({ error: "عدد العمال كبير جداً (الحد الأقصى 50)" }, { status: 400 });
    }

    // 2) استخراج وتدقيق التاريخ
    const date: string = typeof body.date === "string" ? body.date : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "التاريخ مطلوب بصيغة YYYY-MM-DD" }, { status: 400 });
    }

    // 3) استخراج وتدقيق الحصص
    const rawSlotIds: unknown = body.slotIds ?? body.slotId;
    const slotIds: string[] = Array.from(
      new Set(
        (Array.isArray(rawSlotIds)
          ? rawSlotIds
          : typeof rawSlotIds === "string" && rawSlotIds
            ? [rawSlotIds]
            : []
        ).filter((x): x is string => typeof x === "string" && Boolean(x.trim()))
      )
    );

    if (slotIds.length === 0) {
      return NextResponse.json({ error: "اختر حصة واحدة على الأقل" }, { status: 400 });
    }
    if (slotIds.length > 30) {
      return NextResponse.json({ error: "عدد الحصص كبير جداً (الحد 30)" }, { status: 400 });
    }

    const allowAfterContractEnd = body?.allowAfterContractEnd === true;
    const isAdminRole = currentUser.role === "admin" || currentUser.role === "superadmin";

    // 4) التحقق من وجود جميع العمال داخل النادي
    const workers = await db.user.findMany({
      where: { id: { in: userIds }, clubId },
      select: { id: true, name: true, role: true },
    });
    if (workers.length !== userIds.length) {
      const foundIds = new Set(workers.map((w) => w.id));
      const missing = userIds.filter((id) => !foundIds.has(id));
      return NextResponse.json({ error: `بعض العمال المحددين غير موجودين: ${missing.join(", ")}` }, { status: 404 });
    }
    const workerMap = new Map(workers.map((w) => [w.id, w]));

    // 5) فحص حماية العقود لكل عامل إن لم يكن هناك تجاوز صريح من المدير
    if (!allowAfterContractEnd) {
      for (const uid of userIds) {
        const guard = await checkContractAllowsWork(clubId, uid, date);
        if (!guard.ok) {
          const wName = workerMap.get(uid)?.name || uid;
          return NextResponse.json(
            { error: `العامل ${wName}: ${guard.message}`, contractGuard: true, userId: uid },
            { status: isAdminRole ? 409 : 403 }
          );
        }
      }
    }

    // 6) جلب لقطات سعر الساعة لكل عامل (من بطاقة الموظف أو الإعداد الافتراضي)
    const empRecords = await db.employee.findMany({
      where: { clubId, userId: { in: userIds }, status: { not: "ARCHIVED" } },
      select: { userId: true, hourRate: true },
    });
    const empRateMap = new Map(empRecords.map((e) => [e.userId, e.hourRate]));
    const defRateSetting = await db.setting.findFirst({ where: { clubId, key: "workHourRate" } });
    const defaultRate = parseInt(defRateSetting?.value || "200") || 200;

    const rateByUserId = new Map<string, number>();
    for (const uid of userIds) {
      rateByUserId.set(uid, empRateMap.get(uid) ?? defaultRate);
    }

    const breakMinutes = Number.isFinite(+body.breakMinutes) ? Math.max(0, Math.floor(+body.breakMinutes)) : 0;
    const textNote = typeof body.note === "string" ? body.note.trim() : "";
    const requestedWorkStatus = typeof body.workStatus === "string" && body.workStatus ? body.workStatus : "present";

    // 7) فحص يوم تشغيل واستغلال المسبح
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
      } catch {
        /* تجاهل في حال كان الإعداد تالفاً */
      }
    }

    // 8) جلب الحصص المحددة من جدول المسبح
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

    const sortedSlots = slotIds
      .map((id) => slotMap.get(id)!)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    // 9) فحص التكرار الاستباقي الصارم (Atomic: إن وجد أي تكرار لأي عامل وحصة، تفشل العملية بالكامل)
    const dayStart = parseWallDateTime(date, "00:00");
    const existing = await db.workHours.findMany({
      where: {
        clubId,
        userId: { in: userIds },
        date: dayStart,
        status: { notIn: ["rejected", "cancelled"] },
      },
      select: { userId: true, startTime: true, slotId: true },
    });

    const takenStartsByUser = new Set(existing.map((e) => `${e.userId}:${new Date(e.startTime).getTime()}`));
    const takenSlotsByUser = new Set(existing.filter((e) => e.slotId).map((e) => `${e.userId}:${e.slotId}`));

    const conflicts: Array<{ userId: string; workerName: string; slotId: string; slotName: string; time: string }> = [];

    for (const uid of userIds) {
      const wName = workerMap.get(uid)?.name || uid;
      for (const s of sortedSlots) {
        const startDt = parseWallDateTime(date, s.startTime);
        const keyTime = `${uid}:${startDt.getTime()}`;
        const keySlot = `${uid}:${s.id}`;
        if (takenStartsByUser.has(keyTime) || takenSlotsByUser.has(keySlot)) {
          conflicts.push({
            userId: uid,
            workerName: wName,
            slotId: s.id,
            slotName: s.name,
            time: `${s.startTime} - ${s.endTime}`,
          });
        }
      }
    }

    if (conflicts.length > 0) {
      const firstConflict = conflicts[0];
      return NextResponse.json(
        {
          error: `تعذر التسجيل: الحصة (${firstConflict.slotName} ${firstConflict.time}) مسجّلة مسبقاً للعامل ${firstConflict.workerName} في هذا التاريخ`,
          conflict: true,
          conflicts,
        },
        { status: 409 }
      );
    }

    // 10) تجهيز سجلات الإدراج لجميع العمال والحصص
    const toCreate: Array<{
      id: string;
      clubId: string;
      userId: string;
      date: Date;
      startTime: Date;
      endTime: Date;
      note: string;
      status: string;
      approvedById: string | null;
      approvedAt: Date | null;
      slotId: string;
      rateSnapshot: number;
    }> = [];

    let totalDurationHoursPerWorker = 0;
    for (const s of sortedSlots) {
      totalDurationHoursPerWorker += Math.max(0, slotDurationHours(s.startTime, s.endTime) - breakMinutes / 60);
    }

    const userBreakdown: Array<{
      userId: string;
      name: string;
      hourlyRate: number;
      sessionsCount: number;
      hours: number;
      expectedWage: number;
    }> = [];

    for (const uid of userIds) {
      const w = workerMap.get(uid)!;
      const rate = rateByUserId.get(uid) ?? defaultRate;
      const hours = Math.round(totalDurationHoursPerWorker * 100) / 100;
      const expectedWage = Math.round(hours * rate);

      userBreakdown.push({
        userId: uid,
        name: w.name,
        hourlyRate: rate,
        sessionsCount: sortedSlots.length,
        hours,
        expectedWage,
      });

      for (const s of sortedSlots) {
        const startDt = parseWallDateTime(date, s.startTime);
        let endDt = parseWallDateTime(date, s.endTime);
        if (endDt <= startDt) endDt = new Date(endDt.getTime() + 86_400_000);

        const meta = {
          breakMinutes,
          workStatus: requestedWorkStatus,
          absenceReason: null,
          textNote,
          session: { slotId: s.id, name: s.name, startTime: s.startTime, endTime: s.endTime },
        };

        const isAdmin = currentUser.role === "admin" || currentUser.role === "superadmin";

        toCreate.push({
          id: crypto.randomUUID(),
          clubId,
          userId: uid,
          date: dayStart,
          startTime: startDt,
          endTime: endDt,
          note: JSON.stringify(meta),
          status: isAdmin ? "approved" : "pending",
          approvedById: isAdmin ? currentUser.id : null,
          approvedAt: isAdmin ? new Date() : null,
          slotId: s.id,
          rateSnapshot: rate,
        });
      }
    }

    // 11) المعاملة الذرّية الواحدة السريعة (Atomic Transaction)
    // غلاف runTx يضمن إتمام العملية دفعة واحدة أو التراجع التام في حال أي خطأ/تعارض
    await runTx(
      async (tx) => {
        // التحقق الذري الحاسم داخل المعاملة (إغلاق نافذة السباق تماماً)
        const fresh = await tx.workHours.findMany({
          where: {
            clubId,
            userId: { in: userIds },
            date: dayStart,
            status: { notIn: ["rejected", "cancelled"] },
          },
          select: { userId: true, startTime: true, slotId: true },
        });

        const freshStarts = new Set(fresh.map((e) => `${e.userId}:${new Date(e.startTime).getTime()}`));
        const freshSlots = new Set(fresh.filter((e) => e.slotId).map((e) => `${e.userId}:${e.slotId}`));

        for (const item of toCreate) {
          const keyTime = `${item.userId}:${item.startTime.getTime()}`;
          const keySlot = `${item.userId}:${item.slotId}`;
          if (freshStarts.has(keyTime) || freshSlots.has(keySlot)) {
            const wName = workerMap.get(item.userId)?.name || item.userId;
            throw new Error(`تعارض متزامن: الحصة مسجلة مسبقاً للعامل ${wName}`);
          }
        }

        // إدراج جميع السجلات دفعة واحدة (Bulk createMany)
        try {
          await tx.workHours.createMany({
            data: toCreate,
          });
        } catch (createManyErr) {
          // بديل متوافق لبعض محركات SQLite إن لم تدعم createMany على المعاملة
          await Promise.all(toCreate.map((row) => tx.workHours.create({ data: row })));
        }

        // تسجيل حدث التدقيق للعملية المجمعة
        await tx.auditLog.create({
          data: {
            clubId,
            userId: currentUser.id,
            action: "work_hours_bulk_create",
            entityType: "WorkHours",
            description: `تسجيل جماعي لـ ${userIds.length} عمال × ${sortedSlots.length} حصص = ${toCreate.length} سجلاً بتاريخ ${date}`,
            metadata: JSON.stringify({
              date,
              workersCount: userIds.length,
              slotsCount: sortedSlots.length,
              totalRecords: toCreate.length,
              totalHours: Math.round(totalDurationHoursPerWorker * userIds.length * 10) / 10,
              totalExpectedWage: userBreakdown.reduce((sum, u) => sum + u.expectedWage, 0),
            }),
          },
        }).catch(() => undefined);
      },
      "workhours-multi-worker-bulk"
    );

    const totalHoursCombined = Math.round(totalDurationHoursPerWorker * userIds.length * 100) / 100;
    const totalExpectedWageCombined = userBreakdown.reduce((sum, u) => sum + u.expectedWage, 0);

    return NextResponse.json(
      {
        success: true,
        created: toCreate.length,
        totalWorkers: userIds.length,
        totalSlotsPerWorker: sortedSlots.length,
        totalHours: totalHoursCombined,
        totalExpectedWage: totalExpectedWageCombined,
        breakdown: userBreakdown,
        message: `تم تسجيل ${toCreate.length} سجل عمل بنجاح لـ ${userIds.length} عمال`,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("POST workhours/bulk error:", e);
    const msg = e instanceof Error ? e.message : "Internal Error";
    if ((e as { code?: string })?.code === "P2002" || msg.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "سجل مكرر: إحدى الحصص مسجّلة مسبقاً لعامل محدد في هذا اليوم", duplicate: true },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

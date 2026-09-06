import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/session";
import { parseWallDateTime, utcMonthStart, utcMonthEnd, durationHours } from "@/lib/wall-clock";
import { checkContractAllowsWork } from "@/lib/work-contract-guard";
import { ensureRuntimeColumns } from "@/lib/runtime-schema";
import { runTx, ensureSqliteConcurrency } from "@/lib/tx-safe";

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasPermission(currentUser.role, "workHours")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const userId = url.searchParams.get("userId");
    const month = url.searchParams.get("month");

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const where: Record<string, unknown> = { ...clubFilter };
    if (status) where.status = status;
    if (userId) where.userId = userId;

    if (currentUser.role === "lifeguard") {
      where.userId = currentUser.id;
    }

    if (month) {
      const [year, mon] = month.split("-").map(Number);
      // ★ حدود الشهر بـ UTC لتطابق التخزين (wall-clock UTC) — بلا انحراف توقيت
      where.date = { gte: utcMonthStart(month), lte: utcMonthEnd(month) };
    }

    const workHours = await db.workHours.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { date: "desc" },
    });

    // 🔑 جلب Employees لربط hourlyRate و position
    const clubId = currentUser.clubId;
    const employees = clubId
      ? await db.employee.findMany({
          where: { clubId },
          select: { userId: true, position: true, hourRate: true },
        })
      : [];
    const empMap = new Map(employees.map((e) => [e.userId, { hourlyRate: e.hourRate, position: e.position }]));

    // 🔑 حقن الحقول الإضافية من note (JSON) إن وُجدت
    const enriched = workHours.map((w) => {
      let breakMinutes = 0;
      let workStatus = "present";
      let absenceReason: string | null = null;
      try {
        if (w.note && w.note.startsWith("{")) {
          const meta = JSON.parse(w.note);
          breakMinutes = meta.breakMinutes || 0;
          workStatus = meta.workStatus || "present";
          absenceReason = meta.absenceReason || null;
        }
      } catch {}
      const emp = empMap.get(w.userId);
      return {
        ...w,
        breakMinutes,
        workStatus,
        absenceReason,
        user: {
          ...w.user,
          hourlyRate: emp?.hourlyRate || 0,
          position: emp?.position || null,
          avatar: null,
        },
      };
    });

    // ═══ 🔑 ملخص الساعات والأجور — يُحسب في الخادم (المصدر الواحد — رقم واحد §27) ═══
    // ★ القاعدة الموحّدة لإلغاء ساعات العمل (قرار التدقيق):
    //   pending/approved (نشط)  → يدخل في الساعات والأجور وكل الحسابات التشغيلية
    //   rejected/cancelled      → لا يدخل في أي حساب — يبقى في القائمة للتاريخ والتدقيق فقط
    // الاستبعاد هنا بفلتر DB صريح (status notIn) — ليس إخفاءً في الواجهة:
    // القائمة تعرض كل السجلات (بما فيها الملغى بشارة «ملغى») لكن الإجماليات
    // (صفوف العمال + تذييل الجدول) تُبنى من هذا الملخص النشط حصراً.
    const summaryWhere: Record<string, unknown> = {
      ...(currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! }),
      status: { notIn: ["rejected", "cancelled"] },
    };
    if (currentUser.role === "lifeguard") summaryWhere.userId = currentUser.id;
    if (month) summaryWhere.date = { gte: utcMonthStart(month), lte: utcMonthEnd(month) };

    const activeRows = await db.workHours.findMany({
      where: summaryWhere,
      select: { userId: true, startTime: true, endTime: true, note: true, rateSnapshot: true },
    });

    type UserAgg = { rawHours: number; overtime: number; presentSessions: number; absentDays: number; grossBySnapshot: number };
    const agg = new Map<string, UserAgg>();
    for (const r of activeRows) {
      let breakMinutes = 0;
      let workStatus = "present";
      try {
        if (r.note && r.note.startsWith("{")) {
          const meta = JSON.parse(r.note);
          breakMinutes = meta.breakMinutes || 0;
          workStatus = meta.workStatus || "present";
        }
      } catch {}
      const a = agg.get(r.userId) || { rawHours: 0, overtime: 0, presentSessions: 0, absentDays: 0, grossBySnapshot: 0 };
      if (workStatus === "present") {
        const h = durationHours(r.startTime, r.endTime, breakMinutes);
        a.rawHours += h;
        a.overtime += Math.max(0, h - 8);
        a.presentSessions += 1;
        // ★ لقطة السعر أسبق (§23 — نفس قاعدة wage-core): الأجر من لحظة التسجيل
        //   لا من سعر اليوم — صفحة الساعات وصفحة الأجور يعرضان رقماً واحداً
        a.grossBySnapshot += h * (r.rateSnapshot ?? empMap.get(r.userId)?.hourlyRate ?? 0);
      } else if (workStatus === "absent") {
        a.absentDays += 1;
      }
      agg.set(r.userId, a);
    }

    // نفس دلالات الواجهة السابقة حرفياً (ساعات مقرّبة 1 عشري، أجر مقرّب صحيح)
    // — الفرق الوحيد: الملغى/المرفوض مستثنى من المصدر (الاستعلام) لا من العرض
    const perUser = [...agg.entries()].map(([userIdKey, a]) => {
      return {
        userId: userIdKey,
        presentDays: a.presentSessions,
        absentDays: a.absentDays,
        totalHours: Math.round(a.rawHours * 10) / 10,
        overtime: Math.round(a.overtime * 10) / 10,
        totalWage: Math.round(a.grossBySnapshot),
      };
    });
    const summary = {
      rule: "active-only", // pending/approved تُحسب — rejected/cancelled لا
      perUser,
      totals: {
        totalHours: Math.round(perUser.reduce((s, x) => s + x.totalHours, 0) * 10) / 10,
        overtime: Math.round(perUser.reduce((s, x) => s + x.overtime, 0) * 10) / 10,
        totalWage: perUser.reduce((s, x) => s + x.totalWage, 0),
        presentDays: perUser.reduce((s, x) => s + x.presentDays, 0),
        absentDays: perUser.reduce((s, x) => s + x.absentDays, 0),
      },
    };

    return NextResponse.json({ workHours: enriched, summary });
  } catch (e) {
    console.error("GET workhours:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    ensureSqliteConcurrency(); // WAL + busy_timeout (جذر تزامن سطح المكتب — إصلاح P2028)
    await ensureRuntimeColumns();
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasPermission(currentUser.role, "workHours")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await req.json();
    const { date, startTime, endTime, note, breakMinutes, workStatus, absenceReason, targetUserId, allowAfterContractEnd } = body;

    if (!date) {
      return NextResponse.json({ error: "التاريخ مطلوب" }, { status: 400 });
    }

    const effectiveUserId = targetUserId || currentUser.id;
    const isAdminRole = currentUser.role === "admin" || currentUser.role === "superadmin";

    // ★ المرحلة 5 (§23): لقطة سعر الساعة وقت التسجيل — تغيير الأجر لاحقاً لا يعيد حساب التاريخ
    const empForRate = await db.employee.findFirst({
      where: { clubId: currentUser.clubId!, userId: effectiveUserId, status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "desc" },
      select: { hourRate: true },
    });
    let rateSnapshot: number | null = empForRate?.hourRate ?? null;
    if (rateSnapshot === null) {
      const defRate = await db.setting.findFirst({ where: { clubId: currentUser.clubId!, key: "workHourRate" } });
      rateSnapshot = parseInt(defRate?.value || "200") || 200;
    }

    const isAbsence = workStatus === "absent" || workStatus === "leave" || workStatus === "sick" || workStatus === "vacation";

    // 🔑 خزّن الحقول الإضافية في note كـ JSON
    const noteMeta = JSON.stringify({
      breakMinutes: breakMinutes || 0,
      workStatus: workStatus || "present",
      absenceReason: absenceReason || null,
      textNote: note || "",
    });

    if (isAbsence) {
      // الغياب: إنشاء + تدقيق في معاملة واحدة ذرّية (runTx — تحمّل P2028 العابر)
      const workHour = await runTx(
        async (tx) => {
          const wh = await tx.workHours.create({
            data: {
              clubId: currentUser.clubId!,
              userId: targetUserId || currentUser.id,
              date: parseWallDateTime(date, "00:00"),
              startTime: parseWallDateTime(date, "00:00"),
              endTime: parseWallDateTime(date, "00:00"),
              note: noteMeta,
              status: currentUser.role === "admin" || currentUser.role === "superadmin" ? "approved" : "pending",
              approvedById: (currentUser.role === "admin" || currentUser.role === "superadmin") ? currentUser.id : null,
              approvedAt: (currentUser.role === "admin" || currentUser.role === "superadmin") ? new Date() : null,
              rateSnapshot,
            },
          });
          await tx.auditLog.create({
            data: {
              clubId: currentUser.clubId,
              userId: currentUser.id,
              action: "work_hour_create",
              entityType: "WorkHours",
              entityId: wh.id,
              description: `تسجيل غياب/عطلة للعامل (${workStatus}) بتاريخ ${date}`,
              metadata: JSON.stringify({ workStatus, date }),
            },
          }).catch(() => undefined); // التدقيق اختياري — لا يفشل التسجيل
          return wh;
        },
        "workhours-absence"
      );
      return NextResponse.json({ workHour }, { status: 201 });
    }

    if (!startTime || !endTime) {
      return NextResponse.json({ error: "وقت البداية والنهاية مطلوبان" }, { status: 400 });
    }

    // ★ منع التسجيل في يوم مغلق (إعداد poolOperatingDays — غيابه = كل الأيام مفتوحة)
    const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const dayLabels: Record<string, string> = { sun: "الأحد", mon: "الإثنين", tue: "الثلاثاء", wed: "الأربعاء", thu: "الخميس", fri: "الجمعة", sat: "السبت" };
    const recordDayKey = dayKeys[new Date(`${date}T12:00:00Z`).getUTCDay()];
    const opDaysRaw = await db.setting.findFirst({ where: { clubId: currentUser.clubId!, key: "poolOperatingDays" } });
    if (opDaysRaw?.value) {
      try {
        const opDays: unknown = JSON.parse(opDaysRaw.value);
        if (Array.isArray(opDays) && opDays.length > 0 && !opDays.includes(recordDayKey)) {
          return NextResponse.json({ error: `المسبح مغلق في يوم ${dayLabels[recordDayKey] || recordDayKey} حسب إعدادات أيام الاستغلال` }, { status: 400 });
        }
      } catch { /* إعداد تالف → نتجاهل */ }
    }

    // ★ المرحلة 5 (§24): حماية العقد — لا تسجيل بعد انتهاء العقد إلا بتجاوز صريح.
    // المدير يتلقّى 409 contractGuard فيتّم التحذير الواضح في الواجهة ثم يرسل
    // allowAfterContractEnd=true للتأكيد؛ غير المدير يُرفض دائماً (403).
    if (!allowAfterContractEnd) {
      const guard = await checkContractAllowsWork(currentUser.clubId!, effectiveUserId, date);
      if (!guard.ok) {
        return NextResponse.json(
          { error: guard.message, contractGuard: true },
          { status: isAdminRole ? 409 : 403 }
        );
      }
    }

    // ★ منع التكرار: نفس العامل + نفس اليوم + نفس وقت البداية (سجل غير مرفوض)
    const dupStart = parseWallDateTime(date, startTime);
    const duplicate = await db.workHours.findFirst({
      where: {
        clubId: currentUser.clubId!,
        userId: targetUserId || currentUser.id,
        date: parseWallDateTime(date, "00:00"),
        startTime: dupStart,
        status: { notIn: ["rejected", "cancelled"] },
      },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json({ error: "سجل مكرر — نفس العامل مسجّل في نفس اليوم ونفس وقت البداية" }, { status: 409 });
    }

    // ★ تخزين wall-clock UTC: الوقت المُدخل يُحفظ كما هو حرفياً —
    // 09:00 تبقى 09:00 في أي خادم وأي متصفح (جذر إصلاح انحراف الساعة +1)
    const startDate = parseWallDateTime(date, startTime);
    let endDate = parseWallDateTime(date, endTime);
    if (endDate <= startDate) {
      endDate = new Date(endDate.getTime() + 86400000); // وردية ليلية تعبر منتصف الليل
    }
    const diffMs = endDate.getTime() - startDate.getTime();
    if (diffMs < 15 * 60 * 1000) {
      return NextResponse.json({ error: "الفرق بين وقت البداية والنهاية قليل جداً" }, { status: 400 });
    }

    // ★ المعاملة الذرّية: إنشاء + تدقيق معاً (runTx — maxWait مُبرَّر + تحمّل P2028 العابر).
    // P2002 (فهرس WorkHours_active_user_date_start_key) = سباق تكرار متزامن →
    // استجابة 409 واضحة تحدد الحصة المكررة — لا ازدواج على مستوى القاعدة.
    try {
      const workHour = await runTx(
        async (tx) => {
          const wh = await tx.workHours.create({
            data: {
              clubId: currentUser.clubId!,
              userId: targetUserId || currentUser.id,
              date: parseWallDateTime(date, "00:00"),
              startTime: startDate,
              endTime: endDate,
              note: noteMeta,
              status: currentUser.role === "admin" || currentUser.role === "superadmin" ? "approved" : "pending",
              approvedById: (currentUser.role === "admin" || currentUser.role === "superadmin") ? currentUser.id : null,
              approvedAt: (currentUser.role === "admin" || currentUser.role === "superadmin") ? new Date() : null,
              rateSnapshot,
            },
          });
          await tx.auditLog.create({
            data: {
              clubId: currentUser.clubId,
              userId: currentUser.id,
              action: "work_hour_create",
              entityType: "WorkHours",
              entityId: wh.id,
              description: `تسجيل ساعة عمل ${startTime}→${endTime} بتاريخ ${date}`,
              metadata: JSON.stringify({ startTime, endTime, date, rateSnapshot }),
            },
          }).catch(() => undefined); // التدقيق اختياري — لا يفشل التسجيل
          return wh;
        },
        "workhours-single"
      );
      return NextResponse.json({ workHour }, { status: 201 });
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002") {
        return NextResponse.json(
          { error: `سجل مكرر — نفس العامل مسجّل في نفس اليوم ونفس وقت البداية (${startTime})`, duplicate: true, startTime },
          { status: 409 }
        );
      }
      throw e;
    }
  } catch (e) {
    console.error("POST workhours:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal" }, { status: 500 });
  }
}

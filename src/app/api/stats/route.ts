import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeSubscriberFields, computeSubscriberFieldsDynamic, isExemptStatus, type SubscriptionTypeConfig } from "@/lib/rcs";
import { getCurrentUser } from "@/lib/session";
import { computeWages } from "@/lib/wage-core";
import { ensureRuntimeColumns } from "@/lib/runtime-schema";
import { dayKeyFromDate, sessionsForDay, todayYMD, isOperatingDay } from "@/lib/pool-schedule";

/**
 * GET /api/stats
 * 🔒 محسّن: يستخدم groupBy في DB للتوزيعات + select محدود للحسابات العمرية/الحالات
 * ═════════════════════════════════════════════════════════════
 * ★ إحصائيات المنخرطين فقط (المرحلة 4):
 * لا حساب مالي هنا إطلاقاً — كل رقم مالي في النظام يأتي من دفتر
 * FinancialTransaction عبر /api/financial/dashboard (المصدر الوحيد للحقيقة).
 * مستحقات الاشتراكات غير المدفوعة تُحسب هي أيضاً في المسار المالي (receivables).
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const isSuperadmin = currentUser.role === "superadmin";
    const clubFilter = isSuperadmin ? {} : { clubId: currentUser.clubId! };

    // ════ 1) التوزيعات حسب الحقول المخزنة (groupBy في DB — سريع جداً) ════
    const [
      total,
      byPaymentStatusRaw,
      bySubscriptionTypeRaw,
      byGenderRaw,
      byBloodTypeRaw,
      bySwimmingDaysRaw,
      byTimeSlotRaw,
    ] = await Promise.all([
      db.subscriber.count({ where: clubFilter }),

      db.subscriber.groupBy({
        by: ["paymentStatus"],
        where: clubFilter,
        _count: { _all: true },
      }),

      db.subscriber.groupBy({
        by: ["subscriptionType"],
        where: clubFilter,
        _count: { _all: true },
      }),

      db.subscriber.groupBy({
        by: ["gender"],
        where: clubFilter,
        _count: { _all: true },
      }),

      db.subscriber.groupBy({
        by: ["bloodType"],
        where: clubFilter,
        _count: { _all: true },
      }),

      db.subscriber.groupBy({
        by: ["swimmingDays"],
        where: clubFilter,
        _count: { _all: true },
      }),

      db.subscriber.groupBy({
        by: ["timeSlot"],
        where: clubFilter,
        _count: { _all: true },
      }),
    ]);

    // تنسيق التوزيعات
    // ★ "معفى" added as a separate payment status bucket
    const paymentStatusLabels = ["مدفوع", "لم يدفع", "تأمين فقط", "اشتراك 300", "معفى"];
    const byPaymentStatus = paymentStatusLabels.map((status) => ({
      status,
      count: byPaymentStatusRaw.find((r) => r.paymentStatus === status)?._count._all || 0,
    }));

    // ★ Explicit EXEMPT count (the key new metric)
    const exemptCount = byPaymentStatusRaw
      .filter((r) => isExemptStatus(r.paymentStatus))
      .reduce((sum, r) => sum + r._count._all, 0);

    // أنواع الاشتراك من DB
    const subTypeWhere = isSuperadmin ? { active: true } : { clubId: currentUser.clubId!, active: true };
    const dbSubTypes = await db.subscriptionType.findMany({
      where: subTypeWhere,
      orderBy: { sortOrder: "asc" },
    });
    const bySubscriptionType = dbSubTypes.map((t) => ({
      type: t.name === t.code ? t.name : `${t.name} (${t.code})`,
      count: bySubscriptionTypeRaw.find((r) => r.subscriptionType === t.code)?._count._all || 0,
    }));

    const totalMales = byGenderRaw.find((r) => r.gender === "ذكر")?._count._all || 0;
    const totalFemales = byGenderRaw.find((r) => r.gender === "أنثى")?._count._all || 0;

    const bloodTypes = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;
    const byBloodType = bloodTypes.map((type) => ({
      type,
      count: byBloodTypeRaw.find((r) => r.bloodType === type)?._count._all || 0,
    }));

    const swimmingDaysOptions = ["الأحد والأربعاء", "الاثنين والخميس", "الثلاثاء والجمعة", "كل الأيام"] as const;
    const bySwimmingDays = swimmingDaysOptions.map((days) => ({
      days,
      count: bySwimmingDaysRaw.find((r) => r.swimmingDays === days)?._count._all || 0,
    }));

    const timeSlots = ["09:00-10:00", "10:00-11:00", "19:00-20:00", "20:00-21:00"] as const;
    const byTimeSlot = timeSlots.map((slot) => ({
      slot,
      count: byTimeSlotRaw.find((r) => r.timeSlot === slot)?._count._all || 0,
    }));

    // ════ 2) الحسابات المالية والعمرية (تحتاج حقول محسوبة في JS) ════
    // 🔒 تحسين: select فقط الحقول اللازمة (~200 bytes/صف بدلاً من ~2KB)
    const subsForComputation = await db.subscriber.findMany({
      where: clubFilter,
      select: {
        id: true,
        birthDate: true,
        gender: true,
        subscriptionType: true,
        paymentStatus: true,
        lastPaymentDate: true,
      },
    });

    // ★ جلب أنواع الاشتراك من قاعدة البيانات لحساب الرسوم الصحيحة حسب العمر
    const dbTypesMap: Record<string, SubscriptionTypeConfig> = {};
    for (const t of dbSubTypes) {
      dbTypesMap[t.code] = {
        code: t.code, name: t.name,
        subscriptionFee: t.subscriptionFee, insuranceFee: t.insuranceFee,
        compoundRights: t.compoundRights, durationDays: t.durationDays,
        givesMembershipNumber: t.givesMembershipNumber, requiresInsurance: t.requiresInsurance,
        requiresCompoundFee: t.requiresCompoundFee, renewableMonthly: t.renewableMonthly,
        freeSubscription: t.freeSubscription,
      };
    }
    const computed = subsForComputation.map((s) => {
      const tc = dbTypesMap[s.subscriptionType as string];
      return { ...s, ...(tc ? computeSubscriberFieldsDynamic(s as any, tc) : computeSubscriberFields(s as any)) };
    });

    // ★ paid = subscribers who paid AND are NOT exempt (exempt is a separate category)
    //   unpaid = explicitly "لم يدفع"
    //   exempt = isExempt flag (separate, excluded from paid/unpaid/revenue)
    const paid = computed.filter((s) => !isExemptStatus(s.paymentStatus) && s.paymentStatus !== "لم يدفع");
    const unpaid = computed.filter((s) => s.paymentStatus === "لم يدفع");
    const exempt = computed.filter((s) => s.isExempt);

    // ★ الحساب المالي أُزيل من هذا المسار عمداً (المرحلة 4) —
    // الإيرادات والمستحقات والرسوم كلها من الدفتر في /api/financial/dashboard

    // Renewal status breakdown (محسوب)
    const renewalStatuses = ["✅ ساري", "⚠️ قريب الانتهاء", "⛔ منتهي - يتطلب تجديد", "🔒 مجمدة"] as const;
    const renewalLabels = ["سارية", "قريبة الانتهاء", "منتهية", "مجمدة"];
    const byRenewalStatus = renewalStatuses.map((status, i) => ({
      status: renewalLabels[i],
      count: computed.filter((s) => s.renewalStatus === status).length,
    }));

    // Age/gender breakdown (محسوب من birthDate)
    const malesUnder13 = computed.filter((s) => s.gender === "ذكر" && s.age < 13).length;
    const femalesUnder13 = computed.filter((s) => s.gender === "أنثى" && s.age < 13).length;
    const malesOver13 = computed.filter((s) => s.gender === "ذكر" && s.age >= 13).length;
    const femalesOver13 = computed.filter((s) => s.gender === "أنثى" && s.age >= 13).length;

    // ════ المرحلة 4: إحصائيات المسبح (لا مالية هنا — الأجور المعلّقة من wage-core) ════
    let pool: {
      todayKey: string | null;
      operatingToday: boolean;
      todaySessions: number;
      activeLifeguardsToday: number;
      todayWorkHours: number;
      pendingWagesMonth: number;
    } | null = null;
    try {
      if (!isSuperadmin && currentUser.clubId) {
        const clubId = currentUser.clubId;
        // ★ ضمان عمود slotId على الإنتاج قبل أي استعلام يستخدمه (نمط الشفاء الذاتي)
        await ensureRuntimeColumns();
        const today = todayYMD();
        const todayKey = dayKeyFromDate(today);
        const opRaw = await db.setting.findFirst({ where: { clubId, key: "poolOperatingDays" } });
        let opDays: string[] = [];
        if (opRaw?.value) {
          try {
            const parsed: unknown = JSON.parse(opRaw.value);
            if (Array.isArray(parsed)) opDays = parsed.filter((k): k is string => typeof k === "string");
          } catch { /* إعداد تالف */ }
        }
        const operatingToday = isOperatingDay(opDays, todayKey);
        const slots = await db.swimmingTimeSlot.findMany({ where: { clubId } });
        const todaySessionsList = operatingToday ? sessionsForDay(slots as never, todayKey) : [];
        const todaySessionIds = todaySessionsList.map((s) => s.id);
        // العمال المعيّنون على جلسات اليوم (عبر slotId) — عدد فريد
        let activeLifeguardsToday = 0;
        if (todaySessionIds.length > 0) {
          const assigned = await db.guardAssignment.findMany({
            where: { clubId, isActive: true, slotId: { in: todaySessionIds } },
            select: { userId: true },
            distinct: ["userId"],
          });
          activeLifeguardsToday = assigned.length;
        }
        // ساعات العمل المعتمدة اليوم (wall-clock UTC)
        const dayStart = new Date(`${today}T00:00:00.000Z`);
        const dayEnd = new Date(`${today}T23:59:59.999Z`);
        const todayWh = await db.workHours.findMany({
          where: { clubId, date: { gte: dayStart, lte: dayEnd }, status: "approved" },
          select: { startTime: true, endTime: true, note: true },
        });
        let todayWorkHours = 0;
        for (const r of todayWh) {
          let breakMinutes = 0;
          let workStatus = "present";
          try {
            if (r.note && r.note.startsWith("{")) {
              const meta = JSON.parse(r.note);
              breakMinutes = meta.breakMinutes || 0;
              workStatus = meta.workStatus || "present";
            }
          } catch {}
          if (workStatus !== "present" && workStatus !== "half-day") continue;
          todayWorkHours += Math.max(0, (new Date(r.endTime).getTime() - new Date(r.startTime).getTime()) / 3600000 - breakMinutes / 60);
        }
        // الأجور المعلّقة (المتبقي) للشهر الحالي — من نفس مصدر صفحة الأجور
        const nowD = new Date();
        const ym = `${nowD.getUTCFullYear()}-${String(nowD.getUTCMonth() + 1).padStart(2, "0")}`;
        const last = new Date(Date.UTC(nowD.getUTCFullYear(), nowD.getUTCMonth() + 1, 0)).getUTCDate();
        const { totals } = await computeWages(clubId, `${ym}-01`, `${ym}-${String(last).padStart(2, "0")}`);
        pool = {
          todayKey,
          operatingToday,
          todaySessions: todaySessionsList.length,
          activeLifeguardsToday,
          todayWorkHours: Math.round(todayWorkHours * 10) / 10,
          pendingWagesMonth: totals.remaining,
        };
      }
    } catch (e) {
      console.warn("stats pool block failed:", e);
    }

    return NextResponse.json({
      total,
      paid: paid.length,
      // ★ EXEMPT count as a first-class metric (separate from paid/unpaid)
      unpaid: unpaid.length,
      exempt: exempt.length,
      bySubscriptionType,
      byPaymentStatus,
      byRenewalStatus,
      ageGender: {
        malesUnder13,
        femalesUnder13,
        malesOver13,
        femalesOver13,
        totalMales,
        totalFemales,
        adultsOver14: malesOver13 + femalesOver13,
        childrenUnder14: malesUnder13 + femalesUnder13,
      },
      byBloodType,
      bySwimmingDays,
      byTimeSlot,
      pool,
    });
  } catch (error) {
    console.error("GET /api/stats error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

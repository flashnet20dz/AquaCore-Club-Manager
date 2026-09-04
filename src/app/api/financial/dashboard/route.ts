import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/session";
import { ensureRuntimeColumns } from "@/lib/runtime-schema";
import { computeSubscriberFieldsDynamic, isExemptStatus, type SubscriptionTypeConfig } from "@/lib/rcs";
import { financialNumber } from "@/lib/financial-posting";

/**
 * GET /api/financial/dashboard
 * ═════════════════════════════════════════════════════════════
 * المصدر الوحيد للأرقام المالية في كل الواجهات (المرحلة 4/30):
 * كل رقم يُحسب هنا من دفتر FinancialTransaction (النشط فقط) — لا من المنخرطين.
 *
 * ?period=today|week|month|lastmonth|year|custom&from=YYYY-MM-DD&to=YYYY-MM-DD
 * ?day=YYYY-MM-DD → كشف يومي كامل (opening/during/closing + جدول اليوم)
 *
 * يعيد:
 *  balance        — الإجمالي التاريخي (aggregates من الدفتر = الحقيقة)
 *  period         — افتتاحي/داخل/خارج/صافي/ختامي الفترة المختارة + أكبر عملية
 *  receivables    — مستحقات للنادي (من حالات اشتراك المنخرطين — ليست إيراداً)
 *  payables       — التزامات على النادي (أجور مستحقة)
 *  realAvailable  — الرصيد − الالتزامات
 *  cancelled      — ملخص الملغاة (خارج كل الأرقام)
 *  integrity      — مطابقة الكاش (FinancialBalance) مع الدفتر لحظياً
 *  + monthlyComparison, chartData, paymentMethods, byCategory (الفترة),
 *    lastTransactions, topExpenses, topIncome, periodIncome, dues (توافق), dayStatement
 */
export async function GET(req: NextRequest) {
  try {
    await ensureRuntimeColumns();
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasPermission(currentUser.role, "financialDashboard")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const targetClubId = currentUser.role === "superadmin" ? null : currentUser.clubId;
    if (!targetClubId) {
      return NextResponse.json({ error: "النادي غير محدد" }, { status: 400 });
    }

    const url = new URL(req.url);
    const periodParam = url.searchParams.get("period") || "month";

    // ─── حدود الفترة المختارة (wall-clock محلي للنادي — تواريخ منطقية) ───
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    if (periodParam === "today") {
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      periodEnd = endOfToday;
    } else if (periodParam === "week") {
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      periodEnd = endOfToday;
    } else if (periodParam === "lastmonth") {
      periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      periodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (periodParam === "year") {
      periodStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      periodEnd = endOfToday;
    } else if (periodParam === "custom") {
      const fromS = url.searchParams.get("from");
      const toS = url.searchParams.get("to");
      periodStart = fromS ? new Date(`${fromS}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = toS ? new Date(`${toS}T23:59:59.999`) : endOfToday;
    } else {
      // month (افتراضي)
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      periodEnd = endOfToday;
    }

    // ─── 1) الرصيد التاريخي من الدفتر مباشرة (aggregates = الحقيقة، لا الكاش) ───
    const [allIn, allOut, cache] = await Promise.all([
      db.financialTransaction.aggregate({
        where: { clubId: targetClubId, status: "active", type: "income" },
        _sum: { amount: true },
      }),
      db.financialTransaction.aggregate({
        where: { clubId: targetClubId, status: "active", type: "expense" },
        _sum: { amount: true },
      }),
      db.financialBalance.findUnique({ where: { clubId: targetClubId } }),
    ]);
    const ledgerTotalIncome = allIn._sum.amount || 0;
    const ledgerTotalExpense = allOut._sum.amount || 0;
    const ledgerBalance = ledgerTotalIncome - ledgerTotalExpense;

    // فحص سلامة سريع مدمج (المرحلة 31): مطابقة الكاش مع الدفتر
    const integrity = {
      cachedBalance: cache?.balance ?? 0,
      ledgerBalance,
      matches: (cache?.balance ?? 0) === ledgerBalance,
      diff: ledgerBalance - (cache?.balance ?? 0),
    };

    // ─── 2) الفترة: افتتاحي / داخل / خارج / ختامي (المرحلة 14) ───
    const [
      beforeIn, beforeOut, periodIn, periodOut,
    ] = await Promise.all([
      db.financialTransaction.aggregate({ where: { clubId: targetClubId, status: "active", type: "income", date: { lt: periodStart } }, _sum: { amount: true } }),
      db.financialTransaction.aggregate({ where: { clubId: targetClubId, status: "active", type: "expense", date: { lt: periodStart } }, _sum: { amount: true } }),
      db.financialTransaction.aggregate({ where: { clubId: targetClubId, status: "active", type: "income", date: { gte: periodStart, lte: periodEnd } }, _sum: { amount: true }, _count: true }),
      db.financialTransaction.aggregate({ where: { clubId: targetClubId, status: "active", type: "expense", date: { gte: periodStart, lte: periodEnd } }, _sum: { amount: true }, _count: true }),
    ]);
    const openingBalance = (beforeIn._sum.amount || 0) - (beforeOut._sum.amount || 0);
    const periodIncomeSum = periodIn._sum.amount || 0;
    const periodExpenseSum = periodOut._sum.amount || 0;
    const periodCount = (periodIn._count || 0) + (periodOut._count || 0);

    // أكبر عملية داخل الفترة
    const [largestExpenseRow, largestIncomeRow] = await Promise.all([
      db.financialTransaction.findFirst({
        where: { clubId: targetClubId, status: "active", type: "expense", date: { gte: periodStart, lte: periodEnd } },
        orderBy: { amount: "desc" },
        select: { id: true, seq: true, category: true, amount: true, date: true, payeeName: true },
      }),
      db.financialTransaction.findFirst({
        where: { clubId: targetClubId, status: "active", type: "income", date: { gte: periodStart, lte: periodEnd } },
        orderBy: { amount: "desc" },
        select: { id: true, seq: true, category: true, amount: true, date: true, payeeName: true },
      }),
    ]);

    // ─── 3) الفئات في الفترة المختارة من الدفتر (groupBy — لا JSON كاش) ───
    const [periodIncByCat, periodExpByCat, monthIncByCat, monthExpByCat] = await Promise.all([
      db.financialTransaction.groupBy({
        by: ["category"],
        where: { clubId: targetClubId, status: "active", type: "income", date: { gte: periodStart, lte: periodEnd } },
        _sum: { amount: true },
        _count: true,
      }),
      db.financialTransaction.groupBy({
        by: ["category"],
        where: { clubId: targetClubId, status: "active", type: "expense", date: { gte: periodStart, lte: periodEnd } },
        _sum: { amount: true },
        _count: true,
      }),
      db.financialTransaction.groupBy({
        by: ["category"],
        where: { clubId: targetClubId, status: "active", type: "income", date: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } },
        _sum: { amount: true },
      }),
      db.financialTransaction.groupBy({
        by: ["category"],
        where: { clubId: targetClubId, status: "active", type: "expense", date: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } },
        _sum: { amount: true },
      }),
    ]);
    const toMapCount = (rows: Array<{ category: string; _sum: { amount: number | null }; _count: number }>) => {
      const m: Record<string, { amount: number; count: number }> = {};
      for (const g of rows) m[g.category] = { amount: g._sum.amount || 0, count: g._count };
      return m;
    };
    const periodIncomeByCategory = toMapCount(periodIncByCat);
    const periodExpenseByCategory = toMapCount(periodExpByCat);
    const monthIncomeByCategory: Record<string, number> = {};
    for (const g of monthIncByCat) monthIncomeByCategory[g.category] = g._sum.amount || 0;
    const monthExpenseByCategory: Record<string, number> = {};
    for (const g of monthExpByCat) monthExpenseByCategory[g.category] = g._sum.amount || 0;

    // ─── 4) المستحقات للنادي Receivables (من حالات الاشتراك — ليست إيراداً — المرحلة 16A) ───
    const [subsForRecv, dbTypes, allWh, allEmployees, rateSetting] = await Promise.all([
      db.subscriber.findMany({
        where: { clubId: targetClubId, deletedAt: null },
        select: { id: true, birthDate: true, gender: true, subscriptionType: true, paymentStatus: true },
      }),
      db.subscriptionType.findMany({ where: { clubId: targetClubId, active: true } }),
      db.workHours.findMany({
        where: { clubId: targetClubId, status: "approved" },
        select: { userId: true, startTime: true, endTime: true, note: true },
      }),
      db.employee.findMany({ where: { clubId: targetClubId, userId: { not: null } }, select: { userId: true, hourRate: true } }),
      db.setting.findFirst({ where: { clubId: targetClubId, key: "workHourRate" }, select: { value: true } }),
    ]);
    const typesMap: Record<string, SubscriptionTypeConfig> = {};
    for (const t of dbTypes) {
      typesMap[t.code] = {
        code: t.code, name: t.name,
        subscriptionFee: t.subscriptionFee, insuranceFee: t.insuranceFee,
        compoundRights: t.compoundRights, durationDays: t.durationDays,
        givesMembershipNumber: t.givesMembershipNumber, requiresInsurance: t.requiresInsurance,
        requiresCompoundFee: t.requiresCompoundFee, renewableMonthly: t.renewableMonthly,
        freeSubscription: t.freeSubscription,
      };
    }
    const receivables = { subscription: 0, insurance: 0, compound: 0, total: 0 };
    for (const s of subsForRecv) {
      if (isExemptStatus(s.paymentStatus)) continue; // المعفى خارج كل الحساب
      const cfg = typesMap[s.subscriptionType as string];
      const f = cfg
        ? computeSubscriberFieldsDynamic(s as any, cfg)
        : { subscriptionFee: 0, insuranceFee: 0, compoundRights: 0 };
      if (s.paymentStatus === "لم يدفع") {
        receivables.subscription += f.subscriptionFee ?? 0;
        receivables.insurance += f.insuranceFee ?? 0;
        receivables.compound += f.compoundRights ?? 0;
      } else if (s.paymentStatus === "تأمين فقط") {
        receivables.subscription += f.subscriptionFee ?? 0;
        receivables.compound += f.compoundRights ?? 0;
      } else if (s.paymentStatus === "اشتراك 300") {
        // يدفع اشتراكاً مخففاً 300 — الباقي من رسوم النوع مستحق إن وجد
        const subFee = f.subscriptionFee ?? 0;
        receivables.subscription += Math.max(0, subFee - 300);
        receivables.compound += f.compoundRights ?? 0;
      }
      // مدفوع → صفر مستحقات
    }
    receivables.total = receivables.subscription + receivables.insurance + receivables.compound;

    // ─── 5) التزامات النادي Payables: أجور مستحقة (المرحلة 16B) ───
    const rateMap = new Map(allEmployees.map((e) => [e.userId as string, e.hourRate]));
    const defaultRate = parseInt(rateSetting?.value || "200") || 200;
    let wagesGross = 0;
    for (const r of allWh) {
      let breakMinutes = 0, workStatus = "present";
      try {
        if (r.note && r.note.startsWith("{")) {
          const meta = JSON.parse(r.note);
          breakMinutes = meta.breakMinutes || 0;
          workStatus = meta.workStatus || "present";
        }
      } catch {}
      if (workStatus !== "present" && workStatus !== "half-day") continue;
      const h = Math.max(0, (new Date(r.endTime).getTime() - new Date(r.startTime).getTime()) / 3600000 - breakMinutes / 60);
      wagesGross += h * (rateMap.get(r.userId) || defaultRate);
    }
    wagesGross = Math.round(wagesGross);
    const wagesPaid = (cache ? safeParse(cache.expenseByCategory).wages : 0) || 0;
    const wagesRemaining = Math.max(0, wagesGross - wagesPaid);

    const dues = {
      insurance: {
        label: "التأمين",
        collected: safeParse(cache?.incomeByCategory).insurance || 0,
        paid: safeParse(cache?.expenseByCategory).insurance || 0,
        remaining: Math.max(0, (safeParse(cache?.incomeByCategory).insurance || 0) - (safeParse(cache?.expenseByCategory).insurance || 0)),
      },
      compound: {
        label: "حقوق المركب",
        collected: safeParse(cache?.incomeByCategory).compound || 0,
        paid: safeParse(cache?.expenseByCategory).compound_rights || 0,
        remaining: Math.max(0, (safeParse(cache?.incomeByCategory).compound || 0) - (safeParse(cache?.expenseByCategory).compound_rights || 0)),
      },
      wages: {
        label: "أجور العمال",
        collected: wagesGross,
        paid: wagesPaid,
        remaining: wagesRemaining,
      },
      officeSupplies: {
        label: "الأدوات المكتبية",
        collected: safeParse(cache?.expenseByCategory).office_supplies || 0,
        paid: safeParse(cache?.expenseByCategory).office_supplies || 0,
        remaining: 0,
      },
      otherDebt: {
        label: "ديون أخرى",
        collected: safeParse(cache?.expenseByCategory).other_expense || 0,
        paid: safeParse(cache?.expenseByCategory).other_expense || 0,
        remaining: 0,
      },
    };
    const duesTotalRemaining = dues.insurance.remaining + dues.compound.remaining + dues.wages.remaining;

    const payables = {
      wages: wagesRemaining,
      total: wagesRemaining,
    };
    const realAvailable = ledgerBalance - payables.total;

    // ─── 6) المقارنة الشهرية + طرق الدفع + الحركات + chartData ───
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [thisMonthIncomeAgg, thisMonthExpenseAgg, lastMonthIncomeAgg, lastMonthExpenseAgg, monthMethods, movementsThisMonth] = await Promise.all([
      db.financialTransaction.aggregate({ where: { clubId: targetClubId, status: "active", type: "income", date: { gte: thisMonthStart } }, _sum: { amount: true } }),
      db.financialTransaction.aggregate({ where: { clubId: targetClubId, status: "active", type: "expense", date: { gte: thisMonthStart } }, _sum: { amount: true } }),
      db.financialTransaction.aggregate({ where: { clubId: targetClubId, status: "active", type: "income", date: { gte: lastMonthStart, lte: lastMonthEnd } }, _sum: { amount: true } }),
      db.financialTransaction.aggregate({ where: { clubId: targetClubId, status: "active", type: "expense", date: { gte: lastMonthStart, lte: lastMonthEnd } }, _sum: { amount: true } }),
      db.financialTransaction.groupBy({
        by: ["paymentMethod"],
        where: { clubId: targetClubId, status: "active", date: { gte: periodStart, lte: periodEnd } },
        _sum: { amount: true },
        _count: true,
      }),
      db.financialTransaction.count({ where: { clubId: targetClubId, status: "active", date: { gte: thisMonthStart } } }),
    ]);

    const thisMonthIncome = thisMonthIncomeAgg._sum.amount || 0;
    const thisMonthExpense = thisMonthExpenseAgg._sum.amount || 0;
    const lastMonthIncome = lastMonthIncomeAgg._sum.amount || 0;
    const lastMonthExpense = lastMonthExpenseAgg._sum.amount || 0;
    const incomeChangePct = lastMonthIncome > 0 ? ((thisMonthIncome - lastMonthIncome) / lastMonthIncome) * 100 : 0;
    const expenseChangePct = lastMonthExpense > 0 ? ((thisMonthExpense - lastMonthExpense) / lastMonthExpense) * 100 : 0;

    const paymentMethods = monthMethods.map((m) => ({
      method: m.paymentMethod,
      amount: m._sum.amount || 0,
      count: m._count,
    }));

    // 6-month chart (نشط فقط)
    const chartData: { month: string; income: number; expense: number }[] = [];
    const monthNames = ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      const [incAgg, expAgg] = await Promise.all([
        db.financialTransaction.aggregate({ where: { clubId: targetClubId, status: "active", type: "income", date: { gte: mStart, lte: mEnd } }, _sum: { amount: true } }),
        db.financialTransaction.aggregate({ where: { clubId: targetClubId, status: "active", type: "expense", date: { gte: mStart, lte: mEnd } }, _sum: { amount: true } }),
      ]);
      chartData.push({
        month: `${monthNames[mStart.getMonth()]} ${mStart.getFullYear()}`,
        income: incAgg._sum.amount || 0,
        expense: expAgg._sum.amount || 0,
      });
    }

    // ─── 7) آخر القيود + أكبر المصاريف/المداخيل ───
    const [lastTransactions, topExpenses, topIncome, cancelledAgg] = await Promise.all([
      db.financialTransaction.findMany({
        where: { clubId: targetClubId, status: "active" },
        orderBy: { date: "desc" },
        take: 10,
        select: { id: true, seq: true, type: true, category: true, amount: true, date: true, payeeName: true, paymentMethod: true, reference: true },
      }),
      db.financialTransaction.findMany({
        where: { clubId: targetClubId, status: "active", type: "expense" },
        orderBy: { amount: "desc" },
        take: 5,
        select: { id: true, seq: true, category: true, amount: true, date: true, payeeName: true, note: true },
      }),
      db.financialTransaction.findMany({
        where: { clubId: targetClubId, status: "active", type: "income" },
        orderBy: { amount: "desc" },
        take: 5,
        select: { id: true, seq: true, category: true, amount: true, date: true, payeeName: true, note: true },
      }),
      db.financialTransaction.aggregate({ where: { clubId: targetClubId, status: "cancelled" }, _sum: { amount: true }, _count: true }),
    ]);

    // ─── 8) مداخيل الفترات السريعة (توافق مع الواجهات الحالية) ───
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const [todayAgg, weekAgg, monthAgg, yearAgg] = await Promise.all([
      db.financialTransaction.aggregate({ where: { clubId: targetClubId, status: "active", type: "income", date: { gte: todayStart } }, _sum: { amount: true } }),
      db.financialTransaction.aggregate({ where: { clubId: targetClubId, status: "active", type: "income", date: { gte: weekStart } }, _sum: { amount: true } }),
      db.financialTransaction.aggregate({ where: { clubId: targetClubId, status: "active", type: "income", date: { gte: thisMonthStart } }, _sum: { amount: true } }),
      db.financialTransaction.aggregate({ where: { clubId: targetClubId, status: "active", type: "income", date: { gte: yearStart } }, _sum: { amount: true } }),
    ]);

    // ─── 9) كشف الحساب اليومي ?day=YYYY-MM-DD ───
    const dayParam = url.searchParams.get("day");
    let dayStatement: {
      date: string; openingBalance: number; dayIncome: number; dayExpense: number;
      closingBalance: number;
      transactions: Array<{ id: string; seq: number | null; type: string; category: string; amount: number; date: Date; payeeName: string | null; paymentMethod: string; reference: string | null; note: string | null }>;
    } | null = null;
    if (dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam)) {
      const dStart = new Date(`${dayParam}T00:00:00`);
      const dEnd = new Date(`${dayParam}T23:59:59.999`);
      const [bIn, bOut, inAgg, outAgg, dayTx] = await Promise.all([
        db.financialTransaction.aggregate({ where: { clubId: targetClubId, status: "active", type: "income", date: { lt: dStart } }, _sum: { amount: true } }),
        db.financialTransaction.aggregate({ where: { clubId: targetClubId, status: "active", type: "expense", date: { lt: dStart } }, _sum: { amount: true } }),
        db.financialTransaction.aggregate({ where: { clubId: targetClubId, status: "active", type: "income", date: { gte: dStart, lte: dEnd } }, _sum: { amount: true } }),
        db.financialTransaction.aggregate({ where: { clubId: targetClubId, status: "active", type: "expense", date: { gte: dStart, lte: dEnd } }, _sum: { amount: true } }),
        db.financialTransaction.findMany({
          where: { clubId: targetClubId, status: "active", date: { gte: dStart, lte: dEnd } },
          orderBy: { date: "asc" },
          take: 200,
          select: { id: true, seq: true, type: true, category: true, amount: true, date: true, payeeName: true, paymentMethod: true, reference: true, note: true },
        }),
      ]);
      const dayOpening = (bIn._sum.amount || 0) - (bOut._sum.amount || 0);
      const dayIncome = inAgg._sum.amount || 0;
      const dayExpense = outAgg._sum.amount || 0;
      dayStatement = {
        date: dayParam,
        openingBalance: dayOpening,
        dayIncome,
        dayExpense,
        closingBalance: dayOpening + dayIncome - dayExpense,
        transactions: dayTx,
      };
    }

    return NextResponse.json({
      // التوافق مع الواجهات الحالية
      balance: {
        totalIncome: ledgerTotalIncome,
        totalExpense: ledgerTotalExpense,
        balance: ledgerBalance,
        incomeByCategory: safeParse(cache?.incomeByCategory),
        expenseByCategory: safeParse(cache?.expenseByCategory),
      },
      lastTransactions: lastTransactions.map((t) => ({ ...t, number: financialNumber(t.seq, t.date) })),
      monthlyComparison: {
        thisMonthIncome,
        lastMonthIncome,
        thisMonthExpense,
        lastMonthExpense,
        incomeChangePct: Math.round(incomeChangePct * 10) / 10,
        expenseChangePct: Math.round(expenseChangePct * 10) / 10,
        netThisMonth: thisMonthIncome - thisMonthExpense,
      },
      topExpenses: topExpenses.map((t) => ({ ...t, number: financialNumber(t.seq, t.date) })),
      topIncome: topIncome.map((t) => ({ ...t, number: financialNumber(t.seq, t.date) })),
      periodIncome: { today: todayAgg._sum.amount || 0, week: weekAgg._sum.amount || 0, month: monthAgg._sum.amount || 0, year: yearAgg._sum.amount || 0 },
      chartData,
      monthIncomeByCategory,
      monthExpenseByCategory,
      paymentMethods,
      movementsThisMonth,
      dues,
      duesTotalRemaining,
      cancelled: { total: cancelledAgg._sum.amount || 0, count: cancelledAgg._count || 0 },
      dayStatement,

      // ★ الجديد (المراحل 14/15/16/19/30)
      periodKey: periodParam,
      periodRange: {
        from: periodStart.toISOString(),
        to: periodEnd.toISOString(),
      },
      period: {
        openingBalance,
        income: periodIncomeSum,
        expense: periodExpenseSum,
        net: periodIncomeSum - periodExpenseSum,
        closingBalance: openingBalance + periodIncomeSum - periodExpenseSum,
        count: periodCount,
        avgAmount: periodCount > 0 ? Math.round((periodIncomeSum + periodExpenseSum) / periodCount) : 0,
        largestExpense: largestExpenseRow ? { ...largestExpenseRow, number: financialNumber(largestExpenseRow.seq, largestExpenseRow.date) } : null,
        largestIncome: largestIncomeRow ? { ...largestIncomeRow, number: financialNumber(largestIncomeRow.seq, largestIncomeRow.date) } : null,
        incomeByCategory: periodIncomeByCategory,
        expenseByCategory: periodExpenseByCategory,
      },
      receivables,
      payables,
      realAvailable,
      integrity,
    });
  } catch (error) {
    console.error("GET /api/financial/dashboard error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

function safeParse(str: string | null | undefined): Record<string, number> {
  if (!str) return {};
  try { return JSON.parse(str) || {}; } catch { return {}; }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/session";

/**
 * GET /api/financial/dashboard
 * Returns comprehensive financial statistics for the dashboard:
 * - totalIncome, totalExpense, balance
 * - incomeByCategory, expenseByCategory
 * - last 10 transactions
 * - this month vs last month (income + expense + % change)
 * - top 5 largest expenses
 * - today/week/month/year income
 * - 6-month income vs expense chart data
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasPermission(currentUser.role, "financialDashboard")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    if (!currentUser.clubId && currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "النادي غير محدد" }, { status: 400 });
    }

    // For superadmin without club, return empty
    const targetClubId = currentUser.role === "superadmin" ? null : currentUser.clubId;
    if (!targetClubId) {
      return NextResponse.json({
        balance: { totalIncome: 0, totalExpense: 0, balance: 0, incomeByCategory: {}, expenseByCategory: {} },
        lastTransactions: [],
        monthlyComparison: { thisMonthIncome: 0, lastMonthIncome: 0, thisMonthExpense: 0, lastMonthExpense: 0 },
        topExpenses: [],
        periodIncome: { today: 0, week: 0, month: 0, year: 0 },
        chartData: [],
        monthIncomeByCategory: {},
        monthExpenseByCategory: {},
        paymentMethods: [],
        movementsThisMonth: 0,
      });
    }

    // 1) Balance (cached)
    const balance = await db.financialBalance.findUnique({
      where: { clubId: targetClubId },
    }) || { totalIncome: 0, totalExpense: 0, balance: 0, incomeByCategory: "{}", expenseByCategory: "{}" };

    // 2) Last 10 transactions
    const lastTransactions = await db.financialTransaction.findMany({
      where: { clubId: targetClubId },
      orderBy: { date: "desc" },
      take: 10,
      select: {
        id: true, type: true, category: true, amount: true, date: true,
        payeeName: true, paymentMethod: true, reference: true,
      },
    });

    // 3) Monthly comparison
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [thisMonthIncomeAgg, thisMonthExpenseAgg, lastMonthIncomeAgg, lastMonthExpenseAgg] = await Promise.all([
      db.financialTransaction.aggregate({
        where: { clubId: targetClubId, type: "income", date: { gte: thisMonthStart } },
        _sum: { amount: true },
      }),
      db.financialTransaction.aggregate({
        where: { clubId: targetClubId, type: "expense", date: { gte: thisMonthStart } },
        _sum: { amount: true },
      }),
      db.financialTransaction.aggregate({
        where: { clubId: targetClubId, type: "income", date: { gte: lastMonthStart, lte: lastMonthEnd } },
        _sum: { amount: true },
      }),
      db.financialTransaction.aggregate({
        where: { clubId: targetClubId, type: "expense", date: { gte: lastMonthStart, lte: lastMonthEnd } },
        _sum: { amount: true },
      }),
    ]);

    const thisMonthIncome = thisMonthIncomeAgg._sum.amount || 0;
    const thisMonthExpense = thisMonthExpenseAgg._sum.amount || 0;
    const lastMonthIncome = lastMonthIncomeAgg._sum.amount || 0;
    const lastMonthExpense = lastMonthExpenseAgg._sum.amount || 0;

    const incomeChangePct = lastMonthIncome > 0 ? ((thisMonthIncome - lastMonthIncome) / lastMonthIncome) * 100 : 0;
    const expenseChangePct = lastMonthExpense > 0 ? ((thisMonthExpense - lastMonthExpense) / lastMonthExpense) * 100 : 0;

    // 4) Top 5 largest expenses
    const topExpenses = await db.financialTransaction.findMany({
      where: { clubId: targetClubId, type: "expense" },
      orderBy: { amount: "desc" },
      take: 5,
      select: { id: true, category: true, amount: true, date: true, payeeName: true, note: true },
    });

    // 5) Period income (today/week/month/year)
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [todayAgg, weekAgg, monthAgg, yearAgg] = await Promise.all([
      db.financialTransaction.aggregate({
        where: { clubId: targetClubId, type: "income", date: { gte: todayStart } },
        _sum: { amount: true },
      }),
      db.financialTransaction.aggregate({
        where: { clubId: targetClubId, type: "income", date: { gte: weekStart } },
        _sum: { amount: true },
      }),
      db.financialTransaction.aggregate({
        where: { clubId: targetClubId, type: "income", date: { gte: thisMonthStart } },
        _sum: { amount: true },
      }),
      db.financialTransaction.aggregate({
        where: { clubId: targetClubId, type: "income", date: { gte: yearStart } },
        _sum: { amount: true },
      }),
    ]);

    // 6) 6-month chart data (income vs expense per month)
    const chartData: { month: string; income: number; expense: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      const monthNames = ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

      const [incAgg, expAgg] = await Promise.all([
        db.financialTransaction.aggregate({
          where: { clubId: targetClubId, type: "income", date: { gte: mStart, lte: mEnd } },
          _sum: { amount: true },
        }),
        db.financialTransaction.aggregate({
          where: { clubId: targetClubId, type: "expense", date: { gte: mStart, lte: mEnd } },
          _sum: { amount: true },
        }),
      ]);

      chartData.push({
        month: `${monthNames[mStart.getMonth()]} ${mStart.getFullYear()}`,
        income: incAgg._sum.amount || 0,
        expense: expAgg._sum.amount || 0,
      });
    }

    // 7) تفصيل الشهر الحالي حسب الفئة + طرق الدفع + عدد الحركات
    //    (يغذي بطاقات الدورة المالية الذكية في المركز المالي)
    const [monthIncByCat, monthExpByCat, monthMethods, movementsThisMonth] = await Promise.all([
      db.financialTransaction.groupBy({
        by: ["category"],
        where: { clubId: targetClubId, type: "income", date: { gte: thisMonthStart } },
        _sum: { amount: true },
      }),
      db.financialTransaction.groupBy({
        by: ["category"],
        where: { clubId: targetClubId, type: "expense", date: { gte: thisMonthStart } },
        _sum: { amount: true },
      }),
      db.financialTransaction.groupBy({
        by: ["paymentMethod"],
        where: { clubId: targetClubId, date: { gte: thisMonthStart } },
        _sum: { amount: true },
        _count: true,
      }),
      db.financialTransaction.count({
        where: { clubId: targetClubId, date: { gte: thisMonthStart } },
      }),
    ]);

    const monthIncomeByCategory: Record<string, number> = {};
    for (const g of monthIncByCat) monthIncomeByCategory[g.category] = g._sum.amount || 0;
    const monthExpenseByCategory: Record<string, number> = {};
    for (const g of monthExpByCat) monthExpenseByCategory[g.category] = g._sum.amount || 0;
    const paymentMethods = monthMethods.map((m) => ({
      method: m.paymentMethod,
      amount: m._sum.amount || 0,
      count: m._count,
    }));

    // ═══ 8) المستحقات (Dues) — من الدفتر نفسه (مصدر واحد للحقيقة) + أجور من Pointage ═══
    const allIncome = safeParse(balance.incomeByCategory);
    const allExpense = safeParse(balance.expenseByCategory);

    // إجمالي أجور العمال المستحقة تاريخياً (ساعات معتمدة × سعر الساعة لكل عامل)
    const [allWh, allEmployees, rateSetting] = await Promise.all([
      db.workHours.findMany({
        where: { clubId: targetClubId, status: "approved" },
        select: { userId: true, startTime: true, endTime: true, note: true },
      }),
      db.employee.findMany({ where: { clubId: targetClubId, userId: { not: null } }, select: { userId: true, hourRate: true } }),
      db.setting.findFirst({ where: { clubId: targetClubId, key: "workHourRate" }, select: { value: true } }),
    ]);
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

    const dues = {
      insurance: {
        label: "التأمين",
        collected: allIncome.insurance || 0,
        paid: allExpense.insurance || 0,
        remaining: Math.max(0, (allIncome.insurance || 0) - (allExpense.insurance || 0)),
      },
      compound: {
        label: "حقوق المركب",
        collected: allIncome.compound || 0,
        paid: allExpense.compound_rights || 0,
        remaining: Math.max(0, (allIncome.compound || 0) - (allExpense.compound_rights || 0)),
      },
      wages: {
        label: "أجور العمال",
        collected: wagesGross,
        paid: allExpense.wages || 0,
        remaining: Math.max(0, wagesGross - (allExpense.wages || 0)),
      },
      officeSupplies: {
        label: "الأدوات المكتبية",
        collected: allExpense.office_supplies || 0,
        paid: allExpense.office_supplies || 0,
        remaining: 0,
      },
      otherDebt: {
        label: "ديون أخرى",
        collected: allExpense.other_expense || 0,
        paid: allExpense.other_expense || 0,
        remaining: 0,
      },
    };
    dues.wages.remaining = Math.max(0, wagesGross - dues.wages.paid);
    const duesTotalRemaining = dues.insurance.remaining + dues.compound.remaining + dues.wages.remaining;

    return NextResponse.json({
      balance: {
        totalIncome: balance.totalIncome,
        totalExpense: balance.totalExpense,
        balance: balance.balance,
        incomeByCategory: safeParse(balance.incomeByCategory),
        expenseByCategory: safeParse(balance.expenseByCategory),
      },
      lastTransactions,
      monthlyComparison: {
        thisMonthIncome,
        lastMonthIncome,
        thisMonthExpense,
        lastMonthExpense,
        incomeChangePct: Math.round(incomeChangePct * 10) / 10,
        expenseChangePct: Math.round(expenseChangePct * 10) / 10,
        netThisMonth: thisMonthIncome - thisMonthExpense,
      },
      topExpenses,
      periodIncome: {
        today: todayAgg._sum.amount || 0,
        week: weekAgg._sum.amount || 0,
        month: monthAgg._sum.amount || 0,
        year: yearAgg._sum.amount || 0,
      },
      chartData,
      monthIncomeByCategory,
      monthExpenseByCategory,
      paymentMethods,
      movementsThisMonth,
      dues,
      duesTotalRemaining,
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

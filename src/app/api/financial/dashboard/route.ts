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

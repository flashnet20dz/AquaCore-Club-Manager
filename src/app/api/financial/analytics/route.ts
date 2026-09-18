import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/session";
import { ensureRuntimeColumns } from "@/lib/runtime-schema";
import { financialNumber } from "@/lib/financial-posting";
import { CATEGORY_LABELS } from "@/components/financial/labels";

/**
 * GET /api/financial/analytics
 * ═════════════════════════════════════════════════════════════
 * التحليل المالي التفصيلي لمصادر المداخيل والمصاريف (المراحل 4/5/6/14)
 * 100% مبني على دفتر FinancialTransaction (النشط فقط)
 * مجموع الفئات يطابق الإجمالي تماماً بلا أي تقدير أو نسبة افتراضية.
 *
 * Parameters:
 *   period: "all" | "today" | "week" | "month" | "year" | "custom"
 *   from: YYYY-MM-DD
 *   to: YYYY-MM-DD
 *   category: optional (لتفصيل صنف محدد وعرض عملياته الفردية)
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
    const periodParam = url.searchParams.get("period") || "all";
    const selectedCategory = url.searchParams.get("category");

    // نطاق التاريخ
    const now = new Date();
    let dateFilter: { gte?: Date; lte?: Date } | undefined;
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (periodParam === "today") {
      dateFilter = {
        gte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
        lte: endOfToday,
      };
    } else if (periodParam === "week") {
      dateFilter = {
        gte: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0),
        lte: endOfToday,
      };
    } else if (periodParam === "month") {
      dateFilter = {
        gte: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
        lte: endOfToday,
      };
    } else if (periodParam === "year") {
      dateFilter = {
        gte: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0),
        lte: endOfToday,
      };
    } else if (periodParam === "custom") {
      const fromS = url.searchParams.get("from");
      const toS = url.searchParams.get("to");
      const start = fromS ? new Date(`${fromS}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
      const end = toS ? new Date(`${toS}T23:59:59.999`) : endOfToday;
      dateFilter = { gte: start, lte: end };
    }

    const baseWhere: Record<string, unknown> = {
      clubId: targetClubId,
      status: "active",
      ...(dateFilter ? { date: dateFilter } : {}),
    };

    // ─── 1) الإجماليات الحقيقية من الدفتر ───
    const [totalInAgg, totalOutAgg] = await Promise.all([
      db.financialTransaction.aggregate({
        where: { ...baseWhere, type: "income" },
        _sum: { amount: true },
        _count: true,
      }),
      db.financialTransaction.aggregate({
        where: { ...baseWhere, type: "expense" },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const totalIncome = totalInAgg._sum.amount || 0;
    const totalExpense = totalOutAgg._sum.amount || 0;
    const netCash = totalIncome - totalExpense;

    // ─── 2) تجميع المداخيل حسب الصنف ───
    const incomeGroups = await db.financialTransaction.groupBy({
      by: ["category"],
      where: { ...baseWhere, type: "income" },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: "desc" } },
    });

    // ─── 3) تجميع المصاريف حسب الصنف ───
    const expenseGroups = await db.financialTransaction.groupBy({
      by: ["category"],
      where: { ...baseWhere, type: "expense" },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: "desc" } },
    });

    // تفاصيل طرق الدفع لكل صنف في المداخيل والمصاريف
    const [incomeMethods, expenseMethods] = await Promise.all([
      db.financialTransaction.groupBy({
        by: ["category", "paymentMethod"],
        where: { ...baseWhere, type: "income" },
        _sum: { amount: true },
        _count: true,
      }),
      db.financialTransaction.groupBy({
        by: ["category", "paymentMethod"],
        where: { ...baseWhere, type: "expense" },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const incomeMethodsMap: Record<string, Array<{ method: string; amount: number; count: number }>> = {};
    for (const row of incomeMethods) {
      if (!incomeMethodsMap[row.category]) incomeMethodsMap[row.category] = [];
      incomeMethodsMap[row.category].push({
        method: row.paymentMethod,
        amount: row._sum.amount || 0,
        count: row._count,
      });
    }

    const expenseMethodsMap: Record<string, Array<{ method: string; amount: number; count: number }>> = {};
    for (const row of expenseMethods) {
      if (!expenseMethodsMap[row.category]) expenseMethodsMap[row.category] = [];
      expenseMethodsMap[row.category].push({
        method: row.paymentMethod,
        amount: row._sum.amount || 0,
        count: row._count,
      });
    }

    const incomeCategories = incomeGroups.map((g) => {
      const amount = g._sum.amount || 0;
      const percentage = totalIncome > 0 ? Math.round((amount / totalIncome) * 1000) / 10 : 0;
      return {
        key: g.category,
        label: CATEGORY_LABELS[g.category] || g.category,
        amount,
        count: g._count,
        percentage,
        methods: incomeMethodsMap[g.category] || [],
      };
    });

    const expenseCategories = expenseGroups.map((g) => {
      const amount = g._sum.amount || 0;
      const percentage = totalExpense > 0 ? Math.round((amount / totalExpense) * 1000) / 10 : 0;
      return {
        key: g.category,
        label: CATEGORY_LABELS[g.category] || g.category,
        amount,
        count: g._count,
        percentage,
        methods: expenseMethodsMap[g.category] || [],
      };
    });

    // ─── 4) في حال طلب صنف محدد للـ Drill-Down ───
    let categoryDetails: any = null;
    if (selectedCategory) {
      const transactions = await db.financialTransaction.findMany({
        where: { ...baseWhere, category: selectedCategory },
        orderBy: { date: "desc" },
        take: 300,
        select: {
          id: true,
          seq: true,
          type: true,
          category: true,
          amount: true,
          date: true,
          payeeName: true,
          paymentMethod: true,
          reference: true,
          note: true,
          subscriberId: true,
        },
      });

      // جلب بيانات المنخرطين المرتبطين (رقم الملف ونوع الاشتراك)
      const subIds = transactions.map((t) => t.subscriberId).filter((v): v is string => Boolean(v));
      const subscribers = subIds.length > 0
        ? await db.subscriber.findMany({
            where: { id: { in: subIds } },
            select: { id: true, fileNumber: true, subscriptionType: true, phone: true },
          })
        : [];
      const subMap = new Map(subscribers.map((s) => [s.id, s]));

      // تحليل العمليات حسب نوع الاشتراك
      const bySubType: Record<string, { count: number; amount: number }> = {};
      for (const t of transactions) {
        const sub = t.subscriberId ? subMap.get(t.subscriberId) : null;
        const subTypeCode = sub?.subscriptionType || "عام / غير محدد";
        if (!bySubType[subTypeCode]) bySubType[subTypeCode] = { count: 0, amount: 0 };
        bySubType[subTypeCode].count++;
        bySubType[subTypeCode].amount += t.amount;
      }

      categoryDetails = {
        category: selectedCategory,
        label: CATEGORY_LABELS[selectedCategory] || selectedCategory,
        totalAmount: transactions.reduce((acc, t) => acc + t.amount, 0),
        totalCount: transactions.length,
        bySubscriptionType: Object.entries(bySubType).map(([type, data]) => ({
          type,
          count: data.count,
          amount: data.amount,
        })),
        transactions: transactions.map((t) => ({
          ...t,
          number: financialNumber(t.seq, t.date),
          subscriberFileNumber: t.subscriberId ? subMap.get(t.subscriberId)?.fileNumber : null,
          subscriptionType: t.subscriberId ? subMap.get(t.subscriberId)?.subscriptionType : null,
        })),
      };
    }

    return NextResponse.json({
      period: periodParam,
      totalIncome,
      totalExpense,
      netCash,
      incomeTransactionsCount: totalInAgg._count || 0,
      expenseTransactionsCount: totalOutAgg._count || 0,
      incomeCategories,
      expenseCategories,
      categoryDetails,
    });
  } catch (error) {
    console.error("GET /api/financial/analytics error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

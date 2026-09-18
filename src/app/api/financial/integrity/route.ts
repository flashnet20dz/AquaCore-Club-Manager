import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/session";
import { recomputeBalanceTx, backfillSeqTx } from "@/lib/financial-posting";
import { ensureRuntimeColumns } from "@/lib/runtime-schema";

/**
 * GET /api/financial/integrity
 * فحص سلامة الحسابات (المرحلة 31): يقارن الملخص السريع FinancialBalance
 * مع الحقيقة في دفتر FinancialTransaction (النشط فقط):
 *   totalIncome / totalExpense / balance / خرائط الفئات
 * يعيد الرقمين والفرق لكل بند — «✓ متطابق» أو «⚠ يوجد فرق».
 */
export async function GET() {
  try {
    await ensureRuntimeColumns();
    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role, "financialDashboard")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const clubId = user.clubId;
    if (!clubId) return NextResponse.json({ error: "النادي غير محدد" }, { status: 400 });

    const check = await integrityCheck(clubId);
    return NextResponse.json(check);
  } catch (e) {
    console.error("GET /api/financial/integrity:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

/**
 * POST /api/financial/integrity
 * «مزامنة / إعادة بناء الرصيد» — للمدير فقط:
 * يعيد حساب FinancialBalance من الدفتر كاملاً + يرقّم القيود القديمة بلا seq (idempotent).
 */
export async function POST() {
  try {
    await ensureRuntimeColumns();
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح — إعادة البناء للمدير فقط" }, { status: 403 });
    }
    const clubId = user.clubId;
    if (!clubId) return NextResponse.json({ error: "النادي غير محدد" }, { status: 400 });

    const before = await integrityCheck(clubId);
    const result = await db.$transaction(async (tx) => {
      const seqBackfilled = await backfillSeqTx(tx, clubId);
      await recomputeBalanceTx(tx, clubId);
      return { seqBackfilled };
    });
    const after = await integrityCheck(clubId);

    await db.auditLog.create({
      data: {
        clubId,
        userId: user.id,
        action: "financial_balance_rebuild",
        entityType: "FinancialBalance",
        entityId: clubId,
        description: `إعادة بناء الرصيد من الدفتر — قبل: ${before.summary.balanceDiff !== 0 ? `فرق ${before.summary.balanceDiff}` : "مطابق"} → بعد: ${after.summary.matches ? "مطابق ✓" : "لا يزال هناك فرق"}`,
        metadata: JSON.stringify({ seqBackfilled: result.seqBackfilled, before: before.summary, after: after.summary }),
      },
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      seqBackfilled: result.seqBackfilled,
      before: before.summary,
      after,
      message: after.summary.matches ? "✓ تمت إعادة البناء — الحسابات متطابقة" : "⚠ أُعيد البناء — راجع الفروق المتبقية",
    });
  } catch (e) {
    console.error("POST /api/financial/integrity:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

/** المقارنة الكاملة بين الكاش والدفتر */
async function integrityCheck(clubId: string) {
  const [inAgg, outAgg, incByCat, expByCat, cache, unsequenced] = await Promise.all([
    db.financialTransaction.aggregate({ where: { clubId, status: "active", type: "income" }, _sum: { amount: true } }),
    db.financialTransaction.aggregate({ where: { clubId, status: "active", type: "expense" }, _sum: { amount: true } }),
    db.financialTransaction.groupBy({ by: ["category"], where: { clubId, status: "active", type: "income" }, _sum: { amount: true } }),
    db.financialTransaction.groupBy({ by: ["category"], where: { clubId, status: "active", type: "expense" }, _sum: { amount: true } }),
    db.financialBalance.findUnique({ where: { clubId } }),
    db.financialTransaction.count({ where: { clubId, seq: null } }),
  ]);

  const ledger = {
    totalIncome: inAgg._sum.amount || 0,
    totalExpense: outAgg._sum.amount || 0,
    balance: (inAgg._sum.amount || 0) - (outAgg._sum.amount || 0),
    incomeByCategory: Object.fromEntries(incByCat.map((g) => [g.category, g._sum.amount || 0])) as Record<string, number>,
    expenseByCategory: Object.fromEntries(expByCat.map((g) => [g.category, g._sum.amount || 0])) as Record<string, number>,
  };
  const cacheData = {
    totalIncome: cache?.totalIncome ?? 0,
    totalExpense: cache?.totalExpense ?? 0,
    balance: cache?.balance ?? 0,
    incomeByCategory: parseMap(cache?.incomeByCategory),
    expenseByCategory: parseMap(cache?.expenseByCategory),
  };

  const categoryDiffs: Array<{ type: string; category: string; cache: number; ledger: number; diff: number }> = [];
  for (const scope of ["incomeByCategory", "expenseByCategory"] as const) {
    const keys = new Set([...Object.keys(cacheData[scope]), ...Object.keys(ledger[scope])]);
    for (const k of keys) {
      const c = cacheData[scope][k] || 0;
      const l = ledger[scope][k] || 0;
      if (c !== l) categoryDiffs.push({ type: scope === "incomeByCategory" ? "income" : "expense", category: k, cache: c, ledger: l, diff: l - c });
    }
  }

  return {
    summary: {
      matches:
        cacheData.totalIncome === ledger.totalIncome &&
        cacheData.totalExpense === ledger.totalExpense &&
        cacheData.balance === ledger.balance &&
        categoryDiffs.length === 0,
      cacheBalance: cacheData.balance,
      ledgerBalance: ledger.balance,
      balanceDiff: ledger.balance - cacheData.balance,
      totalIncomeDiff: ledger.totalIncome - cacheData.totalIncome,
      totalExpenseDiff: ledger.totalExpense - cacheData.totalExpense,
      unsequencedCount: unsequenced,
      checkedAt: new Date().toISOString(),
    },
    cache: cacheData,
    ledger,
    categoryDiffs,
  };
}

function parseMap(str: string | null | undefined): Record<string, number> {
  if (!str) return {};
  try { return JSON.parse(str) || {}; } catch { return {}; }
}

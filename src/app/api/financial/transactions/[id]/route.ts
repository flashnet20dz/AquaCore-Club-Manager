import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/session";

/**
 * PUT /api/financial/transactions/[id]
 * Edit a transaction (accountant can only edit their own).
 * Recomputes balance.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasPermission(currentUser.role, "financialPayments")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const existing = await db.financialTransaction.findFirst({ where: { id, ...clubFilter } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // ★ Accountant can only edit their own transactions
    if (currentUser.role === "accountant" && existing.createdById !== currentUser.id) {
      return NextResponse.json({ error: "يمكنك تعديل العمليات التي سجّلتها أنت فقط" }, { status: 403 });
    }

    const body = await req.json();
    const oldAmount = existing.amount;
    const oldType = existing.type;
    const newAmount = body.amount != null ? Math.round(Number(body.amount)) : oldAmount;
    const newType = body.type || oldType;
    const newCategory = body.category || existing.category;

    if (newAmount <= 0) {
      return NextResponse.json({ error: "المبلغ يجب أن يكون أكبر من 0" }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      const updated = await tx.financialTransaction.update({
        where: { id },
        data: {
          type: newType,
          category: newCategory,
          subCategory: body.subCategory !== undefined ? (body.subCategory || null) : existing.subCategory,
          amount: newAmount,
          date: body.date ? new Date(body.date) : existing.date,
          paymentMethod: body.paymentMethod || existing.paymentMethod,
          payeeName: body.payeeName !== undefined ? (body.payeeName || null) : existing.payeeName,
          payeeId: body.payeeId !== undefined ? (body.payeeId || null) : existing.payeeId,
          reference: body.reference !== undefined ? (body.reference || null) : existing.reference,
          note: body.note !== undefined ? (body.note || null) : existing.note,
        },
      });

      // Recompute balance from scratch (safest approach)
      await recomputeBalance(tx, existing.clubId);

      return updated;
    });

    await db.activity.create({
      data: {
        clubId: existing.clubId,
        userId: currentUser.id,
        type: "financial_update",
        description: `تعديل عملية مالية: ${oldAmount.toLocaleString()} → ${newAmount.toLocaleString()} دج`,
      },
    }).catch(() => {});

    return NextResponse.json({ transaction: result });
  } catch (error) {
    console.error("PUT /api/financial/transactions/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * DELETE /api/financial/transactions/[id]
 * Delete a transaction (requires reason). Recomputes balance.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasPermission(currentUser.role, "financialPayments")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = body.reason;

    if (!reason || reason.trim().length < 3) {
      return NextResponse.json({ error: "سبب الحذف مطلوب (3 أحرف على الأقل)" }, { status: 400 });
    }

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const existing = await db.financialTransaction.findFirst({ where: { id, ...clubFilter } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (currentUser.role === "accountant" && existing.createdById !== currentUser.id) {
      return NextResponse.json({ error: "يمكنك حذف العمليات التي سجّلتها أنت فقط" }, { status: 403 });
    }

    await db.$transaction(async (tx) => {
      await tx.financialTransaction.delete({ where: { id } });
      await recomputeBalance(tx, existing.clubId);
    });

    await db.activity.create({
      data: {
        clubId: existing.clubId,
        userId: currentUser.id,
        type: "financial_delete",
        description: `حذف عملية مالية (${existing.type}/${existing.category}): ${existing.amount.toLocaleString()} دج — السبب: ${reason}`,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/financial/transactions/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * Recompute the FinancialBalance from all transactions.
 * Called after every PUT/DELETE to ensure consistency.
 */
async function recomputeBalance(tx: any, clubId: string) {
  const allTx = await tx.financialTransaction.findMany({
    where: { clubId },
    select: { type: true, category: true, amount: true },
  });

  let totalIncome = 0, totalExpense = 0;
  const incomeByCat: Record<string, number> = {};
  const expenseByCat: Record<string, number> = {};

  for (const t of allTx) {
    if (t.type === "income") {
      totalIncome += t.amount;
      incomeByCat[t.category] = (incomeByCat[t.category] || 0) + t.amount;
    } else {
      totalExpense += t.amount;
      expenseByCat[t.category] = (expenseByCat[t.category] || 0) + t.amount;
    }
  }

  await tx.financialBalance.upsert({
    where: { clubId },
    update: {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      incomeByCategory: JSON.stringify(incomeByCat),
      expenseByCategory: JSON.stringify(expenseByCat),
    },
    create: {
      clubId,
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      incomeByCategory: JSON.stringify(incomeByCat),
      expenseByCategory: JSON.stringify(expenseByCat),
    },
  });
}

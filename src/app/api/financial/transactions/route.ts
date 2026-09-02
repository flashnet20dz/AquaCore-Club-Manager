import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/session";

/**
 * GET /api/financial/transactions
 * Returns financial transactions with filters + period stats.
 *
 * Query params: type, category, dateFrom, dateTo, payeeName, paymentMethod, page, limit
 */
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasPermission(currentUser.role, "financialPayments")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "";
    const category = url.searchParams.get("category") || "";
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");
    const payeeName = url.searchParams.get("payeeName") || "";
    const paymentMethod = url.searchParams.get("paymentMethod") || "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "50")));
    const skip = (page - 1) * limit;

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const where: Record<string, unknown> = { ...clubFilter };
    if (type) where.type = type;
    if (category) where.category = category;
    if (paymentMethod) where.paymentMethod = paymentMethod;
    if (payeeName) where.payeeName = { contains: payeeName, mode: "insensitive" };

    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (dateFrom) {
        const d = new Date(dateFrom); d.setHours(0, 0, 0, 0); dateFilter.gte = d;
      }
      if (dateTo) {
        const d = new Date(dateTo); d.setHours(23, 59, 59, 999); dateFilter.lte = d;
      }
      where.date = dateFilter;
    }

    const [transactions, total] = await Promise.all([
      db.financialTransaction.findMany({
        where,
        orderBy: { date: "desc" },
        take: limit,
        skip,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      db.financialTransaction.count({ where }),
    ]);

    // Period stats
    const incomeSum = await db.financialTransaction.aggregate({
      where: { ...where, type: "income" },
      _sum: { amount: true },
    });
    const expenseSum = await db.financialTransaction.aggregate({
      where: { ...where, type: "expense" },
      _sum: { amount: true },
    });

    return NextResponse.json({
      transactions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: {
        totalIncome: incomeSum._sum.amount || 0,
        totalExpense: expenseSum._sum.amount || 0,
        balance: (incomeSum._sum.amount || 0) - (expenseSum._sum.amount || 0),
      },
    });
  } catch (error) {
    console.error("GET /api/financial/transactions error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/financial/transactions
 * Create a new financial transaction (income or expense).
 * Updates FinancialBalance atomically.
 * If expense with category=wages and staffCompensationId, mark it as paid.
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasPermission(currentUser.role, "financialPayments")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await req.json();
    const { type, category, subCategory, amount, date, paymentMethod, payeeName, payeeId,
      subscriberId, employeeId, staffCompensationId, closureId, reference, note } = body;

    // Validate
    if (!type || !category || !amount) {
      return NextResponse.json({ error: "النوع والفئة والمبلغ مطلوبة" }, { status: 400 });
    }
    if (type !== "income" && type !== "expense") {
      return NextResponse.json({ error: "النوع يجب أن يكون income أو expense" }, { status: 400 });
    }
    if (Number(amount) <= 0) {
      return NextResponse.json({ error: "المبلغ يجب أن يكون أكبر من 0" }, { status: 400 });
    }

    const clubId = currentUser.role === "superadmin" ? body.clubId : currentUser.clubId;
    if (!clubId) {
      return NextResponse.json({ error: "النادي غير محدد" }, { status: 400 });
    }

    const validIncomeCategories = ["subscription", "renewal", "insurance", "compound", "other_income"];
    const validExpenseCategories = ["wages", "insurance", "compound_rights", "office_supplies", "other_expense"];
    if (type === "income" && !validIncomeCategories.includes(category)) {
      return NextResponse.json({ error: "فئة مدخول غير صالحة" }, { status: 400 });
    }
    if (type === "expense" && !validExpenseCategories.includes(category)) {
      return NextResponse.json({ error: "فئة مصروف غير صالحة" }, { status: 400 });
    }

    const txAmount = Math.round(Number(amount));
    const txDate = date ? new Date(date) : new Date();

    // ★ Atomic: create transaction + update balance + (optional) mark staffCompensation paid
    const result = await db.$transaction(async (tx) => {
      // 1) Create the transaction
      const transaction = await tx.financialTransaction.create({
        data: {
          clubId,
          type,
          category,
          subCategory: subCategory || null,
          amount: txAmount,
          date: txDate,
          paymentMethod: paymentMethod || "cash",
          payeeName: payeeName || null,
          payeeId: payeeId || null,
          subscriberId: subscriberId || null,
          employeeId: employeeId || null,
          staffCompensationId: staffCompensationId || null,
          closureId: closureId || null,
          reference: reference || null,
          note: note || null,
          createdById: currentUser.id,
        },
      });

      // 2) Update balance (upsert singleton)
      const existingBalance = await tx.financialBalance.findUnique({ where: { clubId } });
      const incomeByCat = existingBalance ? parseJSON(existingBalance.incomeByCategory, {}) : {};
      const expenseByCat = existingBalance ? parseJSON(existingBalance.expenseByCategory, {}) : {};

      if (type === "income") {
        incomeByCat[category] = (incomeByCat[category] || 0) + txAmount;
      } else {
        expenseByCat[category] = (expenseByCat[category] || 0) + txAmount;
      }

      const newTotalIncome = (existingBalance?.totalIncome || 0) + (type === "income" ? txAmount : 0);
      const newTotalExpense = (existingBalance?.totalExpense || 0) + (type === "expense" ? txAmount : 0);

      await tx.financialBalance.upsert({
        where: { clubId },
        update: {
          totalIncome: newTotalIncome,
          totalExpense: newTotalExpense,
          balance: newTotalIncome - newTotalExpense,
          incomeByCategory: JSON.stringify(incomeByCat),
          expenseByCategory: JSON.stringify(expenseByCat),
          lastTransactionId: transaction.id,
          lastTransactionDate: txDate,
        },
        create: {
          clubId,
          totalIncome: type === "income" ? txAmount : 0,
          totalExpense: type === "expense" ? txAmount : 0,
          balance: type === "income" ? txAmount : -txAmount,
          incomeByCategory: JSON.stringify(type === "income" ? { [category]: txAmount } : {}),
          expenseByCategory: JSON.stringify(type === "expense" ? { [category]: txAmount } : {}),
          lastTransactionId: transaction.id,
          lastTransactionDate: txDate,
        },
      });

      // 3) If wage payment linked to StaffCompensation, mark it paid
      if (type === "expense" && category === "wages" && staffCompensationId) {
        await tx.staffCompensation.update({
          where: { id: staffCompensationId },
          data: {
            paymentStatus: "paid",
            paymentDate: txDate,
            paymentMethod: paymentMethod || "cash",
          },
        }).catch(() => { /* StaffCompensation may not exist — ignore */ });
      }

      return transaction;
    });

    // Activity log
    await db.activity.create({
      data: {
        clubId,
        userId: currentUser.id,
        type: "financial_transaction",
        description: `${type === "income" ? "مدخول" : "مصروف"}: ${category} — ${txAmount.toLocaleString()} دج${payeeName ? ` (${payeeName})` : ""}`,
      },
    }).catch(() => {});

    // ★ Notify admin for large expenses (> 10000)
    if (type === "expense" && txAmount > 10000) {
      await db.notification.create({
        data: {
          clubId,
          type: "large_expense",
          title: "مصروف كبير",
          message: `تم تسجيل مصروف بقيمة ${txAmount.toLocaleString()} دج (${category})${payeeName ? ` لـ ${payeeName}` : ""}`,
        },
      }).catch(() => {});
    }

    return NextResponse.json({ transaction: result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/financial/transactions error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

function parseJSON(str: string, fallback: Record<string, number>): Record<string, number> {
  try { return JSON.parse(str) || fallback; } catch { return fallback; }
}

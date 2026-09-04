import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/session";
import { postLedgerEntry, financialNumber } from "@/lib/financial-posting";
import { ensureRuntimeColumns, ensureFinancialIndexes } from "@/lib/runtime-schema";

/**
 * GET /api/financial/transactions
 * دفتر القيود — فلاتر وبحث وفرز خادمية + Pagination (المراحل 26-29):
 *   type, category, paymentMethod, status(active|cancelled|all),
 *   dateFrom/dateTo, payeeName,
 *   q: بحث موحّد في (اسم الجهة، المرجع، الملاحظات، رقم الملف، اسم العامل،
 *      رقم العملية FIN-…، المبلغ إن كان رقماً)
 *   sortField: date|amount|category|type|payeeName|seq  sortDir: asc|desc
 *   page/limit
 * stats تحسب النشطة دائماً — الملغاة لا تدخل في الرصيد.
 */
export async function GET(req: NextRequest) {
  try {
    await ensureRuntimeColumns();
    await ensureFinancialIndexes();
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
    const q = (url.searchParams.get("q") || "").trim();
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "50")));
    const skip = (page - 1) * limit;

    // ★ فرز خادمي بقائمة بيضاء (لا يُفرز العميل إلا الصفحة الحالية — المرحلة 27)
    const SORT_FIELDS = new Set(["date", "amount", "category", "type", "payeeName", "seq", "createdAt"]);
    const sortFieldRaw = url.searchParams.get("sortField") || "date";
    const sortField = SORT_FIELDS.has(sortFieldRaw) ? sortFieldRaw : "date";
    const sortDir = url.searchParams.get("sortDir") === "asc" ? "asc" : "desc";
    // Prisma يتطلب مصفوفة للفرز متعدد المفاتيح
    const orderBy: Array<Record<string, string>> = [{ [sortField]: sortDir }];
    if (sortField !== "date") orderBy.push({ date: "desc" }); // فاصل ثابت للتعادل

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const where: Record<string, unknown> = { ...clubFilter };
    // ★ فلتر الحالة: النشطة افتراضياً — «ملغاة» لعرض سجل الإلغاءات — «الكل» للسجل الكامل
    const statusParam = url.searchParams.get("status") || "active";
    if (statusParam === "active" || statusParam === "cancelled") where.status = statusParam;
    if (type) where.type = type;
    if (category) where.category = category;
    if (paymentMethod) where.paymentMethod = paymentMethod;
    if (payeeName) where.payeeName = { contains: payeeName };

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

    // ★ بحث موحّد q (المرحلة 26) — يشمل المنخرط برقم الملف/الاسم والعامل بالاسم ورقم FIN والمبلغ والمرجع والملاحظات
    if (q) {
      const or: Array<Record<string, unknown>> = [
        { payeeName: { contains: q } },
        { reference: { contains: q } },
        { note: { contains: q } },
        { category: { contains: q } },
      ];
      // رقم العملية FIN-YYYY-NNNNNN → seq
      const finMatch = q.toUpperCase().match(/^FIN-(\d{4})-0*(\d{1,9})$/);
      if (finMatch) or.push({ seq: parseInt(finMatch[2]) });
      else if (/^\d{1,9}$/.test(q)) or.push({ seq: parseInt(q) });
      // المبلغ الرقمي
      if (/^\d{1,9}$/.test(q)) or.push({ amount: parseInt(q) });
      // منخرط برقم الملف أو الاسم
      const matchedSubs = await db.subscriber.findMany({
        where: { ...clubFilter, OR: [{ fileNumber: { contains: q } }, { lastName: { contains: q } }, { firstName: { contains: q } }] },
        select: { id: true },
        take: 200,
      });
      if (matchedSubs.length) or.push({ subscriberId: { in: matchedSubs.map((s) => s.id) } });
      // عامل بالاسم (المستخدمون)
      const matchedUsers = await db.user.findMany({
        where: { OR: [{ name: { contains: q } }, { email: { contains: q } }] },
        select: { id: true },
        take: 100,
      });
      if (matchedUsers.length) {
        or.push({ employeeId: { in: matchedUsers.map((u) => u.id) } });
        or.push({ createdById: { in: matchedUsers.map((u) => u.id) } });
      }
      where.OR = or;
    }

    const [transactions, total] = await Promise.all([
      db.financialTransaction.findMany({
        where,
        orderBy,
        take: limit,
        skip,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      db.financialTransaction.count({ where }),
    ]);

    // ★ اسم مُلغي العملية (لعرضه في سجل الإلغاءات)
    const cancellerIds = Array.from(
      new Set(transactions.map((t) => t.cancelledById).filter((v): v is string => Boolean(v)))
    );
    const cancellers = cancellerIds.length
      ? await db.user.findMany({ where: { id: { in: cancellerIds } }, select: { id: true, name: true } })
      : [];
    const cancellerMap = new Map(cancellers.map((u) => [u.id, u.name]));
    const rows = transactions.map((t) => ({
      ...t,
      cancelledByName: t.cancelledById ? cancellerMap.get(t.cancelledById) || null : null,
      // ★ رقم العملية المالي المقروء: FIN-2026-000001
      number: financialNumber(t.seq, t.date),
    }));

    // Period stats — النشطة فقط (الملغاة لا تدخل في الرصيد) + ملخص الملغاة لنفس الفلاتر
    const activeBase = { ...where, status: "active" };
    const [incomeSum, expenseSum, cancelledAgg] = await Promise.all([
      db.financialTransaction.aggregate({
        where: { ...activeBase, type: "income" },
        _sum: { amount: true },
        _count: true,
      }),
      db.financialTransaction.aggregate({
        where: { ...activeBase, type: "expense" },
        _sum: { amount: true },
        _count: true,
      }),
      db.financialTransaction.aggregate({
        where: { ...where, status: "cancelled" },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return NextResponse.json({
      transactions: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: {
        totalIncome: incomeSum._sum.amount || 0,
        totalExpense: expenseSum._sum.amount || 0,
        balance: (incomeSum._sum.amount || 0) - (expenseSum._sum.amount || 0),
        incomeCount: incomeSum._count || 0,
        expenseCount: expenseSum._count || 0,
        cancelledTotal: cancelledAgg._sum.amount || 0,
        cancelledCount: cancelledAgg._count || 0,
      },
    });
  } catch (error) {
    console.error("GET /api/financial/transactions error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/financial/transactions
 * قيد يدوي جديد — عبر النواة الموحّدة postLedgerEntry (رقم FIN + idempotency + رصيد ذرّي).
 */
export async function POST(req: NextRequest) {
  try {
    await ensureRuntimeColumns();
    await ensureFinancialIndexes();
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

    // ★ Atomic: postLedgerEntry (create + seq + balance) + mark staffCompensation paid
    const result = await db.$transaction(async (tx) => {
      const posted = await postLedgerEntry(tx, {
        clubId,
        type,
        category,
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
      });

      // If wage payment linked to StaffCompensation, mark it paid
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

      return posted;
    });

    if (result.duplicate) {
      return NextResponse.json({
        transaction: await db.financialTransaction.findUnique({ where: { id: result.id } }),
        duplicate: true,
        message: "هذه العملية مسجّلة مسبقاً بنفس المرجع — أُعيد القيد الموجود دون ازدواج",
      }, { status: 200 });
    }

    const transaction = await db.financialTransaction.findUnique({ where: { id: result.id } });

    // ★ AuditLog الإنشاء — كل قيد يدوي قابل للتتبع منذ لحظة ولادته (المرحلة 32)
    await db.auditLog.create({
      data: {
        clubId,
        userId: currentUser.id,
        action: "financial_transaction_create",
        entityType: "FinancialTransaction",
        entityId: result.id,
        description: `قيد مالي يدوي (${type}/${category}): ${txAmount} دج${payeeName ? ` — ${payeeName}` : ""} — رقم العملية ${result.number ?? "—"}`,
        metadata: JSON.stringify({ amount: txAmount, type, category, reference: reference || null, financialNumber: result.number }),
      },
    }).catch(() => undefined);

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

    return NextResponse.json({ transaction, number: result.number }, { status: 201 });
  } catch (error) {
    console.error("POST /api/financial/transactions error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * financial-posting.ts — مساعدات الترحيل المحاسبي الموحّد
 * ═════════════════════════════════════════════════════════════
 * مصدر واحد للحقيقة: كل دفعة تُنشأ في أي مكان بالنادي (تجديد، تأمين،
 * حقوق مركب، تسديد أجر…) تُرحَّل تلقائياً إلى دفتر FinancialTransaction
 * مع تحديث FinancialBalance ذرّياً — فلا يبقى دفتران منفصلان.
 *
 * الاصطلاح المرجعي: القيود التلقائية تحمل reference بصيغة
 *   «renewal:{id}» / «payment:{id}» / «bulk-ins:{subscriberId}»
 * حتى يُمكن حذف القيد آلياً عند حذف العملية الأصلية (لا ازدواج ولا بقايا).
 */

import { Prisma, PrismaClient } from "@prisma/client";

/** عميل Prisma يعمل داخل $transaction أو مباشرة */
export type PrismaTx = Prisma.TransactionClient | PrismaClient;

function parseJSONMap(str: string | null | undefined): Record<string, number> {
  if (!str) return {};
  try { return JSON.parse(str) || {}; } catch { return {}; }
}

export interface LedgerEntryInput {
  clubId: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  date?: Date;
  paymentMethod?: string;
  payeeName?: string | null;
  payeeId?: string | null;
  subscriberId?: string | null;
  employeeId?: string | null;
  staffCompensationId?: string | null;
  closureId?: string | null;
  reference?: string | null;
  note?: string | null;
  createdById?: string | null;
}

/**
 * ترحيل قيد مالي إلى الدفتر + تحديث الرصيد ذرّياً.
 * يُستدعى داخل db.$transaction لضمان ذرّية العملية.
 */
export async function postLedgerEntry(tx: PrismaTx, data: LedgerEntryInput): Promise<string> {
  const amount = Math.round(Number(data.amount));
  const entry = await tx.financialTransaction.create({
    data: {
      clubId: data.clubId,
      type: data.type,
      category: data.category,
      amount,
      date: data.date ?? new Date(),
      paymentMethod: data.paymentMethod || "cash",
      payeeName: data.payeeName ?? null,
      payeeId: data.payeeId ?? null,
      subscriberId: data.subscriberId ?? null,
      employeeId: data.employeeId ?? null,
      staffCompensationId: data.staffCompensationId ?? null,
      closureId: data.closureId ?? null,
      reference: data.reference ?? null,
      note: data.note ?? null,
      createdById: data.createdById ?? null,
    },
    select: { id: true },
  });

  await applyBalanceDelta(tx, data.clubId, data.type, data.category, amount);
  return entry.id;
}

/**
 * تحديث تفاضلي لرصيد النادي (singleton FinancialBalance).
 */
export async function applyBalanceDelta(
  tx: PrismaTx,
  clubId: string,
  type: "income" | "expense",
  category: string,
  amount: number
): Promise<void> {
  const existing = await tx.financialBalance.findUnique({ where: { clubId } });
  const incomeByCat = parseJSONMap(existing?.incomeByCategory);
  const expenseByCat = parseJSONMap(existing?.expenseByCategory);

  if (type === "income") incomeByCat[category] = (incomeByCat[category] || 0) + amount;
  else expenseByCat[category] = (expenseByCat[category] || 0) + amount;

  const totalIncome = (existing?.totalIncome || 0) + (type === "income" ? amount : 0);
  const totalExpense = (existing?.totalExpense || 0) + (type === "expense" ? amount : 0);

  await tx.financialBalance.upsert({
    where: { clubId },
    update: {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      incomeByCategory: JSON.stringify(incomeByCat),
      expenseByCategory: JSON.stringify(expenseByCat),
      lastTransactionId: existing?.lastTransactionId ?? null,
      lastTransactionDate: existing?.lastTransactionDate ?? null,
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

/**
 * حذف القيد المرحَّل المرتبط بمرجع (payment:{id} مثلاً) + إعادة حساب الرصيد كاملاً.
 * يُستدعى داخل db.$transaction عند حذف/إلغاء العملية الأصلية.
 * @returns true إن وُجد قيد وحُذف
 */
export async function deleteLedgerByReferenceTx(
  tx: PrismaTx,
  clubId: string,
  reference: string
): Promise<boolean> {
  const found = await tx.financialTransaction.findFirst({
    where: { clubId, reference },
    select: { id: true },
  });
  if (!found) return false;
  await tx.financialTransaction.delete({ where: { id: found.id } });
  await recomputeBalanceTx(tx, clubId);
  return true;
}

/**
 * حذف القيود المرحّلة المرتبطة بعدة مراجع محتملة (دفعة فردية أو جماعية)
 * + إعادة حساب الرصيد مرة واحدة. يُستدعى داخل db.$transaction.
 * @returns عدد القيود المحذوفة
 */
export async function deleteLedgerByReferencesTx(
  tx: PrismaTx,
  clubId: string,
  references: string[]
): Promise<number> {
  const refs = references.filter(Boolean);
  if (refs.length === 0) return 0;
  const found = await tx.financialTransaction.findMany({
    where: { clubId, reference: { in: refs } },
    select: { id: true },
  });
  if (found.length === 0) return 0;
  await tx.financialTransaction.deleteMany({ where: { id: { in: found.map((f) => f.id) } } });
  await recomputeBalanceTx(tx, clubId);
  return found.length;
}

/**
 * إعادة حساب الرصيد من الصفر من كل القيود (الأدق بعد أي حذف/تعديل جماعي).
 */
export async function recomputeBalanceTx(tx: PrismaTx, clubId: string): Promise<void> {
  const allTx = await tx.financialTransaction.findMany({
    where: { clubId },
    select: { type: true, category: true, amount: true, date: true, id: true },
    orderBy: { date: "asc" },
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

  const last = allTx[allTx.length - 1];

  await tx.financialBalance.upsert({
    where: { clubId },
    update: {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      incomeByCategory: JSON.stringify(incomeByCat),
      expenseByCategory: JSON.stringify(expenseByCat),
      lastTransactionId: last?.id ?? null,
      lastTransactionDate: last?.date ?? null,
    },
    create: {
      clubId,
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      incomeByCategory: JSON.stringify(incomeByCat),
      expenseByCategory: JSON.stringify(expenseByCat),
      lastTransactionId: last?.id ?? null,
      lastTransactionDate: last?.date ?? null,
    },
  });
}

/**
 * أسماء الفئات المحاسبية القياسية (مداخيل + مصاريف) — مرجع موحّد للواجهة والخادم.
 */
export const INCOME_CATEGORY_KEYS = ["subscription", "renewal", "insurance", "compound", "other_income"] as const;
export const EXPENSE_CATEGORY_KEYS = ["wages", "insurance", "compound_rights", "office_supplies", "other_expense"] as const;

export const CATEGORY_LABELS_AR: Record<string, string> = {
  // مداخيل
  subscription: "تسجيل اشتراك",
  renewal: "تجديد اشتراك",
  insurance: "تأمين منخرط",
  compound: "حقوق المركب",
  other_income: "مدخول آخر",
  // مصاريف
  wages: "أجور عمال",
  compound_rights: "حقوق المركب (مصروف)",
  office_supplies: "لوازم مكتبية",
  other_expense: "مصروف آخر",
};

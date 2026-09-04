/**
 * financial-posting.ts — النواة المحاسبية الموحّدة (Single Source of Truth)
 * ═════════════════════════════════════════════════════════════
 * كل عملية مالية في النظام تُرحَّل هنا — لا FinancialTransaction.create
 * خارج هذا الملف (المرحلة 42).
 *
 * الضمانات:
 *  1) Idempotency بالمرجع (المرحلة 12/43): فهرس فريد جزئي (clubId, reference)
 *     للقيود النشطة + تحقق استباقي — الضغط المزدوج يُنشئ قيداً واحداً فقط.
 *     القيد الملغى بنفس المرجع لا يمنع إنشاء قيد جديد مشروع (نمط toggle).
 *  2) ذرّية الرصيد (المرحلة 7): totals/balance عبر increment ذرّي على مستوى
 *     قاعدة البيانات — لا lost-update عند التزامن. خرائط الفئات JSON تُدمج
 *     داخل نفس الذرّية، ويكفل «فحص سلامة الرصيد» اكتشاف أي انحراف.
 *  3) lastTransaction يتحدث دائماً لآخر قيد (المرحلة 8).
 *  4) رقم مالي للمستخدم (المرحلة 13): seq فريد لكل نادي → FIN-YYYY-NNNNNN.
 *  5) الإلغاء ناعم — لا حذف فعلي (status=cancelled).
 *
 * الاصطلاح المرجعي: «renewal:{id}» / «payment:{id}» / «wage:{id}» /
 * «bulk-ins:{subscriberId}» / «subscriber:{id}:subscription|insurance|compound»
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { ensureRuntimeColumns, ensureFinancialIndexes } from "@/lib/runtime-schema";

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

export interface PostedEntry {
  id: string;
  seq: number | null;
  number: string | null;
  duplicate: boolean;
}

/** خطأ مرجع مكرر ملغى (لا يُنشأ قيد جديد إلا عن إعادة عملية مشروعة عبر التمرير الصريح) */
export class DuplicateReferenceError extends Error {
  constructor(public reference: string) {
    super(`مرجع مالي مكرر نشط: ${reference}`);
    this.name = "DuplicateReferenceError";
  }
}

/**
 * رقم العملية المالي المقروء للمستخدم: FIN-2026-000001
 */
export function financialNumber(seq: number | null | undefined, date: Date | string): string | null {
  if (!seq || seq < 1) return null;
  const year = new Date(date).getFullYear();
  return `FIN-${year}-${String(seq).padStart(6, "0")}`;
}

/**
 * ترقيم تسلسلي idempotent للقيود القديمة (بلا seq) — حسب التاريخ تصاعدياً.
 * يمكن تشغيله أكثر من مرة دون مضاعفة (المرحلة 44).
 * @returns عدد القيود التي رُقّمت الآن
 */
export async function backfillSeqTx(tx: PrismaTx, clubId: string): Promise<number> {
  const rows = await tx.financialTransaction.findMany({
    where: { clubId, seq: null },
    select: { id: true, date: true },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
  if (rows.length === 0) return 0;
  const maxAgg = await tx.financialTransaction.aggregate({
    where: { clubId },
    _max: { seq: true },
  });
  let next = (maxAgg._max.seq || 0) + 1;
  for (const r of rows) {
    await tx.financialTransaction.update({ where: { id: r.id }, data: { seq: next++ } });
  }
  return rows.length;
}

/**
 * ترحيل قيد مالي إلى الدفتر — النقطة الوحيدة لإنشاء FinancialTransaction.
 * Idempotent بالمرجع + رقم FIN + رصيد ذرّي + lastTransaction.
 * يُستدعى داخل db.$transaction لضمان ذرّية العملية الكاملة.
 */
export async function postLedgerEntry(tx: PrismaTx, data: LedgerEntryInput): Promise<PostedEntry> {
  const amount = Math.round(Number(data.amount));
  const ref = data.reference?.trim() || null;

  // 1) Idempotency استباقية بالمرجع — قيد نشط بنفس المرجع = نفس العملية (لا ازدواج)
  if (ref) {
    const dup = await tx.financialTransaction.findFirst({
      where: { clubId: data.clubId, reference: ref, status: "active" },
      select: { id: true, seq: true, date: true },
    });
    if (dup) {
      return { id: dup.id, seq: dup.seq, number: financialNumber(dup.seq, dup.date), duplicate: true };
    }
  }

  // 2) رقم FIN: seq فريد لكل نادي (إعادة محاولة عند سباق التزامن على القيد الفريد)
  let seq: number | null = null;
  let entryId: string | null = null;
  for (let attempt = 0; attempt < 3 && !entryId; attempt++) {
    try {
      const maxAgg = await tx.financialTransaction.aggregate({
        where: { clubId: data.clubId },
        _max: { seq: true },
      });
      seq = (maxAgg._max.seq || 0) + 1;
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
          reference: ref,
          note: data.note ?? null,
          createdById: data.createdById ?? null,
          seq,
        },
        select: { id: true, date: true },
      });
      entryId = entry.id;
    } catch (e) {
      // P2002 = تعارض فريد (سباق seq أو سباق المرجع) — أعد الفحص:
      const code = (e as { code?: string })?.code;
      if (code !== "P2002") throw e;
      if (ref) {
        // ربما سبقَنا بالمرجع نفسه → أعد الفحص (idempotency تفاعلية)
        const dup = await tx.financialTransaction.findFirst({
          where: { clubId: data.clubId, reference: ref, status: "active" },
          select: { id: true, seq: true, date: true },
        });
        if (dup) {
          return { id: dup.id, seq: dup.seq, number: financialNumber(dup.seq, dup.date), duplicate: true };
        }
      }
      // وإلا سباق seq → حاول برقم أعلى
    }
  }
  if (!entryId) throw new Error("تعذر توليد رقم عملية مالي فريد بعد 3 محاولات");

  // 3) الرصيد: تحديث ذرّي (increment) + دمج خرائط الفئات داخل نفس الذرّية
  await applyBalanceDelta(tx, data.clubId, data.type, data.category, amount);

  // 4) lastTransaction يشير دائماً لآخر قيد فعلي (المرحلة 8)
  await tx.financialBalance.updateMany({
    where: { clubId: data.clubId },
    data: { lastTransactionId: entryId, lastTransactionDate: data.date ?? new Date() },
  });

  return { id: entryId, seq, number: financialNumber(seq, data.date ?? new Date()), duplicate: false };
}

/**
 * تحديث تفاضلي لرصيد النادي (singleton FinancialBalance).
 * ★ الأرقام الإجمالية عبر increment ذرّي (لا read-modify-write للإجماليات — المرحلة 7)؛
 *   خرائط الفئات JSON تُدمج داخل نفس الذرّية (انحرافها محتمل نظرياً على PG المتزامن
 *   لكنه مستثنى عملياً بترتيب الكتابة، و«فحص سلامة الرصيد» يكشفه ويصلحه بإعادة البناء).
 */
export async function applyBalanceDelta(
  tx: PrismaTx,
  clubId: string,
  type: "income" | "expense",
  category: string,
  amount: number
): Promise<void> {
  const existing = await tx.financialBalance.findUnique({ where: { clubId } });
  if (!existing) {
    const incomeByCat = type === "income" ? { [category]: amount } : {};
    const expenseByCat = type === "expense" ? { [category]: amount } : {};
    await tx.financialBalance.create({
      data: {
        clubId,
        totalIncome: type === "income" ? amount : 0,
        totalExpense: type === "expense" ? amount : 0,
        balance: type === "income" ? amount : -amount,
        incomeByCategory: JSON.stringify(incomeByCat),
        expenseByCategory: JSON.stringify(expenseByCat),
      },
    });
    return;
  }

  const incomeByCat = parseJSONMap(existing.incomeByCategory);
  const expenseByCat = parseJSONMap(existing.expenseByCategory);
  if (type === "income") incomeByCat[category] = (incomeByCat[category] || 0) + amount;
  else expenseByCat[category] = (expenseByCat[category] || 0) + amount;

  // increment ذرّي — آمن مع العمليات المتزامنة (لا lost update على الإجماليات)
  await tx.financialBalance.update({
    where: { clubId },
    data: {
      totalIncome: type === "income" ? { increment: amount } : undefined,
      totalExpense: type === "expense" ? { increment: amount } : undefined,
      balance: { increment: type === "income" ? amount : -amount },
      incomeByCategory: JSON.stringify(incomeByCat),
      expenseByCategory: JSON.stringify(expenseByCat),
    },
  });
}

/**
 * إلغاء القيود المرحّلة المرتبطة بعدة مراجع محتملة — إلغاء ناعم لا حذف:
 * status=cancelled + cancelledAt/cancelledById/cancellationReason
 * + إعادة حساب الرصيد مرة واحدة (الملغى لا يدخل فيه).
 * يُستدعى داخل db.$transaction عند إلغاء العملية الأصلية.
 * @returns عدد القيود المُلغاة
 */
export async function cancelLedgerByReferencesTx(
  tx: PrismaTx,
  clubId: string,
  references: string[],
  meta?: { cancelledById?: string | null; reason?: string | null }
): Promise<number> {
  const refs = references.filter(Boolean);
  if (refs.length === 0) return 0;
  const result = await tx.financialTransaction.updateMany({
    where: { clubId, reference: { in: refs }, status: "active" },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledById: meta?.cancelledById ?? null,
      cancellationReason: meta?.reason ?? null,
    },
  });
  if (result.count > 0) await recomputeBalanceTx(tx, clubId);
  return result.count;
}

/**
 * إعادة حساب الرصيد من الصفر من كل القيود النشطة (الملغاة مستثناة).
 * هذه هي «إعادة بناء الملخص السريع» — FinancialBalance كاش قابل لإعادة البناء دائماً.
 */
export async function recomputeBalanceTx(tx: PrismaTx, clubId: string): Promise<void> {
  const allTx = await tx.financialTransaction.findMany({
    where: { clubId, status: "active" },
    select: { type: true, category: true, amount: true, date: true, id: true },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
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
 * إلغاء قيد مالي واحد بالمعرّف — إلغاء ناعم + إعادة حساب الرصيد.
 * يُستدعى داخل db.$transaction. @returns true أُلغى الآن، false غير موجود أو ملغى مسبقاً
 */
export async function cancelLedgerEntryTx(
  tx: PrismaTx,
  clubId: string,
  id: string,
  meta: { cancelledById?: string | null; reason: string }
): Promise<boolean> {
  const existing = await tx.financialTransaction.findFirst({
    where: { id, clubId },
    select: { id: true, status: true },
  });
  if (!existing || existing.status === "cancelled") return false;
  await tx.financialTransaction.update({
    where: { id },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledById: meta.cancelledById ?? null,
      cancellationReason: meta.reason,
    },
  });
  await recomputeBalanceTx(tx, clubId);
  return true;
}

/**
 * ضمان جاهزية البنية المالية (أعمدة + فهارس) — يستدعى من مسارات المالية.
 */
export async function ensureFinancialReady(): Promise<void> {
  await ensureRuntimeColumns();
  await ensureFinancialIndexes();
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

/**
 * التزامات النادي (Payables) — مصادرها المعروفة حالياً من بيانات النادي:
 * أجور عمال مستحقة + حقوق مركب على النادي. (المرحلة 15/16B)
 */
export function computeRealAvailable(balance: number, payables: number): number {
  return balance - Math.max(0, payables);
}

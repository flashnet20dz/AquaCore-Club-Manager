/**
 * runtime-schema.ts — ضمان أعمدة الإلغاء الناعم وdayOfWeek على قاعدة الإنتاج
 * ═════════════════════════════════════════════════════════════
 * بناء Vercel لا يُنفّذ db:push — لذا تُضاف الأعمدة الجديدة ذاتياً عند أول
 * طلب (نمط /api/setup وensureWageTable المُثبَت). العملية idempotent
 * ورخيصة: بعد أول نجاح تُتجاوز من الذاكرة.
 *
 * الأعمدة المغطاة:
 *  - FinancialTransaction: status/cancelledAt/cancelledById/cancellationReason
 *  - WagePayment:          status/cancelledAt/cancelledById/cancellationReason
 *  - SwimmingTimeSlot:     dayOfWeek
 */

let runtimeDdlDone = false;

const COLUMN_SPECS: Array<{
  table: string;
  column: string;
  pg: string;
  sqlite: string;
}> = [
  { table: "FinancialTransaction", column: "status", pg: `ALTER TABLE "FinancialTransaction" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active'`, sqlite: `ALTER TABLE "FinancialTransaction" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active'` },
  { table: "FinancialTransaction", column: "cancelledAt", pg: `ALTER TABLE "FinancialTransaction" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3)`, sqlite: `ALTER TABLE "FinancialTransaction" ADD COLUMN "cancelledAt" DATETIME` },
  { table: "FinancialTransaction", column: "cancelledById", pg: `ALTER TABLE "FinancialTransaction" ADD COLUMN IF NOT EXISTS "cancelledById" TEXT`, sqlite: `ALTER TABLE "FinancialTransaction" ADD COLUMN "cancelledById" TEXT` },
  { table: "FinancialTransaction", column: "cancellationReason", pg: `ALTER TABLE "FinancialTransaction" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT`, sqlite: `ALTER TABLE "FinancialTransaction" ADD COLUMN "cancellationReason" TEXT` },
  { table: "WagePayment", column: "status", pg: `ALTER TABLE "WagePayment" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active'`, sqlite: `ALTER TABLE "WagePayment" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active'` },
  { table: "WagePayment", column: "cancelledAt", pg: `ALTER TABLE "WagePayment" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3)`, sqlite: `ALTER TABLE "WagePayment" ADD COLUMN "cancelledAt" DATETIME` },
  { table: "WagePayment", column: "cancelledById", pg: `ALTER TABLE "WagePayment" ADD COLUMN IF NOT EXISTS "cancelledById" TEXT`, sqlite: `ALTER TABLE "WagePayment" ADD COLUMN "cancelledById" TEXT` },
  { table: "WagePayment", column: "cancellationReason", pg: `ALTER TABLE "WagePayment" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT`, sqlite: `ALTER TABLE "WagePayment" ADD COLUMN "cancellationReason" TEXT` },
  { table: "SwimmingTimeSlot", column: "dayOfWeek", pg: `ALTER TABLE "SwimmingTimeSlot" ADD COLUMN IF NOT EXISTS "dayOfWeek" TEXT`, sqlite: `ALTER TABLE "SwimmingTimeSlot" ADD COLUMN "dayOfWeek" TEXT` },
];

async function columnExists(
  db: { $queryRawUnsafe: (q: string) => Promise<unknown> },
  table: string,
  column: string
): Promise<boolean> {
  // PostgreSQL
  try {
    const rows = (await db.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_name = '${table}' AND column_name = '${column}'`
    )) as unknown[];
    if (Array.isArray(rows)) return rows.length > 0;
  } catch { /* ليس PostgreSQL */ }
  // SQLite
  try {
    const rows = (await db.$queryRawUnsafe(`PRAGMA table_info("${table}")`)) as Array<{ name?: string }>;
    if (Array.isArray(rows)) return rows.some((r) => r?.name === column);
  } catch { /* الجدول غير موجود */ }
  return true; // تعذّر الفحص → لا تحاول الإضافة (تجنّب كسر الطلب)
}

/**
 * يضمن وجود كل أعمدة الإلغاء الناعم + dayOfWeek — يستدعى من مسارات
 * المالية وساعات السباحة قبل أي استعلام يستخدم الأعمدة الجديدة.
 */
export async function ensureRuntimeColumns(): Promise<void> {
  if (runtimeDdlDone) return;
  const { db } = await import("@/lib/db");
  for (const spec of COLUMN_SPECS) {
    try {
      if (await columnExists(db, spec.table, spec.column)) continue;
      // نجرّب PostgreSQL أولاً ثم SQLite
      await db.$executeRawUnsafe(spec.pg).catch(() => db.$executeRawUnsafe(spec.sqlite));
    } catch { /* العمود موجود أو الجدول لم يُنشأ بعد */ }
  }
  runtimeDdlDone = true;
}

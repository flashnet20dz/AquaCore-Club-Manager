/**
 * runtime-schema.ts — ضمان أعمدة الإلغاء الناعم وdayOfWeek على قاعدة الإنتاج
 * ═════════════════════════════════════════════════════════════
 * بناء Vercel لا يُنفّذ db:push — لذا تُضاف الأعمدة الجديدة ذاتياً عند أول
 * طلب (نمط /api/setup وensureWageTable المُثبَت). العملية idempotent
 * ورخيصة: بعد أول نجاح تُتجاوز من الذاكرة.
 *
 * الأعمدة المغطاة:
 *  - FinancialTransaction: status/cancelledAt/cancelledById/cancellationReason/seq
 *  - WagePayment:          status/cancelledAt/cancelledById/cancellationReason
 *  - Payment:              cancelledAt/cancelledById/cancellationReason
 *  - SwimmingTimeSlot:     dayOfWeek
 *
 * + الفهارس المالية (ensureFinancialIndexes):
 *  - فريد جزئي (clubId, reference) للقيود النشطة فقط — منع ازدواج القيد لنفس المرجع
 *    (الملغاة مستثناة ليدعم نمط toggle: إلغاء ثم إعادة إنشاء مشروعة)
 */

let runtimeDdlDone = false;

/** مزوّد قاعدة البيانات الفعلي من DATABASE_URL — نتجنب استعلامات PG على SQLite */
function isSqlite(): boolean {
  try {
    const url = process.env.DATABASE_URL || "";
    return url.startsWith("file:") || url.includes(".db") || url.includes("sqlite");
  } catch {
    return false;
  }
}

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
  { table: "Payment", column: "cancelledAt", pg: `ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3)`, sqlite: `ALTER TABLE "Payment" ADD COLUMN "cancelledAt" DATETIME` },
  { table: "Payment", column: "cancelledById", pg: `ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "cancelledById" TEXT`, sqlite: `ALTER TABLE "Payment" ADD COLUMN "cancelledById" TEXT` },
  { table: "Payment", column: "cancellationReason", pg: `ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT`, sqlite: `ALTER TABLE "Payment" ADD COLUMN "cancellationReason" TEXT` },
  { table: "FinancialTransaction", column: "seq", pg: `ALTER TABLE "FinancialTransaction" ADD COLUMN IF NOT EXISTS "seq" INTEGER`, sqlite: `ALTER TABLE "FinancialTransaction" ADD COLUMN "seq" INTEGER` },
  // ★ المرحلة 4: ربط تعيين الحراس بالحصة الموحّدة من جدول المسبح
  { table: "GuardAssignment", column: "slotId", pg: `ALTER TABLE "GuardAssignment" ADD COLUMN IF NOT EXISTS "slotId" TEXT`, sqlite: `ALTER TABLE "GuardAssignment" ADD COLUMN "slotId" TEXT` },
];

async function columnExists(
  db: { $queryRawUnsafe: (q: string) => Promise<unknown> },
  table: string,
  column: string
): Promise<boolean> {
  // PostgreSQL (يُتخطى على SQLite — لا information_schema هناك)
  if (!isSqlite()) {
    try {
      const rows = (await db.$queryRawUnsafe(
        `SELECT column_name FROM information_schema.columns WHERE table_name = '${table}' AND column_name = '${column}'`
      )) as unknown[];
      if (Array.isArray(rows)) return rows.length > 0;
    } catch { /* ليس PostgreSQL */ }
  }
  // SQLite
  try {
    const rows = (await db.$queryRawUnsafe(`PRAGMA table_info("${table}")`)) as Array<{ name?: string }>;
    if (Array.isArray(rows)) return rows.some((r) => r?.name === column);
  } catch { /* الجدول غير موجود */ }
  return true; // تعذّر الفحص → لا تحاول الإضافة (تجنّب كسر الطلب)
}

/**
 * يضمن وجود كل أعمدة الإلغاء الناعم + dayOfWeek + seq — يستدعى من مسارات
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
  // ★ المرحلة 4: فهرس تعيينات الحصة (استعلام «عمال هذه الحصة»)
  try {
    if (!(await indexExists(db, "GuardAssignment_clubId_slotId_idx"))) {
      const idx = `CREATE INDEX IF NOT EXISTS "GuardAssignment_clubId_slotId_idx" ON "GuardAssignment"("clubId","slotId")`;
      await db.$executeRawUnsafe(idx).catch(() => undefined);
    }
  } catch { /* الفهرس اختياري — الاستعلام يعمل بدونه */ }
  runtimeDdlDone = true;
}

// ─────────────────────────────────────────────────────────────
// الفهارس المالية — منع ازدواج القيد لنفس المرجع (idempotency على مستوى القاعدة)
// ─────────────────────────────────────────────────────────────
let financialIndexesDone = false;

async function indexExists(
  db: { $queryRawUnsafe: (q: string) => Promise<unknown> },
  indexName: string
): Promise<boolean> {
  // PostgreSQL (يُتخطى على SQLite)
  if (!isSqlite()) {
    try {
      const rows = (await db.$queryRawUnsafe(
        `SELECT 1 FROM pg_indexes WHERE indexname = '${indexName}'`
      )) as unknown[];
      if (Array.isArray(rows)) return rows.length > 0;
    } catch { /* ليس PostgreSQL */ }
  }
  // SQLite
  try {
    const rows = (await db.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type='index' AND name = '${indexName}'`
    )) as unknown[];
    if (Array.isArray(rows)) return rows.length > 0;
  } catch { /* لا جدول بعد */ }
  return true;
}

/**
 * فريد جزئي (clubId, reference) للقيود النشطة فقط:
 * نفس المرجع لا يُنشئ قيداً نشطاً ثانياً أبداً (ضغط مزدوج = عملية واحدة)،
 * بينما إعادة الإنشاء بعد الإلغاء تبقى مشروعة (نمط toggle للتأمين/المركب).
 */
export async function ensureFinancialIndexes(): Promise<void> {
  if (financialIndexesDone) return;
  const { db } = await import("@/lib/db");
  const NAME = "FinancialTransaction_active_reference_unique";
  try {
    if (!(await indexExists(db, NAME))) {
      const pg = `CREATE UNIQUE INDEX IF NOT EXISTS "${NAME}" ON "FinancialTransaction"("clubId", "reference") WHERE "reference" IS NOT NULL AND "status" = 'active'`;
      const lite = `CREATE UNIQUE INDEX IF NOT EXISTS "${NAME}" ON "FinancialTransaction"("clubId", "reference") WHERE "reference" IS NOT NULL AND "status" = 'active'`;
      await db.$executeRawUnsafe(pg).catch(() => db.$executeRawUnsafe(lite));
    }
    financialIndexesDone = true;
  } catch { /* الفهرس موجود أو تعذر — postLedgerEntry يتحقق احتياطياً */ }
}

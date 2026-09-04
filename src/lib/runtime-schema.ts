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
  // ★ المرحلة 5: سجل العمل مرتبط بالحصة + لقطة السعر + سبب الرفض/الإلغاء
  { table: "WorkHours", column: "slotId", pg: `ALTER TABLE "WorkHours" ADD COLUMN IF NOT EXISTS "slotId" TEXT`, sqlite: `ALTER TABLE "WorkHours" ADD COLUMN "slotId" TEXT` },
  { table: "WorkHours", column: "rateSnapshot", pg: `ALTER TABLE "WorkHours" ADD COLUMN IF NOT EXISTS "rateSnapshot" INTEGER`, sqlite: `ALTER TABLE "WorkHours" ADD COLUMN "rateSnapshot" INTEGER` },
  { table: "WorkHours", column: "rejectionReason", pg: `ALTER TABLE "WorkHours" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT`, sqlite: `ALTER TABLE "WorkHours" ADD COLUMN "rejectionReason" TEXT` },
  { table: "WorkHours", column: "cancelledById", pg: `ALTER TABLE "WorkHours" ADD COLUMN IF NOT EXISTS "cancelledById" TEXT`, sqlite: `ALTER TABLE "WorkHours" ADD COLUMN "cancelledById" TEXT` },
  { table: "WorkHours", column: "cancelledAt", pg: `ALTER TABLE "WorkHours" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3)`, sqlite: `ALTER TABLE "WorkHours" ADD COLUMN "cancelledAt" DATETIME` },
  // ★ المرحلة 5: حالة الموظف + تواصل + الاسم بالفرنسية
  { table: "Employee", column: "status", pg: `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE'`, sqlite: `ALTER TABLE "Employee" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE'` },
  { table: "Employee", column: "email", pg: `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "email" TEXT`, sqlite: `ALTER TABLE "Employee" ADD COLUMN "email" TEXT` },
  { table: "Employee", column: "firstNameFr", pg: `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "firstNameFr" TEXT`, sqlite: `ALTER TABLE "Employee" ADD COLUMN "firstNameFr" TEXT` },
  { table: "Employee", column: "lastNameFr", pg: `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "lastNameFr" TEXT`, sqlite: `ALTER TABLE "Employee" ADD COLUMN "lastNameFr" TEXT` },
  // ★ المرحلة 5: نوع العقد + عنوان + ساعات أسبوعية + إنهاء ناعم
  { table: "EmploymentContract", column: "contractType", pg: `ALTER TABLE "EmploymentContract" ADD COLUMN IF NOT EXISTS "contractType" TEXT NOT NULL DEFAULT 'HOURLY'`, sqlite: `ALTER TABLE "EmploymentContract" ADD COLUMN "contractType" TEXT NOT NULL DEFAULT 'HOURLY'` },
  { table: "EmploymentContract", column: "title", pg: `ALTER TABLE "EmploymentContract" ADD COLUMN IF NOT EXISTS "title" TEXT`, sqlite: `ALTER TABLE "EmploymentContract" ADD COLUMN "title" TEXT` },
  { table: "EmploymentContract", column: "weeklyHours", pg: `ALTER TABLE "EmploymentContract" ADD COLUMN IF NOT EXISTS "weeklyHours" INTEGER`, sqlite: `ALTER TABLE "EmploymentContract" ADD COLUMN "weeklyHours" INTEGER` },
  { table: "EmploymentContract", column: "terminatedAt", pg: `ALTER TABLE "EmploymentContract" ADD COLUMN IF NOT EXISTS "terminatedAt" TIMESTAMP(3)`, sqlite: `ALTER TABLE "EmploymentContract" ADD COLUMN "terminatedAt" DATETIME` },
  { table: "EmploymentContract", column: "terminatedById", pg: `ALTER TABLE "EmploymentContract" ADD COLUMN IF NOT EXISTS "terminatedById" TEXT`, sqlite: `ALTER TABLE "EmploymentContract" ADD COLUMN "terminatedById" TEXT` },
  { table: "EmploymentContract", column: "terminatedReason", pg: `ALTER TABLE "EmploymentContract" ADD COLUMN IF NOT EXISTS "terminatedReason" TEXT`, sqlite: `ALTER TABLE "EmploymentContract" ADD COLUMN "terminatedReason" TEXT` },
  // ★ المرحلة 5: مفتاح Idempotency للتسديد + ربط بسجل الموظف
  { table: "WagePayment", column: "idempotencyKey", pg: `ALTER TABLE "WagePayment" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT`, sqlite: `ALTER TABLE "WagePayment" ADD COLUMN "idempotencyKey" TEXT` },
  { table: "WagePayment", column: "employeeId", pg: `ALTER TABLE "WagePayment" ADD COLUMN IF NOT EXISTS "employeeId" TEXT`, sqlite: `ALTER TABLE "WagePayment" ADD COLUMN "employeeId" TEXT` },
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
  // ★ المرحلة 5: فهارس سجل العمل + الموظفين
  for (const idxName of ["WorkHours_clubId_slotId_idx", "Employee_clubId_status_idx", "EmploymentContract_clubId_endDate_idx"]) {
    try {
      if (!(await indexExists(db, idxName))) {
        const defs: Record<string, string> = {
          WorkHours_clubId_slotId_idx: `CREATE INDEX IF NOT EXISTS "WorkHours_clubId_slotId_idx" ON "WorkHours"("clubId","slotId")`,
          Employee_clubId_status_idx: `CREATE INDEX IF NOT EXISTS "Employee_clubId_status_idx" ON "Employee"("clubId","status")`,
          EmploymentContract_clubId_endDate_idx: `CREATE INDEX IF NOT EXISTS "EmploymentContract_clubId_endDate_idx" ON "EmploymentContract"("clubId","endDate")`,
        };
        await db.$executeRawUnsafe(defs[idxName]).catch(() => undefined);
      }
    } catch { /* فهارس اختيارية */ }
  }
  // ★ المرحلة 5 (§37): فريد جزئي على مفتاح Idempotency للتسديد —
  //   نفس المفتاح = نفس الدفعة (ضغط مزدوج/إعادة إرسال) — القيم الفارغة مستثناة
  try {
    if (!(await indexExists(db, "WagePayment_idempotencyKey_key"))) {
      const idx = `CREATE UNIQUE INDEX IF NOT EXISTS "WagePayment_idempotencyKey_key" ON "WagePayment"("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL`;
      await db.$executeRawUnsafe(idx).catch(() => undefined);
    }
  } catch { /* الفهرس اختياري — التحقق الاستباقي داخل المعاملة يغطي */ }
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

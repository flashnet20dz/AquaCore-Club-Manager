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
 *  - StaffCompensation:    archivedAt/archivedById/archiveReason (أرشفة ناعمة بلا حذف — التدقيق النهائي)
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
  // ★ التدقيق النهائي: أرشفة ناعمة للتعويضات — لا حذف فعلي (السجل يبقى للتاريخ والتدقيق)
  { table: "StaffCompensation", column: "archivedAt", pg: `ALTER TABLE "StaffCompensation" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3)`, sqlite: `ALTER TABLE "StaffCompensation" ADD COLUMN "archivedAt" DATETIME` },
  { table: "StaffCompensation", column: "archivedById", pg: `ALTER TABLE "StaffCompensation" ADD COLUMN IF NOT EXISTS "archivedById" TEXT`, sqlite: `ALTER TABLE "StaffCompensation" ADD COLUMN "archivedById" TEXT` },
  { table: "StaffCompensation", column: "archiveReason", pg: `ALTER TABLE "StaffCompensation" ADD COLUMN IF NOT EXISTS "archiveReason" TEXT`, sqlite: `ALTER TABLE "StaffCompensation" ADD COLUMN "archiveReason" TEXT` },
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
  // ★ وصل الاستلام: تاريخ ومكان صدور بطاقة التعريف — عالج P2022 على الإنتاج
  //   (الترحيل 20260921100000 وُسم applied دون تنفيذ فعلي — الذاكِل الذاتي هنا يضمن العمود)
  { table: "Employee", column: "nationalIdIssueDate", pg: `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "nationalIdIssueDate" TIMESTAMP(3)`, sqlite: `ALTER TABLE "Employee" ADD COLUMN "nationalIdIssueDate" DATETIME` },
  { table: "Employee", column: "nationalIdIssuePlace", pg: `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "nationalIdIssuePlace" TEXT`, sqlite: `ALTER TABLE "Employee" ADD COLUMN "nationalIdIssuePlace" TEXT` },
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
  // ★ Multi-Pool Enterprise Architecture
  { table: "Pool", column: "color", pg: `ALTER TABLE "Pool" ADD COLUMN IF NOT EXISTS "color" TEXT DEFAULT '#0284c7'`, sqlite: `ALTER TABLE "Pool" ADD COLUMN "color" TEXT DEFAULT '#0284c7'` },
  { table: "Pool", column: "lanesCount", pg: `ALTER TABLE "Pool" ADD COLUMN IF NOT EXISTS "lanesCount" INTEGER`, sqlite: `ALTER TABLE "Pool" ADD COLUMN "lanesCount" INTEGER` },
  { table: "Pool", column: "lengthMeters", pg: `ALTER TABLE "Pool" ADD COLUMN IF NOT EXISTS "lengthMeters" DOUBLE PRECISION`, sqlite: `ALTER TABLE "Pool" ADD COLUMN "lengthMeters" REAL` },
  { table: "Subscriber", column: "poolId", pg: `ALTER TABLE "Subscriber" ADD COLUMN IF NOT EXISTS "poolId" TEXT`, sqlite: `ALTER TABLE "Subscriber" ADD COLUMN "poolId" TEXT` },
  { table: "Attendance", column: "poolId", pg: `ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "poolId" TEXT`, sqlite: `ALTER TABLE "Attendance" ADD COLUMN "poolId" TEXT` },
  { table: "Attendance", column: "enrollmentId", pg: `ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "enrollmentId" TEXT`, sqlite: `ALTER TABLE "Attendance" ADD COLUMN "enrollmentId" TEXT` },
  { table: "SwimmingTimeSlot", column: "poolId", pg: `ALTER TABLE "SwimmingTimeSlot" ADD COLUMN IF NOT EXISTS "poolId" TEXT`, sqlite: `ALTER TABLE "SwimmingTimeSlot" ADD COLUMN "poolId" TEXT` },
  { table: "PoolClosure", column: "poolId", pg: `ALTER TABLE "PoolClosure" ADD COLUMN IF NOT EXISTS "poolId" TEXT`, sqlite: `ALTER TABLE "PoolClosure" ADD COLUMN "poolId" TEXT` },
  { table: "Compensation", column: "poolId", pg: `ALTER TABLE "Compensation" ADD COLUMN IF NOT EXISTS "poolId" TEXT`, sqlite: `ALTER TABLE "Compensation" ADD COLUMN "poolId" TEXT` },
  { table: "Compensation", column: "enrollmentId", pg: `ALTER TABLE "Compensation" ADD COLUMN IF NOT EXISTS "enrollmentId" TEXT`, sqlite: `ALTER TABLE "Compensation" ADD COLUMN "enrollmentId" TEXT` },
  { table: "Waitlist", column: "poolId", pg: `ALTER TABLE "Waitlist" ADD COLUMN IF NOT EXISTS "poolId" TEXT`, sqlite: `ALTER TABLE "Waitlist" ADD COLUMN "poolId" TEXT` },
  { table: "CardTemplate", column: "poolId", pg: `ALTER TABLE "CardTemplate" ADD COLUMN IF NOT EXISTS "poolId" TEXT`, sqlite: `ALTER TABLE "CardTemplate" ADD COLUMN "poolId" TEXT` },
  { table: "FinancialTransaction", column: "poolId", pg: `ALTER TABLE "FinancialTransaction" ADD COLUMN IF NOT EXISTS "poolId" TEXT`, sqlite: `ALTER TABLE "FinancialTransaction" ADD COLUMN "poolId" TEXT` },
  { table: "FinancialTransaction", column: "enrollmentId", pg: `ALTER TABLE "FinancialTransaction" ADD COLUMN IF NOT EXISTS "enrollmentId" TEXT`, sqlite: `ALTER TABLE "FinancialTransaction" ADD COLUMN "enrollmentId" TEXT` },
  { table: "PoolEnrollment", column: "renewedAt", pg: `ALTER TABLE "PoolEnrollment" ADD COLUMN IF NOT EXISTS "renewedAt" TIMESTAMP(3)`, sqlite: `ALTER TABLE "PoolEnrollment" ADD COLUMN "renewedAt" DATETIME` },
  { table: "PoolEnrollment", column: "renewalCount", pg: `ALTER TABLE "PoolEnrollment" ADD COLUMN IF NOT EXISTS "renewalCount" INTEGER NOT NULL DEFAULT 0`, sqlite: `ALTER TABLE "PoolEnrollment" ADD COLUMN "renewalCount" INTEGER NOT NULL DEFAULT 0` },
  { table: "PoolEnrollment", column: "previousExpiryDate", pg: `ALTER TABLE "PoolEnrollment" ADD COLUMN IF NOT EXISTS "previousExpiryDate" TIMESTAMP(3)`, sqlite: `ALTER TABLE "PoolEnrollment" ADD COLUMN "previousExpiryDate" DATETIME` },
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

  // ★ إصلاح P2028/التكرار: فريد جزئي على سجل العمل النشط
  //   (club + worker + day + start-time) — منع الازدواج على مستوى القاعدة
  //   (سباق النقر المزدوج/طلبان متزامنان = P2002 يُعالَج كاستجابة «مكرر» نظيفة
  //   لا 8 سجلات). الملغى/المرفوض مستثنون → إعادة التسجيل بعد الإلغاء تبقى
  //   مشروعة (سلوك المرحلة 5 — notIn rejected+cancelled). جزئي → مدعوم
  //   على PostgreSQL وSQLite معاً بنفس الصيغة.
  try {
    if (!(await indexExists(db, "WorkHours_active_user_date_start_key"))) {
      const idx = `CREATE UNIQUE INDEX IF NOT EXISTS "WorkHours_active_user_date_start_key" ON "WorkHours"("clubId", "userId", "date", "startTime") WHERE "status" NOT IN ('rejected', 'cancelled')`;
      await db.$executeRawUnsafe(idx).catch(() => undefined);
    }
  } catch { /* الفهرس اختياري — التحقق داخل المعاملة يغطي */ }

  try {
    if (!(await indexExists(db, "WorkHours_active_user_date_slot_key"))) {
      const idx = `CREATE UNIQUE INDEX IF NOT EXISTS "WorkHours_active_user_date_slot_key" ON "WorkHours"("clubId", "userId", "date", "slotId") WHERE "status" NOT IN ('rejected', 'cancelled') AND "slotId" IS NOT NULL`;
      await db.$executeRawUnsafe(idx).catch(() => undefined);
    }
  } catch { /* الفهرس اختياري */ }

  await ensureSubscriberPerformanceIndexes().catch(() => undefined);
  await ensureMultiPoolRuntimeIndexes().catch(() => undefined);

  runtimeDdlDone = true;
}

// ─────────────────────────────────────────────────────────────
// فهارس تعدد المسابح — فريدة جزئية للمسابح والترقيم والانخراط النشط
// ─────────────────────────────────────────────────────────────
let multiPoolIndexesDone = false;

export async function ensureMultiPoolRuntimeIndexes(): Promise<void> {
  if (multiPoolIndexesDone) return;
  const { db } = await import("@/lib/db");

  // 🛡️ إنشاء جدول سجل التجديد PoolEnrollmentRenewal تلقائياً إذا لم يكن موجوداً
  try {
    const tableSql = isSqlite()
      ? `CREATE TABLE IF NOT EXISTS "PoolEnrollmentRenewal" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "clubId" TEXT NOT NULL,
          "poolId" TEXT NOT NULL,
          "subscriberId" TEXT NOT NULL,
          "enrollmentId" TEXT NOT NULL,
          "previousExpiryDate" DATETIME,
          "newExpiryDate" DATETIME NOT NULL,
          "renewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "renewedById" TEXT,
          "subscriptionType" TEXT,
          "months" INTEGER NOT NULL DEFAULT 1,
          "amount" INTEGER,
          "paymentMethod" TEXT,
          "transactionId" TEXT,
          "notes" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`
      : `CREATE TABLE IF NOT EXISTS "PoolEnrollmentRenewal" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "clubId" TEXT NOT NULL,
          "poolId" TEXT NOT NULL,
          "subscriberId" TEXT NOT NULL,
          "enrollmentId" TEXT NOT NULL,
          "previousExpiryDate" TIMESTAMP(3),
          "newExpiryDate" TIMESTAMP(3) NOT NULL,
          "renewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "renewedById" TEXT,
          "subscriptionType" TEXT,
          "months" INTEGER NOT NULL DEFAULT 1,
          "amount" INTEGER,
          "paymentMethod" TEXT,
          "transactionId" TEXT,
          "notes" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`;
    await db.$executeRawUnsafe(tableSql).catch(() => undefined);
  } catch {}

  // 🛡️ معالجة استباقية للتعارضات: إذا وجد انخراط مكرر نشط قديماً، نؤرشف الأقدم لضمان سلامة الفهرس الجزئي
  try {
    await db.$executeRawUnsafe(`
      UPDATE "PoolEnrollment"
      SET "status" = 'archived', "archivedAt" = CURRENT_TIMESTAMP
      WHERE "id" IN (
        SELECT "id" FROM (
          SELECT "id",
                 ROW_NUMBER() OVER (
                   PARTITION BY "clubId", "poolId", "subscriberId"
                   ORDER BY "createdAt" DESC
                 ) as rn
          FROM "PoolEnrollment"
          WHERE "status" = 'active'
        ) sub
        WHERE sub.rn > 1
      )
    `).catch(() => undefined);
  } catch {}

  // 🛡️ معالجة استباقية لتعارض بادئات المسابح: إذا وُجدت مسابح بنفس البادئة بالخطأ، نعدل المتكررة لتفادي فشل الفهرس
  try {
    const duplicatePools = (await db.$queryRawUnsafe(`
      SELECT id, "clubId", "fileNumberPrefix"
      FROM "Pool"
      WHERE "fileNumberPrefix" IS NOT NULL AND "fileNumberPrefix" != ''
      AND id NOT IN (
        SELECT MIN(id)
        FROM "Pool"
        WHERE "fileNumberPrefix" IS NOT NULL AND "fileNumberPrefix" != ''
        GROUP BY "clubId", "fileNumberPrefix"
      )
    `)) as Array<{ id: string; clubId: string; fileNumberPrefix: string }>;

    if (Array.isArray(duplicatePools) && duplicatePools.length > 0) {
      for (let i = 0; i < duplicatePools.length; i++) {
        const dp = duplicatePools[i];
        const newPrefix = `${dp.fileNumberPrefix.slice(0, 3)}${i + 2}`.slice(0, 4);
        await db.$executeRawUnsafe(`UPDATE "Pool" SET "fileNumberPrefix" = '${newPrefix}' WHERE id = '${dp.id}'`).catch(() => undefined);
      }
    }
  } catch {}

  const indexes = [
    {
      name: "PoolEnrollment_active_unique",
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS "PoolEnrollment_active_unique" ON "PoolEnrollment"("clubId", "poolId", "subscriberId") WHERE "status" = 'active'`,
      conditionCheck: "active",
    },
    {
      name: "Pool_club_default_unique_idx",
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS "Pool_club_default_unique_idx" ON "Pool"("clubId") WHERE "isDefault" = 1 OR "isDefault" = true`,
      conditionCheck: "isDefault",
    },
    {
      name: "Pool_club_prefix_unique_idx",
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS "Pool_club_prefix_unique_idx" ON "Pool"("clubId", "fileNumberPrefix") WHERE "fileNumberPrefix" IS NOT NULL AND "fileNumberPrefix" != ''`,
      conditionCheck: "fileNumberPrefix",
    },
    {
      name: "SwimmingTimeSlot_club_global_name_idx",
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS "SwimmingTimeSlot_club_global_name_idx" ON "SwimmingTimeSlot"("clubId", "name") WHERE "poolId" IS NULL`,
      conditionCheck: "poolId",
    },
    {
      name: "CardTemplate_club_global_name_idx",
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS "CardTemplate_club_global_name_idx" ON "CardTemplate"("clubId", "name") WHERE "poolId" IS NULL`,
      conditionCheck: "poolId",
    },
  ];

  for (const idx of indexes) {
    try {
      const isValid = await hasValidPartialIndex(db, idx.name, idx.conditionCheck);
      if (!isValid) {
        // إذا كان هناك فهرس قديم باسم مطابق بدون شرط جزئي، نسقطه أولاً لإعادة بنائه بالشرط الصحيح
        await db.$executeRawUnsafe(`DROP INDEX IF EXISTS "${idx.name}"`).catch(() => undefined);
        await db.$executeRawUnsafe(idx.sql).catch(() => undefined);
      }
    } catch { /* فهرس اختياري */ }
  }
  multiPoolIndexesDone = true;
}

/**
 * فحص عميق للفهرس الجزئي: لا يكتفي بالاسم بل يتحقق من وجود شرط WHERE الفعلي في المخطط
 */
async function hasValidPartialIndex(
  db: { $queryRawUnsafe: (q: string) => Promise<unknown> },
  indexName: string,
  expectedConditionSubstring: string
): Promise<boolean> {
  // PostgreSQL
  if (!isSqlite()) {
    try {
      const rows = (await db.$queryRawUnsafe(
        `SELECT indexdef FROM pg_indexes WHERE indexname = '${indexName}'`
      )) as Array<{ indexdef?: string }>;
      if (Array.isArray(rows) && rows.length > 0) {
        const def = rows[0]?.indexdef?.toLowerCase() || "";
        return def.includes("where") && def.includes(expectedConditionSubstring.toLowerCase());
      }
      return false;
    } catch {
      return false;
    }
  }

  // SQLite
  try {
    const rows = (await db.$queryRawUnsafe(
      `SELECT sql FROM sqlite_master WHERE type='index' AND name = '${indexName}'`
    )) as Array<{ sql?: string }>;
    if (Array.isArray(rows) && rows.length > 0) {
      const sql = rows[0]?.sql?.toLowerCase() || "";
      return sql.includes("where") && sql.includes(expectedConditionSubstring.toLowerCase());
    }
    return false;
  } catch {
    return false;
  }
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

let subscriberIndexesDone = false;

export async function ensureSubscriberPerformanceIndexes(): Promise<void> {
  if (subscriberIndexesDone) return;
  const { db } = await import("@/lib/db");
  const indexes = [
    { name: "Subscriber_clubId_fileNumber_idx", cols: `"clubId", "fileNumber"` },
    { name: "Subscriber_clubId_createdAt_idx", cols: `"clubId", "createdAt"` },
    { name: "Subscriber_clubId_lastPaymentDate_idx", cols: `"clubId", "lastPaymentDate"` },
    { name: "Subscriber_clubId_names_idx", cols: `"clubId", "lastName", "firstName"` },
    { name: "Subscriber_clubId_deletedAt_idx", cols: `"clubId", "deletedAt"` },
  ];
  for (const idx of indexes) {
    try {
      if (!(await indexExists(db, idx.name))) {
        await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "${idx.name}" ON "Subscriber"(${idx.cols})`).catch(() => undefined);
      }
    } catch {}
  }
  subscriberIndexesDone = true;
}

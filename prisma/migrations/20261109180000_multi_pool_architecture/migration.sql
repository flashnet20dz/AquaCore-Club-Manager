-- ═══════════════════════════════════════════════════════════
-- MULTI-POOL ENTERPRISE ARCHITECTURE MIGRATION (SAFE & IDEMPOTENT)
-- Zero Data Loss: Additive DDL only, no data deletion or column drops.
-- ═══════════════════════════════════════════════════════════

-- Helper function for idempotent foreign key addition
CREATE OR REPLACE FUNCTION _aquacore_add_fk_if_not_exists(
    _tbl TEXT,
    _con_name TEXT,
    _con_def TEXT
) RETURNS VOID AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = _con_name
    ) THEN
        EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I %s', _tbl, _con_name, _con_def);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 1. Create Pool Table
CREATE TABLE IF NOT EXISTS "Pool" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "fileNumberPrefix" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'active',
    "capacity" INTEGER NOT NULL DEFAULT 100,
    "color" TEXT DEFAULT '#0284c7',
    "lanesCount" INTEGER,
    "lengthMeters" DOUBLE PRECISION,
    "address" TEXT,
    "phone" TEXT,
    "description" TEXT,
    "archivedAt" TIMESTAMP(3),
    "archivedById" TEXT,
    "archiveReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pool_pkey" PRIMARY KEY ("id")
);

-- Ensure UI visual columns exist if Pool was created by runtime heal earlier
ALTER TABLE "Pool" ADD COLUMN IF NOT EXISTS "color" TEXT DEFAULT '#0284c7';
ALTER TABLE "Pool" ADD COLUMN IF NOT EXISTS "lanesCount" INTEGER;
ALTER TABLE "Pool" ADD COLUMN IF NOT EXISTS "lengthMeters" DOUBLE PRECISION;

-- 2. Create PoolEnrollment Table
CREATE TABLE IF NOT EXISTS "PoolEnrollment" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "fileNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "subscriptionType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" TIMESTAMP(3),
    "lastPaymentDate" TIMESTAMP(3),
    "paymentStatus" TEXT NOT NULL,
    "isExempt" BOOLEAN NOT NULL DEFAULT false,
    "swimmingDays" TEXT,
    "timeSlot" TEXT,
    "notes" TEXT,
    "renewedAt" TIMESTAMP(3),
    "renewalCount" INTEGER NOT NULL DEFAULT 0,
    "previousExpiryDate" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoolEnrollment_pkey" PRIMARY KEY ("id")
);

-- 2.1 Create PoolEnrollmentRenewal Table
CREATE TABLE IF NOT EXISTS "PoolEnrollmentRenewal" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoolEnrollmentRenewal_pkey" PRIMARY KEY ("id")
);

-- 3. Create PoolNumberCounter Table
CREATE TABLE IF NOT EXISTS "PoolNumberCounter" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "numberingGroup" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoolNumberCounter_pkey" PRIMARY KEY ("id")
);

-- 4. Create MembershipCard Table
CREATE TABLE IF NOT EXISTS "MembershipCard" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "templateId" TEXT,
    "cardUid" TEXT NOT NULL,
    "cardNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" TIMESTAMP(3),
    "printedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "revokedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipCard_pkey" PRIMARY KEY ("id")
);

-- 5. Create FileNumberHistory Table
CREATE TABLE IF NOT EXISTS "FileNumberHistory" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "poolId" TEXT NOT NULL,
    "oldFileNumber" TEXT NOT NULL,
    "newFileNumber" TEXT NOT NULL,
    "reason" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileNumberHistory_pkey" PRIMARY KEY ("id")
);

-- 6. Create SubscriberTransfer Table
CREATE TABLE IF NOT EXISTS "SubscriberTransfer" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "sourcePoolId" TEXT NOT NULL,
    "targetPoolId" TEXT NOT NULL,
    "sourceEnrollmentId" TEXT,
    "targetEnrollmentId" TEXT,
    "transferFileNumber" BOOLEAN NOT NULL DEFAULT false,
    "oldFileNumber" TEXT NOT NULL,
    "newFileNumber" TEXT NOT NULL,
    "reason" TEXT,
    "transferredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriberTransfer_pkey" PRIMARY KEY ("id")
);

-- 7. Add nullable Multi-Pool columns to existing tables (non-destructive)
ALTER TABLE "Subscriber" ADD COLUMN IF NOT EXISTS "poolId" TEXT;
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "poolId" TEXT;
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "enrollmentId" TEXT;
ALTER TABLE "SwimmingTimeSlot" ADD COLUMN IF NOT EXISTS "poolId" TEXT;
ALTER TABLE "PoolClosure" ADD COLUMN IF NOT EXISTS "poolId" TEXT;
ALTER TABLE "Compensation" ADD COLUMN IF NOT EXISTS "poolId" TEXT;
ALTER TABLE "Compensation" ADD COLUMN IF NOT EXISTS "enrollmentId" TEXT;
ALTER TABLE "Waitlist" ADD COLUMN IF NOT EXISTS "poolId" TEXT;
ALTER TABLE "CardTemplate" ADD COLUMN IF NOT EXISTS "poolId" TEXT;
ALTER TABLE "FinancialTransaction" ADD COLUMN IF NOT EXISTS "poolId" TEXT;
ALTER TABLE "FinancialTransaction" ADD COLUMN IF NOT EXISTS "enrollmentId" TEXT;

-- 8. Transition SwimmingTimeSlot & CardTemplate unique constraints from single-pool to multi-pool
DROP INDEX IF EXISTS "SwimmingTimeSlot_clubId_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "SwimmingTimeSlot_clubId_poolId_name_key" ON "SwimmingTimeSlot"("clubId", "poolId", "name");

DROP INDEX IF EXISTS "CardTemplate_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "CardTemplate_clubId_poolId_name_key" ON "CardTemplate"("clubId", "poolId", "name");

-- 9. Unique Constraints & Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Pool_clubId_code_key" ON "Pool"("clubId", "code");
CREATE INDEX IF NOT EXISTS "Pool_clubId_idx" ON "Pool"("clubId");
CREATE INDEX IF NOT EXISTS "Pool_clubId_active_idx" ON "Pool"("clubId", "active");
CREATE INDEX IF NOT EXISTS "Pool_clubId_isDefault_idx" ON "Pool"("clubId", "isDefault");

-- Deduplication safeguard before partial unique index creation
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
);

CREATE UNIQUE INDEX IF NOT EXISTS "PoolEnrollment_clubId_poolId_fileNumber_key" ON "PoolEnrollment"("clubId", "poolId", "fileNumber");
CREATE INDEX IF NOT EXISTS "PoolEnrollment_clubId_poolId_subscriberId_idx" ON "PoolEnrollment"("clubId", "poolId", "subscriberId");
CREATE INDEX IF NOT EXISTS "PoolEnrollment_clubId_poolId_subscriberId_status_idx" ON "PoolEnrollment"("clubId", "poolId", "subscriberId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "PoolEnrollment_active_unique" ON "PoolEnrollment"("clubId", "poolId", "subscriberId") WHERE "status" = 'active';
CREATE INDEX IF NOT EXISTS "PoolEnrollment_clubId_poolId_idx" ON "PoolEnrollment"("clubId", "poolId");
CREATE INDEX IF NOT EXISTS "PoolEnrollment_subscriberId_idx" ON "PoolEnrollment"("subscriberId");
CREATE INDEX IF NOT EXISTS "PoolEnrollment_clubId_fileNumber_idx" ON "PoolEnrollment"("clubId", "fileNumber");
CREATE INDEX IF NOT EXISTS "PoolEnrollment_status_idx" ON "PoolEnrollment"("status");

CREATE INDEX IF NOT EXISTS "PoolEnrollmentRenewal_clubId_enrollmentId_idx" ON "PoolEnrollmentRenewal"("clubId", "enrollmentId");
CREATE INDEX IF NOT EXISTS "PoolEnrollmentRenewal_clubId_poolId_idx" ON "PoolEnrollmentRenewal"("clubId", "poolId");
CREATE INDEX IF NOT EXISTS "PoolEnrollmentRenewal_clubId_subscriberId_idx" ON "PoolEnrollmentRenewal"("clubId", "subscriberId");
CREATE INDEX IF NOT EXISTS "PoolEnrollmentRenewal_renewedAt_idx" ON "PoolEnrollmentRenewal"("renewedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "PoolNumberCounter_clubId_poolId_numberingGroup_key" ON "PoolNumberCounter"("clubId", "poolId", "numberingGroup");
CREATE INDEX IF NOT EXISTS "PoolNumberCounter_clubId_poolId_idx" ON "PoolNumberCounter"("clubId", "poolId");

CREATE UNIQUE INDEX IF NOT EXISTS "MembershipCard_cardUid_key" ON "MembershipCard"("cardUid");
CREATE INDEX IF NOT EXISTS "MembershipCard_clubId_poolId_idx" ON "MembershipCard"("clubId", "poolId");
CREATE INDEX IF NOT EXISTS "MembershipCard_enrollmentId_idx" ON "MembershipCard"("enrollmentId");
CREATE INDEX IF NOT EXISTS "MembershipCard_subscriberId_idx" ON "MembershipCard"("subscriberId");
CREATE INDEX IF NOT EXISTS "MembershipCard_cardUid_idx" ON "MembershipCard"("cardUid");

CREATE INDEX IF NOT EXISTS "FileNumberHistory_clubId_subscriberId_idx" ON "FileNumberHistory"("clubId", "subscriberId");
CREATE INDEX IF NOT EXISTS "FileNumberHistory_clubId_poolId_idx" ON "FileNumberHistory"("clubId", "poolId");

CREATE INDEX IF NOT EXISTS "SubscriberTransfer_clubId_subscriberId_idx" ON "SubscriberTransfer"("clubId", "subscriberId");

CREATE INDEX IF NOT EXISTS "Subscriber_clubId_poolId_idx" ON "Subscriber"("clubId", "poolId");
CREATE INDEX IF NOT EXISTS "Attendance_clubId_poolId_date_idx" ON "Attendance"("clubId", "poolId", "date");
CREATE INDEX IF NOT EXISTS "Attendance_clubId_enrollmentId_idx" ON "Attendance"("clubId", "enrollmentId");
CREATE INDEX IF NOT EXISTS "SwimmingTimeSlot_clubId_poolId_idx" ON "SwimmingTimeSlot"("clubId", "poolId");
CREATE INDEX IF NOT EXISTS "PoolClosure_clubId_poolId_idx" ON "PoolClosure"("clubId", "poolId");
CREATE INDEX IF NOT EXISTS "Compensation_clubId_poolId_idx" ON "Compensation"("clubId", "poolId");
CREATE INDEX IF NOT EXISTS "Compensation_enrollmentId_idx" ON "Compensation"("enrollmentId");
CREATE INDEX IF NOT EXISTS "Waitlist_clubId_poolId_idx" ON "Waitlist"("clubId", "poolId");
CREATE INDEX IF NOT EXISTS "CardTemplate_clubId_poolId_idx" ON "CardTemplate"("clubId", "poolId");
CREATE INDEX IF NOT EXISTS "FinancialTransaction_clubId_poolId_idx" ON "FinancialTransaction"("clubId", "poolId");

-- 10. Partial Unique Indexes for NULL poolId handling
CREATE UNIQUE INDEX IF NOT EXISTS "SwimmingTimeSlot_club_global_name_idx" ON "SwimmingTimeSlot"("clubId", "name") WHERE "poolId" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "CardTemplate_club_global_name_idx" ON "CardTemplate"("clubId", "name") WHERE "poolId" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Pool_club_default_unique_idx" ON "Pool"("clubId") WHERE "isDefault" = true;
CREATE UNIQUE INDEX IF NOT EXISTS "Pool_club_prefix_unique_idx" ON "Pool"("clubId", "fileNumberPrefix") WHERE "fileNumberPrefix" IS NOT NULL AND "fileNumberPrefix" != '';

-- 11. Idempotent Foreign Keys
SELECT _aquacore_add_fk_if_not_exists('Pool', 'Pool_clubId_fkey', 'FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE');

SELECT _aquacore_add_fk_if_not_exists('PoolEnrollment', 'PoolEnrollment_clubId_fkey', 'FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT _aquacore_add_fk_if_not_exists('PoolEnrollment', 'PoolEnrollment_poolId_fkey', 'FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT _aquacore_add_fk_if_not_exists('PoolEnrollment', 'PoolEnrollment_subscriberId_fkey', 'FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE');

SELECT _aquacore_add_fk_if_not_exists('PoolNumberCounter', 'PoolNumberCounter_clubId_fkey', 'FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT _aquacore_add_fk_if_not_exists('PoolNumberCounter', 'PoolNumberCounter_poolId_fkey', 'FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE');

SELECT _aquacore_add_fk_if_not_exists('MembershipCard', 'MembershipCard_clubId_fkey', 'FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT _aquacore_add_fk_if_not_exists('MembershipCard', 'MembershipCard_poolId_fkey', 'FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT _aquacore_add_fk_if_not_exists('MembershipCard', 'MembershipCard_subscriberId_fkey', 'FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT _aquacore_add_fk_if_not_exists('MembershipCard', 'MembershipCard_enrollmentId_fkey', 'FOREIGN KEY ("enrollmentId") REFERENCES "PoolEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE');

SELECT _aquacore_add_fk_if_not_exists('FileNumberHistory', 'FileNumberHistory_clubId_fkey', 'FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT _aquacore_add_fk_if_not_exists('FileNumberHistory', 'FileNumberHistory_subscriberId_fkey', 'FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT _aquacore_add_fk_if_not_exists('FileNumberHistory', 'FileNumberHistory_poolId_fkey', 'FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT _aquacore_add_fk_if_not_exists('FileNumberHistory', 'FileNumberHistory_enrollmentId_fkey', 'FOREIGN KEY ("enrollmentId") REFERENCES "PoolEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE');

SELECT _aquacore_add_fk_if_not_exists('SubscriberTransfer', 'SubscriberTransfer_clubId_fkey', 'FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT _aquacore_add_fk_if_not_exists('SubscriberTransfer', 'SubscriberTransfer_subscriberId_fkey', 'FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT _aquacore_add_fk_if_not_exists('SubscriberTransfer', 'SubscriberTransfer_sourcePoolId_fkey', 'FOREIGN KEY ("sourcePoolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT _aquacore_add_fk_if_not_exists('SubscriberTransfer', 'SubscriberTransfer_targetPoolId_fkey', 'FOREIGN KEY ("targetPoolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT _aquacore_add_fk_if_not_exists('SubscriberTransfer', 'SubscriberTransfer_sourceEnrollmentId_fkey', 'FOREIGN KEY ("sourceEnrollmentId") REFERENCES "PoolEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE');
SELECT _aquacore_add_fk_if_not_exists('SubscriberTransfer', 'SubscriberTransfer_targetEnrollmentId_fkey', 'FOREIGN KEY ("targetEnrollmentId") REFERENCES "PoolEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE');

SELECT _aquacore_add_fk_if_not_exists('Subscriber', 'Subscriber_poolId_fkey', 'FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE SET NULL ON UPDATE CASCADE');
SELECT _aquacore_add_fk_if_not_exists('Attendance', 'Attendance_poolId_fkey', 'FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE SET NULL ON UPDATE CASCADE');
SELECT _aquacore_add_fk_if_not_exists('Attendance', 'Attendance_enrollmentId_fkey', 'FOREIGN KEY ("enrollmentId") REFERENCES "PoolEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE');
SELECT _aquacore_add_fk_if_not_exists('SwimmingTimeSlot', 'SwimmingTimeSlot_poolId_fkey', 'FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT _aquacore_add_fk_if_not_exists('PoolClosure', 'PoolClosure_poolId_fkey', 'FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT _aquacore_add_fk_if_not_exists('Compensation', 'Compensation_poolId_fkey', 'FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE SET NULL ON UPDATE CASCADE');
SELECT _aquacore_add_fk_if_not_exists('Compensation', 'Compensation_enrollmentId_fkey', 'FOREIGN KEY ("enrollmentId") REFERENCES "PoolEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE');
SELECT _aquacore_add_fk_if_not_exists('Waitlist', 'Waitlist_poolId_fkey', 'FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT _aquacore_add_fk_if_not_exists('CardTemplate', 'CardTemplate_poolId_fkey', 'FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT _aquacore_add_fk_if_not_exists('FinancialTransaction', 'FinancialTransaction_poolId_fkey', 'FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE SET NULL ON UPDATE CASCADE');
SELECT _aquacore_add_fk_if_not_exists('FinancialTransaction', 'FinancialTransaction_enrollmentId_fkey', 'FOREIGN KEY ("enrollmentId") REFERENCES "PoolEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE');

SELECT _aquacore_add_fk_if_not_exists('PoolEnrollmentRenewal', 'PoolEnrollmentRenewal_clubId_fkey', 'FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT _aquacore_add_fk_if_not_exists('PoolEnrollmentRenewal', 'PoolEnrollmentRenewal_poolId_fkey', 'FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT _aquacore_add_fk_if_not_exists('PoolEnrollmentRenewal', 'PoolEnrollmentRenewal_subscriberId_fkey', 'FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT _aquacore_add_fk_if_not_exists('PoolEnrollmentRenewal', 'PoolEnrollmentRenewal_enrollmentId_fkey', 'FOREIGN KEY ("enrollmentId") REFERENCES "PoolEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE');

DROP FUNCTION IF EXISTS _aquacore_add_fk_if_not_exists(TEXT, TEXT, TEXT);

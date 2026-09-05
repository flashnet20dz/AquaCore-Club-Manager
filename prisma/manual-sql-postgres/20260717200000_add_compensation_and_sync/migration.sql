-- Migration: Add pool-closure/compensation feature + hybrid sync engine
-- Date: 2026-07-17
-- Description: يضيف الأعمدة والجداول الناقصة على قاعدة بيانات Neon الإنتاجية.
-- آمن للتشغيل: كل الأوامر IF NOT EXISTS / ADD COLUMN IF NOT EXISTS — لا يمس أي بيانات موجودة.
-- شغّل هذا الملف كامل على Neon (SQL Editor) أو عبر psql.

-- ═══════════════════════════════════════════════════════════
-- 1) أعمدة ناقصة على جداول موجودة (سبب أخطاء 500 الحالية)
-- ═══════════════════════════════════════════════════════════
ALTER TABLE "Subscriber" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Attendance"  ADD COLUMN IF NOT EXISTS "isCompensation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Club"        ADD COLUMN IF NOT EXISTS "syncApiKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Club_syncApiKey_key" ON "Club"("syncApiKey");

-- ═══════════════════════════════════════════════════════════
-- 2) جدول PoolClosure (إغلاق المسبح للصيانة)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "PoolClosure" (
    "id"            TEXT NOT NULL,
    "clubId"        TEXT NOT NULL,
    "date"          TIMESTAMP(3) NOT NULL,
    "swimmingDays"  TEXT,
    "timeSlot"      TEXT,
    "reason"        TEXT NOT NULL,
    "note"          TEXT,
    "createdById"   TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoolClosure_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PoolClosure_clubId_date_idx" ON "PoolClosure"("clubId", "date");

DO $$ BEGIN
  ALTER TABLE "PoolClosure"
    ADD CONSTRAINT "PoolClosure_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ═══════════════════════════════════════════════════════════
-- 3) جدول Compensation (تعويضات المنخرطين)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "Compensation" (
    "id"                        TEXT NOT NULL,
    "clubId"                    TEXT NOT NULL,
    "closureId"                 TEXT,
    "subscriberId"              TEXT NOT NULL,
    "originalDate"              TIMESTAMP(3) NOT NULL,
    "originalSwimmingDays"      TEXT,
    "originalTimeSlot"          TEXT,
    "status"                    TEXT NOT NULL DEFAULT 'pending',
    "compensationDate"          TIMESTAMP(3),
    "compensationSwimmingDays"  TEXT,
    "compensationTimeSlot"      TEXT,
    "notifiedAt"                TIMESTAMP(3),
    "usedAt"                    TIMESTAMP(3),
    "attendanceId"              TEXT,
    "note"                      TEXT,
    "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                 TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Compensation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Compensation_attendanceId_key" ON "Compensation"("attendanceId");
CREATE INDEX IF NOT EXISTS "Compensation_clubId_status_idx" ON "Compensation"("clubId", "status");
CREATE INDEX IF NOT EXISTS "Compensation_clubId_subscriberId_idx" ON "Compensation"("clubId", "subscriberId");
CREATE INDEX IF NOT EXISTS "Compensation_closureId_idx" ON "Compensation"("closureId");

DO $$ BEGIN
  ALTER TABLE "Compensation"
    ADD CONSTRAINT "Compensation_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Compensation"
    ADD CONSTRAINT "Compensation_closureId_fkey"
    FOREIGN KEY ("closureId") REFERENCES "PoolClosure"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Compensation"
    ADD CONSTRAINT "Compensation_subscriberId_fkey"
    FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Compensation"
    ADD CONSTRAINT "Compensation_attendanceId_fkey"
    FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ═══════════════════════════════════════════════════════════
-- 4) جداول محرك المزامنة (SyncOutbox / SyncMeta)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "SyncOutbox" (
    "id"          TEXT NOT NULL,
    "clubId"      TEXT NOT NULL,
    "modelName"   TEXT NOT NULL,
    "recordId"    TEXT NOT NULL,
    "operation"   TEXT NOT NULL,
    "payload"     TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced"      BOOLEAN NOT NULL DEFAULT false,
    "syncedAt"    TIMESTAMP(3),

    CONSTRAINT "SyncOutbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SyncOutbox_clubId_synced_idx" ON "SyncOutbox"("clubId", "synced");

DO $$ BEGIN
  ALTER TABLE "SyncOutbox"
    ADD CONSTRAINT "SyncOutbox_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "SyncMeta" (
    "id"          TEXT NOT NULL DEFAULT 'singleton',
    "lastPullAt"  TIMESTAMP(3),
    "deviceId"    TEXT NOT NULL,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncMeta_pkey" PRIMARY KEY ("id")
);

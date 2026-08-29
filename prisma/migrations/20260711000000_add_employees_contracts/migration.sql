-- Migration: Add Employee, EmploymentContract, ContractTemplate tables
-- Date: 2026-07-11
-- Description: Add employee management and employment contracts feature
-- Run this on Neon database to add the new tables without affecting existing data

-- ═══════════════════════════════════════════════════════════
-- CONTRACT TEMPLATES (قوالب العقود)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "ContractTemplate" (
    "id"              TEXT NOT NULL,
    "clubId"          TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "code"            TEXT NOT NULL,
    "description"     TEXT,
    "content"         TEXT NOT NULL,
    "defaultDuration" INTEGER NOT NULL DEFAULT 365,
    "active"          BOOLEAN NOT NULL DEFAULT true,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractTemplate_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint: clubId + code
CREATE UNIQUE INDEX IF NOT EXISTS "ContractTemplate_clubId_code_key" ON "ContractTemplate"("clubId", "code");
CREATE INDEX IF NOT EXISTS "ContractTemplate_clubId_idx" ON "ContractTemplate"("clubId");

-- Add foreign key to Club
ALTER TABLE "ContractTemplate"
  ADD CONSTRAINT "ContractTemplate_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE;

-- ═══════════════════════════════════════════════════════════
-- EMPLOYEES (العمال)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "Employee" (
    "id"              TEXT NOT NULL,
    "clubId"          TEXT NOT NULL,
    "userId"          TEXT,
    "firstName"       TEXT NOT NULL,
    "lastName"        TEXT NOT NULL,
    "birthDate"       TIMESTAMP(3),
    "birthPlace"      TEXT,
    "address"         TEXT,
    "phone"           TEXT,
    "nationalId"      TEXT,
    "position"        TEXT NOT NULL,
    "hireDate"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hourRate"        INTEGER NOT NULL DEFAULT 200,
    "active"          BOOLEAN NOT NULL DEFAULT true,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: clubId + nationalId
CREATE UNIQUE INDEX IF NOT EXISTS "Employee_clubId_nationalId_key" ON "Employee"("clubId", "nationalId");
CREATE INDEX IF NOT EXISTS "Employee_clubId_idx" ON "Employee"("clubId");
CREATE INDEX IF NOT EXISTS "Employee_clubId_position_idx" ON "Employee"("clubId", "position");

-- Foreign keys
ALTER TABLE "Employee"
  ADD CONSTRAINT "Employee_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE;

ALTER TABLE "Employee"
  ADD CONSTRAINT "Employee_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════════
-- EMPLOYMENT CONTRACTS (عقود العمل)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "EmploymentContract" (
    "id"              TEXT NOT NULL,
    "clubId"          TEXT NOT NULL,
    "employeeId"      TEXT NOT NULL,
    "templateId"      TEXT,
    "contractNumber"  TEXT NOT NULL,
    "position"        TEXT NOT NULL,
    "startDate"       TIMESTAMP(3) NOT NULL,
    "endDate"         TIMESTAMP(3),
    "hourRate"        INTEGER NOT NULL DEFAULT 200,
    "monthlySalary"   INTEGER,
    "workSchedule"    TEXT,
    "content"         TEXT NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'active',
    "version"         INTEGER NOT NULL DEFAULT 1,
    "notes"           TEXT,
    "createdBy"       TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmploymentContract_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: clubId + contractNumber
CREATE UNIQUE INDEX IF NOT EXISTS "EmploymentContract_clubId_contractNumber_key" ON "EmploymentContract"("clubId", "contractNumber");
CREATE INDEX IF NOT EXISTS "EmploymentContract_clubId_employeeId_idx" ON "EmploymentContract"("clubId", "employeeId");
CREATE INDEX IF NOT EXISTS "EmploymentContract_clubId_status_idx" ON "EmploymentContract"("clubId", "status");

-- Foreign keys
ALTER TABLE "EmploymentContract"
  ADD CONSTRAINT "EmploymentContract_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE;

ALTER TABLE "EmploymentContract"
  ADD CONSTRAINT "EmploymentContract_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE;

ALTER TABLE "EmploymentContract"
  ADD CONSTRAINT "EmploymentContract_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "ContractTemplate"("id") ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════════
-- Update existing Club and User tables (add back-relations)
-- Note: Prisma relations don't require schema changes to existing tables,
-- they're virtual relations resolved via foreign keys on the child tables.
-- ═══════════════════════════════════════════════════════════

-- Verification queries (optional, run to confirm):
-- SELECT COUNT(*) FROM "ContractTemplate";
-- SELECT COUNT(*) FROM "Employee";
-- SELECT COUNT(*) FROM "EmploymentContract";

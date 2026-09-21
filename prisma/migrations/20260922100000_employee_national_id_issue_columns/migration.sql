-- Migration: Employee — حقول وصل الاستلام (ضمان فعلي بعد وسم 20260921100000 applied دون تنفيذ)
-- Date: 2026-09-22
-- Description: إعادة تطبيق آمنة (IF NOT EXISTS) لعمودي تاريخ ومكان صدور بطاقة التعريف
--              اللذين يُطبعان آلياً في «وصل استلام مستحقات مالية» ويكتبان عند إضافة عامل.

ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "nationalIdIssueDate" TIMESTAMP(3);
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "nationalIdIssuePlace" TEXT;

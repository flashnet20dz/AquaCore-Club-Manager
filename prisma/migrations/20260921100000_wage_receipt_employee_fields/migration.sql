-- Migration: Employee — حقول وصل الاستلام (تاريخ ومكان صدور بطاقة التعريف)
-- Date: 2026-09-21
-- Description: تُطبع آلياً في «وصل استلام مستحقات مالية» عند تسديد أجور العمال.
--              عمودان اختياريان (nullable) — لا يكسران السجلات القائمة.

ALTER TABLE "Employee" ADD COLUMN "nationalIdIssueDate" TIMESTAMP(3);
ALTER TABLE "Employee" ADD COLUMN "nationalIdIssuePlace" TEXT;

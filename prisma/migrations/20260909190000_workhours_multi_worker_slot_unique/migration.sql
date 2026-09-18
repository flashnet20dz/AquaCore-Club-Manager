-- Migration: WorkHours — فهرس فريد جزئي لحماية تسجيل الحصة للعامل (slotId)
-- Date: 2026-09-09
-- Description: يمنع تكرار نفس الحصة (slotId) لنفس العامل في نفس اليوم على السجلات النشطة.
--              العمليات الملغاة والمرفوضة مستثناة للسماح بإعادة التسجيل بعد الإلغاء.

CREATE UNIQUE INDEX IF NOT EXISTS "WorkHours_active_user_date_slot_key"
ON "WorkHours"("clubId", "userId", "date", "slotId")
WHERE "status" NOT IN ('rejected', 'cancelled') AND "slotId" IS NOT NULL;

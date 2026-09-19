-- Migration: WorkHours — فريد جزئي ضد ازدواج تسجيل الحصة (إصلاح P2028/التكرار)
-- Date: 2026-06-09
-- Description: فهرس فريد جزئي (club + worker + day + start-time) على السجلات
--              النشطة فقط. الملغى/المرفوض مستثنون (WHERE) كي تبقى إعادة تسجيل
--              حصة بعد إلغائها/رفضها مشروعة (سلوك المرحلة 5 المثبت).
--              الجزئية مدعومة على PostgreSQL وSQLite بنفس الصيغة تماماً.
-- Target: Neon PostgreSQL (production) — idempotent (IF NOT EXISTS).
-- ملاحظة: يُضاف أيضاً ذاتياً عبر runtime-schema.ts (ensureRuntimeColumns)
--         للأنظمة التي لا تشغّل migrate deploy (نمط المشروع المثبت).

CREATE UNIQUE INDEX IF NOT EXISTS "WorkHours_active_user_date_start_key"
ON "WorkHours"("clubId", "userId", "date", "startTime")
WHERE "status" NOT IN ('rejected', 'cancelled');

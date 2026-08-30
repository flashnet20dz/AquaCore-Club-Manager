/**
 * ═══════════════════════════════════════════════════════════════
 *  البذر الافتراضي للإعدادات المرتبطة بالميزات (Feature Defaults)
 * ═══════════════════════════════════════════════════════════════
 *
 *  المشكلة الأصلية: أيام السباحة كانت تُبذر فقط في seed-demo.ts،
 *  لذا كل نادٍ حقيقي جديد (تسجيل /api/clubs/register) يرى قسم
 *  "أيام السباحة" فارغاً في الإعدادات ← نموذج المنخرط بلا خيارات.
 *
 *  الحل: بذر تلقائي (idempotent) عند أول قراءة أو عند إنشاء النادي.
 *
 *  🩺 الشفاء الذاتي (v2): العلم swimDefaultsSeeded لم يعد يمنع بذر
 *  جدول فارغ — أي جدول (أيام/توقيتات) فارغ تماماً يُبذر تلقائياً.
 *  هذا يعالج النوادي القديمة التي حُدد علمها قبل تغطية التوقيتات
 *  (شكوى: «توقيتات السباحة غير موجودة في الإعدادات» بينما الأيام موجودة).
 *  حذف المدير المتعمد لكل الصفوف سيعيد البذر — الأسلوب الموصى به
 *  للإغلاق هو «غير فعّال» وليس الحذف.
 */

import type { PrismaClient } from "@prisma/client";

/** أيام السباحة الافتراضية (7 أيام — السبت مغلق افتراضياً) */
export const DEFAULT_SWIM_DAYS: {
  name: string; shortName: string; color: string; active: boolean;
}[] = [
  { name: "الأحد",    shortName: "أح",    color: "#0d9488", active: true },
  { name: "الاثنين",  shortName: "اث",    color: "#0f766e", active: true },
  { name: "الثلاثاء", shortName: "ثل",    color: "#14b8a6", active: true },
  { name: "الأربعاء", shortName: "أر",    color: "#0d9488", active: true },
  { name: "الخميس",   shortName: "خم",    color: "#0f766e", active: true },
  { name: "الجمعة",   shortName: "جم",    color: "#14b8a6", active: true },
  { name: "السبت",    shortName: "سب",    color: "#64748b", active: false },
];

/**
 * توقيتات السباحة الافتراضية — سلسلة ساعية كاملة 09:00 → 22:00
 * (13 فترة) لتغطية العمل الفعلي للنوادي: صباحي / ظهيرة / مسائي / ليلي.
 */
export const DEFAULT_SWIM_SLOTS: {
  name: string; startTime: string; endTime: string; maxCapacity: number; active: boolean;
}[] = [
  { name: "صباحي 1",  startTime: "09:00", endTime: "10:00", maxCapacity: 30, active: true },
  { name: "صباحي 2",  startTime: "10:00", endTime: "11:00", maxCapacity: 30, active: true },
  { name: "صباحي 3",  startTime: "11:00", endTime: "12:00", maxCapacity: 30, active: true },
  { name: "ظهيرة 1",  startTime: "12:00", endTime: "13:00", maxCapacity: 30, active: true },
  { name: "ظهيرة 2",  startTime: "13:00", endTime: "14:00", maxCapacity: 30, active: true },
  { name: "ظهيرة 3",  startTime: "14:00", endTime: "15:00", maxCapacity: 30, active: true },
  { name: "مسائي 1",  startTime: "15:00", endTime: "16:00", maxCapacity: 30, active: true },
  { name: "مسائي 2",  startTime: "16:00", endTime: "17:00", maxCapacity: 30, active: true },
  { name: "مسائي 3",  startTime: "17:00", endTime: "18:00", maxCapacity: 30, active: true },
  { name: "مسائي 4",  startTime: "18:00", endTime: "19:00", maxCapacity: 30, active: true },
  { name: "ليلي 1",   startTime: "19:00", endTime: "20:00", maxCapacity: 30, active: true },
  { name: "ليلي 2",   startTime: "20:00", endTime: "21:00", maxCapacity: 30, active: true },
  { name: "ليلي 3",   startTime: "21:00", endTime: "22:00", maxCapacity: 30, active: true },
];

/** مفتاح العلم في جدول Setting — للتوثيق والتشخيص فقط (لم يعد يحجب البذر) */
const SEED_FLAG = "swimDefaultsSeeded";

async function hasSeedFlag(db: PrismaClient, clubId: string): Promise<boolean> {
  const flag = await db.setting.findUnique({
    where: { clubId_key: { clubId, key: SEED_FLAG } },
  });
  return Boolean(flag);
}

async function setSeedFlag(db: PrismaClient, clubId: string): Promise<void> {
  await db.setting.upsert({
    where: { clubId_key: { clubId, key: SEED_FLAG } },
    update: { value: "true" },
    create: { clubId, key: SEED_FLAG, value: "true" },
  });
}

/**
 * بذر أيام السباحة والتوقيتات الافتراضية لنادٍ — شفاء ذاتي:
 * كل جدول فارغ تماماً يُبذر تلقائياً حتى لو سبق تحديد العلم.
 * @param force يُحدّث قيمة العلم (زر الاستعادة) — لا يغير منطق البذر
 * @returns عدد الصفوف المُنشأة
 */
export async function ensureSwimDefaults(
  db: PrismaClient,
  clubId: string,
  force = false
): Promise<{ seeded: boolean; days: number; slots: number; hadFlag: boolean }> {
  const hadFlag = await hasSeedFlag(db, clubId);

  const [dayCount, slotCount] = await Promise.all([
    db.swimmingDay.count({ where: { clubId } }),
    db.swimmingTimeSlot.count({ where: { clubId } }),
  ]);

  let days = 0, slots = 0;

  if (dayCount === 0) {
    const res = await db.swimmingDay.createMany({
      data: DEFAULT_SWIM_DAYS.map((d, i) => ({ ...d, sortOrder: i, clubId })),
    });
    days = res.count;
  }

  if (slotCount === 0) {
    const res = await db.swimmingTimeSlot.createMany({
      data: DEFAULT_SWIM_SLOTS.map((s, i) => ({ ...s, sortOrder: i, clubId })),
    });
    slots = res.count;
  }

  if (!hadFlag || force) await setSeedFlag(db, clubId);
  return { seeded: days + slots > 0, days, slots, hadFlag };
}

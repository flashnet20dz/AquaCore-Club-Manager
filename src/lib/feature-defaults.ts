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
 *  نستخدم علم Setting خاص (swimDefaultsSeeded) حتى لا نُعيد إنشاء
 *  الأيام التي حذفها المدير عمداً بعد أول تشغيل.
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

/** توقيتات السباحة الافتراضية */
export const DEFAULT_SWIM_SLOTS: {
  name: string; startTime: string; endTime: string; maxCapacity: number; active: boolean;
}[] = [
  { name: "صباحي 1",  startTime: "09:00", endTime: "10:00", maxCapacity: 30, active: true },
  { name: "صباحي 2",  startTime: "10:00", endTime: "11:00", maxCapacity: 30, active: true },
  { name: "مسائي 1",  startTime: "15:00", endTime: "16:00", maxCapacity: 30, active: true },
  { name: "مسائي 2",  startTime: "17:00", endTime: "18:00", maxCapacity: 30, active: true },
  { name: "مسائي 3",  startTime: "19:00", endTime: "20:00", maxCapacity: 30, active: true },
];

/** مفتاح العلم في جدول Setting — يمنع إعادة بذر ما حذفه المدير عمداً */
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
 * بذر أيام السباحة والتوقيتات الافتراضية لنادٍ (مرة واحدة فقط).
 * @param force إن true: يبذر حتى لو الجدول فارغ والموجود رُفض سابقاً (زر الاستعادة)
 * @returns عدد الصفوف المُنشأة
 */
export async function ensureSwimDefaults(
  db: PrismaClient,
  clubId: string,
  force = false
): Promise<{ seeded: boolean; days: number; slots: number }> {
  // سبق البذر؟ لا تلمس شيئاً (يحترم حذف المدير المتعمد)
  if (!force && (await hasSeedFlag(db, clubId))) {
    return { seeded: false, days: 0, slots: 0 };
  }

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

  if (!force) await setSeedFlag(db, clubId);
  return { seeded: days + slots > 0, days, slots };
}

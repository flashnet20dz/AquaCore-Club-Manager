/**
 * swimming-groups.ts
 * ─────────────────────────────────────────────────────────────
 * نظام أفواج السباحة المزدوجة والمخصصة وأيام تشغيل المسبح الموحدة
 * يمثل المصدر الموحد لتعريف الأزواج (الأحد والأربعاء، السبت والثلاثاء...)
 * وتوقيتاتها المتطابقة، ومزامنتها لحظياً مع الإعدادات ونموذج المنخرط.
 */

export interface SwimmingDayGroup {
  id: string;
  name: string;                // مثال: "الأحد والأربعاء"
  shortName?: string;          // مثال: "أح+أر"
  color: string;               // لون مميز للبطاقة والشارة
  days: string[];              // ["الأحد", "الأربعاء"]
  dayKeys: number[];           // [0, 3] (0=Sun, 1=Mon, ..., 6=Sat)
  matchingSlots?: string[];    // توقيتات الحصص المتطابقة المخصصة لهذا الفوج (مثل: ["10:00-11:00", "16:00-17:00"])
  active: boolean;             // هل الفوج نشط ومعروض في نافذة التسجيل؟
  sortOrder: number;           // ترتيب الظهور
  isCustom?: boolean;          // هل أضافه المدير يدوياً؟
}

/** أيام الأسبوع السبعة الرسمية */
export const WEEK_DAYS_MAP: { key: number; dayId: string; name: string; short: string }[] = [
  { key: 0, dayId: "sun", name: "الأحد",    short: "أح" },
  { key: 1, dayId: "mon", name: "الاثنين",  short: "اث" },
  { key: 2, dayId: "tue", name: "الثلاثاء", short: "ثل" },
  { key: 3, dayId: "wed", name: "الأربعاء", short: "أر" },
  { key: 4, dayId: "thu", name: "الخميس",   short: "خم" },
  { key: 5, dayId: "fri", name: "الجمعة",   short: "جم" },
  { key: 6, dayId: "sat", name: "السبت",    short: "سب" },
];

/** الأفواج المزدوجة الافتراضية للنوادي الرياضية */
export const DEFAULT_SWIMMING_GROUPS: SwimmingDayGroup[] = [
  {
    id: "group-sun-wed",
    name: "الأحد والأربعاء",
    shortName: "أح+أر",
    color: "#0d9488", // Teal
    days: ["الأحد", "الأربعاء"],
    dayKeys: [0, 3],
    matchingSlots: [],
    active: true,
    sortOrder: 0,
  },
  {
    id: "group-sat-tue",
    name: "السبت والثلاثاء",
    shortName: "سب+ثل",
    color: "#0284c7", // Sky
    days: ["السبت", "الثلاثاء"],
    dayKeys: [6, 2],
    matchingSlots: [],
    active: true,
    sortOrder: 1,
  },
  {
    id: "group-mon-thu",
    name: "الاثنين والخميس",
    shortName: "اث+خم",
    color: "#8b5cf6", // Violet
    days: ["الاثنين", "الخميس"],
    dayKeys: [1, 4],
    matchingSlots: [],
    active: true,
    sortOrder: 2,
  },
  {
    id: "group-fri-only",
    name: "الجمعة",
    shortName: "جم",
    color: "#10b981", // Emerald
    days: ["الجمعة"],
    dayKeys: [5],
    matchingSlots: [],
    active: true,
    sortOrder: 3,
  },
  {
    id: "group-all-days",
    name: "كل الأيام",
    shortName: "الكل",
    color: "#f59e0b", // Amber
    days: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
    dayKeys: [0, 1, 2, 3, 4, 5, 6],
    matchingSlots: [],
    active: true,
    sortOrder: 4,
  },
];

/** مفتاح إعداد الأفواج في جدول Setting */
export const SWIMMING_GROUPS_SETTING_KEY = "swimmingDayGroups";
/** مفتاح إعداد أيام التشغيل في جدول Setting */
export const POOL_OPERATING_DAYS_SETTING_KEY = "poolOperatingDays";

/**
 * تحليل قيمة Setting النصية إلى مصفوفة أفواج
 */
export function parseSwimmingGroups(raw: string | null | undefined): SwimmingDayGroup[] {
  if (!raw) return DEFAULT_SWIMMING_GROUPS;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_SWIMMING_GROUPS;
  } catch {
    return DEFAULT_SWIMMING_GROUPS;
  }
}

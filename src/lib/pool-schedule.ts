/**
 * pool-schedule.ts — المصدر الموحّد لمنطق جدول استغلال المسبح (المرحلة 4)
 * ═══════════════════════════════════════════════════════════════════════
 * سلسلة الحقيقة الواحدة:
 *   Settings (SwimmingDay + SwimmingTimeSlot + Setting poolOperatingDays)
 *     → Operating Days → Pool Sessions → Pool Schedule
 *     → Registration / Pointage / Work Hours → Wages → Financial Center
 *
 * قواعد صارمة:
 *  - أوقات الجلسات نصوص "HH:mm" (ساعة الحائط) — لا Date ولا تحويل توقيت أبداً.
 *    (09:00 محفوظة = 09:00 معروضة على أي خادم وأي متصفح)
 *  - أيام الأسبوع مفاتيح ثابتة (sun|mon|tue|wed|thu|fri|sat) — الأسبوع الجزائري
 *    يُعرض مرتباً من السبت.
 *  - لا قوائم جلسات hardcoded في الصفحات: كل صفحة تقرأ من قاعدة البيانات
 *    عبر useSwimConfig (الواجهة) أو /api/swimming-slots (الخادم) ثم تستخدم
 *    الدوال هنا لفلترة/ترتيب/حساب الجلسات.
 *
 * لا تعتمد على React — تصلح للخادم والعميل معاً.
 */

// ─── مفاتيح أيام الأسبوع (JS getDay: 0=الأحد … 6=السبت) ───
export const POOL_DAYS: Array<{ key: string; label: string; short: string; jsDay: number }> = [
  { key: "sat", label: "السبت",   short: "سب", jsDay: 6 },
  { key: "sun", label: "الأحد",   short: "أح", jsDay: 0 },
  { key: "mon", label: "الإثنين", short: "إث", jsDay: 1 },
  { key: "tue", label: "الثلاثاء", short: "ثل", jsDay: 2 },
  { key: "wed", label: "الأربعاء", short: "أر", jsDay: 3 },
  { key: "thu", label: "الخميس",  short: "خم", jsDay: 4 },
  { key: "fri", label: "الجمعة",  short: "جم", jsDay: 5 },
];

export const POOL_DAY_LABELS: Record<string, string> = Object.fromEntries(
  POOL_DAYS.map((d) => [d.key, d.label])
);

export const ALL_DAY_KEYS: string[] = POOL_DAYS.map((d) => d.key);

/** مفتاح اليوم من رقم JS getDay (0=الأحد) */
export function dayKeyFromJsDay(jsDay: number): string {
  return POOL_DAYS.find((d) => d.jsDay === jsDay)?.key ?? "sun";
}

/**
 * مفتاح يوم الأسبوع من تاريخ "YYYY-MM-DD".
 * نُفسّر التاريخ عند الظهر ("T12:00:00Z") لتفادي قفزات المناطق الزمنية
 * حول منتصف الليل — نفس اصطلاح wall-clock.
 */
export function dayKeyFromDate(date: string): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return dayKeyFromJsDay(d.getUTCDay());
}

/** اليوم الحالي (مفتاح) حسب تاريخ الجهاز المحلي — لواجهات «حصص اليوم» */
export function todayDayKey(): string {
  const now = new Date();
  return dayKeyFromJsDay(now.getDay());
}

/** تاريخ اليوم المحلي "YYYY-MM-DD" */
export function todayYMD(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// ─── واجهة الحصة المشتركة (توافق SwimSlotOption من use-swim-config) ───
export interface PoolSlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  active: boolean;
  dayOfWeek?: string | null;
  maxCapacity?: number;
  sortOrder?: number;
}

/**
 * مدة حصة بالساعات من نصّي "HH:mm" — حساب حائط صرف، بلا أي Date/توقيت.
 * الوردية التي تعبر منتصف الليل (20:00→02:00) تُحتسب 6 ساعات.
 */
export function slotDurationHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (Number.isNaN(mins)) return 0;
  if (mins <= 0) mins += 24 * 60;
  return Math.max(0, mins / 60);
}

/**
 * جلسات يوم معيّن: حصص ذلك اليوم (dayOfWeek = المفتاح) + الحصص العامة
 * (dayOfWeek = null) — مرتبة زمنياً بالبداية ثم بترتيب الإعدادات.
 * هذه هي الدالة الوحيدة المسموح بها لبناء قائمة جلسات يوم في كل الصفحات.
 */
export function sessionsForDay(
  slots: PoolSlot[],
  dayKey: string | null | undefined,
  opts?: { activeOnly?: boolean; includeGeneral?: boolean }
): PoolSlot[] {
  if (!dayKey) return [];
  const activeOnly = opts?.activeOnly !== false;
  const includeGeneral = opts?.includeGeneral !== false;
  return slots
    .filter((s) => s.active || !activeOnly)
    .filter((s) => s.dayOfWeek === dayKey || (includeGeneral && !s.dayOfWeek))
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/** هل المسبح مفتوح في يوم معيّن حسب إعداد أيام الاستغلال؟ (يدعم المفاتيح النصية sat-fri والرقمية 0-6) */
export function isOperatingDay(operatingDays: string[] | null | undefined, dayKey: string | null | undefined): boolean {
  if (!dayKey) return false;
  if (!operatingDays || operatingDays.length === 0) return true; // الإعداد الافتراضي: كل الأيام
  const match = POOL_DAYS.find((d) => d.key === dayKey);
  const jsDayStr = match !== undefined ? String(match.jsDay) : null;
  return operatingDays.includes(dayKey) || (jsDayStr !== null && operatingDays.includes(jsDayStr));
}

/** مجموع ساعات قائمة جلسات (wall-clock) */
export function totalSessionsHours(slots: PoolSlot[]): number {
  return slots.reduce((sum, s) => sum + slotDurationHours(s.startTime, s.endTime), 0);
}

/** تسمية "09:00-10:00" موحّدة للحصة */
export function slotLabel(s: Pick<PoolSlot, "startTime" | "endTime">): string {
  return `${s.startTime}-${s.endTime}`;
}

/**
 * لقطة جلسة تاريخية (§27): تُخزَّن في note JSON لسجل ساعات العمل —
 * الإعدادات تتحكم في المستقبل فقط؛ السجل التاريخي يحتفظ بوقت تسجيله.
 */
export function slotSnapshot(s: PoolSlot): { slotId: string; name: string; startTime: string; endTime: string } {
  return { slotId: s.id, name: s.name, startTime: s.startTime, endTime: s.endTime };
}

// ─── تصنيف الفترات الزمنية لليوم (الصباحية / الظهيرة / المسائية / الليلية) ───
export type DayPeriodKey = "morning" | "midday" | "evening" | "night";

export interface PeriodInfo {
  key: DayPeriodKey;
  label: string;
  sublabel: string;
  range: string;
  badgeColor: string;
}

export const DAY_PERIODS: Record<DayPeriodKey, PeriodInfo> = {
  morning: {
    key: "morning",
    label: "الفترة الصباحية",
    sublabel: "جلسات الصباح والتدريب المبكر",
    range: "06:00 - 12:00",
    badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  midday: {
    key: "midday",
    label: "فترة الظهيرة",
    sublabel: "حصص منتصف اليوم والاستراحة",
    range: "12:00 - 15:00",
    badgeColor: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
  },
  evening: {
    key: "evening",
    label: "الفترة المسائية",
    sublabel: "حصص ذروة الإقبال وما بعد الدوام",
    range: "15:00 - 19:00",
    badgeColor: "bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30",
  },
  night: {
    key: "night",
    label: "الفترة الليلية",
    sublabel: "جلسات السباحة الحرة والتدريب الليلي",
    range: "19:00 - 23:59",
    badgeColor: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30",
  },
};

/** تحديد الفترة الزمنية لحصة معينة حسب وقت بدايتها (HH:mm) */
export function getSlotPeriod(startTime: string): DayPeriodKey {
  if (!startTime) return "morning";
  const hour = parseInt(startTime.split(":")[0], 10) || 0;
  if (hour < 12) return "morning";
  if (hour < 15) return "midday";
  if (hour < 19) return "evening";
  return "night";
}

/** العثور على الفوج المزدوج الذي يتبعه يوم معين */
export function findGroupByDayKey<T extends { dayKeys: number[] }>(
  groups: T[],
  dayKey: string | null | undefined
): T | undefined {
  if (!dayKey) return undefined;
  const match = POOL_DAYS.find((d) => d.key === dayKey);
  if (!match) return undefined;
  // البحث أولاً عن الأفواج المزدوجة المحددة (ليست الشاملة لكل الأيام)
  const specificGroup = groups.find(
    (g) => g.dayKeys.length <= 3 && g.dayKeys.includes(match.jsDay)
  );
  if (specificGroup) return specificGroup;
  return groups.find((g) => g.dayKeys.includes(match.jsDay));
}

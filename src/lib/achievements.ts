/**
 * ═══════════════════════════════════════════════════════════════
 *  الإنجازات والمكافآت (Gamification) — محرك حسابي نقي
 * ═══════════════════════════════════════════════════════════════
 *  لا يعتمد على قاعدة البيانات إطلاقاً — تُمرَّر قائمة تواريخ الحضور
 *  ويُرجع الإحصائيات والمستوى والأوسمة.
 *
 *  تعريف الأسبوع: من الاثنين إلى الأحد.
 *  السلسلة (Streak): عدد الأسابيع المتتالية التي فيها حضور ≥ 1،
 *  والأسبوع الحالي غير المكتمل (لم يُسجَّل فيه حضور بعد) لا يكسر السلسلة.
 */

// ─── الأنواع ──────────────────────────────────────────────────

export interface AchievementInput {
  attendances: Date[];
}

export interface AchievementLevel {
  key: string;
  label: string;
  min: number;   // الحد الأدنى لإجمالي الحضور للوصول لهذا المستوى
  color: string; // لون التمييز (hex) — لمسات فقط، ليس اللون الأساسي
}

export interface AchievementBadge {
  id: string;
  label: string;
  icon: string;        // اسم أيقونة lucide-react
  description: string;
  unlocked: boolean;
  progress: number;    // 0-100 نحو العتبة
  next: number | null; // العتبة المطلوبة (null إذا كان الوسام مفتوحاً)
  value: number;       // القيمة الحالية للمؤشر المرتبط بالوسام
}

export interface AchievementResult {
  total: number;
  currentStreak: number;
  longestStreak: number;
  monthlyTotal: number;
  level: { label: string; color: string };
  badges: AchievementBadge[];
}

export type BadgeMetric = "total" | "longestStreak" | "monthlyTotal";

export interface BadgeDefinition {
  id: string;
  label: string;
  icon: string;
  description: string;
  threshold: number;
  metric: BadgeMetric;
}

// ─── المستويات (حسب إجمالي الحضور) ────────────────────────────

export const ACHIEVEMENT_LEVELS: AchievementLevel[] = [
  { key: "beginner",     label: "مبتدئ", min: 0,  color: "#64748b" }, // slate
  { key: "intermediate", label: "متوسط", min: 10, color: "#0ea5e9" }, // sky
  { key: "advanced",     label: "متقدم", min: 25, color: "#8b5cf6" }, // violet
  { key: "hero",         label: "بطل",   min: 50, color: "#f59e0b" }, // amber
];

export function getLevelForTotal(total: number): AchievementLevel {
  let level = ACHIEVEMENT_LEVELS[0];
  for (const l of ACHIEVEMENT_LEVELS) {
    if (total >= l.min) level = l;
  }
  return level;
}

// ─── كتالوج الأوسمة ───────────────────────────────────────────

export const BADGE_CATALOG: BadgeDefinition[] = [
  { id: "first-checkin", label: "أول حضور",       icon: "Award",         description: "سجّل حضورك الأول في النادي",       threshold: 1,   metric: "total" },
  { id: "regular",       label: "منتظم",          icon: "CalendarCheck", description: "اجمع 10 حصص حضور",                 threshold: 10,  metric: "total" },
  { id: "persistent",    label: "مثابر",          icon: "Medal",         description: "اجمع 25 حصة حضور",                 threshold: 25,  metric: "total" },
  { id: "pool-legend",   label: "أسطورة المسبح",  icon: "Crown",         description: "اجمع 50 حصة حضور",                 threshold: 50,  metric: "total" },
  { id: "club-star",     label: "نجم النادي",     icon: "Star",          description: "اجمع 100 حصة حضور",                threshold: 100, metric: "total" },
  { id: "streak-5",      label: "سلسلة 5 أسابيع", icon: "Flame",         description: "حضور 5 أسابيع متتالية دون انقطاع", threshold: 5,   metric: "longestStreak" },
  { id: "streak-10",     label: "سلسلة 10 أسابيع", icon: "Zap",          description: "حضور 10 أسابيع متتالية دون انقطاع", threshold: 10,  metric: "longestStreak" },
  { id: "full-month",    label: "شهر كامل",       icon: "Waves",         description: "12 حصة حضور خلال شهر واحد",        threshold: 12,  metric: "monthlyTotal" },
];

// ─── أدوات الأسابيع (الاثنين → الأحد) ─────────────────────────

/** بداية الأسبوع (الاثنين منتصف الليل بالتوقيت المحلي) للتاريخ المعطى */
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=الأحد .. 6=السبت
  const shift = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + shift);
  return d;
}

/** إزاحة مفتاح أسبوع (الاثنين) بعدد أسابيع — عبر setDate لتجنب مشاكل التوقيت الصيفي */
function shiftWeeks(mondayMs: number, weeks: number): number {
  const d = new Date(mondayMs);
  d.setDate(d.getDate() + weeks * 7);
  return d.getTime();
}

// ─── الحساب الرئيسي ───────────────────────────────────────────

/**
 * يحسب إنجازات منخرط من قائمة تواريخ حضوره.
 * يقبل Date[] مباشرة أو كائن { attendances: Date[] }.
 */
export function computeAchievements(input: Date[] | AchievementInput): AchievementResult {
  const attendances = Array.isArray(input) ? input : input.attendances;
  const valid = (attendances ?? []).filter(
    (d) => d instanceof Date && !isNaN(d.getTime())
  );
  const now = new Date();

  const total = valid.length;

  // حضور الشهر الحالي (الشهر الميلادي)
  const monthlyTotal = valid.filter(
    (d) => d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  ).length;

  // مفاتيح أسابيع الحضور (الاثنين من كل أسبوع)
  const weekKeys = new Set<number>();
  for (const d of valid) weekKeys.add(startOfWeek(d).getTime());

  // السلسلة الحالية: نرجع أسبوعاً بأسبوع انطلاقاً من الأسبوع الحالي.
  // إن كان الأسبوع الحالي (غير المكتمل) بلا حضور فلا يكسر السلسلة — نتخطاه.
  const thisWeek = startOfWeek(now).getTime();
  let cursor = thisWeek;
  if (!weekKeys.has(cursor)) cursor = shiftWeeks(cursor, -1);
  let currentStreak = 0;
  while (weekKeys.has(cursor)) {
    currentStreak++;
    cursor = shiftWeeks(cursor, -1);
  }

  // أطول سلسلة في كامل التاريخ: مسح تصاعدي للأسابيع وعدّ المتتاليات
  const sortedWeeks = [...weekKeys].sort((a, b) => a - b);
  let longestStreak = 0;
  let run = 0;
  let prevWeek = 0;
  for (const wk of sortedWeeks) {
    if (run > 0 && wk === shiftWeeks(prevWeek, 1)) run++;
    else run = 1;
    if (run > longestStreak) longestStreak = run;
    prevWeek = wk;
  }

  const level = getLevelForTotal(total);

  // الأوسمة حسب المؤشرات
  const metrics: Record<BadgeMetric, number> = {
    total,
    longestStreak,
    monthlyTotal,
  };

  const badges: AchievementBadge[] = BADGE_CATALOG.map((def) => {
    const value = metrics[def.metric];
    const unlocked = value >= def.threshold;
    return {
      id: def.id,
      label: def.label,
      icon: def.icon,
      description: def.description,
      unlocked,
      progress: unlocked
        ? 100
        : Math.min(100, Math.round((value / def.threshold) * 100)),
      next: unlocked ? null : def.threshold,
      value,
    };
  });

  return {
    total,
    currentStreak,
    longestStreak,
    monthlyTotal,
    level: { label: level.label, color: level.color },
    badges,
  };
}

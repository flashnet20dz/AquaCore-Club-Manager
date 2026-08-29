/**
 * ═══════════════════════════════════════════════════════════════
 *  سجل إعدادات الميزات (Feature Settings Registry)
 * ═══════════════════════════════════════════════════════════════
 *
 *  الطلب: «كل ميزة تكون لها إعدادات في صفحة الإعدادات ومتزامنة معها»
 *
 *  كل ميزة تُعرّف مفاتيحها هنا (نوع + افتراضي + وصف + أين تُستخدم).
 *  القيم تُخزن في جدول Setting القياسي (نفس مخزن الإعدادات العامة)،
 *  وكل ميزة تقرأ قيمها وقت الطلب → مزامنة تلقائية بلا إعادة تشغيل.
 *
 *  الاستهلاك الفعلي (الأهم — يمنع الإعدادات الميتة):
 *   - memberPortalEnabled      ← /api/member-portal + /api/whatsapp/send
 *   - gamificationEnabled      ← /api/achievements
 *   - waitlistDefaultCapacity  ← /api/waitlist
 *   - monthlyRevenueTarget     ← /api/dashboard-extras (الهدف الشهري)
 *   - whatsappEnabled/template ← /api/whatsapp/send (نفس مفاتيح تبويب WhatsApp)
 *   - reminderRepeatDays       ← /api/cron/notifications (تكرار تذكير التجديد)
 *   - attendanceWindowDays     ← /api/cron/notifications (نافذة الغياب)
 */

export type FeatureSettingType = "boolean" | "number" | "text" | "textarea";

export interface FeatureSettingDef {
  key: string;
  label: string;
  type: FeatureSettingType;
  default: string;
  help?: string;
  /** خيارات للنوع select لاحقاً */
  placeholder?: string;
}

export interface FeatureGroupDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** شرح نقاط الاستهلاك الحقيقية (تظهر للمستخدم ليثق أن الإعداد حي) */
  consumedBy: string[];
  settings: FeatureSettingDef[];
}

export const FEATURE_SETTINGS: FeatureGroupDef[] = [
  {
    id: "member-portal",
    name: "بوابة المنخرط (البطاقة الرقمية)",
    icon: "🌐",
    description: "رابط شخصي موقّع لكل منخرط يعرض بطاقته وحالة اشتراكه وQR — بدون حساب.",
    consumedBy: [
      "زر «البوابة» في سجل المنخرط",
      "رسائل WhatsApp التذكيرية (رابط البوابة)",
    ],
    settings: [
      {
        key: "memberPortalEnabled",
        label: "تفعيل بوابة المنخرط",
        type: "boolean",
        default: "true",
        help: "عند الإيقاف: توليد الروابط يُرفض ولن يظهر الرابط في رسائل WhatsApp.",
      },
    ],
  },
  {
    id: "gamification",
    name: "الإنجازات والتحفيز",
    icon: "🏆",
    description: "مستويات المنخرطين، الشارات، سلاسل الحضور المتتالية ولوحة الصدارة.",
    consumedBy: ["تبويب الإنجازات", "API الإنجازات"],
    settings: [
      {
        key: "gamificationEnabled",
        label: "تفعيل نظام الإنجازات",
        type: "boolean",
        default: "true",
        help: "عند الإيقاف: يعرض تبويب الإنجازات إشعار إيقاف ويُرجع الـ API enabled:false.",
      },
    ],
  },
  {
    id: "notifications",
    name: "الإشعارات والتذكيرات",
    icon: "🔔",
    description: "تنبيهات التجديد والغياب داخل اللوحة + رسائل WhatsApp.",
    consumedBy: ["جرس الإشعارات", "المهمة الدورية /api/cron/notifications"],
    settings: [
      {
        key: "reminderRepeatDays",
        label: "أدنى فاصل بين التذكيرات (أيام)",
        type: "number",
        default: "1",
        help: "1 = تذكير يومي. ارفعها (3، 7…) لمنع إزعاج نفس المنخرط بتذكيرات متقاربة.",
      },
      {
        key: "attendanceAbsenceWindowDays",
        label: "نافذة كشف الغياب المتكرر (أيام)",
        type: "number",
        default: "21",
        help: "عدد الأيام بلا حضور قبل إطلاق تنبيه «غياب متكرر» للمدراء.",
      },
    ],
  },
  {
    id: "waitlist",
    name: "قائمة الانتظار",
    icon: "⏳",
    description: "إدارة المتربصين حتى يتوفر مكان في حصة معينة.",
    consumedBy: ["تبويب الانتظار", "POST /api/waitlist (السعة المعروضة)"],
    settings: [
      {
        key: "waitlistDefaultCapacity",
        label: "السعة الافتراضية للحصة",
        type: "number",
        default: "30",
        help: "تُستخدم إذا لم يكن للتوقيت سعة محددة في «توقيتات السباحة».",
      },
    ],
  },
  {
    id: "dashboard",
    name: "لوحة التحكم والأهداف",
    icon: "📊",
    description: "الهدف الشهري للإيرادات ومقارنته بالمحقق فعلياً.",
    consumedBy: ["لوحة التحكم 2.0 (حلقة الأهداف)", "تحليلات الذكاء"],
    settings: [
      {
        key: "monthlyRevenueTarget",
        label: "الهدف الشهري للإيرادات (دج)",
        type: "number",
        default: "0",
        help: "0 = لا هدف. نفس المفتاح المستخدم سابقاً — القيم محفوظة ومتوافقة.",
      },
    ],
  },
  {
    id: "whatsapp",
    name: "WhatsApp — الإرسال التلقائي",
    icon: "💬",
    description: "تذكيرات التجديد عبر WhatsApp (Cloud API أو روابط wa.me).",
    consumedBy: ["زر إرسال WhatsApp في التجديد والإشعارات"],
    settings: [
      {
        key: "whatsappEnabled",
        label: "تفعيل إشعارات WhatsApp",
        type: "boolean",
        default: "false",
        help: "نفس مفتاح تبويب WhatsApp — التبويبان يتشاركان القيمة.",
      },
      {
        key: "whatsappTemplate",
        label: "قالب الرسالة",
        type: "textarea",
        default: "مرحباً {name}، اشتراكك ينتهي في {date}.",
        help: "المتغيرات: {name} الاسم، {date} تاريخ الانتهاء، {portal} رابط البوابة.",
      },
    ],
  },
];

/** خريطة سريعة: key → def */
export const FEATURE_SETTING_MAP: Record<string, FeatureSettingDef> = Object.fromEntries(
  FEATURE_SETTINGS.flatMap((g) => g.settings.map((s) => [s.key, s]))
);

/** كل المفاتيح مع قيمها الافتراضية */
export const FEATURE_SETTING_DEFAULTS: Record<string, string> = Object.fromEntries(
  FEATURE_SETTINGS.flatMap((g) => g.settings.map((s) => [s.key, s.default]))
);

/**
 * قراءة إعدادات الميزات لنادٍ مع دمج الافتراضيات.
 * تُستخدم في كل المسارات المستهلكة (بلا استثناء) لضمان المزامنة.
 */
export async function getFeatureSettings(
  db: { setting: { findMany(args: unknown): Promise<{ key: string; value: string }[]> } },
  clubId: string
): Promise<Record<string, string>> {
  const rows = await db.setting.findMany({
    where: { clubId, key: { in: Object.keys(FEATURE_SETTING_DEFAULTS) } },
  });
  const map: Record<string, string> = { ...FEATURE_SETTING_DEFAULTS };
  for (const r of rows) map[r.key] = r.value;
  return map;
}

/** قيمة منطقية آمنة ("true" / true) */
export function isSettingOn(value: string | undefined | null): boolean {
  return value === "true" || value === "1" || value === "on";
}

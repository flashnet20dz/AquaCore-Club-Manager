/**
 * Business logic for RCS subscription system
 * ─────────────────────────────────────────────
 * v3.0 — Dynamic subscription type properties + EXEMPT payment status
 * لا يوجد أي شرط ثابت مثل if(type === "MJ")
 * كل القرارات مبنية على خصائص النوع المخزنة في قاعدة البيانات
 *
 * EXEMPT ("معفى") is now a first-class payment status:
 *   - subscriptionFee = 0, insuranceFee = 0, compoundRights = 0, totalAmount = 0
 *   - renewalStatus always = "✅ ساري" (never late, never frozen)
 *   - Not counted in unpaid totals; counted separately in statistics
 *   - Accepted variants on import: معفى, معفاة, EXEMPT, EXEMPTED
 */

export type Gender = "ذكر" | "أنثى";
export type BloodType = "A+" | "A-" | "B+" | "B-" | "O+" | "O-" | "AB+" | "AB-";
export type SubscriptionType = "/" | "OPOW" | "DJS" | "FCS" | "RCS" | "POLICE" | "MJ" | string;
// ★ EXEMPT ("معفى") added as a first-class payment status
export type PaymentStatus = "مدفوع" | "لم يدفع" | "تأمين فقط" | "اشتراك 300" | "معفى";
export type SwimmingDays = "الأحد والأربعاء" | "الاثنين والخميس" | "الثلاثاء والجمعة" | "كل الأيام" | string;
export type TimeSlot = "09:00-10:00" | "10:00-11:00" | "19:00-20:00" | "20:00-21:00" | string;

// ════════════ خصائص نوع الاشتراك الديناميكية ════════════
export interface SubscriptionTypeConfig {
  code: string;
  name?: string;
  subscriptionFee: number;
  insuranceFee: number;
  compoundRights: number;
  durationDays: number;
  givesMembershipNumber: boolean;
  requiresInsurance: boolean;
  requiresCompoundFee: boolean;
  renewableMonthly: boolean;
  freeSubscription: boolean;
}

// إعداد افتراضي للأنواع غير الموجودة في قاعدة البيانات (fallback)
export const DEFAULT_TYPE_CONFIG: SubscriptionTypeConfig = {
  code: "/",
  subscriptionFee: 1300,
  insuranceFee: 500,
  compoundRights: 1000,
  durationDays: 30,
  givesMembershipNumber: true,
  requiresInsurance: true,
  requiresCompoundFee: true,
  renewableMonthly: true,
  freeSubscription: false,
};

// خريطة الأنواع الافتراضية (تُستخدم عند عدم توفر قاعدة البيانات)
export const DEFAULT_TYPES_MAP: Record<string, SubscriptionTypeConfig> = {
  "/": {
    code: "/",
    subscriptionFee: 1300,
    insuranceFee: 500,
    compoundRights: 1000,
    durationDays: 30,
    givesMembershipNumber: true,
    requiresInsurance: true,
    requiresCompoundFee: true,
    renewableMonthly: true,
    freeSubscription: false,
  },
  "OPOW": {
    code: "OPOW",
    subscriptionFee: 300,
    insuranceFee: 500,
    compoundRights: 0,
    durationDays: 30,
    givesMembershipNumber: true,
    requiresInsurance: true,
    requiresCompoundFee: false,
    renewableMonthly: true,
    freeSubscription: false,
  },
  "DJS": {
    code: "DJS",
    subscriptionFee: 300,          // أقل من 14 سنة — ≥14 = 300+200=500 تلقائياً
    insuranceFee: 500,
    compoundRights: 0,
    durationDays: 30,
    givesMembershipNumber: true,
    requiresInsurance: true,
    requiresCompoundFee: false,
    renewableMonthly: true,
    freeSubscription: false,
  },
  "FCS": {
    code: "FCS",
    subscriptionFee: 0,
    insuranceFee: 500,
    compoundRights: 0,
    durationDays: 30,
    givesMembershipNumber: true,
    requiresInsurance: true,
    requiresCompoundFee: false,
    renewableMonthly: true,
    freeSubscription: false,
  },
  "RCS": {
    code: "RCS",
    subscriptionFee: 0,
    insuranceFee: 500,
    compoundRights: 0,
    durationDays: 30,
    givesMembershipNumber: true,
    requiresInsurance: true,
    requiresCompoundFee: false,
    renewableMonthly: true,
    freeSubscription: false,
  },
  "POLICE": {
    code: "POLICE",
    subscriptionFee: 300,
    insuranceFee: 500,
    compoundRights: 0,
    durationDays: 30,
    givesMembershipNumber: true,
    requiresInsurance: true,
    requiresCompoundFee: false,
    renewableMonthly: true,
    freeSubscription: false,
  },
  "MJ": {
    code: "MJ",
    subscriptionFee: 0,
    insuranceFee: 0,
    compoundRights: 0,
    durationDays: 30,
    givesMembershipNumber: false,
    requiresInsurance: false,
    requiresCompoundFee: false,
    renewableMonthly: true,
    freeSubscription: true,
  },
};

export interface SubscriberWithComputed {
  id: string;
  fileNumber: string;
  lastName: string;
  firstName: string;
  birthDate: Date;
  gender: Gender;
  bloodType: BloodType | null;
  subscriptionType: SubscriptionType;
  lastPaymentDate: Date | null;
  paymentStatus: PaymentStatus;
  swimmingDays: SwimmingDays | null;
  timeSlot: TimeSlot | null;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Computed
  age: number;
  expiryDate: Date | null;
  subscriptionFee: number | null;
  insuranceFee: number | null;
  compoundRights: number | null;
  totalAmount: number | null;
  renewalStatus: string;
  // ★ EXEMPT flag — true when paymentStatus is "معفى"
  isExempt: boolean;
}

// ════════════ EXEMPT ("معفى") helpers ════════════

/**
 * Checks if a payment status string represents EXEMPT.
 * Accepts the canonical "معفى" plus normalized EXEMPT values.
 */
export function isExemptStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const normalized = status.trim().toLowerCase();
  return normalized === "معفى" || normalized === "معفاة" || normalized === "exempt" || normalized === "exempted";
}

/**
 * Normalize various EXEMPT spellings/encodings to the canonical "معفى".
 * Used during Excel import and data entry.
 * Accepts: معفى, معفاة, EXEMPT, EXEMPTED (any case)
 * Returns the canonical status string, or null if input is not a valid status.
 */
export function normalizePaymentStatus(raw: string | null | undefined): PaymentStatus | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  // EXEMPT variants → canonical "معفى"
  if (lower === "exempt" || lower === "exempted" || trimmed === "معفى" || trimmed === "معفاة") {
    return "معفى";
  }
  // Standard statuses
  if (trimmed === "مدفوع" || trimmed === "لم يدفع" || trimmed === "تأمين فقط" || trimmed === "اشتراك 300") {
    return trimmed as PaymentStatus;
  }
  return null;
}

/**
 * Format an amount for display.
 * EXEMPT subscribers show "معفى" instead of "0 دج" to make clear they are
 * exempt, not just zero-amount.
 */
export function formatAmountDisplay(paymentStatus: PaymentStatus, amount: number | null): string {
  if (isExemptStatus(paymentStatus)) return "معفى";
  if (amount === null) return "—";
  return `${amount.toLocaleString("en-US")} دج`;
}

/**
 * Format amount for Excel/PDF export cells.
 * EXEMPT → "معفى" (string), so the spreadsheet cell literally shows the word.
 */
export function formatAmountForExport(paymentStatus: PaymentStatus, amount: number | null): string | number {
  if (isExemptStatus(paymentStatus)) return "معفى";
  if (amount === null) return "—";
  return amount;
}

// ثوابت قديمة (للتوافق مع الكود الموجود)
export const SUBSCRIPTION_FEE_REGULAR_UNDER_14 = 1300;
export const SUBSCRIPTION_FEE_REGULAR_OVER_14 = 1500;
export const SUBSCRIPTION_FEE_DISCOUNTED = 300;
export const SUBSCRIPTION_FEE_EXEMPT = 0;
export const INSURANCE_FEE = 500;
export const COMPOUND_RIGHTS = 1000;

export function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function calculateExpiryDate(lastPaymentDate: Date | null, durationDays: number = 30): Date | null {
  if (!lastPaymentDate) return null;
  const expiry = new Date(lastPaymentDate);
  expiry.setDate(expiry.getDate() + durationDays);
  return expiry;
}

// ════════════ الدوال الجديدة الديناميكية ════════════

/**
 * الحصول على إعداد نوع الاشتراك
 * يستخدم الإعداد الافتراضي إذا لم يتم تمرير نوع من قاعدة البيانات
 */
export function getTypeConfig(typeCode: string, dbConfig?: Partial<SubscriptionTypeConfig>): SubscriptionTypeConfig {
  const defaultConfig = DEFAULT_TYPES_MAP[typeCode] || DEFAULT_TYPE_CONFIG;
  if (dbConfig) {
    return { ...defaultConfig, ...dbConfig, code: typeCode };
  }
  return defaultConfig;
}

/**
 * حساب رسوم الاشتراك بناءً على خصائص النوع الديناميكية
 * لا يوجد شرط ثابت — كل القرار من typeConfig
 */
export function calculateSubscriptionFeeDynamic(
  paymentStatus: PaymentStatus,
  typeConfig: SubscriptionTypeConfig,
  age: number
): number | null {
  // ★ EXEMPT: no subscription fee at all, regardless of type/age
  if (isExemptStatus(paymentStatus)) return 0;
  if (paymentStatus === "لم يدفع") return null;
  if (typeConfig.freeSubscription) return 0;

  // 🔑 حساب الرسوم حسب العمر لكل الأنواع
  // ≥ 14 سنة: subscriptionFee + 200 (فرق البالغين)
  // < 14 سنة: subscriptionFee كما هو
  // هذا يطبيق منطق 1300/1500 لـ "/" و 300/500 لـ "DJS"
  if (typeConfig.subscriptionFee > 0 && typeConfig.subscriptionFee < 1000) {
    // الأنواع المخفّضة (DJS=300, OPOW=300): +200 للبالغين
    return age >= 14 ? typeConfig.subscriptionFee + 200 : typeConfig.subscriptionFee;
  }
  if (typeConfig.subscriptionFee >= 1000) {
    // الأنواع العادية (/=1300): +200 للبالغين = 1500
    return age >= 14 ? typeConfig.subscriptionFee + 200 : typeConfig.subscriptionFee;
  }
  return typeConfig.subscriptionFee;
}

/**
 * حساب رسوم التأمين بناءً على خصائص النوع الديناميكية
 */
export function calculateInsuranceFeeDynamic(
  paymentStatus: PaymentStatus,
  typeConfig: SubscriptionTypeConfig
): number | null {
  // ★ EXEMPT: no insurance fee
  if (isExemptStatus(paymentStatus)) return 0;
  if (paymentStatus === "لم يدفع") return null;
  // إذا كان النوع مجاني — لا تأمين
  if (typeConfig.freeSubscription) return 0;
  // إذا كان النوع لا يتطلب تأمين — 0
  if (!typeConfig.requiresInsurance) return 0;
  return typeConfig.insuranceFee;
}

/**
 * حساب حقوق المركب بناءً على خصائص النوع الديناميكية
 */
export function calculateCompoundRightsDynamic(
  paymentStatus: PaymentStatus,
  typeConfig: SubscriptionTypeConfig
): number | null {
  // ★ EXEMPT: no compound rights
  if (isExemptStatus(paymentStatus)) return 0;
  if (paymentStatus === "لم يدفع") return null;
  // إذا كان النوع مجاني — لا حقوق مركب
  if (typeConfig.freeSubscription) return 0;
  // إذا كان النوع لا يتطلب حقوق مركب — 0
  if (!typeConfig.requiresCompoundFee) return 0;
  return typeConfig.compoundRights;
}

export function calculateTotalAmountDynamic(
  paymentStatus: PaymentStatus,
  subscriptionFee: number | null,
  insuranceFee: number | null
): number | null {
  // ★ EXEMPT: total is explicitly 0 (not derived from null)
  if (isExemptStatus(paymentStatus)) return 0;
  if (paymentStatus === "لم يدفع") return null;
  if (subscriptionFee === null) return null;
  return subscriptionFee + (insuranceFee ?? 0);
}

export function calculateRenewalStatus(
  paymentStatus: PaymentStatus,
  expiryDate: Date | null
): string {
  // ★ EXEMPT: always active, never overdue, never frozen
  if (isExemptStatus(paymentStatus)) return "✅ ساري";
  if (paymentStatus === "لم يدفع") return "🔒 مجمدة";
  if (!expiryDate) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  if (expiry < today) return "⛔ منتهي - يتطلب تجديد";
  const fiveDaysBefore = new Date(expiry);
  fiveDaysBefore.setDate(fiveDaysBefore.getDate() - 5);
  if (fiveDaysBefore <= today) return "⚠️ قريب الانتهاء";
  return "✅ ساري";
}

/**
 * حساب جميع الحقول بناءً على خصائص النوع الديناميكية
 * هذه هي الدالة الرئيسية الجديدة
 */
export function computeSubscriberFieldsDynamic<T extends {
  birthDate: Date;
  paymentStatus: PaymentStatus;
  subscriptionType: SubscriptionType;
  lastPaymentDate: Date | null;
}>(sub: T, typeConfig?: SubscriptionTypeConfig): {
  age: number;
  expiryDate: Date | null;
  subscriptionFee: number | null;
  insuranceFee: number | null;
  compoundRights: number | null;
  totalAmount: number | null;
  renewalStatus: string;
  isExempt: boolean;
} {
  const config = typeConfig || getTypeConfig(sub.subscriptionType as string);
  const age = calculateAge(sub.birthDate);
  const expiryDate = calculateExpiryDate(sub.lastPaymentDate, config.durationDays);
  // 🔑 حساب الرسوم حسب العمر: ≥ 14 = 1500، < 14 = 1300
  const subscriptionFee = calculateSubscriptionFeeDynamic(sub.paymentStatus, config, age);
  const insuranceFee = calculateInsuranceFeeDynamic(sub.paymentStatus, config);
  const compoundRights = calculateCompoundRightsDynamic(sub.paymentStatus, config);
  const totalAmount = calculateTotalAmountDynamic(sub.paymentStatus, subscriptionFee, insuranceFee);
  const renewalStatus = calculateRenewalStatus(sub.paymentStatus, expiryDate);
  // ★ EXEMPT flag for easy UI/API usage
  const isExempt = isExemptStatus(sub.paymentStatus);

  return {
    age,
    expiryDate,
    subscriptionFee,
    insuranceFee,
    compoundRights,
    totalAmount,
    renewalStatus,
    isExempt,
  };
}

// ════════════ الدوال القديمة (للتوافق — تحاول استخدام الخصائص الديناميكية) ════════════

export function calculateSubscriptionFee(
  paymentStatus: PaymentStatus,
  subscriptionType: SubscriptionType,
  age: number
): number | null {
  const config = getTypeConfig(subscriptionType as string);
  return calculateSubscriptionFeeDynamic(paymentStatus, config, age);
}

export function calculateInsuranceFee(paymentStatus: PaymentStatus, subscriptionType?: SubscriptionType): number | null {
  const config = subscriptionType ? getTypeConfig(subscriptionType as string) : DEFAULT_TYPE_CONFIG;
  return calculateInsuranceFeeDynamic(paymentStatus, config);
}

export function calculateCompoundRights(
  paymentStatus: PaymentStatus,
  subscriptionType: SubscriptionType
): number | null {
  const config = getTypeConfig(subscriptionType as string);
  return calculateCompoundRightsDynamic(paymentStatus, config);
}

export function calculateTotalAmount(
  paymentStatus: PaymentStatus,
  subscriptionFee: number | null,
  insuranceFee: number | null
): number | null {
  return calculateTotalAmountDynamic(paymentStatus, subscriptionFee, insuranceFee);
}

export function computeSubscriberFields<T extends {
  birthDate: Date;
  paymentStatus: PaymentStatus;
  subscriptionType: SubscriptionType;
  lastPaymentDate: Date | null;
}>(sub: T): ReturnType<typeof computeSubscriberFieldsDynamic<T>> {
  return computeSubscriberFieldsDynamic(sub);
}

export function generateFileNumber(index: number): string {
  return `RCS ${String(index).padStart(3, "0")}`;
}

// Status colors for badges — ★ EXEMPT ("معفى") uses distinct violet
export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  "مدفوع": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  "لم يدفع": "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  "تأمين فقط": "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  "اشتراك 300": "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  // ★ EXEMPT — violet/purple, clearly different from paid (emerald) and unpaid (rose)
  "معفى": "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
};

export const SUBSCRIPTION_TYPE_COLORS: Record<string, string> = {
  "/": "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
  "OPOW": "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  "DJS": "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30",
  "FCS": "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
  "RCS": "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  "POLICE": "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
  "MJ": "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
};

export const RENEWAL_STATUS_COLORS: Record<string, string> = {
  "✅ ساري": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  "⚠️ قريب الانتهاء": "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  "⛔ منتهي - يتطلب تجديد": "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  "🔒 مجمدة": "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
};

export const SUBSCRIPTION_TYPES: SubscriptionType[] = ["/", "OPOW", "DJS", "FCS", "RCS", "POLICE", "MJ"];
// ★ PAYMENT_STATUSES now includes "معفى" (EXEMPT)
export const PAYMENT_STATUSES: PaymentStatus[] = ["مدفوع", "لم يدفع", "تأمين فقط", "اشتراك 300", "معفى"];
export const BLOOD_TYPES: BloodType[] = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
export const SWIMMING_DAYS: SwimmingDays[] = ["الأحد والأربعاء", "الاثنين والخميس", "الثلاثاء والجمعة", "الثلاثاء والسبت", "كل الأيام"];
export const TIME_SLOTS: TimeSlot[] = [
  "09:00-10:00", "10:00-11:00", "11:00-12:00", "12:00-13:00",
  "14:00-15:00", "15:00-16:00", "17:00-18:00", "18:00-19:00",
  "19:00-20:00", "20:00-21:00", "21:00-22:00",
];

// === Age category system (strict 13 cutoff) ===
export type AgeCategory = "males_under_13" | "females_under_13" | "males_13_plus" | "females_13_plus";

export const AGE_CATEGORY_INFO: Record<AgeCategory, {
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
  hexColor: string;
  gradient: string;
}> = {
  males_under_13: {
    label: "ذكور أقل من 13 سنة",
    shortLabel: "ذكور <13",
    icon: "👦",
    color: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    hexColor: "#0ea5e9",
    gradient: "from-sky-500/15 to-sky-500/5",
  },
  females_under_13: {
    label: "إناث أقل من 13 سنة",
    shortLabel: "إناث <13",
    icon: "👧",
    color: "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30",
    hexColor: "#ec4899",
    gradient: "from-pink-500/15 to-pink-500/5",
  },
  males_13_plus: {
    label: "ذكور 13 سنة فما فوق",
    shortLabel: "ذكور 13+",
    icon: "👨",
    color: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
    hexColor: "#6366f1",
    gradient: "from-indigo-500/15 to-indigo-500/5",
  },
  females_13_plus: {
    label: "إناث 13 سنة فما فوق",
    shortLabel: "إناث 13+",
    icon: "👩",
    color: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30",
    hexColor: "#a855f7",
    gradient: "from-fuchsia-500/15 to-fuchsia-500/5",
  },
};

export const AGE_CATEGORY_ORDER: AgeCategory[] = [
  "males_under_13",
  "females_under_13",
  "males_13_plus",
  "females_13_plus",
];

export function getAgeCategory(gender: string, age: number): AgeCategory {
  const isYoung = age < 13;
  if (gender === "ذكر") return isYoung ? "males_under_13" : "males_13_plus";
  return isYoung ? "females_under_13" : "females_13_plus";
}

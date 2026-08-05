/**
 * Business logic for RCS subscription system
 * ─────────────────────────────────────────────
 * v2.0 — Dynamic subscription type properties
 * لا يوجد أي شرط ثابت مثل if(type === "MJ")
 * كل القرارات مبنية على خصائص النوع المخزنة في قاعدة البيانات
 */

export type Gender = "ذكر" | "أنثى";
export type BloodType = "A+" | "A-" | "B+" | "B-" | "O+" | "O-" | "AB+" | "AB-";
export type SubscriptionType = "/" | "OPOW" | "DJS" | "FCS" | "RCS" | "POLICE" | "MJ" | string;
export type PaymentStatus = "مدفوع" | "لم يدفع" | "تأمين فقط" | "اشتراك 300";
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
  if (paymentStatus === "لم يدفع") return null;
  // إذا كان النوع مجاني — كل الرسوم = 0
  if (typeConfig.freeSubscription) return 0;
  // 🔑 للاشتراك العادي ("/"): فرّق حسب العمر
  // ≥ 14 سنة = 1500 دج، < 14 سنة = 1300 دج
  if (typeConfig.code === "/" || (typeConfig.code !== "OPOW" && typeConfig.code !== "DJS" && typeConfig.code !== "FCS" && typeConfig.code !== "POLICE" && typeConfig.code !== "MJ")) {
    return age >= 14 ? SUBSCRIPTION_FEE_REGULAR_OVER_14 : SUBSCRIPTION_FEE_REGULAR_UNDER_14;
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
  if (paymentStatus === "لم يدفع") return null;
  if (subscriptionFee === null) return null;
  return subscriptionFee + (insuranceFee ?? 0);
}

export function calculateRenewalStatus(
  paymentStatus: PaymentStatus,
  expiryDate: Date | null
): string {
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

  return {
    age,
    expiryDate,
    subscriptionFee,
    insuranceFee,
    compoundRights,
    totalAmount,
    renewalStatus,
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

// Status colors for badges
export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  "مدفوع": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  "لم يدفع": "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  "تأمين فقط": "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  "اشتراك 300": "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
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
export const PAYMENT_STATUSES: PaymentStatus[] = ["مدفوع", "لم يدفع", "تأمين فقط", "اشتراك 300"];
export const BLOOD_TYPES: BloodType[] = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
export const SWIMMING_DAYS: SwimmingDays[] = ["الأحد والأربعاء", "الاثنين والخميس", "الثلاثاء والجمعة", "كل الأيام"];
export const TIME_SLOTS: TimeSlot[] = ["09:00-10:00", "10:00-11:00", "19:00-20:00", "20:00-21:00"];

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

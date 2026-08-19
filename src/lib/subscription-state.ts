/**
 * ═══════════════════════════════════════════════════════════════
 *  AquaCore — Subscription State Engine
 * ═══════════════════════════════════════════════════════════════
 *
 *  يحسب حالة اشتراك النادي بناءً على:
 *    - trialStartedAt / trialEndDate  (فترة التجربة المجانية)
 *    - آخر اشتراك نشط (ClubSubscription)
 *    - graceEndDate  (فترة السماح بعد انتهاء الاشتراك)
 *
 *  الحالات الممكنة:
 *    - "pending"     : النادي بانتظار موافقة السوبر أدمن
 *    - "trial"       : في فترة التجربة المجانية (7-15 يوم)
 *    - "active"      : اشتراك مدفوع ساري
 *    - "grace"       : انتهى الاشتراك، في فترة السماح (24 ساعة)
 *    - "locked"      : انتهت فترة السماح، الوصول مقفل
 *    - "suspended"   : موقوف يدوياً من السوبر أدمن
 */

export type SubscriptionState =
  | "pending"
  | "trial"
  | "active"
  | "grace"
  | "locked"
  | "suspended";

export interface SubscriptionStatus {
  state: SubscriptionState;
  /** حالة مقروءة بالعربية للعرض */
  label: string;
  /** لون Tailwind للبادج */
  color: string;
  /** تاريخ بداية الفترة الحالية */
  startDate?: Date;
  /** تاريخ نهاية الفترة الحالية */
  endDate?: Date;
  /** عدد الأيام المتبقية (موجب) أو المنقضية (سالب) */
  daysRemaining?: number;
  /** هل الوصول مسموح (إظهار المحتوى)؟ */
  hasAccess: boolean;
  /** رسالة توضيحية للمستخدم */
  message: string;
  /** اسم الخطة الحالية */
  plan?: string;
}

const TRIAL_DAYS = 7;       // مدة التجربة الافتراضية
const GRACE_DAYS = 1;       // مدة السماح بعد انتهاء الاشتراك (24 ساعة = يوم واحد)

export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/**
 * يحسب حالة اشتراك النادي.
 *
 * @param club بيانات النادي (status, trialStartedAt, trialEndDate, graceEndDate, hardwareFingerprint)
 * @param activeSubscription آخر ClubSubscription نشط (أو null)
 */
export function computeSubscriptionStatus(
  club: {
    status: string;
    trialStartedAt?: Date | string | null;
    trialEndDate?: Date | string | null;
    graceEndDate?: Date | string | null;
  },
  activeSubscription: {
    type?: string;
    startDate?: Date | string;
    endDate?: Date | string;
    status?: string;
  } | null
): SubscriptionStatus {
  // 1) النادي موقوف يدوياً
  if (club.status === "suspended" || club.status === "disabled") {
    return {
      state: "suspended",
      label: "موقوف",
      color: "bg-violet-500/15 text-violet-700 border-violet-500/30",
      hasAccess: false,
      message: "تم إيقاف هذا الحساب. تواصل مع الإدارة.",
    };
  }

  const now = new Date();

  // 2) النادي بانتظار الموافقة — لكن لو عنده تجربة مجانية سارية (تبدأ من
  //    لحظة التسجيل مباشرة)، يُسمح له بالوصول أثناءها رغم انتظار الموافقة
  if (club.status === "pending") {
    if (club.trialEndDate) {
      const trialEnd = new Date(club.trialEndDate);
      if (trialEnd > now) {
        const days = daysBetween(now, trialEnd);
        return {
          state: "trial",
          label: "فترة تجريبية",
          color: "bg-sky-500/15 text-sky-700 border-sky-500/30",
          startDate: club.trialStartedAt ? new Date(club.trialStartedAt) : undefined,
          endDate: trialEnd,
          daysRemaining: days,
          hasAccess: true,
          message: `أنت بفترة تجريبية مجانية — ${days} يوم متبقٍ. حسابك بانتظار المراجعة النهائية بالتوازي.`,
        };
      }
    }
    return {
      state: "pending",
      label: "بانتظار الموافقة",
      color: "bg-amber-500/15 text-amber-700 border-amber-500/30",
      hasAccess: false,
      message: "انتهت فترتك التجريبية وحسابك لا يزال بانتظار موافقة الإدارة. تواصل مع الدعم.",
    };
  }

  // 3) اشتراك نشط ساري
  if (activeSubscription && activeSubscription.status === "active" && activeSubscription.endDate) {
    const endDate = new Date(activeSubscription.endDate);
    if (endDate > now) {
      const days = daysBetween(now, endDate);
      return {
        state: "active",
        label: "اشتراك ساري",
        color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
        startDate: activeSubscription.startDate ? new Date(activeSubscription.startDate) : undefined,
        endDate,
        daysRemaining: days,
        hasAccess: true,
        message: days <= 7
          ? `اشتراكك ساري لـ ${days} يوم آخر. يُنصح بالتجديد قريباً.`
          : `اشتراكك ساري لـ ${days} يوماً.`,
        plan: activeSubscription.type,
      };
    }
    // انتهى الاشتراك — تحقق من فترة السماح
    const graceEnd = club.graceEndDate ? new Date(club.graceEndDate) : null;
    // إذا لم تُضبط فترة السماح، احسبها تلقائياً (endDate + GRACE_DAYS)
    const computedGraceEnd = new Date(endDate);
    computedGraceEnd.setDate(computedGraceEnd.getDate() + GRACE_DAYS);
    const effectiveGraceEnd = graceEnd || computedGraceEnd;

    if (effectiveGraceEnd > now) {
      const days = daysBetween(now, effectiveGraceEnd);
      return {
        state: "grace",
        label: "فترة سماح",
        color: "bg-orange-500/15 text-orange-700 border-orange-500/30",
        startDate: activeSubscription.startDate ? new Date(activeSubscription.startDate) : undefined,
        endDate: effectiveGraceEnd,
        daysRemaining: days,
        hasAccess: true,
        message: `انتهى اشتراكك. لديك ${days} يوم في فترة السماح (24 ساعة) قبل قفل الحساب. فعّل كوداً جديداً فوراً.`,
        plan: activeSubscription.type,
      };
    }
    // انتهت فترة السماح → مقفل
    return {
      state: "locked",
      label: "مقفل",
      color: "bg-rose-500/15 text-rose-700 border-rose-500/30",
      endDate: effectiveGraceEnd,
      daysRemaining: daysBetween(now, effectiveGraceEnd),
      hasAccess: false,
      message: "انتهى اشتراكك وفترة السماح. فعّل كود تفعيل جديد لاستعادة الوصول.",
      plan: activeSubscription.type,
    };
  }

  // 4) في فترة التجربة المجانية
  if (club.trialStartedAt && club.trialEndDate) {
    const trialEnd = new Date(club.trialEndDate);
    if (trialEnd > now) {
      const days = daysBetween(now, trialEnd);
      return {
        state: "trial",
        label: "تجربة مجانية",
        color: "bg-sky-500/15 text-sky-700 border-sky-500/30",
        startDate: new Date(club.trialStartedAt),
        endDate: trialEnd,
        daysRemaining: days,
        hasAccess: true,
        message: `تجربة مجانية لـ ${days} يوماً. فعّل كود اشتراك قبل انتهائها لمواصلة الاستخدام.`,
        plan: "trial",
      };
    }
    // انتهت التجربة بدون تفعيل كود → مقفل
    return {
      state: "locked",
      label: "مقفل",
      color: "bg-rose-500/15 text-rose-700 border-rose-500/30",
      endDate: trialEnd,
      daysRemaining: daysBetween(now, trialEnd),
      hasAccess: false,
      message: "انتهت فترة التجربة المجانية. فعّل كود تفعيل للاستمرار.",
      plan: "trial",
    };
  }

  // 5) نادٍ نشط بدون اشتراك ولا تجربة — مقفل افتراضياً
  return {
    state: "locked",
    label: "مقفل",
    color: "bg-rose-500/15 text-rose-700 border-rose-500/30",
    hasAccess: false,
    message: "لا يوجد اشتراك نشط. فعّل كود تفعيل للبدء.",
  };
}

/**
 * يبدأ فترة التجربة المجانية للنادي (عند الموافقة عليه).
 * يُستدعى من مسار موافقة السوبر أدمن.
 */
export function startTrial(now: Date = new Date(), trialDays: number = TRIAL_DAYS) {
  const trialStartedAt = now;
  const trialEndDate = new Date(now);
  trialEndDate.setDate(trialEndDate.getDate() + trialDays);
  return { trialStartedAt, trialEndDate };
}

/**
 * يحسب فترة السماح بعد انتهاء اشتراك (للتحديث في DB).
 */
export function computeGracePeriod(subscriptionEndDate: Date, graceDays: number = GRACE_DAYS) {
  const graceEndDate = new Date(subscriptionEndDate);
  graceEndDate.setDate(graceEndDate.getDate() + graceDays);
  return graceEndDate;
}

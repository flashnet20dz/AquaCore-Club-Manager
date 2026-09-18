"use client";

/**
 * financial-events — ناقل أحداث المزامنة المالية (المرحلة 3: مزامنة بلا تحديث يدوي)
 * ═════════════════════════════════════════════════════════════
 * أي عملية مالية في أي صفحة (تسجيل/تجديد/تأمين/مركب/أجر/مصروف/إلغاء)
 * تبثّ حدثاً واحداً، وكل المستمعين (لوحة القيادة، الدفتر، كشف اليوم،
 * بطاقات الصفحة الرئيسية…) يعيدون الجلب فوراً وبصمت.
 *
 * - نفس التبويبة: CustomEvent على window.
 * - تبويبات أخرى (مدير + كاشير): عبر localStorage "storage" event.
 */

export const FINANCIAL_UPDATED_EVENT = "rcs:financial-updated";
export const FINANCIAL_TICK_KEY = "rcs:financial-tick";

/** تبثّ «تغيرت الأرقام المالية» — تُستدعى بعد نجاح أي عملية مالية */
export function notifyFinancialUpdated(): void {
  if (typeof window === "undefined") return;
  try {
    // قيمة تتغير دائماً حتى يعمل حدث storage بين التبويبات
    localStorage.setItem(FINANCIAL_TICK_KEY, String(Date.now()));
  } catch {
    /* التخزين ممتلئ/محجوب — الحدث الداخلي يكفي */
  }
  window.dispatchEvent(new CustomEvent(FINANCIAL_UPDATED_EVENT));
}

/**
 * يشترك في أحداث المزامنة المالية (نفس التبويبة + التبويبات الأخرى).
 * يعيد دالة إلغاء الاشتراك.
 */
export function onFinancialUpdated(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onCustom = () => handler();
  const onStorage = (e: StorageEvent) => {
    if (e.key === FINANCIAL_TICK_KEY) handler();
  };

  window.addEventListener(FINANCIAL_UPDATED_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(FINANCIAL_UPDATED_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * financial-query.ts — طبقة الاستعلام المالي الموحدة (المرحلة 3 — نقطة 12)
 * ═══════════════════════════════════════════════════════════════════════
 * كل مكوّن يحتاج أرقاماً مالية يستعمل هذه الطبقة:
 *
 *   1) financialQueryKeys — مفاتيح استعلام قياسية (نمط TanStack Query)
 *      لتوحيد التخزين المؤقت والإبطال بين الصفحات.
 *   2) fetchFinancialDashboard — المُحصّل الموحد للمصدر الوحيد للحقيقة
 *      (/api/financial/dashboard) — لا استدعاء مباشر متناثر.
 *   3) invalidateFinancialViews — نقطة الإبطال الوحيدة بعد أي عملية مالية
 *      (تفويض لناقل الأحداث الموجود notifyFinancialUpdated — CustomEvent
 *      داخل التبويبة + storage event بين التبويبات).
 *
 * القاعدة: أي رقم مالي في أي صفحة = من دفتر FinancialTransaction عبر
 * هذا المسار الموحد. لا حسابات موازية في المكوّنات إطلاقاً.
 */

import { notifyFinancialUpdated } from "@/lib/financial-events";

/** الفترات القياسية الموحدة — نفس معانيها في المركز المالي والتقارير */
export type FinancialPeriod =
  | "today"
  | "week"
  | "month"
  | "lastMonth"
  | "year"
  | "all"
  | "custom";

/**
 * مفاتيح الاستعلام المالية القياسية — استخدمها في أي تخزين مؤقت/جلب
 * حتى تكون الإبطالات شاملة ودقيقة.
 */
export const financialQueryKeys = {
  /** نظرة المركز المالي/لوحة التحكم لفترة */
  dashboard: (period: string = "month") => ["financial-dashboard", period] as const,
  /** دفتر القيود مع فلاتره */
  transactions: (filters: Record<string, unknown> = {}) => ["financial-transactions", filters] as const,
  /** الرصيد الحي (FinancialBalance كاش) */
  balance: ["financial-balance"] as const,
  /** التقارير المالية (شهر/سنة) */
  reports: (year?: number, month?: number) => ["financial-reports", year ?? null, month ?? null] as const,
  /** كشف اليوم */
  dayStatement: ["financial-day-statement"] as const,
  /** فحص سلامة الحسابات */
  integrity: ["financial-integrity"] as const,
  /** إحصاءات المنخرطين غير المالية (/api/stats) */
  dashboardStats: ["dashboard-stats"] as const,
  /** تحليلات لوحة الإحصاءات (المال فيها من الدفتر) */
  analytics: ["analytics"] as const,
  /** بيانات لوحة التحكم 2.0 (الهدف الشهري من الدفتر) */
  dashboardExtras: ["dashboard-extras"] as const,
} as const;

/**
 * المُحصّل الموحد للمصدر الوحيد للحقيقة.
 * @param period فترة قياسية من financialQueryKeys meanings
 */
export async function fetchFinancialDashboard<T = Record<string, unknown>>(
  period: string = "month",
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`/api/financial/dashboard?period=${encodeURIComponent(period)}`, {
    cache: "no-store",
    ...init,
  });
  if (!res.ok) throw new Error(`financial dashboard ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * نقطة الإبطال الوحيدة: بعد أي عملية مالية (تسجيل/تجديد/تأمين/مركب/راتب/
 * مصروف/إلغاء) استدعِ هذه بدلاً من تحديث يدوي — كل الواجهات المستمعة
 * (المركز المالي، بطاقات لوحة التحكم، كشف اليوم، الإحصاءات، الأهداف)
 * تعيد الجلب فوراً بلا F5 وبلا خروج/دخول.
 */
export function invalidateFinancialViews(): void {
  notifyFinancialUpdated();
}

/**
 * Shared labels — تسميات عربية للفئات وطرق الدفع والأنواع المالية.
 * يشاركها: جدول المعاملات + حوار التفاصيل + الإيصال المطبوع.
 */

export const CATEGORY_LABELS: Record<string, string> = {
  subscription: "اشتراك",
  renewal: "تجديد",
  insurance: "تأمين",
  compound: "حقوق المركب",
  other_income: "مدخول آخر",
  wages: "أجور عمال",
  compound_rights: "حقوق المركب",
  office_supplies: "لوازم مكتبية",
  other_expense: "دفعات أخرى",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "نقدي",
  bank: "تحويل بنكي",
  cheque: "شيك",
};

export const TYPE_LABELS: Record<string, string> = {
  income: "مدخول",
  expense: "مصروف",
};

export function categoryLabel(k?: string | null): string {
  if (!k) return "—";
  return CATEGORY_LABELS[k] || k;
}

export function paymentMethodLabel(k?: string | null): string {
  if (!k) return "—";
  return PAYMENT_METHOD_LABELS[k] || k;
}

export function typeLabel(k?: string | null): string {
  if (!k) return "—";
  return TYPE_LABELS[k] || k;
}

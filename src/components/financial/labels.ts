/**
 * Shared labels — تسميات عربية للفئات وطرق الدفع والأنواع المالية.
 * يشاركها: جدول المعاملات + حوار التفاصيل + الإيصال المطبوع.
 */

export const CATEGORY_LABELS: Record<string, string> = {
  subscription: "اشتراكات جديدة",
  renewal: "تجديد الاشتراكات",
  insurance: "مصاريف التأمين",
  compound: "حقوق المركب",
  compound_rights: "حقوق المركب",
  services: "خدمات",
  other_services: "خدمات أخرى",
  other_income: "مداخيل أخرى",
  wages: "أجور العمال",
  maintenance: "الصيانة",
  equipment: "المشتريات والمعدات",
  purchases: "المشتريات",
  office_supplies: "المصاريف الإدارية واللوازم",
  administrative: "المصاريف الإدارية",
  transport: "النقل والتنقل",
  other_expense: "مصاريف أخرى",
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

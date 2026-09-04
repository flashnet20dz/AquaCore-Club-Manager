/**
 * Variable substitution engine for employment contracts.
 *
 * Available variables:
 *   {{club_name}}            — اسم النادي (من الإعدادات)
 *   {{club_branch}}          — اسم الفرع
 *   {{worker_name}}          — اسم العامل الكامل
 *   {{birth_date}}           — تاريخ الميلاد
 *   {{birth_place}}          — مكان الميلاد
 *   {{address}}              — العنوان
 *   {{phone}}                — الهاتف
 *   {{national_id}}          — رقم بطاقة التعريف
 *   {{position}}             — المنصب
 *   {{contract_number}}      — رقم العقد
 *   {{start_date}}           — تاريخ بداية العقد
 *   {{end_date}}             — تاريخ نهاية العقد
 *   {{hour_rate}}            — سعر الساعة
 *   {{work_schedule}}        — جدول العمل
 *   {{club_president}}       — رئيس النادي
 *   {{association_president}}— رئيس الجمعية
 *   {{today}}                — تاريخ اليوم
 */

export interface ContractVariables {
  club_name?: string;
  club_branch?: string;
  worker_name?: string;
  birth_date?: string;
  birth_place?: string;
  address?: string;
  phone?: string;
  national_id?: string;
  position?: string;
  contract_number?: string;
  start_date?: string;
  end_date?: string;
  hour_rate?: string | number;
  work_schedule?: string;
  club_president?: string;
  association_president?: string;
  today?: string;
}

export function substituteVariables(template: string, vars: ContractVariables): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    result = result.replace(placeholder, String(value ?? "—"));
  }
  return result;
}

export function formatDateYMD(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

export const AVAILABLE_VARIABLES = [
  { key: "club_name", label: "اسم النادي", description: "اسم النادي من الإعدادات" },
  { key: "club_branch", label: "اسم الفرع", description: "اسم فرع النادي" },
  { key: "worker_name", label: "اسم العامل", description: "الاسم واللقب" },
  { key: "birth_date", label: "تاريخ الميلاد", description: "تاريخ ميلاد العامل" },
  { key: "birth_place", label: "مكان الميلاد", description: "مكان ميلاد العامل" },
  { key: "address", label: "العنوان", description: "عنوان العامل" },
  { key: "phone", label: "الهاتف", description: "رقم الهاتف" },
  { key: "national_id", label: "رقم بطاقة التعريف", description: "رقم بطاقة التعريف الوطنية" },
  { key: "position", label: "المنصب", description: "منصب العامل" },
  { key: "contract_number", label: "رقم العقد", description: "رقم العقد تلقائياً" },
  { key: "start_date", label: "تاريخ البداية", description: "تاريخ بداية العقد" },
  { key: "end_date", label: "تاريخ النهاية", description: "تاريخ نهاية العقد" },
  { key: "hour_rate", label: "سعر الساعة", description: "الأجر بالساعة" },
  { key: "work_schedule", label: "جدول العمل", description: "مثل: 40 ساعة/أسبوع" },
  { key: "club_president", label: "رئيس النادي", description: "اسم رئيس النادي" },
  { key: "association_president", label: "رئيس الجمعية", description: "اسم رئيس الجمعية" },
  { key: "today", label: "تاريخ اليوم", description: "تاريخ اليوم الحالي" },
];

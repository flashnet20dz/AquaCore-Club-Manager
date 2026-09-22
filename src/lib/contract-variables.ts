/**
 * Variable substitution engine for employment contracts.
 *
 * Available variables:
 *   {{club_name}}            — اسم النادي (من الإعدادات)
 *   {{club_branch}}          — اسم الفرع
 *   {{club_seat}}            — مقر النادي
 *   {{worker_name}}          — اسم العامل الكامل
 *   {{birth_date}}           — تاريخ الميلاد
 *   {{birth_place}}          — مكان الميلاد
 *   {{address}}              — العنوان
 *   {{phone}}                — الهاتف
 *   {{national_id}}          — رقم بطاقة التعريف
 *   {{position}}             — المنصب (رمزي)
 *   {{position_title}}       — المنصب (صيغة العقد: حارس سباحة (منقذ مائي))
 *   {{contract_number}}      — رقم العقد
 *   {{season_year}}          — سنة الموسم (لرقم الوثيقة)
 *   {{start_date}}           — تاريخ بداية العقد
 *   {{end_date}}             — تاريخ نهاية العقد
 *   {{hour_rate}}            — سعر الساعة
 *   {{work_schedule}}        — جدول العمل
 *   {{workplace}}            — مكان العمل (المسبح)
 *   {{club_president}}       — رئيس النادي
 *   {{association_president}}        — رئيس الجمعية
 *   {{association_president_title}}  — صفة رئيس الجمعية
 *   {{first_party_representative}}   — ممثل الطرف الأول
 *   {{first_party_rep_title}}        — صفة ممثل الطرف الأول
 *   {{sign_city}}            — مدينة التحرير
 *   {{sign_date}}            — تاريخ التحرير
 *   {{today}}                — تاريخ اليوم
 */

export interface ContractVariables {
  club_name?: string;
  club_branch?: string;
  club_seat?: string;
  worker_name?: string;
  birth_date?: string;
  birth_place?: string;
  address?: string;
  phone?: string;
  national_id?: string;
  position?: string;
  position_title?: string;
  contract_number?: string;
  season_year?: string;
  start_date?: string;
  end_date?: string;
  hour_rate?: string | number;
  work_schedule?: string;
  workplace?: string;
  club_president?: string;
  association_president?: string;
  association_president_title?: string;
  first_party_representative?: string;
  first_party_rep_title?: string;
  sign_city?: string;
  sign_date?: string;
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

const DOTTED = ".........................";

function escapeHtmlValue(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * استبدال بمؤشرات رسمية: الحقول الفارغة تظهر خطاً منقّطاً «.....»
 * (كما في الوثائق الورقية) بدل «—»، مع تهريب HTML لكل القيم.
 * تُستخدم للنموذج الرسمي CDD في المعاينة الحية وعند الحفظ.
 */
export function renderContractHTML(
  template: string,
  vars: ContractVariables,
  opts?: { dotted?: boolean },
): string {
  const dotted = opts?.dotted !== false;
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    const raw = String(value ?? "").trim();
    result = result.replace(
      placeholder,
      raw ? escapeHtmlValue(raw) : dotted ? DOTTED : "—",
    );
  }
  // أي متغير متبقٍ غير معروف → خط منقّط (وليس {{...}} ظاهرة في الوثيقة)
  result = result.replace(/\{\{\s*\w+\s*\}\}/g, DOTTED);
  return result;
}

/**
 * تاريخ العرض في العقود بصيغة DD/MM/YYYY — مثل باقي تواريخ الموقع.
 * (كانت yyyy/mm/dd — تم توحيدها بطلب صاحب الموقع)
 */
export function formatDateDMY(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${day}/${m}/${y}`;
}

export const AVAILABLE_VARIABLES = [
  { key: "club_name", label: "اسم النادي", description: "اسم النادي من الإعدادات" },
  { key: "club_branch", label: "اسم الفرع", description: "اسم فرع النادي" },
  { key: "club_seat", label: "مقر النادي", description: "مقر الجمعية" },
  { key: "worker_name", label: "اسم العامل", description: "الاسم واللقب" },
  { key: "birth_date", label: "تاريخ الميلاد", description: "تاريخ ميلاد العامل" },
  { key: "birth_place", label: "مكان الميلاد", description: "مكان ميلاد العامل" },
  { key: "address", label: "العنوان", description: "عنوان العامل" },
  { key: "phone", label: "الهاتف", description: "رقم الهاتف" },
  { key: "national_id", label: "رقم بطاقة التعريف", description: "رقم بطاقة التعريف الوطنية" },
  { key: "position", label: "المنصب", description: "منصب العامل" },
  { key: "position_title", label: "المنصب (صيغة العقد)", description: "مثل: حارس سباحة (منقذ مائي)" },
  { key: "contract_number", label: "رقم العقد", description: "رقم العقد تلقائياً" },
  { key: "season_year", label: "سنة الموسم", description: "سنة الوثيقة (تلقائي)" },
  { key: "start_date", label: "تاريخ البداية", description: "تاريخ بداية العقد" },
  { key: "end_date", label: "تاريخ النهاية", description: "تاريخ نهاية العقد" },
  { key: "hour_rate", label: "سعر الساعة", description: "الأجر بالساعة" },
  { key: "work_schedule", label: "جدول العمل", description: "مثل: 40 ساعة/أسبوع" },
  { key: "workplace", label: "مكان العمل", description: "المسبح / المنشأة" },
  { key: "club_president", label: "رئيس النادي", description: "اسم رئيس النادي" },
  { key: "association_president", label: "رئيس الجمعية", description: "اسم رئيس الجمعية" },
  { key: "association_president_title", label: "صفة رئيس الجمعية", description: "مثل: رئيس الجمعية" },
  { key: "first_party_representative", label: "ممثل الطرف الأول", description: "السيد الذي يمثل النادي" },
  { key: "first_party_rep_title", label: "صفة ممثل الطرف الأول", description: "مثل: رئيس فرع السباحة" },
  { key: "sign_city", label: "مدينة التحرير", description: "مدينة تحرير العقد" },
  { key: "sign_date", label: "تاريخ التحرير", description: "تاريخ تحرير العقد" },
  { key: "today", label: "تاريخ اليوم", description: "تاريخ اليوم الحالي" },
];

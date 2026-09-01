/**
 * ══════════════════════════════════════════════════════════════
 *  أدوات تنسيق القائمة الرسمية — خالصة (تعمل على العميل والخادم)
 *  مطابقة للوثيقة الرسمية للنادي
 * ══════════════════════════════════════════════════════════════
 */

export const COMPOUND_FEE = 1000; // حقوق المركب: 1000 دج لكل منخرط

export interface CompoundEntry {
  subscriberId: string;
  fileNumber: string;
  lastName: string;
  firstName: string;
  birthDate: string;
  date: string;
  source: "new" | "renewal";
  amount: number;
}

export interface CompoundListResult {
  month: number;
  year: number;
  periodFrom: string; // ISO
  periodTo: string; // ISO
  entries: CompoundEntry[];
  stats: {
    total: number;
    newCount: number;
    renewalCount: number;
    totalCompound: number;
  };
}

/** أسماء الأشهر بالجزائرية */
export const MONTH_NAMES = ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

/** تاريخ بصيغة DD/MM/YYYY (مطابق للوثيقة الرسمية) */
export function formatDateDMY(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${date.getFullYear()}`;
}

/** تاريخ بصيغة YYYY/MM/DD (للعرض داخل الجدول) */
export function formatDateYMD(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

/** المبلغ بصيغة الوثيقة: 1000.00 دج */
export function formatAmountDZD(amount: number): string {
  return `${amount.toFixed(2)} دج`;
}

/** تحويل الرقم إلى أحرف عربية (تفقيط) — للعبارة "تم تحديد المبلغ بـ" */
export function numberToArabicWords(num: number): string {
  if (num === 0) return "صفر";
  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
  const tens = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const hundreds = ["", "مائة", "مئتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

  function threeDigits(n: number): string {
    let result = "";
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const o = n % 10;
    if (h > 0) result += hundreds[h];
    if (t === 1 && o === 0) {
      if (result) result += " و";
      result += "عشرة";
    } else if (t === 1 && o > 0) {
      if (result) result += " و";
      result += ones[o] + " عشر";
    } else if (t === 2 && o === 1) {
      if (result) result += " و";
      result += "أحد وعشرون";
    } else if (t === 2 && o === 2) {
      if (result) result += " و";
      result += "اثنان وعشرون";
    } else if (t > 0 && o > 0) {
      if (result) result += " و";
      result += ones[o] + " و" + tens[t];
    } else if (t > 0) {
      if (result) result += " و";
      result += tens[t];
    } else if (o > 0) {
      if (result) result += " و";
      result += ones[o];
    }
    return result;
  }

  let result = "";
  const millions = Math.floor(num / 1000000);
  const thousands = Math.floor((num % 1000000) / 1000);
  const remainder = num % 1000;

  if (millions > 0) {
    if (millions === 1) result += "مليون";
    else if (millions === 2) result += "مليونان";
    else if (millions <= 10) result += ones[millions] + " ملايين";
    else result += threeDigits(millions) + " مليون";
  }
  if (thousands > 0) {
    if (result) result += " و";
    if (thousands === 1) result += "ألف";
    else if (thousands === 2) result += "ألفان";
    else if (thousands <= 10) result += ones[thousands] + " آلاف";
    else result += threeDigits(thousands) + " ألف";
  }
  if (remainder > 0) {
    if (result) result += " و";
    result += threeDigits(remainder);
  }
  return result;
}

/** السطور الرسمية الأربعة لترويسة الوثيقة (مطابقة للوثيقة الرسمية للنادي) */
export const OFFICIAL_HEADER_LINES = [
  "الجمهورية الجزائرية الديمقراطية الشعبية",
  "ديوان المركب المتعدد الرياضات – المجاهد المتوفي سعيد عمارة",
  "المسبح النصف الأولمبي – طاب لحسن",
  "النادي الرياضي المتعدد الرياضات الرائد بلدية سعيدة - فرع السباحة –",
];

/** إمضاءات الوثيقة الرسمية */
export const OFFICIAL_SIGNATURES: Record<string, string> = {
  president: "رئيس الجمعية:",
  compound: "مدير ديوان المركب المتعدد الرياضات",
  unit: "رئيس الوحدة:",
  branch: "رئيس الفرع:",
  insurance: "تأشيرة التأمين:",
};

export const SIGNATURE_OPTIONS = [
  { id: "president", label: OFFICIAL_SIGNATURES.president },
  { id: "compound", label: OFFICIAL_SIGNATURES.compound },
  { id: "unit", label: OFFICIAL_SIGNATURES.unit },
  { id: "branch", label: OFFICIAL_SIGNATURES.branch },
  { id: "insurance", label: OFFICIAL_SIGNATURES.insurance },
];

export interface EnteteLogo {
  src: string;
  width: number;
  height: number;
}

/**
 * amount-in-words — تحويل مبلغ صحيح بالدينار الجزائري إلى حروف عربية
 * ═══════════════════════════════════════════════════════════════════
 * يُستخدم في الإيصالات الرسمية: «فقط ... دج جزائري لا غير»
 * يدعم: مئات / آلاف / ملايين / مليارات + قواعد الألف والمليون
 * (ألف، ألفان، آلاف، ألفًا — مليون، مليونان، ملايين، مليونًا).
 * مبالغ صحيحة Int فقط — لا floating point (المبالغ في الدفتر Int دج).
 */

const ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];

const TEENS = [
  "عشرة",
  "أحد عشر",
  "اثنا عشر",
  "ثلاثة عشر",
  "أربعة عشر",
  "خمسة عشر",
  "ستة عشر",
  "سبعة عشر",
  "ثمانية عشر",
  "تسعة عشر",
];

const TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];

const HUNDREDS = [
  "",
  "مائة",
  "مائتان",
  "ثلاثمائة",
  "أربعمائة",
  "خمسمائة",
  "ستمائة",
  "سبعمائة",
  "ثمانمائة",
  "تسعمائة",
];

/** صيغ المضاعف لكل فئة: [واحد، اثنان، 3-10، 11+] */
const SCALES: Array<[string, string, string, string]> = [
  ["", "", "", ""], // وحدات — بلا اسم فئة
  ["ألف", "ألفان", "آلاف", "ألفًا"],
  ["مليون", "مليونان", "ملايين", "مليونًا"],
  ["مليار", "ملياران", "مليارات", "مليارًا"],
  ["بليون", "بليونان", "بلايين", "بليونًا"],
];

/** تحويل 0-999 إلى كلمات */
function threeDigitsToWords(n: number): string {
  if (n <= 0) return "";
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];

  if (hundreds > 0) parts.push(HUNDREDS[hundreds]);

  if (rest > 0) {
    if (rest < 10) {
      parts.push(ONES[rest]);
    } else if (rest < 20) {
      parts.push(TEENS[rest - 10]);
    } else {
      const unit = rest % 10;
      const ten = Math.floor(rest / 10);
      if (unit > 0) parts.push(`${ONES[unit]} و${TENS[ten]}`);
      else parts.push(TENS[ten]);
    }
  }

  return parts.join(" و");
}

/** تحويل مجموعة (count) مع اسم الفئة scaleIndex إلى كلمات */
function scaledGroupToWords(count: number, scaleIndex: number): string {
  if (count <= 0) return "";
  if (scaleIndex === 0) return threeDigitsToWords(count);
  const [one, two, few, many] = SCALES[scaleIndex];
  if (count === 1) return one;
  if (count === 2) return two;

  // تمييز المضاعف يتبع آخر جزء من العدد:
  //  • ينتهي بـ 3-10  → جمع: «ثلاثة آلاف»
  //  • ينتهي بمئات كاملة (100/200/…) → مفرد مجرور: «مائة ألف»
  //  • غير ذلك (11-99) → تمييز منصوب: «خمسة عشر ألفًا»
  const mod100 = count % 100;
  if (mod100 >= 3 && mod100 <= 10) return `${threeDigitsToWords(count)} ${few}`;
  if (mod100 === 0) return `${threeDigitsToWords(count)} ${one}`;
  return `${threeDigitsToWords(count)} ${many}`;
}

/**
 * تحويل عدد صحيح إلى حروف عربية.
 * أمثلة:
 *   0          → «صفر»
 *   105        → «مائة وخمسة»
 *   1500       → «ألف وخمسمائة»
 *   2400       → «ألفان وأربعمائة»
 *   12000      → «اثنا عشر ألفًا»
 *   2500000    → «مليونان وخمسمائة ألف»
 *   -3500      → «سالب ثلاثة آلاف وخمسمائة»
 */
export function numberToArabicWords(input: number): string {
  const n = Math.round(Math.abs(input));
  if (n === 0) return "صفر";
  if (n > 999_999_999_999) return String(input); // خارج النطاق — أعد الرقم كما هو

  // تقسيم إلى مجموعات ثلاثية من اليمين
  const groups: number[] = [];
  let rest = n;
  while (rest > 0) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }

  const parts: string[] = [];
  // من الفئة الأعلى إلى الأدنى (مليارات ثم ملايين ثم آلاف ثم وحدات)
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    const words = scaledGroupToWords(groups[i], i);
    if (words) parts.push(words);
  }

  const positive = parts.join(" و");
  return input < 0 ? `سالب ${positive}` : positive;
}

/**
 * تحويل مبلغ بالدينار إلى الصيغة الرسمية للإيصالات.
 * مثال: 15750 → «فقط خمسة عشر ألفًا وسبعمائة وخمسون دج جزائري لا غير»
 */
export function amountToDzdWords(amount: number): string {
  const words = numberToArabicWords(amount);
  if (words === "صفر") return "صفر دج جزائري فقط لا غير";
  return `فقط ${words} دج جزائري لا غير`;
}

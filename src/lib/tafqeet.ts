/**
 * tafqeet.ts — تفقيط المبالغ المالية بالدينار الجزائري
 * ═══════════════════════════════════════════════════════════════
 * تحويل الأرقام إلى كلمات عربية فصيحة بدقة مع مراعاة الإعراب
 * وقواعد الأعداد بالدينار الجزائري (دج) والسنتيم (إن وُجد).
 *
 * مثال:
 *   tafqeetDZD(45000) => "خمسة وأربعون ألف دينار جزائري فقط لا غير"
 *   tafqeetDZD(2500)  => "ألفان وخمسمائة دينار جزائري فقط لا غير"
 *   tafqeetDZD(1000000) => "مليون دينار جزائري فقط لا غير"
 */

const ONES = [
  "", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة",
];

const TEENS = [
  "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر",
  "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر",
];

const TENS = [
  "", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون",
];

const HUNDREDS = [
  "", "مائة", "مئتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة",
];

function convertThreeDigits(n: number): string {
  let result = "";
  const h = Math.floor(n / 100);
  const rem = n % 100;
  const t = Math.floor(rem / 10);
  const o = rem % 10;

  if (h > 0) {
    result += HUNDREDS[h];
  }

  if (rem > 0) {
    if (result) result += " و";

    if (rem < 10) {
      result += ONES[rem];
    } else if (rem >= 10 && rem < 20) {
      result += TEENS[rem - 10];
    } else {
      if (o === 1) {
        result += "واحد و" + TENS[t];
      } else if (o === 2) {
        result += "اثنان و" + TENS[t];
      } else if (o > 2) {
        result += ONES[o] + " و" + TENS[t];
      } else {
        result += TENS[t];
      }
    }
  }

  return result;
}

/**
 * تحويل رقم صحيح إلى نص عربي
 */
export function numberToArabicWords(num: number): string {
  if (num === 0) return "صفر";
  if (num < 0) return "سالب " + numberToArabicWords(Math.abs(num));

  const billions = Math.floor(num / 1000000000);
  let remainder = num % 1000000000;
  const millions = Math.floor(remainder / 1000000);
  remainder = remainder % 1000000;
  const thousands = Math.floor(remainder / 1000);
  const ones = remainder % 1000;

  const parts: string[] = [];

  // مليارات
  if (billions > 0) {
    if (billions === 1) parts.push("مليار");
    else if (billions === 2) parts.push("ملياران");
    else if (billions <= 10) parts.push(ONES[billions] + " مليارات");
    else parts.push(convertThreeDigits(billions) + " مليار");
  }

  // ملايين
  if (millions > 0) {
    if (millions === 1) parts.push("مليون");
    else if (millions === 2) parts.push("مليونان");
    else if (millions <= 10) parts.push(ONES[millions] + " ملايين");
    else parts.push(convertThreeDigits(millions) + " مليون");
  }

  // آلاف
  if (thousands > 0) {
    if (thousands === 1) parts.push("ألف");
    else if (thousands === 2) parts.push("ألفان");
    else if (thousands <= 10) parts.push(ONES[thousands] + " آلاف");
    else parts.push(convertThreeDigits(thousands) + " ألف");
  }

  // مئات وآحاد
  if (ones > 0) {
    parts.push(convertThreeDigits(ones));
  }

  return parts.join(" و");
}

/**
 * تحويل المبلغ المالي إلى حروف بالدينار الجزائري
 * @param amount المبلغ بالدينار
 * @param withEnding إضافة "فقط لا غير" في النهاية
 */
export function tafqeetDZD(amount: number, withEnding: boolean = true): string {
  if (!amount || isNaN(amount) || amount === 0) {
    return `صفر دينار جزائري${withEnding ? " فقط لا غير" : ""}`;
  }

  const integerPart = Math.floor(Math.abs(amount));
  const decimalPart = Math.round((Math.abs(amount) - integerPart) * 100);

  const dinarWords = numberToArabicWords(integerPart);
  let result = `${dinarWords} دينار جزائري`;

  if (decimalPart > 0) {
    const centimeWords = numberToArabicWords(decimalPart);
    result += ` و${centimeWords} سنتيم`;
  }

  if (withEnding) {
    result += " فقط لا غير";
  }

  return result;
}

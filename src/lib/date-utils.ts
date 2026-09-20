// Centralized Date & Number formatting utilities for AquaCore Club Manager
// Enforces standard Latin/Western Arabic numerals (0-9) everywhere.

const EASTERN_ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/**
 * Converts any Eastern Arabic (٠-٩) or Persian (۰-۹) digits into standard Western (0-9) digits.
 * Also removes invisible bidirectional isolate marks that can interfere with numeric alignment.
 */
export function toLatinDigits(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[٠-٩]/g, (d) => String(EASTERN_ARABIC_DIGITS.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[\u200e\u200f\u061c]/g, ""); // strip invisible LTR/RTL marks around digits
}

/**
 * Formats a date into a clean DD/MM/YYYY string using Latin digits (e.g. 03/10/2026).
 */
export function formatDate(date: Date | string | number | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Formats a date into YYYY-MM-DD for HTML input[type="date"] values.
 */
export function formatDateYMD(date: Date | string | number | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  return `${year}-${month}-${day}`;
}

/**
 * Formats a date with Arabic weekday and month names, but GUARANTEES 100% Latin digits (e.g. السبت، 3 أكتوبر 2026).
 */
export function formatDateArabic(
  date: Date | string | number | null | undefined,
  options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", year: "numeric" }
): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";

  try {
    const formatted = d.toLocaleDateString("ar-DZ-u-nu-latn", {
      ...options,
      numberingSystem: "latn",
    });
    return toLatinDigits(formatted);
  } catch {
    return formatDate(d);
  }
}

/**
 * Formats a date and time into DD/MM/YYYY HH:mm (e.g. 03/10/2026 14:30).
 */
export function formatDateTime(date: Date | string | number | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";

  const datePart = formatDate(d);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${datePart} ${hours}:${minutes}`;
}

/**
 * Formats a time into HH:mm (e.g. 14:30).
 */
export function formatTime(date: Date | string | number | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";

  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}

function fixLocaleNuLatn(locales?: string | string[]): string | string[] | undefined {
  if (!locales) return "ar-DZ-u-nu-latn";
  if (typeof locales === "string") {
    if (locales.startsWith("ar") && !locales.includes("nu-latn")) {
      return `${locales}-u-nu-latn`;
    }
    return locales;
  }
  if (Array.isArray(locales)) {
    return locales.map((l) => (l.startsWith("ar") && !l.includes("nu-latn") ? `${l}-u-nu-latn` : l));
  }
  return locales;
}

/**
 * Global prototype guard that intercepts Date and Intl methods so that ANY third-party library,
 * native call, or component will NEVER render Eastern Arabic numerals (٣/١٠/٢٠٢٦).
 */
export function installLatinDigitsGuard(): void {
  if (typeof globalThis === "undefined") return;

  const g = globalThis as any;
  if (g.__latinDigitsGuardInstalled) return;
  g.__latinDigitsGuardInstalled = true;

  // 1. Date.prototype.toLocaleDateString
  const origDateToString = Date.prototype.toLocaleDateString;
  Date.prototype.toLocaleDateString = function (
    locales?: string | string[],
    options?: Intl.DateTimeFormatOptions
  ) {
    const opts = { ...options, numberingSystem: "latn" as const };
    const loc = fixLocaleNuLatn(locales);
    try {
      return toLatinDigits(origDateToString.call(this, loc, opts));
    } catch {
      return toLatinDigits(origDateToString.call(this, "fr-DZ", opts));
    }
  };

  // 2. Date.prototype.toLocaleString
  const origLocaleString = Date.prototype.toLocaleString;
  Date.prototype.toLocaleString = function (
    locales?: string | string[],
    options?: Intl.DateTimeFormatOptions
  ) {
    const opts = { ...options, numberingSystem: "latn" as const };
    const loc = fixLocaleNuLatn(locales);
    try {
      return toLatinDigits(origLocaleString.call(this, loc, opts));
    } catch {
      return toLatinDigits(origLocaleString.call(this, "fr-DZ", opts));
    }
  };

  // 3. Date.prototype.toLocaleTimeString
  const origTimeString = Date.prototype.toLocaleTimeString;
  Date.prototype.toLocaleTimeString = function (
    locales?: string | string[],
    options?: Intl.DateTimeFormatOptions
  ) {
    const opts = { ...options, numberingSystem: "latn" as const };
    const loc = fixLocaleNuLatn(locales);
    try {
      return toLatinDigits(origTimeString.call(this, loc, opts));
    } catch {
      return toLatinDigits(origTimeString.call(this, "fr-DZ", opts));
    }
  };

  // 4. Intl.DateTimeFormat.prototype.format
  // ⚠️ In newer V8, `format` is an accessor whose getter throws when read from
  // the prototype itself ("incompatible receiver"). Guard the read so the app
  // never crashes; instance formatting stays covered by the Date guards above.
  if (typeof Intl !== "undefined" && Intl.DateTimeFormat && Intl.DateTimeFormat.prototype) {
    try {
      const origFormat = Intl.DateTimeFormat.prototype.format;
      if (typeof origFormat === "function") {
        Intl.DateTimeFormat.prototype.format = function (date?: Date | number) {
          return toLatinDigits(origFormat.call(this, date));
        };
      }
    } catch {
      // Skip the Intl.DateTimeFormat patch — Date.prototype guards already enforce Latin digits.
    }
  }

  // 5. Number.prototype.toLocaleString
  const origNumberLocaleString = Number.prototype.toLocaleString;
  Number.prototype.toLocaleString = function (
    locales?: string | string[],
    options?: Intl.NumberFormatOptions
  ) {
    const opts = { ...options, numberingSystem: "latn" as const };
    const loc = fixLocaleNuLatn(locales);
    try {
      return toLatinDigits(origNumberLocaleString.call(this, loc, opts));
    } catch {
      return toLatinDigits(origNumberLocaleString.call(this, "fr-DZ", opts));
    }
  };
}

// Auto-run guard upon file load
installLatinDigitsGuard();

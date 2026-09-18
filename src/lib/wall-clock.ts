/**
 * wall-clock.ts — اصطلاح موحّد لأوقات العمل (Pointage اليدوي)
 * ═════════════════════════════════════════════════════════════
 * المشكلة الأصلية: الوقت المُدخل «09:00» كان يُفسَّر بتوقيت الخادم
 * (UTC على Vercel) ثم يُعرض بتوقيت المتصفح (الجزائر UTC+1) → +1 ساعة.
 *
 * الاصطلاح المعتمد: «wall-clock as UTC» — تُخزَّن ساعة الحائط كما هي
 * بمكوّنات UTC، وتُقرأ دائماً بمكوّنات UTC. وبذلك:
 *   09:00 محفوظة = 09:00 معروضة — على أي خادم وأي متصفح وأي منطقة زمنية.
 *
 * قواعد:
 *  - الكتابة: parseWallDateTime("2026-09-02", "09:00") → 2026-09-02T09:00Z
 *  - القراءة: formatWallTime(iso) → "09:00" (getUTCHours/getUTCMinutes)
 *  - الفروق الزمنية (مدة العمل) آمنة أصلاً لأنها فرق لحظتين.
 */

/** يبني لحظة UTC من تاريخ "YYYY-MM-DD" ووقت "HH:mm" أو "HH:mm:ss" (ساعة الحائط) */
export function parseWallDateTime(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0));
}

/** تاريخ اليوم بتوقيت المتصفح المحلي بصيغة YYYY-MM-DD (للحقول والفلاتر) */
export function toLocalYMD(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** تنسيق وقت مخزّن (wall-clock UTC) → "HH:mm" ثابت في أي منطقة زمنية */
export function formatWallTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** تنسيق تاريخ مخزّن (منتصف ليل UTC) → "DD/MM/YYYY" ثابت */
export function formatWallDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

/** بداية شهر UTC من "YYYY-MM" */
export function utcMonthStart(month: string): Date {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, 1, 0, 0, 0, 0));
}

/** نهاية شهر UTC من "YYYY-MM" (آخر مللي ثانية في الشهر) */
export function utcMonthEnd(month: string): Date {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m || 1, 0, 23, 59, 59, 999));
}

/** بداية/نهاية فترة UTC من تاريخي "YYYY-MM-DD" (شاملة الطرفين) */
export function utcRange(from: string, to: string): { start: Date; end: Date } {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return {
    start: new Date(Date.UTC(fy, (fm || 1) - 1, fd || 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(ty, (tm || 1) - 1, td || 1, 23, 59, 59, 999)),
  };
}

/** المدة بالساعات بين لحظتي بداية/نهاية مع خصم الاستراحة (يضيف يوماً إذا انقلّت الوردية) */
export function durationHours(startIso: string | Date, endIso: string | Date, breakMinutes = 0): number {
  const start = new Date(startIso).getTime();
  let end = new Date(endIso).getTime();
  if (end <= start) end += 86400000; // وردية ليلية تعبر منتصف الليل
  return Math.max(0, (end - start) / 3600000 - breakMinutes / 60);
}

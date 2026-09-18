/**
 * contracts-shared.ts — مساعدات مشتركة بين لوحة العقود وملف الموظف (المرحلة 5)
 * دوال نقية بلا حوافز React — آمنة للعميل والخادم.
 */

export const POSITIONS = [
  { value: "guard", label: "حارس سباحة" },
  { value: "coach", label: "مدرب" },
  { value: "admin", label: "إداري" },
  { value: "maintenance", label: "عامل صيانة" },
  { value: "cleaner", label: "منظفة" },
  { value: "seasonal", label: "موسمي" },
  { value: "other", label: "أخرى" },
] as const;

export function positionLabel(code: string): string {
  return POSITIONS.find((p) => p.value === code)?.label || code;
}

// ★ المرحلة 5 (§4): أنواع العقود القابلة للتوسعة
export const CONTRACT_TYPES = [
  { value: "HOURLY", label: "بالساعة" },
  { value: "MONTHLY", label: "شهري" },
  { value: "TEMPORARY", label: "مؤقت" },
  { value: "FIXED_TERM", label: "مدة محددة" },
  { value: "OTHER", label: "آخر" },
] as const;

export function contractTypeLabel(code: string | null | undefined): string {
  if (!code) return CONTRACT_TYPES[0].label;
  return CONTRACT_TYPES.find((t) => t.value === code)?.label || code;
}

// ★ المرحلة 5 (§3): حالات الموظف
export const EMPLOYEE_STATUS_UI: Record<string, { label: string; badge: string }> = {
  ACTIVE: { label: "نشط", badge: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  INACTIVE: { label: "غير نشط", badge: "bg-slate-500/10 text-slate-600 border-slate-500/30" },
  SUSPENDED: { label: "موقوف", badge: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  ARCHIVED: { label: "مؤرشف", badge: "bg-violet-500/10 text-violet-700 border-violet-500/30" },
};

export function employeeStatusInfo(emp: { status?: string; active: boolean }): { label: string; badge: string } {
  const s = (emp.status || (emp.active ? "ACTIVE" : "INACTIVE")).toUpperCase();
  return EMPLOYEE_STATUS_UI[s] || EMPLOYEE_STATUS_UI.ACTIVE;
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

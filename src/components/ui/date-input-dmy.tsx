"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * DateInputDDMMYYYY — حقل تاريخ بصيغة DD/MM/YYYY في كل الموقع
 * ═══════════════════════════════════════════════════════════════
 * • يعرض ويقبل التاريخ بصيغة يوم/شهر/سنة (مثل باقي تواريخ الموقع) —
 *   بدل «mm/dd/yyyy» الذي يفرضه input[type=date] حسب لغة المتصفح.
 * • القيمة (value) تبقى بصيغة ISO القياسية (yyyy-mm-dd) — نفس صيغة
 *   input[type=date] — فلا يتغير أي منطق حفظ أو API.
 * • يُستدعى onChange بقيمة ISO صالحة أو "" فقط — لا قيم ناقصة أبداً،
 *   فلا تبقى قيمة قديمة مخفية أثناء الكتابة.
 * • يدعم اللصق بصيغة ISO أو DD/MM/YYYY، ويكمل الفواصل تلقائياً أثناء الكتابة.
 * • min/max بنفس صيغة ISO (كما في input[type=date]).
 */

function isValidDate(dd: number, mm: number, yyyy: number): boolean {
  if (!Number.isInteger(dd) || !Number.isInteger(mm) || !Number.isInteger(yyyy)) return false;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 1000 || yyyy > 9999) return false;
  const dt = new Date(Date.UTC(yyyy, mm - 1, dd));
  return dt.getUTCFullYear() === yyyy && dt.getUTCMonth() === mm - 1 && dt.getUTCDate() === dd;
}

/** ISO (أو طابع زمني كامل) → عرض DD/MM/YYYY */
function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** عرض DD/MM/YYYY → ISO أو null إن كان غير صالح */
function displayToIso(display: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display.trim());
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!isValidDate(dd, mm, yyyy)) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export interface DateInputDDMMYYYYProps
  extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> {
  /** القيمة بصيغة ISO (yyyy-mm-dd) */
  value: string;
  /** يُستدعى بقيمة ISO صالحة أو "" */
  onChange: (iso: string) => void;
  /** أدنى تاريخ مسموح (ISO) */
  min?: string;
  /** أقصى تاريخ مسموح (ISO) */
  max?: string;
}

export function DateInputDDMMYYYY({
  value,
  onChange,
  min,
  max,
  className,
  ...props
}: DateInputDDMMYYYYProps) {
  const [display, setDisplay] = React.useState<string>(() => isoToDisplay(value));
  const lastEmittedRef = React.useRef<string>(value ?? "");

  // مزامنة صامتة: تتغير القيمة الخارجية من مصدر آخر (وليس من كتابتنا) → نحدّث العرض
  React.useEffect(() => {
    const v = value ?? "";
    if (v !== lastEmittedRef.current) {
      lastEmittedRef.current = v;
      setDisplay(isoToDisplay(v));
    }
  }, [value]);

  const emit = (iso: string) => {
    lastEmittedRef.current = iso;
    onChange(iso);
  };

  const handleChange = (raw: string) => {
    // لصق بصيغة ISO (من أي حقل آخر في الموقع) — الكتابة اليدوية لا تحتوي "-"
    const isoPaste = /^\s*(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    if (isoPaste) {
      const iso = `${isoPaste[1]}-${isoPaste[2]}-${isoPaste[3]}`;
      setDisplay(isoToDisplay(iso));
      emit(iso);
      return;
    }

    const digits = raw.replace(/\D/g, "").slice(0, 8);
    // تنسيق تدريجي: DD → DD/MM → DD/MM/YYYY
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setDisplay(out);

    if (digits.length === 0) {
      emit("");
      return;
    }

    if (digits.length === 8) {
      const iso = displayToIso(out);
      if (!iso) {
        emit(""); // تاريخ غير صالح (مثل 32/13/...) — لا تبقى قيمة قديمة
        return;
      }
      if (min && iso < min) {
        emit("");
        return;
      }
      if (max && iso > max) {
        emit("");
        return;
      }
      emit(iso);
      return;
    }

    // كتابة جارية ناقصة — نُصفّر القيمة حفاظاً على الاتساق
    if (lastEmittedRef.current !== "") emit("");
  };

  const complete = /^\d{2}\/\d{2}\/\d{4}$/.test(display);
  const parsedIso = complete ? displayToIso(display) : null;
  const invalid =
    complete &&
    (!parsedIso ||
      (min && parsedIso < min) ||
      (max && parsedIso > max));

  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      dir="ltr"
      placeholder="DD/MM/YYYY"
      maxLength={10}
      value={display}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={() => {
        // إن غادر المستخدم الحقل و هو ناقص/غير صالح → يعرض ما هو محفوظ فعلاً
        setDisplay(isoToDisplay(value ?? ""));
      }}
      aria-invalid={invalid || undefined}
      className={cn(invalid && "border-destructive focus-visible:ring-destructive", className)}
      {...props}
    />
  );
}

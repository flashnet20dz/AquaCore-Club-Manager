"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ChipSelector } from "@/components/chip-selector";
import {
  User,
  Droplet,
  CreditCard,
  Calendar,
  Clock,
  Waves,
  UserPlus,
  Save,
  Hash,
  Loader2,
  X,
  CheckCircle2,
  Printer,
  UserRound,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { notifyFinancialUpdated } from "@/lib/financial-events";
import { useSubscriptionTypes } from "@/hooks/use-subscription-types";
import { useSwimConfig } from "@/hooks/use-swim-config";
import { PhotoUploader } from "@/components/photo-uploader";
import {
  BLOOD_TYPES,
  SUBSCRIPTION_TYPES,
  PAYMENT_STATUSES,
  isExemptStatus,
  SWIMMING_DAYS,
  type BloodType,
  type SubscriptionType,
  type PaymentStatus,
  type SwimmingDays,
  type TimeSlot,
  type Gender,
} from "@/lib/rcs";

export interface SubscriberFormValues {
  lastName: string;
  firstName: string;
  birthDate: string;          // DD/MM/YYYY (manual text)
  gender: Gender | null;
  bloodType: BloodType | null;
  subscriptionType: SubscriptionType | null;
  lastPaymentDate: string;    // DD/MM/YYYY (manual text)
  paymentStatus: PaymentStatus | null;
  swimmingDays: SwimmingDays | null;
  timeSlot: TimeSlot | null;
  phone: string;
  photoUrl?: string;
  fileNumber?: string; // ★ رقم الملف (قابل للتعديل)
  startDate?: string;   // ★ تاريخ بداية خاص (اختياري) — DD/MM/YYYY
}

interface SubscriberFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<SubscriberFormValues> & { id?: string };
  onSaved: () => void;
}

const emptyForm: SubscriberFormValues = {
  lastName: "",
  firstName: "",
  birthDate: "",
  gender: null,
  bloodType: null,
  subscriptionType: null,
  lastPaymentDate: "",
  paymentStatus: null,
  swimmingDays: null,
  timeSlot: null,
  phone: "",
  fileNumber: "",
  startDate: "",
};

// ═══ Manual date helpers (DD/MM/YYYY — day/month/year, Arabic/French format) ═══
// Format today as DD/MM/YYYY
function todayYMD(): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const y = d.getFullYear();
  return `${day}/${m}/${y}`;
}

// Validate a DD/MM/YYYY string. Returns Date | null.
// Accepts DD/MM/YYYY or DD-MM-YYYY (we normalize to /).
function parseManualDate(value: string): Date | null {
  if (!value) return null;
  // Normalize separators to /
  const normalized = value.trim().replace(/[-.]/g, "/");
  // Match DD/MM/YYYY (day first, then month, then 4-digit year)
  const m = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const y = parseInt(m[3], 10);
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > 31) return null;
  if (y < 1900 || y > 2100) return null;
  const dt = new Date(y, mo - 1, d);
  // Verify round-trip (reject e.g. 31/02/2024)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

// Format a Date as DD/MM/YYYY
function dateToYMD(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const y = d.getFullYear();
  return `${day}/${m}/${y}`;
}

// Convert ISO date (from DB) to DD/MM/YYYY for the form
function isoToYMD(iso: string | Date | undefined | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return dateToYMD(d);
  } catch {
    return "";
  }
}

// Convert DD/MM/YYYY (form value) to ISO string for API (YYYY-MM-DD)
function ymdToIso(ymd: string): string | null {
  const d = parseManualDate(ymd);
  if (!d) return null;
  return d.toISOString().split("T")[0];
}

export function SubscriberForm({ open, onOpenChange, initial, onSaved }: SubscriberFormProps) {
  const [form, setForm] = useState<SubscriberFormValues>(emptyForm);
  const { activeTypes: subTypes } = useSubscriptionTypes();
  // 🔗 الميزة متزامنة مع الإعدادات: الأيام والتوقيتات من قاعدة البيانات (تبويب الإعدادات ← المنخرطون)
  const { dayNames: swimDayNames, slotLabels: swimSlotLabels } = useSwimConfig();

  // 🏊 خيارات أيام السباحة: أزواج مجموعات النادي المشتقة من الأيام المفتوحة في الإعدادات
  // مثال: الأحد والأربعاء / الإثنين والخميس / الثلاثاء والسبت
  // الزوج يختفي تلقائياً إن أُغلق أحد يوميه (مثل الجمعة يوم الصيانة والراحة)
  const dayOptions = useMemo(() => {
    // تطبيع الهمزات: القاعدة قد تحفظ «الاثنين» والثوابت «الإثنين» — نفس اليوم
    const norm = (s: string) => s.replace(/[أإآ]/g, "ا").trim();
    const open = swimDayNames.map(norm);
    const pairs = SWIMMING_DAYS.filter((p) => {
      if (p === "كل الأيام") return true;
      return p.split(" و").every((d) => open.includes(norm(d)));
    }).map((p) => ({ value: p, label: p }));
    // أمان: إن لم يطابق أي زوج الأيام المفتوحة (أسماء مخصصة)، اعرض الأيام مفردة
    return pairs.length > 1 ? pairs : swimDayNames.map((d) => ({ value: d, label: d }));
  }, [swimDayNames]);
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial?.id;
  // ★ معاينة رقم الملف التالي
  const [previewFileNumber, setPreviewFileNumber] = useState<string>("");
  const [loadingFileNumber, setLoadingFileNumber] = useState(false);

  // 🔑 الصورة المؤقتة للمنخرط الجديد (قبل الحفظ)
  const [pendingPhoto, setPendingPhoto] = useState<{
    original: string; cropped: string; thumbnail: string; faceDetected: boolean;
  } | null>(null);

  // ★ Success view (after save): shows the file number prominently
  const [savedResult, setSavedResult] = useState<{
    fileNumber: string;
    fullName: string;
    subscriberId: string;
    subscriptionType: string;
  } | null>(null);

  // ★ جلب رقم الملف التالي فور اختيار نوع الاشتراك — استخدام endpoint خفيف
  useEffect(() => {
    if (form.subscriptionType && !isEdit) {
      setLoadingFileNumber(true);
      // 🔑 Endpoint خفيف: يعيد فقط الرقم التالي — لا يجلب 10000 منخرط
      fetch(`/api/subscribers/next-file-number?subscriptionType=${encodeURIComponent(form.subscriptionType)}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.fileNumber) {
            setPreviewFileNumber(data.fileNumber);
            setForm(f => ({ ...f, fileNumber: data.fileNumber }));
          }
        })
        .catch(() => {/* silent */})
        .finally(() => setLoadingFileNumber(false));
    } else {
      setPreviewFileNumber("");
    }
     
  }, [form.subscriptionType, isEdit]);

  useEffect(() => {
    if (open) {
      setSavedResult(null); // reset success view on open
      setPendingPhoto(null);
      setForm({
        ...emptyForm,
        ...initial,
        // Convert DB ISO dates to manual DD/MM/YYYY
        birthDate: initial?.birthDate ? isoToYMD(initial.birthDate) : "",
        lastPaymentDate: initial?.lastPaymentDate ? isoToYMD(initial.lastPaymentDate) : "",
        startDate: initial?.startDate ? isoToYMD(initial.startDate) : "",
      } as SubscriberFormValues);
    } else {
      // When dialog closes, clear everything
      setForm(emptyForm);
      setSavedResult(null);
      setPreviewFileNumber("");
      setPendingPhoto(null);
    }
     
  }, [open, initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.lastName.trim() || !form.firstName.trim()) {
      toast.error("يرجى إدخال اللقب والاسم");
      return;
    }
    // ★ تحقق من صحة تاريخ الميلاد المكتوب يدوياً
    if (!form.birthDate) {
      toast.error("يرجى إدخال تاريخ الميلاد");
      return;
    }
    const birthDate = parseManualDate(form.birthDate);
    if (!birthDate) {
      toast.error("تاريخ الميلاد غير صالح — استخدم الصيغة DD/MM/YYYY (مثال: 15/05/2010)");
      return;
    }
    if (!form.gender) {
      toast.error("يرجى اختيار الجنس");
      return;
    }
    if (!form.subscriptionType) {
      toast.error("يرجى اختيار نوع الاشتراك");
      return;
    }
    if (!form.paymentStatus) {
      toast.error("يرجى اختيار حالة الدفع");
      return;
    }

    // ★ إذا قُدم تاريخ بداية خاص، تحقق من صحته
    let startDateIso: string | null = null;
    if (form.startDate && form.startDate.trim()) {
      const sd = parseManualDate(form.startDate);
      if (!sd) {
        toast.error("تاريخ البداية الخاص غير صالح — استخدم DD/MM/YYYY");
        return;
      }
      startDateIso = ymdToIso(form.startDate);
    }

    // ★ تحقق من تاريخ آخر دفعة إن وُجد
    let lastPaymentIso: string | null = null;
    if (form.lastPaymentDate && form.lastPaymentDate.trim()) {
      const lp = parseManualDate(form.lastPaymentDate);
      if (!lp) {
        toast.error("تاريخ آخر دفعة غير صالح — استخدم DD/MM/YYYY");
        return;
      }
      lastPaymentIso = ymdToIso(form.lastPaymentDate);
    }

    setSaving(true);
    try {
      const url = isEdit ? `/api/subscribers/${initial!.id}` : "/api/subscribers";
      const method = isEdit ? "PUT" : "POST";
      const { offlineFetch } = await import("@/hooks/use-offline-mutation");
      // ★ Build body with normalized ISO dates
      const body: Record<string, unknown> = {
        ...form,
        birthDate: ymdToIso(form.birthDate),
        lastPaymentDate: lastPaymentIso,
        startDate: startDateIso,
      };
      const res = await offlineFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "فشل الحفظ");
      }
      const data = await res.json().catch(() => ({}));
      if (data.offline) {
        toast.success("✓ تم الحفظ محلياً — سيُزامن عند عودة الاتصال", {
          description: "المنخرط محفوظ على هذا الجهاز",
        });
      }
      notifyFinancialUpdated();

      // 🔑 ارفع الصورة المؤقتة بعد حفظ المنخرط الجديد
      if (pendingPhoto && data.subscriber?.id) {
        try {
          await fetch(`/api/subscribers/${data.subscriber.id}/photo`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pendingPhoto),
          });
          toast.success("✓ تم حفظ الصورة الشخصية");
        } catch {
          toast.error("تم حفظ المنخرط لكن فشل رفع الصورة — يمكنك إضافتها لاحقاً بالتعديل");
        }
      }

      // ★ اعرض صفحة النجاح مع رقم الملف (بدلاً من إغلاق النافذة مباشرة)
      if (data.subscriber) {
        const s = data.subscriber;
        setSavedResult({
          fileNumber: s.fileNumber || form.fileNumber || previewFileNumber || "—",
          fullName: `${s.lastName || form.lastName} ${s.firstName || form.firstName}`.trim(),
          subscriberId: s.id,
          subscriptionType: s.subscriptionType || form.subscriptionType || "",
        });
        // لا نُغلق النافذة — نُظهر صفحة النجاح
      } else {
        // fallback: إغلاق عادي
        onOpenChange(false);
      }
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطأ غير متوقع");
    } finally {
      setSaving(false);
    }
  };

  // Live preview of computed fees
  const today = new Date();
  const birthDate = form.birthDate ? parseManualDate(form.birthDate) : null;
  const age = birthDate
    ? today.getFullYear() -
      birthDate.getFullYear() -
      (today.getMonth() < birthDate.getMonth() ||
      (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
        ? 1
        : 0)
    : null;

  // حساب الرسوم ديناميكياً من خصائص نوع الاشتراك
  let subscriptionFee: number | null = null;
  let insuranceFee: number | null = null;
  // ★ EXEMPT: no fees at all
  if (isExemptStatus(form.paymentStatus)) {
    subscriptionFee = 0;
    insuranceFee = 0;
  } else if (form.paymentStatus !== "لم يدفع" && form.paymentStatus) {
    const typeConfig = subTypes.find((t) => t.code === form.subscriptionType);
    if (typeConfig) {
      // استخدام الخصائص الديناميكية
      if (typeConfig.freeSubscription) {
        subscriptionFee = 0;
        insuranceFee = 0;
      } else {
        // ★ تطبيق منطق العمر: ≥ 14 سنة = subscriptionFee + 200
        const baseFee = typeConfig.subscriptionFee;
        subscriptionFee = (age !== null && age >= 14 && baseFee > 0) ? baseFee + 200 : baseFee;
        insuranceFee = typeConfig.requiresInsurance ? typeConfig.insuranceFee : 0;
      }
    } else {
      // fallback للأنواع غير الموجودة في DB
      insuranceFee = 500;
      if (form.paymentStatus === "تأمين فقط") {
        subscriptionFee = 0;
      } else if (form.paymentStatus === "اشتراك 300") {
        subscriptionFee = 300;
      } else if (age !== null) {
        subscriptionFee = age < 14 ? 1300 : 1500;
      }
    }
  }
  const total = subscriptionFee !== null && insuranceFee !== null ? subscriptionFee + insuranceFee : null;

  // ─── Success view (file number confirmation) ───
  if (savedResult) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
          <div className="px-6 pt-8 pb-6 text-center bg-gradient-to-b from-emerald-500/15 via-emerald-500/5 to-transparent border-b border-emerald-500/20">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 mb-3">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h2 className="text-lg font-bold">تم تسجيل المنخرط بنجاح</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{savedResult.fullName}</p>
          </div>

          <div className="px-6 py-6 space-y-4">
            {/* ★ رقم الملف — بارز */}
            <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                <Hash className="h-3.5 w-3.5" /> رقم ملف المنخرط
              </div>
              <div className="text-4xl font-extrabold font-mono text-primary tracking-wider" dir="ltr">
                {savedResult.fileNumber}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                احتفظ بهذا الرقم لاستخدامه في التجديد والبطاقة والبحث
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-muted/50 p-2.5">
                <p className="text-muted-foreground mb-0.5">نوع الاشتراك</p>
                <p className="font-semibold">{savedResult.subscriptionType || "—"}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2.5">
                <p className="text-muted-foreground mb-0.5">المعرّف</p>
                <p className="font-mono text-[10px]" dir="ltr">{savedResult.subscriberId.slice(0, 12)}…</p>
              </div>
            </div>

            <div className="rounded-lg border border-amber-300/40 bg-amber-50 dark:bg-amber-950/20 p-3 flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                يمكنك الآن طباعة بطاقة المنخرط، إضافة صورة شخصية، أو تسجيل منخرط جديد.
              </p>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-muted/30 gap-2 flex flex-row-reverse">
            <Button
              type="button"
              onClick={() => {
                setSavedResult(null);
                setForm({ ...emptyForm, birthDate: "", lastPaymentDate: todayYMD(), startDate: "" });
                setPreviewFileNumber("");
                setPendingPhoto(null);
                // إبقاء النافذة مفتوحة لتسجيل منخرط جديد
              }}
              className="flex-1 h-11"
            >
              <UserPlus className="h-4 w-4 ml-1" /> تسجيل منخرط آخر
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                // فتح صفحة البطاقة / الطباعة في تبويب جديد إن أمكن
                if (savedResult.subscriberId) {
                  window.dispatchEvent(new CustomEvent("print-subscriber-card", { detail: { id: savedResult.subscriberId } }));
                }
                onOpenChange(false);
              }}
              className="flex-1 h-11"
            >
              <Printer className="h-4 w-4 ml-1" /> طباعة البطاقة
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-11"
            >
              تم
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ★ تعيين القيمة الافتراضية لتاريخ آخر دفعة عند إنشاء (today)
  // لكن فقط إذا لم يُحدد قيمة مسبقاً
  const effectiveLastPayment = form.lastPaymentDate || (isEdit ? "" : todayYMD());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92dvh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-l from-primary/10 to-transparent">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              {isEdit ? <Save className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            </div>
            {isEdit ? "تعديل بيانات منخرط" : "تسجيل منخرط جديد"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">
          {/* الصورة الشخصية — تظهر دائماً (في وضع التعديل ترفع للـ API، في الإضافة تُخزّن مؤقتاً) */}
          <PhotoUploader
            subscriberId={isEdit ? initial?.id : undefined}
            currentPhoto={form.photoUrl || (pendingPhoto?.cropped ?? null)}
            onPhotoChange={(url) => setForm({ ...form, photoUrl: url || "" })}
            onPhotoProcessed={(data) => setPendingPhoto(data)}
          />

          {/* Personal info */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              المعلومات الشخصية
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lastName" className="text-sm font-semibold">اللقب *</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  placeholder="بورقعة"
                  className="h-11"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="firstName" className="text-sm font-semibold">الاسم *</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  placeholder="محمد الأمين"
                  className="h-11"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="birthDate" className="text-sm font-semibold flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> تاريخ الميلاد *
                  <span className="text-[10px] font-normal text-muted-foreground">(DD/MM/YYYY)</span>
                </Label>
                <Input
                  id="birthDate"
                  type="text"
                  inputMode="numeric"
                  value={form.birthDate}
                  onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                  placeholder="15/05/2010"
                  className="h-11 font-mono"
                  dir="ltr"
                  pattern="\d{1,2}[/-]\d{1,2}[/-]\d{4}"
                  maxLength={10}
                  required
                />
                {form.birthDate && !parseManualDate(form.birthDate) && (
                  <p className="text-xs text-rose-600">⚠ الصيغة غير صحيحة — استخدم DD/MM/YYYY</p>
                )}
                {age !== null && (
                  <p className="text-xs text-muted-foreground">العمر الحالي: <span className="font-bold text-foreground">{age} سنة</span></p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastPaymentDate" className="text-sm font-semibold flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> تاريخ آخر دفعة
                  <span className="text-[10px] font-normal text-muted-foreground">(DD/MM/YYYY)</span>
                </Label>
                <Input
                  id="lastPaymentDate"
                  type="text"
                  inputMode="numeric"
                  value={effectiveLastPayment}
                  onChange={(e) => setForm({ ...form, lastPaymentDate: e.target.value })}
                  placeholder={todayYMD()}
                  className="h-11 font-mono"
                  dir="ltr"
                  pattern="\d{1,2}[/-]\d{1,2}[/-]\d{4}"
                  maxLength={10}
                />
                {form.lastPaymentDate && !parseManualDate(form.lastPaymentDate) && (
                  <p className="text-xs text-rose-600">⚠ الصيغة غير صحيحة — استخدم DD/MM/YYYY</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-sm font-semibold">رقم الهاتف (لإشعارات WhatsApp)</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="0550000000"
                className="h-11"
                dir="ltr"
              />
            </div>
            {/* ★ تاريخ بداية خاص — اختياري، إن أراد المنخرط تاريخاً مختلفاً عن اليوم */}
            <div className="space-y-1.5">
              <Label htmlFor="startDate" className="text-sm font-semibold flex items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5" /> تاريخ بداية خاص (اختياري)
                <span className="text-[10px] font-normal text-muted-foreground">(DD/MM/YYYY)</span>
              </Label>
              <Input
                id="startDate"
                type="text"
                inputMode="numeric"
                value={form.startDate || ""}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                placeholder={todayYMD()}
                className="h-11 font-mono"
                dir="ltr"
                pattern="\d{1,2}[/-]\d{1,2}[/-]\d{4}"
                maxLength={10}
              />
              {form.startDate && !parseManualDate(form.startDate) && (
                <p className="text-xs text-rose-600">⚠ الصيغة غير صحيحة — استخدم DD/MM/YYYY</p>
              )}
              <p className="text-[10px] text-muted-foreground">
                إن تركته فارغاً يُستخدم تاريخ اليوم كتاريخ بداية للاشتراك.
              </p>
            </div>
          </section>

          {/* Selection chips — mirroring the Excel X-mark cells */}
          <section className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              اضغط على الخيار المناسب لكل خانة
            </h3>

            <ChipSelector
              label="الجنس"
              icon={<User className="h-4 w-4" />}
              options={[
                { value: "ذكر", label: "ذكر" },
                { value: "أنثى", label: "أنثى" },
              ]}
              value={form.gender}
              onChange={(v) => setForm({ ...form, gender: v })}
              columns={2}
            />

            <ChipSelector
              label="فصيلة الدم"
              icon={<Droplet className="h-4 w-4" />}
              options={BLOOD_TYPES.map((bt) => ({ value: bt, label: bt }))}
              value={form.bloodType}
              onChange={(v) => setForm({ ...form, bloodType: v })}
              columns={4}
            />

            <ChipSelector
              label="نوع الاشتراك"
              icon={<CreditCard className="h-4 w-4" />}
              options={subTypes.length > 0
                ? subTypes.map((st) => ({ value: st.code, label: st.name === st.code ? st.name : `${st.name} (${st.code})` }))
                : SUBSCRIPTION_TYPES.map((st) => ({ value: st, label: st === "/" ? "عادي (/)" : st }))
              }
              value={form.subscriptionType}
              onChange={(v) => setForm({ ...form, subscriptionType: v })}
              columns={3}
              hint="OPOW/DJS/POLICE = 300 دج • FCS/RCS = 0 دج"
            />

            {/* ★ رقم الملف — معاينة فورية + قابل للتعديل */}
            {!isEdit && form.subscriptionType && (
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold flex items-center gap-1">
                  <Hash className="h-3.5 w-3.5" /> رقم الملف
                  {loadingFileNumber && <Loader2 className="h-3 w-3 animate-spin" />}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={form.fileNumber || ""}
                    onChange={(e) => setForm({ ...form, fileNumber: e.target.value })}
                    className="h-10 font-mono font-bold"
                    placeholder="RCS001"
                    dir="ltr"
                  />
                  <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                    مقترح: {previewFileNumber || "—"}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  يتم توليد الرقم تلقائياً — يمكنك تعديله (فارغ أو ناقص في التسلسل)
                </p>
              </div>
            )}

            <ChipSelector
              label="حالة الدفع"
              icon={<CreditCard className="h-4 w-4" />}
              // ★ "معفى" now appears in the options (from PAYMENT_STATUSES)
              options={PAYMENT_STATUSES.map((ps) => ({ value: ps, label: ps === "معفى" ? "🎁 معفى" : ps }))}
              value={form.paymentStatus}
              onChange={(v) => setForm({ ...form, paymentStatus: v })}
              columns={3}
            />

            {/* ★ EXEMPT info box — shown when paymentStatus is "معفى" */}
            {isExemptStatus(form.paymentStatus) && (
              <div className="rounded-lg border border-violet-300/50 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-700/50 p-3 flex items-start gap-2">
                <div className="text-violet-600 dark:text-violet-400 mt-0.5 shrink-0">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div className="text-xs text-violet-700 dark:text-violet-300">
                  <strong>حالة معفى:</strong> لن يتم احتساب أي مبلغ على هذا المنخرط (الاشتراك = 0، التأمين = 0، المجموع = 0). لن يظهر ضمن المبالغ غير المدفوعة ولن يُعتبر متأخراً في الدفع. لا حاجة لإدخال تاريخ دفع.
                </div>
              </div>
            )}

            <ChipSelector
              label="أيام السباحة (مجموعات)"
              icon={<Waves className="h-4 w-4" />}
              options={dayOptions}
              value={form.swimmingDays}
              onChange={(v) => setForm({ ...form, swimmingDays: v })}
              columns={2}
              hint="الزوج يُخفى إذا أُغلق أحد يوميه من الإعدادات"
            />

            <ChipSelector
              label="التوقيت"
              icon={<Clock className="h-4 w-4" />}
              options={swimSlotLabels.map((t) => ({ value: t, label: t }))}
              value={form.timeSlot}
              onChange={(v) => setForm({ ...form, timeSlot: v })}
              columns={4}
              hint="أو اكتب توقيتاً مخصصاً"
            />
            {/* 🔑 حقل توقيت مخصص — يظهر دائماً للسماح بإدخال توقيت غير موجود في القائمة */}
            <Input
              type="text"
              placeholder="أو اكتب توقيتاً مخصصاً (مثال: 14:00-15:00)"
              value={form.timeSlot && !swimSlotLabels.includes(form.timeSlot) ? form.timeSlot : ""}
              onChange={(e) => setForm({ ...form, timeSlot: e.target.value || null })}
              className="h-9 text-sm"
            />
          </section>

          {/* Live financial preview */}
          {total !== null && (
            <section className="rounded-xl bg-gradient-to-l from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">معاينة المبلغ</p>
                  <p className="text-xs text-muted-foreground">رسوم الاشتراك + مصاريف التأمين</p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">رسوم الاشتراك</p>
                    <p className="font-bold text-foreground">{subscriptionFee} دج</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">مصاريف التأمين</p>
                    <p className="font-bold text-foreground">{insuranceFee} دج</p>
                  </div>
                  <div className="h-10 w-px bg-border" />
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">المبلغ الإجمالي</p>
                    <p className="font-extrabold text-amber-700 dark:text-amber-300 text-lg">{total} دج</p>
                  </div>
                </div>
              </div>
            </section>
          )}
        </form>

        <DialogFooter className="px-6 py-4 border-t bg-muted/30 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-10"
          >
            <X className="h-4 w-4 ml-1" /> إلغاء
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="h-10 px-6"
          >
            {saving ? (
              <>
                <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                جاري الحفظ...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 ml-1" /> {isEdit ? "حفظ التعديلات" : "تسجيل المنخرط"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

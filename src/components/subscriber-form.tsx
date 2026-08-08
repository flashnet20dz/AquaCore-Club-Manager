"use client";

import { useState, useEffect } from "react";
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
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useSubscriptionTypes } from "@/hooks/use-subscription-types";
import { PhotoUploader } from "@/components/photo-uploader";
import {
  BLOOD_TYPES,
  SUBSCRIPTION_TYPES,
  PAYMENT_STATUSES,
  SWIMMING_DAYS,
  TIME_SLOTS,
  isExemptStatus,
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
  birthDate: string;
  gender: Gender | null;
  bloodType: BloodType | null;
  subscriptionType: SubscriptionType | null;
  lastPaymentDate: string;
  paymentStatus: PaymentStatus | null;
  swimmingDays: SwimmingDays | null;
  timeSlot: TimeSlot | null;
  phone: string;
  photoUrl?: string;  // مسار الصورة الشخصية (data URL أو مسار نسبي)
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
};

export function SubscriberForm({ open, onOpenChange, initial, onSaved }: SubscriberFormProps) {
  const [form, setForm] = useState<SubscriberFormValues>(emptyForm);
  const { activeTypes: subTypes } = useSubscriptionTypes();
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial?.id;
  // 🔑 الصورة المؤقتة للمنخرط الجديد (قبل الحفظ)
  const [pendingPhoto, setPendingPhoto] = useState<{
    original: string; cropped: string; thumbnail: string; faceDetected: boolean;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setPendingPhoto(null); // امسح الصورة المؤقتة عند فتح النموذج
      setForm({
        ...emptyForm,
        ...initial,
        birthDate: initial?.birthDate
          ? new Date(initial.birthDate).toISOString().split("T")[0]
          : "",
        lastPaymentDate: initial?.lastPaymentDate
          ? new Date(initial.lastPaymentDate).toISOString().split("T")[0]
          : "",
      } as SubscriberFormValues);
    } else {
      setForm(emptyForm);
    }
  }, [open, initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.lastName.trim() || !form.firstName.trim()) {
      toast.error("يرجى إدخال اللقب والاسم");
      return;
    }
    if (!form.birthDate) {
      toast.error("يرجى إدخال تاريخ الميلاد");
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

    setSaving(true);
    try {
      const url = isEdit ? `/api/subscribers/${initial!.id}` : "/api/subscribers";
      const method = isEdit ? "PUT" : "POST";
      const { offlineFetch } = await import("@/hooks/use-offline-mutation");
      const res = await offlineFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
      } else {
        toast.success(isEdit ? "تم تحديث بيانات المنخرط" : "تم تسجيل منخرط جديد بنجاح");
      }

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

      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطأ غير متوقع");
    } finally {
      setSaving(false);
    }
  };

  // Live preview of computed fees
  const today = new Date();
  const birthDate = form.birthDate ? new Date(form.birthDate) : null;
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
        subscriptionFee = typeConfig.subscriptionFee;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0">
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
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> تاريخ الميلاد *
                </Label>
                <Input
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                  className="h-11"
                  required
                />
                {age !== null && (
                  <p className="text-xs text-muted-foreground">العمر الحالي: <span className="font-bold text-foreground">{age} سنة</span></p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> تاريخ آخر دفعة
                </Label>
                <Input
                  type="date"
                  value={form.lastPaymentDate}
                  onChange={(e) => setForm({ ...form, lastPaymentDate: e.target.value })}
                  className="h-11"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">رقم الهاتف (لإشعارات WhatsApp)</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="0550000000"
                className="h-11"
                dir="ltr"
              />
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
              label="أيام السباحة"
              icon={<Waves className="h-4 w-4" />}
              options={SWIMMING_DAYS.map((d) => ({ value: d, label: d }))}
              value={form.swimmingDays}
              onChange={(v) => setForm({ ...form, swimmingDays: v })}
              columns={2}
            />

            <ChipSelector
              label="التوقيت"
              icon={<Clock className="h-4 w-4" />}
              options={TIME_SLOTS.map((t) => ({ value: t, label: t }))}
              value={form.timeSlot}
              onChange={(v) => setForm({ ...form, timeSlot: v })}
              columns={4}
              hint="أو اكتب توقيتاً مخصصاً"
            />
            {/* 🔑 حقل توقيت مخصص — يظهر دائماً للسماح بإدخال توقيت غير موجود في القائمة */}
            <Input
              type="text"
              placeholder="أو اكتب توقيتاً مخصصاً (مثال: 14:00-15:00)"
              value={form.timeSlot && !TIME_SLOTS.includes(form.timeSlot) ? form.timeSlot : ""}
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

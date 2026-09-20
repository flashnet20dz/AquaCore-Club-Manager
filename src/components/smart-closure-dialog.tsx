"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import {
  CalendarOff,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  CalendarPlus,
  RefreshCw,
  ArrowRight,
  Filter,
  ChevronDown,
  Search,
  Sparkles,
  ShieldCheck,
  Layers,
  Loader2,
  Wrench,
  Check,
  X,
  History,
} from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSwimConfig } from "@/hooks/use-swim-config";
import { SUBSCRIPTION_TYPES, SUBSCRIPTION_TYPE_COLORS } from "@/lib/rcs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SubscriberPreview {
  id: string;
  fileNumber: string;
  fullName: string;
  phone: string | null;
  subscriptionType: string;
  paymentStatus: string;
  swimmingDays: string | null;
  timeSlot: string | null;
  currentExpiryDate: string | null;
  newExpiryDate: string | null;
  isUnexpired: boolean;
  cancelledSessionsCount: number;
}

interface SmartClosureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const QUICK_REASONS = [
  "صيانة دورية للفلاتر وتغيير المياه",
  "تنظيف وتطهير شامل للمسبح",
  "صيانة مضخات المياه ونظام التدوير",
  "صيانة منظومة التدفئة وضبط الحرارة",
  "أعمال ترميم طارئة للمرافق",
  "عطلة رسمية وإغلاق إداري",
];

export function SmartClosureDialog({
  open,
  onOpenChange,
  onCreated,
}: SmartClosureDialogProps) {
  const { dayNames, slotLabels } = useSwimConfig();

  // ─── فرم الإغلاق الأساسي ───
  const [startDate, setStartDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });
  const [reason, setReason] = useState(QUICK_REASONS[0]);
  const [note, setNote] = useState("");
  const [swimmingDays, setSwimmingDays] = useState<string>("__all__");
  const [timeSlot, setTimeSlot] = useState<string>("__all__");
  const [validityDays, setValidityDays] = useState(60);

  // ─── ميزات الاستئناف والتعويض الذكي ───
  const [extendSubscriptionDays, setExtendSubscriptionDays] = useState(true);
  const [createCompensations, setCreateCompensations] = useState(true);
  const [unexpiredOnlyFilter, setUnexpiredOnlyFilter] = useState(true);

  // ─── الفلاتر المتقدمة ───
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedSubscriptionTypes, setSelectedSubscriptionTypes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // ─── المعاينة والمنخرطون ───
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [subscribers, setSubscribers] = useState<SubscriberPreview[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [closureDays, setClosureDays] = useState(3);
  const [reopenDate, setReopenDate] = useState<string>("");
  const [unexpiredCount, setUnexpiredCount] = useState(0);
  const [totalCancelledSessions, setTotalCancelledSessions] = useState(0);

  // حساب الأيام والفترة محلياً للمعاينة الفورية
  useEffect(() => {
    if (!startDate) return;
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = endDate ? new Date(endDate) : new Date(startDate);
    end.setHours(23, 59, 59, 999);

    if (end >= start) {
      const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
      setClosureDays(days);
      const reopen = new Date(end.getTime() + 86400000);
      setReopenDate(reopen.toISOString().slice(0, 10));
    }
  }, [startDate, endDate]);

  // جلب المعاينة عند تغير التواريخ أو النطاق
  useEffect(() => {
    if (!open || !startDate) return;

    let isMounted = true;
    const fetchPreview = async () => {
      setLoadingPreview(true);
      try {
        const params = new URLSearchParams();
        params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        if (swimmingDays !== "__all__") params.set("swimmingDays", swimmingDays);
        if (timeSlot !== "__all__") params.set("timeSlot", timeSlot);
        if (selectedSubscriptionTypes.length > 0) {
          params.set("subscriptionTypes", selectedSubscriptionTypes.join(","));
        }
        // نجلب الكل بدون تقييد حتى نتيح التبديل الفوري في الواجهة
        params.set("unexpiredOnly", "false");

        const res = await fetch(`/api/pool-closures/preview?${params.toString()}`);
        if (!res.ok) throw new Error("تعذّر جلب معاينة الإغلاق");
        const data = await res.json();

        if (isMounted) {
          const subs: SubscriberPreview[] = data.subscribers || [];
          setSubscribers(subs);
          setClosureDays(data.closureDays || 1);
          setReopenDate(data.reopenDate ? data.reopenDate.slice(0, 10) : "");
          setUnexpiredCount(data.unexpiredCount || 0);
          setTotalCancelledSessions(data.totalCancelledSessions || 0);

          // افتراضياً: تحديد كل المنخرطين الذين لم ينتهي اشتراكهم
          const targetIds = subs
            .filter((s) => s.isUnexpired)
            .map((s) => s.id);
          setSelectedIds(new Set(targetIds.length > 0 ? targetIds : subs.map((s) => s.id)));
        }
      } catch (err: any) {
        console.error("Preview error:", err);
      } finally {
        if (isMounted) setLoadingPreview(false);
      }
    };

    const timer = setTimeout(fetchPreview, 250);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [open, startDate, endDate, swimmingDays, timeSlot, selectedSubscriptionTypes]);

  // تصفية المنخرطين المعروضين في الجدول حسب البحث وتصنيف الصلاحية
  const displayedSubscribers = useMemo(() => {
    return subscribers.filter((s) => {
      if (unexpiredOnlyFilter && !s.isUnexpired) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        s.fullName.toLowerCase().includes(q) ||
        s.fileNumber.toLowerCase().includes(q) ||
        (s.phone && s.phone.includes(q)) ||
        (s.swimmingDays && s.swimmingDays.toLowerCase().includes(q))
      );
    });
  }, [subscribers, unexpiredOnlyFilter, searchQuery]);

  // تحديد/إلغاء تحديد الكل للمعروضين حالياً
  const handleToggleSelectAll = (checked: boolean) => {
    const next = new Set(selectedIds);
    displayedSubscribers.forEach((s) => {
      if (checked) {
        next.add(s.id);
      } else {
        next.delete(s.id);
      }
    });
    setSelectedIds(next);
  };

  const handleToggleSelectOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedIds(next);
  };

  const isAllDisplayedSelected =
    displayedSubscribers.length > 0 &&
    displayedSubscribers.every((s) => selectedIds.has(s.id));

  // تعيين سريع لفترة الإغلاق
  const applyQuickDuration = (days: number) => {
    const start = new Date(startDate || new Date());
    const end = new Date(start);
    end.setDate(start.getDate() + (days - 1));
    setEndDate(end.toISOString().slice(0, 10));
  };

  // إرسال تسجيل الإغلاق
  const handleSubmit = async () => {
    if (!startDate) {
      toast.error("يرجى تحديد تاريخ بداية الإغلاق");
      return;
    }
    if (!reason.trim()) {
      toast.error("يرجى كتابة أو اختيار سبب الإغلاق");
      return;
    }
    if (endDate && new Date(endDate) < new Date(startDate)) {
      toast.error("تاريخ النهاية يجب أن يكون مساوياً أو بعد تاريخ البداية");
      return;
    }

    if (selectedIds.size === 0) {
      toast.error("يرجى اختيار منخرط واحد على الأقل لتطبيق الإغلاق وتمديد الاشتراكات");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        startDate,
        endDate: endDate || startDate,
        reason: reason.trim(),
        note: note.trim() || undefined,
        swimmingDays: swimmingDays === "__all__" ? undefined : swimmingDays,
        timeSlot: timeSlot === "__all__" ? undefined : timeSlot,
        subscriptionTypes: selectedSubscriptionTypes.length > 0 ? selectedSubscriptionTypes : undefined,
        validityDays,
        extendSubscriptionDays,
        createCompensations,
        selectedSubscriberIds: Array.from(selectedIds),
        unexpiredOnly: unexpiredOnlyFilter,
      };

      const res = await fetch("/api/pool-closures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "تعذّر تسجيل الإغلاق");
      }

      toast.success(
        `تم تسجيل إغلاق المسبح بنجاح! (${closureDays} أيام) — شمل ${data.affectedCount} منخرط(ة)${
          extendSubscriptionDays ? ` وتمديد ${data.extendedSubscribersCount} اشتراك` : ""
        }`
      );

      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء حفظ الإغلاق");
    } finally {
      setSubmitting(false);
    }
  };

  // تنسيق التاريخ للعرض العربي بأرقام عادية
  const formatArabicDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      const weekday = d.toLocaleDateString("ar-DZ-u-nu-latn", { weekday: "short" });
      return `${weekday} ${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl"
      >
        {/* ═══ الرأس التنفيذي الذكي ═══ */}
        <DialogHeader className="p-5 pb-4 border-b bg-gradient-to-r from-amber-500/10 via-background to-blue-500/10 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Wrench className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  تسجيل إغلاق المسبح للصيانة وتعديل الاشتراكات
                  <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                    <Sparkles className="h-3 w-3 ml-1 inline text-amber-500" />
                    النظام الذكي
                  </Badge>
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  حساب دقيق لعدد أيام الإغلاق، تحديد المشتركين غير المنتهية اشتراكاتهم، وميزة استئناف وتمديد الأيام تلقائياً بعد الفتح.
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* ═══ محتوى النافذة Scrollable ═══ */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 1) فترة الإغلاق مع أزرار سريعة */}
          <div className="rounded-xl border bg-card/60 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <Calendar className="h-4 w-4 text-primary" />
                تحديد فترة الإغلاق
              </span>
              {/* أزرار المدة السريعة */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground ml-1">تحديد سريع:</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2.5"
                  onClick={() => applyQuickDuration(1)}
                >
                  يوم واحد
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2.5"
                  onClick={() => applyQuickDuration(3)}
                >
                  3 أيام
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2.5"
                  onClick={() => applyQuickDuration(7)}
                >
                  أسبوع
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2.5"
                  onClick={() => applyQuickDuration(14)}
                >
                  أسبوعين
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">من تاريخ (بداية الإغلاق) *</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">إلى تاريخ (نهاية الإغلاق) *</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            </div>

            {/* أسباب سريعة + سبب الإغلاق */}
            <div className="space-y-2 pt-1">
              <Label className="text-xs text-muted-foreground">سبب الإغلاق وملاحظات الإدارة *</Label>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {QUICK_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs border transition-colors",
                      reason === r
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 hover:bg-muted text-muted-foreground border-border"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <Input
                placeholder="اكتب سبب الإغلاق..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>

          {/* 2) شريط المؤشرات والذكاء الإداري (KPIs) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* مدة الإغلاق */}
            <div className="rounded-xl border bg-card p-3.5 flex flex-col justify-between space-y-1.5 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span>مدة الإغلاق</span>
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {closureDays} <span className="text-xs font-normal">أيام</span>
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                إعادة الفتح: <strong className="text-foreground">{reopenDate || "—"}</strong>
              </div>
            </div>

            {/* المنخرطون غير المنتهية اشتراكاتهم */}
            <div className="rounded-xl border bg-card p-3.5 flex flex-col justify-between space-y-1.5 shadow-xs border-emerald-500/30 bg-emerald-500/5">
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                <span>الاشتراكات سارية المفعول</span>
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {unexpiredCount} <span className="text-xs font-normal">منخرط(ة)</span>
              </div>
              <div className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                مؤهلون للتمديد الفوري (+{closureDays} أيام)
              </div>
            </div>

            {/* إجمالي المشتركين المتأثرين */}
            <div className="rounded-xl border bg-card p-3.5 flex flex-col justify-between space-y-1.5 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span>إجمالي المتأثرين بالنطاق</span>
                <Users className="h-4 w-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {subscribers.length} <span className="text-xs font-normal">منخرط</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                تم تحديد: <strong className="text-foreground">{selectedIds.size}</strong> للتطبيق
              </div>
            </div>

            {/* الحصص الملغاة */}
            <div className="rounded-xl border bg-card p-3.5 flex flex-col justify-between space-y-1.5 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span>إجمالي الحصص الملغاة</span>
                <Layers className="h-4 w-4 text-purple-500" />
              </div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {totalCancelledSessions} <span className="text-xs font-normal">حصة</span>
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                حسب جداول الأفواج خلال الإغلاق
              </div>
            </div>
          </div>

          {/* 3) خيارات الاستئناف والتمديد الذكية */}
          <div className="rounded-xl border bg-gradient-to-l from-emerald-500/10 via-card to-card p-4 space-y-3.5">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              خيارات التمديد والاستئناف التلقائي
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
              {/* خيار 1: استئناف وتمديد الأيام بعد الفتح */}
              <div className="flex items-start gap-3 p-3 rounded-lg border bg-background/80 hover:bg-background transition-colors">
                <Switch
                  id="extendDays"
                  checked={extendSubscriptionDays}
                  onCheckedChange={setExtendSubscriptionDays}
                  className="mt-1"
                />
                <div className="space-y-1">
                  <Label htmlFor="extendDays" className="font-semibold text-xs cursor-pointer text-foreground flex items-center gap-1.5">
                    استئناف وتمديد الأيام بعد الفتح (+{closureDays} أيام)
                    <Badge variant="secondary" className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                      موصى به
                    </Badge>
                  </Label>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    ترحيل تلقائي لتاريخ انتهاء الاشتراك وتاريخ آخر دفعة بعدد أيام الإغلاق، لضمان استئناف الخدمة دون خسارة أي يوم مدفوع.
                  </p>
                </div>
              </div>

              {/* خيار 2: توليد حصص تعويضية */}
              <div className="flex items-start gap-3 p-3 rounded-lg border bg-background/80 hover:bg-background transition-colors">
                <Switch
                  id="createComp"
                  checked={createCompensations}
                  onCheckedChange={setCreateCompensations}
                  className="mt-1"
                />
                <div className="space-y-1">
                  <Label htmlFor="createComp" className="font-semibold text-xs cursor-pointer text-foreground">
                    توليد سجلات تعويض في جدول الحصص البديلة
                  </Label>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    إنشاء تذاكر تعويض لكل حصة ملغاة للسماح للمنخرط بحضور حصص بديلة في مواعيد يختارها مع المدرب.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 4) فلاتر الفوج والتوقيت ونوع الاشتراك (قابلة للطي) */}
          <div className="rounded-xl border bg-card/60 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="w-full flex items-center justify-between p-3 text-xs font-semibold hover:bg-muted/40 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-primary" />
                تصفية المنخرطين حسب الفوج أو التوقيت أو نوع الاشتراك (اختياري)
              </span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", showAdvancedFilters && "rotate-180")} />
            </button>

            {showAdvancedFilters && (
              <div className="p-4 pt-1 border-t space-y-3 bg-muted/20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">أيام السباحة المتأثرة</Label>
                    <Select value={swimmingDays} onValueChange={setSwimmingDays}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">كل المجموعات والأيام</SelectItem>
                        {dayNames.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">التوقيت المتأثر</Label>
                    <Select value={timeSlot} onValueChange={setTimeSlot}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">كل التوقيتات والحصص</SelectItem>
                        {slotLabels.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* تصفية أنواع الاشتراك */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">أنواع الاشتراكات المعنية:</Label>
                    {selectedSubscriptionTypes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedSubscriptionTypes([])}
                        className="text-[11px] text-rose-500 hover:underline"
                      >
                        إلغاء التصفية
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SUBSCRIPTION_TYPES.map((type) => {
                      const isSelected = selectedSubscriptionTypes.includes(type as string);
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            setSelectedSubscriptionTypes((prev) =>
                              prev.includes(type as string)
                                ? prev.filter((t) => t !== type)
                                : [...prev, type as string]
                            );
                          }}
                          className={cn(
                            "px-2 py-0.5 rounded text-xs border transition-colors",
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground border-border hover:border-primary/50"
                          )}
                        >
                          {type}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 5) جدول المنخرطين التفاعلي مع مقارنة تاريخ الانتهاء الحالي vs الجديد */}
          <div className="rounded-xl border bg-card overflow-hidden space-y-3 p-3.5">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              {/* تبويب: غير المنتهية اشتراكاتهم vs الكل */}
              <div className="flex items-center gap-1.5 bg-muted p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setUnexpiredOnlyFilter(true)}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
                    unexpiredOnlyFilter
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  غير المنتهية اشتراكاتهم فقط
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-emerald-500/15 text-emerald-700">
                    {unexpiredCount}
                  </Badge>
                </button>

                <button
                  type="button"
                  onClick={() => setUnexpiredOnlyFilter(false)}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
                    !unexpiredOnlyFilter
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Users className="h-3.5 w-3.5 text-blue-500" />
                  جميع المنخرطين
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                    {subscribers.length}
                  </Badge>
                </button>
              </div>

              {/* شريط البحث وتحديد الكل */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-56">
                  <Search className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="بحث باسم أو رقم الملف..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 text-xs pr-8 pl-2"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs shrink-0"
                  onClick={() => handleToggleSelectAll(!isAllDisplayedSelected)}
                >
                  {isAllDisplayedSelected ? "إلغاء تحديد الكل" : "تحديد كل المعروض"}
                </Button>
              </div>
            </div>

            {/* الجدول */}
            <div className="border rounded-lg overflow-x-auto max-h-[360px] overflow-y-auto">
              {loadingPreview ? (
                <div className="flex items-center justify-center p-8 text-muted-foreground gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-xs">جاري فحص وتدقيق الاشتراكات المتأثرة...</span>
                </div>
              ) : displayedSubscribers.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground space-y-1">
                  <Users className="h-8 w-8 mx-auto text-muted-foreground/40" />
                  <p className="text-xs font-semibold">لا يوجد منخرطين يطابقون شروط البحث والتصفية</p>
                </div>
              ) : (
                <table className="w-full min-w-[640px] text-xs text-right">
                  <thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10 border-b">
                    <tr>
                      <th className="p-2 w-9 text-center">
                        <Checkbox
                          checked={isAllDisplayedSelected}
                          onCheckedChange={(c) => handleToggleSelectAll(!!c)}
                          aria-label="تحديد الكل"
                        />
                      </th>
                      <th className="p-2 font-semibold min-w-[140px]">المنخرط</th>
                      <th className="p-2 font-semibold min-w-[100px]">الفوج والتوقيت</th>
                      <th className="p-2 font-semibold text-center whitespace-nowrap">الحصص</th>
                      <th className="p-2 font-semibold whitespace-nowrap">تاريخ الانتهاء</th>
                      <th className="p-2 font-semibold whitespace-nowrap">
                        {extendSubscriptionDays
                          ? `+${closureDays} يوم بعد الفتح`
                          : "تاريخ الانتهاء"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {displayedSubscribers.map((s) => {
                      const isSelected = selectedIds.has(s.id);
                      return (
                        <tr
                          key={s.id}
                          onClick={() => handleToggleSelectOne(s.id, !isSelected)}
                          className={cn(
                            "hover:bg-muted/30 cursor-pointer transition-colors",
                            isSelected ? "bg-primary/5" : "opacity-75"
                          )}
                        >
                          <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(c) => handleToggleSelectOne(s.id, !!c)}
                            />
                          </td>

                          {/* بيانات المنخرط */}
                          <td className="p-2">
                            <div className="font-semibold text-foreground flex items-center gap-1">
                              <span className="truncate max-w-[100px]">{s.fullName}</span>
                              <span className="font-mono text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                #{s.fileNumber}
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate max-w-[130px]">
                              {s.subscriptionType}
                            </div>
                          </td>

                          {/* الفوج */}
                          <td className="p-2">
                            <div className="text-foreground text-[11px]">{s.swimmingDays || "غير محدد"}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">{s.timeSlot || "—"}</div>
                          </td>

                          {/* الحصص الملغاة */}
                          <td className="p-2 text-center">
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {s.cancelledSessionsCount} حصة
                            </Badge>
                          </td>

                          {/* تاريخ الانتهاء الحالي */}
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "text-[10px] font-mono",
                                  s.isUnexpired
                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                    : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                                )}
                              >
                                {s.isUnexpired ? "نشط" : "منتهي"}
                              </Badge>
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {formatArabicDate(s.currentExpiryDate)}
                              </span>
                            </div>
                          </td>

                          {/* تاريخ الانتهاء الجديد بعد الاستئناف */}
                          <td className="p-2">
                            {extendSubscriptionDays && s.newExpiryDate ? (
                              <div className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                <ArrowRight className="h-3 w-3 rotate-180 text-emerald-500" />
                                <span>{formatArabicDate(s.newExpiryDate)}</span>
                                <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                                  +{closureDays} يوم
                                </Badge>
                              </div>
                            ) : (
                              <span className="text-muted-foreground font-mono text-[11px]">
                                {formatArabicDate(s.currentExpiryDate)}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>
                تم اختيار <strong className="text-foreground">{selectedIds.size}</strong> من أصل{" "}
                <strong className="text-foreground">{subscribers.length}</strong> منخرط
              </span>
              <span>
                المعروض حالياً: <strong className="text-foreground">{displayedSubscribers.length}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* ═══ أسفل النافذة والأزرار ═══ */}
        <DialogFooter className="p-4 border-t bg-muted/30 shrink-0 flex items-center justify-between sm:justify-between">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>
              سيتم تمديد صلاحية <strong className="text-foreground">{selectedIds.size}</strong> منخرط بـ{" "}
              <strong className="text-foreground">{closureDays}</strong> أيام بعد الفتح
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              إلغاء
            </Button>

            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || selectedIds.size === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري تسجيل الإغلاق والتمديد...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  تسجيل الإغلاق واستئناف الاشتراكات ({selectedIds.size})
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useCallback, useMemo } from "react";
import {
  FileText, Download, Printer, Calendar, Users, Wallet, Loader2,
  ChevronLeft, ChevronRight, RefreshCw, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MONTH_NAMES = [
  "جانفي", "فبراير", "مارس", "أفريل", "ماي", "جوان",
  "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export function StaffRightsPanel() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [generating, setGenerating] = useState(false);

  const goToPrevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const goToNextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const monthName = useMemo(() => `${MONTH_NAMES[month - 1]} ${year}`, [month, year]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/staff-rights?year=${year}&month=${month}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "فشل" }));
        throw new Error(data.error || "فشل الإنشاء");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `حقوق_المركب_${MONTH_NAMES[month - 1]}_${year}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`تم إنشاء وثيقة حقوق المركب — ${monthName}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الإنشاء");
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/staff-rights?year=${year}&month=${month}`);
      if (!res.ok) throw new Error("فشل");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const w = window.open(url);
      if (w) {
        w.onload = () => setTimeout(() => w.print(), 800);
      }
      toast.success("جاري تحضير الطباعة...");
    } catch {
      toast.error("فشل الطباعة");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-teal-600" />
            <div>
              <h2 className="text-xl font-bold text-teal-900">حقوق المركب</h2>
              <p className="text-xs text-muted-foreground">إنشاء وثيقة Word رسمية شهرية لقائمة المنخرطين</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={generating}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 ml-1" />}
              {generating ? "جاري الإنشاء..." : "إنشاء وتحميل Word"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrint}
              disabled={generating}
            >
              <Printer className="h-4 w-4 ml-1" /> طباعة
            </Button>
          </div>
        </div>
      </div>

      {/* Month selector */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="icon" onClick={goToPrevMonth} className="rounded-xl">
            <ChevronRight className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">الشهر المحدد</p>
            <p className="text-2xl font-bold text-teal-900">{monthName}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={goToNextMonth} className="rounded-xl">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
          <Calendar className="h-8 w-8 mx-auto text-teal-600 mb-2" />
          <p className="text-lg font-bold text-teal-900">{monthName}</p>
          <p className="text-xs text-muted-foreground">الشهر المطلوب</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
          <Users className="h-8 w-8 mx-auto text-blue-600 mb-2" />
          <p className="text-lg font-bold text-blue-900">من قاعدة البيانات</p>
          <p className="text-xs text-muted-foreground">عدد المنخرطين في الشهر</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
          <Wallet className="h-8 w-8 mx-auto text-amber-600 mb-2" />
          <p className="text-lg font-bold text-amber-900">مبلغ ≥ 1000 دج</p>
          <p className="text-xs text-muted-foreground">فقط من دفع حقوق المركب</p>
        </div>
      </div>

      {/* Template info */}
      <div className="rounded-2xl border border-teal-500/30 bg-teal-50/30 p-4">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-teal-600 shrink-0" />
          <div>
            <h3 className="font-bold text-sm text-teal-900">القالب الرسمي</h3>
            <p className="text-xs text-muted-foreground mt-1">
              يتم استخدام القالب الرسمي المرفوع وتعبئته تلقائياً ببيانات الشهر المحدد.
              يحافظ النظام على التنسيق الأصلي (الجداول، الخطوط، الهوامش، التوقيعات).
            </p>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-50/30 p-4 space-y-2">
        <h3 className="font-bold text-sm text-amber-900 flex items-center gap-2">
          <FileText className="h-4 w-4" /> طريقة الاستخدام
        </h3>
        <ol className="text-xs text-amber-800 space-y-1 list-decimal list-inside">
          <li>اختر السنة والشهر المطلوب (استخدم الأسهم)</li>
          <li>اضغط "إنشاء وتحميل Word"</li>
          <li>سيتم إنشاء وثيقة Word مطابقة للقالب الرسمي ببيانات الشهر</li>
          <li>يمكنك تعديل الوثيقة في Word قبل الطباعة</li>
          <li>أو اضغط "طباعة" لطباعة مباشرة</li>
        </ol>
      </div>
    </div>
  );
}

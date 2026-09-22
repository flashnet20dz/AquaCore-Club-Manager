"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Type, Image as ImageIcon, Plus, Trash2, Copy, Save, Loader2,
  Eye, RotateCcw, Bold, Italic, Underline, AlignRight, AlignCenter,
  AlignLeft, Upload, Settings2, Building, Phone, Mail, Globe, MapPin,
  Calendar, Hash, FileText, CheckCircle2, ShieldCheck, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  UnifiedReportHeader,
  DEFAULT_CLUB_OFFICIAL_NAME,
  DEFAULT_ENTETE,
  type EnteteConfig,
  type EnteteElement,
} from "@/components/unified-report-header";

// ──────────────── Types ────────────────
type Slot = "header-left" | "header-center" | "header-right" | "footer-left" | "footer-center" | "footer-right";

const SLOT_LABELS: Record<Slot, string> = {
  "header-left": "أعلى - يمين",
  "header-center": "أعلى - وسط",
  "header-right": "أعلى - يسار",
  "footer-left": "أسفل - يمين",
  "footer-center": "أسفل - وسط",
  "footer-right": "أسفل - يسار",
};

const FONT_OPTIONS = [
  { value: "Cairo", label: "Cairo (افتراضي - رسمي)" },
  { value: "Tajawal", label: "Tajawal" },
  { value: "Amiri", label: "Amiri (كلاسيكي)" },
  { value: "Tahoma", label: "Tahoma" },
  { value: "Arial", label: "Arial" },
  { value: "Times New Roman", label: "Times New Roman" },
];

const COLOR_PRESETS = [
  "#0f766e", "#0d9488", "#0891b2", "#1d4ed8", "#4338ca",
  "#047857", "#b45309", "#c2410c", "#b91c1c", "#1e293b",
  "#111111", "#475569",
];

function genId() {
  return Math.random().toString(36).substring(2, 11);
}

// ──────────────── Main Component ────────────────
export function UnifiedHeaderSettings() {
  const [config, setConfig] = useState<EnteteConfig>(DEFAULT_ENTETE);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoUploadTarget, setLogoUploadTarget] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [enteteRes, settingsRes] = await Promise.all([
        fetch("/api/entete").then((r) => r.json()),
        fetch("/api/settings").then((r) => r.json()),
      ]);
      if (enteteRes.config) setConfig(enteteRes.config);
      if (settingsRes.settings) setSettings(settingsRes.settings);
    } catch {
      toast.error("تعذر تحميل الإعدادات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // إيجاد العناصر الأساسية
  const rightLogo = config.elements.find((e) => e.slot === "header-right" && e.type === "logo");
  const leftLogo = config.elements.find((e) => e.slot === "header-left" && e.type === "logo");
  const titleElement = config.elements.find((e) => e.slot === "header-center" && e.type === "text") || {
    id: "title-default",
    label: "اسم الجمعية والنادي (سطر واحد)",
    type: "text" as const,
    slot: "header-center" as const,
    content: settings.clubName || DEFAULT_CLUB_OFFICIAL_NAME,
    fontFamily: "Cairo",
    fontSize: 13.5,
    fontWeight: "bold" as const,
    color: "#0f766e",
  };

  // تحديث عنصر محدد
  const updateElement = (id: string, updates: Partial<EnteteElement>) => {
    setConfig((c) => ({
      ...c,
      elements: c.elements.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }));
  };

  // تحديث السطر الأول الرسمي للنادي (متزامن بين الترويسة وإعدادات النادي)
  const handleUpdateClubName = (newName: string) => {
    setSettings((s) => ({ ...s, clubName: newName }));
    setConfig((c) => {
      const hasTitle = c.elements.some((e) => e.slot === "header-center" && e.type === "text");
      if (hasTitle) {
        return {
          ...c,
          elements: c.elements.map((e) =>
            e.slot === "header-center" && e.type === "text"
              ? { ...e, content: newName }
              : e
          ),
        };
      } else {
        const newTitleEl: EnteteElement = {
          id: "title-default",
          label: "اسم الجمعية والنادي (سطر واحد)",
          type: "text",
          slot: "header-center",
          content: newName,
          fontFamily: "Cairo",
          fontSize: 13.5,
          fontWeight: "bold",
          color: "#0f766e",
        };
        return { ...c, elements: [...c.elements, newTitleEl] };
      }
    });
  };

  // رفع شعار
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !logoUploadTarget) return;
    if (f.size > 2 * 1024 * 1024) {
      toast.error("حجم الصورة يجب أن يكون أقل من 2 ميغابايت");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      const targetSlot = logoUploadTarget.includes("left") ? "header-left" : "header-right";
      const targetLabel = targetSlot === "header-left" ? "الشعار الأيسر" : "الشعار الأيمن";

      setConfig((c) => {
        const hasTarget = c.elements.some(
          (el) => el.id === logoUploadTarget || (el.slot === targetSlot && el.type === "logo")
        );
        if (hasTarget) {
          return {
            ...c,
            elements: c.elements.map((el) =>
              el.id === logoUploadTarget || (el.slot === targetSlot && el.type === "logo")
                ? { ...el, src: data, width: 75, height: 75 }
                : el
            ),
          };
        } else {
          const newEl: EnteteElement = {
            id: logoUploadTarget,
            label: targetLabel,
            type: "logo",
            slot: targetSlot,
            src: data,
            width: 75,
            height: 75,
            borderRadius: 8,
          };
          return {
            ...c,
            elements: [...c.elements, newEl],
          };
        }
      });
      toast.success(`تم رفع وتثبيت ${targetLabel} بنجاح`);
    };
    reader.readAsDataURL(f);
    e.target.value = "";
    setLogoUploadTarget(null);
  };

  // حذف الشعار الأيمن على حدة
  const handleDeleteRightLogo = () => {
    setConfig((c) => ({
      ...c,
      elements: c.elements.filter((e) => !(e.slot === "header-right" && e.type === "logo")),
    }));
    toast.success("تم حذف الشعار الأيمن بنجاح");
  };

  // استرجاع أو إضافة الشعار الأيمن
  const handleAddRightLogo = () => {
    const newRight: EnteteElement = {
      id: "logo-right-default",
      label: "الشعار الأيمن",
      type: "logo",
      slot: "header-right",
      src: "/images/rcs-logo-official.png",
      width: 75,
      height: 75,
      borderRadius: 8,
    };
    setConfig((c) => ({
      ...c,
      elements: [
        ...c.elements.filter((e) => !(e.slot === "header-right" && e.type === "logo")),
        newRight,
      ],
    }));
    toast.success("تمت استعادة الشعار الأيمن");
  };

  // حذف الشعار الأيسر على حدة
  const handleDeleteLeftLogo = () => {
    setConfig((c) => ({
      ...c,
      elements: c.elements.filter((e) => !(e.slot === "header-left" && e.type === "logo")),
    }));
    toast.success("تم حذف الشعار الأيسر بنجاح");
  };

  // استرجاع أو إضافة الشعار الأيسر
  const handleAddLeftLogo = () => {
    const newLeft: EnteteElement = {
      id: "logo-left-default",
      label: "الشعار الأيسر",
      type: "logo",
      slot: "header-left",
      src: rightLogo?.src || "/images/rcs-logo-official.png",
      width: 75,
      height: 75,
      borderRadius: 8,
    };
    setConfig((c) => ({
      ...c,
      elements: [
        ...c.elements.filter((e) => !(e.slot === "header-left" && e.type === "logo")),
        newLeft,
      ],
    }));
    toast.success("تمت إضافة الشعار الأيسر");
  };

  // نسخ الشعار الأيمن إلى الأيسر
  const handleSyncLogos = () => {
    if (!rightLogo?.src) {
      toast.error("لا يوجد شعار أيمن لنسخه");
      return;
    }
    if (leftLogo) {
      updateElement(leftLogo.id, { src: rightLogo.src, width: 75, height: 75 });
    } else {
      const newLeft: EnteteElement = {
        id: "logo-left-default",
        label: "الشعار الأيسر",
        type: "logo",
        slot: "header-left",
        src: rightLogo.src,
        width: 75,
        height: 75,
        borderRadius: 8,
      };
      setConfig((c) => ({ ...c, elements: [...c.elements, newLeft] }));
    }
    toast.success("تمت مطابقة الشعار الأيسر مع الأيمن بنجاح");
  };

  // حفظ التغييرات
  const handleSave = async () => {
    setSaving(true);
    try {
      // إزالة أي عناصر مكررة من الوسط قبل الحفظ
      const currentClubName = (settings.clubName || DEFAULT_CLUB_OFFICIAL_NAME).trim();
      const normMain = currentClubName.toLowerCase().replace(/\s+/g, " ");

      const sanitizedElements = config.elements.map((el) => {
        // تثبيت أبعاد الشعارات دائماً على 75px
        if (el.type === "logo") {
          return { ...el, width: 75, height: 75 };
        }
        return el;
      }).filter((el, idx, arr) => {
        // إذا كان نصاً في الوسط ومطابقاً أو متضمناً في الاسم الرئيسي
        if (el.slot === "header-center" && el.type === "text") {
          const txt = (el.content || "").trim().toLowerCase().replace(/\s+/g, " ");
          const firstTitleIdx = arr.findIndex((x) => x.slot === "header-center" && x.type === "text");
          if (idx !== firstTitleIdx) {
            // حذف أي سطر إضافي يحتوي كلمات مثل "فرع السباحة" أو "الرائد سعيدة" لأنها موجودة في السطر الأول
            if (normMain.includes(txt) || txt.includes("فرع السباحة") || txt.includes("الرائد")) {
              return false;
            }
          }
        }
        return true;
      });

      const cleanConfig: EnteteConfig = {
        ...config,
        elements: sanitizedElements,
      };

      const [enteteRes, settingsRes] = await Promise.all([
        fetch("/api/entete", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: cleanConfig }),
        }),
        fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings }),
        }),
      ]);

      if (!enteteRes.ok || !settingsRes.ok) {
        throw new Error("فشل حفظ بعض الإعدادات");
      }

      setConfig(cleanConfig);
      toast.success("تم حفظ الترويسة الموحدة بنجاح");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  // استعادة الافتراضي
  const handleReset = async () => {
    if (!confirm("استعادة الإعدادات الرسمية الافتراضية للترويسة الموحدة؟")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/entete", { method: "DELETE" });
      const data = await res.json();
      if (data.config) setConfig(data.config);
      setSettings((s) => ({ ...s, clubName: DEFAULT_CLUB_OFFICIAL_NAME }));
      toast.success("تمت استعادة الترويسة الرسمية بنجاح");
    } catch {
      toast.error("فشلت الاستعادة");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        <p className="text-sm text-muted-foreground">جاري تحميل إعدادات الترويسة الموحدة...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        onChange={handleLogoUpload}
        className="hidden"
      />

      {/* ══════ معاينة حية للترويسة الموحدة ══════ */}
      <div className="rounded-2xl border-2 border-teal-600/30 bg-gradient-to-b from-teal-50/60 to-white dark:from-teal-950/20 dark:to-card p-4 sm:p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-teal-700 dark:text-teal-400" />
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
              المعاينة المباشرة للترويسة الموحدة
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="text-[11px] bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/40 dark:text-teal-300">
              سطر واحد رسمي • شعاران ثابتان 75px
            </Badge>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400">
          هذه الترويسة تظهر تلقائياً في جميع التقارير والمطبوعات، عقود العمل، وقوائم التحميل عبر كامل صفحات الموقع.
        </p>

        {/* مكوّن الترويسة الفعلي للمعاينة */}
        <div className="rounded-xl overflow-hidden shadow-xs border border-slate-200 dark:border-slate-800 bg-white">
          <UnifiedReportHeader
            reportType="عقد عمل محدد المدة (CDD) / قائمة المنخرطين"
            reportSubtitle="نموذج توضيحي للترويسة الموحدة"
            date={new Date()}
            entete={config}
            settings={settings}
          />
        </div>
      </div>

      {/* ══════ ألسنة التبويب المنظمة ══════ */}
      <Tabs defaultValue="lines" className="w-full">
        <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4 h-auto p-1 gap-1 bg-slate-100 dark:bg-slate-900 rounded-xl">
          <TabsTrigger value="lines" className="text-xs py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-xs">
            <FileText className="h-3.5 w-3.5 ml-1.5 text-teal-600" /> أسطر الترويسة (نطاقات التعديل)
          </TabsTrigger>
          <TabsTrigger value="logos" className="text-xs py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-xs">
            <ImageIcon className="h-3.5 w-3.5 ml-1.5 text-teal-600" /> الشعارات (ثبات الحجم 75px)
          </TabsTrigger>
          <TabsTrigger value="club" className="text-xs py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-xs">
            <Building className="h-3.5 w-3.5 ml-1.5 text-teal-600" /> بيانات المقر والاتصال
          </TabsTrigger>
          <TabsTrigger value="format" className="text-xs py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-xs">
            <Settings2 className="h-3.5 w-3.5 ml-1.5 text-teal-600" /> التنسيق والفاصل
          </TabsTrigger>
        </TabsList>

        {/* ══════ نطاقات أسطر الترويسة ══════ */}
        <TabsContent value="lines" className="space-y-4 mt-4">
          {/* ──── السطر 1: اسم النادي في سطر واحد ──── */}
          <div className="rounded-xl border border-teal-200 dark:border-teal-900 bg-white dark:bg-card p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-teal-600 text-white text-xs font-bold">1</span>
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100">
                    السطر الأول: اسم الجمعية والنادي (سطر واحد بارز)
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    يكتب في سطر واحد بارز بدون التواء لإتاحة متسع لباقي أسطر الوثائق ومنع أي تكرار
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 text-teal-700 border-teal-300 hover:bg-teal-50"
                onClick={() => handleUpdateClubName(DEFAULT_CLUB_OFFICIAL_NAME)}
              >
                <Sparkles className="h-3 w-3 ml-1 text-teal-600" /> الاسم الرسمي النموذجي
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">نص اسم النادي الرسمي:</Label>
              <Input
                value={settings.clubName ?? titleElement.content ?? ""}
                onChange={(e) => handleUpdateClubName(e.target.value)}
                className="h-10 text-sm font-bold text-teal-800 dark:text-teal-300 bg-slate-50 dark:bg-slate-900/50"
                placeholder="الجمعية الرياضية الهاوية النادي الهاوي متعدد الرياضات - الرائد سعيدة - فرع السباحة"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="space-y-1">
                <Label className="text-[11px]">الخط المعتمد</Label>
                <select
                  value={titleElement.fontFamily || "Cairo"}
                  onChange={(e) => updateElement(titleElement.id, { fontFamily: e.target.value })}
                  className="w-full h-8 text-xs rounded-md border border-input bg-card px-2"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">حجم الخط (pt)</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="11"
                  max="16"
                  value={titleElement.fontSize || 13.5}
                  onChange={(e) => updateElement(titleElement.id, { fontSize: +e.target.value })}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">لون الخط</Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="color"
                    value={titleElement.color || "#0f766e"}
                    onChange={(e) => updateElement(titleElement.id, { color: e.target.value })}
                    className="h-8 w-9 p-0.5"
                  />
                  <Input
                    value={titleElement.color || "#0f766e"}
                    onChange={(e) => updateElement(titleElement.id, { color: e.target.value })}
                    className="h-8 text-xs font-mono"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-teal-700 dark:text-teal-400 bg-teal-50/70 dark:bg-teal-950/30 p-2 rounded-lg">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>
                نظام التنقية التلقائية مفعّل: يتم إزالة أي كلمات مكررة (مثل "فرع السباحة" أو "سعيدة") تلقائياً في حال وجود أسطر وسطى فرعية.
              </span>
            </div>
          </div>

          {/* ──── السطر 2: نوع الوثيقة والتقرير ──── */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-card p-4 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-700 text-white text-xs font-bold">2</span>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100">
                  السطر الثاني: نوع الوثيقة أو التقرير (شارة مخصصة)
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  يظهر تلقائياً كشارة بيضاوية أنيقة تحت اسم النادي حسب الوثيقة المفتوحة أو المصدرة
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">أمثلة على نوع الوثيقة:</span>
                <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-[#0f766e15] text-[#0f766e] border border-[#0f766e35]">
                  عقد عمل محدد المدة (CDD)
                </span>
                <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-700">
                  قائمة المنخرطين
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] text-slate-600">
                يُمرَّر تلقائياً لكل مطبوعة
              </Badge>
            </div>
          </div>

          {/* ──── السطر 3: الصف المرجعي والمكاني ──── */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-card p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-700 text-white text-xs font-bold">3</span>
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100">
                    السطر الثالث: الصف المرجعي (الرقم + التاريخ والمكان + الموسم)
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    صف البيانات الرسمية في أسفل الترويسة
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">إظهار الصف المرجعي</Label>
                <Switch
                  checked={config.showReferenceRow}
                  onCheckedChange={(c) => setConfig({ ...config, showReferenceRow: c })}
                />
              </div>
            </div>

            {config.showReferenceRow && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Hash className="h-3 w-3 text-teal-600" /> نص رقم المرجع
                  </Label>
                  <Input
                    value={config.referenceNumberText}
                    onChange={(e) => setConfig({ ...config, referenceNumberText: e.target.value })}
                    className="h-8 text-xs"
                    placeholder="الرقم: . . ./ن.ر.ر.س"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-teal-600" /> نص مكان وتاريخ التحرير
                  </Label>
                  <Input
                    value={config.dateLocationText}
                    onChange={(e) => setConfig({ ...config, dateLocationText: e.target.value })}
                    className="h-8 text-xs"
                    placeholder="سعيدة في:"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-teal-600" /> الموسم الرياضي
                  </Label>
                  <Input
                    value={settings.sportSeason || ""}
                    onChange={(e) => setSettings({ ...settings, sportSeason: e.target.value })}
                    className="h-8 text-xs"
                    placeholder="2026/2027"
                    dir="ltr"
                  />
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ══════ الشعارات (ثبات الحجم والموقع مع إمكانية الحذف الفردي) ══════ */}
        <TabsContent value="logos" className="space-y-4 mt-4">
          <div className="rounded-xl border border-teal-200 dark:border-teal-900 bg-white dark:bg-card p-4 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-teal-600" />
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100">
                    إدارة الشعارات مع إمكانية حذف كل شعار على حدة (75px × 75px)
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    يمكنك حذف الشعار الأيمن أو الأيسر منفرداً أو استرجاعهما، مع الحفاظ على التوازن والتوسط التلقائي
                  </p>
                </div>
              </div>
              {rightLogo && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-8 text-teal-700 border-teal-300 hover:bg-teal-50"
                  onClick={handleSyncLogos}
                >
                  <Copy className="h-3 w-3 ml-1" /> مطابقة الشعار الأيسر مع الأيمن
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* الشعار الأيمن */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-xs font-bold text-teal-700 border-teal-300">
                      الشعار الأيمن
                    </Badge>
                    {rightLogo ? (
                      <span className="text-[10px] text-emerald-700 bg-emerald-100/80 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full font-bold">مفعّل</span>
                    ) : (
                      <span className="text-[10px] text-rose-700 bg-rose-100/80 dark:bg-rose-950/60 px-2 py-0.5 rounded-full font-bold">محذوف</span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">75px × 75px</span>
                </div>

                {rightLogo ? (
                  <div className="flex items-center gap-3">
                    <div
                      style={{
                        width: 75,
                        height: 75,
                        minWidth: 75,
                        maxWidth: 75,
                        minHeight: 75,
                        maxHeight: 75,
                      }}
                      className="rounded-lg bg-white border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-center overflow-hidden shrink-0"
                    >
                      <img
                        src={rightLogo.src}
                        alt="الشعار الأيمن"
                        width={75}
                        height={75}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs h-7.5"
                        onClick={() => {
                          setLogoUploadTarget(rightLogo.id);
                          fileInputRef.current?.click();
                        }}
                      >
                        <Upload className="h-3 w-3 ml-1" /> تغيير الشعار الأيمن
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs h-7.5 text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                        onClick={handleDeleteRightLogo}
                      >
                        <Trash2 className="h-3 w-3 ml-1" /> حذف الشعار الأيمن على حدة
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 border-2 border-dashed border-rose-200 dark:border-rose-900/50 rounded-lg text-center space-y-2.5 bg-rose-50/30 dark:bg-rose-950/10">
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                      تم حذف الشعار الأيمن (يظهر مكانه فارغاً بتوازن تام)
                    </p>
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7.5 text-teal-700 border-teal-300 hover:bg-teal-50"
                        onClick={handleAddRightLogo}
                      >
                        <Plus className="h-3 w-3 ml-1" /> استرجاع الشعار الرسمي
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7.5"
                        onClick={() => {
                          setLogoUploadTarget("logo-right-default");
                          fileInputRef.current?.click();
                        }}
                      >
                        <Upload className="h-3 w-3 ml-1" /> رفع شعار جديد
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* الشعار الأيسر */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-xs font-bold text-teal-700 border-teal-300">
                      الشعار الأيسر
                    </Badge>
                    {leftLogo ? (
                      <span className="text-[10px] text-emerald-700 bg-emerald-100/80 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full font-bold">مفعّل</span>
                    ) : (
                      <span className="text-[10px] text-rose-700 bg-rose-100/80 dark:bg-rose-950/60 px-2 py-0.5 rounded-full font-bold">محذوف</span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">75px × 75px</span>
                </div>

                {leftLogo ? (
                  <div className="flex items-center gap-3">
                    <div
                      style={{
                        width: 75,
                        height: 75,
                        minWidth: 75,
                        maxWidth: 75,
                        minHeight: 75,
                        maxHeight: 75,
                      }}
                      className="rounded-lg bg-white border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-center overflow-hidden shrink-0"
                    >
                      <img
                        src={leftLogo.src}
                        alt="الشعار الأيسر"
                        width={75}
                        height={75}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs h-7.5"
                          onClick={() => {
                            setLogoUploadTarget(leftLogo.id);
                            fileInputRef.current?.click();
                          }}
                        >
                          <Upload className="h-3 w-3 ml-1" /> تغيير
                        </Button>
                        {rightLogo && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs h-7.5 text-teal-700 border-teal-300 hover:bg-teal-50"
                            onClick={handleSyncLogos}
                            title="مطابقة مع الأيمن"
                          >
                            <Copy className="h-3 w-3 ml-1" /> مطابقة
                          </Button>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs h-7.5 text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                        onClick={handleDeleteLeftLogo}
                      >
                        <Trash2 className="h-3 w-3 ml-1" /> حذف الشعار الأيسر على حدة
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 border-2 border-dashed border-rose-200 dark:border-rose-900/50 rounded-lg text-center space-y-2.5 bg-rose-50/30 dark:bg-rose-950/10">
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                      تم حذف الشعار الأيسر (يظهر مكانه فارغاً بتوازن تام)
                    </p>
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7.5 text-teal-700 border-teal-300 hover:bg-teal-50"
                        onClick={handleAddLeftLogo}
                      >
                        <Plus className="h-3 w-3 ml-1" /> إضافة / استرجاع
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7.5"
                        onClick={() => {
                          setLogoUploadTarget("logo-left-default");
                          fileInputRef.current?.click();
                        }}
                      >
                        <Upload className="h-3 w-3 ml-1" /> رفع شعار جديد
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="text-[11px] text-slate-600 dark:text-slate-400 bg-teal-50/50 dark:bg-teal-950/20 p-2.5 rounded-lg border border-teal-100 dark:border-teal-900/50">
              ⚡ <strong>أداء وثبات تام:</strong> عند حذف أحد الشعارين، يحافظ الآخر على موقعه وحجمه (75px) مع بقاء عنوان النادي في السطر الأول متمركزاً بدقة.
            </div>
          </div>
        </TabsContent>

        {/* ══════ بيانات النادي والمقر ══════ */}
        <TabsContent value="club" className="space-y-3 mt-4">
          <div className="rounded-xl border border-border/60 bg-white dark:bg-card p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5" /> معلومات النادي والمقر الإداري
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">اسم النادي الكامل (عربي)</Label>
                <Input
                  value={settings.clubName || ""}
                  onChange={(e) => handleUpdateClubName(e.target.value)}
                  className="h-9 text-xs font-bold"
                  placeholder="الجمعية الرياضية الهاوية النادي الهاوي متعدد الرياضات - الرائد سعيدة - فرع السباحة"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">اسم النادي (فرنسي)</Label>
                <Input
                  value={settings.clubNameFr || ""}
                  onChange={(e) => setSettings({ ...settings, clubNameFr: e.target.value })}
                  className="h-9 text-xs"
                  placeholder="Club Sportif Amateur - Raed Saida"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> عنوان المقر</Label>
                <Input
                  value={settings.clubAddress || ""}
                  onChange={(e) => setSettings({ ...settings, clubAddress: e.target.value })}
                  className="h-9 text-xs"
                  placeholder="طاب لحسن، سعيدة"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> الولاية</Label>
                <Input
                  value={settings.wilaya || ""}
                  onChange={(e) => setSettings({ ...settings, wilaya: e.target.value })}
                  className="h-9 text-xs"
                  placeholder="سعيدة"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> الهاتف</Label>
                <Input
                  value={settings.clubPhone || ""}
                  onChange={(e) => setSettings({ ...settings, clubPhone: e.target.value })}
                  className="h-9 text-xs"
                  dir="ltr"
                  placeholder="0664451250"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> البريد الإلكتروني</Label>
                <Input
                  value={settings.clubEmail || ""}
                  onChange={(e) => setSettings({ ...settings, clubEmail: e.target.value })}
                  className="h-9 text-xs"
                  dir="ltr"
                  placeholder="rcs.natation.saida@gmail.com"
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ══════ التنسيق والفاصل ══════ */}
        <TabsContent value="format" className="space-y-3 mt-4">
          <div className="rounded-xl border border-border/60 bg-white dark:bg-card p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Settings2 className="h-3.5 w-3.5" /> تنسيق الخط الفاصل
            </h4>
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">إظهار الفاصل الملون</Label>
                  <Switch
                    checked={config.showDivider}
                    onCheckedChange={(c) => setConfig({ ...config, showDivider: c })}
                  />
                </div>
                {config.showDivider && (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div>
                      <Label className="text-[10px]">لون الفاصل</Label>
                      <div className="flex gap-1 mt-1">
                        <Input
                          type="color"
                          value={config.dividerColor}
                          onChange={(e) => setConfig({ ...config, dividerColor: e.target.value })}
                          className="h-8 w-10 p-1"
                        />
                        <Input
                          value={config.dividerColor}
                          onChange={(e) => setConfig({ ...config, dividerColor: e.target.value })}
                          className="h-8 text-xs font-mono"
                          dir="ltr"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px]">سماكة الفاصل (px)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={6}
                        value={config.dividerWidth}
                        onChange={(e) => setConfig({ ...config, dividerWidth: +e.target.value })}
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ══════ أزرار الحفظ والاستعادة ══════ */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/60">
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={saving}
          className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
        >
          <RotateCcw className="h-3.5 w-3.5 ml-1" /> استعادة الترويسة الافتراضية
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-teal-700 hover:bg-teal-800 text-white text-xs px-5 shadow-sm"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Save className="h-4 w-4 ml-1" />}
          حفظ الترويسة الموحدة
        </Button>
      </div>
    </div>
  );
}

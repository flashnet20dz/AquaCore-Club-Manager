"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Palette, Sun, Moon, Monitor, Save, RotateCcw, Upload, Check,
  Loader2, Type, Square, Sparkles, ImageIcon, Contrast, AlertTriangle,
  Smartphone, Tablet, Layout,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  THEME_PRESETS, DEFAULT_THEME_CONFIG, applyThemeConfig, checkContrast,
  oklchString, parseOklch, type ClubThemeConfig, type Mode,
  type BorderRadius, type Density, type FontFamily,
} from "@/lib/theme-presets";
import { useTheme } from "@/lib/theme-context";

// ════════════ Main Theme Settings Panel ════════════
export function ThemeSettingsPanel() {
  const { mode, setMode, clubTheme, setClubTheme, reloadClubTheme } = useTheme();

  // Local draft state (saved on explicit save button)
  const [draft, setDraft] = useState<ClubThemeConfig>(clubTheme);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync draft when clubTheme loads
  useEffect(() => {
    setDraft(clubTheme);
  }, [clubTheme]);

  // Apply draft live (preview) — doesn't save to DB
  const applyDraftLive = useCallback((newDraft: ClubThemeConfig) => {
    setDraft(newDraft);
    applyThemeConfig(newDraft);
  }, []);

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(clubTheme);

  // ═══ Save handler ═══
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/theme", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الحفظ");
      setClubTheme(draft);
      toast.success("تم حفظ إعدادات المظهر بنجاح");
    } catch (e: any) {
      toast.error(e?.message || "تعذّر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  // ═══ Reset handler ═══
  const handleReset = async () => {
    setResetOpen(false);
    applyDraftLive(DEFAULT_THEME_CONFIG);
    setSaving(true);
    try {
      await fetch("/api/settings/theme", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(DEFAULT_THEME_CONFIG),
      });
      setClubTheme(DEFAULT_THEME_CONFIG);
      toast.success("تم إعادة المظهر للافتراضي");
    } catch {
      toast.error("تعذّر إعادة التعيين");
    } finally {
      setSaving(false);
    }
  };

  // ═══ Logo upload ═══
  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/club-logo", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل رفع الشعار");
      applyDraftLive({ ...draft, logoUrl: data.secureUrl });
      toast.success("تم رفع الشعار");
    } catch (e: any) {
      toast.error(e?.message || "تعذّر رفع الشعار");
    } finally {
      setLogoUploading(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            المظهر والألوان
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            خصّص هوية ناديك البصرية — ألوان، شعار، خط، حواف، وكثافة الواجهة.
          </p>
          <p className="mt-2 text-xs leading-6 rounded-xl border border-teal-500/25 bg-teal-500/10 text-teal-800 dark:text-teal-200 px-3 py-2">
            🌊 <strong>بطاقة المنخرط (البوابة):</strong> الشعار هنا + الألوان الأساسية والاستدارة
            تُطبَّق تلقائياً على البطاقة الرقمية التي يفتحها المنخرط من رابط بوابته — عدّلها مرة واحدة
            وستجد انعكاسها في كل الروابط.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setResetOpen(true)} disabled={saving}>
            <RotateCcw className="h-4 w-4 ml-1" />
            إعادة للافتراضي
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges} className="bg-primary">
            {saving ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <Save className="h-4 w-4 ml-1" />}
            حفظ التغييرات
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-2 text-amber-800 dark:text-amber-300 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          لديك تغييرات غير محفوظة. اضغط «حفظ التغييرات» لتطبيقها على كل مستخدمي النادي.
        </div>
      )}

      <Tabs defaultValue="presets" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="presets"><Palette className="h-4 w-4 ml-1" /> القوالب الجاهزة</TabsTrigger>
          <TabsTrigger value="custom"><Sparkles className="h-4 w-4 ml-1" /> تخصيص متقدم</TabsTrigger>
          <TabsTrigger value="mode"><Monitor className="h-4 w-4 ml-1" /> الوضع الليلي/النهاري</TabsTrigger>
        </TabsList>

        {/* ═══ Presets Grid ═══ */}
        <TabsContent value="presets" className="space-y-4 mt-4">
          <Label className="text-sm font-semibold">اختر قالباً جاهزاً</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {THEME_PRESETS.map((preset) => {
              const selected = draft.themePreset === preset.id;
              return (
                <motion.button
                  key={preset.id}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => applyDraftLive({
                    ...draft,
                    themePreset: preset.id,
                    primaryColor: null, secondaryColor: null, accentColor: null,
                  })}
                  className={cn(
                    "relative rounded-xl border-2 p-3 text-right transition-all overflow-hidden",
                    selected
                      ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  {/* Swatches preview */}
                  <div className="flex gap-1.5 mb-2">
                    <div
                      className="h-8 w-8 rounded-lg shadow-sm"
                      style={{ background: preset.swatches.primary }}
                    />
                    <div
                      className="h-8 w-8 rounded-lg shadow-sm"
                      style={{ background: preset.swatches.secondary }}
                    />
                    <div
                      className="h-8 w-8 rounded-lg shadow-sm"
                      style={{ background: preset.swatches.accent }}
                    />
                  </div>
                  <div className="font-semibold text-sm">{preset.name}</div>
                  <div className="text-[10px] text-muted-foreground">{preset.nameEn}</div>
                  {selected && (
                    <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </TabsContent>

        {/* ═══ Custom colors + Logo + Radius + Density + Font ═══ */}
        <TabsContent value="custom" className="space-y-5 mt-4">
          {/* Color pickers */}
          <div className="rounded-xl border bg-card p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">الألوان المخصصة</h3>
              {draft.themePreset && !draft.primaryColor && (
                <Badge variant="secondary" className="text-[10px]">يعتمد القالب: {THEME_PRESETS.find(p => p.id === draft.themePreset)?.name}</Badge>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ColorPickerField
                label="اللون الأساسي (Primary)"
                presetDefault={THEME_PRESETS.find(p => p.id === (draft.themePreset || "ocean"))?.primary}
                value={draft.primaryColor}
                onChange={(v) => applyDraftLive({ ...draft, primaryColor: v, themePreset: null })}
              />
              <ColorPickerField
                label="اللون الثانوي (Secondary)"
                presetDefault={THEME_PRESETS.find(p => p.id === (draft.themePreset || "ocean"))?.secondary}
                value={draft.secondaryColor}
                onChange={(v) => applyDraftLive({ ...draft, secondaryColor: v, themePreset: null })}
              />
              <ColorPickerField
                label="لون التمييز (Accent)"
                presetDefault={THEME_PRESETS.find(p => p.id === (draft.themePreset || "ocean"))?.accent}
                value={draft.accentColor}
                onChange={(v) => applyDraftLive({ ...draft, accentColor: v, themePreset: null })}
              />
            </div>
          </div>

          {/* Logo upload */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">شعار النادي</h3>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30">
                {draft.logoUrl ? (
                  <img src={draft.logoUrl} alt="logo" className="h-full w-full object-contain" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleLogoUpload(f);
                  }}
                />
                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={logoUploading}>
                  {logoUploading ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <Upload className="h-4 w-4 ml-1" />}
                  رفع شعار
                </Button>
                {draft.logoUrl && (
                  <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => applyDraftLive({ ...draft, logoUrl: null })}>
                    إزالة
                  </Button>
                )}
                <p className="text-[10px] text-muted-foreground">PNG/JPG/SVG — يظهر بالهيدر والطباعة والبطاقات</p>
              </div>
            </div>
          </div>

          {/* Border radius */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Square className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">نصف قطر الحواف</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "sharp", label: "حاد", preview: "rounded-sm" },
                { value: "medium", label: "متوسط", preview: "rounded-xl" },
                { value: "full", label: "دائري", preview: "rounded-3xl" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => applyDraftLive({ ...draft, borderRadius: opt.value as BorderRadius })}
                  className={cn(
                    "p-3 border-2 rounded-lg flex flex-col items-center gap-2 transition-all",
                    draft.borderRadius === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <div className={cn("h-10 w-10 bg-primary/20 border-2 border-primary", opt.preview)} />
                  <span className="text-xs font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Density */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Layout className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">كثافة الواجهة</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "comfortable", label: "مريح", desc: "مساحات أكبر" },
                { value: "normal", label: "عادي", desc: "افتراضي" },
                { value: "compact", label: "مضغوط", desc: "مساحات أصغر" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => applyDraftLive({ ...draft, density: opt.value as Density })}
                  className={cn(
                    "p-3 border-2 rounded-lg text-center transition-all",
                    draft.density === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-[10px] text-muted-foreground">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Font family */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Type className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">الخط</h3>
            </div>
            <Select
              value={draft.fontFamily || "cairo"}
              onValueChange={(v) => applyDraftLive({ ...draft, fontFamily: v as FontFamily })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cairo">القاهرة (Cairo) — افتراضي</SelectItem>
                <SelectItem value="tajawal">تجوال (Tajawal)</SelectItem>
                <SelectItem value="system">خط النظام</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        {/* ═══ Dark/Light/System mode ═══ */}
        <TabsContent value="mode" className="space-y-4 mt-4">
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">وضع المظهر (شخصي — لكل جهاز)</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              هذا الإعداد شخصي لكل جهاز/متصفح ولا يؤثر على المستخدمين الآخرين.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "light", label: "نهاري", icon: Sun, color: "text-amber-500" },
                { value: "dark", label: "ليلي", icon: Moon, color: "text-indigo-400" },
                { value: "system", label: "تلقائي", icon: Monitor, color: "text-muted-foreground" },
              ] as const).map((opt) => {
                const Icon = opt.icon;
                const selected = mode === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setMode(opt.value as Mode)}
                    className={cn(
                      "p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-all",
                      selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                    )}
                  >
                    <Icon className={cn("h-6 w-6", opt.color)} />
                    <span className="text-sm font-medium">{opt.label}</span>
                    {selected && <Badge variant="secondary" className="text-[10px]">مفعّل</Badge>}
                  </button>
                );
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ═══ Live Preview ═══ */}
      <LivePreview config={draft} />

      {/* Reset confirmation */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              إعادة المظهر للافتراضي
            </AlertDialogTitle>
            <AlertDialogDescription>
              سيتم إعادة كل إعدادات المظهر (الألوان، الشعار، الحواف، الكثافة، الخط) إلى القيم الافتراضية.
              <strong className="block mt-2">لا يمكن التراجع عن هذا الإجراء.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} className="bg-amber-600 hover:bg-amber-700">
              إعادة للافتراضي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ════════════ Color Picker Field (with contrast check) ════════════
function ColorPickerField({
  label,
  presetDefault,
  value,
  onChange,
}: {
  label: string;
  presetDefault?: [number, number, number];
  value?: string | null;
  onChange: (v: string | null) => void;
}) {
  const presetColor = presetDefault ? oklchString(...presetDefault) : "";
  const currentValue = value || presetColor;

  // Parse L for contrast check
  const parsed = parseOklch(currentValue);
  const contrast = parsed ? checkContrast(parsed[0]) : null;

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          // Convert oklch to approx hex for the native picker (rough)
          value={oklchToHex(currentValue)}
          onChange={(e) => {
            const hex = e.target.value;
            const oklchVal = hexToOklch(hex);
            onChange(oklchVal);
          }}
          className="h-10 w-14 rounded-md border border-border cursor-pointer"
        />
        <Input
          value={currentValue}
          readOnly
          className="font-mono text-xs h-10"
        />
      </div>
      {value && (
        <Button
          size="sm"
          variant="ghost"
          className="text-[10px] h-6"
          onClick={() => onChange(null)}
        >
          استخدام لون القالب
        </Button>
      )}
      {/* Contrast indicator */}
      {contrast && (
        <div className={cn(
          "flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md",
          contrast.passes
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
            : "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
        )}>
          <Contrast className="h-3 w-3" />
          التباين: {contrast.ratio.toFixed(1)}:1
          {contrast.passes ? " ✓ WCAG AA" : " ⚠ ضعيف"}
          {contrast.suggestion && <span className="mr-1">— {contrast.suggestion}</span>}
        </div>
      )}
    </div>
  );
}

// ════════════ Live Preview ════════════
function LivePreview({ config }: { config: ClubThemeConfig }) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            <Tablet className="h-4 w-4 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-sm">معاينة حية</h3>
        </div>
        <Badge variant="outline" className="text-[10px]">يتحدث آنياً مع كل تغيير</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card preview */}
        <div className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
          <div className="text-xs text-muted-foreground">بطاقة (Card)</div>
          <div className="font-semibold">عنوان البطاقة</div>
          <p className="text-xs text-muted-foreground">هذا مثال على محتوى البطاقة مع النص الثانوي.</p>
          <div className="flex gap-2">
            <Button size="sm" className="bg-primary text-primary-foreground">زر أساسي</Button>
            <Button size="sm" variant="secondary">زر ثانوي</Button>
            <Button size="sm" variant="outline">زر محدد</Button>
          </div>
        </div>

        {/* Badges + table preview */}
        <div className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
          <div className="text-xs text-muted-foreground">شارات (Badges)</div>
          <div className="flex flex-wrap gap-1.5">
            <Badge className="bg-primary text-primary-foreground">أساسي</Badge>
            <Badge variant="secondary">ثانوي</Badge>
            <Badge className="bg-accent text-accent-foreground">تمييز</Badge>
            <Badge variant="outline">محدد</Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-2">حقل إدخال</div>
          <Input placeholder="اكتب هنا..." className="h-8" />
        </div>
      </div>
    </div>
  );
}

// ════════════ Color conversion helpers ════════════

/** Approximate oklch → hex (for native color picker display) */
function oklchToHex(oklchStr: string): string {
  const parsed = parseOklch(oklchStr);
  if (!parsed) return "#0F4C81";
  const [L, C, H] = parsed;
  // Very rough approximation: convert to HSL-like
  const r = Math.max(0, Math.min(255, Math.round((L * 255) + (C * 50 * Math.cos((H * Math.PI) / 180)))));
  const g = Math.max(0, Math.min(255, Math.round((L * 255) + (C * 50 * Math.cos(((H - 120) * Math.PI) / 180)))));
  const b = Math.max(0, Math.min(255, Math.round((L * 255) + (C * 50 * Math.cos(((H + 120) * Math.PI) / 180)))));
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/** Approximate hex → oklch string */
function hexToOklch(hex: string): string {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return hex;
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  // Rough approximation
  const L = (r * 0.299 + g * 0.587 + b * 0.114) * 0.85;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const C = (max - min) * 0.2;
  let H = 0;
  if (max === r) H = ((g - b) / (max - min)) * 60;
  else if (max === g) H = (2 + (b - r) / (max - min)) * 60;
  else if (max === b) H = (4 + (r - g) / (max - min)) * 60;
  if (H < 0) H += 360;
  return oklchString(L, C, H);
}

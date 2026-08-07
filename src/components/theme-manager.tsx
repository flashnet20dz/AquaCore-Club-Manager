"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Palette, Sun, Moon, Monitor, Save, RotateCcw, Download, Upload,
  Check, Loader2, Type, Square, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ═══ Preset Themes ═══
const PRESET_THEMES = [
  {
    name: "Ocean Blue", primary: "#0F4C81", secondary: "#00B4D8", accent: "#10B981",
    background: "#F8FAFC", card: "#FFFFFF", sidebar: "#F1F5F9", text: "#0F172A", border: "#E2E8F0",
    success: "#22C55E", warning: "#F59E0B", danger: "#EF4444", info: "#3B82F6",
  },
  {
    name: "Royal Blue", primary: "#1E40AF", secondary: "#3B82F6", accent: "#8B5CF6",
    background: "#F8FAFC", card: "#FFFFFF", sidebar: "#EFF6FF", text: "#1E293B", border: "#DBEAFE",
    success: "#16A34A", warning: "#EA580C", danger: "#DC2626", info: "#2563EB",
  },
  {
    name: "Emerald", primary: "#059669", secondary: "#10B981", accent: "#34D399",
    background: "#F0FDF4", card: "#FFFFFF", sidebar: "#ECFDF5", text: "#064E3B", border: "#D1FAE5",
    success: "#22C55E", warning: "#F59E0B", danger: "#EF4444", info: "#3B82F6",
  },
  {
    name: "Azure", primary: "#0284C7", secondary: "#0EA5E9", accent: "#06B6D4",
    background: "#F0F9FF", card: "#FFFFFF", sidebar: "#E0F2FE", text: "#0C4A6E", border: "#BAE6FD",
    success: "#22C55E", warning: "#F59E0B", danger: "#EF4444", info: "#0EA5E9",
  },
  {
    name: "Midnight", primary: "#6366F1", secondary: "#818CF8", accent: "#A78BFA",
    background: "#0B1220", card: "#111827", sidebar: "#101826", text: "#F8FAFC", border: "#243244",
    success: "#22C55E", warning: "#F59E0B", danger: "#EF4444", info: "#3B82F6",
  },
  {
    name: "Professional Dark", primary: "#334155", secondary: "#64748B", accent: "#0EA5E9",
    background: "#0F172A", card: "#1E293B", sidebar: "#0F172A", text: "#F1F5F9", border: "#334155",
    success: "#22C55E", warning: "#F59E0B", danger: "#EF4444", info: "#3B82F6",
  },
  {
    name: "Corporate", primary: "#1E3A5F", secondary: "#4A90D9", accent: "#50C878",
    background: "#F5F7FA", card: "#FFFFFF", sidebar: "#EEF2F7", text: "#2C3E50", border: "#D6DEE8",
    success: "#27AE60", warning: "#F39C12", danger: "#E74C3C", info: "#3498DB",
  },
  {
    name: "Swimming Club", primary: "#0891B2", secondary: "#06B6D4", accent: "#14B8A6",
    background: "#ECFEFF", card: "#FFFFFF", sidebar: "#CFFAFE", text: "#164E63", border: "#A5F3FC",
    success: "#22C55E", warning: "#F59E0B", danger: "#EF4444", info: "#0EA5E9",
  },
  {
    name: "Modern Glass", primary: "#6366F1", secondary: "#A78BFA", accent: "#F472B6",
    background: "#FAFAFF", card: "#FFFFFF", sidebar: "#F5F3FF", text: "#312E81", border: "#E0E7FF",
    success: "#22C55E", warning: "#F59E0B", danger: "#EF4444", info: "#3B82F6",
  },
  {
    name: "Minimal Gray", primary: "#374151", secondary: "#6B7280", accent: "#9CA3AF",
    background: "#F9FAFB", card: "#FFFFFF", sidebar: "#F3F4F6", text: "#111827", border: "#E5E7EB",
    success: "#22C55E", warning: "#F59E0B", danger: "#EF4444", info: "#3B82F6",
  },
];

const FONTS = [
  { value: "Cairo", label: "Cairo (موصى به)" },
  { value: "Tajawal", label: "Tajawal" },
  { value: "Tahoma", label: "Tahoma" },
  { value: "Arial", label: "Arial" },
];

interface ThemeState {
  themeMode: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  cardColor: string;
  sidebarColor: string;
  textColor: string;
  borderColor: string;
  successColor: string;
  warningColor: string;
  dangerColor: string;
  infoColor: string;
  borderRadius: string;
  fontFamily: string;
  themeName: string;
}

const DEFAULT_THEME: ThemeState = {
  themeMode: "light",
  primaryColor: "#0F4C81",
  secondaryColor: "#00B4D8",
  accentColor: "#10B981",
  backgroundColor: "#F8FAFC",
  cardColor: "#FFFFFF",
  sidebarColor: "#F1F5F9",
  textColor: "#0F172A",
  borderColor: "#E2E8F0",
  successColor: "#22C55E",
  warningColor: "#F59E0B",
  dangerColor: "#EF4444",
  infoColor: "#3B82F6",
  borderRadius: "0.625rem",
  fontFamily: "Cairo",
  themeName: "Ocean Blue",
};

export function ThemeManager() {
  const [theme, setTheme] = useState<ThemeState>(DEFAULT_THEME);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const saved = localStorage.getItem("aquacore-theme");
        if (saved) {
          setTheme(JSON.parse(saved));
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  // 🔑 تطبيق الثيم على CSS Variables فوراً
  const applyTheme = useCallback((t: ThemeState) => {
    const root = document.documentElement;
    root.style.setProperty("--primary", t.primaryColor);
    root.style.setProperty("--secondary", t.secondaryColor);
    root.style.setProperty("--accent", t.accentColor);
    root.style.setProperty("--background", t.backgroundColor);
    root.style.setProperty("--card", t.cardColor);
    root.style.setProperty("--sidebar", t.sidebarColor);
    root.style.setProperty("--foreground", t.textColor);
    root.style.setProperty("--border", t.borderColor);
    root.style.setProperty("--success", t.successColor);
    root.style.setProperty("--warning", t.warningColor);
    root.style.setProperty("--destructive", t.dangerColor);
    root.style.setProperty("--info", t.infoColor);
    root.style.setProperty("--radius", t.borderRadius);

    // Dark/Light mode
    if (t.themeMode === "dark") {
      root.classList.add("dark");
    } else if (t.themeMode === "light") {
      root.classList.remove("dark");
    } else {
      // auto
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) root.classList.add("dark");
      else root.classList.remove("dark");
    }
  }, []);

  useEffect(() => {
    if (!loading) applyTheme(theme);
  }, [theme, loading, applyTheme]);

  const set = <K extends keyof ThemeState>(key: K, value: ThemeState[K]) => {
    setTheme((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem("aquacore-theme", JSON.stringify(theme));
      toast.success("تم حفظ الثيم");
    } catch {
      toast.error("فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!confirm("إعادة التعيين للثيم الافتراضي؟")) return;
    setTheme(DEFAULT_THEME);
    localStorage.removeItem("aquacore-theme");
    toast.success("تمت إعادة التعيين");
  };

  const applyPreset = (preset: typeof PRESET_THEMES[0]) => {
    setTheme({
      ...DEFAULT_THEME,
      themeName: preset.name,
      primaryColor: preset.primary,
      secondaryColor: preset.secondary,
      accentColor: preset.accent,
      backgroundColor: preset.background,
      cardColor: preset.card,
      sidebarColor: preset.sidebar,
      textColor: preset.text,
      borderColor: preset.border,
      successColor: preset.success,
      warningColor: preset.warning,
      dangerColor: preset.danger,
      infoColor: preset.info,
    });
    toast.success(`تم تطبيق ثيم ${preset.name}`);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(theme, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aquacore-theme-${theme.themeName}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير الثيم");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        setTheme({ ...DEFAULT_THEME, ...data });
        toast.success("تم استيراد الثيم");
      } catch {
        toast.error("ملف غير صالح");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Settings */}
      <div className="space-y-6">
        {/* Theme Mode */}
        <Section title="الوضع العام" icon={Sun}>
          <div className="flex gap-2">
            {([
              { v: "light", l: "فاتح", icon: Sun },
              { v: "dark", l: "داكن", icon: Moon },
              { v: "auto", l: "تلقائي", icon: Monitor },
            ] as const).map((m) => (
              <Button
                key={m.v}
                variant={theme.themeMode === m.v ? "default" : "outline"}
                size="sm"
                className="flex-1 gap-1"
                onClick={() => set("themeMode", m.v)}
              >
                <m.icon className="h-4 w-4" /> {m.l}
              </Button>
            ))}
          </div>
        </Section>

        {/* Preset Themes */}
        <Section title="ثيمات جاهزة" icon={Sparkles}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PRESET_THEMES.map((p) => (
              <button
                key={p.name}
                onClick={() => applyPreset(p)}
                className={cn(
                  "flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition hover:scale-105",
                  theme.themeName === p.name ? "border-primary ring-2 ring-primary/20" : "border-border"
                )}
              >
                <div className="flex gap-1">
                  <div className="w-5 h-5 rounded-full" style={{ background: p.primary }} />
                  <div className="w-5 h-5 rounded-full" style={{ background: p.secondary }} />
                  <div className="w-5 h-5 rounded-full" style={{ background: p.accent }} />
                </div>
                <span className="text-[10px] font-semibold">{p.name}</span>
              </button>
            ))}
          </div>
        </Section>

        {/* Colors */}
        <Section title="الألوان" icon={Palette}>
          <div className="grid grid-cols-2 gap-3">
            <ColorField label="اللون الأساسي" value={theme.primaryColor} onChange={(v) => set("primaryColor", v)} />
            <ColorField label="اللون الثانوي" value={theme.secondaryColor} onChange={(v) => set("secondaryColor", v)} />
            <ColorField label="لون التمييز" value={theme.accentColor} onChange={(v) => set("accentColor", v)} />
            <ColorField label="الخلفية" value={theme.backgroundColor} onChange={(v) => set("backgroundColor", v)} />
            <ColorField label="البطاقات" value={theme.cardColor} onChange={(v) => set("cardColor", v)} />
            <ColorField label="الشريط الجانبي" value={theme.sidebarColor} onChange={(v) => set("sidebarColor", v)} />
            <ColorField label="النص" value={theme.textColor} onChange={(v) => set("textColor", v)} />
            <ColorField label="الحدود" value={theme.borderColor} onChange={(v) => set("borderColor", v)} />
            <ColorField label="نجاح" value={theme.successColor} onChange={(v) => set("successColor", v)} />
            <ColorField label="تحذير" value={theme.warningColor} onChange={(v) => set("warningColor", v)} />
            <ColorField label="خطر" value={theme.dangerColor} onChange={(v) => set("dangerColor", v)} />
            <ColorField label="معلومة" value={theme.infoColor} onChange={(v) => set("infoColor", v)} />
          </div>
        </Section>

        {/* Typography */}
        <Section title="الخطوط والتنسيق" icon={Type}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">الخط</Label>
              <select
                value={theme.fontFamily}
                onChange={(e) => set("fontFamily", e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                {FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold">انحناء الزوايا: {theme.borderRadius}</Label>
              <select
                value={theme.borderRadius}
                onChange={(e) => set("borderRadius", e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="0rem">حادة (0)</option>
                <option value="0.375rem">خفيفة (6px)</option>
                <option value="0.625rem">متوسطة (10px)</option>
                <option value="0.875rem">دائرية (14px)</option>
                <option value="1.25rem">كبيرة (20px)</option>
              </select>
            </div>
          </div>
        </Section>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 ml-1" />}
            حفظ الثيم
          </Button>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 ml-1" /> إعادة افتراضي
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 ml-1" /> تصدير
          </Button>
          <label>
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
            <Button variant="outline" asChild>
              <span><Upload className="h-4 w-4 ml-1" /> استيراد</span>
            </Button>
          </label>
        </div>
      </div>

      {/* Right: Live Preview */}
      <div className="lg:sticky lg:top-6 h-fit">
        <div className="rounded-2xl border-2 overflow-hidden shadow-xl" style={{ background: theme.backgroundColor, borderRadius: theme.borderRadius }}>
          {/* Topbar */}
          <div className="flex items-center justify-between p-3 border-b" style={{ background: theme.sidebarColor, borderColor: theme.borderColor }}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg" style={{ background: theme.primaryColor }} />
              <span className="font-bold text-sm" style={{ color: theme.textColor }}>AquaCore</span>
            </div>
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded-full" style={{ background: theme.dangerColor }} />
              <div className="w-3 h-3 rounded-full" style={{ background: theme.warningColor }} />
              <div className="w-3 h-3 rounded-full" style={{ background: theme.successColor }} />
            </div>
          </div>

          <div className="flex">
            {/* Sidebar */}
            <div className="w-24 p-2 space-y-1 border-l" style={{ background: theme.sidebarColor, borderColor: theme.borderColor }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={cn("flex items-center gap-1 p-1.5 rounded-lg", i === 1 ? "" : "opacity-60")} style={i === 1 ? { background: theme.primaryColor + "20" } : {}}>
                  <div className="w-4 h-4 rounded" style={{ background: i === 1 ? theme.primaryColor : theme.textColor + "40" }} />
                  <div className="h-2 flex-1 rounded" style={{ background: theme.textColor + "20" }} />
                </div>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 p-3 space-y-3">
              {/* Cards */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "المنخرطون", color: theme.primaryColor },
                  { label: "المدفوعات", color: theme.successColor },
                  { label: "التجديدات", color: theme.warningColor },
                ].map((c, i) => (
                  <div key={i} className="p-2 rounded-lg border" style={{ background: theme.cardColor, borderColor: theme.borderColor, borderRadius: theme.borderRadius }}>
                    <div className="w-6 h-6 rounded-lg mb-1" style={{ background: c.color }} />
                    <div className="h-3 w-12 rounded mb-1" style={{ background: theme.textColor + "20" }} />
                    <div className="h-2 w-8 rounded" style={{ background: c.color + "40" }} />
                  </div>
                ))}
              </div>

              {/* Button */}
              <div className="flex gap-2">
                <button className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: theme.primaryColor, borderRadius: theme.borderRadius }}>
                  زر أساسي
                </button>
                <button className="px-3 py-1.5 rounded-lg text-xs font-bold border" style={{ borderColor: theme.borderColor, color: theme.textColor, borderRadius: theme.borderRadius }}>
                  زر ثانوي
                </button>
                <button className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: theme.dangerColor, borderRadius: theme.borderRadius }}>
                  حذف
                </button>
              </div>

              {/* Table */}
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: theme.borderColor, borderRadius: theme.borderRadius }}>
                <div className="flex p-2 gap-2 border-b" style={{ background: theme.primaryColor, borderColor: theme.borderColor }}>
                  <span className="text-[10px] text-white font-bold flex-1">الاسم</span>
                  <span className="text-[10px] text-white font-bold w-12">المبلغ</span>
                </div>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex p-2 gap-2 border-b" style={{ background: theme.cardColor, borderColor: theme.borderColor }}>
                    <div className="h-2 flex-1 rounded" style={{ background: theme.textColor + "20" }} />
                    <div className="h-2 w-10 rounded" style={{ background: theme.accentColor + "40" }} />
                  </div>
                ))}
              </div>

              {/* Badges */}
              <div className="flex gap-1 flex-wrap">
                {[
                  { l: "نشط", c: theme.successColor },
                  { l: "معلّق", c: theme.warningColor },
                  { l: "منتهي", c: theme.dangerColor },
                  { l: "معلومات", c: theme.infoColor },
                ].map((b, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ background: b.c }}>
                    {b.l}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Theme info */}
        <div className="mt-3 flex items-center justify-between">
          <Badge variant="outline" className="text-xs">
            <Palette className="h-3 w-3 ml-1" /> {theme.themeName}
          </Badge>
          <span className="text-[10px] text-muted-foreground">معاينة مباشرة</span>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Palette; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
      <h3 className="font-bold text-sm flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </h3>
      {children}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs font-semibold">{label}</Label>
      <div className="flex gap-2 items-center mt-1">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-9 cursor-pointer rounded border border-input"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 text-xs font-mono"
          dir="ltr"
        />
      </div>
    </div>
  );
}

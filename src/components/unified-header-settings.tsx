"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Type, Image as ImageIcon, Plus, Trash2, Copy, Save, Loader2,
  Eye, RotateCcw, Bold, Italic, Underline, AlignRight, AlignCenter,
  AlignLeft, Upload, Settings2, Building, Phone, Mail, Globe, MapPin,
  Calendar, Hash, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { UnifiedReportHeader, type EnteteConfig, type EnteteElement } from "@/components/unified-report-header";

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
  { value: "Cairo", label: "Cairo (افتراضي)" },
  { value: "Tajawal", label: "Tajawal" },
  { value: "Amiri", label: "Amiri (كلاسيكي)" },
  { value: "Tahoma", label: "Tahoma" },
  { value: "Arial", label: "Arial" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Georgia", label: "Georgia" },
  { value: "Verdana", label: "Verdana" },
];

const COLOR_PRESETS = [
  "#0f766e", "#0891b2", "#1d4ed8", "#6366f1", "#9333ea",
  "#dc2626", "#ea580c", "#f59e0b", "#16a34a", "#0284c7",
  "#111111", "#555555", "#999999", "#ffffff",
];

const DEFAULT_CONFIG: EnteteConfig = {
  elements: [
    { id: "logo-l", label: "الشعار الأيسر", type: "logo", slot: "header-left", src: "/images/rcs-logo-official.png", width: 70, height: 70, borderRadius: 8 },
    { id: "title", label: "اسم النادي", type: "text", slot: "header-center", content: "النادي الهاوي متعدد الرياضات", fontFamily: "Cairo", fontSize: 16, fontWeight: "bold", color: "#0f766e" },
    { id: "subtitle", label: "الفرع", type: "text", slot: "header-center", content: "الرائد - سعيدة", fontFamily: "Cairo", fontSize: 14, fontWeight: "bold", color: "#f59e0b" },
    { id: "branch", label: "الفرع", type: "text", slot: "header-center", content: "فرع السباحة", fontFamily: "Cairo", fontSize: 12, fontWeight: "normal", color: "#555555" },
    { id: "logo-r", label: "الشعار الأيمن", type: "logo", slot: "header-right", src: "/images/rcs-logo-official.png", width: 70, height: 70, borderRadius: 8 },
  ],
  showDivider: true,
  dividerColor: "#0f766e",
  dividerWidth: 2,
  referenceNumberText: "الرقم: . . ./ن.ر.ه.ر.س",
  dateLocationText: "سعيدة في:",
  showReferenceRow: true,
};

function genId() { return Math.random().toString(36).substring(2, 11); }

// ──────────────── Main Component ────────────────
export function UnifiedHeaderSettings() {
  const [config, setConfig] = useState<EnteteConfig>(DEFAULT_CONFIG);
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

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // حفظ الترويسة
      const enteteRes = await fetch("/api/entete", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (!enteteRes.ok) throw new Error("فشل حفظ الترويسة");
      // حفظ إعدادات النادي
      const settingsRes = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      if (!settingsRes.ok) throw new Error("فشل حفظ إعدادات النادي");
      toast.success("تم حفظ الترويسة الموحدة بنجاح");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("استعادة الإعدادات الافتراضية للترويسة؟")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/entete", { method: "DELETE" });
      const data = await res.json();
      if (data.config) setConfig(data.config);
      toast.success("تمت الاستعادة للإعدادات الافتراضية");
    } catch {
      toast.error("فشلت الاستعادة");
    } finally {
      setSaving(false);
    }
  };

  const addTextElement = (slot: Slot = "header-center") => {
    const newEl: EnteteElement = {
      id: genId(), label: "نص جديد", type: "text", slot,
      content: "نص جديد", fontFamily: "Cairo", fontSize: 12,
      fontWeight: "normal", color: "#111111", italic: false, underline: false,
    };
    setConfig((c) => ({ ...c, elements: [...c.elements, newEl] }));
    setSelectedId(newEl.id);
  };

  const addLogoElement = (slot: Slot = "header-left") => {
    const newEl: EnteteElement = {
      id: genId(), label: "شعار جديد", type: "logo", slot,
      src: "/images/rcs-logo-official.png", width: 70, height: 70, borderRadius: 8,
    };
    setConfig((c) => ({ ...c, elements: [...c.elements, newEl] }));
    setSelectedId(newEl.id);
  };

  const duplicateElement = (el: EnteteElement) => {
    const copy: EnteteElement = { ...el, id: genId(), label: `${el.label} (نسخة)` };
    setConfig((c) => ({ ...c, elements: [...c.elements, copy] }));
    setSelectedId(copy.id);
    toast.success("تم النسخ");
  };

  const deleteElement = (id: string) => {
    setConfig((c) => ({ ...c, elements: c.elements.filter((e) => e.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  };

  const updateElement = (id: string, updates: Partial<EnteteElement>) => {
    setConfig((c) => ({
      ...c,
      elements: c.elements.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }));
  };

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
      updateElement(logoUploadTarget, { src: data });
      toast.success("تم رفع الشعار");
    };
    reader.readAsDataURL(f);
    e.target.value = "";
    setLogoUploadTarget(null);
  };

  const selected = config.elements.find((e) => e.id === selectedId) || null;

  const slotGroups: Record<Slot, EnteteElement[]> = {
    "header-left": config.elements.filter((e) => e.slot === "header-left"),
    "header-center": config.elements.filter((e) => e.slot === "header-center"),
    "header-right": config.elements.filter((e) => e.slot === "header-right"),
    "footer-left": [],
    "footer-center": [],
    "footer-right": [],
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleLogoUpload} className="hidden" />

      {/* ══════ معاينة مباشرة ══════ */}
      <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <h4 className="font-bold text-sm">المعاينة المباشرة</h4>
          </div>
          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
            {config.elements.length} عنصر
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground">كل تغيير ينعكس فوراً على جميع التقارير بعد الحفظ</p>
        {/* تمرير إعدادات النادي للترويسة الموحدة عبر استخدام UnifiedReportHeader مباشرة */}
        <div className="rounded-lg overflow-hidden">
          <UnifiedReportHeader
            reportType="معاينة — قائمة المنخرطين"
            reportSubtitle="نموذج توضيحي للترويسة الموحدة"
            date={new Date()}
          />
        </div>
      </div>

      <Tabs defaultValue="club" className="w-full">
        <TabsList className="w-full flex-wrap h-auto">
          <TabsTrigger value="club" className="text-xs flex-1">🏢 معلومات النادي</TabsTrigger>
          <TabsTrigger value="elements" className="text-xs flex-1">🎯 العناصر</TabsTrigger>
          <TabsTrigger value="report" className="text-xs flex-1">📋 معلومات التقرير</TabsTrigger>
          <TabsTrigger value="format" className="text-xs flex-1">🎨 التنسيق</TabsTrigger>
        </TabsList>

        {/* ══════ معلومات النادي ══════ */}
        <TabsContent value="club" className="space-y-3 mt-3">
          <div className="rounded-xl border border-border/60 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Building className="h-3 w-3" /> معلومات النادي
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">اسم النادي (عربي)</Label>
                <Input value={settings.clubName || ""} onChange={(e) => setSettings({ ...settings, clubName: e.target.value })} className="h-9" placeholder="النادي الهاوي متعدد الرياضات" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">اسم النادي (فرنسي)</Label>
                <Input value={settings.clubNameFr || ""} onChange={(e) => setSettings({ ...settings, clubNameFr: e.target.value })} className="h-9" placeholder="Club Sportif Multidisciplinaire" dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">اسم الفرع</Label>
                <Input value={settings.branchName || ""} onChange={(e) => setSettings({ ...settings, branchName: e.target.value })} className="h-9" placeholder="فرع السباحة" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> الولاية</Label>
                <Input value={settings.wilaya || ""} onChange={(e) => setSettings({ ...settings, wilaya: e.target.value })} className="h-9" placeholder="سعيدة" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">العنوان</Label>
                <Input value={settings.clubAddress || ""} onChange={(e) => setSettings({ ...settings, clubAddress: e.target.value })} className="h-9" placeholder="حي 5 جويلية، سعيدة" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> الهاتف</Label>
                <Input value={settings.clubPhone || ""} onChange={(e) => setSettings({ ...settings, clubPhone: e.target.value })} className="h-9" dir="ltr" placeholder="048.XX.XX.XX" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> البريد الإلكتروني</Label>
                <Input value={settings.clubEmail || ""} onChange={(e) => setSettings({ ...settings, clubEmail: e.target.value })} className="h-9" dir="ltr" placeholder="club@email.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Globe className="h-3 w-3" /> الموقع الإلكتروني (اختياري)</Label>
                <Input value={settings.clubWebsite || ""} onChange={(e) => setSettings({ ...settings, clubWebsite: e.target.value })} className="h-9" dir="ltr" placeholder="www.club.dz" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <Calendar className="h-3 w-3" /> الموسم الرياضي
            </h4>
            <div className="space-y-1.5">
              <Label className="text-xs">الموسم الحالي</Label>
              <Input value={settings.sportSeason || ""} onChange={(e) => setSettings({ ...settings, sportSeason: e.target.value })} className="h-9" placeholder="2025/2026" dir="ltr" />
              <p className="text-[10px] text-muted-foreground">إذا تُرك فارغاً، يُحسب تلقائياً من تاريخ اليوم</p>
            </div>
          </div>
        </TabsContent>

        {/* ══════ العناصر ══════ */}
        <TabsContent value="elements" className="space-y-3 mt-3">
          <div className="rounded-xl border border-border/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Settings2 className="h-3 w-3" /> عناصر الترويسة
              </h4>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addTextElement()}>
                  <Type className="h-3 w-3 ml-1" /> نص
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addLogoElement()}>
                  <ImageIcon className="h-3 w-3 ml-1" /> شعار
                </Button>
              </div>
            </div>

            {/* العناصر حسب الخانة */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(["header-right", "header-center", "header-left"] as Slot[]).map((slot) => (
                <div key={slot} className="rounded-lg border border-border/40 bg-muted/30 p-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">{SLOT_LABELS[slot]}</span>
                    <div className="flex gap-0.5">
                      <button onClick={() => addTextElement(slot)} className="p-0.5 hover:bg-accent rounded" title="إضافة نص">
                        <Type className="h-3 w-3 text-muted-foreground" />
                      </button>
                      <button onClick={() => addLogoElement(slot)} className="p-0.5 hover:bg-accent rounded" title="إضافة شعار">
                        <ImageIcon className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {slotGroups[slot].length === 0 ? (
                      <p className="text-[10px] text-muted-foreground text-center py-2">لا عناصر</p>
                    ) : (
                      slotGroups[slot].map((el) => (
                        <div
                          key={el.id}
                          onClick={() => setSelectedId(el.id)}
                          className={cn(
                            "flex items-center gap-1.5 p-1.5 rounded-md cursor-pointer text-[11px] border transition",
                            selectedId === el.id ? "bg-primary/10 border-primary/40 ring-1 ring-primary/20" : "bg-card border-transparent hover:border-border/60"
                          )}
                        >
                          {el.type === "logo" ? <ImageIcon className="h-3 w-3 shrink-0 text-primary" /> : <Type className="h-3 w-3 shrink-0 text-muted-foreground" />}
                          <span className="flex-1 truncate">{el.label || el.content || "—"}</span>
                          <button onClick={(e) => { e.stopPropagation(); duplicateElement(el); }} className="opacity-50 hover:opacity-100" title="نسخ">
                            <Copy className="h-2.5 w-2.5" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }} className="opacity-50 hover:opacity-100 text-rose-500" title="حذف">
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* خصائص العنصر المحدد */}
            {selected && (
              <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                    {selected.type === "logo" ? "شعار" : "نص"} • {SLOT_LABELS[selected.slot]}
                  </Badge>
                  <Input
                    value={selected.label}
                    onChange={(e) => updateElement(selected.id, { label: e.target.value })}
                    className="h-7 text-xs flex-1"
                    placeholder="تسمية العنصر"
                  />
                </div>

                {selected.type === "logo" ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-12 w-12 rounded-lg bg-card border overflow-hidden flex items-center justify-center shrink-0">
                        <img src={selected.src} alt="" className="w-full h-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.2"; }} />
                      </div>
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setLogoUploadTarget(selected.id); fileInputRef.current?.click(); }}>
                        <Upload className="h-3 w-3 ml-1" /> رفع شعار
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label className="text-[10px]">العرض</Label><Input type="number" value={selected.width || 70} onChange={(e) => updateElement(selected.id, { width: +e.target.value })} className="h-8 text-xs" /></div>
                      <div><Label className="text-[10px]">الارتفاع</Label><Input type="number" value={selected.height || 70} onChange={(e) => updateElement(selected.id, { height: +e.target.value })} className="h-8 text-xs" /></div>
                      <div><Label className="text-[10px]">استدارة</Label><Input type="number" value={selected.borderRadius || 0} onChange={(e) => updateElement(selected.id, { borderRadius: +e.target.value })} className="h-8 text-xs" /></div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <Label className="text-[10px]">المحتوى</Label>
                      <Textarea value={selected.content || ""} onChange={(e) => updateElement(selected.id, { content: e.target.value })} rows={2} className="text-xs" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px]">الخط</Label>
                        <select value={selected.fontFamily} onChange={(e) => updateElement(selected.id, { fontFamily: e.target.value })} className="w-full h-8 text-xs rounded border bg-card px-2">
                          {FONT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label className="text-[10px]">الحجم (pt)</Label>
                        <Input type="number" value={selected.fontSize || 12} onChange={(e) => updateElement(selected.id, { fontSize: +e.target.value })} className="h-8 text-xs" />
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant={selected.fontWeight === "bold" ? "default" : "outline"} className="h-8 flex-1 text-xs" onClick={() => updateElement(selected.id, { fontWeight: selected.fontWeight === "bold" ? "normal" : "bold" })}>
                        <Bold className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant={selected.italic ? "default" : "outline"} className="h-8 flex-1 text-xs" onClick={() => updateElement(selected.id, { italic: !selected.italic })}>
                        <Italic className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant={selected.underline ? "default" : "outline"} className="h-8 flex-1 text-xs" onClick={() => updateElement(selected.id, { underline: !selected.underline })}>
                        <Underline className="h-3 w-3" />
                      </Button>
                    </div>
                    <div>
                      <Label className="text-[10px]">اللون</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {COLOR_PRESETS.map((c) => (
                          <button key={c} onClick={() => updateElement(selected.id, { color: c })} className={cn("h-5 w-5 rounded border-2", selected.color === c ? "border-primary" : "border-border")} style={{ backgroundColor: c }} />
                        ))}
                        <Input type="color" value={selected.color || "#000000"} onChange={(e) => updateElement(selected.id, { color: e.target.value })} className="h-7 w-10 p-0.5" />
                      </div>
                    </div>
                  </div>
                )}

                {/* تغيير الخانة */}
                <div>
                  <Label className="text-[10px]">الخانة</Label>
                  <select value={selected.slot} onChange={(e) => updateElement(selected.id, { slot: e.target.value as Slot })} className="w-full h-8 text-xs rounded border bg-card px-2">
                    {Object.entries(SLOT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ══════ معلومات التقرير ══════ */}
        <TabsContent value="report" className="space-y-3 mt-3">
          <div className="rounded-xl border border-border/60 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3 w-3" /> معلومات التقرير
            </h4>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">نص رقم المرجع</Label>
                <Input value={config.referenceNumberText} onChange={(e) => setConfig({ ...config, referenceNumberText: e.target.value })} className="h-9" placeholder="الرقم: . . ./ن.ر.ه.ر.س" />
                <p className="text-[10px] text-muted-foreground">يظهر هذا النص متبوعاً بسنة في أسفل الترويسة</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">نص التاريخ والمكان</Label>
                <Input value={config.dateLocationText} onChange={(e) => setConfig({ ...config, dateLocationText: e.target.value })} className="h-9" placeholder="سعيدة في:" />
                <p className="text-[10px] text-muted-foreground">يظهر هذا النص متبوعاً بالتاريخ الحالي</p>
              </div>
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2.5">
                  <div>
                    <Label className="text-xs font-semibold">إظهار صف المرجع</Label>
                    <p className="text-[10px] text-muted-foreground">رقم التقرير + التاريخ + الموسم</p>
                  </div>
                  <Switch checked={config.showReferenceRow} onCheckedChange={(c) => setConfig({ ...config, showReferenceRow: c })} />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ══════ التنسيق ══════ */}
        <TabsContent value="format" className="space-y-3 mt-3">
          <div className="rounded-xl border border-border/60 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Settings2 className="h-3 w-3" /> التنسيق
            </h4>
            <div className="space-y-3">
              {/* الفاصل */}
              <div className="rounded-lg bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">إظهار الفاصل</Label>
                  <Switch checked={config.showDivider} onCheckedChange={(c) => setConfig({ ...config, showDivider: c })} />
                </div>
                {config.showDivider && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">لون الفاصل</Label>
                      <div className="flex gap-1">
                        <Input type="color" value={config.dividerColor} onChange={(e) => setConfig({ ...config, dividerColor: e.target.value })} className="h-8 w-10 p-1" />
                        <Input value={config.dividerColor} onChange={(e) => setConfig({ ...config, dividerColor: e.target.value })} className="h-8 text-xs font-mono" dir="ltr" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px]">سماكة الفاصل (px)</Label>
                      <Input type="number" min={1} max={10} value={config.dividerWidth} onChange={(e) => setConfig({ ...config, dividerWidth: +e.target.value })} className="h-8 text-xs" />
                    </div>
                  </div>
                )}
              </div>

              {/* معاينة الفاصل */}
              {config.showDivider && (
                <div className="rounded-lg border p-3">
                  <Label className="text-[10px] mb-2 block">معاينة الفاصل</Label>
                  <hr style={{ borderTop: `${config.dividerWidth}px solid ${config.dividerColor}`, margin: "8px 0" }} />
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ══════ أزرار الحفظ ══════ */}
      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="outline" onClick={handleReset} disabled={saving}>
          <RotateCcw className="h-4 w-4 ml-1" /> استعادة الافتراضي
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 ml-1" />}
          حفظ الترويسة الموحدة
        </Button>
      </div>
    </div>
  );
}

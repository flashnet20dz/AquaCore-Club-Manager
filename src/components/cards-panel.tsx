"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard, Download, Upload, Settings2, Loader2, Layers,
  RotateCw, Check, ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AGE_CATEGORY_INFO,
  getAgeCategory,
  type SubscriberWithComputed,
} from "@/lib/rcs";

interface CardsPanelProps {
  subscribers: SubscriberWithComputed[];
}

interface CardConfig {
  template: "sport" | "elegant" | "minimal";
  primaryColor: string;
  accentColor: string;
  showLogo: boolean;
  showQR: boolean;
  showBloodType: boolean;
  showPhoto: boolean;
  title: string;
  subtitle: string;
  frontShowAge: boolean;
  frontShowGender: boolean;
  frontShowSubscription: boolean;
  backShowPhone: boolean;
  backShowDays: boolean;
  backShowTime: boolean;
  backShowExpiry: boolean;
  backShowBloodType: boolean;
  backCustomText: string;
}

const DEFAULT_CONFIG: CardConfig = {
  template: "sport",
  primaryColor: "#0f766e",
  accentColor: "#f59e0b",
  showLogo: true,
  showQR: true,
  showBloodType: true,
  showPhoto: false,
  title: "نادي RCS للسباحة",
  subtitle: "بطاقة الانخراط",
  frontShowAge: true,
  frontShowGender: true,
  frontShowSubscription: true,
  backShowPhone: true,
  backShowDays: true,
  backShowTime: true,
  backShowExpiry: true,
  backShowBloodType: true,
  backCustomText: "هذه البطاقة شخصية وغير قابلة للتحويل. يرجى إبرازها عند الدخول.",
};

// SUB_SYMBOLS لم تعد ثابتة — نستخدم subscriptionType مباشرة
// إذا كان النوع غير معروف، نعرض الكود كما هو

export function CardsPanel({ subscribers }: CardsPanelProps) {
  const [config, setConfig] = useState<CardConfig>(DEFAULT_CONFIG);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleSelect = (id: string) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  const selectAll = () => setSelectedIds(subscribers.map((s) => s.id));
  const deselectAll = () => setSelectedIds([]);

  const handleGeneratePDF = async () => {
    const targetSubs = subscribers.filter((s) => selectedIds.includes(s.id));
    if (targetSubs.length === 0) { toast.error("اختر منخرطاً واحداً على الأقل"); return; }
    setGenerating(true);
    try {
      const printWindow = window.open("", "_blank");
      if (!printWindow) { toast.error("اسمح بالنوافذ المنبثقة"); return; }
      const fullHtml = generatePrintableHTML(targetSubs, config);
      printWindow.document.write(fullHtml);
      printWindow.document.close();
      printWindow.onload = () => setTimeout(() => printWindow.print(), 800);
      toast.success(`تم إنشاء ${targetSubs.length} بطاقة (RECTO/VERSO)`);
    } catch { toast.error("فشل إنشاء البطاقات"); } finally { setGenerating(false); }
  };

  const handleImportTemplate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => { try { const data = JSON.parse(ev.target?.result as string); setConfig({ ...DEFAULT_CONFIG, ...data }); toast.success("تم استيراد القالب"); } catch { toast.error("ملف غير صالح"); } };
    reader.readAsText(f); e.target.value = "";
  };

  const handleExportTemplate = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `rcs-card-template-${config.template}.json`; a.click();
    URL.revokeObjectURL(url); toast.success("تم تصدير القالب");
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-base">تصميم وتصدير بطاقات الانخراط</h3>
            <Badge variant="secondary">{selectedIds.length} محدد</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="h-4 w-4 ml-1" /> إعدادات التصميم
            </Button>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportTemplate} className="hidden" />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 ml-1" /> استيراد قالب
            </Button>
            <Button onClick={handleGeneratePDF} disabled={generating} size="sm">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 ml-1" />}
              تصدير ({selectedIds.length})
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <Button size="sm" variant="ghost" onClick={selectAll}>تحديد الكل</Button>
          <Button size="sm" variant="ghost" onClick={deselectAll}>إلغاء التحديد</Button>
        </div>

        <div className="rounded-xl bg-teal-500/10 border border-teal-500/20 p-2.5 text-xs text-teal-800 dark:text-teal-200 mb-3">
          <Layers className="h-3.5 w-3.5 inline ml-1" />
          كل بطاقة تتكون من <strong>وجهين</strong> (أمامي + خلفي). يُصدّر 8 بطاقات في ورقة A4 — <strong>الصفحة 1 = الأوجه الأمامية، الصفحة 2 = الأوجه الخلفية</strong> للطباعة RECTO/VERSO.
        </div>

        {/* Card grid preview — auto-fit (1 col mobile, up to 4 cols desktop) */}
        <div className="grid gap-3 max-h-[600px] overflow-y-auto pr-1 -mr-1 scrollbar-thin" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {subscribers.slice(0, 100).map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.5) }} onClick={() => toggleSelect(s.id)} className="cursor-pointer contain-content">
              <CardPreview subscriber={s} config={config} selected={selectedIds.includes(s.id)} />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Settings dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary" /> إعدادات تصميم البطاقة (وجهين)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">القالب</Label>
                <Select value={config.template} onValueChange={(v) => setConfig({ ...config, template: v as CardConfig["template"] })}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sport">🎨 رياضي</SelectItem>
                    <SelectItem value="elegant">✨ أنيق</SelectItem>
                    <SelectItem value="minimal">⚪ بسيط</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">اللون الأساسي</Label>
                <div className="flex items-center gap-2">
                  <Input type="color" value={config.primaryColor} onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })} className="h-10 w-14 p-1" />
                  <Input value={config.primaryColor} onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })} className="h-10 font-mono text-xs" dir="ltr" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">اللون الثانوي</Label>
                <div className="flex items-center gap-2">
                  <Input type="color" value={config.accentColor} onChange={(e) => setConfig({ ...config, accentColor: e.target.value })} className="h-10 w-14 p-1" />
                  <Input value={config.accentColor} onChange={(e) => setConfig({ ...config, accentColor: e.target.value })} className="h-10 font-mono text-xs" dir="ltr" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-sm font-semibold">عنوان البطاقة</Label><Input value={config.title} onChange={(e) => setConfig({ ...config, title: e.target.value })} className="h-10" /></div>
              <div className="space-y-1.5"><Label className="text-sm font-semibold">العنوان الفرعي</Label><Input value={config.subtitle} onChange={(e) => setConfig({ ...config, subtitle: e.target.value })} className="h-10" /></div>
            </div>
            <div className="rounded-xl border-2 border-primary/30 p-3 bg-primary/5">
              <h4 className="text-sm font-bold mb-2 flex items-center gap-1.5"><CreditCard className="h-4 w-4 text-primary" /> الوجه الأمامي</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Toggle label="الشعار" checked={config.showLogo} onChange={(v) => setConfig({ ...config, showLogo: v })} />
                <Toggle label="رمز QR" checked={config.showQR} onChange={(v) => setConfig({ ...config, showQR: v })} />
                <Toggle label="العمر" checked={config.frontShowAge} onChange={(v) => setConfig({ ...config, frontShowAge: v })} />
                <Toggle label="الجنس" checked={config.frontShowGender} onChange={(v) => setConfig({ ...config, frontShowGender: v })} />
                <Toggle label="نوع الاشتراك" checked={config.frontShowSubscription} onChange={(v) => setConfig({ ...config, frontShowSubscription: v })} />
                <Toggle label="فصيلة الدم" checked={config.showBloodType} onChange={(v) => setConfig({ ...config, showBloodType: v })} />
              </div>
            </div>
            <div className="rounded-xl border-2 p-3" style={{ borderColor: `${config.accentColor}40`, background: `${config.accentColor}10` }}>
              <h4 className="text-sm font-bold mb-2 flex items-center gap-1.5"><RotateCw className="h-4 w-4" style={{ color: config.accentColor }} /> الوجه الخلفي</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                <Toggle label="الهاتف" checked={config.backShowPhone} onChange={(v) => setConfig({ ...config, backShowPhone: v })} />
                <Toggle label="أيام السباحة" checked={config.backShowDays} onChange={(v) => setConfig({ ...config, backShowDays: v })} />
                <Toggle label="التوقيت" checked={config.backShowTime} onChange={(v) => setConfig({ ...config, backShowTime: v })} />
                <Toggle label="تاريخ الانتهاء" checked={config.backShowExpiry} onChange={(v) => setConfig({ ...config, backShowExpiry: v })} />
                <Toggle label="فصيلة الدم" checked={config.backShowBloodType} onChange={(v) => setConfig({ ...config, backShowBloodType: v })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">نص مخصص في الخلف</Label>
                <Input value={config.backCustomText} onChange={(e) => setConfig({ ...config, backCustomText: e.target.value })} className="h-9 text-xs" placeholder="نص تذييل البطاقة الخلفية..." />
              </div>
            </div>
            <div className="rounded-xl bg-muted/40 p-2.5 text-xs text-muted-foreground flex items-center gap-2">
              <Layers className="h-4 w-4" />
              يتم تصدير 8 بطاقات في كل صفحة A4 (4 صفوف × 2 أعمدة). كل بطاقة لها وجهان.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleExportTemplate}><Download className="h-4 w-4 ml-1" /> تصدير القالب</Button>
            <Button onClick={() => setSettingsOpen(false)}>تم</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={cn("flex items-center justify-between p-2 rounded-lg border text-xs transition", checked ? "bg-primary/10 border-primary/30 text-primary" : "bg-card border-border")}>
      <span>{label}</span>
      <span className={cn("h-4 w-8 rounded-full transition relative", checked ? "bg-primary" : "bg-muted")}>
        <span className={cn("absolute h-3 w-3 rounded-full bg-white top-0.5 transition-all", checked ? "right-0.5" : "right-4")} />
      </span>
    </button>
  );
}

function CardPreview({ subscriber, config, selected }: { subscriber: SubscriberWithComputed; config: CardConfig; selected: boolean }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div className={cn("relative rounded-xl overflow-hidden border-2 transition", selected ? "border-primary shadow-lg" : "border-border")} style={{ aspectRatio: "1.586" }}>
      <button type="button" onClick={(e) => { e.stopPropagation(); setFlipped(!flipped); }} className="absolute top-1 right-1 z-20 h-6 w-6 rounded-full bg-black/30 backdrop-blur text-white flex items-center justify-center hover:bg-black/50 transition">
        <RotateCw className="h-3 w-3" />
      </button>
      {selected && <div className="absolute top-1 left-1 z-20 h-5 w-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px]"><Check className="h-3 w-3" strokeWidth={3} /></div>}
      <div className="relative w-full h-full" style={{ perspective: "1000px" }}>
        <motion.div animate={{ rotateY: flipped ? 180 : 0 }} transition={{ duration: 0.5 }} style={{ transformStyle: "preserve-3d", position: "relative", width: "100%", height: "100%" }}>
          <div style={{ backfaceVisibility: "hidden", position: "absolute", width: "100%", height: "100%" }} className="bg-white">
            <CardFront subscriber={subscriber} config={config} />
          </div>
          <div style={{ backfaceVisibility: "hidden", position: "absolute", width: "100%", height: "100%", transform: "rotateY(180deg)" }} className="bg-white">
            <CardBack subscriber={subscriber} config={config} />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function CardFront({ subscriber, config }: { subscriber: SubscriberWithComputed; config: CardConfig }) {
  const ageCat = AGE_CATEGORY_INFO[getAgeCategory(subscriber.gender, subscriber.age)];
  return (
    <div className="h-full flex flex-col">
      <div className="px-2 py-1 text-white flex items-center justify-between" style={{ background: `linear-gradient(135deg, ${config.primaryColor}, ${config.accentColor})` }}>
        {config.showLogo && (
          <div className="flex items-center gap-1">
            {/* Solid white background with dark "R" for high contrast (was white "R" on white-ish bg) */}
            <div className="h-4 w-4 rounded bg-white flex items-center justify-center text-[8px] font-bold" style={{ color: config.primaryColor }}>R</div>
            <span className="text-[7px] font-bold">{config.title}</span>
          </div>
        )}
        <span className="text-[7px] opacity-80">{config.subtitle}</span>
      </div>
      <div className="p-2 flex-1 flex gap-2">
        {config.showQR && <div className="shrink-0"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=50x50&data=${encodeURIComponent(subscriber.fileNumber)}&color=${config.primaryColor.replace("#", "")}&bgcolor=ffffff`} alt="QR" className="w-12 h-12" /></div>}
        <div className="flex-1 min-w-0">
          <p className="text-[8px] text-muted-foreground font-mono">{subscriber.fileNumber}</p>
          <p className="text-xs font-bold truncate">{subscriber.lastName} {subscriber.firstName}</p>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {config.frontShowAge && <span className="text-[7px] text-muted-foreground">{subscriber.age} سنة</span>}
            {config.frontShowGender && <span className="text-[7px] text-muted-foreground">• {subscriber.gender}</span>}
          </div>
          {config.frontShowSubscription && <p className="text-[7px] text-muted-foreground mt-0.5">الاشتراك: {subscriber.subscriptionType}</p>}
          {config.showBloodType && subscriber.bloodType && <p className="text-[7px] text-rose-600 mt-0.5">🩸 {subscriber.bloodType}</p>}
          {/* Age category chip — uses the category's hex color for consistent visual identity */}
          <span
            className="inline-block mt-0.5 text-[7px] px-1 py-0.5 rounded font-semibold"
            style={{ backgroundColor: `${ageCat.hexColor}22`, color: ageCat.hexColor }}
          >
            {ageCat.icon} {ageCat.shortLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

function CardBack({ subscriber, config }: { subscriber: SubscriberWithComputed; config: CardConfig }) {
  return (
    <div className="h-full flex flex-col">
      <div className="px-2 py-1 text-white" style={{ background: config.accentColor }}><span className="text-[7px] font-bold">معلومات إضافية</span></div>
      <div className="p-2 flex-1 text-[7px] space-y-0.5">
        {config.backShowPhone && subscriber.phone && <p dir="ltr" className="text-right">📞 {subscriber.phone}</p>}
        {config.backShowDays && subscriber.swimmingDays && <p>🏊 {subscriber.swimmingDays}</p>}
        {config.backShowTime && subscriber.timeSlot && <p dir="ltr" className="text-right">⏰ {subscriber.timeSlot}</p>}
        {config.backShowExpiry && subscriber.expiryDate && <p>📅 تنتهي: {new Date(subscriber.expiryDate).toISOString().split("T")[0].replace(/-/g,"/")}</p>}
        {config.backShowBloodType && subscriber.bloodType && <p className="text-rose-600">🩸 فصيلة الدم: {subscriber.bloodType}</p>}
      </div>
      <div className="px-2 py-1 bg-muted/30 border-t" style={{ borderColor: `${config.primaryColor}30` }}><p className="text-[6px] text-muted-foreground text-center leading-tight">{config.backCustomText}</p></div>
    </div>
  );
}

function generatePrintableHTML(subscribers: SubscriberWithComputed[], config: CardConfig): string {
  const frontsHtml = subscribers.map((s) => `<div class="card-cell">${generateCardFrontHTML(s, config)}</div>`).join("");
  const backsHtml = subscribers.map((s) => `<div class="card-cell">${generateCardBackHTML(s, config)}</div>`).join("");
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>بطاقات الانخراط - نادي RCS (${subscribers.length} بطاقة)</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Cairo','Tajawal',Arial,sans-serif;background:#f5f5f5;}@page{size:A4 portrait;margin:10mm;}.page{width:210mm;min-height:297mm;padding:10mm;background:white;page-break-after:always;position:relative;}.page:last-child{page-break-after:auto;}.page-header{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;margin-bottom:12px;background:linear-gradient(135deg,${config.primaryColor},${config.accentColor});color:white;border-radius:8px;}.page-header h2{font-size:14px;}.grid{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(4,1fr);gap:5mm;height:calc(297mm - 50mm);}.card-cell{width:100%;height:100%;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.15);background:white;display:flex;flex-direction:column;break-inside:avoid;}.card-header{flex-shrink:0;}.footer{position:absolute;bottom:5mm;left:10mm;right:10mm;text-align:center;font-size:9px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:4px;}.legend{margin-bottom:12px;padding:8px 12px;background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;font-size:11px;color:#92400e;}@media print{body{background:white;}.no-print{display:none!important;}.page{margin:0;box-shadow:none;}}@media screen{.page{margin:10mm auto;box-shadow:0 4px 12px rgba(0,0,0,0.1);}}</style></head><body>
<div class="legend no-print" style="margin:10mm;padding:12px;">📄 <strong>تعليمات الطباعة RECTO/VERSO:</strong><br>1. الصفحة الأولى = الأوجه الأمامية (${subscribers.length} بطاقة)<br>2. الصفحة الثانية = الأوجه الخلفية (بنفس الترتيب)<br>3. اختر "الطباعة على الوجهين (Duplex)"<br>4. اختر "قلب على الحافة القصيرة (Flip on short edge)"</div>
<div class="page"><div class="page-header"><div><h2>نادي RCS للسباحة — الوجه الأمامي (RECTO)</h2><p>${subscribers.length} بطاقة</p></div><p>${new Date().toISOString().split("T")[0].replace(/-/g,"/")}</p></div><div class="grid">${frontsHtml}</div><div class="footer no-print">نادي RCS للسباحة — جميع الحقوق محفوظة ${new Date().getFullYear()}</div></div>
<div class="page"><div class="page-header" style="background:${config.accentColor};"><div><h2>نادي RCS للسباحة — الوجه الخلفي (VERSO)</h2><p>${subscribers.length} بطاقة</p></div><p>${new Date().toISOString().split("T")[0].replace(/-/g,"/")}</p></div><div class="grid">${backsHtml}</div><div class="footer no-print">نادي RCS للسباحة — جميع الحقوق محفوظة ${new Date().getFullYear()}</div></div>
</body></html>`;
}

function generateCardFrontHTML(s: SubscriberWithComputed, config: CardConfig): string {
  const ageCat = AGE_CATEGORY_INFO[getAgeCategory(s.gender, s.age)];
  return `<div class="card-header" style="background:linear-gradient(135deg,${config.primaryColor},${config.accentColor});color:white;padding:6px 10px;display:flex;justify-content:space-between;align-items:center;">${config.showLogo ? `<div style="display:flex;align-items:center;gap:4px;"><div style="width:18px;height:18px;border-radius:4px;background:#ffffff;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:10px;color:${config.primaryColor};">R</div><span style="font-size:10px;font-weight:bold;">${escapeHtml(config.title)}</span></div>` : ""}<span style="font-size:8px;opacity:0.85;">${escapeHtml(config.subtitle)}</span></div>
<div style="padding:8px 10px;display:flex;gap:8px;min-height:60px;">${config.showQR ? `<div style="flex-shrink:0;"><img src="https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(s.fileNumber)}&color=${config.primaryColor.replace("#", "")}&bgcolor=ffffff" width="60" height="60" style="display:block;" /></div>` : ""}<div style="flex:1;min-width:0;"><div style="font-size:8px;color:#6b7280;font-family:monospace;">${s.fileNumber}</div><div style="font-size:13px;font-weight:bold;margin:2px 0;color:#111;">${escapeHtml(s.lastName)} ${escapeHtml(s.firstName)}</div><div style="font-size:9px;color:#6b7280;display:flex;gap:6px;flex-wrap:wrap;">${config.frontShowAge ? `<span>العمر: ${s.age} سنة</span>` : ""}${config.frontShowGender ? `<span>• ${s.gender}</span>` : ""}</div>${config.frontShowSubscription ? `<div style="font-size:9px;color:#6b7280;margin-top:2px;">الاشتراك: ${s.subscriptionType}</div>` : ""}${config.showBloodType && s.bloodType ? `<div style="font-size:9px;color:#e11d48;margin-top:2px;">🩸 فصيلة الدم: ${s.bloodType}</div>` : ""}<div style="display:inline-block;font-size:9px;padding:1px 5px;border-radius:3px;font-weight:600;margin-top:3px;background:${ageCat.hexColor}22;color:${ageCat.hexColor};">${ageCat.icon} ${ageCat.shortLabel}</div></div></div>`;
}

function generateCardBackHTML(s: SubscriberWithComputed, config: CardConfig): string {
  const expiry = s.expiryDate ? new Date(s.expiryDate).toISOString().split("T")[0].replace(/-/g,"/") : "—";
  return `<div class="card-header" style="background:${config.accentColor};color:white;padding:6px 10px;"><span style="font-size:10px;font-weight:bold;">معلومات إضافية</span></div>
<div style="padding:8px 10px;font-size:9px;min-height:60px;">${config.backShowPhone && s.phone ? `<div style="direction:ltr;text-align:right;margin-bottom:3px;">📞 ${escapeHtml(s.phone)}</div>` : ""}${config.backShowDays && s.swimmingDays ? `<div style="margin-bottom:3px;">🏊 ${escapeHtml(s.swimmingDays)}</div>` : ""}${config.backShowTime && s.timeSlot ? `<div style="direction:ltr;text-align:right;margin-bottom:3px;">⏰ ${escapeHtml(s.timeSlot)}</div>` : ""}${config.backShowExpiry ? `<div style="margin-bottom:3px;">📅 تاريخ الانتهاء: ${expiry}</div>` : ""}${config.backShowBloodType && s.bloodType ? `<div style="color:#e11d48;margin-bottom:3px;">🩸 فصيلة الدم: ${s.bloodType}</div>` : ""}</div>
<div style="padding:4px 10px;background:#f8fafc;border-top:1px solid ${config.primaryColor}30;"><p style="font-size:7px;color:#6b7280;text-align:center;line-height:1.3;margin:0;">${escapeHtml(config.backCustomText)}</p></div>`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

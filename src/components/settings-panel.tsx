"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Settings as SettingsIcon, Save, Loader2, Building, Phone, MessageSquare,
  DollarSign, Clock, Users, Plus, Trash2, Type, Calendar, Timer,
  LayoutTemplate, Sparkles, Pencil, FileText, Monitor,
  RefreshCw, Key, Copy, Eye, EyeOff, SlidersHorizontal, Wifi, Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { UnifiedHeaderSettings } from "@/components/unified-header-settings";
import { DesktopSettings } from "@/components/desktop-settings";
import { ThemeSettingsPanel } from "@/components/theme-settings-panel";
import { useSubscriptionTypes, invalidateSubscriptionTypesCache } from "@/hooks/use-subscription-types";
import { invalidateSwimConfig } from "@/hooks/use-swim-config";
import { FeatureSettingsHub } from "@/components/feature-settings-hub";
import { PageNavigationManager } from "@/components/page-navigation-manager";
import { SwimmingScheduleHub } from "@/components/swimming-schedule-hub";
import { LocalNetworkCard } from "@/components/local-network-card";
import { AdvancedBackupManager } from "@/components/advanced-backup-manager";

export function SettingsPanel({ initialTab }: { initialTab?: string | null }) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [activeSubTab, setActiveSubTab] = useState(initialTab || "navigation");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newSubType, setNewSubType] = useState("");
  const [newSwimDay, setNewSwimDay] = useState("");
  const [newTimeSlot, setNewTimeSlot] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setSettings(d.settings || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ★ القفز العميق: قائمة إعداد النادي تنقر بنداً → يُفتح التبويب المطلوب مباشرة
  useEffect(() => {
    if (initialTab) setActiveSubTab(initialTab);
  }, [initialTab]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      if (!res.ok) throw new Error();
      toast.success("تم حفظ الإعدادات");
    } catch {
      toast.error("فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  // Helper: parse JSON array from settings string
  const parseArr = (key: string, fallback: string[]): string[] => {
    try {
      const v = settings[key];
      if (!v) return fallback;
      return JSON.parse(v);
    } catch { return fallback; }
  };

  const updateArr = (key: string, arr: string[]) => {
    setSettings({ ...settings, [key]: JSON.stringify(arr) });
  };

  // أنواع الاشتراك الآن تُدار بالكامل من SubscriptionTypesManager (DB)
  // لا نحتاج customSubTypes من Settings القديمة
  const swimDays = parseArr("customSwimDays", ["الأحد والأربعاء", "الاثنين والخميس", "الثلاثاء والجمعة", "كل الأيام"]);
  const timeSlots = parseArr("customTimeSlots", ["09:00-10:00", "10:00-11:00", "19:00-20:00", "20:00-21:00"]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const SETTINGS_SECTIONS = [
    { id: "navigation", label: "إدارة وترتيب وتسمية الصفحات", icon: SlidersHorizontal, desc: "تسمية الواجهات، ترتيب القوائم، وتخصيص عناوين التصدير", badge: "جديد", color: "text-emerald-500 bg-emerald-500/10" },
    { id: "appearance", label: "المظهر والهوية البصرية", icon: Sparkles, desc: "السمة، الألوان، الشعار والخطوط", color: "text-purple-500 bg-purple-500/10" },
    { id: "general", label: "معلومات النادي والعملة", icon: Building, desc: "اسم النادي، الهاتف، العنوان والعملة", color: "text-blue-500 bg-blue-500/10" },
    { id: "subscribers", label: "المنخرطون والأنواع", icon: Users, desc: "أنواع الاشتراكات، أيام وحصص السباحة", color: "text-teal-500 bg-teal-500/10" },
    { id: "entete", label: "الترويسة الموحدة (En-tête)", icon: FileText, desc: "ترويسة التقارير والمستندات الرسمية", color: "text-indigo-500 bg-indigo-500/10" },
    { id: "workhours", label: "ساعات العمل والتسعير", icon: Clock, desc: "تسعير ساعات العمل ومستحقات العمال", color: "text-amber-500 bg-amber-500/10" },
    { id: "whatsapp", label: "إشعارات WhatsApp", icon: MessageSquare, desc: "قوالب التنبيه والتجديد التلقائي", color: "text-green-500 bg-green-500/10" },
    { id: "texts", label: "النصوص المخصصة", icon: Type, desc: "نصوص الواجهة، الترويسة والتذييل", color: "text-rose-500 bg-rose-500/10" },
    { id: "features", label: "إدارة الميزات والوحدات", icon: LayoutTemplate, desc: "تفعيل وتعطيل وحدات المنظومة", color: "text-sky-500 bg-sky-500/10" },
    { id: "wifi", label: "الشبكة والواي فاي المحلي", icon: Wifi, desc: "ربط الهواتف بدون إنترنت ورمز QR", badge: "مهم", color: "text-emerald-500 bg-emerald-500/10" },
    { id: "backup", label: "النسخ الاحتياطي والأمان", icon: Database, desc: "النسخ اليدوي والجدولة التلقائية", color: "text-indigo-500 bg-indigo-500/10" },
    { id: "desktop", label: "سطح المكتب والمزامنة", icon: Monitor, desc: "إعدادات Electron ومفاتيح المزامنة", color: "text-cyan-500 bg-cyan-500/10" },
  ];

  const currentSection = SETTINGS_SECTIONS.find((s) => s.id === activeSubTab) || SETTINGS_SECTIONS[0];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Command Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-l from-primary/10 via-card to-card p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shadow-inner shrink-0">
              <SettingsIcon className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-xl font-black text-foreground truncate">مركز التحكم والإعدادات الشاملة</h2>
                <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                  {SETTINGS_SECTIONS.length} أقسام
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                تخصيص كامل للهوية، الصفحات، أسعار الاشتراكات، ساعات العمل ونظام التقارير
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto gap-2 shadow-md shadow-primary/20 rounded-xl px-5 h-11 font-bold"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ جميع الإعدادات
            </Button>
          </div>
        </div>
      </div>

      {/* Main Settings 2-Column Grid */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        {/* Mobile quick horizontal selector */}
        <div className="block lg:hidden mb-4 overflow-x-auto pb-2 scrollbar-none">
          <div className="flex gap-2 min-w-max">
            {SETTINGS_SECTIONS.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSubTab === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveSubTab(sec.id)}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{sec.label}</span>
                  {sec.badge && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500 text-white">
                      {sec.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Desktop Left Sidebar Navigation (RTL: right side) */}
          <div className="hidden lg:block lg:col-span-4 xl:col-span-3 space-y-2 sticky top-4">
            <div className="p-2 rounded-2xl border border-border/70 bg-card shadow-sm space-y-1.5">
              <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                أقسام الإعدادات
              </div>
              {SETTINGS_SECTIONS.map((sec) => {
                const Icon = sec.icon;
                const isActive = activeSubTab === sec.id;
                return (
                  <button
                    key={sec.id}
                    onClick={() => setActiveSubTab(sec.id)}
                    className={cn(
                      "w-full text-right flex items-center justify-between gap-3 p-3 rounded-xl text-xs font-bold transition-all group",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.01]"
                        : "hover:bg-muted/70 text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "h-8 w-8 rounded-lg flex items-center justify-center transition-colors shrink-0",
                          isActive
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : sec.color
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 text-right">
                        <div className="truncate font-bold leading-tight">{sec.label}</div>
                        <div
                          className={cn(
                            "text-[10px] truncate mt-0.5 font-normal",
                            isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                          )}
                        >
                          {sec.desc}
                        </div>
                      </div>
                    </div>
                    {sec.badge && (
                      <span
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0",
                          isActive
                            ? "bg-primary-foreground text-primary"
                            : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        {sec.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Main Content Pane (RTL: left side) */}
          <div className="lg:col-span-8 xl:col-span-9">
            <div className="rounded-3xl border border-border/70 bg-card p-5 sm:p-7 shadow-sm">
              {/* Section Header */}
              <div className="flex items-center justify-between pb-5 mb-6 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", currentSection.color)}>
                    {(() => {
                      const Icon = currentSection.icon;
                      return <Icon className="h-5 w-5" />;
                    })()}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                      {currentSection.label}
                      {currentSection.badge && (
                        <Badge className="bg-emerald-500 text-white text-[10px] py-0 px-2">
                          {currentSection.badge}
                        </Badge>
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground">{currentSection.desc}</p>
                  </div>
                </div>
              </div>

              {/* ════════════ 0. إدارة وترتيب الصفحات (جديد) ════════════ */}
              <TabsContent value="navigation" className="m-0 focus-visible:outline-none">
                <PageNavigationManager />
              </TabsContent>

              {/* ════════════ 1. المظهر والشعار (ThemeSettingsPanel) ════════════ */}
              <TabsContent value="appearance" className="m-0 focus-visible:outline-none">
                <ThemeSettingsPanel />
              </TabsContent>

              {/* ════════════ 2. العامة ════════════ */}
              <TabsContent value="general" className="m-0 space-y-4 focus-visible:outline-none">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <Building className="h-4 w-4 text-primary" /> اسم النادي
                    </Label>
                    <Input
                      value={settings.clubName || ""}
                      onChange={(e) => setSettings({ ...settings, clubName: e.target.value })}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold">العنوان والمقر</Label>
                    <Input
                      value={settings.clubAddress || ""}
                      onChange={(e) => setSettings({ ...settings, clubAddress: e.target.value })}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <Phone className="h-4 w-4 text-primary" /> هاتف النادي
                    </Label>
                    <Input
                      value={settings.clubPhone || ""}
                      onChange={(e) => setSettings({ ...settings, clubPhone: e.target.value })}
                      className="h-11 rounded-xl"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4 text-primary" /> العملة المعتمدة
                    </Label>
                    <Input
                      value={settings.currency || "دج"}
                      onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                      className="h-11 rounded-xl"
                      placeholder="دج"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* ════════════ 3. المنخرطون ════════════ */}
              <TabsContent value="subscribers" className="m-0 space-y-6 focus-visible:outline-none">
                <SubscriptionTypesManager />
                <SwimmingScheduleHub />
                <SwimmingTimeSlotsManager />
              </TabsContent>

              {/* ════════════ 4. الترويسة الموحدة (EN-TÊTE) ════════════ */}
              <TabsContent value="entete" className="m-0 space-y-4 focus-visible:outline-none">
                <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-4">
                  <h4 className="font-bold text-sm flex items-center gap-2 mb-1 text-primary">
                    <FileText className="h-4 w-4" /> الترويسة الموحدة (EN-TÊTE) للمستندات والتقارير
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    تُستخدم تلقائياً في جميع التقارير والمطبوعات — قائمة المنخرطين، التأمين، حقوق المركب، التجديدات، الحضور، التقرير المالي وغيرها.
                    أي تعديل هنا ينعكس فوراً على كل التقارير دون الحاجة لتعديل كل تقرير على حدة.
                  </p>
                </div>
                <UnifiedHeaderSettings />
              </TabsContent>

              {/* ════════════ 5. ساعات العمل ════════════ */}
              <TabsContent value="workhours" className="m-0 space-y-4 focus-visible:outline-none">
                <div className="rounded-2xl border-2 border-amber-500/20 bg-amber-500/5 p-5 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <Clock className="h-4 w-4" /> تسعير ساعات العمل ومستحقات العمال
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    يستخدم هذا السعر لحساب مستحقات العمال والمدربين تلقائياً في تبويب الأعباء والتسديدات.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold">سعر الساعة (دج)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={settings.workHourRate || "200"}
                        onChange={(e) => setSettings({ ...settings, workHourRate: e.target.value })}
                        className="h-11 rounded-xl"
                        placeholder="200"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold">عملة السعر</Label>
                      <Input
                        value={settings.workHourCurrency || "دج"}
                        onChange={(e) => setSettings({ ...settings, workHourCurrency: e.target.value })}
                        className="h-11 rounded-xl"
                        placeholder="دج"
                      />
                    </div>
                  </div>
                  <div className="rounded-xl bg-card p-3 text-xs text-muted-foreground border border-border/50">
                    <strong className="text-foreground">مثال توضيحي:</strong> إذا كان السعر 200 دج/ساعة وعامل سجل 10 ساعات ← مستحقاته = 2,000 دج
                  </div>
                </div>
              </TabsContent>

              {/* ════════════ 6. WhatsApp ════════════ */}
              <TabsContent value="whatsapp" className="m-0 space-y-4 focus-visible:outline-none">
                <div className="flex items-center justify-between rounded-2xl bg-muted/40 border border-border/60 p-4">
                  <div>
                    <p className="text-sm font-bold text-foreground">تفعيل إشعارات WhatsApp</p>
                    <p className="text-xs text-muted-foreground mt-0.5">السماح بإرسال تذكيرات التجديد والتنبيهات المباشرة</p>
                  </div>
                  <Switch
                    checked={settings.whatsappEnabled === "true"}
                    onCheckedChange={(c) => setSettings({ ...settings, whatsappEnabled: c ? "true" : "false" })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">قالب رسالة التذكير بالتجديد</Label>
                  <Textarea
                    value={settings.whatsappTemplate || ""}
                    onChange={(e) => setSettings({ ...settings, whatsappTemplate: e.target.value })}
                    rows={4}
                    className="rounded-xl font-mono text-sm leading-relaxed"
                    placeholder="مرحباً {name}، اشتراكك ينتهي في {date}..."
                  />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>المتغيرات المدعومة:</span>
                    <Badge variant="secondary" className="font-mono text-[10px]">{`{name}`}</Badge>
                    <Badge variant="secondary" className="font-mono text-[10px]">{`{date}`}</Badge>
                  </div>
                </div>
              </TabsContent>

              {/* ════════════ 7. النصوص ════════════ */}
              <TabsContent value="texts" className="m-0 space-y-4 focus-visible:outline-none">
                <div className="rounded-2xl border border-border/60 p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <LayoutTemplate className="h-3.5 w-3.5 text-primary" /> نص أعلى الموقع (الترويسة)
                  </h4>
                  <p className="text-xs text-muted-foreground">الشعار والألوان تُدار من تبويب «المظهر والهوية البصرية».</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      value={settings.headerTitle || ""}
                      onChange={(e) => setSettings({ ...settings, headerTitle: e.target.value })}
                      className="h-11 rounded-xl"
                      placeholder="العنوان الرئيسي (مثال: نادي AquaCore)"
                    />
                    <Input
                      value={settings.headerSubtitle || ""}
                      onChange={(e) => setSettings({ ...settings, headerSubtitle: e.target.value })}
                      className="h-11 rounded-xl"
                      placeholder="العنوان الفرعي (مثال: منظومة إدارة الاشتراكات)"
                    />
                  </div>
                </div>
                <div className="rounded-2xl border border-border/60 p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <LayoutTemplate className="h-3.5 w-3.5 text-primary" /> نص أسفل الموقع (التذييل)
                  </h4>
                  <div className="space-y-3">
                    <Input
                      value={settings.footerText || ""}
                      onChange={(e) => setSettings({ ...settings, footerText: e.target.value })}
                      className="h-11 rounded-xl"
                      placeholder="نص حقوق المنظومة في الأسفل"
                    />
                    <Input
                      value={settings.footerNote || ""}
                      onChange={(e) => setSettings({ ...settings, footerNote: e.target.value })}
                      className="h-11 rounded-xl"
                      placeholder="ملاحظة الحسابات الإجمالية"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* ════════════ 8. الميزات (كل ميزة بإعداداتها المتزامنة) ════════════ */}
              <TabsContent value="features" className="m-0 focus-visible:outline-none">
                <FeatureSettingsHub />
              </TabsContent>

              {/* ════════════ 9. سطح المكتب (Desktop) ════════════ */}
              <TabsContent value="desktop" className="m-0 space-y-4 focus-visible:outline-none">
                <div className="rounded-2xl border border-border/60 bg-card p-4">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-primary" /> إعدادات تطبيق سطح المكتب
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    إعدادات خاصة بنسخة Desktop (Electron) — مسار الملفات، النسخ الاحتياطي، الطباعة، الإشعارات، والتشغيل التلقائي.
                  </p>
                </div>
                <SyncKeyGenerator />
                <DesktopSettings />
              </TabsContent>

              {/* ════════════ 10. الشبكة والواي فاي المحلي ════════════ */}
              <TabsContent value="wifi" className="m-0 focus-visible:outline-none">
                <LocalNetworkCard />
              </TabsContent>

              {/* ════════════ 11. النسخ الاحتياطي والأمان ════════════ */}
              <TabsContent value="backup" className="m-0 focus-visible:outline-none">
                <AdvancedBackupManager />
              </TabsContent>

              {/* Bottom Sticky-like Save Bar */}
              <div className="flex items-center justify-between gap-3 pt-6 mt-8 border-t border-border/60">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span>يتم تطبيق التغييرات فور الحفظ</span>
                </div>
                <Button onClick={handleSave} disabled={saving} className="gap-2 rounded-xl px-6 h-10 font-bold">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  حفظ التغييرات
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  );
}

// ════════════ Subscription Types Manager (Dynamic v2.0) ════════════
interface SubType {
  id: string; name: string; code: string; color: string; description?: string;
  insuranceFee: number; compoundRights: number;
  durationDays: number;
  givesMembershipNumber: boolean;
  requiresInsurance: boolean;
  requiresCompoundFee: boolean;
  renewableMonthly: boolean;
  freeSubscription: boolean;
  numberingGroup: string;
  active: boolean; sortOrder: number;
}

function SubscriptionTypesManager() {
  const { types, loading, refresh } = useSubscriptionTypes();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SubType | null>(null);
  const [form, setForm] = useState<any>({
    name: "", code: "", color: "#0d9488", description: "",
    givesMembershipNumber: true, requiresInsurance: true, requiresCompoundFee: true,
    renewableMonthly: true, freeSubscription: false, numberingGroup: "RCS", active: true, sortOrder: 0,
  });

  useEffect(() => { refresh(); }, [refresh]);

  const handleSave = async () => {
    if (!form.name || !form.code) { toast.error("الاسم والرمز مطلوبان"); return; }
    // إذا كان النوع مجاني — اضبط كل الرسوم على 0
    const finalForm = { ...form };
    if (finalForm.freeSubscription) {
      finalForm.subscriptionFee = 0;
      finalForm.insuranceFee = 0;
      finalForm.compoundRights = 0;
      finalForm.requiresInsurance = false;
      finalForm.requiresCompoundFee = false;
      finalForm.givesMembershipNumber = finalForm.givesMembershipNumber; // يحتفظ بإعداد المستخدم
    }
    try {
      const url = editing ? `/api/subscription-types/${editing.id}` : "/api/subscription-types";
      const method = editing ? "PATCH" : "POST";
      const res = await globalThis.fetch(url, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(finalForm),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "فشل الحفظ");
      }
      toast.success(editing ? "تم التحديث" : "تمت الإضافة");
      setDialogOpen(false);
      // إعادة جلب الأنواع لتحديث كل الصفحات
      invalidateSubscriptionTypesCache();
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحفظ");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("حذف هذا النوع؟")) return;
    await globalThis.fetch(`/api/subscription-types/${id}`, { method: "DELETE" });
    toast.success("تم الحذف");
    invalidateSubscriptionTypesCache();
    refresh();
  };

  const openAdd = () => {
    setEditing(null);
    setForm({
      name: "", code: "", color: "#0d9488", description: "",
      givesMembershipNumber: true, requiresInsurance: true, requiresCompoundFee: true,
      renewableMonthly: true, freeSubscription: false, active: true, sortOrder: types.length,
    });
    setDialogOpen(true);
  };

  const openEdit = (t: SubType) => {
    setEditing(t);
    setForm(t);
    setDialogOpen(true);
  };

  return (
    <div className="rounded-xl border border-border/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Type className="h-4 w-4 text-primary" />
          <h4 className="font-bold text-sm">أنواع الاشتراك (ديناميكي)</h4>
          <Badge variant="secondary" className="text-[10px]">{types.length}</Badge>
        </div>
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 ml-1" /> إضافة</Button>
      </div>
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-right border-b">
              <th className="p-1.5">الاسم</th><th className="p-1.5">الرمز</th><th className="p-1.5">اللون</th>
              <th className="p-1.5">الاشتراك</th><th className="p-1.5">التأمين</th><th className="p-1.5">المركب</th>
              <th className="p-1.5">الترقيم</th><th className="p-1.5">رقم ملف</th><th className="p-1.5">تجديد</th><th className="p-1.5">مجاني</th>
              <th className="p-1.5">فعال</th><th className="p-1.5"></th>
            </tr></thead>
            <tbody>
              {types.map(t => (
                <tr key={t.id} className="border-b hover:bg-accent/30">
                  <td className="p-1.5 font-semibold">{t.name}</td>
                  <td className="p-1.5 font-mono">{t.code}</td>
                  <td className="p-1.5"><div className="h-4 w-4 rounded" style={{ backgroundColor: t.color }} /></td>
                  <td className="p-1.5 tabular-nums">{t.subscriptionFee}</td>
                  <td className="p-1.5 tabular-nums">{t.insuranceFee}</td>
                  <td className="p-1.5 tabular-nums">{t.compoundRights}</td>
                  <td className="p-1.5 font-mono font-bold text-primary">{t.numberingGroup || "RCS"}</td>
                  <td className="p-1.5">{t.givesMembershipNumber ? "✅" : "❌"}</td>
                  <td className="p-1.5">{t.renewableMonthly ? "✅" : "❌"}</td>
                  <td className="p-1.5">{t.freeSubscription ? "✅" : "❌"}</td>
                  <td className="p-1.5">{t.active ? "✅" : "❌"}</td>
                  <td className="p-1.5">
                    <div className="flex gap-0.5">
                      <button onClick={() => openEdit(t)} className="p-1 hover:bg-accent rounded text-primary"><Pencil className="h-3 w-3" /></button>
                      <button onClick={() => handleDelete(t.id)} className="p-1 hover:bg-rose-500/10 rounded text-rose-500"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "تعديل نوع اشتراك" : "إضافة نوع اشتراك جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {/* معلومات عامة */}
            <div className="rounded-lg bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-bold text-muted-foreground">معلومات عامة</p>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">الاسم *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-9" placeholder="عادي / VIP / معفى" /></div>
                <div><Label className="text-xs">الرمز *</Label><Input value={form.code} onChange={e => setForm({...form, code: e.target.value})} className="h-9 font-mono" placeholder="/" dir="ltr" /></div>
                <div><Label className="text-xs">اللون</Label><div className="flex gap-2"><Input type="color" value={form.color} onChange={e => setForm({...form, color: e.target.value})} className="h-9 w-12 p-1" /><Input value={form.color} onChange={e => setForm({...form, color: e.target.value})} className="h-9 font-mono text-xs" dir="ltr" /></div></div>
                <div><Label className="text-xs">ترتيب</Label><Input type="number" value={form.sortOrder} onChange={e => setForm({...form, sortOrder: +e.target.value})} className="h-9" /></div>
                <div><Label className="text-xs">مجموعة الترقيم</Label><Input value={form.numberingGroup || "RCS"} onChange={e => setForm({...form, numberingGroup: e.target.value.toUpperCase()})} className="h-9 font-mono" placeholder="RCS / M / X" dir="ltr" /></div>
                <div className="col-span-2"><Label className="text-xs">الوصف</Label><Input value={form.description || ""} onChange={e => setForm({...form, description: e.target.value})} className="h-9" placeholder="وصف مختصر للنوع" /></div>
              </div>
            </div>

            {/* الرسوم */}
            <div className="rounded-lg bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-bold text-muted-foreground">الرسوم (دج) — تُحسب تلقائياً +200 للبالغين (≥14 سنة)</p>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">رسم الاشتراك (أقل من 14 سنة)</Label><Input type="number" value={form.subscriptionFee} onChange={e => setForm({...form, subscriptionFee: +e.target.value})} className="h-9" disabled={form.freeSubscription} /></div>
                <div><Label className="text-xs">مبلغ التأمين</Label><Input type="number" value={form.insuranceFee} onChange={e => setForm({...form, insuranceFee: +e.target.value})} className="h-9" disabled={form.freeSubscription} /></div>
                <div><Label className="text-xs">حقوق المركب</Label><Input type="number" value={form.compoundRights} onChange={e => setForm({...form, compoundRights: +e.target.value})} className="h-9" disabled={form.freeSubscription} /></div>
                <div><Label className="text-xs">المدة (أيام)</Label><Input type="number" value={form.durationDays} onChange={e => setForm({...form, durationDays: +e.target.value})} className="h-9" /></div>
              </div>
            </div>

            {/* الخيارات */}
            <div className="rounded-lg bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-bold text-muted-foreground">الخيارات</p>
              <div className="space-y-1.5">
                <label className="flex items-center justify-between p-2 rounded bg-card border cursor-pointer">
                  <div><span className="text-xs font-semibold">🏷️ يمنح رقم عضوية (رقم ملف)</span><p className="text-[10px] text-muted-foreground">إذا تم إلغاؤه، لا يتم إنشاء رقم ملف لهذا النوع</p></div>
                  <Switch checked={form.givesMembershipNumber} onCheckedChange={c => setForm({...form, givesMembershipNumber: c})} />
                </label>
                <label className="flex items-center justify-between p-2 rounded bg-card border cursor-pointer">
                  <div><span className="text-xs font-semibold">🛡️ يخضع للتأمين</span><p className="text-[10px] text-muted-foreground">يحدد ما إذا كان المنخرط يحتاج لتأمين</p></div>
                  <Switch checked={form.requiresInsurance} onCheckedChange={c => setForm({...form, requiresInsurance: c})} disabled={form.freeSubscription} />
                </label>
                <label className="flex items-center justify-between p-2 rounded bg-card border cursor-pointer">
                  <div><span className="text-xs font-semibold">🏊 يخضع لحقوق المركب</span><p className="text-[10px] text-muted-foreground">يحدد ما إذا كان المنخرط يدفع حقوق المركب</p></div>
                  <Switch checked={form.requiresCompoundFee} onCheckedChange={c => setForm({...form, requiresCompoundFee: c})} disabled={form.freeSubscription} />
                </label>
                <label className="flex items-center justify-between p-2 rounded bg-card border cursor-pointer">
                  <div><span className="text-xs font-semibold">🔄 قابل للتجديد الشهري</span><p className="text-[10px] text-muted-foreground">إذا تم إلغاؤه، يُخفى زر التجديد لهذا النوع</p></div>
                  <Switch checked={form.renewableMonthly} onCheckedChange={c => setForm({...form, renewableMonthly: c})} />
                </label>
                <label className="flex items-center justify-between p-2 rounded bg-card border cursor-pointer">
                  <div><span className="text-xs font-semibold">🆓 نوع مجاني (كل الرسوم = 0)</span><p className="text-[10px] text-muted-foreground">مثل MJ — لا رقم ملف، لا رسوم، لا تأمين</p></div>
                  <Switch checked={form.freeSubscription} onCheckedChange={c => setForm({...form, freeSubscription: c, subscriptionFee: 0, insuranceFee: 0, compoundRights: 0, requiresInsurance: false, requiresCompoundFee: false})} />
                </label>
                <label className="flex items-center justify-between p-2 rounded bg-card border cursor-pointer">
                  <div><span className="text-xs font-semibold">✅ نشط</span><p className="text-[10px] text-muted-foreground">الأنواع غير النشطة لا تظهر في القوائم</p></div>
                  <Switch checked={form.active} onCheckedChange={c => setForm({...form, active: c})} />
                </label>
              </div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button><Button onClick={handleSave}>{editing ? "حفظ" : "إضافة"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ════════════ Swimming Days Manager (مستبدل بالمركز الموحد SwimmingScheduleHub) ════════════
const SwimmingDaysManager = SwimmingScheduleHub;


// ════════════ Swimming Time Slots Manager ════════════
interface SwimSlot { id: string; name: string; startTime: string; endTime: string; maxCapacity: number; active: boolean; sortOrder: number; }

function SwimmingTimeSlotsManager() {
  const [slots, setSlots] = useState<SwimSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SwimSlot | null>(null);
  const [form, setForm] = useState({ name: "", startTime: "09:00", endTime: "10:00", maxCapacity: 30, active: true, sortOrder: 0 });

  const fetchSlots = useCallback(() => {
    setLoading(true);
    globalThis.fetch("/api/swimming-slots").then(r => r.json()).then(d => setSlots(d.slots || [])).finally(() => setLoading(false));
  }, []);

  // الجلب الأولي — كل setState داخل callbacks
  useEffect(() => {
    let cancelled = false;
    globalThis.fetch("/api/swimming-slots")
      .then(r => r.json())
      .then(d => { if (!cancelled) setSlots(d.slots || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    if (!form.name) { toast.error("الاسم مطلوب"); return; }
    const url = editing ? `/api/swimming-slots/${editing.id}` : "/api/swimming-slots";
    const method = editing ? "PATCH" : "POST";
    await globalThis.fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    toast.success(editing ? "تم التحديث" : "تمت الإضافة");
    setDialogOpen(false); invalidateSwimConfig(); fetchSlots();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("تعطيل هذا التوقيت؟ سيُخفى من النماذج والقوائم لكن السجل يبقى محفوظاً مع تاريخ سجلات ساعات العمل.")) return;
    await globalThis.fetch(`/api/swimming-slots/${id}`, { method: "DELETE" });
    toast.success("تم تعطيل التوقيت — السجل محفوظ"); invalidateSwimConfig(); fetchSlots();
  };

  return (
    <div className="rounded-xl border border-border/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Timer className="h-4 w-4 text-primary" /><h4 className="font-bold text-sm">توقيتات السباحة</h4><Badge variant="secondary" className="text-[10px]">{slots.length}</Badge></div>
        <div className="flex gap-1.5">
          {!loading && slots.length === 0 && (
            <Button size="sm" variant="outline" onClick={async () => {
              const res = await globalThis.fetch("/api/swimming-days", { method: "PUT" });
              if (res.ok) { toast.success("تمت الاستعادة"); invalidateSwimConfig(); fetchSlots(); }
            }}><RefreshCw className="h-3.5 w-3.5 ml-1" /> استعادة الافتراضي</Button>
          )}
          <Button size="sm" onClick={() => { setEditing(null); setForm({ name: "", startTime: "09:00", endTime: "10:00", maxCapacity: 30, active: true, sortOrder: slots.length }); setDialogOpen(true); }}><Plus className="h-4 w-4 ml-1" /> إضافة</Button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        🔗 تُستخدم في نموذج المنخرط (حقل التوقيت)، قائمة الانتظار، وتحديد السعة القصوى للحصة.
      </p>
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : slots.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
          لا توجد توقيتات بعد — أضف توقيتاً أو اضغط «استعادة الافتراضي».
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-right border-b"><th className="p-1.5">الاسم</th><th className="p-1.5">البداية</th><th className="p-1.5">النهاية</th><th className="p-1.5">السعة</th><th className="p-1.5">فعال</th><th className="p-1.5"></th></tr></thead>
            <tbody>{slots.map(s => (
              <tr key={s.id} className="border-b hover:bg-accent/30">
                <td className="p-1.5 font-semibold">{s.name}</td>
                <td className="p-1.5 font-mono" dir="ltr">{s.startTime}</td>
                <td className="p-1.5 font-mono" dir="ltr">{s.endTime}</td>
                <td className="p-1.5 tabular-nums">{s.maxCapacity}</td>
                <td className="p-1.5">{s.active ? "✅" : "❌"}</td>
                <td className="p-1.5"><div className="flex gap-0.5">
                  <button onClick={() => { setEditing(s); setForm(s); setDialogOpen(true); }} className="p-1 hover:bg-accent rounded text-primary"><Pencil className="h-3 w-3" /></button>
                  <button onClick={() => handleDelete(s.id)} className="p-1 hover:bg-rose-500/10 rounded text-rose-500"><Trash2 className="h-3 w-3" /></button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "تعديل توقيت" : "إضافة توقيت"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">الاسم *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-9 font-mono" placeholder="09:00-10:00" dir="ltr" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">البداية</Label><Input type="time" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})} className="h-9" dir="ltr" /></div>
              <div><Label className="text-xs">النهاية</Label><Input type="time" value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})} className="h-9" dir="ltr" /></div>
            </div>
            <div><Label className="text-xs">السعة القصوى</Label><Input type="number" value={form.maxCapacity} onChange={e => setForm({...form, maxCapacity: +e.target.value})} className="h-9" /></div>
            <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2"><Label className="text-xs">فعال</Label><Switch checked={form.active} onCheckedChange={c => setForm({...form, active: c})} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button><Button onClick={handleSave}>{editing ? "حفظ" : "إضافة"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// مولّد مفتاح المزامنة (Sync API Key) — لربط الفروع الأوفلاين بالسحابة
// ═══════════════════════════════════════════════════════════
function SyncKeyGenerator() {
  const [key, setKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [visible, setVisible] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sync/generate-key");
      const data = await res.json();
      setKey(data.syncApiKey || null);
    } catch {
      // تجاهل
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    if (key && !confirm("توليد مفتاح جديد سيلغي المفتاح القديم — أي فرع يستخدمه لن يقدر يزامن حتى تحدّثه بالمفتاح الجديد. متابعة؟")) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/sync/generate-key", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setKey(data.syncApiKey);
      setVisible(true);
      toast.success("تم توليد مفتاح مزامنة جديد");
    } catch (e: any) {
      toast.error(e?.message || "تعذّر توليد المفتاح");
    } finally {
      setGenerating(false);
    }
  };

  const copy = () => {
    if (!key) return;
    navigator.clipboard.writeText(key);
    toast.success("تم نسخ المفتاح");
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-3 mb-3 space-y-3">
      <h3 className="font-bold text-sm flex items-center gap-2">
        <Key className="h-4 w-4 text-primary" /> مزامنة الفروع الأوفلاين مع السحابة
      </h3>
      <p className="text-xs text-muted-foreground">
        انسخ هذا المفتاح وألصقه في إعدادات تطبيق سطح المكتب (المزامنة) لكل فرع أوفلاين تبي تربطه بهذا النادي.
      </p>

      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : key ? (
        <div className="flex items-center gap-2">
          <Input
            value={key}
            readOnly
            type={visible ? "text" : "password"}
            className="h-9 text-xs font-mono flex-1"
            dir="ltr"
          />
          <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => setVisible(!visible)}>
            {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
          <Button size="icon" variant="outline" className="h-9 w-9" onClick={copy}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <p className="text-xs text-amber-600">لا يوجد مفتاح مزامنة بعد لهذا النادي.</p>
      )}

      <Button size="sm" variant="outline" onClick={generate} disabled={generating}>
        {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> : <RefreshCw className="h-3.5 w-3.5 ml-1" />}
        {key ? "توليد مفتاح جديد (يلغي القديم)" : "توليد مفتاح مزامنة"}
      </Button>
    </div>
  );
}

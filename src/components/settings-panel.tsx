"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Settings as SettingsIcon, Save, Loader2, Building, Phone, MessageSquare,
  DollarSign, Clock, Users, Plus, Trash2, Type, Calendar, Timer,
  LayoutTemplate, Sparkles, Pencil, FileText, Monitor,
  RefreshCw, Key, Copy, Eye, EyeOff,
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

export function SettingsPanel({ initialTab }: { initialTab?: string | null }) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [activeSubTab, setActiveSubTab] = useState(initialTab || "appearance");
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

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
        <h3 className="font-bold text-base mb-1 flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-primary" /> إعدادات النادي
        </h3>
        <p className="text-xs text-muted-foreground mb-4">عدّل كل إعدادات النادي — الإعدادات العامة، المنخرطين، ساعات العمل، النصوص</p>

        <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
          <TabsList className="w-full flex-wrap h-auto">
            <TabsTrigger value="appearance" className="text-xs flex-1">🎨 المظهر والشعار</TabsTrigger>
            <TabsTrigger value="general" className="text-xs flex-1">🏢 عامة</TabsTrigger>
            <TabsTrigger value="subscribers" className="text-xs flex-1">👥 المنخرطون</TabsTrigger>
            <TabsTrigger value="workhours" className="text-xs flex-1">⏰ ساعات العمل</TabsTrigger>
            <TabsTrigger value="entete" className="text-xs flex-1">📄 الترويسة الموحدة</TabsTrigger>
            <TabsTrigger value="texts" className="text-xs flex-1">📝 النصوص</TabsTrigger>
            <TabsTrigger value="whatsapp" className="text-xs flex-1">💬 WhatsApp</TabsTrigger>
            <TabsTrigger value="features" className="text-xs flex-1">🧩 الميزات</TabsTrigger>
            <TabsTrigger value="desktop" className="text-xs flex-1">💻 سطح المكتب</TabsTrigger>
          </TabsList>

          {/* ════════════ المظهر والشعار (ThemeSettingsPanel) ════════════ */}
          <TabsContent value="appearance" className="mt-3">
            <ThemeSettingsPanel />
          </TabsContent>

          {/* ════════════ العامة ════════════ */}
          <TabsContent value="general" className="space-y-3 mt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1.5"><Building className="h-3 w-3" /> اسم النادي</Label>
                <Input value={settings.clubName || ""} onChange={(e) => setSettings({ ...settings, clubName: e.target.value })} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">العنوان</Label>
                <Input value={settings.clubAddress || ""} onChange={(e) => setSettings({ ...settings, clubAddress: e.target.value })} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1.5"><Phone className="h-3 w-3" /> هاتف النادي</Label>
                <Input value={settings.clubPhone || ""} onChange={(e) => setSettings({ ...settings, clubPhone: e.target.value })} className="h-10" dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1.5"><DollarSign className="h-3 w-3" /> العملة</Label>
                <Input value={settings.currency || "دج"} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} className="h-10" placeholder="دج" />
              </div>
            </div>
          </TabsContent>

          {/* ════════════ المنخرطون ════════════ */}
          <TabsContent value="subscribers" className="space-y-4 mt-3">
            <SubscriptionTypesManager />
            <SwimmingDaysManager />
            <SwimmingTimeSlotsManager />

            {/* إعدادات نوع MJ تم حذفها — تُدار الآن بالكامل من جدول أنواع الاشتراك */}
          </TabsContent>

          {/* ════════════ ساعات العمل ════════════ */}
          <TabsContent value="workhours" className="space-y-3 mt-3">
            <div className="rounded-xl border-2 border-teal-500/30 bg-teal-500/5 p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300 flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> تسعير ساعات العمل
              </h4>
              <p className="text-xs text-muted-foreground">يستخدم هذا السعر لحساب مستحقات العمال في تبويب الأعباء والتسديدات.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">سعر الساعة (دج)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={settings.workHourRate || "200"}
                    onChange={(e) => setSettings({ ...settings, workHourRate: e.target.value })}
                    className="h-10"
                    placeholder="200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">عملة السعر</Label>
                  <Input
                    value={settings.workHourCurrency || "دج"}
                    onChange={(e) => setSettings({ ...settings, workHourCurrency: e.target.value })}
                    className="h-10"
                    placeholder="دج"
                  />
                </div>
              </div>
              <div className="rounded-lg bg-card p-2.5 text-xs text-muted-foreground">
                <strong className="text-foreground">مثال:</strong> إذا كان السعر 200 دج/ساعة وعامل سجل 10 ساعات → مستحقاته = 2,000 دج
              </div>
            </div>
          </TabsContent>

          {/* ════════════ الترويسة الموحدة (EN-TÊTE) ════════════ */}
          <TabsContent value="entete" className="mt-3">
            <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-3 mb-3">
              <h4 className="font-bold text-sm flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-primary" /> الترويسة الموحدة (EN-TÊTE)
              </h4>
              <p className="text-xs text-muted-foreground">
                تُستخدم تلقائياً في جميع التقارير والمطبوعات — قائمة المنخرطين، التأمين، حقوق المركب، التجديدات، الحضور، التقرير المالي وغيرها.
                أي تعديل هنا ينعكس فوراً على كل التقارير دون الحاجة لتعديل كل تقرير على حدة.
              </p>
            </div>
            <UnifiedHeaderSettings />
          </TabsContent>

          {/* ════════════ النصوص ════════════ */}
          <TabsContent value="texts" className="space-y-3 mt-3">
            {/* Header text */}
            <div className="rounded-xl border border-border/60 p-3 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <LayoutTemplate className="h-3 w-3" /> نص أعلى الموقع (الترويسة)
              </h4>
              <p className="text-xs text-muted-foreground">الشعار والألوان تُدار من تبويب «🎨 المظهر والشعار» أول تبويبات هذه الصفحة.</p>
              <Input
                value={settings.headerTitle || ""}
                onChange={(e) => setSettings({ ...settings, headerTitle: e.target.value })}
                className="h-10"
                placeholder="نادي RCS للسباحة"
              />
              <Input
                value={settings.headerSubtitle || ""}
                onChange={(e) => setSettings({ ...settings, headerSubtitle: e.target.value })}
                className="h-10"
                placeholder="منظومة إدارة الاشتراكات والسباحة"
              />
            </div>
            <div className="rounded-xl border border-border/60 p-3 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <LayoutTemplate className="h-3 w-3" /> نص أسفل الموقع (التذييل)
              </h4>
              <Input
                value={settings.footerText || ""}
                onChange={(e) => setSettings({ ...settings, footerText: e.target.value })}
                className="h-10"
                placeholder="نادي RCS — منظومة إدارة الاشتراكات والسباحة"
              />
              <Input
                value={settings.footerNote || ""}
                onChange={(e) => setSettings({ ...settings, footerNote: e.target.value })}
                className="h-10"
                placeholder="المبلغ الإجمالي = رسوم الاشتراك + مصاريف التأمين"
              />
            </div>
          </TabsContent>

          {/* ════════════ WhatsApp ════════════ */}
          <TabsContent value="whatsapp" className="space-y-3 mt-3">
            <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
              <div>
                <p className="text-sm font-semibold">تفعيل إشعارات WhatsApp</p>
                <p className="text-xs text-muted-foreground">السماح بإرسال تذكيرات التجديد</p>
              </div>
              <Switch
                checked={settings.whatsappEnabled === "true"}
                onCheckedChange={(c) => setSettings({ ...settings, whatsappEnabled: c ? "true" : "false" })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">قالب رسالة التذكير</Label>
              <Textarea
                value={settings.whatsappTemplate || ""}
                onChange={(e) => setSettings({ ...settings, whatsappTemplate: e.target.value })}
                rows={3}
                placeholder="مرحباً {name}، اشتراكك ينتهي في {date}..."
              />
              <p className="text-xs text-muted-foreground">المتغيرات: {`{name}`} (الاسم)، {`{date}`} (تاريخ الانتهاء)</p>
            </div>
          </TabsContent>

          {/* ════════════ الميزات (كل ميزة بإعداداتها المتزامنة) ════════════ */}
          <TabsContent value="features" className="mt-3">
            <FeatureSettingsHub />
          </TabsContent>

          {/* ════════════ سطح المكتب (Desktop) ════════════ */}
          <TabsContent value="desktop" className="mt-3">
            <div className="rounded-2xl border border-border/60 bg-card p-3 mb-3">
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
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t mt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 ml-1" />}
            حفظ الإعدادات
          </Button>
        </div>
      </div>
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

// ════════════ Swimming Days Manager ════════════
interface SwimDay { id: string; name: string; shortName: string; color: string; active: boolean; sortOrder: number; }

function SwimmingDaysManager() {
  const [days, setDays] = useState<SwimDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SwimDay | null>(null);
  const [form, setForm] = useState({ name: "", shortName: "", color: "#0d9488", active: true, sortOrder: 0 });

  const fetchDays = useCallback(() => {
    setLoading(true);
    globalThis.fetch("/api/swimming-days").then(r => r.json()).then(d => setDays(d.days || [])).finally(() => setLoading(false));
  }, []);

  // الجلب الأولي — كل setState داخل callbacks (متوافق مع قواعد React hooks)
  useEffect(() => {
    let cancelled = false;
    globalThis.fetch("/api/swimming-days")
      .then(r => r.json())
      .then(d => { if (!cancelled) setDays(d.days || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // 🔗 إبطال كاش الميزات — النماذج (منخرط/انتظار/تعويضات) تلتقط التعديل فوراً
  const syncMutate = async () => { invalidateSwimConfig(); };

  const handleSave = async () => {
    if (!form.name) { toast.error("الاسم مطلوب"); return; }
    const url = editing ? `/api/swimming-days/${editing.id}` : "/api/swimming-days";
    const method = editing ? "PATCH" : "POST";
    await globalThis.fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    toast.success(editing ? "تم التحديث" : "تمت الإضافة");
    setDialogOpen(false); syncMutate(); fetchDays();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("تعطيل هذا اليوم؟ سيُخفى من النماذج والقوائم لكن السجل يبقى محفوظاً ويمكن إعادة تفعيله بإنشاء يوم بنفس الاسم.")) return;
    await globalThis.fetch(`/api/swimming-days/${id}`, { method: "DELETE" });
    toast.success("تم تعطيل اليوم — السجل محفوظ"); syncMutate(); fetchDays();
  };

  const restoreDefaults = async () => {
    const res = await globalThis.fetch("/api/swimming-days", { method: "PUT" });
    if (res.ok) { toast.success("تمت استعادة الأيام والتوقيتات الافتراضية"); syncMutate(); fetchDays(); }
    else toast.error("تعذّرت الاستعادة");
  };

  return (
    <div className="rounded-xl border border-border/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /><h4 className="font-bold text-sm">أيام السباحة</h4><Badge variant="secondary" className="text-[10px]">{days.length}</Badge></div>
        <div className="flex gap-1.5">
          {!loading && days.length === 0 && (
            <Button size="sm" variant="outline" onClick={restoreDefaults}><RefreshCw className="h-3.5 w-3.5 ml-1" /> استعادة الافتراضي</Button>
          )}
          <Button size="sm" onClick={() => { setEditing(null); setForm({ name: "", shortName: "", color: "#0d9488", active: true, sortOrder: days.length }); setDialogOpen(true); }}><Plus className="h-4 w-4 ml-1" /> إضافة</Button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        🔗 هذه الأيام تستخدمها تلقائياً: نموذج المنخرط، قائمة الانتظار، التعويضات، جدول الحضور والتحليلات — أي تعديل هنا ينعكس عليها فوراً.
      </p>
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : days.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
          لا توجد أيام سباحة بعد — أضف يوماً أو اضغط «استعادة الافتراضي».
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-right border-b"><th className="p-1.5">الاسم</th><th className="p-1.5">الرمز</th><th className="p-1.5">اللون</th><th className="p-1.5">الترقيم</th><th className="p-1.5">فعال</th><th className="p-1.5">ترتيب</th><th className="p-1.5"></th></tr></thead>
            <tbody>{days.map(d => (
              <tr key={d.id} className="border-b hover:bg-accent/30">
                <td className="p-1.5 font-semibold">{d.name}</td><td className="p-1.5">{d.shortName}</td>
                <td className="p-1.5"><div className="h-4 w-4 rounded" style={{ backgroundColor: d.color }} /></td>
                <td className="p-1.5">{d.active ? "✅" : "❌"}</td><td className="p-1.5 tabular-nums">{d.sortOrder}</td>
                <td className="p-1.5"><div className="flex gap-0.5">
                  <button onClick={() => { setEditing(d); setForm(d); setDialogOpen(true); }} className="p-1 hover:bg-accent rounded text-primary"><Pencil className="h-3 w-3" /></button>
                  <button onClick={() => handleDelete(d.id)} className="p-1 hover:bg-rose-500/10 rounded text-rose-500"><Trash2 className="h-3 w-3" /></button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "تعديل يوم سباحة" : "إضافة يوم سباحة"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">الاسم *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-9" placeholder="الأحد والأربعاء" /></div>
            <div><Label className="text-xs">الاختصار</Label><Input value={form.shortName} onChange={e => setForm({...form, shortName: e.target.value})} className="h-9" placeholder="أح+أر" /></div>
            <div><Label className="text-xs">اللون</Label><div className="flex gap-2"><Input type="color" value={form.color} onChange={e => setForm({...form, color: e.target.value})} className="h-9 w-12 p-1" /><Input value={form.color} onChange={e => setForm({...form, color: e.target.value})} className="h-9 font-mono text-xs" dir="ltr" /></div></div>
            <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2"><Label className="text-xs">فعال</Label><Switch checked={form.active} onCheckedChange={c => setForm({...form, active: c})} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button><Button onClick={handleSave}>{editing ? "حفظ" : "إضافة"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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

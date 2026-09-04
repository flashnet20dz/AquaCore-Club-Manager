"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, EyeOff, Settings, Save, RefreshCw, Layout, Palette, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════
//  الأنواع
// ═══════════════════════════════════════════════════════════════
interface UIInterface {
  id: string;
  interfaceKey: string;
  interfaceName: string;
  isVisible: boolean;
  settings: Record<string, unknown>;
  scope?: string;
  isOverridden?: boolean;
  updatedAt: string;
}

interface Club {
  id: string;
  name: string;
  city: string;
  status: string;
  createdAt: string;
}

interface UITemplate {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  config: { interfaces?: Array<{ key: string; name: string; visible: boolean }> };
  isDefault: boolean;
}

interface NewClubSettings {
  defaultLanguage: string;
  defaultCurrency: string;
  subscriptionModel: string;
  emailNotifications: boolean;
  primaryColor: string;
  secondaryColor: string;
}

// قائمة الواجهات الافتراضية (تُستخدم للتهيئة الأولية)
const DEFAULT_INTERFACES = [
  { key: "dashboard", name: "لوحة التحكم" },
  { key: "subscribers", name: "المنخرطون" },
  { key: "attendance", name: "الحضور" },
  { key: "renewals", name: "التجديدات" },
  { key: "payments", name: "المدفوعات" },
  { key: "reports", name: "التقارير" },
  { key: "cards", name: "البطاقات" },
  { key: "employees", name: "الموظفون" },
  { key: "contracts", name: "العقود" },
  { key: "settings", name: "الإعدادات" },
];

// ═══════════════════════════════════════════════════════════════
//  1) إدارة الواجهات العامة (لكل النوادي)
// ═══════════════════════════════════════════════════════════════
function InterfacesManagement() {
  const [interfaces, setInterfaces] = useState<UIInterface[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/interfaces", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setInterfaces(data.interfaces || []);
      }
    } catch {
      toast.error("فشل تحميل الواجهات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    setInitialized(true);
  }, [fetchAll]);

  const handleInitDefaults = async () => {
    setLoading(true);
    try {
      // أنشئ إعدادات افتراضية لكل الواجهات (مرئية)
      for (const iface of DEFAULT_INTERFACES) {
        const exists = interfaces.find((i) => i.interfaceKey === iface.key);
        if (!exists) {
          await fetch("/api/super-admin/interfaces", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              interfaceKey: iface.key,
              interfaceName: iface.name,
              isVisible: true,
              settings: {},
            }),
          });
        }
      }
      toast.success("تم تهيئة الواجهات الافتراضية");
      fetchAll();
    } catch {
      toast.error("فشل التهيئة");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVisibility = async (iface: UIInterface) => {
    try {
      await fetch("/api/super-admin/interfaces/visibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interfaceKey: iface.interfaceKey,
          interfaceName: iface.interfaceName,
          isVisible: !iface.isVisible,
          scope: "ALL_CLUBS",
        }),
      });
      toast.success(`${iface.interfaceName}: ${!iface.isVisible ? "مرئية" : "مخفية"}`);
      fetchAll();
    } catch {
      toast.error("فشل التحديث");
    }
  };

  const handleUpdateSettings = async (iface: UIInterface, newSettings: Record<string, unknown>) => {
    try {
      await fetch("/api/super-admin/interfaces/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interfaceKey: iface.interfaceKey,
          interfaceName: iface.interfaceName,
          settings: newSettings,
          scope: "ALL_CLUBS",
        }),
      });
      toast.success(`تم حفظ إعدادات ${iface.interfaceName}`);
      fetchAll();
    } catch {
      toast.error("فشل الحفظ");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layout className="h-5 w-5" />
            إدارة الواجهات العامة
          </CardTitle>
          <CardDescription>التحكم في ظهور الواجهات لجميع النوادي</CardDescription>
        </CardHeader>
        <CardContent>
          {interfaces.length === 0 && !loading && initialized && (
            <div className="text-center py-8 space-y-3">
              <AlertCircle className="h-10 w-10 mx-auto text-amber-500" />
              <p className="text-sm text-muted-foreground">لا توجد واجهات مهيّأة بعد</p>
              <Button onClick={handleInitDefaults} className="bg-gradient-to-l from-teal-500 to-sky-500 border-0">
                <Settings className="h-4 w-4 ml-1" /> تهيئة الواجهات الافتراضية
              </Button>
            </div>
          )}

          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          <div className="space-y-3">
            {interfaces.map((iface) => (
              <InterfaceConfigCard
                key={iface.id}
                iface={iface}
                onToggleVisibility={() => handleToggleVisibility(iface)}
                onUpdateSettings={(s) => handleUpdateSettings(iface, s)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {interfaces.length > 0 && (
        <Button variant="outline" onClick={fetchAll} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 ml-1", loading && "animate-spin")} /> تحديث
        </Button>
      )}
    </div>
  );
}

function InterfaceConfigCard({
  iface,
  onToggleVisibility,
  onUpdateSettings,
}: {
  iface: UIInterface;
  onToggleVisibility: () => void;
  onUpdateSettings: (settings: Record<string, unknown>) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [settingsStr, setSettingsStr] = useState(JSON.stringify(iface.settings || {}, null, 2));

  const handleSave = () => {
    try {
      const parsed = JSON.parse(settingsStr);
      onUpdateSettings(parsed);
      setIsEditing(false);
    } catch {
      toast.error("JSON غير صالح");
    }
  };

  return (
    <div className={cn("rounded-xl border p-4", iface.isVisible ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-rose-500")}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {iface.isVisible ? (
            <Eye className="h-5 w-5 text-emerald-600 shrink-0" />
          ) : (
            <EyeOff className="h-5 w-5 text-rose-600 shrink-0" />
          )}
          <div className="min-w-0">
            <h3 className="font-semibold truncate">{iface.interfaceName}</h3>
            <p className="text-xs text-muted-foreground font-mono">{iface.interfaceKey}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">مفعّلة</Label>
            <Switch checked={iface.isVisible} onCheckedChange={onToggleVisibility} />
          </div>
          <Button
            size="sm"
            variant={isEditing ? "default" : "outline"}
            onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
          >
            {isEditing ? (
              <><Save className="h-4 w-4 ml-1" /> حفظ</>
            ) : (
              <><Settings className="h-4 w-4 ml-1" /> تعديل</>
            )}
          </Button>
        </div>
      </div>

      {isEditing && (
        <div className="mt-4 p-3 bg-muted/30 rounded-lg space-y-2">
          <Label className="text-xs">الإعدادات (JSON)</Label>
          <Textarea
            value={settingsStr}
            onChange={(e) => setSettingsStr(e.target.value)}
            rows={6}
            className="font-mono text-xs"
            dir="ltr"
          />
          <p className="text-[10px] text-muted-foreground">تأكد من صحة JSON قبل الحفظ</p>
        </div>
      )}

      <div className="text-[10px] text-muted-foreground mt-2">
        آخر تحديث: {new Date(iface.updatedAt).toLocaleString("ar-DZ")}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  2) إدارة واجهات النوادي الفردية
// ═══════════════════════════════════════════════════════════════
function ClubInterfacesManagement() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClub, setSelectedClub] = useState<string>("");
  const [clubInterfaces, setClubInterfaces] = useState<UIInterface[]>([]);
  const [loading, setLoading] = useState(false);
  const [clubName, setClubName] = useState("");

  const fetchClubs = useCallback(async () => {
    try {
      const res = await fetch("/api/super-admin/clubs", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setClubs(data.clubs || []);
      }
    } catch {
      toast.error("فشل تحميل النوادي");
    }
  }, []);

  useEffect(() => {
    fetchClubs();
  }, [fetchClubs]);

  const handleSelectClub = async (clubId: string) => {
    setSelectedClub(clubId);
    setLoading(true);
    try {
      const res = await fetch(`/api/super-admin/clubs/${clubId}/interfaces`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setClubInterfaces(data.interfaces || []);
        setClubName(data.club?.name || "");
      }
    } catch {
      toast.error("فشل تحميل واجهات النادي");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleForClub = async (iface: UIInterface) => {
    try {
      await fetch(`/api/super-admin/clubs/${selectedClub}/interfaces`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interfaceKey: iface.interfaceKey,
          interfaceName: iface.interfaceName,
          isVisible: !iface.isVisible,
        }),
      });
      toast.success(`${iface.interfaceName}: ${!iface.isVisible ? "مرئية" : "مخفية"} للنادي`);
      handleSelectClub(selectedClub);
    } catch {
      toast.error("فشل التحديث");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" /> اختر النادي
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedClub} onValueChange={handleSelectClub}>
            <SelectTrigger><SelectValue placeholder="اختر النادي..." /></SelectTrigger>
            <SelectContent>
              {clubs.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} — {c.city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedClub && (
        <Card>
          <CardHeader>
            <CardTitle>واجهات النادي: {clubName}</CardTitle>
            <CardDescription>التحكم في ظهور الواجهات لهذا النادي تحديداً</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : clubInterfaces.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                لا توجد واجهات مهيّأة. وجّه للنادي لاستخدام الإعدادات العامة.
              </div>
            ) : (
              <div className="space-y-2">
                {clubInterfaces.map((iface) => (
                  <div
                    key={`${iface.interfaceKey}-${iface.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/30"
                  >
                    <div className="flex items-center gap-3">
                      {iface.isVisible ? <Eye className="h-4 w-4 text-emerald-600" /> : <EyeOff className="h-4 w-4 text-rose-600" />}
                      <div>
                        <p className="font-medium text-sm">{iface.interfaceName}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{iface.interfaceKey}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {iface.isOverridden && (
                        <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-700 border-amber-500/30">
                          مخصّص
                        </Badge>
                      )}
                      <Switch checked={iface.isVisible} onCheckedChange={() => handleToggleForClub(iface)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  3) إعدادات النادي الجديد
// ═══════════════════════════════════════════════════════════════
function NewClubSettingsTab() {
  const [settings, setSettings] = useState<NewClubSettings>({
    defaultLanguage: "ar",
    defaultCurrency: "DZD",
    subscriptionModel: "monthly",
    emailNotifications: true,
    primaryColor: "#0f766e",
    secondaryColor: "#0369a1",
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/super-admin/settings/new-club", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setSettings({
            defaultLanguage: data.defaultLanguage || "ar",
            defaultCurrency: data.defaultCurrency || "DZD",
            subscriptionModel: data.subscriptionModel || "monthly",
            emailNotifications: data.emailNotifications ?? true,
            primaryColor: data.primaryColor || "#0f766e",
            secondaryColor: data.secondaryColor || "#0369a1",
          });
        }
      } catch {
        // استخدم الإعدادات الافتراضية
      } finally {
        setFetching(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/settings/new-club", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        toast.success("تم حفظ إعدادات النادي الجديد");
      } else {
        toast.error("فشل الحفظ");
      }
    } catch {
      toast.error("فشل الاتصال");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" /> إعدادات النادي الجديد
        </CardTitle>
        <CardDescription>الإعدادات الافتراضية المطبّقة عند إنشاء نادي جديد</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>اللغة الافتراضية</Label>
            <Select value={settings.defaultLanguage} onValueChange={(v) => setSettings({ ...settings, defaultLanguage: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ar">العربية</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>العملة الافتراضية</Label>
            <Select value={settings.defaultCurrency} onValueChange={(v) => setSettings({ ...settings, defaultCurrency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DZD">دينار جزائري (DZD)</SelectItem>
                <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                <SelectItem value="EUR">يورو (EUR)</SelectItem>
                <SelectItem value="MAD">درهم مغربي (MAD)</SelectItem>
                <SelectItem value="TND">دينار تونسي (TND)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>نموذج الاشتراك</Label>
            <Select value={settings.subscriptionModel} onValueChange={(v) => setSettings({ ...settings, subscriptionModel: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">شهري</SelectItem>
                <SelectItem value="yearly">سنوي</SelectItem>
                <SelectItem value="custom">مخصص</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>إشعارات البريد الإلكتروني</Label>
            <div className="flex items-center gap-2 h-10">
              <Switch
                checked={settings.emailNotifications}
                onCheckedChange={(v) => setSettings({ ...settings, emailNotifications: v })}
              />
              <span className="text-sm text-muted-foreground">{settings.emailNotifications ? "مفعّلة" : "معطّلة"}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>اللون الأساسي</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.primaryColor}
                onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                className="w-14 h-10 p-1"
              />
              <Input
                value={settings.primaryColor}
                onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                className="font-mono"
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>اللون الثانوي</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.secondaryColor}
                onChange={(e) => setSettings({ ...settings, secondaryColor: e.target.value })}
                className="w-14 h-10 p-1"
              />
              <Input
                value={settings.secondaryColor}
                onChange={(e) => setSettings({ ...settings, secondaryColor: e.target.value })}
                className="font-mono"
                dir="ltr"
              />
            </div>
          </div>
        </div>

        {/* معاينة الألوان */}
        <div className="rounded-xl p-4 border" style={{ background: `linear-gradient(135deg, ${settings.primaryColor}15, ${settings.secondaryColor}15)` }}>
          <p className="text-xs text-muted-foreground mb-2">معاينة</p>
          <div className="flex gap-2">
            <div className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: settings.primaryColor }}>
              زر أساسي
            </div>
            <div className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: settings.secondaryColor }}>
              زر ثانوي
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={loading} size="lg" className="w-full bg-gradient-to-l from-teal-500 to-sky-500 border-0">
          {loading ? (
            <><Loader2 className="h-4 w-4 ml-1 animate-spin" /> جاري الحفظ...</>
          ) : (
            <><Save className="h-4 w-4 ml-1" /> حفظ الإعدادات</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
//  4) تبويب القوالب
// ═══════════════════════════════════════════════════════════════
function TemplatesTab() {
  const [templates, setTemplates] = useState<UITemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/templates", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch {
      toast.error("فشل تحميل القوالب");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" /> قوالب الواجهات
        </CardTitle>
        <CardDescription>قوالب جاهزة لتطبيقها على النوادي الجديدة</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {templates.map((t) => (
              <div key={t.id} className="rounded-xl border p-4 space-y-2 hover:border-primary/40 transition">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">{t.displayName}</h3>
                  {t.isDefault && <Badge className="bg-primary/10 text-primary border-primary/30 text-[9px]">افتراضي</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{t.description || "—"}</p>
                <div className="text-[10px] text-muted-foreground">
                  {t.config?.interfaces?.length || 0} واجهة
                </div>
                <div className="flex flex-wrap gap-1 pt-2">
                  {t.config?.interfaces?.map((i) => (
                    <span key={i.key} className={cn("text-[9px] px-1.5 py-0.5 rounded", i.visible ? "bg-emerald-500/10 text-emerald-700" : "bg-rose-500/10 text-rose-700 line-through")}>
                      {i.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
//  المكون الرئيسي
// ═══════════════════════════════════════════════════════════════
export function SuperAdminDashboard() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="p-4 border-b bg-gradient-to-l from-teal-500/10 to-sky-500/10">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Layout className="h-5 w-5 text-primary" />
          نظام التحكم الشامل
        </h2>
        <p className="text-xs text-muted-foreground mt-1">إدارة الواجهات والإعدادات لجميع النوادي</p>
      </div>

      <Tabs defaultValue="all-clubs" className="w-full p-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-4">
          <TabsTrigger value="all-clubs">الواجهات العامة</TabsTrigger>
          <TabsTrigger value="club-specific">واجهات نادٍ</TabsTrigger>
          <TabsTrigger value="new-club">النادي الجديد</TabsTrigger>
          <TabsTrigger value="templates">القوالب</TabsTrigger>
        </TabsList>

        <TabsContent value="all-clubs" className="mt-2">
          <InterfacesManagement />
        </TabsContent>

        <TabsContent value="club-specific" className="mt-2">
          <ClubInterfacesManagement />
        </TabsContent>

        <TabsContent value="new-club" className="mt-2">
          <NewClubSettingsTab />
        </TabsContent>

        <TabsContent value="templates" className="mt-2">
          <TemplatesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SuperAdminDashboard;

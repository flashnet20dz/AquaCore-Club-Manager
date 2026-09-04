"use client";

import { useEffect, useState } from "react";
import {
  Folder, Printer, Bell, Database, Save, Loader2, HardDrive,
  Download, Upload, RefreshCw, Check, Monitor, Power, Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

/**
 * Desktop Settings — إعدادات تطبيق سطح المكتب
 * تظهر فقط في وضع Electron
 */
export function DesktopSettings() {
  const [isElectron, setIsElectron] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dbInfo, setDbInfo] = useState<any>(null);

  useEffect(() => {
    // كشف Electron
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.isElectron) {
      setIsElectron(true);
      // تحميل الإعدادات
      electronAPI.getDesktopSettings().then((s: any) => {
        setSettings(s);
        setLoading(false);
      });
      electronAPI.getDatabaseInfo().then((info: any) => {
        setDbInfo(info);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const handleSave = async () => {
    if (!isElectron) return;
    setSaving(true);
    try {
      const electronAPI = (window as any).electronAPI;
      for (const [key, value] of Object.entries(settings)) {
        await electronAPI.setDesktopSetting(key, value);
      }
      toast.success("تم حفظ الإعدادات");
    } catch {
      toast.error("فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const handleBackup = async () => {
    if (!isElectron) return;
    try {
      const electronAPI = (window as any).electronAPI;
      const result = await electronAPI.backupDatabase();
      if (result.success) {
        toast.success(`تم إنشاء نسخة احتياطية: ${result.path}`);
      } else {
        toast.error(result.error || "فشل النسخ الاحتياطي");
      }
    } catch {
      toast.error("فشل النسخ الاحتياطي");
    }
  };

  const handleRestore = async () => {
    if (!isElectron) return;
    if (!confirm("استعادة نسخة احتياطية؟ سيتم استبدال البيانات الحالية.")) return;
    try {
      const electronAPI = (window as any).electronAPI;
      const filePath = await electronAPI.openFile([{ name: "Database", extensions: ["db"] }]);
      if (!filePath) return;
      const result = await electronAPI.restoreDatabase(filePath);
      if (result.success) {
        toast.success("تمت الاستعادة — سيتم إعادة تشغيل التطبيق");
        setTimeout(() => window.location.reload(), 2000);
      } else {
        toast.error(result.error || "فشلت الاستعادة");
      }
    } catch {
      toast.error("فشلت الاستعادة");
    }
  };

  const updateSetting = (key: string, value: any) => {
    setSettings({ ...settings, [key]: value });
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  // إذا لسنا في Electron، لا نعرض شيئاً
  if (!isElectron) {
    return (
      <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-center">
        <Monitor className="h-10 w-10 mx-auto mb-2 opacity-40" />
        <p className="font-semibold text-sm">هذه الإعدادات متاحة فقط في نسخة سطح المكتب</p>
        <p className="text-xs text-muted-foreground mt-1">
          أنت تعمل حالياً على نسخة الويب. حمّل نسخة Desktop للحصول على هذه الميزات.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* معلومات النظام */}
      <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
        <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
          <Monitor className="h-4 w-4 text-primary" /> معلومات النظام
        </h4>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-muted-foreground">البيئة</p>
            <p className="font-semibold">Desktop (Electron)</p>
          </div>
          <div>
            <p className="text-muted-foreground">قاعدة البيانات</p>
            <p className="font-semibold">{dbInfo?.type || "SQLite"} محلي</p>
          </div>
          <div>
            <p className="text-muted-foreground">الحجم</p>
            <p className="font-semibold tabular-nums">
              {dbInfo?.size ? `${(dbInfo.size / 1024 / 1024).toFixed(2)} MB` : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">المسار</p>
            <p className="font-mono text-[10px] truncate" dir="ltr" title={dbInfo?.path}>
              {dbInfo?.path || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* مسار حفظ الملفات */}
      <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
        <h4 className="font-bold text-sm flex items-center gap-2">
          <Folder className="h-4 w-4 text-primary" /> مسار حفظ الملفات
        </h4>
        <div className="grid grid-cols-1 gap-2">
          <div>
            <Label className="text-xs">مجلد الملفات (صور، قوالب، بطاقات)</Label>
            <Input
              value={settings.filesLocation || ""}
              onChange={(e) => updateSetting("filesLocation", e.target.value)}
              className="h-9 text-xs font-mono"
              dir="ltr"
              placeholder="افتراضي: مجلد بيانات التطبيق"
            />
          </div>
          <div>
            <Label className="text-xs">مجلد النسخ الاحتياطية</Label>
            <Input
              value={settings.backupLocation || ""}
              onChange={(e) => updateSetting("backupLocation", e.target.value)}
              className="h-9 text-xs font-mono"
              dir="ltr"
              placeholder="افتراضي: مجلد بيانات التطبيق/backups"
            />
          </div>
          <div>
            <Label className="text-xs">مجلد التصديرات (PDF, Word, Excel)</Label>
            <Input
              value={settings.exportsLocation || ""}
              onChange={(e) => updateSetting("exportsLocation", e.target.value)}
              className="h-9 text-xs font-mono"
              dir="ltr"
              placeholder="افتراضي: مجلد بيانات التطبيق/exports"
            />
          </div>
        </div>
      </div>

      {/* إعدادات الطباعة */}
      <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
        <h4 className="font-bold text-sm flex items-center gap-2">
          <Printer className="h-4 w-4 text-primary" /> إعدادات الطباعة
        </h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2.5">
            <Label className="text-xs">طباعة صامتة (بدون مربع حوار)</Label>
            <Switch
              checked={settings.silentPrint || false}
              onCheckedChange={(c) => updateSetting("silentPrint", c)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2.5">
            <Label className="text-xs">طباعة الخلفيات والألوان</Label>
            <Switch
              checked={settings.printBackground !== false}
              onCheckedChange={(c) => updateSetting("printBackground", c)}
            />
          </div>
        </div>
      </div>

      {/* النسخ الاحتياطي التلقائي */}
      <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
        <h4 className="font-bold text-sm flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" /> النسخ الاحتياطي
        </h4>
        <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2.5">
          <div>
            <Label className="text-xs font-semibold">نسخ احتياطي تلقائي</Label>
            <p className="text-[10px] text-muted-foreground">إنشاء نسخة تلقائياً حسب الجدول</p>
          </div>
          <Switch
            checked={settings.autoBackupEnabled || false}
            onCheckedChange={(c) => updateSetting("autoBackupEnabled", c)}
          />
        </div>
        {settings.autoBackupEnabled && (
          <div>
            <Label className="text-xs">تكرار النسخ</Label>
            <select
              value={settings.autoBackupInterval || "daily"}
              onChange={(e) => updateSetting("autoBackupInterval", e.target.value)}
              className="w-full h-9 text-xs rounded border bg-card px-2"
            >
              <option value="daily">يومي</option>
              <option value="weekly">أسبوعي</option>
              <option value="monthly">شهري</option>
            </select>
          </div>
        )}
        {settings.lastBackupDate && (
          <p className="text-[10px] text-muted-foreground">
            آخر نسخة احتياطية: {new Date(settings.lastBackupDate).toLocaleString("ar-DZ")}
          </p>
        )}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={handleBackup}>
            <Download className="h-3.5 w-3.5 ml-1" /> نسخة احتياطية الآن
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={handleRestore}>
            <Upload className="h-3.5 w-3.5 ml-1" /> استعادة نسخة
          </Button>
        </div>
      </div>

      {/* المزامنة مع السحابة */}
      <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
        <h4 className="font-bold text-sm flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-primary" /> المزامنة مع السحابة
        </h4>
        <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2.5">
          <div>
            <Label className="text-xs font-semibold">تفعيل المزامنة التلقائية</Label>
            <p className="text-[10px] text-muted-foreground">مزامنة دورية كل 5 دقائق عند توفر الإنترنت</p>
          </div>
          <Switch
            checked={settings.syncEnabled !== false}
            onCheckedChange={async (c) => {
              updateSetting("syncEnabled", c);
              await (window as any).electronAPI?.setSyncEnabled(c);
            }}
          />
        </div>
        <div>
          <Label className="text-xs">مفتاح المزامنة (Club API Key)</Label>
          <Input
            value={settings.syncApiKey || ""}
            onChange={(e) => updateSetting("syncApiKey", e.target.value)}
            className="h-9 text-xs font-mono"
            dir="ltr"
            type="password"
            placeholder="rcs_sync_..."
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            احصل عليه من لوحة تحكم النادي على السحابة → الإعدادات → مفتاح المزامنة
          </p>
        </div>
        {settings.lastSyncStatus && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">آخر حالة مزامنة:</span>
            <Badge
              variant="outline"
              className={
                settings.lastSyncStatus === "synced" ? "border-emerald-300 text-emerald-700" :
                settings.lastSyncStatus === "error" ? "border-rose-300 text-rose-700" :
                settings.lastSyncStatus === "offline" ? "border-gray-300 text-gray-500" :
                "border-amber-300 text-amber-700"
              }
            >
              {{
                synced: "متزامن",
                syncing: "جاري المزامنة",
                offline: "أوفلاين",
                error: "خطأ",
                "no-api-key": "بدون مفتاح",
                idle: "غير مفعّل بعد",
              }[settings.lastSyncStatus as string] || settings.lastSyncStatus}
            </Badge>
            {settings.lastSyncAt && (
              <span className="text-muted-foreground">
                {new Date(settings.lastSyncAt).toLocaleString("ar-DZ")}
              </span>
            )}
          </div>
        )}
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={async () => {
            await (window as any).electronAPI?.setSyncApiKey(settings.syncApiKey || "");
            const result = await (window as any).electronAPI?.syncNow();
            if (result?.status === "synced") toast.success("تمت المزامنة بنجاح");
            else if (result?.status === "offline") toast.error("لا يوجد اتصال بالإنترنت");
            else if (result?.status === "no-api-key") toast.error("أدخل مفتاح المزامنة أولاً");
            else if (result?.status === "not-applicable") toast.error("المزامنة تعمل فقط في وضع Offline المحلي");
            else toast.error(result?.error || "فشلت المزامنة");
            const status = await (window as any).electronAPI?.getSyncStatus();
            if (status) setSettings((s: any) => ({ ...s, lastSyncStatus: status.status, lastSyncAt: status.lastSyncAt }));
          }}
        >
          <RefreshCw className="h-3.5 w-3.5 ml-1" /> مزامنة الآن
        </Button>
      </div>

      {/* إعدادات النظام */}
      <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
        <h4 className="font-bold text-sm flex items-center gap-2">
          <Power className="h-4 w-4 text-primary" /> إعدادات النظام
        </h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2.5">
            <div>
              <Label className="text-xs font-semibold">تشغيل مع Windows</Label>
              <p className="text-[10px] text-muted-foreground">بدء التطبيق عند إقلاع النظام</p>
            </div>
            <Switch
              checked={settings.autoStart || false}
              onCheckedChange={(c) => updateSetting("autoStart", c)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2.5">
            <div>
              <Label className="text-xs font-semibold">التصغير إلى شريط المهام</Label>
              <p className="text-[10px] text-muted-foreground">بدل الإغلاق الكامل</p>
            </div>
            <Switch
              checked={settings.minimizeToTray || false}
              onCheckedChange={(c) => updateSetting("minimizeToTray", c)}
            />
          </div>
        </div>
      </div>

      {/* اللغة والثيم */}
      <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
        <h4 className="font-bold text-sm flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" /> اللغة والثيم
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">اللغة</Label>
            <select
              value={settings.language || "ar"}
              onChange={(e) => updateSetting("language", e.target.value)}
              className="w-full h-9 text-xs rounded border bg-card px-2"
            >
              <option value="ar">العربية</option>
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">الثيم</Label>
            <select
              value={settings.theme || "dark"}
              onChange={(e) => updateSetting("theme", e.target.value)}
              className="w-full h-9 text-xs rounded border bg-card px-2"
            >
              <option value="dark">داكن</option>
              <option value="light">فاتح</option>
              <option value="system">حسب النظام</option>
            </select>
          </div>
        </div>
      </div>

      {/* زر الحفظ */}
      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 ml-1" />}
          حفظ الإعدادات
        </Button>
      </div>
    </div>
  );
}

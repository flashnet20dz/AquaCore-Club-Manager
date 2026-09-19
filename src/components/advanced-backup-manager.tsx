"use client";

import { useEffect, useState, useRef } from "react";
import {
  Database, Download, Upload, Loader2, CheckCircle2, AlertCircle,
  FileJson, Clock, FolderArchive, HardDrive, RefreshCw, Trash2,
  Calendar, Check, ShieldAlert, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { type AutoBackupConfig } from "@/app/api/backup/auto/route";

interface BackupFile {
  filename: string;
  size: number;
  date: string;
  isDb: boolean;
}

export function AdvancedBackupManager() {
  const [loading, setLoading] = useState(true);
  const [exportingDb, setExportingDb] = useState(false);
  const [exportingJson, setExportingJson] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [triggeringBackup, setTriggeringBackup] = useState(false);

  // إعدادات النسخ التلقائي
  const [config, setConfig] = useState<AutoBackupConfig>({
    enabled: false,
    interval: "daily",
    destination: "backups",
    retentionCount: 15,
  });

  // سجل النسخ المحفوظة
  const [history, setHistory] = useState<BackupFile[]>([]);
  const [defaultDir, setDefaultDir] = useState("");

  // استيراد واستعادة JSON و DB
  const [importing, setImporting] = useState(false);
  const [importingDb, setImportingDb] = useState(false);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const fileRef = useRef<HTMLInputElement>(null);
  const dbFileRef = useRef<HTMLInputElement>(null);

  const fetchConfigAndHistory = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/backup/auto");
      if (res.ok) {
        const data = await res.json();
        if (data.config) setConfig(data.config);
        if (Array.isArray(data.history)) setHistory(data.history);
        if (data.defaultDir) setDefaultDir(data.defaultDir);
      }
    } catch {
      toast.error("تعذر تحميل إعدادات النسخ الاحتياطي");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigAndHistory();
  }, []);

  // 1. تصدير ملف SQLite المباشر (.db)
  const handleExportSqlite = async () => {
    setExportingDb(true);
    try {
      const res = await fetch("/api/backup?format=sqlite");
      if (!res.ok) throw new Error("فشل");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aquacore-db-${new Date().toISOString().split("T")[0]}.db`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تصدير ملف قاعدة البيانات SQLite (.db) بنجاح — شامل 100%");
    } catch {
      toast.error("فشل تصدير قاعدة البيانات");
    } finally {
      setExportingDb(false);
    }
  };

  // 2. تصدير ملف JSON
  const handleExportJson = async () => {
    setExportingJson(true);
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) throw new Error("فشل");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aquacore-full-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تصدير ملف البيانات الشامل (.json) بنجاح — يشمل كافة الجداول");
    } catch {
      toast.error("فشل التصدير");
    } finally {
      setExportingJson(false);
    }
  };

  // 3. حفظ إعدادات النسخ الاحتياطي التلقائي
  const handleSaveConfig = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/backup/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("فشل");
      toast.success("تم حفظ إعدادات النسخ الاحتياطي التلقائي");
    } catch {
      toast.error("تعذر حفظ الإعدادات");
    } finally {
      setSavingSettings(false);
    }
  };

  // 4. إنشاء نسخة احتياطية فورية في المجلد المحلي
  const handleTriggerInstantBackup = async () => {
    setTriggeringBackup(true);
    try {
      const res = await fetch("/api/backup/auto", { method: "PUT" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل");
      toast.success(`تم إنشاء نسخة احتياطية بنجاح: ${data.filename}`);
      fetchConfigAndHistory();
    } catch (e: any) {
      toast.error(e?.message || "فشل إنشاء النسخة الاحتياطية");
    } finally {
      setTriggeringBackup(false);
    }
  };

  // 5. استيراد واستعادة ملف JSON
  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(
      importMode === "replace"
        ? "⚠️ تنبيه هام: وضع الاستبدال سيقوم بحذف كافة السجلات الحالية واستبدالها بكافة بيانات النسخة (100%). هل تود المتابعة؟"
        : "سيتم دمج بيانات النسخة الاحتياطية مع السجلات الحالية. هل تود المتابعة؟"
    )) {
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setImporting(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backup, mode: importMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الاستيراد");
      toast.success(data.message || `تمت استعادة البيانات بنجاح (${data.totalImported || data.imported} سجل)`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) {
      toast.error(e?.message || "فشل قراءة ملف النسخة الاحتياطية");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // 6. استيراد واستعادة ملف قاعدة البيانات المباشر (.db / .sqlite)
  const handleImportDb = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(
      "⚠️ تنبيه شديد الأهمية:\nاستعادة ملف قاعدة البيانات المباشر (.db) ستستبدل قاعدة بيانات النادي بالكامل بالنسخة المستوردة، مع إنشاء نسخة أمان احتياطية تلقائية للملف الحالي.\n\nهل أنت متأكد من رغبتك في المتابعة؟"
    )) {
      if (dbFileRef.current) dbFileRef.current.value = "";
      return;
    }

    setImportingDb(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/backup/restore-db", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشلت استعادة قاعدة البيانات");
      toast.success(data.message || "تمت استعادة قاعدة البيانات بنجاح 100%");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      toast.error(err?.message || "تعذرت استعادة قاعدة البيانات");
    } finally {
      setImportingDb(false);
      if (dbFileRef.current) dbFileRef.current.value = "";
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* ═══ 1. الترويسة ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl border border-indigo-500/30 bg-gradient-to-l from-indigo-500/10 via-card to-card">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/15 text-indigo-600 flex items-center justify-center shrink-0">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-foreground">مركز النسخ الاحتياطي وحماية البيانات</h3>
              <Badge variant="outline" className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30 text-xs">
                حماية شاملة
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              تصدير يدوي فوري، جدولة نسخ تلقائي على القرص أو الفلاش ديسك، وحماية بيانات النادي من التلف.
            </p>
          </div>
        </div>

        <Button
          size="sm"
          onClick={handleTriggerInstantBackup}
          disabled={triggeringBackup}
          className="text-xs gap-1.5 h-9 bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
        >
          {triggeringBackup ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HardDrive className="h-3.5 w-3.5" />}
          إنشاء نسخة محلية فوراً
        </Button>
      </div>

      {/* ═══ 2. النسخ الاحتياطي اليدوي ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* بطاقة قاعدة البيانات الخام .db */}
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-3 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
                <Database className="h-4 w-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-foreground">نسخة كاملة لقاعدة البيانات (.db)</h4>
                <Badge variant="secondary" className="text-[10px] mt-0.5">
                  SQLite Raw Snapshot
                </Badge>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            لقطة حية ومطابقة 100% لملف قاعدة البيانات بكافة الجداول والصور والمفاتيح. الصيغة المثلى للاحتفاظ بنسخة طبق الأصل لنظام النادي.
          </p>
          <Button
            onClick={handleExportSqlite}
            disabled={exportingDb}
            variant="outline"
            className="w-full text-xs font-bold gap-2 h-10 border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          >
            {exportingDb ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            تحميل نسخة قاعدة البيانات الآن (.db)
          </Button>
        </div>

        {/* بطاقة ملف JSON */}
        <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-3 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-blue-500/15 text-blue-600 flex items-center justify-center shrink-0">
                <FileJson className="h-4 w-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-foreground">تصدير شامل بصيغة JSON</h4>
                <Badge variant="secondary" className="text-[10px] mt-0.5">
                  Structured Export
                </Badge>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            ملف بيانات منظم ومقروء يحتوي على المشتركين، السجلات، المدفوعات، والإعدادات. مناسب للنقل الخفيف بين الأجهزة أو المعالجة البرمجية.
          </p>
          <Button
            onClick={handleExportJson}
            disabled={exportingJson}
            variant="outline"
            className="w-full text-xs font-bold gap-2 h-10 border-blue-500/30 hover:bg-blue-500/10 text-blue-700 dark:text-blue-400"
          >
            {exportingJson ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            تصدير ملف البيانات (.json)
          </Button>
        </div>
      </div>

      {/* ═══ 3. إعدادات النسخ الاحتياطي التلقائي والمجدول ═══ */}
      <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-indigo-600" />
            <h4 className="font-bold text-sm text-foreground">إعدادات النسخ الاحتياطي التلقائي (اختياري)</h4>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs font-bold text-muted-foreground">تفعيل النسخ التلقائي:</Label>
            <Switch
              checked={config.enabled}
              onCheckedChange={(c) => setConfig({ ...config, enabled: c })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* الجدولة والتردد */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">تردد وتوقيت النسخ التلقائي:</Label>
            <Select
              value={config.interval}
              onValueChange={(v: any) => setConfig({ ...config, interval: v })}
              disabled={!config.enabled}
            >
              <SelectTrigger className="h-10 text-xs">
                <SelectValue placeholder="اختر التردد" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="every6h">كل 6 ساعات</SelectItem>
                <SelectItem value="daily">يومياً عند إغلاق الوردية (22:00)</SelectItem>
                <SelectItem value="weekly">أسبوعياً (كل سبت)</SelectItem>
                <SelectItem value="onClose">عند إغلاق التطبيق / نهاية اليوم</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* مسار الحفظ (مجلد محلي أو فلاش ميموري) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">مسار مجلد الحفظ (أو فلاش ديسك USB):</Label>
            <Input
              value={config.destination}
              onChange={(e) => setConfig({ ...config, destination: e.target.value })}
              placeholder="افتراضي: مجلد backups في التطبيق"
              disabled={!config.enabled}
              className="h-10 text-xs font-mono"
              dir="ltr"
            />
          </div>

          {/* عدد النسخ المحتفظ بها (التنظيف الذاتي) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">الاحتفاظ بآخر (نسخ):</Label>
            <Select
              value={String(config.retentionCount || 15)}
              onValueChange={(v) => setConfig({ ...config, retentionCount: Number(v) })}
              disabled={!config.enabled}
            >
              <SelectTrigger className="h-10 text-xs">
                <SelectValue placeholder="الحد الأقصى" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="5">آخر 5 نسخ</SelectItem>
                <SelectItem value="10">آخر 10 نسخ</SelectItem>
                <SelectItem value="15">آخر 15 نسخة (موصى به)</SelectItem>
                <SelectItem value="30">آخر 30 نسخة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-border/60">
          <div className="text-xs text-muted-foreground">
            {config.lastBackupDate ? (
              <span>آخر نسخة تم إنشاؤها: <strong className="text-foreground" dir="ltr">{new Date(config.lastBackupDate).toLocaleString("ar-DZ")}</strong> ({formatBytes(config.lastBackupSize || 0)})</span>
            ) : (
              <span>لم يتم إنشاء نسخة تلقائية بعد.</span>
            )}
          </div>

          <Button
            onClick={handleSaveConfig}
            disabled={savingSettings}
            size="sm"
            className="text-xs font-bold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white self-start sm:self-auto"
          >
            {savingSettings ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            حفظ إعدادات النسخ التلقائي
          </Button>
        </div>
      </div>

      {/* ═══ 4. سجل النسخ الاحتياطية السابقة في المجلد المحلي ═══ */}
      <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderArchive className="h-4 w-4 text-primary" />
            <h4 className="font-bold text-sm text-foreground">سجل النسخ الاحتياطية المتوفرة محلياً</h4>
            <Badge variant="secondary" className="text-xs font-mono">
              {history.length} ملفات
            </Badge>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={fetchConfigAndHistory}
            className="text-xs gap-1 h-8"
          >
            <RefreshCw className="h-3 w-3" />
            تحديث القائمة
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
            لا توجد نسخ احتياطية محفوظة في المجلد المحلي حالياً. اضغط «إنشاء نسخة محلية فوراً» بالأعلى.
          </div>
        ) : (
          <div className="max-h-60 overflow-y-auto space-y-2">
            {history.map((file, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    {file.isDb ? <Database className="h-4 w-4 text-emerald-600" /> : <FileJson className="h-4 w-4 text-blue-600" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate font-mono" dir="ltr">
                      {file.filename}
                    </p>
                    <p className="text-[10px] text-muted-foreground" dir="ltr">
                      {new Date(file.date).toLocaleString("ar-DZ")} • {formatBytes(file.size)}
                    </p>
                  </div>
                </div>

                <Badge variant="outline" className="text-[10px] bg-accent/40">
                  محفوظ محلياً
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ 5. الاستيراد والاستعادة الآمنة الشاملة 100% ═══ */}
      <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-amber-600" />
          <h4 className="font-bold text-sm text-foreground">استيراد واستعادة البيانات الشاملة</h4>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px]">
            دعم ملفات .db و .json
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          يمكنك استعادة بيانات النادي كاملة 100% إما من لقطة قاعدة البيانات المباشرة (.db) أو من ملف البيانات المهيكل (.json).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* خيار 1: استعادة ملف قاعدة البيانات المباشر (.db) */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-600" />
                <h5 className="font-bold text-xs text-foreground">استعادة ملف قاعدة البيانات (.db)</h5>
                <Badge variant="secondary" className="text-[9px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  لقطة طبق الأصل 100%
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                استرجاع شامل لكافة الجداول والمنخرطين والحصص والعمليات المالية والملفات. يتم أخذ نسخة أمان احتياطية تلقائياً قبل الاستبدال.
              </p>
            </div>

            <div>
              <input
                type="file"
                accept=".db,.sqlite"
                ref={dbFileRef}
                onChange={handleImportDb}
                className="hidden"
                id="restore-db-input"
              />
              <Button
                onClick={() => dbFileRef.current?.click()}
                disabled={importingDb}
                className="w-full text-xs font-bold gap-2 h-9 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              >
                {importingDb ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
                اختيار ملف قاعدة البيانات (.db) والاستعادة
              </Button>
            </div>
          </div>

          {/* خيار 2: استعادة من ملف JSON */}
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <FileJson className="h-4 w-4 text-blue-600" />
                <h5 className="font-bold text-xs text-foreground">استعادة من ملف البيانات (.json)</h5>
                <Badge variant="secondary" className="text-[9px] bg-blue-500/15 text-blue-700 dark:text-blue-300">
                  دمج أو استبدال
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                استعادة ذكية تشمل كافة الجداول، مع إمكانية دمج السجلات مع البيانات الحالية أو إجراء استبدال كامل للنادي.
              </p>
            </div>

            <div className="space-y-2">
              <Select value={importMode} onValueChange={(v: "merge" | "replace") => setImportMode(v)}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="طريقة الاستيراد" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="merge">دمج مع البيانات الحالية</SelectItem>
                  <SelectItem value="replace">استبدال كامل (حذف القديم)</SelectItem>
                </SelectContent>
              </Select>

              <input
                type="file"
                accept=".json"
                ref={fileRef}
                onChange={handleImportJson}
                className="hidden"
                id="restore-json-input"
              />

              <Button
                onClick={() => fileRef.current?.click()}
                disabled={importing}
                variant="outline"
                className="w-full text-xs font-bold gap-2 h-9 border-blue-500/30 hover:bg-blue-500/10 text-blue-700 dark:text-blue-400"
              >
                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                اختيار ملف واستعادة البيانات (.json)
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

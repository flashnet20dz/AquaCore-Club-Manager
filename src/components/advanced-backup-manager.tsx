"use client";

import { useEffect, useState, useRef } from "react";
import {
  Database,
  Download,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileJson,
  Clock,
  FolderArchive,
  HardDrive,
  RefreshCw,
  Trash2,
  Calendar,
  Check,
  ShieldAlert,
  Sparkles,
  ShieldCheck,
  Layers,
  FileText,
  Users,
  Wallet,
  Image as ImageIcon,
  Zap,
  FileUp,
  HelpCircle,
  Info,
  ArrowRight,
  Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { type AutoBackupConfig } from "@/app/api/backup/auto/route";
import {
  RestoreProgressDialog,
  type RestoreFilePayload,
} from "@/components/restore-progress-dialog";
import { motion, AnimatePresence } from "framer-motion";

interface BackupFile {
  filename: string;
  size: number;
  date: string;
  isDb: boolean;
}

interface InspectedBackup {
  isValid: boolean;
  format?: "sqlite" | "json";
  formatLabel?: string;
  filename?: string;
  size?: number;
  clubName?: string;
  exportedAt?: string;
  counts?: {
    subscribers?: number;
    financialTransactions?: number;
    subscriberPhotos?: number;
    payments?: number;
  };
  summaryText?: string;
  error?: string;
}

export function AdvancedBackupManager() {
  const [activeTab, setActiveTab] = useState<"export" | "restore" | "history" | "schedule">("export");
  const [loading, setLoading] = useState(true);
  const [exportingDb, setExportingDb] = useState(false);
  const [exportingJson, setExportingJson] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [triggeringBackup, setTriggeringBackup] = useState(false);
  const [deletingFilename, setDeletingFilename] = useState<string | null>(null);

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

  // حالة الاستعادة الذكية
  const [restorePayload, setRestorePayload] = useState<RestoreFilePayload | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inspectedInfo, setInspectedInfo] = useState<InspectedBackup | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [restoreMode, setRestoreMode] = useState<"replace" | "merge">("replace");
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      toast.error("تعذر تحميل إعدادات وسجل النسخ الاحتياطي");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigAndHistory();
  }, []);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // 1. تصدير النسخة الشاملة المعتمدة SQLite (.db)
  const handleExportSqlite = async () => {
    setExportingDb(true);
    try {
      const res = await fetch("/api/backup?format=sqlite");
      if (!res.ok) throw new Error("فشل");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aquacore-full-database-${new Date().toISOString().split("T")[0]}.db`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تصدير النسخة الشاملة (.db) بنجاح 100% — تشمل كافة الجداول والصور");
    } catch {
      toast.error("فشل تصدير قاعدة البيانات");
    } finally {
      setExportingDb(false);
    }
  };

  // 2. تصدير ملف JSON مهيكل
  const handleExportJson = async () => {
    setExportingJson(true);
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) throw new Error("فشل");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aquacore-data-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تصدير ملف البيانات المنظم (.json) بنجاح");
    } catch {
      toast.error("فشل التصدير");
    } finally {
      setExportingJson(false);
    }
  };

  // 3. إنشاء نسخة احتياطية فورية في المجلد المحلي
  const handleTriggerInstantBackup = async () => {
    setTriggeringBackup(true);
    try {
      const res = await fetch("/api/backup/auto", { method: "PUT" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل");
      toast.success(`تم إنشاء نسخة محلية بنجاح: ${data.filename}`);
      fetchConfigAndHistory();
    } catch (e: any) {
      toast.error(e?.message || "فشل إنشاء النسخة الاحتياطية");
    } finally {
      setTriggeringBackup(false);
    }
  };

  // 4. حفظ إعدادات النسخ الاحتياطي التلقائي
  const handleSaveConfig = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/backup/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("فشل");
      toast.success("تم حفظ إعدادات النسخ الاحتياطي والجدولة بنجاح");
    } catch {
      toast.error("تعذر حفظ الإعدادات");
    } finally {
      setSavingSettings(false);
    }
  };

  // 5. حذف نسخة قديمة من السيرفر
  const handleDeleteBackup = async (filename: string) => {
    if (!confirm(`هل أنت متأكد من حذف النسخة الاحتياطية "${filename}" نهائياً من السيرفر؟`)) return;
    setDeletingFilename(filename);
    try {
      const res = await fetch(`/api/backup/auto?filename=${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الحذف");
      toast.success("تم حذف النسخة بنجاح");
      fetchConfigAndHistory();
    } catch (e: any) {
      toast.error(e?.message || "تعذر حذف الملف");
    } finally {
      setDeletingFilename(null);
    }
  };

  // 6. تحميل نسخة من السيرفر
  const handleDownloadBackup = (filename: string) => {
    window.location.href = `/api/backup/auto?download=${encodeURIComponent(filename)}`;
  };

  // 7. استعادة مباشرة من السيرفر بنقرة واحدة
  const handleRestoreFromHistory = (file: BackupFile) => {
    setRestorePayload({
      localFilename: file.filename,
      localFileSize: file.size,
      targetEndpoint: "/api/backup/restore-local",
      defaultMode: "replace",
    });
  };

  // 8. فحص ومعاينة الملف المرفوع في منطقة الاستعادة
  const inspectFile = async (file: File) => {
    setSelectedFile(file);
    setInspecting(true);
    setInspectedInfo(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/backup/inspect", {
        method: "POST",
        body: formData,
      });
      const data: InspectedBackup = await res.json();
      setInspectedInfo(data);
      if (data.isValid) {
        toast.success("تم فحص وتوثيق محتوى النسخة بنجاح");
      } else {
        toast.error(data.error || "الملف غير صالح أو غير مدعوم");
      }
    } catch {
      toast.error("تعذر فحص الملف المرفوع");
    } finally {
      setInspecting(false);
    }
  };

  // معالجة اختيار الملف
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      inspectFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // معالجة السحب والإفلات
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      inspectFile(file);
    }
  };

  // تأكيد وبدء الاستعادة للملف المرفوع
  const handleStartRestoration = () => {
    if (!selectedFile) {
      toast.error("يرجى اختيار ملف النسخة الاحتياطية أولاً");
      return;
    }
    setRestorePayload({
      file: selectedFile,
      targetEndpoint: "/api/backup",
      defaultMode: restoreMode,
    });
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* ═════════ 1. الترويسة التنفيذية ═════════ */}
      <div className="relative overflow-hidden rounded-3xl border border-indigo-500/30 bg-gradient-to-l from-indigo-950/80 via-slate-900/90 to-slate-950 p-6 text-white shadow-xl shadow-indigo-950/30">
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-teal-400 via-sky-400 to-indigo-500" />
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 shrink-0">
              <Database className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  مركز النسخ الاحتياطي وحماية البيانات الموحد
                </h2>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 font-bold text-[11px] gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  حماية واستعادة شاملة 100%
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                تنزيل وحفظ كافة بيانات النادي بضغطة زر، الاستعادة الذكية الآمنة، والجدولة التلقائية مع أخذ لقطة أمان احتياطية قبل كل عملية استرجاع.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={handleTriggerInstantBackup}
              disabled={triggeringBackup}
              className="h-10 px-4 text-xs font-bold gap-2 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white rounded-xl shadow-md shadow-teal-600/20 cursor-pointer"
            >
              {triggeringBackup ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>جاري النسخ...</span>
                </>
              ) : (
                <>
                  <HardDrive className="h-4 w-4" />
                  <span>إنشاء نسخة بالسيرفر فوراً</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* شريط الإحصائيات السريع */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-white/10 text-xs">
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
            <span className="text-white/60 block text-[11px]">حالة الحماية:</span>
            <span className="font-bold text-emerald-300 flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> مؤمنة بنسبة 100%
            </span>
          </div>

          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
            <span className="text-white/60 block text-[11px]">النسخ المحفوظة محلياً:</span>
            <span className="font-bold text-white font-mono mt-0.5 block">{history.length} ملفات</span>
          </div>

          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
            <span className="text-white/60 block text-[11px]">الجدولة التلقائية:</span>
            <span className={`font-bold mt-0.5 block ${config.enabled ? "text-emerald-300" : "text-amber-300"}`}>
              {config.enabled ? `نشطة (${config.interval === "daily" ? "يومياً 22:00" : config.interval})` : "غير مفعلة"}
            </span>
          </div>

          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
            <span className="text-white/60 block text-[11px]">آخر نسخة تم إنشاؤها:</span>
            <span className="font-bold text-white/90 truncate block mt-0.5" dir="ltr">
              {config.lastBackupDate ? new Date(config.lastBackupDate).toLocaleDateString("ar-DZ") : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* ═════════ 2. التبويبات الرئيسية الأربعة ═════════ */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 h-auto p-1 bg-muted/60 rounded-2xl border border-border/60">
          <TabsTrigger
            value="export"
            className="h-10 rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
          >
            <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>أخذ وتنزيل نسخة احتياطية</span>
          </TabsTrigger>

          <TabsTrigger
            value="restore"
            className="h-10 rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
          >
            <Upload className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span>الاستعادة الشاملة الذكية</span>
          </TabsTrigger>

          <TabsTrigger
            value="history"
            className="h-10 rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
          >
            <FolderArchive className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>سجل النسخ بالسيرفر ({history.length})</span>
          </TabsTrigger>

          <TabsTrigger
            value="schedule"
            className="h-10 rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
          >
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span>الجدولة والحماية التلقائية</span>
          </TabsTrigger>
        </TabsList>

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* التبويب 1: أخذ وتنزيل نسخة احتياطية                           */}
        {/* ═════════════════════════════════════════════════════════════ */}
        <TabsContent value="export" className="space-y-4 m-0 focus-visible:outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* البطاقة الذهبية / الزمردية الرئيسية (Master Backup) */}
            <div className="lg:col-span-2 rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 via-card to-card p-6 space-y-5 shadow-sm relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
                    <Database className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-base sm:text-lg text-foreground">
                        النسخة الاحتياطية الشاملة المعتمدة (Full Master Backup)
                      </h3>
                      <Badge className="bg-emerald-600 text-white font-bold text-[10px]">
                        موصى بها 100%
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      الصيغة الأصلية الشاملة لقاعدة البيانات (.db) — لقطة طبق الأصل متوافقة تماماً مع أي جهاز أو سيرفر.
                    </p>
                  </div>
                </div>
              </div>

              {/* قائمة الشمولية والتغطية */}
              <div className="rounded-2xl border border-border/80 bg-background/60 p-4 space-y-2.5">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  تغطية كاملة وشاملة لكافة أقسام النادي بدون أي استثناء:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                  {[
                    "كافة المنخرطين، الملفات، والصور الشخصية Base64",
                    "الدفتر المالي المحاسبي الموحد والعمليات والمداخيل",
                    "سجلات الحضور بالباركود، رموز QR، وجدول المسبح",
                    "تجديدات الاشتراكات، الإعفاءات، وعقود السباحين",
                    "عمال وموظفي المسبح، ساعات العمل، وأجور العمال",
                    "إغلاقات المسبح، حصص التعويض، وقوائم الانتظار",
                    "سجلات الوارد الإداري وإعدادات الترويسة وهوية النادي",
                    "حسابات المستخدمين والصلاحيات والترخيص المعتمد",
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-[11px] leading-tight">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={handleExportSqlite}
                  disabled={exportingDb}
                  className="w-full h-12 text-sm font-bold gap-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  {exportingDb ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>جاري إعداد وتحميل النسخة الشاملة...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-5 w-5" />
                      <span>تنزيل النسخة الاحتياطية الشاملة الآن (.db)</span>
                    </>
                  )}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center mt-2">
                  يتم حفظ الملف مباشرة على حاسوبك، ويمكنك نقله إلى فلاش ديسك خارجي لحمايته.
                </p>
              </div>
            </div>

            {/* البطاقة الثانوية: تصدير JSON مهيكل */}
            <div className="rounded-3xl border border-border/80 bg-card p-6 space-y-4 shadow-sm flex flex-col justify-between">
              <div className="space-y-3">
                <div className="h-10 w-10 rounded-2xl bg-blue-500/15 text-blue-600 flex items-center justify-center shrink-0">
                  <FileJson className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground">
                    تصدير مهيكل بصيغة JSON
                  </h4>
                  <Badge variant="outline" className="text-[10px] mt-1 text-blue-600 border-blue-500/30">
                    ملف نصي منظم
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  ملف بيانات JSON مفتوح وقابل للقراءة البرمجية. مناسب للنقل الخفيف بين البرامج أو التحليل الخارجي للبيانات المالية وسجلات المشتركين.
                </p>
              </div>

              <div className="pt-2">
                <Button
                  onClick={handleExportJson}
                  disabled={exportingJson}
                  variant="outline"
                  className="w-full h-10 text-xs font-bold gap-2 border-blue-500/30 hover:bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-xl cursor-pointer"
                >
                  {exportingJson ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  <span>تصدير ملف البيانات (.json)</span>
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* التبويب 2: الاستعادة الشاملة الذكية                            */}
        {/* ═════════════════════════════════════════════════════════════ */}
        <TabsContent value="restore" className="space-y-5 m-0 focus-visible:outline-none">
          {/* تنبيه الأمان التلقائي */}
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-4 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block text-sm">حماية تلقائية 100% قبل كل استعادة:</span>
              <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                يقوم النظام تلقائياً بأخذ نسخة أمان احتياطية كاملة من قاعدة بيانات النادي الحالية قبل بدء الاستبدال. إذا حدث أي طارئ، بياناتك الحالية محفوظة ومحمية تلقائياً.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* منطقة السحب والإفلات الذكية الموحدة */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-3xl border-2 border-dashed p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[260px] gap-3 ${
                isDragOver
                  ? "border-teal-500 bg-teal-500/10 scale-[1.01]"
                  : "border-border/80 hover:border-teal-500/50 hover:bg-muted/30 bg-card"
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".db,.sqlite,.json"
                className="hidden"
              />

              <div className="h-14 w-14 rounded-2xl bg-teal-500/15 text-teal-600 flex items-center justify-center shadow-inner">
                <FileUp className="h-7 w-7" />
              </div>

              <div>
                <h4 className="font-bold text-sm text-foreground">
                  اسحب وأفلت ملف النسخة الاحتياطية هنا
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  أو انقر لاختيار الملف من جهازك (يدعم صيغ <span className="font-mono font-bold text-foreground">.db</span> أو <span className="font-mono font-bold text-foreground">.json</span> تلقائياً)
                </p>
              </div>

              <Badge variant="secondary" className="text-[10px] mt-1 font-mono">
                كشف وتوثيق آلي للصيغة
              </Badge>
            </div>

            {/* بطاقة الفحص والمعاينة قبل الاستعادة */}
            <div className="rounded-3xl border border-border/80 bg-card p-6 space-y-4 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-teal-600" />
                    <h4 className="font-bold text-sm text-foreground">
                      المعاينة والتحقق قبل الاستعادة
                    </h4>
                  </div>
                  {inspecting && (
                    <Badge variant="outline" className="text-xs gap-1 font-mono">
                      <Loader2 className="h-3 w-3 animate-spin" /> جاري الفحص...
                    </Badge>
                  )}
                </div>

                {selectedFile ? (
                  <div className="mt-4 space-y-3">
                    <div className="p-3.5 rounded-2xl border border-border/60 bg-muted/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground font-mono truncate max-w-[200px]" dir="ltr">
                          {selectedFile.name}
                        </span>
                        <Badge variant="secondary" className="font-mono text-xs">
                          {formatBytes(selectedFile.size)}
                        </Badge>
                      </div>

                      {inspectedInfo && (
                        <div className="pt-2 border-t border-border/40 text-xs space-y-1.5">
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>نوع الحزمة:</span>
                            <span className="font-bold text-teal-600 dark:text-teal-400">
                              {inspectedInfo.formatLabel || "نسخة احتياطية"}
                            </span>
                          </div>
                          {inspectedInfo.clubName && (
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>اسم النادي في النسخة:</span>
                              <span className="font-bold text-foreground truncate max-w-[180px]">
                                {inspectedInfo.clubName}
                              </span>
                            </div>
                          )}
                          {inspectedInfo.counts && (
                            <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px] font-mono">
                              <span className="bg-background/80 p-1.5 rounded-lg border text-center">
                                👥 {inspectedInfo.counts.subscribers || 0} منخرط
                              </span>
                              <span className="bg-background/80 p-1.5 rounded-lg border text-center">
                                💳 {inspectedInfo.counts.financialTransactions || 0} عملية مالية
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* خيار وضع الاستعادة */}
                    <div className="space-y-2 pt-1">
                      <Label className="text-xs font-bold text-foreground">طريقة الاستعادة:</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setRestoreMode("replace")}
                          className={`p-3 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between gap-1 ${
                            restoreMode === "replace"
                              ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500 text-foreground"
                              : "border-border/70 bg-background text-muted-foreground hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                              استبدال كامل 100%
                            </span>
                            {restoreMode === "replace" && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            نسخة طبق الأصل تماماً (موصى به)
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRestoreMode("merge")}
                          className={`p-3 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between gap-1 ${
                            restoreMode === "merge"
                              ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500 text-foreground"
                              : "border-border/70 bg-background text-muted-foreground hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
                              دمج مع الحالي
                            </span>
                            {restoreMode === "merge" && <Check className="h-3.5 w-3.5 text-blue-600" />}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            إضافة السجلات دون حذف القديم
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
                    <Info className="h-8 w-8 mx-auto text-muted-foreground/50" />
                    <p>قم باختيار أو سحب ملف النسخة الاحتياطية لتظهر تفاصيل المعاينة هنا قبل البدء.</p>
                  </div>
                )}
              </div>

              <div className="pt-3">
                <Button
                  onClick={handleStartRestoration}
                  disabled={!selectedFile || inspecting}
                  className="w-full h-11 text-xs sm:text-sm font-bold gap-2 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  <span>بدء الاستعادة الشاملة للبيانات الآن</span>
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* التبويب 3: سجل النسخ المحفوظة بالسيرفر                        */}
        {/* ═════════════════════════════════════════════════════════════ */}
        <TabsContent value="history" className="space-y-4 m-0 focus-visible:outline-none">
          <div className="rounded-3xl border border-border/80 bg-card p-6 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <FolderArchive className="h-5 w-5 text-indigo-600" />
                <div>
                  <h4 className="font-bold text-sm text-foreground">
                    سجل النسخ الاحتياطية المتوفرة بالسيرفر
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    مخزنة محلياً في مجلد backups. يمكنك استعادتها فوراً بضغطة زر أو تنزيلها أو حذف القديم.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchConfigAndHistory}
                  className="text-xs gap-1.5 h-8 rounded-xl cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>تحديث</span>
                </Button>

                <Button
                  size="sm"
                  onClick={handleTriggerInstantBackup}
                  disabled={triggeringBackup}
                  className="text-xs font-bold gap-1.5 h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl cursor-pointer"
                >
                  {triggeringBackup ? <Loader2 className="h-3 w-3 animate-spin" /> : <HardDrive className="h-3 w-3" />}
                  <span>إنشاء نسخة جديدة</span>
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : history.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center text-xs text-muted-foreground space-y-2">
                <FolderArchive className="h-8 w-8 mx-auto text-muted-foreground/40" />
                <p className="font-medium">لا توجد نسخ احتياطية محفوظة في السيرفر حالياً.</p>
                <p className="text-[11px]">اضغط على «إنشاء نسخة جديدة» لإنشاء أول لقطة أمان احتياطية فورية.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {history.map((file, i) => (
                  <div
                    key={i}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-border/70 bg-muted/20 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-background border border-border/80 text-foreground flex items-center justify-center shrink-0 shadow-2xs">
                        {file.isDb ? (
                          <Database className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <FileJson className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-foreground truncate font-mono" dir="ltr">
                            {file.filename}
                          </p>
                          <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
                            {file.isDb ? "SQLite .db" : "JSON"}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground" dir="ltr">
                          {new Date(file.date).toLocaleString("ar-DZ")} • {formatBytes(file.size)}
                        </p>
                      </div>
                    </div>

                    {/* أزرار الإجراءات الثلاثة السريعة */}
                    <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                      {/* استعادة فورية */}
                      <Button
                        size="sm"
                        onClick={() => handleRestoreFromHistory(file)}
                        className="h-8 px-3 text-xs font-bold gap-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-xs cursor-pointer"
                        title="استعادة هذه النسخة مباشرة إلى قاعدة البيانات الحالية"
                      >
                        <Zap className="h-3 w-3" />
                        <span>استعادة فورية</span>
                      </Button>

                      {/* تحميل إلى الجهاز */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadBackup(file.filename)}
                        className="h-8 px-2.5 text-xs rounded-xl cursor-pointer"
                        title="تحميل الملف إلى جهازك"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>

                      {/* حذف */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteBackup(file.filename)}
                        disabled={deletingFilename === file.filename}
                        className="h-8 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl cursor-pointer"
                        title="حذف هذه النسخة من السيرفر"
                      >
                        {deletingFilename === file.filename ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* التبويب 4: الجدولة التلقائية والحماية الذكية                  */}
        {/* ═════════════════════════════════════════════════════════════ */}
        <TabsContent value="schedule" className="space-y-4 m-0 focus-visible:outline-none">
          <div className="rounded-3xl border border-border/80 bg-card p-6 space-y-5 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-indigo-600" />
                  <h4 className="font-bold text-sm text-foreground">
                    إعدادات الجدولة التلقائية لحماية البيانات
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  أخذ نسخ احتياطية دورية تلقائياً دون تدخل يدوي للحفاظ على بيانات المنخرطين والاشتراكات.
                </p>
              </div>

              <div className="flex items-center gap-2.5 bg-muted/40 px-3.5 py-1.5 rounded-2xl border border-border/60">
                <Label className="text-xs font-bold text-foreground">تفعيل النسخ التلقائي:</Label>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(c) => setConfig({ ...config, enabled: c })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* تردد وتوقيت النسخ */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">تردد وتوقيت النسخ:</Label>
                <Select
                  value={config.interval}
                  onValueChange={(v: any) => setConfig({ ...config, interval: v })}
                  disabled={!config.enabled}
                >
                  <SelectTrigger className="h-10 text-xs rounded-xl bg-background">
                    <SelectValue placeholder="اختر التردد" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="every6h">كل 6 ساعات (للنوادي النشطة)</SelectItem>
                    <SelectItem value="daily">يومياً عند إغلاق النادي (22:00) — موصى به</SelectItem>
                    <SelectItem value="weekly">أسبوعياً (كل سبت)</SelectItem>
                    <SelectItem value="onClose">عند نهاية الوردية اليومية</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  التوقيت الأفضل هو عند إغلاق النادي يومياً بعد تسجيل كافة الاشتراكات والحضور.
                </p>
              </div>

              {/* مجلد الحفظ */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">مسار مجلد الحفظ (أو فلاش ديسك USB):</Label>
                <Input
                  value={config.destination}
                  onChange={(e) => setConfig({ ...config, destination: e.target.value })}
                  placeholder="افتراضي: مجلد backups"
                  disabled={!config.enabled}
                  className="h-10 text-xs font-mono rounded-xl bg-background"
                  dir="ltr"
                />
                <p className="text-[11px] text-muted-foreground">
                  يمكنك كتابة مسار فلاش ميموري (مثال: <span className="font-mono text-foreground font-bold">E:\AquaCoreBackups</span>)
                </p>
              </div>

              {/* عدد النسخ والتنظيف الذاتي */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">التنظيف الذاتي (الاحتفاظ بآخر):</Label>
                <Select
                  value={String(config.retentionCount || 15)}
                  onValueChange={(v) => setConfig({ ...config, retentionCount: Number(v) })}
                  disabled={!config.enabled}
                >
                  <SelectTrigger className="h-10 text-xs rounded-xl bg-background">
                    <SelectValue placeholder="الحد الأقصى للنسخ" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="5">آخر 5 نسخ</SelectItem>
                    <SelectItem value="10">آخر 10 نسخ</SelectItem>
                    <SelectItem value="15">آخر 15 نسخة (توازن مثالي)</SelectItem>
                    <SelectItem value="30">آخر 30 نسخة (شامل لشهر كامل)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  يحذف النسخ الأقدم تلقائياً لمنع استهلاك مساحة القرص الصلب.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-border/60">
              <div className="text-xs text-muted-foreground">
                المسار المعتمد الفعلي: <span className="font-mono font-bold text-foreground" dir="ltr">{defaultDir || "backups"}</span>
              </div>

              <Button
                onClick={handleSaveConfig}
                disabled={savingSettings}
                className="h-10 px-5 text-xs font-bold gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs cursor-pointer"
              >
                {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                <span>حفظ إعدادات الجدولة والتنظيف</span>
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ═════════ 3. نافذة الاستعادة التفاعلية المباشرة ═════════ */}
      <RestoreProgressDialog
        payload={restorePayload}
        onClose={() => setRestorePayload(null)}
        onSuccess={fetchConfigAndHistory}
      />
    </div>
  );
}

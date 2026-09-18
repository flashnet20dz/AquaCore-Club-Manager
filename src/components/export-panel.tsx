"use client";

/**
 * export-panel.tsx — مركز تصدير البيانات والتقارير الرسمية الموحدة
 * ══════════════════════════════════════════════════════════════════════════════
 * 1. حذف التكرار: دمج مركز التقارير وخيارات التصدير في قائمة موحدة مصنفة.
 * 2. تطبيق الترويسة الموحدة (EN-TÊTE) الرسمية على كافة المستندات تلقائياً.
 * 3. تصنيف دقيق حسب كل قائمة (المنخرطون، المالية، السباحة، الموارد البشرية، الإحصائيات).
 * 4. نافذة تحميل وصيغ متطابقة مع صفحة حقوق المركب (PDF رسمي، Word، Excel، طباعة).
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileSpreadsheet, FileText, Users, Calendar, RefreshCw, Wallet,
  Download, Loader2, ShieldCheck, Building2, FileType,
  PenTool, Check, Printer, BarChart3,
  Droplet, Clock, Crown, Tag, Activity, Search,
  UserCheck, UserX, AlertCircle, HandCoins, Briefcase, FileClock,
  TrendingUp, Receipt, ListOrdered, ScrollText, Filter, X,
  CalendarRange, Stamp, Sparkles, ChevronRight, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePageNavigation } from "@/hooks/use-page-navigation";

export type ExportCategory = "all" | "subscribers" | "financial" | "operations" | "hr" | "stats";

export interface ExportDataset {
  type: string;
  reportId?: string; // لربطه بنافذة معاينة التقرير الكامل
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  category: "subscribers" | "financial" | "operations" | "hr" | "stats";
  isTimeFiltered?: boolean;
}

// ════════════ توقيعات المستندات الرسمية (أسفل الوثيقة) ════════════
const SIGNATURE_OPTIONS = [
  { id: "president", label: "إمضاء رئيس الجمعية" },
  { id: "branch", label: "رئيس الفرع" },
  { id: "manager", label: "مدير الوحدة" },
  { id: "compound", label: "مدير ديوان المركب" },
  { id: "insurance", label: "تأشيرة التأمين" },
];

// ════════════ 20 قائمة رسمية موحدة خالية من التكرار ════════════
const DATASETS: ExportDataset[] = [
  // ── 1. قوائم المنخرطين والاشتراكات (Subscribers) ──
  {
    type: "subscribers-all",
    reportId: "subscribers-list",
    title: "قائمة المنخرطين الكاملة",
    description: "السجل الشامل لكافة المنخرطين المسجلين في النادي مع بيانات الاتصال والاشتراك",
    icon: Users,
    color: "from-teal-500/15 to-teal-500/5 border-teal-500/30 text-teal-700 dark:text-teal-400",
    category: "subscribers",
  },
  {
    type: "subscribers-active",
    reportId: "subscribers-list",
    title: "قائمة المنخرطين النشطين",
    description: "الاشتراكات السارية المفعول والمؤهلة لدخول المسبح والتدريبات",
    icon: UserCheck,
    color: "from-emerald-500/15 to-emerald-500/5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
    category: "subscribers",
  },
  {
    type: "subscribers-expired",
    reportId: "expired",
    title: "قائمة الاشتراكات المنتهية",
    description: "المنخرطون الذين انتهت صلاحية اشتراكاتهم ويحتاجون إلى تجديد",
    icon: UserX,
    color: "from-rose-500/15 to-rose-500/5 border-rose-500/30 text-rose-700 dark:text-rose-400",
    category: "subscribers",
  },
  {
    type: "subscribers-expiring",
    reportId: "expired",
    title: "اشتراكات قريبة الانتهاء",
    description: "الاشتراكات التي تنتهي صلاحيتها خلال 30 يوماً القادمة",
    icon: AlertCircle,
    color: "from-amber-500/15 to-amber-500/5 border-amber-500/30 text-amber-700 dark:text-amber-400",
    category: "subscribers",
  },
  {
    type: "insurance",
    reportId: "insurance-list",
    title: "قائمة التأمين الرياضي",
    description: "كشف المنخرطين المؤمنين السنوي الموجه لشركات التأمين والاتحادية",
    icon: ShieldCheck,
    color: "from-cyan-500/15 to-cyan-500/5 border-cyan-500/30 text-cyan-700 dark:text-cyan-400",
    category: "subscribers",
  },
  {
    type: "waitlist",
    title: "قائمة الانتظار",
    description: "قائمة المسجلين في لوائح الانتظار حسب الفئات والتوقيتات",
    icon: ListOrdered,
    color: "from-violet-500/15 to-violet-500/5 border-violet-500/30 text-violet-700 dark:text-violet-400",
    category: "subscribers",
  },

  // ── 2. التقارير المالية والمدفوعات (Financial) ──
  {
    type: "payments",
    title: "كشف المدفوعات والواردات",
    description: "سجل المدفوعات والمقبوضات المالية الواردة للنادي عبر الخزينة",
    icon: Wallet,
    color: "from-emerald-500/15 to-emerald-500/5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
    category: "financial",
    isTimeFiltered: true,
  },
  {
    type: "financial-stats",
    reportId: "financial",
    title: "التقرير المالي الشامل",
    description: "ملخص الإيرادات، المصاريف، صافي الرصيد، والمؤشرات المالية العامة",
    icon: TrendingUp,
    color: "from-teal-500/15 to-teal-500/5 border-teal-500/30 text-teal-700 dark:text-teal-400",
    category: "financial",
  },
  {
    type: "monthly-revenue",
    reportId: "financial",
    title: "تقرير الإيرادات الشهرية",
    description: "جدول الإيرادات التفصيلية موزعة حسب الشهور والمواسم",
    icon: BarChart3,
    color: "from-sky-500/15 to-sky-500/5 border-sky-500/30 text-sky-700 dark:text-sky-400",
    category: "financial",
    isTimeFiltered: true,
  },
  {
    type: "expenses",
    title: "تقرير المصاريف والتشغيل",
    description: "سجل المصاريف والنفقات حسب الفئات وبنود الصرف",
    icon: Receipt,
    color: "from-rose-500/15 to-rose-500/5 border-rose-500/30 text-rose-700 dark:text-rose-400",
    category: "financial",
    isTimeFiltered: true,
  },
  {
    type: "compensations",
    title: "كشف التعويضات والأجور",
    description: "سجل التعويضات المالية المصروفة للموظفين والمدربين والمنقذين",
    icon: HandCoins,
    color: "from-amber-500/15 to-amber-500/5 border-amber-500/30 text-amber-700 dark:text-amber-400",
    category: "financial",
    isTimeFiltered: true,
  },
  {
    type: "renewals",
    reportId: "renewals",
    title: "سجل التجديدات المالية",
    description: "كشف تجديدات الاشتراكات والمبالغ المحصلة منها خلال الفترة",
    icon: RefreshCw,
    color: "from-fuchsia-500/15 to-fuchsia-500/5 border-fuchsia-500/30 text-fuchsia-700 dark:text-fuchsia-400",
    category: "financial",
    isTimeFiltered: true,
  },

  // ── 3. السباحة والحضور والتشغيل (Operations) ──
  {
    type: "attendance",
    reportId: "attendance",
    title: "سجل حضور المنخرطين",
    description: "سجل الدخول اليومي للمسبح مع إحصائيات الحضور والغياب",
    icon: Calendar,
    color: "from-sky-500/15 to-sky-500/5 border-sky-500/30 text-sky-700 dark:text-sky-400",
    category: "operations",
    isTimeFiltered: true,
  },
  {
    type: "work-hours",
    title: "كشف ساعات العمل والحراسة",
    description: "سجل ساعات العمل والحراسة المسجلة للمدربين والمنقذين والعمال",
    icon: FileClock,
    color: "from-teal-500/15 to-teal-500/5 border-teal-500/30 text-teal-700 dark:text-teal-400",
    category: "operations",
    isTimeFiltered: true,
  },
  {
    type: "dist-swimming-days",
    reportId: "swimming-days",
    title: "توزيع أيام السباحة والأفواج",
    description: "توزيع المنخرطين حسب الأيام المزدوجة ومجموعات السباحة المعتمدة",
    icon: CalendarRange,
    color: "from-indigo-500/15 to-indigo-500/5 border-indigo-500/30 text-indigo-700 dark:text-indigo-400",
    category: "operations",
  },
  {
    type: "dist-time-slots",
    reportId: "swimming-times",
    title: "توزيع أوقات وحصص السباحة",
    description: "أعداد المنخرطين في كل حصة وتوقيت زمني على مدار اليوم",
    icon: Clock,
    color: "from-blue-500/15 to-blue-500/5 border-blue-500/30 text-blue-700 dark:text-blue-400",
    category: "operations",
  },

  // ── 4. الموارد البشرية والموظفين والعقود (HR) ──
  {
    type: "employees",
    reportId: "coaches",
    title: "كشف الموظفين والمدربين",
    description: "بيانات الطاقم الفني والإداري، المدربين، المنقذين، والعمال",
    icon: Briefcase,
    color: "from-purple-500/15 to-purple-500/5 border-purple-500/30 text-purple-700 dark:text-purple-400",
    category: "hr",
  },
  {
    type: "contracts",
    title: "كشف العقود والاتفاقيات",
    description: "سجل العقود المبرمة مع الموظفين والجهات الخارجية وتواريخ سريانها",
    icon: ScrollText,
    color: "from-slate-500/15 to-slate-500/5 border-slate-500/30 text-slate-700 dark:text-slate-400",
    category: "hr",
  },

  // ── 5. الإحصائيات والتوزيعات (Stats) ──
  {
    type: "dist-age-categories",
    reportId: "age-categories",
    title: "توزيع الفئات العمرية",
    description: "إحصائية تصنيف المنخرطين حسب الفئات: أصاغر، أشبال، أواسط، أكابر",
    icon: Crown,
    color: "from-violet-500/15 to-violet-500/5 border-violet-500/30 text-violet-700 dark:text-violet-400",
    category: "stats",
  },
  {
    type: "dist-subscription-types",
    reportId: "subscription-types",
    title: "توزيع أنواع الاشتراكات",
    description: "إحصائية عدد ونسب المنخرطين حسب صيغ الاشتراك المعتمدة",
    icon: Tag,
    color: "from-cyan-500/15 to-cyan-500/5 border-cyan-500/30 text-cyan-700 dark:text-cyan-400",
    category: "stats",
  },
  {
    type: "dist-blood-types",
    reportId: "blood-types",
    title: "توزيع فصائل الدم",
    description: "الكشف الطبي الإحصائي لفصائل دم المنخرطين لاستخدامات الطوارئ",
    icon: Droplet,
    color: "from-pink-500/15 to-pink-500/5 border-pink-500/30 text-pink-700 dark:text-pink-400",
    category: "stats",
  },
];

const CATEGORY_TABS: { id: ExportCategory; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "all", label: "جميع القوائم", icon: Sparkles },
  { id: "subscribers", label: "قوائم المنخرطين", icon: Users },
  { id: "financial", label: "التقارير المالية", icon: Wallet },
  { id: "operations", label: "السباحة والتشغيل", icon: Activity },
  { id: "hr", label: "الموارد البشرية", icon: Briefcase },
  { id: "stats", label: "الإحصائيات والتوزيع", icon: BarChart3 },
];

interface SubscriberLite {
  id: string;
  fileNumber: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  subscriptionType: string;
  paymentStatus: string;
  renewalStatus?: string;
}

export function ExportPanel({ onOpenReport }: { onOpenReport?: (id: string) => void }) {
  // جلب التسميات المخصصة المتزامنة مع الإعدادات
  const { getEffectiveExportTitle, getEffectivePageLabel } = usePageNavigation();

  // حالة التحميل والتنزيل
  const [downloading, setDownloading] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<ExportCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // الفلاتر المشتركة
  const [selectedSigs, setSelectedSigs] = useState<string[]>(["president", "branch"]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [subscribersTotal, setSubscribersTotal] = useState<number | null>(null);

  // نافذة تحديد المنخرطين
  const [subDialogOpen, setSubDialogOpen] = useState(false);

  // نافذة التحميل والصيغ الرسمية (Modal مثل صفحة حقوق المركب)
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [activeDataset, setActiveDataset] = useState<ExportDataset | null>(null);

  const toggleSig = (id: string) => {
    setSelectedSigs((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  };

  // جلب إجمالي المنخرطين مرة واحدة عند التحميل
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/subscribers?page=1&limit=1");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.pagination?.total != null) {
          setSubscribersTotal(data.pagination.total);
        }
      } catch {
        /* silent */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // بناء القوائم مع العناوين المخصصة المتزامنة مع مسميات الصفحات المعدلة
  const dynamicDatasets = useMemo<ExportDataset[]>(() => {
    return DATASETS.map((item) => ({
      ...item,
      title: getEffectiveExportTitle(item.type, item.title),
    }));
  }, [getEffectiveExportTitle]);

  // بناء معلمات الطلب لتصدير الملف مع تضمين العنوان المخصص
  const buildParams = (dataset: ExportDataset, format: "pdf" | "xlsx" | "word" | "print") => {
    const params = new URLSearchParams({
      format: format === "print" ? "pdf" : format,
      type: dataset.type,
      title: dataset.title,
    });
    if (selectedSigs.length > 0 && (format === "pdf" || format === "word" || format === "print")) {
      params.set("sigs", selectedSigs.join(","));
    }
    if (selectedIds.size > 0 && dataset.category === "subscribers") {
      params.set("ids", Array.from(selectedIds).join(","));
    }
    if (dataset.isTimeFiltered) {
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
    }
    return params;
  };

  // تنفيذ عملية التصدير والتنزيل
  const handleExport = async (dataset: ExportDataset, format: "pdf" | "xlsx" | "word" | "print") => {
    // الطباعة المباشرة: فتح PDF في نافذة جديدة
    if (format === "print") {
      const params = buildParams(dataset, "print");
      window.open(`/api/export?${params.toString()}`, "_blank");
      toast.info("تم فتح الوثيقة للطباعة المباشرة — اضغط Ctrl+P داخل النافذة");
      setDownloadModalOpen(false);
      return;
    }

    const params = buildParams(dataset, format);
    setDownloading(`${dataset.type}-${format}`);
    try {
      const res = await fetch(`/api/export?${params.toString()}`);
      if (!res.ok) throw new Error("فشل التصدير");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeTitle = dataset.title.replace(/[\\/:*?"<>|]/g, "_").trim();
      const filename = res.headers.get("Content-Disposition")?.split('filename="')[1]?.split('"')[0]
        || `AquaCore_${safeTitle}.${format === "word" ? "doc" : format}`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`تم تحميل ملف (${dataset.title}) بنجاح`);
      setDownloadModalOpen(false);
    } catch {
      toast.error("تعذر تصدير الملف، يرجى المحاولة مجدداً");
    } finally {
      setDownloading(null);
    }
  };

  // فتح نافذة التحميل والصيغ الرسمية لقائمة معينة
  const openDownloadModal = (dataset: ExportDataset) => {
    setActiveDataset(dataset);
    setDownloadModalOpen(true);
  };

  // تصفية القوائم حسب التصنيف والبحث مع استخدام العناوين المتزامنة
  const filteredDatasets = useMemo(() => {
    return dynamicDatasets.filter((item) => {
      const matchCat = activeCategory === "all" || item.category === activeCategory;
      const matchSearch = !searchQuery.trim() ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [dynamicDatasets, activeCategory, searchQuery]);

  // تبويبات الفئات مع التسمية المتزامنة
  const dynamicCategoryTabs = useMemo(() => {
    const subLabel = getEffectivePageLabel("subscribers");
    return CATEGORY_TABS.map((tab) => {
      if (tab.id === "subscribers" && subLabel && subLabel !== "المنخرطون") {
        return { ...tab, label: `قوائم ${subLabel}` };
      }
      return tab;
    });
  }, [getEffectivePageLabel]);

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* 1. ترويسة الصفحة الرسمية الموحدة مع تأكيد ترويسة EN-TÊTE */}
      <div className="relative overflow-hidden rounded-3xl border border-teal-500/30 bg-gradient-to-br from-card via-card to-teal-500/5 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 shadow-inner">
              <Download className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                  مركز تصدير البيانات والتقارير الرسمية
                </h1>
                <Badge className="bg-teal-600 text-white text-xs px-2.5 py-0.5 font-bold">
                  ترويسة رسمية موحدة (EN-TÊTE)
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                تصدير كافة جداول وسجلات النادي بصيغ رسمية معتمدة (<strong>PDF رسمي، Word، Excel، طباعة</strong>) مع تطبيق الترويسة الموحدة والشعارات والإمضاءات تلقائياً.
              </p>
            </div>
          </div>

          {/* تنبيه بالترويسة الموحدة المعتمدة */}
          <div className="rounded-2xl border border-teal-500/30 bg-teal-500/10 p-3.5 flex items-center gap-3 text-xs max-w-md">
            <Building2 className="h-5 w-5 text-teal-600 shrink-0" />
            <div className="leading-tight">
              <p className="font-bold text-teal-900 dark:text-teal-200">الترويسة الرسمية الموحدة مفعلة</p>
              <p className="text-[11px] text-teal-800/80 dark:text-teal-300/80 mt-0.5">
                تُطبع الترويسة وشعارات النادي والوزارة والرقم المرجعي على جميع الملفات المستخرجة تلقائياً.
              </p>
            </div>
          </div>
        </div>

        {/* كروت المؤشرات السريعة */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-5 border-t border-border/60">
          <div className="p-3.5 rounded-2xl bg-card/60 border border-border/60 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">إجمالي القوائم المتاحة</p>
              <p className="text-lg font-black text-foreground">{DATASETS.length} <span className="text-xs font-normal text-muted-foreground">قائمة رسمية</span></p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-card/60 border border-border/60 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">إجمالي المنخرطين في النظام</p>
              <p className="text-lg font-black text-foreground">{subscribersTotal ?? "…"} <span className="text-xs font-normal text-muted-foreground">منخرط</span></p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-card/60 border border-border/60 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
              <Stamp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">الإمضاءات المعتمدة</p>
              <p className="text-lg font-black text-foreground">{selectedSigs.length} <span className="text-xs font-normal text-muted-foreground">توقيعات مفعّلة</span></p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-card/60 border border-border/60 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <Check className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">حالة التحديد المخصص</p>
              <p className="text-lg font-black text-foreground">{selectedIds.size > 0 ? `${selectedIds.size} منخرط` : "تصدير شامل"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. أدوات التحكم والفلترة المشتركة (تحديد الفترة + تخصيص المنخرطين) */}
      <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* فلتر التاريخ والفترة */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <CalendarRange className="h-4 w-4 text-teal-600" />
              <span>فترة التقرير:</span>
            </div>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 w-auto text-xs font-mono font-bold"
              aria-label="تاريخ البداية"
            />
            <span className="text-xs text-muted-foreground font-bold">←</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 w-auto text-xs font-mono font-bold"
              aria-label="تاريخ النهاية"
            />
            {(dateFrom || dateTo) && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-rose-600 hover:bg-rose-500/10"
                onClick={() => { setDateFrom(""); setDateTo(""); }}
              >
                <X className="h-3.5 w-3.5 ml-1" /> مسح الفترة
              </Button>
            )}
          </div>

          {/* تحديد المنخرطين المخصص */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Users className="h-4 w-4 text-teal-600" />
              <span>نطاق المنخرطين:</span>
            </div>
            {selectedIds.size > 0 ? (
              <>
                <Badge className="bg-teal-600 text-white text-xs px-2 py-0.5 font-bold">
                  محدد: {selectedIds.size} من {subscribersTotal ?? "…"}
                </Badge>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setSubDialogOpen(true)}>
                  تعديل التحديد
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs text-rose-600" onClick={() => setSelectedIds(new Set())}>
                  <X className="h-3 w-3 ml-1" /> تصدير الكل
                </Button>
              </>
            ) : (
              <>
                <Badge variant="outline" className="text-xs font-semibold">
                  تصدير جميع المنخرطين ({subscribersTotal ?? "الكل"})
                </Badge>
                <Button size="sm" variant="outline" className="h-8 text-xs font-bold" onClick={() => setSubDialogOpen(true)}>
                  <Filter className="h-3.5 w-3.5 ml-1 text-teal-600" /> تحديد منخرطين معينين
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 3. شريط تصنيف القوائم (حسب كل قائمة — خالي من أي تكرار) + مربع البحث */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* أزرار التبويبات والتصنيفات */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full" role="tablist">
          {dynamicCategoryTabs.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeCategory === tab.id;
            const count = tab.id === "all" ? DATASETS.length : DATASETS.filter((d) => d.category === tab.id).length;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all shrink-0 shadow-sm",
                  isSelected
                    ? "bg-teal-600 text-white border-teal-600 shadow-teal-600/20"
                    : "bg-card text-foreground border-border hover:bg-muted"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
                <span className="text-[10px] opacity-75 font-mono px-1 py-0.2 rounded bg-black/10">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* شريط البحث المباشر */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث في القوائم والتقارير..."
            className="h-9 pr-8 text-xs"
          />
        </div>
      </div>

      {/* 4. شبكة القوائم الموحدة المنظمة (كل قائمة في بطاقة احترافية مستقلة) */}
      {filteredDatasets.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/80 p-12 text-center bg-card/50">
          <FileSpreadsheet className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="text-base font-bold text-foreground">لا توجد قوائم مطابقة للبحث</h3>
          <p className="text-xs text-muted-foreground mt-1">
            جرب تعديل كلمة البحث أو اختيار تصنيف آخر من الشريط أعلاه.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredDatasets.map((dataset, idx) => {
            const Icon = dataset.icon;
            const isDownloadingThis = downloading?.startsWith(dataset.type);

            return (
              <motion.div
                key={dataset.type}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                className={cn(
                  "rounded-2xl border-2 bg-gradient-to-br p-4 flex flex-col justify-between gap-3.5 shadow-sm transition-all hover:shadow-md hover:scale-[1.01]",
                  dataset.color
                )}
              >
                <div>
                  {/* رأس البطاقة والأيقونة والتصنيف */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 dark:bg-black/40 shadow-inner shrink-0">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-foreground leading-tight">
                          {dataset.title}
                        </h3>
                        {dataset.isTimeFiltered && (
                          <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1 mt-0.5">
                            <Clock className="h-2.5 w-2.5" /> تقرير زمني حسب الفترة
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* الوصف الإيضاحي للقائمة */}
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-2">
                    {dataset.description}
                  </p>
                </div>

                {/* أزرار الإجراءات للبطاقة (تحميل وصيغ مثل صفحة حقوق المركب) */}
                <div className="pt-2 border-t border-border/40 space-y-2">
                  <div className="flex items-center gap-2">
                    {/* زر رئيسي يفتح نافذة التحميل والصيغ الرسمية الموحدة */}
                    <Button
                      size="sm"
                      onClick={() => openDownloadModal(dataset)}
                      className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs h-8 gap-1.5 shadow-sm"
                    >
                      <Download className="h-3.5 w-3.5" />
                      تحميل وتصدير رسمي
                    </Button>

                    {/* زر معاينة التقرير الكامل إن كان متاحاً */}
                    {dataset.reportId && onOpenReport && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onOpenReport(dataset.reportId!)}
                        className="h-8 text-xs font-semibold px-2.5 gap-1 hover:bg-card shrink-0"
                        title="معاينة التقرير التفاعلي الكامل"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-teal-600" />
                        معاينة
                      </Button>
                    )}
                  </div>

                  {/* أزرار التحميل السريع المباشرة للصيغ */}
                  <div className="grid grid-cols-4 gap-1">
                    <button
                      type="button"
                      onClick={() => handleExport(dataset, "pdf")}
                      disabled={Boolean(isDownloadingThis)}
                      className="h-6 rounded-md bg-white/70 dark:bg-black/30 border border-border/50 text-[10px] font-bold text-foreground hover:bg-card flex items-center justify-center gap-1 transition"
                      title="تحميل مباشر بصيغة PDF"
                    >
                      <FileText className="h-3 w-3 text-rose-600" />
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport(dataset, "xlsx")}
                      disabled={Boolean(isDownloadingThis)}
                      className="h-6 rounded-md bg-white/70 dark:bg-black/30 border border-border/50 text-[10px] font-bold text-foreground hover:bg-card flex items-center justify-center gap-1 transition"
                      title="تحميل مباشر بصيغة Excel"
                    >
                      <FileSpreadsheet className="h-3 w-3 text-emerald-600" />
                      Excel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport(dataset, "word")}
                      disabled={Boolean(isDownloadingThis)}
                      className="h-6 rounded-md bg-white/70 dark:bg-black/30 border border-border/50 text-[10px] font-bold text-foreground hover:bg-card flex items-center justify-center gap-1 transition"
                      title="تحميل مباشر بصيغة Word"
                    >
                      <FileType className="h-3 w-3 text-sky-600" />
                      Word
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport(dataset, "print")}
                      disabled={Boolean(isDownloadingThis)}
                      className="h-6 rounded-md bg-white/70 dark:bg-black/30 border border-border/50 text-[10px] font-bold text-foreground hover:bg-card flex items-center justify-center gap-1 transition"
                      title="طباعة فورية"
                    >
                      <Printer className="h-3 w-3 text-slate-600 dark:text-slate-300" />
                      طباعة
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* 5. نافذة التحميل واختيار الصيغ الرسمية (Modal مطابق لصفحة حقوق المركب) */}
      <Dialog open={downloadModalOpen} onOpenChange={setDownloadModalOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-teal-600" />
              <span>تحميل المستند الرسمي بالترويسة الموحدة</span>
            </DialogTitle>
            {activeDataset && (
              <DialogDescription className="text-xs">
                {activeDataset.title} — تطبيق الترويسة الموحدة والشعارات الرسمية تلقائياً
              </DialogDescription>
            )}
          </DialogHeader>

          {activeDataset && (
            <div className="space-y-4 py-1">
              {/* ملخص القائمة المحددة (صندوق أخضر أنيق مثل صفحة حقوق المركب) */}
              <div className="rounded-xl bg-teal-500/10 border border-teal-500/30 p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">اسم القائمة:</span>
                  <strong className="text-foreground text-sm">{activeDataset.title}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">نطاق التصدير:</span>
                  <strong className="text-teal-800 dark:text-teal-300 font-bold">
                    {selectedIds.size > 0 && activeDataset.category === "subscribers"
                      ? `المنخرطون المحددون فقط (${selectedIds.size} منخرط)`
                      : "جميع السجلات والمنخرطين المسجلين"}
                  </strong>
                </div>
                {activeDataset.isTimeFiltered && (dateFrom || dateTo) && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">الفترة الزمنية:</span>
                    <strong className="font-mono font-bold text-amber-700 dark:text-amber-400">
                      {dateFrom || "البداية"} ← {dateTo || "اليوم"}
                    </strong>
                  </div>
                )}
                <div className="flex justify-between items-center text-[11px] pt-1.5 border-t border-teal-500/20">
                  <span className="text-muted-foreground font-medium">اسم الملف عند التحميل:</span>
                  <code className="font-mono font-bold text-teal-800 dark:text-teal-300 truncate max-w-[220px]" dir="ltr">
                    AquaCore_{activeDataset.title.replace(/\s+/g, "_")}_{new Date().toISOString().split("T")[0]}.*
                  </code>
                </div>
                <div className="flex items-center gap-1.5 pt-1 text-[11px] text-teal-700 dark:text-teal-300">
                  <Building2 className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                  <span>تُطبع الترويسة الرسمية وشعار النادي ورقم القيد في أعلى الوثيقة</span>
                </div>
              </div>

              {/* قسم اختيار الإمضاءات المعتمدة (تظهر أسفل الوثيقة) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <PenTool className="h-3.5 w-3.5 text-teal-600" />
                    <span>الإمضاءات الرسمية (تظهر أسفل الوثيقة):</span>
                  </Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (selectedSigs.length === SIGNATURE_OPTIONS.length) setSelectedSigs([]);
                      else setSelectedSigs(SIGNATURE_OPTIONS.map((s) => s.id));
                    }}
                    className="h-6 text-[10px] text-teal-700"
                  >
                    {selectedSigs.length === SIGNATURE_OPTIONS.length ? "إلغاء الكل" : "تحديد الكل"}
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-1.5">
                  {SIGNATURE_OPTIONS.map((sig) => {
                    const isChecked = selectedSigs.includes(sig.id);
                    return (
                      <label
                        key={sig.id}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition",
                          isChecked
                            ? "border-teal-500/40 bg-teal-500/5 shadow-xs"
                            : "border-border/60 hover:bg-muted/40"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => toggleSig(sig.id)}
                          />
                          <span className="font-semibold text-foreground">{sig.label}</span>
                        </div>
                        {isChecked && <Check className="h-3.5 w-3.5 text-teal-600" />}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* قسم أزرار الصيغ الرسمية الثلاثة + الطباعة (مثل صفحة حقوق المركب) */}
              <div className="space-y-2 pt-1">
                <Label className="text-xs font-bold text-foreground">
                  اختر صيغة التحميل المطلوبة:
                </Label>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleExport(activeDataset, "pdf")}
                    disabled={Boolean(downloading)}
                    className="flex-col h-auto py-3 gap-1.5 border-teal-500/40 hover:bg-teal-500/10 hover:border-teal-600 transition group"
                  >
                    {downloading?.endsWith("-pdf") ? (
                      <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
                    ) : (
                      <FileText className="h-5 w-5 text-teal-600 group-hover:scale-110 transition-transform" />
                    )}
                    <span className="text-xs font-bold">PDF رسمي</span>
                    <span className="text-[9px] text-muted-foreground">جاهز للطبع A4</span>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => handleExport(activeDataset, "word")}
                    disabled={Boolean(downloading)}
                    className="flex-col h-auto py-3 gap-1.5 border-sky-500/40 hover:bg-sky-500/10 hover:border-sky-600 transition group"
                  >
                    {downloading?.endsWith("-word") ? (
                      <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
                    ) : (
                      <FileType className="h-5 w-5 text-sky-600 group-hover:scale-110 transition-transform" />
                    )}
                    <span className="text-xs font-bold">Word</span>
                    <span className="text-[9px] text-muted-foreground">قابل للتعديل</span>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => handleExport(activeDataset, "xlsx")}
                    disabled={Boolean(downloading)}
                    className="flex-col h-auto py-3 gap-1.5 border-emerald-500/40 hover:bg-emerald-500/10 hover:border-emerald-600 transition group"
                  >
                    {downloading?.endsWith("-xlsx") ? (
                      <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                    ) : (
                      <FileSpreadsheet className="h-5 w-5 text-emerald-600 group-hover:scale-110 transition-transform" />
                    )}
                    <span className="text-xs font-bold">Excel</span>
                    <span className="text-[9px] text-muted-foreground">جداول إلكترونية</span>
                  </Button>
                </div>

                <div className="pt-2">
                  <Button
                    variant="ghost"
                    onClick={() => handleExport(activeDataset, "print")}
                    disabled={Boolean(downloading)}
                    className="w-full h-8 text-xs font-bold gap-2 text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <Printer className="h-4 w-4 text-teal-600" />
                    فتح نافذة الطباعة المباشرة (Print Preview)
                  </Button>
                </div>

                <p className="text-[11px] text-muted-foreground text-center mt-1 leading-relaxed">
                  * ملفات PDF و Word تتضمن الترويسة الموحدة والشعارات والإمضاءات المحددة في الأسفل.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-start">
            <Button variant="outline" onClick={() => setDownloadModalOpen(false)} className="text-xs">
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. نافذة تحديد المنخرطين المخصصة (Subscriber Selection Dialog) */}
      <SubscriberSelectionDialog
        open={subDialogOpen}
        onOpenChange={setSubDialogOpen}
        selectedIds={selectedIds}
        onSelect={setSelectedIds}
      />
    </div>
  );
}

// ════════════ حوار تحديد المنخرطين المخصص ════════════
function SubscriberSelectionDialog({
  open,
  onOpenChange,
  selectedIds,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: Set<string>;
  onSelect: (ids: Set<string>) => void;
}) {
  const [subscribers, setSubscribers] = useState<SubscriberLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!open || fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    (async () => {
      try {
        const all: SubscriberLite[] = [];
        let page = 1;
        let hasMore = true;
        while (hasMore) {
          const res = await fetch(`/api/subscribers?page=${page}&limit=500`);
          if (!res.ok) break;
          const data = await res.json();
          const subs: SubscriberLite[] = (data.subscribers || []).map((s: SubscriberLite) => ({
            id: s.id,
            fileNumber: s.fileNumber,
            firstName: s.firstName,
            lastName: s.lastName,
            phone: s.phone,
            subscriptionType: s.subscriptionType,
            paymentStatus: s.paymentStatus,
            renewalStatus: s.renewalStatus,
          }));
          all.push(...subs);
          setTotal(data.pagination?.total ?? all.length);
          hasMore = Boolean(data.pagination?.hasMore);
          page += 1;
          if (page > 200) break;
        }
        setSubscribers(all);
      } catch {
        toast.error("تعذر تحميل قائمة المنخرطين");
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open) {
      fetchedRef.current = false;
      setSearch("");
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return subscribers;
    const q = search.toLowerCase();
    return subscribers.filter((s) =>
      s.firstName?.toLowerCase().includes(q) ||
      s.lastName?.toLowerCase().includes(q) ||
      s.fileNumber?.toLowerCase().includes(q) ||
      s.phone?.toLowerCase().includes(q)
    );
  }, [subscribers, search]);

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelect(next);
  };

  const selectAll = () => onSelect(new Set(subscribers.map((s) => s.id)));
  const deselectAll = () => onSelect(new Set());
  const selectAllFiltered = () => {
    const next = new Set(selectedIds);
    filtered.forEach((s) => next.add(s.id));
    onSelect(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-teal-600" />
            <span>تحديد المنخرطين للتصدير المخصص</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            اختر المنخرطين المراد تصديرهم. يمكنك ترك التحديد فارغاً لتصدير جميع المنخرطين تلقائياً.
          </DialogDescription>
        </DialogHeader>

        {/* شريط البحث + عدّاد التحديد */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="بحث بالاسم أو اللقب أو رقم الملف أو الهاتف..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-8 text-xs"
            />
          </div>
          <Badge variant="outline" className="shrink-0 text-xs font-bold font-mono">
            {selectedIds.size} من {total || subscribers.length}
          </Badge>
        </div>

        {/* أزرار التحديد الجماعي */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={selectAll} disabled={loading || subscribers.length === 0} className="text-xs">
            <Check className="h-3.5 w-3.5 ml-1 text-teal-600" /> تحديد الكل
          </Button>
          <Button size="sm" variant="outline" onClick={selectAllFiltered} disabled={loading || filtered.length === 0} className="text-xs">
            تحديد المعروضين ({filtered.length})
          </Button>
          <Button size="sm" variant="outline" onClick={deselectAll} disabled={loading || selectedIds.size === 0} className="text-xs text-rose-600">
            <X className="h-3.5 w-3.5 ml-1" /> إلغاء التحديد
          </Button>
        </div>

        {/* قائمة المنخرطين مع مربعات الاختيار */}
        <ScrollArea className="h-[360px] rounded-xl border">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full p-8 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
              <p className="text-xs text-muted-foreground">جاري تحميل سجلات المنخرطين...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-full p-8">
              <p className="text-xs text-muted-foreground">لا توجد نتائج مطابقة للبحث</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {filtered.map((s) => {
                const checked = selectedIds.has(s.id);
                return (
                  <label
                    key={s.id}
                    className={cn(
                      "flex items-center gap-3 p-3 cursor-pointer transition",
                      checked ? "bg-teal-500/10" : "hover:bg-accent/40"
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(s.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground">
                        {s.lastName} {s.firstName}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        ملف #{s.fileNumber} • {s.subscriptionType} • {s.paymentStatus}
                      </p>
                    </div>
                    {s.renewalStatus && (
                      <Badge variant="outline" className="text-[10px] shrink-0 font-semibold">{s.renewalStatus}</Badge>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2 sm:justify-start">
          <Button onClick={() => onOpenChange(false)} className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold">
            تم الحفظ والتطبيق ({selectedIds.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ExportPanel;

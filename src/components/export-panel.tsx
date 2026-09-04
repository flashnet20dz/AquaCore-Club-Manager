"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import {
  FileSpreadsheet, FileText, Users, Calendar, RefreshCw, Wallet,
  Download, Loader2, ShieldCheck, Building2, FileType,
  PenTool, Check, Printer, Badge as BadgeIcon, BarChart3,
  Droplet, Clock, Crown, Tag, Activity, Search,
  UserCheck, UserX, AlertCircle, HandCoins, Briefcase, FileClock,
  TrendingUp, Receipt, ListOrdered, ScrollText, Filter, X,
  CalendarRange, Stamp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// الترويسة الموحدة تم نقلها إلى: الإعدادات → إعدادات النادي → الترويسة الموحدة (EN-TÊTE)

type ExportCategory = "subscribers" | "time" | "static";

interface ExportOption {
  type: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  category: ExportCategory;
}

const SIGNATURES = [
  { id: "president", label: "إمضاء رئيس الجمعية" },
  { id: "branch", label: "رئيس الفرع" },
  { id: "manager", label: "مدير الوحدة" },
  { id: "compound", label: "مدير ديوان المركب" },
  { id: "insurance", label: "تأشيرة التأمين" },
];

// ════════════ 20 Export Options ════════════
const EXPORT_OPTIONS: ExportOption[] = [
  // ── قوائم المنخرطين (4) ──
  { type: "subscribers-all", title: "قائمة المنخرطين الكاملة", description: "جميع المنخرطين المسجّلين في النادي", icon: Users, color: "from-teal-500/15 to-teal-500/5 border-teal-500/30", category: "subscribers" },
  { type: "subscribers-active", title: "قائمة المنخرطين النشطين", description: "الاشتراكات السارية فقط", icon: UserCheck, color: "from-emerald-500/15 to-emerald-500/5 border-emerald-500/30", category: "subscribers" },
  { type: "subscribers-expired", title: "قائمة المنخرطين المنتهية", description: "الاشتراكات المنتهية", icon: UserX, color: "from-rose-500/15 to-rose-500/5 border-rose-500/30", category: "subscribers" },
  { type: "subscribers-expiring", title: "قائمة المنخرطين قريبة الانتهاء", description: "المنتهية خلال 30 يوماً", icon: AlertCircle, color: "from-amber-500/15 to-amber-500/5 border-amber-500/30", category: "subscribers" },

  // ── الكشوف الزمنية (3) ──
  { type: "attendance", title: "كشف الحضور", description: "سجل حضور المنخرطين", icon: Calendar, color: "from-sky-500/15 to-sky-500/5 border-sky-500/30", category: "time" },
  { type: "payments", title: "كشف المدفوعات", description: "سجل المدفوعات الواردة", icon: Wallet, color: "from-cyan-500/15 to-cyan-500/5 border-cyan-500/30", category: "time" },
  { type: "renewals", title: "كشف التجديدات", description: "سجل تجديدات الاشتراكات", icon: RefreshCw, color: "from-fuchsia-500/15 to-fuchsia-500/5 border-fuchsia-500/30", category: "time" },

  // ── المالية (4) ──
  { type: "financial-stats", title: "الإحصائيات المالية", description: "الإيرادات، المصاريف، الرصيد", icon: Wallet, color: "from-rose-500/15 to-rose-500/5 border-rose-500/30", category: "subscribers" },
  { type: "monthly-revenue", title: "تقرير الإيرادات الشهرية", description: "الإيرادات موزّعة حسب الشهر", icon: TrendingUp, color: "from-green-500/15 to-green-500/5 border-green-500/30", category: "time" },
  { type: "expenses", title: "تقرير المصاريف", description: "المصاريف حسب الفئة", icon: Receipt, color: "from-red-500/15 to-red-500/5 border-red-500/30", category: "time" },
  { type: "compensations", title: "كشف التعويضات", description: "التعويضات المدفوعة للموظفين", icon: HandCoins, color: "from-amber-500/15 to-amber-500/5 border-amber-500/30", category: "time" },

  // ── التوزيعات الإحصائية (5) ──
  { type: "dist-age-categories", title: "توزيع الفئات العمرية", description: "عدد المنخرطين حسب كل فئة عمرية", icon: Crown, color: "from-violet-500/15 to-violet-500/5 border-violet-500/30", category: "subscribers" },
  { type: "dist-subscription-types", title: "توزيع أنواع الاشتراكات", description: "عدد المنخرطين حسب النوع", icon: Tag, color: "from-cyan-500/15 to-cyan-500/5 border-cyan-500/30", category: "subscribers" },
  { type: "dist-blood-types", title: "توزيع فصائل الدم", description: "إحصائيات حسب فصيلة الدم", icon: Droplet, color: "from-pink-500/15 to-pink-500/5 border-pink-500/30", category: "subscribers" },
  { type: "dist-swimming-days", title: "توزيع أيام السباحة", description: "عدد المنخرطين حسب كل يوم", icon: Calendar, color: "from-indigo-500/15 to-indigo-500/5 border-indigo-500/30", category: "subscribers" },
  { type: "dist-time-slots", title: "توزيع التوقيت", description: "عدد المنخرطين حسب كل توقيت", icon: Clock, color: "from-blue-500/15 to-blue-500/5 border-blue-500/30", category: "subscribers" },

  // ── الموارد البشرية والعمليات (4) ──
  { type: "work-hours", title: "كشف ساعات العمل", description: "ساعات عمل الموظفين", icon: FileClock, color: "from-orange-500/15 to-orange-500/5 border-orange-500/30", category: "time" },
  { type: "waitlist", title: "قائمة الانتظار", description: "الأشخاص في قائمة الانتظار", icon: ListOrdered, color: "from-yellow-500/15 to-yellow-500/5 border-yellow-500/30", category: "subscribers" },
  { type: "employees", title: "كشف الموظفين", description: "قائمة الموظفين والمدربين", icon: Briefcase, color: "from-purple-500/15 to-purple-500/5 border-purple-500/30", category: "static" },
  { type: "contracts", title: "كشف العقود", description: "العقود النشطة والمنتهية", icon: ScrollText, color: "from-slate-500/15 to-slate-500/5 border-slate-500/30", category: "static" },
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
  const [downloading, setDownloading] = useState<string | null>(null);
  const [selectedSigs, setSelectedSigs] = useState<string[]>(["president", "branch"]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [subscribersTotal, setSubscribersTotal] = useState<number | null>(null);

  const toggleSig = (id: string) => {
    setSelectedSigs((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  };

  // Fetch total subscriber count once on mount (for the "X من Y" badge)
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
        // silent — total is optional
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const buildParams = (opt: ExportOption, format: "pdf" | "xlsx" | "word" | "print") => {
    const params = new URLSearchParams({ format: format === "print" ? "pdf" : format, type: opt.type });
    if (selectedSigs.length > 0 && (format === "pdf" || format === "word" || format === "print")) {
      params.set("sigs", selectedSigs.join(","));
    }
    if (selectedIds.size > 0 && opt.category === "subscribers") {
      params.set("ids", Array.from(selectedIds).join(","));
    }
    if (opt.category === "time") {
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
    }
    return params;
  };

  const handleExport = async (opt: ExportOption, format: "pdf" | "xlsx" | "word" | "print") => {
    // Print: open PDF in a new tab; user prints from there
    if (format === "print") {
      const params = buildParams(opt, "print");
      window.open(`/api/export?${params.toString()}`, "_blank");
      toast.info("فتح ملف PDF للطباعة — استخدم Ctrl+P داخل النافذة الجديدة");
      return;
    }

    const params = buildParams(opt, format);
    setDownloading(`${opt.type}-${format}`);
    try {
      const res = await fetch(`/api/export?${params.toString()}`);
      if (!res.ok) throw new Error("فشل التصدير");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const filename = res.headers.get("Content-Disposition")?.split('filename="')[1]?.split('"')[0]
        || `RCS_${opt.type}.${format === "word" ? "doc" : format}`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`تم تصدير ${filename}`);
    } catch {
      toast.error("فشل التصدير");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* ═══ تذكير بنقل الترويسة ═══ */}
      <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
        <FileText className="h-5 w-5 text-primary shrink-0" />
        <div className="flex-1">
          <p className="font-bold text-sm">الترويسة الموحدة (EN-TÊTE)</p>
          <p className="text-xs text-muted-foreground">تُدار الآن من: الإعدادات → إعدادات النادي → الترويسة الموحدة — تنعكس تلقائياً على كل التقارير</p>
        </div>
      </div>

      {/* ═══ مركز التقارير (يفتح واجهة تقرير كاملة) ═══ */}
      <ReportsCenter onOpenReport={onOpenReport} />

      {/* ═══ خيارات التصدير (تصدير مباشر PDF/Excel/Word/طباعة) ═══ */}
      <ExportOptions
        downloading={downloading}
        selectedSigs={selectedSigs}
        selectedIdsCount={selectedIds.size}
        subscribersTotal={subscribersTotal}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onToggleSig={toggleSig}
        onSetDateFrom={setDateFrom}
        onSetDateTo={setDateTo}
        onOpenSubDialog={() => setSubDialogOpen(true)}
        onClearSubs={() => setSelectedIds(new Set())}
        onExport={handleExport}
      />

      {/* ═══ حوار تحديد المنخرطين ═══ */}
      <SubscriberSelectionDialog
        open={subDialogOpen}
        onOpenChange={setSubDialogOpen}
        selectedIds={selectedIds}
        onSelect={setSelectedIds}
      />
    </div>
  );
}

// ════════════ Reports Center (15 reports hub — opens full report viewer) ════════════
const REPORTS: { id: string; title: string; description: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { id: "subscribers-list", title: "قائمة المنخرطين", description: "الفلترة حسب النوع، الجنس، العمر، الاشتراك، الحالة", icon: Users, color: "from-teal-500/15 to-teal-500/5 border-teal-500/30" },
  { id: "insurance-list", title: "قائمة التأمين", description: "مؤمنون / غير مؤمنين / الكل", icon: ShieldCheck, color: "from-emerald-500/15 to-emerald-500/5 border-emerald-500/30" },
  { id: "compound-rights", title: "حقوق دخول المركب", description: "المنخرطون الذي رسمهم ≥ 1300 دج", icon: Building2, color: "from-sky-500/15 to-sky-500/5 border-sky-500/30" },
  { id: "renewals", title: "قائمة التجديدات", description: "اليوم / الأسبوع / الشهر / فترة", icon: RefreshCw, color: "from-fuchsia-500/15 to-fuchsia-500/5 border-fuchsia-500/30" },
  { id: "attendance", title: "سجل الحضور", description: "حسب اليوم / الفترة / المدرب / الحصة", icon: Calendar, color: "from-amber-500/15 to-amber-500/5 border-amber-500/30" },
  { id: "financial", title: "التقرير المالي", description: "الإيرادات، المصاريف، الرصيد + رسوم بيانية", icon: Wallet, color: "from-rose-500/15 to-rose-500/5 border-rose-500/30" },
  { id: "expired", title: "الاشتراكات المنتهية", description: "المنتهية + خلال 7 أيام + خلال 30 يوماً", icon: Calendar, color: "from-orange-500/15 to-orange-500/5 border-orange-500/30" },
  { id: "absence", title: "تقرير الغياب", description: "عدد الغيابات + آخر حضور + نسبة الحضور", icon: Activity, color: "from-red-500/15 to-red-500/5 border-red-500/30" },
  { id: "age-categories", title: "الفئات العمرية", description: "عدد المنخرطين حسب كل فئة عمرية", icon: Crown, color: "from-violet-500/15 to-violet-500/5 border-violet-500/30" },
  { id: "subscription-types", title: "أنواع الاشتراك", description: "عادي، OPW، DJS، FCS، RCS، POLICE وغيرها", icon: Tag, color: "from-cyan-500/15 to-cyan-500/5 border-cyan-500/30" },
  { id: "swimming-days", title: "أيام السباحة", description: "عدد المنخرطين حسب كل يوم", icon: Calendar, color: "from-indigo-500/15 to-indigo-500/5 border-indigo-500/30" },
  { id: "swimming-times", title: "أوقات السباحة", description: "عدد المنخرطين حسب كل توقيت", icon: Clock, color: "from-blue-500/15 to-blue-500/5 border-blue-500/30" },
  { id: "blood-types", title: "فصائل الدم", description: "إحصائيات حسب فصيلة الدم", icon: Droplet, color: "from-pink-500/15 to-pink-500/5 border-pink-500/30" },
  { id: "ages", title: "تقرير الأعمار", description: "إحصائيات حسب العمر", icon: Users, color: "from-lime-500/15 to-lime-500/5 border-lime-500/30" },
  { id: "coaches", title: "تقرير المدربين", description: "عدد المنخرطين لكل مدرب", icon: Users, color: "from-purple-500/15 to-purple-500/5 border-purple-500/30" },
];

function ReportsCenter({ onOpenReport }: { onOpenReport?: (id: string) => void }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-base">مركز التقارير</h3>
        <Badge variant="outline" className="text-[10px]">{REPORTS.length} تقرير</Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        اضغط على أي تقرير لفتح واجهة كاملة مستقلة — تحتوي على الترويسة الموحدة + إحصائيات + فلاتر + جدول + ترقيم صفحات + تصدير PDF/Word/Excel/طباعة
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {REPORTS.map((r, i) => {
          const Icon = r.icon;
          return (
            <motion.button
              key={r.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => onOpenReport?.(r.id)}
              className={cn("text-right rounded-2xl border-2 bg-gradient-to-br p-4 hover:scale-[1.02] transition-transform", r.color)}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/60 dark:bg-black/20 shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{r.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30">
                <span className="text-[10px] text-muted-foreground">فتح التقرير</span>
                <FileText className="h-3.5 w-3.5 text-primary" />
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ════════════ Export Options (20 types — direct export with format buttons) ════════════
function ExportOptions({
  downloading,
  selectedSigs,
  selectedIdsCount,
  subscribersTotal,
  dateFrom,
  dateTo,
  onToggleSig,
  onSetDateFrom,
  onSetDateTo,
  onOpenSubDialog,
  onClearSubs,
  onExport,
}: {
  downloading: string | null;
  selectedSigs: string[];
  selectedIdsCount: number;
  subscribersTotal: number | null;
  dateFrom: string;
  dateTo: string;
  onToggleSig: (id: string) => void;
  onSetDateFrom: (v: string) => void;
  onSetDateTo: (v: string) => void;
  onOpenSubDialog: () => void;
  onClearSubs: () => void;
  onExport: (opt: ExportOption, format: "pdf" | "xlsx" | "word" | "print") => void;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2 mb-1">
        <Download className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-base">خيارات التصدير</h3>
        <Badge variant="outline" className="text-[10px]">{EXPORT_OPTIONS.length} نوع</Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        تصدير مباشر بصيغة PDF / Excel / Word / طباعة — يُصدّر جميع المنخرطين تلقائياً مع الترويسة الموحدة والإمضاءات
      </p>

      {/* ═══ أدوات تحديد مشتركة ═══ */}
      <div className="space-y-3 mb-4 p-3 rounded-xl bg-muted/30 border border-border/40">
        {/* فلتر التاريخ */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <CalendarRange className="h-4 w-4 text-primary" />
            <span>فترة التقرير:</span>
          </div>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => onSetDateFrom(e.target.value)}
            className="h-8 w-auto text-xs"
            aria-label="تاريخ البداية"
          />
          <span className="text-xs text-muted-foreground">→</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => onSetDateTo(e.target.value)}
            className="h-8 w-auto text-xs"
            aria-label="تاريخ النهاية"
          />
          {(dateFrom || dateTo) && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={() => { onSetDateFrom(""); onSetDateTo(""); }}
            >
              <X className="h-3 w-3 ml-1" /> مسح
            </Button>
          )}
          <span className="text-[10px] text-muted-foreground">
            يُطبّق على: الحضور، المدفوعات، التجديدات، الإيرادات الشهرية، المصاريف، التعويضات، ساعات العمل
          </span>
        </div>

        {/* تحديد المنخرطين */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <Users className="h-4 w-4 text-primary" />
            <span>تحديد المنخرطين:</span>
          </div>
          {selectedIdsCount > 0 ? (
            <>
              <Badge className="bg-primary/15 text-primary border-primary/30">
                تم تحديد {selectedIdsCount} من {subscribersTotal ?? "…"} منخرط
              </Badge>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onOpenSubDialog}>
                تعديل التحديد
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onClearSubs}>
                <X className="h-3 w-3 ml-1" /> تصدير الكل
              </Button>
            </>
          ) : (
            <>
              <Badge variant="outline">
                تصدير الكل{subscribersTotal != null ? ` (${subscribersTotal})` : ""}
              </Badge>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onOpenSubDialog}>
                <Filter className="h-3 w-3 ml-1" /> تحديد منخرطين محدّدين
              </Button>
            </>
          )}
          <span className="text-[10px] text-muted-foreground">يُطبّق على تقارير المنخرطين فقط</span>
        </div>

        {/* تحديد الإمضاءات */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <PenTool className="h-4 w-4 text-primary" />
              <span>الإمضاءات (تظهر في أسفل الملف في سطر واحد متساوية):</span>
            </div>
            {selectedSigs.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[10px]"
                onClick={() => selectedSigs.forEach(onToggleSig)}
              >
                مسح الكل
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {SIGNATURES.map((sig) => {
              const checked = selectedSigs.includes(sig.id);
              return (
                <button
                  key={sig.id}
                  type="button"
                  onClick={() => onToggleSig(sig.id)}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg border-2 text-xs transition text-right",
                    checked ? "border-primary bg-primary/10" : "border-border hover:bg-accent"
                  )}
                >
                  <div
                    className={cn(
                      "h-4 w-4 rounded border-2 flex items-center justify-center shrink-0",
                      checked ? "bg-primary border-primary text-primary-foreground" : "border-border"
                    )}
                  >
                    {checked && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                  </div>
                  <span className="font-medium text-[11px] leading-tight">{sig.label}</span>
                </button>
              );
            })}
          </div>

          {/* معاينة الإمضاءات */}
          {selectedSigs.length > 0 ? (
            <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3">
              <p className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1">
                <Stamp className="h-3 w-3" /> معاينة ترتيب الإمضاءات في أسفل الملف:
              </p>
              <div className="flex items-end justify-around gap-2">
                {selectedSigs.map((id) => {
                  const sig = SIGNATURES.find((s) => s.id === id);
                  if (!sig) return null;
                  return (
                    <div key={id} className="flex-1 text-center min-w-0">
                      <div className="h-8 flex items-end justify-center">
                        <span className="text-[9px] text-muted-foreground/60 italic">[مكان التوقيع والختم]</span>
                      </div>
                      <div className="border-t border-foreground/40 my-1" />
                      <p className="text-[10px] font-medium leading-tight">{sig.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground italic">لم يتم اختيار إمضاءات — لن تظهر أي إمضاءات في أسفل الملف</p>
          )}
        </div>
      </div>

      {/* ═══ شبكة خيارات التصدير ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {EXPORT_OPTIONS.map((opt, i) => {
          const Icon = opt.icon;
          return (
            <motion.div
              key={opt.type}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.4) }}
              className={cn("rounded-2xl border-2 bg-gradient-to-br p-3 flex flex-col", opt.color)}
            >
              <div className="flex items-start gap-2 mb-2 flex-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/60 dark:bg-black/20 shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs leading-tight">{opt.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{opt.description}</p>
                </div>
                {opt.category === "time" && (
                  <BadgeIcon className="h-3 w-3 text-amber-500 shrink-0" />
                )}
              </div>
              <div className="grid grid-cols-4 gap-1 mt-auto">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] px-1 bg-white/60 dark:bg-black/20 flex-col gap-0"
                  onClick={() => onExport(opt, "pdf")}
                  disabled={downloading === `${opt.type}-pdf`}
                  title="تصدير PDF"
                >
                  {downloading === `${opt.type}-pdf`
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <FileText className="h-3 w-3" />}
                  PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] px-1 bg-white/60 dark:bg-black/20 flex-col gap-0"
                  onClick={() => onExport(opt, "xlsx")}
                  disabled={downloading === `${opt.type}-xlsx`}
                  title="تصدير Excel"
                >
                  {downloading === `${opt.type}-xlsx`
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <FileSpreadsheet className="h-3 w-3" />}
                  Excel
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] px-1 bg-white/60 dark:bg-black/20 flex-col gap-0"
                  onClick={() => onExport(opt, "word")}
                  disabled={downloading === `${opt.type}-word`}
                  title="تصدير Word"
                >
                  {downloading === `${opt.type}-word`
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <FileType className="h-3 w-3" />}
                  Word
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] px-1 bg-white/60 dark:bg-black/20 flex-col gap-0"
                  onClick={() => onExport(opt, "print")}
                  title="طباعة مباشرة"
                >
                  <Printer className="h-3 w-3" />
                  طباعة
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════ Subscriber Selection Dialog (searchable checkbox list) ════════════
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

  // Load all subscribers (paginated) when dialog opens for the first time
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
          // Safety cap: avoid infinite loops
          if (page > 200) break;
        }
        setSubscribers(all);
      } catch {
        toast.error("فشل تحميل قائمة المنخرطين");
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  // Reset fetched flag + search when dialog closes
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            تحديد المنخرطين للتصدير
          </DialogTitle>
          <DialogDescription>
            اختر المنخرطين الذين تريد تضمينهم في التصدير. اترك التحديد فارغاً لتصدير جميع المنخرطين.
          </DialogDescription>
        </DialogHeader>

        {/* شريط البحث + عدّاد */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="بحث بالاسم أو رقم الملف أو الهاتف..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-8"
            />
          </div>
          <Badge variant="outline" className="shrink-0">
            {selectedIds.size} من {total || subscribers.length}
          </Badge>
        </div>

        {/* أزرار تحديد جماعي */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={selectAll} disabled={loading || subscribers.length === 0}>
            <Check className="h-3.5 w-3.5 ml-1" /> تحديد الكل
          </Button>
          <Button size="sm" variant="outline" onClick={selectAllFiltered} disabled={loading || filtered.length === 0}>
            تحديد المعروضين ({filtered.length})
          </Button>
          <Button size="sm" variant="outline" onClick={deselectAll} disabled={loading || selectedIds.size === 0}>
            <X className="h-3.5 w-3.5 ml-1" /> إلغاء التحديد
          </Button>
        </div>

        {/* قائمة المنخرطين */}
        <ScrollArea className="h-[400px] rounded-lg border">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full p-8 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">جاري تحميل جميع المنخرطين...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-full p-8">
              <p className="text-sm text-muted-foreground">لا توجد نتائج</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((s) => {
                const checked = selectedIds.has(s.id);
                return (
                  <label
                    key={s.id}
                    className={cn(
                      "flex items-center gap-3 p-3 cursor-pointer transition",
                      checked ? "bg-primary/5" : "hover:bg-accent"
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(s.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {s.lastName} {s.firstName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.fileNumber} • {s.subscriptionType} • {s.paymentStatus}
                      </p>
                    </div>
                    {s.renewalStatus && (
                      <Badge variant="outline" className="text-[10px] shrink-0">{s.renewalStatus}</Badge>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            تم
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ExportPanel;

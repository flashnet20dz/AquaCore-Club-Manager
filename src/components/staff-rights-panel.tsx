"use client";

import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  FileText, Download, Printer, Calendar, Users, Wallet, Loader2,
  ChevronLeft, ChevronRight, Building2, Eye, RefreshCw, CheckCircle2,
  XCircle, AlertCircle, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MONTH_NAMES = [
  "جانفي", "فبراير", "مارس", "أفريل", "ماي", "جوان",
  "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

interface MonthData {
  month: number;
  year: number;
  members: Array<{ index: number; lastName: string; firstName: string; fileNumber: string; amount: number }>;
  totalAmount: number;
  memberCount: number;
  monthName: string;
  dateFrom: string;
  dateTo: string;
}

interface MonthStatus {
  loading: boolean;
  data: MonthData | null;
  generated: boolean;
}

export function StaffRightsPanel() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthStatuses, setMonthStatuses] = useState<Record<number, MonthStatus>>({});
  const [previewMonth, setPreviewMonth] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [printing, setPrinting] = useState<number | null>(null);

  // 🔑 جلب بيانات شهر محدد
  const fetchMonthData = useCallback(async (month: number) => {
    setMonthStatuses((prev) => ({ ...prev, [month]: { loading: true, data: null, generated: prev[month]?.generated || false } }));
    try {
      const res = await fetch("/api/staff-rights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month }),
      });
      if (!res.ok) throw new Error("فشل");
      const data = await res.json();
      setMonthStatuses((prev) => ({
        ...prev,
        [month]: { loading: false, data, generated: prev[month]?.generated || false },
      }));
    } catch {
      setMonthStatuses((prev) => ({
        ...prev,
        [month]: { loading: false, data: null, generated: prev[month]?.generated || false },
      }));
    }
  }, [year]);

  // 🔑 جلب كل الأشهر عند تغيير السنة
  useMemo(() => {
    for (let m = 1; m <= 12; m++) {
      fetchMonthData(m);
    }
  }, [year, fetchMonthData]);

  // 🔑 إحصائيات
  const stats = useMemo(() => {
    const monthsWithData = Object.values(monthStatuses).filter((s) => s.data && s.data.memberCount > 0).length;
    const monthsGenerated = Object.values(monthStatuses).filter((s) => s.generated).length;
    const totalMembers = Object.values(monthStatuses).reduce((s, x) => s + (x.data?.memberCount || 0), 0);
    const totalAmount = Object.values(monthStatuses).reduce((s, x) => s + (x.data?.totalAmount || 0), 0);
    return { monthsWithData, monthsGenerated, totalMembers, totalAmount };
  }, [monthStatuses]);

  const handleDownload = async (month: number) => {
    setDownloading(month);
    try {
      const res = await fetch(`/api/staff-rights?year=${year}&month=${month}`);
      if (!res.ok) throw new Error("فشل");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `حقوق_المركب_${MONTH_NAMES[month - 1]}_${year}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      setMonthStatuses((prev) => ({
        ...prev,
        [month]: { ...prev[month], generated: true },
      }));
      toast.success(`تم تحميل وثيقة ${MONTH_NAMES[month - 1]} ${year}`);
    } catch {
      toast.error("فشل التحميل");
    } finally {
      setDownloading(null);
    }
  };

  const handlePrint = async (month: number) => {
    setPrinting(month);
    try {
      const res = await fetch(`/api/staff-rights?year=${year}&month=${month}`);
      if (!res.ok) throw new Error("فشل");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const w = window.open(url);
      if (w) {
        w.onload = () => setTimeout(() => w.print(), 800);
      }
      toast.success(`جاري تحضير طباعة ${MONTH_NAMES[month - 1]}`);
    } catch {
      toast.error("فشل الطباعة");
    } finally {
      setPrinting(null);
    }
  };

  const previewData = previewMonth !== null ? monthStatuses[previewMonth]?.data : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-teal-600" />
            <div>
              <h2 className="text-xl font-bold text-teal-900">حقوق المركب</h2>
              <p className="text-xs text-muted-foreground">قائمة المنخرطين الشهرية — وثيقة Word رسمية</p>
            </div>
          </div>
          {/* Year selector */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setYear(year - 1)} className="rounded-xl">
              <ChevronRight className="h-5 w-5" />
            </Button>
            <span className="text-xl font-bold text-teal-900 px-3">{year}</span>
            <Button variant="ghost" size="icon" onClick={() => setYear(year + 1)} className="rounded-xl">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Calendar} label="أشهر ببيانات" value={stats.monthsWithData} color="from-blue-500 to-blue-600" />
        <StatCard icon={CheckCircle2} label="وثائق منشأة" value={stats.monthsGenerated} color="from-emerald-500 to-emerald-600" />
        <StatCard icon={Users} label="إجمالي المنخرطين" value={stats.totalMembers} color="from-teal-500 to-teal-600" />
        <StatCard icon={Wallet} label="إجمالي المبالغ" value={`${stats.totalAmount.toLocaleString()} دج`} color="from-amber-500 to-amber-600" />
      </div>

      {/* Months grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {MONTH_NAMES.map((monthName, idx) => {
          const month = idx + 1;
          const status = monthStatuses[month];
          const isLoading = status?.loading;
          const data = status?.data;
          const hasData = data && data.memberCount > 0;
          const isGenerated = status?.generated;

          return (
            <motion.div
              key={month}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.03, 0.3) }}
              className={cn(
                "rounded-xl border p-4 transition-all",
                isGenerated ? "border-emerald-500/40 bg-emerald-50/30" :
                hasData ? "border-teal-500/30 bg-teal-50/20" :
                "border-border/60 bg-card"
              )}
            >
              {/* Month header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm",
                    isGenerated ? "bg-emerald-500/15 text-emerald-700" :
                    hasData ? "bg-teal-500/15 text-teal-700" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {String(month).padStart(2, "0")}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{monthName}</p>
                    <p className="text-[10px] text-muted-foreground">{year}</p>
                  </div>
                </div>
                {/* Status badge */}
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : isGenerated ? (
                  <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                    <CheckCircle2 className="h-2.5 w-2.5 ml-0.5" /> منشأة
                  </Badge>
                ) : hasData ? (
                  <Badge variant="outline" className="text-[9px] bg-teal-500/10 text-teal-700 border-teal-500/30">
                    <Clock className="h-2.5 w-2.5 ml-0.5" /> جاهزة
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px] bg-muted text-muted-foreground">
                    <XCircle className="h-2.5 w-2.5 ml-0.5" /> لا بيانات
                  </Badge>
                )}
              </div>

              {/* Data preview */}
              {hasData && (
                <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                  <div className="rounded-lg bg-card p-2 text-center">
                    <p className="text-muted-foreground">المنخرطون</p>
                    <p className="font-bold text-teal-700">{data.memberCount}</p>
                  </div>
                  <div className="rounded-lg bg-card p-2 text-center">
                    <p className="text-muted-foreground">المبلغ</p>
                    <p className="font-bold text-amber-600">{data.totalAmount.toLocaleString()} دج</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-1 flex-wrap">
                {hasData && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[10px]"
                      onClick={() => setPreviewMonth(month)}
                    >
                      <Eye className="h-3 w-3 ml-1" /> معاينة
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px]"
                      onClick={() => handleDownload(month)}
                      disabled={downloading === month}
                    >
                      {downloading === month ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3 ml-1" />}
                      Word
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[10px]"
                      onClick={() => handlePrint(month)}
                      disabled={printing === month}
                    >
                      {printing === month ? <Loader2 className="h-3 w-3 animate-spin" /> : <Printer className="h-3 w-3 ml-1" />}
                      طباعة
                    </Button>
                  </>
                )}
                {!hasData && !isLoading && (
                  <p className="text-[10px] text-muted-foreground py-2">لا توجد بيانات لهذا الشهر</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Preview Modal */}
      <Dialog open={previewMonth !== null} onOpenChange={() => setPreviewMonth(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-teal-600" />
              معاينة — {previewData?.monthName} {previewData?.year}
            </DialogTitle>
          </DialogHeader>
          {previewData && (
            <div className="space-y-4">
              {/* Header info */}
              <div className="rounded-lg border p-3 text-xs space-y-1">
                <p className="font-bold">القائمة الاسمية للمنخرطين — فرع السباحة</p>
                <p className="text-muted-foreground">من {previewData.dateFrom} إلى {previewData.dateTo}</p>
                <p className="text-muted-foreground">عدد المنخرطين: {previewData.memberCount} | المجموع: {previewData.totalAmount.toLocaleString()} دج</p>
              </div>

              {/* Members table */}
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-teal-800 text-white">
                      <th className="p-2 text-right w-10">#</th>
                      <th className="p-2 text-right">رقم الملف</th>
                      <th className="p-2 text-right">اللقب</th>
                      <th className="p-2 text-right">الاسم</th>
                      <th className="p-2 text-center">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.members.map((m, i) => (
                      <tr key={i} className={cn("border-b", i % 2 === 0 ? "bg-slate-50" : "bg-white")}>
                        <td className="p-2 text-center text-muted-foreground">{m.index}</td>
                        <td className="p-2 font-mono text-xs">{m.fileNumber}</td>
                        <td className="p-2 font-semibold">{m.lastName}</td>
                        <td className="p-2">{m.firstName}</td>
                        <td className="p-2 text-center font-bold text-amber-600">{m.amount.toLocaleString()} دج</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-teal-500/10 font-bold">
                      <td colSpan={4} className="p-2 text-right">المجموع</td>
                      <td className="p-2 text-center text-amber-700">{previewData.totalAmount.toLocaleString()} دج</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => previewMonth !== null && handlePrint(previewMonth)}
                >
                  <Printer className="h-4 w-4 ml-1" /> طباعة
                </Button>
                <Button
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={() => previewMonth !== null && handleDownload(previewMonth)}
                >
                  <Download className="h-4 w-4 ml-1" /> تحميل Word
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className={cn("rounded-xl p-3 text-white bg-gradient-to-br", color)}>
      <Icon className="h-4 w-4 mb-1" />
      <p className="text-lg font-extrabold tabular-nums leading-none">{typeof value === "number" ? value.toLocaleString() : value}</p>
      <p className="text-[10px] opacity-90 mt-1">{label}</p>
    </div>
  );
}

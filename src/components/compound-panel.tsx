"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Building2, Download, Loader2, Users, FileText, RefreshCw, Calendar,
  TrendingUp, ChevronRight, ChevronLeft, Check, CheckSquare, Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CompoundEntry {
  subscriberId: string;
  fileNumber: string;
  lastName: string;
  firstName: string;
  birthDate: string;
  date: string;
  source: "new" | "renewal";
  amount: number;
}

interface CompoundData {
  month: number;
  year: number;
  monthName: string;
  entries: CompoundEntry[];
  stats: {
    total: number;
    newCount: number;
    renewalCount: number;
    totalCompound: number;
  };
}

const SIGNATURES = [
  { id: "president", label: "إمضاء رئيس الجمعية" },
  { id: "branch", label: "رئيس الفرع" },
  { id: "manager", label: "مدير الوحدة" },
  { id: "compound", label: "مدير ديوان المركب" },
  { id: "insurance", label: "تأشيرة التأمين" },
];

// 🔑 تنسيق التاريخ YYYY/MM/DD
function formatDateYMD(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

export function CompoundPanel() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<CompoundData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [sigModal, setSigModal] = useState(false);
  const [selectedSigs, setSelectedSigs] = useState<string[]>(["president", "compound"]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/compound-rights?year=${year}&month=${month}`, { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        setData(d);
        setSelectedIds(new Set()); // مسح التحديد عند تغيير الشهر
      }
    } catch {
      toast.error("تعذر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const goToPrevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const goToNextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const toggleSig = (id: string) => {
    setSelectedSigs((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(entries.map((e) => e.subscriberId)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleExport = async (format: string, selectedOnly: boolean = false) => {
    setSigModal(false);
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("type", "compound");
      params.set("format", format);
      params.set("year", String(year));
      params.set("month", String(month));
      if (selectedSigs.length > 0) params.set("sigs", selectedSigs.join(","));
      // 🔑 إذا حدد منخرطين، أرسل معرفاتهم
      if (selectedOnly && selectedIds.size > 0) {
        params.set("selectedIds", Array.from(selectedIds).join(","));
      }

      const res = await fetch(`/api/export?${params.toString()}`);
      if (!res.ok) throw new Error("فشل التصدير");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = format === "pdf" ? "pdf" : format === "excel" ? "xlsx" : "doc";
      const scope = selectedOnly ? "_محددين" : "";
      a.download = `AquaCore_حقوق_المركب_${year}_${month}${scope}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(selectedOnly
        ? `تم تصدير ${selectedIds.size} منخرط محدد`
        : "تم تصدير قائمة الشهر كاملاً");
    } catch {
      toast.error("فشل التصدير");
    } finally {
      setExporting(false);
    }
  };

  const entries = data?.entries || [];
  const stats = data?.stats || { total: 0, newCount: 0, renewalCount: 0, totalCompound: 0 };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-teal-600" />
            <div>
              <h2 className="text-xl font-bold text-teal-900">حقوق المركب — القائمة الشهرية</h2>
              <p className="text-xs text-muted-foreground">المنخرطون الذين دفعوا 1300 أو 1500 دج (تسجيل جديد أو تجديد)</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* 🔑 تحميل بالشهر المحدد */}
            <Button size="sm" variant="outline" onClick={() => setSigModal(true)} disabled={exporting || entries.length === 0}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 ml-1" />}
              تحميل قائمة الشهر
            </Button>
            {/* 🔑 تحميل المنخرطين المحددين */}
            {selectedIds.size > 0 && (
              <Button size="sm" variant="default" onClick={() => handleExport("pdf", true)} disabled={exporting}
                className="bg-teal-600 hover:bg-teal-700 text-white">
                <Download className="h-4 w-4 ml-1" />
                تحميل المحددين ({selectedIds.size})
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Month selector */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="icon" onClick={goToPrevMonth} className="rounded-xl">
            <ChevronRight className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">الشهر المحدد</p>
            <p className="text-lg font-bold text-teal-900">{data?.monthName || `${month}/${year}`}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={goToNextMonth} className="rounded-xl">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label="إجمالي" count={stats.total} color="from-teal-600 to-teal-700" />
        <StatCard icon={FileText} label="تسجيل جديد" count={stats.newCount} color="from-sky-600 to-sky-700" />
        <StatCard icon={RefreshCw} label="تجديد" count={stats.renewalCount} color="from-violet-600 to-violet-700" />
        <div className="rounded-2xl p-4 text-white bg-gradient-to-br from-amber-600 to-orange-600">
          <TrendingUp className="h-5 w-5 mb-1" />
          <p className="text-2xl font-extrabold tabular-nums">{stats.totalCompound.toLocaleString()}</p>
          <p className="text-xs opacity-90">دج (1000 × {stats.total})</p>
        </div>
      </div>

      {/* Selection controls */}
      {entries.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="ghost" onClick={selectAll} className="text-teal-700">
            <CheckSquare className="h-3.5 w-3.5 ml-1" /> تحديد الكل
          </Button>
          <Button size="sm" variant="ghost" onClick={deselectAll} className="text-muted-foreground">
            <Square className="h-3.5 w-3.5 ml-1" /> إلغاء التحديد
          </Button>
          {selectedIds.size > 0 && (
            <Badge className="bg-teal-100 text-teal-800 border-teal-300">
              محدد: {selectedIds.size} من {entries.length}
            </Badge>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-teal-700 text-white">
                <th className="p-3 text-center w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer"
                    checked={selectedIds.size === entries.length && entries.length > 0}
                    onChange={(e) => e.target.checked ? selectAll() : deselectAll()}
                  />
                </th>
                <th className="p-3 text-right w-12">#</th>
                <th className="p-3 text-right">اللقب</th>
                <th className="p-3 text-right">الاسم</th>
                <th className="p-3 text-center w-32">التاريخ</th>
                <th className="p-3 text-center w-28">النوع</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin text-teal-600 mx-auto" /></td></tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">لا يوجد منخرطون في هذا الشهر</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">اختر شهراً آخر للعرض</p>
                  </td>
                </tr>
              ) : (
                entries.map((entry, i) => {
                  const isSelected = selectedIds.has(entry.subscriberId);
                  return (
                    <motion.tr
                      key={entry.subscriberId}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.005, 0.2) }}
                      className={cn(
                        "border-b transition",
                        isSelected ? "bg-teal-50/80 ring-1 ring-inset ring-teal-300" : (i % 2 === 0 ? "bg-white hover:bg-teal-50/40" : "bg-gray-50/50 hover:bg-teal-50/40")
                      )}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer"
                          checked={isSelected}
                          onChange={() => toggleSelect(entry.subscriberId)}
                        />
                      </td>
                      <td className="p-3 text-center font-mono text-xs text-teal-700 font-bold">{i + 1}</td>
                      <td className="p-3 text-right font-medium text-gray-900">{entry.lastName}</td>
                      <td className="p-3 text-right font-medium text-gray-900">{entry.firstName}</td>
                      <td className="p-3 text-center text-xs font-mono text-gray-700">
                        {/* 🔑 تنسيق YYYY/MM/DD */}
                        {formatDateYMD(entry.date)}
                      </td>
                      <td className="p-3 text-center">
                        {entry.source === "new" ? (
                          <Badge className="bg-sky-100 text-sky-800 border-sky-300 text-xs">تسجيل جديد</Badge>
                        ) : (
                          <Badge className="bg-violet-100 text-violet-800 border-violet-300 text-xs">تجديد</Badge>
                        )}
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Signature selection modal */}
      <Dialog open={sigModal} onOpenChange={setSigModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تصدير قائمة حقوق المركب</DialogTitle>
            <DialogDescription>اختر الإمضاءات وصيغة التصدير — {data?.monthName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold mb-2 text-gray-900">الإمضاءات (تظهر في أسفل الملف في سطر واحد):</p>
              <div className="grid grid-cols-1 gap-2">
                {SIGNATURES.map((sig) => (
                  <label key={sig.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-accent/40">
                    <Checkbox checked={selectedSigs.includes(sig.id)} onCheckedChange={() => toggleSig(sig.id)} />
                    <span className="text-sm text-gray-900">{sig.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2 text-gray-900">صيغة التصدير:</p>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>PDF</Button>
                <Button variant="outline" size="sm" onClick={() => handleExport("excel")}>Excel</Button>
                <Button variant="outline" size="sm" onClick={() => handleExport("word")}>Word</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, count, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className={cn("rounded-2xl p-4 text-white bg-gradient-to-br", color)}>
      <Icon className="h-5 w-5 mb-1" />
      <p className="text-2xl font-extrabold tabular-nums">{count}</p>
      <p className="text-xs opacity-90">{label}</p>
    </div>
  );
}

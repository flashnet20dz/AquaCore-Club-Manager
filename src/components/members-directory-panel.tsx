"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users, Download, Loader2, Calendar, ChevronRight, ChevronLeft,
  CheckSquare, Square, RefreshCw, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MemberEntry {
  id: string;
  fileNumber: string;
  lastName: string;
  firstName: string;
  birthDate: string;
  gender: string;
  subscriptionType: string;
  paymentStatus: string;
  lastPaymentDate: string | null;
  createdAt: string;
  age: number;
  renewalStatus: string;
  // renewal info
  lastRenewalDate?: string | null;
  renewalExpiryDate?: string | null;
}

interface MemberData {
  members: MemberEntry[];
  stats: {
    total: number;
    paid: number;
    unpaid: number;
    exempt: number;
  };
}

const MONTH_NAMES = ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

const SIGNATURES = [
  { id: "president", label: "إمضاء رئيس الجمعية" },
  { id: "branch", label: "رئيس الفرع" },
  { id: "manager", label: "مدير الوحدة" },
  { id: "compound", label: "مدير ديوان المركب" },
  { id: "insurance", label: "تأشيرة التأمين" },
];

function formatDateYMD(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

export function MembersDirectoryPanel() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<MemberEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [sigModal, setSigModal] = useState(false);
  const [selectedSigs, setSelectedSigs] = useState<string[]>(["president", "compound"]);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // جلب كل المنخرطين مع معلومات التجديد
      const res = await fetch(`/api/subscribers?limit=10000`, { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        setData(d.subscribers || []);
      }
    } catch {
      toast.error("تعذر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, []);

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

  const handleExport = async (format: string) => {
    setSigModal(false);
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("type", "subscribers");
      params.set("format", format);
      if (selectedSigs.length > 0) params.set("sigs", selectedSigs.join(","));
      // فلترة بالشهر إن لزم
      params.set("from", `${year}-${String(month).padStart(2, "0")}-01`);
      params.set("to", `${year}-${String(month).padStart(2, "0")}-31`);

      const res = await fetch(`/api/export?${params.toString()}`);
      if (!res.ok) throw new Error("فشل التصدير");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = format === "pdf" ? "pdf" : format === "excel" ? "xlsx" : "doc";
      a.download = `AquaCore_سجل_المنخرطين_${year}_${month}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تصدير سجل المنخرطين");
    } catch {
      toast.error("فشل التصدير");
    } finally {
      setExporting(false);
    }
  };

  // فلترة حسب البحث
  const filtered = data.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return m.lastName.toLowerCase().includes(q) ||
           m.firstName.toLowerCase().includes(q) ||
           m.fileNumber.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-teal-600" />
            <div>
              <h2 className="text-xl font-bold text-teal-900">سجل المنخرطين الكامل</h2>
              <p className="text-xs text-muted-foreground">قائمة بكل المنخرطين بمعلوماتهم الشخصية ومعلومات الانخراط</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setSigModal(true)} disabled={exporting || data.length === 0}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 ml-1" />}
            تحميل السجل
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو رقم الملف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
        <Badge variant="secondary">{filtered.length} منخرط</Badge>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-muted/60 text-foreground border-b-2 border-primary/20">
                <th className="p-3 text-right w-12">#</th>
                <th className="p-3 text-right">رقم الملف</th>
                <th className="p-3 text-right">اللقب</th>
                <th className="p-3 text-right">الاسم</th>
                <th className="p-3 text-center w-32">تاريخ الميلاد</th>
                <th className="p-3 text-center w-24">الجنس</th>
                <th className="p-3 text-center w-24">العمر</th>
                <th className="p-3 text-center w-24">نوع الاشتراك</th>
                <th className="p-3 text-center w-32">تاريخ التسجيل</th>
                <th className="p-3 text-center w-32">آخر دفعة</th>
                <th className="p-3 text-center w-24">حالة الدفع</th>
                <th className="p-3 text-center w-24">حالة التجديد</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin text-teal-600 mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-16">
                    <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">لا يوجد منخروطون</p>
                  </td>
                </tr>
              ) : (
                filtered.map((m, i) => (
                  <motion.tr
                    key={m.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.003, 0.2) }}
                    className="border-b border-border/40 transition hover:bg-muted/40"
                  >
                    <td className="p-3 text-center text-xs text-muted-foreground">{i + 1}</td>
                    <td className="p-3 text-center font-mono text-xs font-bold">{m.fileNumber}</td>
                    <td className="p-3 text-right font-medium">{m.lastName}</td>
                    <td className="p-3 text-right font-medium">{m.firstName}</td>
                    <td className="p-3 text-center text-xs font-mono">{formatDateYMD(m.birthDate)}</td>
                    <td className="p-3 text-center">{m.gender}</td>
                    <td className="p-3 text-center text-xs">{m.age}</td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className="text-[10px]">{m.subscriptionType}</Badge>
                    </td>
                    <td className="p-3 text-center text-xs font-mono">{formatDateYMD(m.createdAt)}</td>
                    <td className="p-3 text-center text-xs font-mono">{m.lastPaymentDate ? formatDateYMD(m.lastPaymentDate) : "—"}</td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className={cn("text-[10px]",
                        m.paymentStatus === "مدفوع" ? "bg-emerald-100 text-emerald-700 border-emerald-300" :
                        m.paymentStatus === "لم يدفع" ? "bg-rose-100 text-rose-700 border-rose-300" :
                        m.paymentStatus === "معفى" ? "bg-violet-100 text-violet-700 border-violet-300" :
                        "bg-amber-100 text-amber-700 border-amber-300"
                      )}>{m.paymentStatus}</Badge>
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className={cn("text-[10px]",
                        m.renewalStatus?.includes("ساري") ? "bg-emerald-100 text-emerald-700 border-emerald-300" :
                        m.renewalStatus?.includes("قريب") ? "bg-amber-100 text-amber-700 border-amber-300" :
                        m.renewalStatus?.includes("منتهي") ? "bg-rose-100 text-rose-700 border-rose-300" :
                        "bg-slate-100 text-slate-500 border-slate-300"
                      )}>{m.renewalStatus || "—"}</Badge>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export modal */}
      <Dialog open={sigModal} onOpenChange={setSigModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تصدير سجل المنخرطين</DialogTitle>
            <DialogDescription>اختر الإمضاءات وصيغة التصدير</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold mb-2">الإمضاءات:</p>
              <div className="grid grid-cols-1 gap-2">
                {SIGNATURES.map((sig) => (
                  <label key={sig.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-accent/40">
                    <Checkbox checked={selectedSigs.includes(sig.id)} onCheckedChange={() => toggleSig(sig.id)} />
                    <span className="text-sm">{sig.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">صيغة التصدير:</p>
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

"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Building2, Download, Search, Loader2, Check, Users, CheckCircle2, XCircle,
  FileText, Wallet, TrendingUp, Filter, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { SubscriberWithComputed } from "@/lib/rcs";

interface CompoundPanelProps {
  subscribers: SubscriberWithComputed[];
  onRefresh?: () => void;
}

interface CompoundStatus {
  [subscriberId: string]: boolean;
}

const SIGNATURES = [
  { id: "president", label: "إمضاء رئيس الجمعية" },
  { id: "branch", label: "رئيس الفرع" },
  { id: "manager", label: "مدير الوحدة" },
  { id: "compound", label: "مدير ديوان المركب" },
  { id: "insurance", label: "تأشيرة التأمين" },
];

export function CompoundPanel({ subscribers, onRefresh }: CompoundPanelProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "paid" | "unpaid" | "eligible">("eligible");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compoundStatus, setCompoundStatus] = useState<CompoundStatus>({});
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [sigModal, setSigModal] = useState<{ open: boolean; format: string } | null>(null);
  const [selectedSigs, setSelectedSigs] = useState<string[]>(["president", "compound"]);

  // جلب حالة حقوق المركب من المدفوعات
  const fetchCompoundStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payments?category=compound", { cache: "no-store" });
      const data = await res.json();
      const status: CompoundStatus = {};
      for (const p of data.payments || []) {
        if (p.subscriberId) status[p.subscriberId] = true;
      }
      setCompoundStatus(status);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCompoundStatus(); }, [fetchCompoundStatus]);

  // 🔑 المنخرطون المؤهلون: المبلغ الإجمالي >= 1300 دج
  const eligibleSubs = subscribers.filter((s) => (s.totalAmount ?? 0) >= 1300);
  const paidCount = eligibleSubs.filter((s) => compoundStatus[s.id]).length;
  const unpaidCount = eligibleSubs.length - paidCount;

  const filteredSubs = (() => {
    let result = eligibleSubs;
    if (filter === "paid") result = eligibleSubs.filter((s) => compoundStatus[s.id]);
    else if (filter === "unpaid") result = eligibleSubs.filter((s) => !compoundStatus[s.id]);
    // eligible = الكل المؤهلين
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((s) =>
        s.fileNumber?.toLowerCase().includes(q) ||
        s.lastName?.toLowerCase().includes(q) ||
        s.firstName?.toLowerCase().includes(q) ||
        `${s.lastName} ${s.firstName}`.toLowerCase().includes(q)
      );
    }
    return result;
  })();

  const handleToggleCompound = async (id: string) => {
    setTogglingId(id);
    try {
      const res = await fetch(`/api/subscribers/${id}/toggle-compound`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCompoundStatus((prev) => {
        const next = { ...prev };
        if (data.hasCompound) next[id] = true;
        else delete next[id];
        return next;
      });
      toast.success(data.hasCompound ? "تم تحصيل حقوق المركب" : "تم إلغاء حقوق المركب");
      onRefresh?.();
    } catch {
      toast.error("فشل");
    } finally {
      setTogglingId(null);
    }
  };

  const handleBulkCompound = async () => {
    const toCollect = selectedIds.filter((id) => !compoundStatus[id]);
    if (toCollect.length === 0) {
      toast.info("المنخرطون المحددون سبق تحصيل حقوق المركب لهم");
      return;
    }
    setLoading(true);
    let success = 0;
    for (const id of toCollect) {
      try {
        const res = await fetch(`/api/subscribers/${id}/toggle-compound`, { method: "PATCH" });
        if (res.ok) {
          success++;
          setCompoundStatus((prev) => ({ ...prev, [id]: true }));
        }
      } catch {}
    }
    toast.success(`تم تحصيل حقوق المركب لـ ${success} منخرط`);
    setSelectedIds([]);
    setLoading(false);
    onRefresh?.();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const selectAllUnpaid = () => {
    setSelectedIds(filteredSubs.filter((s) => !compoundStatus[s.id]).map((s) => s.id));
  };

  const toggleSig = (id: string) => {
    setSelectedSigs((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  };

  const handleExport = async (format: string) => {
    setSigModal(null);
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("type", "compound");
      params.set("format", format);
      if (selectedSigs.length > 0) params.set("sigs", selectedSigs.join(","));

      const res = await fetch(`/api/export?${params.toString()}`);
      if (!res.ok) throw new Error("فشل التصدير");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = format === "pdf" ? "pdf" : format === "excel" ? "xlsx" : "doc";
      a.download = `AquaCore_حقوق_المركب_${new Date().toISOString().split("T")[0]}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تصدير القائمة");
    } catch {
      toast.error("فشل التصدير");
    } finally {
      setExporting(false);
    }
  };

  const totalCollected = eligibleSubs
    .filter((s) => compoundStatus[s.id])
    .reduce((sum, s) => sum + 1000, 0);
  const totalPending = unpaidCount * 1000;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-teal-600" />
            <div>
              <h2 className="text-xl font-bold">حقوق المركب</h2>
              <p className="text-xs text-muted-foreground">المنخرطون بمبلغ إجمالي ≥ 1300 دج</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSigModal({ open: true, format: "pdf" })} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 ml-1" />}
              تصدير
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label="مؤهلون" count={eligibleSubs.length} color="bg-teal-600" active={filter === "eligible"} onClick={() => setFilter("eligible")} />
        <StatCard icon={CheckCircle2} label="مُحصَّل" count={paidCount} color="bg-emerald-600" active={filter === "paid"} onClick={() => setFilter("paid")} />
        <StatCard icon={XCircle} label="غير محصّل" count={unpaidCount} color="bg-rose-600" active={filter === "unpaid"} onClick={() => setFilter("unpaid")} />
        <div className="rounded-2xl p-4 text-white bg-gradient-to-br from-amber-600 to-orange-600">
          <Wallet className="h-5 w-5 mb-1" />
          <p className="text-2xl font-extrabold tabular-nums">{totalCollected.toLocaleString()}</p>
          <p className="text-xs opacity-90">دج محصّل (من {totalPending.toLocaleString()} مطلوب)</p>
        </div>
      </div>

      {/* Search + actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="بحث برقم الملف أو الاسم..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10 h-10" />
        </div>
        <Button size="sm" variant="outline" onClick={selectAllUnpaid}>تحديد غير المحصّل</Button>
        <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>إلغاء التحديد</Button>
        {selectedIds.length > 0 && (
          <Button size="sm" onClick={handleBulkCompound} className="bg-teal-600 hover:bg-teal-700 text-white">
            <Building2 className="h-3.5 w-3.5 ml-1" /> تحصيل المحدد ({selectedIds.length})
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-teal-700 text-white">
                <th className="p-2 w-10">
                  <input type="checkbox" className="h-4 w-4" checked={selectedIds.length > 0 && selectedIds.length === filteredSubs.filter((s) => !compoundStatus[s.id]).length} onChange={(e) => e.target.checked ? selectAllUnpaid() : setSelectedIds([])} />
                </th>
                <th className="p-2 text-right w-20">رقم</th>
                <th className="p-2 text-right">اللقب والاسم</th>
                <th className="p-2 text-center w-28">نوع الاشتراك</th>
                <th className="p-2 text-center w-28">المبلغ الإجمالي</th>
                <th className="p-2 text-center w-32">حقوق المركب</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" /></td></tr>
              ) : filteredSubs.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">لا يوجد منخرطون مؤهلون</td></tr>
              ) : (
                filteredSubs.map((s, i) => {
                  const hasCompound = !!compoundStatus[s.id];
                  const isSelected = selectedIds.includes(s.id);
                  return (
                    <motion.tr
                      key={s.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.005, 0.2) }}
                      className={cn("border-b transition hover:bg-accent/40", i % 2 === 0 ? "bg-white" : "bg-gray-50/50", isSelected && "ring-1 ring-inset ring-teal-400")}
                    >
                      <td className="p-2 text-center">
                        {!hasCompound && (
                          <input type="checkbox" className="h-4 w-4" checked={isSelected} onChange={() => toggleSelect(s.id)} />
                        )}
                      </td>
                      <td className="p-2 text-center font-mono text-xs text-muted-foreground">{s.fileNumber}</td>
                      <td className="p-2 text-right font-medium">{s.lastName} {s.firstName}</td>
                      <td className="p-2 text-center text-xs">{s.subscriptionType}</td>
                      <td className="p-2 text-center font-bold text-teal-700">{(s.totalAmount ?? 0).toLocaleString()} دج</td>
                      <td className="p-2 text-center">
                        {togglingId === s.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        ) : hasCompound ? (
                          <Button size="sm" className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleToggleCompound(s.id)}>
                            <CheckCircle2 className="h-3 w-3 ml-1" /> محصّل ✓
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="h-7 px-3 text-xs border-teal-500 text-teal-600 hover:bg-teal-50" onClick={() => handleToggleCompound(s.id)}>
                            <Building2 className="h-3 w-3 ml-1" /> تحصيل
                          </Button>
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
      <Dialog open={sigModal?.open} onOpenChange={(open) => !open && setSigModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تصدير قائمة حقوق المركب</DialogTitle>
            <DialogDescription>اختر الإمضاءات وصيغة التصدير</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold mb-2">الإمضاءات (تظهر في أسفل الملف):</p>
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

function StatCard({ icon: Icon, label, count, color, active, onClick }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  color: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn("rounded-2xl p-4 text-white text-right transition", color, active ? "ring-2 ring-offset-2 ring-offset-background ring-white" : "opacity-80 hover:opacity-100")}
    >
      <Icon className="h-5 w-5 mb-1" />
      <p className="text-2xl font-extrabold tabular-nums">{count}</p>
      <p className="text-xs opacity-90">{label}</p>
    </button>
  );
}

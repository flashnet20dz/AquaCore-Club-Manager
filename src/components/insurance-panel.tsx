"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Download, Search, Loader2, Check, Users, Shield, ShieldOff,
  FileText, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { SubscriberWithComputed } from "@/lib/rcs";

interface InsurancePanelProps {
  subscribers: SubscriberWithComputed[];
  onRefresh?: () => void;
}

interface InsuranceStatus {
  [subscriberId: string]: boolean;
}

export function InsurancePanel({ subscribers, onRefresh }: InsurancePanelProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "insured" | "uninsured">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [insuranceStatus, setInsuranceStatus] = useState<InsuranceStatus>({});
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  // 🔑 فلاتر جديدة: شهر، من/إلى، حالة
  const [monthFilter, setMonthFilter] = useState<string>(""); // YYYY-MM
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Fetch insurance status from payments
  const fetchInsuranceStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payments?category=insurance", { cache: "no-store" });
      const data = await res.json();
      const status: InsuranceStatus = {};
      for (const p of data.payments || []) {
        if (p.subscriberId) status[p.subscriberId] = true;
      }
      setInsuranceStatus(status);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInsuranceStatus(); }, [fetchInsuranceStatus]);

  // Computed
  const insuredCount = Object.keys(insuranceStatus).length;
  const uninsuredCount = subscribers.length - insuredCount;

  const filteredSubs = subscribers.filter((s) => {
    const isInsured = !!insuranceStatus[s.id];
    if (filter === "insured" && !isInsured) return false;
    if (filter === "uninsured" && isInsured) return false;
    // 🔑 فلتر الشهر: YYYY-MM
    if (monthFilter && s.lastPaymentDate) {
      const d = new Date(s.lastPaymentDate);
      const subMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (subMonth !== monthFilter) return false;
    }
    // 🔑 فلتر من/إلى (تاريخ الميلاد)
    if (dateFrom && s.birthDate) {
      const bd = new Date(s.birthDate);
      const from = new Date(dateFrom);
      if (bd < from) return false;
    }
    if (dateTo && s.birthDate) {
      const bd = new Date(s.birthDate);
      const to = new Date(dateTo);
      to.setHours(23, 59, 59);
      if (bd > to) return false;
    }
    if (!search) return true;
    const q = search.toLowerCase();
    return s.lastName.toLowerCase().includes(q) || s.firstName.toLowerCase().includes(q) || s.fileNumber.toLowerCase().includes(q);
  });

  const handleToggleInsurance = async (id: string) => {
    setTogglingId(id);
    try {
      const res = await fetch(`/api/subscribers/${id}/toggle-insurance`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInsuranceStatus((prev) => {
        const next = { ...prev };
        if (data.isInsured) next[id] = true;
        else delete next[id];
        return next;
      });
      toast.success(data.isInsured ? "تم تأمين المنخرط" : "تم إلغاء التأمين");
      onRefresh?.();
    } catch {
      toast.error("فشل");
    } finally {
      setTogglingId(null);
    }
  };

  const handleBulkInsure = async () => {
    const toInsure = selectedIds.filter((id) => !insuranceStatus[id]);
    if (toInsure.length === 0) {
      toast.info("المنخرطون المحددون مؤمنون بالفعل");
      return;
    }
    setLoading(true);
    let success = 0;
    for (const id of toInsure) {
      try {
        const res = await fetch(`/api/subscribers/${id}/toggle-insurance`, { method: "PATCH" });
        if (res.ok) {
          success++;
          setInsuranceStatus((prev) => ({ ...prev, [id]: true }));
        }
      } catch {}
    }
    toast.success(`تم تأمين ${success} منخرط`);
    setSelectedIds([]);
    setLoading(false);
    onRefresh?.();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const selectAllUninsured = () => {
    setSelectedIds(filteredSubs.filter((s) => !insuranceStatus[s.id]).map((s) => s.id));
  };

  const handleExportWord = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/export?format=word&type=insurance&sigs=president,branch,insurance");
      if (!res.ok) throw new Error("فشل");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `RCS_قائمة_التأمين_${new Date().toISOString().split("T")[0]}.doc`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تصدير القائمة الرسمية");
    } catch {
      toast.error("فشل التصدير");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
            <h2 className="text-xl font-bold text-blue-900">إدارة التأمين</h2>
          </div>
          <Button onClick={handleExportWord} disabled={exporting} variant="outline" className="border-blue-600 text-blue-700 hover:bg-blue-50">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 ml-1" />}
            تحميل القائمة الرسمية
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Users} label="إجمالي" count={subscribers.length} color="bg-blue-600" active={filter === "all"} onClick={() => setFilter("all")} />
        <StatCard icon={Shield} label="مؤمن" count={insuredCount} color="bg-emerald-600" active={filter === "insured"} onClick={() => setFilter("insured")} />
        <StatCard icon={ShieldOff} label="غير مؤمن" count={uninsuredCount} color="bg-rose-600" active={filter === "uninsured"} onClick={() => setFilter("uninsured")} />
      </div>

      {/* Search + filters + actions */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم أو رقم العضوية..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10 h-10" />
          </div>
          <Button size="sm" variant="outline" onClick={selectAllUninsured}>تحديد الكل</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>إلغاء التحديد</Button>
          {selectedIds.length > 0 && (
            <Button size="sm" onClick={handleBulkInsure} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <ShieldCheck className="h-3.5 w-3.5 ml-1" /> تأمين المحدد ({selectedIds.length})
            </Button>
          )}
        </div>
        {/* 🔑 فلاتر الشهر، من/إلى، حالة */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="font-semibold text-muted-foreground">فلترة:</span>
          {/* فلتر الشهر */}
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            title="فلترة حسب شهر الدفعة"
          />
          {/* فلتر تاريخ الميلاد من */}
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">الميلاد من:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            />
          </div>
          {/* فلتر تاريخ الميلاد إلى */}
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">إلى:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            />
          </div>
          {/* زر مسح الفلاتر */}
          {(monthFilter || dateFrom || dateTo) && (
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setMonthFilter(""); setDateFrom(""); setDateTo(""); }}>
              مسح الفلاتر
            </Button>
          )}
          <Badge variant="outline" className="text-[10px]">{filteredSubs.length} نتيجة</Badge>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blue-900 text-white">
                <th className="p-2 w-10">
                  <input type="checkbox" className="h-4 w-4" checked={selectedIds.length > 0 && selectedIds.length === filteredSubs.filter((s) => !insuranceStatus[s.id]).length} onChange={(e) => e.target.checked ? selectAllUninsured() : setSelectedIds([])} />
                </th>
                <th className="p-2 text-right w-20">رقم</th>
                <th className="p-2 text-right">اللقب والاسم</th>
                <th className="p-2 text-center w-32">تاريخ الميلاد</th>
                <th className="p-2 text-center w-28">التأمين</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" /></td></tr>
              ) : filteredSubs.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">لا يوجد منخرون</td></tr>
              ) : (
                filteredSubs.map((s, i) => {
                  const isInsured = !!insuranceStatus[s.id];
                  const isSelected = selectedIds.includes(s.id);
                  return (
                    <motion.tr
                      key={s.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.01, 0.3) }}
                      className={cn("border-b transition hover:bg-accent/40", i % 2 === 0 ? "bg-white" : "bg-gray-50/50", isSelected && "ring-1 ring-inset ring-blue-400")}
                    >
                      <td className="p-2 text-center">
                        {!isInsured && (
                          <input type="checkbox" className="h-4 w-4" checked={isSelected} onChange={() => toggleSelect(s.id)} />
                        )}
                      </td>
                      <td className="p-2 text-center font-mono text-xs text-muted-foreground">{s.fileNumber}</td>
                      <td className="p-2 text-right font-medium">{s.lastName} {s.firstName}</td>
                      <td className="p-2 text-center text-xs text-muted-foreground">{s.birthDate ? new Date(s.birthDate).toISOString().split("T")[0].replace(/-/g, "/") : "—"}</td>
                      <td className="p-2 text-center">
                        {togglingId === s.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        ) : isInsured ? (
                          <Button size="sm" className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleToggleInsurance(s.id)}>
                            <ShieldCheck className="h-3 w-3 ml-1" /> مأمن ✓
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="h-7 px-3 text-xs border-emerald-500 text-emerald-600 hover:bg-emerald-50" onClick={() => handleToggleInsurance(s.id)}>
                            <Shield className="h-3 w-3 ml-1" /> تأمين
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

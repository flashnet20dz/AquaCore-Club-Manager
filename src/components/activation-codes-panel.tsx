"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  KeyRound, Plus, Download, Search, Loader2, X, Sparkles, Copy,
  CheckCircle2, Ban, Eye, Trash2, FileText, Filter, RefreshCw, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Batch {
  id: string;
  batchNo: number;
  name: string;
  plan: string;
  planLabel: string;
  durationDays: number;
  count: number;
  createdAt: string;
  generatedBy: string;
  stats: { unused: number; used: number; revoked: number };
}

interface CodeEntry {
  id: string;
  code: string;
  plan: string;
  planLabel: string;
  durationDays: number;
  status: string;
  club: { id: string; name: string; email: string } | null;
  activatedAt: string | null;
  expiresAt: string | null;
  hardwareFingerprint: string | null;
  createdAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
}

const PLAN_OPTIONS = [
  { value: "monthly", label: "شهري (30 يوم)" },
  { value: "quarterly", label: "ربع سنوي (90 يوم)" },
  { value: "halfyear", label: "نصف سنوي (180 يوم)" },
  { value: "yearly", label: "سنوي (365 يوم)" },
  { value: "twoyear", label: "سنتان (730 يوم)" },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  unused: { label: "غير مستخدم", color: "bg-sky-500/15 text-sky-700 border-sky-500/30" },
  used: { label: "مُستخدم", color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  revoked: { label: "ملغى", color: "bg-rose-500/15 text-rose-700 border-rose-500/30" },
};

export function ActivationCodesPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [codes, setCodes] = useState<CodeEntry[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [search, setSearch] = useState("");

  // نموذج التوليد
  const [genOpen, setGenOpen] = useState(false);
  const [genPlan, setGenPlan] = useState("monthly");
  const [genCount, setGenCount] = useState(100);
  const [genName, setGenName] = useState("");
  const [genNotes, setGenNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<{ codes: string[]; batchNo: number } | null>(null);

  // ★ نموذج التحقق من كود
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/activation-codes/list", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setBatches(data.batches || []);
      }
    } catch {
      toast.error("فشل تحميل الدفعات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchBatches();
  }, [open, fetchBatches]);

  const fetchCodes = async (batchId: string) => {
    setCodesLoading(true);
    try {
      const res = await fetch(`/api/activation-codes/list?batchId=${batchId}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setCodes(data.codes || []);
      }
    } catch {
      toast.error("فشل تحميل الأكواد");
    } finally {
      setCodesLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/activation-codes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: genPlan,
          count: genCount,
          name: genName,
          notes: genNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل التوليد");
        return;
      }
      setGeneratedResult({ codes: data.codes, batchNo: data.batch.batchNo });
      toast.success(`تم توليد ${data.codes.length} كود بنجاح`);
      fetchBatches();
    } catch {
      toast.error("فشل التوليد");
    } finally {
      setGenerating(false);
    }
  };

  // ★ التحقق من كود تفعيل — يعرض حالته الكاملة
  const handleVerify = async () => {
    if (!verifyCode.trim()) {
      toast.error("أدخل كوداً للتحقق");
      return;
    }
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetch("/api/activation-codes/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verifyCode.trim() }),
      });
      const data = await res.json();
      setVerifyResult(data);
      if (data.valid && data.canBeActivated) {
        toast.success("✓ الكود صالح ومتاح للتفعيل");
      } else if (data.valid && !data.canBeActivated) {
        toast.warning(data.message || "الكود صالح لكنه غير متاح للتفعيل");
      } else {
        toast.error(data.error || "كود غير صالح");
      }
    } catch {
      toast.error("تعذر التحقق — تحقق من الاتصال");
    } finally {
      setVerifying(false);
    }
  };

  const handleRevoke = async (codeId: string, code: string) => {
    if (!confirm(`إلغاء الكود ${code.substring(0, 14)}...؟`)) return;
    try {
      const res = await fetch("/api/activation-codes/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codeId, reason: "إلغاء يدوي" }),
      });
      if (res.ok) {
        toast.success("تم إلغاء الكود");
        if (selectedBatch) fetchCodes(selectedBatch.id);
      }
    } catch {
      toast.error("فشل الإلغاء");
    }
  };

  const copyAll = (codesList: string[]) => {
    navigator.clipboard.writeText(codesList.join("\n"));
    toast.success(`تم نسخ ${codesList.length} كود`);
  };

  const exportTxt = (codesList: string[], batchName: string) => {
    const blob = new Blob([codesList.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aquacore-codes-${batchName.replace(/\s+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير الأكواد (TXT)");
  };

  const exportCsv = (codesList: CodeEntry[], batchName: string) => {
    const header = "الكود,الخطة,المدة(يوم),الحالة,النادي,تاريخ التفعيل,تاريخ الانتهاء\n";
    const rows = codesList.map((c) =>
      `${c.code},${c.planLabel},${c.durationDays},${STATUS_LABELS[c.status]?.label || c.status},${c.club?.name || "—"},${c.activatedAt ? new Date(c.activatedAt).toLocaleDateString("en-GB") : "—"},${c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("en-GB") : "—"}`
    ).join("\n");
    const blob = new Blob(["\ufeff" + header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aquacore-codes-${batchName.replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير الأكواد (CSV/Excel)");
  };

  const filteredCodes = codes.filter((c) =>
    !search || c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.club?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalUnused = batches.reduce((s, b) => s + b.stats.unused, 0);
  const totalUsed = batches.reduce((s, b) => s + b.stats.used, 0);
  const totalRevoked = batches.reduce((s, b) => s + b.stats.revoked, 0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.97, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-6xl max-h-[95vh] bg-background rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gradient-to-l from-teal-500/10 to-sky-500/10">
              <div className="flex items-center gap-2">
                <KeyRound className="h-6 w-6 text-primary" />
                <div>
                  <h2 className="font-extrabold text-lg">إدارة أكواد التفعيل</h2>
                  <p className="text-xs text-muted-foreground">توليد ومراقبة أكواد اشتراك الأندية</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* ★ زر التحقق من كود */}
                <Button size="sm" variant="outline" onClick={() => { setVerifyOpen(true); setVerifyResult(null); setVerifyCode(""); }} className="h-9 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10">
                  <ShieldCheck className="h-4 w-4 ml-1" /> تحقق من كود
                </Button>
                <Button size="sm" onClick={() => setGenOpen(true)} className="h-9 bg-gradient-to-l from-teal-500 to-sky-500 hover:from-teal-400 hover:to-sky-400 border-0">
                  <Plus className="h-4 w-4 ml-1" /> توليد دفعة جديدة
                </Button>
                <Button size="icon" variant="ghost" onClick={onClose} className="h-9 w-9">
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-2 p-4 border-b bg-muted/20">
              <div className="rounded-lg p-2 text-center bg-sky-500/10 border border-sky-500/20">
                <div className="text-2xl font-extrabold text-sky-700">{totalUnused}</div>
                <div className="text-[10px] text-muted-foreground">غير مستخدمة</div>
              </div>
              <div className="rounded-lg p-2 text-center bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-2xl font-extrabold text-emerald-700">{totalUsed}</div>
                <div className="text-[10px] text-muted-foreground">مُستخدمة</div>
              </div>
              <div className="rounded-lg p-2 text-center bg-rose-500/10 border border-rose-500/20">
                <div className="text-2xl font-extrabold text-rose-700">{totalRevoked}</div>
                <div className="text-[10px] text-muted-foreground">ملغاة</div>
              </div>
              <div className="rounded-lg p-2 text-center bg-primary/10 border border-primary/20">
                <div className="text-2xl font-extrabold text-primary">{batches.length}</div>
                <div className="text-[10px] text-muted-foreground">دفعات</div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-hidden flex">
              {/* Batches sidebar */}
              <div className="w-1/2 border-l overflow-y-auto" style={{ maxHeight: "calc(95vh - 200px)" }}>
                {loading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : batches.length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <KeyRound className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground mb-4">لا توجد أكواد بعد. ابدأ بتوليد دفعة جديدة.</p>
                    <Button onClick={() => setGenOpen(true)} className="bg-gradient-to-l from-teal-500 to-sky-500 border-0">
                      <Plus className="h-4 w-4 ml-1" /> توليد دفعة
                    </Button>
                  </div>
                ) : (
                  <div className="p-3 space-y-2">
                    {batches.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => { setSelectedBatch(b); fetchCodes(b.id); }}
                        className={cn(
                          "w-full text-right p-3 rounded-xl border transition",
                          selectedBatch?.id === b.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40 hover:bg-accent/50"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm">#{b.batchNo} — {b.name}</span>
                          <Badge variant="outline" className="text-[10px]">{b.planLabel}</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2">
                          <span>{b.count} كود</span>
                          <span>•</span>
                          <span>{new Date(b.createdAt).toLocaleDateString("ar-DZ")}</span>
                          <span>•</span>
                          <span>بواسطة {b.generatedBy}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <Badge className="bg-sky-500/15 text-sky-700 border-sky-500/30">{b.stats.unused} متاح</Badge>
                          <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">{b.stats.used} مستخدم</Badge>
                          {b.stats.revoked > 0 && (
                            <Badge className="bg-rose-500/15 text-rose-700 border-rose-500/30">{b.stats.revoked} ملغى</Badge>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Codes detail */}
              <div className="flex-1 overflow-y-auto" style={{ maxHeight: "calc(95vh - 200px)" }}>
                {!selectedBatch ? (
                  <div className="text-center py-16 text-sm text-muted-foreground">
                    <Eye className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    اختر دفعة لعرض أكوادها
                  </div>
                ) : (
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Input
                        placeholder="بحث برقم الكود أو اسم النادي..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-9"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => exportTxt(codes.map((c) => c.code), selectedBatch.name)}
                        className="h-9 shrink-0"
                        title="تصدير كأ TXT"
                      >
                        <FileText className="h-4 w-4 ml-1" /> TXT
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => exportCsv(codes, selectedBatch.name)}
                        className="h-9 shrink-0"
                        title="تصدير كـ Excel/CSV"
                      >
                        <Download className="h-4 w-4 ml-1" /> Excel
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyAll(codes.filter((c) => c.status === "unused").map((c) => c.code))}
                        className="h-9 shrink-0"
                        title="نسخ الأكواد المتاحة"
                      >
                        <Copy className="h-4 w-4 ml-1" /> نسخ
                      </Button>
                    </div>

                    {codesLoading ? (
                      <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                    ) : (
                      <div className="space-y-1">
                        {filteredCodes.length === 0 ? (
                          <p className="text-center py-8 text-sm text-muted-foreground">لا توجد أكواد مطابقة</p>
                        ) : (
                          filteredCodes.slice(0, 500).map((c) => (
                            <div
                              key={c.id}
                              className={cn(
                                "flex items-center justify-between gap-2 p-2 rounded-lg border text-xs",
                                c.status === "used" ? "bg-emerald-500/5 border-emerald-500/20" :
                                c.status === "revoked" ? "bg-rose-500/5 border-rose-500/20 opacity-60" :
                                "bg-card border-border"
                              )}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <code className="font-mono font-bold text-xs tracking-wide">{c.code}</code>
                                <Badge className={cn("text-[9px]", STATUS_LABELS[c.status]?.color)} variant="outline">
                                  {STATUS_LABELS[c.status]?.label || c.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
                                {c.club && <span className="hidden sm:inline">→ {c.club.name}</span>}
                                {c.expiresAt && <span>حتى {new Date(c.expiresAt).toLocaleDateString("ar-DZ")}</span>}
                                {c.status === "unused" && (
                                  <button
                                    onClick={() => { navigator.clipboard.writeText(c.code); toast.success("تم النسخ"); }}
                                    className="p-1 rounded hover:bg-accent"
                                    title="نسخ الكود"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </button>
                                )}
                                {c.status !== "revoked" && (
                                  <button
                                    onClick={() => handleRevoke(c.id, c.code)}
                                    className="p-1 rounded hover:bg-rose-500/10 text-rose-600"
                                    title="إلغاء الكود"
                                  >
                                    <Ban className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                        {filteredCodes.length > 500 && (
                          <p className="text-center text-[10px] text-muted-foreground py-2">
                            عرض أول 500 كود من {filteredCodes.length}. صدّر القائمة كاملة لرؤية الجميع.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Generate dialog */}
          <Dialog open={genOpen} onOpenChange={setGenOpen}>
            <DialogContent className="max-w-lg" onClick={(e) => e.stopPropagation()}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" /> توليد دفعة أكواد جديدة
                </DialogTitle>
              </DialogHeader>

              {generatedResult ? (
                <div className="space-y-3">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                    <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                    <p className="font-bold text-emerald-700">تم توليد {generatedResult.codes.length} كود بنجاح!</p>
                    <p className="text-xs text-muted-foreground mt-1">دفعة #{generatedResult.batchNo}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => copyAll(generatedResult.codes)}
                      className="flex-1"
                    >
                      <Copy className="h-4 w-4 ml-1" /> نسخ الكل
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const blob = new Blob([generatedResult.codes.join("\n")], { type: "text/plain;charset=utf-8" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `aquacore-batch-${generatedResult.batchNo}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 ml-1" /> تحميل TXT
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => { setGeneratedResult(null); setGenOpen(false); }}
                    className="w-full"
                  >
                    إغلاق
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-sm">خطة الاشتراك</Label>
                    <Select value={genPlan} onValueChange={setGenPlan}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PLAN_OPTIONS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">عدد الأكواد</Label>
                    <Input
                      type="number"
                      min={1}
                      max={5000}
                      value={genCount}
                      onChange={(e) => setGenCount(Math.min(5000, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="h-10"
                    />
                    <p className="text-[10px] text-muted-foreground">الحد الأقصى 5000 كود لكل دفعة</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">اسم الدفعة (اختياري)</Label>
                    <Input
                      value={genName}
                      onChange={(e) => setGenName(e.target.value)}
                      placeholder="مثال: دفعة يناير 2026 — تجارية"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">ملاحظات (اختياري)</Label>
                    <Textarea
                      value={genNotes}
                      onChange={(e) => setGenNotes(e.target.value)}
                      placeholder="أي ملاحظات للتوثيق..."
                      className="h-16 resize-none"
                    />
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-[11px] text-amber-700">
                    ⚠️ احفظ الأكواد بعد التوليد — لا يمكن استرجاعها لاحقاً إلا من قاعدة البيانات.
                  </div>
                </div>
              )}

              {!generatedResult && (
                <DialogFooter>
                  <Button variant="outline" onClick={() => setGenOpen(false)}>إلغاء</Button>
                  <Button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="bg-gradient-to-l from-teal-500 to-sky-500 hover:from-teal-400 hover:to-sky-400 border-0"
                  >
                    {generating ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> جاري التوليد...</>
                    ) : (
                      <><Sparkles className="h-4 w-4 ml-1" /> توليد {genCount} كود</>
                    )}
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>

          {/* ★ Modal التحقق من كود */}
          <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" /> التحقق من كود تفعيل
                </DialogTitle>
                <DialogDescription>
                  تحقق من صحة كود تفعيل ومعرفة حالته قبل إعطائه لنادٍ
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">كود التفعيل</Label>
                  <Input
                    type="text"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.toUpperCase())}
                    placeholder="AQCR-M1-XXXXXXXX-XXXX"
                    className="h-11 font-mono text-center text-sm tracking-wider"
                    dir="ltr"
                    onKeyDown={(e) => { if (e.key === "Enter" && !verifying) handleVerify(); }}
                  />
                </div>
                <Button onClick={handleVerify} disabled={verifying || !verifyCode.trim()} className="w-full h-10">
                  {verifying ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> جاري التحقق...</>
                  ) : (
                    <><ShieldCheck className="h-4 w-4 ml-1" /> تحقق الآن</>
                  )}
                </Button>

                {/* ★ نتائج التحقق */}
                {verifyResult && (
                  <div className={cn(
                    "rounded-lg border p-3 space-y-2",
                    verifyResult.valid
                      ? (verifyResult.canBeActivated ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300" : "bg-amber-50 dark:bg-amber-950/30 border-amber-300")
                      : "bg-rose-50 dark:bg-rose-950/30 border-rose-300"
                  )}>
                    <div className="flex items-center gap-2">
                      {verifyResult.valid ? (
                        verifyResult.canBeActivated ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        ) : (
          <Ban className="h-5 w-5 text-amber-600" />
                        )
                      ) : (
                        <X className="h-5 w-5 text-rose-600" />
                      )}
                      <span className="font-bold text-sm">
                        {verifyResult.valid
                          ? (verifyResult.canBeActivated ? "كود صالح ومتاح للتفعيل" : "كود صالح لكنه غير متاح")
                          : "كود غير صالح"}
                      </span>
                    </div>
                    {verifyResult.error && !verifyResult.valid && (
                      <p className="text-xs text-rose-700 dark:text-rose-300">{verifyResult.error}</p>
                    )}
                    {verifyResult.valid && (
                      <div className="space-y-1 text-xs">
                        {verifyResult.planLabel && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">الخطة:</span>
                            <span className="font-semibold">{verifyResult.planLabel} ({verifyResult.durationDays} يوم)</span>
                          </div>
                        )}
                        {verifyResult.inDatabase && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">الحالة في DB:</span>
                              <span className="font-semibold">{verifyResult.statusLabel}</span>
                            </div>
                            {verifyResult.club && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">النادي المستخدم:</span>
                                <span className="font-semibold">{verifyResult.club.name}</span>
                              </div>
                            )}
                            {verifyResult.activatedAt && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">تاريخ التفعيل:</span>
                                <span className="font-semibold">{new Date(verifyResult.activatedAt).toLocaleDateString("ar-DZ")}</span>
                              </div>
                            )}
                            {verifyResult.expiresAt && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">ينتهي في:</span>
                                <span className="font-semibold">{new Date(verifyResult.expiresAt).toLocaleDateString("ar-DZ")}</span>
                              </div>
                            )}
                          </>
                        )}
                        {!verifyResult.inDatabase && (
                          <p className="text-amber-700 dark:text-amber-300">
                            ⚠ الكود صالح رياضياً لكنه غير مسجّل في قاعدة البيانات.
                          </p>
                        )}
                        {verifyResult.message && (
                          <p className="text-muted-foreground pt-1 border-t">{verifyResult.message}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-300 p-2.5">
                  <p className="text-[11px] text-blue-700 dark:text-blue-300">
                    💡 استخدم هذه الأداة للتحقق من أي كود قبل إعطائه لنادٍ. الكود الوحيد الاستخدام لا يمكن تفعيله على نادٍ آخر.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setVerifyOpen(false)}>إغلاق</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

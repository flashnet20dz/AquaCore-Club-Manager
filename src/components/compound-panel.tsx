"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Building2, Download, Loader2, Users, FileText, RefreshCw, Calendar,
  TrendingUp, ChevronRight, ChevronLeft, Check, CheckSquare, Square, Copy,
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

const MONTH_NAMES = ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

function formatDateYMD(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

// ★ تحويل الرقم إلى أحرف عربية (تفقيط)
function numberToArabicWords(num: number): string {
  if (num === 0) return "صفر";
  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
  const tens = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const hundreds = ["", "مائة", "مئتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

  function threeDigits(n: number): string {
    let result = "";
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const o = n % 10;
    if (h > 0) result += hundreds[h];
    if (t === 1 && o === 0) {
      if (result) result += " و";
      result += "عشرة";
    } else if (t === 1 && o > 0) {
      if (result) result += " و";
      result += ones[o] + " عشر";
    } else if (t === 2 && o === 1) {
      if (result) result += " و";
      result += "أحد وعشرون";
    } else if (t === 2 && o === 2) {
      if (result) result += " و";
      result += "اثنان وعشرون";
    } else if (t > 0 && o > 0) {
      if (result) result += " و";
      result += ones[o] + " و" + tens[t];
    } else if (t > 0) {
      if (result) result += " و";
      result += tens[t];
    } else if (o > 0) {
      if (result) result += " و";
      result += ones[o];
    }
    return result;
  }

  let result = "";
  const millions = Math.floor(num / 1000000);
  const thousands = Math.floor((num % 1000000) / 1000);
  const remainder = num % 1000;

  if (millions > 0) {
    if (millions === 1) result += "مليون";
    else if (millions === 2) result += "مليونان";
    else if (millions <= 10) result += ones[millions] + " ملايين";
    else result += threeDigits(millions) + " مليون";
  }
  if (thousands > 0) {
    if (result) result += " و";
    if (thousands === 1) result += "ألف";
    else if (thousands === 2) result += "ألفان";
    else if (thousands <= 10) result += ones[thousands] + " آلاف";
    else result += threeDigits(thousands) + " ألف";
  }
  if (remainder > 0) {
    if (result) result += " و";
    result += threeDigits(remainder);
  }
  return result;
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
        setSelectedIds(new Set());
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

  // ★ نسخ القائمة إلى الحافظة
  const handleCopyList = async () => {
    const target = selectedIds.size > 0
      ? entries.filter((e) => selectedIds.has(e.subscriberId))
      : entries;
    if (target.length === 0) { toast.info("لا يوجد منخرطون للنسخ"); return; }
    const header = "#\tرقم الملف\tاللقب\tالاسم\tالتاريخ\tالنوع\tالمبلغ";
    const rows = target.map((e, i) =>
      `${i + 1}\t${e.fileNumber}\t${e.lastName}\t${e.firstName}\t${formatDateYMD(e.date)}\t${e.source === "new" ? "تسجيل جديد" : "تجديد"}\t1000`
    ).join("\n");
    const text = `${header}\n${rows}\n\nالمجموع: ${target.length} منخرط\t${(target.length * 1000).toLocaleString()} دج`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`تم نسخ ${target.length} منخرط إلى الحافظة`);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
      toast.success(`تم نسخ ${target.length} منخرط`);
    }
  };

  // ★ تصدير PDF client-side (html2canvas) — يعرض النص العربي صحيحاً
  const exportPdfClientSide = async (selectedOnly: boolean) => {
    const target = selectedOnly && selectedIds.size > 0
      ? entries.filter((e) => selectedIds.has(e.subscriberId))
      : entries;
    if (target.length === 0) { toast.info("لا يوجد منخرطون للتصدير"); return; }
    const today = new Date();
    const dStr = formatDateYMD(today.toISOString());
    const sigsHTML = selectedSigs.map((sigId) => {
      const sig = SIGNATURES.find((s) => s.id === sigId);
      return sig ? `<td style="text-align:center;vertical-align:bottom;padding:20px 10px 5px;border:none;width:${Math.floor(100 / selectedSigs.length)}%;">
        <div style="border-top:1.5px solid #333;height:40px;margin-bottom:5px;"></div>
        <div style="font-size:11px;font-weight:bold;color:#333;">${sig.label}</div></td>` : "";
    }).join("");
    const tableRows = target.map((e, i) => `<tr>
        <td style="text-align:center;padding:6px;border:1px solid #ccc;">${i + 1}</td>
        <td style="text-align:center;font-family:monospace;padding:6px;border:1px solid #ccc;">${e.fileNumber}</td>
        <td style="padding:6px;border:1px solid #ccc;">${e.lastName}</td>
        <td style="padding:6px;border:1px solid #ccc;">${e.firstName}</td>
        <td style="text-align:center;padding:6px;border:1px solid #ccc;">${formatDateYMD(e.date)}</td>
        <td style="text-align:center;padding:6px;border:1px solid #ccc;">${e.source === "new" ? "تسجيل جديد" : "تجديد"}</td>
        <td style="text-align:center;font-weight:bold;padding:6px;border:1px solid #ccc;">1000</td></tr>`
    ).join("");
    const total = target.length * 1000;
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
    <style>@page{size:A4 landscape;margin:15mm}body{font-family:'Cairo','Tahoma',Arial,sans-serif;font-size:11pt;direction:rtl}
    table{border-collapse:collapse;width:100%;font-size:10pt}th{background:#0f766e;color:white;padding:6px;text-align:center;border:1px solid #ccc}
    td{padding:6px;border:1px solid #ccc}.total-row{background:#fef3c7;font-weight:bold}
    .amount-words{text-align:right;font-size:12pt;font-weight:bold;margin-top:15px}.sigs{width:100%;border-collapse:collapse;margin-top:40px}</style>
    </head><body><div style="text-align:center;margin-bottom:10px">
    <h1 style="font-size:16pt;color:#0f766e;margin:0">نادي RCS للسباحة — حقوق المركب</h1>
    <p style="font-size:10pt;color:#555;margin:2px 0">الشهر: ${MONTH_NAMES[month - 1]} ${year} — سعيدة في: ${dStr}</p>
    <p style="font-size:10pt;color:#555;margin:2px 0">الرقم: . . ./ن.ر.ه.ر.س ${today.getFullYear()}</p></div>
    <table><thead><tr><th>#</th><th>رقم الملف</th><th>اللقب</th><th>الاسم</th><th>التاريخ</th><th>النوع</th><th>المبلغ</th></tr></thead>
    <tbody>${tableRows}</tbody>
    <tfoot><tr class="total-row"><td colspan="6" style="text-align:center">المجموع</td>
    <td style="text-align:center;color:#0369a1">${total.toLocaleString()} دج</td></tr></tfoot></table>
    <p class="amount-words">تم تحديد المبلغ بـ: <span style="color:#0369a1">${amountInWords} دينار جزائري (${total.toLocaleString()} دج)</span></p>
    <table class="sigs"><tr>${sigsHTML}</tr></table></body></html>`;
    // iframe + html2canvas
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:-9999px;top:0;width:1123px;height:794px;border:none;";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow!.document;
    doc.open(); doc.write(html); doc.close();
    await new Promise((r) => setTimeout(r, 500));
    const mod = await import("html2canvas");
    const h2c = (mod as any).default || mod;
    const canvas = await h2c(doc.body, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });
    document.body.removeChild(iframe);
    // jsPDF
    const jsPDFMod = await import("jspdf");
    const JsPDF = (jsPDFMod as any).default || jsPDFMod;
    const pdf = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW - 30;
    const imgH = (canvas.height / canvas.width) * imgW;
    let heightLeft = imgH; let position = 15;
    const imgData = canvas.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", 15, position, imgW, imgH);
    heightLeft -= (pageH - 30);
    while (heightLeft > 0) {
      position = heightLeft - imgH + 15;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 15, position, imgW, imgH);
      heightLeft -= (pageH - 30);
    }
    const scope = selectedOnly ? "_محددين" : "";
    pdf.save(`AquaCore_حقوق_المركب_${year}_${month}${scope}.pdf`);
    toast.success(selectedOnly ? `تم تصدير ${selectedIds.size} منخرط محدد بصيغة PDF` : "تم تصدير قائمة الشهر كاملاً بصيغة PDF");
  };

  const handleExport = async (format: string, selectedOnly: boolean = false) => {
    setSigModal(false);
    setExporting(true);
    try {
      // ★ للـ PDF: استخدم html2canvas client-side لعرض النص العربي صحيحاً
      if (format === "pdf") {
        await exportPdfClientSide(selectedOnly);
        setExporting(false);
        return;
      }
      const params = new URLSearchParams();
      params.set("type", "compound");
      params.set("format", format);
      params.set("year", String(year));
      params.set("month", String(month));
      if (selectedSigs.length > 0) params.set("sigs", selectedSigs.join(","));
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
  // ★ المبلغ الإجمالي محسوب تلقائياً
  const totalAmount = stats.totalCompound || (entries.length * 1000);
  const amountInWords = numberToArabicWords(totalAmount);

  return (
    <div className="space-y-4">
      {/* Header — مطابق لورقة حقوق_المركب في Excel */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-teal-600" />
            <div>
              <h2 className="text-xl font-bold text-teal-900">🏊 سجل حقوق المركب — نادي RCS</h2>
              <p className="text-xs text-muted-foreground">قائمة المسجلين الجدد والمجددين حسب الشهر (حقوق المركب فقط: المبلغ الإجمالي ≥ 1300 دج)</p>
            </div>
          </div>
          {/* الشهر + السنة — مطابق للورقة */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">الشهر:</span>
            <Badge className="bg-teal-100 text-teal-800 border-teal-300">{MONTH_NAMES[month - 1]}</Badge>
            <span className="text-muted-foreground">السنة:</span>
            <Badge className="bg-teal-100 text-teal-800 border-teal-300">{year}</Badge>
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
            <p className="text-lg font-bold text-teal-900">{MONTH_NAMES[month - 1]} {year}</p>
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
          <p className="text-2xl font-extrabold tabular-nums">{totalAmount.toLocaleString()}</p>
          <p className="text-xs opacity-90">دج (1000 × {stats.total})</p>
        </div>
      </div>

      {/* ★ المبلغ بالأحرف (تفقيط) */}
      <div className="rounded-xl border border-amber-300/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
        <p className="text-sm font-bold text-amber-900 dark:text-amber-300">
          تم تحديد المبلغ بـ: <span className="text-amber-700 dark:text-amber-400">{amountInWords} دينار جزائري</span>
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
          ({totalAmount.toLocaleString("en-US")} دج) — محسوب تلقائياً من عدد المنخرطين × 1000 دج
        </p>
      </div>

      {/* Selection controls + Download */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {entries.length > 0 && (
            <>
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
            </>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* ★ زر نسخ القائمة */}
          <Button size="sm" variant="outline" onClick={handleCopyList} disabled={exporting || entries.length === 0}
            className="border-sky-500/40 bg-sky-500/5 text-sky-700 hover:bg-sky-500/10">
            <Copy className="h-4 w-4 ml-1" /> نسخ القائمة
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSigModal(true)} disabled={exporting || entries.length === 0}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 ml-1" />}
            تحميل قائمة الشهر
          </Button>
          {selectedIds.size > 0 && (
            <Button size="sm" variant="default" onClick={() => handleExport("pdf", true)} disabled={exporting}
              className="bg-teal-600 hover:bg-teal-700 text-white">
              <Download className="h-4 w-4 ml-1" />
              تحميل المحددين ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      {/* Table — مطابق لهيكل ورقة حقوق_المركب */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-muted/60 text-foreground border-b-2 border-primary/20">
                <th className="p-3 text-center w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer"
                    checked={selectedIds.size === entries.length && entries.length > 0}
                    onChange={(e) => e.target.checked ? selectAll() : deselectAll()}
                  />
                </th>
                <th className="p-3 text-right w-12">#</th>
                <th className="p-3 text-right">رقم الملف</th>
                <th className="p-3 text-right">اللقب</th>
                <th className="p-3 text-right">الاسم</th>
                <th className="p-3 text-center w-32">التاريخ</th>
                <th className="p-3 text-center w-28">النوع</th>
                <th className="p-3 text-center w-28">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin text-teal-600 mx-auto" /></td></tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
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
                      key={entry.subscriberId + "_" + entry.source}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.005, 0.2) }}
                      className={cn(
                        "border-b border-border/40 transition hover:bg-muted/40",
                        isSelected ? "bg-teal-50/80 ring-1 ring-inset ring-teal-300" : ""
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
                      <td className="p-3 text-center font-mono text-xs">{entry.fileNumber}</td>
                      <td className="p-3 text-right font-medium">{entry.lastName}</td>
                      <td className="p-3 text-right font-medium">{entry.firstName}</td>
                      <td className="p-3 text-center text-xs font-mono">{formatDateYMD(entry.date)}</td>
                      <td className="p-3 text-center">
                        {entry.source === "new" ? (
                          <Badge className="bg-sky-100 text-sky-800 border-sky-300 text-xs">تسجيل جديد</Badge>
                        ) : (
                          <Badge className="bg-violet-100 text-violet-800 border-violet-300 text-xs">🔄 تجديد</Badge>
                        )}
                      </td>
                      <td className="p-3 text-center font-bold text-amber-600">1000</td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
            {/* ★ صف المجموع */}
            {entries.length > 0 && !loading && (
              <tfoot>
                <tr className="bg-amber-50 dark:bg-amber-950/30 font-bold border-t-2 border-amber-500/20">
                  <td colSpan={7} className="p-3 text-center">المجموع</td>
                  <td className="p-3 text-center text-amber-700 dark:text-amber-400 text-base">{totalAmount.toLocaleString()} دج</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Signature selection modal */}
      <Dialog open={sigModal} onOpenChange={setSigModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تصدير قائمة حقوق المركب</DialogTitle>
            <DialogDescription>اختر الإمضاءات وصيغة التصدير — {MONTH_NAMES[month - 1]} {year}</DialogDescription>
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
            {/* ★ معاينة المبلغ بالأحرف */}
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300/50 p-3">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                <strong>المبلغ الإجمالي:</strong> {totalAmount.toLocaleString()} دج<br />
                <strong>بالأحرف:</strong> {amountInWords} دينار جزائري
              </p>
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

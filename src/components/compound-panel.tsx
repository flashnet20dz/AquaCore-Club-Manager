"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Building2, Download, Loader2, Users, FileText, RefreshCw, Calendar,
  TrendingUp, ChevronRight, ChevronLeft, CheckSquare, Square, Copy,
  FileSpreadsheet, FileType, Printer, CalendarRange,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  MONTH_NAMES, SIGNATURE_OPTIONS, OFFICIAL_HEADER_LINES,
  formatDateYMD, formatDateDMY, formatAmountDZD, numberToArabicWords,
  COMPOUND_FEE, type CompoundEntry, type CompoundListResult, type EnteteLogo,
} from "@/lib/compound-format";

const OFFICIAL_TITLE = "القائمة الاسمية للمنخرطين في النادي فرع السباحة";

// ══════════════════════════════════════════════════════════════
//  القائمة الاسمية الرسمية — مطابقة للوثيقة الرسمية للنادي
//  صفحات A4 عمودية: ترويسة رسمية + جدول (الرقم/اللقب/الاسم/المبلغ)
//  + المجموع + التفقيط + الإمضاءات
// ══════════════════════════════════════════════════════════════

const PAGE_W = 794;   // A4 @96dpi
const PAGE_H = 1123;
const FIRST_CAP = 30; // صفوف الصفحة الأولى (بعد الترويسة)
const PAGE_CAP = 38;  // صفوف الصفحات التالية
const FOOTER_ROWS = 7; // حجز مساحة المجموع + التفقيط + الإمضاءات (بصفوف)

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// أنماط المستند الرسمي — معزولة تماماً عن أنماط التطبيق (Tailwind oklch غير مدعوم في html2canvas)
const DOC_CSS = `
aqc-page, .aqc-page{width:${PAGE_W}px;height:${PAGE_H}px;background:#ffffff;padding:22px 30px 26px;box-sizing:border-box;
  display:flex;flex-direction:column;font-family:Tahoma,Arial,'Segoe UI',sans-serif;color:#000000;
  overflow:hidden;position:relative;margin:0}
.aqc-hdr{display:flex;align-items:center;gap:6px}
.aqc-hdr img{object-fit:contain}
.aqc-hdr-lines{flex:1;text-align:center}
.aqc-h-line{font-size:14.5px;font-weight:700;line-height:1.5;margin:0;color:#000000}
.aqc-ref{display:flex;justify-content:space-between;font-size:14px;font-weight:700;margin:8px 2px 2px}
.aqc-title{text-align:center;font-size:17px;font-weight:800;text-decoration:underline;margin:7px 0 2px}
.aqc-period{text-align:center;font-size:14px;font-weight:700;text-decoration:underline;margin:0 0 8px}
.aqc-tbl{border:1px solid #000000;width:100%;background:#ffffff}
.aqc-row{display:flex;flex-direction:row;border-bottom:1px solid #000000}
.aqc-row:last-child{border-bottom:none}
.aqc-c{padding:3.5px 4px;font-size:13px;line-height:1.4;text-align:center;color:#000000;white-space:nowrap;box-sizing:border-box;font-weight:700}
.aqc-c:not(:last-child){border-left:1px solid #000000}
.aqc-c.w1{width:9%}.aqc-c.w2{width:34.5%}.aqc-c.w3{width:33.5%}.aqc-c.w4{width:23%}
.aqc-c.n{font-weight:800}
.aqc-c.amt{font-weight:700;white-space:nowrap}
.aqc-row.head{background:#efefef;font-weight:800}
.aqc-row.head .aqc-c{font-size:13.5px;font-weight:800}
.aqc-row.total{background:#efefef;font-weight:800}
.aqc-row.total .aqc-c{font-size:14px;font-weight:800}
.aqc-words{font-size:14px;font-weight:800;margin:12px 2px 0;text-align:right;color:#000000}
.aqc-words span{text-decoration:underline}
.aqc-sigs{display:flex;justify-content:space-around;align-items:flex-end;margin-top:46px}
.aqc-sig{font-size:13.5px;font-weight:800;text-align:center;max-width:30%;color:#000000}
.aqc-pagenum{position:absolute;bottom:7px;left:0;right:0;text-align:center;font-size:10px;color:#555555}
`;

function ensureDocStyles() {
  if (document.getElementById("aqc-compound-doc-style")) return;
  const st = document.createElement("style");
  st.id = "aqc-compound-doc-style";
  st.textContent = DOC_CSS;
  document.head.appendChild(st);
}

export function CompoundPanel() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<(CompoundListResult & {
    periodLabel?: { from: string; to: string };
    enteteLogos?: EnteteLogo[];
  }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [sigModal, setSigModal] = useState(false);
  const [selectedSigs, setSelectedSigs] = useState<string[]>(["president", "compound", "unit"]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportScope, setExportScope] = useState<"month" | "selected">("month");
  const exportRunRef = useRef(0);

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

  const selectAll = () => setSelectedIds(new Set(entries.map((e) => e.subscriberId)));
  const deselectAll = () => setSelectedIds(new Set());

  const entries = data?.entries || [];
  const stats = data?.stats || { total: 0, newCount: 0, renewalCount: 0, totalCompound: 0 };
  const totalAmount = stats.totalCompound || entries.length * COMPOUND_FEE;
  const amountInWords = numberToArabicWords(totalAmount);
  const periodLabel = data?.periodLabel;
  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  // ★ نسخ القائمة إلى الحافظة
  const handleCopyList = async () => {
    const target = selectedIds.size > 0
      ? entries.filter((e) => selectedIds.has(e.subscriberId))
      : entries;
    if (target.length === 0) { toast.info("لا يوجد منخرطون للنسخ"); return; }
    const header = "#\tاللقب\tالاسم\tالمبلغ";
    const rows = target.map((e, i) =>
      `${i + 1}\t${e.lastName}\t${e.firstName}\t${formatAmountDZD(COMPOUND_FEE)}`
    ).join("\n");
    const text = `${OFFICIAL_TITLE}\nمن تاريخ ${periodLabel?.from ?? ""} إلى غاية ${periodLabel?.to ?? ""}\n\n${header}\n${rows}\n\nالمجموع: ${formatAmountDZD(totalAmount)}\nتم تحديد المبلغ بـ: ${numberToArabicWords(totalAmount)} دينار جزائري`;
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

  // ══════════════ بناء المستند الرسمي (صفحات A4) ══════════════

  function rowHtml(e: CompoundEntry, globalIndex: number): string {
    return `<div class="aqc-row">
      <div class="aqc-c w1 n">${globalIndex + 1}</div>
      <div class="aqc-c w2">${escapeHtml(e.lastName)}</div>
      <div class="aqc-c w3">${escapeHtml(e.firstName)}</div>
      <div class="aqc-c w4 amt">${formatAmountDZD(COMPOUND_FEE)}</div>
    </div>`;
  }

  function headerBlockHtml(logos: EnteteLogo[], from: string, to: string): string {
    const logoImg = (l?: EnteteLogo) =>
      l ? `<img src="${l.src}" style="height:78px;width:78px;" />` : "";
    const leftLogos = logos.length > 1
      ? `<div style="display:flex;flex-direction:column;gap:2px;align-items:center">${logoImg(logos[1])}${logoImg(logos[2])}</div>`
      : "";
    const lines = OFFICIAL_HEADER_LINES
      .map((l) => `<p class="aqc-h-line">${escapeHtml(l)}</p>`)
      .join("");
    return `<div class="aqc-hdr">
      ${logoImg(logos[0])}
      <div class="aqc-hdr-lines">${lines}</div>
      ${leftLogos}
    </div>
    <div class="aqc-ref"><span>الرقم: . . . / ن.ر.ه.ر.س ${new Date().getFullYear()}</span><span>سعيدة في: ${formatDateDMY(new Date())}</span></div>
    <div class="aqc-title">القائمة الاسمية للمنخرطين في النادي فرع السباحة</div>
    <div class="aqc-period">من تاريخ ${from} إلى غاية ${to}</div>`;
  }

  function pageHtml(opts: {
    rows: string[];
    isFirst: boolean; isLast: boolean;
    pageNo: number; totalPages: number;
    logos: EnteteLogo[]; from: string; to: string;
    total: number; sigs: string[]; monthLabel: string;
  }): string {
    const { rows, isFirst, isLast, pageNo, totalPages, logos, from, to, total, sigs, monthLabel } = opts;
    const headRow = `<div class="aqc-row head">
      <div class="aqc-c w1">الرقم</div><div class="aqc-c w2">اللقب</div><div class="aqc-c w3">الاسم</div><div class="aqc-c w4">المبلغ</div>
    </div>`;
    const totalRow = isLast
      ? `<div class="aqc-row total"><div class="aqc-c" style="width:77%">المجموع</div><div class="aqc-c amt" style="width:23%">${formatAmountDZD(total)}</div></div>`
      : "";
    const words = isLast
      ? `<div class="aqc-words">تم تحديد المبلغ بـ: <span>${numberToArabicWords(total)} دينار جزائري</span></div>`
      : "";
    const sigsHtml = isLast && sigs.length > 0
      ? `<div class="aqc-sigs">${sigs.map((s) => `<div class="aqc-sig">${escapeHtml(s)}</div>`).join("")}</div>`
      : "";
    return `<div class="aqc-page" dir="rtl">
      ${isFirst ? headerBlockHtml(logos, from, to) : ""}
      <div class="aqc-tbl">${headRow}${rows.join("")}${totalRow}</div>
      ${words}${sigsHtml}
      <div class="aqc-pagenum">صفحة ${pageNo} من ${totalPages} — قائمة المنخرطين ${monthLabel}</div>
    </div>`;
  }

  /** توزيع الصفوف على الصفحات — مع توازن الصفحتين الأخيرتين */
  function chunkRows(rowList: string[]): string[][] {
    const chunks: string[][] = [];
    let pool = [...rowList];
    let idx = 0;
    while (pool.length > 0) {
      const baseCap = idx === 0 ? FIRST_CAP : PAGE_CAP;
      const lastCap = baseCap - FOOTER_ROWS;
      const nextLastCap = PAGE_CAP - FOOTER_ROWS;
      if (pool.length <= lastCap) { chunks.push(pool); break; }
      if (pool.length >= baseCap + nextLastCap || pool.length >= baseCap) {
        chunks.push(pool.slice(0, baseCap));
        pool = pool.slice(baseCap);
      } else {
        // صفحتان متوازنتان (الباقي لا يملأ صفحة كاملة لكنه يتجاوز صفحة أخيرة آمنة)
        const take = Math.ceil(pool.length / 2);
        chunks.push(pool.slice(0, take));
        pool = pool.slice(take);
      }
      idx++;
    }
    return chunks;
  }

  // ══════════════ التصدير PDF (رسمي، عربي كامل، متعدد الصفحات) ══════════════

  const exportOfficialPdf = async (selectedOnly: boolean) => {
    const runId = ++exportRunRef.current;
    const target = selectedOnly && selectedIds.size > 0
      ? entries.filter((e) => selectedIds.has(e.subscriberId))
      : entries;
    if (target.length === 0) { toast.info("لا يوجد منخرطون للتصدير"); return; }

    const logos = data?.enteteLogos || [];
    const from = periodLabel?.from || formatDateDMY(new Date(year, month - 2, 29));
    const to = periodLabel?.to || formatDateDMY(new Date(year, month - 1, 28));
    const sigLabels = selectedSigs.map((id) => SIGNATURE_OPTIONS.find((s) => s.id === id)?.label || id);

    ensureDocStyles();
    try {
      await document.fonts?.ready;

      // صفوف مرقّمة عالمياً
      const rowList = target.map((e, i) => rowHtml(e, i));
      const chunks = chunkRows(rowList);
      const totalPages = chunks.length;
      const total = target.length * COMPOUND_FEE;

      // حاوية خارج الشاشة
      const host = document.createElement("div");
      host.style.cssText = `position:fixed;left:-20000px;top:0;z-index:-1;`;
      document.body.appendChild(host);

      const jsPDFMod = await import("jspdf");
      const JsPDF = (jsPDFMod as unknown as {
        default: new (o: Record<string, unknown>) => {
          addPage: () => void;
          addImage: (img: string, fmt: string, x: number, y: number, w: number, h: number, alias?: string, compression?: string) => void;
          save: (name: string) => void;
        };
      }).default;
      const pdf = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // ★ الرسم عبر SVG foreignObject — نفس محرك المتصفح (نص عربي مثالي)،
      //   بدلاً من html2canvas الذي يشوّه baseline النص العربي
      const dataUrls: string[] = [];
      for (let p = 0; p < chunks.length; p++) {
        if (exportRunRef.current !== runId) { document.body.removeChild(host); return; }
        const isLast = p === totalPages - 1;
        host.innerHTML = pageHtml({
          rows: chunks[p], isFirst: p === 0, isLast,
          pageNo: p + 1, totalPages, logos, from, to,
          total, sigs: sigLabels, monthLabel,
        });
        const el = host.firstElementChild as HTMLElement;
        await new Promise((r) => setTimeout(r, 40));

        // تحويل الشعارات إلى data URL (شرط العمل داخل SVG)
        await Promise.all(Array.from(el.querySelectorAll("img")).map(async (img) => {
          try {
            if (!img.src.startsWith("data:")) {
              const res = await fetch(img.src);
              const blob = await res.blob();
              img.src = await new Promise<string>((resolve, reject) => {
                const fr = new FileReader();
                fr.onload = () => resolve(fr.result as string);
                fr.onerror = reject;
                fr.readAsDataURL(blob);
              });
            }
          } catch { img.remove(); }
        }));

        // تغليف الصفحة + أنماطها لتحويلها إلى XHTML داخل SVG
        const wrap = document.createElement("div");
        wrap.appendChild(Object.assign(document.createElement("style"), { textContent: DOC_CSS }));
        wrap.appendChild(el.cloneNode(true));
        const xhtml = new XMLSerializer().serializeToString(wrap);
        const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}">` +
          `<foreignObject width="100%" height="100%">${xhtml}</foreignObject></svg>`;

        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("SVG foreignObject render failed"));
          img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
        });

        const canvas = document.createElement("canvas");
        canvas.width = PAGE_W * 2;
        canvas.height = PAGE_H * 2;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D unavailable");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0, PAGE_W, PAGE_H);
        dataUrls.push(canvas.toDataURL("image/jpeg", 0.95));
      }
      document.body.removeChild(host);

      for (let p = 0; p < dataUrls.length; p++) {
        if (p > 0) pdf.addPage();
        pdf.addImage(dataUrls[p], "JPEG", 0, 0, 210, 297, undefined, "FAST");
      }

      const scope = selectedOnly ? "_محددين" : "";
      pdf.save(`قائمة_المنخرطين_${year}-${String(month).padStart(2, "0")}${scope}.pdf`);
      toast.success(`تم تصدير ${target.length} منخرط في ${totalPages} صفحة A4 — قائمة الشهر ${monthLabel}`);
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("تعذر إنشاء ملف PDF");
    }
  };

  // ══════════════ التصدير Word / Excel (الخادم — نفس منطق القائمة) ══════════════

  const downloadServerExport = async (format: "word" | "excel", selectedOnly: boolean) => {
    const runId = ++exportRunRef.current;
    try {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
        format,
      });
      if (selectedSigs.length > 0) params.set("sigs", selectedSigs.join(","));
      if (selectedOnly && selectedIds.size > 0) params.set("ids", Array.from(selectedIds).join(","));

      const res = await fetch(`/api/compound-rights/export?${params.toString()}`);
      if (!res.ok) throw new Error("فشل التصدير");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = format === "word" ? "doc" : "xlsx";
      const scope = selectedOnly ? "_محددين" : "";
      a.download = `قائمة_المنخرطين_${year}-${String(month).padStart(2, "0")}${scope}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(format === "word"
        ? `تم تحميل القائمة الرسمية (Word) — ${monthLabel}`
        : `تم تحميل القائمة (Excel) — ${monthLabel}`);
    } catch {
      toast.error("فشل التصدير");
    }
  };

  const handleExport = async (format: string) => {
    const selectedOnly = exportScope === "selected" && selectedIds.size > 0;
    setSigModal(false);
    setExporting(true);
    try {
      if (format === "pdf") await exportOfficialPdf(selectedOnly);
      else if (format === "word") await downloadServerExport("word", selectedOnly);
      else if (format === "excel") await downloadServerExport("excel", selectedOnly);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header — ترويسة القائمة الرسمية */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-teal-600" />
            <div>
              <h2 className="text-xl font-bold text-teal-900">🏊 سجل حقوق المركب — نادي RCS</h2>
              <p className="text-xs text-muted-foreground">
                {OFFICIAL_TITLE} — حقوق المركب 1000 دج لكل منخرط
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">الشهر:</span>
            <Badge className="bg-teal-100 text-teal-800 border-teal-300">{MONTH_NAMES[month - 1]}</Badge>
            <span className="text-muted-foreground">السنة:</span>
            <Badge className="bg-teal-100 text-teal-800 border-teal-300">{year}</Badge>
          </div>
        </div>
      </div>

      {/* Month selector + الفترة الرسمية */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="icon" onClick={goToPrevMonth} className="rounded-xl">
            <ChevronRight className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">الشهر المحدد</p>
            <p className="text-lg font-bold text-teal-900">{monthLabel}</p>
            {periodLabel && (
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mt-1 flex items-center justify-center gap-1">
                <CalendarRange className="h-3.5 w-3.5" />
                الفترة الرسمية: من {periodLabel.from} إلى غاية {periodLabel.to}
              </p>
            )}
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
          <p className="text-xs opacity-90">دج ({COMPOUND_FEE} × {stats.total})</p>
        </div>
      </div>

      {/* المبلغ بالأحرف (تفقيط) */}
      <div className="rounded-xl border border-amber-300/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
        <p className="text-sm font-bold text-amber-900 dark:text-amber-300">
          تم تحديد المبلغ بـ: <span className="text-amber-700 dark:text-amber-400">{amountInWords} دينار جزائري</span>
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
          ({formatAmountDZD(totalAmount)}) — محسوب تلقائياً من عدد المنخرطين × {COMPOUND_FEE} دج
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
          <Button size="sm" variant="outline" onClick={handleCopyList} disabled={exporting || entries.length === 0}
            className="border-sky-500/40 bg-sky-500/5 text-sky-700 hover:bg-sky-500/10">
            <Copy className="h-4 w-4 ml-1" /> نسخ القائمة
          </Button>
          <Button size="sm" variant="default" onClick={() => { setExportScope("month"); setSigModal(true); }} disabled={exporting || entries.length === 0}
            className="bg-teal-600 hover:bg-teal-700 text-white">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 ml-1" />}
            تحميل قائمة الشهر
          </Button>
          {selectedIds.size > 0 && (
            <Button size="sm" variant="outline" onClick={() => { setExportScope("selected"); setSigModal(true); }} disabled={exporting}
              className="border-amber-500/40 bg-amber-500/5 text-amber-700 hover:bg-amber-500/10">
              <Download className="h-4 w-4 ml-1" />
              تحميل المحددين ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
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
                      <td className="p-3 text-center font-bold text-amber-600">{COMPOUND_FEE}</td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
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

      {/* Signature + format selection modal */}
      <Dialog open={sigModal} onOpenChange={setSigModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {exportScope === "selected"
                ? `تحميل المحددين (${selectedIds.size} منخرط)`
                : "تحميل القائمة الاسمية الرسمية"}
            </DialogTitle>
            <DialogDescription>
              {OFFICIAL_TITLE} — {monthLabel}
              {periodLabel && <> · من {periodLabel.from} إلى غاية {periodLabel.to}</>}
              {exportScope === "selected" && <> · المنخرطون المحددون فقط</>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* ملخص القائمة */}
            <div className="rounded-lg bg-teal-50 dark:bg-teal-950/30 border border-teal-300/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">عدد المنخرطين:</span>
                <strong>{exportScope === "selected" ? selectedIds.size : stats.total}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">المبلغ الإجمالي:</span>
                <strong className="text-amber-700 dark:text-amber-400">
                  {formatAmountDZD((exportScope === "selected" ? selectedIds.size : stats.total) * COMPOUND_FEE)}
                </strong>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground shrink-0">بالأحرف:</span>
                <strong className="text-left">{numberToArabicWords((exportScope === "selected" ? selectedIds.size : stats.total) * COMPOUND_FEE)} دينار جزائري</strong>
              </div>
            </div>
            {/* الإمضاءات */}
            <div>
              <p className="text-sm font-semibold mb-2">الإمضاءات (تظهر أسفل الوثيقة):</p>
              <div className="grid grid-cols-1 gap-1.5">
                {SIGNATURE_OPTIONS.map((sig) => (
                  <label key={sig.id} className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-accent/40">
                    <Checkbox checked={selectedSigs.includes(sig.id)} onCheckedChange={() => toggleSig(sig.id)} />
                    <span className="text-sm">{sig.label}</span>
                  </label>
                ))}
              </div>
            </div>
            {/* الصيغ */}
            <div>
              <p className="text-sm font-semibold mb-2">صيغة التحميل <span className="text-xs font-normal text-muted-foreground">(حسب الشهر المحدد: {monthLabel})</span>:</p>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} className="flex-col h-auto py-2.5 gap-1 border-teal-500/40 hover:bg-teal-500/5">
                  <Printer className="h-4 w-4 text-teal-600" />
                  <span className="text-xs font-bold">PDF رسمي</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExport("word")} className="flex-col h-auto py-2.5 gap-1 border-sky-500/40 hover:bg-sky-500/5">
                  <FileType className="h-4 w-4 text-sky-600" />
                  <span className="text-xs font-bold">Word</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExport("excel")} className="flex-col h-auto py-2.5 gap-1 border-emerald-500/40 hover:bg-emerald-500/5">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-bold">Excel</span>
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                PDF: وثيقة A4 جاهزة للطبع بالترويسة الرسمية والشعارات — Word/Excel: نفس القائمة قابلة للتحرير
              </p>
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

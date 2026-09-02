"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck, Download, Search, Loader2, Users, Shield, ShieldOff,
  FileText, FileType, FileSpreadsheet, FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  OFFICIAL_HEADER_LINES, SIGNATURE_OPTIONS, MONTH_NAMES, formatDateDMY,
  type EnteteLogo,
} from "@/lib/compound-format";
import type { SubscriberWithComputed } from "@/lib/rcs";

interface InsurancePanelProps {
  subscribers: SubscriberWithComputed[];
  onRefresh?: () => void;
}

interface InsuranceStatus {
  [subscriberId: string]: boolean;
}

// ══════════════════════════════════════════════════════════════
//  القائمة الرسمية للتأمين — مطابقة لأسلوب وثيقة حقوق المركب
//  صفحات A4 عمودية: ترويسة رسمية + جدول (الرقم/اللقب/الاسم/تاريخ الميلاد)
//  + عدد المنخرطين + الإمضاءات أسفل الوثيقة
// ══════════════════════════════════════════════════════════════

const PAGE_W = 794;   // A4 @96dpi
const PAGE_H = 1123;
const FIRST_CAP = 26; // صفوف الصفحة الأولى (بعد الترويسة)
const PAGE_CAP = 34;  // صفوف الصفحات التالية
const FOOTER_ROWS = 10; // حجز مساحة العدد + الإمضاءات (صفّان أو أكثر)

type ExportStatus = "all" | "insured" | "uninsured" | "selected";

const STATUS_DISPLAY: Record<Exclude<ExportStatus, never>, string> = {
  all: "إجمالي المنخرطين",
  insured: "المنخرطون المؤمَّنون",
  uninsured: "المنخرطون غير المؤمَّنين",
  selected: "المنخرطون المحددون",
};

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// أنماط المستند الرسمي — معزولة تماماً عن أنماط التطبيق
const INS_DOC_CSS = `
aqi-page, .aqi-page{width:${PAGE_W}px;height:${PAGE_H}px;background:#ffffff;padding:22px 30px 26px;box-sizing:border-box;
  display:flex;flex-direction:column;font-family:Tahoma,Arial,'Segoe UI',sans-serif;color:#000000;
  overflow:hidden;position:relative;margin:0}
.aqi-hdr{display:flex;align-items:center;gap:6px}
.aqi-hdr img{object-fit:contain}
.aqi-hdr-lines{flex:1;text-align:center}
.aqi-h-line{font-size:14.5px;font-weight:700;line-height:1.5;margin:0;color:#000000}
.aqi-ref{display:flex;justify-content:space-between;font-size:14px;font-weight:700;margin:8px 2px 2px}
.aqi-title{text-align:center;font-size:17px;font-weight:800;text-decoration:underline;margin:7px 0 2px}
.aqi-sub{text-align:center;font-size:13.5px;font-weight:700;text-decoration:underline;margin:0 0 8px}
.aqi-tbl{border:1px solid #000000;width:100%;background:#ffffff}
.aqi-row{display:flex;flex-direction:row;border-bottom:1px solid #000000}
.aqi-row:last-child{border-bottom:none}
.aqi-c{padding:3.5px 4px;font-size:13px;line-height:1.4;text-align:center;color:#000000;white-space:nowrap;box-sizing:border-box;font-weight:700}
.aqi-c:not(:last-child){border-left:1px solid #000000}
.aqi-c.w1{width:9%}.aqi-c.w2{width:30%}.aqi-c.w3{width:30%}.aqi-c.w4{width:31%}
.aqi-c.n{font-weight:800}
.aqi-row.head{background:#efefef;font-weight:800}
.aqi-row.head .aqi-c{font-size:13.5px;font-weight:800}
.aqi-row.total{background:#efefef;font-weight:800}
.aqi-row.total .aqi-c{font-size:14px;font-weight:800}
.aqi-count{font-size:14px;font-weight:800;margin:12px 2px 0;text-align:right;color:#000000}
.aqi-count span{text-decoration:underline}
.aqi-sigs{display:flex;flex-direction:column;gap:30px;margin-top:40px}
.aqi-sigrow{display:flex;justify-content:space-around;align-items:flex-end}
.aqi-sig{font-size:13px;font-weight:800;text-align:center;max-width:31%;color:#000000}
.aqi-pagenum{position:absolute;bottom:7px;left:0;right:0;text-align:center;font-size:10px;color:#555555}
`;

function ensureInsDocStyles() {
  if (document.getElementById("aqc-insurance-doc-style")) return;
  const st = document.createElement("style");
  st.id = "aqc-insurance-doc-style";
  st.textContent = INS_DOC_CSS;
  document.head.appendChild(st);
}

export function InsurancePanel({ subscribers, onRefresh }: InsurancePanelProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "insured" | "uninsured">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [insuranceStatus, setInsuranceStatus] = useState<InsuranceStatus>({});
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState<"insure" | "uninsure" | null>(null);
  // 🔑 فلاتر جديدة: شهر، من/إلى، حالة
  const [monthFilter, setMonthFilter] = useState<string>(""); // YYYY-MM
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // ★ نافذة التحميل الرسمي
  const [exportModal, setExportModal] = useState(false);
  const [exportStatus, setExportStatus] = useState<ExportStatus>("all");
  const [selectedSigs, setSelectedSigs] = useState<string[]>(SIGNATURE_OPTIONS.map((s) => s.id));
  const [exportFmt, setExportFmt] = useState<"pdf" | "word" | "excel" | null>(null);
  const [logos, setLogos] = useState<EnteteLogo[]>([]);
  const exportRunRef = useRef(0);

  // Fetch insurance status — من مصدر مخصص بلا حد عددي
  // (كانت تُبنى من /api/payments المحدود بآخر 100 دفعة — فبعد تأمين أكثر
  //  من 100 منخرط كان الباقون يظهرون "غير مؤمنين" بعد تحديث الصفحة)
  const fetchInsuranceStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/subscribers/insurance-status", { cache: "no-store" });
      const data = await res.json();
      const status: InsuranceStatus = {};
      for (const id of data.insuredIds || []) status[id] = true;
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

  const applyCommonFilters = (s: SubscriberWithComputed) => {
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
  };

  const filteredSubs = subscribers.filter((s) => {
    const isInsured = !!insuranceStatus[s.id];
    if (filter === "insured" && !isInsured) return false;
    if (filter === "uninsured" && isInsured) return false;
    return applyCommonFilters(s);
  });

  // القائمة الأساسية (بلا فلتر الحالة) — لعدّادات نطاق التحميل
  const baseFiltered = subscribers.filter(applyCommonFilters);
  const scopeAll = baseFiltered.length;
  const scopeInsured = baseFiltered.filter((s) => insuranceStatus[s.id]).length;
  const scopeUninsured = scopeAll - scopeInsured;
  const scopeCounts: Record<ExportStatus, number> = {
    all: scopeAll,
    insured: scopeInsured,
    uninsured: scopeUninsured,
    selected: selectedIds.length,
  };

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

  // ✅ التأمين الجماعي في طلب واحد — يدعم مئات وآلاف المنخرطين دون مشاكل
  const handleBulkInsure = async (action: "insure" | "uninsure") => {
    if (selectedIds.length === 0 || bulkLoading) return;
    setBulkLoading(action);
    try {
      const res = await fetch("/api/subscribers/bulk-insurance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriberIds: selectedIds, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل");
      setInsuranceStatus((prev) => {
        const next = { ...prev };
        for (const id of selectedIds) {
          if (action === "insure") next[id] = true;
          else delete next[id];
        }
        return next;
      });
      const verb = action === "insure" ? "تأمين" : "إلغاء تأمين";
      const skippedNote = data.skipped > 0 ? ` — ${data.skipped} كانوا في هذه الحالة مسبقاً` : "";
      toast.success(`تم ${verb} ${data.affected} منخرط${skippedNote}`);
      setSelectedIds([]);
      onRefresh?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشلت العملية الجماعية");
    } finally {
      setBulkLoading(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const selectAllUninsured = () => {
    setSelectedIds(filteredSubs.filter((s) => !insuranceStatus[s.id]).map((s) => s.id));
  };

  // ═══════════════════════════════════════════════════════════
  //  التصدير الرسمي — القائمة المعروضة هي القائمة المحمَّلة
  // ═══════════════════════════════════════════════════════════

  const toggleSig = (id: string) => {
    setSelectedSigs((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  };

  /** القائمة الفعلية للتصدير حسب الحالة المختارة — مرتبة برقم الملف */
  const resolveExportList = (): SubscriberWithComputed[] => {
    let list: SubscriberWithComputed[];
    if (exportStatus === "selected") {
      const ids = new Set(selectedIds);
      list = baseFiltered.filter((s) => ids.has(s.id));
    } else if (exportStatus === "insured") {
      list = baseFiltered.filter((s) => insuranceStatus[s.id]);
    } else if (exportStatus === "uninsured") {
      list = baseFiltered.filter((s) => !insuranceStatus[s.id]);
    } else {
      list = baseFiltered;
    }
    return [...list].sort((a, b) => a.fileNumber.localeCompare(b.fileNumber, "en", { numeric: true }));
  };

  /** معلومات الفترة المعروضة في الوثيقة (نفس منطق الخادم) */
  const buildPeriodParts = (): string[] => {
    const parts: string[] = [];
    if (monthFilter) {
      const [y, m] = monthFilter.split("-").map(Number);
      if (y && m >= 1 && m <= 12) parts.push(`شهر ${MONTH_NAMES[m - 1]} ${y}`);
    }
    if (dateFrom && dateTo) parts.push(`المواليد من ${formatDateDMY(new Date(dateFrom))} إلى ${formatDateDMY(new Date(dateTo))}`);
    else if (dateFrom) parts.push(`المواليد من ${formatDateDMY(new Date(dateFrom))}`);
    else if (dateTo) parts.push(`المواليد إلى غاية ${formatDateDMY(new Date(dateTo))}`);
    return parts;
  };

  const buildTitle = (): string => {
    if (exportStatus === "insured") return "القائمة الاسمية للمنخرطين المؤمَّنين — فرع السباحة";
    if (exportStatus === "uninsured") return "القائمة الاسمية للمنخرطين غير المؤمَّنين — فرع السباحة";
    return "القائمة الاسمية لمنخرطي النادي فرع السباحة";
  };

  const fileBase = (ext: string) => {
    const statusFile = STATUS_DISPLAY[exportStatus].replace(/\s+/g, "_");
    return `قائمة_التأمين_${statusFile}.${ext}`;
  };

  const fetchLogos = useCallback(async (): Promise<EnteteLogo[]> => {
    try {
      const res = await fetch("/api/subscribers/insurance-export?format=logos");
      if (res.ok) {
        const d = await res.json();
        return d.logos || [];
      }
    } catch { /* silent */ }
    return [];
  }, []);

  const openExportModal = async () => {
    setExportModal(true);
    if (logos.length === 0) setLogos(await fetchLogos());
  };

  // ─── بناء المستند الرسمي (صفحات A4) ───

  function rowHtml(s: SubscriberWithComputed, globalIndex: number): string {
    return `<div class="aqi-row">
      <div class="aqi-c w1 n">${globalIndex + 1}</div>
      <div class="aqi-c w2">${escapeHtml(s.lastName)}</div>
      <div class="aqi-c w3">${escapeHtml(s.firstName)}</div>
      <div class="aqi-c w4">${escapeHtml(formatDateDMY(new Date(s.birthDate)))}</div>
    </div>`;
  }

  function headerBlockHtml(logosLocal: EnteteLogo[], subtitle: string): string {
    const logoImg = (l?: EnteteLogo) =>
      l ? `<img src="${l.src}" style="height:78px;width:78px;" />` : "";
    const leftLogos = logosLocal.length > 1
      ? `<div style="display:flex;flex-direction:column;gap:2px;align-items:center">${logoImg(logosLocal[1])}${logoImg(logosLocal[2])}</div>`
      : "";
    const lines = OFFICIAL_HEADER_LINES
      .map((l) => `<p class="aqi-h-line">${escapeHtml(l)}</p>`)
      .join("");
    return `<div class="aqi-hdr">
      ${logoImg(logosLocal[0])}
      <div class="aqi-hdr-lines">${lines}</div>
      ${leftLogos}
    </div>
    <div class="aqi-ref"><span>الرقم: . . . / ن.ر.ه.ر.س ${new Date().getFullYear()}</span><span>سعيدة في: ${formatDateDMY(new Date())}</span></div>
    <div class="aqi-title">${escapeHtml(buildTitle())}</div>
    <div class="aqi-sub">الحالة: ${escapeHtml(STATUS_DISPLAY[exportStatus])}${subtitle ? ` — ${escapeHtml(subtitle)}` : ""}</div>`;
  }

  function sigsBlockHtml(sigLabels: string[]): string {
    if (sigLabels.length === 0) return "";
    const rows: string[] = [];
    for (let i = 0; i < sigLabels.length; i += 3) {
      rows.push(`<div class="aqi-sigrow">${sigLabels.slice(i, i + 3).map((s) => `<div class="aqi-sig">${escapeHtml(s)}</div>`).join("")}</div>`);
    }
    return `<div class="aqi-sigs">${rows.join("")}</div>`;
  }

  function pageHtml(opts: {
    rows: string[];
    isFirst: boolean; isLast: boolean;
    pageNo: number; totalPages: number;
    logosLocal: EnteteLogo[]; subtitle: string;
    count: number; sigLabels: string[];
  }): string {
    const { rows, isFirst, isLast, pageNo, totalPages, logosLocal, subtitle, count, sigLabels } = opts;
    const headRow = `<div class="aqi-row head">
      <div class="aqi-c w1">الرقم</div><div class="aqi-c w2">اللقب</div><div class="aqi-c w3">الاسم</div><div class="aqi-c w4">تاريخ الميلاد</div>
    </div>`;
    const totalRow = isLast
      ? `<div class="aqi-row total"><div class="aqi-c" style="width:69%">عدد المنخرطين</div><div class="aqi-c" style="width:31%">${count}</div></div>`
      : "";
    const countLine = isLast
      ? `<div class="aqi-count">عدد المنخرطين المذكورين في هذه القائمة: <span>${count}</span></div>`
      : "";
    const sigsHtml = isLast ? sigsBlockHtml(sigLabels) : "";
    return `<div class="aqi-page" dir="rtl">
      ${isFirst ? headerBlockHtml(logosLocal, subtitle) : ""}
      <div class="aqi-tbl">${headRow}${rows.join("")}${totalRow}</div>
      ${countLine}${sigsHtml}
      <div class="aqi-pagenum">صفحة ${pageNo} من ${totalPages} — قائمة التأمين (${STATUS_DISPLAY[exportStatus]})</div>
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

  // ─── التصدير PDF (رسمي، عربي كامل، متعدد الصفحات) ───

  const exportOfficialPdf = async () => {
    const runId = ++exportRunRef.current;
    const target = resolveExportList();
    if (target.length === 0) { toast.info("لا يوجد منخرطون في هذا النطاق"); return; }

    const subtitle = buildPeriodParts().join(" — ");
    const sigLabels = selectedSigs.map((id) => SIGNATURE_OPTIONS.find((s) => s.id === id)?.label || id);

    ensureInsDocStyles();
    let host: HTMLElement | null = null;
    try {
      await document.fonts?.ready;

      // صفوف مرقّمة عالمياً
      const rowList = target.map((s, i) => rowHtml(s, i));
      const chunks = chunkRows(rowList);
      const totalPages = chunks.length;
      const count = target.length;

      // حاوية خارج الشاشة
      host = document.createElement("div");
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

      // ★ الرسم عبر SVG foreignObject — نفس محرك المتصفح (نص عربي مثالي)
      const dataUrls: string[] = [];
      for (let p = 0; p < chunks.length; p++) {
        if (exportRunRef.current !== runId) return;
        const isLast = p === totalPages - 1;
        host.innerHTML = pageHtml({
          rows: chunks[p], isFirst: p === 0, isLast,
          pageNo: p + 1, totalPages, logosLocal: logos, subtitle,
          count, sigLabels,
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
        wrap.appendChild(Object.assign(document.createElement("style"), { textContent: INS_DOC_CSS }));
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

      for (let p = 0; p < dataUrls.length; p++) {
        if (p > 0) pdf.addPage();
        pdf.addImage(dataUrls[p], "JPEG", 0, 0, 210, 297, undefined, "FAST");
      }

      pdf.save(fileBase("pdf"));
      toast.success(`تم تصدير ${count} منخرط في ${totalPages} صفحة A4 — ${STATUS_DISPLAY[exportStatus]}`);
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("تعذر إنشاء ملف PDF");
    } finally {
      if (host && document.body.contains(host)) document.body.removeChild(host);
    }
  };

  // ─── التصدير Word / Excel (الخادم — نفس منطق القائمة) ───

  const downloadServerExport = async (format: "word" | "excel") => {
    const runId = ++exportRunRef.current;
    try {
      const params = new URLSearchParams({
        format,
        status: exportStatus,
      });
      if (selectedSigs.length > 0) params.set("sigs", selectedSigs.join(","));
      if (exportStatus === "selected" && selectedIds.length > 0) params.set("ids", selectedIds.join(","));
      if (search.trim()) params.set("q", search.trim());
      if (monthFilter) params.set("month", monthFilter);
      if (dateFrom) params.set("birthFrom", dateFrom);
      if (dateTo) params.set("birthTo", dateTo);

      const res = await fetch(`/api/subscribers/insurance-export?${params.toString()}`);
      if (!res.ok) throw new Error("فشل التصدير");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileBase(format === "word" ? "doc" : "xlsx");
      a.click();
      URL.revokeObjectURL(url);
      toast.success(format === "word"
        ? `تم تحميل القائمة الرسمية (Word) — ${STATUS_DISPLAY[exportStatus]}`
        : `تم تحميل القائمة (Excel) — ${STATUS_DISPLAY[exportStatus]}`);
      void runId;
    } catch {
      toast.error("فشل التصدير");
    }
  };

  const handleExport = async (format: "pdf" | "word" | "excel") => {
    setExportFmt(format);
    try {
      if (format === "pdf") await exportOfficialPdf();
      else if (format === "word") await downloadServerExport("word");
      else if (format === "excel") await downloadServerExport("excel");
    } finally {
      setExportFmt(null);
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
          <Button onClick={openExportModal} variant="outline" className="border-blue-600 text-blue-700 hover:bg-blue-50">
            <Download className="h-4 w-4 ml-1" />
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
          <Button size="sm" variant="outline" onClick={selectAllUninsured}>تحديد غير المؤمنين</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>إلغاء التحديد</Button>
          {selectedIds.length > 0 && (
            <>
              <Button
                size="sm"
                onClick={() => handleBulkInsure("insure")}
                disabled={bulkLoading !== null}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {bulkLoading === "insure" ? <Loader2 className="h-3.5 w-3.5 ml-1 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 ml-1" />}
                {bulkLoading === "insure" ? `جارٍ التأمين (${selectedIds.length})…` : `تأمين المحدد (${selectedIds.length})`}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkInsure("uninsure")}
                disabled={bulkLoading !== null}
                className="border-rose-400 text-rose-600 hover:bg-rose-50"
              >
                {bulkLoading === "uninsure" ? <Loader2 className="h-3.5 w-3.5 ml-1 animate-spin" /> : <ShieldOff className="h-3.5 w-3.5 ml-1" />}
                {bulkLoading === "uninsure" ? `جارٍ الإلغاء (${selectedIds.length})…` : `إلغاء تأمين المحدد (${selectedIds.length})`}
              </Button>
            </>
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
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={filteredSubs.length > 0 && selectedIds.length > 0 && selectedIds.length === filteredSubs.length}
                    onChange={(e) => e.target.checked ? setSelectedIds(filteredSubs.map((s) => s.id)) : setSelectedIds([])}
                    title="تحديد كل النتائج (مؤمنين وغير مؤمنين)"
                  />
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
                        <input type="checkbox" className="h-4 w-4" checked={isSelected} onChange={() => toggleSelect(s.id)} />
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

      {/* ═══════ نافذة التحميل الرسمي ═══════ */}
      <Dialog open={exportModal} onOpenChange={setExportModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileDown className="h-5 w-5 text-blue-700" />
              تحميل قائمة التأمين الرسمية
            </DialogTitle>
            <DialogDescription>
              وثيقة رسمية: الرقم، اللقب، الاسم، تاريخ الميلاد + الإمضاءات أسفل الوثيقة
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* نطاق التحميل حسب الحالة */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">حسب الحالة</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["all", "insured", "uninsured", ...(selectedIds.length > 0 ? ["selected" as const] : [])] as ExportStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setExportStatus(st)}
                    className={cn(
                      "rounded-xl border p-3 text-right transition",
                      exportStatus === st
                        ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40 ring-1 ring-blue-400"
                        : "border-border hover:bg-accent/40"
                    )}
                  >
                    <p className="text-sm font-bold">
                      {st === "all" && "📋 إجمالي"}
                      {st === "insured" && "🛡️ مؤمن"}
                      {st === "uninsured" && "⚠️ غير مؤمن"}
                      {st === "selected" && "✅ المحددون"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{scopeCounts[st]} منخرط</p>
                  </button>
                ))}
              </div>
            </div>

            {/* الإمضاءات */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">الإمضاءات (تظهر أسفل الوثيقة)</Label>
              <div className="flex flex-wrap gap-2">
                {SIGNATURE_OPTIONS.map((sig) => (
                  <label
                    key={sig.id}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer transition",
                      selectedSigs.includes(sig.id)
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200"
                        : "border-border text-muted-foreground hover:bg-accent/40"
                    )}
                  >
                    <Checkbox checked={selectedSigs.includes(sig.id)} onCheckedChange={() => toggleSig(sig.id)} className="h-3.5 w-3.5" />
                    {sig.label}
                  </label>
                ))}
              </div>
            </div>

            {/* ملخص القائمة */}
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900 p-3 text-xs space-y-1">
              <p className="font-bold text-blue-900 dark:text-blue-200">
                العنوان: {buildTitle()}
              </p>
              <p className="text-blue-800 dark:text-blue-300">
                الحالة: {STATUS_DISPLAY[exportStatus]} — عدد المنخرطين: <span className="font-bold">{scopeCounts[exportStatus]}</span>
              </p>
              {buildPeriodParts().length > 0 && (
                <p className="text-blue-800 dark:text-blue-300">{buildPeriodParts().join(" — ")}</p>
              )}
              <p className="text-muted-foreground">الأعمدة: الرقم • اللقب • الاسم • تاريخ الميلاد</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <Button
              onClick={() => handleExport("pdf")}
              disabled={exportFmt !== null || scopeCounts[exportStatus] === 0}
              className="bg-rose-600 hover:bg-rose-700 text-white flex-col h-auto py-2.5 gap-0.5"
            >
              {exportFmt === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              <span className="text-xs font-bold">PDF</span>
            </Button>
            <Button
              onClick={() => handleExport("word")}
              disabled={exportFmt !== null || scopeCounts[exportStatus] === 0}
              className="bg-blue-700 hover:bg-blue-800 text-white flex-col h-auto py-2.5 gap-0.5"
            >
              {exportFmt === "word" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileType className="h-4 w-4" />}
              <span className="text-xs font-bold">Word</span>
            </Button>
            <Button
              onClick={() => handleExport("excel")}
              disabled={exportFmt !== null || scopeCounts[exportStatus] === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex-col h-auto py-2.5 gap-0.5"
            >
              {exportFmt === "excel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              <span className="text-xs font-bold">Excel</span>
            </Button>
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

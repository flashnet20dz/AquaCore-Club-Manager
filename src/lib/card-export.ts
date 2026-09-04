"use client";

/**
 * ═══════════════════════════════════════════════════════════════
 *  AquaCore — Unified Export (WYSIWYG)
 * ═══════════════════════════════════════════════════════════════
 *
 *  كل عمليات التصدير تلتقط CardCanvas من DOM الحالي.
 *  لا توليد HTML منفصل — ما تراه هو ما تحصل عليه.
 *
 *  - PNG/JPG: html2canvas على CardCanvas
 *  - PDF: jsPDF من صورة CardCanvas
 *  - Print: react-to-print يطبع CardCanvas مباشرة
 *  - Word: HTML منفصل (Word يحتاج HTML، لكن يستخدم نفس بيانات التصميم)
 */

import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { type CardDesign, getPhotoUrl, getContent, escapeHtml, formatDate } from "./card-types";

// ─── Capture a CardCanvas element from DOM as canvas ─────────────────
async function captureElement(el: HTMLElement, scale: number = 3): Promise<HTMLCanvasElement> {
  return html2canvas(el, {
    scale,
    backgroundColor: "#ffffff",
    useCORS: true,
    allowTaint: false,
    logging: false,
  });
}

// ─── Download a canvas as PNG/JPG ────────────────────────────────────
function downloadCanvas(canvas: HTMLCanvasElement, filename: string, type: "image/png" | "image/jpeg" = "image/png", quality = 0.95) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL(type, quality);
  link.click();
}

// ═══════════════════════════════════════════════════════════════
//  1) PNG — لقطة عالية الدقة لبطاقة واحدة من DOM
// ═══════════════════════════════════════════════════════════════
export async function exportCardPNG(cardEl: HTMLElement, filename: string): Promise<void> {
  const canvas = await captureElement(cardEl, 3);
  downloadCanvas(canvas, filename, "image/png");
}

// ═══════════════════════════════════════════════════════════════
//  2) JPG — نفس PNG لكن بصيغة JPG
// ═══════════════════════════════════════════════════════════════
export async function exportCardJPG(cardEl: HTMLElement, filename: string): Promise<void> {
  const canvas = await captureElement(cardEl, 3);
  downloadCanvas(canvas, filename, "image/jpeg", 0.95);
}

// ═══════════════════════════════════════════════════════════════
//  3) PDF — jsPDF من صورة CardCanvas (WYSIWYG تام)
// ═══════════════════════════════════════════════════════════════
export async function exportCardPDF(cardEl: HTMLElement, filename: string): Promise<void> {
  const canvas = await captureElement(cardEl, 3);
  const imgData = canvas.toDataURL("image/png");

  // أبعاد البطاقة من canvas (px → mm at 96dpi: 1px = 25.4/96 mm)
  const wMM = (canvas.width / 3) * (25.4 / 96);
  const hMM = (canvas.height / 3) * (25.4 / 96);

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: [wMM, hMM] });
  pdf.addImage(imgData, "PNG", 0, 0, wMM, hMM);
  pdf.save(filename);
}

// ═══════════════════════════════════════════════════════════════
//  4) A4 PDF (8 cards) — يلتقط 8 CardCanvas ويرتبها في A4
//  يبني DOM مؤقتاً من CardCanvas، يلتقطه، يضعه في PDF.
//  يستخدم نفس المكوّن — لا توليد HTML منفصل.
// ═══════════════════════════════════════════════════════════════
export async function exportA4PDF(
  cardCanvases: HTMLCanvasElement[], // قائمة canvas للبطاقات (front+back)
  filename: string,
  options: { cols?: number; rows?: number; cardWidthMM?: number; cardHeightMM?: number; gapMM?: number } = {}
): Promise<void> {
  const cols = options.cols || 2;
  const rows = options.rows || 4;
  const cardW = options.cardWidthMM || 93;
  const cardH = options.cardHeightMM || 66.25;
  const gap = options.gapMM || 4;
  const margin = 10;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;

  const cardsPerPage = cols * rows;
  for (let p = 0; p < cardCanvases.length; p += cardsPerPage) {
    if (p > 0) pdf.addPage();
    const pageCards = cardCanvases.slice(p, p + cardsPerPage);
    for (let i = 0; i < pageCards.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = margin + col * (cardW + gap);
      const y = margin + row * (cardH + gap);
      const imgData = pageCards[i].toDataURL("image/png");
      pdf.addImage(imgData, "PNG", x, y, cardW, cardH);
    }
  }
  pdf.save(filename);
}

// ═══════════════════════════════════════════════════════════════
//  5) Word — HTML منفصل (Word يحتاج HTML)
//  يستخدم نفس بيانات التصميم من CardDesign.
// ═══════════════════════════════════════════════════════════════
export function exportCardWord(
  subscribers: any[],
  design: CardDesign,
  origin: string,
  filename: string
): void {
  const html = generateWordHTML(subscribers, design, origin);
  const blob = new Blob([html], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════
//  Word HTML generator — يستخدم نفس بيانات CardDesign
//  (نسخة طباعة بنفس العناصر، لا تخطيط ثابت)
// ═══════════════════════════════════════════════════════════════

function generateWordHTML(subscribers: any[], design: CardDesign, origin: string): string {
  const { config } = design;
  const today = formatDate(new Date());
  const cardWcm = config.width;
  const cardHcm = config.height;

  const renderSide = (sub: any, side: "front" | "back"): string => {
    const els = side === "front" ? design.front : design.back;
    const elsHTML = els.filter((e) => e.visible).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).map((el) => {
      const base = `position:absolute;left:${el.x}cm;top:${el.y}cm;width:${el.width}cm;height:${el.height}cm;display:flex;align-items:center;justify-content:${el.textAlign === "center" ? "center" : el.textAlign === "left" ? "flex-start" : "flex-end"};direction:rtl;overflow:hidden;box-sizing:border-box;transform:rotate(${el.rotation || 0}deg);opacity:${(el.opacity ?? 100) / 100};${el.bgColor ? `background-color:${el.bgColor};` : ""}${el.borderWidth ? `border:${el.borderWidth}px ${el.borderStyle || "solid"} ${el.borderColor || "#000"};` : ""}border-radius:${el.borderRadius || 0}px;padding:0.5mm;`;
      if (el.type === "qr") return `<div style="${base}"><img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(sub?.fileNumber || "RCS")}&color=000000&bgcolor=ffffff" style="width:100%;height:100%;object-fit:contain;" /></div>`;
      if (el.type === "barcode") return `<div style="${base}"><img src="https://api.qrserver.com/v1/create-barcode/?data=${encodeURIComponent(sub?.fileNumber || "RCS")}&type=code128" style="width:100%;height:100%;object-fit:contain;" /></div>`;
      if (el.type === "logo") return `<div style="${base}display:flex;align-items:center;justify-content:center;font-size:8mm;color:#0f766e;font-weight:700;">ن</div>`;
      if (el.type === "uploadedImage" && el.imageData) return `<div style="${base}"><img src="${el.imageData}" style="width:100%;height:100%;object-fit:contain;" /></div>`;
      if (el.type === "photo") {
        const photoSrc = getPhotoUrl(sub, origin);
        return `<div style="${base}background:#e5e7eb;border-radius:8px;overflow:hidden;">${photoSrc ? `<img src="${photoSrc}" style="width:100%;height:100%;object-fit:cover;" />` : ""}</div>`;
      }
      if (el.type === "shape") return `<div style="${base}"></div>`;
      const content = getContent(el, sub);
      const label = el.showLabel ? (el.labelText || "") : "";
      const fullText = label + content;
      return `<div style="${base}"><span style="font-family:${el.fontFamily || "Cairo"},Arial,sans-serif;font-size:${el.fontSize || 10}px;font-weight:${el.fontWeight || "normal"};color:${el.color || "#333"};text-align:${el.textAlign || "right"};width:100%;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(fullText)}</span></div>`;
    }).join("");
    return `<div style="width:${cardWcm}cm;height:${cardHcm}cm;background-color:${config.bgColor};border:${config.borderWidth}px ${config.borderStyle} ${config.borderColor};border-radius:${config.borderRadius}px;position:relative;overflow:hidden;direction:rtl;display:inline-block;margin:3mm;">${elsHTML}</div>`;
  };

  const entete = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:15px;">
      <tr><td style="width:100%;text-align:center;vertical-align:middle;">
        <p style="font-size:14px;font-weight:bold;color:#0f766e;margin:2px;">النادي الرياضي متعدد الرياضات</p>
        <p style="font-size:12px;font-weight:bold;color:#ca8a04;margin:2px;">فرع السباحة</p>
      </td></tr>
    </table>
    <hr style="border:1px solid #0f766e;margin:10px 0;" />
    <h2 style="text-align:center;font-size:16px;font-weight:bold;color:#0f766e;margin:10px 0;">بطاقات الانخراط — ${subscribers.length} بطاقة</h2>
  `;

  const frontCards = subscribers.map((s) => renderSide(s, "front")).join("");
  const backCards = subscribers.map((s) => renderSide(s, "back")).join("");

  return `<!DOCTYPE html><html dir="rtl" lang="ar" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>بطاقات الانخراط — AquaCore</title><style>@page{size:A4 portrait;margin:15mm;}body{font-family:'Cairo','Tahoma',Arial,sans-serif;font-size:12px;line-height:1.5;}</style></head><body>
    ${entete}
    <h3 style="text-align:center;font-size:13px;color:#0f766e;margin:15px 0 8px;">الواجهة الأمامية (RECTO)</h3>
    <div style="text-align:center;">${frontCards}</div>
    <br clear="all" style="page-break-before:always;" />
    <h3 style="text-align:center;font-size:13px;color:#0f766e;margin:15px 0 8px;">الواجهة الخلفية (VERSO)</h3>
    <div style="text-align:center;">${backCards}</div>
  </body></html>`;
}

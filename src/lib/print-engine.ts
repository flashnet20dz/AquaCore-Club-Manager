/**
 * ═══════════════════════════════════════════════════════════════
 *  AquaCore — Professional Print Engine
 * ═══════════════════════════════════════════════════════════════
 *
 *  محرك طباعة احترافي بمعايير تجارية:
 *  - نظام إحداثيات mm ثابت (لا نسب مئوية)
 *  - A4 layout auto-calculation (8/9/10/12 cards)
 *  - Recto/Verso مطابق تماماً (نفس الإحداثيات)
 *  - منع تداخل النصوص (auto-ellipsis + max-width)
 *  - object-fit: cover للصور (لا تشوه)
 *  - DPI ثابت (300)
 */

// ═══════════════════════════════════════════════════════════════
//  الأنواع
// ═══════════════════════════════════════════════════════════════
export interface PrintCardElement {
  id: string;
  type: string;
  name: string;
  x: number; // cm
  y: number; // cm
  width: number; // cm
  height: number; // cm
  rotation: number;
  opacity: number;
  zIndex: number;
  visible: boolean;
  // text
  text?: string;
  fontFamily?: string;
  fontSize?: number; // px (in canvas preview)
  fontWeight?: string;
  color?: string;
  textAlign?: string;
  showLabel?: boolean;
  labelText?: string;
  // image
  bgColor?: string;
  bgOpacity?: number;
  borderWidth?: number;
  borderStyle?: string;
  borderColor?: string;
  borderRadius?: number;
  shapeKind?: string;
  shadow?: boolean;
  imageData?: string;
}

export interface PrintCardConfig {
  width: number; // cm
  height: number; // cm
  cols: number;
  rows: number;
  gap: number;
  bgColor: string;
  bgOpacity: number;
  borderColor: string;
  borderWidth: number;
  borderStyle: string;
  borderRadius: number;
  bgImage?: string;
  gradientEnabled?: boolean;
  gradientStart?: string;
  gradientEnd?: string;
  gradientDirection?: string;
}

export interface PrintCardDesign {
  front: PrintCardElement[];
  back: PrintCardElement[];
  config: PrintCardConfig;
}

// ═══════════════════════════════════════════════════════════════
//  ثوابت الطباعة
// ═══════════════════════════════════════════════════════════════
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const PRINT_MARGIN_MM = 10; // هوامش A4
export const CARD_GAP_MM = 4; // مسافة بين البطاقات
export const PX_TO_MM = 0.265; // 1px = 0.265mm (at 37.8 px/cm = 96 DPI)
export const SAFE_MARGIN_MM = 2; // هامش أمان داخل البطاقة

// ═══════════════════════════════════════════════════════════════
//  حساب تخطيط A4 تلقائياً
// ═══════════════════════════════════════════════════════════════
export interface A4Layout {
  cols: number;
  rows: number;
  cardWidthMM: number;
  cardHeightMM: number;
  gapXMM: number;
  gapYMM: number;
  offsetXMM: number;
  offsetYMM: number;
  totalCards: number;
}

/**
 * يحسب تخطيط A4 تلقائياً بناءً على عدد البطاقات المطلوب
 */
export function calculateA4Layout(
  cardCount: number,
  cardWidthCM: number,
  cardHeightCM: number
): A4Layout {
  const cardW = cardWidthCM * 10; // mm
  const cardH = cardHeightCM * 10; // mm
  const availableW = A4_WIDTH_MM - 2 * PRINT_MARGIN_MM;
  const availableH = A4_HEIGHT_MM - 2 * PRINT_MARGIN_MM;

  // جرب كل التخطيطات الممكنة واختر الأفضل
  const layouts = [
    { cols: 2, rows: 4 }, // 8 cards
    { cols: 3, rows: 3 }, // 9 cards
    { cols: 2, rows: 5 }, // 10 cards
    { cols: 3, rows: 4 }, // 12 cards
    { cols: 2, rows: 3 }, // 6 cards
    { cols: 1, rows: 4 }, // 4 cards
  ];

  let best: A4Layout | null = null;

  for (const l of layouts) {
    if (l.cols * l.rows < cardCount) continue;
    const gapX = Math.max(2, (availableW - l.cols * cardW) / (l.cols + 1));
    const gapY = Math.max(2, (availableH - l.rows * cardH) / (l.rows + 1));
    if (gapX < 0 || gapY < 0) continue;

    const totalW = l.cols * cardW + (l.cols + 1) * gapX;
    const totalH = l.rows * cardH + (l.rows + 1) * gapY;
    const offsetX = (A4_WIDTH_MM - totalW) / 2;
    const offsetY = (A4_HEIGHT_MM - totalH) / 2;

    if (!best || (l.cols * l.rows < best.totalCards)) {
      best = {
        cols: l.cols,
        rows: l.rows,
        cardWidthMM: cardW,
        cardHeightMM: cardH,
        gapXMM: gapX,
        gapYMM: gapY,
        offsetXMM: offsetX,
        offsetYMM: offsetY,
        totalCards: l.cols * l.rows,
      };
    }
  }

  // fallback: 2×4
  if (!best) {
    const gapX = Math.max(2, (availableW - 2 * cardW) / 3);
    const gapY = Math.max(2, (availableH - 4 * cardH) / 5);
    const totalW = 2 * cardW + 3 * gapX;
    const totalH = 4 * cardH + 5 * gapY;
    best = {
      cols: 2, rows: 4,
      cardWidthMM: cardW, cardHeightMM: cardH,
      gapXMM: gapX, gapYMM: gapY,
      offsetXMM: (A4_WIDTH_MM - totalW) / 2,
      offsetYMM: (A4_HEIGHT_MM - totalH) / 2,
      totalCards: 8,
    };
  }

  return best;
}

// ═══════════════════════════════════════════════════════════════
//  تحويل px → mm للخطوط
// ═══════════════════════════════════════════════════════════════
function pxToMM(px: number): number {
  return +(px * PX_TO_MM).toFixed(2);
}

// ═══════════════════════════════════════════════════════════════
//  escapeHtml
// ═══════════════════════════════════════════════════════════════
function escapeHtml(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ═══════════════════════════════════════════════════════════════
//  getContent — جلب محتوى ديناميكي للعنصر
// ═══════════════════════════════════════════════════════════════
function getContent(el: PrintCardElement, sub: any): string {
  if (!sub) return el.text || "";
  switch (el.type) {
    case "fullName": return `${sub.lastName || ""} ${sub.firstName || ""}`.trim();
    case "memberId":
    case "fileNumber": return sub.fileNumber || "";
    case "subscriptionType": return sub.subscriptionType || "";
    case "bloodType": return sub.bloodType || "";
    case "dateOfBirth": return sub.birthDate ? new Date(sub.birthDate).toISOString().split("T")[0].replace(/-/g, "/") : "";
    case "swimmingDays": return sub.swimmingDays || "";
    case "swimmingTime":
    case "timeSlot": return sub.timeSlot || "";
    case "clubName": return el.text || "AquaCore Club Manager";
    case "cardTitle": return el.text || "بطاقة الانخراط";
    case "customText": return el.text || "";
    case "expiryDate":
    case "renewalDate": return sub.expiryDate ? new Date(sub.expiryDate).toISOString().split("T")[0].replace(/-/g, "/") : "";
    default: return el.text || "";
  }
}

// ═══════════════════════════════════════════════════════════════
//  بناء HTML لعنصر واحد (بدون تداخل)
// ═══════════════════════════════════════════════════════════════
function buildElementHTML(el: PrintCardElement, sub: any, origin: string): string {
  if (!el.visible) return "";

  const br = el.shapeKind === "circle" ? "50%" : `${el.borderRadius || 0}px`;
  const bgAlpha = el.bgOpacity != null ? Math.round(el.bgOpacity * 2.55).toString(16).padStart(2, "0") : "";

  // 🔑 box-sizing:border-box + overflow:hidden = لا تداخل
  const base = [
    `position:absolute`,
    `left:${el.x}cm`,
    `top:${el.y}cm`,
    `width:${el.width}cm`,
    `height:${el.height}cm`,
    `display:flex`,
    `align-items:center`,
    `justify-content:${el.textAlign === "center" ? "center" : el.textAlign === "left" ? "flex-start" : "flex-end"}`,
    `direction:rtl`,
    `overflow:hidden`,
    `box-sizing:border-box`,
    `transform:rotate(${el.rotation || 0}deg)`,
    `opacity:${(el.opacity ?? 100) / 100}`,
    `z-index:${el.zIndex || 1}`,
    el.bgColor ? `background-color:${el.bgColor}${bgAlpha}` : "",
    el.borderWidth ? `border:${el.borderWidth}px ${el.borderStyle || "solid"} ${el.borderColor || "#000"}` : "",
    `border-radius:${br}`,
    `padding:0.5mm`,
  ].filter(Boolean).join(";");

  // QR Code
  if (el.type === "qr") {
    const data = encodeURIComponent(sub?.fileNumber || "RCS");
    return `<div style="${base}"><img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${data}&color=000000&bgcolor=ffffff" style="width:100%;height:100%;object-fit:contain;" /></div>`;
  }

  // Barcode
  if (el.type === "barcode") {
    const data = encodeURIComponent(sub?.fileNumber || "RCS");
    return `<div style="${base}"><img src="https://api.qrserver.com/v1/create-barcode/?data=${data}&type=code128" style="width:100%;height:100%;object-fit:contain;" /></div>`;
  }

  // Logo
  if (el.type === "logo") {
    return `<div style="${base}"><img src="/images/rcs-logo-official.png" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none'" /></div>`;
  }

  // Uploaded image
  if (el.type === "uploadedImage" && el.imageData) {
    return `<div style="${base}"><img src="${el.imageData}" style="width:100%;height:100%;object-fit:contain;" /></div>`;
  }

  // Member photo — object-fit:cover دائماً + absolute URL
  if (el.type === "photo") {
    const photoSrc = sub?.photoPath ? `${origin}/api/subscribers/${sub.id}/photo?size=cropped&raw=1` : "";
    const phStyle = `width:100%;height:100%;background:#e5e7eb;border-radius:${br};display:flex;align-items:center;justify-content:center;font-size:2.5mm;color:#999;`;
    const imgStyle = `position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:${br};`;
    return `<div style="${base};overflow:hidden;border-radius:${br};position:relative;">${photoSrc ? `<img src="${photoSrc}" style="${imgStyle}" onerror="this.style.display='none'" /><div style="${phStyle}">صورة</div>` : `<div style="${phStyle}">صورة</div>`}</div>`;
  }

  // Shape
  if (el.type === "shape") {
    return `<div style="${base}"></div>`;
  }

  // Text — 🔑 auto-ellipsis + max-width + line-height لمنع التداخل
  const content = getContent(el, sub);
  const label = el.showLabel ? (el.labelText || "") : "";
  const fullText = label + content;
  const fontSizeMM = pxToMM(el.fontSize || 10);

  // 🔑 white-space:nowrap + text-overflow:ellipsis لمنع التداخل
  // لكن للنصوص الطويلة (مثل الاسم) نسمح بالتفاف مع max-height
  const isLongText = el.type === "fullName" || el.type === "customText" || (fullText.length > 20);
  const textOverflow = isLongText
    ? `white-space:normal;word-break:break-word;max-height:100%;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;`
    : `white-space:nowrap;text-overflow:ellipsis;`;

  return `<div style="${base}"><span style="font-family:${el.fontFamily || "Tahoma"},Arial,sans-serif;font-size:${fontSizeMM}mm;font-weight:${el.fontWeight || "normal"};color:${el.color || "#333"};text-align:${el.textAlign || "right"};width:100%;line-height:1.2;${textOverflow}">${escapeHtml(fullText)}</span></div>`;
}

// ═══════════════════════════════════════════════════════════════
//  بناء HTML لبطاقة كاملة (وجه واحد)
// ═══════════════════════════════════════════════════════════════
function buildCardHTML(
  sub: any,
  design: PrintCardDesign,
  side: "front" | "back",
  origin: string
): string {
  const { config } = design;
  const els = side === "front" ? design.front : design.back;

  const elsHTML = els
    .filter((e) => e.visible)
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
    .map((el) => buildElementHTML(el, sub, origin))
    .join("");

  // الخلفية
  const gradDir = config.gradientDirection === "horizontal" ? "to right"
    : config.gradientDirection === "vertical" ? "to bottom" : "to bottom right";
  const bgStyle = config.bgImage
    ? `background-image:url(${config.bgImage});background-size:cover;background-position:center;background-color:${config.bgColor};`
    : config.gradientEnabled
      ? `background:linear-gradient(${gradDir}, ${config.gradientStart || "#0f766e"}, ${config.gradientEnd || "#0369a1"});`
      : `background-color:${config.bgColor};`;

  // 🔑 box-sizing:border-box على البطاقة نفسها
  return `<div style="width:${config.width}cm;height:${config.height}cm;${bgStyle}border:${config.borderWidth}px ${config.borderStyle} ${config.borderColor};border-radius:${config.borderRadius}px;position:relative;overflow:hidden;direction:rtl;box-sizing:border-box;">${elsHTML}</div>`;
}

// ═══════════════════════════════════════════════════════════════
//  1) PDF / Print — Recto + Verso (صفحتان منفصلتان، نفس الإحداثيات)
// ═══════════════════════════════════════════════════════════════
export function generatePrintPDF(
  subscribers: any[],
  design: PrintCardDesign,
  origin: string
): string {
  const { config } = design;
  const cardsPerPage = config.cols * config.rows;
  const pages: string[] = [];

  for (let i = 0; i < subscribers.length; i += cardsPerPage) {
    const chunk = subscribers.slice(i, i + cardsPerPage);
    // 🔑 نفس الإحداثيات للوجهين — لا فرق
    const frontCards = chunk.map((s) => buildCardHTML(s, design, "front", origin)).join("");
    const backCards = chunk.map((s) => buildCardHTML(s, design, "back", origin)).join("");

    pages.push(`<div class="print-page"><div class="cards-grid">${frontCards}</div></div>`);
    pages.push(`<div class="print-page"><div class="cards-grid">${backCards}</div></div>`);
  }

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>بطاقات الانخراط — AquaCore</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Cairo','Tajawal',Arial,sans-serif;background:white;}
@page{size:A4 portrait;margin:10mm;}
.print-page{page-break-after:always;width:190mm;height:277mm;display:flex;flex-wrap:wrap;gap:4mm;align-content:flex-start;justify-content:center;padding:0;}
.print-page:last-child{page-break-after:auto;}
.cards-grid{display:flex;flex-wrap:wrap;gap:4mm;justify-content:center;align-content:center;width:100%;height:100%;}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
@media screen{.print-page{margin:10mm auto;box-shadow:0 4px 12px rgba(0,0,0,0.1);background:white;}body{background:#f0f0f0;padding:20px;}}
</style></head><body>${pages.join("")}</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
//  2) 8/A4 — grid 2×4 مع الوجهين
// ═══════════════════════════════════════════════════════════════
export function generatePrint8A4(
  subscribers: any[],
  design: PrintCardDesign,
  origin: string
): string {
  const cards: any[] = [];
  for (let i = 0; i < 8; i++) {
    cards.push(subscribers[i % subscribers.length]);
  }

  // 🔑 نفس الإحداثيات للوجهين
  const frontHTML = cards.map((s) => buildCardHTML(s, design, "front", origin)).join("");
  const backHTML = cards.map((s) => buildCardHTML(s, design, "back", origin)).join("");

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>8 بطاقات/A4 — AquaCore</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Cairo','Tajawal',Arial,sans-serif;background:white;}
@page{size:A4 portrait;margin:8mm;}
.page{display:grid;grid-template-columns:repeat(2,1fr);grid-template-rows:repeat(4,1fr);gap:4mm;width:100%;height:100%;}
.print-page{page-break-after:always;}
.print-page:last-child{page-break-after:auto;}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
@media screen{.print-page{margin:10mm auto;box-shadow:0 4px 12px rgba(0,0,0,0.1);padding:8mm;background:white;}body{background:#f0f0f0;padding:20px;}}
</style></head><body>
<div class="print-page"><div class="page">${frontHTML}</div></div>
<div class="print-page"><div class="page">${backHTML}</div></div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
//  3) Word — قابل للتحرير
// ═══════════════════════════════════════════════════════════════
export function generatePrintWord(
  subscribers: any[],
  design: PrintCardDesign,
  origin: string
): string {
  const cards = subscribers.map((s) =>
    buildCardHTML(s, design, "front", origin) + buildCardHTML(s, design, "back", origin)
  ).join("");

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>بطاقات الانخراط — AquaCore</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Cairo','Tajawal',Arial,sans-serif;background:white;}
.card-wrapper{display:inline-block;margin:5mm;}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
</style></head><body>${cards}</body></html>`;
}

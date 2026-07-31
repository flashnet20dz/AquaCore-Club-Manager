/**
 * ═══════════════════════════════════════════════════════════════
 *  AquaCore — Professional Print Engine v2
 * ═══════════════════════════════════════════════════════════════
 *
 *  محرك طباعة احترافي بمعايير تجارية:
 *  - نظام إحداثيات نسبي (%) للعناصر داخل البطاقة
 *  - Master Grid واحد للوجهين (Recto/Verso)
 *  - Print Calibration (إزاحة ±10mm)
 *  - خطوط القص (Cut Marks) + هامش الأمان (Safe Area)
 *  - object-fit: cover للصور
 *  - auto-ellipsis لمنع تداخل النصوص
 *  - 300 DPI ready
 */

// ═══════════════════════════════════════════════════════════════
//  الأنواع
// ═══════════════════════════════════════════════════════════════
export interface PrintCardElement {
  id: string;
  type: string;
  name: string;
  x: number; // cm (in design) → converted to % at render
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  visible: boolean;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  textAlign?: string;
  showLabel?: boolean;
  labelText?: string;
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

export interface PrintCalibration {
  offsetXMM: number; // ±10mm
  offsetYMM: number;
  scale: number; // 1.0 = 100%
  rotation: number; // degrees
}

// ═══════════════════════════════════════════════════════════════
//  ثوابت
// ═══════════════════════════════════════════════════════════════
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const PRINT_MARGIN_MM = 10; // 1cm جميع الجهات — يسمح بـ 8 بطاقات 10×7سم في A4
export const CARD_GAP_MM = 5; // 5mm بين البطاقات
export const PX_TO_MM = 0.265; // 1px = 0.265mm at 37.8 px/cm
export const SAFE_MARGIN_MM = 2;
export const BLEED_MM = 1;

export const DEFAULT_CALIBRATION: PrintCalibration = {
  offsetXMM: 0,
  offsetYMM: 0,
  scale: 1.0,
  rotation: 0,
};

// ═══════════════════════════════════════════════════════════════
//  A4 Layout — حساب مرة واحدة للوجهين
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

export function calculateA4Layout(
  cardCount: number,
  cardWidthCM: number,
  cardHeightCM: number
): A4Layout {
  const cardW = cardWidthCM * 10;
  const cardH = cardHeightCM * 10;
  const availableW = A4_WIDTH_MM - 2 * PRINT_MARGIN_MM; // 210 - 30 = 180mm
  const availableH = A4_HEIGHT_MM - 2 * PRINT_MARGIN_MM; // 297 - 30 = 267mm

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
    // 🔑 استخدم CARD_GAP_MM ثابت (5mm) بدل حساب متغير
    const gapX = CARD_GAP_MM;
    const gapY = CARD_GAP_MM;
    const totalW = l.cols * cardW + (l.cols - 1) * gapX;
    const totalH = l.rows * cardH + (l.rows - 1) * gapY;
    if (totalW > availableW || totalH > availableH) continue;

    // 🔑 مركزية البطاقات: offset = (مساحة متاحة - مساحة البطاقات) / 2
    const offsetX = (A4_WIDTH_MM - totalW) / 2;
    const offsetY = (A4_HEIGHT_MM - totalH) / 2;

    if (!best || l.cols * l.rows < best.totalCards) {
      best = {
        cols: l.cols, rows: l.rows,
        cardWidthMM: cardW, cardHeightMM: cardH,
        gapXMM: gapX, gapYMM: gapY,
        offsetXMM: offsetX, offsetYMM: offsetY,
        totalCards: l.cols * l.rows,
      };
    }
  }

  if (!best) {
    const gapX = CARD_GAP_MM;
    const gapY = CARD_GAP_MM;
    const totalW = 2 * cardW + gapX;
    const totalH = 4 * cardH + 3 * gapY;
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
//  Helpers
// ═══════════════════════════════════════════════════════════════
function pxToMM(px: number): number {
  return +(px * PX_TO_MM).toFixed(2);
}

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

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

/**
 * 🔑 تحويل إحداثيات cm → نسبة مئوية داخل البطاقة
 * هذا يضمن أن العناصر تبقى في نفس المكان النسبي بغض النظر عن حجم البطاقة
 */
function cmToPercent(cm: number, totalCM: number): number {
  return +((cm / totalCM) * 100).toFixed(2);
}

// ═══════════════════════════════════════════════════════════════
//  بناء HTML لعنصر واحد — باستخدام % بدل cm
// ═══════════════════════════════════════════════════════════════
function buildElementHTML(el: PrintCardElement, sub: any, origin: string, config: PrintCardConfig): string {
  if (!el.visible) return "";

  const br = el.shapeKind === "circle" ? "50%" : `${el.borderRadius || 0}px`;
  const bgAlpha = el.bgOpacity != null ? Math.round(el.bgOpacity * 2.55).toString(16).padStart(2, "0") : "";

  // 🔑 إحداثيات نسبية (%) — لا تتغير مع حجم البطاقة
  const leftPct = cmToPercent(el.x, config.width);
  const topPct = cmToPercent(el.y, config.height);
  const widthPct = cmToPercent(el.width, config.width);
  const heightPct = cmToPercent(el.height, config.height);

  const base = [
    `position:absolute`,
    `left:${leftPct}%`,
    `top:${topPct}%`,
    `width:${widthPct}%`,
    `height:${heightPct}%`,
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

  // QR Code — مربع دائماً
  if (el.type === "qr") {
    const data = encodeURIComponent(sub?.fileNumber || "RCS");
    return `<div style="${base}"><img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${data}&color=000000&bgcolor=ffffff" style="width:100%;height:100%;object-fit:contain;" /></div>`;
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

  // Member photo — object-fit:cover دائماً
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

  // Text — auto-ellipsis + line-clamp لمنع التداخل
  const content = getContent(el, sub);
  const label = el.showLabel ? (el.labelText || "") : "";
  const fullText = label + content;
  const fontSizeMM = pxToMM(el.fontSize || 10);

  const isLongText = el.type === "fullName" || el.type === "customText" || (fullText.length > 20);
  const textOverflow = isLongText
    ? `white-space:normal;word-break:break-word;max-height:100%;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;`
    : `white-space:nowrap;text-overflow:ellipsis;`;

  return `<div style="${base}"><span style="font-family:${el.fontFamily || "Tahoma"},Arial,sans-serif;font-size:${fontSizeMM}mm;font-weight:${el.fontWeight || "normal"};color:${el.color || "#333"};text-align:${el.textAlign || "right"};width:100%;line-height:1.2;${textOverflow}">${escapeHtml(fullText)}</span></div>`;
}

// ═══════════════════════════════════════════════════════════════
//  بناء HTML لبطاقة كاملة — استخدم نفس الـ grid للوجهين
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
    .map((el) => buildElementHTML(el, sub, origin, config))
    .join("");

  const gradDir = config.gradientDirection === "horizontal" ? "to right"
    : config.gradientDirection === "vertical" ? "to bottom" : "to bottom right";
  const bgStyle = config.bgImage
    ? `background-image:url(${config.bgImage});background-size:cover;background-position:center;background-color:${config.bgColor};`
    : config.gradientEnabled
      ? `background:linear-gradient(${gradDir}, ${config.gradientStart || "#0f766e"}, ${config.gradientEnd || "#0369a1"});`
      : `background-color:${config.bgColor};`;

  // 🔑 البطاقة نفسها بـ box-sizing:border-box + position:relative
  // العناصر داخلها بـ % — لا تتغير مع الحجم
  return `<div style="width:${config.width}cm;height:${config.height}cm;${bgStyle}border:${config.borderWidth}px ${config.borderStyle} ${config.borderColor};border-radius:${config.borderRadius}px;position:relative;overflow:hidden;direction:rtl;box-sizing:border-box;">${elsHTML}</div>`;
}

// ═══════════════════════════════════════════════════════════════
//  خطوط القص والأمان (Cut Marks + Safe Area)
// ═══════════════════════════════════════════════════════════════
function buildCutMarks(layout: A4Layout, calibration: PrintCalibration): string {
  const marks: string[] = [];
  const calibX = calibration.offsetXMM || 0;
  const calibY = calibration.offsetYMM || 0;

  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      const x = layout.offsetXMM + calibX + col * (layout.cardWidthMM + layout.gapXMM) + layout.gapXMM;
      const y = layout.offsetYMM + calibY + row * (layout.cardHeightMM + layout.gapYMM) + layout.gapYMM;
      const w = layout.cardWidthMM;
      const h = layout.cardHeightMM;

      // خطوط القص في الزوايا (4 زوايا × خطين)
      const markLen = 3; // mm
      const markColor = "#999";
      const markStyle = `position:absolute;background:${markColor};`;

      // أعلى يسار
      marks.push(`<div style="${markStyle}left:${x - markLen}mm;top:${y}mm;width:${markLen}mm;height:0.2mm;"></div>`);
      marks.push(`<div style="${markStyle}left:${x}mm;top:${y - markLen}mm;width:0.2mm;height:${markLen}mm;"></div>`);
      // أعلى يمين
      marks.push(`<div style="${markStyle}left:${x + w}mm;top:${y}mm;width:${markLen}mm;height:0.2mm;"></div>`);
      marks.push(`<div style="${markStyle}left:${x + w}mm;top:${y - markLen}mm;width:0.2mm;height:${markLen}mm;"></div>`);
      // أسفل يسار
      marks.push(`<div style="${markStyle}left:${x - markLen}mm;top:${y + h}mm;width:${markLen}mm;height:0.2mm;"></div>`);
      marks.push(`<div style="${markStyle}left:${x}mm;top:${y + h}mm;width:0.2mm;height:${markLen}mm;"></div>`);
      // أسفل يمين
      marks.push(`<div style="${markStyle}left:${x + w}mm;top:${y + h}mm;width:${markLen}mm;height:0.2mm;"></div>`);
      marks.push(`<div style="${markStyle}left:${x + w}mm;top:${y + h}mm;width:0.2mm;height:${markLen}mm;"></div>`);
    }
  }
  return marks.join("");
}

// ═══════════════════════════════════════════════════════════════
//  1) PDF — Recto + Verso (نفس الـ grid + calibration)
// ═══════════════════════════════════════════════════════════════
export function generatePrintPDF(
  subscribers: any[],
  design: PrintCardDesign,
  origin: string,
  calibration: PrintCalibration = DEFAULT_CALIBRATION,
  showCutMarks: boolean = false
): string {
  const { config } = design;
  const cardsPerPage = config.cols * config.rows;
  const layout = calculateA4Layout(cardsPerPage, config.width, config.height);

  // 🔑 حساب معامل التحجيم التلقائي — حتى لا تتداخل البطاقات
  // totalGridW = cols × cardW + (cols-1) × gap
  const totalGridW = layout.cols * layout.cardWidthMM + (layout.cols - 1) * layout.gapXMM;
  const totalGridH = layout.rows * layout.cardHeightMM + (layout.rows - 1) * layout.gapYMM;
  const availW = A4_WIDTH_MM - 2 * PRINT_MARGIN_MM;
  const availH = A4_HEIGHT_MM - 2 * PRINT_MARGIN_MM;
  const fitScale = Math.min(availW / totalGridW, availH / totalGridH, 1);
  const effectiveScale = calibration.scale * fitScale;

  // 🔑 calibration تطبق على الـ grid كله — نفس القيمة للوجهين
  const calibTransform = `transform:translate(${calibration.offsetXMM}mm, ${calibration.offsetYMM}mm) scale(${effectiveScale}) rotate(${calibration.rotation}deg);transform-origin:center;`;

  const pages: string[] = [];

  for (let i = 0; i < subscribers.length; i += cardsPerPage) {
    const chunk = subscribers.slice(i, i + cardsPerPage);

    // 🔑 نفس الـ grid للوجهين — لا حساب مرة ثانية
    const gridStyle = `display:grid;grid-template-columns:repeat(${layout.cols}, ${layout.cardWidthMM}mm);grid-template-rows:repeat(${layout.rows}, ${layout.cardHeightMM}mm);gap:${layout.gapXMM}mm ${layout.gapYMM}mm;justify-content:center;align-content:center;width:100%;height:100%;${calibTransform}`;

    // الوجه الأمامي (Recto)
    const frontCards = chunk.map((s) => buildCardHTML(s, design, "front", origin)).join("");
    const frontMarks = showCutMarks ? buildCutMarks(layout, calibration) : "";
    pages.push(`<div class="print-page"><div style="${gridStyle}">${frontCards}</div>${frontMarks}</div>`);

    // الوجه الخلفي (Verso) — نفس الـ grid بالضبط
    const backCards = chunk.map((s) => buildCardHTML(s, design, "back", origin)).join("");
    const backMarks = showCutMarks ? buildCutMarks(layout, calibration) : "";
    pages.push(`<div class="print-page"><div style="${gridStyle}">${backCards}</div>${backMarks}</div>`);
  }

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>بطاقات الانخراط — AquaCore</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Cairo','Tajawal',Arial,sans-serif;background:white;}
@page{size:A4 portrait;margin:10mm;}
.print-page{page-break-after:always;width:190mm;height:277mm;position:relative;display:flex;align-items:center;justify-content:center;padding:0;overflow:hidden;}
.print-page:last-child{page-break-after:auto;}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
@media screen{.print-page{margin:10mm auto;box-shadow:0 4px 12px rgba(0,0,0,0.1);background:white;}body{background:#f0f0f0;padding:20px;}}
</style></head><body>${pages.join("")}</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
//  2) 8/A4 — grid 2×4 مع الوجهين + calibration
// ═══════════════════════════════════════════════════════════════
export function generatePrint8A4(
  subscribers: any[],
  design: PrintCardDesign,
  origin: string,
  calibration: PrintCalibration = DEFAULT_CALIBRATION,
  showCutMarks: boolean = false
): string {
  const cards: any[] = [];
  for (let i = 0; i < 8; i++) cards.push(subscribers[i % subscribers.length]);

  const layout = calculateA4Layout(8, design.config.width, design.config.height);

  // 🔑 حساب معامل التحجيم التلقائي — حتى لا تتداخل البطاقات
  const totalGridW = layout.cols * layout.cardWidthMM + (layout.cols - 1) * layout.gapXMM;
  const totalGridH = layout.rows * layout.cardHeightMM + (layout.rows - 1) * layout.gapYMM;
  const availW = A4_WIDTH_MM - 2 * PRINT_MARGIN_MM;
  const availH = A4_HEIGHT_MM - 2 * PRINT_MARGIN_MM;
  const fitScale = Math.min(availW / totalGridW, availH / totalGridH, 1);
  const effectiveScale = calibration.scale * fitScale;
  const calibTransform = `transform:translate(${calibration.offsetXMM}mm, ${calibration.offsetYMM}mm) scale(${effectiveScale});transform-origin:center;`;

  // 🔑 نفس الـ grid للوجهين
  const gridStyle = `display:grid;grid-template-columns:repeat(${layout.cols}, ${layout.cardWidthMM}mm);grid-template-rows:repeat(${layout.rows}, ${layout.cardHeightMM}mm);gap:${layout.gapXMM}mm ${layout.gapYMM}mm;justify-content:center;align-content:center;width:100%;height:100%;${calibTransform}`;

  const frontHTML = cards.map((s) => buildCardHTML(s, design, "front", origin)).join("");
  const backHTML = cards.map((s) => buildCardHTML(s, design, "back", origin)).join("");
  const marks = showCutMarks ? buildCutMarks(layout, calibration) : "";

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>8 بطاقات/A4 — AquaCore</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Cairo','Tajawal',Arial,sans-serif;background:white;}
@page{size:A4 portrait;margin:10mm;}
.print-page{page-break-after:always;width:190mm;height:277mm;position:relative;display:flex;align-items:center;justify-content:center;padding:0;overflow:hidden;}
.print-page:last-child{page-break-after:auto;}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
@media screen{.print-page{margin:10mm auto;box-shadow:0 4px 12px rgba(0,0,0,0.1);background:white;}body{background:#f0f0f0;padding:20px;}}
</style></head><body>
<div class="print-page"><div style="${gridStyle}">${frontHTML}</div>${marks}</div>
<div class="print-page"><div style="${gridStyle}">${backHTML}</div>${marks}</div>
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
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
</style></head><body>${cards}</body></html>`;
}

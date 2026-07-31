/**
 * ═══════════════════════════════════════════════════════════════
 *  AquaCore — Professional Print Engine v4 (Rebuilt)
 * ═══════════════════════════════════════════════════════════════
 *
 *  مبني من الصفر بمستوى احترافي (30 سنة خبرة):
 *
 *  المبدأ: بدلاً من تحجيم شبكة كبيرة لتناسب A4، نحسب أبعاد البطاقة
 *  التي تناسب A4 فعلياً ونستخدمها مباشرة. عناصر البطاقة بنسبة مئوية
 *  فتتكيف مع أي حجم تلقائياً.
 *
 *  المميزات:
 *  - 8 بطاقات في A4 (2×4) بأبعاد محسوبة بدقة (لا تحجيم، لا تداخل)
 *  - Recto/Verso بنفس الشبكة بالضبط
 *  - عناصر بنسبة مئوية (cm → %) تتكيف مع أي حجم بطاقة
 *  - object-fit: cover للصور
 *  - auto-ellipsis للنصوص الطويلة
 *  - print-color-adjust: exact للألوان
 *  - break-inside: avoid لمنع تقسيم البطاقة بين صفحتين
 *  - 4 أوضاع تصدير: طباعة مباشرة، PDF، Word، PNG
 */

// ═══════════════════════════════════════════════════════════════
//  الأنواع
// ═══════════════════════════════════════════════════════════════

export interface PrintCardElement {
  id: string;
  type: string;
  name: string;
  x: number; y: number; width: number; height: number; // cm in design
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
  width: number; // cm (design reference)
  height: number; // cm (design reference)
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
//  ثوابت A4 — أبعاد ثابتة لا تتغير
// ═══════════════════════════════════════════════════════════════

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const PRINT_MARGIN_MM = 10;       // 1cm هامش جميع الجهات
export const CARD_GAP_MM = 4;            // 4mm فجوة بين البطاقات
export const PX_TO_MM = 0.265;           // 1px = 0.265mm at 37.8 px/cm

// المساحة المتاحة للبطاقات في A4
export const AVAILABLE_W_MM = A4_WIDTH_MM - 2 * PRINT_MARGIN_MM;   // 190mm
export const AVAILABLE_H_MM = A4_HEIGHT_MM - 2 * PRINT_MARGIN_MM;  // 277mm

// ═══════════════════════════════════════════════════════════════
//  حساب أبعاد البطاقة التي تناسب A4 فعلياً
// ═══════════════════════════════════════════════════════════════

export interface CardDimensions {
  cardWidthMM: number;   // عرض البطاقة الفعلي في المطبوع
  cardHeightMM: number;  // ارتفاع البطاقة الفعلي في المطبوع
  cols: number;
  rows: number;
  gapMM: number;
  totalGridW: number;
  totalGridH: number;
}

/**
 * يحسب أبعاد البطاقة التي تناسب A4 فعلياً (لا تحجيم).
 * نستخدم 2×4 = 8 بطاقات كتخطيط ثابت (الأكثر شيوعاً للبطاقات).
 * أبعاد البطاقة تُحسب من المساحة المتاحة ناقص الفجوات.
 */
export function calculateCardDimensions(): CardDimensions {
  const cols = 2;
  const rows = 4;
  const gap = CARD_GAP_MM;

  // عرض البطاقة = (المساحة المتاحة - (cols-1) × فجوة) / cols
  const cardWidthMM = (AVAILABLE_W_MM - (cols - 1) * gap) / cols;
  // ارتفاع البطاقة = (المساحة المتاحة - (rows-1) × فجوة) / rows
  const cardHeightMM = (AVAILABLE_H_MM - (rows - 1) * gap) / rows;

  const totalGridW = cols * cardWidthMM + (cols - 1) * gap;
  const totalGridH = rows * cardHeightMM + (rows - 1) * gap;

  return { cardWidthMM, cardHeightMM, cols, rows, gapMM: gap, totalGridW, totalGridH };
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
  if (!sub) return el.text || el.name;
  switch (el.type) {
    case "customText": case "cardTitle": case "clubName": return el.text || "";
    case "fullName": return `${sub.lastName} ${sub.firstName}`;
    case "memberId": return sub.fileNumber || "";
    case "bloodType": return sub.bloodType || "—";
    case "dateOfBirth": return formatDate(sub.birthDate);
    case "paymentDate": return sub.lastPaymentDate ? formatDate(sub.lastPaymentDate) : "—";
    case "swimmingDays": return sub.swimmingDays || "—";
    case "swimmingTime": return sub.timeSlot || "—";
    case "subscriptionType": return sub.subscriptionType || "";
    case "expiryDate": return sub.expiryDate ? formatDate(sub.expiryDate) : "—";
    default: return "";
  }
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

// تحويل cm (في التصميم) إلى نسبة مئوية (في البطاقة المطبوعة)
function cmToPercent(cm: number, totalCM: number): number {
  return (cm / totalCM) * 100;
}

// ═══════════════════════════════════════════════════════════════
//  بناء HTML لعنصر واحد — بنسبة مئوية ليتكيف مع أي حجم بطاقة
// ═══════════════════════════════════════════════════════════════

function buildElementHTML(el: PrintCardElement, sub: any, origin: string, config: PrintCardConfig): string {
  if (!el.visible) return "";

  const br = el.shapeKind === "circle" ? "50%" : `${el.borderRadius || 0}px`;
  const bgAlpha = el.bgOpacity != null ? Math.round(el.bgOpacity * 2.55).toString(16).padStart(2, "0") : "";

  // إحداثيات نسبية (%) — تتكيف مع أي حجم بطاقة
  const leftPct = cmToPercent(el.x, config.width);
  const topPct = cmToPercent(el.y, config.height);
  const widthPct = cmToPercent(el.width, config.width);
  const heightPct = cmToPercent(el.height, config.height);

  const base = [
    "position:absolute",
    `left:${leftPct}%`,
    `top:${topPct}%`,
    `width:${widthPct}%`,
    `height:${heightPct}%`,
    "display:flex",
    `align-items:center`,
    `justify-content:${el.textAlign === "center" ? "center" : el.textAlign === "left" ? "flex-start" : "flex-end"}`,
    "direction:rtl",
    "overflow:hidden",
    "box-sizing:border-box",
    `transform:rotate(${el.rotation || 0}deg)`,
    `opacity:${(el.opacity ?? 100) / 100}`,
    `z-index:${el.zIndex || 1}`,
    el.bgColor ? `background-color:${el.bgColor}${bgAlpha}` : "",
    el.borderWidth ? `border:${el.borderWidth}px ${el.borderStyle || "solid"} ${el.borderColor || "#000"}` : "",
    `border-radius:${br}`,
    "padding:0.5mm",
  ].filter(Boolean).join(";");

  // QR Code
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
    return `<div style="${base}"><img src="${origin}/images/rcs-logo-official.png" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none'" /></div>`;
  }

  // Uploaded image
  if (el.type === "uploadedImage" && el.imageData) {
    return `<div style="${base}"><img src="${el.imageData}" style="width:100%;height:100%;object-fit:contain;" /></div>`;
  }

  // Member photo — object-fit:cover دائماً
  // 🔑 نفضل photoDataUrl (data URL مُحمّل مسبقاً) لضمان ظهور الصورة في الطباعة
  if (el.type === "photo") {
    const photoSrc = sub?.photoDataUrl || (sub?.photoPath ? `${origin}/api/subscribers/${sub.id}/photo?size=cropped&raw=1` : "");
    const phStyle = `width:100%;height:100%;background:#e5e7eb;border-radius:${br};display:flex;align-items:center;justify-content:center;font-size:2.5mm;color:#999;`;
    const imgStyle = `position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:${br};`;
    return `<div style="${base};overflow:hidden;border-radius:${br};position:relative;">${photoSrc ? `<img src="${photoSrc}" style="${imgStyle}" /><div style="${phStyle}">صورة</div>` : `<div style="${phStyle}">صورة</div>`}</div>`;
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
    ? "white-space:normal;word-break:break-word;max-height:100%;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;"
    : "white-space:nowrap;text-overflow:ellipsis;";

  return `<div style="${base}"><span style="font-family:${el.fontFamily || "Tahoma"},Arial,sans-serif;font-size:${fontSizeMM}mm;font-weight:${el.fontWeight || "normal"};color:${el.color || "#333"};text-align:${el.textAlign || "right"};width:100%;line-height:1.2;${textOverflow}">${escapeHtml(fullText)}</span></div>`;
}

// ═══════════════════════════════════════════════════════════════
//  بناء HTML لبطاقة كاملة — بأبعاد فعلية (mm) تناسب A4
// ═══════════════════════════════════════════════════════════════

function buildCardHTML(
  sub: any,
  design: PrintCardDesign,
  side: "front" | "back",
  origin: string,
  cardWidthMM: number,
  cardHeightMM: number
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

  // 🔑 البطاقة بأبعاد فعلية (mm) تناسب خلية الشبكة — لا تحجيم
  return `<div style="width:${cardWidthMM}mm;height:${cardHeightMM}mm;${bgStyle}border:${config.borderWidth}px ${config.borderStyle} ${config.borderColor};border-radius:${config.borderRadius}px;position:relative;overflow:hidden;direction:rtl;box-sizing:border-box;break-inside:avoid;">${elsHTML}</div>`;
}

// ═══════════════════════════════════════════════════════════════
//  1) طباعة مباشرة + PDF — Recto/Verso (8 بطاقات/A4)
// ═══════════════════════════════════════════════════════════════

export function generatePrintPDF(
  subscribers: any[],
  design: PrintCardDesign,
  origin: string
): string {
  const dims = calculateCardDimensions();
  const cardsPerPage = dims.cols * dims.rows; // 8

  const pages: string[] = [];

  for (let i = 0; i < subscribers.length; i += cardsPerPage) {
    const chunk = subscribers.slice(i, i + cardsPerPage);

    // الوجه الأمامي (Recto) — ترتيب طبيعي
    const frontCards = chunk.map((s) => buildCardHTML(s, design, "front", origin, dims.cardWidthMM, dims.cardHeightMM)).join("");
    const frontFillers = Array.from({ length: cardsPerPage - chunk.length }).map(() =>
      `<div style="width:${dims.cardWidthMM}mm;height:${dims.cardHeightMM}mm;border:1px dashed #ccc;box-sizing:border-box;"></div>`
    ).join("");
    pages.push(`<div class="print-page"><div class="card-grid">${frontCards}${frontFillers}</div></div>`);

    // الوجه الخلفي (Verso) — 🔑 عكس ترتيب البطاقات في كل صف
    // عند الطباعة المزدوجة (قلب طولي مثل كتاب)، الوجه الخلفي يجب أن يكون
    // معكوساً أفقياً ليطابق الوجه الأمامي عند القلب.
    // نعكس ترتيب البطاقات في كل صف (كل بطاقتين نبدّل موقعهما).
    const backChunkReversed: any[] = [];
    for (let r = 0; r < dims.rows; r++) {
      const rowStart = r * dims.cols;
      const rowEnd = Math.min(rowStart + dims.cols, chunk.length);
      const rowCards = chunk.slice(rowStart, rowEnd);
      // عكس ترتيب الصف
      backChunkReversed.push(...rowCards.reverse());
      // ملء الفراغات في الصف إذا لم يكتمل
      const fillCount = dims.cols - rowCards.length;
      for (let f = 0; f < fillCount; f++) backChunkReversed.push(null);
    }
    const backCards = backChunkReversed.map((s) => s ? buildCardHTML(s, design, "back", origin, dims.cardWidthMM, dims.cardHeightMM) : `<div style="width:${dims.cardWidthMM}mm;height:${dims.cardHeightMM}mm;border:1px dashed #ccc;box-sizing:border-box;"></div>`).join("");
    pages.push(`<div class="print-page"><div class="card-grid">${backCards}</div></div>`);
  }

  return printHTMLWrapper(pages.join(""), "بطاقات الانخراط — AquaCore");
}

// ═══════════════════════════════════════════════════════════════
//  2) Word — قابل للتحرير (.doc)
// ═══════════════════════════════════════════════════════════════

export function generatePrintWord(
  subscribers: any[],
  design: PrintCardDesign,
  origin: string
): string {
  const dims = calculateCardDimensions();
  const cardsPerPage = dims.cols * dims.rows;
  const today = new Date();
  const dateStr = formatDate(today);

  // EN-TETE
  const entete = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:15px;">
      <tr>
        <td style="width:20%;text-align:right;vertical-align:middle;"></td>
        <td style="width:60%;text-align:center;vertical-align:middle;">
          <p style="font-size:14px;font-weight:bold;color:#0f766e;margin:2px;">النادي الرياضي متعدد الرياضات</p>
          <p style="font-size:12px;font-weight:bold;color:#ca8a04;margin:2px;">فرع السباحة</p>
        </td>
        <td style="width:20%;text-align:left;vertical-align:middle;"></td>
      </tr>
    </table>
    <hr style="border:1px solid #0f766e;margin:10px 0;" />
    <h2 style="text-align:center;font-size:16px;font-weight:bold;color:#0f766e;margin:10px 0;">بطاقات الانخراط — ${subscribers.length} بطاقة</h2>
  `;

  const pagesHTML: string[] = [];
  for (let i = 0; i < subscribers.length; i += cardsPerPage) {
    const chunk = subscribers.slice(i, i + cardsPerPage);
    const frontCards = chunk.map((s) => buildCardHTML(s, design, "front", origin, dims.cardWidthMM, dims.cardHeightMM)).join("");
    const backCards = chunk.map((s) => buildCardHTML(s, design, "back", origin, dims.cardWidthMM, dims.cardHeightMM)).join("");

    pagesHTML.push(`
      <h3 style="text-align:center;font-size:13px;color:#0f766e;margin:15px 0 8px;">الواجهة الأمامية (RECTO)</h3>
      <div style="text-align:center;">${frontCards}</div>
      <br clear="all" style="page-break-before:always;" />
      <h3 style="text-align:center;font-size:13px;color:#0f766e;margin:15px 0 8px;">الواجهة الخلفية (VERSO)</h3>
      <div style="text-align:center;">${backCards}</div>
    `);
  }

  return `<!DOCTYPE html><html dir="rtl" lang="ar" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>بطاقات الانخراط — AquaCore</title><style>@page{size:A4 portrait;margin:15mm;}body{font-family:'Cairo','Tahoma',Arial,sans-serif;font-size:12px;line-height:1.5;}</style></head><body>
    ${entete}
    ${pagesHTML.join('<br style="page-break-before:always;" />')}
  </body></html>`;
}

// ═══════════════════════════════════════════════════════════════
//  3) PNG — بطاقة واحدة عالية الدقة (تُستخدم مع html2canvas في الواجهة)
//     هنا نولّد HTML لبطاقة واحدة بحجم كبير لالتقاط لقطة عالية الجودة
// ═══════════════════════════════════════════════════════════════

export function generateSingleCardHTML(
  sub: any,
  design: PrintCardDesign,
  origin: string,
  side: "front" | "back" = "front",
  scale: number = 3 // دقة عالية للـ PNG
): string {
  // للـ PNG نستخدم أبعاد أكبر (CR80 حقيقي 85.6×54mm أو أبعاد التصميم)
  const cardWidthMM = design.config.width * 10 * scale;
  const cardHeightMM = design.config.height * 10 * scale;

  const cardHTML = buildCardHTML(sub, design, side, origin, cardWidthMM, cardHeightMM);

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>بطاقة — AquaCore</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:transparent;}</style></head><body>${cardHTML}</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
//  غلاف HTML للطباعة — CSS احترافي
// ═══════════════════════════════════════════════════════════════

function printHTMLWrapper(pagesHTML: string, title: string): string {
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${title}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  background: #fff;
  font-family: 'Cairo', 'Tajawal', 'Tahoma', Arial, sans-serif;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}
@page {
  size: A4 portrait;
  margin: ${PRINT_MARGIN_MM}mm;
}
.print-page {
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  page-break-after: always;
  padding: 0;
}
.print-page:last-child {
  page-break-after: auto;
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(4, 1fr);
  gap: ${CARD_GAP_MM}mm;
  width: 100%;
  max-width: ${AVAILABLE_W_MM}mm;
  aspect-ratio: ${AVAILABLE_W_MM} / ${AVAILABLE_H_MM};
}
.card-grid > * {
  width: 100%;
  height: 100%;
  break-inside: avoid;
}
@media screen {
  body { background: #f0f0f0; padding: 20px; }
  .print-page {
    background: #fff;
    margin: 0 auto 20px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    max-width: 210mm;
    min-height: 297mm;
  }
}
</style></head><body>${pagesHTML}</body></html>`;
}

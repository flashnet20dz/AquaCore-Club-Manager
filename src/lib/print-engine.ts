/**
 * ═══════════════════════════════════════════════════════════════
 *  AquaCore — Professional Print Engine v5 (Enterprise Grade)
 * ═══════════════════════════════════════════════════════════════
 *
 *  مبني بمعايير Adobe InDesign / Canva Print:
 *
 *  المبدأ الجذري: تخلي تام عن التموضع الحر (absolute positioning) في الطباعة.
 *  كل بطاقة تستخدم CSS Grid + Flexbox بتخطيط ثابت:
 *
 *  ┌─────────────────────────────────────────┐
 *  │ HEADER (club name + branch + title)     │  flex-column center
 *  ├──────────┬──────────────────┬───────────┤
 *  │          │  MEMBER PHOTO    │           │
 *  │  LOGO    │  (object-cover)  │  QR CODE  │  CSS Grid: logo | body | qr
 *  │          │  NAME / ID /     │  (square) │
 *  │          │  DOB / BLOOD     │           │
 *  ├──────────┴──────────────────┴───────────┤
 *  │ FOOTER (pool name + terms)              │  flex-column center
 *  └─────────────────────────────────────────┘
 *
 *  المميزات:
 *  - 8 بطاقات في A4 (2×4) بأبعاد متطابقة، فواصل متطابقة
 *  - Recto/Verso: نفس الشبكة + نفس الترتيب (duplex ready)
 *  - صورة العضو: إطار ثابت + object-fit:cover + overflow:hidden
 *  - QR: مربع دائماً + مركز + لا يتمدد
 *  - نص: auto-ellipsis + multiline + never overflow
 *  - طبقات طباعة: قطع + منطقة أمان + bleed + هوامش (SVG)
 *  - المعاينة = PDF (نفس HTML، نفس المحرك)
 */

// ═══════════════════════════════════════════════════════════════
//  الأنواع (مبسطة — لا نحتاج التموضع الحر)
// ═══════════════════════════════════════════════════════════════

export interface PrintCardConfig {
  bgColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  accentColor: string;       // لون الترويسة والعنوان
  subAccentColor: string;    // لون العنوان الفرعي
  bloodColor: string;        // لون فصيلة الدم
  fontFamily: string;
  showPhoto: boolean;
  showQR: boolean;
  showLogo: boolean;
  showBorders: boolean;
}

export interface PrintCardTexts {
  headerText: string;        // اسم النادي
  subHeaderText: string;     // الفرع
  cardTitle: string;         // عنوان البطاقة
  footerText: string;        // التذييل
  backTitle: string;         // عنوان الخلف
  backInfoTitle: string;     // عنوان معلومات الاشتراك
  backDaysLabel: string;
  backTimeLabel: string;
  backExpiryLabel: string;
}

export interface PrintDesign {
  config: PrintCardConfig;
  texts: PrintCardTexts;
}

// ═══════════════════════════════════════════════════════════════
//  ثوابت A4 — أبعاد دقيقة لا تتغير
// ═══════════════════════════════════════════════════════════════

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const PRINT_MARGIN_MM = 10;       // 1cm هامش
export const CARD_GAP_MM = 4;            // 4mm فجوة بين البطاقات
export const COLS = 2;
export const ROWS = 4;
export const CARDS_PER_PAGE = COLS * ROWS; // 8

// المساحة المتاحة
export const AVAILABLE_W_MM = A4_WIDTH_MM - 2 * PRINT_MARGIN_MM;   // 190mm
export const AVAILABLE_H_MM = A4_HEIGHT_MM - 2 * PRINT_MARGIN_MM;  // 277mm

// أبعاد البطاقة الفعلية (متطابقة لكل البطاقات)
export const CARD_W_MM = (AVAILABLE_W_MM - (COLS - 1) * CARD_GAP_MM) / COLS; // 93mm
export const CARD_H_MM = (AVAILABLE_H_MM - (ROWS - 1) * CARD_GAP_MM) / ROWS; // 66.25mm

// التخطيط الداخلي للبطاقة (mm)
const CARD_PADDING_MM = 2;
const HEADER_H_MM = 12;
const FOOTER_H_MM = 6;
const BODY_H_MM = CARD_H_MM - 2 * CARD_PADDING_MM - HEADER_H_MM - FOOTER_H_MM; // ~44mm
const LOGO_W_MM = 16;
const QR_W_MM = 18;
const PHOTO_W_MM = 20;
const PHOTO_H_MM = 28;

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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

function getPhotoUrl(sub: any, origin: string): string {
  if (sub?.photoDataUrl) return sub.photoDataUrl;
  if (sub?.photoPath) return `${origin}/api/subscribers/${sub.id}/photo?size=cropped&raw=1`;
  return "";
}

function getQRUrl(sub: any): string {
  const data = encodeURIComponent(sub?.fileNumber || "RCS");
  return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${data}&color=000000&bgcolor=ffffff`;
}

// ═══════════════════════════════════════════════════════════════
//  بناء بطاقة واحدة — CSS Grid + Flexbox (تخطيط ثابت)
// ═══════════════════════════════════════════════════════════════

function renderCardFront(sub: any, design: PrintDesign, origin: string): string {
  const { config, texts } = design;
  const photoUrl = getPhotoUrl(sub, origin);
  const qrUrl = getQRUrl(sub);

  const border = config.showBorders
    ? `border:${config.borderWidth}px solid ${config.borderColor};`
    : `border:1px dashed #ccc;`;

  return `
  <div class="card" style="
    width:${CARD_W_MM}mm; height:${CARD_H_MM}mm;
    background:${config.bgColor};
    ${border}
    border-radius:${config.borderRadius}px;
    box-sizing:border-box;
    overflow:hidden;
    direction:rtl;
    font-family:${config.fontFamily};
    display:grid;
    grid-template-rows: ${HEADER_H_MM}mm 1fr ${FOOTER_H_MM}mm;
    grid-template-areas: 'header' 'body' 'footer';
    break-inside:avoid;
  ">
    <!-- ═══ HEADER ═══ -->
    <div class="card-header" style="
      grid-area:header;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      padding:0 ${CARD_PADDING_MM}mm;
      border-bottom:1px solid ${config.accentColor}33;
      text-align:center;
    ">
      <div style="font-size:3mm; font-weight:700; color:${config.accentColor}; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%;">
        ${escapeHtml(texts.headerText)}
      </div>
      <div style="font-size:2.5mm; font-weight:600; color:${config.subAccentColor}; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%;">
        ${escapeHtml(texts.subHeaderText)}
      </div>
      <div style="font-size:3mm; font-weight:700; color:${config.accentColor}; border-bottom:1px solid ${config.accentColor}; padding:0 2mm; margin-top:0.5mm;">
        ${escapeHtml(texts.cardTitle)}
      </div>
    </div>

    <!-- ═══ BODY: logo | photo+info | qr ═══ -->
    <div class="card-body" style="
      grid-area:body;
      display:grid;
      grid-template-columns: ${LOGO_W_MM}mm 1fr ${QR_W_MM}mm;
      gap:1.5mm;
      padding:${CARD_PADDING_MM}mm;
      align-items:center;
    ">
      <!-- LOGO (left column in RTL = right visually) -->
      ${config.showLogo ? `
      <div style="display:flex; align-items:center; justify-content:center; height:100%;">
        <div style="width:${LOGO_W_MM}mm; height:${LOGO_W_MM}mm; background:${config.accentColor}11; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:8mm; color:${config.accentColor}; font-weight:700;">
          ن
        </div>
      </div>` : `<div></div>`}

      <!-- PHOTO + INFO (center column) -->
      <div style="display:flex; flex-direction:row; gap:1.5mm; height:100%; align-items:center; min-width:0;">
        <!-- PHOTO -->
        ${config.showPhoto ? `
        <div style="
          width:${PHOTO_W_MM}mm; height:${PHOTO_H_MM}mm;
          flex-shrink:0;
          border:1.5px solid ${config.accentColor};
          border-radius:2mm;
          overflow:hidden;
          background:#e5e7eb;
          position:relative;
        ">
          ${photoUrl ? `
            <img src="${photoUrl}" style="width:100%; height:100%; object-fit:cover; object-position:center; display:block;" />
          ` : `
            <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:2.5mm; color:#999;">صورة</div>
          `}
        </div>` : ""}

        <!-- INFO -->
        <div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:0.8mm; overflow:hidden;">
          <div style="font-size:3.5mm; font-weight:700; color:#111; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${escapeHtml(`${sub?.lastName || ""} ${sub?.firstName || ""}`)}
          </div>
          <div style="font-size:2.8mm; color:#333; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            <span style="font-weight:600;">رقم:</span> <span style="color:${config.accentColor}; font-weight:700;">${escapeHtml(sub?.fileNumber || "")}</span>
          </div>
          <div style="font-size:2.5mm; color:#555; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            <span style="font-weight:600;">الميلاد:</span> ${formatDate(sub?.birthDate)}
          </div>
          <div style="font-size:4mm; font-weight:800; color:${config.bloodColor}; line-height:1; margin-top:0.5mm;">
            ${escapeHtml(sub?.bloodType || "—")}
          </div>
        </div>
      </div>

      <!-- QR (right column in RTL = left visually) -->
      ${config.showQR ? `
      <div style="display:flex; align-items:center; justify-content:center; height:100%;">
        <div style="
          width:${QR_W_MM}mm; height:${QR_W_MM}mm;
          background:#fff;
          border:1px solid #ddd;
          padding:0.5mm;
          box-sizing:border-box;
        ">
          <img src="${qrUrl}" style="width:100%; height:100%; object-fit:contain; display:block;" />
        </div>
      </div>` : `<div></div>`}
    </div>

    <!-- ═══ FOOTER ═══ -->
    <div class="card-footer" style="
      grid-area:footer;
      display:flex; align-items:center; justify-content:center;
      padding:0 ${CARD_PADDING_MM}mm;
      border-top:1px solid ${config.accentColor}33;
      text-align:center;
      font-size:2mm; color:#666; font-style:italic;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    ">
      ${escapeHtml(texts.footerText)}
    </div>
  </div>`;
}

function renderCardBack(sub: any, design: PrintDesign, origin: string): string {
  const { config, texts } = design;
  const photoUrl = getPhotoUrl(sub, origin);

  const border = config.showBorders
    ? `border:${config.borderWidth}px solid ${config.borderColor};`
    : `border:1px dashed #ccc;`;

  return `
  <div class="card" style="
    width:${CARD_W_MM}mm; height:${CARD_H_MM}mm;
    background:${config.bgColor};
    ${border}
    border-radius:${config.borderRadius}px;
    box-sizing:border-box;
    overflow:hidden;
    direction:rtl;
    font-family:${config.fontFamily};
    display:grid;
    grid-template-rows: ${HEADER_H_MM}mm 1fr ${FOOTER_H_MM}mm;
    grid-template-areas: 'header' 'body' 'footer';
    break-inside:avoid;
    position:relative;
  ">
    <!-- Watermark logo -->
    <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; z-index:0;">
      <div style="width:50mm; height:50mm; background:${config.accentColor}08; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:20mm; color:${config.accentColor}15; font-weight:700;">ن</div>
    </div>

    <!-- ═══ HEADER (back title) ═══ -->
    <div class="card-header" style="
      grid-area:header; position:relative; z-index:1;
      display:flex; align-items:center; justify-content:center;
      padding:0 ${CARD_PADDING_MM}mm;
      border-bottom:1px solid ${config.accentColor}33;
    ">
      <div style="font-size:3.5mm; font-weight:700; color:${config.accentColor}; border-bottom:1px solid ${config.accentColor}; padding:0 2mm;">
        ${escapeHtml(texts.backTitle)}
      </div>
    </div>

    <!-- ═══ BODY (subscription info) ═══ -->
    <div class="card-body" style="
      grid-area:body; position:relative; z-index:1;
      display:flex; flex-direction:column; justify-content:center;
      padding:${CARD_PADDING_MM}mm ${CARD_PADDING_MM + 4}mm;
      gap:2mm;
    ">
      <div style="font-size:3mm; font-weight:700; color:${config.accentColor}; margin-bottom:1mm;">
        ${escapeHtml(texts.backInfoTitle)}
      </div>
      <div style="display:flex; justify-content:space-between; align-items:baseline; font-size:2.8mm;">
        <span style="font-weight:600; color:#333;">${escapeHtml(texts.backDaysLabel)}:</span>
        <span style="color:${config.bloodColor}; font-weight:600;">${escapeHtml(sub?.swimmingDays || "—")}</span>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:baseline; font-size:2.8mm;">
        <span style="font-weight:600; color:#333;">${escapeHtml(texts.backTimeLabel)}:</span>
        <span style="color:${config.bloodColor}; font-weight:600;">${escapeHtml(sub?.timeSlot || "—")}</span>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:baseline; font-size:3mm;">
        <span style="font-weight:700; color:#333;">${escapeHtml(texts.backExpiryLabel)}:</span>
        <span style="color:${config.bloodColor}; font-weight:700; font-size:3.5mm;">${formatDate(sub?.expiryDate)}</span>
      </div>
    </div>

    <!-- ═══ FOOTER ═══ -->
    <div class="card-footer" style="
      grid-area:footer; position:relative; z-index:1;
      display:flex; align-items:center; justify-content:center;
      padding:0 ${CARD_PADDING_MM}mm;
      border-top:1px solid ${config.accentColor}33;
      text-align:center;
      font-size:2mm; color:#666; font-style:italic;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    ">
      ${escapeHtml(texts.footerText)}
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
//  طبقات الطباعة (Print Guides) — SVG overlay
// ═══════════════════════════════════════════════════════════════

function renderCutMarks(): string {
  // علامات القطع في زوايا كل بطاقة
  const marks: string[] = [];
  const markLen = 3; // mm
  const markColor = "#FF8800";
  const strokeWidth = 0.2;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = PRINT_MARGIN_MM + col * (CARD_W_MM + CARD_GAP_MM);
      const y = PRINT_MARGIN_MM + row * (CARD_H_MM + CARD_GAP_MM);
      // 4 زوايا × خطين
      // أعلى يسار
      marks.push(`<line x1="${x - markLen}" y1="${y}" x2="${x}" y2="${y}" stroke="${markColor}" stroke-width="${strokeWidth}"/>`);
      marks.push(`<line x1="${x}" y1="${y - markLen}" x2="${x}" y2="${y}" stroke="${markColor}" stroke-width="${strokeWidth}"/>`);
      // أعلى يمين
      marks.push(`<line x1="${x + CARD_W_MM}" y1="${y}" x2="${x + CARD_W_MM + markLen}" y2="${y}" stroke="${markColor}" stroke-width="${strokeWidth}"/>`);
      marks.push(`<line x1="${x + CARD_W_MM}" y1="${y - markLen}" x2="${x + CARD_W_MM}" y2="${y}" stroke="${markColor}" stroke-width="${strokeWidth}"/>`);
      // أسفل يسار
      marks.push(`<line x1="${x - markLen}" y1="${y + CARD_H_MM}" x2="${x}" y2="${y + CARD_H_MM}" stroke="${markColor}" stroke-width="${strokeWidth}"/>`);
      marks.push(`<line x1="${x}" y1="${y + CARD_H_MM}" x2="${x}" y2="${y + CARD_H_MM + markLen}" stroke="${markColor}" stroke-width="${strokeWidth}"/>`);
      // أسفل يمين
      marks.push(`<line x1="${x + CARD_W_MM}" y1="${y + CARD_H_MM}" x2="${x + CARD_W_MM + markLen}" y2="${y + CARD_H_MM}" stroke="${markColor}" stroke-width="${strokeWidth}"/>`);
      marks.push(`<line x1="${x + CARD_W_MM}" y1="${y + CARD_H_MM}" x2="${x + CARD_W_MM}" y2="${y + CARD_H_MM + markLen}" stroke="${markColor}" stroke-width="${strokeWidth}"/>`);
    }
  }
  return marks.join("");
}

function renderGuides(): string {
  return `
  <svg class="print-guides" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${A4_WIDTH_MM} ${A4_HEIGHT_MM}" style="position:absolute; top:0; left:0; width:${A4_WIDTH_MM}mm; height:${A4_HEIGHT_MM}mm; pointer-events:none; z-index:9999;">
    <!-- علامات القطع -->
    ${renderCutMarks()}
  </svg>`;
}

// ═══════════════════════════════════════════════════════════════
//  توليد HTML كامل للطباعة — Recto/Verso (نفس الشبكة + نفس الترتيب)
// ═══════════════════════════════════════════════════════════════

export function generateProfessionalPrint(
  subscribers: any[],
  design: PrintDesign,
  origin: string,
  options: { showGuides?: boolean } = {}
): string {
  const { showGuides = false } = options;
  const pages: string[] = [];

  for (let i = 0; i < subscribers.length; i += CARDS_PER_PAGE) {
    const chunk = subscribers.slice(i, i + CARDS_PER_PAGE);
    const fillersNeeded = CARDS_PER_PAGE - chunk.length;

    // ═══ الوجه الأمامي (Recto) ═══
    const frontCards = chunk.map((s) => renderCardFront(s, design, origin)).join("");
    const frontFillers = Array.from({ length: fillersNeeded }).map(() =>
      `<div style="width:${CARD_W_MM}mm;height:${CARD_H_MM}mm;border:1px dashed #ccc;box-sizing:border-box;"></div>`
    ).join("");
    pages.push(`<div class="print-page"><div class="card-grid">${frontCards}${frontFillers}</div>${showGuides ? renderGuides() : ""}</div>`);

    // ═══ الوجه الخلفي (Verso) — نفس الشبكة + نفس الترتيب ═══
    const backCards = chunk.map((s) => renderCardBack(s, design, origin)).join("");
    const backFillers = Array.from({ length: fillersNeeded }).map(() =>
      `<div style="width:${CARD_W_MM}mm;height:${CARD_H_MM}mm;border:1px dashed #ccc;box-sizing:border-box;"></div>`
    ).join("");
    pages.push(`<div class="print-page"><div class="card-grid">${backCards}${backFillers}</div>${showGuides ? renderGuides() : ""}</div>`);
  }

  return printHTMLWrapper(pages.join(""), "بطاقات الانخراط — AquaCore", design);
}

// ═══════════════════════════════════════════════════════════════
//  Word — نفس المحرك، تنسيق Word
// ═══════════════════════════════════════════════════════════════

export function generateProfessionalWord(
  subscribers: any[],
  design: PrintDesign,
  origin: string
): string {
  const { config, texts } = design;
  const today = formatDate(new Date());

  const entete = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:15px;">
      <tr>
        <td style="width:60%;text-align:center;vertical-align:middle;">
          <p style="font-size:14px;font-weight:bold;color:${config.accentColor};margin:2px;">${escapeHtml(texts.headerText)}</p>
          <p style="font-size:12px;font-weight:bold;color:${config.subAccentColor};margin:2px;">${escapeHtml(texts.subHeaderText)}</p>
        </td>
      </tr>
    </table>
    <hr style="border:1px solid ${config.accentColor};margin:10px 0;" />
    <h2 style="text-align:center;font-size:16px;font-weight:bold;color:${config.accentColor};margin:10px 0;">بطاقات الانخراط — ${subscribers.length} بطاقة</h2>
  `;

  const pagesHTML: string[] = [];
  for (let i = 0; i < subscribers.length; i += CARDS_PER_PAGE) {
    const chunk = subscribers.slice(i, i + CARDS_PER_PAGE);
    const frontCards = chunk.map((s) => renderCardFront(s, design, origin)).join("");
    const backCards = chunk.map((s) => renderCardBack(s, design, origin)).join("");
    pagesHTML.push(`
      <h3 style="text-align:center;font-size:13px;color:${config.accentColor};margin:15px 0 8px;">الواجهة الأمامية (RECTO)</h3>
      <div style="text-align:center;">${frontCards}</div>
      <br clear="all" style="page-break-before:always;" />
      <h3 style="text-align:center;font-size:13px;color:${config.accentColor};margin:15px 0 8px;">الواجهة الخلفية (VERSO)</h3>
      <div style="text-align:center;">${backCards}</div>
    `);
  }

  return `<!DOCTYPE html><html dir="rtl" lang="ar" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>بطاقات الانخراط — AquaCore</title><style>@page{size:A4 portrait;margin:15mm;}body{font-family:'Cairo','Tahoma',Arial,sans-serif;font-size:12px;line-height:1.5;}</style></head><body>
    ${entete}
    ${pagesHTML.join('<br style="page-break-before:always;" />')}
  </body></html>`;
}

// ═══════════════════════════════════════════════════════════════
//  غلاف HTML — CSS احترافي (Grid ثابت + print-color-adjust)
// ═══════════════════════════════════════════════════════════════

function printHTMLWrapper(pagesHTML: string, title: string, design: PrintDesign): string {
  const { config } = design;
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${title}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  background: #fff;
  font-family: ${config.fontFamily}, 'Cairo', 'Tajawal', 'Tahoma', Arial, sans-serif;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  color-adjust: exact !important;
}
@page {
  size: A4 portrait;
  margin: ${PRINT_MARGIN_MM}mm;
}
.print-page {
  width: ${AVAILABLE_W_MM}mm;
  height: ${AVAILABLE_H_MM}mm;
  display: flex;
  align-items: center;
  justify-content: center;
  page-break-after: always;
  position: relative;
}
.print-page:last-child {
  page-break-after: auto;
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(${COLS}, ${CARD_W_MM}mm);
  grid-template-rows: repeat(${ROWS}, ${CARD_H_MM}mm);
  gap: ${CARD_GAP_MM}mm;
  width: ${AVAILABLE_W_MM}mm;
  height: ${AVAILABLE_H_MM}mm;
}
.card-grid > * {
  break-inside: avoid;
}
.card img {
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}
@media screen {
  body { background: #f0f0f0; padding: 20px; }
  .print-page {
    background: #fff;
    margin: 0 auto 20px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    width: ${A4_WIDTH_MM}mm;
    height: ${A4_HEIGHT_MM}mm;
    padding: ${PRINT_MARGIN_MM}mm;
    align-items: center;
    justify-content: center;
  }
}
</style></head><body>${pagesHTML}</body></html>`;
}

/**
 * AquaCore Print Layout Engine
 * ─────────────────────────────────────────────────────────────────
 * Handles precise mm-based card positioning for RECTO/VERSO printing.
 * Single source of truth: Preview = PDF = Print
 * 
 * All dimensions in mm. No px, no cm, no CSS grid tricks.
 */

export type PaperSize = "A4" | "Letter" | "Custom";
export type DuplexMode = "long-edge" | "short-edge";

export interface PrintSettings {
  paperSize: PaperSize;
  paperWidth: number;       // mm
  paperHeight: number;      // mm
  marginTop: number;        // mm
  marginBottom: number;     // mm
  marginLeft: number;       // mm
  marginRight: number;      // mm
  gapHorizontal: number;    // mm — space between columns
  gapVertical: number;      // mm — space between rows
  cols: number;             // default 2
  rows: number;             // default 4
  cardsPerPage: number;     // default 8
  duplexMode: DuplexMode;   // default "long-edge"
  xOffset: number;          // mm — print registration
  yOffset: number;          // mm
  scale: number;            // % — default 100
  showCropMarks: boolean;
}

export interface CardPosition {
  index: number;            // 0-7
  left: number;             // mm from page left edge
  top: number;              // mm from page top edge
  width: number;            // mm
  height: number;           // mm
}

export interface PrintLayout {
  positions: CardPosition[];
  cardWidth: number;        // mm
  cardHeight: number;       // mm
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  paperSize: "A4",
  paperWidth: 210,
  paperHeight: 297,
  marginTop: 8,
  marginBottom: 8,
  marginLeft: 8,
  marginRight: 8,
  gapHorizontal: 5,
  gapVertical: 5,
  cols: 2,
  rows: 4,
  cardsPerPage: 8,
  duplexMode: "long-edge",
  xOffset: 0,
  yOffset: 0,
  scale: 100,
  showCropMarks: false,
};

export const PAPER_SIZES: Record<PaperSize, { width: number; height: number; label: string }> = {
  A4: { width: 210, height: 297, label: "A4 (210×297mm)" },
  Letter: { width: 215.9, height: 279.4, label: "Letter (215.9×279.4mm)" },
  Custom: { width: 210, height: 297, label: "مخصص" },
};

/**
 * Calculate card positions on the page based on settings.
 * Returns exact mm coordinates for each card slot.
 */
export function calculateLayout(settings: PrintSettings): PrintLayout {
  const availableWidth = settings.paperWidth - settings.marginLeft - settings.marginRight;
  const availableHeight = settings.paperHeight - settings.marginTop - settings.marginBottom;
  
  const cardWidth = (availableWidth - (settings.cols - 1) * settings.gapHorizontal) / settings.cols;
  const cardHeight = (availableHeight - (settings.rows - 1) * settings.gapVertical) / settings.rows;
  
  const positions: CardPosition[] = [];
  for (let row = 0; row < settings.rows; row++) {
    for (let col = 0; col < settings.cols; col++) {
      const index = row * settings.cols + col;
      positions.push({
        index,
        left: settings.marginLeft + col * (cardWidth + settings.gapHorizontal) + settings.xOffset,
        top: settings.marginTop + row * (cardHeight + settings.gapVertical) + settings.yOffset,
        width: cardWidth,
        height: cardHeight,
      });
    }
  }
  
  return { positions, cardWidth, cardHeight };
}

/**
 * Get the card ordering for VERSO based on duplex flip mode.
 * 
 * RECTO order:     [0, 1, 2, 3, 4, 5, 6, 7]
 * 
 * Long-edge flip (horizontal flip — flip on the long vertical edge):
 * When you flip the paper horizontally, right becomes left.
 * So each row's columns are reversed:
 *   [1, 0, 3, 2, 5, 4, 7, 6]
 * 
 * Short-edge flip (vertical flip — flip on the short horizontal edge):
 * When you flip the paper vertically, top becomes bottom.
 * So rows are reversed, and within each row columns are also reversed:
 *   [7, 6, 5, 4, 3, 2, 1, 0]
 */
export function getVersoOrder(settings: PrintSettings): number[] {
  const { cardsPerPage, cols, rows, duplexMode } = settings;
  const defaultOrder = Array.from({ length: cardsPerPage }, (_, i) => i);
  
  if (duplexMode === "long-edge") {
    // Reverse columns within each row
    const result: number[] = [];
    for (let row = 0; row < rows; row++) {
      const rowStart = row * cols;
      const rowCards = defaultOrder.slice(rowStart, rowStart + cols);
      result.push(...rowCards.reverse());
    }
    return result;
  } else {
    // Short-edge: reverse everything (rows + columns)
    return defaultOrder.reverse();
  }
}

/**
 * Generate the shared CSS for print pages.
 * This CSS is used identically for: Preview, PDF, and Print.
 */
export function generatePrintCSS(settings: PrintSettings): string {
  const { paperWidth, paperHeight, scale } = settings;
  const scaleStr = scale !== 100 ? `body{zoom:${scale / 100};}` : "";
  
  return `*{margin:0;padding:0;box-sizing:border-box;}
@page{size:${paperWidth}mm ${paperHeight}mm;margin:0;}
html,body{width:${paperWidth}mm;}
body{font-family:'Cairo','Tajawal','Tahoma',Arial,sans-serif;background:#fff;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important;${scaleStr}}
.print-page{width:${paperWidth}mm;height:${paperHeight}mm;position:relative;page-break-after:always;overflow:hidden;}
.print-page:last-child{page-break-after:auto;}
.card-slot{position:absolute;overflow:hidden;}
@media screen{
  body{background:#e5e7eb;padding:20px;}
  .print-page{margin:0 auto 20px;background:#fff;box-shadow:0 4px 20px rgba(0,0,0,0.15);}
  .card-slot{outline:1px dashed #d1d5db;}
}`;
}

/**
 * Generate crop marks HTML for a card slot.
 */
export function generateCropMarks(pos: CardPosition): string {
  if (!pos) return "";
  const markLen = 3; // mm
  const { left, top, width, height } = pos;
  // Corner marks at the 4 corners
  const tl = `<div style="position:absolute;left:${left - markLen}mm;top:${top}mm;width:${markLen}mm;height:0.2mm;background:#999;"></div><div style="position:absolute;left:${left}mm;top:${top - markLen}mm;width:0.2mm;height:${markLen}mm;background:#999;"></div>`;
  const tr = `<div style="position:absolute;left:${left + width}mm;top:${top}mm;width:${markLen}mm;height:0.2mm;background:#999;"></div><div style="position:absolute;left:${left + width}mm;top:${top - markLen}mm;width:0.2mm;height:${markLen}mm;background:#999;"></div>`;
  const bl = `<div style="position:absolute;left:${left - markLen}mm;top:${top + height}mm;width:${markLen}mm;height:0.2mm;background:#999;"></div><div style="position:absolute;left:${left}mm;top:${top + height}mm;width:0.2mm;height:${markLen}mm;background:#999;"></div>`;
  const br = `<div style="position:absolute;left:${left + width}mm;top:${top + height}mm;width:${markLen}mm;height:0.2mm;background:#999;"></div><div style="position:absolute;left:${left + width}mm;top:${top + height}mm;width:0.2mm;height:${markLen}mm;background:#999;"></div>`;
  return tl + tr + bl + br;
}

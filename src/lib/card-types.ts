// ═══════════════════════════════════════════════════════════════
//  AquaCore — Shared Card Types (Single Source of Truth)
// ═══════════════════════════════════════════════════════════════
//  هذه الأنواع مشتركة بين: المصمم، المعاينة، الطباعة، التصدير.
//  لا توجد نسخ منفصلة — كل العمليات تقرأ من نفس CardDesign.

export type ElementType =
  | "customText" | "shape" | "logo" | "qr" | "photo" | "uploadedImage"
  | "fullName" | "memberId" | "bloodType" | "dateOfBirth" | "paymentDate"
  | "swimmingDays" | "swimmingTime" | "subscriptionType" | "expiryDate"
  | "clubName" | "cardTitle" | "barcode";

export type ShapeKind = "rectangle" | "circle" | "line";

export interface CardElement {
  id: string;
  type: ElementType;
  name: string;
  x: number; y: number; width: number; height: number; // cm
  rotation: number;
  opacity: number;
  zIndex: number;
  visible: boolean;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  textAlign?: string;
  color?: string;
  showLabel?: boolean;
  labelText?: string;
  bgColor?: string;
  bgOpacity?: number;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: string;
  borderRadius?: number;
  shapeKind?: ShapeKind;
  imageData?: string;
  locked?: boolean;
  shadow?: boolean;
}

export interface CardConfig {
  width: number; height: number;
  cols: number; rows: number; gap: number;
  offsetX: number; offsetY: number;
  bgColor: string;
  bgOpacity: number;
  bgImage?: string;
  bgImageOpacity?: number;
  borderColor: string;
  borderWidth: number;
  borderStyle: string;
  borderRadius: number;
  gradientEnabled?: boolean;
  gradientStart?: string;
  gradientEnd?: string;
  gradientDirection?: "horizontal" | "vertical" | "diagonal";
}

export interface CardDesign {
  front: CardElement[];
  back: CardElement[];
  config: CardConfig;
}

// ─── Constants shared across designer/preview/print ───────────────────
export const PRESET_COLORS = [
  "#000000","#ffffff","#0f766e","#0369a1","#dc2626","#ea580c","#ca8a04",
  "#16a34a","#0891b2","#7c3aed","#c026d3","#475569","#fbbf24","#34d399",
  "#60a5fa","#f472b6",
];

export const FONTS = ["Tahoma","Arial","Cairo","Tajawal","Times New Roman","Courier New","Verdana","Georgia","Trebuchet MS","Palatino"];

export const TEXT_TYPES: ElementType[] = [
  "customText","fullName","memberId","bloodType","dateOfBirth","paymentDate",
  "swimmingDays","swimmingTime","subscriptionType","expiryDate","clubName","cardTitle",
];

export const IMAGE_TYPES: ElementType[] = ["photo","uploadedImage","logo"];
export const CODE_TYPES: ElementType[] = ["qr","barcode"];

export const isTextType = (t: ElementType) => TEXT_TYPES.includes(t);
export const isImageType = (t: ElementType) => IMAGE_TYPES.includes(t);
export const isCodeType = (t: ElementType) => CODE_TYPES.includes(t);
export const isEditableText = (t: ElementType) => t === "customText" || t === "cardTitle" || t === "clubName";

// ─── Conversion helpers (shared) ──────────────────────────────────────
export const cmToPx = (cm: number) => cm * 37.8; // 1cm ≈ 37.8px @ 96dpi
export const alphaHex = (opacity: number) => Math.round(Math.max(0, Math.min(100, opacity)) * 2.55).toString(16).padStart(2, "0");

export function uid(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

export function escapeHtml(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── Element content resolver (shared) ────────────────────────────────
export function getContent(el: CardElement, sub: any): string {
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
    case "expiryDate": return formatDate(sub.expiryDate);
    default: return "";
  }
}

// ─── Member photo URL resolver (shared) ───────────────────────────────
export function getPhotoUrl(sub: any, origin?: string): string {
  if (sub?.photoDataUrl) return sub.photoDataUrl;
  if (sub?.photoPath) return `${origin || ""}/api/subscribers/${sub.id}/photo?size=cropped&raw=1`;
  return "";
}

export function getQRUrl(sub: any): string {
  const data = encodeURIComponent(sub?.fileNumber || "RCS");
  return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${data}&color=000000&bgcolor=ffffff`;
}

export function getBarcodeUrl(sub: any): string {
  const data = encodeURIComponent(sub?.fileNumber || "RCS");
  return `https://api.qrserver.com/v1/create-barcode/?data=${data}&type=code128`;
}

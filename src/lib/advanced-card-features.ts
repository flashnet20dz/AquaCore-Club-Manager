/**
 * ═══════════════════════════════════════════════════════════════
 *  AquaCore — Advanced Card Features
 * ═══════════════════════════════════════════════════════════════
 *
 *  ميزات متقدمة لبطاقات الانخراط:
 *  - قوالب احترافية (أكاديمي/شركي/رياضي/طبي/حكومي)
 *  - علامة مائية
 *  - توقيع رقمي
 *  - QR Code آمن
 *  - Barcode
 *  - تصدير دفعي (ZIP)
 *  - DPI قابل للتخصيص
 *  - التحقق من البيانات
 */

// ═══════════════════════════════════════════════════════════════
//  القوالب الاحترافية
// ═══════════════════════════════════════════════════════════════
export interface CardTemplate {
  id: string;
  name: string;
  category: "academic" | "corporate" | "sports" | "medical" | "government";
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    background: string;
  };
  config: {
    width: number;
    height: number;
    borderRadius: number;
    borderWidth: number;
    gradientEnabled: boolean;
  };
  elements: string[];
}

export const PROFESSIONAL_TEMPLATES: CardTemplate[] = [
  {
    id: "academic-1",
    name: "أكاديمي كلاسيكي",
    category: "academic",
    colors: { primary: "#1E3A8A", secondary: "#3B82F6", accent: "#FBBF24", text: "#FFFFFF", background: "#FFFFFF" },
    config: { width: 10, height: 6.5, borderRadius: 12, borderWidth: 3, gradientEnabled: true },
    elements: ["clubName", "cardTitle", "photo", "fullName", "memberId", "dateOfBirth", "subscriptionType", "qr"],
  },
  {
    id: "corporate-1",
    name: "شركي احترافي",
    category: "corporate",
    colors: { primary: "#1F2937", secondary: "#6366F1", accent: "#F97316", text: "#FFFFFF", background: "#F9FAFB" },
    config: { width: 10, height: 6.5, borderRadius: 8, borderWidth: 2, gradientEnabled: false },
    elements: ["clubName", "cardTitle", "photo", "fullName", "memberId", "subscriptionType", "qr"],
  },
  {
    id: "sports-1",
    name: "نادي رياضي",
    category: "sports",
    colors: { primary: "#0f766e", secondary: "#0369a1", accent: "#FCD34D", text: "#FFFFFF", background: "#FFFFFF" },
    config: { width: 10, height: 6.5, borderRadius: 16, borderWidth: 4, gradientEnabled: true },
    elements: ["clubName", "cardTitle", "photo", "fullName", "memberId", "bloodType", "dateOfBirth", "subscriptionType", "qr"],
  },
  {
    id: "medical-1",
    name: "طبي احترافي",
    category: "medical",
    colors: { primary: "#059669", secondary: "#10B981", accent: "#06B6D4", text: "#FFFFFF", background: "#F0FDF4" },
    config: { width: 10, height: 6.5, borderRadius: 10, borderWidth: 2, gradientEnabled: false },
    elements: ["clubName", "cardTitle", "photo", "fullName", "memberId", "bloodType", "qr"],
  },
  {
    id: "government-1",
    name: "حكومي رسمي",
    category: "government",
    colors: { primary: "#7C3AED", secondary: "#8B5CF6", accent: "#E9D5FF", text: "#FFFFFF", background: "#FFFFFF" },
    config: { width: 10, height: 6.5, borderRadius: 6, borderWidth: 3, gradientEnabled: false },
    elements: ["clubName", "cardTitle", "photo", "fullName", "memberId", "dateOfBirth", "qr"],
  },
];

// ═══════════════════════════════════════════════════════════════
//  إعدادات الأمان
// ═══════════════════════════════════════════════════════════════
export interface SecuritySettings {
  watermark: boolean;
  watermarkText: string;
  watermarkTransparency: number; // 0-1
  digitalSignature: boolean;
  authorizedBy: string;
  qrCode: boolean;
  qrData: "memberId" | "fullName" | "custom";
  qrCustomData?: string;
  barcode: boolean;
  barcodeFormat: "CODE128" | "EAN13" | "CODE39";
}

export const DEFAULT_SECURITY: SecuritySettings = {
  watermark: false,
  watermarkText: "نسخة للعرض فقط",
  watermarkTransparency: 0.15,
  digitalSignature: false,
  authorizedBy: "",
  qrCode: true,
  qrData: "memberId",
  barcode: false,
  barcodeFormat: "CODE128",
};

// ═══════════════════════════════════════════════════════════════
//  إعدادات التصدير
// ═══════════════════════════════════════════════════════════════
export interface ExportSettings {
  format: "pdf" | "png" | "jpg" | "svg" | "zip";
  quality: "standard" | "high" | "very_high";
  dpi: number; // 300, 600, 1200
  includeMetadata: boolean;
  numbering: boolean;
  startNumber: number;
  batchMode: boolean;
}

export const DEFAULT_EXPORT: ExportSettings = {
  format: "pdf",
  quality: "high",
  dpi: 300,
  includeMetadata: true,
  numbering: false,
  startNumber: 1,
  batchMode: false,
};

// ═══════════════════════════════════════════════════════════════
//  التحقق من البيانات
// ═══════════════════════════════════════════════════════════════
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateCardData(data: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data.lastName || !data.firstName) {
    errors.push("الاسم واللقب مطلوبان");
  }
  if (!data.fileNumber) {
    errors.push("رقم الملف مطلوب");
  }
  if (!data.birthDate) {
    warnings.push("تاريخ الميلاد غير موجود");
  }
  if (!data.subscriptionType) {
    warnings.push("نوع الاشتراك غير محدد");
  }
  if (data.phone && !/^[\d\s+\-()]{8,}$/.test(data.phone)) {
    warnings.push("رقم الهاتف غير صالح");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ═══════════════════════════════════════════════════════════════
//  توليد QR Code آمن
// ═══════════════════════════════════════════════════════════════
export function generateSecureQRData(sub: any, security: SecuritySettings): string {
  if (security.qrData === "custom" && security.qrCustomData) {
    return security.qrCustomData;
  }
  return JSON.stringify({
    id: sub.fileNumber || sub.id,
    name: `${sub.lastName} ${sub.firstName}`,
    type: sub.subscriptionType,
    validatedAt: new Date().toISOString(),
  });
}

// ═══════════════════════════════════════════════════════════════
//  إحصائيات
// ═══════════════════════════════════════════════════════════════
export interface CardStats {
  totalCards: number;
  expiringCards: number;
  expiredCards: number;
  activeCards: number;
  lastUpdated: string;
}

export function getCardStatistics(subscribers: any[]): CardStats {
  const now = new Date();
  const expiringCards = subscribers.filter((s) => {
    if (!s.expiryDate) return false;
    const exp = new Date(s.expiryDate);
    const days = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return days > 0 && days <= 7;
  }).length;
  const expiredCards = subscribers.filter((s) => {
    if (!s.expiryDate) return false;
    return new Date(s.expiryDate) < now;
  }).length;

  return {
    totalCards: subscribers.length,
    expiringCards,
    expiredCards,
    activeCards: subscribers.length - expiredCards,
    lastUpdated: now.toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════
//  تطبيق قالب على تصميم
// ═══════════════════════════════════════════════════════════════
export function applyTemplateToDesign(template: CardTemplate, design: any): any {
  return {
    ...design,
    config: {
      ...design.config,
      width: template.config.width,
      height: template.config.height,
      borderRadius: template.config.borderRadius,
      borderWidth: template.config.borderWidth,
      bgColor: template.colors.background,
      borderColor: template.colors.primary,
      gradientEnabled: template.config.gradientEnabled,
      gradientStart: template.colors.primary,
      gradientEnd: template.colors.secondary,
    },
    front: design.front.map((el: any) => {
      if (el.type === "clubName" || el.type === "cardTitle") {
        return { ...el, color: template.colors.text };
      }
      if (el.type === "fullName") {
        return { ...el, color: template.colors.primary };
      }
      if (el.type === "memberId" || el.type === "dateOfBirth") {
        return { ...el, color: template.colors.secondary };
      }
      if (el.type === "bloodType") {
        return { ...el, color: template.colors.accent };
      }
      return el;
    }),
  };
}

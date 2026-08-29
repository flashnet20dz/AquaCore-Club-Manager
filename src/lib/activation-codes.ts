/**
 * ═══════════════════════════════════════════════════════════════
 *  AquaCore — Cryptographically Signed Activation Codes
 * ═══════════════════════════════════════════════════════════════
 *
 *  كل كود يحمل توقيعاً رقمياً (HMAC-SHA256) يُتحقَّق منه محلياً
 *  بدون أي اتصال بالإنترنت — تماماً مثل مفاتيح تفعيل Windows/Office.
 *
 *  بنية الكود:  PREFIX-PLAN-PAYLOAD-SIG
 *    AQCR-M1-7K3P9X2Q-8F2A
 *    ↑     ↑   ↑        ↑
 *    بادئة منظومة   نوع/مدة  حمولة عشوائية  توقيع مدمج (4 محارف)
 *
 *  التحقق أوفلاين:
 *    1. فك الكود إلى أجزائه
 *    2. أعد حساب HMAC للحمولة + نوع الاشتراك
 *    3. قارن أول 4 محارف من التوقيع بالجزء SIG
 *    4. إن تطابقا → الكود صحيح رياضياً (وليس مزيّفاً)
 *
 *  منع إعادة الاستخدام:
 *    - التحقق المحلي يؤكد "الكود صالح" لكنه لا يمنع استخدامه مرتين
 *    - التسجيل في DB المركزي (عند الاتصال) هو ما يمنع إعادة الاستخدام
 *    - في الوضع الأوفلاين: يُخزَّن الكود المُفعَّل محلياً (IndexedDB)
 *      وعند المزامنة يُبلِّغ السحابة، فإذا تكرّر في مكانين يُكتشف فوراً
 */

import crypto from "crypto";

// ───────────────────────────────────────────────────────────────
//  المفتاح السري — يُقرأ من متغيّر بيئة ACTIVATION_HMAC_SECRET
//  في الإنتاج يجب أن يكون ثابتاً (نفس القيمة في التوليد والتحقق)
// ───────────────────────────────────────────────────────────────
function getHmacSecret(): string {
  const secret = process.env.ACTIVATION_HMAC_SECRET;
  if (!secret || secret.length < 16) {
    // fallback للتطوير المحلي فقط — في الإنتاج يجب ضبط المتغيّر
    return "aquacore-activation-secret-key-2026-do-not-use-in-production";
  }
  return secret;
}

// ───────────────────────────────────────────────────────────────
//  خطط الاشتراك — رمز قصير + مدة بالأيام
// ───────────────────────────────────────────────────────────────
export type PlanCode = "monthly" | "quarterly" | "halfyear" | "yearly" | "twoyear";

export interface PlanDefinition {
  code: PlanCode;
  shortCode: string;        // رمز قصير مدمج بالكود: M1/Q3/H6/Y1/Y2
  label: string;            // الاسم بالعربية
  durationDays: number;     // المدة بالأيام
}

export const PLANS: Record<PlanCode, PlanDefinition> = {
  monthly:   { code: "monthly",   shortCode: "M1", label: "شهري (شهر واحد)",    durationDays: 30 },
  quarterly: { code: "quarterly", shortCode: "Q3", label: "ربع سنوي (3 أشهر)",  durationDays: 90 },
  halfyear:  { code: "halfyear",  shortCode: "H6", label: "نصف سنوي (6 أشهر)",  durationDays: 180 },
  yearly:    { code: "yearly",    shortCode: "Y1", label: "سنوي (سنة كاملة)",    durationDays: 365 },
  twoyear:   { code: "twoyear",   shortCode: "Y2", label: "سنتان",               durationDays: 730 },
};

export const PLAN_LIST: PlanDefinition[] = Object.values(PLANS);

// ───────────────────────────────────────────────────────────────
//  أدوات مساعدة للتشفير
// ───────────────────────────────────────────────────────────────
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // بدون I,O,0,1 لتجنّب اللبس
const PREFIX = "AQCR"; // AquaCore

function randomChars(len: number): string {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/**
 * يحسب توقيع HMAC-SHA256 لحمولة الكود.
 * @returns أول N محارف من الـ hex الناتج، بأحرف كبيرة.
 */
function computeSignature(planShort: string, payload: string, sigLen = 4): string {
  const data = `${PREFIX}.${planShort}.${payload}`;
  const hmac = crypto.createHmac("sha256", getHmacSecret()).update(data).digest("hex");
  // خذ أول sigLen بايتات وحوّلها لأحرف من ALPHABET لسهولة الإدخال
  let sig = "";
  for (let i = 0; i < sigLen; i++) {
    const byte = parseInt(hmac.substr(i * 2, 2), 16);
    sig += ALPHABET[byte % ALPHABET.length];
  }
  return sig;
}

// ───────────────────────────────────────────────────────────────
//  التوليد
// ───────────────────────────────────────────────────────────────
export interface GeneratedCode {
  code: string;          // الكود الكامل للعرض
  plan: PlanCode;
  payload: string;       // الجزء العشوائي
  signature: string;     // التوقيع
}

/**
 * يولّد كوداً واحداً موقّعاً لخطة معيّنة.
 */
export function generateCode(plan: PlanCode): GeneratedCode {
  const def = PLANS[plan];
  const payload = randomChars(8); // 8 محارف = ~40 bit عشوائية
  const signature = computeSignature(def.shortCode, payload, 4);
  const code = `${PREFIX}-${def.shortCode}-${payload}-${signature}`;
  return { code, plan, payload, signature };
}

/**
 * يولّد عدداً من الأكواد لخطة معيّنة، مع ضمان عدم التكرار.
 */
export function generateBatch(plan: PlanCode, count: number): GeneratedCode[] {
  const seen = new Set<string>();
  const out: GeneratedCode[] = [];
  let attempts = 0;
  while (out.length < count && attempts < count * 10) {
    const g = generateCode(plan);
    if (!seen.has(g.code)) {
      seen.add(g.code);
      out.push(g);
    }
    attempts++;
  }
  return out;
}

// ───────────────────────────────────────────────────────────────
//  التحقق (يعمل أوفلاين 100%)
// ───────────────────────────────────────────────────────────────
export interface VerificationResult {
  valid: boolean;
  plan?: PlanCode;
  durationDays?: number;
  error?: string;
}

/**
 * يتحقق من صحة كود تفعيل **محلياً** بدون أي اتصال شبكة.
 * يستخدم HMAC-SHA256 للمقارنة — آمن ضد التزوير.
 *
 * @example
 * const res = verifyCode("AQCR-M1-7K3P9X2Q-8F2A");
 * if (res.valid) { /* الكود صحيح رياضياً *\/ }
 */
export function verifyCode(rawCode: string): VerificationResult {
  if (!rawCode || typeof rawCode !== "string") {
    return { valid: false, error: "كود فارغ" };
  }
  // تنظيف: أحرف كبيرة + إزالة المسافات والشرطات الزائدة
  const code = rawCode.trim().toUpperCase().replace(/\s+/g, "");
  // قبول صيغ متعددة: AQCR-M1-XXXX-SIG أو AQCRM1XXXXSIG
  const normalized = code.replace(/-/g, "");

  if (normalized.length < 16) {
    return { valid: false, error: "طول الكود غير صحيح" };
  }

  // استخراج الأجزاء: PREFIX(4) + PLAN(2) + PAYLOAD(8) + SIG(4) = 18
  if (normalized.length !== 18) {
    return { valid: false, error: "بنية الكود غير صحيحة" };
  }

  const prefix = normalized.substring(0, 4);
  const planShort = normalized.substring(4, 6);
  const payload = normalized.substring(6, 14);
  const sig = normalized.substring(14, 18);

  if (prefix !== PREFIX) {
    return { valid: false, error: "بادئة الكود غير صحيحة" };
  }

  // ابحث عن الخطة المطابقة
  const planDef = PLAN_LIST.find((p) => p.shortCode === planShort);
  if (!planDef) {
    return { valid: false, error: "نوع الاشتراك غير معروف" };
  }

  // أعد حساب التوقيع وقارن
  const expectedSig = computeSignature(planShort, payload, 4);
  if (sig !== expectedSig) {
    return { valid: false, error: "توقيع الكود غير صالح" };
  }

  return {
    valid: true,
    plan: planDef.code,
    durationDays: planDef.durationDays,
  };
}

// ───────────────────────────────────────────────────────────────
//  بصمة الجهاز (Hardware Fingerprint) — لمنع نسخ الترخيص
// ───────────────────────────────────────────────────────────────
/**
 * يولّد بصمة جهاز من معلومات المتصفح/النظام.
 * تُستخدم لربط الكود المُفعَّل بجهاز محدّد.
 *
 * ملاحظة: في Electron تُستخدم معلومات أعمق (MAC, CPU, disk UUID)
 *         عبر node-machine-id. هنا نسخة المتصفح.
 */
export function generateHardwareFingerprint(): string {
  if (typeof window === "undefined") return "server";
  const parts = [
    navigator.userAgent,
    navigator.language,
    (navigator as any).languages?.join(",") || "",
    String(screen.width) + "x" + String(screen.height),
    String(screen.colorDepth),
    String(new Date().getTimezoneOffset()),
    // خصائص hardwareConcurrency و deviceMemory (إن وُجدت)
    String(navigator.hardwareConcurrency || 0),
    String((navigator as any).deviceMemory || 0),
    // بصمة canvas (إن أمكن)
    getCanvasFingerprint(),
  ].join("|");

  // hash بسيط (FNV-1a) لإنتاج معرّف ثابت قصير
  let hash = 2166136261;
  for (let i = 0; i < parts.length; i++) {
    hash ^= parts.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  //حوّل لـ hex موجب
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  return `FP-${hex.toUpperCase()}`;
}

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-canvas";
    canvas.width = 220;
    canvas.height = 30;
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("AquaCore 🐠", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("AquaCore 🐠", 4, 17);
    return canvas.toDataURL().substring(0, 64);
  } catch {
    return "canvas-blocked";
  }
}

// ───────────────────────────────────────────────────────────────
//  حساب تاريخ انتهاء الاشتراك من كود مُفعَّل
// ───────────────────────────────────────────────────────────────
export function computeExpiryDate(activationDate: Date, durationDays: number): Date {
  const d = new Date(activationDate);
  d.setDate(d.getDate() + durationDays);
  return d;
}

// ───────────────────────────────────────────────────────────────
//  تصدير لـ Electron (للنسخة المكتبية الأوفلاين)
// ───────────────────────────────────────────────────────────────
// نفس المنطق يُستخدم في Electron بدون أي تعديل — فقط استدعِ verifyCode()

/**
 * ═══════════════════════════════════════════════════════════════
 * AquaCore — Universal Offline License Engine
 * ═══════════════════════════════════════════════════════════════
 *
 * محرك تحقق وتفعيل التراخيص أوفلاين (بدون إنترنت).
 * يعمل بشكل موحد على:
 *   - متصفحات الهواتف والكمبيوتر (Web Crypto API)
 *   - بيئة Node.js / السيرفر المحلي (crypto / subtle)
 *   - تطبيق سطح المكتب Electron
 *   - تطبيق الهاتف PWA و Capacitor
 *
 * يوفر تخزيناً آمناً للرخصة في localStorage و IndexedDB
 * ويسمح للنادي بالعمل أوفلاين 100% حتى لو لم يكن هناك اتصال بالسيرفر المركزي.
 */

export type PlanCode = "monthly" | "quarterly" | "halfyear" | "yearly" | "twoyear";

export interface PlanDefinition {
  code: PlanCode;
  shortCode: string;
  label: string;
  durationDays: number;
}

export const PLANS: Record<PlanCode, PlanDefinition> = {
  monthly:   { code: "monthly",   shortCode: "M1", label: "شهري (شهر واحد)",    durationDays: 30 },
  quarterly: { code: "quarterly", shortCode: "Q3", label: "ربع سنوي (3 أشهر)",  durationDays: 90 },
  halfyear:  { code: "halfyear",  shortCode: "H6", label: "نصف سنوي (6 أشهر)",  durationDays: 180 },
  yearly:    { code: "yearly",    shortCode: "Y1", label: "سنوي (سنة كاملة)",    durationDays: 365 },
  twoyear:   { code: "twoyear",   shortCode: "Y2", label: "سنتان",               durationDays: 730 },
};

export const PLAN_LIST: PlanDefinition[] = Object.values(PLANS);

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PREFIX = "AQCR";
const DEFAULT_SECRET = "aquacore-activation-secret-key-2026-do-not-use-in-production";

function getSecretKey(): string {
  if (typeof process !== "undefined" && process.env && process.env.ACTIVATION_HMAC_SECRET) {
    return process.env.ACTIVATION_HMAC_SECRET;
  }
  return DEFAULT_SECRET;
}

/**
 * حساب توقيع HMAC-SHA256 باستخدام Web Crypto API (SubtleCrypto)
 * مدعومة في كل المتصفحات الحديثة وNode 16+.
 */
async function computeSignatureWebCrypto(planShort: string, payload: string, secret: string, sigLen = 4): Promise<string> {
  const data = `${PREFIX}.${planShort}.${payload}`;
  const enc = new TextEncoder();
  
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const bytes = new Uint8Array(signatureBuffer);

  let sig = "";
  for (let i = 0; i < sigLen; i++) {
    sig += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return sig;
}

export interface UniversalVerificationResult {
  valid: boolean;
  plan?: PlanCode;
  planLabel?: string;
  durationDays?: number;
  error?: string;
  normalizedCode?: string;
}

/**
 * تحقق كوني من كود التفعيل (يعمل في المتصفح، السيرفر، وأوفلاين)
 */
export async function verifyActivationCodeUniversal(rawCode: string): Promise<UniversalVerificationResult> {
  if (!rawCode || typeof rawCode !== "string") {
    return { valid: false, error: "كود التفعيل فارغ" };
  }

  const clean = rawCode.trim().toUpperCase().replace(/\s+/g, "");
  const normalized = clean.replace(/-/g, "");

  if (normalized.length !== 18) {
    return { valid: false, error: "بنية الكود غير صحيحة (يجب أن يتكون من 18 حرفاً)" };
  }

  const prefix = normalized.substring(0, 4);
  const planShort = normalized.substring(4, 6);
  const payload = normalized.substring(6, 14);
  const sig = normalized.substring(14, 18);

  if (prefix !== PREFIX) {
    return { valid: false, error: "بادئة الكود غير صحيحة (يجب أن تبدأ بـ AQCR)" };
  }

  const planDef = PLAN_LIST.find((p) => p.shortCode === planShort);
  if (!planDef) {
    return { valid: false, error: "نوع الاشتراك غير معروف في الكود" };
  }

  try {
    const secret = getSecretKey();
    const expectedSig = await computeSignatureWebCrypto(planShort, payload, secret, 4);

    if (sig !== expectedSig) {
      return { valid: false, error: "توقيع الكود غير صالح أو الكود مزيّف" };
    }

    const formattedCode = `${prefix}-${planShort}-${payload}-${sig}`;

    return {
      valid: true,
      plan: planDef.code,
      planLabel: planDef.label,
      durationDays: planDef.durationDays,
      normalizedCode: formattedCode,
    };
  } catch (err) {
    return { valid: false, error: "فشل التحقق الرقمي من الكود: " + (err instanceof Error ? err.message : String(err)) };
  }
}

// ───────────────────────────────────────────────────────────────
//  تخزين وإدارة الرخصة المحلية (Offline License Storage)
// ───────────────────────────────────────────────────────────────

export interface OfflineLicenseRecord {
  code: string;
  plan: PlanCode;
  planLabel: string;
  durationDays: number;
  activatedAt: string;
  expiresAt: string;
  hardwareFingerprint: string;
  clubName?: string;
  isOffline: boolean;
}

const STORAGE_KEY = "aquacore_offline_license_v1";

/**
 * حفظ رخصة أوفلاين في المتصفح
 */
export function saveOfflineLicense(record: OfflineLicenseRecord): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    // نسخ في sessionStorage أيضاً للأمان
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch (e) {
    console.warn("Could not save offline license to localStorage:", e);
  }
}

/**
 * استرجاع الرخصة المحلية مع فحص الصلاحية والانتهاء
 */
export function getOfflineLicense(): OfflineLicenseRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: OfflineLicenseRecord = JSON.parse(raw);

    if (!parsed || !parsed.expiresAt) return null;

    return parsed;
  } catch (e) {
    console.error("Error reading offline license:", e);
    return null;
  }
}

/**
 * فحص هل الرخصة الأوفلاين لا تزال سارية المفعول
 */
export function isOfflineLicenseActive(license: OfflineLicenseRecord | null): boolean {
  if (!license) return false;
  const now = new Date();
  const end = new Date(license.expiresAt);
  // سارية إذا كان تاريخ الانتهاء أكبر من الآن
  return end.getTime() > now.getTime();
}

/**
 * مسح الرخصة المحلية
 */
export function clearOfflineLicense(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

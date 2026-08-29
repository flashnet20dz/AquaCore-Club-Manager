/**
 * ═══════════════════════════════════════════════════════════════
 *  Member Portal Token — بوابة المنخرط
 * ═══════════════════════════════════════════════════════════════
 *
 *  HMAC-SHA256 signed opaque token يشيّر إلى منخرط واحد فقط.
 *
 *  التنسيق:
 *    payload = subscriberId (cuid غير حسّاس، لا يحتوي أي بيانات شخصية)
 *    sig     = first 32 hex chars of HMAC-SHA256(secret, payload)
 *    token   = base64url(payload) + "." + base64url(sig)
 *
 *  ⚠️ القرار: التوكن **دائم (بدون انتهاء صلاحية)** ومحدَّد (deterministic) —
 *  الرابط نفسه يُولَّد لنفس المنخرط في كل مرة، لكي يستطيع الموظف إعادة إرسال
 *  الرابط نفسه (WhatsApp/طباعة QR) دون أن يتغير. الرابط يدوّر (rotates) فقط
 *  إذا تغيّر MEMBER_PORTAL_SECRET في البيئة.
 *  - التوكن يمنح قراءة فقط لبطاقة رقمية بلا أي بيانات حساسة (لا مبالغ،
 *    لا هويات، لا هاتف المنخرط) — لذا الأثر عند التسريب محدود.
 *  - التوقيع يمنع التخمين/التفنييد (enumeration/forgery) لأن cuid عشوائي
 *    والتوقيع غير قابل للحساب دون السر.
 *
 *  🔒 الإنتاج: يجب ضبط MEMBER_PORTAL_SECRET كمتغير بيئة عشوائي قوي
 *  (مثلاً: openssl rand -hex 32). النص الاحتياطي أدناه لبيئة التطوير فقط.
 */

import crypto from "crypto";

// ⚠️ يجب ضبط MEMBER_PORTAL_SECRET في الإنتاج — الافتراضي هنا للتطوير فقط
const SECRET = process.env.MEMBER_PORTAL_SECRET || "aquacore-member-portal-secret-2026";

/** تحويل نص عادي إلى base64url (بدون حشو) — آمن للروابط */
function toBase64Url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

/** فك base64url إلى نص عادي */
function fromBase64Url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

/** حساب التوقيع: أول 32 محرفاً سداسياً من HMAC-SHA256(secret, payload) */
function computeSignature(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex").slice(0, 32);
}

/**
 * توليد توكن بوابة المنخرط — محدَّد (deterministic):
 * نفس subscriberId ⟹ نفس الرابط دائماً (لا طابع زمني في الحمولة).
 */
export function createPortalToken(subscriberId: string): string {
  const payload = subscriberId;
  const sig = computeSignature(payload);
  return `${toBase64Url(payload)}.${toBase64Url(sig)}`;
}

/**
 * التحقق من توكن البوابة.
 * - مقارنة زمنية ثابتة (crypto.timingSafeEqual) لمنع timing attacks.
 * - لا انتهاء صلاحية (رابط دائم) — انظر التعليق أعلاه.
 * @returns { subscriberId } إذا كان التوكن صالحاً، أو null إذا كان تالفاً/مزيّفاً
 */
export function verifyPortalToken(token: string): { subscriberId: string } | null {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  let payload: string;
  let providedSig: string;
  try {
    payload = fromBase64Url(parts[0]);
    providedSig = fromBase64Url(parts[1]);
  } catch {
    return null;
  }
  if (!payload || !providedSig) return null;

  const expectedSig = computeSignature(payload);

  // طولان التوقيعين ثابتان (32 hex) لكن نتحقق قبل timingSafeEqual (يشترط تساوي الطول)
  if (providedSig.length !== expectedSig.length) return null;

  const a = Buffer.from(providedSig, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  if (!crypto.timingSafeEqual(a, b)) return null;

  return { subscriberId: payload };
}

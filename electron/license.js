// ═══════════════════════════════════════════════════════════
// AquaCore — نظام التفعيل الأوفلاين لـ Electron
// نفس منطق src/lib/activation-codes.ts + src/lib/subscription-state.ts
// بالضبط (يجب أن يبقى مطابقاً 100% حتى تعمل نفس الأكواد بكل مكان)
// ═══════════════════════════════════════════════════════════

const crypto = require("crypto");
const os = require("os");

function getHmacSecret() {
    const secret = process.env.ACTIVATION_HMAC_SECRET;
    if (!secret || secret.length < 16) {
        return "aquacore-activation-secret-key-2026-do-not-use-in-production";
    }
    return secret;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PREFIX = "AQCR";

const PLANS = {
    monthly:   { shortCode: "M1", label: "شهري (شهر واحد)",   durationDays: 30 },
    quarterly: { shortCode: "Q3", label: "ربع سنوي (3 أشهر)", durationDays: 90 },
    halfyear:  { shortCode: "H6", label: "نصف سنوي (6 أشهر)", durationDays: 180 },
    yearly:    { shortCode: "Y1", label: "سنوي (سنة كاملة)",  durationDays: 365 },
    twoyear:   { shortCode: "Y2", label: "سنتان",              durationDays: 730 },
};
const PLAN_LIST = Object.entries(PLANS).map(([code, def]) => ({ code, ...def }));

function computeSignature(planShort, payload, sigLen = 4) {
    const data = `${PREFIX}.${planShort}.${payload}`;
    const hmac = crypto.createHmac("sha256", getHmacSecret()).update(data).digest("hex");
    let sig = "";
    for (let i = 0; i < sigLen; i++) {
        const byte = parseInt(hmac.substr(i * 2, 2), 16);
        sig += ALPHABET[byte % ALPHABET.length];
    }
    return sig;
}

/** يتحقق من كود تفعيل محلياً بالكامل — بدون إنترنت. نفس verifyCode() بالضبط. */
function verifyCode(rawCode) {
    if (!rawCode || typeof rawCode !== "string") return { valid: false, error: "كود فارغ" };
    const code = rawCode.trim().toUpperCase().replace(/\s+/g, "");
    const normalized = code.replace(/-/g, "");
    if (normalized.length !== 18) return { valid: false, error: "بنية الكود غير صحيحة" };

    const prefix = normalized.substring(0, 4);
    const planShort = normalized.substring(4, 6);
    const payload = normalized.substring(6, 14);
    const sig = normalized.substring(14, 18);

    if (prefix !== PREFIX) return { valid: false, error: "بادئة الكود غير صحيحة" };

    const planDef = PLAN_LIST.find((p) => p.shortCode === planShort);
    if (!planDef) return { valid: false, error: "نوع الاشتراك غير معروف" };

    const expectedSig = computeSignature(planShort, payload, 4);
    if (sig !== expectedSig) return { valid: false, error: "توقيع الكود غير صالح" };

    return { valid: true, plan: planDef.code, durationDays: planDef.durationDays, planLabel: planDef.label };
}

/**
 * بصمة جهاز لـ Electron (أعمق من نسخة المتصفح — تستخدم معلومات نظام حقيقية).
 * بادئة "FP-" موحّدة مع نسخة الويب لتمييزها.
 */
function generateHardwareFingerprint() {
    const cpus = os.cpus();
    const parts = [
        os.hostname(), os.platform(), os.arch(),
        cpus?.[0]?.model || "", cpus?.length || 0,
        os.totalmem(), os.userInfo().username,
    ].join("|");
    const hash = crypto.createHash("sha256").update(parts).digest("hex").slice(0, 8).toUpperCase();
    return `FP-${hash}`;
}

const TRIAL_DAYS = 7;
const GRACE_DAYS = 1; // ★ 24 ساعة (نفس قيمة الويب)

/** نفس computeSubscriptionStatus() لكن من بيانات محلية (desktop-settings). */
function computeLocalSubscriptionStatus(local) {
    const now = new Date();

    if (local.subscriptionEndDate) {
        const endDate = new Date(local.subscriptionEndDate);
        if (endDate > now) {
            return { state: "active", hasAccess: true, endDate };
        }
        const graceEnd = local.graceEndDate ? new Date(local.graceEndDate) : new Date(endDate.getTime() + GRACE_DAYS * 86400000);
        if (graceEnd > now) {
            return { state: "grace", hasAccess: true, endDate: graceEnd };
        }
        return { state: "locked", hasAccess: false, endDate: graceEnd };
    }

    if (local.trialStartedAt && local.trialEndDate) {
        const trialEnd = new Date(local.trialEndDate);
        if (trialEnd > now) {
            return { state: "trial", hasAccess: true, endDate: trialEnd };
        }
        return { state: "locked", hasAccess: false, endDate: trialEnd };
    }

    return { state: "locked", hasAccess: false, endDate: null };
}

module.exports = {
    verifyCode, generateHardwareFingerprint, computeLocalSubscriptionStatus,
    TRIAL_DAYS, GRACE_DAYS, PLANS,
};

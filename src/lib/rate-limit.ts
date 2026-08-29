/**
 * ═══════════════════════════════════════════════════════════════
 *  Rate Limiter — حماية ضد brute force و DoS
 * ═══════════════════════════════════════════════════════════════
 *
 *  تخزين في الذاكرة (Map) — مناسب لـ Vercel serverless (كل instance منفصل).
 *  للإنتاج بمستوى عالٍ، يُستحسن Redis (Upstash) للمشاركة بين instances.
 *
 *  الاستخدام:
 *    const rl = rateLimit("login", { max: 5, windowMs: 15*60*1000 });
 *    if (rl.blocked) return 429;
 *    rl.increment();
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
  lockedUntil?: number;
}

const store = new Map<string, RateLimitEntry>();

// تنظيف دوري لتجنب تضخم الذاكرة
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt < now && (!entry.lockedUntil || entry.lockedUntil < now)) {
        store.delete(key);
      }
    }
  }, 60 * 1000).unref?.();
}

export interface RateLimitOptions {
  max: number;           // عدد المحاولات المسموحة
  windowMs: number;      // نافذة الوقت (مللي ثانية)
  lockoutMs?: number;    // مدة القفل بعد تجاوز الحد (افتراضي = windowMs)
}

export interface RateLimitResult {
  blocked: boolean;          // هل يجب رفض الطلب؟
  remaining: number;         // المحاولات المتبقية
  resetAt: number;           // متى تُصفَّر العداد
  lockedUntil?: number;      // متى ينتهي القفل (إن كان مقفلاً)
  lockoutRemaining?: number; // الثواني المتبقية للقفل
}

/**
 * يتحقق من حالة rate limit لمفتاح معيّن.
 * لا يزيد العداد تلقائياً — استدعِ increment() بعد المعالجة.
 */
export function rateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  // لا يوجد entry سابق → مسموح
  if (!entry || entry.resetAt < now) {
    return {
      blocked: false,
      remaining: options.max,
      resetAt: now + options.windowMs,
    };
  }

  // مقفل → محظور
  if (entry.lockedUntil && entry.lockedUntil > now) {
    return {
      blocked: true,
      remaining: 0,
      resetAt: entry.resetAt,
      lockedUntil: entry.lockedUntil,
      lockoutRemaining: Math.ceil((entry.lockedUntil - now) / 1000),
    };
  }

  // تجاوز الحد → قفل
  if (entry.count >= options.max) {
    const lockoutMs = options.lockoutMs || options.windowMs;
    entry.lockedUntil = now + lockoutMs;
    store.set(key, entry);
    return {
      blocked: true,
      remaining: 0,
      resetAt: entry.resetAt,
      lockedUntil: entry.lockedUntil,
      lockoutRemaining: Math.ceil(lockoutMs / 1000),
    };
  }

  // مسموح
  return {
    blocked: false,
    remaining: options.max - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * يزيد عداد المحاولات لمفتاح معيّن.
 * يُستدعى بعد معالجة الطلب (سواء نجح أو فشل).
 */
export function incrementRateLimit(key: string, options: RateLimitOptions): void {
  const now = Date.now();
  let entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    entry = {
      count: 1,
      resetAt: now + options.windowMs,
    };
  } else {
    entry.count++;
  }

  store.set(key, entry);
}

/**
 * يصفّر العداد عند النجاح (لكي لا تتراكم محاولات فاشلة قديمة).
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

/**
 * يستخرج معرّف العميل (IP) من طلب Next.js.
 * يأخذ أول IP من X-Forwarded-For (خلف Caddy/Vercel).
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

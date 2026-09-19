/**
 * tx-safe.ts — غلاف معاملات Prisma المقاوم لانتهاء المهلة (P2028)
 * ═══════════════════════════════════════════════════════════════════
 * الجذر المُشخَّص لخطأ «Transaction API Error: Unable to start a transaction
 * in the given time»: المعاملة التفاعلية تفشل في البدء (BEGIN) ضمن maxWait
 * الافتراضي (2000ms فقط):
 *  - الويب (Vercel + Neon): بداية باردة للـ compute (scale-to-zero) + طابور
 *    اتصالات pgbouncer تحت التزامن → BEGIN يتجاوز ثانيتين.
 *  - سطح المكتب (SQLite): journal_mode=delete (قبل الإصلاح) — القراءة الطويلة
 *    (مزامنة المنخرطين/لوحة المالية) تحجب الكاتب، وBEGIN ينتظر.
 *
 * الحل (بلا إخفاء للسبب):
 *  1) maxWait=10s — يكفي لصحوة Neon/طابور الاتصالات؛ العملية نفسها (4 إدخالات)
 *     ميلي‌ثوانٍ — الانتظار هنا «انتظار بدء» لا «انتظار تنفيذ».
 *  2) timeout=15s — سقف سخي للتنفيذ الفعلي بعد البدء.
 *  3) إعادة محاولة على P2028 تحديداً (فشل بدء = لم يُنفَّذ شيء → آمنة تماماً).
 *  4) تسجيل تشخيصي في dev: المزود/المحاولة/المدة/رمز الخطأ — بلا بيانات حساسة.
 */

import { db } from "@/lib/db";

/** نوع عميل المعاملة المستلم في الـ callback */
export type TxClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

const IS_SQLITE = (process.env.DATABASE_URL || "").startsWith("file:");
const PROVIDER = IS_SQLITE ? "sqlite" : "postgresql";

/** مهلة انتظار بدء المعاملة (افتراضي Prisma = 2000ms — سبب الجذر) */
export const TX_MAX_WAIT = 10_000;
/** مهلة تنفيذ المعاملة بعد بدئها */
export const TX_TIMEOUT = 15_000;
/** عدد إعادات المحاولة على فشل البدء (P2028) — عابرة بطبيعتها */
const START_RETRY = 2;
const BACKOFF_MS = [250, 600];

function isStartFailure(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  const msg = e instanceof Error ? e.message : String(e);
  return code === "P2028" || /Unable to start a transaction in the given time/i.test(msg);
}

/** رمز خطأ Prisma إن وُجد (للتسجيل التشخيصي) */
function errCode(e: unknown): string {
  return (e as { code?: string })?.code || (e instanceof Error ? e.name : "unknown");
}

/**
 * تشغيل ذرّي داخل معاملة واحدة مع تحمّل فشل البدء العابر.
 * @param fn      العملية داخل المعاملة (تستقبل عميل المعاملة)
 * @param label   وصف قصير للتشخيص (مثال: "workhours-bulk")
 */
export async function runTx<T>(
  fn: (tx: TxClient) => Promise<T>,
  label = "tx"
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const t0 = Date.now();
    try {
      const result = await db.$transaction(fn, { maxWait: TX_MAX_WAIT, timeout: TX_TIMEOUT });
      const ms = Date.now() - t0;
      if (process.env.NODE_ENV !== "production") {
        console.log(`[tx-safe] ${label} ✓ ${PROVIDER} attempt=${attempt + 1} ${ms}ms`);
      }
      return result;
    } catch (e) {
      const ms = Date.now() - t0;
      if (isStartFailure(e) && attempt < START_RETRY) {
        // فشل البدء = لم تُنفَّذ أي عملية داخل المعاملة → إعادة آمنة
        console.warn(
          `[tx-safe] ${label} ⚠ بدء المعاملة فشل (${PROVIDER}) attempt=${attempt + 1} بعد ${ms}ms — إعادة محاولة ${attempt + 2}/${START_RETRY + 1}`
        );
        await new Promise((r) => setTimeout(r, BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]));
        continue;
      }
      console.error(
        `[tx-safe] ${label} ✗ ${PROVIDER} attempt=${attempt + 1} بعد ${ms}ms code=${errCode(e)}`,
        e instanceof Error ? e.message.slice(0, 300) : e
      );
      throw e;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// SQLite: تفعيل WAL مرة واحدة لكل عملية — الإصلاح الجذري لتزامن
// سطح المكتب: القراءات الطويلة لم تعد تحجب الكاتب (ومعها BEGIN).
// WAL يُحفظ في ملف القاعدة نفسه — idempotent وبلا تكلفة بعد أول مرة.
// PostgreSQL غير متأثر (لا-op محمي بالفحص).
// ─────────────────────────────────────────────────────────────
let sqlitePragmasDone = false;

export function ensureSqliteConcurrency(): void {
  if (!IS_SQLITE || sqlitePragmasDone) return;
  sqlitePragmasDone = true; // يُضبط مبكراً كي لا تتكدس المحاولات على كل طلب
  void (async () => {
    try {
      const mode = await db.$queryRawUnsafe<{ journal_mode?: string }[]>('PRAGMA journal_mode=WAL');
      await db.$queryRawUnsafe('PRAGMA busy_timeout=8000').catch(() => undefined);
      console.log(`[tx-safe] sqlite journal_mode=${mode?.[0]?.journal_mode ?? "؟"} busy_timeout=8000`);
    } catch (e) {
      console.warn("[tx-safe] sqlite WAL setup skipped:", e instanceof Error ? e.message.slice(0, 120) : e);
    }
  })();
}

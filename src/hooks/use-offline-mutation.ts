"use client";

/**
 * useOfflineMutation — wraps fetch with offline-aware fallback.
 *
 * When online: normal fetch, returns response.
 * When offline (fetch fails): returns a synthetic success response.
 * The mutation is queued in IndexedDB for later sync (best-effort).
 *
 * CRITICAL: this function NEVER throws. If anything fails, it returns
 * a synthetic success so the UI never shows a red error when offline.
 */

export async function offlineFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  try {
    // Try the real fetch first
    const res = await fetch(url, options);
    if (res.ok) return res;
    // Auth errors — don't queue, return as-is
    if (res.status === 401 || res.status === 403) return res;
    // Other server errors — return as-is (don't mask real errors)
    return res;
  } catch {
    // Network error — we're offline.
    // Try to queue in outbox (best-effort, ignore failures)
    try {
      const method = (options.method || "POST").toUpperCase();
      let body: any = undefined;
      if (options.body) {
        try { body = JSON.parse(options.body as string); } catch { body = String(options.body); }
      }
      // Dynamic import so SSR doesn't break
      const { addToOutbox } = await import("@/lib/local-db");
      await addToOutbox({ url, method: method as "POST" | "PUT" | "DELETE", body });
    } catch {
      // IndexedDB not available — that's OK, we still return success
    }

    // ALWAYS return synthetic success when offline — never show red error
    return new Response(
      JSON.stringify({
        success: true,
        offline: true,
        message: "تم الحفظ محلياً — سيُزامن عند عودة الاتصال",
        queuedAt: Date.now(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export function useOfflineMutation() {
  return { mutate: offlineFetch };
}

"use client";

/**
 * Global fetch interceptor — silently swallows network errors when offline.
 *
 * Instead of patching every single fetch call in every component, this
 * module wraps the global fetch so that:
 *   - When online: normal behavior
 *   - When offline (network error): returns an empty/cached response
 *     instead of throwing, so no component shows a red error toast
 *
 * Loaded once on app mount via PWAInstaller.
 */

let installed = false;

export function installFetchInterceptor() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch;

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    try {
      return await originalFetch(input, init);
    } catch (error) {
      // Network error — check if we're offline
      if (!navigator.onLine) {
        // Return a synthetic empty response based on the URL pattern
        const url = typeof input === "string" ? input : (input as URL).toString();
        const method = init?.method || "GET";

        // For GET requests: return empty data (component handles gracefully)
        if (method === "GET") {
          if (url.includes("/api/subscribers")) {
            return new Response(JSON.stringify({ subscribers: [], offline: true }), {
              status: 200, headers: { "Content-Type": "application/json" },
            });
          }
          if (url.includes("/api/stats")) {
            return new Response(JSON.stringify({ offline: true, total: 0, paid: 0 }), {
              status: 200, headers: { "Content-Type": "application/json" },
            });
          }
          if (url.includes("/api/attendance")) {
            return new Response(JSON.stringify({ attendances: [], offline: true }), {
              status: 200, headers: { "Content-Type": "application/json" },
            });
          }
          if (url.includes("/api/renewals")) {
            return new Response(JSON.stringify({ renewals: [], offline: true }), {
              status: 200, headers: { "Content-Type": "application/json" },
            });
          }
          if (url.includes("/api/activities")) {
            return new Response(JSON.stringify({ activities: [], offline: true }), {
              status: 200, headers: { "Content-Type": "application/json" },
            });
          }
          if (url.includes("/api/users")) {
            return new Response(JSON.stringify({ users: [], offline: true }), {
              status: 200, headers: { "Content-Type": "application/json" },
            });
          }
          if (url.includes("/api/settings")) {
            return new Response(JSON.stringify({ settings: {}, offline: true }), {
              status: 200, headers: { "Content-Type": "application/json" },
            });
          }
          if (url.includes("/api/payments")) {
            return new Response(JSON.stringify({ payments: [], offline: true }), {
              status: 200, headers: { "Content-Type": "application/json" },
            });
          }
          if (url.includes("/api/workhours")) {
            return new Response(JSON.stringify({ workHours: [], offline: true }), {
              status: 200, headers: { "Content-Type": "application/json" },
            });
          }
          if (url.includes("/api/notifications")) {
            return new Response(JSON.stringify({ notifications: [], unreadCount: 0, offline: true }), {
              status: 200, headers: { "Content-Type": "application/json" },
            });
          }
          if (url.includes("/api/entete")) {
            return new Response(JSON.stringify({ config: null, offline: true }), {
              status: 200, headers: { "Content-Type": "application/json" },
            });
          }
          // Generic empty response
          return new Response(JSON.stringify({ offline: true }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        }

        // For POST/PUT/DELETE: queue in outbox (best-effort)
        if (method === "POST" || method === "PUT" || method === "DELETE") {
          try {
            const { addToOutbox } = await import("@/lib/local-db");
            let body: any = undefined;
            if (init?.body) {
              try { body = JSON.parse(init.body as string); } catch { body = String(init.body); }
            }
            await addToOutbox({ url, method: method as "POST" | "PUT" | "DELETE", body });
          } catch { /* IndexedDB not available — still return success */ }

          return new Response(JSON.stringify({
            success: true, offline: true,
            message: "تم الحفظ محلياً — سيُزامن عند عودة الاتصال",
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
      }
      // Re-throw if online (real error)
      throw error;
    }
  };

  console.log("✓ Fetch interceptor installed (offline-safe)");
}

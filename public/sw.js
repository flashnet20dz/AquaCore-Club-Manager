// ═══════════════════════════════════════════════════════════
// RCS Club — Service Worker v5 (Chunk-Safe + Cache-Bust)
// ═══════════════════════════════════════════════════════════
//
// v5 fixes:
//   - Aggressive cache-busting on activate (delete ALL old caches)
//   - HTML pages: NETWORK-ONLY (never cache) → always fresh HTML
//   - JS chunks: NETWORK-ONLY → browser HTTP cache handles them
//   - API GET: network-first, cache fallback, empty-JSON fallback
//   - Images/static: stale-while-revalidate
//   - Added: API endpoints for new features (employees, contracts, templates)

const CACHE_VERSION = "rcs-club-v6";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Aggressively delete ALL caches that don't match the current version
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
  // Force all open clients to refresh
  self.clients.matchAll({ type: "window" }).then((clients) => {
    clients.forEach((client) => client.navigate(client.url));
  });
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/webpack-hmr")) return;

  // ─── NON-GET: pass through (the inline interceptor handles offline) ───
  if (request.method !== "GET") return;

  // ─── HTML pages: NETWORK-ONLY (never cache) ───
  const accept = request.headers.get("accept") || "";
  if (accept.includes("text/html") || url.pathname === "/" || url.pathname === "/login" || url.pathname === "/pin") {
    return;
  }

  // ─── Next.js chunks & static: NETWORK-ONLY (browser HTTP cache handles) ───
  if (url.pathname.startsWith("/_next/static/")) {
    return;
  }

  // ─── API GET: network-first, cache fallback, empty-JSON fallback ───
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || makeEmptyResponse(url.pathname))
        )
    );
    return;
  }

  // ─── Images & other static: stale-while-revalidate ───
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

function makeEmptyResponse(pathname) {
  const empty = {};
  if (pathname.includes("/api/subscribers")) empty.subscribers = [];
  else if (pathname.includes("/api/stats")) { empty.total = 0; empty.paid = 0; }
  else if (pathname.includes("/api/attendance")) empty.attendances = [];
  else if (pathname.includes("/api/renewals")) empty.renewals = [];
  else if (pathname.includes("/api/activities")) empty.activities = [];
  else if (pathname.includes("/api/users")) empty.users = [];
  else if (pathname.includes("/api/settings")) empty.settings = {};
  else if (pathname.includes("/api/payments")) empty.payments = [];
  else if (pathname.includes("/api/workhours")) empty.workHours = [];
  else if (pathname.includes("/api/notifications")) { empty.notifications = []; empty.unreadCount = 0; }
  else if (pathname.includes("/api/entete")) empty.config = null;
  else if (pathname.includes("/api/cashier-pin")) empty.pins = [];
  else if (pathname.includes("/api/analytics")) empty.ageGroups = [];
  else if (pathname.includes("/api/auth/me")) empty.user = null;
  // ─── New: employee/contract endpoints ───
  else if (pathname.includes("/api/employees")) empty.employees = [];
  else if (pathname.includes("/api/contracts")) empty.contracts = [];
  else if (pathname.includes("/api/contract-templates")) empty.templates = [];
  else if (pathname.includes("/api/subscription-types")) empty.types = [];
  else if (pathname.includes("/api/swimming-days")) empty.days = [];
  else if (pathname.includes("/api/swimming-slots")) empty.slots = [];
  empty.offline = true;
  return new Response(JSON.stringify(empty), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

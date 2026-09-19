import type { Metadata, Viewport } from "next";
import { Cairo, Tajawal, Unbounded, Manrope, Azeret_Mono, Cairo_Play, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "@/lib/date-utils";
import { Toaster } from "@/components/ui/sonner";
import { PWAInstaller } from "@/components/pwa-installer";
import { ThemeProvider } from "@/lib/theme-context";
import { LatinDigitsGuard } from "@/components/latin-digits-guard";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "700", "800"],
  display: "swap",
});

// ── SaaS Analytics fonts (dense tables / mono metrics) ──
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

// ── Expressive Brand fonts ──
// Unbounded carries display, Manrope carries UI, Azeret Mono marks energy.
// Cairo Play is the expressive Arabic display fallback (Unbounded has no Arabic).
const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const azeretMono = Azeret_Mono({
  variable: "--font-azeret",
  subsets: ["latin"],
  display: "swap",
});

const cairoPlay = Cairo_Play({
  variable: "--font-cairo-play",
  subsets: ["arabic", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AquaCore Club Manager | منظومة إدارة الاشتراكات والسباحة",
  description: "AquaCore Club Manager — منظومة عصرية متكاملة لإدارة اشتراكات نادي السباحة — تسجيل، إحصائيات، تجديد، حضور بكود QR، وإشعارات WhatsApp",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AquaCore Club Manager",
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: [{ url: "/images/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: "AquaCore Club Manager - منظومة إدارة الاشتراكات",
    description: "AquaCore Club Manager — منظومة متكاملة لإدارة اشتراكات نادي السباحة",
    type: "website",
    locale: "ar_DZ",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0b10" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('rcs-theme');
                // ?_theme=dark|light deep-link override (useful for QA + screenshots)
                const qp = new URLSearchParams(location.search).get('_theme');
                const wantsDark = qp === 'dark' || (!qp && theme === 'dark') || (!qp && !theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (wantsDark) {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}

              // ═══ Offline Fetch Interceptor — runs BEFORE React ═══
              // Wraps window.fetch so that when offline, ALL requests
              // return synthetic empty JSON (200) instead of throwing.
              // This guarantees ZERO red error toasts when offline.
              (function() {
                var _fetch = window.fetch;
                window.fetch = function(input, init) {
                  return _fetch.call(this, input, init).catch(function(err) {
                    if (!navigator.onLine) {
                      var url = typeof input === 'string' ? input : (input && input.url) || '';
                      var method = (init && init.method) || 'GET';
                      var empty = { offline: true };

                      // Return appropriate empty data per endpoint
                      if (url.indexOf('/api/subscribers') !== -1) empty.subscribers = [];
                      else if (url.indexOf('/api/stats') !== -1) { empty.total = 0; empty.paid = 0; }
                      else if (url.indexOf('/api/attendance') !== -1) empty.attendances = [];
                      else if (url.indexOf('/api/renewals') !== -1) empty.renewals = [];
                      else if (url.indexOf('/api/activities') !== -1) empty.activities = [];
                      else if (url.indexOf('/api/users') !== -1) empty.users = [];
                      else if (url.indexOf('/api/settings') !== -1) empty.settings = {};
                      else if (url.indexOf('/api/payments') !== -1) empty.payments = [];
                      else if (url.indexOf('/api/workhours') !== -1) empty.workHours = [];
                      else if (url.indexOf('/api/notifications') !== -1) { empty.notifications = []; empty.unreadCount = 0; }
                      else if (url.indexOf('/api/entete') !== -1) empty.config = null;
                      else if (url.indexOf('/api/cashier-pin') !== -1) empty.pins = [];
                      else if (url.indexOf('/api/analytics') !== -1) empty.ageGroups = [];
                      else if (url.indexOf('/api/auth/me') !== -1) empty.user = null;
                      // ─── New: employee/contract endpoints ───
                      else if (url.indexOf('/api/employees') !== -1) empty.employees = [];
                      else if (url.indexOf('/api/contracts') !== -1) empty.contracts = [];
                      else if (url.indexOf('/api/contract-templates') !== -1) empty.templates = [];
                      else if (url.indexOf('/api/subscription-types') !== -1) empty.types = [];
                      else if (url.indexOf('/api/swimming-days') !== -1) empty.days = [];
                      else if (url.indexOf('/api/swimming-slots') !== -1) empty.slots = [];
                      else if (method !== 'GET') {
                        empty.success = true;
                        empty.message = 'تم الحفظ محلياً';
                      }

                      // Try to queue mutations in IndexedDB
                      if (method !== 'GET') {
                        try {
                          var body = init && init.body ? JSON.parse(init.body) : null;
                          var req = indexedDB.open('rcs-club-local', 1);
                          req.onupgradeneeded = function(e) {
                            var db = e.target.result;
                            if (!db.objectStoreNames.contains('outbox')) {
                              db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
                            }
                          };
                          req.onsuccess = function(e) {
                            try {
                              var db = e.target.result;
                              var tx = db.transaction('outbox', 'readwrite');
                              tx.objectStore('outbox').add({
                                url: url, method: method, body: body, createdAt: Date.now()
                              });
                            } catch(ex) {}
                          };
                        } catch(ex) {}
                      }

                      return new Response(JSON.stringify(empty), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                      });
                    }
                    throw err;
                  });
                };
                // ═══ Auto-reload on chunk load failure ═══
              // When a new deployment changes chunk filenames, old cached
              // HTML references chunks that 404. This handler catches the
              // error and forces a full page reload to get fresh HTML.
              window.addEventListener('error', function(e) {
                if (e && e.target && e.target.src && e.target.src.indexOf('/_next/static/chunks/') !== -1) {
                  console.log('Chunk load failed, reloading...');
                  window.location.reload();
                }
              }, true);
              window.addEventListener('unhandledrejection', function(e) {
                if (e && e.reason && e.reason.message && e.reason.message.indexOf('chunk') !== -1) {
                  console.log('Chunk load rejected, reloading...');
                  window.location.reload();
                }
              });

              console.log('✓ Offline fetch interceptor installed');
              })();

              // ═══ Global Latin Digits Enforcer ═══
              (function() {
                var eastern = '٠١٢٣٤٥٦٧٨٩', persian = '۰۱۲۳۴۵۶۷۸۹';
                function toLatin(s) {
                  return String(s || '').replace(/[٠-٩]/g, function(d) { return eastern.indexOf(d); }).replace(/[۰-۹]/g, function(d) { return persian.indexOf(d); }).replace(/[\u200e\u200f\u061c]/g, '');
                }
                function fixLoc(l) {
                  if (!l) return 'ar-DZ-u-nu-latn';
                  if (typeof l === 'string' && l.indexOf('ar') === 0 && l.indexOf('nu-latn') === -1) return l + '-u-nu-latn';
                  return l;
                }
                var origD = Date.prototype.toLocaleDateString;
                Date.prototype.toLocaleDateString = function(l, o) {
                  var opts = Object.assign({}, o, { numberingSystem: 'latn' });
                  return toLatin(origD.call(this, fixLoc(l), opts));
                };
                var origS = Date.prototype.toLocaleString;
                Date.prototype.toLocaleString = function(l, o) {
                  var opts = Object.assign({}, o, { numberingSystem: 'latn' });
                  return toLatin(origS.call(this, fixLoc(l), opts));
                };
                var origT = Date.prototype.toLocaleTimeString;
                Date.prototype.toLocaleTimeString = function(l, o) {
                  var opts = Object.assign({}, o, { numberingSystem: 'latn' });
                  return toLatin(origT.call(this, fixLoc(l), opts));
                };
                var origN = Number.prototype.toLocaleString;
                Number.prototype.toLocaleString = function(l, o) {
                  var opts = Object.assign({}, o, { numberingSystem: 'latn' });
                  return toLatin(origN.call(this, fixLoc(l), opts));
                };
                if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
                  var origFmt = Intl.DateTimeFormat.prototype.format;
                  Intl.DateTimeFormat.prototype.format = function(d) {
                    return toLatin(origFmt.call(this, d));
                  };
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${cairo.variable} ${tajawal.variable} ${inter.variable} ${jetbrainsMono.variable} ${unbounded.variable} ${manrope.variable} ${azeretMono.variable} ${cairoPlay.variable} font-cairo antialiased bg-background text-foreground min-h-screen`}
      >
        <LatinDigitsGuard />
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <Toaster position="top-center" richColors closeButton />
        <PWAInstaller />
      </body>
    </html>
  );
}

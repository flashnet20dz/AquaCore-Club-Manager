"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [installed, setInstalled] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(display-mode: standalone)").matches;
    }
    return false;
  });

  useEffect(() => {
    // Register service worker for offline support
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("SW registration failed:", err);
      });
    }

    // Install global fetch interceptor — silences all red errors when offline
    import("@/lib/fetch-interceptor").then(({ installFetchInterceptor }) => {
      installFetchInterceptor();
    });

    // Start auto-sync engine (pulls on load, syncs every 5 min, on reconnect)
    import("@/lib/sync").then(({ startAutoSync }) => {
      startAutoSync();
    });

    // If already installed, no need to show banner
    if (installed) return;

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show banner after 3 seconds if not dismissed before
      const dismissed = localStorage.getItem("pwa-dismissed");
      if (!dismissed) {
        setTimeout(() => setShowBanner(true), 3000);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Listen for installed
    const installedHandler = () => {
      setInstalled(true);
      setShowBanner(false);
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("pwa-dismissed", "true");
  };

  if (installed) return null;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ opacity: 0, y: 50, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: 50, x: "-50%" }}
          className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md"
        >
          <div className="rounded-2xl bg-gradient-to-br from-teal-600 to-sky-700 p-4 shadow-2xl border border-white/20">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur shrink-0">
                <Smartphone className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">ثبّت التطبيق على هاتفك</p>
                <p className="text-xs text-white/80 mt-0.5">
                  للوصول السريع واستخدام كاميرا QR بسهولة
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={handleInstall}
                    className="bg-white text-teal-700 hover:bg-white/90 h-8"
                  >
                    <Download className="h-3.5 w-3.5 ml-1" /> تثبيت
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDismiss}
                    className="text-white hover:bg-white/20 h-8"
                  >
                    لاحقاً
                  </Button>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="text-white/70 hover:text-white p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

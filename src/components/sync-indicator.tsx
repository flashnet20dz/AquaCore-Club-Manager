"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wifi, WifiOff, RefreshCw, Cloud, CloudOff, CheckCircle2,
  Loader2, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { syncNow, type SyncResult } from "@/lib/sync";
import { getMeta } from "@/lib/local-db";
import { toast } from "sonner";

type ConnectionState = "online" | "offline";
type SyncState = "idle" | "syncing" | "success" | "error";

export function SyncIndicator() {
  const [connection, setConnection] = useState<ConnectionState>("online");
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Track online/offline
  useEffect(() => {
    const update = () => setConnection(navigator.onLine ? "online" : "offline");
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    // Load last sync time
    getMeta("lastSyncAt").then((t) => { if (t) setLastSync(t); });

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // Auto-sync on reconnect
  useEffect(() => {
    if (connection === "online" && syncState !== "syncing") {
      handleSync();
    }
  }, [connection]);

  const handleSync = useCallback(async () => {
    if (syncState === "syncing") return;
    setSyncState("syncing");
    try {
      const result = await syncNow();
      setLastSync(result.lastSyncAt);
      if (result.errors > 0) {
        setSyncState("error");
        toast.error(`المزامنة اكتملت مع ${result.errors} خطأ`);
      } else if (result.pushed > 0 || result.pulled > 0) {
        setSyncState("success");
        toast.success(`تمت المزامنة: ${result.pushed} مُرسَل، ${result.pulled} مُستلَم`);
      } else {
        setSyncState("success");
      }
      setTimeout(() => setSyncState("idle"), 3000);
    } catch (e) {
      setSyncState("error");
      toast.error("فشلت المزامنة");
      setTimeout(() => setSyncState("idle"), 3000);
    }
  }, [syncState]);

  const isOnline = connection === "online";
  const isSyncing = syncState === "syncing";

  // Compact display
  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return "الآن";
    if (diff < 3600000) return `منذ ${Math.floor(diff / 60000)} د`;
    if (diff < 86400000) return `منذ ${Math.floor(diff / 3600000)} س`;
    return new Date(ts).toLocaleDateString("ar-DZ");
  };

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 h-9 px-2 sm:px-3 rounded-lg border border-border/60 bg-card hover:bg-accent transition"
        title={isOnline ? "متصل" : "غير متصل"}
      >
        {/* Connection icon */}
        {isOnline ? (
          <Wifi className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <WifiOff className="h-3.5 w-3.5 text-rose-500" />
        )}

        {/* Sync state icon */}
        {isSyncing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        ) : syncState === "success" ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        ) : syncState === "error" ? (
          <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
        ) : isOnline ? (
          <Cloud className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <CloudOff className="h-3.5 w-3.5 text-muted-foreground" />
        )}

        {/* Status text — hidden on very small screens */}
        <span className="hidden sm:inline text-xs font-medium">
          {isSyncing ? "مزامنة..." :
           !isOnline ? "أوفلاين" :
           syncState === "success" ? "متزامن" :
           syncState === "error" ? "خطأ مزامنة" :
           lastSync ? `آخر مزامنة ${formatTime(lastSync)}` : "جاهز"}
        </span>
      </button>

      {/* Expanded panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-11 left-0 z-50 w-64 rounded-xl border border-border/60 bg-card shadow-xl p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs">حالة المزامنة</h4>
              <button onClick={() => setExpanded(false)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between p-1.5 rounded bg-muted/40">
                <span className="flex items-center gap-1.5">
                  {isOnline ? <Wifi className="h-3 w-3 text-emerald-500" /> : <WifiOff className="h-3 w-3 text-rose-500" />}
                  الاتصال
                </span>
                <span className={isOnline ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
                  {isOnline ? "متصل" : "غير متصل"}
                </span>
              </div>

              <div className="flex items-center justify-between p-1.5 rounded bg-muted/40">
                <span className="flex items-center gap-1.5">
                  <Cloud className="h-3 w-3" />
                  السحابة
                </span>
                <span className="text-muted-foreground">
                  {isOnline ? "Vercel + Neon" : "—"}
                </span>
              </div>

              <div className="flex items-center justify-between p-1.5 rounded bg-muted/40">
                <span>آخر مزامنة</span>
                <span className="text-muted-foreground">
                  {lastSync ? formatTime(lastSync) : "لم تتم بعد"}
                </span>
              </div>
            </div>

            <button
              onClick={handleSync}
              disabled={!isOnline || isSyncing}
              className="w-full flex items-center justify-center gap-1.5 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
            >
              {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              مزامنة الآن
            </button>

            {!isOnline && (
              <p className="text-[10px] text-muted-foreground text-center">
                ستتم المزامنة تلقائياً عند عودة الاتصال
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

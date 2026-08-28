"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Maximize, Minimize, CheckCircle2, XCircle, AlertTriangle,
  Loader2, QrCode, Clock, User, Droplet, CreditCard, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { notifySuccess, notifyWarning, notifyError } from "@/lib/sounds";
import { cn } from "@/lib/utils";

interface KioskEntry {
  id: string;
  time: string;
  fileNumber: string;
  name: string;
  status: "granted" | "denied" | "warning";
  message: string;
}

interface KioskModeProps {
  open: boolean;
  onClose: () => void;
}

type FlashState = "idle" | "granted" | "denied" | "warning";

export function KioskMode({ open, onClose }: KioskModeProps) {
  const [code, setCode] = useState("");
  const [processing, setProcessing] = useState(false);
  const [flash, setFlash] = useState<FlashState>("idle");
  const [flashData, setFlashData] = useState<{
    name?: string;
    fileNumber?: string;
    subscriptionType?: string;
    bloodType?: string | null;
    message?: string;
    canRenew?: boolean;
  }>({});
  const [history, setHistory] = useState<KioskEntry[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ★ وضع الشاشة الكاملة
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch { /* ignore */ }
  }, []);

  // ★ focus تلقائي على حقل الإدخال
  useEffect(() => {
    if (open && !processing) {
      inputRef.current?.focus();
    }
  }, [open, processing, flash]);

  // ★ طلب الشاشة الكاملة عند الفتح
  useEffect(() => {
    if (open) {
      toggleFullscreen();
      setHistory([]);
      setFlash("idle");
    }
  }, [open, toggleFullscreen]);

  // ★ إغلاق الشاشة الكاملة عند الخروج
  useEffect(() => {
    if (!open && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, [open]);

  // ★ تأثير وميض (flash) — يعود إلى idle بعد 3 ثوانٍ
  const triggerFlash = useCallback((state: FlashState, data: typeof flashData) => {
    setFlash(state);
    setFlashData(data);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => {
      setFlash("idle");
      setFlashData({});
      setCode("");
      inputRef.current?.focus();
    }, state === "granted" ? 2500 : 3500);
  }, []);

  // ★ معالجة الإدخال — يُستدعى عند Enter أو مسح باركود
  const handleCheckIn = useCallback(async (fileNumber: string) => {
    if (!fileNumber.trim() || processing) return;
    setProcessing(true);
    setCode("");
    try {
      const { offlineFetch } = await import("@/hooks/use-offline-mutation");
      const res = await offlineFetch("/api/qr-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileNumber: fileNumber.trim() }),
      });
      const data = await res.json();
      const now = new Date();
      const timeStr = now.toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      if (!res.ok) {
        notifyError();
        triggerFlash("denied", {
          message: data.error || "رقم الملف غير موجود",
        });
        setHistory((prev) => [{
          id: Date.now().toString(),
          time: timeStr,
          fileNumber: fileNumber.trim(),
          name: "—",
          status: "denied" as const,
          message: data.error || "غير موجود",
        }, ...prev].slice(0, 10));
      } else if (data.alreadyCheckedIn) {
        notifyWarning();
        triggerFlash("warning", {
          name: `${data.subscriber.lastName} ${data.subscriber.firstName}`,
          fileNumber: data.subscriber.fileNumber,
          subscriptionType: data.subscriber.subscriptionType,
          bloodType: data.subscriber.bloodType,
          message: "تم تسجيل الحضور مسبقاً اليوم",
        });
        setHistory((prev) => [{
          id: Date.now().toString(),
          time: timeStr,
          fileNumber: data.subscriber.fileNumber,
          name: `${data.subscriber.lastName} ${data.subscriber.firstName}`,
          status: "warning" as const,
          message: "حضور مسبق",
        }, ...prev].slice(0, 10));
      } else if (data.status === "expired" || data.status === "no_payment") {
        notifyWarning();
        triggerFlash("denied", {
          name: `${data.subscriber.lastName} ${data.subscriber.firstName}`,
          fileNumber: data.subscriber.fileNumber,
          subscriptionType: data.subscriber.subscriptionType,
          bloodType: data.subscriber.bloodType,
          message: data.status === "expired" ? "الاشتراك منتهي — يلزم التجديد" : "لم يسدد — يلزم التسوية",
          canRenew: true,
        });
        setHistory((prev) => [{
          id: Date.now().toString(),
          time: timeStr,
          fileNumber: data.subscriber.fileNumber,
          name: `${data.subscriber.lastName} ${data.subscriber.firstName}`,
          status: "denied" as const,
          message: data.status === "expired" ? "منتهي" : "لم يسدد",
        }, ...prev].slice(0, 10));
      } else {
        notifySuccess();
        triggerFlash("granted", {
          name: `${data.subscriber.lastName} ${data.subscriber.firstName}`,
          fileNumber: data.subscriber.fileNumber,
          subscriptionType: data.subscriber.subscriptionType,
          bloodType: data.subscriber.bloodType,
          message: "✓ الدخول مسموح",
        });
        setHistory((prev) => [{
          id: Date.now().toString(),
          time: timeStr,
          fileNumber: data.subscriber.fileNumber,
          name: `${data.subscriber.lastName} ${data.subscriber.firstName}`,
          status: "granted" as const,
          message: "مسموح",
        }, ...prev].slice(0, 10));
      }
    } catch {
      notifyError();
      triggerFlash("denied", { message: "خطأ في الاتصال" });
    } finally {
      setProcessing(false);
    }
  }, [processing, triggerFlash]);

  // ★ معالجة الإدخال المستمر (قارئ الباركود)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCode(val);
    // قارئ الباركود يضيف \n أو \r في نهاية المسح
    if (val.endsWith("\n") || val.endsWith("\r")) {
      const clean = val.replace(/[\n\r]/g, "").trim();
      if (clean) handleCheckIn(clean);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = code.trim();
      if (val) handleCheckIn(val);
    }
  };

  if (!open) return null;

  // ★ خلفيات حسب الحالة
  const bgClass = {
    idle: "bg-slate-950",
    granted: "bg-emerald-950",
    denied: "bg-rose-950",
    warning: "bg-amber-950",
  }[flash];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn("fixed inset-0 z-[100] flex flex-col transition-colors duration-300", bgClass)}
    >
      {/* ─── شريط علوي ─── */}
      <div className="flex items-center justify-between px-6 py-3 bg-black/30">
        <div className="flex items-center gap-2 text-white">
          <QrCode className="h-6 w-6 text-teal-400" />
          <h1 className="text-lg font-bold">شاشة البوابة الذكية — AquaCore</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={toggleFullscreen} className="text-white/70 hover:text-white">
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} className="text-white/70 hover:text-white">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* ─── المنطقة الرئيسية ─── */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        {/* هالة متوهجة عند القبول/الرفض */}
        <AnimatePresence>
          {flash !== "idle" && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className={cn(
                "absolute inset-0 rounded-full blur-3xl pointer-events-none",
                flash === "granted" && "bg-emerald-500/20",
                flash === "denied" && "bg-rose-500/20",
                flash === "warning" && "bg-amber-500/20"
              )}
              style={{ maxWidth: "600px", maxHeight: "600px", margin: "auto" }}
            />
          )}
        </AnimatePresence>

        {/* المحتوى المركزي */}
        <div className="relative z-10 w-full max-w-md text-center">
          {flash === "idle" ? (
            <>
              {/* حالة الاستقبال */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="inline-flex h-24 w-24 items-center justify-center rounded-3xl bg-white/5 border border-white/10">
                  <QrCode className="h-12 w-12 text-teal-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-white mb-2">امسح بطاقتك أو أدخل رقم الملف</h2>
                  <p className="text-sm text-white/50">وجّه القارئ نحو الباركود أو اكتب الرقم واضغط Enter</p>
                </div>
                <Input
                  ref={inputRef}
                  type="text"
                  value={code}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="RCS001"
                  disabled={processing}
                  className="h-16 text-center text-2xl font-mono font-bold bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-2xl focus:bg-white/10"
                  dir="ltr"
                  autoComplete="off"
                />
                {processing && <Loader2 className="h-8 w-8 animate-spin text-teal-400 mx-auto" />}
              </motion.div>
            </>
          ) : (
            <>
              {/* حالة القبول/الرفض/التنبيه */}
              <motion.div
                key={flash}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="space-y-4"
              >
                <div className={cn(
                  "inline-flex h-28 w-28 items-center justify-center rounded-full border-4",
                  flash === "granted" && "border-emerald-400 bg-emerald-500/20",
                  flash === "denied" && "border-rose-400 bg-rose-500/20",
                  flash === "warning" && "border-amber-400 bg-amber-500/20"
                )}>
                  {flash === "granted" ? <CheckCircle2 className="h-14 w-14 text-emerald-400" /> :
                   flash === "denied" ? <XCircle className="h-14 w-14 text-rose-400" /> :
                   <AlertTriangle className="h-14 w-14 text-amber-400" />}
                </div>
                <div>
                  <h2 className={cn(
                    "text-3xl font-extrabold mb-2",
                    flash === "granted" && "text-emerald-400",
                    flash === "denied" && "text-rose-400",
                    flash === "warning" && "text-amber-400"
                  )}>
                    {flash === "granted" ? "✓ الدخول مسموح" :
                     flash === "denied" ? "✗ الدخول مرفوض" :
                     "⚠ تنبيه"}
                  </h2>
                  {flashData.name && <p className="text-xl font-bold text-white">{flashData.name}</p>}
                  {flashData.fileNumber && <p className="text-sm font-mono text-white/60 mt-1">{flashData.fileNumber}</p>}
                  {flashData.message && <p className="text-sm text-white/80 mt-2">{flashData.message}</p>}
                </div>
                {/* تفاصيل إضافية */}
                {flash === "granted" && flashData.subscriptionType && (
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                      <CreditCard className="h-3 w-3 ml-1" /> {flashData.subscriptionType}
                    </Badge>
                    {flashData.bloodType && (
                      <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30">
                        <Droplet className="h-3 w-3 ml-1" /> {flashData.bloodType}
                      </Badge>
                    )}
                  </div>
                )}
                {/* زر تجديد فوري */}
                {flash === "denied" && flashData.canRenew && (
                  <Button
                    size="lg"
                    className="bg-gradient-to-l from-amber-500 to-orange-500 text-white border-0 mt-4"
                    onClick={() => {
                      onClose();
                      // سيُعالج من قبل المكون الأب للانتقال لتبويب التجديد
                      window.dispatchEvent(new CustomEvent("navigate-to-renewals"));
                    }}
                  >
                    <RotateCcw className="h-5 w-5 ml-1" /> تجديد فوري
                  </Button>
                )}
              </motion.div>
            </>
          )}
        </div>
      </div>

      {/* ─── سجل الدخول اللحظي ─── */}
      <div className="bg-black/40 border-t border-white/5 max-h-[200px] overflow-y-auto">
        <div className="px-6 py-2 border-b border-white/5 flex items-center gap-2 text-white/50 text-xs">
          <Clock className="h-3.5 w-3.5" />
          <span>آخر العمليات ({history.length})</span>
        </div>
        <div className="divide-y divide-white/5">
          <AnimatePresence initial={false}>
            {history.map((entry) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-3 px-6 py-2 text-sm"
              >
                <span className="font-mono text-xs text-white/40 tabular-nums w-20" dir="ltr">{entry.time}</span>
                <div className={cn(
                  "h-6 w-6 rounded-full flex items-center justify-center shrink-0",
                  entry.status === "granted" ? "bg-emerald-500/20" :
                  entry.status === "denied" ? "bg-rose-500/20" : "bg-amber-500/20"
                )}>
                  {entry.status === "granted" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> :
                   entry.status === "denied" ? <XCircle className="h-3.5 w-3.5 text-rose-400" /> :
                   <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
                </div>
                <span className="font-mono text-xs text-white/60 w-20">{entry.fileNumber}</span>
                <span className="text-white/80 flex-1 truncate">{entry.name}</span>
                <span className={cn(
                  "text-xs",
                  entry.status === "granted" ? "text-emerald-400" :
                  entry.status === "denied" ? "text-rose-400" : "text-amber-400"
                )}>{entry.message}</span>
              </motion.div>
            ))}
          </AnimatePresence>
          {history.length === 0 && (
            <p className="text-center py-4 text-xs text-white/30">لا توجد عمليات بعد</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

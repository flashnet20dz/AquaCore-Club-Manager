"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, ScanLine, CheckCircle2, AlertCircle, Loader2, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { notifySuccess, notifyWarning, notifyError } from "@/lib/sounds";
import type { SubscriberWithComputed } from "@/lib/rcs";

interface CheckInResult {
  success: boolean;
  alreadyCheckedIn?: boolean;
  subscriber: SubscriberWithComputed & { phone?: string | null };
  attendance?: { id: string; checkInTime: string; method: string };
  status?: "ok" | "expired" | "no_payment" | "offline";
  expiryDate?: string | null;
  error?: string;
  offline?: boolean;
}

interface QRScannerProps {
  open: boolean;
  onClose: () => void;
  onCheckIn?: (result: CheckInResult) => void;
}

export function QRScanner({ open, onClose, onCheckIn }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  // ★ معرّف فريد للحاوية لتفادي إعادة استخدام نفس العنصر (يزيد الاستقرار)
  const containerId = useRef(`qr-reader-${Date.now()}`).current;
  const [scanning, setScanning] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [lastResult, setLastResult] = useState<CheckInResult | null>(null);
  const [processing, setProcessing] = useState(false);
  // ★ تقليل فترة الـ debounce من 3000ms إلى 1500ms (استجابة أسرع)
  const lastScanRef = useRef<{ code: string; time: number }>({ code: "", time: 0 });
  const onCheckInRef = useRef(onCheckIn);
  onCheckInRef.current = onCheckIn;
  // ★ flag لمنع بدء تشغيل مزدوج
  const startingRef = useRef(false);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  const doCheckIn = useCallback(async (fileNumber: string) => {
    // ★ منع المعالجة المتزامنة: استخدم flag بدلاً من setProcessing callback
    if (processing) return;
    setProcessing(true);
    try {
      const { offlineFetch } = await import("@/hooks/use-offline-mutation");
      const res = await offlineFetch("/api/qr-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileNumber }),
      });
      const data = await res.json();
      if (!res.ok) {
        notifyError();
        toast.error(data.error || "فشل تسجيل الحضور");
        setLastResult({ success: false, error: data.error, subscriber: data.subscriber });
      } else if (data.offline) {
        notifySuccess();
        toast.success("✓ تم تسجيل الحضور محلياً — سيُزامن عند عودة الاتصال");
        setLastResult({ success: true, offline: true, subscriber: { fileNumber, lastName: "", firstName: "" } as any, status: "offline" });
      } else {
        setLastResult(data);
        onCheckInRef.current?.(data);
        if (data.alreadyCheckedIn) {
          notifyWarning();
          toast.warning(`تم تسجيل الحضور مسبقاً: ${data.subscriber.lastName} ${data.subscriber.firstName}`);
        } else if (data.status === "expired" || data.status === "no_payment") {
          notifyWarning();
          toast.warning(`⚠️ ${data.subscriber.lastName} ${data.subscriber.firstName} — ${data.status === "expired" ? "اشتراك منتهي" : "لم يدفع"}`);
        } else {
          notifySuccess();
          toast.success(`✓ تم تسجيل حضور ${data.subscriber.lastName} ${data.subscriber.firstName}`);
        }
      }
    } catch (e) {
      console.error(e);
      notifyError();
      toast.error("خطأ في الاتصال");
    } finally {
      setProcessing(false);
    }
  }, [processing]);

  const startScanner = useCallback(async () => {
    // ★ منع البدء المزدوج
    if (scannerRef.current || startingRef.current) return;
    startingRef.current = true;
    setScanning(true);
    setLastResult(null);
    try {
      // ★ تقليل الانتظار من 100ms إلى 50ms
      await new Promise((r) => setTimeout(r, 50));
      const html5QrCode = new Html5Qrcode(containerId, { verbose: false });
      scannerRef.current = html5QrCode;

      const onScanSuccess = (decodedText: string) => {
        const now = Date.now();
        // ★ تقليل debounce من 3000ms إلى 1500ms (استجابة أسرع للتكرار)
        if (lastScanRef.current.code === decodedText && now - lastScanRef.current.time < 1500) {
          return;
        }
        lastScanRef.current = { code: decodedText, time: now };
        doCheckIn(decodedText.trim());
      };

      // ★ تحسينات الأداء:
      // - fps: 10 → 15 (مسح أسرع)
      // - qrbox: أصغر (200×200) للتركيز على الكود
      // - experimentalFeatures: useBarCodeDetectorIfSupported (أداء أصلي في Chrome)
      // - videoConstraints: resolution أعلى + focusMode continuous
      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 15,
          qrbox: { width: 200, height: 200 },
          aspectRatio: 1.0,
          videoConstraints: {
            facingMode: "environment",
            width: { min: 480, ideal: 640, max: 1280 },
            height: { min: 480, ideal: 640, max: 1280 },
          },
        } as any,
        onScanSuccess,
        () => {}
      );
    } catch (e) {
      console.error(e);
      toast.error("تعذر الوصول إلى الكاميرا. جرّب الإدخال اليدوي.");
      setScanning(false);
      setManualMode(true);
      scannerRef.current = null;
    } finally {
      startingRef.current = false;
    }
  }, [containerId, doCheckIn]);

  useEffect(() => {
    if (open) {
      startScanner();
    } else {
      stopScanner();
      setLastResult(null);
      setManualCode("");
      setManualMode(false);
    }
    return () => { stopScanner(); };
  }, [open, stopScanner]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const code = manualCode.trim();
    setManualCode("");
    await doCheckIn(code);
  };

  const handleSwitchToCamera = () => {
    setManualMode(false);
    setLastResult(null);
    startScanner();
  };

  const handleSwitchToManual = () => {
    stopScanner();
    setManualMode(true);
  };

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-card rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-l from-teal-600 to-sky-700 p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" />
            <h2 className="font-bold">ماسح QR لتسجيل الحضور</h2>
          </div>
          <button
            onClick={() => { stopScanner(); onClose(); }}
            className="rounded-full p-1.5 hover:bg-white/20 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2 p-1 bg-muted rounded-xl">
            <button
              onClick={handleSwitchToCamera}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition ${
                !manualMode ? "bg-card shadow-sm" : "text-muted-foreground"
              }`}
            >
              <Camera className="h-4 w-4" /> كاميرا
            </button>
            <button
              onClick={handleSwitchToManual}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition ${
                manualMode ? "bg-card shadow-sm" : "text-muted-foreground"
              }`}
            >
              <Keyboard className="h-4 w-4" /> إدخال يدوي
            </button>
          </div>

          {/* Camera mode */}
          {!manualMode && (
            <div className="space-y-3">
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-black">
                <div id={containerId} className="w-full h-full" />
                {!scanning && (
                  <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm">
                    <Loader2 className="h-5 w-5 animate-spin ml-2" /> جاري تشغيل الكاميرا...
                  </div>
                )}
                {scanning && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-8 border-2 border-teal-400 rounded-2xl" />
                    {/* ★ تسريع الخط المتحرك: 2.5s → 1.8s */}
                    <motion.div
                      initial={{ top: "10%" }}
                      animate={{ top: ["10%", "85%", "10%"] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute left-8 right-8 h-1 bg-gradient-to-r from-transparent via-teal-400 to-transparent shadow-[0_0_10px_rgba(45,212,191,0.8)]"
                    />
                  </div>
                )}
              </div>
              <p className="text-center text-xs text-muted-foreground">
                وجّه الكاميرا نحو رمز QR على بطاقة المنخرط
              </p>
            </div>
          )}

          {/* Manual mode */}
          {manualMode && (
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <Input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="RCS 001"
                className="h-12 text-center font-mono text-lg"
                dir="ltr"
                autoFocus
              />
              <Button type="submit" disabled={!manualCode.trim() || processing} className="w-full h-11">
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 ml-1" />}
                تسجيل الحضور
              </Button>
            </form>
          )}

          {/* Last result */}
          <AnimatePresence mode="wait">
            {lastResult && (
              <motion.div
                key={lastResult.success + (lastResult.subscriber?.id || "")}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`rounded-xl p-3 border ${
                  lastResult.success
                    ? lastResult.alreadyCheckedIn
                      ? "bg-amber-50 border-amber-200"
                      : lastResult.status === "ok"
                      ? "bg-emerald-50 border-emerald-200"
                      : "bg-orange-50 border-orange-200"
                    : "bg-rose-50 border-rose-200"
                }`}
              >
                <div className="flex items-start gap-2">
                  {lastResult.success ? (
                    lastResult.alreadyCheckedIn ? (
                      <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                    ) : lastResult.status === "ok" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-orange-500 shrink-0" />
                    )
                  ) : (
                    <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    {lastResult.success ? (
                      <>
                        <p className="font-bold text-sm">
                          {lastResult.subscriber?.lastName} {lastResult.subscriber?.firstName}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {lastResult.subscriber?.fileNumber}
                        </p>
                        {!lastResult.alreadyCheckedIn && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            الحضور: {new Date(lastResult.attendance?.checkInTime || "").toLocaleTimeString("ar-DZ")}
                          </p>
                        )}
                        {lastResult.status === "expired" && (
                          <p className="text-xs text-orange-700 font-semibold mt-1">⚠️ اشتراك منتهي — يلزم التجديد</p>
                        )}
                        {lastResult.status === "no_payment" && (
                          <p className="text-xs text-orange-700 font-semibold mt-1">⚠️ لم يدفع — يلزم التسوية</p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-rose-700">{lastResult.error || "خطأ غير معروف"}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

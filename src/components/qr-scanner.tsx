"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, ScanLine, CheckCircle2, AlertCircle, Loader2, Keyboard, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { notifySuccess, notifyWarning, notifyError } from "@/lib/sounds";
import type { SubscriberWithComputed } from "@/lib/rcs";
import { usePools } from "@/hooks/use-pools";

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

export interface CandidateEnrollment {
  id?: string;
  enrollmentId?: string;
  poolId: string;
  poolName?: string;
  fileNumber?: string;
  subscriptionType: string;
  status?: string;
  subscriberName?: string;
  pool?: {
    id: string;
    name: string;
    color?: string | null;
    fileNumberPrefix?: string | null;
  };
  subscriber?: {
    id: string;
    lastName: string;
    firstName: string;
    fileNumber: string;
  };
}

interface QRScannerProps {
  open: boolean;
  onClose: () => void;
  poolId?: string | null;
  onCheckIn?: (result: CheckInResult) => void;
}

export function QRScanner({ open, onClose, poolId: propPoolId, onCheckIn }: QRScannerProps) {
  const { currentPoolId } = usePools();
  const rawPoolId = propPoolId !== undefined ? propPoolId : currentPoolId;
  const effectivePoolId = rawPoolId && rawPoolId !== "all" ? rawPoolId : null;

  const scannerRef = useRef<Html5Qrcode | null>(null);
  // ★ معرّف فريد للحاوية لتفادي إعادة استخدام نفس العنصر (يزيد الاستقرار)
  const containerId = useRef(`qr-reader-${Date.now()}`).current;
  const [scanning, setScanning] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [lastResult, setLastResult] = useState<CheckInResult | null>(null);
  const [ambiguousCandidates, setAmbiguousCandidates] = useState<CandidateEnrollment[] | null>(null);
  const [ambiguousScannedCode, setAmbiguousScannedCode] = useState<string>("");
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

  const doCheckIn = useCallback(async (fileNumber: string, specificPoolId?: string) => {
    // ★ منع المعالجة المتزامنة: استخدم flag بدلاً من setProcessing callback
    if (processing) return;
    setProcessing(true);
    try {
      const { offlineFetch } = await import("@/hooks/use-offline-mutation");
      const targetPoolId =
        specificPoolId !== undefined
          ? specificPoolId
          : effectivePoolId && effectivePoolId !== "all"
          ? effectivePoolId
          : undefined;
      const res = await offlineFetch("/api/qr-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileNumber, poolId: targetPoolId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.ambiguous && Array.isArray(data.candidateEnrollments)) {
          notifyWarning();
          setAmbiguousScannedCode(fileNumber);
          setAmbiguousCandidates(data.candidateEnrollments);
          toast.warning("يوجد أكثر من انخراط بهذا الرقم في مسابح مختلفة، اختر المسبح للتأكيد");
          return;
        }
        setAmbiguousCandidates(null);
        setAmbiguousScannedCode("");
        notifyError();
        toast.error(data.error || "فشل تسجيل الحضور");
        setLastResult({ success: false, error: data.error, subscriber: data.subscriber });
      } else if (data.offline) {
        setAmbiguousCandidates(null);
        notifySuccess();
        toast.success("✓ تم تسجيل الحضور محلياً — سيُزامن عند عودة الاتصال");
        setLastResult({ success: true, offline: true, subscriber: { fileNumber, lastName: "", firstName: "" } as any, status: "offline" });
      } else {
        setAmbiguousCandidates(null);
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
  }, [processing, effectivePoolId]);

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
      setAmbiguousCandidates(null);
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

          {/* Ambiguous candidates disambiguation */}
          {ambiguousCandidates && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl p-4 border border-amber-500/40 bg-amber-500/10 space-y-3"
            >
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
                <span>الرقم مسجل في أكثر من مسبح: حدد المسبح</span>
              </div>
              <p className="text-xs text-amber-200/80 leading-relaxed">
                تم العثور على انخراطات متعددة بهذا الرقم. اختر المسبح المستهدف لتسجيل الحضور مباشرة:
              </p>
              <div className="space-y-2">
                {ambiguousCandidates.map((cand) => {
                  const poolDisplayName = cand.pool?.name || cand.poolName || "مسبح";
                  const memberDisplayName = cand.subscriber
                    ? `${cand.subscriber.lastName} ${cand.subscriber.firstName}`
                    : cand.subscriberName || "";
                  const codeToUse = cand.fileNumber || ambiguousScannedCode;
                  const candStatus = cand.status || "active";
                  return (
                    <button
                      key={cand.id || cand.enrollmentId || cand.poolId}
                      type="button"
                      disabled={processing}
                      onClick={() => doCheckIn(codeToUse, cand.poolId)}
                      className="w-full text-right p-3 rounded-xl bg-card border border-border hover:border-sky-500 hover:bg-sky-500/5 transition flex items-center justify-between group cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-sm text-foreground group-hover:text-sky-400">
                          <Waves className="h-4 w-4 text-sky-400" />
                          <span>{poolDisplayName}</span>
                          {cand.pool?.fileNumberPrefix && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono">
                              {cand.pool.fileNumberPrefix}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                          {memberDisplayName ? `${memberDisplayName} — ` : ""}
                          رقم الملف: {codeToUse} | {cand.subscriptionType}
                        </p>
                      </div>
                      <div className="text-left shrink-0">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                          candStatus === "active" ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"
                        }`}>
                          {candStatus === "active" ? "نشط" : candStatus}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setAmbiguousCandidates(null)}
                className="w-full text-xs text-muted-foreground hover:text-foreground h-8"
              >
                إلغاء واستئناف المسح
              </Button>
            </motion.div>
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

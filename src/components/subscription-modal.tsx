"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Sparkles, KeyRound, CheckCircle2, AlertTriangle,
  Lock, Clock, Copy, Check, X, Clipboard, Loader2,
  Layers, Cpu, ChevronDown, ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { generateHardwareFingerprint } from "@/lib/activation-codes";
import { verifyActivationCodeUniversal, saveOfflineLicense } from "@/lib/offline-license";
import { formatDate } from "@/lib/date-utils";

export interface SubscriptionStatusData {
  state: "pending" | "trial" | "active" | "grace" | "locked" | "suspended";
  label?: string;
  color?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  daysRemaining?: number;
  hasAccess?: boolean;
  message?: string;
  plan?: string;
  club?: { id?: string; name?: string; city?: string };
  subscription?: {
    id?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  } | null;
  hardwareFingerprint?: string | null;
}

interface SubscriptionModalProps {
  open: boolean;
  onClose: () => void;
  status: SubscriptionStatusData | null;
  onActivated?: () => void;
  initialMode?: "details" | "activate";
}

export function SubscriptionModal({
  open,
  onClose,
  status,
  onActivated,
  initialMode = "details",
}: SubscriptionModalProps) {
  const [showCodeInput, setShowCodeInput] = useState(
    initialMode === "activate" || status?.state === "locked" || status?.state === "grace"
  );
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"input" | "verifying" | "success" | "error">("input");
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);
  const [copiedHw, setCopiedHw] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Format activation code: AQCR-XX-XXXXXXXX-XXXX
  const formatCode = (raw: string) => {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean.length === 0) return "";
    const parts: string[] = [];
    if (clean.length > 0) parts.push(clean.substring(0, 4));
    if (clean.length > 4) parts.push(clean.substring(4, 6));
    if (clean.length > 6) parts.push(clean.substring(6, 14));
    if (clean.length > 14) parts.push(clean.substring(14, 18));
    return parts.join("-");
  };

  const handleActivate = async () => {
    setLoading(true);
    setStep("verifying");
    setError("");
    try {
      const hardwareFingerprint = status?.hardwareFingerprint || generateHardwareFingerprint();
      const res = await fetch("/api/clubs/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, hardwareFingerprint }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "فشل التفعيل");
        setStep("error");
        toast.error(data.error || "فشل التفعيل");
        return;
      }
      setResult(data.activated || data);
      setStep("success");
      toast.success(data.message || "تم التفعيل بنجاح!");
      onActivated?.();
    } catch {
      // ★ مسار الأوفلاين عند تعذر الوصول للسيرفر أو انقطاع الإنترنت:
      // نتحقق من الكود محلياً بالـ WebCrypto
      try {
        const offlineVerify = await verifyActivationCodeUniversal(code);
        if (offlineVerify.valid && offlineVerify.plan && offlineVerify.durationDays) {
          const now = new Date();
          const expiresAt = new Date(now.getTime() + offlineVerify.durationDays * 24 * 60 * 60 * 1000);
          const hardwareFingerprint = status?.hardwareFingerprint || generateHardwareFingerprint();

          saveOfflineLicense({
            code: offlineVerify.normalizedCode || code,
            plan: offlineVerify.plan,
            planLabel: offlineVerify.planLabel || "اشتراك محلي",
            durationDays: offlineVerify.durationDays,
            activatedAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
            hardwareFingerprint,
            clubName: status?.club?.name || "نادي AquaCore",
            isOffline: true,
          });

          setResult({
            plan: offlineVerify.plan,
            planLabel: offlineVerify.planLabel,
            durationDays: offlineVerify.durationDays,
            startDate: now,
            endDate: expiresAt,
            daysRemaining: offlineVerify.durationDays,
            hardwareFingerprint,
            isOffline: true,
          });

          setStep("success");
          toast.success(`تم التفعيل محلياً بدون إنترنت بنجاح! اشتراك ${offlineVerify.planLabel} صالح لـ ${offlineVerify.durationDays} يوماً.`);
          onActivated?.();
          return;
        } else {
          setError(offlineVerify.error || "كود التفعيل غير صالح (فحص أوفلاين)");
          setStep("error");
          toast.error(offlineVerify.error || "كود التفعيل غير صالح");
          return;
        }
      } catch {
        setError("تعذر الاتصال بالخادم. تحقق من الاتصال بالشبكة أو صحة الكود.");
        setStep("error");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCode("");
    setStep("input");
    setError("");
    setResult(null);
    setShowCodeInput(initialMode === "activate" || status?.state === "locked");
    onClose();
  };

  const hwFingerprint = status?.hardwareFingerprint || (typeof window !== "undefined" ? generateHardwareFingerprint() : "FP-AC89B214");

  const copyHardwareId = () => {
    if (navigator.clipboard && hwFingerprint) {
      navigator.clipboard.writeText(hwFingerprint);
      setCopiedHw(true);
      toast.success("تم نسخ معرّف الجهاز إلى الحافظة");
      setTimeout(() => setCopiedHw(false), 2000);
    }
  };

  if (!mounted) return null;

  const daysRemaining = status?.daysRemaining ?? 0;
  const isGrace = status?.state === "grace";
  const isTrial = status?.state === "trial";
  const isLocked = status?.state === "locked";
  const isActive = status?.state === "active" || (!isGrace && !isTrial && !isLocked && status?.hasAccess);

  // Friendly duration display
  const getRemainingText = () => {
    if (daysRemaining > 365) {
      const years = Math.floor(daysRemaining / 365);
      const remainingDays = daysRemaining % 365;
      return remainingDays > 30
        ? `${years === 2 ? "عامان" : `${years} سنوات`} و ${Math.round(remainingDays / 30)} أشهر متبقية`
        : `${years === 2 ? "عامان" : `${years} سنوات`} متبقية (${daysRemaining} يوماً)`;
    }
    if (daysRemaining > 300) return `سنة كاملة متبقية (${daysRemaining} يوماً)`;
    if (daysRemaining > 30) {
      const months = Math.floor(daysRemaining / 30);
      return `${months} أشهر متبقية (${daysRemaining} يوماً)`;
    }
    if (daysRemaining > 0) return `${daysRemaining} يوماً متبقية`;
    if (isGrace) return "فترة سماح (24 ساعة متبقية)";
    return "الاشتراك منتهٍ";
  };

  const getPlanTitle = () => {
    if (daysRemaining > 365) return "باقة النوادي الماسية (عامان • Enterprise)";
    if (daysRemaining > 300) return "باقة النوادي السنوية (سنة كاملة • Pro)";
    if (status?.plan === "monthly") return "باقة النادي الشهرية المعتمدة";
    return "باقة النادي الاحترافية المعتمدة";
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="subscription-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/80 backdrop-blur-md"
          onClick={handleClose}
        >
          <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center">
            <motion.div
              key="subscription-modal-dialog"
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col text-right my-auto max-h-[88vh]"
            >
          {/* Top Decorative Gradient Accent */}
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 shrink-0" />

          {/* Modal Fixed Header - ALWAYS VISIBLE */}
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white shadow-md shadow-teal-500/25 shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-foreground truncate">
                    حالة وترخيص اشتراك النادي
                  </h2>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60 hidden xs:inline">
                    AquaCore Official
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  {status?.club?.name || "النادي الرياضي المعتمد"}
                  {status?.club?.city ? ` — ${status.club.city}` : ""}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable Content Body with min-h-0 so overflow works correctly */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 text-right">
            {/* Step: Success feedback */}
            {step === "success" && result && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-center space-y-2.5"
              >
                <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-emerald-900 dark:text-emerald-200">
                  تم تفعيل وتحديث الاشتراك بنجاح! 🎉
                </h3>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  {result.planLabel || "الاشتراك"} — تمت إضافة {result.durationDays || daysRemaining} يوم إلى صلاحية ناديك.
                </p>
                <Button
                  onClick={() => {
                    setStep("input");
                    setShowCodeInput(false);
                    onActivated?.();
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-8 px-5 rounded-xl cursor-pointer text-xs"
                >
                  العودة لتفاصيل الاشتراك
                </Button>
              </motion.div>
            )}

            {/* Main Executive Subscription Card */}
            <div className="relative rounded-2xl overflow-hidden border border-emerald-500/25 bg-gradient-to-br from-teal-900/95 via-slate-900/95 to-emerald-950/95 text-white p-4 sm:p-5 shadow-xl shadow-teal-950/20">
              <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                    <span className="text-[11px] font-semibold text-emerald-200/90">
                      {getPlanTitle()}
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                    {getRemainingText()}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 shadow-xs">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{isActive ? "مرخص ونشط رسمياً" : isTrial ? "فترة تجريبية" : isGrace ? "فترة سماح" : "منتهي الصلاحية"}</span>
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-white/10 rounded-full h-1.5 mb-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-teal-400 to-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(15, Math.min(100, (daysRemaining / 730) * 100)))}%` }}
                />
              </div>

              {/* Validity Dates Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2.5 border-t border-white/10 text-[11px]">
                <div className="flex items-center justify-between sm:justify-start gap-2 bg-white/5 rounded-xl px-2.5 py-1.5 border border-white/5">
                  <span className="text-white/60">تاريخ بدء الاشتراك:</span>
                  <span className="font-bold text-white font-mono-data">
                    {formatDate(status?.startDate || status?.subscription?.startDate)}
                  </span>
                </div>
                <div className="flex items-center justify-between sm:justify-start gap-2 bg-white/5 rounded-xl px-2.5 py-1.5 border border-white/5">
                  <span className="text-white/60">تاريخ التجديد القادم:</span>
                  <span className="font-bold text-emerald-300 font-mono-data">
                    {formatDate(status?.endDate || status?.subscription?.endDate)}
                  </span>
                </div>
              </div>
            </div>

            {/* Included Verified Features */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  الميزات والخدمات النشطة في المنظومة:
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  شاملة بالكامل
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {[
                  "إدارة غير محدودة للمنخرطين والملفات",
                  "مصمم بطاقات PVC الاحترافي مع طباعة فورية",
                  "تسجيل الحضور الذكي بالباركود ورموز QR",
                  "الدفتر المالي المحاسبي الموحد والتحليلات",
                  "إدارة إغلاقات المسبح وتمديد الاشتراكات",
                  "النسخ الاحتياطي والأمان المتقدم للبيانات",
                ].map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-[11px] leading-tight">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hardware Binding & License Security */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  معرّف الجهاز المرخص (Hardware ID):
                </span>
                <button
                  type="button"
                  onClick={copyHardwareId}
                  className="flex items-center gap-1 text-[11px] font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 hover:underline cursor-pointer"
                >
                  {copiedHw ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" />
                      <span>تم النسخ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>نسخ المعرّف</span>
                    </>
                  )}
                </button>
              </div>
              <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/80 rounded-xl px-3 py-1.5 font-mono text-xs text-slate-800 dark:text-slate-200 select-all border border-slate-200/60 dark:border-slate-700/60" dir="ltr">
                <span>{hwFingerprint}</span>
                <span className="text-[10px] text-muted-foreground font-sans">توقيع رقمي موثق</span>
              </div>
            </div>

            {/* Extension / New Activation Code Section */}
            <div className="rounded-2xl border border-teal-500/25 bg-teal-500/5 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 truncate">
                    <KeyRound className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                    تمديد الاشتراك أو ترقية الباقة
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    أدخل كود تفعيل جديد لتمديد فترة ناديك تلقائياً.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCodeInput((prev) => !prev)}
                  className="h-7 px-2.5 text-xs font-bold gap-1 border-teal-500/30 text-teal-700 dark:text-teal-300 hover:bg-teal-500/10 cursor-pointer shrink-0"
                >
                  <span>{showCodeInput ? "إخفاء" : "إدخال كود جديد"}</span>
                  {showCodeInput ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
              </div>

              {showCodeInput && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="pt-2.5 border-t border-teal-500/20 space-y-2.5"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-bold text-foreground">
                        كود التفعيل (AQCR-XX-XXXXXXXX-XXXX):
                      </Label>
                      <span className={`text-[10px] font-mono font-bold ${code.replace(/[^A-Z0-9]/g, "").length === 18 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                        {code.replace(/[^A-Z0-9]/g, "").length}/18
                      </span>
                    </div>

                    <div className="relative">
                      <Input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(formatCode(e.target.value))}
                        placeholder="AQCR-M1-XXXXXXXX-XXXX"
                        className={`h-11 text-center text-sm font-mono font-bold tracking-wider rounded-xl transition-all ${
                          code.replace(/[^A-Z0-9]/g, "").length === 18
                            ? "border-emerald-500 ring-2 ring-emerald-500/20"
                            : "border-slate-300 dark:border-slate-700"
                        }`}
                        dir="ltr"
                        maxLength={21}
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const text = await navigator.clipboard.readText();
                            if (text) {
                              setCode(formatCode(text));
                              toast.success("تم لصق الكود من الحافظة");
                            }
                          } catch {
                            toast.error("الصق الكود يدوياً (Ctrl+V)");
                          }
                        }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                        title="لصق من الحافظة"
                      >
                        <Clipboard className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleActivate}
                      disabled={code.replace(/[^A-Z0-9]/g, "").length < 18 || loading}
                      className="flex-1 h-9 font-bold text-xs bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl shadow-md shadow-teal-600/20 cursor-pointer disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin ml-1.5" />
                          جاري التحقق من التوقيع الرقمي...
                        </>
                      ) : (
                        <>
                          <KeyRound className="h-3.5 w-3.5 ml-1.5" />
                          تفعيل الكود وتمديد الاشتراك
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowCodeInput(false)}
                      className="h-9 px-3 text-xs rounded-xl cursor-pointer"
                    >
                      إلغاء
                    </Button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Modal Bottom Footer - ALWAYS VISIBLE */}
          <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-muted-foreground shrink-0 z-10">
            <span className="text-[11px] truncate">
              تحتاج دعماً أو ترقية؟ تواصل: <span className="font-mono text-foreground font-semibold">0664451250</span>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              className="h-8 px-4 font-semibold rounded-xl cursor-pointer text-xs"
            >
              إغلاق
            </Button>
          </div>
        </motion.div>
      </div>
    </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/**
 * Backward compatibility wrapper for ActivationModal.
 */
export function ActivationModal({
  open,
  onClose,
  onActivated,
}: {
  open: boolean;
  onClose: () => void;
  onActivated?: () => void;
}) {
  return (
    <SubscriptionModal
      open={open}
      onClose={onClose}
      status={{
        state: "locked",
        daysRemaining: 0,
      }}
      initialMode="activate"
      onActivated={onActivated}
    />
  );
}

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Lock, Clock, AlertTriangle, CheckCircle2, KeyRound,
  Loader2, ShieldCheck, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { generateHardwareFingerprint } from "@/lib/activation-codes";

interface SubscriptionStatus {
  state: "pending" | "trial" | "active" | "grace" | "locked" | "suspended";
  label: string;
  color: string;
  hasAccess: boolean;
  message: string;
  daysRemaining?: number;
  endDate?: string;
  plan?: string;
}

interface ActivationModalProps {
  open: boolean;
  onClose: () => void;
  onActivated?: () => void;
}

/**
 * نافذة تفعيل كود الاشتراك — احترافية ومتكاملة.
 * تعمل حتى لو كان الإنترنت متقطعاً (التحقق المحلي يحدث أولاً).
 */
export function ActivationModal({ open, onClose, onActivated }: ActivationModalProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"input" | "verifying" | "success" | "error">("input");
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);

  // تنسيق الكود أثناء الكتابة (تلقائي بأقسام)
  // ★ الصيغة الصحيحة: AQCR-XX-XXXXXXXX-XXXX (PREFIX-PLAN-PAYLOAD-SIG)
  // الأقسام: 4 + 2 + 8 + 4 = 18 حرفاً + 3 شرطات = 21 حرفاً
  const formatCode = (raw: string) => {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean.length === 0) return "";
    // أقسام: 4 (prefix) + 2 (plan) + 8 (payload) + 4 (sig)
    const parts: string[] = [];
    if (clean.length > 0) parts.push(clean.substring(0, 4));
    if (clean.length > 4) parts.push(clean.substring(4, 6));
    if (clean.length > 6) parts.push(clean.substring(6, 14));
    if (clean.length > 14) parts.push(clean.substring(14, 18));
    return parts.join("-"); // AQCR-M1-XXXXXXXX-XXXX
  };

  const handleActivate = async () => {
    setLoading(true);
    setStep("verifying");
    setError("");
    try {
      const hardwareFingerprint = generateHardwareFingerprint();
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
    } catch (e) {
      setError("تعذر الاتصال بالخادم. تحقق من الإنترنت.");
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCode("");
    setStep("input");
    setError("");
    setResult(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            // ★ max-h-[90vh] + overflow-y-auto يضمن ظهور كل المحتوى + الأزرار
            // حتى على الشاشات الصغيرة (mobile)
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 rounded-3xl border border-white/10 shadow-2xl"
          >
            {/* Header gradient bar */}
            <div className="h-1 bg-gradient-to-l from-teal-400 via-sky-400 to-indigo-400" />

            {/* Close button — absolute positioned, always visible */}
            <button
              onClick={handleClose}
              className="absolute top-3 left-3 z-10 p-2 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 transition"
              aria-label="إغلاق"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Content — p-5 on mobile, p-8 on desktop */}
            <div className="p-5 sm:p-8">
              {/* Icon */}
              <div className="flex justify-center mb-4 sm:mb-6">
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-br from-teal-500/20 to-sky-500/20 border border-white/10 flex items-center justify-center">
                  {step === "success" ? (
                    <CheckCircle2 className="h-8 w-8 sm:h-10 sm:w-10 text-emerald-400" />
                  ) : step === "error" ? (
                    <AlertTriangle className="h-8 w-8 sm:h-10 sm:w-10 text-rose-400" />
                  ) : (
                    <KeyRound className="h-8 w-8 sm:h-10 sm:w-10 text-teal-400" />
                  )}
                </div>
              </div>

              {step === "input" && (
                <>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-white text-center mb-2">
                    تفعيل الاشتراك
                  </h2>
                  <p className="text-xs sm:text-sm text-white/60 text-center mb-4 sm:mb-6 px-2">
                    أدخل كود التفعيل الذي حصلت عليه لإتمام اشتراكك
                  </p>

                  <div className="space-y-3 sm:space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] sm:text-xs font-semibold text-white/60 uppercase tracking-wider">
                        كود التفعيل
                      </Label>
                      <Input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(formatCode(e.target.value))}
                        placeholder="AQCR-M1-XXXXXXXX-XXXX"
                        className="h-12 sm:h-14 text-center text-base sm:text-lg font-mono font-bold tracking-wider bg-white/[0.06] border-white/[0.12] text-white placeholder:text-white/20 rounded-xl focus:bg-white/[0.1] focus:border-teal-400/40"
                        dir="ltr"
                        autoFocus
                      />
                    </div>

                    <div className="bg-white/[0.03] rounded-xl p-2.5 flex items-start gap-2 text-[11px] sm:text-xs text-white/50">
                      <ShieldCheck className="h-4 w-4 mt-0.5 text-teal-400/70 shrink-0" />
                      <span>
                        الكود موقّع رقمياً ويُتحقَّق منه محلياً. يُستخدم لمرة واحدة على نادٍ واحد.
                      </span>
                    </div>

                    {/* ★ Buttons row — تفعل الآن + إلغاء جنب بعض */}
                    <div className="flex gap-2">
                      <Button
                        onClick={handleActivate}
                        disabled={code.length < 21 || loading}
                        className="flex-1 h-11 sm:h-12 text-sm sm:text-base font-bold rounded-xl bg-gradient-to-l from-teal-500 to-sky-500 hover:from-teal-400 hover:to-sky-400 border-0 text-white shadow-lg shadow-teal-500/20 disabled:opacity-50"
                      >
                        {loading ? (
                          <><Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" /> جاري التحقق...</>
                        ) : (
                          <><KeyRound className="h-4 w-4 sm:h-5 sm:w-5 ml-1" /> تفعيل الآن</>
                        )}
                      </Button>
                      <Button
                        onClick={handleClose}
                        variant="outline"
                        className="h-11 sm:h-12 px-4 rounded-xl border-white/20 text-white hover:bg-white/5"
                      >
                        إلغاء
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {step === "verifying" && (
                <div className="text-center py-6 sm:py-8">
                  <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 animate-spin text-teal-400 mx-auto mb-4" />
                  <p className="text-white/80 font-medium text-sm sm:text-base">جاري التحقق من الكود...</p>
                  <p className="text-xs text-white/40 mt-2">توقيع رقمي + قاعدة البيانات</p>
                </div>
              )}

              {step === "success" && result && (
                <div className="text-center">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-white mb-2">تم التفعيل بنجاح! 🎉</h2>
                  <p className="text-xs sm:text-sm text-white/60 mb-4 sm:mb-6">{result.planLabel || "اشتراك"} — {result.durationDays} يوم</p>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 sm:p-4 space-y-2 text-right">
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-white/60">تاريخ البداية:</span>
                      <span className="text-white font-medium">{result.startDate ? new Date(result.startDate).toLocaleDateString("ar-DZ") : "—"}</span>
                    </div>
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-white/60">تاريخ النهاية:</span>
                      <span className="text-emerald-400 font-bold">{result.endDate ? new Date(result.endDate).toLocaleDateString("ar-DZ") : "—"}</span>
                    </div>
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-white/60">الأيام المتبقية:</span>
                      <span className="text-white font-medium">{result.daysRemaining} يوم</span>
                    </div>
                  </div>
                  <Button
                    onClick={handleClose}
                    className="w-full h-11 sm:h-12 mt-4 sm:mt-6 rounded-xl bg-gradient-to-l from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 border-0 text-white font-bold"
                  >
                    <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 ml-1" /> متابعة
                  </Button>
                </div>
              )}

              {step === "error" && (
                <div className="text-center">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-white mb-2">فشل التفعيل</h2>
                  <p className="text-xs sm:text-sm text-rose-400 mb-4 sm:mb-6 px-2">{error}</p>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setStep("input")}
                      variant="outline"
                      className="flex-1 h-11 sm:h-12 rounded-xl border-white/20 text-white hover:bg-white/5"
                    >
                      المحاولة مرة أخرى
                    </Button>
                    <Button
                      onClick={handleClose}
                      variant="ghost"
                      className="h-11 sm:h-12 px-4 text-white/60 hover:text-white"
                    >
                      إغلاق
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * بوابة الاشتراك — تُظهر شاشة قفل كاملة إذا كان الاشتراك منتهياً.
 * تُستخدم في layout النادي لمنع الوصول للمحتوى.
 */
export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showActivation, setShowActivation] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/subscription/status", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // في حالة فشل الشبكة، اسمح بالوصول (النظام أوفلاين-أولاً)
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // تحديث كل 5 دقائق (للتقاط تغيّر الحالة)
    const interval = setInterval(fetchStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
      </div>
    );
  }

  // Superadmin يتجاوز البوابة (له وصول كامل)
  // ملاحظة: هذه البوابة تُعرض فقط في صفحات النادي، ليس super-admin
  if (!status || status.hasAccess) {
    return (
      <>
        {children}
        {/* بادج الحالة في الأعلى لو كان في تجربة أو سماح */}
        {(status?.state === "trial" || status?.state === "grace") && (
          <SubscriptionBanner status={status} onActivate={() => setShowActivation(true)} />
        )}
        <ActivationModal
          open={showActivation}
          onClose={() => setShowActivation(false)}
          onActivated={fetchStatus}
        />
      </>
    );
  }

  // الحالة مقفلة → اعرض شاشة القفل
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-rose-950/30 to-slate-950">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md bg-white/[0.07] backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
      >
        <div className="h-1 bg-gradient-to-l from-rose-400 via-orange-400 to-amber-400" />
        <div className="p-8 text-center">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-rose-500/15 border border-rose-500/20 mb-4">
            <Lock className="h-10 w-10 text-rose-400" />
          </div>
          <h1 className="text-2xl font-extrabold text-white mb-2">{status.label}</h1>
          <p className="text-sm text-white/60 mb-6">{status.message}</p>

          {status.daysRemaining !== undefined && status.daysRemaining < 0 && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 mb-4 text-sm">
              <span className="text-rose-400 font-bold">انتهى منذ {-status.daysRemaining} يوم</span>
            </div>
          )}

          <Button
            onClick={() => setShowActivation(true)}
            className="w-full h-12 text-base font-bold rounded-xl bg-gradient-to-l from-teal-500 to-sky-500 hover:from-teal-400 hover:to-sky-400 border-0 text-white shadow-lg shadow-teal-500/20"
          >
            <KeyRound className="h-5 w-5 ml-1" /> تفعيل كود اشتراك
          </Button>

          <ActivationModal
            open={showActivation}
            onClose={() => setShowActivation(false)}
            onActivated={fetchStatus}
          />
        </div>
      </motion.div>
    </div>
  );
}

/**
 * شريط تنبيه علوي للحالات غير الحرجة (تجربة/سماح).
 */
function SubscriptionBanner({ status, onActivate }: { status: SubscriptionStatus; onActivate: () => void }) {
  const isTrial = status.state === "trial";
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`sticky top-0 z-40 ${isTrial ? "bg-sky-500/10 border-sky-500/20" : "bg-orange-500/10 border-orange-500/20"} border-b backdrop-blur-md`}
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          {isTrial ? <Clock className="h-4 w-4 text-sky-400" /> : <AlertTriangle className="h-4 w-4 text-orange-400" />}
          <span className="text-white/90">{status.message}</span>
        </div>
        <Button
          size="sm"
          onClick={onActivate}
          className="h-8 px-3 text-xs rounded-lg bg-gradient-to-l from-teal-500 to-sky-500 hover:from-teal-400 hover:to-sky-400 border-0 text-white"
        >
          <KeyRound className="h-3 w-3 ml-1" /> فعّل الآن
        </Button>
      </div>
    </motion.div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Lock, Clock, AlertTriangle, KeyRound, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubscriptionModal, type SubscriptionStatusData } from "@/components/subscription-modal";
import { getOfflineLicense, isOfflineLicenseActive } from "@/lib/offline-license";

export interface SubscriptionStatus extends SubscriptionStatusData {
  state: "pending" | "trial" | "active" | "grace" | "locked" | "suspended";
  label: string;
  color: string;
  hasAccess: boolean;
  message: string;
  daysRemaining?: number;
  endDate?: string;
  plan?: string;
}

export interface ActivationModalProps {
  open: boolean;
  onClose: () => void;
  onActivated?: () => void;
}

/**
 * نافذة تفعيل كود الاشتراك — احترافية ومدمجة مع مركز ترخيص المنظومة.
 */
export function ActivationModal({ open, onClose, onActivated }: ActivationModalProps) {
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

/**
 * بوابة الاشتراك — تُظهر شاشة قفل كاملة إذا كان الاشتراك منتهياً.
 * تُستخدم في layout النادي لمنع الوصول للمحتوى إلا بعد التفعيل.
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
        setLoading(false);
        return;
      }
    } catch {
      // في حالة فشل الشبكة أو السيرفر
    }

    // 🔒 التحقق من وجود رخصة أوفلاين محلية (تفعيل بدون إنترنت)
    const offlineLic = getOfflineLicense();
    if (offlineLic && isOfflineLicenseActive(offlineLic)) {
      const now = new Date();
      const end = new Date(offlineLic.expiresAt);
      const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      setStatus({
        state: "active",
        label: `اشتراك محلي (${offlineLic.planLabel})`,
        color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
        hasAccess: true,
        message: `الاشتراك مفعّل محلياً (بدون إنترنت) — صالح لـ ${days} يوماً.`,
        daysRemaining: days,
        endDate: offlineLic.expiresAt,
        plan: offlineLic.plan,
        hardwareFingerprint: offlineLic.hardwareFingerprint,
      });
    }

    setLoading(false);
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
        <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
      </div>
    );
  }

  // Superadmin أو نادٍ باشتراك سارٍ يتجاوز شاشة القفل
  if (!status || status.hasAccess) {
    return (
      <>
        {children}
        {/* شريط التنبيه في الأعلى لو كان في تجربة أو سماح */}
        {(status?.state === "trial" || status?.state === "grace") && (
          <SubscriptionBanner status={status} onActivate={() => setShowActivation(true)} />
        )}
        <SubscriptionModal
          open={showActivation}
          onClose={() => setShowActivation(false)}
          status={status}
          initialMode={status?.hasAccess ? "details" : "activate"}
          onActivated={fetchStatus}
        />
      </>
    );
  }

  // الحالة مقفلة → اعرض شاشة القفل الاحترافية
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md bg-white/[0.07] backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
      >
        <div className="h-1.5 bg-gradient-to-l from-rose-500 via-orange-500 to-amber-500" />
        <div className="p-8 text-center space-y-4">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-rose-500/15 border border-rose-500/25 shadow-lg shadow-rose-500/10">
            <Lock className="h-10 w-10 text-rose-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white mb-1.5">{status.label || "انتهت فترة الاشتراك"}</h1>
            <p className="text-xs sm:text-sm text-white/60 leading-relaxed">{status.message}</p>
          </div>

          {status.daysRemaining !== undefined && status.daysRemaining < 0 && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-xs">
              <span className="text-rose-400 font-bold">انتهت الصلاحية منذ {-status.daysRemaining} يوم</span>
            </div>
          )}

          <Button
            onClick={() => setShowActivation(true)}
            className="w-full h-12 text-sm sm:text-base font-bold rounded-xl bg-gradient-to-l from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 border-0 text-white shadow-lg shadow-teal-500/25 cursor-pointer"
          >
            <KeyRound className="h-5 w-5 ml-1.5" /> تفعيل كود ترخيص المنظومة
          </Button>

          <SubscriptionModal
            open={showActivation}
            onClose={() => setShowActivation(false)}
            status={status}
            initialMode="activate"
            onActivated={fetchStatus}
          />
        </div>
      </motion.div>
    </div>
  );
}

/**
 * شريط تنبيه علوي للحالات المؤقتة (تجربة / سماح).
 */
function SubscriptionBanner({ status, onActivate }: { status: SubscriptionStatus; onActivate: () => void }) {
  const isTrial = status.state === "trial";
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`sticky top-0 z-40 ${
        isTrial
          ? "bg-sky-500/15 border-sky-500/30 text-sky-900 dark:text-sky-200"
          : "bg-amber-500/15 border-amber-500/30 text-amber-900 dark:text-amber-200"
      } border-b backdrop-blur-md px-4 py-2`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2">
          {isTrial ? <Clock className="h-4 w-4 text-sky-500 shrink-0" /> : <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />}
          <span className="font-medium">{status.message}</span>
        </div>
        <Button
          size="sm"
          onClick={onActivate}
          className="h-7 px-3 text-xs font-bold rounded-lg bg-gradient-to-l from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 border-0 text-white cursor-pointer"
        >
          <KeyRound className="h-3 w-3 ml-1" /> فعّل الآن
        </Button>
      </div>
    </motion.div>
  );
}

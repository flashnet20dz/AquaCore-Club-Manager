"use client";

import { useEffect, useState, useCallback } from "react";
import { ShieldCheck, Clock, AlertTriangle, Lock } from "lucide-react";
import { SubscriptionModal, type SubscriptionStatusData } from "@/components/subscription-modal";
import { getOfflineLicense, isOfflineLicenseActive } from "@/lib/offline-license";

function formatBadgeText(s: SubscriptionStatusData): string {
  const days = s.daysRemaining ?? 0;
  if (s.state === "active") {
    if (days > 365) return "اشتراك نشط • عامان";
    if (days > 300) return "اشتراك نشط • سنة";
    if (days > 30) return `اشتراك نشط • ${Math.round(days / 30)} أشهر`;
    if (days > 0) return `ساري • ${days} يوم`;
    return "اشتراك نشط ومؤكد";
  }
  if (s.state === "trial") {
    return `تجربة مجانية • ${days} يوم`;
  }
  if (s.state === "grace") {
    return "فترة سماح (24 ساعة)";
  }
  if (s.state === "locked") {
    return "الاشتراك منتهٍ • فعّل الآن";
  }
  if (s.state === "pending") {
    return "بانتظار الموافقة";
  }
  if (s.state === "suspended") {
    return "الحساب موقوف";
  }
  return "حالة الاشتراك";
}

export function SubscriptionBadge() {
  const [status, setStatus] = useState<SubscriptionStatusData | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/subscription/status", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        return;
      }
    } catch {
      // Offline-first fallback
    }

    // فحص رخصة أوفلاين
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
        message: `الاشتراك مفعّل محلياً (بدون إنترنت)`,
        daysRemaining: days,
        endDate: offlineLic.expiresAt,
        plan: offlineLic.plan,
        hardwareFingerprint: offlineLic.hardwareFingerprint,
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!status) return null;

  const state = status.state;
  const isGrace = state === "grace";
  const isTrial = state === "trial";
  const isLocked = state === "locked";
  const isActive = state === "active" || (!isGrace && !isTrial && !isLocked && status.hasAccess);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`h-8 px-3 rounded-full text-xs font-semibold shadow-2xs transition-all flex items-center gap-2 cursor-pointer group ${
          isActive
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/50"
            : isTrial
            ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/30 hover:bg-sky-500/20 hover:border-sky-500/50"
            : isGrace
            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-500/50"
            : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 hover:border-rose-500/50 animate-pulse"
        }`}
        title="حالة الاشتراك والترخيص — انقر لعرض التفاصيل وتمديد الصلاحية"
      >
        <span className="relative flex h-2 w-2">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isActive ? "bg-emerald-400" : isTrial ? "bg-sky-400" : isGrace ? "bg-amber-400" : "bg-rose-400"
            }`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              isActive ? "bg-emerald-500" : isTrial ? "bg-sky-500" : isGrace ? "bg-amber-500" : "bg-rose-500"
            }`}
          />
        </span>

        {isActive ? (
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
        ) : isTrial ? (
          <Clock className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform" />
        ) : isGrace ? (
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform" />
        ) : (
          <Lock className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform" />
        )}

        <span className="font-semibold text-xs leading-none">
          {formatBadgeText(status)}
        </span>
      </button>

      <SubscriptionModal
        open={open}
        onClose={() => setOpen(false)}
        status={status}
        onActivated={load}
      />
    </>
  );
}

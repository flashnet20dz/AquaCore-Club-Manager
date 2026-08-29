"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Clock, ShieldCheck, AlertTriangle, Lock } from "lucide-react";
import { ActivationModal } from "@/components/subscription-gate";

interface Status {
  state: "pending" | "trial" | "active" | "grace" | "locked" | "suspended";
  daysRemaining?: number;
  plan?: string;
}

const STATE_META: Record<
  string,
  { icon: any; className: string; label: (s: Status) => string }
> = {
  trial: {
    icon: Clock,
    className: "border-sky-300 text-sky-700 bg-sky-50 hover:bg-sky-100",
    label: (s) => `تجربة — ${s.daysRemaining ?? 0} يوم`,
  },
  grace: {
    icon: AlertTriangle,
    className: "border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100",
    label: (s) => `سماح — ${s.daysRemaining ?? 0} يوم`,
  },
  locked: {
    icon: Lock,
    className: "border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100",
    label: () => "مقفل — فعّل الآن",
  },
  active: {
    icon: ShieldCheck,
    className: "border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100",
    label: (s) => (s.daysRemaining !== undefined ? `مفعَّل — ${s.daysRemaining} يوم` : "مفعَّل"),
  },
  pending: {
    icon: Clock,
    className: "border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100",
    label: () => "بانتظار الموافقة",
  },
  suspended: {
    icon: Lock,
    className: "border-violet-300 text-violet-700 bg-violet-50 hover:bg-violet-100",
    label: () => "موقوف",
  },
};

/**
 * زر دائم بالعارضة العلوية يعرض حالة الاشتراك ويفتح نافذة التفعيل —
 * متاح دائماً (مو بس وقت التجربة/السماح)، حتى لو الاشتراك نشط، حتى
 * يقدر صاحب النادي يشوف تفاصيله أو يفعّل كود جديد أوفلاين بأي وقت.
 */
export function SubscriptionBadge() {
  const [status, setStatus] = useState<Status | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/subscription/status", { cache: "no-store" });
      if (res.ok) setStatus(await res.json());
    } catch {
      // تجاهل — أوفلاين-أولاً، ما نعطّل الزر بسبب فشل شبكة عابر
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!status) return null;

  const meta = STATE_META[status.state] || STATE_META.active;
  const Icon = meta.icon;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={`h-9 gap-1.5 px-2.5 text-xs font-semibold ${meta.className}`}
        title="حالة الاشتراك — اضغط للتفعيل أو المراجعة"
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{meta.label(status)}</span>
      </Button>
      <ActivationModal open={open} onClose={() => setOpen(false)} onActivated={load} />
    </>
  );
}

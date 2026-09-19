"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store, UserPlus, Wallet, Users, ChevronLeft, X, CheckCircle2, Circle, Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const STORAGE_KEY = "aquacore-onboarding-dismissed-v1";

interface Stats {
  total: number;
  paid: number;
}

interface Props {
  onGoTab: (tab: string) => void;
}

/**
 * معالج الإعداد الأولي — قائمة تحقق تفاعلية تعلو لوحة التحكم
 * تختفي نهائياً بعد إتمام الخطوات أو الإغلاق اليدوي.
 */
export function OnboardingChecklist({ onGoTab }: Props) {
  const [dismissed, setDismissed] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [clubName, setClubName] = useState<string>("");
  const [usersCount, setUsersCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === "1");

    Promise.allSettled([
      fetch("/api/stats", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/settings", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/users", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
    ]).then(([statsRes, settingsRes, usersRes]) => {
      const s = statsRes.status === "fulfilled" ? statsRes.value : null;
      if (s && s.total !== undefined) setStats({ total: s.total, paid: s.paid || 0 });
      const cfg = settingsRes.status === "fulfilled" ? settingsRes.value : null;
      const settingsObj = cfg?.settings || cfg;
      if (settingsObj?.clubName) setClubName(settingsObj.clubName);
      const u = usersRes.status === "fulfilled" ? usersRes.value : null;
      if (u?.users) setUsersCount(u.users.length);
      setLoading(false);
    });
  }, []);

  if (dismissed || loading) return null;

  const isDefaultClubName = !clubName || clubName.includes("الرائد سعيدة");

  const steps = [
    {
      id: "club", done: !isDefaultClubName,
      icon: Store, title: "أكمل بيانات ناديك", desc: "الاسم، الهاتف، العنوان وقوالب الرسائل",
      tab: "settings", cta: "إعداد النادي",
    },
    {
      id: "subscribers", done: (stats?.total || 0) > 0,
      icon: UserPlus, title: "أضف منخرطيك الأوائل", desc: "يدوياً أو استيراد جماعي من ملف Excel",
      tab: "subscribers", cta: "إضافة / استيراد",
    },
    {
      id: "payment", done: (stats?.paid || 0) > 0,
      icon: Wallet, title: "سجّل أول دفعة أو تجديد", desc: "لتفعيل التتبع المالي والتذكيرات",
      tab: "renewals", cta: "التجديدات",
    },
    {
      id: "team", done: (usersCount || 0) > 1,
      icon: Users, title: "ادعُ فريق العمل", desc: "مدربون، محاسب، حارسو سباحة بأدوار محددة",
      tab: "users", cta: "إدارة الفريق",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  if (pct === 100) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
    toast.info("يمكنك دائماً إكمال الإعداد من التبويبات");
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="mb-4"
      >
        <Card className="border-teal-300/50 dark:border-teal-800/50 bg-gradient-to-l from-teal-500/8 via-transparent to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/15 text-teal-600">
                  <Store className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold">أهلاً بك! أكمل إعداد ناديك في 4 خطوات</p>
                  <p className="text-[11px] text-muted-foreground">{doneCount} من 4 مكتملة — دقيقتان لكل خطوة</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2">
                  <Progress value={pct} className="h-2 w-28" />
                  <span className="text-xs font-bold text-teal-600 tabular-nums">{pct}%</span>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={dismiss} title="إخفاء">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {steps.map((step) => (
                <button
                  key={step.id}
                  onClick={() => onGoTab(step.tab)}
                  className={`group flex items-start gap-2.5 p-3 rounded-xl border text-right transition hover:shadow-md ${
                    step.done
                      ? "border-emerald-200 bg-emerald-500/5 dark:border-emerald-900"
                      : "border-border/60 bg-card hover:border-teal-300"
                  }`}
                >
                  {step.done ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0 mt-0.5 group-hover:text-teal-500 transition" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold ${step.done ? "text-emerald-700 line-through decoration-emerald-400/50" : ""}`}>
                      {step.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-4">{step.desc}</p>
                    {!step.done && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-teal-600 mt-1">
                        {step.cta} <ChevronLeft className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

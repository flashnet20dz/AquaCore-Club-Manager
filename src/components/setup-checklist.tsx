"use client";

/**
 * ═══════════════════════════════════════════════════════════════
 *  قائمة إعداد النادي — تظهر للنوادي الجديدة/غير المكتملة
 * ═══════════════════════════════════════════════════════════════
 *
 *  الشكوى: «عند إنشاء نادي جديد يكون كل شيء فارغ» — الحل على مستويين:
 *  1) البذر الذاتي (feature-defaults) يجعل الأيام/التوقيتات/الأنواع
 *     غير فارغة أبداً — تبدأ بقوائم جاهزة للتعديل.
 *  2) هذه القائمة ترشد المدير خطوة بخطوة لتخصيص: الاسم، الشعار،
 *     الأيام، التوقيتات، أنواع الاشتراك — وتختفي عند الإكمال أو الإخفاء.
 *
 *  لا تلمس قاعدة البيانات إطلاقاً: قراءة فقط + إخفاء في localStorage.
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flag, CheckCircle2, Circle, X, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "aquacore_setup_checklist_dismissed";

interface Item {
  id: string;
  label: string;
  where: string;
  /** التبويب الفرعي داخل الإعدادات — النقر على البند يفتحه مباشرة */
  tab: string;
  done: boolean;
}

/** إرسال أمر «افتح الإعدادات على هذا التبويب» — يلتقطه page.tsx */
const gotoSettingsTab = (tab: string) => {
  window.dispatchEvent(new CustomEvent("aquacore-goto-settings", { detail: { tab } }));
};

export function SetupChecklist() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      /* localStorage محجوب — نعرض القائمة عادي */
    }
  }, []);

  const check = useCallback(async () => {
    try {
      const [settingsRes, themeRes, daysRes, slotsRes, typesRes] = await Promise.all([
        fetch("/api/settings", { cache: "no-store" }),
        fetch("/api/settings/theme", { cache: "no-store" }),
        fetch("/api/swimming-days", { cache: "no-store" }),
        fetch("/api/swimming-slots", { cache: "no-store" }),
        fetch("/api/subscription-types", { cache: "no-store" }),
      ]);
      if (!settingsRes.ok || !themeRes.ok) { setItems([]); return; }
      const settings = await settingsRes.json();
      const theme = await themeRes.json();
      const days = daysRes.ok ? ((await daysRes.json()).days || []) : [];
      const slots = slotsRes.ok ? ((await slotsRes.json()).slots || []) : [];
      const types = typesRes.ok ? ((await typesRes.json()).types || []) : [];

      const s: Record<string, string> = settings?.settings || {};
      setItems([
        { id: "name",   label: "اسم النادي والهاتف",        where: "الإعدادات ← عامة",               tab: "general",     done: Boolean(s.clubName && s.clubPhone) },
        { id: "logo",   label: "شعار النادي ومظهره",        where: "الإعدادات ← المظهر والشعار",      tab: "appearance",  done: Boolean(theme?.config?.logoUrl) },
        { id: "days",   label: "أيام السباحة (المجموعات)",  where: "الإعدادات ← المنخرطون",            tab: "subscribers", done: days.filter((d: { active: boolean }) => d.active).length > 0 },
        { id: "slots",  label: "توقيتات السباحة",            where: "الإعدادات ← المنخرطون",            tab: "subscribers", done: slots.filter((x: { active: boolean }) => x.active).length > 0 },
        { id: "types",  label: "أنواع الاشتراك",             where: "الإعدادات ← المنخرطون",            tab: "subscribers", done: types.filter((t: { active?: boolean }) => t.active !== false).length > 0 },
      ]);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    if (!dismissed) check();
  }, [dismissed, check]);

  const hide = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* تجاهل */ }
    setDismissed(true);
  };

  if (dismissed || !items || items.length === 0) return null;
  const remaining = items.filter((i) => !i.done);
  if (remaining.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="rounded-2xl border border-teal-500/30 bg-gradient-to-l from-teal-500/10 via-emerald-500/5 to-transparent p-4 mb-4"
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center shrink-0">
            <Flag className="h-4 w-4 text-teal-600 dark:text-teal-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">
              أكمل إعداد ناديك — بقي {remaining.length} من {items.length}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              كل شيء يبدأ بقوائم جاهزة من المنظومة — انقر أي بند لينقلك إلى مكان تعديله مباشرة.
            </p>
            <ul className="mt-2.5 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((i) =>
                i.done ? (
                  <li key={i.id} className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span className="text-muted-foreground line-through">{i.label}</span>
                  </li>
                ) : (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => gotoSettingsTab(i.tab)}
                      title={`فتح ${i.where}`}
                      className="w-full flex items-center gap-2 text-xs rounded-lg px-1.5 py-1 -mx-1.5 text-right transition-colors hover:bg-teal-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50"
                    >
                      <Circle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span className="font-semibold text-foreground">{i.label}</span>
                      <span className="text-[10px] text-muted-foreground truncate">({i.where})</span>
                      <ArrowLeft className="h-3 w-3 text-teal-600 dark:text-teal-300 shrink-0 mr-auto" aria-hidden />
                    </button>
                  </li>
                )
              )}
            </ul>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={hide} aria-label="إخفاء قائمة الإعداد">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

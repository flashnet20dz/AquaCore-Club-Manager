"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Users, Plus, Building2, Wallet, FileText, CreditCard,
  Settings, QrCode, Calendar, TrendingUp, ArrowRight, CornerDownLeft, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SubscriberWithComputed } from "@/lib/rcs";

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscribers: SubscriberWithComputed[];
  onNavigate: (tab: string) => void;
  onAddSubscriber: () => void;
  onOpenKiosk: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  subscribers,
  onNavigate,
  onAddSubscriber,
  onOpenKiosk,
}: CommandPaletteProps) {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ★ قائمة الأوامر السريعة
  const commands: Command[] = useMemo(() => [
    {
      id: "kiosk",
      label: "شاشة البوابة الذكية",
      description: "وضع الشاشة الكاملة للاستقبال والكشك",
      icon: QrCode,
      shortcut: "Ctrl+K",
      action: () => { onOpenKiosk(); onOpenChange(false); },
      keywords: ["kiosk", "بوابة", "كشك", "استقبال", "fullscreen", "barcode"],
    },
    {
      id: "add-subscriber",
      label: "تسجيل منخرط جديد",
      description: "فتح نموذج تسجيل منخرط",
      icon: Plus,
      action: () => { onAddSubscriber(); onOpenChange(false); },
      keywords: ["new", "add", "تسجيل", "منخرط", "جديد"],
    },
    {
      id: "subscribers",
      label: "قائمة المنخرطين",
      description: "عرض كل المنخرطين",
      icon: Users,
      action: () => { onNavigate("subscribers"); onOpenChange(false); },
      keywords: ["list", "منخرطين", "قائمة"],
    },
    {
      id: "attendance",
      label: "صفحة الحضور",
      description: "تسجيل وتتبع الحضور",
      icon: Calendar,
      action: () => { onNavigate("attendance"); onOpenChange(false); },
      keywords: ["حضور", "attendance", "qr"],
    },
    {
      id: "renewals",
      label: "التجديد",
      description: "تجديد الاشتراكات",
      icon: TrendingUp,
      action: () => { onNavigate("renewals"); onOpenChange(false); },
      keywords: ["renewal", "تجديد", "اشتراك"],
    },
    {
      id: "cards-pro",
      label: "مصمم البطاقات",
      description: "تصميم وطباعة البطاقات",
      icon: CreditCard,
      action: () => { onNavigate("cards-pro"); onOpenChange(false); },
      keywords: ["card", "بطاقة", "تصميم", "طباعة"],
    },
    {
      id: "financial",
      label: "لوحة المالية والتقارير",
      description: "الإدارة المالية والتقارير",
      icon: Wallet,
      action: () => { onNavigate("financial-dashboard"); onOpenChange(false); },
      keywords: ["finance", "مالية", "تقارير", "دفعات"],
    },
    {
      id: "charges",
      label: "الأعباء والتسديدات",
      description: "إدارة الأعباء والدفعات",
      icon: FileText,
      action: () => { onNavigate("charges"); onOpenChange(false); },
      keywords: ["charges", "أعباء", "تسديدات"],
    },
    {
      id: "settings",
      label: "الإعدادات",
      description: "إعدادات النادي",
      icon: Settings,
      action: () => { onNavigate("settings"); onOpenChange(false); },
      keywords: ["settings", "إعدادات", "config"],
    },
  ], [onNavigate, onAddSubscriber, onOpenKiosk, onOpenChange]);

  // ★ نتائج البحث في المنخرطين
  const subscriberResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase().trim();
    return subscribers
      .filter((s) =>
        s.lastName?.toLowerCase().includes(q) ||
        s.firstName?.toLowerCase().includes(q) ||
        s.fileNumber?.toLowerCase().includes(q) ||
        (s.phone || "").includes(q)
      )
      .slice(0, 8);
  }, [search, subscribers]);

  // ★ فلترة الأوامر
  const filteredCommands = useMemo(() => {
    if (!search.trim()) return commands;
    const q = search.toLowerCase().trim();
    return commands.filter((c) =>
      c.label.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q) ||
      c.keywords?.some((k) => k.includes(q))
    );
  }, [search, commands]);

  // ★ قائمة موحدة للأغراض المعروضة
  const items = useMemo(() => {
    const cmdItems = filteredCommands.map((c) => ({ type: "command" as const, ...c }));
    const subItems = subscriberResults.map((s) => ({
      type: "subscriber" as const,
      id: `sub-${s.id}`,
      label: `${s.lastName} ${s.firstName}`,
      description: `${s.fileNumber} • ${s.subscriptionType} • ${s.paymentStatus}`,
      icon: Users,
      action: () => { onNavigate("subscribers"); onOpenChange(false); },
      subscriber: s,
    }));
    return [...cmdItems, ...subItems];
  }, [filteredCommands, subscriberResults, onNavigate, onOpenChange]);

  // ★ focus على حقل البحث عند الفتح
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearch("");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ★ تنقل بلوحة المفاتيح
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[selectedIndex];
      if (item) item.action();
    } else if (e.key === "Escape") {
      onOpenChange(false);
    }
  }, [items, selectedIndex, onOpenChange]);

  useEffect(() => {
    if (open) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  // ★ scroll للعنصر المحدد
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedIndex]);

  // ★ إعادة تعيين الفهرس عند تغيّر البحث
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIndex(0);
  }, [search]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      >
        <motion.div
          initial={{ scale: 0.95, y: -10 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: -10 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl bg-card rounded-2xl shadow-2xl border border-border/60 overflow-hidden"
        >
          {/* حقل البحث */}
          <div className="flex items-center gap-3 px-4 py-3 border-b">
            <Search className="h-5 w-5 text-muted-foreground shrink-0" />
            <Input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم، رقم الملف، الهاتف... أو اختر أمراً سريعاً"
              className="border-0 h-8 px-0 focus-visible:ring-0 text-base"
            />
            <kbd className="shrink-0 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              ESC
            </kbd>
          </div>

          {/* النتائج */}
          <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
            {items.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                <Search className="h-10 w-10 mx-auto mb-2 opacity-30" />
                لا توجد نتائج لـ "{search}"
              </div>
            ) : (
              <>
                {/* الأوامر */}
                {filteredCommands.length > 0 && (
                  <div className="mb-2">
                    {search.trim() && <p className="text-[10px] font-bold uppercase text-muted-foreground px-2 py-1">أوامر</p>}
                    {filteredCommands.map((cmd, i) => (
                      <button
                        key={cmd.id}
                        data-index={i}
                        onClick={() => cmd.action()}
                        onMouseEnter={() => setSelectedIndex(i)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-right transition",
                          selectedIndex === i ? "bg-primary/10" : "hover:bg-accent/50"
                        )}
                      >
                        <div className={cn(
                          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                          selectedIndex === i ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                        )}>
                          <cmd.icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{cmd.label}</p>
                          {cmd.description && <p className="text-xs text-muted-foreground truncate">{cmd.description}</p>}
                        </div>
                        {cmd.shortcut && (
                          <kbd className="shrink-0 text-[10px] font-mono text-muted-foreground border rounded px-1.5 py-0.5">
                            {cmd.shortcut}
                          </kbd>
                        )}
                        {selectedIndex === i && (
                          <CornerDownLeft className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* المنخرطون */}
                {subscriberResults.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground px-2 py-1">منخرطون ({subscriberResults.length})</p>
                    {subscriberResults.map((s, i) => {
                      const idx = filteredCommands.length + i;
                      return (
                        <button
                          key={s.id}
                          data-index={idx}
                          onClick={() => { onNavigate("subscribers"); onOpenChange(false); }}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-right transition",
                            selectedIndex === idx ? "bg-primary/10" : "hover:bg-accent/50"
                          )}
                        >
                          <div className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold",
                            s.gender === "ذكر" ? "bg-sky-100 text-sky-700" : "bg-pink-100 text-pink-700"
                          )}>
                            {s.lastName?.[0]}{s.firstName?.[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{s.lastName} {s.firstName}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">{s.fileNumber} • {s.subscriptionType}</p>
                          </div>
                          <Badge variant="outline" className={cn(
                            "text-[9px] shrink-0",
                            s.paymentStatus === "مدفوع" ? "bg-emerald-100 text-emerald-700" :
                            s.paymentStatus === "معفى" ? "bg-violet-100 text-violet-700" :
                            "bg-rose-100 text-rose-700"
                          )}>{s.paymentStatus}</Badge>
                          {selectedIndex === idx && <CornerDownLeft className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><kbd className="border rounded px-1">↑↓</kbd> تنقل</span>
              <span className="flex items-center gap-1"><kbd className="border rounded px-1">↵</kbd> اختيار</span>
              <span className="flex items-center gap-1"><kbd className="border rounded px-1">ESC</kbd> إغلاق</span>
            </div>
            <span>AquaCore Command Palette</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

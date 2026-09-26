"use client";

import { motion } from "framer-motion";
import {
  Layers, Users, QrCode, Wallet, Menu, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { notifyClick } from "@/lib/sounds";

interface MobileBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenMenu: () => void;
  subscribersCount?: number;
  unresolvedAlertsCount?: number;
}

export function MobileBottomNav({
  activeTab,
  onTabChange,
  onOpenMenu,
  subscribersCount,
  unresolvedAlertsCount = 0,
}: MobileBottomNavProps) {
  const navItems = [
    {
      id: "dashboard",
      label: "الرئيسية",
      icon: Layers,
    },
    {
      id: "subscribers",
      label: "المنخرطين",
      icon: Users,
      badge: subscribersCount ? (subscribersCount > 999 ? "+999" : subscribersCount) : undefined,
    },
    {
      id: "qr-attendance",
      label: "حضور QR",
      icon: QrCode,
      isCenter: true,
    },
    {
      id: "financial",
      label: "المالية",
      icon: Wallet,
    },
    {
      id: "menu",
      label: "المزيد",
      icon: Menu,
      badge: unresolvedAlertsCount > 0 ? unresolvedAlertsCount : undefined,
      isAction: true,
    },
  ];

  const handleClick = (item: (typeof navItems)[number]) => {
    try {
      notifyClick();
    } catch {
      // ignore
    }

    if (item.isAction) {
      onOpenMenu();
    } else {
      onTabChange(item.id);
    }
  };

  return (
    <nav
      aria-label="شريط التنقل السفلي للهاتف"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/90 dark:bg-slate-950/90 backdrop-blur-2xl border-t border-border/80 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] transition-all select-none pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <div className="h-16 flex items-center justify-around px-2 max-w-lg mx-auto relative">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = !item.isAction && activeTab === item.id;

          if (item.isCenter) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleClick(item)}
                className="relative -top-4 flex flex-col items-center justify-center group cursor-pointer focus:outline-none"
                title="تسجيل الحضور السريع بـ QR"
              >
                <div
                  className={cn(
                    "w-13 h-13 rounded-2xl flex items-center justify-center shadow-lg transition-transform active:scale-95 group-hover:scale-105",
                    isActive
                      ? "bg-gradient-to-tr from-teal-600 via-teal-500 to-emerald-400 text-white shadow-teal-500/40 ring-4 ring-background"
                      : "bg-gradient-to-tr from-teal-500 to-sky-500 text-white shadow-teal-500/30 ring-4 ring-background"
                  )}
                >
                  <Icon className="h-6 w-6 stroke-[2.2] animate-pulse" />
                </div>
                <span className="text-[11px] font-bold mt-1 text-teal-600 dark:text-teal-400">
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleClick(item)}
              className={cn(
                "relative flex-1 flex flex-col items-center justify-center h-full py-1 px-1 transition-all active:scale-95 focus:outline-none cursor-pointer",
                isActive
                  ? "text-teal-600 dark:text-teal-400 font-bold"
                  : "text-muted-foreground hover:text-foreground font-medium"
              )}
            >
              {/* Active pill indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeBottomTabPill"
                  className="absolute -top-[1px] w-8 h-1 rounded-full bg-teal-500 dark:bg-teal-400 shadow-sm shadow-teal-500/50"
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              )}

              <div className="relative">
                <Icon
                  className={cn(
                    "h-5 w-5 transition-transform",
                    isActive && "scale-115 stroke-[2.3]"
                  )}
                />

                {item.badge !== undefined && (
                  <span className="absolute -top-1.5 -left-2 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-background">
                    {item.badge}
                  </span>
                )}
              </div>

              <span className="text-[10px] mt-1 leading-tight tracking-tight">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

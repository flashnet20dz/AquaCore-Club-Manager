"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: "ocean" | "teal" | "amber" | "coral" | "violet" | "emerald";
  sublabel?: string;
  delay?: number;
  suffix?: string;
  delta?: {
    value: number;
    label?: string;
  };
}

const accentClasses = {
  ocean: {
    icon: "bg-ocean-500/15 text-ocean-600 dark:text-ocean-300",
    ring: "from-ocean-500/20",
    glow: "shadow-ocean-500/10",
    value: "text-ocean-700 dark:text-ocean-300",
  },
  teal: {
    icon: "bg-teal-500/15 text-teal-600 dark:text-teal-300",
    ring: "from-teal-500/20",
    glow: "shadow-teal-500/10",
    value: "text-teal-700 dark:text-teal-300",
  },
  amber: {
    icon: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
    ring: "from-amber-500/20",
    glow: "shadow-amber-500/10",
    value: "text-amber-700 dark:text-amber-300",
  },
  coral: {
    icon: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
    ring: "from-rose-500/20",
    glow: "shadow-rose-500/10",
    value: "text-rose-700 dark:text-rose-300",
  },
  violet: {
    icon: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
    ring: "from-violet-500/20",
    glow: "shadow-violet-500/10",
    value: "text-violet-700 dark:text-violet-300",
  },
  emerald: {
    icon: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
    ring: "from-emerald-500/20",
    glow: "shadow-emerald-500/10",
    value: "text-emerald-700 dark:text-emerald-300",
  },
};

// Tailwind-safe color mapping
const colorMap = {
  ocean: { bg: "bg-sky-500/15", text: "text-sky-600 dark:text-sky-300", glow: "shadow-sky-500/10", value: "text-sky-700 dark:text-sky-300", ring: "from-sky-500/20" },
  teal: { bg: "bg-teal-500/15", text: "text-teal-600 dark:text-teal-300", glow: "shadow-teal-500/10", value: "text-teal-700 dark:text-teal-300", ring: "from-teal-500/20" },
  amber: { bg: "bg-amber-500/15", text: "text-amber-600 dark:text-amber-300", glow: "shadow-amber-500/10", value: "text-amber-700 dark:text-amber-300", ring: "from-amber-500/20" },
  coral: { bg: "bg-rose-500/15", text: "text-rose-600 dark:text-rose-300", glow: "shadow-rose-500/10", value: "text-rose-700 dark:text-rose-300", ring: "from-rose-500/20" },
  violet: { bg: "bg-violet-500/15", text: "text-violet-600 dark:text-violet-300", glow: "shadow-violet-500/10", value: "text-violet-700 dark:text-violet-300", ring: "from-violet-500/20" },
  emerald: { bg: "bg-emerald-500/15", text: "text-emerald-600 dark:text-emerald-300", glow: "shadow-emerald-500/10", value: "text-emerald-700 dark:text-emerald-300", ring: "from-emerald-500/20" },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = "ocean",
  sublabel,
  delay = 0,
  suffix,
  delta,
}: StatCardProps) {
  const colors = colorMap[accent];
  const isPositive = delta ? delta.value > 0 : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay, ease: [0.2, 0, 0, 1] }}
      whileHover={{ y: -2 }}
      className={cn(
        "relative overflow-hidden rounded-near-md border border-border/80 bg-card p-4",
        "elevation-1 hover:elevation-2 hover:border-primary/50 motion-fast select-none",
        colors.glow
      )}
    >
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider truncate">
            {label}
          </p>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className={cn("font-mono-data text-2xl font-bold tracking-tight", colors.value)}>
              {typeof value === "number" ? value.toLocaleString("en-US") : value}
            </span>
            {suffix && (
              <span className="text-xs font-semibold text-muted-foreground">{suffix}</span>
            )}
          </div>
          {delta && (
            <div className="mt-1.5 flex items-center gap-1">
              <span
                className={cn(
                  "inline-flex items-center px-1.5 py-0.5 rounded-near-2xs text-[10px] font-mono-data font-semibold",
                  isPositive ? "bg-[#22c55e]/15 text-[#22c55e]" : "bg-[#ef4444]/15 text-[#ef4444]"
                )}
              >
                {isPositive ? "+" : ""}{delta.value}%
              </span>
              {delta.label && (
                <span className="text-[10px] text-muted-foreground truncate">{delta.label}</span>
              )}
            </div>
          )}
          {sublabel && !delta && (
            <p className="mt-1 text-[11px] text-muted-foreground truncate">{sublabel}</p>
          )}
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-near-sm", colors.bg)}>
          <Icon className={cn("h-5 w-5", colors.text)} />
        </div>
      </div>
    </motion.div>
  );
}

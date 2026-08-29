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
}: StatCardProps) {
  const colors = colorMap[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      whileHover={{ y: -3 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5",
        "shadow-sm hover:shadow-xl transition-all duration-300",
        colors.glow
      )}
    >
      {/* Decorative gradient blob */}
      <div className={cn(
        "absolute -top-8 -left-8 h-32 w-32 rounded-full bg-gradient-to-br to-transparent blur-2xl opacity-60",
        colors.ring
      )} />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">
            {label}
          </p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className={cn("text-3xl font-extrabold tabular-nums", colors.value)}>
              {typeof value === "number" ? value.toLocaleString("en-US") : value}
            </span>
            {suffix && (
              <span className="text-sm font-semibold text-muted-foreground">{suffix}</span>
            )}
          </div>
          {sublabel && (
            <p className="mt-1 text-xs text-muted-foreground truncate">{sublabel}</p>
          )}
        </div>
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", colors.bg)}>
          <Icon className={cn("h-6 w-6", colors.text)} />
        </div>
      </div>
    </motion.div>
  );
}

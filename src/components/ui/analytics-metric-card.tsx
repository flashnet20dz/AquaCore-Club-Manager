"use client";

import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AnalyticsMetricCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  delta?: {
    value: number; // e.g. +12.4 or -3.2
    label?: string; // e.g. "vs الشهر الماضي"
  };
  sparkline?: number[]; // Array of numbers e.g. [35, 42, 45, 38, 55, 62]
  icon?: LucideIcon;
  variant?: "default" | "primary" | "secondary" | "positive" | "warn";
  className?: string;
  onClick?: () => void;
}

export function AnalyticsMetricCard({
  label,
  value,
  suffix,
  delta,
  sparkline = [30, 45, 40, 55, 60, 75],
  icon: Icon,
  variant = "default",
  className,
  onClick,
}: AnalyticsMetricCardProps) {
  // Normalize sparkline values to percentage for mini bars
  const maxSpark = Math.max(...sparkline, 1);
  const minSpark = Math.min(...sparkline, 0);
  const range = maxSpark - minSpark || 1;

  const isPositive = delta ? delta.value > 0 : null;
  const isNeutral = delta ? delta.value === 0 : null;

  const variantStyles = {
    default: "border-[#3a3a48] bg-[#111118] text-[#f1f5f9] hover:border-[#3b82f6]/50",
    primary: "border-[#3b82f6]/40 bg-[#111118] text-[#f1f5f9] hover:border-[#3b82f6]",
    secondary: "border-[#14b8a6]/40 bg-[#111118] text-[#f1f5f9] hover:border-[#14b8a6]",
    positive: "border-[#22c55e]/40 bg-[#111118] text-[#f1f5f9] hover:border-[#22c55e]",
    warn: "border-[#f59e0b]/40 bg-[#111118] text-[#f1f5f9] hover:border-[#f59e0b]",
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
      onClick={onClick}
      className={cn(
        "relative rounded-near-md border p-4 elevation-1 motion-fast select-none overflow-hidden",
        variantStyles[variant],
        onClick && "cursor-pointer",
        className
      )}
    >
      {/* Header: Label + Optional Icon */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium tracking-wide text-[#7a7d8a] truncate uppercase">
          {label}
        </span>
        {Icon && (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-near-xs bg-[#1f1f28] text-[#60a5fa]">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      {/* Main Metric Value (Mono + Tabular Figures) */}
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-mono-data text-2xl font-bold tracking-tight text-[#ffffff]">
          {typeof value === "number" ? value.toLocaleString("en-US") : value}
        </span>
        {suffix && (
          <span className="text-xs font-medium text-[#7a7d8a]">
            {suffix}
          </span>
        )}
      </div>

      {/* Footer: Delta Indicator + Mini Sparkline */}
      <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#1f1f28]/80">
        {delta ? (
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-near-2xs px-1.5 py-0.5 text-[11px] font-mono-data font-semibold",
                isPositive && "bg-[#22c55e]/15 text-[#22c55e]",
                !isPositive && !isNeutral && "bg-[#ef4444]/15 text-[#ef4444]",
                isNeutral && "bg-[#7a7d8a]/15 text-[#7a7d8a]"
              )}
            >
              {isPositive && <TrendingUp className="h-3 w-3" />}
              {!isPositive && !isNeutral && <TrendingDown className="h-3 w-3" />}
              {isNeutral && <Minus className="h-3 w-3" />}
              <span>{Math.abs(delta.value)}%</span>
            </span>
            {delta.label && (
              <span className="text-[10px] text-[#7a7d8a] truncate">
                {delta.label}
              </span>
            )}
          </div>
        ) : (
          <div />
        )}

        {/* Mini Sparkline Bar Visualization */}
        {sparkline && sparkline.length > 0 && (
          <div className="flex items-end gap-1 h-5 shrink-0" title="مخطط الاتجاه">
            {sparkline.map((val, idx) => {
              const heightPct = Math.max(15, Math.round(((val - minSpark) / range) * 100));
              const isLast = idx === sparkline.length - 1;
              return (
                <div
                  key={idx}
                  style={{ height: `${heightPct}%` }}
                  className={cn(
                    "w-1 rounded-near-2xs transition-all duration-200",
                    isLast ? "bg-[#14b8a6]" : "bg-[#282832] hover:bg-[#3b82f6]"
                  )}
                />
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

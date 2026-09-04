"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface BarItem {
  label: string;
  value: number;
  color?: string;
  sublabel?: string;
}

interface ProgressBarsProps {
  items: BarItem[];
  total?: number;
  delay?: number;
  showValue?: boolean;
}

export function ProgressBars({ items, total, delay = 0, showValue = true }: ProgressBarsProps) {
  const max = total ?? Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const pct = (item.value / max) * 100;
        return (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium text-foreground/90 truncate">{item.label}</span>
              {showValue && (
                <span className="font-bold tabular-nums text-foreground">
                  {item.value}
                  {item.sublabel && (
                    <span className="text-xs text-muted-foreground mr-1">{item.sublabel}</span>
                  )}
                </span>
              )}
            </div>
            <div className="relative h-2.5 rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, delay: delay + i * 0.08, ease: "easeOut" }}
                className={cn(
                  "absolute inset-y-0 right-0 rounded-full",
                  item.color || "bg-gradient-to-l from-primary to-primary/70"
                )}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface DonutSlice {
  label: string;
  value: number;
  color: string; // hex
}

export function DonutChart({ slices, size = 160, thickness = 22, centerLabel, centerValue }: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string | number;
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  // Pre-compute cumulative offsets to avoid mutating during render
  const sliceData = slices.reduce<{ dash: number; offset: number; label: string; value: number; color: string }[]>(
    (acc, slice) => {
      const dash = (slice.value / total) * circumference;
      const offset = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].dash : 0;
      return [...acc, { ...slice, dash, offset }];
    },
    []
  );

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={thickness}
          className="text-muted"
        />
        {sliceData.map((slice, i) => (
          <motion.circle
            key={slice.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={slice.color}
            strokeWidth={thickness}
            strokeDasharray={`${slice.dash} ${circumference - slice.dash}`}
            strokeDashoffset={-slice.offset}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      {(centerLabel || centerValue !== undefined) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {centerValue !== undefined && (
            <span className="text-2xl font-extrabold tabular-nums text-foreground">
              {typeof centerValue === "number" ? centerValue.toLocaleString("en-US") : centerValue}
            </span>
          )}
          {centerLabel && (
            <span className="text-xs text-muted-foreground mt-0.5">{centerLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

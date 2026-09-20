"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface ChartTooltipItem {
  name: string;
  value: number | string;
  color?: string;
  unit?: string;
}

export interface ChartTooltipOverlayProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey?: string;
    payload?: any;
  }>;
  label?: string;
  formatter?: (value: number) => string;
  unit?: string;
  className?: string;
}

export function ChartTooltipOverlay({
  active,
  payload,
  label,
  formatter,
  unit = "دج",
  className,
}: ChartTooltipOverlayProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div
      className={cn(
        "rounded-near-sm border border-[#3a3a48] bg-[#111118]/95 p-2.5 elevation-3 backdrop-blur-md text-xs select-none min-w-[150px]",
        className
      )}
      dir="rtl"
    >
      {/* Header Label */}
      {label && (
        <div className="border-b border-[#1f1f28] pb-1.5 mb-1.5 font-medium text-[#7a7d8a] text-[11px] tracking-wide">
          {label}
        </div>
      )}

      {/* Rows */}
      <div className="space-y-1">
        {payload.map((item, index) => {
          const formattedVal = formatter
            ? formatter(item.value)
            : typeof item.value === "number"
            ? item.value.toLocaleString("en-US")
            : item.value;

          return (
            <div key={`item-${index}`} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.color || "#3b82f6" }}
                />
                <span className="text-[#cbd5e1] font-medium">{item.name}</span>
              </div>
              <span className="font-mono-data font-semibold text-[#ffffff]">
                {formattedVal} <span className="text-[10px] text-[#7a7d8a] font-normal">{unit}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

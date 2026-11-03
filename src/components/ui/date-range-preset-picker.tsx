"use client";

import React from "react";
import { Calendar as CalendarIcon, ChevronDown, Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export type PresetRange = "today" | "7d" | "30d" | "90d" | "year";

export interface DateRangePresetPickerProps {
  activePreset: PresetRange;
  onChangePreset: (preset: PresetRange) => void;
  className?: string;
}

const PRESETS: { id: PresetRange; label: string; sub: string }[] = [
  { id: "today", label: "اليوم", sub: "24 ساعة" },
  { id: "7d", label: "7 أيام", sub: "آخر أسبوع" },
  { id: "30d", label: "30 يوماً", sub: "الشهر الأخير" },
  { id: "90d", label: "90 يوماً", sub: "الربع الحالي" },
  { id: "year", label: "سنة كاملة", sub: "12 شهراً" },
];

export function DateRangePresetPicker({
  activePreset,
  onChangePreset,
  className,
}: DateRangePresetPickerProps) {
  const selected = PRESETS.find((p) => p.id === activePreset) || PRESETS[2];

  return (
    <div className={cn("inline-block select-none", className)}>
      <DropdownMenu dir="rtl">
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`تحديد نطاق التاريخ: ${selected.label}`}
            className="group inline-flex items-center gap-2 h-9 px-3 rounded-xl bg-black/40 hover:bg-black/60 text-white border border-white/20 hover:border-sky-400/60 text-xs font-medium shadow-sm backdrop-blur-md transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 active:scale-[0.98]"
          >
            <div className="flex items-center justify-center w-5 h-5 rounded-lg bg-sky-500/20 text-sky-300 shrink-0">
              <CalendarIcon className="h-3.5 w-3.5" />
            </div>
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-white/80 font-normal text-[11px] sm:text-xs">النطاق:</span>
              <strong className="text-sky-300 font-bold text-xs">{selected.label}</strong>
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-white/70 transition-transform duration-200 group-data-[state=open]:rotate-180 shrink-0 mr-0.5" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          side="bottom"
          sideOffset={8}
          className="w-56 p-1.5 rounded-2xl border border-slate-700/80 bg-slate-950/95 backdrop-blur-2xl shadow-2xl shadow-black/70 text-right z-[9999]"
        >
          <div className="flex items-center gap-2 px-2.5 py-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-800/80 mb-1">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span>نطاق التحليلات الزمنية</span>
          </div>

          <div className="space-y-0.5">
            {PRESETS.map((preset) => {
              const isActive = preset.id === activePreset;
              return (
                <DropdownMenuItem
                  key={preset.id}
                  onClick={() => onChangePreset(preset.id)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-all duration-150 outline-none select-none my-0.5",
                    isActive
                      ? "bg-gradient-to-r from-sky-500/25 to-teal-500/25 text-sky-200 font-bold border border-sky-500/40 shadow-sm"
                      : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                  )}
                >
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="font-bold text-xs leading-none">{preset.label}</span>
                    <span className={cn("text-[10px] leading-tight", isActive ? "text-sky-300/80" : "text-slate-400")}>
                      {preset.sub}
                    </span>
                  </div>
                  {isActive && (
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-sky-500/30 text-sky-300 shrink-0">
                      <Check className="h-3 w-3 stroke-[2.5]" />
                    </div>
                  )}
                </DropdownMenuItem>
              );
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

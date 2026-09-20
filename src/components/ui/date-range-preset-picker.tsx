"use client";

import React, { useState } from "react";
import { Calendar as CalendarIcon, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [isOpen, setIsOpen] = useState(false);
  const selected = PRESETS.find((p) => p.id === activePreset) || PRESETS[2];

  return (
    <div className={cn("relative inline-block text-right select-none", className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 h-[34px] px-3 rounded-near-sm bg-[#111118] border border-[#3a3a48] text-xs font-medium text-[#f1f5f9] hover:border-[#3b82f6] elevation-1 motion-fast"
      >
        <CalendarIcon className="h-3.5 w-3.5 text-[#3b82f6]" />
        <span>النطاق: <strong className="text-[#60a5fa]">{selected.label}</strong></span>
        <ChevronDown className={cn("h-3 w-3 text-[#7a7d8a] transition-transform duration-150", isOpen && "rotate-180")} />
      </button>

      {/* Preset Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 mt-1.5 w-44 rounded-near-md border border-[#3a3a48] bg-[#111118]/95 p-1.5 elevation-3 backdrop-blur-md z-40">
            <div className="text-[10px] uppercase font-semibold text-[#7a7d8a] px-2 py-1 tracking-wider border-b border-[#1f1f28] mb-1">
              نطاق التحليلات
            </div>
            {PRESETS.map((preset) => {
              const isActive = preset.id === activePreset;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    onChangePreset(preset.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between px-2.5 py-1.5 rounded-near-xs text-xs font-medium text-right motion-fast",
                    isActive
                      ? "bg-[#3b82f6]/20 text-[#60a5fa] font-semibold"
                      : "text-[#cbd5e1] hover:bg-[#1f1f28] hover:text-[#ffffff]"
                  )}
                >
                  <div className="flex flex-col items-start">
                    <span>{preset.label}</span>
                    <span className="text-[10px] text-[#7a7d8a] font-normal">{preset.sub}</span>
                  </div>
                  {isActive && <Check className="h-3.5 w-3.5 text-[#3b82f6]" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

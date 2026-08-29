"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { motion } from "framer-motion";

interface ChipOption<T extends string> {
  value: T;
  label: string;
  color?: string;
}

interface ChipSelectorProps<T extends string> {
  label: string;
  options: ChipOption<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  columns?: number;
  icon?: React.ReactNode;
  hint?: string;
}

export function ChipSelector<T extends string>({
  label,
  options,
  value,
  onChange,
  columns = 3,
  icon,
  hint,
}: ChipSelectorProps<T>) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        {icon && <span className="text-primary">{icon}</span>}
        <label className="text-sm font-bold text-foreground">{label}</label>
        {hint && <span className="text-xs text-muted-foreground">— {hint}</span>}
      </div>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {options.map((option) => {
          const isSelected = value === option.value;
          return (
            <motion.button
              key={option.value}
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.15 }}
              onClick={() => onChange(isSelected ? null : option.value)}
              className={cn(
                "relative flex items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition-all duration-200",
                "hover:shadow-md hover:border-primary/40",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "border-border bg-card text-foreground/80 hover:bg-accent"
              )}
            >
              {isSelected && (
                <motion.span
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center"
                >
                  <Check className="h-4 w-4" strokeWidth={3} />
                </motion.span>
              )}
              <span>{option.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

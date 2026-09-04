"use client";

import { QRCodeSVG } from "qrcode.react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface QRBadgeProps {
  fileNumber: string;
  name: string;
  size?: number;
  showInfo?: boolean;
  className?: string;
  downloadable?: boolean;
  subscriptionType?: string;
  timeSlot?: string;
}

export function QRBadge({
  fileNumber,
  name,
  size = 120,
  showInfo = true,
  className,
  subscriptionType,
  timeSlot,
}: QRBadgeProps) {
  return (
    <div className={cn("inline-flex flex-col items-center gap-2", className)}>
      <div className="relative">
        {/* Gradient border */}
        <div className="absolute -inset-0.5 bg-gradient-to-br from-teal-500 via-sky-500 to-indigo-500 rounded-2xl blur-sm opacity-50" />
        <div className="relative bg-white p-3 rounded-2xl shadow-md">
          <QRCodeSVG
            value={fileNumber}
            size={size}
            level="H"
            includeMargin={false}
            fgColor="#0f766e"
            bgColor="#ffffff"
            imageSettings={{
              // The "R" logo embedded in the QR uses a solid teal background with a white "R"
              // — high contrast against the white QR background.
              src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%230F766E'/%3E%3Ctext x='50' y='68' font-family='Arial' font-size='52' font-weight='bold' fill='white' text-anchor='middle'%3ER%3C/text%3E%3C/svg%3E",
              height: 24,
              width: 24,
              excavate: true,
            }}
          />
        </div>
      </div>
      {showInfo && (
        <div className="text-center">
          <p className="text-xs font-mono font-bold text-foreground">{fileNumber}</p>
          <p className="text-xs text-muted-foreground truncate max-w-[140px]">{name}</p>
          {(subscriptionType || timeSlot) && (
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              {subscriptionType && subscriptionType !== "/" ? subscriptionType : "عادي"}
              {timeSlot && ` • ${timeSlot}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface QRCardProps {
  fileNumber: string;
  name: string;
  subscriptionType: string;
  timeSlot?: string | null;
  swimmingDays?: string | null;
  ageCategoryShort?: string;
  ageCategoryIcon?: string;
  ageCategoryColor?: string;
}

// Full printable badge — like an ID card
export function QRCard({
  fileNumber,
  name,
  subscriptionType,
  timeSlot,
  swimmingDays,
  ageCategoryShort,
  ageCategoryIcon,
  ageCategoryColor = "#6366f1",
}: QRCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative w-full max-w-[280px] rounded-2xl overflow-hidden shadow-xl"
    >
      {/* Header */}
      <div className="bg-gradient-to-br from-teal-600 to-sky-700 p-3 text-white">
        <div className="flex items-center gap-2">
          {/* Logo: solid white background with teal wave icon — high contrast, no white-on-white */}
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shrink-0">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#0f766e" strokeWidth={2.5}>
              <path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold leading-tight">نادي RCS</p>
            <p className="text-[10px] text-white/80 leading-tight">للسباحة</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="bg-white p-4 flex flex-col items-center gap-2">
        <QRBadge fileNumber={fileNumber} name={name} size={140} showInfo={false} />
        <div className="text-center w-full">
          <p className="font-mono text-sm font-bold text-teal-700">{fileNumber}</p>
          <p className="font-bold text-foreground text-sm mt-0.5">{name}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-1">
            <span className="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded font-semibold">
              {subscriptionType === "/" ? "عادي" : subscriptionType}
            </span>
            {timeSlot && (
              <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-mono">
                {timeSlot}
              </span>
            )}
            {ageCategoryShort && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                style={{ backgroundColor: `${ageCategoryColor}22`, color: ageCategoryColor }}
              >
                {ageCategoryIcon} {ageCategoryShort}
              </span>
            )}
          </div>
          {swimmingDays && (
            <p className="text-[10px] text-muted-foreground mt-1">{swimmingDays}</p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-slate-50 px-3 py-1.5 text-center">
        <p className="text-[9px] text-slate-500">امسح الكود لتسجيل الحضور</p>
      </div>
    </motion.div>
  );
}

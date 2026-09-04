"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Pencil,
  Trash2,
  Calendar,
  Droplet,
  Clock,
  Waves,
  QrCode,
  Check,
  MessageCircle,
  FileText,
  Receipt,
} from "lucide-react";
import {
  PAYMENT_STATUS_COLORS,
  SUBSCRIPTION_TYPE_COLORS,
  RENEWAL_STATUS_COLORS,
  AGE_CATEGORY_INFO,
  getAgeCategory,
  type SubscriberWithComputed,
} from "@/lib/rcs";
import { notifyClick } from "@/lib/sounds";

interface SubscriberCardProps {
  subscriber: SubscriberWithComputed;
  onEdit?: (sub: SubscriberWithComputed) => void;
  onDelete?: (sub: SubscriberWithComputed) => void;
  onShowQR?: (sub: SubscriberWithComputed) => void;
  onViewRecord?: (sub: SubscriberWithComputed) => void;
  onPrintPOS?: (sub: SubscriberWithComputed) => void;
  index?: number;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export const SubscriberCard = memo(function SubscriberCard({
  subscriber, onEdit, onDelete, onShowQR, onViewRecord, onPrintPOS, index = 0,
  selectionMode = false, selected = false, onToggleSelect,
}: SubscriberCardProps) {
  const initials = (subscriber.lastName[0] || "") + (subscriber.firstName[0] || "");
  const isMale = subscriber.gender === "ذكر";
  const ageCategory = getAgeCategory(subscriber.gender, subscriber.age);
  const ageCatInfo = AGE_CATEGORY_INFO[ageCategory];

  const openWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    notifyClick();
    if (!subscriber.phone) return;
    let phone = subscriber.phone.replace(/\D/g, "");
    if (phone.startsWith("0")) phone = "213" + phone.slice(1);
    else if (!phone.startsWith("213")) phone = "213" + phone;
    const msg = `مرحباً ${subscriber.firstName} ${subscriber.lastName} (${subscriber.fileNumber})، نادي RCS للسباحة.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.4) }}
      onClick={selectionMode ? () => onToggleSelect?.(subscriber.id) : () => { notifyClick(); onViewRecord?.(subscriber); }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card hover:shadow-xl transition-all duration-300 contain-content",
        selectionMode ? "cursor-pointer" : "cursor-pointer border-border/60 hover:border-primary/40",
        selected && "border-primary ring-2 ring-primary/30"
      )}
    >
      {/* Selection checkbox */}
      {selectionMode && (
        <div className={cn(
          "absolute top-2 left-2 z-10 h-6 w-6 rounded-md border-2 flex items-center justify-center transition",
          selected ? "bg-primary border-primary text-primary-foreground" : "bg-white/80 border-border"
        )}>
          {selected && <Check className="h-4 w-4" strokeWidth={3} />}
        </div>
      )}

      {/* Top accent bar */}
      <div className={cn(
        "h-1 w-full",
        // ★ EXEMPT uses violet gradient
        subscriber.paymentStatus === "معفى" ? "bg-gradient-to-l from-violet-500 to-violet-400"
        : subscriber.paymentStatus === "مدفوع" ? "bg-gradient-to-l from-emerald-500 to-emerald-400"
        : subscriber.paymentStatus === "لم يدفع" ? "bg-gradient-to-l from-rose-500 to-rose-400"
        : subscriber.paymentStatus === "تأمين فقط" ? "bg-gradient-to-l from-sky-500 to-sky-400"
        : "bg-gradient-to-l from-amber-500 to-amber-400"
      )} />

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={cn(
            "h-12 w-12 rounded-xl border-2 overflow-hidden shrink-0 relative",
            isMale ? "border-sky-500/30 bg-sky-500/10" : "border-pink-500/30 bg-pink-500/10"
          )}>
            {subscriber.photoPath && (
              <img
                src={`/api/subscribers/${subscriber.id}/photo?size=thumbnail&raw=1`}
                alt={`${subscriber.lastName} ${subscriber.firstName}`}
                className="absolute inset-0 h-full w-full object-cover rounded-xl"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <div className={cn(
              "absolute inset-0 flex items-center justify-center rounded-lg font-bold text-sm",
              isMale ? "text-sky-700 dark:text-sky-300" : "text-pink-700 dark:text-pink-300"
            )}>
              {initials}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] font-mono py-0 px-1.5 h-5">
                {subscriber.fileNumber}
              </Badge>
              <span className={cn(
                "text-xs font-semibold",
                isMale ? "text-sky-600 dark:text-sky-300" : "text-pink-600 dark:text-pink-300"
              )}>
                {subscriber.gender}
              </span>
              <span className="text-xs text-muted-foreground">• {subscriber.age} سنة</span>
            </div>
            <h3 className="mt-1 font-bold text-foreground truncate text-base">
              {subscriber.lastName} {subscriber.firstName}
            </h3>
          </div>
          {!selectionMode && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -me-1 opacity-60 group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onShowQR?.(subscriber)}>
                  <QrCode className="h-4 w-4 ml-2" /> عرض بطاقة QR
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onViewRecord?.(subscriber)}>
                  <FileText className="h-4 w-4 ml-2" /> السجل الكامل
                </DropdownMenuItem>
                {/* ★ طباعة وصل حراري (POS) */}
                <DropdownMenuItem onClick={() => onPrintPOS?.(subscriber)}>
                  <Receipt className="h-4 w-4 ml-2 text-teal-600" /> طباعة وصل حراري (POS)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit?.(subscriber)}>
                  <Pencil className="h-4 w-4 ml-2" /> تعديل
                </DropdownMenuItem>
                {subscriber.phone && (
                  <DropdownMenuItem onClick={openWhatsApp}>
                    <MessageCircle className="h-4 w-4 ml-2 text-emerald-600" /> إرسال WhatsApp
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete?.(subscriber)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 ml-2" /> حذف
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className={cn("border", ageCatInfo.color)}>
            {ageCatInfo.icon} {ageCatInfo.shortLabel}
          </Badge>
          <Badge variant="outline" className={cn("border", SUBSCRIPTION_TYPE_COLORS[subscriber.subscriptionType])}>
            {subscriber.subscriptionType === "/" ? "عادي" : subscriber.subscriptionType}
          </Badge>
          <Badge variant="outline" className={cn("border", PAYMENT_STATUS_COLORS[subscriber.paymentStatus])}>
            {subscriber.paymentStatus}
          </Badge>
          {subscriber.renewalStatus && (
            <Badge variant="outline" className={cn("border", RENEWAL_STATUS_COLORS[subscriber.renewalStatus] || "")}>
              {subscriber.renewalStatus}
            </Badge>
          )}
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {subscriber.bloodType && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Droplet className="h-3 w-3 text-rose-500" />
              <span>{subscriber.bloodType}</span>
            </div>
          )}
          {subscriber.swimmingDays && (
            <div className="flex items-center gap-1.5 text-muted-foreground truncate">
              <Waves className="h-3 w-3 text-teal-500" />
              <span className="truncate">{subscriber.swimmingDays}</span>
            </div>
          )}
          {subscriber.timeSlot && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3 w-3 text-violet-500" />
              <span className="font-mono">{subscriber.timeSlot}</span>
            </div>
          )}
          {subscriber.lastPaymentDate && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3 w-3 text-amber-500" />
              <span className="truncate">
                {new Date(subscriber.lastPaymentDate).toISOString().split("T")[0].replace(/-/g,"/")}
              </span>
            </div>
          )}
          {subscriber.phone && (
            <button
              onClick={openWhatsApp}
              title={`WhatsApp: ${subscriber.phone}`}
              className="flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 transition-colors"
            >
              <MessageCircle className="h-3 w-3" />
              <span className="font-mono truncate" dir="ltr">{subscriber.phone}</span>
            </button>
          )}
        </div>

        {/* Footer: total amount */}
        <div className="flex items-center justify-between pt-3 border-t border-border/60">
          <div className="text-xs text-muted-foreground">
            المبلغ الإجمالي
          </div>
          <div className="text-right">
            {/* ★ EXEMPT shows "معفى" instead of "0 دج" */}
            {subscriber.isExempt ? (
              <span className="font-extrabold text-lg text-violet-700 dark:text-violet-300">
                معفى
              </span>
            ) : subscriber.totalAmount !== null ? (
              <span className="font-extrabold text-lg text-amber-700 dark:text-amber-300 tabular-nums">
                {subscriber.totalAmount.toLocaleString("en-US")} <span className="text-xs font-medium">دج</span>
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </div>
        </div>

        {/* Mini breakdown — hidden for EXEMPT (no breakdown needed) */}
        {!subscriber.isExempt && subscriber.totalAmount !== null && (
          <div className="flex items-center justify-between text-[10px] text-muted-foreground -mt-2">
            <span>اشتراك: {subscriber.subscriptionFee ?? 0}</span>
            <span>تأمين: {subscriber.insuranceFee ?? 0}</span>
            {subscriber.compoundRights && <span>مركب: {subscriber.compoundRights}</span>}
          </div>
        )}
      </div>
    </motion.div>
  );
});

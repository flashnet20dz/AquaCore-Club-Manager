"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRCard } from "@/components/qr-badge";
import { Printer, X, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { AGE_CATEGORY_INFO, getAgeCategory, type SubscriberWithComputed } from "@/lib/rcs";

interface QRBadgeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriber: SubscriberWithComputed | null;
}

export function QRBadgeModal({ open, onOpenChange, subscriber }: QRBadgeModalProps) {
  if (!subscriber) return null;

  const ageCategory = getAgeCategory(subscriber.gender, subscriber.age);
  const ageCatInfo = AGE_CATEGORY_INFO[ageCategory];

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (!printWindow) {
      toast.error("اسمح بالنوافذ المنبثقة للطباعة");
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>بطاقة ${subscriber.fileNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Cairo', 'Tajawal', Arial, sans-serif; padding: 20px; display: flex; justify-content: center; }
          .card { width: 280px; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.15); }
          .header { background: linear-gradient(135deg, #0f766e, #0369a1); padding: 12px; color: white; display: flex; align-items: center; gap: 8px; }
          .header .logo { width: 32px; height: 32px; background: #ffffff; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #0f766e; }
          .header h1 { font-size: 14px; }
          .header p { font-size: 10px; opacity: 0.8; }
          .body { background: white; padding: 16px; text-align: center; }
          .qr { display: flex; justify-content: center; margin-bottom: 8px; }
          .file { font-family: monospace; font-weight: bold; color: #0f766e; font-size: 14px; }
          .name { font-weight: bold; font-size: 14px; margin-top: 2px; color: #111; }
          .chips { margin-top: 8px; display: flex; justify-content: center; gap: 4px; flex-wrap: wrap; }
          .chip { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
          .chip-teal { background: #ccfbf1; color: #0f766e; }
          .chip-violet { background: #ede9fe; color: #6d28d9; }
          .chip-age { background: ${ageCatInfo.hexColor}22; color: ${ageCatInfo.hexColor}; }
          .days { font-size: 10px; color: #6b7280; margin-top: 4px; }
          .footer { background: #f8fafc; padding: 6px; text-align: center; font-size: 9px; color: #64748b; }
          @media print { body { padding: 0; } .card { box-shadow: none; } }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="logo">R</div>
            <div>
              <h1>نادي RCS</h1>
              <p>للسباحة</p>
            </div>
          </div>
          <div class="body">
            <div class="qr">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(subscriber.fileNumber)}&color=0f766e&bgcolor=ffffff" alt="QR" width="140" height="140" />
            </div>
            <p class="file">${subscriber.fileNumber}</p>
            <p class="name">${subscriber.lastName} ${subscriber.firstName}</p>
            <div class="chips">
              <span class="chip chip-teal">${subscriber.subscriptionType === "/" ? "عادي" : subscriber.subscriptionType}</span>
              ${subscriber.timeSlot ? `<span class="chip chip-violet">${subscriber.timeSlot}</span>` : ""}
              <span class="chip chip-age">${ageCatInfo.icon} ${ageCatInfo.shortLabel}</span>
            </div>
            ${subscriber.swimmingDays ? `<p class="days">${subscriber.swimmingDays}</p>` : ""}
          </div>
          <div class="footer">امسح الكود لتسجيل الحضور</div>
        </div>
        <script>setTimeout(() => { window.print(); }, 500);</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const fullName = `${subscriber.lastName} ${subscriber.firstName}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">بطاقة QR لـ {fullName}</DialogTitle>
        <div className="bg-gradient-to-l from-teal-600 to-sky-700 p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            <h2 className="font-bold">بطاقة المنخرط</h2>
          </div>
          <button onClick={() => onOpenChange(false)} className="rounded-full p-1.5 hover:bg-white/20">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 flex flex-col items-center gap-4">
          <QRCard
            fileNumber={subscriber.fileNumber}
            name={fullName}
            subscriptionType={subscriber.subscriptionType}
            timeSlot={subscriber.timeSlot}
            swimmingDays={subscriber.swimmingDays}
            ageCategoryShort={ageCatInfo.shortLabel}
            ageCategoryIcon={ageCatInfo.icon}
            ageCategoryColor={ageCatInfo.hexColor}
          />

          {/* Quick stats */}
          <div className="w-full grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted/40 p-2">
              <p className="text-xs text-muted-foreground">العمر</p>
              <p className="font-bold text-sm">{subscriber.age} سنة</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-2">
              <p className="text-xs text-muted-foreground">الجنس</p>
              <p className="font-bold text-sm">{subscriber.gender}</p>
            </div>
            <div className="rounded-lg p-2" style={{ backgroundColor: `${ageCatInfo.hexColor}22` }}>
              <p className="text-xs text-muted-foreground">الفئة</p>
              <p className="font-bold text-sm" style={{ color: ageCatInfo.hexColor }}>
                {ageCatInfo.icon} {ageCatInfo.shortLabel}
              </p>
            </div>
          </div>

          {/* Total amount line (separate so we still show revenue context) */}
          <div className="w-full text-center text-xs text-muted-foreground -mt-2">
            الإجمالي: <span className="font-bold text-amber-700 dark:text-amber-300">{subscriber.totalAmount ?? "-"} دج</span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 w-full">
            <Button onClick={handlePrint} className="flex-1">
              <Printer className="h-4 w-4 ml-1" /> طباعة البطاقة
            </Button>
          </div>

          {/* WhatsApp renewal reminder */}
          {subscriber.phone && (
            <a
              href={`https://wa.me/213${subscriber.phone.replace(/^0/, "")}?text=${encodeURIComponent(
                `مرحباً ${fullName}،%0A%0Aاشتراكك في نادي RCS ينتهي في ${
                  subscriber.expiryDate ? new Date(subscriber.expiryDate).toISOString().split("T")[0].replace(/-/g,"/") : "قريب"
                }.%0A%0Aيرجى التجديد في أقرب وقت. شكراً.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold transition"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm0 1.67c2.2 0 4.27.86 5.82 2.42a8.22 8.22 0 012.41 5.82c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.21 8.21 0 01-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24z"/></svg>
              تذكير بالتجديد عبر WhatsApp
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

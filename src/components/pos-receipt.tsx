"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Printer, Loader2, Receipt, CheckCircle2, Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { SubscriberWithComputed } from "@/lib/rcs";

interface POSReceiptProps {
  open: boolean;
  onClose: () => void;
  subscriber: SubscriberWithComputed | null;
}

type PaperSize = "80mm" | "58mm";

export function POSReceipt({ open, onClose, subscriber }: POSReceiptProps) {
  const [paperSize, setPaperSize] = useState<PaperSize>("80mm");
  const [paidAmount, setPaidAmount] = useState("");
  const [printing, setPrinting] = useState(false);

  // ★ إعادة تعيين عند الفتح
  const handleOpenChange = (o: boolean) => {
    if (o) {
      setPaidAmount(String(subscriber?.totalAmount || 0));
    }
    if (!o) onClose();
  };

  // ★ حساب المتبقي (الدين)
  const total = subscriber?.totalAmount || 0;
  const paid = parseFloat(paidAmount) || 0;
  const remaining = Math.max(0, total - paid);

  // ★ توليد QR مشفّر بسيط (hash من البيانات)
  const generateReceiptQR = useCallback(() => {
    if (!subscriber) return "";
    const data = `${subscriber.fileNumber}|${subscriber.lastName}|${total}|${paid}|${Date.now()}`;
    // Base64 تشفير بسيط (للعرض فقط)
    return btoa(unescape(encodeURIComponent(data)));
  }, [subscriber, total, paid]);

  // ★ طباعة الإيصال
  const handlePrint = useCallback(async () => {
    if (!subscriber) return;
    setPrinting(true);
    try {
      const qrData = generateReceiptQR();
      const width = paperSize === "80mm" ? "80mm" : "58mm";
      const padding = paperSize === "80mm" ? "8mm" : "4mm";
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-GB");
      const timeStr = now.toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" });

      // ★ بناء HTML للإيصال — مهيأ للطباعة الحرارية
      const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
        <title>وصل استلام — ${subscriber.fileNumber}</title>
        <style>
          @page { size: ${width}; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            width: ${width};
            padding: ${padding};
            font-family: 'Cairo', 'Tahoma', monospace;
            font-size: 11px;
            direction: rtl;
            color: #000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .lg { font-size: 14px; }
          .xl { font-size: 18px; }
          .sm { font-size: 9px; }
          .muted { color: #666; }
          .border-top { border-top: 1px dashed #000; padding-top: 4px; margin-top: 4px; }
          .border-bottom { border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 4px; }
          .row { display: flex; justify-content: space-between; padding: 2px 0; }
          .total { font-size: 16px; font-weight: bold; }
          .qr { text-align: center; margin: 8px 0; }
          .sign { margin-top: 20px; text-align: center; }
          .sign-line { border-top: 1px solid #000; margin-top: 30px; padding-top: 4px; }
          @media print {
            body { width: ${width}; }
          }
        </style>
        </head><body>
        <!-- رأس الإيصال -->
        <div class="center bold lg">نادي RCS للسباحة</div>
        <div class="center sm muted">وصل استلام اشتراك</div>
        <div class="center sm muted">${dateStr} — ${timeStr}</div>
        <div class="border-top"></div>

        <!-- بيانات المنخرط -->
        <div class="row"><span>رقم الملف:</span><span class="bold font-mono">${subscriber.fileNumber}</span></div>
        <div class="row"><span>الاسم:</span><span class="bold">${subscriber.lastName} ${subscriber.firstName}</span></div>
        ${subscriber.subscriptionType ? `<div class="row"><span>الاشتراك:</span><span>${subscriber.subscriptionType}</span></div>` : ""}
        <div class="border-top"></div>

        <!-- التفاصيل المالية -->
        <div class="row"><span>رسوم الاشتراك:</span><span>${subscriber.subscriptionFee || 0} دج</span></div>
        <div class="row"><span>التأمين الرياضي:</span><span>${subscriber.insuranceFee || 0} دج</span></div>
        <div class="row"><span>حقوق المركب:</span><span>${subscriber.compoundRights || 0} دج</span></div>
        <div class="border-top"></div>

        <!-- المجموع -->
        <div class="row total"><span>المجموع:</span><span>${total} دج</span></div>
        <div class="row"><span>المدفوع:</span><span class="bold">${paid} دج</span></div>
        ${remaining > 0 ? `<div class="row"><span>المتبقي (الدين):</span><span class="bold" style="color:#c00;">${remaining} دج</span></div>` : `<div class="row center bold" style="color:#080;">✓ مدفوع بالكامل</div>`}
        <div class="border-top"></div>

        <!-- QR للتأكد -->
        <div class="qr">
          <div style="display:inline-block;padding:4px;border:1px solid #000;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrData)}" 
                 alt="QR" style="width:80px;height:80px;" />
          </div>
          <div class="sm muted">رمز التحقق: ${qrData.substring(0, 12)}...</div>
        </div>

        <!-- توقيع -->
        <div class="sign">
          <div class="sign-line sm">توقيع الكاشير</div>
        </div>

        <div class="center sm muted border-top">AquaCore Club Manager — ${now.getFullYear()}</div>
        </body></html>`;

      // ★ فتح نافذة طباعة
      const w = window.open("", "_blank", "width=400,height=600");
      if (!w) {
        toast.error("اسمح بالنوافذ المنبثقة للطباعة");
        return;
      }
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => {
        w.print();
        w.close();
      }, 500);
      toast.success("جاري طباعة الوصل الحراري...");
    } catch (e) {
      console.error(e);
      toast.error("فشل طباعة الوصل");
    } finally {
      setPrinting(false);
    }
  }, [subscriber, paperSize, total, paid, generateReceiptQR]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-teal-600" /> طباعة وصل حراري (POS)
          </DialogTitle>
          <DialogDescription>
            طباعة وصل استلام متوافق مع الطابعات الحرارية (80mm / 58mm)
          </DialogDescription>
        </DialogHeader>

        {subscriber && (
          <div className="space-y-4">
            {/* بيانات المنخرط */}
            <div className="rounded-lg bg-muted/40 p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">الاسم:</span>
                <span className="font-bold">{subscriber.lastName} {subscriber.firstName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">رقم الملف:</span>
                <span className="font-mono font-bold">{subscriber.fileNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">نوع الاشتراك:</span>
                <span>{subscriber.subscriptionType}</span>
              </div>
            </div>

            {/* التفاصيل المالية */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>رسوم الاشتراك:</span>
                <span className="font-bold">{subscriber.subscriptionFee || 0} دج</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>التأمين الرياضي:</span>
                <span className="font-bold">{subscriber.insuranceFee || 0} دج</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>حقوق المركب:</span>
                <span className="font-bold">{subscriber.compoundRights || 0} دج</span>
              </div>
              <div className="flex justify-between text-base font-extrabold border-t pt-2">
                <span>المجموع:</span>
                <span className="text-teal-700">{total} دج</span>
              </div>
            </div>

            {/* المبلغ المدفوع */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">المبلغ المدفوع (دج)</Label>
              <Input
                type="number"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                className="h-11 text-lg font-bold"
                dir="ltr"
              />
              {remaining > 0 && (
                <p className="text-sm text-rose-600 font-semibold">
                  المتبقي (الدين): {remaining} دج
                </p>
              )}
              {remaining === 0 && paid > 0 && (
                <p className="text-sm text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> مدفوع بالكامل
                </p>
              )}
            </div>

            {/* مقاس الورقة */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">مقاس الورقة</Label>
              <Select value={paperSize} onValueChange={(v) => setPaperSize(v as PaperSize)}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="80mm">80mm (القياسي)</SelectItem>
                  <SelectItem value="58mm">58mm (مصغّر)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* زر الطباعة */}
            <Button
              onClick={handlePrint}
              disabled={printing}
              className="w-full h-12 bg-gradient-to-l from-teal-600 to-sky-600 text-white font-bold"
            >
              {printing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5 ml-1" />}
              طباعة الوصل الحراري
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

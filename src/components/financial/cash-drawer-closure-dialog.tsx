"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Printer,
  Receipt,
  Scale,
  Coins,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDateArabic, formatTime } from "@/lib/date-utils";

interface CashClosureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubName?: string;
  todayIncome?: number;
  todayExpense?: number;
}

function formatDA(n: number): string {
  return new Intl.NumberFormat("fr-DZ").format(Math.round(n)) + " دج";
}

export function CashDrawerClosureDialog({
  open,
  onOpenChange,
  clubName = "AquaCore Club",
  todayIncome = 0,
  todayExpense = 0,
}: CashClosureDialogProps) {
  const expectedCash = Math.max(0, todayIncome - todayExpense);
  const [actualCashStr, setActualCashStr] = useState<string>("");
  const [cashierName, setCashierName] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const actualCash = actualCashStr === "" ? expectedCash : Number(actualCashStr) || 0;
  const variance = actualCash - expectedCash;

  const handlePrintZReport = () => {
    const win = window.open("", "_blank", "width=800,height=700");
    if (!win) {
      toast.error("يرجى السماح بالنوافذ المنبثقة لطباعة التقرير");
      return;
    }

    const now = new Date();
    const dateStr = formatDateArabic(now, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const timeStr = formatTime(now);

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>محضر إقفال الصندوق اليومي — ${dateStr}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 24px;
      color: #1e293b;
      background: #fff;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #0d9488;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .club-title {
      font-size: 20px;
      font-weight: 800;
      color: #0f766e;
      margin: 0;
    }
    .report-title {
      font-size: 16px;
      font-weight: 700;
      margin: 6px 0 2px 0;
    }
    .date-badge {
      font-size: 12px;
      color: #64748b;
    }
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .summary-table th, .summary-table td {
      border: 1px solid #e2e8f0;
      padding: 10px 14px;
      font-size: 13px;
    }
    .summary-table th {
      background: #f8fafc;
      text-align: right;
      font-weight: 700;
      width: 60%;
    }
    .summary-table td {
      text-align: left;
      font-weight: 800;
      direction: ltr;
    }
    .variance-row {
      background: ${variance === 0 ? "#f0fdf4" : variance > 0 ? "#eff6ff" : "#fef2f2"};
    }
    .notes-box {
      border: 1px dashed #cbd5e1;
      padding: 12px;
      border-radius: 6px;
      margin: 16px 0;
      font-size: 12px;
      background: #f8fafc;
    }
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 48px;
      padding: 0 20px;
    }
    .sig-block {
      text-align: center;
      width: 200px;
    }
    .sig-line {
      border-top: 1px solid #94a3b8;
      margin-top: 50px;
      padding-top: 6px;
      font-size: 12px;
      font-weight: 600;
    }
    @media print {
      body { padding: 10px; }
      @page { margin: 1.5cm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="club-title">${clubName}</h1>
    <h2 class="report-title">محضر إقفال الصندوق اليومي (تقرير Z)</h2>
    <div class="date-badge">${dateStr} — الساعة: ${timeStr}</div>
  </div>

  <table class="summary-table">
    <tr>
      <th>المقبوضات النقدية لليوم (المداخيل)</th>
      <td>+${new Intl.NumberFormat("fr-DZ").format(Math.round(todayIncome))} دج</td>
    </tr>
    <tr>
      <th>المصروفات النقدية المسجلة لليوم</th>
      <td>-${new Intl.NumberFormat("fr-DZ").format(Math.round(todayExpense))} دج</td>
    </tr>
    <tr>
      <th>الرصيد الدفتري المتوقع في الصندوق</th>
      <td>${new Intl.NumberFormat("fr-DZ").format(Math.round(expectedCash))} دج</td>
    </tr>
    <tr>
      <th>النقد الفعلي المحصي في الدرج</th>
      <td>${new Intl.NumberFormat("fr-DZ").format(Math.round(actualCash))} دج</td>
    </tr>
    <tr class="variance-row">
      <th>الفارق (عجز / فائض الصندوق)</th>
      <td style="color: ${variance === 0 ? "#16a34a" : variance > 0 ? "#2563eb" : "#dc2626"};">
        ${variance > 0 ? "+" : ""}${new Intl.NumberFormat("fr-DZ").format(Math.round(variance))} دج
      </td>
    </tr>
  </table>

  ${notes ? `<div class="notes-box"><strong>ملاحظات الإقفال:</strong> ${notes}</div>` : ""}

  <div class="signatures">
    <div class="sig-block">
      <div>أمين الصندوق (الكاشير)</div>
      <div style="font-size: 11px; color: #64748b; margin-top: 4px;">${cashierName || "الموظف المسؤول"}</div>
      <div class="sig-line">التوقيع والتاريخ</div>
    </div>
    <div class="sig-block">
      <div>إدارة النادي / المشرف المالي</div>
      <div style="font-size: 11px; color: #64748b; margin-top: 4px;">المصادقة والاعتماد</div>
      <div class="sig-line">التوقيع والختم</div>
    </div>
  </div>

  <script>
    window.onload = function() { window.print(); }
  </script>
</body>
</html>`;

    win.document.write(html);
    win.document.close();
    toast.success("تم تجهيز محضر إقفال الصندوق للطباعة");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-teal-600/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-extrabold">
                إقفال الصندوق اليومي (تقرير Z)
              </DialogTitle>
              <DialogDescription className="text-xs">
                مطابقة النقد الفعلي في الدرج مع الحركات المسجلة لليوم
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* ملخص أرقام اليوم */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl border border-border/70 bg-background/50 space-y-1">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <ArrowDownCircle className="h-3.5 w-3.5 text-emerald-500" />
                المقبوضات النقدية
              </span>
              <p className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                +{formatDA(todayIncome)}
              </p>
            </div>
            <div className="p-3 rounded-xl border border-border/70 bg-background/50 space-y-1">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <ArrowUpCircle className="h-3.5 w-3.5 text-rose-500" />
                المصروفات النقدية
              </span>
              <p className="text-base font-bold tabular-nums text-rose-600 dark:text-rose-400">
                -{formatDA(todayExpense)}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-teal-500/30 bg-teal-500/5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">الرصيد الدفتري المتوقع في الصندوق</p>
              <p className="text-lg font-black tabular-nums text-teal-700 dark:text-teal-300">
                {formatDA(expectedCash)}
              </p>
            </div>
            <Coins className="h-6 w-6 text-teal-600 dark:text-teal-400 opacity-60" />
          </div>

          {/* إدخال النقد الفعلي */}
          <div className="space-y-2">
            <Label htmlFor="actual-cash" className="text-xs font-semibold">
              المبلغ الفعلي في الدرج (المحصي يدوياً)
            </Label>
            <Input
              id="actual-cash"
              type="number"
              placeholder={String(expectedCash)}
              value={actualCashStr}
              onChange={(e) => setActualCashStr(e.target.value)}
              className="tabular-nums font-bold text-base text-left"
              dir="ltr"
            />
          </div>

          {/* احتساب الفارق */}
          <div
            className={cn(
              "p-3 rounded-xl border text-xs flex items-center justify-between",
              variance === 0
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : variance > 0
                ? "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
            )}
          >
            <div className="flex items-center gap-2">
              {variance === 0 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <span className="font-medium">
                {variance === 0
                  ? "الصندوق مطابق تماماً بلا أي فارق"
                  : variance > 0
                  ? "يوجد فائض نقدي في الدرج"
                  : "يوجد عجز نقدي في الدرج"}
              </span>
            </div>
            <span className="font-extrabold tabular-nums text-sm">
              {variance > 0 ? `+${formatDA(variance)}` : formatDA(variance)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label className="text-[11px]">اسم أمين الصندوق</Label>
              <Input
                placeholder="الاسم واللقب..."
                value={cashierName}
                onChange={(e) => setCashierName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">ملاحظات الإقفال</Label>
              <Input
                placeholder="أي ملاحظة بخصوص الوردية..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            إلغاء
          </Button>
          <Button
            onClick={handlePrintZReport}
            className="bg-teal-600 hover:bg-teal-700 text-white gap-2 text-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            طباعة محضر الإقفال (Z-Report)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

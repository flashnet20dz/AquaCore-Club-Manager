"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText, Printer, Search, RefreshCw, Trash2,
  Calendar, Check, Download, ExternalLink, Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { unifiedReportHeaderHTML } from "@/components/unified-report-header";

interface WageReceiptItem {
  id: string;
  receiptNumber: string;
  season: string;
  date: string;
  workerName: string;
  workerPosition: string;
  nationalId?: string | null;
  periodLabel: string;
  daysWorked: number;
  workHours: number;
  hourRate: number;
  baseWage: number;
  allowances: number;
  deductions: number;
  netAmount: number;
  amountInWords: string;
  subject: string;
  paymentMethod: string;
  paymentReference?: string | null;
  status: string;
  createdAt: string;
}

interface WageReceiptsListProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage?: boolean;
}

const PAYMENT_METHODS_LABELS: Record<string, string> = {
  cash: "نقدًا",
  postal_check: "صك بريدي",
  bank_check: "صك بنكي",
  transfer: "تحويل بريدي / بنكي",
};

export function WageReceiptsList({
  open,
  onOpenChange,
  canManage = false,
}: WageReceiptsListProps) {
  const [receipts, setReceipts] = useState<WageReceiptItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const loadReceipts = useCallback(async () => {
    setLoading(true);
    try {
      const q = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
      const res = await fetch(`/api/wage-receipts${q}`);
      const data = await res.json();
      if (res.ok && data.receipts) {
        setReceipts(data.receipts);
      }
    } catch {
      toast.error("فشل في تحميل سجل الوصولات");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (open) {
      loadReceipts();
    }
  }, [open, loadReceipts]);

  const handleDelete = async (id: string, num: string) => {
    if (!confirm(`هل أنت متأكد من حذف الوصل رقم ${num}؟`)) return;
    try {
      const res = await fetch(`/api/wage-receipts/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("تم حذف الوصل بنجاح");
        setReceipts((prev) => prev.filter((r) => r.id !== id));
      } else {
        toast.error("فشل في حذف الوصل");
      }
    } catch {
      toast.error("حدث خطأ أثناء الحذف");
    }
  };

  const handlePrint = (r: WageReceiptItem) => {
    const printWindow = window.open("", "_blank", "width=850,height=1050");
    if (!printWindow) {
      toast.error("يرجى السماح بالنوافذ المنبثقة");
      return;
    }

    const headerHTML = unifiedReportHeaderHTML({
      reportType: "وَصْلُ اسْتِلَامِ مُسْتَحَقَّاتٍ مَالِيَّة",
      reportSubtitle: `الموسم الرياضي: ${r.season} • ${r.subject}`,
      reportNumber: `وصل رقم: ${r.receiptNumber}`,
      date: r.date.slice(0, 10),
    });

    const paymentMethodLabel = PAYMENT_METHODS_LABELS[r.paymentMethod] || r.paymentMethod;

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>وصل استلام مستحقات - ${r.receiptNumber}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 portrait; margin: 10mm 12mm; }
          * { box-sizing: border-box; }
          body { font-family: 'Cairo', sans-serif; color: #0f172a; margin: 0; padding: 0; direction: rtl; }
          .receipt-container { width: 100%; max-width: 190mm; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }
          .doc-title-banner { text-align: center; background: #0f766e12; border: 1.5px solid #0f766e; border-radius: 8px; padding: 8px 12px; }
          .doc-title { font-size: 16pt; font-weight: 900; color: #0f766e; margin: 0; }
          .doc-meta { font-size: 9.5pt; color: #475569; margin-top: 3px; display: flex; justify-content: space-around; font-weight: 600; }
          .section-card { border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; }
          .section-header { background: #f1f5f9; padding: 5px 12px; font-size: 10.5pt; font-weight: 700; color: #1e293b; border-bottom: 1px solid #cbd5e1; }
          .grid-table { width: 100%; border-collapse: collapse; }
          .grid-table td, .grid-table th { padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 10pt; }
          .grid-table th { background: #f8fafc; color: #334155; text-align: right; font-weight: 700; }
          .amount-box { background: #f0fdf4; border: 1.5px solid #16a34a; border-radius: 8px; padding: 10px 14px; }
          .amount-number { font-size: 14pt; font-weight: 800; color: #15803d; }
          .amount-words { font-size: 11pt; font-weight: 700; color: #166534; margin-top: 4px; }
          .signatures-container { margin-top: 18px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; text-align: center; }
          .sig-box { border: 1px dashed #94a3b8; border-radius: 8px; padding: 8px 6px; min-height: 105px; display: flex; flex-direction: column; justify-content: space-between; }
          .sig-title { font-weight: 700; font-size: 10pt; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
          .sig-placeholder { font-size: 8pt; color: #94a3b8; margin-top: auto; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          ${headerHTML}
          <div class="doc-title-banner">
            <h2 class="doc-title">وَصْلُ اسْتِلَامِ مُسْتَحَقَّاتٍ مَالِيَّة</h2>
            <div class="doc-meta">
              <span>رقم الوصل: <b>${r.receiptNumber}</b></span>
              <span>الموسم الرياضي: <b>${r.season}</b></span>
              <span>تاريخ التحرير: <b>${r.date.slice(0, 10)}</b></span>
            </div>
          </div>
          <div class="section-card">
            <div class="section-header">أولاً: بيانات العامل المستفيد</div>
            <table class="grid-table">
              <tr>
                <th style="width:25%;">الاسم واللقب:</th>
                <td style="width:35%; font-weight:bold; color:#0f766e;">${r.workerName}</td>
                <th style="width:20%;">الصفة / الوظيفة:</th>
                <td style="width:20%; font-weight:600;">${r.workerPosition || "حارس سباحة"}</td>
              </tr>
              <tr>
                <th>رقم بطاقة التعريف:</th>
                <td colspan="3">${r.nationalId || "—"}</td>
              </tr>
            </table>
          </div>
          <div class="section-card">
            <div class="section-header">ثانياً: تفاصيل الأجر المحسوب (${r.subject})</div>
            <table class="grid-table" style="text-align: center;">
              <thead>
                <tr>
                  <th>الشهر</th>
                  <th>أيام العمل</th>
                  <th>ساعات العمل</th>
                  <th>سعر الساعة</th>
                  <th>الأجر الأساسي</th>
                  <th>التعويضات</th>
                  <th>الخصومات</th>
                  <th style="background:#ecfdf5; color:#065f46;">صافي المستحقات</th>
                </tr>
              </thead>
              <tbody>
                <tr style="font-weight:600;">
                  <td>${r.periodLabel}</td>
                  <td>${r.daysWorked} يوم</td>
                  <td>${r.workHours} سا</td>
                  <td>${r.hourRate} دج</td>
                  <td>${r.baseWage.toLocaleString()} دج</td>
                  <td style="color:#047857;">+${r.allowances.toLocaleString()} دج</td>
                  <td style="color:#b91c1c;">-${r.deductions.toLocaleString()} دج</td>
                  <td style="background:#ecfdf5; font-size:11pt; font-weight:800; color:#047857;">
                    ${r.netAmount.toLocaleString()} دج
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="amount-box">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed #86efac; padding-bottom:6px;">
              <span class="amount-number">المبلغ بالأرقام: ${r.netAmount.toLocaleString()} دج</span>
              <span style="font-weight:700; color:#166534; font-size:10pt;">
                طريقة الدفع: <b>${paymentMethodLabel}</b>
                ${r.paymentReference ? ` (${r.paymentReference})` : ""}
              </span>
            </div>
            <div class="amount-words">
              المبلغ بالحروف: <b>${r.amountInWords}</b>
            </div>
          </div>
          <div class="signatures-container">
            <div class="sig-box">
              <div class="sig-title">توقيع واستلام المعني(ة) بالأمر</div>
              <div class="sig-placeholder">الاسم وتأكيد الاستلام</div>
            </div>
            <div class="sig-box">
              <div class="sig-title">ختم وتوقيع إدارة النادي</div>
              <div class="sig-placeholder">الرئيس أو أمين المال</div>
            </div>
            <div class="sig-box">
              <div class="sig-title">ختم مصالح البلدية</div>
              <div class="sig-placeholder">المصادقة والتأشيرة</div>
            </div>
          </div>
        </div>
        <script>
          window.onload = function() { setTimeout(function() { window.print(); }, 400); };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 border-b pb-2">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <FileText className="h-5 w-5 text-teal-600" />
              أرشيف وسجل وصولات استلام المستحقات المالية
            </DialogTitle>
            <Badge variant="secondary" className="text-xs">
              {receipts.length} وصل
            </Badge>
          </div>
        </DialogHeader>

        {/* بحث وتحديث */}
        <div className="flex items-center gap-2 pt-1">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute right-2.5 top-2.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadReceipts()}
              placeholder="ابحث برقم الوصل، اسم العامل، رقم التعريف..."
              className="h-9 pr-9 text-xs"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadReceipts}
            className="h-9 text-xs gap-1"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            تحديث
          </Button>
        </div>

        {/* جدول السجل */}
        <div className="rounded-xl border overflow-hidden mt-2">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-teal-600" />
              جاري تحميل الوصولات...
            </div>
          ) : receipts.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              لا توجد وصولات مستحقات مسجلة بعد. يمكنك إنشاء وصل جديد من جدول الأجور.
            </div>
          ) : (
            <table className="w-full text-xs text-right">
              <thead className="bg-muted font-bold text-slate-700">
                <tr>
                  <th className="p-2.5 text-center">رقم الوصل</th>
                  <th className="p-2.5">العامل</th>
                  <th className="p-2.5 text-center">الفترة</th>
                  <th className="p-2.5 text-center">الساعات</th>
                  <th className="p-2.5 text-center">صافي المبلغ</th>
                  <th className="p-2.5 text-center">طريقة الدفع</th>
                  <th className="p-2.5 text-center">تاريخ التحرير</th>
                  <th className="p-2.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {receipts.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/40 transition-colors">
                    <td className="p-2.5 text-center font-bold text-teal-700">
                      {r.receiptNumber}
                    </td>
                    <td className="p-2.5">
                      <div className="font-semibold">{r.workerName}</div>
                      <div className="text-[10px] text-muted-foreground">{r.workerPosition}</div>
                    </td>
                    <td className="p-2.5 text-center font-medium">{r.periodLabel}</td>
                    <td className="p-2.5 text-center tabular-nums">{r.workHours} سا</td>
                    <td className="p-2.5 text-center font-bold text-emerald-700 tabular-nums">
                      {r.netAmount.toLocaleString()} دج
                    </td>
                    <td className="p-2.5 text-center">
                      <Badge variant="outline" className="text-[10px]">
                        {PAYMENT_METHODS_LABELS[r.paymentMethod] || r.paymentMethod}
                      </Badge>
                    </td>
                    <td className="p-2.5 text-center text-[10px] text-muted-foreground">
                      {r.date ? r.date.slice(0, 10) : "—"}
                    </td>
                    <td className="p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handlePrint(r)}
                          className="h-7 px-2 text-xs gap-1 text-teal-700 border-teal-500/30 hover:bg-teal-50"
                          title="طباعة A4"
                        >
                          <Printer className="h-3 w-3" />
                          طباعة
                        </Button>
                        {canManage && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(r.id, r.receiptNumber)}
                            className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50"
                            title="حذف الوصل"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

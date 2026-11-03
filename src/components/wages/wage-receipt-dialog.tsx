"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  FileText, Printer, Check, Save, RefreshCw,
  Eye, Calendar, DollarSign, User, Building,
  CreditCard, ShieldCheck, AlertCircle, Stamp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { tafqeetDZD } from "@/lib/tafqeet";
import { toLocalYMD } from "@/lib/wall-clock";
import { UnifiedReportHeader, unifiedReportHeaderHTML } from "@/components/unified-report-header";

export interface WageReceiptInitialData {
  userId?: string;
  employeeId?: string;
  workerName: string;
  workerPosition?: string;
  nationalId?: string;
  idIssueDate?: string;
  idIssuePlace?: string;
  periodLabel: string;
  daysWorked: number;
  workHours: number;
  hourRate: number;
  baseWage: number;
  gross?: number;
  allowances?: number;
  deductions?: number;
  netAmount?: number;
  wagePaymentId?: string;
}

interface WageReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: WageReceiptInitialData | null;
  onSaved?: () => void;
}

const PAYMENT_METHODS: Record<string, string> = {
  cash: "نقدًا",
  postal_check: "صك بريدي",
  bank_check: "صك بنكي",
  transfer: "تحويل بريدي / بنكي",
};

export function WageReceiptDialog({
  open,
  onOpenChange,
  data,
  onSaved,
}: WageReceiptDialogProps) {
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [isSaving, setIsSaving] = useState(false);

  // حقول الوصل
  const [receiptNumber, setReceiptNumber] = useState("");
  const [season, setSeason] = useState("2025/2026");
  const [date, setDate] = useState(toLocalYMD());

  // العامل
  const [workerName, setWorkerName] = useState("");
  const [workerPosition, setWorkerPosition] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [idIssueDate, setIdIssueDate] = useState("");
  const [idIssuePlace, setIdIssuePlace] = useState("");
  const [saveToEmployee, setSaveToEmployee] = useState(true);

  // الحسابات
  const [periodLabel, setPeriodLabel] = useState("");
  const [daysWorked, setDaysWorked] = useState(0);
  const [workHours, setWorkHours] = useState(0);
  const [hourRate, setHourRate] = useState(200);
  const [allowances, setAllowances] = useState(0);
  const [deductions, setDeductions] = useState(0);

  // الدفع
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [notes, setNotes] = useState("");

  // حساب الأجر الأساسي وصافي المستحقات
  const baseWage = useMemo(() => {
    return Math.round(workHours * hourRate);
  }, [workHours, hourRate]);

  const netAmount = useMemo(() => {
    const net = baseWage + (Number(allowances) || 0) - (Number(deductions) || 0);
    return Math.max(0, net);
  }, [baseWage, allowances, deductions]);

  // التفقيط باللغة العربية
  const amountInWords = useMemo(() => {
    return tafqeetDZD(netAmount);
  }, [netAmount]);

  // موضوع الدفع
  const subject = useMemo(() => {
    return `مستحقات / أجر شهر: ${periodLabel || "الفترة الحالية"}`;
  }, [periodLabel]);

  // تعبئة البيانات الافتراضية عند فتح الحوار
  useEffect(() => {
    if (!open || !data) return;

    setWorkerName(data.workerName || "");
    setWorkerPosition(data.workerPosition || "حارس سباحة");
    setNationalId(data.nationalId || "");
    setIdIssueDate(data.idIssueDate ? data.idIssueDate.slice(0, 10) : "");
    setIdIssuePlace(data.idIssuePlace || "");

    setPeriodLabel(data.periodLabel || "");
    setDaysWorked(data.daysWorked || 0);
    setWorkHours(data.workHours || 0);
    setHourRate(data.hourRate || 200);
    setAllowances(data.allowances || 0);
    setDeductions(data.deductions || 0);

    setDate(toLocalYMD());
    setActiveTab("edit");

    // جلب رقم مقترح من الخادم
    fetch("/api/wage-receipts")
      .then((r) => r.json())
      .then((res) => {
        if (res.suggestedNumber) {
          setReceiptNumber(res.suggestedNumber);
        }
      })
      .catch(() => {
        const year = new Date().getFullYear();
        setReceiptNumber(`001 / ${year}`);
      });

    // جلب إعدادات النادي للموسم
    fetch("/api/settings")
      .then((r) => r.json())
      .then((res) => {
        if (res.sportSeason) setSeason(res.sportSeason);
      })
      .catch(() => {});

    // محاولة استرجاع تفاصيل بطاقة التعريف الوطنية للموظف إذا وُجد
    if (data.employeeId || data.userId) {
      fetch(`/api/employees?q=${encodeURIComponent(data.workerName)}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.employees && res.employees.length > 0) {
            const emp = res.employees[0];
            if (emp.nationalId && !data.nationalId) setNationalId(emp.nationalId);
            if (emp.idIssueDate && !data.idIssueDate) setIdIssueDate(emp.idIssueDate.slice(0, 10));
            if (emp.idIssuePlace && !data.idIssuePlace) setIdIssuePlace(emp.idIssuePlace);
          }
        })
        .catch(() => {});
    }
  }, [open, data]);

  // حفظ الوصل في قاعدة البيانات
  const handleSave = useCallback(async () => {
    if (!workerName.trim()) {
      toast.error("يرجى إدخال اسم العامل");
      return;
    }
    if (!receiptNumber.trim()) {
      toast.error("يرجى إدخال رقم الوصل");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/wage-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiptNumber,
          season,
          date,
          employeeId: data?.employeeId,
          userId: data?.userId,
          workerName,
          workerPosition,
          nationalId,
          idIssueDate: idIssueDate || null,
          idIssuePlace,
          periodLabel,
          daysWorked,
          workHours,
          hourRate,
          baseWage,
          allowances,
          deductions,
          netAmount,
          subject,
          paymentMethod,
          paymentReference,
          wagePaymentId: data?.wagePaymentId,
          updateEmployeeProfile: saveToEmployee,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "فشل في حفظ الوصل");
      }

      toast.success("تم حفظ وصل استلام المستحقات بنجاح");
      if (onSaved) onSaved();
      return result.receipt;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل في حفظ الوصل";
      toast.error(msg);
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [
    receiptNumber, season, date, data, workerName, workerPosition,
    nationalId, idIssueDate, idIssuePlace, periodLabel, daysWorked,
    workHours, hourRate, baseWage, allowances, deductions, netAmount,
    subject, paymentMethod, paymentReference, saveToEmployee, onSaved
  ]);

  // طباعة الوصل عبر A4 مع الترويسة الموحدة المعتمدة
  const handlePrint = useCallback(() => {
    const printWindow = window.open("", "_blank", "width=850,height=1050");
    if (!printWindow) {
      toast.error("يرجى السماح بالنوافذ المنبثقة للطباعة");
      return;
    }

    // جلب الترويسة الموحدة HTML
    const headerHTML = unifiedReportHeaderHTML({
      reportType: "وَصْلُ اسْتِلَامِ مُسْتَحَقَّاتٍ مَالِيَّة",
      reportSubtitle: `الموسم الرياضي: ${season} • ${subject}`,
      reportNumber: `وصل رقم: ${receiptNumber}`,
      date: date,
    });

    const paymentMethodLabel = PAYMENT_METHODS[paymentMethod] || paymentMethod;

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>وصل استلام مستحقات مالية - ${workerName} - ${receiptNumber}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: 'Cairo', 'Tahoma', Arial, sans-serif;
            color: #0f172a;
            background: #fff;
            margin: 0;
            padding: 0;
            line-height: 1.4;
            font-size: 11pt;
            direction: rtl;
          }
          .receipt-container {
            width: 100%;
            max-width: 190mm;
            margin: 0 auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .doc-title-banner {
            text-align: center;
            background: linear-gradient(135deg, #0f766e12, #0284c712);
            border: 1.5px solid #0f766e;
            border-radius: 8px;
            padding: 8px 12px;
            margin: 6px 0;
          }
          .doc-title {
            font-size: 16pt;
            font-weight: 900;
            color: #0f766e;
            margin: 0;
            letter-spacing: 0.5px;
          }
          .doc-meta {
            font-size: 9.5pt;
            color: #475569;
            margin-top: 3px;
            display: flex;
            justify-content: space-around;
            font-weight: 600;
          }
          .section-card {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            overflow: hidden;
            margin-bottom: 8px;
          }
          .section-header {
            background: #f1f5f9;
            padding: 5px 12px;
            font-size: 10.5pt;
            font-weight: 700;
            color: #1e293b;
            border-bottom: 1px solid #cbd5e1;
          }
          .grid-table {
            width: 100%;
            border-collapse: collapse;
          }
          .grid-table td, .grid-table th {
            padding: 6px 10px;
            border: 1px solid #e2e8f0;
            font-size: 10pt;
          }
          .grid-table th {
            background: #f8fafc;
            color: #334155;
            text-align: right;
            font-weight: 700;
          }
          .amount-box {
            background: #f0fdf4;
            border: 1.5px solid #16a34a;
            border-radius: 8px;
            padding: 10px 14px;
            margin: 8px 0;
          }
          .amount-number {
            font-size: 14pt;
            font-weight: 800;
            color: #15803d;
          }
          .amount-words {
            font-size: 11pt;
            font-weight: 700;
            color: #166534;
            margin-top: 4px;
          }
          .signatures-container {
            margin-top: 18px;
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 12px;
            text-align: center;
          }
          .sig-box {
            border: 1px dashed #94a3b8;
            border-radius: 8px;
            padding: 8px 6px;
            min-height: 105px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .sig-title {
            font-weight: 700;
            font-size: 10pt;
            color: #1e293b;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 4px;
          }
          .sig-placeholder {
            font-size: 8pt;
            color: #94a3b8;
            margin-top: auto;
          }
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <!-- 1. الترويسة الموحدة المركزية -->
          ${headerHTML}

          <!-- 2. عنوان الوثيقة الرسمي -->
          <div class="doc-title-banner">
            <h2 class="doc-title">وَصْلُ اسْتِلَامِ مُسْتَحَقَّاتٍ مَالِيَّة</h2>
            <div class="doc-meta">
              <span>رقم الوصل: <b>${receiptNumber}</b></span>
              <span>الموسم الرياضي: <b>${season}</b></span>
              <span>تاريخ التحرير: <b>${date}</b></span>
            </div>
          </div>

          <!-- 3. بيانات العامل -->
          <div class="section-card">
            <div class="section-header">أولاً: بيانات العامل المستفيد</div>
            <table class="grid-table">
              <tr>
                <th style="width: 25%;">الاسم واللقب:</th>
                <td style="width: 35%; font-weight: bold; color: #0f766e;">${workerName}</td>
                <th style="width: 20%;">الصفة / الوظيفة:</th>
                <td style="width: 20%; font-weight: 600;">${workerPosition || "حارس سباحة"}</td>
              </tr>
              <tr>
                <th>رقم بطاقة التعريف الوطنية:</th>
                <td>${nationalId || "—"}</td>
                <th>تاريخ ومكان الإصدار:</th>
                <td>${idIssueDate || "—"} ${idIssuePlace ? `بـ: ${idIssuePlace}` : ""}</td>
              </tr>
            </table>
          </div>

          <!-- 4. تفاصيل الأجر والمستحقات -->
          <div class="section-card">
            <div class="section-header">ثانياً: تفاصيل الأجر المحسوب (${subject})</div>
            <table class="grid-table" style="text-align: center;">
              <thead>
                <tr>
                  <th>الشهر / الفترة</th>
                  <th>أيام العمل</th>
                  <th>ساعات العمل</th>
                  <th>سعر الساعة</th>
                  <th>الأجر الأساسي</th>
                  <th>التعويضات (+)</th>
                  <th>الخصومات (-)</th>
                  <th style="background:#ecfdf5; color:#065f46;">صافي المستحقات</th>
                </tr>
              </thead>
              <tbody>
                <tr style="font-weight: 600;">
                  <td>${periodLabel}</td>
                  <td>${daysWorked} يوم</td>
                  <td>${workHours} سا</td>
                  <td>${hourRate} دج</td>
                  <td>${baseWage.toLocaleString()} دج</td>
                  <td style="color: #047857;">${Number(allowances || 0).toLocaleString()} دج</td>
                  <td style="color: #b91c1c;">${Number(deductions || 0).toLocaleString()} دج</td>
                  <td style="background:#ecfdf5; font-size:11pt; font-weight:800; color:#047857;">
                    ${netAmount.toLocaleString()} دج
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 5. المبلغ بالأرقام والحروف وطريقة الدفع -->
          <div class="amount-box">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #86efac; padding-bottom: 6px;">
              <span class="amount-number">المبلغ بالأرقام: ${netAmount.toLocaleString()} دج</span>
              <span style="font-weight: 700; color: #166534; font-size: 10pt;">
                طريقة الدفع: <b>${paymentMethodLabel}</b>
                ${paymentReference ? ` (مرجع: ${paymentReference})` : ""}
              </span>
            </div>
            <div class="amount-words">
              المبلغ بالحروف: <b>${amountInWords}</b>
            </div>
          </div>

          <!-- 6. موضوع الدفع والتصريح -->
          <div style="padding: 6px 10px; font-size: 9.5pt; color: #334155; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
            أقر أنا الموقع(ة) أدناه المعني(ة) بالأمر باستلام كامل مستحقاتي المالية المبيّنة أعلاه عن <b>${subject}</b>، دون أي تحفظ أو اعتراض.
          </div>

          <!-- 7. التوقيعات الثلاثية الرسمية -->
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
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 400);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }, [
    season, subject, receiptNumber, date, paymentMethod,
    workerName, workerPosition, nationalId, idIssueDate,
    idIssuePlace, periodLabel, daysWorked, workHours, hourRate,
    baseWage, allowances, deductions, netAmount, paymentReference,
    amountInWords
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 border-b pb-2.5">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-teal-800 dark:text-teal-300">
              <FileText className="h-5 w-5 text-teal-600" />
              إنشاء وصل استلام المستحقات المالية
            </DialogTitle>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant={activeTab === "edit" ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => setActiveTab("edit")}
              >
                تعديل البيانات
              </Button>
              <Button
                type="button"
                variant={activeTab === "preview" ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => setActiveTab("preview")}
              >
                <Eye className="h-3.5 w-3.5" />
                معاينة الوصل
              </Button>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            يُولَّد الوصل تلقائيًا معتمدًا على الترويسة الموحدة المركزية والتفقيط بالدينار الجزائري والتوقيعات الثلاثية.
          </DialogDescription>
        </DialogHeader>

        {activeTab === "edit" ? (
          <div className="space-y-4 py-2">
            {/* 1. معلومات التحرير والرقم */}
            <div className="rounded-xl border bg-muted/30 p-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2.5 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-teal-600" /> معلومات الوثيقة والموسم
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">رقم الوصل *</Label>
                  <Input
                    value={receiptNumber}
                    onChange={(e) => setReceiptNumber(e.target.value)}
                    placeholder="001 / 2026"
                    className="h-8 text-xs font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">الموسم الرياضي</Label>
                  <Input
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                    placeholder="2025/2026"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">تاريخ التحرير</Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* 2. بيانات العامل */}
            <div className="rounded-xl border bg-card p-3 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <User className="h-4 w-4 text-teal-600" /> بيانات العامل (من ملف العامل)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">الاسم واللقب *</Label>
                  <Input
                    value={workerName}
                    onChange={(e) => setWorkerName(e.target.value)}
                    className="h-8 text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">الصفة / الوظيفة</Label>
                  <Input
                    value={workerPosition}
                    onChange={(e) => setWorkerPosition(e.target.value)}
                    placeholder="حارس سباحة / مدرب / عون صيانة..."
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">رقم بطاقة التعريف الوطنية</Label>
                  <Input
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    placeholder="رقم بطاقة التعريف البيومترية"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">تاريخ الإصدار</Label>
                    <Input
                      type="date"
                      value={idIssueDate}
                      onChange={(e) => setIdIssueDate(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">مكان الإصدار</Label>
                    <Input
                      value={idIssuePlace}
                      onChange={(e) => setIdIssuePlace(e.target.value)}
                      placeholder="دائرة سعيدة"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>

              {data?.employeeId && (
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id="saveToEmp"
                    checked={saveToEmployee}
                    onCheckedChange={(c) => setSaveToEmployee(!!c)}
                  />
                  <Label htmlFor="saveToEmp" className="text-xs text-muted-foreground cursor-pointer">
                    حفظ وتحديث بيانات بطاقة التعريف في ملف العامل تلقائيًا
                  </Label>
                </div>
              )}
            </div>

            {/* 3. تفاصيل الأجر والمستحقات */}
            <div className="rounded-xl border bg-card p-3 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-teal-600" /> تفاصيل الأجر المحسوب من ساعات العمل
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">الشهر / الفترة</Label>
                  <Input
                    value={periodLabel}
                    onChange={(e) => setPeriodLabel(e.target.value)}
                    placeholder="أوت 2026"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">أيام العمل</Label>
                  <Input
                    type="number"
                    min={0}
                    value={daysWorked}
                    onChange={(e) => setDaysWorked(Number(e.target.value))}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">ساعات العمل</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min={0}
                    value={workHours}
                    onChange={(e) => setWorkHours(Number(e.target.value))}
                    className="h-8 text-xs font-bold text-teal-700"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">سعر الساعة (دج)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={hourRate}
                    onChange={(e) => setHourRate(Number(e.target.value))}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">الأجر الأساسي</Label>
                  <div className="h-8 flex items-center px-2.5 rounded-md bg-muted text-xs font-bold text-slate-800">
                    {baseWage.toLocaleString()} دج
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-emerald-700">التعويضات / المنح (+)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={allowances}
                    onChange={(e) => setAllowances(Number(e.target.value))}
                    className="h-8 text-xs text-emerald-700 font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-rose-700">الخصومات (-)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={deductions}
                    onChange={(e) => setDeductions(Number(e.target.value))}
                    className="h-8 text-xs text-rose-700 font-semibold"
                  />
                </div>
              </div>

              {/* صندوق الصافي والتفقيط */}
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                    صافي المستحقات (المبلغ بالأرقام):
                  </span>
                  <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-400">
                    {netAmount.toLocaleString()} دج
                  </span>
                </div>
                <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                  المبلغ بالحروف: <span className="font-bold underline">{amountInWords}</span>
                </div>
              </div>
            </div>

            {/* 4. طريقة الدفع والمرجع */}
            <div className="rounded-xl border bg-card p-3 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-teal-600" /> طريقة الدفع وبيانات المرجع
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">طريقة الدفع</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PAYMENT_METHODS).map(([val, label]) => (
                        <SelectItem key={val} value={val} className="text-xs">
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    {paymentMethod === "cash" ? "ملاحظة / مرجع الإيصال" : "رقم الصك / التحويل والبنك *"}
                  </Label>
                  <Input
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder={
                      paymentMethod === "cash"
                        ? "تسليم يدوي نقدًا..."
                        : "مثال: صك بريدي رقم 12345678 — بريد الجزائر"
                    }
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* تبويب المعاينة الحية للوثيقة بالترويسة الموحدة */
          <div className="py-2 space-y-4">
            {/* الترويسة الموحدة الرسمية المباشرة */}
            <UnifiedReportHeader
              reportType="وَصْلُ اسْتِلَامِ مُسْتَحَقَّاتٍ مَالِيَّة"
              reportSubtitle={`الموسم الرياضي: ${season} • ${subject}`}
              reportNumber={`وصل رقم: ${receiptNumber}`}
              date={date}
            />

            {/* شريط العنوان والميتا */}
            <div className="text-center rounded-lg border border-teal-600/30 bg-teal-500/10 p-2.5">
              <h3 className="text-sm font-black text-teal-800 dark:text-teal-200">
                وَصْلُ اسْتِلَامِ مُسْتَحَقَّاتٍ مَالِيَّة
              </h3>
              <div className="flex justify-around text-xs text-muted-foreground mt-1 font-semibold">
                <span>رقم الوصل: <b>{receiptNumber}</b></span>
                <span>الموسم الرياضي: <b>{season}</b></span>
                <span>تاريخ التحرير: <b>{date}</b></span>
              </div>
            </div>

            {/* بطاقة العامل */}
            <div className="rounded-lg border p-3 text-xs space-y-1.5">
              <div className="font-bold text-slate-800 border-b pb-1">بيانات العامل المستفيد:</div>
              <div className="grid grid-cols-2 gap-2">
                <div>الاسم واللقب: <b className="text-teal-700">{workerName}</b></div>
                <div>الصفة / الوظيفة: <b>{workerPosition}</b></div>
                <div>رقم ب.ت.و: <b>{nationalId || "—"}</b></div>
                <div>مكان وتاريخ الإصدار: <b>{idIssueDate || "—"} {idIssuePlace ? `(${idIssuePlace})` : ""}</b></div>
              </div>
            </div>

            {/* جدول الحساب */}
            <div className="rounded-lg border overflow-hidden text-xs">
              <table className="w-full text-center">
                <thead className="bg-muted font-bold text-slate-700">
                  <tr>
                    <th className="p-1.5">الشهر</th>
                    <th className="p-1.5">الأيام</th>
                    <th className="p-1.5">الساعات</th>
                    <th className="p-1.5">سعر/سا</th>
                    <th className="p-1.5">الأساسي</th>
                    <th className="p-1.5">التعويضات</th>
                    <th className="p-1.5">الخصومات</th>
                    <th className="p-1.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800">الصافي</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-semibold">
                  <tr>
                    <td className="p-1.5">{periodLabel}</td>
                    <td className="p-1.5">{daysWorked}</td>
                    <td className="p-1.5 font-bold text-teal-700">{workHours} سا</td>
                    <td className="p-1.5">{hourRate} دج</td>
                    <td className="p-1.5">{baseWage.toLocaleString()} دج</td>
                    <td className="p-1.5 text-emerald-700">+{allowances.toLocaleString()} دج</td>
                    <td className="p-1.5 text-rose-700">-{deductions.toLocaleString()} دج</td>
                    <td className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 font-extrabold text-emerald-700 text-sm">
                      {netAmount.toLocaleString()} دج
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* تفقيط الصافي وطريقة الدفع */}
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs space-y-1">
              <div className="flex justify-between items-center font-bold">
                <span className="text-emerald-900 text-sm">المبلغ بالأرقام: {netAmount.toLocaleString()} دج</span>
                <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">
                  طريقة الدفع: {PAYMENT_METHODS[paymentMethod] || paymentMethod}
                  {paymentReference ? ` (${paymentReference})` : ""}
                </Badge>
              </div>
              <div className="text-emerald-800 font-bold">
                المبلغ بالحروف: <span className="underline">{amountInWords}</span>
              </div>
            </div>

            {/* التوقيعات الثلاثية */}
            <div className="grid grid-cols-3 gap-2 text-center pt-2">
              <div className="border border-dashed rounded-lg p-2 min-h-20 flex flex-col justify-between">
                <span className="text-xs font-bold">توقيع واستلام المعني بالأمر</span>
                <span className="text-[10px] text-muted-foreground">التوقيع والتاريخ</span>
              </div>
              <div className="border border-dashed rounded-lg p-2 min-h-20 flex flex-col justify-between">
                <span className="text-xs font-bold">ختم وتوقيع إدارة النادي</span>
                <span className="text-[10px] text-muted-foreground">الإدارة المالية</span>
              </div>
              <div className="border border-dashed rounded-lg p-2 min-h-20 flex flex-col justify-between">
                <span className="text-xs font-bold">ختم مصالح البلدية</span>
                <span className="text-[10px] text-muted-foreground">التأشيرة والمصادقة</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex-row items-center justify-between sm:justify-between border-t pt-3 gap-2">
          <div className="text-xs text-muted-foreground">
            الوثيقة تعتمد بنسبة 100% على الترويسة الموحدة للنادي.
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => onOpenChange(false)}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="text-xs gap-1.5"
              onClick={handlePrint}
            >
              <Printer className="h-4 w-4" />
              طباعة فورية A4
            </Button>
            <Button
              type="button"
              size="sm"
              className="text-xs bg-teal-700 hover:bg-teal-800 text-white gap-1.5"
              disabled={isSaving}
              onClick={async () => {
                const saved = await handleSave();
                if (saved) {
                  onOpenChange(false);
                }
              }}
            >
              {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ الوصل
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Wallet, Lock, Unlock, Plus, Minus, Printer, Loader2,
  TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, Receipt,
  Coins, ArrowRightLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CashOperation {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  note: string;
  time: string;
  /** ★ هل رُحِّلت العملية إلى دفتر التسديدات (FinancialTransaction)؟ */
  posted?: boolean;
  /** ★ معرّف القيد في الدفتر (لحذفه عند حذف العملية من الصندوق) */
  transactionId?: string | null;
}

interface ShiftState {
  open: boolean;
  openedAt: string | null;
  openingBalance: number;
  operations: CashOperation[];
}

const STORAGE_KEY = "aquacore-cash-shift";

const CATEGORIES = {
  income: ["مقبوضات إضافية", "تجديد اشتراك", "تأمين", "أخرى"],
  expense: ["مصاريف تشغيلية", "صيانة", "مشتريات", "نقل", "أخرى"],
};

export function CashRegister({ onLedgerChanged }: { onLedgerChanged?: () => void } = {}) {
  const [shift, setShift] = useState<ShiftState>({
    open: false,
    openedAt: null,
    openingBalance: 0,
    operations: [],
  });
  const [openingAmount, setOpeningAmount] = useState("");
  const [closeAmount, setCloseAmount] = useState("");
  const [opOpen, setOpOpen] = useState(false);
  const [openShiftOpen, setOpenShiftOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [zReportOpen, setZReportOpen] = useState(false);
  const [printing, setPrinting] = useState(false);

  // نموذج عملية جديدة
  const [opType, setOpType] = useState<"income" | "expense">("income");
  const [opAmount, setOpAmount] = useState("");
  const [opCategory, setOpCategory] = useState("");
  const [opNote, setOpNote] = useState("");
  // ★ ترحيل العملية إلى دفتر التسديدات (مصدر واحد للحقيقة)
  const [postToLedger, setPostToLedger] = useState(true);
  const [posting, setPosting] = useState(false);

  // ★ مداخيل الاشتراكات والتأمين تُقيَّد تلقائياً من شاشات التجديد والاستقبال —
  //   ترحيلها من الصندوق يعني ازدواج محاسبي. البقية تُرحَّل افتراضياً.
  const shouldDefaultPost = (type: "income" | "expense", category: string): boolean => {
    if (type === "expense") return true;
    return category === "مقبوضات إضافية" || category === "أخرى";
  };

  // ★ تحميل الحالة من localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setShift(JSON.parse(saved));
      }
    } catch {}
  }, []);

  // ★ حفظ الحالة في localStorage
  const saveShift = useCallback((newShift: ShiftState) => {
    setShift(newShift);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newShift)); } catch {}
  }, []);

  // ★ فتح الوردية
  const handleOpenShift = () => {
    const balance = parseFloat(openingAmount) || 0;
    const newShift: ShiftState = {
      open: true,
      openedAt: new Date().toISOString(),
      openingBalance: balance,
      operations: [],
    };
    saveShift(newShift);
    setOpeningAmount("");
    setOpenShiftOpen(false);
    toast.success(`تم فتح الوردية برصيد بداية: ${balance} دج`);
  };

  // ★ إضافة عملية (مع ترحيل اختياري لدفتر التسديدات)
  const handleAddOperation = async () => {
    const amount = parseFloat(opAmount);
    if (!amount || amount <= 0) {
      toast.error("أدخل مبلغاً صحيحاً");
      return;
    }
    const category = opCategory || CATEGORIES[opType][0];
    const time = new Date().toISOString();

    let posted = false;
    let transactionId: string | null = null;
    if (postToLedger) {
      setPosting(true);
      try {
        const res = await fetch("/api/financial/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: opType,
            category: opType === "income" ? "other_income" : "other_expense",
            amount,
            date: time,
            paymentMethod: "cash",
            payeeName: null,
            payeeId: null,
            reference: null,
            note: `صندوق — ${category}${opNote ? " • " + opNote : ""}`,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "فشل الترحيل للدفتر");
        posted = true;
        transactionId = data.transaction?.id || null;
      } catch (e) {
        toast.warning("سُجّلت في الصندوق فقط — تعذّر الترحيل للدفتر: " + (e instanceof Error ? e.message : ""));
      } finally {
        setPosting(false);
      }
    }

    const op: CashOperation = {
      id: Date.now().toString(),
      type: opType,
      amount,
      category,
      note: opNote,
      time,
      posted,
      transactionId,
    };
    saveShift({ ...shift, operations: [...shift.operations, op] });
    setOpAmount("");
    setOpNote("");
    setOpCategory("");
    setOpOpen(false);
    toast.success(
      (opType === "income" ? `تم تسجيل مقبوض: ${amount} دج` : `تم تسجيل مصروف: ${amount} دج`) +
        (posted ? " — ورُحِّل لدفتر التسديدات ✓" : "")
    );
    if (posted) onLedgerChanged?.();
  };

  // ★ حذف عملية — إن كانت مُرحّلة تُحذف قيدها من الدفتر أيضاً (بلا ازدواج)
  const handleDeleteOp = async (id: string) => {
    const op = shift.operations.find((o) => o.id === id);
    if (op?.posted && op.transactionId) {
      try {
        const res = await fetch(`/api/financial/transactions/${op.transactionId}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        toast.success("حُذفت العملية وقيدها من دفتر التسديدات");
        onLedgerChanged?.();
      } catch {
        toast.error("حُذفت من الصندوق — تعذّر حذف القيد من الدفتر، احذفه يدوياً");
      }
    } else {
      toast.success("تم حذف العملية");
    }
    saveShift({ ...shift, operations: shift.operations.filter((o) => o.id !== id) });
  };

  // ★ إغلاق الوردية + تقرير Z
  const handleCloseShift = () => {
    const actual = parseFloat(closeAmount) || 0;
    const expected = getExpectedBalance();
    const diff = actual - expected;

    saveShift({
      ...shift,
      open: false,
    });
    setCloseAmount("");
    setCloseOpen(false);
    setZReportOpen(true);
    toast.success("تم إغلاق الوردية — راجع تقرير Z");
  };

  // ★ الحسابات
  const totalIncome = shift.operations.filter((o) => o.type === "income").reduce((s, o) => s + o.amount, 0);
  const totalExpense = shift.operations.filter((o) => o.type === "expense").reduce((s, o) => s + o.amount, 0);
  const getExpectedBalance = () => shift.openingBalance + totalIncome - totalExpense;
  const expectedBalance = getExpectedBalance();

  // ★ طباعة Z-Report
  const handlePrintZReport = useCallback(() => {
    setPrinting(true);
    try {
      const now = new Date();
      const openedAt = shift.openedAt ? new Date(shift.openedAt) : now;
      const actual = parseFloat(closeAmount) || 0;
      const diff = actual - expectedBalance;

      const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
        <title>Z-Report — ${now.toLocaleDateString("en-GB")}</title>
        <style>
          @page { size: 80mm; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { width: 80mm; padding: 8mm; font-family: 'Cairo', 'Tahoma', monospace; font-size: 11px; direction: rtl; color: #000; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .lg { font-size: 14px; }
          .xl { font-size: 18px; }
          .border-top { border-top: 1px dashed #000; padding-top: 4px; margin-top: 4px; }
          .border-bottom { border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 4px; }
          .row { display: flex; justify-content: space-between; padding: 2px 0; }
          .total { font-size: 16px; font-weight: bold; }
          .sign { margin-top: 30px; }
          .sign-line { border-top: 1px solid #000; margin-top: 40px; padding-top: 4px; text-align: center; }
          @media print { body { width: 80mm; } }
        </style>
        </head><body>
        <div class="center bold lg">نادي RCS للسباحة</div>
        <div class="center bold xl">تقرير Z (Z-Report)</div>
        <div class="center">إغلاق الوردية المالية</div>
        <div class="border-top"></div>
        <div class="row"><span>التاريخ:</span><span>${now.toLocaleDateString("en-GB")}</span></div>
        <div class="row"><span>الوقت:</span><span>${now.toLocaleTimeString("ar-DZ", {hour:"2-digit",minute:"2-digit"})}</span></div>
        <div class="row"><span>فتح الوردية:</span><span>${openedAt.toLocaleTimeString("ar-DZ", {hour:"2-digit",minute:"2-digit"})}</span></div>
        <div class="border-top"></div>
        <div class="row"><span>رصيد البداية:</span><span class="bold">${shift.openingBalance} دج</span></div>
        <div class="row"><span>إجمالي المقبوضات:</span><span style="color:#080;">+${totalIncome} دج</span></div>
        <div class="row"><span>إجمالي المصاريف:</span><span style="color:#c00;">-${totalExpense} دج</span></div>
        <div class="border-top"></div>
        <div class="row total"><span>الرصيد المتوقع:</span><span>${expectedBalance} دج</span></div>
        <div class="row total"><span>الرصيد الفعلي:</span><span>${actual} دج</span></div>
        <div class="row total" style="color:${diff >= 0 ? "#080" : "#c00"};">
          <span>${diff >= 0 ? "فائض" : "عجز"}:</span>
          <span>${Math.abs(diff)} دج</span>
        </div>
        <div class="border-top"></div>
        <div class="row"><span>عدد العمليات:</span><span>${shift.operations.length}</span></div>
        <div class="row"><span>مُرحّل لدفتر التسديدات:</span><span>${shift.operations.filter((o) => o.posted).length}</span></div>
        <div class="sign">
          <div style="display:flex;justify-content:space-between;">
            <div class="sign-line sm">توقيع الكاشير</div>
            <div class="sign-line sm">توقيع الإدارة</div>
          </div>
        </div>
        <div class="center border-top sm" style="margin-top:8px;">AquaCore Club Manager — ${now.getFullYear()}</div>
        </body></html>`;

      const w = window.open("", "_blank", "width=400,height=600");
      if (!w) { toast.error("اسمح بالنوافذ المنبثقة"); return; }
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => { w.print(); w.close(); }, 500);
      toast.success("جاري طباعة تقرير Z...");
    } catch (e) {
      toast.error("فشل طباعة تقرير Z");
    } finally {
      setPrinting(false);
    }
  }, [shift, totalIncome, totalExpense, expectedBalance, closeAmount]);

  return (
    <div className="space-y-4">
      {/* رأس — حالة الوردية */}
      <div className={cn(
        "rounded-2xl border p-4 flex items-center justify-between",
        shift.open ? "border-emerald-500/30 bg-emerald-500/5" : "border-muted/60 bg-card"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "h-12 w-12 rounded-2xl flex items-center justify-center",
            shift.open ? "bg-emerald-500/15 text-emerald-700" : "bg-muted text-muted-foreground"
          )}>
            {shift.open ? <Unlock className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
          </div>
          <div>
            <h2 className="font-bold text-base">الصندوق وتقرير Z</h2>
            <p className="text-xs text-muted-foreground">
              {shift.open
                ? `الوردية مفتوحة منذ ${shift.openedAt ? new Date(shift.openedAt).toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" }) : "—"}`
                : "الوردية مغلقة — افتح وردية جديدة للبدء"}
            </p>
          </div>
        </div>
        <Badge className={shift.open ? "bg-emerald-100 text-emerald-700 border-emerald-300" : "bg-muted text-muted-foreground"}>
          {shift.open ? "● مفتوحة" : "● مغلقة"}
        </Badge>
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/60 bg-card p-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
            <Coins className="h-3.5 w-3.5" /> رصيد البداية
          </div>
          <p className="text-lg font-extrabold tabular-nums">{shift.openingBalance.toLocaleString()} دج</p>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
          <div className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300 mb-1">
            <TrendingUp className="h-3.5 w-3.5" /> مقبوضات
          </div>
          <p className="text-lg font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">+{totalIncome.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3">
          <div className="flex items-center gap-1 text-xs text-rose-700 dark:text-rose-300 mb-1">
            <TrendingDown className="h-3.5 w-3.5" /> مصاريف
          </div>
          <p className="text-lg font-extrabold tabular-nums text-rose-700 dark:text-rose-300">-{totalExpense.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-3">
          <div className="flex items-center gap-1 text-xs text-teal-700 dark:text-teal-300 mb-1">
            <Wallet className="h-3.5 w-3.5" /> الرصيد المتوقع
          </div>
          <p className="text-lg font-extrabold tabular-nums text-teal-700 dark:text-teal-300">{expectedBalance.toLocaleString()}</p>
        </div>
      </div>

      {/* أزرار الإجراءات */}
      <div className="flex gap-2 flex-wrap">
        {!shift.open ? (
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => { setOpeningAmount(""); setOpenShiftOpen(true); }}
          >
            <Unlock className="h-4 w-4 ml-1" /> فتح الوردية
          </Button>
        ) : (
          <>
            <Button onClick={() => { setOpType("income"); setPostToLedger(shouldDefaultPost("income", "")); setOpOpen(true); }} variant="outline"
              className="border-emerald-400 text-emerald-700 hover:bg-emerald-50">
              <Plus className="h-4 w-4 ml-1" /> مقبوضات
            </Button>
            <Button onClick={() => { setOpType("expense"); setPostToLedger(shouldDefaultPost("expense", "")); setOpOpen(true); }} variant="outline"
              className="border-rose-400 text-rose-700 hover:bg-rose-50">
              <Minus className="h-4 w-4 ml-1" /> مصاريف
            </Button>
            <Button onClick={() => setCloseOpen(true)} variant="destructive">
              <Lock className="h-4 w-4 ml-1" /> إغلاق الوردية
            </Button>
          </>
        )}
      </div>

      {/* فتح الوردية */}
      <Dialog open={openShiftOpen} onOpenChange={setOpenShiftOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>فتح الوردية</DialogTitle>
            <DialogDescription>أدخل رصيد البداية في درج الصندوق</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="number"
              value={openingAmount}
              onChange={(e) => setOpeningAmount(e.target.value)}
              placeholder="0"
              className="h-12 text-lg font-bold text-center"
              dir="ltr"
              autoFocus
            />
            <Button onClick={handleOpenShift} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white">
              <Unlock className="h-4 w-4 ml-1" /> تأكيد فتح الوردية
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* نموذج إضافة عملية */}
      <Dialog open={opOpen} onOpenChange={setOpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {opType === "income" ? <Plus className="h-5 w-5 text-emerald-600" /> : <Minus className="h-5 w-5 text-rose-600" />}
              {opType === "income" ? "تسجيل مقبوضات" : "تسجيل مصاريف"}
            </DialogTitle>
            <DialogDescription>أدخل تفاصيل العملية المالية</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={opType === "income" ? "default" : "outline"}
                onClick={() => { setOpType("income"); setOpCategory(""); setPostToLedger(shouldDefaultPost("income", "")); }}
                className={opType === "income" ? "bg-emerald-600" : ""}
              >
                <TrendingUp className="h-4 w-4 ml-1" /> مقبوضات
              </Button>
              <Button
                variant={opType === "expense" ? "default" : "outline"}
                onClick={() => { setOpType("expense"); setOpCategory(""); setPostToLedger(shouldDefaultPost("expense", "")); }}
                className={opType === "expense" ? "bg-rose-600" : ""}
              >
                <TrendingDown className="h-4 w-4 ml-1" /> مصاريف
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">المبلغ (دج) *</Label>
              <Input type="number" value={opAmount} onChange={(e) => setOpAmount(e.target.value)}
                placeholder="0" className="h-11 text-lg font-bold" dir="ltr" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">التصنيف</Label>
              <Select value={opCategory} onValueChange={(v) => { setOpCategory(v); setPostToLedger(shouldDefaultPost(opType, v)); }}>
                <SelectTrigger className="h-10"><SelectValue placeholder="اختر تصنيفاً" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES[opType].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">ملاحظة (اختياري)</Label>
              <Input value={opNote} onChange={(e) => setOpNote(e.target.value)} placeholder="..." className="h-10" />
            </div>
            <label className="flex items-start gap-2 rounded-lg border border-teal-500/30 bg-teal-500/5 p-2.5 cursor-pointer">
              <Checkbox checked={postToLedger} onCheckedChange={(v) => setPostToLedger(v === true)} className="mt-0.5" />
              <span className="text-xs leading-relaxed">
                <span className="font-bold">ترحيل إلى دفتر التسديدات</span>
                <span className="block text-muted-foreground">
                  {opType === "expense"
                    ? "يُقيّد المصروف في الدفتر المالي فوراً (يوصى به) — أما مداخيل الاشتراكات/التأمين فتُقيَّد تلقائياً من شاشات التجديد لتجنّب الازدواج"
                    : "يُقيّد المقبوض في الدفتر المالي فوراً — أما تجديدات الاشتراك والتأمين فمقيّدة تلقائياً من شاشة التجديد"}
                </span>
              </span>
            </label>
            <Button onClick={handleAddOperation} disabled={posting} className="w-full h-11">
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {opType === "income" ? "تسجيل المقبوض" : "تسجيل المصروف"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* إغلاق الوردية */}
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-rose-600" /> إغلاق الوردية
            </DialogTitle>
            <DialogDescription>أدخل الرصيد الفعلي بعد عد الدرج</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-muted/40 p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">رصيد البداية:</span><span className="font-bold">{shift.openingBalance.toLocaleString()} دج</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">مقبوضات:</span><span className="font-bold text-emerald-600">+{totalIncome.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">مصاريف:</span><span className="font-bold text-rose-600">-{totalExpense.toLocaleString()}</span></div>
              <div className="flex justify-between border-t pt-1"><span className="font-bold">الرصيد المتوقع:</span><span className="font-extrabold text-teal-700">{expectedBalance.toLocaleString()} دج</span></div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">الرصيد الفعلي (بعد العد) *</Label>
              <Input type="number" value={closeAmount} onChange={(e) => setCloseAmount(e.target.value)}
                placeholder={String(expectedBalance)} className="h-12 text-lg font-bold" dir="ltr" autoFocus />
            </div>
            {closeAmount && (
              <div className={cn(
                "rounded-lg p-2 text-center text-sm font-bold",
                (parseFloat(closeAmount) || 0) >= expectedBalance
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700"
              )}>
                {(parseFloat(closeAmount) || 0) >= expectedBalance ? "✓ فائض" : "⚠ عجز"}:{" "}
                {Math.abs((parseFloat(closeAmount) || 0) - expectedBalance)} دج
              </div>
            )}
            <Button onClick={handleCloseShift} className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white">
              <Lock className="h-4 w-4 ml-1" /> تأكيد الإغلاق + طباعة تقرير Z
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Z-Report */}
      <Dialog open={zReportOpen} onOpenChange={setZReportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-teal-600" /> تقرير Z
            </DialogTitle>
            <DialogDescription>تقرير إغلاق الوردية جاهز للطباعة</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 p-3 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-1" />
              <p className="text-sm font-bold text-emerald-700">تم إغلاق الوردية بنجاح</p>
            </div>
            <Button onClick={handlePrintZReport} disabled={printing} className="w-full h-11 bg-teal-700 hover:bg-teal-800 text-white">
              {printing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5 ml-1" />}
              طباعة تقرير Z (POS)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* سجل العمليات */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="p-3 border-b flex items-center justify-between">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-primary" /> سجل العمليات ({shift.operations.length})
          </h3>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {shift.operations.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">لا توجد عمليات مسجلة</p>
          ) : (
            <div className="divide-y divide-border/30">
              {shift.operations.map((op) => (
                <div key={op.id} className="flex items-center gap-2 p-2.5 hover:bg-muted/40 transition group">
                  <div className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                    op.type === "income" ? "bg-emerald-500/15 text-emerald-700" : "bg-rose-500/15 text-rose-700"
                  )}>
                    {op.type === "income" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      {op.category}
                      {op.posted && (
                        <Badge variant="outline" className="h-4 px-1 text-[9px] bg-teal-500/10 text-teal-700 border-teal-500/30">مُرحّل ✓</Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(op.time).toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" })}
                      {op.note && ` • ${op.note}`}
                    </p>
                  </div>
                  <span className={cn(
                    "font-bold text-sm tabular-nums shrink-0",
                    op.type === "income" ? "text-emerald-600" : "text-rose-600"
                  )}>
                    {op.type === "income" ? "+" : "-"}{op.amount.toLocaleString()} دج
                  </span>
                  {shift.open && (
                    <button onClick={() => handleDeleteOp(op.id)} className="opacity-0 group-hover:opacity-100 transition p-1 text-rose-500 hover:bg-rose-500/10 rounded">
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

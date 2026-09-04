"use client";

import * as React from "react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Wallet,
  Calendar,
  CreditCard,
  User,
  FileText,
  StickyNote,
  CheckCircle2,
  AlertCircle,
  Search,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { notifyFinancialUpdated } from "@/lib/financial-events";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export type TxType = "income" | "expense";

export interface TransactionData {
  id: string;
  type: TxType;
  category: string;
  subCategory?: string | null;
  amount: number;
  date: string;
  paymentMethod: string;
  payeeName?: string | null;
  payeeId?: string | null;
  reference?: string | null;
  note?: string | null;
}

interface FinancialTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: TransactionData | null;
  currentBalance: number;
  onSaved?: () => void;
  /** قيم مبدئية لوضع الإنشاء (الدفع من المركز المالي — نفس مسار القيد الواحد) */
  preset?: Partial<Pick<TransactionData, "type" | "category" | "payeeName" | "note">> | null;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const INCOME_CATEGORIES: { value: string; label: string }[] = [
  { value: "subscription", label: "اشتراك" },
  { value: "renewal", label: "تجديد" },
  { value: "insurance", label: "تأمين" },
  { value: "compound", label: "حقوق المركب" },
  { value: "other_income", label: "مدخول آخر" },
];

const EXPENSE_CATEGORIES: { value: string; label: string }[] = [
  { value: "wages", label: "أجور عمال" },
  { value: "insurance", label: "تأمين" },
  { value: "compound_rights", label: "حقوق المركب" },
  { value: "maintenance", label: "صيانة" },
  { value: "equipment", label: "معدات" },
  { value: "office_supplies", label: "لوازم مكتبية" },
  { value: "other_expense", label: "دفعات أخرى" },
];

const PAYMENT_METHODS: { value: string; label: string; icon: typeof Wallet }[] = [
  { value: "cash", label: "نقدي", icon: Wallet },
  { value: "bank", label: "بنك", icon: CreditCard },
  { value: "cheque", label: "شيك", icon: FileText },
];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function formatDA(n: number): string {
  return new Intl.NumberFormat("fr-DZ").format(Math.round(n)) + " دج";
}

function toDateInputValue(d: Date): string {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

interface SuggestionItem {
  id: string;
  label: string;
  sub?: string;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export function FinancialTransactionDialog({
  open,
  onOpenChange,
  transaction,
  currentBalance,
  onSaved,
  preset,
}: FinancialTransactionDialogProps) {
  const isEdit = !!transaction;

  const [type, setType] = useState<TxType>("income");
  const [category, setCategory] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string>(toDateInputValue(new Date()));
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [payeeName, setPayeeName] = useState<string>("");
  const [payeeId, setPayeeId] = useState<string>("");
  const [reference, setReference] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const suggestionsBoxRef = React.useRef<HTMLDivElement>(null);

  // Reset form when dialog opens or transaction changes
  React.useEffect(() => {
    if (!open) return;
    if (transaction) {
      setType(transaction.type);
      setCategory(transaction.category);
      setAmount(String(transaction.amount));
      setDate(toDateInputValue(new Date(transaction.date)));
      setPaymentMethod(transaction.paymentMethod || "cash");
      setPayeeName(transaction.payeeName || "");
      setPayeeId(transaction.payeeId || "");
      setReference(transaction.reference || "");
      setNote(transaction.note || "");
    } else {
      // ★ الدفع من المركز المالي: preset يفتح النافذة على فئة المصروف المطلوبة —
      // نفس نافذة القيد الواحد في الدفتر → لا عملية ثانية أبداً
      setType(preset?.type ?? "income");
      setCategory(preset?.category ?? "");
      setAmount("");
      setDate(toDateInputValue(new Date()));
      setPaymentMethod("cash");
      setPayeeName(preset?.payeeName ?? "");
      setPayeeId("");
      setReference("");
      setNote(preset?.note ?? "");
    }
    setShowSuggestions(false);
  }, [open, transaction, preset]);

  // Load suggestions based on type + payeeName prefix
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const q = payeeName.trim();
    if (q.length < 1) {
      setSuggestions([]);
      return;
    }
    const endpoint =
      type === "expense"
        ? "/api/employees"
        : "/api/subscribers?limit=50";
    const ctrl = new AbortController();
    fetch(endpoint, { signal: ctrl.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (type === "expense") {
          const list: SuggestionItem[] = (data.employees || [])
            .filter(
              (e: { firstName: string; lastName: string; position?: string }) => {
                const full = `${e.firstName} ${e.lastName}`;
                return full.toLowerCase().includes(q.toLowerCase());
              }
            )
            .slice(0, 8)
            .map((e: { id: string; firstName: string; lastName: string; position?: string }) => ({
              id: e.id,
              label: `${e.firstName} ${e.lastName}`,
              sub: e.position || undefined,
            }));
          setSuggestions(list);
        } else {
          const list: SuggestionItem[] = (data.subscribers || [])
            .filter(
              (s: { firstName: string; lastName: string; fileNumber: string }) => {
                const full = `${s.firstName} ${s.lastName} ${s.fileNumber}`;
                return full.toLowerCase().includes(q.toLowerCase());
              }
            )
            .slice(0, 8)
            .map((s: { id: string; firstName: string; lastName: string; fileNumber: string }) => ({
              id: s.id,
              label: `${s.firstName} ${s.lastName}`,
              sub: s.fileNumber,
            }));
          setSuggestions(list);
        }
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [open, type, payeeName]);

  // Close suggestions on outside click
  React.useEffect(() => {
    if (!showSuggestions) return;
    function handler(e: MouseEvent) {
      if (suggestionsBoxRef.current && !suggestionsBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSuggestions]);

  const amountNum = parseFloat(amount) || 0;
  const liveBalance = isEdit
    ? currentBalance // بعد التعديل الرصيد يُعاد حسابه سيرفر-سايد
    : type === "income"
    ? currentBalance + amountNum
    : currentBalance - amountNum;

  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleTypeChange = (newType: string) => {
    if (newType !== "income" && newType !== "expense") return;
    setType(newType as TxType);
    setCategory(""); // reset category when type changes
    setPayeeId("");
  };

  const pickSuggestion = (s: SuggestionItem) => {
    setPayeeName(s.label);
    setPayeeId(s.id);
    setShowSuggestions(false);
  };

  const handleSave = async () => {
    // Validation
    if (!category) {
      toast.error("الفئة مطلوبة");
      return;
    }
    if (!amount || amountNum <= 0) {
      toast.error("المبلغ يجب أن يكون أكبر من 0");
      return;
    }
    if (!date) {
      toast.error("التاريخ مطلوب");
      return;
    }
    if (!paymentMethod) {
      toast.error("طريقة الدفع مطلوبة");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        type,
        category,
        amount: amountNum,
        date: new Date(date).toISOString(),
        paymentMethod,
        payeeName: payeeName.trim() || null,
        payeeId: payeeId || null,
        reference: reference.trim() || null,
        note: note.trim() || null,
      };

      const url = isEdit
        ? `/api/financial/transactions/${transaction!.id}`
        : "/api/financial/transactions";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل الحفظ");
      }

      toast.success(isEdit ? "تم تعديل العملية بنجاح" : "تم تسجيل العملية بنجاح");
      notifyFinancialUpdated();
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5 text-primary" />
            {isEdit ? "تعديل عملية مالية" : "تسجيل عملية مالية جديدة"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "عدّل بيانات العملية المالية. سيُعاد حساب الرصيد تلقائياً."
              : "أدخل بيانات العملية بدقة. ستُحدّث الأرصدة فوراً عند الحفظ."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Type toggle */}
          <div className="space-y-2">
            <Label>نوع العملية</Label>
            <ToggleGroup
              type="single"
              value={type}
              onValueChange={handleTypeChange}
              className="grid grid-cols-2 w-full gap-2"
              disabled={saving}
            >
              <ToggleGroupItem
                value="income"
                aria-label="مدخول"
                className={cn(
                  "h-12 rounded-lg border-2 data-[state=on]:bg-emerald-500/15 data-[state=on]:border-emerald-500 data-[state=on]:text-emerald-700 dark:data-[state=on]:text-emerald-400 transition-all flex items-center gap-2"
                )}
              >
                <TrendingUp className="h-4 w-4" />
                <span className="font-bold">مدخول</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="expense"
                aria-label="مصروف"
                className={cn(
                  "h-12 rounded-lg border-2 data-[state=on]:bg-rose-500/15 data-[state=on]:border-rose-500 data-[state=on]:text-rose-700 dark:data-[state=on]:text-rose-400 transition-all flex items-center gap-2"
                )}
              >
                <TrendingDown className="h-4 w-4" />
                <span className="font-bold">مصروف</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Category + Payment method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>الفئة</Label>
              <Select value={category} onValueChange={setCategory} disabled={saving}>
                <SelectTrigger className="w-full h-10">
                  <SelectValue placeholder="اختر الفئة" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>طريقة الدفع</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={saving}>
                <SelectTrigger className="w-full h-10">
                  <SelectValue placeholder="اختر طريقة الدفع" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      <span className="flex items-center gap-2">
                        <m.icon className="h-4 w-4" />
                        {m.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Amount + Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>المبلغ (دج)</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  step="100"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="h-10 text-lg font-bold tabular-nums pl-14"
                  disabled={saving}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                  دج
                </span>
              </div>
              {amountNum > 0 && (
                <p className="text-xs text-muted-foreground">
                  المعاينة:{" "}
                  <span className={cn("font-bold", type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                    {type === "income" ? "+" : "-"}
                    {formatDA(amountNum)}
                  </span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>التاريخ</Label>
              <div className="relative">
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-10 pr-9"
                  disabled={saving}
                />
              </div>
            </div>
          </div>

          {/* Payee name with autocomplete */}
          <div className="space-y-2 relative" ref={suggestionsBoxRef}>
            <Label className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {type === "expense" ? "اسم المستفيد (الموظف/المورد)" : "اسم الدافع (المنخرط)"}
            </Label>
            <div className="relative">
              <Input
                type="text"
                value={payeeName}
                onChange={(e) => {
                  setPayeeName(e.target.value);
                  setPayeeId(""); // clear id when text edited
                  setShowSuggestions(true);
                }}
                onFocus={() => payeeName.trim() && setShowSuggestions(true)}
                placeholder={type === "expense" ? "ابحث عن موظف..." : "ابحث عن منخرط..."}
                className="h-10 pr-9"
                disabled={saving}
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              {payeeId && (
                <Badge
                  variant="secondary"
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px]"
                >
                  مرتبط
                </Badge>
              )}
            </div>
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute z-50 top-full mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-56 overflow-y-auto"
                >
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => pickSuggestion(s)}
                      className="w-full text-right px-3 py-2 hover:bg-accent transition-colors flex items-center justify-between gap-2 border-b border-border/40 last:border-0"
                    >
                      <span className="text-sm font-medium text-foreground">{s.label}</span>
                      {s.sub && (
                        <span className="text-xs text-muted-foreground">{s.sub}</span>
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Reference + Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                المرجع (رقم الإيصال/الشيك)
              </Label>
              <Input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="اختياري"
                className="h-10"
                disabled={saving}
              />
            </div>

            <div className="space-y-2 sm:col-span-1">
              <Label className="flex items-center gap-1.5">
                <StickyNote className="h-3.5 w-3.5" />
                ملاحظات
              </Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="اختياري"
                rows={2}
                disabled={saving}
              />
            </div>
          </div>

          {/* Live balance preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "rounded-xl border p-4 flex items-center justify-between gap-3",
              liveBalance < 0
                ? "border-rose-500/40 bg-rose-500/10"
                : liveBalance < 5000
                ? "border-amber-500/40 bg-amber-500/10"
                : "border-emerald-500/40 bg-emerald-500/10"
            )}
          >
            <div className="flex items-center gap-2.5">
              {liveBalance < 0 ? (
                <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              )}
              <div>
                <p className="text-xs text-muted-foreground">
                  {isEdit ? "الرصيد بعد التعديل (يُعاد حسابه سيرفر-سايد)" : "الرصيد بعد هذه العملية"}
                </p>
                <p className="text-lg font-bold tabular-nums text-foreground">
                  {formatDA(liveBalance)}
                </p>
              </div>
            </div>
            <div className="text-left">
              <p className="text-[10px] text-muted-foreground">الرصيد الحالي</p>
              <p className="text-sm font-semibold tabular-nums text-muted-foreground">
                {formatDA(currentBalance)}
              </p>
            </div>
          </motion.div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={saving} className="min-w-[140px]">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري الحفظ...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                {isEdit ? "حفظ التعديل" : "تسجيل العملية"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

/**
 * TransactionDetailsDialog — حوار تفاصيل العملية المالية (المرحلة 33)
 * ═══════════════════════════════════════════════════════════════════
 *  • يجلب /api/financial/transactions/[id] عند الفتح
 *  • رقم العملية FIN بارز أعلى + كل حقول القيد
 *  • بيانات المنخرط المرتبط (رقم الملف!) وبيانات أجر العامل إن وجدت
 *  • Timeline سجل التدقيق (AuditLog) — خط زمني عمودي بأيقونات حسب action
 *  • طباعة إيصال رسمي + إلغاء العملية (سبب إلزامي — الخادم يحمي 403)
 */

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  History,
  Loader2,
  Pencil,
  Plus,
  Printer,
  RefreshCcw,
  User,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { amountToDzdWords } from "@/lib/amount-in-words";
import { categoryLabel, paymentMethodLabel, typeLabel } from "./labels";
import { openReceiptPrint } from "./receipt";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export interface TransactionDetail {
  id: string;
  number: string | null;
  seq: number | null;
  type: string;
  category: string;
  subCategory?: string | null;
  amount: number;
  date: string;
  paymentMethod: string;
  payeeName?: string | null;
  reference?: string | null;
  note?: string | null;
  status: string;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  cancelledByName?: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string } | null;
  subscriber?: {
    id: string;
    fileNumber: string;
    lastName: string;
    firstName: string;
    phone?: string | null;
  } | null;
  wagePayment?: {
    id: string;
    periodLabel: string;
    hours: number;
    hourRate: number;
    amount: number;
    status: string;
  } | null;
}

export interface TimelineEntry {
  id: string;
  action: string;
  description: string | null;
  createdAt: string;
  userName?: string | null;
}

interface TransactionDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string | null;
  /** اسم النادي للإيصال (من /api/settings) */
  clubName?: string;
  /** يُستدعى بعد نجاح الإلغاء — لإعادة جلب القائمة والبطاقات */
  onChanged?: () => void;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function formatDA(n: number): string {
  return new Intl.NumberFormat("fr-DZ").format(Math.round(n)) + " دج";
}

function formatDate(s: string): string {
  try {
    return new Date(s).toLocaleDateString("ar-DZ", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return s;
  }
}

function formatDateTime(s: string): string {
  try {
    return new Date(s).toLocaleString("ar-DZ", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return s;
  }
}

/** أيقونة ولون عنصر التايملاين حسب نوع action */
function timelineStyle(action: string): { icon: typeof Plus; cls: string } {
  const a = (action || "").toLowerCase();
  if (a.includes("cancel") || a.includes("void") || a.includes("delete")) {
    return { icon: XCircle, cls: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30" };
  }
  if (a.includes("update") || a.includes("edit")) {
    return { icon: Pencil, cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" };
  }
  if (a.includes("create") || a.includes("payment_create")) {
    return { icon: Plus, cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" };
  }
  if (a.includes("rebuild") || a.includes("integrity")) {
    return { icon: RefreshCcw, cls: "bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30" };
  }
  return { icon: FileText, cls: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30" };
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export function TransactionDetailsDialog({
  open,
  onOpenChange,
  transactionId,
  clubName,
  onChanged,
}: TransactionDetailsDialogProps) {
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cancel state
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!transactionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/financial/transactions/${transactionId}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "فشل جلب التفاصيل");
      setDetail(json.transaction as TransactionDetail);
      setTimeline((json.timeline as TimelineEntry[]) || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل جلب التفاصيل");
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    if (!open || !transactionId) return;
    setDetail(null);
    setTimeline([]);
    setCancelOpen(false);
    setCancelReason("");
    fetchDetail();
  }, [open, transactionId, fetchDetail]);

  const isCancelled = detail?.status === "cancelled";
  const isIncome = detail?.type === "income";

  const handleCancel = async () => {
    if (!detail) return;
    if (cancelReason.trim().length < 3) {
      toast.error("سبب الإلغاء إلزامي (3 أحرف على الأقل)");
      return;
    }
    setCancelling(true);
    try {
      const res = await fetch(`/api/financial/transactions/${detail.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "فشل الإلغاء");
      toast.success("تم إلغاء العملية — تبقى في السجل بوضع «ملغاة» ولا تدخل في الرصيد");
      setCancelOpen(false);
      setCancelReason("");
      onChanged?.();
      await fetchDetail(); // أعد العرض بالحالة الجديدة + قيد الإلغاء في الـTimeline
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الإلغاء");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Wallet className="h-5 w-5 text-teal-600" />
              تفاصيل العملية المالية
            </DialogTitle>
            <DialogDescription>
              السجل المحاسبي الكامل للقيد مع سجل التدقيق (من أنشأها وعدّلها وألغاها).
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-16 w-full rounded-lg" />
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-md" />
                ))}
              </div>
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ) : error || !detail ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <AlertTriangle className="h-8 w-8 text-rose-600" />
              <p className="text-sm text-muted-foreground">{error || "لا توجد بيانات"}</p>
              <Button variant="outline" size="sm" onClick={fetchDetail}>
                <RefreshCcw className="h-3.5 w-3.5" /> إعادة المحاولة
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* FIN بارز + الحالة */}
              <div
                className={cn(
                  "rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3",
                  isCancelled
                    ? "border-slate-500/30 bg-slate-500/5"
                    : isIncome
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-rose-500/30 bg-rose-500/5"
                )}
              >
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">رقم العملية</p>
                  {detail.number ? (
                    <p
                      className="text-xl font-extrabold tracking-wide text-teal-700 dark:text-teal-400 tabular-nums"
                      style={{ fontFamily: "'Courier New', ui-monospace, monospace" }}
                      dir="ltr"
                    >
                      {detail.number}
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                      — قيد قديم (قبل الترقيم التسلسلي)
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    className={cn(
                      "text-[11px]",
                      isIncome
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                        : "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
                    )}
                  >
                    {typeLabel(detail.type)}
                  </Badge>
                  {isCancelled ? (
                    <Badge variant="outline" className="text-[11px] gap-1 bg-muted text-muted-foreground border-border">
                      <XCircle className="h-3 w-3" /> ملغاة
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[11px] gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                      <CheckCircle2 className="h-3 w-3" /> نشطة
                    </Badge>
                  )}
                </div>
              </div>

              {/* المبلغ + الحروف */}
              <div
                className={cn(
                  "rounded-xl border p-4 text-center",
                  isIncome ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"
                )}
              >
                <p className={cn("text-2xl font-extrabold tabular-nums", isCancelled && "line-through opacity-70")}>
                  <span className={isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                    {isIncome ? "+" : "−"}
                    {formatDA(detail.amount)}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground font-medium">{amountToDzdWords(detail.amount)}</p>
              </div>

              {/* الحقول */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Field icon={BadgeDollarSign} label="الفئة" value={categoryLabel(detail.category)} sub={detail.subCategory || undefined} />
                <Field icon={CalendarDays} label="التاريخ" value={formatDate(detail.date)} />
                <Field icon={CreditCard} label="طريقة الدفع" value={paymentMethodLabel(detail.paymentMethod)} />
                <Field icon={User} label={isIncome ? "الدافع / الجهة" : "المستفيد / الجهة"} value={detail.payeeName || "—"} />
                <Field icon={FileText} label="المرجع (رقم الإيصال/الشيك)" value={detail.reference || "—"} />
                <Field icon={User} label="سجّلها" value={detail.user?.name || "—"} sub={formatDateTime(detail.createdAt)} />
              </div>

              {detail.note && (
                <div className="rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed">
                  <span className="font-bold text-foreground">ملاحظة: </span>
                  <span className="text-muted-foreground whitespace-pre-wrap">{detail.note}</span>
                </div>
              )}

              {/* الإلغاء */}
              {isCancelled && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs space-y-1">
                  <p className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5" /> عملية ملغاة — خارج الرصيد
                  </p>
                  {detail.cancellationReason && <p>السبب: {detail.cancellationReason}</p>}
                  {detail.cancelledAt && <p>وقت الإلغاء: {formatDateTime(detail.cancelledAt)}</p>}
                  {detail.cancelledByName && <p>ألغاها: {detail.cancelledByName}</p>}
                </div>
              )}

              {/* المنخرط المرتبط */}
              {detail.subscriber && (
                <div className="rounded-lg border border-teal-500/30 bg-teal-500/5 p-3 text-xs space-y-1.5">
                  <p className="font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" /> المنخرط المرتبط
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="rounded bg-teal-500/15 px-1.5 py-0.5 font-bold text-teal-700 dark:text-teal-400 tabular-nums" dir="ltr">
                      {detail.subscriber.fileNumber}
                    </span>
                    <span className="font-semibold text-foreground">
                      {detail.subscriber.lastName} {detail.subscriber.firstName}
                    </span>
                    {detail.subscriber.phone && (
                      <span className="text-muted-foreground tabular-nums" dir="ltr">{detail.subscriber.phone}</span>
                    )}
                  </div>
                </div>
              )}

              {/* أجر عامل مرتبط */}
              {detail.wagePayment && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs space-y-1.5">
                  <p className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5" /> قيد أجر عامل
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-foreground">
                    <span className="font-semibold">{detail.wagePayment.periodLabel}</span>
                    <span className="tabular-nums" dir="ltr">
                      {detail.wagePayment.hours}سا × {new Intl.NumberFormat("fr-DZ").format(detail.wagePayment.hourRate)} = {formatDA(detail.wagePayment.amount)}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px]",
                        detail.wagePayment.status === "cancelled"
                          ? "bg-muted text-muted-foreground border-border line-through"
                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                      )}
                    >
                      {detail.wagePayment.status === "cancelled" ? "ملغى" : "مسدد"}
                    </Badge>
                  </div>
                </div>
              )}

              <Separator />

              {/* Timeline سجل التدقيق */}
              <div>
                <p className="text-sm font-bold text-foreground flex items-center gap-1.5 mb-3">
                  <History className="h-4 w-4 text-teal-600" />
                  سجل التدقيق (Timeline)
                </p>
                {timeline.length === 0 ? (
                  <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-3 text-center">
                    لا توجد سجلات تدقيق موثّقة لهذه العملية (قيود قديمة قبل تفعيل السجل).
                  </p>
                ) : (
                  <ol className="relative space-y-0 border-r-2 border-border/60 mr-3 pr-4">
                    {timeline.map((t, i) => {
                      const st = timelineStyle(t.action);
                      const Icon = st.icon;
                      return (
                        <li key={t.id} className="relative pb-4 last:pb-0">
                          {/* نقطة الأيقونة على الخط */}
                          <span
                            className={cn(
                              "absolute -right-[30px] top-0 flex h-6 w-6 items-center justify-center rounded-full border",
                              st.cls
                            )}
                          >
                            <Icon className="h-3 w-3" />
                          </span>
                          <div className="space-y-0.5">
                            <p className="text-xs font-semibold text-foreground leading-relaxed">
                              {t.description || t.action}
                            </p>
                            <p className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-x-2">
                              <span className="inline-flex items-center gap-0.5">
                                <User className="h-2.5 w-2.5" />
                                {t.userName || "النظام"}
                              </span>
                              <span className="inline-flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" />
                                {formatDateTime(t.createdAt)}
                              </span>
                              {i === 0 && timeline.length > 1 && (
                                <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5">الأحدث</Badge>
                              )}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            {detail && !isCancelled && (
              <Button
                variant="outline"
                className="text-rose-600 border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-700"
                onClick={() => setCancelOpen(true)}
              >
                <XCircle className="h-4 w-4" />
                إلغاء العملية
              </Button>
            )}
            {detail && (
              <Button onClick={() => openReceiptPrint(detail, clubName)}>
                <Printer className="h-4 w-4" />
                طباعة إيصال
              </Button>
            )}
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حوار تأكيد الإلغاء — نفس نمط wages-section: سبب إلزامي ≥3 أحرف */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              تأكيد إلغاء العملية
            </AlertDialogTitle>
            <AlertDialogDescription>
              لن تُحذف العملية: تبقى في الدفتر بوضع «ملغاة» وتُستبعد من الرصيد فوراً. الإجراء موثّق في سجل التدقيق.
              {detail && (
                <span className="block mt-2 text-xs font-semibold text-foreground">
                  {detail.number || "قيد قديم"} — {typeLabel(detail.type)} — {categoryLabel(detail.category)} — {formatDA(detail.amount)}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">سبب الإلغاء (إلزامي، 3 أحرف على الأقل)</Label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="مثال: خطأ في إدخال المبلغ / عملية مكررة..."
              rows={3}
              disabled={cancelling}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>رجوع</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleCancel(); }}
              disabled={cancelling || cancelReason.trim().length < 3}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {cancelling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري الإلغاء...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  إلغاء العملية
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Field — خلية عرض مختصرة
// ─────────────────────────────────────────────────────────────
function Field({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof User;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-2.5">
      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className="text-xs font-bold text-foreground mt-0.5 break-words">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">{sub}</p>}
    </div>
  );
}

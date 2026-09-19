"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck, AlertTriangle, RefreshCw, Receipt, CheckCircle2,
  XCircle, Ban, History, Clock, FileText, User, ArrowRightLeft,
  Loader2, Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CashDrawerClosureDialog } from "@/components/financial/cash-drawer-closure-dialog";
import { TransactionDetailsDialog } from "@/components/financial/transaction-details-dialog";
import { onFinancialUpdated, notifyFinancialUpdated } from "@/lib/financial-events";

interface AuditViewProps {
  role: string;
}

export function AuditView({ role }: AuditViewProps) {
  const [loading, setLoading] = useState(true);
  const [integrityData, setIntegrityData] = useState<any>(null);
  const [cancelledTxs, setCancelledTxs] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [repairing, setRepairing] = useState(false);
  const [closureOpen, setClosureOpen] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [intRes, canRes, logRes] = await Promise.all([
        fetch("/api/financial/integrity", { cache: "no-store" }),
        fetch("/api/financial/transactions?status=cancelled&limit=50", { cache: "no-store" }),
        fetch("/api/audit-logs?limit=30", { cache: "no-store" }).catch(() => null),
      ]);

      if (intRes.ok) setIntegrityData(await intRes.json());
      if (canRes.ok) {
        const json = await canRes.json();
        setCancelledTxs(json.transactions || []);
      }
      if (logRes && logRes.ok) {
        const json = await logRes.json();
        setAuditLogs(json.logs || json.auditLogs || []);
      }
    } catch (err: any) {
      toast.error("خطأ أثناء جلب بيانات التدقيق");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => onFinancialUpdated(() => fetchData()), [fetchData]);

  const handleRepair = async () => {
    setRepairing(true);
    try {
      const res = await fetch("/api/financial/integrity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recompute" }),
      });
      if (!res.ok) throw new Error("فشلت إعادة البناء");
      toast.success("تمت مطابقة وإعادة بناء رصيد الدفتر بنجاح ✓");
      notifyFinancialUpdated();
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء الإصلاح");
    } finally {
      setRepairing(false);
    }
  };

  const isHealthy = integrityData?.matches ?? true;

  return (
    <div dir="rtl" className="space-y-6">
      {/* ═══ Header ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card border border-border/70 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-teal-500/15 text-teal-600 flex items-center justify-center font-bold">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-foreground">التدقيق وسجل العمليات المحاسبية</h3>
              <p className="text-xs text-muted-foreground">
                سلامة الدفتر، سجل العمليات الملغاة، ومطابقة الرصيد اللحظية
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setClosureOpen(true)}
            className="h-9 gap-1.5 text-xs font-bold"
          >
            <Receipt className="h-4 w-4 text-teal-600" /> إقفال الصندوق (تقرير Z)
          </Button>

          {role === "admin" || role === "superadmin" ? (
            <Button
              size="sm"
              onClick={handleRepair}
              disabled={repairing}
              className="h-9 gap-1.5 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white"
            >
              {repairing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              إعادة بناء ومطابقة الدفتر
            </Button>
          ) : null}
        </div>
      </div>

      {/* ═══ Integrity Status Card ═══ */}
      <Card className={cn(
        "border-2 shadow-xs",
        isHealthy ? "border-emerald-500/40 bg-emerald-500/5" : "border-rose-500/50 bg-rose-500/5"
      )}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              {isHealthy ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-rose-600" />
              )}
              حالة سلامة النظام المالي (Single Source of Truth)
            </CardTitle>
            <Badge className={isHealthy ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}>
              {isHealthy ? "مطابق تماماً ✓" : "بحاجة لمطابقة ⚠️"}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            يتم فحص الرصيد المسجل مقابل مجموع قيود دفتر FinancialTransaction النشطة دورياً
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-card border p-3">
              <span className="text-xs text-muted-foreground">رصيد الدفتر الفعلي (الحقيقة)</span>
              <div className="text-xl font-black text-foreground tabular-nums mt-0.5">
                {(integrityData?.ledgerBalance ?? 0).toLocaleString()} دج
              </div>
            </div>
            <div className="rounded-xl bg-card border p-3">
              <span className="text-xs text-muted-foreground">رصيد الكاش المخزن</span>
              <div className="text-xl font-black text-foreground tabular-nums mt-0.5">
                {(integrityData?.cachedBalance ?? 0).toLocaleString()} دج
              </div>
            </div>
            <div className="rounded-xl bg-card border p-3">
              <span className="text-xs text-muted-foreground">الفارق الحسابي</span>
              <div className="text-xl font-black text-foreground tabular-nums mt-0.5">
                {(integrityData?.diff ?? 0).toLocaleString()} دج
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ Cancelled Transactions (Soft-deleted) ═══ */}
      <Card className="border-border/80">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <Ban className="h-4 w-4 text-rose-600" />
                سجل العمليات الملغاة (Soft Cancelled Transactions)
              </CardTitle>
              <CardDescription className="text-xs">
                العمليات الملغاة مستبعدة تماماً من الرصيد والإجماليات، لكنها محفوظة لأغراض التدقيق
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs text-rose-700 border-rose-500/40">
              {cancelledTxs.length} عملية ملغاة
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-3">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : cancelledTxs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              لا توجد عمليات مالية ملغاة في السجل
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {cancelledTxs.map((tx) => (
                <div
                  key={tx.id}
                  onClick={() => setSelectedTxId(tx.id)}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 transition cursor-pointer text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono text-[11px] font-bold text-rose-700 dark:text-rose-400 shrink-0">
                      {tx.number || tx.id.slice(0, 8)}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate">
                        {tx.payeeName || "جهة غير مسماة"} — <span className="line-through text-muted-foreground">{tx.amount.toLocaleString()} دج</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {new Date(tx.date).toLocaleDateString("ar-DZ")} • سبب الإلغاء: {tx.cancellationReason || "لم يحدد سبب"}
                      </p>
                    </div>
                  </div>

                  <div className="text-left shrink-0">
                    <Badge variant="destructive" className="text-[10px]">
                      ملغاة
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cash Drawer Closure Dialog */}
      <CashDrawerClosureDialog
        open={closureOpen}
        onOpenChange={setClosureOpen}
        todayIncome={0}
      />

      {/* Transaction Details Dialog */}
      <TransactionDetailsDialog
        transactionId={selectedTxId}
        open={Boolean(selectedTxId)}
        onOpenChange={(open) => !open && setSelectedTxId(null)}
        onChanged={() => fetchData()}
      />
    </div>
  );
}

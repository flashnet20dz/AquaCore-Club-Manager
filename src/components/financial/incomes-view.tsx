"use client";

import { useCallback, useEffect, useState } from "react";
import {
  TrendingUp, Wallet, ShieldCheck, Building2, Users, RefreshCw,
  Plus, Search, Filter, ArrowDownRight, Eye, Layers, CreditCard,
  Banknote, FileSpreadsheet, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ExportButton } from "@/components/shared/export-button";
import { FinancialTransactionDialog } from "@/components/financial-transaction-dialog";
import { TransactionDetailsDialog } from "@/components/financial/transaction-details-dialog";
import { onFinancialUpdated } from "@/lib/financial-events";
import { CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from "@/components/financial/labels";

interface IncomesViewProps {
  role: string;
}

export function IncomesView({ role }: IncomesViewProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog states
  const [newIncomeOpen, setNewIncomeOpen] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);

  const fetchIncomes = useCallback(async (isSilent = false) => {
    if (isSilent) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetch(`/api/financial/analytics?period=${period}${selectedCategory !== "all" ? `&category=${selectedCategory}` : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error("فشل تحميل المداخيل");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      toast.error(err.message || "خطأ أثناء جلب المداخيل");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, selectedCategory]);

  useEffect(() => {
    fetchIncomes();
  }, [fetchIncomes]);

  useEffect(() => onFinancialUpdated(() => fetchIncomes(true)), [fetchIncomes]);

  const categories = data?.incomeCategories || [];
  const transactions = data?.categoryDetails?.transactions || [];

  // Filtered transactions by search query
  const filteredTransactions = transactions.filter((t: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.payeeName?.toLowerCase().includes(q) ||
      t.number?.toLowerCase().includes(q) ||
      t.note?.toLowerCase().includes(q) ||
      t.subscriberFileNumber?.toLowerCase().includes(q)
    );
  });

  const exportRows = filteredTransactions.map((t: any) => ({
    number: t.number,
    date: new Date(t.date).toLocaleDateString("ar-DZ"),
    category: CATEGORY_LABELS[t.category] || t.category,
    payee: t.payeeName || (t.subscriberFileNumber ? `منخرط #${t.subscriberFileNumber}` : "—"),
    amount: `${t.amount.toLocaleString()} دج`,
    method: PAYMENT_METHOD_LABELS[t.paymentMethod] || t.paymentMethod,
    notes: t.note || "—",
  }));

  return (
    <div dir="rtl" className="space-y-6">
      {/* ═══ Header ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card border border-border/70 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center font-bold">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-foreground">إدارة وسجل المداخيل</h3>
              <p className="text-xs text-muted-foreground">
                المصدر المالي الموحد لجميع إيرادات النادي: الاشتراكات، التجديدات، التأمين، وحقوق المركب
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Add Income Button */}
          <Button
            size="sm"
            onClick={() => setNewIncomeOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs font-bold shadow-xs h-9"
          >
            <Plus className="h-4 w-4" /> قيد قبض جديد
          </Button>

          <ExportButton
            rows={exportRows}
            columns={[
              { key: "number", label: "رقم القيد" },
              { key: "date", label: "التاريخ" },
              { key: "category", label: "الصنف" },
              { key: "payee", label: "الجهة / المنخرط" },
              { key: "amount", label: "المبلغ" },
              { key: "method", label: "طريقة الدفع" },
              { key: "notes", label: "الملاحظات" },
            ]}
            filename={`المداخيل-${period}`}
            title="كشف المقبوضات والمداخيل — AquaCore"
            disabled={loading || exportRows.length === 0}
            label="تصدير المداخيل"
          />

          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchIncomes(true)}
            disabled={refreshing}
            className="h-9 gap-1 text-xs"
          >
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* ═══ Stats Cards ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="pb-1 pt-3.5 px-4 flex flex-row items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">إجمالي المداخيل</span>
            <Wallet className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                {(data?.totalIncome ?? 0).toLocaleString()} <span className="text-xs font-normal">دج</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="pb-1 pt-3.5 px-4 flex flex-row items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">عدد عمليات القبض</span>
            <ArrowDownRight className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-black text-foreground tabular-nums">
                {(data?.incomeTransactionsCount ?? 0).toLocaleString()} <span className="text-xs font-normal">عملية</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="pb-1 pt-3.5 px-4 flex flex-row items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">متوسط عملية القبض</span>
            <Banknote className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {loading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div className="text-2xl font-black text-foreground tabular-nums">
                {data?.incomeTransactionsCount > 0
                  ? Math.round(data.totalIncome / data.incomeTransactionsCount).toLocaleString()
                  : 0}{" "}
                <span className="text-xs font-normal">دج</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ Categories Breakdown Grid ═══ */}
      <Card className="border-border/80">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm sm:text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-600" />
              توزيع المداخيل حسب الأصناف (انقر لتصفية العمليات)
            </span>
            <Badge variant="outline" className="text-xs text-emerald-700 border-emerald-500/40">
              {categories.length} أصناف دخل
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {categories.map((cat: any) => {
              const isSelected = selectedCategory === cat.key;
              return (
                <div
                  key={cat.key}
                  onClick={() => setSelectedCategory(isSelected ? "all" : cat.key)}
                  className={cn(
                    "rounded-xl border p-3.5 transition cursor-pointer space-y-2",
                    isSelected
                      ? "border-emerald-600 bg-emerald-500/10 shadow-xs"
                      : "border-border/70 hover:border-emerald-500/40 hover:bg-accent/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground truncate">{cat.label}</span>
                    <Badge variant={isSelected ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                      {cat.percentage}%
                    </Badge>
                  </div>
                  <div className="text-lg font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {cat.amount.toLocaleString()} <span className="text-xs font-normal">دج</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                    <span>{cat.count} عملية</span>
                    <span className="text-emerald-600 font-bold text-[10px]">
                      {isSelected ? "محدد ✓" : "تصفية ←"}
                    </span>
                  </div>
                  <Progress value={cat.percentage} className="h-1.5 bg-emerald-950/10" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ═══ Transactions Table / List ═══ */}
      {selectedCategory !== "all" && data?.categoryDetails && (
        <Card className="border-border/80">
          <CardHeader className="pb-3 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <Eye className="h-4 w-4 text-teal-600" />
                  قائمة العمليات المسجلة للصنف: {data.categoryDetails.label}
                </CardTitle>
                <CardDescription className="text-xs">
                  إجمالي {data.categoryDetails.totalCount} عملية بمبلغ {data.categoryDetails.totalAmount.toLocaleString()} دج
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-56">
                  <Search className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="بحث في القيد أو الاسم..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pr-8 text-xs"
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedCategory("all")}
                  className="h-8 text-xs text-muted-foreground"
                >
                  إلغاء التصفية
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-3">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                لا توجد عمليات تطابق البحث
              </div>
            ) : (
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {filteredTransactions.map((tx: any) => (
                  <div
                    key={tx.id}
                    onClick={() => setSelectedTxId(tx.id)}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-border/70 hover:border-emerald-500/50 hover:bg-accent/40 transition cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-[11px] font-bold text-muted-foreground shrink-0">
                        {tx.number}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-foreground truncate">
                          {tx.payeeName || (tx.subscriberFileNumber ? `منخرط #${tx.subscriberFileNumber}` : "جهة غير مسماة")}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {new Date(tx.date).toLocaleDateString("ar-DZ")} • {PAYMENT_METHOD_LABELS[tx.paymentMethod] || tx.paymentMethod} {tx.note ? `• ${tx.note}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="text-left shrink-0">
                      <span className="font-black text-xs sm:text-sm tabular-nums text-emerald-700 dark:text-emerald-400">
                        +{tx.amount.toLocaleString()} دج
                      </span>
                      <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5 justify-end">
                        <Eye className="h-3 w-3" /> عرض القيد
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* New Income Dialog */}
      <FinancialTransactionDialog
        open={newIncomeOpen}
        onOpenChange={setNewIncomeOpen}
        preset={{ type: "income" }}
        currentBalance={data?.totalIncome ?? 0}
        onSaved={() => fetchIncomes(true)}
      />

      {/* Transaction Details Dialog */}
      <TransactionDetailsDialog
        transactionId={selectedTxId}
        open={Boolean(selectedTxId)}
        onOpenChange={(open) => !open && setSelectedTxId(null)}
        onChanged={() => fetchIncomes(true)}
      />
    </div>
  );
}

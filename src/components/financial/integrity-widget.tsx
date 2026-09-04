"use client";

/**
 * IntegrityWidget — ودجت سلامة الحسابات (المرحلة 31)
 * ═════════════════════════════════════════════════════════════
 * يقارن الرصيد المُخزَّن (FinancialBalance) مع الحقيقة في دفتر
 * FinancialTransaction (النشط فقط):
 *   - زر «فحص الحسابات»  → GET  /api/financial/integrity
 *     ✓ الحسابات متطابقة  أو  ⚠ يوجد فرق (المسجل/الحقيقي/الفرق)
 *   - زر «إعادة بناء الرصيد» (admin/superadmin فقط) → POST نفس المسار
 *     مع توست للنتيجة ثم onChanged() لإعادة جلب كل شيء.
 *
 * حالة بداية العرض تُقرأ من integrity داخل payload الـdashboard
 * (فحص خفيف يحدث مع كل جلب) — والفحص الكامل بالزر.
 */

import { useState } from "react";
import {
  ShieldCheck, ShieldAlert, Loader2, Wrench, ClipboardCheck,
  Hash, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
/** فحص خفيف قادم داخل payload /api/financial/dashboard */
export interface InlineIntegrity {
  matches: boolean;
  cachedBalance: number;
  ledgerBalance: number;
  diff: number;
}

interface IntegritySummary {
  matches: boolean;
  cacheBalance: number;
  ledgerBalance: number;
  balanceDiff: number;
  totalIncomeDiff: number;
  totalExpenseDiff: number;
  unsequencedCount: number;
  checkedAt: string;
}

interface IntegrityResponse {
  summary: IntegritySummary;
  categoryDiffs: Array<{ type: string; category: string; cache: number; ledger: number; diff: number }>;
}

interface IntegrityWidgetProps {
  /** دور المستخدم الحالي — زر إعادة البناء يظهر لـadmin/superadmin فقط */
  role?: string;
  /** الفحص الخفيف من payload الـdashboard (حالة قبل أول فحص يدوي) */
  inline?: InlineIntegrity | null;
  /** يُستدعى بعد إعادة البناء الناجحة لإعادة جلب كل البيانات */
  onChanged?: () => void;
}

function formatDA(n: number): string {
  return new Intl.NumberFormat("fr-DZ").format(Math.round(n)) + " دج";
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export function IntegrityWidget({ role, inline, onChanged }: IntegrityWidgetProps) {
  const [checking, setChecking] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [result, setResult] = useState<IntegrityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canRebuild = role === "admin" || role === "superadmin";

  const runCheck = async () => {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/financial/integrity", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json: IntegrityResponse = await res.json();
      setResult(json);
      if (json.summary.matches) {
        toast.success("✓ فحص الحسابات — كل الأرقام متطابقة");
      } else {
        toast.warning("⚠ فحص الحسابات — يوجد فرق بين الرصيد المسجل والحقيقي");
      }
    } catch {
      setError("تعذر إجراء الفحص");
      toast.error("تعذر إجراء فحص الحسابات");
    } finally {
      setChecking(false);
    }
  };

  const runRebuild = async () => {
    setRebuilding(true);
    setError(null);
    try {
      const res = await fetch("/api/financial/integrity", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "HTTP " + res.status);
      if (json?.after) setResult(json.after as IntegrityResponse);
      if (json?.message) {
        if (json?.after?.summary?.matches) toast.success(json.message);
        else toast.warning(json.message);
      }
      onChanged?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "تعذر إعادة بناء الرصيد";
      toast.error(msg);
      setError(msg);
    } finally {
      setRebuilding(false);
    }
  };

  // الحالة المعروضة: نتيجة الفحص اليدوي إن وجدت، وإلا الفحص الخفيف من الـdashboard
  const shown = result
    ? {
        matches: result.summary.matches,
        cacheBalance: result.summary.cacheBalance,
        ledgerBalance: result.summary.ledgerBalance,
        diff: result.summary.balanceDiff,
      }
    : inline
      ? { matches: inline.matches, cacheBalance: inline.cachedBalance, ledgerBalance: inline.ledgerBalance, diff: inline.diff }
      : null;

  const catDiffs = result?.categoryDiffs ?? [];
  const hasChecked = !!result;

  return (
    <Card className={cn(
      "border",
      shown ? (shown.matches ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/5") : "border-border/60"
    )}>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn(
              "h-8 w-8 rounded-xl flex items-center justify-center shrink-0",
              shown ? (shown.matches ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400") : "bg-teal-500/12 text-teal-600"
            )}>
              {shown ? (shown.matches ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />) : <ClipboardCheck className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-extrabold leading-tight">سلامة الحسابات</p>
              <p className="text-[10px] text-muted-foreground leading-tight">
                مطابقة الرصيد المُخزَّن مع دفتر القيود الفعلي
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={runCheck}
              disabled={checking || rebuilding}
              className="h-9 min-w-11 gap-1.5 text-[11px] font-bold"
            >
              {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
              فحص الحسابات
            </Button>
            {canRebuild && (
              <Button
                size="sm"
                variant="outline"
                onClick={runRebuild}
                disabled={checking || rebuilding}
                className="h-9 min-w-11 gap-1.5 text-[11px] font-bold border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                title="إعادة حساب الرصيد من الدفتر كاملاً + ترقيم القيود القديمة"
              >
                {rebuilding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
                إعادة بناء الرصيد
              </Button>
            )}
          </div>
        </div>

        {/* نتيجة الفحص */}
        {error && (
          <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" /> {error}
          </p>
        )}

        {shown && (
          <div className={cn(
            "rounded-xl border p-3 space-y-2",
            shown.matches ? "border-emerald-500/25 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"
          )}>
            <p className={cn(
              "text-xs font-extrabold flex items-center gap-1.5",
              shown.matches ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"
            )}>
              {shown.matches
                ? <>✓ الحسابات متطابقة — الرصيد المسجل يطابق الدفتر</>
                : <>⚠ يوجد فرق بين الرصيد المسجل والحقيقي</>}
              {!hasChecked && (
                <span className="text-[9px] font-bold rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground">فحص تلقائي — اضغط «فحص الحسابات» للتفصيل</span>
              )}
            </p>
            {!shown.matches && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                <MiniStat label="الرصيد المسجل" value={formatDA(shown.cacheBalance)} />
                <MiniStat label="الرصيد الحقيقي (الدفتر)" value={formatDA(shown.ledgerBalance)} />
                <MiniStat label="الفرق" value={formatDA(shown.diff)} tone={shown.diff !== 0 ? "warn" : "ok"} />
              </div>
            )}
            {catDiffs.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {catDiffs.slice(0, 8).map((d, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-background px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                    <Hash className="h-3 w-3" />
                    {d.type === "income" ? "مدخول" : "مصروف"}: {d.category} ({d.diff > 0 ? "+" : ""}{new Intl.NumberFormat("fr-DZ").format(d.diff)})
                  </span>
                ))}
              </div>
            )}
            {hasChecked && result && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                <RefreshCw className="h-3 w-3" />
                آخر فحص: {new Date(result.summary.checkedAt).toLocaleString("ar-DZ")}
                {result.summary.unsequencedCount > 0 && ` — قيود بلا ترقيم: ${result.summary.unsequencedCount} (تُرقَّم عند إعادة البناء)`}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────
function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background p-2">
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className={cn(
        "text-xs font-extrabold tabular-nums",
        tone === "warn" ? "text-amber-700 dark:text-amber-300" : "text-foreground"
      )}>
        {value}
      </p>
    </div>
  );
}

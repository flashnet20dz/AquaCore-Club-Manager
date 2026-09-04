"use client";

/**
 * EmployeeProfileDialog — ملف الموظف الكامل (المرحلة 5 — §29)
 * ═══════════════════════════════════════════════════════════════
 * حوار واحد يجمع سلسلة الموظف كلها (من نفس مصادر الصفحات المتخصصة):
 *   المعلومات الشخصية • العقود • حصص المسبح المعيَّنة • ساعات العمل الأخيرة
 *   الساعات المعتمدة • الأجور الشهرية (آخر 6 أشهر من wage-core) • التسديدات
 *   التسديدات الملغاة • القيود المالية (wage:*)
 * + تصدير موحّد (Excel/CSV/PDF/طباعة) للعقود والأجور المعروضة.
 */

import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, XCircle, User, FileText, Wallet, Clock, Waves } from "lucide-react";
import { toast } from "sonner";
import { formatWallTime, formatWallDate } from "@/lib/wall-clock";
import { ExportButton } from "@/components/shared/export-button";
import { positionLabel, contractTypeLabel, employeeStatusInfo, formatDate } from "@/components/contracts-shared";

interface ProfileData {
  employee: {
    id: string; firstName: string; lastName: string; firstNameFr?: string | null;
    lastNameFr?: string | null; email?: string | null; phone: string | null;
    address: string | null; nationalId: string | null; birthDate: string | null;
    birthPlace: string | null; position: string; hourRate: number; hireDate: string;
    status?: string; active: boolean;
    user?: { id: string; name: string; email: string } | null;
  };
  contracts: Array<{
    id: string; contractNumber: string; contractType?: string; title?: string | null;
    startDate: string; endDate: string | null; hourRate: number; status: string;
    terminatedReason?: string | null;
  }>;
  assignments: Array<{ id: string; dayOfWeek: string; timeSlot: string; assignmentType: string }>;
  workHours: {
    approvedCount: number;
    approvedHoursTotal: number;
    recent: Array<{
      id: string; date: string; startTime: string; endTime: string;
      status: string; rateSnapshot: number | null; rejectionReason: string | null;
    }>;
  };
  wagesByMonth: Array<{
    label: string; hours: number; rate: number; gross: number;
    paid: number; remaining: number; status: string;
  }>;
  payments: Array<{
    id: string; amount: number; method: string; paidAt: string; periodLabel: string;
    status: string; cancellationReason?: string | null;
  }>;
  transactions: Array<{
    id: string; seq: number | null; amount: number; date: string;
    paymentMethod: string; status: string; reference: string | null;
  }>;
}

const WAGE_STATUS_LABELS: Record<string, string> = {
  unpaid: "غير مدفوع",
  partial: "مدفوع جزئياً",
  paid: "مدفوع بالكامل",
};

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: "مسودة", active: "نشط", expired: "منتهٍ",
  terminated: "منهيّ", renewed: "مجدّد", cancelled: "ملغى",
};

const WH_STATUS_LABELS: Record<string, string> = {
  pending: "مسودة", approved: "موافق عليه", rejected: "مرفوض", cancelled: "ملغى",
};

export function EmployeeProfileDialog({ employee, onClose }: {
  employee: { id: string; lastName: string; firstName: string } | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  // الملف يُحمَّل عند فتح الحوار (المكوّن يُعاد تركيبه بمفتاح فريد لكل موظف)
  const loading = !data && !error;

  useEffect(() => {
    if (!employee) return;
    let cancelled = false;
    fetch(`/api/employees/${employee.id}/profile`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "فشل تحميل الملف";
        setError(msg);
        toast.error(msg);
      });
    return () => {
      cancelled = true;
    };
  }, [employee]);

  if (!employee) return null;

  const finNumber = (seq: number | null) =>
    seq ? `FIN-${new Date().getFullYear()}-${String(seq).padStart(6, "0")}` : "—";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-primary" />
            ملف الموظف — {employee.lastName} {employee.firstName}
          </DialogTitle>
        </DialogHeader>

        {loading || !data ? (
          <div className="flex justify-center py-14">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* المعلومات الشخصية */}
            <section className="rounded-xl border border-border/60 p-3">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <h4 className="font-bold text-xs">المعلومات الشخصية</h4>
                <Badge variant="outline" className={`text-[9px] ${employeeStatusInfo(data.employee).badge}`}>
                  {employeeStatusInfo(data.employee).label}
                </Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                {([
                  ["المنصب", positionLabel(data.employee.position)],
                  ["سعر الساعة", `${data.employee.hourRate} دج`],
                  ["الهاتف", data.employee.phone || "—"],
                  ["البريد", data.employee.email || "—"],
                  ["بطاقة التعريف", data.employee.nationalId || "—"],
                  ["تاريخ الميلاد", formatDate(data.employee.birthDate)],
                  ["مكان الميلاد", data.employee.birthPlace || "—"],
                  ["التوظيف", formatDate(data.employee.hireDate)],
                ] as Array<[string, string]>).map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-muted/40 p-2">
                    <p className="text-[9px] text-muted-foreground">{k}</p>
                    <p className="font-semibold truncate">{v}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* العقود */}
            <section className="rounded-xl border border-border/60 p-3">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <h4 className="font-bold text-xs flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-primary" /> العقود ({data.contracts.length})</h4>
                <ExportButton
                  rows={data.contracts}
                  filename={`عقود-${employee.lastName}-${employee.firstName}`}
                  title={`عقود ${employee.lastName} ${employee.firstName}`}
                  formats={["excel", "csv", "pdf", "print"]}
                  columns={[
                    { key: "number", label: "رقم العقد", format: (c) => c.contractNumber },
                    { key: "type", label: "النوع", format: (c) => contractTypeLabel(c.contractType) },
                    { key: "start", label: "البداية", format: (c) => formatDate(c.startDate) },
                    { key: "end", label: "النهاية", format: (c) => formatDate(c.endDate) },
                    { key: "rate", label: "سعر الساعة", format: (c) => `${c.hourRate} دج` },
                    { key: "status", label: "الحالة", format: (c) => CONTRACT_STATUS_LABELS[c.status] || c.status },
                    { key: "reason", label: "سبب الإنهاء", format: (c) => c.terminatedReason || "" },
                  ]}
                />
              </div>
              {data.contracts.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-2 text-center">لا عقود مسجّلة</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {data.contracts.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5 text-[11px]">
                      <span className="font-mono" dir="ltr">{c.contractNumber}</span>
                      <span>{contractTypeLabel(c.contractType)}</span>
                      <span className="text-muted-foreground">{formatDate(c.startDate)} → {formatDate(c.endDate)}</span>
                      <Badge variant="outline" className="text-[9px]">{CONTRACT_STATUS_LABELS[c.status] || c.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* حصص المسبح المعيَّنة */}
            <section className="rounded-xl border border-border/60 p-3">
              <h4 className="font-bold text-xs flex items-center gap-1.5 mb-2"><Waves className="h-3.5 w-3.5 text-teal-600" /> حصص المسبح المعيَّنة ({data.assignments.length})</h4>
              {data.assignments.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-1 text-center">لا تعيينات نشطة</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {data.assignments.map((a) => (
                    <Badge key={a.id} variant="outline" className="text-[10px] gap-1">
                      {a.dayOfWeek} • {a.timeSlot}
                    </Badge>
                  ))}
                </div>
              )}
            </section>

            {/* ساعات العمل */}
            <section className="rounded-xl border border-border/60 p-3">
              <h4 className="font-bold text-xs flex items-center gap-1.5 mb-2"><Clock className="h-3.5 w-3.5 text-amber-600" /> ساعات العمل</h4>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="rounded-lg bg-emerald-500/10 p-2 text-center">
                  <p className="text-[9px] text-muted-foreground">الساعات المعتمدة (كل التاريخ)</p>
                  <p className="font-bold text-sm text-emerald-700">{data.workHours.approvedHoursTotal} ساعة</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-2 text-center">
                  <p className="text-[9px] text-muted-foreground">عدد السجلات المعتمدة</p>
                  <p className="font-bold text-sm">{data.workHours.approvedCount}</p>
                </div>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {data.workHours.recent.slice(0, 20).map((w) => (
                  <div key={w.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-2.5 py-1 text-[10px]">
                    <span>{formatWallDate(w.date)}</span>
                    <span className="font-mono" dir="ltr">{formatWallTime(w.startTime)} → {formatWallTime(w.endTime)}</span>
                    {w.rateSnapshot != null && <span className="text-muted-foreground">{w.rateSnapshot} دج/سا</span>}
                    <Badge variant="outline" className="text-[9px]">{WH_STATUS_LABELS[w.status] || w.status}</Badge>
                  </div>
                ))}
              </div>
            </section>

            {/* الأجور الشهرية */}
            <section className="rounded-xl border border-border/60 p-3">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <h4 className="font-bold text-xs flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5 text-amber-600" /> الأجور — آخر 6 أشهر (نفس مصدر صفحة الأجور)</h4>
                <ExportButton
                  rows={data.wagesByMonth}
                  filename={`أجور-${employee.lastName}-${employee.firstName}`}
                  title={`أجور ${employee.lastName} ${employee.firstName} — آخر 6 أشهر`}
                  formats={["excel", "csv", "pdf", "print"]}
                  columns={[
                    { key: "month", label: "الشهر", format: (m) => m.label },
                    { key: "hours", label: "الساعات المعتمدة", format: (m) => String(m.hours) },
                    { key: "rate", label: "سعر الساعة", format: (m) => String(m.rate) },
                    { key: "gross", label: "الإجمالي", format: (m) => `${m.gross} دج` },
                    { key: "paid", label: "المدفوع", format: (m) => `${m.paid} دج` },
                    { key: "remaining", label: "المتبقي", format: (m) => `${m.remaining} دج` },
                    { key: "status", label: "الحالة", format: (m) => WAGE_STATUS_LABELS[m.status] || m.status },
                  ]}
                />
              </div>
              <div className="overflow-x-auto max-h-44 overflow-y-auto">
                <table className="w-full text-[10px]">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="p-1.5 text-right">الشهر</th>
                      <th className="p-1.5">الساعات</th>
                      <th className="p-1.5">السعر</th>
                      <th className="p-1.5">الإجمالي</th>
                      <th className="p-1.5">المدفوع</th>
                      <th className="p-1.5">المتبقي</th>
                      <th className="p-1.5">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.wagesByMonth.map((m) => (
                      <tr key={m.label} className="border-t border-border/40">
                        <td className="p-1.5 font-semibold">{m.label}</td>
                        <td className="p-1.5 text-center">{m.hours}</td>
                        <td className="p-1.5 text-center">{m.rate}</td>
                        <td className="p-1.5 text-center font-semibold">{m.gross}</td>
                        <td className="p-1.5 text-center text-emerald-700">{m.paid}</td>
                        <td className="p-1.5 text-center text-amber-700">{m.remaining}</td>
                        <td className="p-1.5 text-center">{WAGE_STATUS_LABELS[m.status] || m.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* التسديدات + القيود المالية */}
            <section className="rounded-xl border border-border/60 p-3">
              <h4 className="font-bold text-xs mb-2">التسديدات والقيود المالية</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">تسديدات الأجر ({data.payments.length})</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {data.payments.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-2">لا تسديدات</p>}
                    {data.payments.map((p) => (
                      <div key={p.id} className={`rounded-lg px-2.5 py-1.5 text-[10px] ${p.status === "cancelled" ? "bg-rose-500/10" : "bg-muted/30"}`}>
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-bold">{p.amount} دج</span>
                          <span className="text-muted-foreground">{formatWallDate(p.paidAt)}</span>
                          {p.status === "cancelled" ? (
                            <Badge variant="outline" className="text-[9px] bg-rose-500/10 text-rose-700 border-rose-500/30 gap-0.5">
                              <XCircle className="h-2.5 w-2.5" /> ملغى
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30">نشط</Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground">{p.periodLabel} • {p.method}</p>
                        {p.status === "cancelled" && p.cancellationReason && (
                          <p className="text-rose-600">السبب: {p.cancellationReason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">قيود الدفتر المالي — أجور ({data.transactions.length})</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {data.transactions.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-2">لا قيود</p>}
                    {data.transactions.map((t) => (
                      <div key={t.id} className={`rounded-lg px-2.5 py-1.5 text-[10px] ${t.status === "cancelled" ? "bg-rose-500/10" : "bg-muted/30"}`}>
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-mono" dir="ltr">{finNumber(t.seq)}</span>
                          <span className="font-bold">{t.amount} دج</span>
                          {t.status === "cancelled" ? (
                            <Badge variant="outline" className="text-[9px] bg-rose-500/10 text-rose-700 border-rose-500/30">ملغى</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30">نشط</Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground">{formatWallDate(t.date)} • {t.reference || "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={onClose}>إغلاق</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

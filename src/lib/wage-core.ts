/**
 * wage-core.ts — حساب أجور العمال من ساعات العمل المعتمدة (المصدر الموحّد)
 * ═══════════════════════════════════════════════════════════════════════
 * يُستهلك من: /api/wages (صفحة الأجور) و /api/stats (لوحة التحكم — الأجور المعلّقة)
 *
 * المعادلة الوحيدة في النظام:
 *   Total Hours (WorkHours المعتمدة داخل الفترة) × Hourly Rate = Gross Wage
 *   المدفوع = تسديدات WagePayment النشطة لنفس الفترة + دفعات salary قديمة
 *   المتبقي = Gross − المدفوع
 *
 * تخزين الأوقات: wall-clock UTC (src/lib/wall-clock.ts) — بلا انحراف توقيت.
 */

import { db } from "@/lib/db";
import { utcRange } from "@/lib/wall-clock";

export interface WorkerWageRow {
  userId: string;
  name: string;
  role: string;
  position: string | null;
  hourRate: number;
  daysWorked: number;
  sessions: number;
  totalHours: number;
  gross: number;
  paid: number;
  remaining: number;
  status: "unpaid" | "partial" | "paid";
  payments: Array<{
    id: string; amount: number; method: string; paidAt: string; note: string | null;
    periodLabel: string; transactionId: string | null; legacy?: boolean;
    status?: string; cancelledAt?: string | null; cancellationReason?: string | null;
  }>;
}

export async function computeWages(clubId: string, from: string, to: string) {
  const { start, end } = utcRange(from, to);

  // العمال (كل مستخدمي النادي غير المعلّقين)
  const staff = await db.user.findMany({
    where: { clubId, pending: false, active: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  // أسعار الساعة من Employee (خاصة بكل عامل)
  const employees = await db.employee.findMany({
    where: { clubId, userId: { not: null } },
    select: { userId: true, position: true, hourRate: true },
  });
  const empMap = new Map(employees.map((e) => [e.userId as string, { position: e.position, hourRate: e.hourRate }]));
  const settingsRow = await db.setting.findFirst({ where: { clubId, key: "workHourRate" } });
  const defaultRate = parseInt(settingsRow?.value || "200") || 200;

  // ساعات العمل المعتمدة داخل الفترة (Pointage الفعلي)
  const wh = await db.workHours.findMany({
    where: { clubId, date: { gte: start, lte: end }, status: "approved" },
    select: { userId: true, date: true, startTime: true, endTime: true, note: true },
  });

  // تسديدات الأجور المرتبطة بنفس الفترة (الملغاة تُعرض في السجل ولا تُحسب مدفوعاً)
  const wagePayments = await db.wagePayment.findMany({
    where: { clubId, periodStart: start, periodEnd: end },
    orderBy: { paidAt: "desc" },
  });

  // دفعات salary قديمة (قبل نظام WagePayment) المؤرخة داخل الفترة — تُحتسب مدفوعاً
  // ★ الملغاة مستثناة من الحساب (تبقى في التاريخ فقط)
  const legacySalary = await db.payment.findMany({
    where: { clubId, category: "salary", status: { not: "cancelled" }, date: { gte: start, lte: end } },
    select: { id: true, userId: true, amount: true, date: true, note: true, status: true },
  });

  // تجميع الساعات لكل عامل
  const hoursByUser = new Map<string, { hours: number; days: Set<string>; sessions: number }>();
  for (const r of wh) {
    // ★ قراءة الحالة والاستراحة من note JSON (نفس منطق GET /api/workhours)
    let breakMinutes = 0;
    let workStatus = "present";
    try {
      if (r.note && r.note.startsWith("{")) {
        const meta = JSON.parse(r.note);
        breakMinutes = meta.breakMinutes || 0;
        workStatus = meta.workStatus || "present";
      }
    } catch {}
    if (workStatus !== "present" && workStatus !== "half-day") continue; // الغياب لا يُحتسب
    const durH = Math.max(0, (new Date(r.endTime).getTime() - new Date(r.startTime).getTime()) / 3600000 - breakMinutes / 60);
    const dayKey = new Date(r.date).toISOString().slice(0, 10);
    const acc = hoursByUser.get(r.userId) || { hours: 0, days: new Set<string>(), sessions: 0 };
    acc.hours += durH;
    acc.days.add(dayKey);
    acc.sessions += 1;
    hoursByUser.set(r.userId, acc);
  }

  const workers: WorkerWageRow[] = staff.map((u) => {
    const emp = empMap.get(u.id);
    const hourRate = emp?.hourRate || defaultRate;
    const agg = hoursByUser.get(u.id);
    const totalHours = Math.round((agg?.hours || 0) * 100) / 100;
    const gross = Math.round(totalHours * hourRate);
    const wpRows = wagePayments.filter((p) => p.userId === u.id);
    // ★ المدفوع = التسديدات النشطة فقط — الملغى لا يُحتسب (يعود المبلغ للمتبقي)
    const wpPaid = wpRows.filter((p) => p.status !== "cancelled").reduce((s, p) => s + p.amount, 0);
    const legacyPaid = legacySalary.filter((p) => p.userId === u.id).reduce((s, p) => s + p.amount, 0);
    const paid = wpPaid + legacyPaid;
    const remaining = Math.max(0, gross - paid);
    const status: WorkerWageRow["status"] = paid <= 0 ? "unpaid" : remaining <= 0 ? "paid" : "partial";
    return {
      userId: u.id,
      name: u.name,
      role: u.role,
      position: emp?.position || null,
      hourRate,
      daysWorked: agg?.days.size || 0,
      sessions: agg?.sessions || 0,
      totalHours,
      gross,
      paid,
      remaining,
      status,
      payments: [
        ...wpRows.map((p) => ({
          id: p.id, amount: p.amount, method: p.method, paidAt: p.paidAt.toISOString(),
          note: p.note, periodLabel: p.periodLabel, transactionId: p.transactionId, legacy: false,
          status: p.status, cancelledAt: p.cancelledAt?.toISOString() ?? null, cancellationReason: p.cancellationReason,
        })),
        ...legacySalary.filter((p) => p.userId === u.id).map((p) => ({
          id: p.id, amount: p.amount, method: "cash", paidAt: p.date.toISOString(),
          note: p.note || "تسديد أجر (سجل قديم)", periodLabel: "—", transactionId: null, legacy: true,
          status: p.status, cancelledAt: null as string | null, cancellationReason: null as string | null,
        })),
      ],
    };
  });

  const totals = {
    gross: workers.reduce((s, w) => s + w.gross, 0),
    paid: workers.reduce((s, w) => s + w.paid, 0),
    remaining: workers.reduce((s, w) => s + w.remaining, 0),
  };

  return { workers, totals };
}

export function wagePeriodLabel(from: string, to: string): string {
  if (from === to) return from.split("-").reverse().join("/");
  return `${from.split("-").reverse().join("/")} ← ${to.split("-").reverse().join("/")}`;
}

/**
 * /api/wages — نظام أجور العمال (Single Source of Truth)
 * ═════════════════════════════════════════════════════════════
 * GET   ?from=YYYY-MM-DD&to=YYYY-MM-DD   (أو ?month=YYYY-MM)
 *   → حساب أجور كل عامل من Pointage الفعلي (WorkHours المعتمدة):
 *     أيام العمل، الحصص، الساعات، سعر الساعة، الإجمالي، المدفوع، المتبقي، الحالة
 *   المدفوع = تسديدات WagePayment لنفس الفترة + دفعات salary قديمة المؤرخة داخل الفترة
 *
 * POST  { userId, from, to, amount, method, paidAt, note, source }
 *   → تسديد ذرّي: WagePayment + قيد مالي واحد FinancialTransaction (expense/wages)
 *     مرتبط 1:1 (transactionId فريد) + تحديث الرصيد + سجل تدقيق AuditLog
 *   الحمايات: صلاحية admin/superadmin • مبلغ > 0 • المبلغ ≤ المتبقي (منع الدفع الزائد)
 *
 * تخزين الأوقات: wall-clock UTC (انظر src/lib/wall-clock.ts) — بلا انحراف توقيت.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { utcRange, parseWallDateTime } from "@/lib/wall-clock";
import { applyBalanceDelta, recomputeBalanceTx } from "@/lib/financial-posting";

// ═══════════════════════════════════════════════════════════
// ★ إصلاح ذاتي للإنتاج: Vercel build لا يُنفّذ db:push —
// إن لم يكن جدول WagePayment موجوداً نُنشئه DDL ثم نطلب إعادة المحاولة.
// ═══════════════════════════════════════════════════════════
let wageDdlDone = false;
async function ensureWageTable(): Promise<void> {
  if (wageDdlDone) return;
  const stmts = [
    `CREATE TABLE IF NOT EXISTS "WagePayment" (
      "id" TEXT PRIMARY KEY,
      "clubId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "periodStart" TIMESTAMP(3) NOT NULL,
      "periodEnd" TIMESTAMP(3) NOT NULL,
      "periodLabel" TEXT NOT NULL,
      "hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "hourRate" INTEGER NOT NULL DEFAULT 0,
      "grossAmount" INTEGER NOT NULL DEFAULT 0,
      "prevPaid" INTEGER NOT NULL DEFAULT 0,
      "amount" INTEGER NOT NULL DEFAULT 0,
      "method" TEXT NOT NULL DEFAULT 'cash',
      "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "note" TEXT,
      "transactionId" TEXT,
      "createdById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "WagePayment_transactionId_key" ON "WagePayment"("transactionId")`,
    `CREATE INDEX IF NOT EXISTS "WagePayment_clubId_userId_periodStart_idx" ON "WagePayment"("clubId","userId","periodStart")`,
    `CREATE INDEX IF NOT EXISTS "WagePayment_clubId_paidAt_idx" ON "WagePayment"("clubId","paidAt")`,
  ];
  for (const s of stmts) {
    await db.$executeRawUnsafe(s).catch(() => undefined); // موجود مسبقاً → تجاهل
  }
  for (const fk of [
    `ALTER TABLE "WagePayment" ADD CONSTRAINT "WagePayment_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE "WagePayment" ADD CONSTRAINT "WagePayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE "WagePayment" ADD CONSTRAINT "WagePayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "FinancialTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  ]) {
    await db.$executeRawUnsafe(fk).catch(() => undefined);
  }
  wageDdlDone = true;
}

function isMissingTableErr(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /WagePayment|does not exist|P2021|no such table/i.test(msg);
}

// ═══════════════════════════════════════════════════════════
// حساب أجور الفترة — من ساعات العمل الفعلية فقط
// ═══════════════════════════════════════════════════════════
interface WorkerWageRow {
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
  payments: Array<{ id: string; amount: number; method: string; paidAt: string; note: string | null; periodLabel: string; transactionId: string | null; legacy?: boolean }>;
}

async function computeWages(clubId: string, from: string, to: string) {
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

  // تسديدات الأجور المرتبطة بنفس الفترة
  const wagePayments = await db.wagePayment.findMany({
    where: { clubId, periodStart: start, periodEnd: end },
    orderBy: { paidAt: "desc" },
  });

  // دفعات salary قديمة (قبل نظام WagePayment) المؤرخة داخل الفترة — تُحتسب مدفوعاً
  const legacySalary = await db.payment.findMany({
    where: { clubId, category: "salary", date: { gte: start, lte: end } },
    select: { id: true, userId: true, amount: true, date: true, note: true },
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
    const wpPaid = wpRows.reduce((s, p) => s + p.amount, 0);
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
        })),
        ...legacySalary.filter((p) => p.userId === u.id).map((p) => ({
          id: p.id, amount: p.amount, method: "cash", paidAt: p.date.toISOString(),
          note: p.note || "تسديد أجر (سجل قديم)", periodLabel: "—", transactionId: null, legacy: true,
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

// صلاحية الوصول للقراءة: من يدير/يراقب العمل والمال
function hasWageAccess(role: string): boolean {
  return ["admin", "superadmin", "assistant", "accountant"].includes(role);
}

// ═══════════════════════════════════════════════════════════
// GET — حساب الأجور
// ═══════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasWageAccess(currentUser.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const url = new URL(req.url);
    const month = url.searchParams.get("month");
    let from = url.searchParams.get("from");
    let to = url.searchParams.get("to");

    if ((!from || !to) && month) {
      const [y, m] = month.split("-").map(Number);
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      from = `${month}-01`;
      to = `${month}-${String(last).padStart(2, "0")}`;
    }
    if (!from || !to) {
      const now = new Date();
      const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
      const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
      from = `${ym}-01`;
      to = `${ym}-${String(last).padStart(2, "0")}`;
    }

    if (!currentUser.clubId) return NextResponse.json({ error: "النادي غير محدد" }, { status: 400 });

    const { workers, totals } = await computeWages(currentUser.clubId, from, to);
    return NextResponse.json({
      period: { from, to, label: wagePeriodLabel(from, to) },
      workers,
      totals,
    });
  } catch (e) {
    if (isMissingTableErr(e)) {
      try { await ensureWageTable(); return NextResponse.json({ retry: true }, { status: 503 }); } catch { /* fallthrough */ }
    }
    console.error("GET wages:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════
// POST — تسديد أجر (قيد مالي واحد + WagePayment مرتبط 1:1)
// ═══════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    // ★ صلاحية مالية حساسة: admin/superadmin فقط (تتحقق في الخادم لا في الواجهة)
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح — تسديد الأجور للمدير فقط" }, { status: 403 });
    }
    if (!currentUser.clubId) return NextResponse.json({ error: "النادي غير محدد" }, { status: 400 });
    const clubId = currentUser.clubId;

    const body = await req.json();
    const { userId, from, to, amount, method, paidAt, note, source } = body;

    if (!userId || !from || !to || !amount) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    const amountNum = Math.round(Number(amount));
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: "المبلغ يجب أن يكون رقماً موجباً" }, { status: 400 });
    }

    // العامل
    const worker = await db.user.findFirst({
      where: { id: userId, clubId },
      select: { id: true, name: true },
    });
    if (!worker) return NextResponse.json({ error: "العامل غير موجود" }, { status: 404 });

    // الحساب الفعلي من Pointage — الحماية من الدفع الزائد تُحسب من المصدر
    const { workers } = await computeWages(clubId, from, to);
    const row = workers.find((w) => w.userId === userId);
    const remaining = row?.remaining ?? 0;
    if (amountNum > remaining) {
      return NextResponse.json(
        { error: `المبلغ أكبر من المتبقي (${remaining} دج) — لا يمكن تسديد أكثر من المستحق` },
        { status: 400 }
      );
    }

    const { start, end } = utcRange(from, to);
    const paidAtDate = paidAt ? parseWallDateTime(String(paidAt).slice(0, 10), "12:00") : new Date();
    const wageMethod = ["cash", "bank", "cheque"].includes(method) ? method : "cash";
    const src = source === "financial-hub" ? "المركز المالي" : "صفحة ساعات العمل";
    const label = wagePeriodLabel(from, to);

    // ★ ذرّية كاملة: WagePayment + القيد المالي + الرصيد + التدقيق في معاملة واحدة
    const result = await db.$transaction(async (tx) => {
      // 1) سجل التسديد (transactionId اختياري — يُربط بعد إنشاء القيد)
      const wp = await tx.wagePayment.create({
        data: {
          clubId,
          userId,
          periodStart: start,
          periodEnd: end,
          periodLabel: label,
          hours: row?.totalHours ?? 0,
          hourRate: row?.hourRate ?? 0,
          grossAmount: row?.gross ?? 0,
          prevPaid: row?.paid ?? 0,
          amount: amountNum,
          method: wageMethod,
          paidAt: paidAtDate,
          note: note?.trim() || null,
          createdById: currentUser.id,
        },
      });

      // 2) القيد المالي الوحيد — مرجع wage:{id} يستحيل معه ازدواج
      const ledger = await tx.financialTransaction.create({
        data: {
          clubId,
          type: "expense",
          category: "wages",
          amount: amountNum,
          date: paidAtDate,
          paymentMethod: wageMethod,
          payeeName: worker.name,
          payeeId: userId,
          reference: `wage:${wp.id}`,
          note: `تسديد أجر — الفترة ${label}${note?.trim() ? ` • ${note.trim()}` : ""}`,
          createdById: currentUser.id,
        },
      });

      // 3) الربط 1:1 (قيد UNIQUE على transactionId يمنع التكرار في قاعدة البيانات نفسها)
      await tx.wagePayment.update({ where: { id: wp.id }, data: { transactionId: ledger.id } });

      // 4) الرصيد اللحظي
      await applyBalanceDelta(tx, clubId, "expense", "wages", amountNum);

      // 5) سجل التدقيق (لا يعطّل العملية المالية إذا فشل)
      await tx.auditLog.create({
        data: {
          clubId,
          userId: currentUser.id,
          action: "wage_payment_create",
          entityType: "WagePayment",
          entityId: wp.id,
          description: `تسديد أجر ${amountNum} دج للعامل ${worker.name} — الفترة ${label} — من ${src}`,
          metadata: JSON.stringify({ amount: amountNum, period: label, method: wageMethod, transactionId: ledger.id, source: src }),
        },
      }).catch(() => undefined);

      return { wagePaymentId: wp.id, transactionId: ledger.id };
    });

    return NextResponse.json({ success: true, ...result, message: "تم تسديد الأجر — القيد مرتبط 1:1 ولا يمكن تكراره" }, { status: 201 });
  } catch (e) {
    if (isMissingTableErr(e)) {
      try { await ensureWageTable(); return NextResponse.json({ retry: true }, { status: 503 }); } catch { /* fallthrough */ }
    }
    console.error("POST wages:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal" }, { status: 500 });
  }
}

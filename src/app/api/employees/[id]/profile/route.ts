import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { computeWages } from "@/lib/wage-core";
import { ensureRuntimeColumns } from "@/lib/runtime-schema";

/**
 * GET /api/employees/[id]/profile — ملف الموظف الكامل (المرحلة 5 — §29)
 * ═══════════════════════════════════════════════════════════════════════
 * يعرض في حوار واحد:
 *   المعلومات الشخصية • العقود • حصص المسبح المعيَّنة • ساعات العمل
 *   الساعات المعتمدة • الأجور الشهرية (آخر 6 أشهر من wage-core) • التسديدات
 *   التسديدات الملغاة • القيود المالية (wage:*)
 *
 * صلاحية العرض: admin/superadmin/assistant/accountant
 */

function hasEmployeesView(role: string): boolean {
  return ["admin", "superadmin", "assistant", "accountant"].includes(role);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureRuntimeColumns();
    const user = await getCurrentUser();
    if (!user || !user.clubId || !hasEmployeesView(user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const clubId = user.clubId;
    const { id } = await params;

    const employee = await db.employee.findFirst({
      where: { id, clubId },
      include: { user: { select: { id: true, name: true, email: true, phone: true, role: true } } },
    });
    if (!employee) return NextResponse.json({ error: "العامل غير موجود" }, { status: 404 });

    const now = new Date();

    // العقود
    const contracts = await db.employmentContract.findMany({
      where: { clubId, employeeId: id },
      orderBy: { startDate: "desc" },
      select: {
        id: true, contractNumber: true, contractType: true, title: true, position: true,
        startDate: true, endDate: true, hourRate: true, monthlySalary: true, weeklyHours: true,
        status: true, terminatedAt: true, terminatedReason: true, version: true, createdAt: true,
      },
    });

    // ساعات العمل — آخر 100 سجل + إجمالي الساعات المعتمدة (كل التاريخ)
    const [recentWorkHours, approvedAgg, assignments] = await Promise.all([
      db.workHours.findMany({
        where: { clubId, userId: employee.userId ?? "__none__" },
        orderBy: [{ date: "desc" }, { startTime: "desc" }],
        take: 100,
        select: {
          id: true, date: true, startTime: true, endTime: true, status: true,
          rateSnapshot: true, rejectionReason: true, note: true,
        },
      }),
      db.workHours.aggregate({
        where: { clubId, userId: employee.userId ?? "__none__", status: "approved" },
        _count: { id: true },
      }),
      employee.userId
        ? db.guardAssignment.findMany({
            where: { clubId, userId: employee.userId, isActive: true },
            select: { id: true, dayOfWeek: true, timeSlot: true, slotId: true, assignmentType: true, isActive: true },
            take: 30,
          })
        : Promise.resolve([]),
    ]);

    // إجمالي الساعات المعتمدة (من اللقطات، بخصم الاستراحات من note JSON)
    let approvedHoursTotal = 0;
    const approvedRecords = await db.workHours.findMany({
      where: { clubId, userId: employee.userId ?? "__none__", status: "approved" },
      select: { startTime: true, endTime: true, note: true },
    });
    for (const r of approvedRecords) {
      let breakMinutes = 0;
      try {
        if (r.note && r.note.startsWith("{")) {
          const meta = JSON.parse(r.note);
          breakMinutes = meta.breakMinutes || 0;
        }
      } catch {}
      let end = new Date(r.endTime).getTime();
      const start = new Date(r.startTime).getTime();
      if (end <= start) end += 86_400_000;
      approvedHoursTotal += Math.max(0, (end - start) / 3600000 - breakMinutes / 60);
    }

    // الأجور — آخر 6 أشهر من wage-core (نفس مصدر صفحة الأجور — رقم واحد)
    const months: Array<{ from: string; to: string; label: string; hours: number; rate: number; gross: number; paid: number; remaining: number; status: string }> = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      const from = `${ym}-01`;
      const to = `${ym}-${String(last).padStart(2, "0")}`;
      const { workers } = await computeWages(clubId, from, to);
      const row = workers.find((w) => w.userId === employee.userId);
      if (row) {
        months.push({
          from, to, label: ym,
          hours: row.totalHours, rate: row.hourRate, gross: row.gross,
          paid: row.paid, remaining: row.remaining, status: row.status,
        });
      }
    }

    // التسديدات + القيود المالية المرتبطة
    const [payments, transactions] = await Promise.all([
      db.wagePayment.findMany({
        where: { clubId, employeeId: id },
        orderBy: { paidAt: "desc" },
        take: 60,
      }),
      employee.userId
        ? db.financialTransaction.findMany({
            where: { clubId, category: "wages", payeeId: employee.userId },
            orderBy: { date: "desc" },
            take: 60,
            select: {
              id: true, seq: true, type: true, category: true, amount: true, date: true,
              paymentMethod: true, reference: true, note: true, status: true,
              cancelledAt: true, cancellationReason: true, employeeId: true,
            },
          })
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      employee,
      contracts,
      assignments,
      workHours: {
        recent: recentWorkHours,
        approvedCount: approvedAgg._count.id,
        approvedHoursTotal: Math.round(approvedHoursTotal * 100) / 100,
      },
      wagesByMonth: months,
      payments,
      transactions,
    });
  } catch (e) {
    console.error("GET employee profile:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal" }, { status: 500 });
  }
}

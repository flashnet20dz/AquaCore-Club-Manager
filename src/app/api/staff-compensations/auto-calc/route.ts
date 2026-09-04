import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/session";

/**
 * POST /api/staff-compensations/auto-calc
 * Auto-calculate compensation for a guard/worker based on WorkHours records.
 *
 * Input: { employeeId?, userId?, month, year }
 * Output: { workHours, hourRate, baseAmount, guardSessions }
 *
 * Uses:
 *   - WorkHours records for the given month/year
 *   - Employee.hourRate (or default 200)
 *   - GuardAssignment completed sessions (Pointage)
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasPermission(currentUser.role, "staffCompensationsManage")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await req.json();
    const { employeeId, userId, month, year } = body;

    if (!month || !year) {
      return NextResponse.json({ error: "الشهر والسنة مطلوبان" }, { status: 400 });
    }

    const targetUserId = userId;
    if (!targetUserId && !employeeId) {
      return NextResponse.json({ error: "employeeId أو userId مطلوب" }, { status: 400 });
    }

    // Find employee record to get hourRate + position
    let employee: { id: string; userId: string | null; hourRate: number; position: string; firstName: string; lastName: string } | null = null;
    if (employeeId) {
      employee = await db.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, userId: true, hourRate: true, position: true, firstName: true, lastName: true },
      });
    } else if (targetUserId) {
      employee = await db.employee.findFirst({
        where: { userId: targetUserId },
        select: { id: true, userId: true, hourRate: true, position: true, firstName: true, lastName: true },
      });
    }

    const effectiveUserId = targetUserId || employee?.userId;
    const hourRate = employee?.hourRate || 200;
    const position = employee?.position || "guard";
    const personName = employee ? `${employee.firstName} ${employee.lastName}` : "غير محدد";

    if (!effectiveUserId) {
      return NextResponse.json({
        workHours: 0,
        hourRate,
        baseAmount: 0,
        guardSessions: 0,
        personName,
        personPosition: position,
        message: "لا يوجد مستخدم مرتبط — لا يمكن حساب ساعات العمل",
      });
    }

    // ★ Calculate from WorkHours records
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const workHoursRecords = await db.workHours.findMany({
      where: {
        userId: effectiveUserId,
        date: { gte: startDate, lte: endDate },
        status: { in: ["approved", "pending"] },
      },
      select: { startTime: true, endTime: true, note: true, status: true },
    });

    let totalMinutes = 0;
    let totalBreakMinutes = 0;
    for (const wh of workHoursRecords) {
      const start = new Date(wh.startTime);
      const end = new Date(wh.endTime);
      const diffMs = end.getTime() - start.getTime();
      if (diffMs > 0) {
        totalMinutes += Math.floor(diffMs / 60000);
        // Parse break minutes from note JSON
        try {
          if (wh.note && wh.note.startsWith("{")) {
            const meta = JSON.parse(wh.note);
            totalBreakMinutes += meta.breakMinutes || 0;
          }
        } catch { /* ignore */ }
      }
    }

    const netMinutes = Math.max(0, totalMinutes - totalBreakMinutes);
    const workHours = Math.round((netMinutes / 60) * 10) / 10; // one decimal
    const baseAmount = Math.round(workHours * hourRate);

    // ★ Count completed guard sessions (Pointage)
    let guardSessions = 0;
    try {
      guardSessions = await db.guardAssignment.count({
        where: {
          userId: effectiveUserId,
          attendanceStatus: "completed",
          actualStartTime: { gte: startDate, lte: endDate },
        },
      });
    } catch { /* GuardAssignment table may not exist — ignore */ }

    return NextResponse.json({
      workHours,
      hourRate,
      baseAmount,
      guardSessions,
      sessionsCount: workHoursRecords.length,
      personName,
      personPosition: position,
      employeeId: employee?.id || null,
      userId: effectiveUserId,
    });
  } catch (error) {
    console.error("POST /api/staff-compensations/auto-calc error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
  }
}

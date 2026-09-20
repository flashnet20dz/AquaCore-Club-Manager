/**
 * /api/wages/receipt — بيانات «وصل استلام مستحقات مالية» لتسديد أجور العمال
 * ═════════════════════════════════════════════════════════════
 * GET ?id=<WagePayment.id>            → وصل تسديد جديد
 * GET ?id=<Payment.id>&legacy=1       → وصل لسجل تسديد قديم (category=salary)
 *
 * يعيد: بيانات الدفعة + معلومات العامل الشخصية (الاسم، الوظيفة، رقم بطاقة
 * التعريف الوطنية) + اسم النادي ومدينته + رقم الوصل التسلسلي.
 * الصلاحية: نفس من يقرأ الأجور (admin/superadmin/assistant/accountant).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

function hasWageAccess(role: string): boolean {
  return ["admin", "superadmin", "assistant", "accountant"].includes(role);
}

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasWageAccess(currentUser.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const clubId = currentUser.clubId;
    if (!clubId) return NextResponse.json({ error: "النادي غير محدد" }, { status: 400 });

    const url = new URL(req.url);
    const id = url.searchParams.get("id") || "";
    const legacy = url.searchParams.get("legacy") === "1";
    if (!id) return NextResponse.json({ error: "معرّف التسديد مفقود" }, { status: 400 });

    const club = await db.club.findUnique({
      where: { id: clubId },
      select: { name: true, city: true },
    });
    if (!club) return NextResponse.json({ error: "النادي غير موجود" }, { status: 404 });

    // ═══ سجل قديم (Payment category=salary) — بيانات محدودة ═══
    if (legacy) {
      const p = await db.payment.findFirst({
        where: { id, clubId, category: "salary" },
        include: { user: { select: { name: true } } },
      });
      if (!p) return NextResponse.json({ error: "سجل التسديد غير موجود" }, { status: 404 });

      return NextResponse.json({
        legacy: true,
        payment: {
          id: p.id,
          amount: p.amount,
          method: p.method || "cash",
          paidAt: (p.date ?? p.createdAt).toISOString(),
          note: p.note ?? null,
          periodLabel: "سجل قديم",
          hours: null,
          hourRate: null,
          grossAmount: null,
          prevPaid: null,
          financialNumber: null,
          receiptNo: null,
        },
        worker: {
          name: p.user?.name || "—",
          jobTitle: null,
          nationalId: null,
        },
        club,
      });
    }

    // ═══ تسديد جديد (WagePayment) ═══
    const wp = await db.wagePayment.findFirst({
      where: { id, clubId },
      include: {
        user: { select: { name: true } },
        transaction: { select: { seq: true, createdAt: true } },
      },
    });
    if (!wp) return NextResponse.json({ error: "سجل التسديد غير موجود" }, { status: 404 });

    // رقم العملية المالي المقروء: FIN-YYYY-NNNNNN (نفس تنسيق postLedgerEntry)
    const finNumber =
      wp.transaction?.seq != null
        ? `FIN-${wp.transaction.createdAt.getUTCFullYear()}-${String(wp.transaction.seq).padStart(6, "0")}`
        : null;

    // معلومات العامل الشخصية — من سجل الموظف المرتبط (employeeId أو userId)
    const employee = await db.employee.findFirst({
      where: {
        clubId,
        OR: [
          ...(wp.employeeId ? [{ id: wp.employeeId }] : []),
          { userId: wp.userId },
        ],
      },
      select: { firstName: true, lastName: true, nationalId: true, position: true },
    });

    // رقم الوصل التسلسلي: ترتيب زمني للتسديدات النشطة داخل سنة الوصل
    const paidAt = wp.paidAt;
    const year = paidAt.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const seq = (await db.wagePayment.count({
      where: {
        clubId,
        status: "active",
        createdAt: { lte: paidAt },
        OR: [
          { paidAt: { gte: yearStart } },
          { createdAt: { gte: yearStart } },
        ],
      },
    })) || 1;

    const POSITION_LABELS: Record<string, string> = {
      guard: "حارس سباحة",
      coach: "مدرب",
      admin: "إدارة",
      maintenance: "صيانة",
      cleaner: "نظافة",
      seasonal: "موسمي",
      other: "أخرى",
    };

    return NextResponse.json({
      legacy: false,
      payment: {
        id: wp.id,
        amount: wp.amount,
        method: wp.method,
        paidAt: wp.paidAt.toISOString(),
        note: wp.note ?? null,
        periodLabel: wp.periodLabel,
        hours: wp.hours || null,
        hourRate: wp.hourRate || null,
        grossAmount: wp.grossAmount || null,
        prevPaid: wp.prevPaid || null,
        financialNumber: finNumber,
        receiptNo: `${seq}/${year}`,
      },
      worker: {
        name: wp.user?.name || [employee?.lastName, employee?.firstName].filter(Boolean).join(" ") || "—",
        jobTitle: employee?.position ? (POSITION_LABELS[employee.position] || employee.position) : null,
        nationalId: employee?.nationalId ?? null,
      },
      club,
    });
  } catch (e) {
    console.error("GET wages/receipt:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal" }, { status: 500 });
  }
}

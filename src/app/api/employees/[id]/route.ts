import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * /api/employees/[id] — تعديل/أرشفة موظف (المرحلة 5 — §3/§35)
 * ─────────────────────────────────────────────────────────────────
 * PATCH  — تعديل بحقول مضبوطة + تدقيق (oldValue → newValue)
 * DELETE — أرشفة ناعمة (status=ARCHIVED + active=false) — لا حذف فعلي أبداً
 *          (§3: لا تحذف أي بيانات قديمة) — استثناء: موظف بلا عقود ولا ساعات
 *          ولا تعويضات ولا تسديدات يُحذف فعلياً (بيانات وهمية مكتملة الأهلية).
 */

const EMPLOYEE_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "ARCHIVED"] as const;
const POSITIONS = ["guard", "coach", "admin", "maintenance", "cleaner", "seasonal", "other"] as const;

function normalizeStatus(raw: unknown): { status: string; active: boolean } {
  const s = typeof raw === "string" ? raw.toUpperCase() : "ACTIVE";
  const status = (EMPLOYEE_STATUSES as readonly string[]).includes(s) ? s : "ACTIVE";
  return { status, active: status === "ACTIVE" };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const clubId = user.clubId!;
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const existing = await db.employee.findFirst({ where: { id, clubId } });
    if (!existing) return NextResponse.json({ error: "العامل غير موجود" }, { status: 404 });

    // ★ بناء التحديث من حقول مضبوطة فقط — active يُزامن مع status دائماً
    const data: Record<string, unknown> = {};
    if (typeof body.firstName === "string" && body.firstName.trim()) data.firstName = body.firstName.trim();
    if (typeof body.lastName === "string" && body.lastName.trim()) data.lastName = body.lastName.trim();
    if ("phone" in body) data.phone = body.phone ? String(body.phone).trim() : null;
    if ("email" in body) data.email = body.email ? String(body.email).trim() : null;
    if ("firstNameFr" in body) data.firstNameFr = body.firstNameFr ? String(body.firstNameFr).trim() : null;
    if ("lastNameFr" in body) data.lastNameFr = body.lastNameFr ? String(body.lastNameFr).trim() : null;
    if ("address" in body) data.address = body.address ? String(body.address).trim() : null;
    if ("birthPlace" in body) data.birthPlace = body.birthPlace ? String(body.birthPlace).trim() : null;
    if ("nationalId" in body) data.nationalId = body.nationalId ? String(body.nationalId).trim() : null;
    if ("birthDate" in body) data.birthDate = body.birthDate ? new Date(body.birthDate) : null;
    if ("hireDate" in body) data.hireDate = body.hireDate ? new Date(body.hireDate) : existing.hireDate;
    if (body.position && (POSITIONS as readonly string[]).includes(body.position)) data.position = body.position;
    if (body.hourRate !== undefined) data.hourRate = Math.max(0, Math.round(Number(body.hourRate) || 0));
    if ("userId" in body) data.userId = typeof body.userId === "string" && body.userId ? body.userId : null;
    if ("status" in body) {
      const { status, active } = normalizeStatus(body.status);
      data.status = status;
      data.active = active;
    }

    const employee = await db.employee.update({ where: { id }, data });

    await db.auditLog.create({
      data: {
        clubId,
        userId: user.id,
        action: "employee_update",
        entityType: "Employee",
        entityId: id,
        description: `تعديل موظف: ${employee.lastName} ${employee.firstName}`,
        metadata: JSON.stringify({
          oldValue: {
            firstName: existing.firstName, lastName: existing.lastName, position: existing.position,
            hourRate: existing.hourRate, status: existing.status, phone: existing.phone,
          },
          newValue: {
            firstName: employee.firstName, lastName: employee.lastName, position: employee.position,
            hourRate: employee.hourRate, status: employee.status, phone: employee.phone,
          },
        }),
      },
    }).catch(() => undefined);

    return NextResponse.json({ employee });
  } catch (e) {
    console.error("PATCH employee:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const clubId = user.clubId!;
    const { id } = await params;

    const existing = await db.employee.findFirst({ where: { id, clubId } });
    if (!existing) return NextResponse.json({ error: "العامل غير موجود" }, { status: 404 });

    // ★ §3: لا حذف لبيانات مرتبطة — العقود/الساعات/التعويضات تبقى
    const [contracts, workHours, compensations, wagePayments] = await Promise.all([
      db.employmentContract.count({ where: { employeeId: id } }),
      db.workHours.count({ where: { clubId, userId: existing.userId ?? "__none__" } }),
      db.staffCompensation.count({ where: { employeeId: id } }),
      db.wagePayment.count({ where: { clubId, employeeId: id } }),
    ]);

    // ★ التدقيق النهائي: لا حذف فعلي أبداً — الأرشفة دائماً (status=ARCHIVED)
    // حتى بلا بيانات مرتبطة: هوية العامل وسجل توظيفه يبقى محفوظاً للتاريخ والتدقيق
    const employee = await db.employee.update({
      where: { id },
      data: { status: "ARCHIVED", active: false },
    });
    await db.auditLog.create({
      data: {
        clubId,
        userId: user.id,
        action: "employee_archive",
        entityType: "Employee",
        entityId: id,
        description: `أرشفة موظف: ${employee.lastName} ${employee.firstName} (السجل محفوظ — ${contracts} عقد / ${workHours} ساعة / ${compensations} تعويض / ${wagePayments} تسديد)`,
        metadata: JSON.stringify({ contracts, workHours, compensations, wagePayments, oldValue: { position: existing.position, hourRate: existing.hourRate, status: existing.status } }),
      },
    }).catch(() => undefined);
    return NextResponse.json({ success: true, archived: true, message: "تمت الأرشفة — السجل محفوظ في الأرشيف" });
  } catch (e) {
    console.error("DELETE employee:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal" }, { status: 500 });
  }
}

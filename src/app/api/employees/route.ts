import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * /api/employees — إدارة العمال (المرحلة 5 — §3)
 * ─────────────────────────────────────────────────────────────────
 * GET   ?status=&position=&q=   — قائمة العمال (server-side filtering §42)
 * POST  { firstName, lastName, phone, email, firstNameFr, lastNameFr,
 *         address, birthDate, birthPlace, nationalId, position,
 *         hourRate, hireDate, status, userId? }
 *   → إنشاء موظف بحقول مضبوطة (whitelist) + مزامنة active مع status + تدقيق
 *
 * الحالة: ACTIVE / INACTIVE / SUSPENDED / ARCHIVED — active (قديم) يبقى مزامَناً.
 */

const EMPLOYEE_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "ARCHIVED"] as const;
const POSITIONS = ["guard", "coach", "admin", "maintenance", "cleaner", "seasonal", "other"] as const;

// من يرى قائمة العمال: إدارة + محاسبة (المساعد يرى أيضاً للعمل الإداري)
function hasEmployeesView(role: string): boolean {
  return ["admin", "superadmin", "assistant", "accountant"].includes(role);
}

/** تطبيع حالة الموظف + مزامنة active القديم (§3 التوافق) */
function normalizeStatus(raw: unknown): { status: string; active: boolean } {
  const s = typeof raw === "string" ? raw.toUpperCase() : "ACTIVE";
  const status = (EMPLOYEE_STATUSES as readonly string[]).includes(s) ? s : "ACTIVE";
  return { status, active: status === "ACTIVE" };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.clubId || !hasEmployeesView(user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const position = url.searchParams.get("position");
    const q = (url.searchParams.get("q") || "").trim();

    const where: Record<string, unknown> = { clubId: user.clubId };
    if (status && status !== "all") where.status = status.toUpperCase();
    if (position && position !== "all") where.position = position;
    if (q) {
      where.OR = [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { phone: { contains: q } },
        { nationalId: { contains: q } },
      ];
    }

    const employees = await db.employee.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, role: true } },
        contracts: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ employees });
  } catch (e) {
    console.error("GET employees:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const clubId = user.clubId!;
    const body = await req.json().catch(() => ({}));

    // ★ حقول مضبوطة — لا spread مباشر من الطلب (سلامة البيانات)
    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    if (!firstName || !lastName) {
      return NextResponse.json({ error: "الاسم والأسم مطلوبان" }, { status: 400 });
    }
    const position = (POSITIONS as readonly string[]).includes(body.position) ? body.position : "other";
    const { status, active } = normalizeStatus(body.status);
    const hourRate = Math.max(0, Math.round(Number(body.hourRate) || 0)) || 200;

    const employee = await db.employee.create({
      data: {
        clubId,
        userId: typeof body.userId === "string" && body.userId ? body.userId : null,
        firstName,
        lastName,
        phone: body.phone ? String(body.phone).trim() : null,
        email: body.email ? String(body.email).trim() : null,
        firstNameFr: body.firstNameFr ? String(body.firstNameFr).trim() : null,
        lastNameFr: body.lastNameFr ? String(body.lastNameFr).trim() : null,
        address: body.address ? String(body.address).trim() : null,
        birthDate: body.birthDate ? new Date(body.birthDate) : null,
        birthPlace: body.birthPlace ? String(body.birthPlace).trim() : null,
        nationalId: body.nationalId ? String(body.nationalId).trim() : null,
        position,
        hourRate,
        hireDate: body.hireDate ? new Date(body.hireDate) : new Date(),
        status,
        active,
      },
    });

    await db.auditLog.create({
      data: {
        clubId,
        userId: user.id,
        action: "employee_create",
        entityType: "Employee",
        entityId: employee.id,
        description: `إنشاء موظف: ${lastName} ${firstName} (${position})`,
        metadata: JSON.stringify({ newValue: { position, hourRate, status } }),
      },
    }).catch(() => undefined);

    return NextResponse.json({ employee }, { status: 201 });
  } catch (e) {
    console.error("POST employee:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal" }, { status: 500 });
  }
}

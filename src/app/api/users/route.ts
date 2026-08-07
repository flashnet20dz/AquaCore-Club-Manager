import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    // 🔑 جلب كل العمال (Users) + Employees
    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };

    const users = await db.user.findMany({
      where: { role: { not: "superadmin" }, ...clubFilter },
      select: { id: true, email: true, name: true, role: true, phone: true, active: true, pending: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // 🔑 جلب Employees (فيهم hourRate و position)
    const employees = await db.employee.findMany({
      where: clubFilter,
      select: { id: true, userId: true, position: true, hourRate: true, firstName: true, lastName: true },
    });

    // 🔑 دمج: لكل User، ابحث عن Employee المرتبط به
    const empMap = new Map(employees.map((e) => [e.userId, e]));
    const enriched = users.map((u) => {
      const emp = empMap.get(u.id);
      return {
        ...u,
        position: emp?.position || null,
        hourlyRate: emp?.hourRate || 0,
        employeeId: emp?.id || null,
      };
    });

    return NextResponse.json({ users: enriched });
  } catch (e) {
    console.error("GET users:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { name, email, password, role, phone } = await req.json();

    // Check if email already exists
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "البريد الإلكتروني مستخدم بالفعل" }, { status: 400 });
    }

    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await db.user.create({
      data: {
        email,
        name,
        passwordHash,
        role,
        phone: phone || null,
        pending: false,
        clubId: currentUser.clubId,
      },
      select: { id: true, email: true, name: true, role: true, phone: true, active: true, pending: true, createdAt: true },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (e) {
    console.error("POST user:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

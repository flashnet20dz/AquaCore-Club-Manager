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

    // ★ Superadmin يرى كل المستخدمين بما فيهم حساب المدير العام (superadmin)
    // غير السوبر أدمن لا يرى حسابات السوبر أدمن (تجنّب الصلاحيات)
    const roleFilter = currentUser.role === "superadmin"
      ? {}  // لا فلترة — يشمل superadmin
      : { role: { not: "superadmin" } };  // يستثني superadmin

    const users = await db.user.findMany({
      where: { ...clubFilter, ...roleFilter },
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

    const { name, email, password, role, phone, clubId: requestedClubId } = await req.json();

    // 🔒 قائمة أدوار مسموحة — مطابقة لـ users/[id]/route.ts.
    // سابقاً كان الدور يُمرّر خاماً من الجسم، فاستطاع admin إنشاء superadmin.
    const VALID_ROLES = ["admin", "accountant", "assistant", "lifeguard", "observer"];
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "دور غير صالح" }, { status: 400 });
    }

    // 🔒 تحقق من صحة المدخلات
    if (
      !name || !email ||
      typeof password !== "string" || password.length < 8 ||
      typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        { error: "الاسم والبريد صالحان مطلوبان، وكلمة السر 8 محارف على الأقل" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists
    const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: "البريد الإلكتروني مستخدم بالفعل" }, { status: 400 });
    }

    // 🔒 النادي: admin مقيّد بناديه دائماً؛ superadmin فقط قد يحدد نادياً صراحةً
    const targetClubId = currentUser.role === "superadmin"
      ? (requestedClubId || currentUser.clubId)
      : currentUser.clubId;

    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await db.user.create({
      data: {
        email: normalizedEmail,
        name,
        passwordHash,
        role,
        phone: phone || null,
        pending: false,
        clubId: targetClubId,
      },
      select: { id: true, email: true, name: true, role: true, phone: true, active: true, pending: true, createdAt: true },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (e) {
    console.error("POST user:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

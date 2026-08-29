import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, role, phone, active, pending, password, hourlyRate, position } = body;

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const existing = await db.user.findFirst({ where: { id, ...clubFilter } });
    if (!existing) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }

    // 🔑 تحديث بيانات User
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (role !== undefined) {
      // ★ حماية دور السوبر أدمن: لا يمكن تخفيضه
      // إذا كان المستخدم الحالي superadmin، يُسمح بتحديث الأدوار الأخرى فقط
      const validRoles = ["admin", "accountant", "assistant", "lifeguard", "observer"];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: "دور غير صالح" }, { status: 400 });
      }
      // ★ لا يمكن تغيير دور superadmin إلى دور آخر (حماية المدير العام)
      if (existing.role === "superadmin" && role !== "superadmin") {
        return NextResponse.json({
          error: "لا يمكن تغيير دور المدير العام (superadmin) إلى دور آخر",
        }, { status: 400 });
      }
      data.role = role;
    }
    if (phone !== undefined) data.phone = phone || null;
    if (active !== undefined) data.active = active;
    if (pending !== undefined) data.pending = pending;
    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }, { status: 400 });
      }
      const bcrypt = await import("bcryptjs");
      data.passwordHash = await bcrypt.hash(password, 10);
    }

    const user = await db.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, phone: true, active: true, pending: true, createdAt: true },
    });

    // 🔑 تحديث/إنشاء Employee لربط hourlyRate و position
    if (hourlyRate !== undefined || position !== undefined) {
      const emp = await db.employee.findFirst({ where: { userId: id } });
      if (emp) {
        const empData: Record<string, unknown> = {};
        if (hourlyRate !== undefined) empData.hourRate = hourlyRate;
        if (position !== undefined) empData.position = position;
        await db.employee.update({ where: { id: emp.id }, data: empData });
      } else {
        // إنشاء Employee جديد مرتبط بهذا المستخدم
        await db.employee.create({
          data: {
            clubId: existing.clubId!,
            userId: id,
            firstName: existing.name.split(" ")[0] || existing.name,
            lastName: existing.name.split(" ").slice(1).join(" ") || "—",
            position: position || (role || "lifeguard"),
            hourRate: hourlyRate || 0,
          },
        });
      }
    }

    return NextResponse.json({ user });
  } catch (e) {
    console.error("PUT user:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    if (id === currentUser.id) {
      return NextResponse.json({ error: "لا يمكن حذف حسابك الحالي" }, { status: 400 });
    }

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const existing = await db.user.findFirst({ where: { id, ...clubFilter } });
    if (!existing) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }

    await db.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE user:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

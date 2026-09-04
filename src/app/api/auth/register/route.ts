import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name, phone } = body;

    if (!email || !password || !name) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return NextResponse.json({ error: "هذا البريد مسجل بالفعل" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userCount = await db.user.count();
    const isFirstUser = userCount === 0;
    const role = isFirstUser ? "admin" : "lifeguard";
    const pending = !isFirstUser;

    const user = await db.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name,
        passwordHash,
        phone: phone || null,
        role,
        pending,
      },
    });

    if (pending) {
      const admins = await db.user.findMany({ where: { role: "admin", active: true } });
      for (const admin of admins) {
        await db.notification.create({
          data: {
            userId: admin.id,
            type: "system",
            title: "طلب تسجيل حساب جديد",
            message: `${name} (${email}) طلب إنشاء حساب جديد بانتظار الموافقة`,
            link: "/?tab=users",
          },
        });
      }
    }

    if (!pending) {
      const sessionUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
      };
      const token = await createSession(sessionUser);
      await setSessionCookie(token);

      return NextResponse.json({
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        autoLogin: true,
      }, { status: 201 });
    }

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      autoLogin: false,
      pending: true,
      message: "تم إنشاء حسابك بنجاح! حسابك بانتظار موافقة المدير.",
    }, { status: 201 });
  } catch (e) {
    console.error("Register error:", e);
    return NextResponse.json({ error: "خطأ داخلي" }, { status: 500 });
  }
}

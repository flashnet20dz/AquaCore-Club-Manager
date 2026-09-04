import { NextRequest, NextResponse } from "next/server";
import {
  verifyCredentials,
  createSession,
  setSessionCookie,
  setClubHintCookie,
  ensureDefaultAdmin,
  ensureDefaultSettings,
  cleanupExpiredSessions,
} from "@/lib/session";
import { db } from "@/lib/db";
import { rateLimit, incrementRateLimit, resetRateLimit, getClientIp } from "@/lib/rate-limit";
import { auditLogWithRequest } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "البريد وكلمة المرور مطلوبان" }, { status: 400 });
    }

    // 🔒 Rate limiting: 10 محاولات لكل IP كل 15 دقيقة، ثم قفل 30 دقيقة
    const clientIp = getClientIp(req);
    const rateLimitKey = `login:${clientIp}`;
    const rlOptions = { max: 10, windowMs: 15 * 60 * 1000, lockoutMs: 30 * 60 * 1000 };
    const rl = rateLimit(rateLimitKey, rlOptions);

    if (rl.blocked) {
      const waitMin = rl.lockoutRemaining ? Math.ceil(rl.lockoutRemaining / 60) : 15;
      return NextResponse.json({
        error: `تم تجاوز عدد محاولات الدخول. انتظر ${waitMin} دقيقة.`,
      }, { status: 429, headers: { "Retry-After": String(rl.lockoutRemaining || 900) } });
    }

    // Self-healing: try to ensure admin + settings exist. If tables don't exist yet
    // (fresh database), trigger /api/setup first via a fetch.
    try {
      await ensureDefaultAdmin();
      await ensureDefaultSettings();
    } catch (e) {
      console.error("ensureDefaultAdmin failed, running setup:", e);
      // Trigger setup
      try {
        const setupRes = await fetch(`${req.nextUrl.origin}/api/setup`, { cache: "no-store" });
        if (setupRes.ok) {
          await ensureDefaultAdmin();
          await ensureDefaultSettings();
        }
      } catch (setupErr) {
        console.error("Setup auto-trigger failed:", setupErr);
      }
    }

    // Cleanup expired sessions (best effort)
    cleanupExpiredSessions().catch(() => {});

    const userCheck = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (userCheck?.pending) {
      return NextResponse.json({
        error: "حسابك بانتظار موافقة المدير. يرجى المحاولة لاحقاً.",
      }, { status: 403 });
    }
    if (userCheck && !userCheck.active) {
      return NextResponse.json({
        error: "حسابك معطّل. تواصل مع المدير.",
      }, { status: 403 });
    }

    const user = await verifyCredentials(email, password);
    if (!user) {
      // 🔒 سجّل المحاولة الفاشلة
      incrementRateLimit(rateLimitKey, rlOptions);
      const remaining = Math.max(0, rl.remaining - 1);
      return NextResponse.json({
        error: `بيانات الدخول غير صحيحة${remaining > 0 ? ` — ${remaining} محاولات متبقية` : ""}`,
      }, { status: 401 });
    }

    // 🔒 نجح الدخول → صفّر العداد
    resetRateLimit(rateLimitKey);

    const token = await createSession(user);
    await setSessionCookie(token);
    if (user.clubId) await setClubHintCookie(user.clubId);

    // 🔒 سجّل الدخول الناجح في سجل التدقيق
    await auditLogWithRequest(req, user, {
      action: "login",
      entityType: "user",
      entityId: user.id,
      description: `تسجيل دخول: ${user.name} (${user.email}) — دور: ${user.role}`,
    });

    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (e) {
    console.error("Login error:", e);
    return NextResponse.json({ error: "خطأ داخلي في الخادم" }, { status: 500 });
  }
}

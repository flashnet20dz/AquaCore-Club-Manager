import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { createSession, setSessionCookie, getCurrentUser, setClubHintCookie, getClubHintCookie } from "@/lib/session";
import { rateLimit, incrementRateLimit, resetRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * POST /api/cashier-pin
 * Body: { pin: "1234" }
 * Authenticates via 4-digit PIN and creates a session.
 * Used for fast tablet cashier login.
 *
 * GET /api/cashier-pin
 * Returns list of PINs (admin only) — never returns the hash.
 *
 * POST /api/cashier-pin (with action=create)
 * Body: { action: "create", pin, label, role }
 * Creates a new PIN (admin only).
 *
 * DELETE /api/cashier-pin/[id]
 * Deletes a PIN (admin only).
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const pins = await db.cashierPin.findMany({
      where: clubFilter,
      select: { id: true, label: true, role: true, active: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ pins });
  } catch (e) {
    console.error("GET cashier-pin:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pin, action, label, role } = body;

    if (!pin || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: "PIN يجب أن يكون 4 أرقام" }, { status: 400 });
    }

    // Action: create new PIN (admin only)
    if (action === "create") {
      const currentUser = await getCurrentUser();
      if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
        return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      }
      const pinHash = await bcrypt.hash(pin, 10);
      const newPin = await db.cashierPin.create({
        data: {
          clubId: currentUser.clubId!,
          pin: pinHash,
          label: label || "كاشير",
          role: role || "assistant",
          active: true,
        },
        select: { id: true, label: true, role: true, active: true, createdAt: true },
      });
      // IMPORTANT: do NOT log the admin out. The admin stays logged in as admin.
      // The PIN login flow is a separate path on /pin page (action: "login", default).
      return NextResponse.json({ pin: newPin });
    }

    // Action: login with PIN
    // 🔒 Rate limiting: 5 محاولات لكل IP كل 15 دقيقة، ثم قفل 30 دقيقة
    const clientIp = getClientIp(req);
    const rateLimitKey = `pin-login:${clientIp}`;
    const rlOptions = { max: 5, windowMs: 15 * 60 * 1000, lockoutMs: 30 * 60 * 1000 };
    const rl = rateLimit(rateLimitKey, rlOptions);

    if (rl.blocked) {
      const waitMin = rl.lockoutRemaining ? Math.ceil(rl.lockoutRemaining / 60) : 15;
      return NextResponse.json({
        error: `تم تجاوز عدد المحاولات المسموحة. انتظر ${waitMin} دقيقة قبل المحاولة مرة أخرى.`,
        retryAfter: rl.lockoutRemaining || 900,
      }, { status: 429, headers: { "Retry-After": String(rl.lockoutRemaining || 900) } });
    }

    // 🔒 عزل كامل بين النوادي: نحصر البحث بنادي هذا الجهاز فقط (كوكي
    // طويل الأمد يُضبط تلقائياً عند أول تسجيل دخول عادي). PIN رقم من 4
    // خانات فقط (10,000 احتمال) — بدون هذا الحصر، تصادم الأكواد بين
    // نوادي مختلفة شبه مؤكد رياضياً بعد ~100 نادي، وممكن يسجّل كاشير
    // نادٍ بحساب نادٍ آخر كلياً. لهذا ما نسمح بفحص شامل غير محصور إطلاقاً،
    // حتى لو أُرسل clubId بالطلب (لا نثق بقيمة يرسلها العميل لهذا الغرض).
    const clubHint = await getClubHintCookie();
    if (!clubHint) {
      return NextResponse.json(
        { error: "أول استخدام لهذا الجهاز: سجّل الدخول كمدير مرة واحدة بالبريد وكلمة السر، بعدها كود PIN يشتغل مباشرة." },
        { status: 428 }
      );
    }
    const pins = await db.cashierPin.findMany({ where: { active: true, clubId: clubHint } });
    if (pins.length === 0) {
      return NextResponse.json({ error: "لا توجد أكواد PIN مفعّلة. سجّل الدخول كمدير لإنشاء واحد." }, { status: 404 });
    }

    type PinRow = { id: string; pin: string; label: string; role: string; clubId: string };
    let matchedPin: PinRow | null = null;
    for (const p of pins) {
      const ok = await bcrypt.compare(pin, p.pin);
      if (ok) { matchedPin = p as PinRow; break; }
    }

    if (!matchedPin) {
      // 🔒 سجّل المحاولة الفاشلة
      incrementRateLimit(rateLimitKey, rlOptions);
      const remaining = Math.max(0, rl.remaining - 1);
      return NextResponse.json({
        error: `PIN غير صحيح${remaining > 0 ? ` — ${remaining} محاولات متبقية` : " — سيتم قفل الحساب مؤقتاً"}`,
      }, { status: 401 });
    }

    // 🔒 نجح الدخول → صفّر العداد
    resetRateLimit(rateLimitKey);

    const fakeUser = {
      id: `pin-${matchedPin.id}`,
      email: `cashier@pin.local`,
      name: matchedPin.label,
      role: matchedPin.role,
      phone: null,
      clubId: matchedPin.clubId,
    };

    const token = await createSession(fakeUser);
    await setSessionCookie(token);
    await setClubHintCookie(matchedPin.clubId);

    return NextResponse.json({ user: fakeUser });
  } catch (e) {
    console.error("POST cashier-pin:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

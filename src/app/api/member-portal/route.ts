/**
 * ═══════════════════════════════════════════════════════════════
 *  API — بوابة المنخرط (توليد روابط البطاقة الرقمية)
 * ═══════════════════════════════════════════════════════════════
 *
 *  POST /api/member-portal   body: { subscriberId }
 *  GET  /api/member-portal?subscriberId=...
 *
 *  كلاهما يتطلب جلسة موظف (getCurrentUser) ويُعيد:
 *    { url: "/member/<token>", token, subscriber: { id, name, fileNumber } }
 *
 *  الرابط محدَّد (deterministic): نفس المنخرط ⟹ نفس الرابط دائماً،
 *  لذا POST و GET متكافئان (idempotent) — انظر src/lib/portal-token.ts
 *
 *  🔒 عزل multi-tenant: يُفرض clubId على كل من ليس superadmin.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { rateLimit, incrementRateLimit, getClientIp } from "@/lib/rate-limit";
import { createPortalToken } from "@/lib/portal-token";
import { getFeatureSettings, isSettingOn } from "@/lib/feature-settings";

/** Rate limit: 30 طلب/دقيقة لكل IP (توليد الروابط إجراء موظفين، لكن نحترس من الإساءة) */
const RL_OPTIONS = { max: 30, windowMs: 60 * 1000 };

async function generatePortalLink(
  subscriberId: string | null,
  clubId: string | null | undefined,
  isSuperadmin: boolean
): Promise<{ ok: true; data: { url: string; token: string; subscriber: { id: string; name: string; fileNumber: string } } } | { ok: false; status: number; error: string }> {
  if (!subscriberId || typeof subscriberId !== "string" || !subscriberId.trim()) {
    return { ok: false, status: 400, error: "معرّف المنخرط (subscriberId) مطلوب" };
  }

  // 🧩 إعداد الميزة: التزامن مع الإعدادات ← الميزات (memberPortalEnabled)
  if (clubId) {
    const feat = await getFeatureSettings(db, clubId);
    if (!isSettingOn(feat.memberPortalEnabled)) {
      return { ok: false, status: 403, error: "بوابة المنخرط معطّلة — فعلها من الإعدادات ← الميزات" };
    }
  }

  // 🔒 عزل حسب النادي — superadmin فقط يرى كل النوادي
  const subscriber = await db.subscriber.findFirst({
    where: {
      id: subscriberId.trim(),
      ...(isSuperadmin ? {} : { clubId: clubId ?? undefined }),
      deletedAt: null,
    },
    select: { id: true, firstName: true, lastName: true, fileNumber: true },
  });

  if (!subscriber) {
    return { ok: false, status: 404, error: "المنخرط غير موجود" };
  }

  const token = createPortalToken(subscriber.id);
  return {
    ok: true,
    data: {
      url: `/member/${token}`,
      token,
      subscriber: {
        id: subscriber.id,
        name: `${subscriber.lastName} ${subscriber.firstName}`,
        fileNumber: subscriber.fileNumber,
      },
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح — يتطلب تسجيل الدخول" }, { status: 401 });
    }

    // 🔒 Rate limiting حسب IP (نفس نمط /api/auth/login)
    const clientIp = getClientIp(req);
    const rlKey = `member-portal:${clientIp}`;
    const rl = rateLimit(rlKey, RL_OPTIONS);
    if (rl.blocked) {
      return NextResponse.json(
        { error: "تم تجاوز الحد المسموح من الطلبات. حاول بعد قليل." },
        { status: 429, headers: { "Retry-After": String(60) } }
      );
    }
    incrementRateLimit(rlKey, RL_OPTIONS);

    let body: { subscriberId?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "صيغة الطلب غير صالحة (JSON مطلوب)" }, { status: 400 });
    }

    const result = await generatePortalLink(
      typeof body.subscriberId === "string" ? body.subscriberId : null,
      currentUser.clubId,
      currentUser.role === "superadmin"
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.data);
  } catch (error) {
    console.error("POST /api/member-portal error:", error);
    return NextResponse.json({ error: "خطأ داخلي في الخادم" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح — يتطلب تسجيل الدخول" }, { status: 401 });
    }

    // 🔒 Rate limiting حسب IP (نفس الحد لكل الطرق)
    const clientIp = getClientIp(req);
    const rlKey = `member-portal:${clientIp}`;
    const rl = rateLimit(rlKey, RL_OPTIONS);
    if (rl.blocked) {
      return NextResponse.json(
        { error: "تم تجاوز الحد المسموح من الطلبات. حاول بعد قليل." },
        { status: 429, headers: { "Retry-After": String(60) } }
      );
    }
    incrementRateLimit(rlKey, RL_OPTIONS);

    const subscriberId = new URL(req.url).searchParams.get("subscriberId");

    // الرابط محدَّد ⟹ (إعادة) التوليد يعطي دائماً نفس الرابط — GET idempotent
    const result = await generatePortalLink(
      subscriberId,
      currentUser.clubId,
      currentUser.role === "superadmin"
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.data);
  } catch (error) {
    console.error("GET /api/member-portal error:", error);
    return NextResponse.json({ error: "خطأ داخلي في الخادم" }, { status: 500 });
  }
}

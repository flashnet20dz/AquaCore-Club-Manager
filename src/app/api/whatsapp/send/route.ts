import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { calculateExpiryDate, getTypeConfig } from "@/lib/rcs";
import { createPortalToken } from "@/lib/portal-token";
import { getFeatureSettings, isSettingOn } from "@/lib/feature-settings";
import {
  isCloudConfigured, normalizeDzPhone, renderTemplate, sendWhatsApp,
} from "@/lib/whatsapp";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * POST /api/whatsapp/send
 * إرسال رسائل واتساب (دفعة أو مفرد) — عبر Meta Cloud API إن ضُبطت الأسرار،
 * وإلا يعيد روابط wa.me جاهزة للفتح اليدوي (وضع بدون أسرار).
 * Body: { subscriberIds: string[], customMessage?: string, includePortal?: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin" && currentUser.role !== "assistant")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const rl = rateLimit(`wa-send:${getClientIp(req)}`, { max: 10, windowMs: 60 * 1000, lockoutMs: 60 * 1000 });
    if (rl.blocked) {
      return NextResponse.json({ error: "طلبات كثيرة — انتظر دقيقة" }, { status: 429 });
    }

    const body = await req.json();
    const subscriberIds: string[] = Array.isArray(body.subscriberIds) ? body.subscriberIds.slice(0, 50) : [];
    const customMessage: string | undefined = typeof body.customMessage === "string" ? body.customMessage : undefined;
    const includePortal: boolean = Boolean(body.includePortal);
    if (subscriberIds.length === 0) {
      return NextResponse.json({ error: "subscriberIds مطلوب (حتى 50)" }, { status: 400 });
    }

    const clubId = currentUser.clubId!;
    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId };

    // 🧩 إعدادات الميزة (تزامن مع الإعدادات ← الميزات):
    //  - whatsappEnabled: مفتاح التبديل العام للإرسال
    //  - memberPortalEnabled: يمنع تضمين رابط البوابة حين تكون البوابة معطلة
    const feat = await getFeatureSettings(db, clubId);
    if (!isSettingOn(feat.whatsappEnabled)) {
      return NextResponse.json({ error: "إشعارات WhatsApp معطّلة — فعلها من الإعدادات ← الميزات ← WhatsApp" }, { status: 403 });
    }
    const portalAllowed = isSettingOn(feat.memberPortalEnabled);

    const clubNameSetting = await db.setting.findFirst({ where: { clubId, key: "clubName" } });
    const clubName = clubNameSetting?.value || "النادي";
    const templateSetting = await db.setting.findFirst({ where: { clubId, key: "whatsappTemplate" } });
    const template = templateSetting?.value || "مرحباً {name}، اشتراكك في {club} ينتهي في {date}. يرجى التجديد. شكراً.";

    const subscribers = await db.subscriber.findMany({
      where: { id: { in: subscriberIds }, ...clubFilter, deletedAt: null },
    });

    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const results: {
      subscriberId: string; name: string; phone: string | null;
      mode?: string; url?: string; providerMessageId?: string; error?: string;
    }[] = [];
    let sent = 0, failed = 0;

    for (const sub of subscribers) {
      const phone = normalizeDzPhone(sub.phone);
      if (!phone) {
        failed++;
        results.push({ subscriberId: sub.id, name: `${sub.lastName} ${sub.firstName}`, phone: null, error: "لا يوجد رقم هاتف صالح" });
        continue;
      }

      const expiry = calculateExpiryDate(sub.lastPaymentDate, getTypeConfig(sub.subscriptionType).durationDays);
      let portalUrl = "";
      if (includePortal && portalAllowed) {
        const token = createPortalToken(sub.id);
        portalUrl = `${origin}/member/${token}`;
      }

      const message = renderTemplate(customMessage || template, {
        name: `${sub.firstName} ${sub.lastName}`,
        date: expiry ? expiry.toISOString().split("T")[0].replace(/-/g, "/") : undefined,
        file: sub.fileNumber,
        club: clubName,
        portal: portalUrl ? `\n🔗 بوابتك الشخصية: ${portalUrl}` : "",
      });

      const result = await sendWhatsApp(phone, message);
      if (result.mode === "skipped") failed++;
      else sent++;

      results.push({
        subscriberId: sub.id,
        name: `${sub.lastName} ${sub.firstName}`,
        phone,
        mode: result.mode,
        url: result.url,
        providerMessageId: result.providerMessageId,
        error: result.error,
      });

      // سجل نشاط غير حاجب
      db.activity.create({
        data: {
          clubId: sub.clubId,
          subscriberId: sub.id,
          type: "whatsapp",
          description: `رسالة واتساب (${result.mode === "cloud" ? "أُرسلت آلياً" : "رابط يدوي"}) إلى ${sub.firstName} ${sub.lastName}`,
        },
      }).catch(() => {});
    }

    return NextResponse.json({
      mode: isCloudConfigured() ? "cloud" : "link",
      sent, failed,
      results,
    });
  } catch (e) {
    console.error("POST whatsapp/send:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

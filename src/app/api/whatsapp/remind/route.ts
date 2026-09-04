import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateExpiryDate, getTypeConfig } from "@/lib/rcs";
import { getCurrentUser } from "@/lib/session";

/**
 * GET /api/whatsapp/remind
 * Returns WhatsApp reminder links for subscribers whose subscription expires within 7 days.
 * Each link uses https://wa.me/<phone>?text=<encoded-message>
 *
 * POST /api/whatsapp/remind
 * Body: { subscriberId }
 * Returns the WhatsApp link for one subscriber (manual trigger).
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const clubId = currentUser.clubId!;

    const whatsappEnabled = await db.setting.findFirst({ where: { clubId, key: "whatsappEnabled" } });
    if (!whatsappEnabled || whatsappEnabled.value !== "true") {
      return NextResponse.json({ reminders: [], enabled: false });
    }

    const templateSetting = await db.setting.findFirst({ where: { clubId, key: "whatsappTemplate" } });
    const template = templateSetting?.value || "مرحباً {name}، اشتراكك في نادي RCS ينتهي في {date}. يرجى التجديد. شكراً.";

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId };
    const subscribers = await db.subscriber.findMany({
      where: {
        ...clubFilter,
        paymentStatus: { not: "لم يدفع" },
        phone: { not: null },
      },
    });

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    type Reminder = {
      subscriberId: string;
      fileNumber: string;
      name: string;
      phone: string;
      expiryDate: Date;
      daysLeft: number;
      url: string;
      message: string;
    };
    const reminders: Reminder[] = [];
    for (const sub of subscribers) {
      // 🔧 المدة من نوع الاشتراك الفعلي بدل الافتراضية 30
      const expiry = calculateExpiryDate(sub.lastPaymentDate, getTypeConfig(sub.subscriptionType).durationDays);
      if (!expiry) continue;
      const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0 || diffDays > 7) continue;

      // Normalize phone: strip leading 0, prefix with 213
      let phone = sub.phone?.replace(/\D/g, "") || "";
      if (phone.startsWith("0")) phone = "213" + phone.slice(1);
      else if (!phone.startsWith("213")) phone = "213" + phone;

      const message = template
        .replace(/{name}/g, `${sub.firstName} ${sub.lastName}`)
        .replace(/{date}/g, expiry.toISOString().split("T")[0].replace(/-/g, "/"))
        .replace(/{file}/g, sub.fileNumber);

      const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      reminders.push({
        subscriberId: sub.id,
        fileNumber: sub.fileNumber,
        name: `${sub.lastName} ${sub.firstName}`,
        phone,
        expiryDate: expiry,
        daysLeft: diffDays,
        url,
        message,
      });
    }

    return NextResponse.json({ reminders, enabled: true, count: reminders.length });
  } catch (e) {
    console.error("GET whatsapp/remind:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await req.json();
    const { subscriberId, customMessage } = body as { subscriberId: string; customMessage?: string };
    if (!subscriberId) {
      return NextResponse.json({ error: "subscriberId required" }, { status: 400 });
    }

    const clubId = currentUser.clubId!;
    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId };
    const sub = await db.subscriber.findFirst({ where: { id: subscriberId, ...clubFilter } });
    if (!sub) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    if (!sub.phone) return NextResponse.json({ error: "لا يوجد رقم هاتف" }, { status: 400 });

    let phone = sub.phone.replace(/\D/g, "");
    if (phone.startsWith("0")) phone = "213" + phone.slice(1);
    else if (!phone.startsWith("213")) phone = "213" + phone;

    const expiry = calculateExpiryDate(sub.lastPaymentDate, getTypeConfig(sub.subscriptionType).durationDays);
    const templateSetting = await db.setting.findFirst({ where: { clubId, key: "whatsappTemplate" } });
    const template = templateSetting?.value || "مرحباً {name}، اشتراكك ينتهي في {date}.";

    const message = (customMessage || template)
      .replace(/{name}/g, `${sub.firstName} ${sub.lastName}`)
      .replace(/{date}/g, expiry?.toISOString().split("T")[0].replace(/-/g, "/") || "—")
      .replace(/{file}/g, sub.fileNumber);

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

    return NextResponse.json({ url, phone, message });
  } catch (e) {
    console.error("POST whatsapp/remind:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

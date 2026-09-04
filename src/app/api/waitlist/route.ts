import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getFeatureSettings } from "@/lib/feature-settings";

/**
 * GET /api/waitlist?status=waiting
 */
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const status = req.nextUrl.searchParams.get("status");
    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const where: Record<string, unknown> = { ...clubFilter };
    if (status) where.status = status;

    const entries = await db.waitlist.findMany({
      where,
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ entries });
  } catch (e) {
    console.error("GET /api/waitlist:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

/**
 * POST /api/waitlist
 * body: { firstName, lastName, phone?, desiredSwimmingDays, desiredTimeSlot, note? }
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.clubId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const body = await req.json();
    const { firstName, lastName, phone, desiredSwimmingDays, desiredTimeSlot, note } = body;

    if (!firstName || !lastName || !desiredSwimmingDays || !desiredTimeSlot) {
      return NextResponse.json({ error: "الاسم والحصة المطلوبة إلزامية" }, { status: 400 });
    }

    const entry = await db.waitlist.create({
      data: {
        clubId: currentUser.clubId,
        firstName, lastName, phone: phone || null,
        desiredSwimmingDays, desiredTimeSlot,
        note: note || null,
      },
    });

    // معلومة مفيدة للموظف: هل الحصة ممتلئة فعلاً وقت الإضافة؟
    const [slot, regularCount] = await Promise.all([
      db.swimmingTimeSlot.findFirst({ where: { clubId: currentUser.clubId, name: desiredTimeSlot } }),
      db.subscriber.count({ where: { clubId: currentUser.clubId, swimmingDays: desiredSwimmingDays, timeSlot: desiredTimeSlot } }),
    ]);
    // 🧩 السعة الافتراضية متزامنة مع الإعدادات ← الميزات ← قائمة الانتظار
    const feat = await getFeatureSettings(db, currentUser.clubId);
    const defaultCapacity = Number(feat.waitlistDefaultCapacity) || 30;
    const maxCapacity = slot?.maxCapacity ?? defaultCapacity;

    return NextResponse.json({ entry, currentOccupancy: regularCount, maxCapacity });
  } catch (e) {
    console.error("POST /api/waitlist:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

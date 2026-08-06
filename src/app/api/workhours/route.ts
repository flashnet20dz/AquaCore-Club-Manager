import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasPermission(currentUser.role, "workHours")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const userId = url.searchParams.get("userId");

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const where: Record<string, unknown> = { ...clubFilter };
    if (status) where.status = status;
    if (userId) where.userId = userId;

    // Lifeguard sees only their own; admin/assistant/superadmin sees all
    if (currentUser.role === "lifeguard") {
      where.userId = currentUser.id;
    }

    const workHours = await db.workHours.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ workHours });
  } catch (e) {
    console.error("GET workhours:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasPermission(currentUser.role, "workHours")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await req.json();
    const { date, startTime, endTime, note } = body;

    if (!date || !startTime || !endTime) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    const startDate = new Date(`${date}T${startTime}`);
    let endDate = new Date(`${date}T${endTime}`);
    // 🔑 دعم الورديات الليلية: إذا كان endTime قبل startTime، اعتبره في اليوم التالي
    if (endDate <= startDate) {
      endDate = new Date(endDate);
      endDate.setDate(endDate.getDate() + 1);
    }
    // تحقق نهائي: يجب أن يكون هناك فرق فعلي
    const diffMs = endDate.getTime() - startDate.getTime();
    if (diffMs < 15 * 60 * 1000) { // أقل من 15 دقيقة
      return NextResponse.json({ error: "الفرق بين وقت البداية والنهاية قليل جداً (أقل من 15 دقيقة)" }, { status: 400 });
    }

    const workHour = await db.workHours.create({
      data: {
        clubId: currentUser.clubId!,
        userId: currentUser.id,
        date: new Date(date),
        startTime: startDate,
        endTime: endDate,
        note: note || null,
        status: "pending",
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return NextResponse.json({ workHour }, { status: 201 });
  } catch (e) {
    console.error("POST workhours:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

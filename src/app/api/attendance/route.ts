import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateRenewalStatus, calculateExpiryDate } from "@/lib/rcs";
import { getCurrentUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const subscriberId = url.searchParams.get("subscriberId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const where: Record<string, unknown> = { ...clubFilter };
    if (date) {
      const d = new Date(date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      where.date = { gte: d, lt: next };
    } else if (from && to) {
      where.date = { gte: new Date(from), lte: new Date(to) };
    }
    if (subscriberId) where.subscriberId = subscriberId;

    const attendances = await db.attendance.findMany({
      where,
      include: { subscriber: true },
      orderBy: { checkInTime: "desc" },
    });

    return NextResponse.json({ attendances });
  } catch (e) {
    console.error("GET attendance:", e);
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
    const { subscriberId, method, date, note, checkInTime } = body;

    if (!subscriberId) {
      return NextResponse.json({ error: "subscriberId required" }, { status: 400 });
    }

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const sub = await db.subscriber.findFirst({ where: { id: subscriberId, ...clubFilter } });
    if (!sub) return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });

    // Compute renewal status to allow/deny check-in
    const expiry = calculateExpiryDate(sub.lastPaymentDate);
    const renewalStatus = calculateRenewalStatus(sub.paymentStatus as never, expiry);
    const isExpired = renewalStatus.includes("منتهي");
    const isFrozen = renewalStatus.includes("مجمدة");

    const today = date ? new Date(date) : new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await db.attendance.findUnique({
      where: { clubId_subscriberId_date: { clubId: sub.clubId, subscriberId, date: today } },
    });

    if (existing) {
      return NextResponse.json({
        error: "تم تسجيل الحضور اليوم",
        attendance: existing,
        status: "duplicate",
      }, { status: 409 });
    }

    // ★ وقت تسجيل الحضور: استخدم checkInTime المخصص إن قُدم، وإلا الآن
    const checkIn = checkInTime ? new Date(checkInTime) : new Date();
    const attendance = await db.attendance.create({
      data: {
        clubId: sub.clubId,
        subscriberId,
        date: today,
        checkInTime: checkIn,
        method: method || "manual",
        note: note || (isExpired ? "منتهي — يحتاج تجديد" : isFrozen ? "مجمد — لم يدفع" : null),
      },
      include: { subscriber: true },
    });

    await db.activity.create({
      data: {
        clubId: sub.clubId,
        subscriberId,
        type: "attendance",
        description: `حضر ${sub.lastName} ${sub.firstName} حصة اليوم`,
      },
    });

    // Return status info so frontend can play the right sound
    return NextResponse.json({
      attendance,
      status: isExpired ? "expired" : isFrozen ? "frozen" : "valid",
      renewalStatus,
    }, { status: 201 });
  } catch (e) {
    console.error("POST attendance:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const existing = await db.attendance.findFirst({ where: { id, ...clubFilter } });
    if (!existing) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }
    await db.attendance.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE attendance:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await req.json();
    const { id, checkOut } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const existing = await db.attendance.findFirst({ where: { id, ...clubFilter } });
    if (!existing) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }

    const attendance = await db.attendance.update({
      where: { id },
      data: checkOut ? { checkOutTime: new Date() } : {},
    });

    return NextResponse.json({ attendance });
  } catch (e) {
    console.error("PATCH attendance:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

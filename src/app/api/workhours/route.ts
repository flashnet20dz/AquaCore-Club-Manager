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
    const month = url.searchParams.get("month");

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const where: Record<string, unknown> = { ...clubFilter };
    if (status) where.status = status;
    if (userId) where.userId = userId;

    if (currentUser.role === "lifeguard") {
      where.userId = currentUser.id;
    }

    if (month) {
      const [year, mon] = month.split("-").map(Number);
      const start = new Date(year, mon - 1, 1);
      const end = new Date(year, mon, 0, 23, 59, 59);
      where.date = { gte: start, lte: end };
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

    // 🔑 حقن الحقول الجديدة من note (JSON) إن وُجدت — لتجنب P2022
    const enriched = workHours.map((w) => {
      let breakMinutes = 0;
      let workStatus = "present";
      let absenceReason: string | null = null;
      let hourlyRate = 0;
      let position: string | null = null;
      try {
        if (w.note && w.note.startsWith("{")) {
          const meta = JSON.parse(w.note);
          breakMinutes = meta.breakMinutes || 0;
          workStatus = meta.workStatus || "present";
          absenceReason = meta.absenceReason || null;
          hourlyRate = meta.hourlyRate || 0;
          position = meta.position || null;
        }
      } catch {}
      return {
        ...w,
        breakMinutes,
        workStatus,
        absenceReason,
        user: { ...w.user, hourlyRate, position, avatar: null },
      };
    });

    return NextResponse.json({ workHours: enriched });
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
    const { date, startTime, endTime, note, breakMinutes, workStatus, absenceReason, targetUserId } = body;

    if (!date) {
      return NextResponse.json({ error: "التاريخ مطلوب" }, { status: 400 });
    }

    const isAbsence = workStatus === "absent" || workStatus === "leave" || workStatus === "sick" || workStatus === "vacation";

    // 🔑 خزّن الحقول الإضافية في note كـ JSON — لتجنب P2022
    const noteMeta = JSON.stringify({
      breakMinutes: breakMinutes || 0,
      workStatus: workStatus || "present",
      absenceReason: absenceReason || null,
      textNote: note || "",
    });

    if (isAbsence) {
      const workHour = await db.workHours.create({
        data: {
          clubId: currentUser.clubId!,
          userId: targetUserId || currentUser.id,
          date: new Date(date),
          startTime: new Date(`${date}T00:00`),
          endTime: new Date(`${date}T00:00`),
          note: noteMeta,
          status: currentUser.role === "admin" || currentUser.role === "superadmin" ? "approved" : "pending",
          approvedById: (currentUser.role === "admin" || currentUser.role === "superadmin") ? currentUser.id : null,
          approvedAt: (currentUser.role === "admin" || currentUser.role === "superadmin") ? new Date() : null,
        },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      });
      return NextResponse.json({ workHour }, { status: 201 });
    }

    if (!startTime || !endTime) {
      return NextResponse.json({ error: "وقت البداية والنهاية مطلوبان" }, { status: 400 });
    }

    const startDate = new Date(`${date}T${startTime}`);
    let endDate = new Date(`${date}T${endTime}`);
    if (endDate <= startDate) {
      endDate = new Date(endDate);
      endDate.setDate(endDate.getDate() + 1);
    }
    const diffMs = endDate.getTime() - startDate.getTime();
    if (diffMs < 15 * 60 * 1000) {
      return NextResponse.json({ error: "الفرق بين وقت البداية والنهاية قليل جداً" }, { status: 400 });
    }

    const workHour = await db.workHours.create({
      data: {
        clubId: currentUser.clubId!,
        userId: targetUserId || currentUser.id,
        date: new Date(date),
        startTime: startDate,
        endTime: endDate,
        note: noteMeta,
        status: currentUser.role === "admin" || currentUser.role === "superadmin" ? "approved" : "pending",
        approvedById: (currentUser.role === "admin" || currentUser.role === "superadmin") ? currentUser.id : null,
        approvedAt: (currentUser.role === "admin" || currentUser.role === "superadmin") ? new Date() : null,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return NextResponse.json({ workHour }, { status: 201 });
  } catch (e) {
    console.error("POST workhours:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal" }, { status: 500 });
  }
}

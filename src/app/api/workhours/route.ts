import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/session";
import { parseWallDateTime, utcMonthStart, utcMonthEnd } from "@/lib/wall-clock";

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
      // ★ حدود الشهر بـ UTC لتطابق التخزين (wall-clock UTC) — بلا انحراف توقيت
      where.date = { gte: utcMonthStart(month), lte: utcMonthEnd(month) };
    }

    const workHours = await db.workHours.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { date: "desc" },
    });

    // 🔑 جلب Employees لربط hourlyRate و position
    const clubId = currentUser.clubId;
    const employees = clubId
      ? await db.employee.findMany({
          where: { clubId },
          select: { userId: true, position: true, hourRate: true },
        })
      : [];
    const empMap = new Map(employees.map((e) => [e.userId, { hourlyRate: e.hourRate, position: e.position }]));

    // 🔑 حقن الحقول الإضافية من note (JSON) إن وُجدت
    const enriched = workHours.map((w) => {
      let breakMinutes = 0;
      let workStatus = "present";
      let absenceReason: string | null = null;
      try {
        if (w.note && w.note.startsWith("{")) {
          const meta = JSON.parse(w.note);
          breakMinutes = meta.breakMinutes || 0;
          workStatus = meta.workStatus || "present";
          absenceReason = meta.absenceReason || null;
        }
      } catch {}
      const emp = empMap.get(w.userId);
      return {
        ...w,
        breakMinutes,
        workStatus,
        absenceReason,
        user: {
          ...w.user,
          hourlyRate: emp?.hourlyRate || 0,
          position: emp?.position || null,
          avatar: null,
        },
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

    // 🔑 خزّن الحقول الإضافية في note كـ JSON
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
          date: parseWallDateTime(date, "00:00"),
          startTime: parseWallDateTime(date, "00:00"),
          endTime: parseWallDateTime(date, "00:00"),
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

    // ★ منع التسجيل في يوم مغلق (إعداد poolOperatingDays — غيابه = كل الأيام مفتوحة)
    const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const dayLabels: Record<string, string> = { sun: "الأحد", mon: "الإثنين", tue: "الثلاثاء", wed: "الأربعاء", thu: "الخميس", fri: "الجمعة", sat: "السبت" };
    const recordDayKey = dayKeys[new Date(`${date}T12:00:00Z`).getUTCDay()];
    const opDaysRaw = await db.setting.findFirst({ where: { clubId: currentUser.clubId!, key: "poolOperatingDays" } });
    if (opDaysRaw?.value) {
      try {
        const opDays: unknown = JSON.parse(opDaysRaw.value);
        if (Array.isArray(opDays) && opDays.length > 0 && !opDays.includes(recordDayKey)) {
          return NextResponse.json({ error: `المسبح مغلق في يوم ${dayLabels[recordDayKey] || recordDayKey} حسب إعدادات أيام الاستغلال` }, { status: 400 });
        }
      } catch { /* إعداد تالف → نتجاهل */ }
    }

    // ★ منع التكرار: نفس العامل + نفس اليوم + نفس وقت البداية (سجل غير مرفوض)
    const dupStart = parseWallDateTime(date, startTime);
    const duplicate = await db.workHours.findFirst({
      where: {
        clubId: currentUser.clubId!,
        userId: targetUserId || currentUser.id,
        date: parseWallDateTime(date, "00:00"),
        startTime: dupStart,
        status: { not: "rejected" },
      },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json({ error: "سجل مكرر — نفس العامل مسجّل في نفس اليوم ونفس وقت البداية" }, { status: 409 });
    }

    // ★ تخزين wall-clock UTC: الوقت المُدخل يُحفظ كما هو حرفياً —
    // 09:00 تبقى 09:00 في أي خادم وأي متصفح (جذر إصلاح انحراف الساعة +1)
    const startDate = parseWallDateTime(date, startTime);
    let endDate = parseWallDateTime(date, endTime);
    if (endDate <= startDate) {
      endDate = new Date(endDate.getTime() + 86400000); // وردية ليلية تعبر منتصف الليل
    }
    const diffMs = endDate.getTime() - startDate.getTime();
    if (diffMs < 15 * 60 * 1000) {
      return NextResponse.json({ error: "الفرق بين وقت البداية والنهاية قليل جداً" }, { status: 400 });
    }

    const workHour = await db.workHours.create({
      data: {
        clubId: currentUser.clubId!,
        userId: targetUserId || currentUser.id,
        date: parseWallDateTime(date, "00:00"),
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

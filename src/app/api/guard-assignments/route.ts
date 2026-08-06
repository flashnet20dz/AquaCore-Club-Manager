import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// GET /api/guard-assignments?userId=xxx&dayOfWeek=xxx
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.clubId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const dayOfWeek = url.searchParams.get("dayOfWeek");

    const where: Record<string, unknown> = {
      clubId: currentUser.clubId,
      isActive: true,
    };
    if (userId) where.userId = userId;
    if (dayOfWeek) where.dayOfWeek = dayOfWeek;

    // 🔑 حارس السباحة يرى تعييناته فقط
    if (currentUser.role === "lifeguard") {
      where.userId = currentUser.id;
    }

    const assignments = await db.guardAssignment.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true, avatar: true, position: true, hourlyRate: true },
        },
      },
      orderBy: [{ dayOfWeek: "asc" }, { timeSlot: "asc" }],
    });

    return NextResponse.json({ assignments });
  } catch (e) {
    console.error("GET guard-assignments:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

// POST /api/guard-assignments
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح — المدير فقط" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, dayOfWeek, timeSlot, groupName, assignmentType } = body;

    if (!userId || !dayOfWeek || !timeSlot) {
      return NextResponse.json({ error: "الحارس، اليوم، والتوقيت مطلوبون" }, { status: 400 });
    }

    // 🔑 فحص التعارض: نفس الحارس بنفس اليوم والتوقيت
    const existing = await db.guardAssignment.findFirst({
      where: {
        clubId: currentUser.clubId!,
        userId,
        dayOfWeek,
        timeSlot,
        isActive: true,
      },
    });
    if (existing) {
      return NextResponse.json({ error: "الحارس معيَّن بالفعل في هذه الحصة" }, { status: 400 });
    }

    const assignment = await db.guardAssignment.create({
      data: {
        clubId: currentUser.clubId!,
        userId,
        dayOfWeek,
        timeSlot,
        groupName: groupName || null,
        assignmentType: assignmentType || "primary",
        isActive: true,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, avatar: true, position: true, hourlyRate: true } },
      },
    });

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (e) {
    console.error("POST guard-assignments:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal" }, { status: 500 });
  }
}

// PATCH /api/guard-assignments?id=xxx (بدء/إنهاء الحصة، تحديث حالة)
export async function PATCH(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.clubId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

    const body = await req.json();
    const { action, note, attendanceStatus } = body;

    const assignment = await db.guardAssignment.findFirst({
      where: { id, clubId: currentUser.clubId },
    });
    if (!assignment) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

    // 🔑 حارس السباحة يبدى/ينهي حصصه فقط
    if (currentUser.role === "lifeguard" && assignment.userId !== currentUser.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};
    if (action === "start") {
      updates.actualStartTime = new Date();
      updates.attendanceStatus = "started";
    } else if (action === "end") {
      updates.actualEndTime = new Date();
      updates.attendanceStatus = "completed";
    } else if (attendanceStatus) {
      updates.attendanceStatus = attendanceStatus;
    }
    if (note) updates.note = note;

    const updated = await db.guardAssignment.update({
      where: { id },
      data: updates,
      include: {
        user: { select: { id: true, name: true, email: true, role: true, avatar: true, position: true, hourlyRate: true } },
      },
    });

    return NextResponse.json({ assignment: updated });
  } catch (e) {
    console.error("PATCH guard-assignments:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

// DELETE /api/guard-assignments?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح — المدير فقط" }, { status: 403 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

    await db.guardAssignment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE guard-assignments:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

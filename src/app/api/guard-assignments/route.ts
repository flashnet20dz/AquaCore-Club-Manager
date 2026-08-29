import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// GET /api/guard-assignments
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.clubId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const dayOfWeek = url.searchParams.get("dayOfWeek");

    // 🔑 تجنب P2022: استخدم try/catch مع GuardAssignment
    // إذا الجدول غير موجود، أرجع قائمة فارغة
    let assignments: any[] = [];
    try {
      const where: Record<string, unknown> = {
        clubId: currentUser.clubId,
        isActive: true,
      };
      if (userId) where.userId = userId;
      if (dayOfWeek) where.dayOfWeek = dayOfWeek;
      if (currentUser.role === "lifeguard") {
        where.userId = currentUser.id;
      }

      assignments = await db.guardAssignment.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: [{ dayOfWeek: "asc" }, { timeSlot: "asc" }],
      });
    } catch (e) {
      // GuardAssignment table might not exist — return empty
      console.warn("GuardAssignment query failed (table may not exist):", e);
    }

    return NextResponse.json({ assignments });
  } catch (e) {
    console.error("GET guard-assignments:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

// POST
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

    try {
      // فحص التعارض
      const existing = await db.guardAssignment.findFirst({
        where: { clubId: currentUser.clubId!, userId, dayOfWeek, timeSlot, isActive: true },
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
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      });

      return NextResponse.json({ assignment }, { status: 201 });
    } catch (e) {
      return NextResponse.json({ error: "تعذر إنشاء التعيين — تأكد من تحديث قاعدة البيانات" }, { status: 500 });
    }
  } catch (e) {
    console.error("POST guard-assignments:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

// PATCH
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

    try {
      const assignment = await db.guardAssignment.findFirst({
        where: { id, clubId: currentUser.clubId },
      });
      if (!assignment) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

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
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      });

      return NextResponse.json({ assignment: updated });
    } catch (e) {
      return NextResponse.json({ error: "تعذر تحديث التعيين" }, { status: 500 });
    }
  } catch (e) {
    console.error("PATCH guard-assignments:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

// DELETE
export async function DELETE(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

    try {
      await db.guardAssignment.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } catch (e) {
      return NextResponse.json({ error: "تعذر الحذف" }, { status: 500 });
    }
  } catch (e) {
    console.error("DELETE guard-assignments:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

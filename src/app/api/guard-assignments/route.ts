import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ensureRuntimeColumns } from "@/lib/runtime-schema";
import { POOL_DAY_LABELS } from "@/lib/pool-schedule";

/**
 * guard-assignments — تعيين العمال/الحراس على حصص المسبح (المرحلة 4)
 * ─────────────────────────────────────────────────────────────
 * GET    ?slotId=…  → عمال حصة محددة | بلا slotId → كل التعيينات (+ معلومات الحصة)
 * POST   { slotId, userId, assignmentType?, groupName? }
 *        → تعيين على حصة من الإعدادات (المصدر الموحّد) — يشتق اليوم/التوقيت
 *          من الحصة نفسها ويحفظها لقطة تاريخية.
 * PATCH  ?id=…      → بدء/إنهاء نقاط أو حالة حضور (كما هو).
 * DELETE ?id=…      → إزالة تعيين.
 *
 * slotId اختياري في القرون القديمة (dayOfWeek نصّي) — الجديد دائماً بslotId
 * ليحصل كل الجلسات على مصدر واحد من Settings.
 */

// GET /api/guard-assignments
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.clubId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    await ensureRuntimeColumns();

    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const slotId = url.searchParams.get("slotId");
    const dayOfWeek = url.searchParams.get("dayOfWeek");

    let assignments: Array<Record<string, unknown>> = [];
    try {
      const where: Record<string, unknown> = {
        clubId: currentUser.clubId,
        isActive: true,
      };
      if (userId) where.userId = userId;
      if (slotId) where.slotId = slotId;
      if (dayOfWeek) where.dayOfWeek = dayOfWeek;
      if (currentUser.role === "lifeguard") {
        where.userId = currentUser.id;
      }

      assignments = await db.guardAssignment.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          slot: {
            select: { id: true, name: true, startTime: true, endTime: true, dayOfWeek: true, active: true },
          },
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

// POST — تعيين عامل على حصة من جدول المسبح (أو تعيين نصّي قديم للتوافق)
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح — المدير فقط" }, { status: 403 });
    }
    if (!currentUser.clubId) {
      return NextResponse.json({ error: "لا يوجد نادي مرتبط بهذا الحساب" }, { status: 400 });
    }
    await ensureRuntimeColumns();

    const body = await req.json();
    const { userId, slotId, dayOfWeek, timeSlot, groupName, assignmentType } = body;

    if (!userId) {
      return NextResponse.json({ error: "العامل مطلوب" }, { status: 400 });
    }

    // العامل يجب أن يكون مستخدماً في نفس النادي
    const worker = await db.user.findFirst({
      where: { id: userId, clubId: currentUser.clubId },
      select: { id: true },
    });
    if (!worker) return NextResponse.json({ error: "العامل غير موجود" }, { status: 404 });

    let derivedDay: string;
    let derivedSlot: string;

    if (slotId) {
      // ★ المسار الموحّد: الحصة من الإعدادات — نشتق اليوم/التوقيت منها (لقطة تاريخية)
      const slot = await db.swimmingTimeSlot.findFirst({
        where: { id: slotId, clubId: currentUser.clubId },
      });
      if (!slot) return NextResponse.json({ error: "الحصة غير موجودة في إعدادات المسبح" }, { status: 404 });

      const existing = await db.guardAssignment.findFirst({
        where: { clubId: currentUser.clubId!, userId, slotId, isActive: true },
      });
      if (existing) {
        return NextResponse.json({ error: "العامل معيَّن بالفعل على هذه الحصة" }, { status: 400 });
      }

      const dow = slot.dayOfWeek;
      derivedDay = dow ? (POOL_DAY_LABELS[dow] ?? dow) : "كل الأيام";
      derivedSlot = `${slot.startTime}-${slot.endTime}`;

      try {
        const assignment = await db.guardAssignment.create({
          data: {
            clubId: currentUser.clubId!,
            userId,
            slotId,
            dayOfWeek: derivedDay,
            timeSlot: derivedSlot,
            groupName: groupName || null,
            assignmentType: assignmentType || "primary",
            isActive: true,
          },
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
            slot: {
              select: { id: true, name: true, startTime: true, endTime: true, dayOfWeek: true, active: true },
            },
          },
        });
        return NextResponse.json({ assignment }, { status: 201 });
      } catch (e) {
        console.error("POST guard-assignment (slot):", e);
        return NextResponse.json({ error: "تعذر إنشاء التعيين" }, { status: 500 });
      }
    }

    // التوافق القديم: تعيين نصّي (dayOfWeek + timeSlot)
    if (!dayOfWeek || !timeSlot) {
      return NextResponse.json({ error: "الحصة (slotId) أو اليوم والتوقيت مطلوبة" }, { status: 400 });
    }

    try {
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
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
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
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          slot: {
            select: { id: true, name: true, startTime: true, endTime: true, dayOfWeek: true, active: true },
          },
        },
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
      return NextResponse.json({ error: "غير مصرح — المدير فقط" }, { status: 403 });
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

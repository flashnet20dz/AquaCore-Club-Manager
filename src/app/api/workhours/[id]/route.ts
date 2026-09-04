import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/session";
import { ensureRuntimeColumns } from "@/lib/runtime-schema";

/**
 * PATCH /api/workhours/[id] — اعتماد/رفض/إلغاء سجل ساعات عمل (المرحلة 5 — §9/§10)
 * ─────────────────────────────────────────────────────────────────────────
 * الحالات: pending (مسودة) / approved / rejected / cancelled
 * الرفض والإلغاء يقبلا سبباً (rejectionReason) — سجل التدقيق يوثّق كل انتقال.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureRuntimeColumns();
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasPermission(currentUser.role, "workHoursApproval")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { status, note, reason } = body; // "approved" | "rejected" | "cancelled"

    if (!["approved", "rejected", "cancelled"].includes(status)) {
      return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
    }

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const existing = await db.workHours.findFirst({ where: { id, ...clubFilter } });
    if (!existing) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }

    // ★ منع التكرار: الانتقال من نفس الحالة إلى نفسها بلا معنى
    if (existing.status === status) {
      return NextResponse.json({ error: `السجل في هذه الحالة أصلاً (${status})` }, { status: 409 });
    }
    // السجل الملغى لا يُعاد إحياؤه إلا بإعادة التسجيل (سلامة التاريخ)
    if (existing.status === "cancelled") {
      return NextResponse.json({ error: "السجل ملغى — لا يمكن تعديله، أعد تسجيله من جديد" }, { status: 409 });
    }
    // الرفض/الإلغاء بسبب إلزامي (واضح للتدقيق)
    if ((status === "rejected" || status === "cancelled") && !(reason || "").trim()) {
      return NextResponse.json(
        { error: status === "rejected" ? "سبب الرفض إلزامي" : "سبب الإلغاء إلزامي" },
        { status: 400 }
      );
    }

    const workHour = await db.workHours.update({
      where: { id },
      data: {
        status,
        note: note || existing.note,
        approvedById: currentUser.id,
        approvedAt: new Date(),
        rejectionReason: status === "approved" ? null : (reason || "").trim() || null,
        // ★ الإلغاء ناعم — لا حذف: من ألغى ومتى (§9)
        cancelledById: status === "cancelled" ? currentUser.id : null,
        cancelledAt: status === "cancelled" ? new Date() : null,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    // ★ المرحلة 5 (§35): تدقيق كل انتقالات الحالة
    const actionLabel =
      status === "approved" ? "work_hour_approve" : status === "rejected" ? "work_hour_reject" : "work_hour_cancel";
    await db.auditLog.create({
      data: {
        clubId: existing.clubId,
        userId: currentUser.id,
        action: actionLabel,
        entityType: "WorkHours",
        entityId: id,
        description:
          status === "approved"
            ? "اعتماد سجل ساعات عمل"
            : status === "rejected"
              ? `رفض سجل ساعات عمل — السبب: ${(reason || "").trim()}`
              : `إلغاء سجل ساعات عمل — السبب: ${(reason || "").trim()}`,
        metadata: JSON.stringify({
          oldValue: { status: existing.status },
          newValue: { status },
          reason: (reason || "").trim() || null,
          startTime: existing.startTime.toISOString(),
          endTime: existing.endTime.toISOString(),
          date: existing.date.toISOString(),
        }),
      },
    }).catch(() => undefined);

    return NextResponse.json({ workHour });
  } catch (e) {
    console.error("PATCH workhour:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureRuntimeColumns();
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const existing = await db.workHours.findFirst({ where: { id, ...clubFilter } });
    if (!existing) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }

    // Only owner or admin/assistant can delete
    if (existing.userId !== currentUser.id && !hasPermission(currentUser.role, "workHoursApproval")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    // ★ المرحلة 5 (§9): الحذف الفعلي للمسودات (pending) فقط —
    //   المعتمد/المرفوض يُلغى ناعماً (PATCH cancelled) حفاظاً على التاريخ والتدقيق
    if (existing.status !== "pending") {
      return NextResponse.json(
        { error: "لا يمكن حذف سجل معتمد/مرفوض — ألغِه بدل الحذف (يُحفظ في التاريخ)", requiresCancel: true },
        { status: 409 }
      );
    }

    await db.workHours.delete({ where: { id } });
    await db.auditLog.create({
      data: {
        clubId: existing.clubId,
        userId: currentUser.id,
        action: "work_hour_delete_draft",
        entityType: "WorkHours",
        entityId: id,
        description: "حذف مسودة سجل ساعات عمل (قبل الاعتماد)",
        metadata: JSON.stringify({
          startTime: existing.startTime.toISOString(),
          endTime: existing.endTime.toISOString(),
          date: existing.date.toISOString(),
        }),
      },
    }).catch(() => undefined);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE workhour:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

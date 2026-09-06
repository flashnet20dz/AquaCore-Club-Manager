import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/session";
import { ensureRuntimeColumns } from "@/lib/runtime-schema";
import { runTx, ensureSqliteConcurrency } from "@/lib/tx-safe";

/**
 * PATCH /api/workhours/[id] — اعتماد/رفض/إلغاء سجل ساعات عمل (المرحلة 5 — §9/§10)
 * ─────────────────────────────────────────────────────────────────────────
 * الحالات: pending (مسودة) / approved / rejected / cancelled
 * الرفض والإلغاء يقبلا سبباً (rejectionReason) — سجل التدقيق يوثّق كل انتقال.
 *
 * ★ صلابات التدقيق (قرار إلغاء الساعات):
 *  1) المعاملة الذرّية (runTx) مع إعادة قراءة داخلها — الإلغاء المزدوج المتزامن
 *     (نقر مزدوج/طلبان متوازيان) ينتهي بواحد 200 وواحد 409 حتماً.
 *  2) حماية الأجر المدفوع (paidWageGuard): السجل المعتمد الذي يقع تاريخه داخل
 *     فترة تسديد أجر نشطة لنفس العامل لا يُلغى/يُرفض صمتاً — لأنه أساس قيد
 *     مالي مدفوع. المسار الرقابي: ألغِ التسديد أولاً (DELETE /api/wages/[id]
 *     — العكس الناعم المضبوط) ثم ألغِ السجل. لا مساس بالتاريخ المالي أبدأً.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    ensureSqliteConcurrency();
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

    const isDeactivation = status === "cancelled" || status === "rejected";

    // ═══ ★ حماية الأجر المدفوع (فحص استباقي سريع — ويُعاد فحصه داخل المعاملة) ═══
    // سجل «معتمد» يقع تاريخه داخل فترة WagePayment نشطة لنفس العامل = جزء من
    // أساس أجر مدفوع فعلاً (قيد مالي). إلغاؤه صمتاً يفسد أساس التاريخ المدفوع —
    // لذا يُمنع، والمسار الصحيح: إلغاء التسديد أولاً (آلية العكس الرقابية الموجودة)
    // ثم إلغاء السجل. السجلات pending لم تدخل في أي حساب أبداً → إلغاؤها حر.
    if (existing.status === "approved" && isDeactivation) {
      const paid = await db.wagePayment.findFirst({
        where: {
          clubId: existing.clubId,
          userId: existing.userId,
          status: { not: "cancelled" },
          periodStart: { lte: existing.date },
          periodEnd: { gte: existing.date },
        },
        select: { id: true, periodLabel: true },
      });
      if (paid) {
        return NextResponse.json(
          {
            error: `لا يمكن ${status === "cancelled" ? "إلغاء" : "رفض"} هذا السجل — تاريخه يقع داخل فترة أجر مسدّدة (${paid.periodLabel}). ألغِ تسديد الأجر أولاً من صفحة الأجور (إلغاء التسديد) ثم أعد المحاولة.`,
            paidWageGuard: true,
            wagePaymentId: paid.id,
          },
          { status: 409 }
        );
      }
    }

    // ═══ المعاملة الذرّية: إعادة قراءة + إعادة حماية + تحديث + تدقيق معاً ═══
    // إعادة القراءة داخل المعاملة تغلق سباق الإلغاء المزدوج:
    // طلبان متوازيان على نفس السجل → الأول ينتقل، والثاني يرى الحالة الجديدة → 409.
    let workHour;
    try {
      workHour = await runTx(
        async (tx) => {
          const fresh = await tx.workHours.findFirst({ where: { id, ...clubFilter } });
          if (!fresh) throw new Error("WH_GONE");
          if (fresh.status === "cancelled") throw new Error("WH_CANCELLED");
          if (fresh.status === status) throw new Error(`WH_SAME:${status}`);
          if (fresh.status === "approved" && isDeactivation) {
            const paid = await tx.wagePayment.findFirst({
              where: {
                clubId: fresh.clubId,
                userId: fresh.userId,
                status: { not: "cancelled" },
                periodStart: { lte: fresh.date },
                periodEnd: { gte: fresh.date },
              },
              select: { id: true, periodLabel: true },
            });
            if (paid) throw new Error(`WH_PAID:${paid.periodLabel}`);
          }
          const wh = await tx.workHours.update({
            where: { id },
            data: {
              status,
              note: note || fresh.note,
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
          await tx.auditLog.create({
            data: {
              clubId: fresh.clubId,
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
                oldValue: { status: fresh.status },
                newValue: { status },
                reason: (reason || "").trim() || null,
                startTime: fresh.startTime.toISOString(),
                endTime: fresh.endTime.toISOString(),
                date: fresh.date.toISOString(),
              }),
            },
          }).catch(() => undefined); // التدقيق اختياري — لا يفشل الانتقال
          return wh;
        },
        "workhours-transition"
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "WH_GONE") {
        return NextResponse.json({ error: "غير موجود" }, { status: 404 });
      }
      if (msg === "WH_CANCELLED") {
        return NextResponse.json({ error: "السجل ملغى — لا يمكن تعديله، أعد تسجيله من جديد" }, { status: 409 });
      }
      if (msg.startsWith("WH_SAME:")) {
        return NextResponse.json({ error: `السجل في هذه الحالة أصلاً (${msg.split(":")[1]})` }, { status: 409 });
      }
      if (msg.startsWith("WH_PAID:")) {
        return NextResponse.json(
          {
            error: `لا يمكن ${status === "cancelled" ? "إلغاء" : "رفض"} هذا السجل — تاريخه يقع داخل فترة أجر مسدّدة (${msg.split(":").slice(1).join(":")}). ألغِ تسديد الأجر أولاً من صفحة الأجور ثم أعد المحاولة.`,
            paidWageGuard: true,
          },
          { status: 409 }
        );
      }
      throw e;
    }

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

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/session";
import { ensureRuntimeColumns } from "@/lib/runtime-schema";
import { runTx, ensureSqliteConcurrency } from "@/lib/tx-safe";

/**
 * POST /api/workhours/approve — اعتماد/رفض عدة سجلات دفعة واحدة (المرحلة 5 — §10)
 * ═══════════════════════════════════════════════════════════════════════════
 * Body: { ids: string[], action: "approved" | "rejected", reason?: string }
 * - صلاحية workHoursApproval (admin/assistant/superadmin)
 * - المعاملة الواحدة: كل السجلات الصالحة تُحدَّث أو لا شيء
 * - الرفض بسبب إلزامي
 * - التدقيق: سجل AuditLog واحد مجمّع + قيمة سابقة/جديدة لكل سجل
 * Response: { updated, skipped: [{id, reason}], totalHours }
 */

export async function POST(req: NextRequest) {
  try {
    ensureSqliteConcurrency(); // WAL + busy_timeout (إصلاح P2028 على سطح المكتب)
    await ensureRuntimeColumns();
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasPermission(currentUser.role, "workHoursApproval")) {
      return NextResponse.json({ error: "غير مصرح — اعتماد الساعات للمدير/المساعد فقط" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const ids: string[] = Array.isArray(body?.ids)
      ? body.ids.filter((x: unknown): x is string => typeof x === "string" && Boolean(x))
      : [];
    const action: string = body?.action === "rejected" ? "rejected" : "approved";
    const reason: string = typeof body?.reason === "string" ? body.reason.trim() : "";

    if (ids.length === 0) {
      return NextResponse.json({ error: "اختر سجلاً واحداً على الأقل" }, { status: 400 });
    }
    if (ids.length > 200) {
      return NextResponse.json({ error: "عدد السجلات كبير جداً (الحد 200)" }, { status: 400 });
    }
    if (action === "rejected" && reason.length < 3) {
      return NextResponse.json({ error: "سبب الرفض إلزامي (3 أحرف على الأقل)" }, { status: 400 });
    }

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const records = await db.workHours.findMany({
      where: { id: { in: ids }, ...clubFilter },
      select: { id: true, status: true, startTime: true, endTime: true },
    });

    const skipped: Array<{ id: string; reason: string }> = [];
    const updatable = records.filter((r) => {
      if (r.status === action) {
        skipped.push({ id: r.id, reason: "السجل في هذه الحالة أصلاً" });
        return false;
      }
      if (r.status === "cancelled") {
        skipped.push({ id: r.id, reason: "السجل ملغى — لا يمكن تعديله" });
        return false;
      }
      return true;
    });

    if (updatable.length === 0) {
      return NextResponse.json({ updated: 0, skipped, totalHours: 0 });
    }

    const totalHours = updatable.reduce((s, r) => {
      let end = new Date(r.endTime).getTime();
      const start = new Date(r.startTime).getTime();
      if (end <= start) end += 86_400_000;
      return s + Math.max(0, (end - start) / 3600000);
    }, 0);

    // ★ المعاملة الواحدة عبر runTx — اعتماد 200 سجل ببدءٍ مضمون (maxWait=10s
    //    + إعادة على P2028 العابر) — بلا تغيير في الدلالة (كل أو لا شيء)
    await runTx(
      async (tx) => {
      for (const r of updatable) {
        await tx.workHours.update({
          where: { id: r.id },
          data: {
            status: action,
            approvedById: currentUser.id,
            approvedAt: new Date(),
            rejectionReason: action === "rejected" ? reason : null,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          clubId: currentUser.clubId!,
          userId: currentUser.id,
          action: action === "approved" ? "work_hour_bulk_approve" : "work_hour_bulk_reject",
          entityType: "WorkHours",
          entityId: null,
          description:
            action === "approved"
              ? `اعتماد ${updatable.length} سجل ساعات عمل دفعة واحدة (${Math.round(totalHours * 100) / 100} ساعة)`
              : `رفض ${updatable.length} سجل ساعات عمل دفعة واحدة — السبب: ${reason}`,
          metadata: JSON.stringify({
            ids: updatable.map((r) => r.id),
            reason: reason || null,
            totalHours: Math.round(totalHours * 100) / 100,
          }),
        },
      }).catch(() => undefined);
    },
      "workhours-approve"
    );

    return NextResponse.json({
      updated: updatable.length,
      skipped,
      totalHours: Math.round(totalHours * 100) / 100,
    });
  } catch (e) {
    console.error("POST workhours/approve:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal" }, { status: 500 });
  }
}

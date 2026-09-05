import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * swimming-days/[id] — تعديل/تعطيل يوم سباحة (admin فقط)
 * ─────────────────────────────────────────────────────
 * ★ التدقيق النهائي: لا حذف فعلي أبداً — DELETE = تعطيل (active=false)
 *   مع بقاء السجل في قاعدة البيانات حفاظاً على التاريخ والمرجعيات،
 *   ويمكن إعادة تفعيله من الإعدادات في أي وقت.
 */

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    const { id } = await params;
    const body = await req.json();
    // حماية: لا حذف عبر PATCH — التعطيل فقط
    if (body && typeof body === "object" && "active" in body) {
      body.active = typeof body.active === "boolean" ? body.active : true;
    }
    const day = await db.swimmingDay.update({ where: { id }, data: body });
    return NextResponse.json({ day });
  } catch (e) { return NextResponse.json({ error: "Internal" }, { status: 500 }); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    const { id } = await params;
    const existing = await db.swimmingDay.findFirst({ where: { id } });
    if (!existing) return NextResponse.json({ error: "اليوم غير موجود" }, { status: 404 });

    // ★ تعطيل ناعم — السجل يبقى محفوظاً للتاريخ (لا حذف فعلي)
    await db.swimmingDay.update({ where: { id }, data: { active: false } });
    await db.auditLog.create({
      data: {
        clubId: existing.clubId,
        userId: user.id,
        action: "swimming_day_deactivate",
        entityType: "SwimmingDay",
        entityId: id,
        description: `تعطيل يوم السباحة «${existing.name}» — السجل محفوظ بدون حذف`,
        metadata: JSON.stringify({ oldValue: { name: existing.name, active: existing.active } }),
      },
    }).catch(() => undefined);
    return NextResponse.json({ success: true, archived: true });
  } catch (e) { return NextResponse.json({ error: "Internal" }, { status: 500 }); }
}

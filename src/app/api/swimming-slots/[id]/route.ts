import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ensureRuntimeColumns } from "@/lib/runtime-schema";

/**
 * swimming-slots/[id] — تعديل/تعطيل حصة سباحة (admin/superadmin فقط)
 * ───────────────────────────────────────────────────────────────
 * فحص الملكية: الحصة يجب أن تنتمي لنادي المستخدم (clubId) — 404 خلاف ذلك.
 * dayOfWeek: مفتاح يوم (sat..fri) أو null (عامة). الأوقات نصوص "HH:mm" حرفية.
 * ★ التدقيق النهائي: لا حذف فعلي أبداً — DELETE = تعطيل (active=false)
 *   مع بقاء الحصة وسجلات ساعات العمل المرتبطة بها محفوظة للتاريخ.
 */

const DAY_KEYS = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"] as const;
type DayKey = (typeof DAY_KEYS)[number];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidDay(v: unknown): v is DayKey {
  return typeof v === "string" && (DAY_KEYS as readonly string[]).includes(v);
}

/** تسمية فريدة per club — تُستخدم عند تغيير الاسم فقط */
async function resolveUniqueName(
  clubId: string,
  desired: string,
  startTime: string,
  excludeId: string
): Promise<string> {
  const rows = await db.swimmingTimeSlot.findMany({
    where: { clubId, id: { not: excludeId } },
    select: { name: true },
  });
  const taken = new Set(rows.map((r) => r.name));
  if (!taken.has(desired)) return desired;
  const withTime = `${desired} ${startTime}`;
  if (!taken.has(withTime)) return withTime;
  let i = 2;
  while (taken.has(`${withTime} (${i})`)) i++;
  return `${withTime} (${i})`;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    if (!user.clubId) {
      return NextResponse.json({ error: "لا يوجد نادي مرتبط بهذا الحساب" }, { status: 400 });
    }
    await ensureRuntimeColumns();

    const { id } = await params;
    // فحص الملكية: الحصة من نفس النادي فقط
    const existing = await db.swimmingTimeSlot.findFirst({ where: { id, clubId: user.clubId } });
    if (!existing) {
      return NextResponse.json({ error: "الحصة غير موجودة" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }

    const data: {
      name?: string;
      startTime?: string;
      endTime?: string;
      dayOfWeek?: string | null;
      maxCapacity?: number;
      sortOrder?: number;
      active?: boolean;
    } = {};

    if (body.startTime !== undefined) {
      const v = typeof body.startTime === "string" ? body.startTime.trim() : "";
      if (!TIME_RE.test(v)) return NextResponse.json({ error: "وقت البداية غير صالح (HH:mm)" }, { status: 400 });
      data.startTime = v;
    }
    if (body.endTime !== undefined) {
      const v = typeof body.endTime === "string" ? body.endTime.trim() : "";
      if (!TIME_RE.test(v)) return NextResponse.json({ error: "وقت النهاية غير صالح (HH:mm)" }, { status: 400 });
      data.endTime = v;
    }
    if (body.dayOfWeek !== undefined) {
      // null أو "" → عامة (كل الأيام)؛ قيمة غير فارغة يجب أن تكون مفتاح يوم صالح
      if (body.dayOfWeek === null || body.dayOfWeek === "") {
        data.dayOfWeek = null;
      } else if (isValidDay(body.dayOfWeek)) {
        data.dayOfWeek = body.dayOfWeek;
      } else {
        return NextResponse.json({ error: "يوم غير صالح" }, { status: 400 });
      }
    }
    if (body.maxCapacity !== undefined) {
      data.maxCapacity = typeof body.maxCapacity === "number" && Number.isFinite(body.maxCapacity) && body.maxCapacity >= 1
        ? Math.floor(body.maxCapacity) : 30;
    }
    if (body.sortOrder !== undefined) {
      data.sortOrder = typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)
        ? Math.floor(body.sortOrder) : 0;
    }
    if (body.active !== undefined) {
      data.active = typeof body.active === "boolean" ? body.active : true;
    }
    if (body.name !== undefined) {
      const desired = typeof body.name === "string" ? body.name.trim() : "";
      if (desired && desired !== existing.name) {
        const startForSuffix = data.startTime || existing.startTime;
        data.name = await resolveUniqueName(user.clubId, desired, startForSuffix, id);
      } else if (desired) {
        data.name = desired; // نفس الاسم الحالي — بلا تغيير
      }
      // اسم فارغ في التعديل → يُتجاهل (يحتفظ بالاسم الحالي)
    }

    const slot = await db.swimmingTimeSlot.update({ where: { id }, data });
    return NextResponse.json({ slot });
  } catch (e) {
    console.error("PATCH swimming-slots/[id]:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    if (!user.clubId) {
      return NextResponse.json({ error: "لا يوجد نادي مرتبط بهذا الحساب" }, { status: 400 });
    }
    await ensureRuntimeColumns();

    const { id } = await params;
    // فحص الملكية: الحصة من نفس النادي فقط
    const existing = await db.swimmingTimeSlot.findFirst({ where: { id, clubId: user.clubId } });
    if (!existing) {
      return NextResponse.json({ error: "الحصة غير موجودة" }, { status: 404 });
    }
    // ★ تعطيل ناعم — الحصة وسجلات الساعات المرتبطة بها تبقى محفوظة (لا حذف فعلي)
    await db.swimmingTimeSlot.update({ where: { id }, data: { active: false } });
    await db.auditLog.create({
      data: {
        clubId: user.clubId,
        userId: user.id,
        action: "swimming_slot_deactivate",
        entityType: "SwimmingTimeSlot",
        entityId: id,
        description: `تعطيل حصة السباحة «${existing.name}» — السجل محفوظ بدون حذف`,
        metadata: JSON.stringify({ oldValue: { name: existing.name, startTime: existing.startTime, endTime: existing.endTime, active: existing.active } }),
      },
    }).catch(() => undefined);
    return NextResponse.json({ success: true, archived: true });
  } catch (e) {
    console.error("DELETE swimming-slots/[id]:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

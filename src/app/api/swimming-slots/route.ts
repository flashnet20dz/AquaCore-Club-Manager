import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ensureSwimDefaults } from "@/lib/feature-defaults";
import { ensureRuntimeColumns } from "@/lib/runtime-schema";

/**
 * swimming-slots — حصص السباحة (SwimmingTimeSlot)
 * ─────────────────────────────────────────────────
 * GET  : كل حصص النادي مرتبة بـ sortOrder ثم startTime — أو حصص يوم محدد
 *        عبر ?day=sun (يشمل حصص dayOfWeek=null العامة).
 * POST : إنشاء حصة (admin/superadmin فقط) مع دعم dayOfWeek وتسمية فريدة per club.
 *
 * الأوقات نصوص "HH:mm" حرفية (wall-clock) — بلا أي تحويل توقيت.
 */

const DAY_KEYS = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"] as const;
type DayKey = (typeof DAY_KEYS)[number];

// HH:mm — 00:00 حتى 23:59
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidDay(v: unknown): v is DayKey {
  return typeof v === "string" && (DAY_KEYS as readonly string[]).includes(v);
}

/**
 * تسمية فريدة per club (@@unique([clubId, name])).
 * لو تكرر الاسم المطلوب: نجرّب «{الاسم} {startTime}» ثم نضيف عدّاداً.
 */
async function resolveUniqueName(
  clubId: string,
  desired: string,
  startTime: string,
  excludeId?: string
): Promise<string> {
  const rows = await db.swimmingTimeSlot.findMany({
    where: { clubId, ...(excludeId ? { id: { not: excludeId } } : {}) },
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

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.clubId) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    // ★ عمود dayOfWeek يُضاف ذاتياً في إنتاج PostgreSQL قبل أي استعلام يستخدمه
    await ensureRuntimeColumns();
    // بذر تلقائي مرة واحدة للنوادي الجديدة (إصلاح: توقيتات السباحة فارغة)
    await ensureSwimDefaults(db, user.clubId).catch(() => null);

    // فلتر اختياري ?day=sun → حصص هذا اليوم + الحصص العامة (dayOfWeek=null)
    const day = req.nextUrl.searchParams.get("day");
    const where = isValidDay(day)
      ? { clubId: user.clubId, OR: [{ dayOfWeek: day }, { dayOfWeek: null }] }
      : { clubId: user.clubId };

    const slots = await db.swimmingTimeSlot.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { startTime: "asc" }],
    });
    return NextResponse.json({ slots });
  } catch (e) {
    console.error("GET swimming-slots:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    if (!user.clubId) {
      return NextResponse.json({ error: "لا يوجد نادي مرتبط بهذا الحساب" }, { status: 400 });
    }
    await ensureRuntimeColumns();

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }

    const startTime = typeof body.startTime === "string" ? body.startTime.trim() : "";
    const endTime = typeof body.endTime === "string" ? body.endTime.trim() : "";
    if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
      return NextResponse.json({ error: "وقت البداية والنهاية مطلوبان بصيغة HH:mm" }, { status: 400 });
    }

    // dayOfWeek: مفتاح يوم صالح أو null/"" (عامة — تظهر كل الأيام)
    const rawDay = body.dayOfWeek;
    let dayOfWeek: string | null = null;
    if (rawDay !== undefined && rawDay !== null && rawDay !== "") {
      if (!isValidDay(rawDay)) {
        return NextResponse.json({ error: "يوم غير صالح" }, { status: 400 });
      }
      dayOfWeek = rawDay;
    }

    // الاسم اختياري — الافتراضي «حصة سباحة» — فريد per club (لاحققة وقت عند التكرار)
    const desiredName = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "حصة سباحة";
    const name = await resolveUniqueName(user.clubId, desiredName, startTime);

    const maxCapacity = typeof body.maxCapacity === "number" && Number.isFinite(body.maxCapacity) && body.maxCapacity >= 1
      ? Math.floor(body.maxCapacity) : 30;
    const sortOrder = typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)
      ? Math.floor(body.sortOrder) : 0;
    const active = typeof body.active === "boolean" ? body.active : true;

    try {
      const slot = await db.swimmingTimeSlot.create({
        data: { clubId: user.clubId, name, startTime, endTime, dayOfWeek, maxCapacity, sortOrder, active },
      });
      return NextResponse.json({ slot }, { status: 201 });
    } catch (err) {
      // سباق تسمية نادر (P2002) — أعِد المحاولة بلاحقة وقت
      if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
        const fallback = await resolveUniqueName(user.clubId, `${name} ${startTime}`, startTime);
        const slot = await db.swimmingTimeSlot.create({
          data: { clubId: user.clubId, name: fallback, startTime, endTime, dayOfWeek, maxCapacity, sortOrder, active },
        });
        return NextResponse.json({ slot }, { status: 201 });
      }
      throw err;
    }
  } catch (e) {
    console.error("POST swimming-slots:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

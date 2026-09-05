import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ensureSwimDefaults } from "@/lib/feature-defaults";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !user.clubId) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    // بذر تلقائي مرة واحدة للنوادي الجديدة (إصلاح: أيام السباحة فارغة)
    await ensureSwimDefaults(db, user.clubId).catch(() => null);
    const days = await db.swimmingDay.findMany({
      where: { clubId: user.clubId },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json({ days });
  } catch (e) {
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

/** استعادة الأيام والتوقيتات الافتراضية يدوياً (زر في الإعدادات) */
export async function PUT() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin" || !user.clubId)
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    const result = await ensureSwimDefaults(db, user.clubId, true);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    if (!user.clubId) return NextResponse.json({ error: "لا يوجد نادي مرتبط بهذا الحساب" }, { status: 400 });
    const body = await req.json();
    try {
      const day = await db.swimmingDay.create({ data: { ...body, clubId: user.clubId } });
      return NextResponse.json({ day }, { status: 201 });
    } catch (err) {
      // ★ الأرشفة الناعمة: يوم بنفس الاسم موجود (فريد per club)
      if ((err as { code?: string })?.code === "P2002") {
        const name = typeof body?.name === "string" ? body.name.trim() : "";
        const clash = name
          ? await db.swimmingDay.findFirst({ where: { clubId: user.clubId, name } })
          : null;
        if (clash && !clash.active) {
          // يوماً معطّلاً بنفس الاسم → إعادة تفعيله مع تحديث خصائصه (لا ازدواج سجل)
          const day = await db.swimmingDay.update({
            where: { id: clash.id },
            data: {
              active: true,
              shortName: typeof body?.shortName === "string" ? body.shortName : clash.shortName,
              color: typeof body?.color === "string" ? body.color : clash.color,
              sortOrder: typeof body?.sortOrder === "number" ? body.sortOrder : clash.sortOrder,
            },
          });
          return NextResponse.json({ day, reactivated: true }, { status: 201 });
        }
        return NextResponse.json({ error: "يوم بنفس الاسم موجود مسبقاً" }, { status: 409 });
      }
      throw err;
    }
  } catch (e) {
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

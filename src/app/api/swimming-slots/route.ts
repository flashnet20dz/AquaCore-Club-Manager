import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ensureSwimDefaults } from "@/lib/feature-defaults";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !user.clubId) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    // بذر تلقائي مرة واحدة للنوادي الجديدة (إصلاح: توقيتات السباحة فارغة)
    await ensureSwimDefaults(db, user.clubId).catch(() => null);
    const slots = await db.swimmingTimeSlot.findMany({
      where: { clubId: user.clubId },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json({ slots });
  } catch (e) { return NextResponse.json({ error: "Internal" }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    const body = await req.json();
    const slot = await db.swimmingTimeSlot.create({ data: { ...body, clubId: user.clubId } });
    return NextResponse.json({ slot }, { status: 201 });
  } catch (e) { return NextResponse.json({ error: "Internal" }, { status: 500 }); }
}

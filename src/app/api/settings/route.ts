import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDefaultSettings, getCurrentUser } from "@/lib/session";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    // Self-heal: ensure default settings exist
    await ensureDefaultSettings();

    const settings = currentUser.role === "superadmin"
      ? []
      : await db.setting.findMany({
          where: { clubId: currentUser.clubId! },
        });
    const map: Record<string, string> = {};
    for (const s of settings) map[s.key] = s.value;
    return NextResponse.json({ settings: map });
  } catch (e) {
    console.error("GET settings:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const clubId = currentUser.clubId;
    if (!clubId) {
      return NextResponse.json({ error: "لا يوجد نادي مرتبط بهذا الحساب" }, { status: 400 });
    }

    const body = await req.json();
    const { settings } = body as { settings: Record<string, string> };

    for (const [key, value] of Object.entries(settings)) {
      await db.setting.upsert({
        where: { clubId_key: { clubId, key } },
        update: { value },
        create: { clubId, key, value },
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("PUT settings error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}

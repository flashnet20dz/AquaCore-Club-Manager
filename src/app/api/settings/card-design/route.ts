import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

const SETTING_KEY = "cardDesignSettings";

// GET /api/settings/card-design
// Returns the saved card design settings (or defaults if not saved yet)
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    // Superadmin without clubId → return defaults
    const clubId = currentUser.clubId;
    if (!clubId) {
      return NextResponse.json({ isDefault: true });
    }

    const setting = await db.setting.findUnique({
      where: { clubId_key: { clubId, key: SETTING_KEY } },
    });

    if (setting) {
      try {
        return NextResponse.json(JSON.parse(setting.value));
      } catch {
        // fall through to defaults
      }
    }
    return NextResponse.json({ isDefault: true });
  } catch (error) {
    console.error("Error getting card design settings:", error);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}

// POST /api/settings/card-design
// Saves card design settings (overwrites previous)
export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const clubId = currentUser.clubId;
    if (!clubId) {
      return NextResponse.json({ error: "لا يوجد نادي مرتبط بهذا الحساب" }, { status: 400 });
    }

    const body = await request.json();
    const { settings } = body;

    if (!settings) {
      return NextResponse.json({ error: "الإعدادات مطلوبة" }, { status: 400 });
    }

    const value = JSON.stringify({ ...settings, isDefault: false, savedAt: new Date().toISOString() });

    await db.setting.upsert({
      where: { clubId_key: { clubId, key: SETTING_KEY } },
      update: { value },
      create: { clubId, key: SETTING_KEY, value },
    });

    return NextResponse.json({ success: true, settings: JSON.parse(value) });
  } catch (error) {
    console.error("Error saving card design settings:", error);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}

// DELETE /api/settings/card-design
// Resets to defaults (removes saved settings)
export async function DELETE() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const clubId = currentUser.clubId;
    if (!clubId) {
      return NextResponse.json({ error: "لا يوجد نادي مرتبط بهذا الحساب" }, { status: 400 });
    }

    await db.setting.deleteMany({
      where: { clubId, key: SETTING_KEY },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error resetting card design settings:", error);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}

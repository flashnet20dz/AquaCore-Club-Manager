import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { randomBytes } from "crypto";

/**
 * POST /api/sync/generate-key — يولّد (أو يجدّد) مفتاح المزامنة لنادي المستخدم الحالي.
 */
export async function POST(_req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.clubId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }
    if (!["admin", "superadmin"].includes(currentUser.role)) {
      return NextResponse.json({ error: "صلاحية المدير مطلوبة" }, { status: 403 });
    }

    const key = `rcs_sync_${randomBytes(24).toString("hex")}`;
    const club = await db.club.update({
      where: { id: currentUser.clubId },
      data: { syncApiKey: key },
    });

    return NextResponse.json({ syncApiKey: club.syncApiKey });
  } catch (e) {
    console.error("POST /api/sync/generate-key:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

/**
 * GET /api/sync/generate-key — يرجع المفتاح الحالي (إن وُجد) بدون تجديده.
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.clubId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }
    const club = await db.club.findUnique({ where: { id: currentUser.clubId } });
    return NextResponse.json({ syncApiKey: club?.syncApiKey || null });
  } catch (e) {
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

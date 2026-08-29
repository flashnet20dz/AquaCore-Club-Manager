import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * GET /api/super-admin/clubs
 * SuperAdmin: قائمة كل النوادي (مبسّطة)
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const clubs = await db.club.findMany({
      select: {
        id: true,
        name: true,
        city: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ clubs });
  } catch (e) {
    console.error("GET /api/super-admin/clubs error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const url = new URL(req.url);
    const unreadOnly = url.searchParams.get("unreadOnly") === "true";

    const clubFilter = user.role === "superadmin" ? {} : { clubId: user.clubId! };
    const where: Record<string, unknown> = {
      ...clubFilter,
      OR: [{ userId: user.id }, { userId: null }],
    };
    if (unreadOnly) where.read = false;

    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const unreadCount = await db.notification.count({
      where: { ...clubFilter, OR: [{ userId: user.id }, { userId: null }], read: false },
    });

    return NextResponse.json({ notifications, unreadCount });
  } catch (e) {
    console.error("GET notifications:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const body = await req.json();
    const { action, id } = body;

    const clubFilter = user.role === "superadmin" ? {} : { clubId: user.clubId! };

    if (action === "markRead" && id) {
      // Verify ownership before updating
      const existing = await db.notification.findFirst({ where: { id, ...clubFilter } });
      if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
      await db.notification.update({
        where: { id },
        data: { read: true },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "markAllRead") {
      await db.notification.updateMany({
        where: { ...clubFilter, OR: [{ userId: user.id }, { userId: null }], read: false },
        data: { read: true },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "clearRead") {
      // 🆕 حذف جماعي للإشعارات المقروءة
      const result = await db.notification.deleteMany({
        where: { ...clubFilter, OR: [{ userId: user.id }, { userId: null }], read: true },
      });
      return NextResponse.json({ success: true, deleted: result.count });
    }

    if (action === "delete" && id) {
      const existing = await db.notification.findFirst({ where: { id, ...clubFilter } });
      if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
      await db.notification.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  } catch (e) {
    console.error("POST notifications:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

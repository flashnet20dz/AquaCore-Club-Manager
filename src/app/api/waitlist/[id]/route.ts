import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * PATCH /api/waitlist/[id]
 * body: { action: "cancel" | "notify" | "convert", convertedSubscriberId? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { id } = await params;
    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const entry = await db.waitlist.findFirst({ where: { id, ...clubFilter } });
    if (!entry) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

    const body = await req.json();

    if (body.action === "cancel") {
      const updated = await db.waitlist.update({ where: { id }, data: { status: "cancelled" } });
      return NextResponse.json({ entry: updated });
    }

    if (body.action === "notify") {
      const updated = await db.waitlist.update({
        where: { id }, data: { status: "notified", notifiedAt: new Date() },
      });
      return NextResponse.json({ entry: updated });
    }

    if (body.action === "convert") {
      const updated = await db.waitlist.update({
        where: { id },
        data: {
          status: "converted",
          convertedAt: new Date(),
          convertedSubscriberId: body.convertedSubscriberId || null,
        },
      });
      return NextResponse.json({ entry: updated });
    }

    return NextResponse.json({ error: "action غير معروف" }, { status: 400 });
  } catch (e) {
    console.error("PATCH /api/waitlist/[id]:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

/**
 * DELETE /api/waitlist/[id] — حذف نهائي (مثلاً إدخال بالخطأ)
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { id } = await params;
    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };
    const entry = await db.waitlist.findFirst({ where: { id, ...clubFilter } });
    if (!entry) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

    await db.waitlist.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/waitlist/[id]:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

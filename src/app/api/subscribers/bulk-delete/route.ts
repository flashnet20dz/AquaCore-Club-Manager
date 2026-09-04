import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasPermission(currentUser.role, "subscribers")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await req.json();
    const { ids } = body as { ids: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "لا توجد عناصر محددة" }, { status: 400 });
    }

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };

    // Get names for activity log before deletion
    const subs = await db.subscriber.findMany({
      where: { id: { in: ids }, ...clubFilter },
      select: { id: true, lastName: true, firstName: true, fileNumber: true },
    });

    const result = await db.subscriber.deleteMany({
      where: { id: { in: ids }, ...clubFilter },
    });

    // Log activity
    await db.activity.create({
      data: {
        clubId: currentUser.clubId!,
        type: "delete",
        description: `تم حذف ${result.count} منخرط بشكل جماعي`,
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      deleted: subs.map((s) => ({ id: s.id, name: `${s.lastName} ${s.firstName}`, fileNumber: s.fileNumber })),
    });
  } catch (e) {
    console.error("Bulk delete:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

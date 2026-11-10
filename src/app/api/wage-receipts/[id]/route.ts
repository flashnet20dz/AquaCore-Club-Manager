import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { hasPermission } from "@/lib/roles";

/**
 * GET /api/wage-receipts/[id]
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.clubId || !hasPermission(user.role, "wageReceipts")) {
      return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 403 });
    }

    const { id } = await params;
    const receipt = await db.wageReceipt.findFirst({
      where: { id, clubId: user.clubId },
    });

    if (!receipt) {
      return NextResponse.json({ error: "الوصل غير موجود" }, { status: 404 });
    }

    return NextResponse.json({ receipt });
  } catch (error) {
    console.error("Error in GET /api/wage-receipts/[id]:", error);
    return NextResponse.json({ error: "فشل في جلب الوصل" }, { status: 500 });
  }
}

/**
 * DELETE /api/wage-receipts/[id]
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.clubId || !["admin", "superadmin"].includes(user.role)) {
      return NextResponse.json({ error: "غير مصرح لك بحذف الوصل" }, { status: 403 });
    }

    const { id } = await params;
    await db.wageReceipt.deleteMany({
      where: { id, clubId: user.clubId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/wage-receipts/[id]:", error);
    return NextResponse.json({ error: "فشل في حذف الوصل" }, { status: 500 });
  }
}

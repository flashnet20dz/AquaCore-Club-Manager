import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { auditLogWithRequest } from "@/lib/audit";

/**
 * POST /api/super-admin/club-groups/[id]/members
 * Body: { clubIds: string[] }  — إضافة نوادي للمجموعة
 *
 * DELETE /api/super-admin/club-groups/[id]/members?clubId=xxx
 * حذف نادٍ من المجموعة
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    const { id } = await params;
    const body = await req.json();
    const { clubIds } = body;
    if (!Array.isArray(clubIds) || clubIds.length === 0) {
      return NextResponse.json({ error: "clubIds مطلوبة" }, { status: 400 });
    }

    // إضافة (تجاهل الموجود بالفعل)
    const created = await db.clubGroupMember.createMany({
      data: clubIds.map((clubId: string) => ({ groupId: id, clubId })),
      skipDuplicates: true,
    });

    await auditLogWithRequest(req, currentUser, {
      action: "update", entityType: "club_group", entityId: id,
      description: `إضافة ${created.count} نادٍ للمجموعة`,
    });

    return NextResponse.json({ success: true, added: created.count });
  } catch (e) {
    console.error("POST members error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    const { id } = await params;
    const url = new URL(req.url);
    const clubId = url.searchParams.get("clubId");
    if (!clubId) return NextResponse.json({ error: "clubId مطلوب" }, { status: 400 });

    await db.clubGroupMember.deleteMany({ where: { groupId: id, clubId } });

    await auditLogWithRequest(req, currentUser, {
      action: "update", entityType: "club_group", entityId: id,
      description: `حذف نادٍ من المجموعة`,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE member error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

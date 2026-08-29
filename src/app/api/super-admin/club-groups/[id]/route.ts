import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { auditLogWithRequest } from "@/lib/audit";

/**
 * GET /api/super-admin/club-groups/[id]
 * PATCH /api/super-admin/club-groups/[id]
 * DELETE /api/super-admin/club-groups/[id]
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    const { id } = await params;
    const group = await db.clubGroup.findUnique({
      where: { id },
      include: { members: { include: { club: { select: { id: true, name: true, city: true, status: true } } } } },
    });
    if (!group) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    return NextResponse.json({
      group: {
        id: group.id, name: group.name, description: group.description, color: group.color,
        members: group.members.map((m) => ({ id: m.id, clubId: m.clubId, clubName: m.club.name, city: m.club.city, status: m.club.status })),
      },
    });
  } catch (e) {
    console.error("GET club-group error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    const { id } = await params;
    const body = await req.json();
    const group = await db.clubGroup.update({ where: { id }, data: { name: body.name, description: body.description, color: body.color } });
    await auditLogWithRequest(req, currentUser, { action: "update", entityType: "club_group", entityId: id, description: `تحديث مجموعة: ${body.name}` });
    return NextResponse.json({ group });
  } catch (e) {
    console.error("PATCH club-group error:", e);
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
    const g = await db.clubGroup.findUnique({ where: { id } });
    await db.clubGroup.delete({ where: { id } });
    await auditLogWithRequest(req, currentUser, { action: "delete", entityType: "club_group", entityId: id, description: `حذف مجموعة: ${g?.name || id}` });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE club-group error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

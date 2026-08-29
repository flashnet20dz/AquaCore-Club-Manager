import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { auditLogWithRequest } from "@/lib/audit";

/**
 * GET /api/super-admin/club-groups
 * POST /api/super-admin/club-groups
 * SuperAdmin: قائمة/إنشاء مجموعات النوادي
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const groups = await db.clubGroup.findMany({
      include: {
        _count: { select: { members: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        color: g.color,
        memberCount: g._count.members,
        createdAt: g.createdAt,
      })),
    });
  } catch (e) {
    console.error("GET club-groups error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, color = "#0f766e" } = body;
    if (!name) return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 });

    const group = await db.clubGroup.create({ data: { name, description, color } });

    await auditLogWithRequest(req, currentUser, {
      action: "create", entityType: "club_group", entityId: group.id,
      description: `إنشاء مجموعة نوادي: ${name}`,
    });

    return NextResponse.json({ group }, { status: 201 });
  } catch (e) {
    console.error("POST club-group error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

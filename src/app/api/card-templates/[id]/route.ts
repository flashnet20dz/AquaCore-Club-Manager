import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { auditLogWithRequest } from "@/lib/audit";

/**
 * GET /api/card-templates/[id] — تفاصيل قالب
 * PATCH /api/card-templates/[id] — تحديث قالب
 * DELETE /api/card-templates/[id] — حذف قالب
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    const { id } = await params;

    const template = await db.cardTemplate.findUnique({ where: { id } });
    if (!template) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

    // تحقق الصلاحية
    if (template.clubId && currentUser.role !== "superadmin" && template.clubId !== currentUser.clubId && !template.isShared) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    return NextResponse.json({
      template: {
        ...template,
        layout: template.layout ? JSON.parse(template.layout) : {},
      },
    });
  } catch (e) {
    console.error("GET card-template error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.clubId) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    const { id } = await params;
    const body = await req.json();

    const existing = await db.cardTemplate.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

    const data: Record<string, unknown> = {};
    const allowed = ["name", "description", "cardSize", "orientation", "width", "height", "thumbnail", "isDefault", "isShared", "version"];
    for (const f of allowed) {
      if (f in body) data[f] = body[f];
    }
    if (body.layout !== undefined) {
      data.layout = typeof body.layout === "string" ? body.layout : JSON.stringify(body.layout);
    }

    // إذا أصبح افتراضياً، ألغِ بقية الافتراضيات
    if (body.isDefault) {
      await db.cardTemplate.updateMany({
        where: { clubId: currentUser.clubId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const template = await db.cardTemplate.update({ where: { id }, data });

    await auditLogWithRequest(req, currentUser, {
      action: "update", entityType: "card_template", entityId: id,
      description: `تحديث قالب بطاقة: ${existing.name}`,
    });

    return NextResponse.json({ template });
  } catch (e) {
    console.error("PATCH card-template error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.clubId) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    const { id } = await params;

    const existing = await db.cardTemplate.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

    await db.cardTemplate.delete({ where: { id } });

    await auditLogWithRequest(req, currentUser, {
      action: "delete", entityType: "card_template", entityId: id,
      description: `حذف قالب بطاقة: ${existing.name}`,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE card-template error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

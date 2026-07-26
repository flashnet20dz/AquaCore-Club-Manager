import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { auditLogWithRequest } from "@/lib/audit";

/**
 * GET /api/card-templates
 * قائمة قوالب البطاقات (خاصة بالنادي + مشتركة)
 *
 * POST /api/card-templates
 * إنشاء قالب جديد
 * Body: { name, description, cardSize, orientation, width, height, layout, thumbnail, isDefault }
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const where = currentUser.role === "superadmin"
      ? {}
      : { OR: [{ clubId: currentUser.clubId }, { isShared: true }] };

    const templates = await db.cardTemplate.findMany({
      where,
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true, name: true, description: true, cardSize: true,
        orientation: true, width: true, height: true,
        thumbnail: true, isDefault: true, isShared: true,
        version: true, createdAt: true, updatedAt: true,
        clubId: true,
      },
    });

    return NextResponse.json({ templates });
  } catch (e) {
    console.error("GET card-templates error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.clubId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, cardSize, orientation, width, height, layout, thumbnail, isDefault, isShared } = body;

    if (!name) {
      return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 });
    }

    // إذا كان قالباً افتراضياً، ألغِ الافتراضية عن البقية
    if (isDefault) {
      await db.cardTemplate.updateMany({
        where: { clubId: currentUser.clubId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await db.cardTemplate.create({
      data: {
        clubId: currentUser.role === "superadmin" ? null : currentUser.clubId,
        name,
        description: description || null,
        cardSize: cardSize || "CR80",
        orientation: orientation || "landscape",
        width: width || 10,
        height: height || 6.5,
        layout: typeof layout === "string" ? layout : JSON.stringify(layout || {}),
        thumbnail: thumbnail || null,
        isDefault: isDefault || false,
        isShared: isShared && currentUser.role === "superadmin" ? true : false,
        createdById: currentUser.id,
      },
    });

    await auditLogWithRequest(req, currentUser, {
      action: "create",
      entityType: "card_template",
      entityId: template.id,
      description: `إنشاء قالب بطاقة: ${name}`,
      metadata: { cardSize, orientation },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (e) {
    console.error("POST card-template error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

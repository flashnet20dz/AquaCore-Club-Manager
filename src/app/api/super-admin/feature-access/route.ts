import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { auditLogWithRequest } from "@/lib/audit";

/**
 * POST /api/super-admin/feature-access
 * SuperAdmin: تطبيق إعداد ميزة على نطاق (all/club/group)
 *
 * Body:
 *   { featureId, scope: "ALL_CLUBS"|"CLUB_SPECIFIC"|"CLUB_GROUP",
 *     clubId?, clubGroupId?, overrides: { enabled, visible, ... } }
 *
 * GET /api/super-admin/feature-access?featureId=xxx
 *   قائمة كل overrides لميزة معيّنة
 */
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

    const url = new URL(req.url);
    const featureId = url.searchParams.get("featureId");
    const clubId = url.searchParams.get("clubId");

    const where: Record<string, unknown> = {};
    if (featureId) where.featureId = featureId;
    if (clubId) where.clubId = clubId;

    const access = await db.featureAccess.findMany({
      where,
      include: {
        feature: { select: { key: true, name: true } },
        club: { select: { name: true } },
        clubGroup: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      access: access.map((a) => ({
        id: a.id,
        featureId: a.featureId,
        featureKey: a.feature.key,
        featureName: a.feature.name,
        scope: a.scope,
        clubId: a.clubId,
        clubName: a.club?.name || null,
        clubGroupId: a.clubGroupId,
        clubGroupName: a.clubGroup?.name || null,
        enabled: a.enabled,
        visible: a.visible,
        readOnly: a.readOnly,
        allowEdit: a.allowEdit,
        allowDelete: a.allowDelete,
        allowPrint: a.allowPrint,
        allowExport: a.allowExport,
        updatedAt: a.updatedAt,
      })),
    });
  } catch (e) {
    console.error("GET feature-access error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

    const body = await req.json();
    const { featureId, scope = "ALL_CLUBS", clubId = null, clubGroupId = null, overrides } = body;

    if (!featureId) return NextResponse.json({ error: "featureId مطلوب" }, { status: 400 });

    // upsert: ابحث عن سجل مطابق ثم حدّث أو أنشئ
    const existing = await db.featureAccess.findFirst({
      where: { featureId, scope, clubId, clubGroupId },
    });

    const data: Record<string, unknown> = {
      featureId, scope, clubId, clubGroupId,
      updatedById: currentUser.id,
      ...overrides,
    };

    let access;
    if (existing) {
      access = await db.featureAccess.update({ where: { id: existing.id }, data });
    } else {
      access = await db.featureAccess.create({ data });
    }

    await auditLogWithRequest(req, currentUser, {
      action: "update",
      entityType: "feature_access",
      entityId: access.id,
      description: `تطبيق إعداد ميزة ${featureId} — النطاق: ${scope}`,
      metadata: { featureId, scope, clubId, clubGroupId, overrides },
    });

    return NextResponse.json({ success: true, access });
  } catch (e) {
    console.error("POST feature-access error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

    await db.featureAccess.delete({ where: { id } });

    await auditLogWithRequest(req, currentUser, {
      action: "delete",
      entityType: "feature_access",
      entityId: id,
      description: `حذف override وصول ميزة`,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE feature-access error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

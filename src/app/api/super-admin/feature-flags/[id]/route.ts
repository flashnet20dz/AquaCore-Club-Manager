import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { auditLogWithRequest } from "@/lib/audit";

/**
 * PATCH /api/super-admin/feature-flags/[id]
 * SuperAdmin: تحديث ميزة
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json();
    const existing = await db.featureFlag.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "الميزة غير موجودة" }, { status: 404 });

    const allowedFields = [
      "name", "description", "category", "enabled", "visible", "readOnly",
      "allowEdit", "allowDelete", "allowPrint", "allowExport",
      "isBeta", "isPremium", "minVersion", "platforms", "countries", "plans", "icon", "sortOrder",
    ];
    const data: Record<string, unknown> = {};
    const changes: Record<string, { old: unknown; new: unknown }> = {};
    for (const f of allowedFields) {
      if (f in body) {
        data[f] = body[f];
        if ((existing as any)[f] !== body[f]) changes[f] = { old: (existing as any)[f], new: body[f] };
      }
    }

    const feature = await db.featureFlag.update({ where: { id }, data });

    await auditLogWithRequest(req, currentUser, {
      action: "update",
      entityType: "feature_flag",
      entityId: id,
      description: `تحديث ميزة: ${existing.name} (${existing.key})`,
      metadata: changes,
    });

    return NextResponse.json({ feature });
  } catch (e) {
    console.error("PATCH feature-flag error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const { id } = await params;
    const existing = await db.featureFlag.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "الميزة غير موجودة" }, { status: 404 });

    await db.featureFlag.delete({ where: { id } });
    await auditLogWithRequest(req, currentUser, {
      action: "delete", entityType: "feature_flag", entityId: id,
      description: `حذف ميزة: ${existing.name} (${existing.key})`,
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE feature-flag error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

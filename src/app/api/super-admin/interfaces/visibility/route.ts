import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { auditLogWithRequest } from "@/lib/audit";

/**
 * PATCH /api/super-admin/interfaces/visibility
 * SuperAdmin: تبديل ظهور واجهة (عامة لكل النوادي أو نادٍ محدد)
 * Body: { interfaceKey, isVisible, scope: "ALL_CLUBS", clubId? }
 */
export async function PATCH(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await req.json();
    const { interfaceKey, isVisible, scope = "ALL_CLUBS", clubId = null } = body;

    if (!interfaceKey) {
      return NextResponse.json({ error: "interfaceKey مطلوب" }, { status: 400 });
    }

    // ابحث أو أنشئ السجل
    const where = scope === "CLUB_SPECIFIC" && clubId
      ? { interfaceKey_clubId: { interfaceKey, clubId } }
      : { interfaceKey_clubId: { interfaceKey, clubId: null as any } };

    const existing = await db.uIConfiguration.findFirst({
      where: { interfaceKey, clubId: clubId || null },
    });

    let config;
    if (existing) {
      config = await db.uIConfiguration.update({
        where: { id: existing.id },
        data: { isVisible, updatedById: currentUser.id },
      });
    } else {
      // أنشئ — نحتاج interfaceName من body أو افتراضي
      config = await db.uIConfiguration.create({
        data: {
          interfaceKey,
          interfaceName: body.interfaceName || interfaceKey,
          scope,
          clubId: clubId || null,
          isVisible,
          settings: "{}",
          updatedById: currentUser.id,
        },
      });
    }

    await auditLogWithRequest(req, currentUser, {
      action: "update",
      entityType: "ui_configuration",
      entityId: config.id,
      description: `تبديل ظهور واجهة ${interfaceKey} → ${isVisible ? "مرئية" : "مخفية"}${clubId ? ` (نادي محدد)` : " (كل النوادي)"}`,
      metadata: { interfaceKey, isVisible, scope, clubId },
    });

    return NextResponse.json({ config });
  } catch (e) {
    console.error("PATCH visibility error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

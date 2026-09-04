import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { auditLogWithRequest } from "@/lib/audit";

/**
 * PUT /api/super-admin/interfaces/settings
 * SuperAdmin: تحديث إعدادات واجهة (JSON)
 * Body: { interfaceKey, settings, scope, clubId? }
 */
export async function PUT(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await req.json();
    const { interfaceKey, settings, scope = "ALL_CLUBS", clubId = null } = body;

    if (!interfaceKey || !settings) {
      return NextResponse.json({ error: "interfaceKey و settings مطلوبان" }, { status: 400 });
    }

    const settingsStr = typeof settings === "string" ? settings : JSON.stringify(settings);

    const existing = await db.uIConfiguration.findFirst({
      where: { interfaceKey, clubId: clubId || null },
    });

    let config;
    if (existing) {
      config = await db.uIConfiguration.update({
        where: { id: existing.id },
        data: { settings: settingsStr, updatedById: currentUser.id },
      });
    } else {
      config = await db.uIConfiguration.create({
        data: {
          interfaceKey,
          interfaceName: body.interfaceName || interfaceKey,
          scope,
          clubId: clubId || null,
          isVisible: true,
          settings: settingsStr,
          updatedById: currentUser.id,
        },
      });
    }

    await auditLogWithRequest(req, currentUser, {
      action: "update",
      entityType: "ui_configuration",
      entityId: config.id,
      description: `تحديث إعدادات واجهة ${interfaceKey}`,
      metadata: { interfaceKey, scope, clubId },
    });

    return NextResponse.json({ config });
  } catch (e) {
    console.error("PUT settings error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

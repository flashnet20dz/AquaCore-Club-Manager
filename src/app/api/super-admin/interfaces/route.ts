import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { auditLogWithRequest } from "@/lib/audit";

/**
 * GET /api/super-admin/interfaces
 * SuperAdmin: قائمة كل إعدادات الواجهات (عامة + محددة)
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const configs = await db.uIConfiguration.findMany({
      where: { scope: "ALL_CLUBS" },
      orderBy: { interfaceKey: "asc" },
    });

    return NextResponse.json({
      interfaces: configs.map((c) => ({
        id: c.id,
        interfaceKey: c.interfaceKey,
        interfaceName: c.interfaceName,
        isVisible: c.isVisible,
        settings: c.settings ? JSON.parse(c.settings) : {},
        updatedAt: c.updatedAt,
      })),
    });
  } catch (e) {
    console.error("GET /api/super-admin/interfaces error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/super-admin/interfaces
 * SuperAdmin: إنشاء إعداد واجهة جديد (إن لم يكن موجوداً)
 * Body: { interfaceKey, interfaceName, isVisible, settings }
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await req.json();
    const { interfaceKey, interfaceName, isVisible = true, settings = {} } = body;

    if (!interfaceKey || !interfaceName) {
      return NextResponse.json({ error: "interfaceKey و interfaceName مطلوبان" }, { status: 400 });
    }

    const config = await db.uIConfiguration.create({
      data: {
        interfaceKey,
        interfaceName,
        scope: "ALL_CLUBS",
        clubId: null,
        isVisible,
        settings: JSON.stringify(settings),
        updatedById: currentUser.id,
      },
    });

    await auditLogWithRequest(req, currentUser, {
      action: "create",
      entityType: "ui_configuration",
      entityId: config.id,
      description: `إنشاء إعداد واجهة: ${interfaceName} (${interfaceKey})`,
      metadata: { interfaceKey, isVisible, settings },
    });

    return NextResponse.json({ config }, { status: 201 });
  } catch (e) {
    console.error("POST /api/super-admin/interfaces error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

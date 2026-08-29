import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { auditLogWithRequest } from "@/lib/audit";

/**
 * GET /api/super-admin/clubs/[id]/interfaces
 * SuperAdmin: قائمة واجهات نادٍ محدد (عامة + مخصصة)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;

    // تحقق من وجود النادي
    const club = await db.club.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!club) {
      return NextResponse.json({ error: "النادي غير موجود" }, { status: 404 });
    }

    // اجلب الإعدادات العامة + المخصصة للنادي
    const configs = await db.uIConfiguration.findMany({
      where: {
        OR: [
          { scope: "ALL_CLUBS" },
          { clubId: id },
        ],
      },
      orderBy: { interfaceKey: "asc" },
    });

    // ادمج: الإعداد المخصص للنادي يلغي الإعداد العام
    const merged = new Map<string, any>();
    for (const c of configs) {
      const existing = merged.get(c.interfaceKey);
      // الإعداد المخصص له أولوية
      if (c.scope === "CLUB_SPECIFIC" && c.clubId === id) {
        merged.set(c.interfaceKey, {
          id: c.id,
          interfaceKey: c.interfaceKey,
          interfaceName: c.interfaceName,
          isVisible: c.isVisible,
          settings: c.settings ? JSON.parse(c.settings) : {},
          scope: "CLUB_SPECIFIC",
          isOverridden: true,
          updatedAt: c.updatedAt,
        });
      } else if (!existing) {
        merged.set(c.interfaceKey, {
          id: c.id,
          interfaceKey: c.interfaceKey,
          interfaceName: c.interfaceName,
          isVisible: c.isVisible,
          settings: c.settings ? JSON.parse(c.settings) : {},
          scope: "ALL_CLUBS",
          isOverridden: false,
          updatedAt: c.updatedAt,
        });
      }
    }

    return NextResponse.json({
      club: { id: club.id, name: club.name },
      interfaces: Array.from(merged.values()),
    });
  } catch (e) {
    console.error("GET club interfaces error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * PATCH /api/super-admin/clubs/[id]/interfaces
 * SuperAdmin: تبديل ظهور واجهة لنادٍ محدد (إنشاء override)
 * Body: { interfaceKey, interfaceName?, isVisible, settings? }
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
    const { interfaceKey, interfaceName, isVisible, settings } = body;

    if (!interfaceKey) {
      return NextResponse.json({ error: "interfaceKey مطلوب" }, { status: 400 });
    }

    // ابحث عن override موجود لهذا النادي
    const existing = await db.uIConfiguration.findFirst({
      where: { interfaceKey, clubId: id },
    });

    let config;
    if (existing) {
      config = await db.uIConfiguration.update({
        where: { id: existing.id },
        data: {
          isVisible: isVisible !== undefined ? isVisible : existing.isVisible,
          settings: settings ? JSON.stringify(settings) : existing.settings,
          updatedById: currentUser.id,
        },
      });
    } else {
      config = await db.uIConfiguration.create({
        data: {
          interfaceKey,
          interfaceName: interfaceName || interfaceKey,
          scope: "CLUB_SPECIFIC",
          clubId: id,
          isVisible: isVisible !== undefined ? isVisible : true,
          settings: settings ? JSON.stringify(settings) : "{}",
          updatedById: currentUser.id,
        },
      });
    }

    await auditLogWithRequest(req, currentUser, {
      action: "update",
      entityType: "ui_configuration",
      entityId: config.id,
      description: `تبديل ظهور واجهة ${interfaceKey} للنادي ${id} → ${isVisible ? "مرئية" : "مخفية"}`,
      metadata: { interfaceKey, clubId: id, isVisible },
    });

    return NextResponse.json({ config });
  } catch (e) {
    console.error("PATCH club interface error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

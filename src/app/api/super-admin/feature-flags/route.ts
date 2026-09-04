import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { auditLogWithRequest } from "@/lib/audit";

/**
 * GET /api/super-admin/feature-flags
 * SuperAdmin: قائمة كل الميزات مع إحصاءات access
 *
 * POST /api/super-admin/feature-flags
 * SuperAdmin: إنشاء ميزة جديدة
 */
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const search = url.searchParams.get("search") || "";

    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { key: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ];
    }

    const features = await db.featureFlag.findMany({
      where,
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      include: {
        _count: { select: { access: true } },
      },
    });

    return NextResponse.json({
      features: features.map((f) => ({
        id: f.id,
        key: f.key,
        name: f.name,
        description: f.description,
        category: f.category,
        enabled: f.enabled,
        visible: f.visible,
        readOnly: f.readOnly,
        allowEdit: f.allowEdit,
        allowDelete: f.allowDelete,
        allowPrint: f.allowPrint,
        allowExport: f.allowExport,
        isBeta: f.isBeta,
        isPremium: f.isPremium,
        minVersion: f.minVersion,
        platforms: f.platforms,
        countries: f.countries,
        plans: f.plans,
        icon: f.icon,
        sortOrder: f.sortOrder,
        accessCount: f._count.access,
        updatedAt: f.updatedAt,
      })),
      total: features.length,
    });
  } catch (e) {
    console.error("GET feature-flags error:", e);
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
    const {
      key, name, description, category = "module",
      enabled = true, visible = true, readOnly = false,
      allowEdit = true, allowDelete = true, allowPrint = true, allowExport = true,
      isBeta = false, isPremium = false, minVersion = "1.0.0",
      platforms = "all", countries = null, plans = null, icon = null, sortOrder = 0,
    } = body;

    if (!key || !name) {
      return NextResponse.json({ error: "key و name مطلوبان" }, { status: 400 });
    }

    const feature = await db.featureFlag.create({
      data: {
        key, name, description, category, enabled, visible, readOnly,
        allowEdit, allowDelete, allowPrint, allowExport,
        isBeta, isPremium, minVersion, platforms, countries, plans, icon, sortOrder,
      },
    });

    await auditLogWithRequest(req, currentUser, {
      action: "create",
      entityType: "feature_flag",
      entityId: feature.id,
      description: `إنشاء ميزة: ${name} (${key})`,
      metadata: { key, category, isPremium, isBeta },
    });

    return NextResponse.json({ feature }, { status: 201 });
  } catch (e) {
    console.error("POST feature-flag error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

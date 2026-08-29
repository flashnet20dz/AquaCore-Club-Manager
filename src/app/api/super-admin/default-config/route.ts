import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { auditLogWithRequest } from "@/lib/audit";

/**
 * GET /api/super-admin/default-config
 * POST /api/super-admin/default-config
 * SuperAdmin: قراءة/حفظ إعدادات النادي الجديد الافتراضية
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const config = await db.defaultClubConfig.findFirst();
    if (!config) {
      // أنشئ افتراضي
      const created = await db.defaultClubConfig.create({ data: {} });
      return NextResponse.json({ config: created });
    }
    return NextResponse.json({
      config: {
        ...config,
        enabledFeatures: config.enabledFeatures ? JSON.parse(config.enabledFeatures) : [],
        settings: config.settings ? JSON.parse(config.settings) : {},
      },
    });
  } catch (e) {
    console.error("GET default-config error:", e);
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
      clubName, primaryColor, secondaryColor, logoUrl,
      language, currency, currencySymbol, timezone, calendar,
      defaultPlan, trialDays, enabledFeatures, settings,
    } = body;

    const data: Record<string, unknown> = {
      clubName, primaryColor, secondaryColor, logoUrl,
      language, currency, currencySymbol, timezone, calendar,
      defaultPlan, trialDays,
      updatedById: currentUser.id,
    };
    if (enabledFeatures !== undefined) data.enabledFeatures = JSON.stringify(enabledFeatures);
    if (settings !== undefined) data.settings = JSON.stringify(settings);

    // احذف undefined
    Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);

    const existing = await db.defaultClubConfig.findFirst();
    let config;
    if (existing) {
      config = await db.defaultClubConfig.update({ where: { id: existing.id }, data });
    } else {
      config = await db.defaultClubConfig.create({ data });
    }

    await auditLogWithRequest(req, currentUser, {
      action: "update",
      entityType: "default_club_config",
      entityId: config.id,
      description: "حفظ إعدادات النادي الجديد الافتراضية",
      metadata: { clubName, language, currency, defaultPlan, trialDays },
    });

    return NextResponse.json({ success: true, config });
  } catch (e) {
    console.error("POST default-config error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

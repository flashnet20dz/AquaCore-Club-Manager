import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { auditLogWithRequest } from "@/lib/audit";

/**
 * GET /api/super-admin/settings/new-club
 * SuperAdmin: إعدادات النادي الجديد الافتراضية
 *
 * POST /api/super-admin/settings/new-club
 * SuperAdmin: حفظ إعدادات النادي الجديد
 * Body: { defaultLanguage, defaultCurrency, subscriptionModel, emailNotifications, primaryColor, secondaryColor }
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    // الإعدادات مخزّنة كـ ClubSettings لـ clubId = "DEFAULT" (نادي وهمي للإعدادات الافتراضية)
    const defaults = await db.clubSettings.findUnique({
      where: { clubId: "DEFAULT" },
    });

    if (defaults) {
      return NextResponse.json({
        defaultLanguage: defaults.defaultLanguage,
        defaultCurrency: defaults.defaultCurrency,
        subscriptionModel: defaults.subscriptionModel,
        emailNotifications: defaults.emailNotifications,
        primaryColor: defaults.primaryColor,
        secondaryColor: defaults.secondaryColor,
        features: defaults.features ? JSON.parse(defaults.features) : {},
        appliedTemplate: defaults.appliedTemplate,
      });
    }

    // إعدادات افتراضية مدمجة
    return NextResponse.json({
      defaultLanguage: "ar",
      defaultCurrency: "DZD",
      subscriptionModel: "monthly",
      emailNotifications: true,
      primaryColor: "#0f766e",
      secondaryColor: "#0369a1",
      features: {},
      appliedTemplate: null,
    });
  } catch (e) {
    console.error("GET new-club settings error:", e);
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
      defaultLanguage = "ar",
      defaultCurrency = "DZD",
      subscriptionModel = "monthly",
      emailNotifications = true,
      primaryColor = "#0f766e",
      secondaryColor = "#0369a1",
      features = {},
    } = body;

    // upsert لـ ClubSettings مع clubId = "DEFAULT"
    const settings = await db.clubSettings.upsert({
      where: { clubId: "DEFAULT" },
      update: {
        defaultLanguage,
        defaultCurrency,
        subscriptionModel,
        emailNotifications,
        primaryColor,
        secondaryColor,
        features: JSON.stringify(features),
      },
      create: {
        clubId: "DEFAULT",
        defaultLanguage,
        defaultCurrency,
        subscriptionModel,
        emailNotifications,
        primaryColor,
        secondaryColor,
        features: JSON.stringify(features),
      },
    });

    await auditLogWithRequest(req, currentUser, {
      action: "update",
      entityType: "club_settings",
      entityId: settings.id,
      description: "حفظ إعدادات النادي الجديد الافتراضية",
      metadata: { defaultLanguage, defaultCurrency, subscriptionModel, emailNotifications, primaryColor, secondaryColor },
    });

    return NextResponse.json({ success: true, settings });
  } catch (e) {
    console.error("POST new-club settings error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

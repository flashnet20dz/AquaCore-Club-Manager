import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { DEFAULT_THEME_CONFIG, type ClubThemeConfig } from "@/lib/theme-presets";

/**
 * GET /api/settings/theme
 * Returns the theme config for the current user's club.
 * Public (any authenticated user can read — needed to apply theme on every page).
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      // Return default config for unauthenticated (login page)
      return NextResponse.json({ config: DEFAULT_THEME_CONFIG });
    }

    // Superadmin without club → default
    if (currentUser.role === "superadmin" && !currentUser.clubId) {
      return NextResponse.json({ config: DEFAULT_THEME_CONFIG });
    }

    const clubId = currentUser.clubId;
    if (!clubId) {
      return NextResponse.json({ config: DEFAULT_THEME_CONFIG });
    }

    const club = await db.club.findUnique({
      where: { id: clubId },
      select: {
        themePreset: true,
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        logoUrl: true,
        borderRadius: true,
        density: true,
        fontFamily: true,
      },
    });

    if (!club) {
      return NextResponse.json({ config: DEFAULT_THEME_CONFIG });
    }

    const config: ClubThemeConfig = {
      themePreset: club.themePreset,
      primaryColor: club.primaryColor,
      secondaryColor: club.secondaryColor,
      accentColor: club.accentColor,
      logoUrl: club.logoUrl,
      borderRadius: club.borderRadius,
      density: club.density,
      fontFamily: club.fontFamily,
    };

    return NextResponse.json({ config });
  } catch (error) {
    console.error("GET /api/settings/theme error:", error);
    return NextResponse.json({ config: DEFAULT_THEME_CONFIG }, { status: 200 });
  }
}

/**
 * PUT /api/settings/theme
 * Updates the theme config for the current user's club (admin only).
 */
export async function PUT(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const clubId = currentUser.role === "superadmin"
      ? (await req.clone().json().catch(() => ({}))).clubId || currentUser.clubId
      : currentUser.clubId;

    if (!clubId) {
      return NextResponse.json({ error: "النادي غير محدد" }, { status: 400 });
    }

    const body = await req.json();
    const {
      themePreset, primaryColor, secondaryColor, accentColor,
      logoUrl, borderRadius, density, fontFamily,
    } = body;

    // Validate borderRadius, density, fontFamily
    const validRadii = ["sharp", "medium", "full"];
    const validDensities = ["comfortable", "normal", "compact"];
    const validFonts = ["cairo", "tajawal", "system"];

    const updated = await db.club.update({
      where: { id: clubId },
      data: {
        themePreset: themePreset || null,
        primaryColor: primaryColor || null,
        secondaryColor: secondaryColor || null,
        accentColor: accentColor || null,
        logoUrl: logoUrl !== undefined ? (logoUrl || null) : undefined,
        borderRadius: borderRadius && validRadii.includes(borderRadius) ? borderRadius : null,
        density: density && validDensities.includes(density) ? density : null,
        fontFamily: fontFamily && validFonts.includes(fontFamily) ? fontFamily : null,
      },
      select: {
        themePreset: true, primaryColor: true, secondaryColor: true, accentColor: true,
        logoUrl: true, borderRadius: true, density: true, fontFamily: true,
      },
    });

    // Log activity
    await db.activity.create({
      data: {
        clubId,
        userId: currentUser.id,
        type: "theme_update",
        description: `تحديث إعدادات المظهر: ${themePreset || "مخصص"}`,
      },
    }).catch(() => { /* activity logging is best-effort */ });

    return NextResponse.json({ config: updated, success: true });
  } catch (error) {
    console.error("PUT /api/settings/theme error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

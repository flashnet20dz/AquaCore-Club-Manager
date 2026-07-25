import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * GET /api/settings/photos
 * قراءة إعدادات صور المنخرطين (لكل نادٍ)
 *
 * POST /api/settings/photos
 * حفظ إعدادات صور المنخرطين
 * Body: { enabled, allowCamera, allowUpload, maxFileSize, quality, compress, thumbnail, defaultShape, dimensions, autoCrop, faceDetection }
 */
const DEFAULT_PHOTO_SETTINGS = {
  enabled: true,
  allowCamera: true,
  allowUpload: true,
  maxFileSize: 10, // MB
  quality: 85, // 0-100
  compress: true,
  thumbnail: true,
  defaultShape: "circle", // circle | square
  dimensions: 300,
  autoCrop: true,
  faceDetection: true,
};

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.clubId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    // الإعدادات مخزّنة في جدول Setting (key-value per club)
    const setting = await db.setting.findUnique({
      where: {
        clubId_key: { clubId: currentUser.clubId, key: "photoSettings" },
      },
    });

    if (setting) {
      return NextResponse.json({ settings: JSON.parse(setting.value) });
    }
    return NextResponse.json({ settings: DEFAULT_PHOTO_SETTINGS });
  } catch (e) {
    console.error("GET photo settings error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.clubId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    if (currentUser.role !== "admin") {
      return NextResponse.json({ error: "غير مصرح — للإدارة فقط" }, { status: 403 });
    }

    const body = await req.json();
    const settings = { ...DEFAULT_PHOTO_SETTINGS, ...body };

    await db.setting.upsert({
      where: { clubId_key: { clubId: currentUser.clubId, key: "photoSettings" } },
      update: { value: JSON.stringify(settings) },
      create: { clubId: currentUser.clubId, key: "photoSettings", value: JSON.stringify(settings) },
    });

    return NextResponse.json({ success: true, settings });
  } catch (e) {
    console.error("POST photo settings error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

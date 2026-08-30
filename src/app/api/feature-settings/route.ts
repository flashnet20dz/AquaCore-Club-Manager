/**
 * ═══════════════════════════════════════════════════════════════
 *  API — إعدادات الميزات (Feature Settings Hub)
 * ═══════════════════════════════════════════════════════════════
 *
 *  GET  /api/feature-settings
 *       → { groups: FeatureGroupDef[], values: Record<key, value> }
 *         (القيم = المخزنة أو الافتراضي)
 *
 *  PUT  /api/feature-settings   body: { settings: Record<key, value> }
 *       → يرفض أي مفتاح خارج السجل (حماية من الكتابة العشوائية)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import {
  FEATURE_SETTINGS,
  FEATURE_SETTING_DEFAULTS,
} from "@/lib/feature-settings";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !user.clubId) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

    const rows = await db.setting.findMany({
      where: {
        clubId: user.clubId,
        key: { in: Object.keys(FEATURE_SETTING_DEFAULTS) },
      },
    });
    const values: Record<string, string> = { ...FEATURE_SETTING_DEFAULTS };
    for (const r of rows) values[r.key] = r.value;

    return NextResponse.json({ groups: FEATURE_SETTINGS, values });
  } catch (e) {
    console.error("GET feature-settings:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.clubId) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    if (user.role !== "admin" && user.role !== "superadmin")
      return NextResponse.json({ error: "الإعدادات للأمين والمشرف الأعلى فقط" }, { status: 403 });

    const body = await req.json();
    const incoming: Record<string, unknown> = body?.settings || {};

    // 🔒 قبول مفاتيح السجل فقط
    const updates: [string, string][] = [];
    for (const [key, value] of Object.entries(incoming)) {
      if (!(key in FEATURE_SETTING_DEFAULTS)) continue;
      updates.push([key, value === null || value === undefined ? "" : String(value)]);
    }
    if (!updates.length) return NextResponse.json({ error: "لا تغييرات صالحة" }, { status: 400 });

    const clubId = user.clubId;
    for (const [key, value] of updates) {
      await db.setting.upsert({
        where: { clubId_key: { clubId, key } },
        update: { value },
        create: { clubId, key, value },
      });
    }

    return NextResponse.json({ ok: true, updated: updates.length });
  } catch (e) {
    console.error("PUT feature-settings:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

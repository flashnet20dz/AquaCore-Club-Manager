import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import fs from "fs";
import path from "path";

import { DEFAULT_LOGIN_CONFIG } from "@/lib/login-config";

const CONFIG_KEY = "system_login_customization";
const LOCAL_CACHE_FILE = path.join(process.cwd(), "electron", "login-customizer-cache.json");

/**
 * GET: استرجاع إعدادات واجهة تسجيل الدخول (متاح للجميع لعرض صفحة الدخول)
 */
export async function GET() {
  try {
    // 1) محاولة القراءة من قاعدة البيانات
    try {
      const setting = await db.setting.findFirst({
        where: { key: CONFIG_KEY },
      });
      if (setting && setting.value) {
        const parsed = JSON.parse(setting.value);
        return NextResponse.json({ config: { ...DEFAULT_LOGIN_CONFIG, ...parsed } });
      }
    } catch {
      // قاعدة البيانات غير متوفرة أو تعمل بدون اتصال
    }

    // 2) محاولة القراءة من الملف المحلي الاحتياطي
    if (fs.existsSync(LOCAL_CACHE_FILE)) {
      try {
        const raw = fs.readFileSync(LOCAL_CACHE_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        return NextResponse.json({ config: { ...DEFAULT_LOGIN_CONFIG, ...parsed } });
      } catch {}
    }

    // 3) إرجاع الإعدادات الافتراضية
    return NextResponse.json({ config: DEFAULT_LOGIN_CONFIG });
  } catch (err) {
    console.error("GET login customizer error:", err);
    return NextResponse.json({ config: DEFAULT_LOGIN_CONFIG });
  }
}

/**
 * POST: حفظ إعدادات واجهة الدخول (خاص بالمدير العام SuperAdmin فقط)
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح — هذه الميزة مخصصة للمدير العام فقط" }, { status: 403 });
    }

    const body = await req.json();
    const configToSave = {
      ...DEFAULT_LOGIN_CONFIG,
      ...body,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.email || currentUser.name,
    };

    const valueString = JSON.stringify(configToSave);

    // 1) الحفظ في قاعدة البيانات
    try {
      const firstClub = await db.club.findFirst();
      const clubId = firstClub?.id;
      if (clubId) {
        await db.setting.upsert({
          where: { clubId_key: { clubId, key: CONFIG_KEY } },
          update: { value: valueString },
          create: { clubId, key: CONFIG_KEY, value: valueString },
        });
      }
    } catch (dbErr) {
      console.warn("DB save warning for login customizer:", dbErr);
    }

    // 2) حفظ في ملف محلي احتياطي لضمان العمل أوفلاين
    try {
      const dir = path.dirname(LOCAL_CACHE_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(LOCAL_CACHE_FILE, valueString, "utf-8");
    } catch {}

    return NextResponse.json({
      success: true,
      message: "تم حفظ إعدادات واجهة تسجيل الدخول بنجاح",
      config: configToSave,
    });
  } catch (err: any) {
    console.error("POST login customizer error:", err);
    return NextResponse.json(
      { error: err?.message || "فشل في حفظ إعدادات واجهة الدخول" },
      { status: 500 }
    );
  }
}

/**
 * DELETE: استعادة الإعدادات الافتراضية لواجهة الدخول
 */
export async function DELETE() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    try {
      await db.setting.deleteMany({
        where: { key: CONFIG_KEY },
      });
    } catch {}

    if (fs.existsSync(LOCAL_CACHE_FILE)) {
      try {
        fs.unlinkSync(LOCAL_CACHE_FILE);
      } catch {}
    }

    return NextResponse.json({
      success: true,
      message: "تم استعادة التصميم الافتراضي لواجهة الدخول",
      config: DEFAULT_LOGIN_CONFIG,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "فشل في الاستعادة" }, { status: 500 });
  }
}

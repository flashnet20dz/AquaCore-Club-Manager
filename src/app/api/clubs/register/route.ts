import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { startTrial } from "@/lib/subscription-state";
import { ensureSwimDefaults } from "@/lib/feature-defaults";

/**
 * POST /api/clubs/register
 * Register a new club — creates Club + admin User + ClubRequest
 * Status: pending (requires SuperAdmin approval)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clubName, city, country, managerName, phone, email, username, password, confirmPassword } = body;

    // Validation
    if (!clubName || !city || !managerName || !phone || !email || !username || !password) {
      return NextResponse.json({ error: "جميع الحقول مطلوبة" }, { status: 400 });
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ error: "كلمتا المرور غير متطابقتين" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }, { status: 400 });
    }

    // Check if email already exists
    const existingUser = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existingUser) {
      return NextResponse.json({ error: "هذا البريد الإلكتروني مسجل بالفعل" }, { status: 409 });
    }

    // Check if club email already exists
    const existingClub = await db.club.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existingClub) {
      return NextResponse.json({ error: "هذا البريد مرتبط بنادٍ آخر" }, { status: 409 });
    }

    // Create club — تبدأ الفترة التجريبية فوراً عند التسجيل (7 أيام)
    // بدل انتظار موافقة السوبر-أدمن، حتى يشوف النادي التجربة مباشرة
    const trial = startTrial();
    const club = await db.club.create({
      data: {
        name: clubName,
        city,
        country: country || "الجزائر",
        managerName,
        phone,
        email: email.toLowerCase().trim(),
        status: "pending",
        trialStartedAt: trial.trialStartedAt,
        trialEndDate: trial.trialEndDate,
      },
    });

    // Create admin user for this club
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await db.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name: managerName,
        passwordHash,
        role: "admin",
        phone,
        clubId: club.id,
        active: true,
        pending: false, // user is active but club is pending
      },
    });

    // Create club registration request
    await db.clubRequest.create({
      data: {
        clubId: club.id,
        status: "pending",
      },
    });

    // 🏊 بذر أيام السباحة والتوقيتات الافتراضية — حتى لا يجد النادي الجديد
    // قسم "أيام السباحة" فارغاً في الإعدادات (كان سبب خلل «الإعدادات غير متزامنة»)
    await ensureSwimDefaults(db, club.id).catch((err) =>
      console.error("swim defaults seed (register):", err)
    );

    return NextResponse.json({
      success: true,
      message: "تم استلام طلب التسجيل بنجاح. سيتم مراجعته من قبل الإدارة قبل التفعيل.",
      clubId: club.id,
    }, { status: 201 });
  } catch (e) {
    console.error("Club registration error:", e);
    return NextResponse.json({ error: "خطأ داخلي في الخادم" }, { status: 500 });
  }
}

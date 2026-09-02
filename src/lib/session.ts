import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import type { Role, SessionUser } from "@/lib/roles";

// Re-export for backward compatibility
export type { Role, SessionUser };
export { ROLE_LABELS, ROLE_ICONS, hasPermission } from "@/lib/roles";

export const SESSION_COOKIE = "rcs-session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

function generateToken(): string {
  // Cryptographically random token
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Ensure a default admin account exists. Called from /api/auth/login
 * so the system is always usable on a fresh database.
 */
export async function ensureDefaultAdmin(): Promise<void> {
  try {
    const count = await db.user.count();
    if (count > 0) return;

    // 🔒 الحساب الافتراضي لم يعد يُنشأ تلقائياً بكلمة سر معروفة — كانت "admin123"
    // تتيح لأول زائر على قاعدة بيانات فارغة الاستيلاء على النظام كاملاً.
    // الآن: يتطلب تفعيلاً صريحاً بمتغير البيئة SEED_DEFAULT_ADMIN=true،
    // وتُولَّد كلمة سر عشوائية قوية تُطبع مرة واحدة في سجل الخادم.
    if (process.env.SEED_DEFAULT_ADMIN !== "true") {
      console.warn(
        "⚠️ قاعدة البيانات فارغة ولا يوجد مستخدمون. " +
          "لإنشاء حساب مدير أولي: اضبط SEED_DEFAULT_ADMIN=true ثم أعد المحاولة."
      );
      return;
    }

    const password = crypto.randomBytes(16).toString("base64url"); // ~22 محرفاً عشوائياً
    const passwordHash = await bcrypt.hash(password, 10);
    await db.user.create({
      data: {
        email: "admin@rcs.dz",
        name: "المدير العام",
        passwordHash,
        role: "admin",
        phone: "0550000000",
        active: true,
        pending: false,
      },
    });
    console.log(
      "✓ Default admin created: admin@rcs.dz / " + password +
        " — غيّر كلمة السر فوراً بعد أول دخول!"
    );
  } catch (e) {
    console.error("ensureDefaultAdmin error:", e);
  }
}

/**
 * Ensure default settings exist (currency=دج, WhatsApp template, etc.)
 */
export async function ensureDefaultSettings(): Promise<void> {
  try {
    const currentUser = await getCurrentUser();
    const clubId = currentUser?.clubId;
    if (!clubId) return;

    const count = await db.setting.count({ where: { clubId } });
    if (count > 0) return;

    const defaults = [
      { key: "clubName", value: "النادي الهاوي متعدد الرياضات - الرائد سعيدة - فرع السباحة" },
      { key: "clubPhone", value: "0550000000" },
      { key: "clubAddress", value: "سعيدة - الجزائر" },
      { key: "lateFee", value: "0" },
      { key: "currency", value: "دج" },
      { key: "whatsappEnabled", value: "true" },
      { key: "whatsappNumber", value: "213550000000" },
      { key: "whatsappTemplate", value: "مرحباً {name}، اشتراكك في نادي RCS ينتهي في {date}. يرجى التجديد. شكراً." },
      { key: "absenceAlertWeeks", value: "3" },
      { key: "expiryAlertDays", value: "7" },
      { key: "workHourRate", value: "200" },
    ];
    for (const s of defaults) {
      await db.setting.upsert({
        where: { clubId_key: { clubId, key: s.key } },
        update: {},
        create: { ...s, clubId },
      });
    }
    console.log("✓ Default settings created for club:", clubId);
  } catch (e) {
    console.error("ensureDefaultSettings error:", e);
  }
}

export async function createUser(email: string, password: string, name: string, phone?: string): Promise<SessionUser> {
  const existing = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (existing) throw new Error("هذا البريد مسجل بالفعل");

  const passwordHash = await bcrypt.hash(password, 10);
  const userCount = await db.user.count();
  // First user is admin; subsequent users default to "lifeguard" (حارس سباحة)
  const role = userCount === 0 ? "admin" : "lifeguard";

  const user = await db.user.create({
    data: {
      email: email.toLowerCase().trim(),
      name,
      passwordHash,
      phone: phone || null,
      role,
    },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone,
  };
}

export async function verifyCredentials(email: string, password: string): Promise<SessionUser | null> {
  try {
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { club: { select: { id: true, name: true, status: true } } },
    });
    if (!user) return null;
    if (!user.active) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;

    // Check club status for non-superadmin users
    // ملاحظة: "pending" لا يمنع الدخول — النادي عنده تجربة مجانية سارية
    // من لحظة التسجيل، ونظام subscription-gate هو من يقرر لاحقاً هل
    // فترة التجربة/السماح انتهت فعلاً أم لا (وليس حالة الموافقة الإدارية).
    if (user.role !== "superadmin" && user.club) {
      if (user.club.status === "suspended") return null;
      if (user.club.status === "disabled") return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      clubId: user.clubId,
      clubName: user.club?.name || null,
    };
  } catch (e) {
    console.error("Verify credentials error:", e);
    return null;
  }
}

// 🛡️ قيود FK القديمة: قواعد بيانات PostgreSQL إنتاجية ما زالت تحمل القيد
// «Session_userId_fkey» الذي يرفض جلسات كود الكاشير (userId وهمي «pin-...»
// غير موجود في Users). يُسقَط القيد مرة واحدة وقت الحاجة ثم تعمل الجلسات
// طبيعياً — بلا هجرة يدوية ولا وصول مباشر لقاعدة الإنتاج.
const DROP_SESSION_FK_SQL = `ALTER TABLE "Session" DROP CONSTRAINT IF EXISTS "Session_userId_fkey"`;
let sessionFkHealed = false;

export async function createSession(user: SessionUser): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  const sessionData = { id: token, userId: user.id, data: JSON.stringify(user), expiresAt };
  try {
    await db.session.create({ data: sessionData });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 🛡️ إصلاح ذاتي (إنتاج PostgreSQL): أسقط قيد FK القديم ثم أعد المحاولة.
    // العلامة تُضبط فقط بعد نجاح الإسقاط حتى لا يُعطَّل الإصلاح بخطأ عابر.
    // P2003 = كود Prisma لانتهاك المفتاح الأجنبي (صيغة الرسالة تختلف بين
    // PostgreSQL وSQLite فنعتمد الكود + النص معاً).
    const isFkError = (e as { code?: string })?.code === "P2003" || /foreign key|constraint/i.test(msg);
    if (!sessionFkHealed && isFkError) {
      try {
        await db.$executeRawUnsafe(DROP_SESSION_FK_SQL);
        sessionFkHealed = true;
        await db.session.create({ data: sessionData });
        return token; // ✓ حُفظت الجلسة في قاعدة البيانات بعد الإصلاح
      } catch (retryErr) {
        console.error("createSession retry after FK drop failed:", retryErr);
      }
    }
    // Fallback: if Session table doesn't exist yet (before db push), use in-memory
    console.error("createSession DB error, using fallback:", e);
    fallbackStore.set(token, { user, expires: expiresAt.getTime() });
  }
  return token;
}

// Fallback in-memory store (only used if DB session table missing)
const fallbackStore = new Map<string, { user: SessionUser; expires: number }>();

export function getSessionFromToken(token: string | undefined): SessionUser | null {
  if (!token) return null;
  // Check fallback first (synchronous)
  const fb = fallbackStore.get(token);
  if (fb) {
    if (fb.expires < Date.now()) {
      fallbackStore.delete(token);
      return null;
    }
    return fb.user;
  }
  return null; // DB lookup is async — use getCurrentUser() instead
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  // Check fallback
  const fb = fallbackStore.get(token);
  if (fb) {
    if (fb.expires < Date.now()) {
      fallbackStore.delete(token);
      return null;
    }
    return fb.user;
  }

  // Check DB
  try {
    const session = await db.session.findUnique({
      where: { id: token },
    });
    if (!session) return null;
    if (session.expiresAt < new Date()) {
      await db.session.delete({ where: { id: token } }).catch(() => {});
      return null;
    }
    return JSON.parse(session.data) as SessionUser;
  } catch (e) {
    console.error("getCurrentUser DB error:", e);
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * "تلميح النادي" — كوكي طويل الأمد (سنة) غير حسّاس، يربط هذا الجهاز/المتصفح
 * بنادٍ محدد. يُستخدم فقط لتسريع وعزل تسجيل دخول كود الكاشير (PIN) —
 * بدونه، كود PIN يضطر يفحص كل أكواد كل النوادي بالنظام (بطيء جداً + خطر
 * تصادم بين نوادي مختلفة، بما أن الأكواد 4 أرقام فقط). هذا الكوكي يُضبط
 * تلقائياً عند أي تسجيل دخول عادي (بريد/كلمة سر) أو أول نجاح بكود PIN.
 */
const CLUB_HINT_COOKIE = "rcs-club-hint";

export async function setClubHintCookie(clubId: string) {
  const cookieStore = await cookies();
  cookieStore.set(CLUB_HINT_COOKIE, clubId, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
}

export async function getClubHintCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CLUB_HINT_COOKIE)?.value || null;
}

export async function destroySession(token: string | undefined) {
  if (token) {
    fallbackStore.delete(token);
    try {
      await db.session.delete({ where: { id: token } });
    } catch {
      // ignore
    }
  }
  await clearSessionCookie();
}

/**
 * Cleanup expired sessions (called periodically)
 */
export async function cleanupExpiredSessions(): Promise<void> {
  try {
    await db.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  } catch {
    // ignore
  }
}

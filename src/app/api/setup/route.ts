import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * GET /api/setup
 * Auto-creates the database schema at runtime (serverless-friendly).
 * Uses raw SQL DDL statements instead of `prisma db push` so it works
 * even if Prisma CLI isn't available.
 *
 * Idempotent: uses CREATE TABLE IF NOT EXISTS.
 *
 * After schema creation, also seeds the default admin + default settings.
 *
 * 🔒 SECURITY: Protected — requires either:
 *   1. Authenticated superadmin session, OR
 *   2. Valid SETUP_SECRET_KEY in Authorization header
 *   3. OR allow if no users exist yet (first-time bootstrap)
 */
export async function GET(req: NextRequest) {
  const results: string[] = [];

  // 🔒 Security check
  const hasUsers = await db.user.count().catch(() => 0);
  if (hasUsers > 0) {
    // DB already initialized — require auth
    const currentUser = await getCurrentUser();
    const setupKey = process.env.SETUP_SECRET_KEY;
    const authHeader = req.headers.get("authorization");
    const keyMatch = setupKey && authHeader === `Bearer ${setupKey}`;

    if (!currentUser || (currentUser.role !== "superadmin" && !keyMatch)) {
      return NextResponse.json(
        { error: "غير مصرح — قاعدة البيانات مهيأة بالفعل" },
        { status: 403 }
      );
    }
  }

  try {
    // Test connection
    await db.$queryRaw`SELECT 1`;
    results.push("✓ DB connection OK");

    // Create tables with IF NOT EXISTS (PostgreSQL)
    const statements = [
      `CREATE TABLE IF NOT EXISTS "Subscriber" (
        id TEXT PRIMARY KEY,
        "fileNumber" TEXT UNIQUE NOT NULL,
        "lastName" TEXT NOT NULL,
        "firstName" TEXT NOT NULL,
        "birthDate" TIMESTAMP(3) NOT NULL,
        gender TEXT NOT NULL,
        "bloodType" TEXT,
        "subscriptionType" TEXT NOT NULL,
        "lastPaymentDate" TIMESTAMP(3),
        "paymentStatus" TEXT NOT NULL,
        "swimmingDays" TEXT,
        "timeSlot" TEXT,
        phone TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS "Renewal" (
        id TEXT PRIMARY KEY,
        "subscriberId" TEXT NOT NULL,
        "renewalDate" TIMESTAMP(3) NOT NULL,
        "expiryDate" TIMESTAMP(3) NOT NULL,
        months INTEGER NOT NULL DEFAULT 1,
        amount INTEGER NOT NULL,
        "paymentStatus" TEXT NOT NULL,
        note TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Renewal_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS "Attendance" (
        id TEXT PRIMARY KEY,
        "subscriberId" TEXT NOT NULL,
        date TIMESTAMP(3) NOT NULL,
        "checkInTime" TIMESTAMP(3) NOT NULL,
        "checkOutTime" TIMESTAMP(3),
        method TEXT NOT NULL,
        "coachId" TEXT,
        note TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Attendance_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"(id) ON DELETE CASCADE,
        CONSTRAINT "Attendance_subscriberId_date_key" UNIQUE ("subscriberId", date)
      )`,
      `CREATE TABLE IF NOT EXISTS "User" (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        "passwordHash" TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'lifeguard',
        phone TEXT,
        avatar TEXT,
        active BOOLEAN NOT NULL DEFAULT true,
        pending BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS "WorkHours" (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        date TIMESTAMP(3) NOT NULL,
        "startTime" TIMESTAMP(3) NOT NULL,
        "endTime" TIMESTAMP(3) NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        note TEXT,
        "approvedById" TEXT,
        "approvedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "WorkHours_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS "Payment" (
        id TEXT PRIMARY KEY,
        "subscriberId" TEXT,
        "userId" TEXT,
        category TEXT NOT NULL,
        amount INTEGER NOT NULL,
        method TEXT NOT NULL DEFAULT 'cash',
        "receiptNumber" TEXT,
        date TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        note TEXT,
        status TEXT NOT NULL DEFAULT 'paid',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Payment_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"(id) ON DELETE SET NULL,
        CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE SET NULL
      )`,
      `CREATE TABLE IF NOT EXISTS "Activity" (
        id TEXT PRIMARY KEY,
        "subscriberId" TEXT,
        "userId" TEXT,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        metadata TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Activity_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"(id) ON DELETE SET NULL
      )`,
      `CREATE TABLE IF NOT EXISTS "Notification" (
        id TEXT PRIMARY KEY,
        "userId" TEXT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        read BOOLEAN NOT NULL DEFAULT false,
        link TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS "Setting" (
        id TEXT PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        "updatedAt" TIMESTAMP(3) NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS "Session" (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        data TEXT NOT NULL,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS "CashierPin" (
        id TEXT PRIMARY KEY,
        pin TEXT UNIQUE NOT NULL,
        label TEXT NOT NULL DEFAULT 'كاشير',
        role TEXT NOT NULL DEFAULT 'assistant',
        active BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL
      )`,
      // Indexes (IF NOT EXISTS)
      `CREATE INDEX IF NOT EXISTS "Subscriber_paymentStatus_idx" ON "Subscriber"("paymentStatus")`,
      `CREATE INDEX IF NOT EXISTS "Subscriber_subscriptionType_idx" ON "Subscriber"("subscriptionType")`,
      `CREATE INDEX IF NOT EXISTS "Subscriber_gender_idx" ON "Subscriber"(gender)`,
      `CREATE INDEX IF NOT EXISTS "Renewal_subscriberId_idx" ON "Renewal"("subscriberId")`,
      `CREATE INDEX IF NOT EXISTS "Attendance_date_idx" ON "Attendance"(date)`,
      `CREATE INDEX IF NOT EXISTS "WorkHours_userId_date_idx" ON "WorkHours"("userId", date)`,
      `CREATE INDEX IF NOT EXISTS "WorkHours_status_idx" ON "WorkHours"(status)`,
      `CREATE INDEX IF NOT EXISTS "Payment_subscriberId_idx" ON "Payment"("subscriberId")`,
      `CREATE INDEX IF NOT EXISTS "Payment_category_idx" ON "Payment"(category)`,
      `CREATE INDEX IF NOT EXISTS "Payment_date_idx" ON "Payment"(date)`,
      `CREATE INDEX IF NOT EXISTS "Payment_userId_idx" ON "Payment"("userId")`,
      `CREATE INDEX IF NOT EXISTS "Activity_createdAt_idx" ON "Activity"("createdAt")`,
      `CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification"("userId", read)`,
      `CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId")`,
      `CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt")`,
    ];

    // Drop the generated columns first if they exist (in case table existed before without them)
    // Actually, we use simpler approach — just CREATE TABLE IF NOT EXISTS, won't modify existing tables.

    for (const sql of statements) {
      try {
        await db.$executeRawUnsafe(sql);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Ignore "already exists" errors (CREATE INDEX IF NOT EXISTS won't error, but column gen may)
        if (!msg.includes("already exists") && !msg.includes("duplicate")) {
          results.push(`⚠️ SQL warning: ${msg.substring(0, 120)}`);
        }
      }
    }
    results.push(`✓ ${statements.length} schema statements executed`);

    // Seed default admin
    const userCount = await db.user.count().catch(() => -1);
    if (userCount === 0) {
      const bcrypt = (await import("bcryptjs")).default;
      const hash = await bcrypt.hash("admin123", 10);
      await db.user.create({
        data: {
          email: "admin@rcs.dz",
          name: "المدير العام",
          passwordHash: hash,
          role: "admin",
          phone: "0550000000",
          active: true,
          pending: false,
        },
      });
      results.push("✓ Default admin created: admin@rcs.dz / admin123");
    } else {
      results.push(`• Users already exist (${userCount})`);
    }

    // Seed default settings (use default-club-1 as fallback)
    const defaultClubId = "default-club-1";
    const settingCount = await db.setting.count({ where: { clubId: defaultClubId } }).catch(() => -1);
    if (settingCount === 0) {
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
          where: { clubId_key: { clubId: defaultClubId, key: s.key } },
          update: {},
          create: { ...s, clubId: defaultClubId },
        });
      }
      results.push(`✓ ${defaults.length} default settings seeded`);
    } else {
      results.push(`• Settings already exist (${settingCount})`);
    }

    return NextResponse.json({
      success: true,
      results,
      message: "Database setup complete. You can now log in with admin@rcs.dz / admin123",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Setup error:", msg);
    results.push(`✗ Error: ${msg}`);
    return NextResponse.json({ success: false, results, error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// Export full database backup
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const clubFilter = user.role === "superadmin" ? {} : { clubId: user.clubId! };

    const [subscribers, users, attendances, renewals, workHours, activities, settings, payments, notifications] = await Promise.all([
      db.subscriber.findMany({ where: clubFilter }),
      db.user.findMany({ where: clubFilter, select: { id: true, email: true, name: true, role: true, phone: true, active: true, createdAt: true } }),
      db.attendance.findMany({ where: clubFilter }),
      db.renewal.findMany({ where: clubFilter }),
      db.workHours.findMany({ where: clubFilter }),
      db.activity.findMany({ where: clubFilter }),
      db.setting.findMany({ where: clubFilter }),
      db.payment.findMany({ where: clubFilter }),
      db.notification.findMany({ where: clubFilter }),
    ]);

    // Don't export password hashes
    const safeUsers = users.map(({ ...u }) => u);

    const backup = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      exportedBy: user.email,
      counts: {
        subscribers: subscribers.length,
        users: users.length,
        attendances: attendances.length,
        renewals: renewals.length,
        workHours: workHours.length,
        activities: activities.length,
        settings: settings.length,
        payments: payments.length,
        notifications: notifications.length,
      },
      data: {
        subscribers,
        users: safeUsers,
        attendances,
        renewals,
        workHours,
        activities,
        settings,
        payments,
        notifications,
      },
    };

    const json = JSON.stringify(backup, null, 2);
    const filename = `rcs-backup-${new Date().toISOString().split("T")[0]}.json`;

    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error("Backup export:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

// Import database backup
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await req.json();
    const { backup, mode } = body as { backup: { version: string; data: Record<string, unknown[]> }; mode: "merge" | "replace" };

    if (!backup || !backup.data) {
      return NextResponse.json({ error: "ملف النسخة الاحتياطية غير صالح" }, { status: 400 });
    }

    const clubId = user.clubId!;
    const clubFilter = user.role === "superadmin" ? {} : { clubId };
    const { subscribers, settings, payments } = backup.data;
    let imported = 0;
    let skipped = 0;

    // If replace mode, clear existing data for this club (except users)
    if (mode === "replace") {
      await Promise.all([
        db.payment.deleteMany({ where: clubFilter }),
        db.attendance.deleteMany({ where: clubFilter }),
        db.renewal.deleteMany({ where: clubFilter }),
        db.activity.deleteMany({ where: clubFilter }),
        db.notification.deleteMany({ where: clubFilter }),
        db.workHours.deleteMany({ where: clubFilter }),
        db.subscriber.deleteMany({ where: clubFilter }),
      ]);
    }

    // Import subscribers
    if (subscribers) {
      for (const s of subscribers as Array<Record<string, unknown>>) {
        try {
          const fileNumber = s.fileNumber as string;
          await db.subscriber.upsert({
            where: { clubId_fileNumber: { clubId, fileNumber } },
            create: {
              clubId,
              fileNumber,
              lastName: s.lastName as string,
              firstName: s.firstName as string,
              birthDate: new Date(s.birthDate as string),
              gender: s.gender as string,
              bloodType: (s.bloodType as string) || null,
              subscriptionType: s.subscriptionType as string,
              lastPaymentDate: s.lastPaymentDate ? new Date(s.lastPaymentDate as string) : null,
              paymentStatus: s.paymentStatus as string,
              swimmingDays: (s.swimmingDays as string) || null,
              timeSlot: (s.timeSlot as string) || null,
              phone: (s.phone as string) || null,
            },
            update: {},
          });
          imported++;
        } catch {
          skipped++;
        }
      }
    }

    // Import settings
    if (settings) {
      for (const s of settings as Array<Record<string, string>>) {
        try {
          await db.setting.upsert({
            where: { clubId_key: { clubId, key: s.key } },
            create: { clubId, key: s.key, value: s.value },
            update: { value: s.value },
          });
        } catch {}
      }
    }

    return NextResponse.json({
      success: true,
      mode,
      imported,
      skipped,
    });
  } catch (e) {
    console.error("Backup import:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

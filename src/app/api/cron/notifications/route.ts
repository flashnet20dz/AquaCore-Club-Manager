import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { computeSubscriberFields } from "@/lib/rcs";
import { getCurrentUser } from "@/lib/session";
import { getFeatureSettings } from "@/lib/feature-settings";

// 🔒 مقارنة آمنة زمنياً للأسرار (تمنع timing attacks)
function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// This endpoint can be called by a cron job (e.g., Vercel Cron) to generate notifications
// GET /api/cron/notifications — generates renewal + absence reminders
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    // 🔒 حماية Cron: الزائر المجهول مرفوض دائماً — إلا إذا أحضر سرّ CRON_SECRET
    // صحيحاً في ترويسة x-cron-secret (تُضبط في إعدادات جدولة Vercel Cron).
    // سابقاً: أي شخص على الإنترنت كان يستطيع استدعاء هذه النقطة مجاناً
    // ليفرض فحص كل المشتركين في كل النوادي وإنشاء إشعارات جماعية (DoS/سبام).
    const cronSecret = process.env.CRON_SECRET;
    const providedSecret = req.headers.get("x-cron-secret") || "";
    const isTrustedCron = Boolean(cronSecret) && timingSafeEqualStr(cronSecret, providedSecret);

    if (!currentUser && !isTrustedCron) {
      return NextResponse.json(
        { error: "غير مصرح — هذه النقطة مخصصة لمهام مجدولة موثوقة فقط" },
        { status: 401 }
      );
    }
    // المستخدم المُسجّل (للتشغيل اليدوي) يجب أن يكون admin أو superadmin
    if (currentUser && currentUser.role !== "admin" && currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    // Determine club filter: trusted cron calls (no user) and superadmin process all
    // clubs; regular users only process their own club.
    const clubFilter = !currentUser || currentUser.role === "superadmin"
      ? {}
      : { clubId: currentUser.clubId! };

    // 🧩 إعدادات الميزات لكل نادٍ (تزامن مع الإعدادات ← الميزات ← الإشعارات)
    const featByClub = new Map<string, Record<string, string>>();
    async function featsForClub(clubId: string) {
      let f = featByClub.get(clubId);
      if (!f) {
        f = await getFeatureSettings(db, clubId);
        featByClub.set(clubId, f);
      }
      return f;
    }

    const subscribers = await db.subscriber.findMany({
      where: clubFilter,
      include: {
        attendances: {
          orderBy: { date: "desc" },
          take: 1,
        },
      },
    });
    const computed = subscribers.map((s) => ({ ...s, ...computeSubscriberFields(s) }));

    const expiringSoon = computed.filter((s) => s.renewalStatus === "⚠️ قريب الانتهاء");
    const expired = computed.filter((s) => s.renewalStatus === "⛔ منتهي - يتطلب تجديد");

    let created = 0;

    // Group admins per club so each subscriber's notifications go to its own club's admins
    const adminsByClub = new Map<string, { id: string }[]>();
    async function getAdminsForClub(clubId: string) {
      let list = adminsByClub.get(clubId);
      if (!list) {
        list = await db.user.findMany({
          where: { clubId, role: "admin", active: true },
          select: { id: true },
        });
        adminsByClub.set(clubId, list);
      }
      return list;
    }

    for (const sub of expiringSoon) {
      // نافذة منع تكرار التذكير — من إعدادات الميزات (الافتراضي: 1 يوم)
      const feat = await featsForClub(sub.clubId);
      const repeatDays = Math.max(1, Number(feat.reminderRepeatDays) || 1);
      const existing = await db.notification.findFirst({
        where: {
          clubId: sub.clubId,
          type: "renewal",
          createdAt: { gte: new Date(Date.now() - repeatDays * 24 * 60 * 60 * 1000) },
          message: { contains: sub.fileNumber },
        },
      });
      if (!existing) {
        const admins = await getAdminsForClub(sub.clubId);
        for (const admin of admins) {
          await db.notification.create({
            data: {
              clubId: sub.clubId,
              userId: admin.id,
              type: "renewal",
              title: "اشتراك قريب الانتهاء",
              message: `${sub.lastName} ${sub.firstName} (${sub.fileNumber}) — ينتهي في ${sub.expiryDate ? new Date(sub.expiryDate).toLocaleDateString("ar-DZ") : "قريب"}`,
              link: "/?tab=renewals",
            },
          });
          created++;
        }
      }
    }

    for (const sub of expired) {
      const feat = await featsForClub(sub.clubId);
      const repeatDays = Math.max(1, Number(feat.reminderRepeatDays) || 1);
      const existing = await db.notification.findFirst({
        where: {
          clubId: sub.clubId,
          type: "renewal",
          createdAt: { gte: new Date(Date.now() - repeatDays * 24 * 60 * 60 * 1000) },
          message: { contains: sub.fileNumber },
        },
      });
      if (!existing) {
        const admins = await getAdminsForClub(sub.clubId);
        for (const admin of admins) {
          await db.notification.create({
            data: {
              clubId: sub.clubId,
              userId: admin.id,
              type: "renewal",
              title: "⚠️ اشتراك منتهي",
              message: `${sub.lastName} ${sub.firstName} (${sub.fileNumber}) — اشتراك منتهي ويحتاج تجديد`,
              link: "/?tab=renewals",
            },
          });
          created++;
        }
      }
    }

    // Absence alerts: subscribers who haven't attended in N days (ميزة متزامنة — افتراضي 21)
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let absenceCreated = 0;
    for (const sub of subscribers) {
      const feat = await featsForClub(sub.clubId);
      const absenceWindowDays = Math.max(1, Number(feat.attendanceAbsenceWindowDays) || 21);
      const absenceCutoff = new Date(now);
      absenceCutoff.setDate(absenceCutoff.getDate() - absenceWindowDays);

      const lastAtt = sub.attendances[0]?.date;
      const lastDate = lastAtt ? new Date(lastAtt) : null;
      if (lastDate && lastDate >= absenceCutoff) continue; // attended recently
      if (!sub.lastPaymentDate) continue; // never paid, skip

      const existing = await db.notification.findFirst({
        where: {
          clubId: sub.clubId,
          type: "system",
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // weekly dedup
          message: { contains: sub.fileNumber },
          title: { contains: "غياب" },
        },
      });
      if (!existing) {
        const weeks = lastDate
          ? Math.floor((now.getTime() - lastDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
          : 99;
        const admins = await getAdminsForClub(sub.clubId);
        for (const admin of admins) {
          await db.notification.create({
            data: {
              clubId: sub.clubId,
              userId: admin.id,
              type: "system",
              title: "🚨 غياب متكرر",
              message: `${sub.lastName} ${sub.firstName} (${sub.fileNumber}) — غائب ${weeks >= 99 ? "منذ البداية" : `${weeks} أسابيع`} — ينبغي التواصل معه`,
              link: "/?tab=subscribers",
            },
          });
          absenceCreated++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      created,
      absenceCreated,
      expiringSoon: expiringSoon.length,
      expired: expired.length,
    });
  } catch (e) {
    console.error("Cron notifications:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

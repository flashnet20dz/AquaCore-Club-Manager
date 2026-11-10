import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { restoreSqliteBuffer, restoreJsonData } from "@/lib/backup-restore";
import { resolveSqliteDbPath, isSqliteEngine } from "@/lib/db-path";
import fs from "fs";

export const dynamic = "force-dynamic";

// حجم دفعة الصور في النسخة الشاملة المجزأة (master) — 5 صور ≈ 8.5MB مع استجابة متدفقة
const MASTER_PHOTO_TAKE = 5;

// ═════════════════════════════════════════════════════════════════════════════
// 1. GET: تصدير نسخة احتياطية شاملة 100% لكافة بيانات ومعلومات حساب النادي
// ═════════════════════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format");

    // أ) تصدير ملف SQLite المباشر (.db) — لقطة طبق الأصل 100% مع تفريغ الـ WAL
    if (format === "sqlite" || format === "db") {
      // ★ المسار يُستخرج من DATABASE_URL مباشرة (إصلاح فشل تصدير قاعدة البيانات)
      const dbPath = resolveSqliteDbPath();
      if (!dbPath) {
        return NextResponse.json(
          { error: "تصدير ملف .db متاح فقط على الخادم المحلي (SQLite). على الخادم السحابي (PostgreSQL) تُصدَّر النسخة الشاملة تلقائياً بصيغة JSON المكافئة 100%.", hint: "master" },
          { status: 501 }
        );
      }
      if (!fs.existsSync(dbPath)) {
        return NextResponse.json(
          { error: `ملف قاعدة بيانات SQLite غير متوفر حالياً على الخادم (${dbPath})` },
          { status: 404 }
        );
      }

      // تفريغ سجل الكتابة المسبقة (WAL) لضمان كتابة كافة العمليات في dev.db فوراً
      try {
        await db.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE);");
      } catch (err) {
        console.warn("[backup] wal_checkpoint warning:", err);
      }

      const fileBuffer = fs.readFileSync(dbPath);
      const filename = `aquacore-db-${new Date().toISOString().split("T")[0]}.db`;
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": "application/x-sqlite3",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // ★ أ-2) النسخة الشاملة المجزأة (master) — تعمل على PostgreSQL السحابي حيث لا يوجد
    //    ملف .db، وتتجنب حدود حجم استجابة serverless (الصور Base64 تتجاوز 70MB):
    //    part=data  → كل الجداول + الصور خفيفة (بدون Base64) + masterMeta (عدد الأجزاء)
    //    part=photos&index=N → دفعة صور كاملة (original/cropped/thumbnail) متدفقة
    if (format === "master") {
      const clubId = user.clubId!;
      const clubFilter = user.role === "superadmin" ? {} : { clubId };

      if (searchParams.get("part") === "photos") {
        const index = Math.max(0, parseInt(searchParams.get("index") || "0", 10) || 0);
        const photos = await db.subscriberPhoto.findMany({
          where: { subscriber: clubFilter },
          orderBy: { id: "asc" },
          skip: index * MASTER_PHOTO_TAKE,
          take: MASTER_PHOTO_TAKE,
        }).catch(() => []);

        const total = await db.subscriberPhoto.count({ where: { subscriber: clubFilter } }).catch(() => 0);
        const payload = JSON.stringify({
          ok: true,
          index,
          total,
          take: MASTER_PHOTO_TAKE,
          photos,
        });

        // استجابة متدفقة لتجاوز حد التخزين المؤقت للاستجابة (~6MB) في serverless
        const encoder = new TextEncoder();
        const CHUNK = 512 * 1024;
        const stream = new ReadableStream({
          start(controller) {
            for (let i = 0; i < payload.length; i += CHUNK) {
              controller.enqueue(encoder.encode(payload.slice(i, i + CHUNK)));
            }
            controller.close();
          },
        });
        return new NextResponse(stream, {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            "X-Photo-Index": String(index),
            "X-Photo-Total": String(total),
          },
        });
      }

      // part=data (الافتراضي): كل الجداول — الصور خفيفة بدون Base64 الثقيل
      const [backup, photoCount] = await Promise.all([
        buildJsonBackup(user, { lightPhotos: true }),
        db.subscriberPhoto.count({ where: { subscriber: clubFilter } }).catch(() => 0),
      ]);
      const masterBackup = {
        ...backup,
        masterMeta: {
          engine: isSqliteEngine() ? ("sqlite" as const) : ("postgresql" as const),
          photoCount,
          photoTake: MASTER_PHOTO_TAKE,
          photoParts: Math.ceil(photoCount / MASTER_PHOTO_TAKE),
        },
      };

      const json = JSON.stringify(masterBackup);
      const filename = `aquacore-master-part-data-${new Date().toISOString().split("T")[0]}.json`;
      return new NextResponse(json, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "X-Master-Photo-Count": String(photoCount),
          "X-Master-Photo-Parts": String(Math.ceil(photoCount / MASTER_PHOTO_TAKE)),
        },
      });
    }

    // ب) تصدير JSON شامل 100% لكافة جداول وسجلات النادي بدون أي استثناء
    const backup = await buildJsonBackup(user);

    const json = JSON.stringify(backup, null, 2);
    const filename = `aquacore-full-backup-${new Date().toISOString().split("T")[0]}.json`;

    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error("Backup export:", e);
    return NextResponse.json({ error: "تعذر تصدير النسخة الاحتياطية" }, { status: 500 });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// بناء كائن النسخة الاحتياطية الشامل — مشترك بين تصدير JSON والمسار المجزأ (master)
// lightPhotos: استبعاد حقول Base64 الثقيلة من الصور (original/cropped/thumbnail)
// ═════════════════════════════════════════════════════════════════════════════
async function buildJsonBackup(
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
  opts: { lightPhotos?: boolean } = {}
) {
  const clubId = user.clubId!;
  const clubFilter = user.role === "superadmin" ? {} : { clubId };

  const [
      club,
      subscribers,
      subscriberPhotos,
      renewals,
      attendances,
      payments,
      financialTransactions,
      financialBalance,
      workHours,
      wagePayments,
      staffCompensations,
      wageReceipts,
      incomingMails,
      swimmingDays,
      swimmingTimeSlots,
      poolClosures,
      compensations,
      compensationHistory,
      waitlists,
      subscriberContracts,
      settings,
      cashierPins,
      subscriptionTypes,
      employees,
      employmentContracts,
      contractTemplates,
      guardAssignments,
      cardTemplates,
      uiConfigurations,
      uiTemplates,
      activities,
      notifications,
      users,
      auditLogs,
      clubSettings,
      featureFlags,
      featureAccess,
      clubGroups,
      clubGroupMembers,
      defaultClubConfig,
      clubSubscriptions,
      subscriptionHistories,
      codeBatches,
      activationCodes,
      clubRequests,
      syncOutbox,
      syncMeta,
    ] = await Promise.all([
      db.club.findUnique({ where: { id: clubId } }).catch(() => null),
      db.subscriber.findMany({ where: clubFilter }).catch(() => []),
      db.subscriberPhoto.findMany({ where: { subscriber: clubFilter } }).catch(() => []),
      db.renewal.findMany({ where: clubFilter }).catch(() => []),
      db.attendance.findMany({ where: clubFilter }).catch(() => []),
      db.payment.findMany({ where: clubFilter }).catch(() => []),
      db.financialTransaction.findMany({ where: clubFilter }).catch(() => []),
      db.financialBalance.findFirst({ where: clubFilter }).catch(() => null),
      db.workHours.findMany({ where: clubFilter }).catch(() => []),
      db.wagePayment.findMany({ where: clubFilter }).catch(() => []),
      db.staffCompensation.findMany({ where: clubFilter }).catch(() => []),
      db.wageReceipt.findMany({ where: clubFilter }).catch(() => []),
      db.incomingMail.findMany({ where: clubFilter }).catch(() => []),
      db.swimmingDay.findMany({ where: clubFilter }).catch(() => []),
      db.swimmingTimeSlot.findMany({ where: clubFilter }).catch(() => []),
      db.poolClosure.findMany({ where: clubFilter }).catch(() => []),
      db.compensation.findMany({ where: clubFilter }).catch(() => []),
      db.compensationHistory.findMany({ where: { compensation: clubFilter } }).catch(() => []),
      db.waitlist.findMany({ where: clubFilter }).catch(() => []),
      db.subscriberContract.findMany({ where: clubFilter }).catch(() => []),
      db.setting.findMany({ where: clubFilter }).catch(() => []),
      db.cashierPin.findMany({ where: clubFilter }).catch(() => []),
      db.subscriptionType.findMany({ where: clubFilter }).catch(() => []),
      db.employee.findMany({ where: clubFilter }).catch(() => []),
      db.employmentContract.findMany({ where: clubFilter }).catch(() => []),
      db.contractTemplate.findMany({ where: clubFilter }).catch(() => []),
      db.guardAssignment.findMany({ where: clubFilter }).catch(() => []),
      db.cardTemplate.findMany({ where: clubFilter }).catch(() => []),
      db.uIConfiguration.findMany({ where: clubFilter }).catch(() => []),
      db.uITemplate.findMany().catch(() => []),
      db.activity.findMany({ where: clubFilter }).catch(() => []),
      db.notification.findMany({ where: clubFilter }).catch(() => []),
      db.user.findMany({
        where: clubFilter,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          phone: true,
          avatar: true,
          active: true,
          pending: true,
          passwordHash: true,
          clubId: true,
          createdAt: true,
        },
      }).catch(() => []),
      db.auditLog.findMany({ where: user.role === "superadmin" ? {} : { clubId }, take: 5000, orderBy: { createdAt: "desc" } }).catch(() => []),
      db.clubSettings.findUnique({ where: { clubId } }).catch(() => null),
      db.featureFlag.findMany().catch(() => []),
      db.featureAccess.findMany({ where: user.role === "superadmin" ? {} : { OR: [{ clubId }, { clubId: null }] } }).catch(() => []),
      db.clubGroup.findMany().catch(() => []),
      db.clubGroupMember.findMany({ where: clubFilter }).catch(() => []),
      db.defaultClubConfig.findMany().catch(() => []),
      db.clubSubscription.findMany({ where: clubFilter }).catch(() => []),
      db.subscriptionHistory.findMany({ where: { subscription: clubFilter } }).catch(() => []),
      db.codeBatch.findMany().catch(() => []),
      db.activationCode.findMany({ where: user.role === "superadmin" ? {} : { OR: [{ clubId }, { clubId: null }] } }).catch(() => []),
      db.clubRequest.findMany({ where: clubFilter }).catch(() => []),
      db.syncOutbox.findMany({ where: clubFilter }).catch(() => []),
      db.syncMeta.findMany().catch(() => []),
    ]);

    // ★ الصور الخفيفة (lightPhotos): استبعاد حقول Base64 الثقيلة (original/cropped/thumbnail)
    //   عند بناء جزء البيانات في المسار المجزأ — تُجلب لاحقاً على دفعات part=photos
    const photos = opts.lightPhotos
      ? subscriberPhotos.map((p) => ({
          id: p.id,
          subscriberId: p.subscriberId,
          faceDetected: p.faceDetected,
          cloudinaryPublicId: p.cloudinaryPublicId,
          cloudinaryUrl: p.cloudinaryUrl,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        }))
      : subscriberPhotos;

    const backup = {
      version: "2.1",
      system: "AquaCore Club Manager",
      exportedAt: new Date().toISOString(),
      exportedBy: user.email,
      clubId,
      clubName: club?.name || "AquaCore Club",
      counts: {
        subscribers: subscribers.length,
        subscriberPhotos: photos.length,
        subscriberContracts: subscriberContracts.length,
        renewals: renewals.length,
        attendances: attendances.length,
        payments: payments.length,
        financialTransactions: financialTransactions.length,
        workHours: workHours.length,
        wagePayments: wagePayments.length,
        staffCompensations: staffCompensations.length,
        wageReceipts: wageReceipts.length,
        incomingMails: incomingMails.length,
        swimmingDays: swimmingDays.length,
        swimmingTimeSlots: swimmingTimeSlots.length,
        poolClosures: poolClosures.length,
        compensations: compensations.length,
        compensationHistory: compensationHistory.length,
        waitlists: waitlists.length,
        settings: settings.length,
        cashierPins: cashierPins.length,
        subscriptionTypes: subscriptionTypes.length,
        employees: employees.length,
        employmentContracts: employmentContracts.length,
        contractTemplates: contractTemplates.length,
        guardAssignments: guardAssignments.length,
        cardTemplates: cardTemplates.length,
        uiConfigurations: uiConfigurations.length,
        uiTemplates: uiTemplates.length,
        activities: activities.length,
        notifications: notifications.length,
        users: users.length,
        auditLogs: auditLogs.length,
        featureFlags: featureFlags.length,
        featureAccess: featureAccess.length,
        clubGroups: clubGroups.length,
        clubGroupMembers: clubGroupMembers.length,
        defaultClubConfig: defaultClubConfig.length,
        clubSubscriptions: clubSubscriptions.length,
        subscriptionHistories: subscriptionHistories.length,
        codeBatches: codeBatches.length,
        activationCodes: activationCodes.length,
        clubRequests: clubRequests.length,
        syncOutbox: syncOutbox.length,
        syncMeta: syncMeta.length,
      },
      data: {
        club,
        subscribers,
        subscriberPhotos: photos,
        subscriberContracts,
        renewals,
        attendances,
        payments,
        financialTransactions,
        financialBalance,
        workHours,
        wagePayments,
        staffCompensations,
        wageReceipts,
        incomingMails,
        swimmingDays,
        swimmingTimeSlots,
        poolClosures,
        compensations,
        compensationHistory,
        waitlists,
        settings,
        cashierPins,
        subscriptionTypes,
        employees,
        employmentContracts,
        contractTemplates,
        guardAssignments,
        cardTemplates,
        uiConfigurations,
        uiTemplates,
        activities,
        notifications,
        users,
        auditLogs,
        clubSettings,
        featureFlags,
        featureAccess,
        clubGroups,
        clubGroupMembers,
        defaultClubConfig,
        clubSubscriptions,
        subscriptionHistories,
        codeBatches,
        activationCodes,
        clubRequests,
        syncOutbox,
        syncMeta,
      },
    };

  return backup;
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. POST: استيراد واستعادة نسخة احتياطية كاملة 100% (FormData أو JSON)
// ═════════════════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const contentType = req.headers.get("content-type") || "";

    // أ) المعالجة عند رفع ملف عبر FormData (المفضل للملفات الضخمة والصور)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const mode = (formData.get("mode") as "merge" | "replace") || "merge";

      if (!file) {
        return NextResponse.json({ error: "يرجى تحديد ملف النسخة الاحتياطية" }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length < 4) {
        return NextResponse.json({ error: "الملف المرفوع فارغ" }, { status: 400 });
      }

      // فحص هل هو ملف قاعدة بيانات SQLite أصلي (.db / .sqlite)
      const SQLITE_HEADER = Buffer.from("SQLite format 3\0");
      const isSqlite = buffer.length >= 16 && buffer.subarray(0, 16).equals(SQLITE_HEADER);

      if (isSqlite) {
        return await restoreSqliteBuffer(buffer, file.name, user);
      }

      // قراءة كـ JSON
      try {
        const text = buffer.toString("utf8");
        const parsed = JSON.parse(text);
        return await restoreJsonData(parsed, user.clubId!, mode);
      } catch (parseErr: any) {
        return NextResponse.json(
          { error: `تعذر قراءة محتوى الملف: ${parseErr?.message || "صيغة غير صالحة"}` },
          { status: 400 }
        );
      }
    }

    // ب) المعالجة عند إرسال JSON في الـ Body
    const body = await req.json();
    const backup = body.backup || body;
    const mode = (body.mode as "merge" | "replace") || "merge";

    if (!backup) {
      return NextResponse.json({ error: "ملف النسخة الاحتياطية غير صالح أو فارغ" }, { status: 400 });
    }

    return await restoreJsonData(backup, user.clubId!, mode);
  } catch (e: any) {
    console.error("[backup] Import error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "فشل استيراد النسخة الاحتياطية" },
      { status: 500 }
    );
  }
}

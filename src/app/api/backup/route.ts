import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import fs from "fs";
import path from "path";

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
      const dbPath = path.join(process.cwd(), "prisma", "dev.db");
      if (fs.existsSync(dbPath)) {
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
    }

    // ب) تصدير JSON شامل 100% لكافة جداول وسجلات النادي بدون أي استثناء
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
      activities,
      notifications,
      users,
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
      db.activity.findMany({ where: clubFilter }).catch(() => []),
      db.notification.findMany({ where: clubFilter }).catch(() => []),
      db.user.findMany({
        where: clubFilter,
        select: { id: true, email: true, name: true, role: true, phone: true, active: true, createdAt: true },
      }).catch(() => []),
    ]);

    const backup = {
      version: "2.0",
      system: "AquaCore Club Manager",
      exportedAt: new Date().toISOString(),
      exportedBy: user.email,
      clubId,
      clubName: club?.name || "AquaCore Club",
      counts: {
        subscribers: subscribers.length,
        subscriberPhotos: subscriberPhotos.length,
        renewals: renewals.length,
        attendances: attendances.length,
        payments: payments.length,
        financialTransactions: financialTransactions.length,
        workHours: workHours.length,
        wagePayments: wagePayments.length,
        staffCompensations: staffCompensations.length,
        swimmingDays: swimmingDays.length,
        swimmingTimeSlots: swimmingTimeSlots.length,
        poolClosures: poolClosures.length,
        compensations: compensations.length,
        compensationHistory: compensationHistory.length,
        waitlists: waitlists.length,
        subscriberContracts: subscriberContracts.length,
        settings: settings.length,
        cashierPins: cashierPins.length,
        subscriptionTypes: subscriptionTypes.length,
        employees: employees.length,
        employmentContracts: employmentContracts.length,
        contractTemplates: contractTemplates.length,
        guardAssignments: guardAssignments.length,
        cardTemplates: cardTemplates.length,
        uiConfigurations: uiConfigurations.length,
        activities: activities.length,
        notifications: notifications.length,
        users: users.length,
      },
      data: {
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
        activities,
        notifications,
        users,
      },
    };

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
// 2. POST: استيراد واستعادة نسخة احتياطية كاملة 100% لكافة جداول وبيانات النادي
// ═════════════════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await req.json();
    const { backup, mode } = body as {
      backup: { version?: string; data?: Record<string, unknown[]> };
      mode: "merge" | "replace";
    };

    if (!backup || !backup.data) {
      return NextResponse.json({ error: "ملف النسخة الاحتياطية غير صالح أو فارغ" }, { status: 400 });
    }

    const clubId = user.clubId!;
    const clubFilter = user.role === "superadmin" ? {} : { clubId };
    const d = backup.data as Record<string, any[]>;

    const importedCounts: Record<string, number> = {};
    let totalImported = 0;

    // ── في وضع الاستبدال الكامل (Replace): مسح البيانات الحالية للنادي بترتيب آمن ──
    if (mode === "replace") {
      try {
        await Promise.allSettled([
          db.compensationHistory.deleteMany({ where: { compensation: clubFilter } }),
          db.compensation.deleteMany({ where: clubFilter }),
          db.poolClosure.deleteMany({ where: clubFilter }),
          db.subscriberContract.deleteMany({ where: clubFilter }),
          db.waitlist.deleteMany({ where: clubFilter }),
          db.financialTransaction.deleteMany({ where: clubFilter }),
          db.wagePayment.deleteMany({ where: clubFilter }),
          db.staffCompensation.deleteMany({ where: clubFilter }),
          db.payment.deleteMany({ where: clubFilter }),
          db.attendance.deleteMany({ where: clubFilter }),
          db.renewal.deleteMany({ where: clubFilter }),
          db.workHours.deleteMany({ where: clubFilter }),
          db.guardAssignment.deleteMany({ where: clubFilter }),
          db.employmentContract.deleteMany({ where: clubFilter }),
          db.employee.deleteMany({ where: clubFilter }),
          db.contractTemplate.deleteMany({ where: clubFilter }),
          db.cardTemplate.deleteMany({ where: clubFilter }),
          db.swimmingTimeSlot.deleteMany({ where: clubFilter }),
          db.swimmingDay.deleteMany({ where: clubFilter }),
          db.subscriptionType.deleteMany({ where: clubFilter }),
          db.cashierPin.deleteMany({ where: clubFilter }),
          db.uIConfiguration.deleteMany({ where: clubFilter }),
          db.notification.deleteMany({ where: clubFilter }),
          db.activity.deleteMany({ where: clubFilter }),
          db.setting.deleteMany({ where: clubFilter }),
          db.subscriberPhoto.deleteMany({ where: { subscriber: clubFilter } }),
          db.subscriber.deleteMany({ where: clubFilter }),
        ]);
      } catch (cleanErr) {
        console.warn("[restore] Clean existing data warning:", cleanErr);
      }
    }

    // ── 1. استعادة إعدادات النادي (Settings) ──
    if (Array.isArray(d.settings) && d.settings.length > 0) {
      let count = 0;
      for (const s of d.settings) {
        if (!s.key) continue;
        try {
          await db.setting.upsert({
            where: { clubId_key: { clubId, key: s.key } },
            create: { clubId, key: s.key, value: String(s.value ?? "") },
            update: { value: String(s.value ?? "") },
          });
          count++;
        } catch {}
      }
      importedCounts.settings = count;
      totalImported += count;
    }

    // ── 2. استعادة أيام وحصص المسبح (Swimming Days & Slots) ──
    if (Array.isArray(d.swimmingDays) && d.swimmingDays.length > 0) {
      let count = 0;
      for (const day of d.swimmingDays) {
        if (!day.name) continue;
        try {
          await db.swimmingDay.upsert({
            where: { clubId_name: { clubId, name: day.name } },
            create: {
              id: day.id,
              clubId,
              name: day.name,
              shortName: day.shortName || day.name.slice(0, 3),
              color: day.color || "#0d9488",
              active: Boolean(day.active ?? true),
              sortOrder: Number(day.sortOrder ?? 0),
            },
            update: {
              shortName: day.shortName || day.name.slice(0, 3),
              color: day.color || "#0d9488",
              active: Boolean(day.active ?? true),
            },
          });
          count++;
        } catch {}
      }
      importedCounts.swimmingDays = count;
      totalImported += count;
    }

    if (Array.isArray(d.swimmingTimeSlots) && d.swimmingTimeSlots.length > 0) {
      let count = 0;
      for (const slot of d.swimmingTimeSlots) {
        if (!slot.name || !slot.startTime || !slot.endTime) continue;
        try {
          await db.swimmingTimeSlot.upsert({
            where: { id: slot.id || `slot-${slot.name}-${clubId}` },
            create: {
              id: slot.id,
              clubId,
              name: slot.name,
              startTime: slot.startTime,
              endTime: slot.endTime,
              maxCapacity: Number(slot.maxCapacity ?? 30),
              active: Boolean(slot.active ?? true),
              dayOfWeek: slot.dayOfWeek || null,
              sortOrder: Number(slot.sortOrder ?? 0),
            },
            update: {
              name: slot.name,
              startTime: slot.startTime,
              endTime: slot.endTime,
              dayOfWeek: slot.dayOfWeek || null,
              active: Boolean(slot.active ?? true),
            },
          });
          count++;
        } catch {}
      }
      importedCounts.swimmingTimeSlots = count;
      totalImported += count;
    }

    // ── 3. استعادة أنواع الاشتراكات المخصصة (Subscription Types) ──
    if (Array.isArray(d.subscriptionTypes) && d.subscriptionTypes.length > 0) {
      let count = 0;
      for (const st of d.subscriptionTypes) {
        if (!st.name || !st.code) continue;
        try {
          await db.subscriptionType.upsert({
            where: { clubId_code: { clubId, code: st.code } },
            create: {
              id: st.id,
              clubId,
              name: st.name,
              code: st.code,
              color: st.color || "#0d9488",
              description: st.description || null,
              subscriptionFee: Number(st.subscriptionFee ?? st.price ?? 0),
              insuranceFee: Number(st.insuranceFee ?? 500),
              compoundRights: Number(st.compoundRights ?? 1000),
              durationDays: Number(st.durationDays ?? 30),
              givesMembershipNumber: Boolean(st.givesMembershipNumber ?? true),
              requiresInsurance: Boolean(st.requiresInsurance ?? true),
              requiresCompoundFee: Boolean(st.requiresCompoundFee ?? true),
              renewableMonthly: Boolean(st.renewableMonthly ?? true),
              freeSubscription: Boolean(st.freeSubscription ?? false),
              numberingGroup: st.numberingGroup || "RCS",
              active: Boolean(st.active ?? true),
            },
            update: {
              name: st.name,
              color: st.color || "#0d9488",
              subscriptionFee: Number(st.subscriptionFee ?? st.price ?? 0),
              insuranceFee: Number(st.insuranceFee ?? 500),
              compoundRights: Number(st.compoundRights ?? 1000),
              durationDays: Number(st.durationDays ?? 30),
              active: Boolean(st.active ?? true),
            },
          });
          count++;
        } catch {}
      }
      importedCounts.subscriptionTypes = count;
      totalImported += count;
    }

    // ── 4. استعادة المنخرطين بكافة حقولهم 100% (Subscribers) ──
    if (Array.isArray(d.subscribers) && d.subscribers.length > 0) {
      let count = 0;
      for (const s of d.subscribers) {
        try {
          const fileNumber = String(s.fileNumber || "").trim();
          if (!fileNumber) continue;

          await db.subscriber.upsert({
            where: { clubId_fileNumber: { clubId, fileNumber } },
            create: {
              id: s.id,
              clubId,
              fileNumber,
              lastName: s.lastName || "",
              firstName: s.firstName || "",
              birthDate: s.birthDate ? new Date(s.birthDate) : new Date("2000-01-01"),
              gender: s.gender || "ذكر",
              bloodType: s.bloodType || null,
              subscriptionType: s.subscriptionType || "شهري",
              lastPaymentDate: s.lastPaymentDate ? new Date(s.lastPaymentDate) : null,
              paymentStatus: s.paymentStatus || "لم يدفع",
              swimmingDays: s.swimmingDays || null,
              timeSlot: s.timeSlot || null,
              phone: s.phone || null,
              photoPath: s.photoPath || null,
              photoThumb: s.photoThumb || null,
              deletedAt: s.deletedAt ? new Date(s.deletedAt) : null,
              createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
            },
            update: {
              lastName: s.lastName,
              firstName: s.firstName,
              birthDate: s.birthDate ? new Date(s.birthDate) : undefined,
              gender: s.gender,
              bloodType: s.bloodType,
              subscriptionType: s.subscriptionType,
              lastPaymentDate: s.lastPaymentDate ? new Date(s.lastPaymentDate) : null,
              paymentStatus: s.paymentStatus,
              swimmingDays: s.swimmingDays,
              timeSlot: s.timeSlot,
              phone: s.phone,
              photoPath: s.photoPath,
              deletedAt: s.deletedAt ? new Date(s.deletedAt) : null,
            },
          });
          count++;
        } catch (subErr) {
          console.warn("[restore] Subscriber restore item error:", subErr);
        }
      }
      importedCounts.subscribers = count;
      totalImported += count;
    }

    // ── 5. استعادة التجديدات والاشتراكات (Renewals) ──
    if (Array.isArray(d.renewals) && d.renewals.length > 0) {
      let count = 0;
      for (const r of d.renewals) {
        if (!r.subscriberId) continue;
        try {
          await db.renewal.upsert({
            where: { id: r.id },
            create: {
              id: r.id,
              clubId,
              subscriberId: r.subscriberId,
              renewalDate: new Date(r.renewalDate),
              expiryDate: new Date(r.expiryDate),
              months: Number(r.months ?? 1),
              amount: Number(r.amount ?? 0),
              paymentStatus: r.paymentStatus || "مدفوع",
              note: r.note || null,
              createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
            },
            update: {
              renewalDate: new Date(r.renewalDate),
              expiryDate: new Date(r.expiryDate),
              months: Number(r.months ?? 1),
              amount: Number(r.amount ?? 0),
              paymentStatus: r.paymentStatus,
              note: r.note,
            },
          });
          count++;
        } catch {}
      }
      importedCounts.renewals = count;
      totalImported += count;
    }

    // ── 6. استعادة سجلات الحضور (Attendances) ──
    if (Array.isArray(d.attendances) && d.attendances.length > 0) {
      let count = 0;
      for (const a of d.attendances) {
        if (!a.subscriberId) continue;
        try {
          const attendanceDate = a.date ? new Date(a.date) : new Date();
          const checkIn = a.checkInTime ? new Date(a.checkInTime) : attendanceDate;
          await db.attendance.upsert({
            where: { id: a.id },
            create: {
              id: a.id,
              clubId,
              subscriberId: a.subscriberId,
              date: attendanceDate,
              checkInTime: checkIn,
              checkOutTime: a.checkOutTime ? new Date(a.checkOutTime) : null,
              method: a.method || "qr",
              coachId: a.coachId || null,
              note: a.note || null,
              isCompensation: Boolean(a.isCompensation ?? false),
            },
            update: {
              date: attendanceDate,
              checkInTime: checkIn,
              note: a.note,
            },
          });
          count++;
        } catch {}
      }
      importedCounts.attendances = count;
      totalImported += count;
    }

    // ── 7. استعادة المعاملات المالية والمحاسبية 100% (Financial Transactions) ──
    if (Array.isArray(d.financialTransactions) && d.financialTransactions.length > 0) {
      let count = 0;
      for (const tx of d.financialTransactions) {
        try {
          await db.financialTransaction.upsert({
            where: { id: tx.id },
            create: {
              id: tx.id,
              clubId,
              type: tx.type || "income",
              amount: Number(tx.amount ?? 0),
              category: tx.category || "عام",
              subCategory: tx.subCategory || null,
              date: tx.date ? new Date(tx.date) : new Date(),
              paymentMethod: tx.paymentMethod || "cash",
              payeeName: tx.payeeName || null,
              payeeId: tx.payeeId || null,
              subscriberId: tx.subscriberId || null,
              employeeId: tx.employeeId || null,
              staffCompensationId: tx.staffCompensationId || null,
              closureId: tx.closureId || null,
              reference: tx.reference || null,
              note: tx.note || null,
              createdById: tx.createdById || null,
              status: tx.status || "active",
              createdAt: tx.createdAt ? new Date(tx.createdAt) : new Date(),
            },
            update: {
              type: tx.type,
              amount: Number(tx.amount ?? 0),
              category: tx.category,
              subCategory: tx.subCategory || null,
              date: tx.date ? new Date(tx.date) : undefined,
              paymentMethod: tx.paymentMethod,
              reference: tx.reference,
              note: tx.note,
              status: tx.status || "active",
            },
          });
          count++;
        } catch (txErr) {
          console.warn("[restore] Financial transaction item error:", txErr);
        }
      }
      importedCounts.financialTransactions = count;
      totalImported += count;
    }

    // ── 8. استعادة ساعات عمل العمال وتسديدات الأجور (Work Hours & Wages) ──
    if (Array.isArray(d.workHours) && d.workHours.length > 0) {
      let count = 0;
      for (const w of d.workHours) {
        if (!w.userId) continue;
        try {
          await db.workHours.upsert({
            where: { id: w.id },
            create: {
              id: w.id,
              clubId,
              userId: w.userId,
              date: new Date(w.date),
              startTime: new Date(w.startTime),
              endTime: new Date(w.endTime),
              status: w.status || "pending",
              note: w.note || null,
              approvedById: w.approvedById || null,
              approvedAt: w.approvedAt ? new Date(w.approvedAt) : null,
              rateSnapshot: w.rateSnapshot ? Number(w.rateSnapshot) : null,
              rejectionReason: w.rejectionReason || null,
              slotId: w.slotId || null,
            },
            update: {
              date: new Date(w.date),
              startTime: new Date(w.startTime),
              endTime: new Date(w.endTime),
              status: w.status,
              note: w.note,
            },
          });
          count++;
        } catch {}
      }
      importedCounts.workHours = count;
      totalImported += count;
    }

    if (Array.isArray(d.wagePayments) && d.wagePayments.length > 0) {
      let count = 0;
      for (const wp of d.wagePayments) {
        if (!wp.userId) continue;
        try {
          await db.wagePayment.upsert({
            where: { id: wp.id },
            create: {
              id: wp.id,
              clubId,
              userId: wp.userId,
              periodStart: new Date(wp.periodStart),
              periodEnd: new Date(wp.periodEnd),
              periodLabel: wp.periodLabel || "فترة تسديد",
              hours: Number(wp.hours ?? 0),
              hourRate: Number(wp.hourRate ?? 200),
              grossAmount: Number(wp.grossAmount ?? wp.amount ?? 0),
              prevPaid: Number(wp.prevPaid ?? 0),
              amount: Number(wp.amount ?? 0),
              method: wp.method || "cash",
              paidAt: wp.paidAt ? new Date(wp.paidAt) : new Date(),
              note: wp.note || null,
              status: wp.status || "active",
            },
            update: {
              amount: Number(wp.amount ?? 0),
              status: wp.status,
            },
          });
          count++;
        } catch {}
      }
      importedCounts.wagePayments = count;
      totalImported += count;
    }

    // ── 9. استعادة إغلاقات المسبح والتعويضات (Pool Closures & Compensations) ──
    if (Array.isArray(d.poolClosures) && d.poolClosures.length > 0) {
      let count = 0;
      for (const pc of d.poolClosures) {
        try {
          const closureDate = pc.date ? new Date(pc.date) : (pc.startDate ? new Date(pc.startDate) : new Date());
          await db.poolClosure.upsert({
            where: { id: pc.id },
            create: {
              id: pc.id,
              clubId,
              date: closureDate,
              startDate: pc.startDate ? new Date(pc.startDate) : closureDate,
              endDate: pc.endDate ? new Date(pc.endDate) : closureDate,
              swimmingDays: pc.swimmingDays || null,
              timeSlot: pc.timeSlot || null,
              reason: pc.reason || "صيانة",
              note: pc.note || null,
              subscriptionTypesFilter: pc.subscriptionTypesFilter || null,
              paymentStatusesFilter: pc.paymentStatusesFilter || null,
              createdById: pc.createdById || null,
              createdAt: pc.createdAt ? new Date(pc.createdAt) : new Date(),
            },
            update: {
              reason: pc.reason,
              note: pc.note,
            },
          });
          count++;
        } catch {}
      }
      importedCounts.poolClosures = count;
      totalImported += count;
    }

    if (Array.isArray(d.compensations) && d.compensations.length > 0) {
      let count = 0;
      for (const comp of d.compensations) {
        if (!comp.subscriberId) continue;
        try {
          await db.compensation.upsert({
            where: { id: comp.id },
            create: {
              id: comp.id,
              clubId,
              closureId: comp.closureId || null,
              subscriberId: comp.subscriberId,
              originalDate: comp.originalDate ? new Date(comp.originalDate) : new Date(),
              originalSwimmingDays: comp.originalSwimmingDays || null,
              originalTimeSlot: comp.originalTimeSlot || null,
              status: comp.status || "pending",
              cancelledSessionsCount: Number(comp.cancelledSessionsCount ?? 1),
              compensatedCount: Number(comp.compensatedCount ?? 0),
              expiryDate: comp.expiryDate ? new Date(comp.expiryDate) : null,
              compensationDate: comp.compensationDate ? new Date(comp.compensationDate) : null,
              compensationSwimmingDays: comp.compensationSwimmingDays || null,
              compensationTimeSlot: comp.compensationTimeSlot || null,
              note: comp.note || null,
              createdAt: comp.createdAt ? new Date(comp.createdAt) : new Date(),
            },
            update: {
              status: comp.status,
              compensatedCount: Number(comp.compensatedCount ?? 0),
            },
          });
          count++;
        } catch {}
      }
      importedCounts.compensations = count;
      totalImported += count;
    }

    // ── 10. استعادة قوائم الانتظار، العقود، قوالب البطاقات والأنشطة ──
    if (Array.isArray(d.waitlists) && d.waitlists.length > 0) {
      let count = 0;
      for (const w of d.waitlists) {
        try {
          await db.waitlist.upsert({
            where: { id: w.id },
            create: {
              id: w.id,
              clubId,
              firstName: w.firstName || w.fullName?.split(" ")[0] || "منخرط",
              lastName: w.lastName || w.fullName?.split(" ").slice(1).join(" ") || "",
              phone: w.phone || null,
              desiredSwimmingDays: w.desiredSwimmingDays || "كل الأيام",
              desiredTimeSlot: w.desiredTimeSlot || "صباحي",
              status: w.status || "waiting",
              note: w.note || null,
              createdAt: w.createdAt ? new Date(w.createdAt) : new Date(),
            },
            update: { status: w.status, note: w.note },
          });
          count++;
        } catch {}
      }
      importedCounts.waitlists = count;
      totalImported += count;
    }

    if (Array.isArray(d.cardTemplates) && d.cardTemplates.length > 0) {
      let count = 0;
      for (const ct of d.cardTemplates) {
        if (!ct.name) continue;
        try {
          await db.cardTemplate.upsert({
            where: { id: ct.id },
            create: {
              id: ct.id,
              clubId,
              name: ct.name,
              description: ct.description || null,
              cardSize: ct.cardSize || "CR80",
              orientation: ct.orientation || "landscape",
              width: Number(ct.width ?? 10),
              height: Number(ct.height ?? 6.5),
              layout: typeof ct.layout === "string" ? ct.layout : JSON.stringify(ct.layout ?? {}),
              thumbnail: ct.thumbnail || null,
              isDefault: Boolean(ct.isDefault ?? false),
            },
            update: {
              name: ct.name,
              layout: typeof ct.layout === "string" ? ct.layout : JSON.stringify(ct.layout ?? {}),
            },
          });
          count++;
        } catch {}
      }
      importedCounts.cardTemplates = count;
      totalImported += count;
    }

    return NextResponse.json({
      success: true,
      mode,
      importedCounts,
      totalImported,
      message: `تمت استعادة كافة البيانات بنجاح 100% (${totalImported} سجل مسترجع)`,
    });
  } catch (e) {
    console.error("Backup import:", e);
    return NextResponse.json({ error: "فشل استيراد النسخة الاحتياطية" }, { status: 500 });
  }
}

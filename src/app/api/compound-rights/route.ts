import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * GET /api/compound-rights?year=2026&month=7
 *
 * يرجع قائمة المنخرطين الذين دفعوا حقوق المركب في شهر معيّن:
 * - المصدر 1: تسجيل جديد (Subscriber.lastPaymentDate within month + subscriptionType يدفع 1300/1500)
 * - المصدر 2: تجديد (Renewal.renewalDate within month + amount = 1300/1500)
 *
 * الشرط: مبلغ رسوم الاشتراك = 1300 (تحت 14) أو 1500 (14+)
 * أنواع أخرى (DJS/POLICE/MJ/300) مستثناة
 */
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.clubId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const url = new URL(req.url);
    const year = parseInt(url.searchParams.get("year") || String(new Date().getFullYear()));
    const month = parseInt(url.searchParams.get("month") || String(new Date().getMonth() + 1));

    // حساب بداية ونهاية الشهر
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const clubId = currentUser.role === "superadmin"
      ? (url.searchParams.get("clubId") || undefined)
      : currentUser.clubId;

    // ════ 1) التسجيل الجديد: Subscriber.lastPaymentDate within month ════
    // نبحث عن المنخرطين الذين lastPaymentDate يقع في الشهر المحدد
    // ونتحقق من أن نوع اشتراكهم يدفع 1300 أو 1500
    const newSubscribers = await db.subscriber.findMany({
      where: {
        clubId: clubId || undefined,
        lastPaymentDate: {
          gte: startDate,
          lte: endDate,
        },
        deletedAt: null,
      },
      select: {
        id: true,
        fileNumber: true,
        lastName: true,
        firstName: true,
        birthDate: true,
        subscriptionType: true,
        lastPaymentDate: true,
        paymentStatus: true,
      },
      orderBy: { lastPaymentDate: "asc" },
    });

    // جلب أنواع الاشتراك لمعرفة الرسوم
    const subTypes = await db.subscriptionType.findMany({
      where: clubId ? { clubId } : {},
      select: { code: true, subscriptionFee: true, requiresCompoundFee: true },
    });

    // خريطة أنواع الاشتراك
    const subTypeMap = new Map<string, { fee: number; requiresCompound: boolean }>();
    for (const t of subTypes) {
      subTypeMap.set(t.code, { fee: t.subscriptionFee, requiresCompound: t.requiresCompoundFee });
    }

    // 🔑 فلترة: فقط من يدفع 1300 أو 1500 (نوع "/" عادة)
    const eligibleNew = newSubscribers.filter((s) => {
      const config = subTypeMap.get(s.subscriptionType);
      if (!config) {
        // fallback: نوع "/" يدفع 1300/1500
        if (s.subscriptionType === "/") return true;
        return false;
      }
      // يتطلب حقوق المركب AND الرسوم 1300 أو 1500
      return config.requiresCompound && (config.fee === 1300 || config.fee === 1500);
    });

    // ════ 2) التجديدات: Renewal.renewalDate within month ════
    const renewals = await db.renewal.findMany({
      where: {
        clubId: clubId || undefined,
        renewalDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        subscriber: {
          select: {
            id: true,
            fileNumber: true,
            lastName: true,
            firstName: true,
            birthDate: true,
            subscriptionType: true,
          },
        },
      },
      orderBy: { renewalDate: "asc" },
    });

    // 🔑 فلترة التجديدات: فقط amount = 1300 أو 1500
    const eligibleRenewals = renewals.filter((r) => r.amount === 1300 || r.amount === 1500);

    // ════ 3) دمج القائمتين دون تكرار ════
    // المفتاح: subscriberId — إذا ظهر في القائمتين، نأخذ السجل الأحدث
    const merged = new Map<string, {
      subscriberId: string;
      fileNumber: string;
      lastName: string;
      firstName: string;
      birthDate: Date;
      date: Date;
      source: "new" | "renewal";
      amount: number;
    }>();

    // أضف التسجيلات الجديدة
    for (const s of eligibleNew) {
      merged.set(s.id, {
        subscriberId: s.id,
        fileNumber: s.fileNumber,
        lastName: s.lastName,
        firstName: s.firstName,
        birthDate: s.birthDate,
        date: s.lastPaymentDate!,
        source: "new",
        amount: subTypeMap.get(s.subscriptionType)?.fee || 1300,
      });
    }

    // أضف التجديدات — تتجاوز التسجيل إن كان التاريخ أحدث
    for (const r of eligibleRenewals) {
      const existing = merged.get(r.subscriberId);
      if (!existing || r.renewalDate > existing.date) {
        merged.set(r.subscriberId, {
          subscriberId: r.subscriberId,
          fileNumber: r.subscriber.fileNumber,
          lastName: r.subscriber.lastName,
          firstName: r.subscriber.firstName,
          birthDate: r.subscriber.birthDate,
          date: r.renewalDate,
          source: "renewal",
          amount: r.amount,
        });
      }
    }

    // تحويل لقائمة مرتبة بالتاريخ
    const list = Array.from(merged.values()).sort((a, b) => a.date.getTime() - b.date.getTime());

    // الإحصائيات
    const totalAmount = list.reduce((sum, r) => sum + 1000, 0); // 1000 دج لكل منخرط
    const newCount = list.filter((r) => r.source === "new").length;
    const renewalCount = list.filter((r) => r.source === "renewal").length;

    return NextResponse.json({
      month,
      year,
      monthName: startDate.toLocaleDateString("ar-DZ", { month: "long", year: "numeric" }),
      entries: list.map((r) => ({
        ...r,
        date: r.date.toISOString(),
        birthDate: r.birthDate.toISOString(),
      })),
      stats: {
        total: list.length,
        newCount,
        renewalCount,
        totalCompound: totalAmount,
      },
    });
  } catch (e) {
    console.error("GET compound-rights error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

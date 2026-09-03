import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { applyBalanceDelta, recomputeBalanceTx } from "@/lib/financial-posting";

/**
 * POST /api/subscribers/bulk-insurance
 * تأمين / إلغاء تأمين مجموعة منخرطين في طلب واحد (يدعم مئات وآلاف المنخرطين).
 * Body: { subscriberIds: string[], action?: "insure" | "uninsure" }
 * - insure: ينشئ دفعة تأمين لكل غير مؤمن (المبلغ من رسوم نوع اشتراكه، افتراضي 500 دج)
 * - uninsure: يحذف دفعات التأمين للمؤمنين من المحدد
 * يتجاهل من هم في الحالة المطلوبة مسبقاً (skipped) ويُرجع إحصاءات العملية.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !["admin", "assistant", "superadmin"].includes(user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const rawIds: unknown = body?.subscriberIds;
    const action: "insure" | "uninsure" = body?.action === "uninsure" ? "uninsure" : "insure";

    if (!Array.isArray(rawIds) || rawIds.length === 0 || rawIds.some((x) => typeof x !== "string" || !x.trim())) {
      return NextResponse.json({ error: "قائمة المنخرطين غير صالحة" }, { status: 400 });
    }
    // إزالة التكرار — سقف واسع يكفي أي نادٍ (5000)
    const subscriberIds = [...new Set(rawIds as string[])].slice(0, 5000);

    const clubFilter = user.role === "superadmin" ? {} : { clubId: user.clubId! };
    const clubId = user.clubId;

    // المنخرطون المطلوبون — ضمن النادي فقط (عزل multi-tenant)
    const subs = await db.subscriber.findMany({
      where: { id: { in: subscriberIds }, ...clubFilter, deletedAt: null },
      select: { id: true, clubId: true, lastName: true, firstName: true, subscriptionType: true },
    });
    if (subs.length === 0) {
      return NextResponse.json({ error: "لا يوجد منخرطون مطابقون" }, { status: 404 });
    }

    // رسوم التأمين حسب نوع الاشتراك لكل منخرط (افتراضي 500 دج)
    const typeNames = [...new Set(subs.map((s) => s.subscriptionType))];
    const types = await db.subscriptionType.findMany({
      where: { ...(clubId ? { clubId } : {}), name: { in: typeNames } },
      select: { name: true, insuranceFee: true },
    });
    const feeByName = new Map(types.map((t) => [t.name, t.insuranceFee]));

    // من لديهم دفعة تأمين حالياً
    const existing = await db.payment.findMany({
      where: { subscriberId: { in: subs.map((s) => s.id) }, category: "insurance", ...(clubId ? { clubId } : {}) },
      select: { id: true, subscriberId: true },
    });
    const insuredSet = new Set(
      existing.map((p) => p.subscriberId).filter((x): x is string => Boolean(x))
    );

    let affected = 0;
    let skipped = 0;

    if (action === "insure") {
      const toInsure = subs.filter((s) => !insuredSet.has(s.id));
      skipped = subs.length - toInsure.length;

      if (toInsure.length > 0) {
        await db.$transaction(async (tx) => {
          await tx.payment.createMany({
            data: toInsure.map((s) => ({
              clubId: s.clubId,
              subscriberId: s.id,
              category: "insurance",
              amount: feeByName.get(s.subscriptionType) ?? 500,
              method: "cash",
              note: "تأمين (دفعات متعددة)",
              userId: user.id,
            })),
          });
          // ★ ترحيل جماعي للدفتر المالي — مرجع قابل للتتبع bulk-ins:{subscriberId}
          await tx.financialTransaction.createMany({
            data: toInsure.map((s) => ({
              clubId: s.clubId,
              type: "income",
              category: "insurance",
              amount: feeByName.get(s.subscriptionType) ?? 500,
              date: new Date(),
              paymentMethod: "cash",
              payeeName: `${s.lastName} ${s.firstName}`.trim(),
              subscriberId: s.id,
              reference: `bulk-ins:${s.id}`,
              note: "تأمين منخرط — ترحيل جماعي",
              createdById: user.id,
            })),
          });
          // تحديث رصيد كل نادي متأثر (superadmin قد يمس عدة نوادٍ)
          const perClub = new Map<string, number>();
          for (const s of toInsure) {
            perClub.set(s.clubId, (perClub.get(s.clubId) || 0) + (feeByName.get(s.subscriptionType) ?? 500));
          }
          for (const [clubId, total] of perClub) {
            await applyBalanceDelta(tx, clubId, "income", "insurance", total);
          }
          await tx.activity.createMany({
            data: toInsure.map((s) => ({
              clubId: s.clubId,
              subscriberId: s.id,
              userId: user.id,
              type: "payment",
              description: `تأمين المنخرط: ${s.lastName} ${s.firstName}`,
            })),
          });
        });
        affected = toInsure.length;
      }
    } else {
      // uninsure — حذف دفعات التأمين للمؤمنين من المحدد فقط
      const targetSet = new Set(subs.map((s) => s.id));
      const paymentsToDelete = existing.filter(
        (p) => p.subscriberId && targetSet.has(p.subscriberId)
      );
      skipped = subs.length - paymentsToDelete.length;

      if (paymentsToDelete.length > 0) {
        const idToSub = new Map(subs.map((s) => [s.id, s]));
        await db.$transaction(async (tx) => {
          await tx.payment.deleteMany({
            where: { id: { in: paymentsToDelete.map((p) => p.id) } },
          });
          // ★ إلغاء القيود المرحّلة ناعماً (فردي payment: أو جماعي bulk-ins:)
          // الملغاة تبقى في سجل الدفتر بوضع «ملغاة» ولا تدخل في الرصيد
          const refs = paymentsToDelete.flatMap((p) => {
            const r = [`payment:${p.id}`];
            if (p.subscriberId) r.push(`bulk-ins:${p.subscriberId}`);
            return r;
          });
          const cancelled = await tx.financialTransaction.updateMany({
            where: { reference: { in: refs }, category: "insurance", type: "income", status: "active" },
            data: {
              status: "cancelled",
              cancelledAt: new Date(),
              cancelledById: user.id,
              cancellationReason: "إلغاء تأمين جماعي",
            },
          });
          if (cancelled.count > 0) {
            const clubs = await tx.financialTransaction.findMany({
              where: { reference: { in: refs }, category: "insurance" },
              select: { clubId: true },
              distinct: ["clubId"],
            });
            for (const { clubId } of clubs) {
              await recomputeBalanceTx(tx, clubId);
            }
          }
          await tx.activity.createMany({
            data: paymentsToDelete
              .map((p) => (p.subscriberId ? idToSub.get(p.subscriberId) : undefined))
              .filter((s): s is (typeof subs)[number] => Boolean(s))
              .map((s) => ({
                clubId: s.clubId,
                subscriberId: s.id,
                userId: user.id,
                type: "payment",
                description: `إلغاء تأمين المنخرط: ${s.lastName} ${s.firstName}`,
              })),
          });
        });
        affected = paymentsToDelete.length;
      }
    }

    return NextResponse.json({
      success: true,
      action,
      affected,
      skipped,
      total: subs.length,
    });
  } catch (e) {
    console.error("POST bulk-insurance:", e);
    return NextResponse.json({ error: "تعذر تنفيذ العملية — أعد المحاولة" }, { status: 500 });
  }
}

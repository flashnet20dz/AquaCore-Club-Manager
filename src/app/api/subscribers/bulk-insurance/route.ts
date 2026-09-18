import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { postLedgerEntriesBatchTx, cancelLedgerByReferencesTx } from "@/lib/financial-posting";
import { ensureRuntimeColumns, ensureFinancialIndexes } from "@/lib/runtime-schema";

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
    await ensureRuntimeColumns();
    await ensureFinancialIndexes();
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

    // من لديهم دفعة تأمين حالياً (نشطة فقط — الملغاة لا تعني تأميناً قائماً)
    const existing = await db.payment.findMany({
      where: { subscriberId: { in: subs.map((s) => s.id) }, category: "insurance", status: { not: "cancelled" }, ...(clubId ? { clubId } : {}) },
      select: { id: true, subscriberId: true, clubId: true },
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
          // ★ النواة الجماعية الموحّدة (Batch Kernel) — نفس ضمانات postLedgerEntry:
          // idempotency بالمرجع bulk-ins:{subscriberId} + seq فريد + رصيد ذرّي + lastTransaction
          // التجميع حسب النادي (superadmin قد يمس عدة نوادٍ) — كل دفعة لنادي واحد
          const byClub = new Map<string, typeof toInsure>();
          for (const s of toInsure) {
            const list = byClub.get(s.clubId) || [];
            list.push(s);
            byClub.set(s.clubId, list);
          }
          for (const [cid, list] of byClub) {
            await postLedgerEntriesBatchTx(
              tx,
              cid,
              list.map((s) => ({
                clubId: cid,
                type: "income" as const,
                category: "insurance",
                amount: feeByName.get(s.subscriptionType) ?? 500,
                date: new Date(),
                paymentMethod: "cash",
                payeeName: `${s.lastName} ${s.firstName}`.trim(),
                subscriberId: s.id,
                reference: `bulk-ins:${s.id}`,
                note: "تأمين منخرط — ترحيل جماعي",
                createdById: user.id,
              }))
            );
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
          // ★ إلغاء ناعم للدفعات (تبقى في التاريخ — لا حذف فعلي)
          await tx.payment.updateMany({
            where: { id: { in: paymentsToDelete.map((p) => p.id) } },
            data: {
              status: "cancelled",
              cancelledAt: new Date(),
              cancelledById: user.id,
              cancellationReason: "إلغاء تأمين جماعي",
            },
          });
          // ★ إلغاء القيود المرحّلة عبر النواة الموحّدة — مراجع فردي payment: أو جماعي bulk-ins:
          // الملغاة تبقى في سجل الدفتر بوضع «ملغاة» ولا تدخل في الرصيد، والرصيد يُعاد حسابه من الدفتر
          const refsByClub = new Map<string, string[]>();
          for (const p of paymentsToDelete) {
            const refs: string[] = [`payment:${p.id}`];
            if (p.subscriberId) {
              refs.push(`bulk-ins:${p.subscriberId}`);
              refs.push(`subscriber:${p.subscriberId}:insurance`);
            }
            const list = refsByClub.get(p.clubId) || [];
            list.push(...refs);
            refsByClub.set(p.clubId, list);
          }
          for (const [cid, refs] of refsByClub) {
            await cancelLedgerByReferencesTx(tx, cid, refs, {
              cancelledById: user.id,
              reason: "إلغاء تأمين جماعي",
            });
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

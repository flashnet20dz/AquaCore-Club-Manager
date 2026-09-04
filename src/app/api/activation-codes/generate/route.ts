import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { generateBatch, PLANS, type PlanCode } from "@/lib/activation-codes";
import crypto from "crypto";

/**
 * POST /api/activation-codes/generate
 * SuperAdmin only — يولّد دفعة من أكواد التفعيل الموقّعة.
 *
 * Body:
 *   { plan: "monthly"|"quarterly"|"halfyear"|"yearly"|"twoyear",
 *     count: number (1-5000),
 *     name?: string (وصف الدفعة),
 *     notes?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح — هذه العملية للسوبر أدمن فقط" }, { status: 403 });
    }

    const body = await req.json();
    const { plan, count, name, notes } = body;

    // التحقق من الخطة
    if (!plan || !PLANS[plan as PlanCode]) {
      return NextResponse.json({
        error: "خطة غير صالحة. المتاحة: monthly, quarterly, halfyear, yearly, twoyear",
      }, { status: 400 });
    }

    const planDef = PLANS[plan as PlanCode];

    // التحقق من العدد
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > 5000) {
      return NextResponse.json({ error: "العدد يجب أن يكون بين 1 و 5000" }, { status: 400 });
    }

    // توليد الأكواد (محلياً، بدون DB)
    const generated = generateBatch(plan as PlanCode, n);

    // رقم الدفعة التسلسلي
    const lastBatch = await db.codeBatch.findFirst({ orderBy: { batchNo: "desc" } });
    const batchNo = (lastBatch?.batchNo || 0) + 1;

    // إنشاء الدفعة + الأكواد في معاملة واحدة
    const batch = await db.$transaction(async (tx) => {
      const b = await tx.codeBatch.create({
        data: {
          batchNo,
          name: name || `دفعة #${batchNo} — ${planDef.label}`,
          plan: plan as PlanCode,
          count: generated.length,
          generatedById: currentUser.id,
          notes: notes || null,
        },
      });

      // إدراج جماعي للأكواد
      await tx.activationCode.createMany({
        data: generated.map((g) => ({
          code: g.code,
          codeHash: crypto.createHash("sha256").update(g.code).digest("hex"),
          batchId: b.id,
          plan: plan as PlanCode,
          durationDays: planDef.durationDays,
          status: "unused",
        })),
      });

      return b;
    });

    // إرجاع الأكواد (مرّة واحدة فقط للعرض/التصدير)
    return NextResponse.json({
      success: true,
      batch: {
        id: batch.id,
        batchNo: batch.batchNo,
        name: batch.name,
        plan: batch.plan,
        count: generated.length,
        createdAt: batch.createdAt,
      },
      codes: generated.map((g) => g.code),
      planLabel: planDef.label,
      durationDays: planDef.durationDays,
    }, { status: 201 });
  } catch (e) {
    console.error("Generate activation codes error:", e);
    return NextResponse.json({
      error: "فشل توليد الأكواد",
      detail: e instanceof Error ? e.message : String(e),
    }, { status: 500 });
  }
}

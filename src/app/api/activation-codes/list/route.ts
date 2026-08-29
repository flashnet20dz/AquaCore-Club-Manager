import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { PLANS } from "@/lib/activation-codes";

/**
 * GET /api/activation-codes/list
 * SuperAdmin: قائمة الدفعات والأكواد مع إحصاءات.
 *
 * Query: ?batchId=xxx  (لعرض أكواد دفعة معيّنة)
 *        ?status=unused|used|revoked  (فلتر)
 *        ?plan=monthly|...  (فلتر)
 */
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const url = new URL(req.url);
    const batchId = url.searchParams.get("batchId");
    const status = url.searchParams.get("status");
    const plan = url.searchParams.get("plan");

    // قائمة الدفعات مع إحصاءات
    if (!batchId) {
      const batches = await db.codeBatch.findMany({
        include: {
          _count: { select: { codes: true } },
          generatedBy: { select: { name: true, email: true } },
        },
        orderBy: { batchNo: "desc" },
        take: 100,
      });

      // إحصاءات لكل دفعة
      const stats = await db.activationCode.groupBy({
        by: ["batchId", "status"],
        _count: { status: true },
      });

      const batchStats = new Map<string, { unused: number; used: number; revoked: number }>();
      for (const s of stats) {
        const entry = batchStats.get(s.batchId) || { unused: 0, used: 0, revoked: 0 };
        entry[s.status as keyof typeof entry] += s._count.status;
        batchStats.set(s.batchId, entry);
      }

      return NextResponse.json({
        batches: batches.map((b) => ({
          id: b.id,
          batchNo: b.batchNo,
          name: b.name,
          plan: b.plan,
          planLabel: PLANS[b.plan as keyof typeof PLANS]?.label || b.plan,
          durationDays: PLANS[b.plan as keyof typeof PLANS]?.durationDays || 0,
          count: b.count,
          createdAt: b.createdAt,
          generatedBy: b.generatedBy?.name || "—",
          stats: batchStats.get(b.id) || { unused: 0, used: 0, revoked: 0 },
        })),
      });
    }

    // عرض أكواد دفعة معيّنة
    const where: Record<string, unknown> = { batchId };
    if (status) where.status = status;
    if (plan) where.plan = plan;

    const codes = await db.activationCode.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: 5000,
      include: {
        club: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({
      codes: codes.map((c) => ({
        id: c.id,
        code: c.code,
        plan: c.plan,
        planLabel: PLANS[c.plan as keyof typeof PLANS]?.label || c.plan,
        durationDays: c.durationDays,
        status: c.status,
        club: c.club ? { id: c.club.id, name: c.club.name, email: c.club.email } : null,
        activatedAt: c.activatedAt,
        expiresAt: c.expiresAt,
        hardwareFingerprint: c.hardwareFingerprint,
        createdAt: c.createdAt,
        revokedAt: c.revokedAt,
        revokedReason: c.revokedReason,
      })),
    });
  } catch (e) {
    console.error("List activation codes error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

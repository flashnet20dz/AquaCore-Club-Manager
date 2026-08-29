import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { auditLogWithRequest } from "@/lib/audit";

/**
 * POST /api/super-admin/apply-config
 * SuperAdmin: تطبيق إعدادات الميزات على نوادي/مجموعات دفعة واحدة
 *
 * Body:
 *   { scope: "ALL_CLUBS"|"CLUB_SPECIFIC"|"CLUB_GROUP",
 *     clubIds?: string[],          // للنوادي المحددة
 *     clubGroupId?: string,        // لمجموعة
 *     featureIds: string[],        // الميزات المطلوب تطبيقها
 *     overrides: { enabled, visible, readOnly, ... },
 *     reset?: boolean              // true = حذف overrides (Reset to Default)
 *   }
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

    const body = await req.json();
    const { scope = "ALL_CLUBS", clubIds = [], clubGroupId, featureIds, overrides, reset = false } = body;

    if (!Array.isArray(featureIds) || featureIds.length === 0) {
      return NextResponse.json({ error: "featureIds مطلوبة" }, { status: 400 });
    }

    let targetClubIds: string[] = [];

    if (scope === "ALL_CLUBS") {
      const allClubs = await db.club.findMany({ select: { id: true } });
      targetClubIds = allClubs.map((c) => c.id);
    } else if (scope === "CLUB_SPECIFIC") {
      targetClubIds = clubIds;
    } else if (scope === "CLUB_GROUP" && clubGroupId) {
      const members = await db.clubGroupMember.findMany({ where: { groupId: clubGroupId }, select: { clubId: true } });
      targetClubIds = members.map((m) => m.clubId);
    }

    if (targetClubIds.length === 0 && scope !== "ALL_CLUBS") {
      return NextResponse.json({ error: "لا توجد نوادي مستهدفة" }, { status: 400 });
    }

    let processed = 0;

    if (reset) {
      // Reset: احذف كل overrides لهذه الميزات على هذه النوادي
      for (const fid of featureIds) {
        const del = await db.featureAccess.deleteMany({
          where: {
            featureId: fid,
            scope: scope === "ALL_CLUBS" ? "ALL_CLUBS" : "CLUB_SPECIFIC",
            ...(scope === "CLUB_SPECIFIC" ? { clubId: { in: targetClubIds } } : {}),
          },
        });
        processed += del.count;
      }
    } else {
      // تطبيق: upsert لكل ميزة × نادي
      for (const fid of featureIds) {
        if (scope === "ALL_CLUBS") {
          // upsert على ALL_CLUBS
          const existing = await db.featureAccess.findFirst({ where: { featureId: fid, scope: "ALL_CLUBS", clubId: null, clubGroupId: null } });
          if (existing) {
            await db.featureAccess.update({ where: { id: existing.id }, data: { ...overrides, updatedById: currentUser.id } });
          } else {
            await db.featureAccess.create({ data: { featureId: fid, scope: "ALL_CLUBS", clubId: null, clubGroupId: null, ...overrides, updatedById: currentUser.id } });
          }
          processed++;
        } else {
          for (const cid of targetClubIds) {
            const existing = await db.featureAccess.findFirst({ where: { featureId: fid, scope: "CLUB_SPECIFIC", clubId: cid, clubGroupId: null } });
            if (existing) {
              await db.featureAccess.update({ where: { id: existing.id }, data: { ...overrides, updatedById: currentUser.id } });
            } else {
              await db.featureAccess.create({ data: { featureId: fid, scope: "CLUB_SPECIFIC", clubId: cid, clubGroupId: null, ...overrides, updatedById: currentUser.id } });
            }
            processed++;
          }
        }
      }
    }

    await auditLogWithRequest(req, currentUser, {
      action: reset ? "reset" : "apply",
      entityType: "feature_access",
      description: `${reset ? "إعادة تعيين" : "تطبيق"} ${featureIds.length} ميزة على ${scope === "ALL_CLUBS" ? "كل النوادي" : `${targetClubIds.length} نادٍ`} — ${processed} عملية`,
      metadata: { scope, clubIds: targetClubIds, clubGroupId, featureIds, overrides, reset },
    });

    return NextResponse.json({ success: true, processed, targetCount: targetClubIds.length || 1 });
  } catch (e) {
    console.error("POST apply-config error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

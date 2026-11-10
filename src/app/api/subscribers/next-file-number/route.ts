import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ensureDefaultPool } from "@/lib/multi-pool";

// ═══ GET /api/subscribers/next-file-number?subscriptionType=RCS&poolId=... ═══
// Lightweight endpoint: returns the next file number preview for a given pool and subscription type.
// Supports multi-pool prefixes (e.g. B-RCS001, C-RCS001, or RCS001 for default pool).
//
// Logic:
//   1. Look up the subscription type config (givesMembershipNumber, numberingGroup).
//   2. If the type does not give a membership number, return the type's code itself.
//   3. Otherwise, find the highest existing number with the group prefix, +1.
//   4. If the suggested number collides with an existing one, keep incrementing.
//
// Response: { fileNumber: string, group: string, givesMembershipNumber: boolean }

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const url = new URL(req.url);
    const subscriptionType = (url.searchParams.get("subscriptionType") || "").trim();

    if (!subscriptionType) {
      return NextResponse.json({ error: "subscriptionType مطلوب" }, { status: 400 });
    }

    // 🔑 superadmin: استخدم targetClubId إن وُجد، أو أول نادٍ نشط
    let targetClubId: string | null = null;
    if (currentUser.role === "superadmin") {
      targetClubId = url.searchParams.get("clubId") || null;
      if (!targetClubId) {
        const firstClub = await db.club.findFirst({
          where: { status: "active" },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
        targetClubId = firstClub?.id || null;
      }
    } else {
      targetClubId = currentUser.clubId || null;
    }

    if (!targetClubId) {
      return NextResponse.json({ error: "لم يتم العثور على نادٍ" }, { status: 400 });
    }

    const rawPoolId = url.searchParams.get("poolId");
    let pool: any = null;
    if (rawPoolId && rawPoolId !== "all") {
      pool = await db.pool.findFirst({
        where: { id: rawPoolId, clubId: targetClubId },
      });
    }
    if (!pool) {
      pool = await ensureDefaultPool(targetClubId);
    }

    const prefix = (pool?.fileNumberPrefix || "").trim();

    // جلب إعداد نوع الاشتراك
    const subType = await db.subscriptionType.findFirst({
      where: { clubId: targetClubId, code: subscriptionType },
      select: {
        code: true,
        givesMembershipNumber: true,
        numberingGroup: true,
      },
    });

    // إذا النوع لا يمنح رقم عضوية — استخدم الكود نفسه
    if (subType && !subType.givesMembershipNumber) {
      const codeOnly = prefix ? `${prefix}-${subType.code}` : subType.code;
      return NextResponse.json({
        fileNumber: codeOnly,
        group: subType.code,
        givesMembershipNumber: false,
        poolId: pool?.id,
        poolName: pool?.name,
        prefix,
      });
    }

    // النوع يمنح رقم عضوية — استخدم numberingGroup + العداد
    const group = subType?.numberingGroup || "RCS";

    // جلب قيمة العداد الذري الحالي
    const counter = await db.poolNumberCounter.findUnique({
      where: {
        clubId_poolId_numberingGroup: {
          clubId: targetClubId,
          poolId: pool.id,
          numberingGroup: group,
        },
      },
    });

    let maxNum = counter?.lastValue || 0;

    // فحص إضافي للأرقام المحجوزة في هذا المسبح
    const enrollments = await db.poolEnrollment.findMany({
      where: { clubId: targetClubId, poolId: pool.id },
      select: { fileNumber: true },
    });
    const existingSet = new Set<string>();
    for (const e of enrollments) {
      existingSet.add(e.fileNumber);
      const match = e.fileNumber.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }

    // إذا كان المسبح الافتراضي: فحص المشتركين القدامى للتوافق
    if (pool.isDefault) {
      const subs = await db.subscriber.findMany({
        where: { clubId: targetClubId, fileNumber: { startsWith: group } },
        select: { fileNumber: true },
      });
      for (const s of subs) {
        existingSet.add(s.fileNumber);
        const match = s.fileNumber.match(new RegExp(`^${group}(\\d+)$`));
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }

    let nextNum = maxNum + 1;
    let attempts = 0;
    const formatNumber = (num: number) => {
      const padded = String(num).padStart(3, "0");
      return prefix ? `${prefix}-${group}${padded}` : `${group}${padded}`;
    };

    let fileNumber = formatNumber(nextNum);
    while (existingSet.has(fileNumber) && attempts < 200) {
      nextNum++;
      fileNumber = formatNumber(nextNum);
      attempts++;
    }

    return NextResponse.json({
      fileNumber,
      group,
      givesMembershipNumber: true,
      poolId: pool.id,
      poolName: pool.name,
      prefix,
    });
  } catch (error) {
    console.error("GET /api/subscribers/next-file-number error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

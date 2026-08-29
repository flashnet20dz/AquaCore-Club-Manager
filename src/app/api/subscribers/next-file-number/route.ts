import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// ═══ GET /api/subscribers/next-file-number?subscriptionType=RCS ═══
// Lightweight endpoint: returns the next file number for a given subscription type.
// Used by the subscriber form to preview the file number immediately when the user
// picks a subscription type. Avoids fetching all subscribers (10000 rows) just to
// compute the next number.
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
      return NextResponse.json({
        fileNumber: subType.code,
        group: subType.code,
        givesMembershipNumber: false,
      });
    }

    // النوع يمنح رقم عضوية — استخدم numberingGroup + العداد
    const group = subType?.numberingGroup || "RCS";

    // 🔑 جلب كل أرقام الملفات لهذه المجموعة فقط (select خفيف)
    // استخدم startsWith لتقليص النتائج (العدد الذي يطابق البادئة فقط)
    const subs = await db.subscriber.findMany({
      where: {
        clubId: targetClubId,
        fileNumber: { startsWith: group },
      },
      select: { fileNumber: true },
    });

    // ابحث عن أكبر رقم في المجموعة
    let maxNum = 0;
    const existingSet = new Set<string>();
    for (const s of subs) {
      existingSet.add(s.fileNumber);
      const match = s.fileNumber.match(new RegExp(`^${group}(\\d+)$`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }

    // جرّب أرقاماً حتى نجد واحداً غير مستخدم (حد أقصى 200 محاولة)
    let nextNum = maxNum + 1;
    let attempts = 0;
    let fileNumber = `${group}${String(nextNum).padStart(3, "0")}`;
    while (existingSet.has(fileNumber) && attempts < 200) {
      nextNum++;
      fileNumber = `${group}${String(nextNum).padStart(3, "0")}`;
      attempts++;
    }

    return NextResponse.json({
      fileNumber,
      group,
      givesMembershipNumber: true,
    });
  } catch (error) {
    console.error("GET /api/subscribers/next-file-number error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

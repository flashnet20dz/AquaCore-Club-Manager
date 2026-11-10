import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { auditLogWithRequest } from "@/lib/audit";
import { ensureClubMultiPoolReady, validatePoolPrefixRules } from "@/lib/multi-pool";

/**
 * GET /api/pools
 * قائمة مسابح النادي مع إحصائيات سريعة (عدد المنخرطين، الحضور، الطاقة الاستيعابية)
 * 
 * POST /api/pools
 * إنشاء مسبح جديد تابع للنادي (admin / superadmin فقط)
 */

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const url = new URL(req.url);
    const includeInactive = url.searchParams.get("includeInactive") === "true";
    const targetClubId = currentUser.role === "superadmin"
      ? (url.searchParams.get("clubId") || currentUser.clubId)
      : currentUser.clubId;

    if (!targetClubId) {
      return NextResponse.json({ error: "لا يوجد نادي مرتبط" }, { status: 400 });
    }

    // ضمان وجود المسبح الافتراضي وترحيل البيانات القديمة آلياً دون فقدان أي سجل
    await ensureClubMultiPoolReady(targetClubId);

    const where: any = { clubId: targetClubId };
    if (!includeInactive) {
      where.active = true;
    }

    const pools = await db.pool.findMany({
      where,
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      include: {
        _count: {
          select: {
            enrollments: { where: { status: "active" } },
            attendances: true,
            swimmingTimeSlots: true,
          },
        },
      },
    });

    const formattedPools = pools.map((p) => ({
      id: p.id,
      clubId: p.clubId,
      name: p.name,
      code: p.code,
      fileNumberPrefix: p.fileNumberPrefix || "",
      isDefault: p.isDefault,
      active: p.active,
      status: p.status,
      capacity: p.capacity,
      color: p.color || "#0284c7",
      lanesCount: p.lanesCount,
      lengthMeters: p.lengthMeters,
      address: p.address,
      phone: p.phone,
      description: p.description,
      createdAt: p.createdAt,
      activeSubscribersCount: p._count.enrollments,
      totalAttendancesCount: p._count.attendances,
      timeSlotsCount: p._count.swimmingTimeSlots,
    }));

    return NextResponse.json({ pools: formattedPools });
  } catch (error) {
    console.error("GET /api/pools error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح — صلاحية مسؤول مطلوبة" }, { status: 403 });
    }

    const body = await req.json();
    const { name, code, fileNumberPrefix, capacity, color, lanesCount, lengthMeters, address, phone, description } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "اسم المسبح مطلوب" }, { status: 400 });
    }
    if (!code || !code.trim()) {
      return NextResponse.json({ error: "رمز المسبح مطلوب" }, { status: 400 });
    }

    const targetClubId = currentUser.role === "superadmin"
      ? (body.clubId || currentUser.clubId)
      : currentUser.clubId;

    if (!targetClubId) {
      return NextResponse.json({ error: "لا يوجد نادي مرتبط" }, { status: 400 });
    }

    const cleanName = name.trim();
    const cleanCode = code.trim().toUpperCase();
    const cleanPrefix = (fileNumberPrefix || "").trim().toUpperCase();

    // 1. التحقق من عدم تكرار الكود داخل النادي
    const existingCode = await db.pool.findUnique({
      where: { clubId_code: { clubId: targetClubId, code: cleanCode } },
    });
    if (existingCode) {
      return NextResponse.json({ error: `رمز المسبح "${cleanCode}" مستخدم بالفعل في هذا النادي` }, { status: 409 });
    }

    // 2. التحقق من القواعد المعمارية الصارمة للبادئة (validatePoolPrefixRules)
    const prefixCheck = validatePoolPrefixRules(cleanPrefix, false);
    if (!prefixCheck.valid) {
      return NextResponse.json({ error: prefixCheck.error }, { status: 400 });
    }
    const finalPrefix = prefixCheck.normalizedPrefix || "";

    // التحقق من عدم تكرار البادئة داخل النادي (حتى مع المسابح المؤرشفة)
    const existingPrefix = await db.pool.findFirst({
      where: {
        clubId: targetClubId,
        fileNumberPrefix: finalPrefix,
      },
    });
    if (existingPrefix) {
      return NextResponse.json({ error: `بادئة الترقيم "${finalPrefix}" مستخدمة بالفعل للمسبح "${existingPrefix.name}"` }, { status: 409 });
    }

    const pool = await db.pool.create({
      data: {
        clubId: targetClubId,
        name: cleanName,
        code: cleanCode,
        fileNumberPrefix: finalPrefix,
        isDefault: false,
        active: true,
        status: "active",
        capacity: Number(capacity) > 0 ? Number(capacity) : 100,
        color: color || "#0284c7",
        lanesCount: lanesCount ? Number(lanesCount) : null,
        lengthMeters: lengthMeters ? Number(lengthMeters) : null,
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        description: description?.trim() || null,
      },
    });

    await auditLogWithRequest(req, currentUser, {
      action: "create",
      entityType: "Pool",
      entityId: pool.id,
      description: `إنشاء منشأة مسبح جديدة: ${cleanName} (${cleanCode}) بالبادئة: ${cleanPrefix || "بدون"}`,
    });

    return NextResponse.json({ pool }, { status: 201 });
  } catch (error) {
    console.error("POST /api/pools error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

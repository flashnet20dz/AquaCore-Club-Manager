import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { auditLogWithRequest } from "@/lib/audit";

/**
 * GET /api/pools/[id] — تفاصيل مسبح محدد
 * PATCH /api/pools/[id] — تحديث بيانات المسبح أو حالته
 * DELETE /api/pools/[id] — أرشفة ناعمة أو حذف (مع حماية البيانات التاريخية)
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const pool = await db.pool.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            enrollments: true,
            attendances: true,
            swimmingTimeSlots: true,
            poolClosures: true,
          },
        },
      },
    });

    if (!pool) {
      return NextResponse.json({ error: "المسبح غير موجود" }, { status: 404 });
    }

    if (currentUser.role !== "superadmin" && pool.clubId !== currentUser.clubId) {
      return NextResponse.json({ error: "غير مصرح بالوصول لهذا المسبح" }, { status: 403 });
    }

    return NextResponse.json({ pool });
  } catch (error) {
    console.error("GET /api/pools/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.pool.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "المسبح غير موجود" }, { status: 404 });
    }

    if (currentUser.role !== "superadmin" && existing.clubId !== currentUser.clubId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await req.json();
    const allowedFields = ["name", "capacity", "color", "lanesCount", "lengthMeters", "address", "phone", "description", "status", "active"];
    const data: Record<string, any> = {};

    for (const f of allowedFields) {
      if (f in body) data[f] = body[f];
    }

    if (data.lanesCount !== undefined && data.lanesCount !== null) {
      data.lanesCount = Number(data.lanesCount) || null;
    }
    if (data.lengthMeters !== undefined && data.lengthMeters !== null) {
      data.lengthMeters = Number(data.lengthMeters) || null;
    }

    // حماية: المسبح الافتراضي لا يمكن تعطيله
    if (existing.isDefault && data.active === false) {
      return NextResponse.json({ error: "لا يمكن تعطيل المسبح الرئيسي الافتراضي للنادي" }, { status: 400 });
    }

    // إذا تم تعديل الطاقة الاستيعابية
    if (data.capacity !== undefined) {
      const cap = Number(data.capacity);
      if (cap <= 0) return NextResponse.json({ error: "الطاقة الاستيعابية يجب أن تكون رقماً موجباً" }, { status: 400 });
      data.capacity = cap;
    }

    const updated = await db.pool.update({
      where: { id },
      data,
    });

    await auditLogWithRequest(req, currentUser, {
      action: "update",
      entityType: "Pool",
      entityId: id,
      description: `تحديث بيانات المسبح: ${updated.name}`,
      metadata: data,
    });

    return NextResponse.json({ pool: updated });
  } catch (error) {
    console.error("PATCH /api/pools/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const pool = await db.pool.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            enrollments: true,
            attendances: true,
          },
        },
      },
    });

    if (!pool) {
      return NextResponse.json({ error: "المسبح غير موجود" }, { status: 404 });
    }

    if (currentUser.role !== "superadmin" && pool.clubId !== currentUser.clubId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    // 1. المسبح الافتراضي لا يمكن حذفه أبداً
    if (pool.isDefault) {
      return NextResponse.json({ error: "لا يمكن حذف أو أرشفة المسبح الرئيسي الافتراضي للنادي" }, { status: 400 });
    }

    // 2. إذا كانت هناك بيانات تاريخية (منخرطين أو حضور): أرشفة ناعمة فقط
    const hasHistory = pool._count.enrollments > 0 || pool._count.attendances > 0;
    if (hasHistory) {
      const archived = await db.pool.update({
        where: { id },
        data: {
          active: false,
          status: "archived",
          archivedAt: new Date(),
          archivedById: currentUser.id,
          archiveReason: "أرشفة إدارية لحفظ السجلات التاريخية",
        },
      });

      await auditLogWithRequest(req, currentUser, {
        action: "archive",
        entityType: "Pool",
        entityId: id,
        description: `أرشفة المسبح ${pool.name} مع الاحتفاظ بـ ${pool._count.enrollments} انخراط و ${pool._count.attendances} سجل حضور`,
      });

      return NextResponse.json({
        message: "تم أرشفة المسبح بنجاح مع الاحتفاظ بكافة بياناته التاريخية وسجلاته",
        pool: archived,
      });
    }

    // 3. مسبح فارغ بلا أي بيانات تاريخية: يمكن حذفه فعلياً
    await db.pool.delete({ where: { id } });

    await auditLogWithRequest(req, currentUser, {
      action: "delete",
      entityType: "Pool",
      entityId: id,
      description: `حذف المسبح الخالي من البيانات: ${pool.name} (${pool.code})`,
    });

    return NextResponse.json({ message: "تم حذف المسبح نهائياً لعدم وجود بيانات مرتبطة به" });
  } catch (error) {
    console.error("DELETE /api/pools/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

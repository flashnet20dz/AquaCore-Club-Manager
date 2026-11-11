import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { resolveTargetClubId } from "@/lib/tenant";

/**
 * ★ قائمة انتظار الطباعة السحابية — مرتبطة بنادي الحساب
 * ─────────────────────────────────────────────────────────────────────────────
 * GET  /api/print-queue            → { queue: string[], updatedAt }
 * PUT  /api/print-queue  { queue } → { success, count }
 *
 * - تُخزَّن في جدول Setting بمفتاح "printQueue" (نفس نمط autoBackupConfig)
 * - سحابياً: تُقرأ من أي جهاز يُسجَّل فيه الدخول بحساب النادي
 * - superadmin: يقبل ?clubId لتحديد نادي الهدف (نفس نمط pools/settings)
 * - الحد الأقصى 1000 معرف مع إزالة التكرار للحفاظ على حجم الطلب والاستجابة
 */

export const PRINT_QUEUE_SETTING_KEY = "printQueue";
const MAX_QUEUE_SIZE = 1000;

function sanitizeQueue(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const cleaned = input
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0 && x.length <= 64)
    .map((x) => x.trim());
  return [...new Set(cleaned)].slice(0, MAX_QUEUE_SIZE);
}

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const clubId = await resolveTargetClubId(
      currentUser,
      currentUser.role === "superadmin" ? req.nextUrl.searchParams.get("clubId") : undefined,
    );
    if (!clubId) {
      return NextResponse.json({ queue: [], updatedAt: null });
    }

    const setting = await db.setting.findUnique({
      where: { clubId_key: { clubId, key: PRINT_QUEUE_SETTING_KEY } },
    });

    let queue: string[] = [];
    if (setting?.value) {
      try {
        const parsed = JSON.parse(setting.value);
        queue = sanitizeQueue(parsed);
      } catch {
        queue = [];
      }
    }

    return NextResponse.json({
      queue,
      updatedAt: setting?.updatedAt ?? null,
    });
  } catch (e) {
    console.error("GET /api/print-queue:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const clubId = await resolveTargetClubId(
      currentUser,
      currentUser.role === "superadmin" ? req.nextUrl.searchParams.get("clubId") : undefined,
    );
    if (!clubId) {
      return NextResponse.json({ error: "لا يوجد نادي مرتبط بهذا الحساب" }, { status: 400 });
    }

    const body = await req.json();
    const queue = sanitizeQueue(body?.queue);

    await db.setting.upsert({
      where: { clubId_key: { clubId, key: PRINT_QUEUE_SETTING_KEY } },
      update: { value: JSON.stringify(queue) },
      create: { clubId, key: PRINT_QUEUE_SETTING_KEY, value: JSON.stringify(queue) },
    });

    return NextResponse.json({ success: true, count: queue.length });
  } catch (e) {
    console.error("PUT /api/print-queue:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 },
    );
  }
}

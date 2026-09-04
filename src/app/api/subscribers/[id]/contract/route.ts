import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * GET /api/subscribers/[id]/contract
 * يرجع آخر عقد موقّع لهذا المنخرط (إن وُجد).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { id } = await params;
    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };

    const contract = await db.subscriberContract.findFirst({
      where: { subscriberId: id, ...clubFilter, status: "signed" },
      orderBy: { signedAt: "desc" },
    });

    return NextResponse.json({ contract });
  } catch (e) {
    console.error("GET /api/subscribers/[id]/contract:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

/**
 * POST /api/subscribers/[id]/contract
 * body: { contractText, signerName, signatureImage } — signatureImage هو Base64 PNG.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.clubId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { id } = await params;
    const sub = await db.subscriber.findFirst({ where: { id, clubId: currentUser.clubId } });
    if (!sub) return NextResponse.json({ error: "المنخرط غير موجود" }, { status: 404 });

    const body = await req.json();
    const { contractText, signerName, signatureImage } = body;

    if (!contractText || !signerName || !signatureImage) {
      return NextResponse.json({ error: "نص العقد واسم الموقّع والتوقيع كلها مطلوبة" }, { status: 400 });
    }
    if (typeof signatureImage !== "string" || !signatureImage.startsWith("data:image/")) {
      return NextResponse.json({ error: "صيغة التوقيع غير صالحة" }, { status: 400 });
    }
    // حد أقصى معقول لحجم صورة التوقيع (~2 ميجا base64) لمنع إساءة الاستخدام
    if (signatureImage.length > 2_500_000) {
      return NextResponse.json({ error: "حجم التوقيع كبير جداً" }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

    const contract = await db.subscriberContract.create({
      data: {
        clubId: currentUser.clubId,
        subscriberId: id,
        contractText,
        signerName,
        signatureImage,
        ipAddress: ip,
      },
    });

    await db.activity.create({
      data: {
        clubId: currentUser.clubId,
        subscriberId: id,
        type: "contract_signed",
        description: `تم توقيع العقد الإلكتروني من طرف ${signerName} للمنخرط ${sub.firstName} ${sub.lastName}`,
        userId: currentUser.id,
      },
    });

    return NextResponse.json({ contract });
  } catch (e) {
    console.error("POST /api/subscribers/[id]/contract:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

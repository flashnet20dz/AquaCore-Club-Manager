import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "يرجى اختيار ملف" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 4) {
      return NextResponse.json({
        isValid: false,
        error: "الملف المرفوع فارغ أو تالف.",
      });
    }

    // 1. فحص هل هو ملف SQLite
    const SQLITE_HEADER = Buffer.from("SQLite format 3\0");
    const isSqlite = buffer.length >= 16 && buffer.subarray(0, 16).equals(SQLITE_HEADER);

    if (isSqlite) {
      return NextResponse.json({
        isValid: true,
        format: "sqlite",
        formatLabel: "قاعدة بيانات كاملة (SQLite .db)",
        filename: file.name,
        size: buffer.length,
        version: "SQLite 3",
        summaryText: "نسخة أصلية كاملة 100% لكافة الجداول والمنخرطين والعمليات والصور.",
        recommendedMode: "replace",
      });
    }

    // 2. فحص هل هو ملف JSON مهيكل
    const preview = buffer.toString("utf8", 0, Math.min(buffer.length, 500)).trim();
    if (preview.startsWith("{") || preview.startsWith("[")) {
      try {
        const text = buffer.toString("utf8");
        const parsed = JSON.parse(text);
        const dataObj = parsed.data || parsed.backup?.data || parsed;
        const countsObj = parsed.counts || {};

        const subscribersCount =
          countsObj.subscribers ?? (Array.isArray(dataObj.subscribers) ? dataObj.subscribers.length : 0);
        const transactionsCount =
          countsObj.financialTransactions ??
          (Array.isArray(dataObj.financialTransactions) ? dataObj.financialTransactions.length : 0);
        const photosCount =
          countsObj.subscriberPhotos ??
          (Array.isArray(dataObj.subscriberPhotos) ? dataObj.subscriberPhotos.length : 0);
        const paymentsCount =
          countsObj.payments ?? (Array.isArray(dataObj.payments) ? dataObj.payments.length : 0);

        return NextResponse.json({
          isValid: true,
          format: "json",
          formatLabel: "نسخة بيانات مهيكلة (JSON Data)",
          filename: file.name,
          size: buffer.length,
          version: parsed.version || "2.1",
          clubName: parsed.clubName || parsed.club?.name || "نادي رياضي",
          exportedAt: parsed.exportedAt || null,
          exportedBy: parsed.exportedBy || null,
          counts: {
            subscribers: subscribersCount,
            financialTransactions: transactionsCount,
            subscriberPhotos: photosCount,
            payments: paymentsCount,
          },
          summaryText: `نسخة موثقة للنادي تحتوي على ${subscribersCount} منخرط، ${transactionsCount} عملية مالية، و${photosCount} صورة شخصية.`,
          recommendedMode: "replace",
        });
      } catch (parseErr: any) {
        return NextResponse.json({
          isValid: false,
          error: "الملف بصيغة JSON لكنه تالف أو غير مكتمل.",
        });
      }
    }

    return NextResponse.json({
      isValid: false,
      error: "صيغة الملف غير مدعومة. يرجى اختيار ملف قاعدة بيانات (.db) أو ملف نسخة احتياطية (.json).",
    });
  } catch (e: any) {
    return NextResponse.json(
      { isValid: false, error: e?.message || "فشل فحص الملف" },
      { status: 500 }
    );
  }
}

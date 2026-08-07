import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { readFileSync } from "fs";
import { join } from "path";

// GET /api/staff-rights?year=2026&month=7 → generates Word document
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const url = new URL(req.url);
    const year = parseInt(url.searchParams.get("year") || String(new Date().getFullYear()));
    const month = parseInt(url.searchParams.get("month") || String(new Date().getMonth() + 1));

    // 🔑 جلب المنخرطين الذين دفعوا حقوق المركب في الشهر المحدد
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };

    const renewals = await db.renewal.findMany({
      where: {
        ...clubFilter,
        renewalDate: { gte: startDate, lte: endDate },
        amount: { gte: 1000 }, // فقط الذين دفعوا 1000 دج أو أكثر
      },
      include: {
        subscriber: { select: { id: true, fileNumber: true, lastName: true, firstName: true } },
      },
      orderBy: { subscriber: { fileNumber: "asc" } },
    });

    // 🔑 تجميع البيانات: كل منخرط مرة واحدة مع مجموع ما دفعه
    const memberMap = new Map<string, { lastName: string; firstName: string; amount: number }>();
    for (const r of renewals) {
      const key = r.subscriber.id;
      const existing = memberMap.get(key);
      if (existing) {
        existing.amount += r.amount;
      } else {
        memberMap.set(key, {
          lastName: r.subscriber.lastName,
          firstName: r.subscriber.firstName,
          amount: r.amount,
        });
      }
    }

    const members = Array.from(memberMap.values());
    const totalAmount = members.reduce((s, m) => s + m.amount, 0);

    // 🔑 تحضير بيانات القالب
    const monthNames = ["جانفي", "فبراير", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    const lastDay = new Date(year, month, 0).getDate();
    const monthStr = String(month).padStart(2, "0");

    const templateData = {
      year: String(year),
      yearShort: String(year).slice(-2),
      month: String(month),
      monthName: monthNames[month - 1],
      dateFrom: `01/${monthStr}/${year}`,
      dateTo: `${lastDay}/${monthStr}/${year}`,
      today: new Date().toLocaleDateString("ar-DZ"),
      memberCount: String(members.length),
      totalAmount: totalAmount.toLocaleString("ar-DZ") + ".00 دج",
      members: members.map((m, i) => ({
        index: String(i + 1),
        lastName: m.lastName,
        firstName: m.firstName,
        amount: m.amount.toFixed(2) + " دج",
      })),
    };

    // 🔑 تحميل القالب
    const templatePath = join(process.cwd(), "public", "templates", "monthly-staff-rights-template.docx");
    let templateBuffer: Buffer;
    try {
      templateBuffer = readFileSync(templatePath);
    } catch {
      return NextResponse.json({ error: "القالب غير موجود: " + templatePath }, { status: 500 });
    }

    // 🔑 معالجة القالب مع docxtemplater
    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "",
    });

    try {
      doc.render(templateData);
    } catch (e: any) {
      console.error("Docxtemplater error:", e);
      const errorInfo = e.properties?.errors?.map((err: any) => ({
        key: err?.properties?.key,
        message: err?.message,
      })) || [];
      return NextResponse.json({
        error: "فشل تعبئة القالب",
        details: errorInfo,
      }, { status: 500 });
    }

    const generatedBuffer = doc.getZip().generate({ type: "nodebuffer" });

    // 🔑 إرجاع الملف
    const filename = `حقوق_المركب_${monthNames[month - 1]}_${year}.docx`;
    return new NextResponse(generatedBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": String(generatedBuffer.length),
      },
    });
  } catch (e) {
    console.error("Staff rights generation error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import PizZip from "pizzip";
import { readFileSync } from "fs";
import { join } from "path";

// GET /api/staff-rights?year=2026&month=7 → generates Word document with DB data
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
        amount: { gte: 1000 },
      },
      include: {
        subscriber: { select: { id: true, fileNumber: true, lastName: true, firstName: true } },
      },
      orderBy: { subscriber: { fileNumber: "asc" } },
    });

    // 🔑 تجميع: كل منخرط مرة واحدة مع مجموع ما دفعه
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

    // 🔑 تحميل القالب الأصلي
    const templatePath = join(process.cwd(), "public", "templates", "monthly-staff-rights-template.docx");
    let templateBuffer: Buffer;
    try {
      templateBuffer = readFileSync(templatePath);
    } catch {
      return NextResponse.json({ error: "القالب غير موجود" }, { status: 500 });
    }

    // 🔑 معالجة XML مباشرة — استبدال البيانات يدوياً مع الحفاظ على التنسيق
    const zip = new PizZip(templateBuffer);
    const docFile = zip.file("word/document.xml");
    if (!docFile) {
      return NextResponse.json({ error: "تعذر قراءة القالب" }, { status: 500 });
    }
    let docXml = docFile.asText();

    // 🔑 تحضير البيانات
    const monthNames = ["جانفي", "فبراير", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    const lastDay = new Date(year, month, 0).getDate();
    const monthStr = String(month).padStart(2, "0");
    const today = new Date();
    const todayStr = `${String(today.getDate()).padStart(2, "0")}/${monthStr}/${year}`;

    // 🔑 استبدال التاريخ في الترويسة (سعيدة في: 29/07/2026)
    const dateRegex = /سعيدة في:\s*\d+\/\d+\/\d+/;
    docXml = docXml.replace(dateRegex, `سعيدة في: ${todayStr}`);

    // 🔑 استبدال "من تاريخ 01/07/2026 إلى غاية 31/07/2026"
    const dateRangeRegex = /من تاريخ\s+\d+\/\d+\/\d+\s+إلى غاية\s+\d+\/\d+\/\d+/;
    docXml = docXml.replace(dateRangeRegex, `من تاريخ 01/${monthStr}/${year} إلى غاية ${lastDay}/${monthStr}/${year}`);

    // 🔑 استبدال السنة في "الرقم: . . . / ن.ر.ه. ... / ر.س ... / 2026"
    const yearRegex = /20\d{2}/g;
    docXml = docXml.replace(yearRegex, String(year));

    // 🔑 بناء صفوف الجدول — استبدال صفوف البيانات القديمة بالجديدة
    // الجدول يحتوي على: الرقم | اللقب | الاسم | المبلغ
    // الصف الأول بعد العناوين هو صف البيانات الأول
    // نحتاج إلى إيجاد جميع صفوف البيانات (من "يحياوي" إلى آخر صف قبل "المجموع")

    // استخراج نمط صف البيانات من القالب (أول صف بيانات)
    const rowPattern = /(<w:tr\b[^>]*>[\s\S]*?<\/w:tr>)/g;
    const allRows = docXml.match(rowPattern) || [];

    // ابحث عن صف البيانات الأول (الذي يحتوي على "يحياوي" أو نص بيانات)
    let dataRowTemplate: string | null = null;
    let dataRowIndex = -1;
    for (let i = 0; i < allRows.length; i++) {
      if (allRows[i].includes("يحياوي") || (allRows[i].includes("1000.00 دج") && !allRows[i].includes("المجموع"))) {
        dataRowTemplate = allRows[i];
        dataRowIndex = i;
        break;
      }
    }

    if (dataRowTemplate) {
      // بناء صفوف جديدة من القالب
      const newRows: string[] = [];
      members.forEach((m, idx) => {
        let row = dataRowTemplate!;
        // استبدال الرقم
        row = row.replace(/1(?=<\/w:t>)/, String(idx + 1));
        // استبدال اللقب (يحياوي → m.lastName)
        row = row.replace(/يحياوي/, m.lastName);
        // استبدال الاسم (اياد عبد الله → m.firstName)
        row = row.replace(/اياد عبد الله/, m.firstName);
        // استبدال المبلغ (1000.00 دج → m.amount.toFixed(2) دج)
        row = row.replace(/1000\.00\s*دج/, `${m.amount.toFixed(2)} دج`);
        newRows.push(row);
      });

      // 🔑 حذف جميع صفوف البيانات القديمة (من dataRowIndex إلى آخر صف قبل المجموع)
      // ابحث عن فهرس صف "المجموع"
      let totalRowIndex = -1;
      for (let i = dataRowIndex; i < allRows.length; i++) {
        if (allRows[i].includes("المجموع")) {
          totalRowIndex = i;
          break;
        }
      }

      // عدد صفوف البيانات القديمة
      const oldDataRowsCount = totalRowIndex > 0 ? totalRowIndex - dataRowIndex : 0;

      // 🔑 استبدال: احذف صفوف البيانات القديمة وأدرج الجديدة مكانها
      // الطريقة: ابحث عن أول صف بيانات قديم، واستبدل كل صفوف البيانات بالصفوف الجديدة
      const oldDataRows = allRows.slice(dataRowIndex, dataRowIndex + oldDataRowsCount);
      const oldDataRowsJoined = oldDataRows.join("");
      const newRowsJoined = newRows.join("");

      docXml = docXml.replace(oldDataRowsJoined, newRowsJoined);

      // 🔑 تحديث المجموع (140000.00 دج → totalAmount)
      docXml = docXml.replace(/140000\.00\s*دج/, `${totalAmount.toFixed(2)} دج`);
    }

    // 🔑 كتابة XML المعدّل في الـ zip
    zip.file("word/document.xml", docXml);

    const generatedBuffer = zip.generate({ type: "nodebuffer" });

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

// 🔑 GET /api/staff-rights?preview=true&year=2026&month=7 → returns JSON data for preview
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await req.json();
    const { year, month } = body;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    const clubFilter = currentUser.role === "superadmin" ? {} : { clubId: currentUser.clubId! };

    const renewals = await db.renewal.findMany({
      where: {
        ...clubFilter,
        renewalDate: { gte: startDate, lte: endDate },
        amount: { gte: 1000 },
      },
      include: {
        subscriber: { select: { id: true, fileNumber: true, lastName: true, firstName: true } },
      },
      orderBy: { subscriber: { fileNumber: "asc" } },
    });

    const memberMap = new Map<string, { lastName: string; firstName: string; amount: number; fileNumber: string }>();
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
          fileNumber: r.subscriber.fileNumber,
        });
      }
    }

    const members = Array.from(memberMap.values());
    const totalAmount = members.reduce((s, m) => s + m.amount, 0);

    const monthNames = ["جانفي", "فبراير", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    const lastDay = new Date(year, month, 0).getDate();

    return NextResponse.json({
      members: members.map((m, i) => ({
        index: i + 1,
        lastName: m.lastName,
        firstName: m.firstName,
        fileNumber: m.fileNumber,
        amount: m.amount,
      })),
      totalAmount,
      memberCount: members.length,
      monthName: monthNames[month - 1],
      year,
      dateFrom: `01/${String(month).padStart(2, "0")}/${year}`,
      dateTo: `${lastDay}/${String(month).padStart(2, "0")}/${year}`,
    });
  } catch (e) {
    console.error("Staff rights preview error:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

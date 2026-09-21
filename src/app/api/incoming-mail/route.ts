import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { hasPermission } from "@/lib/roles";

/**
 * GET /api/incoming-mail
 * استرجاع قائمة الواردات مع الفلاتر والإحصائيات وتوليد الرقم التالي
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.clubId || !hasPermission(user.role, "incomingMail")) {
      return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 403 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const documentType = url.searchParams.get("documentType");
    const urgency = url.searchParams.get("urgency");
    const sender = url.searchParams.get("sender");
    const yearParam = url.searchParams.get("year");
    const q = (url.searchParams.get("q") || "").trim();

    const currentYear = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    const where: Record<string, unknown> = { clubId: user.clubId };
    if (yearParam && yearParam !== "all") {
      where.year = currentYear;
    }
    if (status && status !== "all") {
      where.status = status;
    }
    if (documentType && documentType !== "all") {
      where.documentType = documentType;
    }
    if (urgency && urgency !== "all") {
      where.urgency = urgency;
    }
    if (sender && sender !== "all") {
      where.sender = { contains: sender };
    }
    if (q) {
      where.OR = [
        { mailNumber: { contains: q } },
        { letterNumber: { contains: q } },
        { sender: { contains: q } },
        { subject: { contains: q } },
        { assignedTo: { contains: q } },
        { notes: { contains: q } },
      ];
    }

    const mails = await db.incomingMail.findMany({
      where,
      orderBy: [{ receivedDate: "desc" }, { seq: "desc" }],
    });

    // إحصائيات عامة للنادي في هذه السنة
    const allMailsYear = await db.incomingMail.findMany({
      where: { clubId: user.clubId, ...(yearParam !== "all" ? { year: currentYear } : {}) },
      select: { status: true, seq: true },
    });

    const stats = {
      total: allMailsYear.length,
      new: allMailsYear.filter((m) => m.status === "new").length,
      in_progress: allMailsYear.filter((m) => m.status === "in_progress").length,
      referred: allMailsYear.filter((m) => m.status === "referred").length,
      completed: allMailsYear.filter((m) => m.status === "completed").length,
      archived: allMailsYear.filter((m) => m.status === "archived").length,
    };

    // حساب الرقم التسلسلي القادم للسنة الحالية
    const maxSeqResult = await db.incomingMail.aggregate({
      where: { clubId: user.clubId, year: currentYear },
      _max: { seq: true },
    });
    const nextSeq = (maxSeqResult._max.seq || 0) + 1;
    const nextNumber = `${String(nextSeq).padStart(3, "0")} / ${currentYear}`;

    return NextResponse.json({
      mails,
      stats,
      nextNumber,
      nextSeq,
      year: currentYear,
    });
  } catch (error) {
    console.error("Error in GET /api/incoming-mail:", error);
    return NextResponse.json({ error: "فشل في جلب سجل الوارد" }, { status: 500 });
  }
}

/**
 * POST /api/incoming-mail
 * تسجيل وارد إداري جديد مع توليد رقم متسلسل تلقائي غير قابل للتكرار
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.clubId || !hasPermission(user.role, "incomingMail")) {
      return NextResponse.json({ error: "غير مصرح لك بتسجيل وارد جديد" }, { status: 403 });
    }

    const body = await req.json();
    const {
      receivedDate,
      letterNumber,
      letterDate,
      sender,
      senderType,
      subject,
      documentType = "مراسلة",
      urgency = "normal",
      assignedTo,
      deliveryMethod = "hand",
      notes,
      attachmentUrl,
      attachmentName,
      status = "new",
      customMailNumber,
    } = body;

    if (!sender?.trim() || !subject?.trim()) {
      return NextResponse.json(
        { error: "الجهة المرسلة وموضوع المراسلة حقول إلزامية" },
        { status: 400 }
      );
    }

    const recDate = receivedDate ? new Date(receivedDate) : new Date();
    const year = recDate.getFullYear();

    // حساب الرقم التسلسلي التالي
    const maxSeqResult = await db.incomingMail.aggregate({
      where: { clubId: user.clubId, year },
      _max: { seq: true },
    });
    const seq = (maxSeqResult._max.seq || 0) + 1;
    const defaultNumber = `${String(seq).padStart(3, "0")} / ${year}`;
    const mailNumber = customMailNumber?.trim() || defaultNumber;

    const mail = await db.incomingMail.create({
      data: {
        clubId: user.clubId,
        mailNumber,
        seq,
        year,
        receivedDate: recDate,
        letterNumber: letterNumber?.trim() || "بدون رقم",
        letterDate: letterDate ? new Date(letterDate) : recDate,
        sender: sender.trim(),
        senderType: senderType?.trim() || null,
        subject: subject.trim(),
        documentType: documentType.trim(),
        urgency,
        assignedTo: assignedTo?.trim() || null,
        deliveryMethod,
        notes: notes?.trim() || null,
        attachmentUrl: attachmentUrl || null,
        attachmentName: attachmentName || null,
        status,
        createdById: user.id,
      },
    });

    return NextResponse.json({ mail, success: true });
  } catch (error) {
    console.error("Error in POST /api/incoming-mail:", error);
    return NextResponse.json({ error: "فشل في تسجيل الوارد الإداري" }, { status: 500 });
  }
}

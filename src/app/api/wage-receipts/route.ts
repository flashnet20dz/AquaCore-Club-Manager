import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { hasPermission } from "@/lib/roles";
import { tafqeetDZD } from "@/lib/tafqeet";

/**
 * GET /api/wage-receipts
 * استرجاع قائمة وصولات استلام المستحقات المالية
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.clubId || !hasPermission(user.role, "wageReceipts")) {
      return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 403 });
    }

    const url = new URL(req.url);
    const employeeId = url.searchParams.get("employeeId");
    const periodLabel = url.searchParams.get("periodLabel");
    const q = (url.searchParams.get("q") || "").trim();

    const where: Record<string, unknown> = { clubId: user.clubId };
    if (employeeId && employeeId !== "all") where.employeeId = employeeId;
    if (periodLabel && periodLabel !== "all") where.periodLabel = periodLabel;
    if (q) {
      where.OR = [
        { receiptNumber: { contains: q } },
        { workerName: { contains: q } },
        { nationalId: { contains: q } },
        { periodLabel: { contains: q } },
      ];
    }

    const receipts = await db.wageReceipt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // توليد الرقم التالي المقترح
    const currentYear = new Date().getFullYear();
    const countThisYear = await db.wageReceipt.count({
      where: {
        clubId: user.clubId,
        receiptNumber: { contains: String(currentYear) },
      },
    });
    const nextSeq = String(countThisYear + 1).padStart(3, "0");
    const suggestedNumber = `${nextSeq} / ${currentYear}`;

    return NextResponse.json({
      receipts,
      suggestedNumber,
    });
  } catch (error) {
    console.error("Error in GET /api/wage-receipts:", error);
    return NextResponse.json({ error: "فشل في جلب وصولات المستحقات" }, { status: 500 });
  }
}

/**
 * POST /api/wage-receipts
 * إنشاء وحفظ وصل استلام مستحقات مالية جديد
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.clubId || !hasPermission(user.role, "wageReceipts")) {
      return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 403 });
    }

    const body = await req.json();
    const {
      receiptNumber: reqReceiptNumber,
      season,
      date,
      employeeId,
      userId,
      workerName,
      workerPosition,
      nationalId,
      idIssueDate,
      idIssuePlace,
      periodLabel,
      daysWorked = 0,
      workHours = 0,
      hourRate = 0,
      baseWage = 0,
      allowances = 0,
      deductions = 0,
      netAmount,
      subject,
      paymentMethod = "cash",
      paymentReference,
      status = "issued",
      wagePaymentId,
      updateEmployeeProfile = false,
    } = body;

    if (!workerName || !periodLabel || netAmount === undefined) {
      return NextResponse.json(
        { error: "بيانات الوصل الأساسية (اسم العامل، الفترة، وصافي المبلغ) مطلوبة" },
        { status: 400 }
      );
    }

    const currentYear = new Date().getFullYear();
    let finalReceiptNumber = reqReceiptNumber?.trim();

    // إذا لم يُرسل رقم الوصل أو وُجد تكرار، نولّد رقمًا فريدًا
    if (!finalReceiptNumber) {
      const countThisYear = await db.wageReceipt.count({
        where: {
          clubId: user.clubId,
          receiptNumber: { contains: String(currentYear) },
        },
      });
      finalReceiptNumber = `${String(countThisYear + 1).padStart(3, "0")} / ${currentYear}`;
    }

    // فحص فرادة رقم الوصل داخل نفس النادي
    const existing = await db.wageReceipt.findUnique({
      where: {
        clubId_receiptNumber: {
          clubId: user.clubId,
          receiptNumber: finalReceiptNumber,
        },
      },
    });

    if (existing) {
      // إضافة تمييز زمني لضمان الفرادة
      finalReceiptNumber = `${finalReceiptNumber}-${Date.now().toString().slice(-4)}`;
    }

    // التفقيط باللغة العربية
    const amountInWords = tafqeetDZD(Number(netAmount));

    const finalSubject = subject?.trim() || `مستحقات / أجر شهر: ${periodLabel}`;

    const receipt = await db.wageReceipt.create({
      data: {
        clubId: user.clubId,
        receiptNumber: finalReceiptNumber,
        season: season || `${currentYear - 1}/${currentYear}`,
        date: date ? new Date(date) : new Date(),
        employeeId: employeeId || null,
        userId: userId || null,
        workerName: workerName.trim(),
        workerPosition: workerPosition?.trim() || "عامل",
        nationalId: nationalId?.trim() || null,
        idIssueDate: idIssueDate ? new Date(idIssueDate) : null,
        idIssuePlace: idIssuePlace?.trim() || null,
        periodLabel: periodLabel.trim(),
        daysWorked: Number(daysWorked) || 0,
        workHours: Number(workHours) || 0,
        hourRate: Number(hourRate) || 0,
        baseWage: Number(baseWage) || 0,
        allowances: Number(allowances) || 0,
        deductions: Number(deductions) || 0,
        netAmount: Number(netAmount) || 0,
        amountInWords,
        subject: finalSubject,
        paymentMethod,
        paymentReference: paymentReference?.trim() || null,
        status,
        wagePaymentId: wagePaymentId || null,
        createdById: user.id,
      },
    });

    // تحديث ملف العامل إذا طلب المستخدم حفظ بيانات الهوية
    if (updateEmployeeId(employeeId) && updateEmployeeProfile) {
      try {
        await db.employee.update({
          where: { id: employeeId },
          data: {
            nationalId: nationalId?.trim() || undefined,
            idIssueDate: idIssueDate ? new Date(idIssueDate) : undefined,
            idIssuePlace: idIssuePlace?.trim() || undefined,
          },
        });
      } catch (err) {
        console.warn("Could not update employee details:", err);
      }
    }

    return NextResponse.json({ receipt, success: true });
  } catch (error) {
    console.error("Error in POST /api/wage-receipts:", error);
    return NextResponse.json({ error: "فشل في حفظ وصل المستحقات" }, { status: 500 });
  }
}

function updateEmployeeId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0;
}

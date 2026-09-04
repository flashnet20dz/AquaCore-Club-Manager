/**
 * work-contract-guard.ts — حماية ساعات العمل بعقود العمل (المرحلة 5 — §24)
 * ═══════════════════════════════════════════════════════════════════════
 * إذا انتهى عقد العامل (endDate) فلا يُسمح بتسجيل WorkHours بعد تاريخ
 * الانتهاء إلا لمدير يتجاوز صراحةً (override) — مع رسالة تحذير واضحة.
 *
 * التوافق الخلفي: العامل بلا سجل Employee أو بلا عقد نشط = مسموح
 * (لا نُوقف النظام الحالي لغياب بيانات عقود قديمة).
 */

import { db } from "@/lib/db";
import { parseWallDateTime } from "@/lib/wall-clock";

export interface ContractGuardResult {
  ok: boolean;
  /** رسالة تحذير/رفض واضحة للعرض */
  message?: string;
  contractNumber?: string;
  endDate?: string;
}

export async function checkContractAllowsWork(
  clubId: string,
  userId: string,
  dateYMD: string
): Promise<ContractGuardResult> {
  const employee = await db.employee.findFirst({
    where: { clubId, userId, status: { not: "ARCHIVED" } },
    orderBy: { createdAt: "desc" },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!employee) return { ok: true }; // بلا سجل موظف → التوافق الخلفي (نظام المستخدمين القديم)

  const workDate = parseWallDateTime(dateYMD, "12:00");

  // العقود النشطة للعامل — إن لم يوجد عقد نشط فالسماح (بيانات عقود غير مكتملة لا تُوقف العمل)
  // ★ العقد الحاكم = النشط ذو أقصى endDate (التغطية الأوسع) —
  //   يُسمح بالعمل ما دام هناك عقد نشط يغطي التاريخ
  const contract = await db.employmentContract.findFirst({
    where: {
      clubId,
      employeeId: employee.id,
      status: "active",
      startDate: { lte: workDate },
    },
    orderBy: { endDate: "desc" },
    select: { contractNumber: true, endDate: true },
  });
  if (!contract) return { ok: true };

  if (contract.endDate && workDate > contract.endDate) {
    const endStr = contract.endDate.toISOString().slice(0, 10).split("-").reverse().join("/");
    return {
      ok: false,
      message: `عقد العامل ${employee.lastName} ${employee.firstName} (${contract.contractNumber}) منتهٍ في ${endStr} — لا يمكن تسجيل ساعات عمل بعد انتهاء العقد إلا بتجاوز صلاحية المدير`,
      contractNumber: contract.contractNumber,
      endDate: contract.endDate.toISOString().slice(0, 10),
    };
  }

  return { ok: true, contractNumber: contract.contractNumber };
}

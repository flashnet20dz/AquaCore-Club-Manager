import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { substituteVariables, formatDateYMD, type ContractVariables } from "@/lib/contract-variables";

/**
 * Contracts API
 * ─────────────
 * GET  /api/contracts               — list all contracts (archive)
 * POST /api/contracts               — create new contract from template + employee
 *   body: { employeeId, templateId, startDate, endDate, hourRate, workSchedule, notes }
 *   - auto-generates contractNumber: CTR-YYYY-NNN
 *   - auto-substitutes {{variables}} from employee + club settings
 */

async function generateContractNumber(clubId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.employmentContract.count({ where: { clubId } });
  const seq = String(count + 1).padStart(3, "0");
  return `CTR-${year}-${seq}`;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !user.clubId) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

    const contracts = await db.employmentContract.findMany({
      where: { clubId: user.clubId },
      include: {
        employee: true,
        template: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ contracts });
  } catch (e) {
    console.error("GET contracts:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const clubId = user.clubId!;
    const body = await req.json();
    const { employeeId, templateId, startDate, endDate, hourRate, workSchedule, notes } = body;

    if (!employeeId) return NextResponse.json({ error: "employeeId مطلوب" }, { status: 400 });

    // Fetch employee + template + settings
    const [employee, template, settings] = await Promise.all([
      db.employee.findFirst({ where: { id: employeeId, clubId } }),
      templateId ? db.contractTemplate.findFirst({ where: { id: templateId, clubId } }) : Promise.resolve(null),
      db.setting.findMany({ where: { clubId } }),
    ]);

    if (!employee) return NextResponse.json({ error: "العامل غير موجود" }, { status: 404 });

    const settingsMap: Record<string, string> = {};
    settings.forEach((s) => { settingsMap[s.key] = s.value; });

    const contractNumber = await generateContractNumber(clubId);
    const sd = new Date(startDate);
    const ed = endDate ? new Date(endDate) : null;
    const rate = hourRate ?? employee.hourRate ?? 200;
    const position = employee.position;

    // Build variables
    const vars: ContractVariables = {
      club_name: settingsMap.clubName || "النادي",
      club_branch: settingsMap.branchName || settingsMap.clubNameFr || "",
      worker_name: `${employee.lastName} ${employee.firstName}`.trim(),
      birth_date: formatDateYMD(employee.birthDate),
      birth_place: employee.birthPlace || "—",
      address: employee.address || "—",
      phone: employee.phone || "—",
      national_id: employee.nationalId || "—",
      position,
      contract_number: contractNumber,
      start_date: formatDateYMD(sd),
      end_date: formatDateYMD(ed),
      hour_rate: rate,
      work_schedule: workSchedule || "—",
      club_president: settingsMap.clubPresident || "—",
      association_president: settingsMap.associationPresident || "—",
      today: formatDateYMD(new Date()),
    };

    // Get template content (fallback to a minimal default if no template)
    const templateContent = template?.content || `<div dir="rtl" style="font-family:'Cairo','Tahoma',Arial;font-size:12pt;padding:20px;">
<h2 style="text-align:center;color:#0f766e;">عقد عمل</h2>
<p>في اليوم {{today}}، بين {{club_name}} والسيد/ة {{worker_name}}.</p>
<p>المنصب: {{position}}</p>
<p>المدة: من {{start_date}} إلى {{end_date}}</p>
<p>الأجر: {{hour_rate}} دج/ساعة</p>
<p>رقم العقد: {{contract_number}}</p>
</div>`;

    const renderedContent = substituteVariables(templateContent, vars);

    const contract = await db.employmentContract.create({
      data: {
        clubId,
        employeeId,
        templateId: template?.id || null,
        contractNumber,
        position,
        startDate: sd,
        endDate: ed,
        hourRate: rate,
        workSchedule: workSchedule || null,
        content: renderedContent,
        status: "active",
        notes: notes || null,
        createdBy: user.id,
      },
      include: { employee: true, template: { select: { name: true, code: true } } },
    });

    return NextResponse.json({ contract }, { status: 201 });
  } catch (e) {
    console.error("POST contract:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

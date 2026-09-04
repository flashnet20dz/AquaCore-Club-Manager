import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { substituteVariables, formatDateYMD, type ContractVariables } from "@/lib/contract-variables";

/**
 * Contracts API (المرحلة 5 — §4/§5/§26/§42)
 * ─────────────
 * GET  /api/contracts?employeeId=&type=&status=&from=&to=&page=&pageSize=
 *   — قائمة العقود مع فلاتر server-side + انتهاء تلقائي عند القراءة (§26)
 *     (active ب endDate < اليوم → expired — بلا تغيير تاريخ العقد الأصلي)
 * POST /api/contracts
 *   body: { employeeId, templateId?, startDate, endDate?, hourRate?, workSchedule?,
 *           contractType?, title?, weeklyHours?, notes?, asDraft? }
 *   - auto-generates contractNumber: CTR-YYYY-NNN
 *   - auto-substitutes {{variables}} from employee + club settings
 *   - asDraft=true → status=draft (مسودة قابلة للتفعيل لاحقاً)
 */

const CONTRACT_TYPES = ["HOURLY", "MONTHLY", "TEMPORARY", "FIXED_TERM", "OTHER"] as const;

// من يرى العقود: الإدارة + المحاسبة + المساعد
function hasContractsView(role: string): boolean {
  return ["admin", "superadmin", "assistant", "accountant"].includes(role);
}

async function generateContractNumber(clubId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.employmentContract.count({ where: { clubId } });
  const seq = String(count + 1).padStart(3, "0");
  return `CTR-${year}-${seq}`;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.clubId || !hasContractsView(user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const clubId = user.clubId;

    // ★ المرحلة 5 (§26): انتهاء تلقائي عند القراءة — العقود النشطة التي انتهت
    //   مدتها تصبح expired (idempotent — بلا تغيير تاريخ العقد الأصلي)
    const now = new Date();
    await db.employmentContract.updateMany({
      where: { clubId, status: "active", endDate: { not: null, lt: now } },
      data: { status: "expired" },
    }).catch(() => undefined);

    const url = new URL(req.url);
    const employeeId = url.searchParams.get("employeeId");
    const type = url.searchParams.get("type");
    const status = url.searchParams.get("status");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const pageParam = url.searchParams.get("page");
    const pageSizeParam = url.searchParams.get("pageSize");

    const where: Record<string, unknown> = { clubId };
    if (employeeId && employeeId !== "all") where.employeeId = employeeId;
    if (type && type !== "all") where.contractType = type.toUpperCase();
    if (status && status !== "all") where.status = status;
    if (from || to) {
      const startDateFilter: Record<string, unknown> = {};
      if (from) startDateFilter.gte = new Date(`${from}T00:00:00.000Z`);
      if (to) startDateFilter.lte = new Date(`${to}T23:59:59.999Z`);
      where.startDate = startDateFilter;
    }

    const total = await db.employmentContract.count({ where });

    // ★ §42: ترقيم صفحات server-side اختياري — الوضع الافتراضي (بلا page) يُرجع الكل
    //   للتوافق مع الواجهة الحالية؛ عند تمرير page يُرجع { contracts, total, page, pageSize }
    let take: number | undefined;
    let skip: number | undefined;
    let page: number | null = null;
    let pageSize: number | null = null;
    if (pageParam) {
      page = Math.max(1, parseInt(pageParam) || 1);
      pageSize = Math.min(100, Math.max(5, parseInt(pageSizeParam || "20") || 20));
      take = pageSize;
      skip = (page - 1) * pageSize;
    }

    const contracts = await db.employmentContract.findMany({
      where,
      include: {
        employee: true,
        template: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
      ...(take !== undefined ? { take, skip } : {}),
    });

    if (page !== null) {
      return NextResponse.json({ contracts, total, page, pageSize });
    }
    return NextResponse.json({ contracts, total });
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
    const {
      employeeId, templateId, startDate, endDate, hourRate, workSchedule, notes,
      contractType, title, weeklyHours, asDraft,
    } = body;

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
    const cType = (CONTRACT_TYPES as readonly string[]).includes(contractType) ? contractType : "HOURLY";
    const weekly = weeklyHours ? Math.max(0, Math.round(Number(weeklyHours))) : null;

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
      work_schedule: workSchedule || (weekly ? `${weekly} ساعة/أسبوع` : "—"),
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
        contractType: cType,
        title: title ? String(title).trim() : null,
        weeklyHours: weekly,
        content: renderedContent,
        status: asDraft ? "draft" : "active",
        notes: notes || null,
        createdBy: user.id,
      },
      include: { employee: true, template: { select: { name: true, code: true } } },
    });

    // ★ المرحلة 5 (§35): تدقيق إنشاء العقد
    await db.auditLog.create({
      data: {
        clubId,
        userId: user.id,
        action: "contract_create",
        entityType: "EmploymentContract",
        entityId: contract.id,
        description: `إنشاء عقد ${contractNumber} للعامل ${employee.lastName} ${employee.firstName} (${cType}${asDraft ? " — مسودة" : ""})`,
        metadata: JSON.stringify({
          contractNumber, contractType: cType, hourRate: rate,
          startDate: sd.toISOString(), endDate: ed?.toISOString() ?? null, asDraft: Boolean(asDraft),
        }),
      },
    }).catch(() => undefined);

    return NextResponse.json({ contract }, { status: 201 });
  } catch (e) {
    console.error("POST contract:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal" }, { status: 500 });
  }
}

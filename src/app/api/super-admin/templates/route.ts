import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { auditLogWithRequest } from "@/lib/audit";

/**
 * GET /api/super-admin/templates
 * SuperAdmin: قائمة قوالب الواجهات
 *
 * POST /api/super-admin/templates
 * SuperAdmin: إنشاء قالب جديد
 * Body: { name, displayName, description, config }
 */

// قوالب افتراضية مدمجة (تُنشأ عند أول طلب)
const DEFAULT_TEMPLATES = [
  {
    name: "basic",
    displayName: "أساسي",
    description: "قوالب أساسي بأقل الواجهات ظهوراً — مناسب للنوادي الصغيرة",
    config: JSON.stringify({
      interfaces: [
        { key: "dashboard", name: "لوحة التحكم", visible: true },
        { key: "subscribers", name: "المنخرطون", visible: true },
        { key: "attendance", name: "الحضور", visible: true },
        { key: "renewals", name: "التجديدات", visible: true },
        { key: "reports", name: "التقارير", visible: false },
        { key: "settings", name: "الإعدادات", visible: true },
      ],
    }),
    isDefault: true,
  },
  {
    name: "professional",
    displayName: "احترافي",
    description: "كل الواجهات مفعّلة + ميزات متقدمة",
    config: JSON.stringify({
      interfaces: [
        { key: "dashboard", name: "لوحة التحكم", visible: true },
        { key: "subscribers", name: "المنخرطون", visible: true },
        { key: "attendance", name: "الحضور", visible: true },
        { key: "renewals", name: "التجديدات", visible: true },
        { key: "payments", name: "المدفوعات", visible: true },
        { key: "reports", name: "التقارير", visible: true },
        { key: "cards", name: "البطاقات", visible: true },
        { key: "settings", name: "الإعدادات", visible: true },
      ],
    }),
    isDefault: false,
  },
  {
    name: "starter",
    displayName: "مبتدئ",
    description: "إعداد مبسّط للتجربة المجانية",
    config: JSON.stringify({
      interfaces: [
        { key: "dashboard", name: "لوحة التحكم", visible: true },
        { key: "subscribers", name: "المنخرطون", visible: true },
        { key: "attendance", name: "الحضور", visible: true },
      ],
    }),
    isDefault: false,
  },
];

async function ensureDefaultTemplates() {
  const count = await db.uITemplate.count();
  if (count === 0) {
    await db.uITemplate.createMany({ data: DEFAULT_TEMPLATES });
  }
}

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    await ensureDefaultTemplates();

    const templates = await db.uITemplate.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        displayName: t.displayName,
        description: t.description,
        config: t.config ? JSON.parse(t.config) : {},
        isDefault: t.isDefault,
        createdAt: t.createdAt,
      })),
    });
  } catch (e) {
    console.error("GET templates error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await req.json();
    const { name, displayName, description, config, isDefault = false } = body;

    if (!name || !displayName || !config) {
      return NextResponse.json({ error: "name, displayName, config مطلوبة" }, { status: 400 });
    }

    const template = await db.uITemplate.create({
      data: {
        name,
        displayName,
        description: description || null,
        config: typeof config === "string" ? config : JSON.stringify(config),
        isDefault,
      },
    });

    await auditLogWithRequest(req, currentUser, {
      action: "create",
      entityType: "ui_template",
      entityId: template.id,
      description: `إنشاء قالب واجهات: ${displayName} (${name})`,
      metadata: { name, displayName, isDefault },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (e) {
    console.error("POST template error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// ════════════ أنواع افتراضية مع الخصائص الديناميكية ════════════
const DEFAULT_TYPES = [
  {
    name: "عادي",
    code: "/",
    color: "#0d9488",
    description: "اشتراك عادي شهري — رسوم 1300/1500 دج",
    subscriptionFee: 1300,
    insuranceFee: 500,
    compoundRights: 1000,
    durationDays: 30,
    givesMembershipNumber: true,
    requiresInsurance: true,
    requiresCompoundFee: true,
    renewableMonthly: true,
    freeSubscription: false,
    numberingGroup: "RCS",
    sortOrder: 0,
  },
  {
    name: "DJS",
    code: "DJS",
    color: "#d946ef",
    description: "اشتراك مخفض — رسوم 300/500 دج حسب العمر",
    subscriptionFee: 300,
    insuranceFee: 500,
    compoundRights: 0,
    durationDays: 30,
    givesMembershipNumber: true,
    requiresInsurance: true,
    requiresCompoundFee: false,
    renewableMonthly: true,
    freeSubscription: false,
    numberingGroup: "RCS",
    sortOrder: 1,
  },
  {
    name: "**",
    code: "**",
    color: "#dc2626",
    description: "نوع خاص — مجاني، سلسلة مستقلة X",
    subscriptionFee: 0,
    insuranceFee: 0,
    compoundRights: 0,
    durationDays: 30,
    givesMembershipNumber: true,
    requiresInsurance: false,
    requiresCompoundFee: false,
    renewableMonthly: true,
    freeSubscription: true,
    numberingGroup: "X",
    sortOrder: 2,
  },
];

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !user.clubId) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

    // auto-seed الأنواع الافتراضية إذا لم تكن موجودة
    const existingCount = await db.subscriptionType.count({ where: { clubId: user.clubId } });
    if (existingCount === 0) {
      await db.subscriptionType.createMany({
        data: DEFAULT_TYPES.map((t) => ({ ...t, clubId: user.clubId! })),
      });
    } else {
      // Migration: تحديث الأنواع الموجودة + إضافة ** إذا لم تكن موجودة
      const existing = await db.subscriptionType.findMany({ where: { clubId: user.clubId } });
      for (const t of existing) {
        const defaultType = DEFAULT_TYPES.find((d) => d.code === t.code);
        if (defaultType) {
          await db.subscriptionType.update({
            where: { id: t.id },
            data: {
              givesMembershipNumber: defaultType.givesMembershipNumber,
              requiresInsurance: defaultType.requiresInsurance,
              requiresCompoundFee: defaultType.requiresCompoundFee,
              renewableMonthly: defaultType.renewableMonthly,
              freeSubscription: defaultType.freeSubscription,
              numberingGroup: defaultType.numberingGroup,
              description: t.description || defaultType.description,
            },
          });
        } else {
          // نوع غير موجود في DEFAULT_TYPES — اضبط numberingGroup افتراضية
          if (!t.numberingGroup || t.numberingGroup === "RCS") {
            // إذا كان النوع لا يمنح رقم عضوية، أعطه مجموعة خاصة
            if (!t.givesMembershipNumber) {
              await db.subscriptionType.update({
                where: { id: t.id },
                data: { numberingGroup: t.code.substring(0, 3).toUpperCase() },
              });
            }
          }
        }
      }
      // إضافة نوع ** إذا لم يكن موجوداً
      const hasStarStar = existing.some(t => t.code === "**");
      if (!hasStarStar) {
        const starType = DEFAULT_TYPES.find(d => d.code === "**");
        if (starType) {
          await db.subscriptionType.create({
            data: { ...starType, clubId: user.clubId! },
          });
        }
      }
    }

    const types = await db.subscriptionType.findMany({
      where: { clubId: user.clubId },
      orderBy: { sortOrder: "asc" },
    });
    // منع caching لضمان ظهور الأنواع الجديدة فوراً
    const response = NextResponse.json({ types });
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    return response;
  } catch (e) {
    console.error("GET subscription-types:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await req.json();
    const type = await db.subscriptionType.create({
      data: {
        ...body,
        clubId: user.clubId!,
        givesMembershipNumber: body.givesMembershipNumber ?? true,
        requiresInsurance: body.requiresInsurance ?? true,
        requiresCompoundFee: body.requiresCompoundFee ?? true,
        renewableMonthly: body.renewableMonthly ?? true,
        freeSubscription: body.freeSubscription ?? false,
      },
    });
    return NextResponse.json({ type }, { status: 201 });
  } catch (e) {
    console.error("POST subscription-types:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

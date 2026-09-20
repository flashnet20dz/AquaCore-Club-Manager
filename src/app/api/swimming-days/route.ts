import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ensureSwimDefaults } from "@/lib/feature-defaults";
import {
  parseSwimmingGroups,
  SWIMMING_GROUPS_SETTING_KEY,
  POOL_OPERATING_DAYS_SETTING_KEY,
  DEFAULT_SWIMMING_GROUPS,
  WEEK_DAYS_MAP,
  type SwimmingDayGroup,
} from "@/lib/swimming-groups";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !user.clubId) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

    // 1. بذر تلقائي مرة واحدة للنوادي الجديدة
    await ensureSwimDefaults(db, user.clubId).catch(() => null);

    // 2. جلب الأيام السبعة من جدول SwimmingDay
    const days = await db.swimmingDay.findMany({
      where: { clubId: user.clubId },
      orderBy: { sortOrder: "asc" },
    });

    // 3. جلب أيام تشغيل المسبح (Setting: poolOperatingDays)
    const opSetting = await db.setting.findUnique({
      where: { clubId_key: { clubId: user.clubId, key: POOL_OPERATING_DAYS_SETTING_KEY } },
    });

    let operatingDays: string[];
    if (opSetting?.value) {
      try {
        operatingDays = JSON.parse(opSetting.value);
      } catch {
        operatingDays = ["0", "1", "2", "3", "4", "5"];
      }
    } else {
      // اشتقاق أيام التشغيل من الأيام النشطة في SwimmingDay
      const activeDows = days
        .map((d, i) => {
          const match = WEEK_DAYS_MAP.find((w) => w.name === d.name);
          return d.active ? String(match ? match.key : i) : null;
        })
        .filter(Boolean) as string[];
      operatingDays = activeDows.length ? activeDows : ["0", "1", "2", "3", "4", "5"];
    }

    // 4. جلب الأفواج المزدوجة والمخصصة (Setting: swimmingDayGroups)
    const groupsSetting = await db.setting.findUnique({
      where: { clubId_key: { clubId: user.clubId, key: SWIMMING_GROUPS_SETTING_KEY } },
    });
    const groups = parseSwimmingGroups(groupsSetting?.value);

    return NextResponse.json({ days, operatingDays, groups });
  } catch (e) {
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

/** استعادة الأيام والتوقيتات والأفواج الافتراضية يدوياً */
export async function PUT() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin" || !user.clubId)
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

    const result = await ensureSwimDefaults(db, user.clubId, true);

    // استعادة إعداد الأفواج الافتراضية وإعادة تعيين أيام التشغيل
    const defaultOpDays = ["0", "1", "2", "3", "4", "5"]; // السبت مغلق افتراضياً
    await db.$transaction([
      db.setting.upsert({
        where: { clubId_key: { clubId: user.clubId, key: POOL_OPERATING_DAYS_SETTING_KEY } },
        update: { value: JSON.stringify(defaultOpDays) },
        create: { clubId: user.clubId, key: POOL_OPERATING_DAYS_SETTING_KEY, value: JSON.stringify(defaultOpDays) },
      }),
      db.setting.upsert({
        where: { clubId_key: { clubId: user.clubId, key: SWIMMING_GROUPS_SETTING_KEY } },
        update: { value: JSON.stringify(DEFAULT_SWIMMING_GROUPS) },
        create: { clubId: user.clubId, key: SWIMMING_GROUPS_SETTING_KEY, value: JSON.stringify(DEFAULT_SWIMMING_GROUPS) },
      }),
    ]);

    return NextResponse.json({ ok: true, ...result, groups: DEFAULT_SWIMMING_GROUPS, operatingDays: defaultOpDays });
  } catch (e) {
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

/** تحديث مرن للأفواج المزدوجة أو لأيام التشغيل مع التزامن التام */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin" || !user.clubId)
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

    const body = await req.json();

    // أ) تحديث أيام تشغيل المسبح (تزامن فوري بين poolOperatingDays و SwimmingDay)
    if (Array.isArray(body.operatingDays)) {
      const opDays = body.operatingDays.map(String);
      const clubId = user.clubId; // narrowed: string

      // ⚡ معاملة مجمّعة واحدة: upsert + مزامنة 7 أيام في دفعة واحدة
      // (كانت 8 طلبات متتالية = بطء ملحوظ عند تبديل أيام التشغيل، خاصة على الإنترنت)
      await db.$transaction([
        db.setting.upsert({
          where: { clubId_key: { clubId, key: POOL_OPERATING_DAYS_SETTING_KEY } },
          update: { value: JSON.stringify(opDays) },
          create: { clubId, key: POOL_OPERATING_DAYS_SETTING_KEY, value: JSON.stringify(opDays) },
        }),
        ...WEEK_DAYS_MAP.map((w) =>
          db.swimmingDay.updateMany({
            where: { clubId, name: w.name },
            data: { active: opDays.includes(String(w.key)) },
          })
        ),
      ]);
    }

    // ب) تحديث أفواج السباحة المزدوجة والمخصصة
    if (Array.isArray(body.groups)) {
      const groups = body.groups as SwimmingDayGroup[];
      await db.setting.upsert({
        where: { clubId_key: { clubId: user.clubId, key: SWIMMING_GROUPS_SETTING_KEY } },
        update: { value: JSON.stringify(groups) },
        create: { clubId: user.clubId, key: SWIMMING_GROUPS_SETTING_KEY, value: JSON.stringify(groups) },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    if (!user.clubId) return NextResponse.json({ error: "لا يوجد نادي مرتبط بهذا الحساب" }, { status: 400 });
    const body = await req.json();
    try {
      const day = await db.swimmingDay.create({ data: { ...body, clubId: user.clubId } });
      return NextResponse.json({ day }, { status: 201 });
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") {
        const name = typeof body?.name === "string" ? body.name.trim() : "";
        const clash = name
          ? await db.swimmingDay.findFirst({ where: { clubId: user.clubId, name } })
          : null;
        if (clash && !clash.active) {
          const day = await db.swimmingDay.update({
            where: { id: clash.id },
            data: {
              active: true,
              shortName: typeof body?.shortName === "string" ? body.shortName : clash.shortName,
              color: typeof body?.color === "string" ? body.color : clash.color,
              sortOrder: typeof body?.sortOrder === "number" ? body.sortOrder : clash.sortOrder,
            },
          });
          return NextResponse.json({ day, reactivated: true }, { status: 201 });
        }
        return NextResponse.json({ error: "يوم بنفس الاسم موجود مسبقاً" }, { status: 409 });
      }
      throw err;
    }
  } catch (e) {
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

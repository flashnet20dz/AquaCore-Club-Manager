import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { resolveTargetClubId } from "@/lib/tenant";
import {
  CLUB_FULL_NAME_ROLE,
  ENTETE_VERSION,
  UNIFIED_LOGO_SIZE,
  composeClubFullName,
} from "@/lib/entete-shared";

/**
 * EN-TETE (letterhead) configuration endpoint
 *
 * The EN-TETE is composed of multiple elements, each placed in a "slot":
 *   - header-left / header-center / header-right
 *   - footer-left / footer-center / footer-right
 *
 * Element types:
 *   - text: content + fontFamily + fontSize + fontWeight + color + italic + underline
 *   - logo: src (URL or base64) + width + height + borderRadius
 *
 * Stored as a single JSON in the Setting table under key "enteteConfig".
 *
 * ★ v2: سطر الاسم الرسمي الكامل الواحد (role=clubFullName) — يُرقّى تلقائياً من v1
 *   مع الحفاظ على الشعارات المخصصة وعناصر التذييل.
 */

export interface EnteteElement {
  id: string;
  label: string;          // admin-friendly name (for the editor sidebar)
  type: "text" | "logo";
  // Text props
  content?: string;
  fontFamily?: string;    // "Cairo" | "Tahoma" | "Arial" | "Times New Roman" | "Amiri" | "Tajawal"
  fontSize?: number;      // pt
  fontWeight?: "normal" | "bold";
  color?: string;         // hex like "#0f766e"
  italic?: boolean;
  underline?: boolean;
  // Position
  slot: "header-left" | "header-center" | "header-right" | "footer-left" | "footer-center" | "footer-right";
  // Logo props
  src?: string;
  width?: number;         // px
  height?: number;        // px
  borderRadius?: number;  // px
  // ★ v2: دور العنصر — يتيح التوليد الآلي من إعدادات النادي
  role?: string;
}

export interface EnteteConfig {
  elements: EnteteElement[];
  showDivider: boolean;
  dividerColor: string;
  dividerWidth: number;   // px
  referenceNumberText: string;  // "الرقم: . . ./ن.ر.ه.ر.س YYYY"
  dateLocationText: string;     // "سعيدة في: YYYY/MM/DD"
  showReferenceRow: boolean;
  version?: number;       // ★ v2
}

const DEFAULT_CLUB_OFFICIAL_NAME = "الجمعية الرياضية الهاوية النادي الهاوي متعدد الرياضات - الرائد سعيدة - فرع السباحة";

const DEFAULT_ENTETE: EnteteConfig = {
  elements: [
    {
      id: "logo-right-default",
      label: "الشعار الأيمن",
      type: "logo",
      slot: "header-right",
      src: "/images/rcs-logo-official.png",
      width: UNIFIED_LOGO_SIZE,
      height: UNIFIED_LOGO_SIZE,
      borderRadius: 8,
    },
    {
      id: "club-full-name",
      label: "الاسم الرسمي للنادي (سطر واحد)",
      type: "text",
      slot: "header-center",
      role: CLUB_FULL_NAME_ROLE,
      content: DEFAULT_CLUB_OFFICIAL_NAME,
      fontFamily: "Cairo",
      fontSize: 13,
      fontWeight: "bold",
      color: "#0f766e",
      italic: false,
      underline: false,
    },
    {
      id: "logo-left-default",
      label: "الشعار الأيسر",
      type: "logo",
      slot: "header-left",
      src: "/images/rcs-logo-official.png",
      width: UNIFIED_LOGO_SIZE,
      height: UNIFIED_LOGO_SIZE,
      borderRadius: 8,
    },
  ],
  showDivider: true,
  dividerColor: "#0f766e",
  dividerWidth: 2,
  referenceNumberText: "الرقم: . . ./ن.ر.ر.س",
  dateLocationText: "سعيدة في:",
  showReferenceRow: true,
  version: ENTETE_VERSION,
};

const EN_TETE_KEY = "enteteConfig";

/**
 * ★ ترقية إعدادات الترويسة القديمة (v1: ثلاثة أسطر مكررة) إلى v2:
 *   - سطر الاسم الرسمي الكامل الواحد (بلا تكرار كلمات)
 *   - الحفاظ على الشعارات المخزنة (قد تكون مخصصة برفع ملف) وعناصر التذييل
 */
function upgradeEnteteConfig(parsed: EnteteConfig): { config: EnteteConfig; changed: boolean } {
  if ((parsed as { version?: number })?.version === ENTETE_VERSION && Array.isArray(parsed.elements)) {
    return { config: parsed, changed: false };
  }
  const els: EnteteElement[] = Array.isArray(parsed?.elements) ? parsed.elements : [];
  const headerLogos = els.filter((e) => e.type === "logo" && (e.slot === "header-right" || e.slot === "header-left"));
  const rightLogo = headerLogos.find((l) => l.slot === "header-right")
    || { id: "logo-right-default", label: "الشعار الأيمن", type: "logo" as const, slot: "header-right" as const, src: "/images/rcs-logo-official.png", width: UNIFIED_LOGO_SIZE, height: UNIFIED_LOGO_SIZE, borderRadius: 8 };
  const leftLogo = headerLogos.find((l) => l.slot === "header-left" && l.id !== rightLogo.id)
    || { id: "logo-left-default", label: "الشعار الأيسر", type: "logo" as const, slot: "header-left" as const, src: "/images/rcs-logo-official.png", width: UNIFIED_LOGO_SIZE, height: UNIFIED_LOGO_SIZE, borderRadius: 8 };

  // كل ما ليس نصاً وسطياً ولا شعاراً علوياً يُحفظ كما هو (تذييل…)
  const keepOthers = els.filter(
    (e) => !(e.type === "text" && e.slot === "header-center") && !((e.type === "logo") && (e.slot === "header-right" || e.slot === "header-left")),
  );

  const config: EnteteConfig = {
    ...parsed,
    elements: [
      { ...rightLogo, width: UNIFIED_LOGO_SIZE, height: UNIFIED_LOGO_SIZE },
      {
        id: "club-full-name",
        label: "الاسم الرسمي للنادي (سطر واحد)",
        type: "text",
        slot: "header-center",
        role: CLUB_FULL_NAME_ROLE,
        content: "", // فارغ = توليد آلي من إعدادات النادي (بلا تكرار)
        fontFamily: "Cairo",
        fontSize: 13,
        fontWeight: "bold",
        color: "#0f766e",
        italic: false,
        underline: false,
      },
      { ...leftLogo, width: UNIFIED_LOGO_SIZE, height: UNIFIED_LOGO_SIZE },
      ...keepOthers,
    ],
    version: ENTETE_VERSION,
  };
  return { config, changed: true };
}

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    // 🔑 superadmin يدير النادي الفعلي — نفس الحل في settings/employees
    const clubId = await resolveTargetClubId(currentUser);
    if (!clubId) {
      return NextResponse.json({ config: DEFAULT_ENTETE });
    }

    const setting = await db.setting.findFirst({
      where: { clubId, key: EN_TETE_KEY },
    });
    if (!setting) {
      return NextResponse.json({ config: DEFAULT_ENTETE });
    }
    try {
      const parsed = JSON.parse(setting.value) as EnteteConfig;
      const { config, changed } = upgradeEnteteConfig({ ...DEFAULT_ENTETE, ...parsed });
      if (changed) {
        // ترقية صامتة دائمة — حتى لا تتكرر عند كل قراءة
        await db.setting
          .upsert({
            where: { clubId_key: { clubId, key: EN_TETE_KEY } },
            update: { value: JSON.stringify(config) },
            create: { clubId, key: EN_TETE_KEY, value: JSON.stringify(config) },
          })
          .catch(() => undefined);
      }
      return NextResponse.json({ config });
    } catch {
      return NextResponse.json({ config: DEFAULT_ENTETE });
    }
  } catch (e) {
    console.error("GET entete:", e);
    return NextResponse.json({ config: DEFAULT_ENTETE });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    // 🔑 إصلاح superadmin: احفظ في نادي الهدف بدل رفض الطلب
    const clubId = await resolveTargetClubId(currentUser);
    if (!clubId) {
      return NextResponse.json({ error: "لا يوجد نادي مرتبط" }, { status: 400 });
    }

    const body = await req.json();
    const config = body.config as EnteteConfig;

    if (!config || !Array.isArray(config.elements)) {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }

    const json = JSON.stringify({ ...config, version: ENTETE_VERSION });
    await db.setting.upsert({
      where: { clubId_key: { clubId, key: EN_TETE_KEY } },
      update: { value: json },
      create: { clubId, key: EN_TETE_KEY, value: json },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("PUT entete:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

/** Reset to defaults */
export async function DELETE() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    // 🔑 superadmin: صفّر إعدادات نادي الهدف
    const clubId = await resolveTargetClubId(currentUser);
    if (!clubId) {
      return NextResponse.json({ error: "لا يوجد نادي مرتبط" }, { status: 400 });
    }
    await db.setting.deleteMany({ where: { clubId, key: EN_TETE_KEY } });
    return NextResponse.json({ success: true, config: DEFAULT_ENTETE });
  } catch (e) {
    console.error("DELETE entete:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

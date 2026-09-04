import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

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
}

export interface EnteteConfig {
  elements: EnteteElement[];
  showDivider: boolean;
  dividerColor: string;
  dividerWidth: number;   // px
  referenceNumberText: string;  // "الرقم: . . ./ن.ر.ه.ر.س YYYY"
  dateLocationText: string;     // "سعيدة في: YYYY/MM/DD"
  showReferenceRow: boolean;
}

export const DEFAULT_ENTETE: EnteteConfig = {
  elements: [
    {
      id: "logo-left-default",
      label: "الشعار الأيسر",
      type: "logo",
      slot: "header-left",
      src: "/images/rcs-logo-official.png",
      width: 70,
      height: 70,
      borderRadius: 8,
    },
    {
      id: "title-default",
      label: "النادي الهاوي متعدد الرياضات",
      type: "text",
      slot: "header-center",
      content: "النادي الهاوي متعدد الرياضات",
      fontFamily: "Cairo",
      fontSize: 16,
      fontWeight: "bold",
      color: "#0f766e",
      italic: false,
      underline: false,
    },
    {
      id: "subtitle-default",
      label: "الرائد - سعيدة",
      type: "text",
      slot: "header-center",
      content: "الرائد - سعيدة",
      fontFamily: "Cairo",
      fontSize: 14,
      fontWeight: "bold",
      color: "#f59e0b",
      italic: false,
      underline: false,
    },
    {
      id: "branch-default",
      label: "فرع السباحة",
      type: "text",
      slot: "header-center",
      content: "فرع السباحة",
      fontFamily: "Cairo",
      fontSize: 12,
      fontWeight: "normal",
      color: "#555555",
      italic: false,
      underline: false,
    },
    {
      id: "logo-right-default",
      label: "الشعار الأيمن",
      type: "logo",
      slot: "header-right",
      src: "/images/rcs-logo-official.png",
      width: 70,
      height: 70,
      borderRadius: 8,
    },
  ],
  showDivider: true,
  dividerColor: "#0f766e",
  dividerWidth: 2,
  referenceNumberText: "الرقم: . . ./ن.ر.ه.ر.س",
  dateLocationText: "سعيدة في:",
  showReferenceRow: true,
};

const EN_TETE_KEY = "enteteConfig";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const setting = await db.setting.findFirst({
      where: { clubId: currentUser.clubId!, key: EN_TETE_KEY },
    });
    if (!setting) {
      return NextResponse.json({ config: DEFAULT_ENTETE });
    }
    try {
      const parsed = JSON.parse(setting.value) as EnteteConfig;
      return NextResponse.json({ config: { ...DEFAULT_ENTETE, ...parsed } });
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
    const clubId = currentUser.clubId;
    if (!clubId) {
      return NextResponse.json({ error: "لا يوجد نادي مرتبط" }, { status: 400 });
    }

    const body = await req.json();
    const config = body.config as EnteteConfig;

    if (!config || !Array.isArray(config.elements)) {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }

    const json = JSON.stringify(config);
    await db.setting.upsert({
      where: { clubId_key: { clubId: currentUser.clubId!, key: EN_TETE_KEY } },
      update: { value: json },
      create: { clubId: currentUser.clubId!, key: EN_TETE_KEY, value: json },
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
    await db.setting.deleteMany({ where: { clubId: currentUser.clubId!, key: EN_TETE_KEY } });
    return NextResponse.json({ success: true, config: DEFAULT_ENTETE });
  } catch (e) {
    console.error("DELETE entete:", e);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

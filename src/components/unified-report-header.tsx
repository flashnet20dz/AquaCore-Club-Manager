"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Hash, Calendar, MapPin } from "lucide-react";

/**
 * UnifiedReportHeader
 * ───────────────────
 * مكوّن واحد موحّد للترويسة يُستخدم في جميع التقارير والمطبوعات.
 * - يجلب إعداداته من /api/entete (الترويسة) و /api/settings (معلومات النادي).
 * - أي تعديل على الإعدادات ينعكس تلقائياً على كل التقارير.
 * - يدعم: شعار يمين/يسار، اسم النادي، الفرع، الولاية، نوع التقرير، التاريخ، رقم التقرير، الموسم الرياضي.
 */

export interface EnteteElement {
  id: string;
  label: string;
  type: "text" | "logo";
  content?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  color?: string;
  italic?: boolean;
  underline?: boolean;
  slot: "header-left" | "header-center" | "header-right" | "footer-left" | "footer-center" | "footer-right";
  src?: string;
  width?: number;
  height?: number;
  borderRadius?: number;
}

export interface EnteteConfig {
  elements: EnteteElement[];
  showDivider: boolean;
  dividerColor: string;
  dividerWidth: number;
  referenceNumberText: string;
  dateLocationText: string;
  showReferenceRow: boolean;
}

interface ClubSettings {
  clubName?: string;
  clubNameFr?: string;
  branchName?: string;
  wilaya?: string;
  clubAddress?: string;
  clubPhone?: string;
  clubEmail?: string;
  clubWebsite?: string;
  sportSeason?: string;
}

interface UnifiedReportHeaderProps {
  /** نوع التقرير — يظهر تحت اسم النادي */
  reportType?: string;
  /** عنوان فرعي للتقرير (اختياري) */
  reportSubtitle?: string;
  /** رقم التقرير (اختياري) — إذا لم يُمرَّر ويكون showReferenceRow=true يظهر تلقائياً */
  reportNumber?: string;
  /** التاريخ المعروض — يفترض تاريخ اليوم إذا لم يُمرَّر */
  date?: Date | string;
  /** مظهر مضغوط للمعاينة داخل الإعدادات */
  compact?: boolean;
  /** إظهار الموسم الرياضي */
  showSeason?: boolean;
  /** إظهار حقل التاريخ */
  showDate?: boolean;
  /** إظهار رقم التقرير */
  showReportNumber?: boolean;
  /** تخصيص مباشر للترويسة (للمعاينة الحية الفورية) */
  entete?: EnteteConfig;
  /** تخصيص مباشر لبيانات النادي */
  settings?: ClubSettings;
}

export const DEFAULT_CLUB_OFFICIAL_NAME = "الجمعية الرياضية الهاوية النادي الهاوي متعدد الرياضات - الرائد سعيدة - فرع السباحة";

export const DEFAULT_ENTETE: EnteteConfig = {
  elements: [
    {
      id: "logo-right-default",
      label: "الشعار الأيمن",
      type: "logo",
      slot: "header-right",
      src: "/images/rcs-logo-official.png",
      width: 75,
      height: 75,
      borderRadius: 8,
    },
    {
      id: "title-default",
      label: "اسم الجمعية والنادي (سطر واحد)",
      type: "text",
      slot: "header-center",
      content: DEFAULT_CLUB_OFFICIAL_NAME,
      fontFamily: "Cairo",
      fontSize: 13.5,
      fontWeight: "bold",
      color: "#0f766e",
    },
    {
      id: "logo-left-default",
      label: "الشعار الأيسر",
      type: "logo",
      slot: "header-left",
      src: "/images/rcs-logo-official.png",
      width: 75,
      height: 75,
      borderRadius: 8,
    },
  ],
  showDivider: true,
  dividerColor: "#0f766e",
  dividerWidth: 2,
  referenceNumberText: "الرقم: . . ./ن.ر.ر.س",
  dateLocationText: "سعيدة في:",
  showReferenceRow: true,
};

function todayStr(d?: Date | string): string {
  if (!d) {
    const x = new Date();
    return `${x.getFullYear()}/${String(x.getMonth() + 1).padStart(2, "0")}/${String(x.getDate()).padStart(2, "0")}`;
  }
  if (typeof d === "string") return d;
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function currentSeason(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (m >= 9) return `${y}/${y + 1}`;
  return `${y - 1}/${y}`;
}

/**
 * دالة لتنقية النصوص الفرعية في الوسط وتفادي أي تكرار لكلمات اسم النادي أو الفرع
 */
function filterDuplicateCenterElements(
  elements: EnteteElement[],
  mainTitle: string
): EnteteElement[] {
  const normMain = mainTitle.trim().toLowerCase().replace(/\s+/g, " ");
  const seen = new Set<string>();

  return elements.filter((el) => {
    if (el.type !== "text") return true;
    const raw = (el.content || "").trim();
    if (!raw) return false;
    const norm = raw.toLowerCase().replace(/\s+/g, " ");

    // حذف التكرار مع العنوان الرئيسي
    if (norm === normMain) return false;

    // إذا كان السطر الفرعي كلمة/عبارة فرعية متضمنة أصلاً في الاسم الرئيسي (مثل "فرع السباحة" أو "الرائد - سعيدة")
    const cleanSub = norm.replace(/^[-–—\s]+|[-–—\s]+$/g, "");
    if (cleanSub.length >= 3 && normMain.includes(cleanSub)) {
      return false;
    }

    if (seen.has(norm)) return false;
    seen.add(norm);
    return true;
  });
}

export function UnifiedReportHeader({
  reportType,
  reportSubtitle,
  reportNumber,
  date,
  compact = false,
  showSeason = true,
  showDate = true,
  showReportNumber = true,
  entete: propEntete,
  settings: propSettings,
}: UnifiedReportHeaderProps) {
  const [entete, setEntete] = useState<EnteteConfig>(propEntete || DEFAULT_ENTETE);
  const [settings, setSettings] = useState<ClubSettings>(propSettings || {});

  useEffect(() => {
    if (propEntete) setEntete(propEntete);
  }, [propEntete]);

  useEffect(() => {
    if (propSettings) setSettings(propSettings);
  }, [propSettings]);

  useEffect(() => {
    if (propEntete && propSettings) return;
    let cancelled = false;
    Promise.all([
      fetch("/api/entete").then((r) => r.json()).catch(() => ({ config: DEFAULT_ENTETE })),
      fetch("/api/settings").then((r) => r.json()).catch(() => ({ settings: {} })),
    ]).then(([enteteData, settingsData]) => {
      if (!cancelled) {
        if (!propEntete && enteteData.config) setEntete(enteteData.config);
        if (!propSettings && settingsData.settings) setSettings(settingsData.settings);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [propEntete, propSettings]);

  // الاسم الرئيسي الموحد للنادي في سطر واحد
  const mainClubName = (
    settings.clubName ||
    DEFAULT_CLUB_OFFICIAL_NAME
  ).trim();

  // عناصر الوسط الإضافية بعد إزالة أي تكرار
  const extraCenterElements = filterDuplicateCenterElements(
    entete.elements.filter((e) => e.slot === "header-center" && e.type === "text"),
    mainClubName
  );

  const rightLogos = entete.elements.filter((e) => e.slot === "header-right" && e.type === "logo" && e.src);
  const leftLogos = entete.elements.filter((e) => e.slot === "header-left" && e.type === "logo" && e.src);
  const hasRight = rightLogos.length > 0;
  const hasLeft = leftLogos.length > 0;

  const logoSize = compact ? 60 : 75;
  const gridColumns = (hasRight || hasLeft) ? `${logoSize + 5}px 1fr ${logoSize + 5}px` : "1fr";

  const renderLogoBox = (src?: string, alt?: string, borderRadius?: number) => (
    <div
      style={{
        width: logoSize,
        height: logoSize,
        minWidth: logoSize,
        maxWidth: logoSize,
        minHeight: logoSize,
        maxHeight: logoSize,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        borderRadius: borderRadius || 8,
        overflow: "hidden",
        backgroundColor: "#f8fafc",
        border: "1px solid #f1f5f9",
      }}
      className="shadow-xs"
    >
      <img
        src={src || "/images/rcs-logo-official.png"}
        alt={alt || "شعار"}
        width={logoSize}
        height={logoSize}
        style={{
          width: "100%",
          height: "100%",
          maxWidth: logoSize,
          maxHeight: logoSize,
          objectFit: "contain",
          display: "block",
        }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.opacity = "0.2";
        }}
      />
    </div>
  );

  return (
    <div
      className="unified-report-header rounded-xl bg-white border border-border/70 shadow-sm overflow-hidden"
      style={{ containerType: "inline-size" }}
      dir="rtl"
    >
      {/* ════ الصف العلوي: شعار يمين (اختياري) + عنوان في سطر واحد + شعار يسار (اختياري) ════ */}
      <div
        className="grid items-center"
        style={{
          gridTemplateColumns: gridColumns,
          gap: "8px",
          padding: compact ? "6px 10px" : "10px 14px",
          minHeight: compact ? 70 : 92,
        }}
      >
        {/* يمين: الشعار الأيمن أو مساحة توازن للمحاذاة */}
        {(hasRight || hasLeft) && (
          <div className="flex items-center justify-start" style={{ width: logoSize + 5 }}>
            {hasRight
              ? renderLogoBox(rightLogos[0].src, rightLogos[0].label, rightLogos[0].borderRadius)
              : <div style={{ width: logoSize + 5 }} />}
          </div>
        )}

        {/* وسط: اسم النادي في سطر واحد بدون تكرار + نوع الوثيقة */}
        <div className="flex flex-col items-center justify-center text-center min-w-0 w-full px-1">
          {/* سطر 1: الاسم الرسمي للجمعية والنادي في سطر واحد بارز */}
          <h1
            className="font-extrabold text-[#0f766e] tracking-tight leading-tight whitespace-nowrap overflow-hidden text-ellipsis max-w-full text-center"
            style={{
              fontSize: compact ? "8pt" : "clamp(7pt, 1.75cqi, 11.5pt)",
              fontFamily: "'Cairo', 'Tahoma', Arial, sans-serif",
              letterSpacing: "-0.35px",
            }}
            title={mainClubName}
          >
            {mainClubName}
          </h1>

          {/* أسطر مخصصة غير مكررة إن وُجدت */}
          {extraCenterElements.map((el) => (
            <p
              key={el.id}
              className="mt-0.5 text-slate-600 max-w-full truncate"
              style={{
                fontFamily: `'${el.fontFamily || "Cairo"}', 'Tahoma', Arial`,
                fontSize: `${Math.min(el.fontSize || 11, 12)}pt`,
                fontWeight: el.fontWeight || "normal",
                color: el.color || "#475569",
              }}
            >
              {el.content}
            </p>
          ))}

          {/* سطر 2: شارة نوع الوثيقة أو التقرير المعتمد بنطاق مخصص */}
          {reportType && (
            <div
              className="mt-1.5 inline-flex items-center px-3.5 py-0.5 rounded-full font-bold bg-[#0f766e15] text-[#0f766e] border border-[#0f766e35] whitespace-nowrap shadow-2xs"
              style={{
                fontSize: compact ? "9.5pt" : "11pt",
                fontFamily: "'Cairo', 'Tahoma', Arial, sans-serif",
              }}
            >
              {reportType}
            </div>
          )}

          {/* سطر 3: عنوان فرعي اختياري فقط إن وُجد ولم يتطابق مع نوع التقرير */}
          {reportSubtitle && reportSubtitle !== reportType && (
            <p
              className="text-slate-500 mt-1 max-w-full truncate"
              style={{ fontSize: compact ? "8.5pt" : "10pt" }}
            >
              {reportSubtitle}
            </p>
          )}
        </div>

        {/* يسار: الشعار الأيسر أو مساحة توازن للمحاذاة */}
        {(hasRight || hasLeft) && (
          <div className="flex items-center justify-end" style={{ width: logoSize + 5 }}>
            {hasLeft
              ? renderLogoBox(leftLogos[0].src, leftLogos[0].label, leftLogos[0].borderRadius)
              : <div style={{ width: logoSize + 5 }} />}
          </div>
        )}
      </div>

      {/* ════ الفاصل ════ */}
      {entete.showDivider && (
        <hr
          style={{
            border: "none",
            borderTop: `${entete.dividerWidth || 2}px solid ${entete.dividerColor || "#0f766e"}`,
            margin: "0",
          }}
        />
      )}

      {/* ════ صف مرجعي: رقم + تاريخ + موسم ════ */}
      {(entete.showReferenceRow || showDate || showReportNumber || showSeason) && (
        <div
          className="flex items-center justify-between flex-wrap gap-2 text-[9.5pt] sm:text-[10pt] text-slate-700 bg-slate-50/50"
          style={{ padding: compact ? "4px 10px" : "6px 16px", fontFamily: "'Cairo', 'Tahoma', Arial" }}
        >
          <div className="flex items-center gap-3 flex-wrap">
            {entete.showReferenceRow && showReportNumber && (
              <span className="font-bold flex items-center gap-1 text-slate-900">
                <Hash className="h-3 w-3 text-teal-600" />
                {reportNumber || `${entete.referenceNumberText || "الرقم: . . ./ن.ر.ر.س"} ${new Date().getFullYear()}`}
              </span>
            )}
            {showSeason && (
              <span className="text-slate-600 font-semibold">
                الموسم الرياضي: {settings.sportSeason || currentSeason()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {showDate && (
              <span className="font-bold flex items-center gap-1 text-slate-900">
                <Calendar className="h-3 w-3 text-teal-600" />
                {entete.dateLocationText || "سعيدة في:"} {todayStr(date)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ════ معلومات إضافية للنادي (هاتف، بريد، موقع) ════ */}
      {!compact && (settings.clubPhone || settings.clubEmail || settings.clubWebsite) && (
        <div
          className="flex items-center justify-center gap-4 text-[9pt] text-slate-500 border-t border-border/30 bg-slate-50/30"
          style={{ padding: "4px 16px", fontFamily: "'Cairo', 'Tahoma', Arial" }}
        >
          {settings.clubPhone && <span dir="ltr">📞 {settings.clubPhone}</span>}
          {settings.clubEmail && <span dir="ltr">✉ {settings.clubEmail}</span>}
          {settings.clubWebsite && <span dir="ltr">🌐 {settings.clubWebsite}</span>}
        </div>
      )}
    </div>
  );
}

/**
 * هيكل HTML للترويسة الموحدة — يُستخدم عند توليد ملفات Word/PDF/الطباعة والعقود.
 * يضمن ظهور اسم النادي في سطر واحد، عدم تكرار الكلمات، وثبات حجم وموقع الشعارات.
 */
export function unifiedReportHeaderHTML(opts: {
  reportType?: string;
  reportSubtitle?: string;
  reportNumber?: string;
  date?: string;
  entete?: EnteteConfig;
  settings?: ClubSettings;
}): string {
  const entete = opts.entete || DEFAULT_ENTETE;
  const settings = opts.settings || {};
  const dateStr = opts.date || todayStr();
  const season = settings.sportSeason || currentSeason();

  const mainClubName = (
    settings.clubName ||
    DEFAULT_CLUB_OFFICIAL_NAME
  ).trim();

  // الشعارات في اليمين واليسار (مع إمكانية الحذف الفردي لكل شعار على حدة)
  const rightLogo = entete.elements.find((e) => e.slot === "header-right" && e.type === "logo" && e.src);
  const leftLogo = entete.elements.find((e) => e.slot === "header-left" && e.type === "logo" && e.src);
  const hasRight = !!rightLogo;
  const hasLeft = !!leftLogo;
  const gridColumns = (hasRight || hasLeft) ? "80px 1fr 80px" : "1fr";

  const renderLogoHTML = (src?: string) => `
    <div style="width:75px;height:75px;min-width:75px;max-width:75px;min-height:75px;max-height:75px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border-radius:8px;overflow:hidden;background:#f8fafc;border:1px solid #f1f5f9;">
      <img src="${src || "/images/rcs-logo-official.png"}" alt="شعار" width="75" height="75" style="width:75px;height:75px;max-width:75px;max-height:75px;object-fit:contain;display:block;" onerror="this.style.opacity='0.2'" />
    </div>
  `;

  // نصوص إضافية في الوسط مع تفادي أي تكرار
  const normMain = mainClubName.toLowerCase().replace(/\s+/g, " ");
  const customCenterHTML = entete.elements
    .filter((e) => e.slot === "header-center" && e.type === "text")
    .filter((e) => {
      const txt = (e.content || "").trim();
      if (!txt) return false;
      const norm = txt.toLowerCase().replace(/\s+/g, " ");
      if (norm === normMain) return false;
      const cleanSub = norm.replace(/^[-–—\s]+|[-–—\s]+$/g, "");
      if (cleanSub.length >= 3 && normMain.includes(cleanSub)) return false;
      return true;
    })
    .map(
      (el) =>
        `<p style="font-family:'${el.fontFamily || "Cairo"}','Tahoma',Arial;font-size:${Math.min(el.fontSize || 11, 11)}pt;font-weight:${el.fontWeight || "normal"};color:${el.color || "#475569"};margin:2px 0 0 0;line-height:1.3;">${el.content || ""}</p>`
    )
    .join("");

  const reportTypeHTML = opts.reportType
    ? `<div style="margin-top:6px;display:inline-block;padding:3px 16px;border-radius:9999px;background:#0f766e15;color:#0f766e;font-size:11pt;font-weight:700;border:1px solid #0f766e35;white-space:nowrap;line-height:1.4;">${opts.reportType}</div>`
    : "";

  const subtitleHTML = (opts.reportSubtitle && opts.reportSubtitle !== opts.reportType)
    ? `<p style="font-size:10pt;color:#64748b;margin:3px 0 0 0;">${opts.reportSubtitle}</p>`
    : "";

  const dividerHTML = entete.showDivider
    ? `<hr style="border:none;border-top:${entete.dividerWidth || 2}px solid ${entete.dividerColor || "#0f766e"};margin:0;" />`
    : "";

  const refRowHTML = `
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:6px 16px;font-size:10pt;color:#334155;font-family:'Cairo','Tahoma',Arial;background:#f8fafc;">
      <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;">
        ${entete.showReferenceRow ? `<span style="font-weight:bold;color:#0f172a;">${opts.reportNumber || `${entete.referenceNumberText || "الرقم: . . ./ن.ر.ر.س"} ${new Date().getFullYear()}`}</span>` : ""}
        <span style="color:#64748b;font-weight:600;">الموسم الرياضي: ${season}</span>
      </div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;">
        <span style="font-weight:bold;color:#0f172a;">${entete.dateLocationText || "سعيدة في:"} ${dateStr}</span>
      </div>
    </div>
  `;

  const contactRowHTML = (settings.clubPhone || settings.clubEmail || settings.clubWebsite)
    ? `<div style="display:flex;justify-content:center;gap:16px;flex-wrap:wrap;padding:4px 16px;font-size:9pt;color:#64748b;border-top:1px solid #f1f5f9;font-family:'Cairo','Tahoma',Arial;background:#f8fafc;">
        ${settings.clubPhone ? `<span dir="ltr">📞 ${settings.clubPhone}</span>` : ""}
        ${settings.clubEmail ? `<span dir="ltr">✉ ${settings.clubEmail}</span>` : ""}
        ${settings.clubWebsite ? `<span dir="ltr">🌐 ${settings.clubWebsite}</span>` : ""}
      </div>`
    : "";

  return `
    <div class="unified-report-header" style="background:#fff;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden;direction:rtl;container-type:inline-size;" dir="rtl">
      <div style="display:grid;grid-template-columns:${gridColumns};gap:8px;align-items:center;padding:10px 14px;min-height:90px;">
        ${(hasRight || hasLeft) ? `<div style="display:flex;align-items:center;justify-content:flex-start;width:80px;">${hasRight ? renderLogoHTML(rightLogo!.src) : `<div style="width:80px;"></div>`}</div>` : ""}
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;min-width:0;width:100%;padding:0 4px;">
          <h1 style="font-family:'Cairo','Tahoma',Arial,sans-serif;font-size:clamp(7pt, 1.75cqi, 11.5pt);font-weight:800;color:#0f766e;margin:0;padding:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.35;max-width:100%;letter-spacing:-0.35px;" title="${mainClubName}">
            ${mainClubName}
          </h1>
          ${customCenterHTML}
          ${reportTypeHTML}
          ${subtitleHTML}
        </div>
        ${(hasRight || hasLeft) ? `<div style="display:flex;align-items:center;justify-content:flex-end;width:80px;">${hasLeft ? renderLogoHTML(leftLogo!.src) : `<div style="width:80px;"></div>`}</div>` : ""}
      </div>
      ${dividerHTML}
      ${refRowHTML}
      ${contactRowHTML}
    </div>
  `;
}

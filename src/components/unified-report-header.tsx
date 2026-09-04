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
}

const DEFAULT_ENTETE: EnteteConfig = {
  elements: [
    { id: "logo-left-default", label: "الشعار الأيسر", type: "logo", slot: "header-left", src: "/images/rcs-logo-official.png", width: 70, height: 70, borderRadius: 8 },
    { id: "title-default", label: "اسم النادي", type: "text", slot: "header-center", content: "النادي الهاوي متعدد الرياضات", fontFamily: "Cairo", fontSize: 16, fontWeight: "bold", color: "#0f766e" },
    { id: "subtitle-default", label: "الفرع", type: "text", slot: "header-center", content: "الرائد - سعيدة", fontFamily: "Cairo", fontSize: 14, fontWeight: "bold", color: "#f59e0b" },
    { id: "branch-default", label: "الفرع", type: "text", slot: "header-center", content: "فرع السباحة", fontFamily: "Cairo", fontSize: 12, fontWeight: "normal", color: "#555555" },
    { id: "logo-right-default", label: "الشعار الأيمن", type: "logo", slot: "header-right", src: "/images/rcs-logo-official.png", width: 70, height: 70, borderRadius: 8 },
  ],
  showDivider: true,
  dividerColor: "#0f766e",
  dividerWidth: 2,
  referenceNumberText: "الرقم: . . ./ن.ر.ه.ر.س",
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
  // الموسم الرياضي يبدأ في سبتمبر
  if (m >= 9) return `${y}/${y + 1}`;
  return `${y - 1}/${y}`;
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
}: UnifiedReportHeaderProps) {
  const [entete, setEntete] = useState<EnteteConfig>(DEFAULT_ENTETE);
  const [settings, setSettings] = useState<ClubSettings>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/entete").then((r) => r.json()).catch(() => ({ config: DEFAULT_ENTETE })),
      fetch("/api/settings").then((r) => r.json()).catch(() => ({ settings: {} })),
    ]).then(([enteteData, settingsData]) => {
      if (cancelled) return;
      setEntete(enteteData.config || DEFAULT_ENTETE);
      setSettings(settingsData.settings || {});
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // دمج إعدادات النادي على عناصر الترويسة
  // إذا كان هناك clubName في الإعدادات نستبدله في النص المركزي
  const mergedElements = entete.elements.map((el) => {
    if (el.type === "text") {
      // استبدال ديناميكي بقيم إعدادات النادي
      if (el.content === "النادي الهاوي متعدد الرياضات" && settings.clubName) {
        return { ...el, content: settings.clubName };
      }
      if (el.content === "الرائد - سعيدة" && settings.branchName) {
        return { ...el, content: settings.branchName };
      }
    }
    return el;
  });

  const renderElement = (el: EnteteElement) => {
    if (el.type === "logo") {
      return (
        <img
          src={el.src || "/images/rcs-logo-official.png"}
          alt={el.label}
          style={{
            width: `${Math.min(el.width || 70, compact ? 50 : 80)}px`,
            height: `${Math.min(el.height || 70, compact ? 50 : 80)}px`,
            borderRadius: `${el.borderRadius || 0}px`,
            objectFit: "contain",
          }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.2"; }}
        />
      );
    }
    return (
      <p
        style={{
          fontFamily: `'${el.fontFamily || "Cairo"}', 'Tahoma', Arial`,
          fontSize: `${el.fontSize || 12}pt`,
          fontWeight: el.fontWeight || "normal",
          color: el.color || "#111",
          fontStyle: el.italic ? "italic" : "normal",
          textDecoration: el.underline ? "underline" : "none",
          margin: "1px 0",
          lineHeight: 1.3,
        }}
      >
        {el.content || ""}
      </p>
    );
  };

  if (loading) {
    return (
      <div className="rounded-xl bg-white border border-border/60 p-4 text-center" dir="rtl">
        <span className="text-xs text-gray-400">جاري تحميل الترويسة...</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="unified-report-header rounded-xl bg-white border border-border/60 shadow-sm overflow-hidden"
      dir="rtl"
    >
      {/* ════ الصف العلوي: شعار + معلومات النادي + شعار ════ */}
      <div
        className="grid grid-cols-3 gap-2 items-center"
        style={{ padding: compact ? "8px 12px" : "12px 18px", minHeight: compact ? 70 : 90 }}
      >
        {/* يمين */}
        <div className="flex flex-col items-start justify-center gap-1">
          {mergedElements.filter((e) => e.slot === "header-right").map((el) => (
            <div key={el.id}>{renderElement(el)}</div>
          ))}
        </div>
        {/* وسط */}
        <div className="flex flex-col items-center justify-center gap-0 text-center">
          {mergedElements.filter((e) => e.slot === "header-center").map((el) => (
            <div key={el.id}>{renderElement(el)}</div>
          ))}
          {reportType && (
            <p
              className="mt-1 px-3 py-0.5 rounded-full font-bold"
              style={{
                backgroundColor: "#0f766e15",
                color: "#0f766e",
                fontSize: compact ? "10pt" : "12pt",
                border: "1px solid #0f766e30",
              }}
            >
              {reportType}
            </p>
          )}
          {reportSubtitle && (
            <p style={{ fontSize: compact ? "9pt" : "10pt", color: "#666", margin: "2px 0 0" }}>
              {reportSubtitle}
            </p>
          )}
        </div>
        {/* يسار */}
        <div className="flex flex-col items-end justify-center gap-1">
          {mergedElements.filter((e) => e.slot === "header-left").map((el) => (
            <div key={el.id}>{renderElement(el)}</div>
          ))}
        </div>
      </div>

      {/* ════ الفاصل ════ */}
      {entete.showDivider && (
        <hr style={{ borderTop: `${entete.dividerWidth || 2}px solid ${entete.dividerColor || "#0f766e"}`, margin: "0" }} />
      )}

      {/* ════ صف مرجعي: رقم + تاريخ + موسم ════ */}
      {(entete.showReferenceRow || showDate || showReportNumber || showSeason) && (
        <div
          className="flex items-center justify-between flex-wrap gap-2 text-[10pt] text-gray-700"
          style={{ padding: compact ? "4px 12px" : "6px 18px", fontFamily: "Cairo, Tahoma, Arial" }}
        >
          <div className="flex items-center gap-3 flex-wrap">
            {entete.showReferenceRow && showReportNumber && (
              <span className="font-bold flex items-center gap-1">
                <Hash className="h-3 w-3 text-primary" />
                {reportNumber || `${entete.referenceNumberText || "الرقم: . . ./ن.ر.ه.ر.س"} ${new Date().getFullYear()}`}
              </span>
            )}
            {showSeason && settings.sportSeason && (
              <span className="text-muted-foreground font-semibold">
                الموسم الرياضي: {settings.sportSeason}
              </span>
            )}
            {showSeason && !settings.sportSeason && (
              <span className="text-muted-foreground font-semibold">
                الموسم الرياضي: {currentSeason()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {showDate && (
              <span className="font-bold flex items-center gap-1">
                <Calendar className="h-3 w-3 text-primary" />
                {entete.dateLocationText || "في:"} {todayStr(date)}
              </span>
            )}
            {settings.wilaya && (
              <span className="text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {settings.wilaya}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ════ معلومات إضافية للنادي (اختياري) ════ */}
      {!compact && (settings.clubAddress || settings.clubPhone || settings.clubEmail) && (
        <div
          className="flex items-center justify-center gap-4 text-[9pt] text-gray-500 border-t border-border/30"
          style={{ padding: "4px 18px", fontFamily: "Cairo, Tahoma, Arial" }}
        >
          {settings.clubAddress && <span>{settings.clubAddress}</span>}
          {settings.clubPhone && <span dir="ltr">📞 {settings.clubPhone}</span>}
          {settings.clubEmail && <span dir="ltr">✉ {settings.clubEmail}</span>}
          {settings.clubWebsite && <span dir="ltr">🌐 {settings.clubWebsite}</span>}
        </div>
      )}
    </motion.div>
  );
}

/**
 * هيكل HTML للترويسة الموحدة — يُستخدم عند توليد ملفات Word/PDF/الطباعة.
 * يبني نفس البنية المرئية لكن كـ HTML خام قابل للنسخ في document.write.
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

  const renderElHTML = (el: EnteteElement): string => {
    if (el.type === "logo") {
      return `<img src="${el.src || "/images/rcs-logo-official.png"}" style="height:${Math.min(el.height || 70, 70)}px;width:${Math.min(el.width || 70, 70)}px;object-fit:contain;border-radius:${el.borderRadius || 0}px;" onerror="this.style.display='none'" />`;
    }
    return `<p style="font-family:'${el.fontFamily || "Cairo"}','Tahoma',Arial;font-size:${el.fontSize || 12}pt;font-weight:${el.fontWeight || "normal"};color:${el.color || "#111"};font-style:${el.italic ? "italic" : "normal"};text-decoration:${el.underline ? "underline" : "none"};margin:1px 0;line-height:1.3;">${el.content || ""}</p>`;
  };

  const rightEls = entete.elements.filter((e) => e.slot === "header-right").map(renderElHTML).join("");
  const centerEls = entete.elements.filter((e) => e.slot === "header-center").map(renderElHTML).join("");
  const leftEls = entete.elements.filter((e) => e.slot === "header-left").map(renderElHTML).join("");

  // استبدال ديناميكي من الإعدادات
  const centerHTML = centerEls
    .replace("النادي الهاوي متعدد الرياضات", settings.clubName || "النادي الهاوي متعدد الرياضات")
    .replace("الرائد - سعيدة", settings.branchName || "الرائد - سعيدة");

  const reportTypeHTML = opts.reportType
    ? `<p style="margin-top:4px;padding:2px 12px;border-radius:9999px;background:#0f766e15;color:#0f766e;font-size:12pt;font-weight:bold;border:1px solid #0f766e30;display:inline-block;">${opts.reportType}</p>`
    : "";
  const subtitleHTML = opts.reportSubtitle
    ? `<p style="font-size:10pt;color:#666;margin:2px 0 0;">${opts.reportSubtitle}</p>`
    : "";

  const dividerHTML = entete.showDivider
    ? `<hr style="border:none;border-top:${entete.dividerWidth || 2}px solid ${entete.dividerColor || "#0f766e"};margin:0;" />`
    : "";

  const refRowHTML = `
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:6px 18px;font-size:10pt;color:#444;font-family:'Cairo','Tahoma',Arial;">
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
        ${entete.showReferenceRow ? `<span style="font-weight:bold;">${opts.reportNumber || `${entete.referenceNumberText || "الرقم: . . ./ن.ر.ه.ر.س"} ${new Date().getFullYear()}`}</span>` : ""}
        <span style="color:#666;font-weight:600;">الموسم الرياضي: ${season}</span>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
        <span style="font-weight:bold;">${entete.dateLocationText || "في:"} ${dateStr}</span>
        ${settings.wilaya ? `<span style="color:#666;">${settings.wilaya}</span>` : ""}
      </div>
    </div>
  `;

  const contactRowHTML = (settings.clubAddress || settings.clubPhone || settings.clubEmail)
    ? `<div style="display:flex;justify-content:center;gap:16px;flex-wrap:wrap;padding:4px 18px;font-size:9pt;color:#777;border-top:1px solid #eee;font-family:'Cairo','Tahoma',Arial;">
        ${settings.clubAddress ? `<span>${settings.clubAddress}</span>` : ""}
        ${settings.clubPhone ? `<span dir="ltr">📞 ${settings.clubPhone}</span>` : ""}
        ${settings.clubEmail ? `<span dir="ltr">✉ ${settings.clubEmail}</span>` : ""}
        ${settings.clubWebsite ? `<span dir="ltr">🌐 ${settings.clubWebsite}</span>` : ""}
      </div>`
    : "";

  return `
    <div class="unified-report-header" style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;direction:rtl;" dir="rtl">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;align-items:center;padding:12px 18px;min-height:90px;">
        <div style="display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:4px;">${rightEls}</div>
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
          ${centerHTML}
          ${reportTypeHTML}
          ${subtitleHTML}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;justify-content:center;gap:4px;">${leftEls}</div>
      </div>
      ${dividerHTML}
      ${refRowHTML}
      ${contactRowHTML}
    </div>
  `;
}

"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Hash, Calendar, MapPin } from "lucide-react";
import {
  CLUB_FULL_NAME_ROLE,
  ENTETE_VERSION,
  UNIFIED_LOGO_SIZE,
  composeClubFullName,
} from "@/lib/entete-shared";

/**
 * UnifiedReportHeader — v2
 * ─────────────────────────────────────────────────────────────
 * مكوّن واحد موحّد للترويسة يُستخدم في جميع التقارير والمطبوعات والعقود.
 *
 * ★ بنية v2 (نظيفة بلا تكرار):
 *   [شعار ثابت]  الاسم الرسمي الكامل في سطر واحد  [شعار ثابت]
 *   ─────────────────────────────────────────────
 *   الرقم + الموسم الرياضي        التاريخ + المدينة
 *
 * • كل سطر عنصر مستقل قابل للتعديل من: الإعدادات → الترويسة الموحدة
 * • سطر الاسم يُولَّد آلياً من اسم النادي (role=clubFullName) ما لم يُكتب نص يدوي
 * • الشعار في صندوق ثابت الحجم (UNIFIED_LOGO_SIZE) — يحافظ على مكانه وحجمه
 *   عند التحميل ومن أي صفحة من الموقع (لا قفز، لا تغيير حجم)
 * • التحميل صامت: تُرسم البنية فوراً بالقيم الافتراضية ثم تُحدَّث دون أي إزاحة
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
  role?: string;
}

export interface EnteteConfig {
  elements: EnteteElement[];
  showDivider: boolean;
  dividerColor: string;
  dividerWidth: number;
  referenceNumberText: string;
  dateLocationText: string;
  showReferenceRow: boolean;
  version?: number;
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
    { id: "logo-right-default", label: "الشعار الأيمن", type: "logo", slot: "header-right", src: "/images/rcs-logo-official.png", width: UNIFIED_LOGO_SIZE, height: UNIFIED_LOGO_SIZE, borderRadius: 8 },
    { id: "club-full-name", label: "الاسم الرسمي للنادي (سطر واحد)", type: "text", slot: "header-center", role: CLUB_FULL_NAME_ROLE, content: "", fontFamily: "Cairo", fontSize: 13, fontWeight: "bold", color: "#0f766e" },
    { id: "logo-left-default", label: "الشعار الأيسر", type: "logo", slot: "header-left", src: "/images/rcs-logo-official.png", width: UNIFIED_LOGO_SIZE, height: UNIFIED_LOGO_SIZE, borderRadius: 8 },
  ],
  showDivider: true,
  dividerColor: "#0f766e",
  dividerWidth: 2,
  referenceNumberText: "الرقم: . . ./ن.ر.ه.ر.س",
  dateLocationText: "سعيدة في:",
  showReferenceRow: true,
  version: ENTETE_VERSION,
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

/**
 * ★ FitLine — يضمن بقاء النص في سطر واحد دائماً:
 * يقيس عرض المحتوى ويصغّره بتحويل متناسب إن تجاوز المساحة المتاحة
 * (بدون لفّ الأسطر وبدون قصّ) — فيبقى الاسم الرسمي كاملاً في سطر واحد.
 */
function FitLine({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const fit = () => {
      const box = boxRef.current;
      const inner = innerRef.current;
      if (!box || !inner) return;
      const avail = box.clientWidth;
      const need = inner.scrollWidth;
      setScale(avail > 0 && need > avail ? avail / need : 1);
    };
    fit();
    // إعادة القياس عند تغيّر حجم النافذة أو تحميل الخطوط
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    if (ro && boxRef.current) ro.observe(boxRef.current);
    if (typeof document !== "undefined" && (document as Document & { fonts?: FontFaceSet }).fonts) {
      (document as Document & { fonts: FontFaceSet }).fonts.ready.then(fit).catch(() => undefined);
    }
    return () => ro?.disconnect();
  }, [children]);

  return (
    <div ref={boxRef} className="w-full overflow-hidden" aria-label={typeof children === "string" ? children : undefined}>
      <span
        ref={innerRef}
        className="block whitespace-nowrap origin-center"
        style={{ ...style, transform: scale < 1 ? `scale(${scale})` : undefined }}
      >
        {children}
      </span>
    </div>
  );
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
  // ★ لا شاشة تحميل — تُرسم الترويسة فوراً بالافتراضي ثم تُحدَّث بصمت (بلا أي قفز)
  const [entete, setEntete] = useState<EnteteConfig>(DEFAULT_ENTETE);
  const [settings, setSettings] = useState<ClubSettings>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/entete").then((r) => r.json()).catch(() => ({ config: DEFAULT_ENTETE })),
      fetch("/api/settings").then((r) => r.json()).catch(() => ({ settings: {} })),
    ]).then(([enteteData, settingsData]) => {
      if (cancelled) return;
      if (enteteData?.config) setEntete({ ...DEFAULT_ENTETE, ...enteteData.config });
      if (settingsData?.settings) setSettings(settingsData.settings);
    });
    return () => { cancelled = true; };
  }, []);

  // نص السطر الأول: محتوى العنصر إن كُتب يدوياً، وإلا التوليد الآلي من الإعدادات
  const resolvedContent = (el: EnteteElement): string => {
    if (el.role === CLUB_FULL_NAME_ROLE) {
      const manual = (el.content || "").trim();
      return manual || composeClubFullName(settings);
    }
    return el.content || "";
  };

  const renderElement = (el: EnteteElement) => {
    if (el.type === "logo") {
      // ★ صندوق شعار ثابت الحجم في كل الصفحات — الصورة داخل الصندوق لا تحرّك شيئاً
      const size = Math.min(Math.max(el.width || UNIFIED_LOGO_SIZE, 36), UNIFIED_LOGO_SIZE);
      return (
        <div
          style={{
            width: `${size}px`,
            height: `${size}px`,
            flex: "0 0 auto",
          }}
        >
          <img
            src={el.src || "/images/rcs-logo-official.png"}
            alt={el.label}
            width={size}
            height={size}
            loading="eager"
            style={{
              width: "100%",
              height: "100%",
              borderRadius: `${el.borderRadius || 0}px`,
              objectFit: "contain",
              display: "block",
            }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.2"; }}
          />
        </div>
      );
    }
    const text = resolvedContent(el);
    return (
      <FitLine
        style={{
          fontFamily: `'${el.fontFamily || "Cairo"}', 'Tahoma', Arial`,
          fontSize: `${el.fontSize || 12}pt`,
          fontWeight: el.fontWeight || "normal",
          color: el.color || "#111",
          fontStyle: el.italic ? "italic" : "normal",
          textDecoration: el.underline ? "underline" : "none",
          lineHeight: 1.35,
        }}
      >
        {text}
      </FitLine>
    );
  };

  const rightEls = entete.elements.filter((e) => e.slot === "header-right");
  const centerEls = entete.elements.filter((e) => e.slot === "header-center");
  const leftEls = entete.elements.filter((e) => e.slot === "header-left");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="unified-report-header rounded-xl bg-white border border-border/60 shadow-sm overflow-hidden"
      dir="rtl"
    >
      {/* ════ الصف العلوي: شعار ثابت + الاسم الرسمي في سطر واحد + شعار ثابت ════ */}
      <div
        className="flex items-center gap-3"
        style={{ padding: compact ? "8px 12px" : "12px 18px", minHeight: compact ? 78 : 94 }}
      >
        {/* يمين (أول الصف في RTL) */}
        <div className="flex items-center gap-2 shrink-0">
          {rightEls.map((el) => (
            <div key={el.id}>{renderElement(el)}</div>
          ))}
        </div>
        {/* وسط — الاسم الرسمي الكامل في سطر واحد */}
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center gap-1 text-center">
          {centerEls.map((el) => (
            <div key={el.id} className="w-full max-w-full">
              {renderElement(el)}
            </div>
          ))}
          {reportType && (
            <p
              className="mt-0.5 px-3 py-0.5 rounded-full font-bold"
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
        {/* يسار (آخر الصف في RTL) */}
        <div className="flex items-center gap-2 shrink-0">
          {leftEls.map((el) => (
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
 * يبني نفس بنية v2: شعاران ثابتان + الاسم الرسمي الكامل في سطر واحد (nowrap).
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

  const resolved = (el: EnteteElement): string => {
    if (el.role === CLUB_FULL_NAME_ROLE) {
      const manual = (el.content || "").trim();
      return manual || composeClubFullName(settings);
    }
    return el.content || "";
  };

  const escapeHtmlText = (s: string): string =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const renderElHTML = (el: EnteteElement): string => {
    if (el.type === "logo") {
      // ★ صندوق ثابت — نفس الحجم في كل المستندات
      const size = Math.min(Math.max(el.width || UNIFIED_LOGO_SIZE, 36), UNIFIED_LOGO_SIZE);
      return `<div style="width:${size}px;height:${size}px;flex:0 0 auto;"><img src="${el.src || "/images/rcs-logo-official.png"}" width="${size}" height="${size}" style="width:100%;height:100%;object-fit:contain;border-radius:${el.borderRadius || 0}px;display:block;" onerror="this.style.opacity=0.2" /></div>`;
    }
    const text = escapeHtmlText(resolved(el));
    return `<div style="width:100%;overflow:hidden;"><span style="display:block;white-space:nowrap;font-family:'${el.fontFamily || "Cairo"}','Tahoma',Arial;font-size:${el.fontSize || 12}pt;font-weight:${el.fontWeight || "normal"};color:${el.color || "#111"};font-style:${el.italic ? "italic" : "normal"};text-decoration:${el.underline ? "underline" : "none"};line-height:1.35;">${text}</span></div>`;
  };

  const rightEls = entete.elements.filter((e) => e.slot === "header-right").map(renderElHTML).join("");
  const centerEls = entete.elements.filter((e) => e.slot === "header-center").map(renderElHTML).join("");
  const leftEls = entete.elements.filter((e) => e.slot === "header-left").map(renderElHTML).join("");

  const reportTypeHTML = opts.reportType
    ? `<p style="margin:2px 0 0;padding:2px 12px;border-radius:9999px;background:#0f766e15;color:#0f766e;font-size:12pt;font-weight:bold;border:1px solid #0f766e30;display:inline-block;">${opts.reportType}</p>`
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
      <div style="display:flex;align-items:center;gap:12px;padding:12px 18px;min-height:94px;">
        <div style="display:flex;align-items:center;gap:8px;flex:0 0 auto;">${rightEls}</div>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
          ${centerEls}
          ${reportTypeHTML}
          ${subtitleHTML}
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex:0 0 auto;">${leftEls}</div>
      </div>
      ${dividerHTML}
      ${refRowHTML}
      ${contactRowHTML}
    </div>
  `;
}

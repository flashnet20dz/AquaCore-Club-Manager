"use client";

/**
 * AquaCore — Card Designer Pro (v3 — Structured Print Edition)
 * ─────────────────────────────────────────────────────────────────────────────
 *  صفحة بطاقات الانخراط المهيكلة — مطابقة لتصميم PDF نادي RCS.
 *
 *  الميزات:
 *   - واجهة أمامية للبطاقة: ترويسة + عنوان + شريط (صورة + بيانات + فصيلة دم + QR) + تذييل
 *   - واجهة خلفية للبطاقة: عنوان + معلومات الاشتراك (أيام + توقيت + ت.ن.إ) + شعار مائي + تذييل
 *   - طباعة Recto/Verso (أمامي + خلفي) أو أمامي فقط أو خلفي فقط
 *   - 8 بطاقات في صفحة A4 (4 صفوف × عمودان)
 *   - لوحة إعدادات شاملة: نصوص + ألوان + خطوط + محاذاة + مواضع + أحجام + تبديلات
 *   - معاينة مباشرة للواجهتين
 *   - حفظ/تحميل الإعدادات من /api/settings/card-design
 *   - اختيار المنخرطين + بحث + تحديد متعدد
 *
 *  يستقبل subscribers من الصفحة الأم (مثل الإصدار السابق).
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import {
  CreditCard, Search, Printer, Check, Settings, Upload, Image as ImageIcon,
  MoveRight, MoveLeft, LayoutGrid, RotateCcw, Save,
  AlignRight, AlignCenter, AlignLeft,
  Eye, ArrowRight, FlipHorizontal, FileText, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import type { SubscriberWithComputed } from "@/lib/rcs";
import { formatDateYMD } from "@/lib/contract-variables";

// ══════════════════════════════ الأنواع ══════════════════════════════

type Align = "right" | "center" | "left";
type PhotoPos = "right" | "left" | "top";
type QRPos = "right" | "left" | "top" | "bottom";
type PrintMode = "both" | "front" | "back";
type QRContent = "memberId" | "name" | "full";

interface CardDesignSettings {
  // نصوص أمامية
  headerText: string;
  subHeaderText: string;
  footerText: string;
  cardTitle: string;
  // نصوص خلفية
  backTitle: string;
  backInfoTitle: string;
  backDaysLabel: string;
  backTimeLabel: string;
  backExpiryLabel: string;
  // الألوان
  accentColor: string;
  subAccentColor: string;
  bloodColor: string;
  backAccentColor: string;
  // الشعار
  logoImage: string;
  watermarkLogo: boolean;
  cornerLogo: boolean;
  logoSize: number;
  // الخلفية
  backgroundImage: string;
  showBackgroundImage: boolean;
  // الخطوط
  fontFamily: string;
  fontSize: number;
  headerFontSize: number;
  titleFontSize: number;
  fieldFontSize: number;
  footerFontSize: number;
  bloodFontSize: number;
  // المحاذاة
  headerAlign: Align;
  titleAlign: Align;
  footerAlign: Align;
  fieldAlign: Align;
  // التخطيط
  showBorders: boolean;
  contentPadding: number;
  photoSize: number;
  qrSize: number;
  photoPosition: PhotoPos;
  qrPosition: QRPos;
  stripHeight: number;
  showTitleUnderline: boolean;
  // تبديلات أمامية
  showStrip: boolean;
  showMemberId: boolean;
  showBloodType: boolean;
  showName: boolean;
  showDateOfBirth: boolean;
  showPhoto: boolean;
  showQR: boolean;
  // تبديلات خلفية
  showBackTitle: boolean;
  showBackDays: boolean;
  showBackTime: boolean;
  showBackExpiry: boolean;
  showBackWatermark: boolean;
  // محتوى QR
  qrContent: QRContent;
}

interface CardDesignerProProps {
  subscribers: SubscriberWithComputed[];
  onBack?: () => void;
}

// ══════════════════════════════ الثوابت ══════════════════════════════

// أبعاد البطاقة: 8 بطاقات في A4 (4 صفوف × عمودان، فجوة 3مم، هامش 10مم)
const CARD_W = 93.5; // مم
const CARD_H = 67;   // مم
const CARD_GAP = 3;  // مم
const PAGE_MARGIN = 10; // مم

const defaultCardSettings: CardDesignSettings = {
  headerText: "النادي الرياضي المتعدد الرياضات الرائد - سعيدة",
  subHeaderText: "*- فرع السباحة *-",
  footerText: "يُمنع الدخول إلى المسبح دون تقديم بطاقة الانخراط.",
  cardTitle: "بطاقة الانخراط",
  backTitle: "بطاقة الانخراط",
  backInfoTitle: "معلومات الاشتراك",
  backDaysLabel: "أيام السباحة",
  backTimeLabel: "التوقيت",
  backExpiryLabel: "ت.ن.إ",
  accentColor: "#1E3A8A",
  subAccentColor: "#D4A017",
  bloodColor: "#C62828",
  backAccentColor: "#C62828",
  logoImage: "",
  watermarkLogo: false,
  cornerLogo: false,
  logoSize: 30,
  backgroundImage: "",
  showBackgroundImage: false,
  fontFamily: "Cairo, Tajawal, Tahoma, Arial, sans-serif",
  fontSize: 1.0,
  headerFontSize: 10,
  titleFontSize: 11,
  fieldFontSize: 9,
  footerFontSize: 7,
  bloodFontSize: 18,
  headerAlign: "right",
  titleAlign: "center",
  footerAlign: "center",
  fieldAlign: "right",
  showBorders: true,
  contentPadding: 2,
  photoSize: 20,
  qrSize: 16,
  photoPosition: "left",
  qrPosition: "bottom",
  stripHeight: 30,
  showTitleUnderline: true,
  showStrip: true,
  showMemberId: true,
  showBloodType: true,
  showName: true,
  showDateOfBirth: true,
  showPhoto: true,
  showQR: true,
  showBackTitle: true,
  showBackDays: true,
  showBackTime: true,
  showBackExpiry: true,
  showBackWatermark: true,
  qrContent: "memberId",
};

const FONT_OPTIONS = [
  { value: "Cairo, Tajawal, Tahoma, Arial, sans-serif", label: "Cairo (موصى به)" },
  { value: "Tajawal, Tahoma, Arial, sans-serif", label: "Tajawal" },
  { value: "Tahoma, Arial, sans-serif", label: "Tahoma" },
  { value: "Arial, sans-serif", label: "Arial" },
];

const ALIGN_OPTIONS: { value: Align; label: string }[] = [
  { value: "right", label: "يمين" },
  { value: "center", label: "وسط" },
  { value: "left", label: "يسار" },
];

// ══════════════════════════════ Helpers ══════════════════════════════

function getPhotoUrl(sub: SubscriberWithComputed): string {
  const photoPath = (sub as unknown as { photoPath?: string | null }).photoPath;
  return photoPath ? `/api/subscribers/${sub.id}/photo?size=thumbnail&raw=1` : "";
}

function getMemberId(sub: SubscriberWithComputed): string {
  return sub.fileNumber || "";
}

function getBloodType(sub: SubscriberWithComputed): string {
  return sub.bloodType || "—";
}

function getFullName(sub: SubscriberWithComputed): string {
  return `${sub.lastName} ${sub.firstName}`;
}

function getQRText(sub: SubscriberWithComputed, mode: QRContent): string {
  if (mode === "memberId") return getMemberId(sub);
  if (mode === "name") return getFullName(sub);
  return JSON.stringify({
    id: getMemberId(sub),
    name: getFullName(sub),
    blood: sub.bloodType || "",
    exp: sub.expiryDate ? formatDateYMD(sub.expiryDate) : "",
  });
}

function alignStyle(a: Align): React.CSSProperties {
  return { textAlign: a === "right" ? "right" : a === "left" ? "left" : "center" };
}

function AlignIcon({ value }: { value: Align }) {
  if (value === "right") return <AlignRight className="w-3.5 h-3.5" />;
  if (value === "left") return <AlignLeft className="w-3.5 h-3.5" />;
  return <AlignCenter className="w-3.5 h-3.5" />;
}

// ══════════════════════════════ المكوّن الرئيسي ══════════════════════════════

export function CardDesignerPro({ subscribers, onBack }: CardDesignerProProps) {
  const [settings, setSettings] = useState<CardDesignSettings>(defaultCardSettings);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [showDesignSettings, setShowDesignSettings] = useState(true);
  const [printMode, setPrintMode] = useState<PrintMode>("both");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [hasSavedSettings, setHasSavedSettings] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof CardDesignSettings>(key: K, value: CardDesignSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  // ── تحميل الإعدادات المحفوظة من الخادم ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings/card-design");
        if (res.ok) {
          const data = await res.json();
          if (!data.isDefault && data.headerText !== undefined) {
            if (!cancelled) {
              setSettings({ ...defaultCardSettings, ...data });
              setHasSavedSettings(true);
            }
          }
        }
      } catch (e) {
        console.error("Error loading card design settings:", e);
      } finally {
        if (!cancelled) setIsLoadingSettings(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── حفظ الإعدادات ──
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings/card-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      if (!res.ok) throw new Error("فشل الحفظ");
      setHasSavedSettings(true);
      toast.success("تم حفظ إعدادات تصميم البطاقة كافتراضية");
    } catch (err) {
      console.error(err);
      toast.error("فشل حفظ الإعدادات");
    } finally {
      setIsSaving(false);
    }
  };

  // ── إعادة التعيين ──
  const handleResetSettings = async () => {
    if (!confirm("هل أنت متأكد من إعادة التعيين للوضع الافتراضي؟")) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings/card-design", { method: "DELETE" });
      if (!res.ok) throw new Error("فشل إعادة التعيين");
      setSettings(defaultCardSettings);
      setHasSavedSettings(false);
      toast.success("تمت إعادة التعيين للوضع الافتراضي");
    } catch (err) {
      console.error(err);
      toast.error("فشل إعادة التعيين");
    } finally {
      setIsSaving(false);
    }
  };

  // ── رفع الشعار ──
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set("logoImage", reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      set("backgroundImage", reader.result as string);
      set("showBackgroundImage", true);
    };
    reader.readAsDataURL(file);
  };

  // ── فلترة المنخرطين ──
  const filteredSubs = useMemo(() => {
    if (!searchTerm.trim()) return subscribers;
    const t = searchTerm.toLowerCase();
    return subscribers.filter((s) =>
      `${s.lastName} ${s.firstName}`.toLowerCase().includes(t) ||
      s.fileNumber.toLowerCase().includes(t) ||
      (s.bloodType || "").toLowerCase().includes(t)
    );
  }, [subscribers, searchTerm]);

  const selectedSubs = useMemo(
    () => subscribers.filter((s) => selectedIds.has(s.id)),
    [subscribers, selectedIds]
  );

  const toggleSub = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredSubs.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredSubs.map((s) => s.id)));
  };

  // ── الطباعة ──
  const handlePrint = () => {
    if (selectedSubs.length === 0) {
      toast.error("يرجى اختيار منخرط واحد على الأقل");
      return;
    }
    setShowPreview(true);
    setTimeout(() => window.print(), 600);
  };

  // تقسيم المنخرطين إلى صفحات من 8
  const pages = useMemo(() => {
    const result: SubscriberWithComputed[][] = [];
    for (let i = 0; i < selectedSubs.length; i += 8) {
      result.push(selectedSubs.slice(i, i + 8));
    }
    return result.length > 0 ? result : [[]];
  }, [selectedSubs]);

  // ══════════════════════════════ رسم البطاقة ══════════════════════════════

  const renderFrontCard = useCallback((sub: SubscriberWithComputed, key?: string) => {
    const s = settings;
    const fs = s.fontSize;
    const pad = s.contentPadding;

    const photoUrl = getPhotoUrl(sub);
    const photoBlock = s.showPhoto && (
      <div
        className="overflow-hidden flex items-center justify-center bg-gray-100 shrink-0"
        style={{
          width: `${s.photoSize * fs}mm`,
          height: `${s.photoSize * 1.25 * fs}mm`,
          border: `2px solid ${s.accentColor}`,
        }}
      >
        {photoUrl ? (
          <img src={photoUrl} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
        ) : (
          <span className="font-semibold text-gray-400" style={{ fontSize: `${8 * fs}px` }}>
            صورة
          </span>
        )}
      </div>
    );

    const qrText = getQRText(sub, s.qrContent);
    const qrBlock = s.showQR && (
      <div className="flex flex-col items-center justify-center shrink-0 bg-white p-0.5">
        <QRCodeSVG
          value={qrText || " "}
          size={Math.round(s.qrSize * fs * 3.78)}
          level="M"
          marginSize={0}
        />
      </div>
    );

    const stripInfo = (
      <div className="flex flex-col justify-center gap-1 flex-1 min-w-0">
        {s.showMemberId && (
          <div className="flex items-baseline" style={{ justifyContent: "flex-end" }}>
            <span className="font-bold whitespace-nowrap" style={{ fontSize: `${s.fieldFontSize * fs}px` }}>
              رقم العضوية:&nbsp;
            </span>
            <span className="font-bold" style={{ fontSize: `${s.fieldFontSize * fs}px`, color: s.accentColor }}>
              {getMemberId(sub)}
            </span>
          </div>
        )}
        {s.showName && (
          <div className="flex items-baseline" style={{ justifyContent: "flex-end" }}>
            <span className="font-bold whitespace-nowrap" style={{ fontSize: `${(s.fieldFontSize + 1) * fs}px` }}>
              {getFullName(sub)}
            </span>
          </div>
        )}
        {s.showDateOfBirth && (
          <div className="flex items-baseline" style={{ justifyContent: "flex-end" }}>
            <span className="font-bold whitespace-nowrap" style={{ fontSize: `${s.fieldFontSize * fs}px` }}>
              الميلاد:&nbsp;
            </span>
            <span className="font-semibold" style={{ fontSize: `${s.fieldFontSize * fs}px` }}>
              {formatDateYMD(sub.birthDate)}
            </span>
          </div>
        )}
      </div>
    );

    const bloodBlock = s.showBloodType && (
      <div className="flex items-center justify-center shrink-0">
        <span
          className="font-extrabold leading-none"
          style={{ fontSize: `${s.bloodFontSize * fs}px`, color: s.bloodColor }}
        >
          {getBloodType(sub)}
        </span>
      </div>
    );

    // تخطيط الشريط حسب مواضع الصورة و QR
    let stripChildren: React.ReactNode;
    if (s.qrPosition === "top" || s.qrPosition === "bottom") {
      const qrRow = <div className="flex items-center justify-center w-full">{qrBlock}</div>;
      const photoInfoRow = (
        <div className="flex items-center gap-2 w-full flex-1 min-h-0">
          {s.photoPosition === "left" ? <>{photoBlock}{stripInfo}{bloodBlock}</> : <>{bloodBlock}{stripInfo}{photoBlock}</>}
        </div>
      );
      stripChildren = (
        <div className="flex flex-col items-center gap-1 h-full">
          {s.qrPosition === "top" ? <>{qrRow}{photoInfoRow}</> : <>{photoInfoRow}{qrRow}</>}
        </div>
      );
    } else if (s.photoPosition === "top") {
      stripChildren = (
        <div className="flex flex-col items-center gap-1 h-full">
          {photoBlock}
          <div className="flex items-center gap-2 w-full justify-center flex-1 min-h-0">
            {s.qrPosition === "left" ? <>{qrBlock}{stripInfo}{bloodBlock}</> : <>{bloodBlock}{stripInfo}{qrBlock}</>}
          </div>
        </div>
      );
    } else {
      const photoFirst = s.photoPosition === "left";
      stripChildren = (
        <div className="flex items-center gap-2 h-full">
          {photoFirst ? (
            <>{photoBlock}{stripInfo}{bloodBlock}{qrBlock}</>
          ) : (
            <>{qrBlock}{bloodBlock}{stripInfo}{photoBlock}</>
          )}
        </div>
      );
    }

    const renderStrip = () => {
      if (!s.showStrip) return null;
      return (
        <div className="shrink-0 overflow-hidden" style={{ height: `${s.stripHeight * fs}mm` }}>
          {stripChildren}
        </div>
      );
    };

    return (
      <div
        key={key}
        className="member-card bg-white relative overflow-hidden flex flex-col"
        style={{
          width: `${CARD_W}mm`,
          height: `${CARD_H}mm`,
          border: s.showBorders ? "2px solid #000" : "1px dashed #ccc",
          direction: "rtl",
          fontFamily: s.fontFamily,
        }}
      >
        {s.watermarkLogo && s.logoImage && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 0 }}>
            <img src={s.logoImage} alt="" className="object-contain" style={{ width: `${s.logoSize * 2}mm`, height: `${s.logoSize * 2}mm`, opacity: 0.1 }} />
          </div>
        )}
        {s.showBackgroundImage && s.backgroundImage && (
          <div className="absolute inset-0 bg-cover bg-center pointer-events-none" style={{ backgroundImage: `url(${s.backgroundImage})`, opacity: 0.08, zIndex: 0 }} />
        )}
        <div className="relative flex flex-col h-full" style={{ zIndex: 1, padding: `${pad}mm` }}>
          {/* الترويسة */}
          <div className="shrink-0" style={alignStyle(s.headerAlign)}>
            <p className="font-bold leading-tight" style={{ fontSize: `${s.headerFontSize * fs}px`, color: s.accentColor }}>
              {s.headerText}
            </p>
            <p className="font-semibold leading-tight" style={{ fontSize: `${(s.headerFontSize - 1) * fs}px`, color: s.subAccentColor, marginTop: "1px" }}>
              {s.subHeaderText}
            </p>
          </div>
          {/* العنوان */}
          <div className="shrink-0 mt-1 mb-1" style={alignStyle(s.titleAlign)}>
            <span
              className="font-bold inline-block px-3 py-0.5"
              style={{
                fontSize: `${s.titleFontSize * fs}px`,
                color: s.accentColor,
                borderBottom: s.showTitleUnderline ? `2px solid ${s.accentColor}` : "none",
              }}
            >
              {s.cardTitle}
            </span>
          </div>
          {/* الشريط */}
          {renderStrip()}
          {/* التذييل */}
          <div className="shrink-0 mt-auto" style={alignStyle(s.footerAlign)}>
            <p className="italic" style={{ fontSize: `${s.footerFontSize * fs}px`, color: "#555" }}>
              {s.footerText}
            </p>
          </div>
          {/* شعار الزاوية */}
          {s.cornerLogo && s.logoImage && (
            <div className="absolute flex flex-col items-center pointer-events-none" style={{ bottom: "1mm", left: "1mm", zIndex: 2 }}>
              <img src={s.logoImage} alt="Logo" className="object-contain" style={{ width: `${s.logoSize * 0.4}mm`, height: `${s.logoSize * 0.4}mm` }} />
            </div>
          )}
        </div>
      </div>
    );
  }, [settings]);

  const renderBackCard = useCallback((sub: SubscriberWithComputed, key?: string) => {
    const s = settings;
    const fs = s.fontSize;
    const pad = s.contentPadding;

    return (
      <div
        key={key}
        className="member-card bg-white relative overflow-hidden flex flex-col"
        style={{
          width: `${CARD_W}mm`,
          height: `${CARD_H}mm`,
          border: s.showBorders ? "2px solid #000" : "1px dashed #ccc",
          direction: "rtl",
          fontFamily: s.fontFamily,
        }}
      >
        {s.showBackWatermark && s.logoImage && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 0 }}>
            <img src={s.logoImage} alt="" className="object-contain" style={{ width: `${s.logoSize * 2.4}mm`, height: `${s.logoSize * 2.4}mm`, opacity: 0.12 }} />
          </div>
        )}
        <div className="relative flex flex-col h-full" style={{ zIndex: 1, padding: `${pad + 1}mm` }}>
          {s.showBackTitle && (
            <div className="shrink-0 mb-2" style={alignStyle(s.titleAlign)}>
              <span
                className="font-bold inline-block px-3 py-0.5"
                style={{
                  fontSize: `${s.titleFontSize * fs}px`,
                  color: s.accentColor,
                  borderBottom: s.showTitleUnderline ? `2px solid ${s.accentColor}` : "none",
                }}
              >
                {s.backTitle}
              </span>
            </div>
          )}
          <div className="flex-1 flex flex-col justify-center gap-2">
            <div className="font-bold mb-1" style={{ fontSize: `${(s.fieldFontSize + 1) * fs}px`, color: s.accentColor, textAlign: "right" }}>
              {s.backInfoTitle}
            </div>
            {s.showBackDays && (
              <div className="flex items-baseline" style={{ justifyContent: "flex-end" }}>
                <span className="font-bold whitespace-nowrap" style={{ fontSize: `${s.fieldFontSize * fs}px` }}>
                  {s.backDaysLabel}:&nbsp;
                </span>
                <span className="font-semibold" style={{ fontSize: `${s.fieldFontSize * fs}px`, color: s.backAccentColor }}>
                  {sub.swimmingDays || "—"}
                </span>
              </div>
            )}
            {s.showBackTime && (
              <div className="flex items-baseline" style={{ justifyContent: "flex-end" }}>
                <span className="font-bold whitespace-nowrap" style={{ fontSize: `${s.fieldFontSize * fs}px` }}>
                  {s.backTimeLabel}:&nbsp;
                </span>
                <span className="font-semibold" style={{ fontSize: `${s.fieldFontSize * fs}px`, color: s.backAccentColor }}>
                  {sub.timeSlot || "—"}
                </span>
              </div>
            )}
            {s.showBackExpiry && (
              <div className="flex items-baseline" style={{ justifyContent: "flex-end" }}>
                <span className="font-bold whitespace-nowrap" style={{ fontSize: `${s.fieldFontSize * fs}px` }}>
                  {s.backExpiryLabel}:&nbsp;
                </span>
                <span className="font-semibold" style={{ fontSize: `${s.fieldFontSize * fs}px`, color: s.backAccentColor }}>
                  {sub.expiryDate ? formatDateYMD(sub.expiryDate) : "—"}
                </span>
              </div>
            )}
          </div>
          <div className="shrink-0 mt-auto" style={alignStyle(s.footerAlign)}>
            <p className="italic" style={{ fontSize: `${s.footerFontSize * fs}px`, color: "#555" }}>
              {s.footerText}
            </p>
          </div>
        </div>
      </div>
    );
  }, [settings]);

  // ══════════════════════════════ لوحة الإعدادات ══════════════════════════════

  const AlignPicker = ({ label, value, onChange }: { label: string; value: Align; onChange: (v: Align) => void }) => (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-[#1E3A8A]">{label}</Label>
      <div className="flex gap-1">
        {ALIGN_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            variant={value === opt.value ? "default" : "outline"}
            size="sm"
            className={`h-8 w-10 p-0 ${value === opt.value ? "bg-[#1E3A8A] hover:bg-[#1E3A8A]/90" : "border-[#1E3A8A]/20"}`}
            onClick={() => onChange(opt.value)}
            title={opt.label}
          >
            <AlignIcon value={opt.value} />
          </Button>
        ))}
      </div>
    </div>
  );

  const renderSettings = () => (
    <Card className="border-[#D4A017]/30 bg-gradient-to-l from-[#D4A017]/5 to-transparent">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-bold text-[#1E3A8A] flex items-center gap-2">
            <Settings className="w-4 h-4" />
            إعدادات تصميم البطاقة
            {hasSavedSettings && (
              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">✓ محفوظ</span>
            )}
          </h3>
          <div className="flex gap-1.5">
            <Button variant="default" size="sm" className="text-xs bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white" onClick={handleSaveSettings} disabled={isSaving}>
              <Save className="w-3 h-3 ml-1" /> {isSaving ? "جاري الحفظ..." : "حفظ"}
            </Button>
            <Button variant="ghost" size="sm" className="text-xs text-red-600 hover:bg-red-50" onClick={handleResetSettings} disabled={isSaving}>
              <RotateCcw className="w-3 h-3 ml-1" /> إعادة الضبط
            </Button>
          </div>
        </div>

        {isLoadingSettings && (
          <div className="text-xs text-muted-foreground bg-blue-50 p-2 rounded">جاري تحميل الإعدادات المحفوظة...</div>
        )}

        {/* النصوص */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-[#1E3A8A]">نص الترويسة</Label>
            <Input value={settings.headerText} onChange={(e) => set("headerText", e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-[#1E3A8A]">العنوان الفرعي</Label>
            <Input value={settings.subHeaderText} onChange={(e) => set("subHeaderText", e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-[#1E3A8A]">عنوان البطاقة (أمامي)</Label>
            <Input value={settings.cardTitle} onChange={(e) => set("cardTitle", e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-[#1E3A8A]">عنوان البطاقة (خلفي)</Label>
            <Input value={settings.backTitle} onChange={(e) => set("backTitle", e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-[#1E3A8A]">نص التذييل</Label>
            <Input value={settings.footerText} onChange={(e) => set("footerText", e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-[#1E3A8A]">عنوان معلومات الاشتراك (خلفي)</Label>
            <Input value={settings.backInfoTitle} onChange={(e) => set("backInfoTitle", e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-[#1E3A8A]">الخط العربي</Label>
            <select
              value={settings.fontFamily}
              onChange={(e) => set("fontFamily", e.target.value)}
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              {FONT_OPTIONS.map((f) => (<option key={f.value} value={f.value}>{f.label}</option>))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#1E3A8A]">لون التمييز</Label>
              <div className="flex gap-2 items-center h-8">
                <input type="color" value={settings.accentColor} onChange={(e) => set("accentColor", e.target.value)} className="w-10 h-7 cursor-pointer rounded border" />
                <span className="text-xs">{settings.accentColor}</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#1E3A8A]">لون العنوان الفرعي</Label>
              <div className="flex gap-2 items-center h-8">
                <input type="color" value={settings.subAccentColor} onChange={(e) => set("subAccentColor", e.target.value)} className="w-10 h-7 cursor-pointer rounded border" />
                <span className="text-xs">{settings.subAccentColor}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#1E3A8A]">لون فصيلة الدم</Label>
              <div className="flex gap-2 items-center h-8">
                <input type="color" value={settings.bloodColor} onChange={(e) => set("bloodColor", e.target.value)} className="w-10 h-7 cursor-pointer rounded border" />
                <span className="text-xs">{settings.bloodColor}</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#1E3A8A]">لون قيم الخلف</Label>
              <div className="flex gap-2 items-center h-8">
                <input type="color" value={settings.backAccentColor} onChange={(e) => set("backAccentColor", e.target.value)} className="w-10 h-7 cursor-pointer rounded border" />
                <span className="text-xs">{settings.backAccentColor}</span>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* أحجام الخطوط */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {([
            ["fontSize", "حجم الكتابة العام", 0.6, 1.6, 0.05],
            ["headerFontSize", "حجم الترويسة", 7, 16, 1],
            ["titleFontSize", "حجم العنوان", 8, 16, 1],
            ["fieldFontSize", "حجم الحقول", 7, 14, 1],
            ["footerFontSize", "حجم التذييل", 5, 12, 1],
            ["bloodFontSize", "حجم فصيلة الدم", 12, 28, 1],
          ] as const).map(([key, label, min, max, step]) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs font-semibold text-[#1E3A8A]">{label}: {settings[key]}</Label>
              <Slider
                value={[settings[key] as number]}
                onValueChange={([v]) => set(key, v as never)}
                min={min as number}
                max={max as number}
                step={step as number}
                className="w-full"
              />
            </div>
          ))}
        </div>

        <Separator />

        {/* المحاذاة */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <AlignPicker label="محاذاة الترويسة" value={settings.headerAlign} onChange={(v) => set("headerAlign", v)} />
          <AlignPicker label="محاذاة العنوان" value={settings.titleAlign} onChange={(v) => set("titleAlign", v)} />
          <AlignPicker label="محاذاة التذييل" value={settings.footerAlign} onChange={(v) => set("footerAlign", v)} />
          <AlignPicker label="محاذاة الحقول" value={settings.fieldAlign} onChange={(v) => set("fieldAlign", v)} />
        </div>

        <Separator />

        {/* المواضع */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-[#1E3A8A]">موضع الصورة</Label>
            <div className="flex gap-1">
              {(["left", "right", "top"] as PhotoPos[]).map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant={settings.photoPosition === p ? "default" : "outline"}
                  size="sm"
                  className={`h-8 flex-1 text-xs ${settings.photoPosition === p ? "bg-[#1E3A8A] hover:bg-[#1E3A8A]/90" : "border-[#1E3A8A]/20"}`}
                  onClick={() => set("photoPosition", p)}
                >
                  {p === "left" ? <><MoveLeft className="w-3.5 h-3.5 ml-1" /> يسار</> : p === "right" ? <><MoveRight className="w-3.5 h-3.5 ml-1" /> يمين</> : <><LayoutGrid className="w-3.5 h-3.5 ml-1" /> أعلى</>}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-[#1E3A8A]">موضع رمز QR</Label>
            <div className="flex gap-1 flex-wrap">
              {(["top", "right", "left", "bottom"] as QRPos[]).map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant={settings.qrPosition === p ? "default" : "outline"}
                  size="sm"
                  className={`h-8 flex-1 text-xs min-w-[55px] ${settings.qrPosition === p ? "bg-[#1E3A8A] hover:bg-[#1E3A8A]/90" : "border-[#1E3A8A]/20"}`}
                  onClick={() => set("qrPosition", p)}
                >
                  {p === "top" ? "أعلى" : p === "bottom" ? "أسفل" : p === "right" ? "يمين" : "يسار"}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* الأحجام والمسافات */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {([
            ["photoSize", "حجم الصورة (مم)", 14, 28, 1],
            ["qrSize", "حجم QR (مم)", 10, 24, 1],
            ["stripHeight", "ارتفاع النطاق (مم)", 20, 40, 1],
            ["contentPadding", "هامش المحتوى (مم)", 1, 6, 1],
            ["logoSize", "حجم الشعار (%)", 10, 80, 5],
          ] as const).map(([key, label, min, max, step]) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs font-semibold text-[#1E3A8A]">{label}: {settings[key]}</Label>
              <Slider
                value={[settings[key] as number]}
                onValueChange={([v]) => set(key, v as never)}
                min={min as number}
                max={max as number}
                step={step as number}
                className="w-full"
              />
            </div>
          ))}
        </div>

        <Separator />

        {/* محتوى QR */}
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-[#1E3A8A]">محتوى رمز QR</Label>
          <div className="flex gap-1">
            {([
              { v: "memberId", l: "رقم العضوية" },
              { v: "name", l: "الاسم" },
              { v: "full", l: "بيانات كاملة" },
            ] as const).map((opt) => (
              <Button
                key={opt.v}
                type="button"
                variant={settings.qrContent === opt.v ? "default" : "outline"}
                size="sm"
                className={`h-8 flex-1 text-xs ${settings.qrContent === opt.v ? "bg-[#1E3A8A] hover:bg-[#1E3A8A]/90" : "border-[#1E3A8A]/20"}`}
                onClick={() => set("qrContent", opt.v)}
              >
                {opt.l}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* الشعار والخلفية */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-semibold text-[#1E3A8A] flex items-center gap-2 text-sm">
              <Upload className="w-4 h-4" /> الشعار
            </h4>
            <div className="flex gap-2 items-center flex-wrap">
              <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
                <Upload className="w-4 h-4 ml-1" /> تحميل
              </Button>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              {settings.logoImage && (
                <img src={settings.logoImage} alt="Logo" className="w-10 h-10 object-contain" />
              )}
              {settings.logoImage && (
                <Button variant="ghost" size="sm" onClick={() => set("logoImage", "")}>إزالة</Button>
              )}
            </div>
            {settings.logoImage && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Checkbox id="watermark-logo" checked={settings.watermarkLogo} onCheckedChange={(c) => set("watermarkLogo", !!c)} />
                  <Label htmlFor="watermark-logo" className="text-xs cursor-pointer">شعار مائي في الوسط (أمامي)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="corner-logo" checked={settings.cornerLogo} onCheckedChange={(c) => set("cornerLogo", !!c)} />
                  <Label htmlFor="corner-logo" className="text-xs cursor-pointer">شعار صغير في الزاوية</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="back-watermark" checked={settings.showBackWatermark} onCheckedChange={(c) => set("showBackWatermark", !!c)} />
                  <Label htmlFor="back-watermark" className="text-xs cursor-pointer">شعار مائي في الخلف</Label>
                </div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-[#1E3A8A] flex items-center gap-2 text-sm">
              <ImageIcon className="w-4 h-4" /> صورة الخلفية
            </h4>
            <div className="flex gap-2 items-center flex-wrap">
              <Button variant="outline" size="sm" onClick={() => bgInputRef.current?.click()}>
                <Upload className="w-4 h-4 ml-1" /> تحميل
              </Button>
              <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
              {settings.backgroundImage && (
                <img src={settings.backgroundImage} alt="BG" className="w-16 h-10 object-cover rounded" />
              )}
              {settings.backgroundImage && (
                <Button variant="ghost" size="sm" onClick={() => { set("backgroundImage", ""); set("showBackgroundImage", false); }}>إزالة</Button>
              )}
            </div>
            {settings.backgroundImage && (
              <div className="flex items-center gap-2">
                <Checkbox checked={settings.showBackgroundImage} onCheckedChange={(c) => set("showBackgroundImage", !!c)} />
                <Label className="text-xs cursor-pointer">إظهار صورة الخلفية</Label>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* تبديلات الحقول */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold text-[#1E3A8A] mb-2 text-sm">الواجهة الأمامية</h4>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                { key: "showStrip" as const, label: "إظهار النطاق (صورة + بيانات + QR)" },
                { key: "showTitleUnderline" as const, label: "تسطير العنوان" },
                { key: "showMemberId" as const, label: "رقم العضوية" },
                { key: "showName" as const, label: "الاسم واللقب" },
                { key: "showDateOfBirth" as const, label: "تاريخ الميلاد" },
                { key: "showBloodType" as const, label: "فصيلة الدم (كبير)" },
                { key: "showPhoto" as const, label: "الصورة الشخصية" },
                { key: "showQR" as const, label: "رمز QR" },
              ].map((item) => (
                <div key={item.key} className="flex items-center gap-2">
                  <Checkbox id={`f-${item.key}`} checked={settings[item.key]} onCheckedChange={(c) => set(item.key, !!c)} />
                  <Label htmlFor={`f-${item.key}`} className="text-xs cursor-pointer">{item.label}</Label>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-[#1E3A8A] mb-2 text-sm">الواجهة الخلفية</h4>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                { key: "showBackTitle" as const, label: "عنوان البطاقة الخلفية" },
                { key: "showBackDays" as const, label: "أيام السباحة" },
                { key: "showBackTime" as const, label: "التوقيت" },
                { key: "showBackExpiry" as const, label: "تاريخ انتهاء الاشتراك (ت.ن.إ)" },
              ].map((item) => (
                <div key={item.key} className="flex items-center gap-2">
                  <Checkbox id={`b-${item.key}`} checked={settings[item.key]} onCheckedChange={(c) => set(item.key, !!c)} />
                  <Label htmlFor={`b-${item.key}`} className="text-xs cursor-pointer">{item.label}</Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="show-borders" checked={settings.showBorders} onCheckedChange={(c) => set("showBorders", !!c)} />
          <Label htmlFor="show-borders" className="text-sm cursor-pointer">إظهار حدود البطاقات (إطار أسود)</Label>
        </div>
      </CardContent>
    </Card>
  );

  // ══════════════════════════════ العرض ══════════════════════════════

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50/30">
      <style dangerouslySetInnerHTML={{ __html: printCSS(settings) }} />

      {/* الرأس */}
      <header className="no-print sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#1E3A8A]/10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button variant="ghost" size="sm" onClick={onBack} className="text-[#1E3A8A]">
                <ArrowRight className="w-4 h-4 ml-1" /> رجوع
              </Button>
            )}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1E3A8A] to-[#3B82F6] flex items-center justify-center text-white shadow-md">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#1E3A8A] leading-tight">مصمم البطاقات</h1>
              <p className="text-xs text-muted-foreground">نظام طباعة البطاقات الاحترافي - Recto/Verso</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="bg-[#1E3A8A]/10 text-[#1E3A8A] border-[#1E3A8A]/20">
              <Users className="w-3 h-3 ml-1" />
              {selectedIds.size} / {subscribers.length} منخرط
            </Badge>
            <Button variant="outline" size="sm" onClick={() => setShowDesignSettings(!showDesignSettings)}>
              <Settings className="w-4 h-4 ml-1" />
              {showDesignSettings ? "إخفاء الإعدادات" : "تصميم البطاقة"}
            </Button>
            <Button
              className="bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white"
              size="sm"
              onClick={handlePrint}
              disabled={selectedSubs.length === 0}
            >
              <Printer className="w-4 h-4 ml-1" />
              طباعة ({selectedSubs.length})
            </Button>
          </div>
        </div>
      </header>

      {/* المحتوى */}
      <main className="no-print flex-1 max-w-7xl w-full mx-auto px-4 py-6 space-y-6">
        {/* شريط الأدوات */}
        <Card className="border-[#1E3A8A]/20 shadow-sm">
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ابحث عن منخرط بالاسم أو الرقم..."
                  className="pr-10 border-[#1E3A8A]/20 focus:border-[#1E3A8A]"
                />
              </div>
              <Button variant="outline" size="sm" onClick={selectAll}>
                <Check className="w-4 h-4 ml-1" />
                {selectedIds.size === filteredSubs.length ? "إلغاء الكل" : "اختيار الكل"}
              </Button>
            </div>

            {/* محدد وضع الطباعة */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-[#1E3A8A] flex items-center gap-1">
                <FlipHorizontal className="w-3.5 h-3.5" /> وضع الطباعة:
              </span>
              {([
                { v: "both", l: "أمامي + خلفي (Recto/Verso)" },
                { v: "front", l: "أمامي فقط" },
                { v: "back", l: "خلفي فقط" },
              ] as const).map((opt) => (
                <Button
                  key={opt.v}
                  type="button"
                  variant={printMode === opt.v ? "default" : "outline"}
                  size="sm"
                  className={`text-xs ${printMode === opt.v ? "bg-[#1E3A8A] hover:bg-[#1E3A8A]/90" : "border-[#1E3A8A]/20"}`}
                  onClick={() => setPrintMode(opt.v)}
                >
                  {opt.l}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* لوحة الإعدادات */}
        <AnimatePresence>
          {showDesignSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              {renderSettings()}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* قائمة المنخرطين */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="border-[#1E3A8A]/20 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-[#1E3A8A] flex items-center gap-2">
                  <Users className="w-4 h-4" /> قائمة المنخرطين
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {filteredSubs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">لا توجد نتائج.</p>
                  </div>
                ) : (
                  <div className="max-h-[28rem] overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                    {filteredSubs.map((sub) => {
                      const photoUrl = getPhotoUrl(sub);
                      return (
                        <div
                          key={sub.id}
                          className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${
                            selectedIds.has(sub.id)
                              ? "bg-[#1E3A8A]/10 border border-[#1E3A8A]/40 shadow-sm"
                              : "hover:bg-muted border border-transparent"
                          }`}
                          onClick={() => toggleSub(sub.id)}
                        >
                          <Checkbox checked={selectedIds.has(sub.id)} />
                          <div className="w-10 h-12 rounded bg-[#1E3A8A]/10 flex items-center justify-center overflow-hidden border border-[#1E3A8A]/20 shrink-0">
                            {photoUrl ? (
                              <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-bold text-[#1E3A8A]">صورة</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{getFullName(sub)}</p>
                            <p className="text-xs text-muted-foreground">{sub.fileNumber} • {sub.bloodType || "—"}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">{sub.subscriptionType}</Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* المعاينة */}
          <div className="space-y-4">
            <Card className="border-[#1E3A8A]/20 shadow-sm sticky top-24">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-[#1E3A8A] flex items-center gap-2">
                  <Eye className="w-4 h-4" /> معاينة مباشرة
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                {selectedSubs.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    اختر منخرطاً لعرض المعاينة
                  </p>
                ) : (
                  <>
                    <div className="text-xs text-muted-foreground mb-1">الواجهة الأمامية:</div>
                    <div className="flex justify-center bg-gray-100 p-3 rounded-lg overflow-x-auto">
                      <div style={{ transform: "scale(0.8)", transformOrigin: "center" }}>
                        {renderFrontCard(selectedSubs[0], "preview-front")}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mb-1">الواجهة الخلفية:</div>
                    <div className="flex justify-center bg-gray-100 p-3 rounded-lg overflow-x-auto">
                      <div style={{ transform: "scale(0.8)", transformOrigin: "center" }}>
                        {renderBackCard(selectedSubs[0], "preview-back")}
                      </div>
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                      المعاينة لأول منخرط محدد: {getFullName(selectedSubs[0])}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-[#D4A017]/30 bg-amber-50/50">
              <CardContent className="p-4 text-xs space-y-1.5 text-amber-900">
                <p className="font-bold flex items-center gap-1.5">
                  <FileText className="w-4 h-4" /> معلومات الطباعة
                </p>
                <p>• مقاس البطاقة: {CARD_W}مم × {CARD_H}مم (أفقي)</p>
                <p>• 8 بطاقات في صفحة A4 (4 صفوف × عمودان)</p>
                <p>• هوامش الصفحة: {PAGE_MARGIN}مم، فجوات: {CARD_GAP}مم</p>
                <p>• {selectedSubs.length} بطاقة مختارة = {pages.length} صفحة</p>
                <p>• الوضع: {printMode === "both" ? "أمامي + خلفي" : printMode === "front" ? "أمامي فقط" : "خلفي فقط"}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* التذييل */}
      <footer className="no-print mt-auto bg-[#1E3A8A] text-white py-4">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-2 text-center md:text-right">
          <p className="text-sm font-semibold">مصمم البطاقات - AquaCore Club Manager</p>
          <p className="text-xs text-white/70">8 بطاقات لكل صفحة A4 • Recto/Verso • طباعة احترافية</p>
        </div>
      </footer>

      {/* منطقة الطباعة */}
      {showPreview && selectedSubs.length > 0 && (
        <div className="print-area">
          {pages.map((page, pageIdx) => (
            <div key={`page-${pageIdx}`}>
              {(printMode === "both" || printMode === "front") && (
                <div className="print-page" style={{ direction: "rtl" }}>
                  {page.map((sub) => (
                    <div key={`f-${sub.id}`}>{renderFrontCard(sub, `f-${sub.id}`)}</div>
                  ))}
                  {Array.from({ length: 8 - page.length }).map((_, i) => (
                    <div key={`f-empty-${i}`} className="member-card" style={{ width: `${CARD_W}mm`, height: `${CARD_H}mm`, border: settings.showBorders ? "2px solid #000" : "1px dashed #ccc" }} />
                  ))}
                </div>
              )}
              {(printMode === "both" || printMode === "back") && (
                <div className="print-page" style={{ direction: "rtl" }}>
                  {page.map((sub) => (
                    <div key={`b-${sub.id}`}>{renderBackCard(sub, `b-${sub.id}`)}</div>
                  ))}
                  {Array.from({ length: 8 - page.length }).map((_, i) => (
                    <div key={`b-empty-${i}`} className="member-card" style={{ width: `${CARD_W}mm`, height: `${CARD_H}mm`, border: settings.showBorders ? "2px solid #000" : "1px dashed #ccc" }} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════ طباعة CSS ══════════════════════════════

function printCSS(s: CardDesignSettings): string {
  return `
    @media print {
      @page {
        size: A4 portrait;
        margin: ${PAGE_MARGIN}mm;
      }
      html, body {
        background: #fff !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      body * { visibility: hidden !important; }
      .print-area, .print-area * { visibility: visible !important; }
      .print-area {
        position: absolute;
        top: 0;
        right: 0;
        left: 0;
        width: 100%;
        margin: 0 !important;
        padding: 0 !important;
      }
      .no-print { display: none !important; }
      .print-page {
        display: grid !important;
        grid-template-columns: ${CARD_W}mm ${CARD_W}mm !important;
        grid-template-rows: repeat(4, ${CARD_H}mm) !important;
        gap: ${CARD_GAP}mm !important;
        padding: 0 !important;
        width: ${(CARD_W * 2) + CARD_GAP}mm !important;
        page-break-after: always !important;
        margin: 0 auto !important;
      }
      .print-page:last-child {
        page-break-after: auto !important;
      }
      .member-card {
        width: ${CARD_W}mm !important;
        height: ${CARD_H}mm !important;
        page-break-inside: avoid !important;
        overflow: hidden !important;
      }
    }
    @media screen {
      .print-area { display: none; }
    }
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #1E3A8A40; border-radius: 3px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #1E3A8A80; }
  `;
}

"use client";

/**
 * ═══════════════════════════════════════════════════════════════
 *  AquaCore — CardCanvas (Single Render Engine)
 * ═══════════════════════════════════════════════════════════════
 *
 *  هذا هو المكوّن الوحيد الذي يرسم البطاقة. يُستخدم في:
 *  - المصمم (مع إمكانية السحب عبر onElementMouseDown)
 *  - المعاينة (بدون سحب، readOnly)
 *  - الطباعة (react-to-print يطبع هذا المكوّن مباشرة)
 *  - التصدير (html2canvas يلتقط هذا المكوّن)
 *
 *  لا يوجد توليد HTML منفصل — كل شيء من نفس شجرة React.
 *
 *  يقرأ design من Zustand store (useCardDesignStore) أو من props.
 */

import React, { forwardRef, useCallback } from "react";
import {
  type CardDesign, type CardElement, type CardConfig,
  isTextType, isImageType, isCodeType, isEditableText,
  getContent, getPhotoUrl, getQRUrl, getBarcodeUrl,
  cmToPx, alphaHex,
} from "@/lib/card-types";

export interface CardCanvasProps {
  design: CardDesign;
  side: "front" | "back";
  sub: any;
  origin?: string;
  scale?: number; // 1 = natural size (cm × 37.8px)
  // Designer interaction (optional — undefined = readOnly)
  selectedElementId?: string | null;
  onElementMouseDown?: (e: React.MouseEvent, el: CardElement) => void;
  onElementDoubleClick?: (el: CardElement) => void;
  onBackgroundClick?: () => void;
}

export const CardCanvas = forwardRef<HTMLDivElement, CardCanvasProps>(function CardCanvas(
  { design, side, sub, origin = "", scale = 1, selectedElementId, onElementMouseDown, onElementDoubleClick, onBackgroundClick },
  ref
) {
  const { config } = design;
  const elements = side === "front" ? design.front : design.back;
  const naturalW = cmToPx(config.width);
  const naturalH = cmToPx(config.height);
  const isInteractive = !!onElementMouseDown;

  const bgStyle: React.CSSProperties = config.bgImage
    ? { backgroundImage: `url(${config.bgImage})`, backgroundSize: "cover", backgroundPosition: "center", backgroundColor: config.bgColor }
    : config.gradientEnabled
      ? { background: `linear-gradient(${gradientDir(config.gradientDirection)}, ${config.gradientStart || "#0f766e"}, ${config.gradientEnd || "#0369a1"})` }
      : { backgroundColor: config.bgColor };

  return (
    <div
      ref={ref}
      data-card
      onClick={onBackgroundClick}
      className="relative shadow-2xl"
      style={{
        width: `${naturalW}px`,
        height: `${naturalH}px`,
        transform: `scale(${scale})`,
        transformOrigin: "top center",
        ...bgStyle,
        opacity: config.bgOpacity / 100,
        border: `${config.borderWidth}px ${config.borderStyle} ${config.borderColor}`,
        borderRadius: `${config.borderRadius}px`,
        direction: "rtl",
        overflow: "hidden",
        fontFamily: "Cairo, Tajawal, Tahoma, Arial, sans-serif",
      }}
    >
      {/* Background image overlay (dim) */}
      {config.bgImage && (
        <div className="absolute inset-0" style={{ backgroundColor: config.bgColor, opacity: 1 - (config.bgImageOpacity ?? 30) / 100 }} />
      )}
      {/* Render elements (sorted by zIndex) */}
      {elements.filter((e) => e.visible).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).map((el) => (
        <CardElementView
          key={el.id}
          el={el}
          config={config}
          sub={sub}
          origin={origin}
          selected={selectedElementId === el.id}
          interactive={isInteractive}
          onMouseDown={onElementMouseDown}
          onDoubleClick={onElementDoubleClick}
        />
      ))}
    </div>
  );
});

function gradientDir(d?: string): string {
  if (d === "horizontal") return "to right";
  if (d === "vertical") return "to bottom";
  return "to bottom right";
}

// ═══════════════════════════════════════════════════════════════
//  CardElementView — renders ONE element (shared by designer/preview/print)
// ═══════════════════════════════════════════════════════════════

interface CardElementViewProps {
  el: CardElement;
  config: CardConfig;
  sub: any;
  origin: string;
  selected: boolean;
  interactive: boolean;
  onMouseDown?: (e: React.MouseEvent, el: CardElement) => void;
  onDoubleClick?: (el: CardElement) => void;
}

const CardElementView = React.memo(function CardElementView({
  el, config, sub, origin, selected, interactive, onMouseDown, onDoubleClick,
}: CardElementViewProps) {
  const br = el.shapeKind === "circle" ? "50%" : `${el.borderRadius || 0}px`;
  const bgAlpha = el.bgOpacity != null ? alphaHex(el.bgOpacity) : "";

  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: `${(el.x / config.width) * 100}%`,
    top: `${(el.y / config.height) * 100}%`,
    width: `${(el.width / config.width) * 100}%`,
    height: `${(el.height / config.height) * 100}%`,
    display: "flex",
    alignItems: "center",
    justifyContent: el.textAlign === "center" ? "center" : el.textAlign === "left" ? "flex-start" : "flex-end",
    direction: "rtl",
    overflow: "hidden",
    boxSizing: "border-box",
    transform: `rotate(${el.rotation || 0}deg)`,
    opacity: (el.opacity ?? 100) / 100,
    zIndex: el.zIndex || 1,
    backgroundColor: el.bgColor ? `${el.bgColor}${bgAlpha}` : undefined,
    border: el.borderWidth ? `${el.borderWidth}px ${el.borderStyle || "solid"} ${el.borderColor || "#000"}` : undefined,
    borderRadius: br,
    padding: "0.5mm",
    boxShadow: el.shadow ? "0 2px 8px rgba(0,0,0,0.15)" : undefined,
    cursor: interactive ? (el.locked ? "default" : "move") : "default",
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (onMouseDown && !el.locked) onMouseDown(e, el);
  }, [onMouseDown, el]);

  const handleDoubleClick = useCallback(() => {
    if (onDoubleClick) onDoubleClick(el);
  }, [onDoubleClick, el]);

  return (
    <div
      style={baseStyle}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      className={selected ? "ring-2 ring-blue-500 ring-offset-1" : ""}
    >
      {renderElementContent(el, sub, origin, br)}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
//  renderElementContent — the actual content of an element
//  This is the SINGLE render function used everywhere.
// ═══════════════════════════════════════════════════════════════

function renderElementContent(el: CardElement, sub: any, origin: string, br: string): React.ReactNode {
  // QR Code — square, object-contain, never stretch
  if (el.type === "qr") {
    return (
      <img
        src={getQRUrl(sub)}
        alt="QR"
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        draggable={false}
      />
    );
  }
  // Barcode
  if (el.type === "barcode") {
    return (
      <img
        src={getBarcodeUrl(sub)}
        alt="Barcode"
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        draggable={false}
      />
    );
  }
  // Logo
  if (el.type === "logo") {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#0f766e", fontWeight: 700, fontSize: "8mm" }}>
        ن
      </div>
    );
  }
  // Uploaded image — object-contain
  if (el.type === "uploadedImage") {
    if (el.imageData) {
      return <img src={el.imageData} alt="img" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} draggable={false} />;
    }
    return <div style={{ width: "100%", height: "100%", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: "3mm" }}>صورة</div>;
  }
  // Member photo — object-cover, overflow hidden (FIXED in frame)
  if (el.type === "photo") {
    const photoUrl = getPhotoUrl(sub, origin);
    return (
      <div style={{
        width: "100%", height: "100%", background: "#e5e7eb",
        borderRadius: el.shapeKind === "circle" ? "50%" : (el.borderRadius || 8),
        border: el.borderWidth ? `${el.borderWidth}px ${el.borderStyle || "solid"} ${el.borderColor || "#000"}` : undefined,
        overflow: "hidden", position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {photoUrl ? (
          <img src={photoUrl} alt="عضو" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }} draggable={false} />
        ) : (
          <span style={{ color: "#9ca3af", fontSize: "3mm" }}>صورة</span>
        )}
      </div>
    );
  }
  // Shape
  if (el.type === "shape") {
    return <div style={{ width: "100%", height: "100%" }} />;
  }
  // Text elements
  if (isTextType(el.type)) {
    const content = getContent(el, sub);
    const label = el.showLabel ? (el.labelText || "") : "";
    const fullText = label + content;
    const isLongText = el.type === "fullName" || el.type === "customText" || (fullText.length > 20);
    const textOverflow: React.CSSProperties = isLongText
      ? { whiteSpace: "normal", wordBreak: "break-word", maxHeight: "100%", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }
      : { whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" };

    return (
      <span style={{
        fontFamily: `${el.fontFamily || "Cairo"}, Arial, sans-serif`,
        fontSize: `${el.fontSize || 10}px`,
        fontWeight: el.fontWeight as React.CSSProperties["fontWeight"],
        color: el.color || "#333",
        textAlign: (el.textAlign as React.CSSProperties["textAlign"]) || "right",
        width: "100%",
        lineHeight: 1.2,
        ...textOverflow,
      }}>
        {fullText}
      </span>
    );
  }
  return null;
}

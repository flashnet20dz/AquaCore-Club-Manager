"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Type, Image as ImageIcon, Plus, Trash2, Edit2, Copy, Move, Save,
  Loader2, Eye, RotateCcw, X, Bold, Italic, Underline, AlignRight,
  AlignCenter, AlignLeft, Upload, GripVertical, Settings2, Sparkles,
  ChevronUp, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScaleFit } from "@/hooks/use-scale-fit";
import { useBreakpoint, type Breakpoint } from "@/hooks/use-breakpoint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ---------- Types (mirror server) ----------
type Slot = "header-left" | "header-center" | "header-right" | "footer-left" | "footer-center" | "footer-right";

interface EnteteElement {
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
  slot: Slot;
  src?: string;
  width?: number;
  height?: number;
  borderRadius?: number;
}

interface EnteteConfig {
  elements: EnteteElement[];
  showDivider: boolean;
  dividerColor: string;
  dividerWidth: number;
  referenceNumberText: string;
  dateLocationText: string;
  showReferenceRow: boolean;
}

// ---------- Constants ----------
const SLOT_LABELS: Record<Slot, string> = {
  "header-left": "أعلى - يمين",
  "header-center": "أعلى - وسط",
  "header-right": "أعلى - يسار",
  "footer-left": "أسفل - يمين",
  "footer-center": "أسفل - وسط",
  "footer-right": "أسفل - يسار",
};

const FONT_OPTIONS = [
  { value: "Cairo", label: "Cairo (افتراضي)" },
  { value: "Tajawal", label: "Tajawal" },
  { value: "Amiri", label: "Amiri (كلاسيكي)" },
  { value: "Tahoma", label: "Tahoma" },
  { value: "Arial", label: "Arial" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Georgia", label: "Georgia" },
  { value: "Verdana", label: "Verdana" },
];

const COLOR_PRESETS = [
  "#0f766e", "#0891b2", "#1d4ed8", "#6366f1", "#9333ea",
  "#dc2626", "#ea580c", "#f59e0b", "#16a34a", "#0284c7",
  "#111111", "#555555", "#999999", "#ffffff",
];

const DEFAULT_CONFIG: EnteteConfig = {
  elements: [
    { id: "logo-l", label: "الشعار الأيسر", type: "logo", slot: "header-left", src: "/images/rcs-logo-official.png", width: 70, height: 70, borderRadius: 8 },
    { id: "title", label: "النادي الهاوي", type: "text", slot: "header-center", content: "النادي الهاوي متعدد الرياضات", fontFamily: "Cairo", fontSize: 16, fontWeight: "bold", color: "#0f766e" },
    { id: "subtitle", label: "الرائد - سعيدة", type: "text", slot: "header-center", content: "الرائد - سعيدة", fontFamily: "Cairo", fontSize: 14, fontWeight: "bold", color: "#f59e0b" },
    { id: "branch", label: "فرع السباحة", type: "text", slot: "header-center", content: "فرع السباحة", fontFamily: "Cairo", fontSize: 12, fontWeight: "normal", color: "#555555" },
    { id: "logo-r", label: "الشعار الأيمن", type: "logo", slot: "header-right", src: "/images/rcs-logo-official.png", width: 70, height: 70, borderRadius: 8 },
  ],
  showDivider: true,
  dividerColor: "#0f766e",
  dividerWidth: 2,
  referenceNumberText: "الرقم: . . ./ن.ر.ه.ر.س",
  dateLocationText: "سعيدة في:",
  showReferenceRow: true,
};

// ---------- Helper ----------
function genId(): string {
  return `el-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

// ---------- Live preview renderer (fixed canvas + transform: scale) ----------
//
// The EN-TETE is rendered at its natural A4-ratio size (HEADER_W × HEADER_H)
// and then scaled down via transform: scale() to fit the available container
// width. This keeps all text crisp and proportions exact — exactly what the
// user sees in the exported Word/PDF.
//
// Approach: a wrapper div measures the available width (ResizeObserver via
// useScaleFit), the inner "canvas" renders at 1100×natural, and we apply
// transform: scale(scale) + transform-origin: top center.

const HEADER_W = 1100;   // natural width of an A4 letterhead (px @ 96dpi)
const HEADER_MIN_H = 220; // minimum height; grows with content

function EntetePreview({ config, onMoveElement, selectedId, onSelectElement }: {
  config: EnteteConfig;
  onMoveElement?: (id: string, newSlot: Slot) => void;
  selectedId?: string | null;
  onSelectElement?: (id: string) => void;
}) {
  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  };

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<Slot | null>(null);

  const renderElement = (el: EnteteElement) => {
    if (el.type === "logo") {
      return (
        <img
          src={el.src || "/images/rcs-logo-official.png"}
          alt={el.label}
          style={{
            width: `${el.width || 70}px`,
            height: `${el.height || 70}px`,
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
          whiteSpace: "pre-wrap",
        }}
      >
        {el.content || ""}
      </p>
    );
  };

  const leftEls = config.elements.filter((e) => e.slot === "header-left");
  const centerEls = config.elements.filter((e) => e.slot === "header-center");
  const rightEls = config.elements.filter((e) => e.slot === "header-right");

  // Render an element wrapped in a draggable container
  const renderDraggableElement = (el: EnteteElement) => {
    const isSelected = selectedId === el.id;
    const isDragged = draggedId === el.id;
    return (
      <div
        key={el.id}
        draggable={!!onMoveElement}
        onDragStart={(e) => {
          if (!onMoveElement) return;
          setDraggedId(el.id);
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", el.id);
        }}
        onDragEnd={() => {
          setDraggedId(null);
          setDragOverSlot(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelectElement?.(el.id);
        }}
        style={{
          cursor: onMoveElement ? "grab" : "default",
          opacity: isDragged ? 0.4 : 1,
          outline: isSelected ? "2px dashed #0f766e" : "none",
          outlineOffset: "2px",
          borderRadius: "4px",
          padding: "2px 4px",
          transition: "opacity 0.15s",
        }}
        title={onMoveElement ? `اسحب لإعادة التموضع — ${el.label}` : el.label}
      >
        {renderElement(el)}
      </div>
    );
  };

  // Column drop handler factory
  const makeDropHandlers = (slot: Slot) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!onMoveElement || !draggedId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverSlot(slot);
    },
    onDragLeave: () => {
      if (dragOverSlot === slot) setDragOverSlot(null);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const id = e.dataTransfer.getData("text/plain") || draggedId;
      if (id && onMoveElement) {
        onMoveElement(id, slot);
      }
      setDraggedId(null);
      setDragOverSlot(null);
    },
  });

  // The inner canvas — fixed natural dimensions, scaled by transform.
  // We let height grow with content (no fixed height) so a tall header
  // still renders fully; the scale is computed from width only.
  const canvas = (
    <div
      dir="rtl"
      style={{
        width: `${HEADER_W}px`,
        background: "#ffffff",
        color: "#000",
        padding: "16px 24px",
        boxSizing: "border-box",
        fontFamily: "'Cairo', 'Tahoma', Arial, sans-serif",
      }}
    >
      {/* Header row: 3 columns (left logo / center text / right logo) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: "16px",
          minHeight: "80px",
        }}
      >
        {/* Left column (header-left) — drop target */}
        <div
          {...makeDropHandlers("header-left")}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            gap: "2px",
            minHeight: "60px",
            padding: "4px",
            borderRadius: "6px",
            backgroundColor: dragOverSlot === "header-left" ? "rgba(15, 118, 110, 0.08)" : "transparent",
            border: dragOverSlot === "header-left" ? "2px dashed #0f766e" : "2px dashed transparent",
            transition: "all 0.15s",
          }}
        >
          {rightEls.length === 0 && dragOverSlot === "header-left" && (
            <span style={{ color: "#0f766e", fontSize: "10pt", fontStyle: "italic" }}>أفلت هنا</span>
          )}
          {rightEls.map((el) => renderDraggableElement(el))}
        </div>

        {/* Center column (header-center) — drop target */}
        <div
          {...makeDropHandlers("header-center")}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            maxWidth: "600px",
            minHeight: "60px",
            padding: "4px",
            borderRadius: "6px",
            backgroundColor: dragOverSlot === "header-center" ? "rgba(15, 118, 110, 0.08)" : "transparent",
            border: dragOverSlot === "header-center" ? "2px dashed #0f766e" : "2px dashed transparent",
            transition: "all 0.15s",
          }}
        >
          {centerEls.length === 0 && dragOverSlot === "header-center" && (
            <span style={{ color: "#0f766e", fontSize: "10pt", fontStyle: "italic" }}>أفلت هنا</span>
          )}
          {centerEls.map((el) => renderDraggableElement(el))}
        </div>

        {/* Right column (header-right) — drop target */}
        <div
          {...makeDropHandlers("header-right")}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            justifyContent: "center",
            gap: "2px",
            minHeight: "60px",
            padding: "4px",
            borderRadius: "6px",
            backgroundColor: dragOverSlot === "header-right" ? "rgba(15, 118, 110, 0.08)" : "transparent",
            border: dragOverSlot === "header-right" ? "2px dashed #0f766e" : "2px dashed transparent",
            transition: "all 0.15s",
          }}
        >
          {leftEls.length === 0 && dragOverSlot === "header-right" && (
            <span style={{ color: "#0f766e", fontSize: "10pt", fontStyle: "italic" }}>أفلت هنا</span>
          )}
          {leftEls.map((el) => renderDraggableElement(el))}
        </div>
      </div>

      {/* Divider */}
      {config.showDivider && (
        <hr style={{ borderTop: `${config.dividerWidth || 2}px solid ${config.dividerColor || "#0f766e"}`, margin: "8px 0", border: "none", borderTopWidth: `${config.dividerWidth || 2}px`, borderTopStyle: "solid", borderTopColor: config.dividerColor || "#0f766e" }} />
      )}

      {/* Reference row */}
      {config.showReferenceRow && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11pt", color: "#374151", marginTop: "4px", marginBottom: "8px", fontWeight: "bold" }}>
          <span>{config.referenceNumberText} {new Date().getFullYear()}</span>
          <span>{config.dateLocationText} {todayStr()}</span>
        </div>
      )}
    </div>
  );

  // Measure the wrapper and compute scale = wrapperWidth / HEADER_W
  // We only constrain by width (height grows with content).
  const { containerRef, scale } = useScaleFit(HEADER_W, HEADER_MIN_H);

  // We need to know the canvas's natural height to set the outer wrapper's
  // height to scaledHeight — otherwise the scaled element would leave a
  // gap (transform doesn't affect layout box). We measure it with a ref
  // and ResizeObserver on the canvas itself.
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [canvasH, setCanvasH] = useState(HEADER_MIN_H);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const update = () => setCanvasH(el.offsetHeight);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [config]);

  const scaledHeight = canvasH * scale;

  return (
    <div
      ref={containerRef}
      className="bg-white rounded-xl border border-border shadow-sm overflow-hidden flex justify-center"
      style={{ height: `${scaledHeight}px`, minHeight: "80px", transition: "height 0.15s ease-out" }}
    >
      <div
        ref={canvasRef}
        style={{
          width: `${HEADER_W}px`,
          transform: `scale(${scale})`,
          transformOrigin: "top center",
          // position absolute so it doesn't affect parent layout box
          position: "absolute",
          top: 0,
          left: "50%",
          marginLeft: `-${HEADER_W / 2}px`,
        }}
      >
        {canvas}
      </div>
    </div>
  );
}

// ---------- Main component ----------
export function EnteteEditor({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [config, setConfig] = useState<EnteteConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EnteteElement | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoUploadTarget, setLogoUploadTarget] = useState<string | null>(null);
  const breakpoint = useBreakpoint();
  // On mobile, properties panel is hidden by default (opens as bottom sheet)
  const [mobilePropsOpen, setMobilePropsOpen] = useState(false);
  // On tablet, properties panel is collapsible
  const [tabletPropsOpen, setTabletPropsOpen] = useState(true);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/entete");
      const data = await res.json();
      if (data.config) setConfig(data.config);
    } catch {
      toast.error("تعذر تحميل إعدادات الترويسة");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchConfig();
  }, [open, fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/entete", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "فشل الحفظ");
      }
      toast.success("تم حفظ إعدادات الترويسة");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/entete", { method: "DELETE" });
      const data = await res.json();
      if (data.config) setConfig(data.config);
      toast.success("تمت الاستعادة للإعدادات الافتراضية");
      setResetOpen(false);
    } catch {
      toast.error("فشلت الاستعادة");
    } finally {
      setSaving(false);
    }
  };

  const addTextElement = (slot: Slot = "header-center") => {
    const newEl: EnteteElement = {
      id: genId(),
      label: "نص جديد",
      type: "text",
      slot,
      content: "نص جديد",
      fontFamily: "Cairo",
      fontSize: 12,
      fontWeight: "normal",
      color: "#111111",
      italic: false,
      underline: false,
    };
    setConfig((c) => ({ ...c, elements: [...c.elements, newEl] }));
    setSelectedId(newEl.id);
  };

  const addLogoElement = (slot: Slot = "header-left") => {
    const newEl: EnteteElement = {
      id: genId(),
      label: "شعار جديد",
      type: "logo",
      slot,
      src: "/images/rcs-logo-official.png",
      width: 70,
      height: 70,
      borderRadius: 8,
    };
    setConfig((c) => ({ ...c, elements: [...c.elements, newEl] }));
    setSelectedId(newEl.id);
  };

  const duplicateElement = (el: EnteteElement) => {
    const copy: EnteteElement = { ...el, id: genId(), label: `${el.label} (نسخة)` };
    setConfig((c) => ({ ...c, elements: [...c.elements, copy] }));
    setSelectedId(copy.id);
    toast.success("تم نسخ العنصر");
  };

  const deleteElement = (id: string) => {
    setConfig((c) => ({ ...c, elements: c.elements.filter((e) => e.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  };

  const updateElement = (id: string, updates: Partial<EnteteElement>) => {
    setConfig((c) => ({
      ...c,
      elements: c.elements.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !logoUploadTarget) return;
    if (f.size > 2 * 1024 * 1024) {
      toast.error("حجم الصورة يجب أن يكون أقل من 2 ميغابايت");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      updateElement(logoUploadTarget, { src: data });
      toast.success("تم رفع الشعار");
    };
    reader.readAsDataURL(f);
    e.target.value = "";
    setLogoUploadTarget(null);
  };

  const selected = config.elements.find((e) => e.id === selectedId) || null;

  // Group elements by slot for the sidebar
  const slotGroups: Record<Slot, EnteteElement[]> = {
    "header-left": config.elements.filter((e) => e.slot === "header-left"),
    "header-center": config.elements.filter((e) => e.slot === "header-center"),
    "header-right": config.elements.filter((e) => e.slot === "header-right"),
    "footer-left": [],
    "footer-center": [],
    "footer-right": [],
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        // Desktop: min(1400px, 95vw) × min(900px, 95vh), centered with rounded corners
        // Mobile: 100vw × 100vh, no rounding — feels like a full app
        className="p-0 gap-0 overflow-hidden border-0 sm:border fixed inset-0 sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]"
        style={{
          width: "100vw",
          height: "100dvh",
          maxWidth: "none",
          borderRadius: 0,
          // On sm+ override with min() per spec
          ...(breakpoint !== "mobile" ? {
            width: "min(1400px, 95vw)",
            height: "min(900px, 95vh)",
            borderRadius: "1rem",
            maxWidth: "95vw",
            maxHeight: "95vh",
          } : {}),
        }}
      >
        <DialogHeader className="px-3 sm:px-5 py-3 sm:py-4 border-b bg-gradient-to-l from-teal-600 to-sky-700 text-white shrink-0">
          <DialogTitle className="flex items-center justify-between gap-2 text-base sm:text-lg flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <Settings2 className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              <span className="truncate">محرر الترويسة الموحدة</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 h-8 px-2 sm:px-3" onClick={() => setResetOpen(true)} disabled={saving}>
                <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-1" />
                <span className="hidden sm:inline ml-1">استعادة</span>
              </Button>
              <Button variant="secondary" size="sm" className="h-8 px-3 sm:px-4" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" /> : <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-1" />}
                <span className="ml-1">حفظ</span>
              </Button>
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 h-8 w-8 p-0" onClick={() => onOpenChange(false)} title="إغلاق">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* ====== DESKTOP (≥1024px): side-by-side — preview center, properties right ====== */}
            {breakpoint === "desktop" && (
              <div className="flex flex-row overflow-hidden flex-1" style={{ height: "calc(100% - 60px)" }}>
                {/* Left: Live preview + slot list + global settings — scrollable */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-muted/20">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Eye className="h-3 w-3" /> المعاينة الحية
                    </h4>
                    <EntetePreview config={config} onMoveElement={(id, newSlot) => updateElement(id, { slot: newSlot })} selectedId={selectedId} onSelectElement={setSelectedId} />
                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                      اسحب العناصر بين الأعمدة الثلاثة لإعادة تموضعها — المعاينة مطابقة للتصدير
                    </p>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <GripVertical className="h-3 w-3" /> العناصر حسب الموضع
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      {(["header-right", "header-center", "header-left"] as Slot[]).map((slot) => (
                        <SlotColumn
                          key={slot}
                          slot={slot}
                          elements={slotGroups[slot]}
                          selectedId={selectedId}
                          onSelect={setSelectedId}
                          onDelete={(el) => setDeleteTarget(el)}
                          onDuplicate={duplicateElement}
                          onMove={(id, newSlot) => updateElement(id, { slot: newSlot })}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <Button size="sm" variant="outline" onClick={() => addTextElement("header-center")}>
                      <Plus className="h-4 w-4 ml-1" /> <Type className="h-3.5 w-3.5 ml-1" /> نص جديد
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addLogoElement("header-left")}>
                      <Plus className="h-4 w-4 ml-1" /> <ImageIcon className="h-3.5 w-3.5 ml-1" /> شعار جديد
                    </Button>
                  </div>
                  <GlobalSettings config={config} setConfig={setConfig} />
                </div>

                {/* Right: Element properties panel — fixed 380px width */}
                <div className="border-r border-border bg-card overflow-y-auto w-[380px] shrink-0">
                  {selected ? (
                    <ElementProperties
                      key={selected.id}
                      element={selected}
                      onUpdate={(updates) => updateElement(selected.id, updates)}
                      onDelete={() => setDeleteTarget(selected)}
                      onDuplicate={() => duplicateElement(selected)}
                      onUploadLogo={() => { setLogoUploadTarget(selected.id); fileInputRef.current?.click(); }}
                    />
                  ) : (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      <Settings2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="font-semibold mb-1">اختر عنصراً للتعديل</p>
                      <p className="text-xs">انقر على أي عنصر في القائمة لعرض خصائصه</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ====== TABLET (768–1023px): collapsible properties panel ====== */}
            {breakpoint === "tablet" && (
              <div className="flex flex-col overflow-hidden flex-1" style={{ height: "calc(100% - 60px)" }}>
                {/* Main: preview + slots */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Eye className="h-3 w-3" /> المعاينة الحية
                    </h4>
                    <EntetePreview config={config} onMoveElement={(id, newSlot) => updateElement(id, { slot: newSlot })} selectedId={selectedId} onSelectElement={setSelectedId} />
                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                      اسحب العناصر بين الأعمدة الثلاثة لإعادة تموضعها — المعاينة مطابقة للتصدير
                    </p>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <GripVertical className="h-3 w-3" /> العناصر حسب الموضع
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      {(["header-right", "header-center", "header-left"] as Slot[]).map((slot) => (
                        <SlotColumn
                          key={slot}
                          slot={slot}
                          elements={slotGroups[slot]}
                          selectedId={selectedId}
                          onSelect={setSelectedId}
                          onDelete={(el) => setDeleteTarget(el)}
                          onDuplicate={duplicateElement}
                          onMove={(id, newSlot) => updateElement(id, { slot: newSlot })}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <Button size="sm" variant="outline" onClick={() => addTextElement("header-center")}>
                      <Plus className="h-4 w-4 ml-1" /> <Type className="h-3.5 w-3.5 ml-1" /> نص جديد
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addLogoElement("header-left")}>
                      <Plus className="h-4 w-4 ml-1" /> <ImageIcon className="h-3.5 w-3.5 ml-1" /> شعار جديد
                    </Button>
                  </div>
                  <GlobalSettings config={config} setConfig={setConfig} />
                </div>

                {/* Collapsible properties panel — toggled by button */}
                <button
                  onClick={() => setTabletPropsOpen(!tabletPropsOpen)}
                  className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-card text-sm font-semibold hover:bg-accent transition shrink-0"
                >
                  <span className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-primary" />
                    {selected ? `خصائص: ${selected.label}` : "خصائص العنصر"}
                  </span>
                  {tabletPropsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </button>
                {tabletPropsOpen && (
                  <div className="border-t border-border bg-card overflow-y-auto max-h-[45%] shrink-0">
                    {selected ? (
                      <ElementProperties
                        key={selected.id}
                        element={selected}
                        onUpdate={(updates) => updateElement(selected.id, updates)}
                        onDelete={() => setDeleteTarget(selected)}
                        onDuplicate={() => duplicateElement(selected)}
                        onUploadLogo={() => { setLogoUploadTarget(selected.id); fileInputRef.current?.click(); }}
                      />
                    ) : (
                      <div className="p-6 text-center text-sm text-muted-foreground">
                        <Settings2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="font-semibold mb-1">اختر عنصراً للتعديل</p>
                        <p className="text-xs">انقر على أي عنصر في القائمة لعرض خصائصه</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ====== MOBILE (<768px): preview on top + properties as bottom sheet ====== */}
            {breakpoint === "mobile" && (
              <div className="flex flex-col overflow-hidden flex-1" style={{ height: "calc(100% - 56px)" }}>
                {/* Preview + slots — scrollable, takes most of the screen */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-muted/20">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Eye className="h-3 w-3" /> المعاينة الحية
                    </h4>
                    <EntetePreview config={config} onMoveElement={(id, newSlot) => updateElement(id, { slot: newSlot })} selectedId={selectedId} onSelectElement={setSelectedId} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <GripVertical className="h-3 w-3" /> العناصر
                    </h4>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(["header-right", "header-center", "header-left"] as Slot[]).map((slot) => (
                        <SlotColumn
                          key={slot}
                          slot={slot}
                          elements={slotGroups[slot]}
                          selectedId={selectedId}
                          onSelect={(id) => { setSelectedId(id); setMobilePropsOpen(true); }}
                          onDelete={(el) => setDeleteTarget(el)}
                          onDuplicate={duplicateElement}
                          onMove={(id, newSlot) => updateElement(id, { slot: newSlot })}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <Button size="sm" variant="outline" onClick={() => addTextElement("header-center")}>
                      <Plus className="h-4 w-4 ml-1" /> <Type className="h-3.5 w-3.5 ml-1" /> نص
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addLogoElement("header-left")}>
                      <Plus className="h-4 w-4 ml-1" /> <ImageIcon className="h-3.5 w-3.5 ml-1" /> شعار
                    </Button>
                  </div>
                  <GlobalSettings config={config} setConfig={setConfig} />
                </div>

                {/* Bottom sheet toggle button — always visible */}
                <button
                  onClick={() => setMobilePropsOpen(!mobilePropsOpen)}
                  className="flex items-center justify-between px-4 py-3 border-t border-border bg-card text-sm font-semibold shrink-0 shadow-lg"
                >
                  <span className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-primary" />
                    {selected ? `خصائص: ${selected.label}` : "خصائص العنصر"}
                  </span>
                  {mobilePropsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </button>

                {/* Bottom sheet — slides up when open */}
                <AnimatePresence>
                  {mobilePropsOpen && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "65vh" }}
                      exit={{ height: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="border-t-2 border-primary bg-card overflow-hidden shrink-0"
                    >
                      <div className="overflow-y-auto h-full">
                        {selected ? (
                          <ElementProperties
                            key={selected.id}
                            element={selected}
                            onUpdate={(updates) => updateElement(selected.id, updates)}
                            onDelete={() => { setDeleteTarget(selected); setMobilePropsOpen(false); }}
                            onDuplicate={() => duplicateElement(selected)}
                            onUploadLogo={() => { setLogoUploadTarget(selected.id); fileInputRef.current?.click(); }}
                          />
                        ) : (
                          <div className="p-6 text-center text-sm text-muted-foreground">
                            <Settings2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                            <p className="font-semibold mb-1">اختر عنصراً للتعديل</p>
                            <p className="text-xs">انقر على أي عنصر في القائمة لعرض خصائصه</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </>
        )}

        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleLogoUpload} className="hidden" />

        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>تأكيد حذف العنصر</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف{" "}
                <span className="font-bold text-foreground">{deleteTarget?.label}</span>؟
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteTarget && deleteElement(deleteTarget.id)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                نعم، احذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>استعادة الإعدادات الافتراضية</AlertDialogTitle>
              <AlertDialogDescription>
                سيتم استبدال كل تعديلاتك بالترويسة الافتراضية. لا يمكن التراجع.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4 ml-1" />}
                استعادة
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Global settings (divider + reference row) ----------
function GlobalSettings({
  config,
  setConfig,
}: {
  config: EnteteConfig;
  setConfig: React.Dispatch<React.SetStateAction<EnteteConfig>>;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3 space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Sparkles className="h-3 w-3" /> الإعدادات العامة
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2">
          <Label className="text-xs">إظهار الفاصل</Label>
          <Switch checked={config.showDivider} onCheckedChange={(v) => setConfig((c) => ({ ...c, showDivider: v }))} />
        </div>
        <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2">
          <Label className="text-xs">إظهار سطر المرجع</Label>
          <Switch checked={config.showReferenceRow} onCheckedChange={(v) => setConfig((c) => ({ ...c, showReferenceRow: v }))} />
        </div>
      </div>
      {config.showDivider && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">لون الفاصل</Label>
            <div className="flex items-center gap-2">
              <Input type="color" value={config.dividerColor} onChange={(e) => setConfig((c) => ({ ...c, dividerColor: e.target.value }))} className="h-8 w-12 p-1" />
              <Input value={config.dividerColor} onChange={(e) => setConfig((c) => ({ ...c, dividerColor: e.target.value }))} className="h-8 font-mono text-xs" dir="ltr" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">سمك الفاصل (px)</Label>
            <Input type="number" min={1} max={10} value={config.dividerWidth} onChange={(e) => setConfig((c) => ({ ...c, dividerWidth: parseInt(e.target.value) || 1 }))} className="h-8" />
          </div>
        </div>
      )}
      {config.showReferenceRow && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">نص رقم المرجع</Label>
            <Input value={config.referenceNumberText} onChange={(e) => setConfig((c) => ({ ...c, referenceNumberText: e.target.value }))} className="h-8 text-xs" placeholder="الرقم: . . ./ن.ر.ه.ر.س" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">نص التاريخ</Label>
            <Input value={config.dateLocationText} onChange={(e) => setConfig((c) => ({ ...c, dateLocationText: e.target.value }))} className="h-8 text-xs" placeholder="سعيدة في:" />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Slot column (lists elements per slot) ----------
function SlotColumn({
  slot, elements, selectedId, onSelect, onDelete, onDuplicate, onMove,
}: {
  slot: Slot;
  elements: EnteteElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (el: EnteteElement) => void;
  onDuplicate: (el: EnteteElement) => void;
  onMove: (id: string, newSlot: Slot) => void;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-2 min-h-[80px]">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold text-muted-foreground">{SLOT_LABELS[slot]}</span>
        <Badge variant="outline" className="text-[9px] h-4 px-1">{elements.length}</Badge>
      </div>
      <div className="space-y-1">
        {elements.length === 0 ? (
          <p className="text-[10px] text-muted-foreground/60 text-center py-2 italic">فارغ</p>
        ) : (
          elements.map((el) => (
            <motion.div
              key={el.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => onSelect(el.id)}
              className={cn(
                "group rounded-md border p-1.5 cursor-pointer transition",
                selectedId === el.id ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border hover:border-primary/40 hover:bg-accent/40"
              )}
            >
              <div className="flex items-center gap-1">
                {el.type === "text" ? <Type className="h-3 w-3 text-primary shrink-0" /> : <ImageIcon className="h-3 w-3 text-emerald-600 shrink-0" />}
                <p className="text-[10px] font-semibold truncate flex-1">{el.label}</p>
                <select
                  value={el.slot}
                  onChange={(e) => onMove(el.id, e.target.value as Slot)}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[8px] bg-transparent border-0 cursor-pointer text-muted-foreground hover:text-foreground"
                  title="نقل إلى موضع آخر"
                >
                  <option value="header-right">أعلى-يمين</option>
                  <option value="header-center">أعلى-وسط</option>
                  <option value="header-left">أعلى-يسار</option>
                </select>
              </div>
              {el.type === "text" && el.content && (
                <p className="text-[9px] text-muted-foreground truncate mt-0.5">{el.content}</p>
              )}
              <div className="flex gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition">
                <button onClick={(e) => { e.stopPropagation(); onDuplicate(el); }} className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-primary" title="نسخ">
                  <Copy className="h-2.5 w-2.5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(el); }} className="p-0.5 rounded hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600" title="حذف">
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

// ---------- Element properties panel ----------
function ElementProperties({
  element, onUpdate, onDelete, onDuplicate, onUploadLogo,
}: {
  element: EnteteElement;
  onUpdate: (updates: Partial<EnteteElement>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onUploadLogo: () => void;
}) {
  const isText = element.type === "text";

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b">
        <div className="flex items-center gap-2 min-w-0">
          {isText ? <Type className="h-4 w-4 text-primary shrink-0" /> : <ImageIcon className="h-4 w-4 text-emerald-600 shrink-0" />}
          <p className="font-bold text-sm truncate">{element.label}</p>
        </div>
        <Badge variant="outline" className="text-[9px] shrink-0">{isText ? "نص" : "شعار"}</Badge>
      </div>

      {/* Common: label + slot */}
      <div className="space-y-2">
        <div className="space-y-1">
          <Label className="text-xs font-semibold">إعادة تسمية (للتعريف الداخلي)</Label>
          <Input value={element.label} onChange={(e) => onUpdate({ label: e.target.value })} className="h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">الموضع</Label>
          <Select value={element.slot} onValueChange={(v) => onUpdate({ slot: v as Slot })}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="header-right">أعلى - يمين</SelectItem>
              <SelectItem value="header-center">أعلى - وسط</SelectItem>
              <SelectItem value="header-left">أعلى - يسار</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Text properties */}
      {isText && (
        <>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">النص (المحتوى)</Label>
            <textarea
              value={element.content || ""}
              onChange={(e) => onUpdate({ content: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="اكتب النص هنا..."
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">نوع الخط</Label>
              <Select value={element.fontFamily || "Cairo"} onValueChange={(v) => onUpdate({ fontFamily: v })}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((f) => (
                    <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">الحجم (pt)</Label>
              <Input
                type="number"
                min={6}
                max={72}
                value={element.fontSize || 12}
                onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value) || 12 })}
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* Style toggles */}
          <div className="grid grid-cols-3 gap-1">
            <StyleToggle
              active={element.fontWeight === "bold"}
              onClick={() => onUpdate({ fontWeight: element.fontWeight === "bold" ? "normal" : "bold" })}
              icon={<Bold className="h-3.5 w-3.5" />}
              label="عريض"
            />
            <StyleToggle
              active={!!element.italic}
              onClick={() => onUpdate({ italic: !element.italic })}
              icon={<Italic className="h-3.5 w-3.5" />}
              label="مائل"
            />
            <StyleToggle
              active={!!element.underline}
              onClick={() => onUpdate({ underline: !element.underline })}
              icon={<Underline className="h-3.5 w-3.5" />}
              label="تسطير"
            />
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">لون النص</Label>
            <div className="flex items-center gap-2 mb-1">
              <Input type="color" value={element.color || "#111111"} onChange={(e) => onUpdate({ color: e.target.value })} className="h-9 w-12 p-1" />
              <Input value={element.color || "#111111"} onChange={(e) => onUpdate({ color: e.target.value })} className="h-9 font-mono text-xs" dir="ltr" />
            </div>
            <div className="grid grid-cols-7 gap-1">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => onUpdate({ color: c })}
                  className={cn(
                    "h-6 w-full rounded-md border-2 transition",
                    element.color === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Logo properties */}
      {!isText && (
        <>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">معاينة الشعار</Label>
            <div className="rounded-lg border-2 border-dashed border-border p-3 bg-muted/30 flex items-center justify-center min-h-[100px]">
              <img
                src={element.src || "/images/rcs-logo-official.png"}
                alt={element.label}
                style={{ width: `${element.width || 70}px`, height: `${element.height || 70}px`, borderRadius: `${element.borderRadius || 0}px`, objectFit: "contain" }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.2"; }}
              />
            </div>
            <Button size="sm" variant="outline" className="w-full" onClick={onUploadLogo}>
              <Upload className="h-3.5 w-3.5 ml-1" /> رفع شعار جديد (PNG/JPG)
            </Button>
            <Input
              value={element.src || ""}
              onChange={(e) => onUpdate({ src: e.target.value })}
              className="h-8 text-[10px] font-mono"
              dir="ltr"
              placeholder="أو الصق رابط الصورة..."
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">العرض (px)</Label>
              <Input type="number" min={20} max={300} value={element.width || 70} onChange={(e) => onUpdate({ width: parseInt(e.target.value) || 70 })} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">الارتفاع (px)</Label>
              <Input type="number" min={20} max={300} value={element.height || 70} onChange={(e) => onUpdate({ height: parseInt(e.target.value) || 70 })} className="h-9 text-sm" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs font-semibold">استدارة الزوايا (px)</Label>
              <Input type="number" min={0} max={50} value={element.borderRadius || 0} onChange={(e) => onUpdate({ borderRadius: parseInt(e.target.value) || 0 })} className="h-9 text-sm" />
            </div>
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-3 border-t">
        <Button size="sm" variant="outline" className="flex-1" onClick={onDuplicate}>
          <Copy className="h-3.5 w-3.5 ml-1" /> نسخ
        </Button>
        <Button size="sm" variant="outline" className="flex-1 text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5 ml-1" /> حذف
        </Button>
      </div>
    </div>
  );
}

function StyleToggle({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg border-2 text-[10px] transition",
        active ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

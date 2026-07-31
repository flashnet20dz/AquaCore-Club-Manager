"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";

/**
 * AquaCore Card Designer Pro
 * ─────────────────────────────────────────────────────────────────────────────
 * Canva / Adobe Express-style card designer for AquaCore Club Manager.
 * 4-panel layout: floating top toolbar · left members sidebar · center canvas
 * workspace · right properties sidebar. Ocean glassmorphism theme, RTL Arabic.
 *
 * Features:
 *  - Drag & drop elements with smart alignment guides
 *  - Zoom (fit / 100% / 150% / 200%), grid + snap toggles
 *  - Front / Back / Both views
 *  - Keyboard shortcuts (Ctrl+Z undo, Ctrl+Y redo, Delete, Ctrl+D duplicate)
 *  - History (debounced, max 50 steps)
 *  - Save / Load templates (POST/GET /api/card-templates)
 *  - Export PDF (print HTML) / 8-per-A4 / Word / PNG
 *  - Photo elements use object-fit: cover always, frame = rect / rounded / circle
 *
 * Self-contained — does not import from cards-designer.tsx.
 */

import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard, Download, Upload, Loader2, Layers, Check,
  Type, Square, Circle, Image as ImageIcon, QrCode, User, Hash,
  Droplet, Calendar, Wallet, Clock, Tag, Building2, Eye,
  EyeOff, Trash2, Copy, Save, Printer, Search,
  ChevronUp, ChevronDown, Bold, AlignRight, AlignCenter, AlignLeft,
  Palette, FileText, Settings2, Lock, Unlock, Pencil,
  Barcode, Grid3x3, Magnet, Undo2, Redo2, FolderOpen, BringToFront,
  SendToBack, PanelRightClose, PanelLeftClose, PanelLeftOpen, PanelRightOpen,
  Moon, Sun, ZoomIn, ZoomOut, Maximize, Users,
  Droplets, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useSubscriptionTypes } from "@/hooks/use-subscription-types";
import type { SubscriberWithComputed } from "@/lib/rcs";
import { generateProfessionalPrint, generateProfessionalWord, type PrintDesign, type PrintCardConfig, type PrintCardTexts } from "@/lib/print-engine";
import { CardCanvas } from "@/components/card-canvas";
import { exportCardPNG, exportCardJPG, exportCardPDF, exportA4PDF, exportCardWord } from "@/lib/card-export";

// ──────────────────────────── Types ────────────────────────────

type ElementType =
  | "customText" | "shape" | "logo" | "qr" | "photo" | "uploadedImage"
  | "fullName" | "memberId" | "bloodType" | "dateOfBirth" | "paymentDate"
  | "swimmingDays" | "swimmingTime" | "subscriptionType" | "expiryDate"
  | "clubName" | "cardTitle" | "barcode";

type ShapeKind = "rectangle" | "circle" | "line";

interface CardElement {
  id: string;
  type: ElementType;
  name: string;
  x: number; y: number; width: number; height: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  visible: boolean;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  textAlign?: string;
  color?: string;
  showLabel?: boolean;
  labelText?: string;
  bgColor?: string;
  bgOpacity?: number;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: string;
  borderRadius?: number;
  shapeKind?: ShapeKind;
  imageData?: string;
  locked?: boolean;
  shadow?: boolean;
}

interface CardConfig {
  width: number; height: number;
  cols: number; rows: number; gap: number;
  offsetX: number; offsetY: number;
  bgColor: string;
  bgOpacity: number;
  bgImage?: string;
  bgImageOpacity?: number;
  borderColor: string;
  borderWidth: number;
  borderStyle: string;
  borderRadius: number;
  gradientEnabled?: boolean;
  gradientStart?: string;
  gradientEnd?: string;
  gradientDirection?: "horizontal" | "vertical" | "diagonal";
}

interface CardDesign {
  front: CardElement[];
  back: CardElement[];
  config: CardConfig;
}

interface CardDesignerProProps {
  subscribers: SubscriberWithComputed[];
  onBack?: () => void;
}

// ──────────────────────────── Constants ────────────────────────────

const PRESET_COLORS = [
  "#000000","#ffffff","#0f766e","#0369a1","#dc2626","#ea580c","#ca8a04",
  "#16a34a","#0891b2","#7c3aed","#c026d3","#475569","#fbbf24","#34d399",
  "#60a5fa","#f472b6",
];
const FONTS = ["Tahoma","Arial","Times New Roman","Courier New","Verdana","Georgia","Trebuchet MS","Palatino"];

const CARD_SIZE_PRESETS: { value: string; label: string; width: number; height: number }[] = [
  { value: "CR80", label: "CR80 PVC (10×6.5سم)", width: 10, height: 6.5 },
  { value: "A7", label: "A7 (7.4×10.5سم)", width: 7.4, height: 10.5 },
  { value: "A6", label: "A6 (10.5×14.8سم)", width: 10.5, height: 14.8 },
  { value: "custom", label: "مخصص", width: 0, height: 0 },
];

const ELEMENT_LIBRARY: { type: ElementType; label: string; icon: typeof Type }[] = [
  { type: "customText", label: "نص", icon: Type },
  { type: "shape", label: "مستطيل", icon: Square },
  { type: "logo", label: "شعار", icon: Building2 },
  { type: "uploadedImage", label: "صورة", icon: ImageIcon },
  { type: "qr", label: "QR", icon: QrCode },
  { type: "barcode", label: "باركود", icon: Barcode },
  { type: "photo", label: "صورة عضو", icon: User },
  { type: "fullName", label: "الاسم", icon: User },
  { type: "memberId", label: "رقم", icon: Hash },
  { type: "bloodType", label: "فصيلة", icon: Droplet },
  { type: "dateOfBirth", label: "ميلاد", icon: Calendar },
  { type: "paymentDate", label: "دفعة", icon: Wallet },
  { type: "swimmingDays", label: "أيام", icon: Calendar },
  { type: "swimmingTime", label: "وقت", icon: Clock },
  { type: "subscriptionType", label: "نوع", icon: Tag },
  { type: "expiryDate", label: "نهاية", icon: Calendar },
  { type: "clubName", label: "النادي", icon: Building2 },
  { type: "cardTitle", label: "عنوان", icon: Type },
];

const TEXT_TYPES: ElementType[] = [
  "customText","fullName","memberId","bloodType","dateOfBirth","paymentDate",
  "swimmingDays","swimmingTime","subscriptionType","expiryDate","clubName","cardTitle",
];
const IMAGE_TYPES: ElementType[] = ["photo","uploadedImage","logo"];
const CODE_TYPES: ElementType[] = ["qr","barcode"];
const isTextType = (t: ElementType) => TEXT_TYPES.includes(t);
const isImageType = (t: ElementType) => IMAGE_TYPES.includes(t);
const isCodeType = (t: ElementType) => CODE_TYPES.includes(t);
const isEditableText = (t: ElementType) => t === "customText" || t === "cardTitle" || t === "clubName";

const DEFAULT_DESIGN: CardDesign = {
  front: [
    { id: "f1", type: "logo", name: "شعار", x: 7.5, y: 0.3, width: 2, height: 1.2, rotation: 0, opacity: 100, zIndex: 1, visible: true },
    { id: "f2", type: "clubName", name: "اسم النادي", x: 0.5, y: 0.3, width: 6.5, height: 0.7, rotation: 0, opacity: 100, zIndex: 2, visible: true, text: "نادي RCS", fontFamily: "Tahoma", fontSize: 13, fontWeight: "bold", textAlign: "right", color: "#0f766e", showLabel: false },
    { id: "f3", type: "cardTitle", name: "عنوان", x: 0.5, y: 1.0, width: 6.5, height: 0.5, rotation: 0, opacity: 100, zIndex: 3, visible: true, text: "بطاقة الانخراط", fontFamily: "Tahoma", fontSize: 9, fontWeight: "normal", textAlign: "right", color: "#666666", showLabel: false },
    { id: "f4", type: "photo", name: "صورة", x: 0.5, y: 1.8, width: 2.5, height: 3, rotation: 0, opacity: 100, zIndex: 4, visible: true, bgColor: "#e5e7eb", bgOpacity: 100, borderRadius: 8, shapeKind: "rectangle", shadow: true },
    { id: "f5", type: "fullName", name: "الاسم", x: 3.2, y: 1.8, width: 6, height: 0.8, rotation: 0, opacity: 100, zIndex: 5, visible: true, fontFamily: "Tahoma", fontSize: 14, fontWeight: "bold", textAlign: "right", color: "#111111", showLabel: false },
    { id: "f6", type: "memberId", name: "رقم", x: 3.2, y: 2.6, width: 3, height: 0.6, rotation: 0, opacity: 100, zIndex: 6, visible: true, fontFamily: "Tahoma", fontSize: 10, fontWeight: "normal", textAlign: "right", color: "#333333", showLabel: true, labelText: "رقم: " },
    { id: "f7", type: "bloodType", name: "فصيلة", x: 6.2, y: 2.6, width: 3, height: 0.6, rotation: 0, opacity: 100, zIndex: 7, visible: true, fontFamily: "Tahoma", fontSize: 10, fontWeight: "normal", textAlign: "right", color: "#dc2626", showLabel: true, labelText: "🩸 " },
    { id: "f8", type: "dateOfBirth", name: "ميلاد", x: 3.2, y: 3.2, width: 3, height: 0.6, rotation: 0, opacity: 100, zIndex: 8, visible: true, fontFamily: "Tahoma", fontSize: 9, fontWeight: "normal", textAlign: "right", color: "#333333", showLabel: true, labelText: "الميلاد: " },
    { id: "f9", type: "subscriptionType", name: "نوع", x: 6.2, y: 3.2, width: 3, height: 0.6, rotation: 0, opacity: 100, zIndex: 9, visible: true, fontFamily: "Tahoma", fontSize: 9, fontWeight: "normal", textAlign: "right", color: "#333333", showLabel: true, labelText: "النوع: " },
    { id: "f10", type: "qr", name: "QR", x: 7.5, y: 4.2, width: 2, height: 2, rotation: 0, opacity: 100, zIndex: 10, visible: true },
  ],
  back: [
    { id: "b1", type: "cardTitle", name: "عنوان", x: 0.5, y: 0.3, width: 9, height: 0.7, rotation: 0, opacity: 100, zIndex: 1, visible: true, text: "معلومات الاشتراك", fontFamily: "Tahoma", fontSize: 12, fontWeight: "bold", textAlign: "center", color: "#0f766e", showLabel: false },
    { id: "b2", type: "swimmingDays", name: "أيام", x: 0.5, y: 1.5, width: 9, height: 0.6, rotation: 0, opacity: 100, zIndex: 2, visible: true, fontFamily: "Tahoma", fontSize: 10, fontWeight: "normal", textAlign: "right", color: "#333333", showLabel: true, labelText: "أيام السباحة: " },
    { id: "b3", type: "swimmingTime", name: "وقت", x: 0.5, y: 2.2, width: 9, height: 0.6, rotation: 0, opacity: 100, zIndex: 3, visible: true, fontFamily: "Tahoma", fontSize: 10, fontWeight: "normal", textAlign: "right", color: "#333333", showLabel: true, labelText: "التوقيت: " },
    { id: "b4", type: "subscriptionType", name: "نوع", x: 0.5, y: 2.9, width: 9, height: 0.6, rotation: 0, opacity: 100, zIndex: 4, visible: true, fontFamily: "Tahoma", fontSize: 10, fontWeight: "normal", textAlign: "right", color: "#333333", showLabel: true, labelText: "نوع الاشتراك: " },
    { id: "b5", type: "expiryDate", name: "نهاية", x: 0.5, y: 3.6, width: 9, height: 0.6, rotation: 0, opacity: 100, zIndex: 5, visible: true, fontFamily: "Tahoma", fontSize: 10, fontWeight: "normal", textAlign: "right", color: "#dc2626", showLabel: true, labelText: "تاريخ الانتهاء: " },
  ],
  config: {
    width: 10, height: 7, cols: 2, rows: 4, gap: 0, offsetX: 0, offsetY: 0,
    bgColor: "#ffffff", bgOpacity: 100,
    borderColor: "#0f766e", borderWidth: 2, borderStyle: "solid", borderRadius: 12,
    gradientEnabled: false, gradientStart: "#0f766e", gradientEnd: "#0369a1", gradientDirection: "diagonal",
  },
};

// ──────────────────────────── Helpers ────────────────────────────

function uid() { return Math.random().toString(36).substring(2, 11); }

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getSubPhotoPath(sub: SubscriberWithComputed | null): string {
  if (!sub) return "";
  // photoPath is added by Prisma but not always in the TS interface — cast safely
  return (sub as unknown as { photoPath?: string | null }).photoPath || "";
}

function getContent(el: CardElement, sub: SubscriberWithComputed | null): string {
  if (!sub) return el.text || el.name;
  switch (el.type) {
    case "customText": case "cardTitle": case "clubName": return el.text || "";
    case "fullName": return `${sub.lastName} ${sub.firstName}`;
    case "memberId": return sub.fileNumber;
    case "bloodType": return sub.bloodType || "—";
    case "dateOfBirth": return new Date(sub.birthDate).toISOString().split("T")[0].replace(/-/g,"/");
    case "paymentDate": return sub.lastPaymentDate ? new Date(sub.lastPaymentDate).toISOString().split("T")[0].replace(/-/g,"/") : "—";
    case "swimmingDays": return sub.swimmingDays || "—";
    case "swimmingTime": return sub.timeSlot || "—";
    case "subscriptionType": return sub.subscriptionType;
    case "expiryDate": return sub.expiryDate ? new Date(sub.expiryDate).toISOString().split("T")[0].replace(/-/g,"/") : "—";
    default: return "";
  }
}

function createElement(type: ElementType): CardElement {
  const meta = ELEMENT_LIBRARY.find((e) => e.type === type);
  const el: CardElement = {
    id: uid(), type, name: meta?.label || type,
    x: 1, y: 1 + Math.random() * 2, width: 4, height: 1,
    rotation: 0, opacity: 100, zIndex: 99, visible: true,
  };
  if (type === "customText") {
    el.text = "نص جديد"; el.fontFamily = "Tahoma"; el.fontSize = 10;
    el.fontWeight = "normal"; el.textAlign = "right"; el.color = "#000000";
  }
  if (type === "clubName") {
    el.text = "نادي RCS"; el.fontFamily = "Tahoma"; el.fontSize = 13;
    el.fontWeight = "bold"; el.textAlign = "right"; el.color = "#0f766e";
  }
  if (type === "cardTitle") {
    el.text = "بطاقة الانخراط"; el.fontFamily = "Tahoma"; el.fontSize = 12;
    el.fontWeight = "bold"; el.textAlign = "center"; el.color = "#0f766e";
  }
  if (isTextType(type) && !isEditableText(type)) {
    el.fontFamily = "Tahoma"; el.fontSize = 10; el.fontWeight = "normal";
    el.textAlign = "right"; el.color = "#333333";
    el.showLabel = true; el.labelText = (meta?.label || "") + ": ";
  }
  if (type === "shape") {
    el.shapeKind = "rectangle"; el.bgColor = "#0f766e"; el.bgOpacity = 100;
    el.borderColor = "#000000"; el.borderWidth = 0; el.borderStyle = "solid";
    el.borderRadius = 4; el.width = 3; el.height = 1;
  }
  if (type === "logo") { el.width = 2; el.height = 1.5; }
  if (type === "uploadedImage") { el.width = 3; el.height = 2; }
  if (type === "qr") { el.width = 2; el.height = 2; }
  if (type === "barcode") { el.width = 3; el.height = 1.5; }
  if (type === "photo") {
    el.width = 2.5; el.height = 3; el.bgColor = "#e5e7eb"; el.bgOpacity = 100;
    el.borderRadius = 8; el.shapeKind = "rectangle"; el.shadow = true;
  }
  return el;
}

const alphaHex = (opacity: number) => Math.round(Math.max(0, Math.min(100, opacity)) * 2.55).toString(16).padStart(2, "0");
const cmToPx = (cm: number) => cm * 37.8; // 1cm ≈ 37.8px @ 96dpi

// ════════════════════════════ MAIN COMPONENT ════════════════════════════

export function CardDesignerPro({ subscribers, onBack }: CardDesignerProProps) {
  const breakpoint = useBreakpoint();
  const { activeTypes: subTypes } = useSubscriptionTypes();

  // ── Core state ──
  const [design, setDesign] = useState<CardDesign>(() => {
    try {
      // 🔑 ترقية المفتاح لتحميل التصميم الافتراضي الجديد (صورة في اليسار)
      const s = localStorage.getItem("aquacore-card-design-pro-v2");
      if (s) return JSON.parse(s);
    } catch { /* ignore */ }
    return DEFAULT_DESIGN;
  });
  const [activeSide, setActiveSide] = useState<"front" | "back">("front");
  const [viewMode, setViewMode] = useState<"front" | "back" | "both">("front");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);
  const [previewSubId, setPreviewSubId] = useState<string | null>(null);

  // ── Members filter state ──
  const [search, setSearch] = useState("");
  const [subFilter, setSubFilter] = useState<string>("");
  const [genderFilter, setGenderFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  // ── Canvas state ──
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [showGrid, setShowGrid] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [smartGuides, setSmartGuides] = useState(true);
  const [guides, setGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });

  // ── UI state ──
  const [darkMode, setDarkMode] = useState(false);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  // 🔑 WYSIWYG: صور مُحضّرة كـ data URLs للحاوية المخفية
  const [preparedPhotos, setPreparedPhotos] = useState<Record<string, string>>({});
  // ── Mobile sheet state ──
  const [membersSheetOpen, setMembersSheetOpen] = useState(false);
  const [elementsSheetOpen, setElementsSheetOpen] = useState(false);
  const [propsSheetOpen, setPropsSheetOpen] = useState(false);

  // ── Dialogs ──
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showLoadTemplate, setShowLoadTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [renameTarget, setRenameTarget] = useState<CardElement | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // ── History (undo/redo) ──
  const [history, setHistory] = useState<CardDesign[]>([design]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const skipNextHistoryPush = useRef(false);
  const historyIndexRef = useRef(0);
  const clipboardRef = useRef<CardElement | null>(null);

  // ── Refs ──
  const cardRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    id: string; startX: number; startY: number; origX: number; origY: number;
  } | null>(null);
  const fileImageRef = useRef<HTMLInputElement | null>(null);
  const fileBgRef = useRef<HTMLInputElement | null>(null);
  const fileTemplateRef = useRef<HTMLInputElement | null>(null);

  // ── Derived ──
  const elements = activeSide === "front" ? design.front : design.back;
  const selected = elements.find((e) => e.id === selectedId) || null;
  const previewSub = useMemo(
    () => subscribers.find((s) => s.id === (previewSubId || selectedSubIds[0])) || null,
    [subscribers, previewSubId, selectedSubIds],
  );

  const currentPreset = useMemo(() => {
    const match = CARD_SIZE_PRESETS.find((p) => p.width === design.config.width && p.height === design.config.height);
    return match ? match.value : "custom";
  }, [design.config.width, design.config.height]);

  // ── Persistence (debounced localStorage) ──
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem("aquacore-card-design-pro-v2", JSON.stringify(design)); } catch { /* ignore */ }
    }, 500);
    return () => clearTimeout(t);
  }, [design]);

  useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);

  // ── History push (debounced, skips during undo/redo) ──
  useEffect(() => {
    if (skipNextHistoryPush.current) { skipNextHistoryPush.current = false; return; }
    const t = setTimeout(() => {
      setHistory((prev) => {
        const last = prev[historyIndexRef.current];
        if (last && JSON.stringify(last) === JSON.stringify(design)) return prev;
        const newHistory = [...prev.slice(0, historyIndexRef.current + 1), design];
        while (newHistory.length > 50) newHistory.shift();
        return newHistory;
      });
      setHistoryIndex((prev) => Math.min(prev + 1, 49));
    }, 500);
    return () => clearTimeout(t);
  }, [design]);

  const undo = useCallback(() => {
    setHistoryIndex((idx) => {
      if (idx <= 0) return idx;
      const newIdx = idx - 1;
      skipNextHistoryPush.current = true;
      setDesign(history[newIdx]);
      return newIdx;
    });
  }, [history]);

  const redo = useCallback(() => {
    setHistoryIndex((idx) => {
      if (idx >= history.length - 1) return idx;
      const newIdx = idx + 1;
      skipNextHistoryPush.current = true;
      setDesign(history[newIdx]);
      return newIdx;
    });
  }, [history]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (((e.ctrlKey || e.metaKey) && k === "y") || ((e.ctrlKey || e.metaKey) && e.shiftKey && k === "z")) { e.preventDefault(); redo(); }
      else if ((e.ctrlKey || e.metaKey) && k === "d" && selectedId) { e.preventDefault(); duplicateElement(selectedId); }
      else if (k === "delete" || k === "backspace") {
        if (selectedId) { e.preventDefault(); deleteElement(selectedId); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
     
  }, [undo, redo, selectedId, activeSide, elements]);

  // ── Mutations ──
  const updateEl = useCallback((id: string, updates: Partial<CardElement>) => {
    setDesign((prev) => ({
      ...prev,
      [activeSide]: prev[activeSide].map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }));
  }, [activeSide]);

  const updateConfig = useCallback((updates: Partial<CardConfig>) => {
    setDesign((prev) => ({ ...prev, config: { ...prev.config, ...updates } }));
  }, []);

  const addElement = useCallback((type: ElementType) => {
    const el = createElement(type);
    setDesign((prev) => ({ ...prev, [activeSide]: [...prev[activeSide], el] }));
    setSelectedId(el.id);
     
  }, [activeSide]);

  const deleteElement = useCallback((id: string) => {
    setDesign((prev) => ({ ...prev, [activeSide]: prev[activeSide].filter((e) => e.id !== id) }));
    if (selectedId === id) setSelectedId(null);
     
  }, [activeSide, selectedId]);

  const duplicateElement = useCallback((id: string) => {
    const el = elements.find((e) => e.id === id);
    if (!el) return;
    const copy: CardElement = { ...el, id: uid(), x: el.x + 0.5, y: el.y + 0.5, name: el.name + " (نسخة)" };
    setDesign((prev) => ({ ...prev, [activeSide]: [...prev[activeSide], copy] }));
    setSelectedId(copy.id);
     
  }, [activeSide, elements]);

  const toggleVisible = useCallback((id: string) => {
    const el = elements.find((e) => e.id === id);
    if (el) updateEl(id, { visible: !el.visible });
     
  }, [elements, updateEl]);

  const bringToFront = useCallback((id: string) => {
    setDesign((prev) => {
      const arr = [...prev[activeSide]];
      const idx = arr.findIndex((e) => e.id === id);
      if (idx === -1 || idx === arr.length - 1) return prev;
      const [el] = arr.splice(idx, 1);
      arr.push(el);
      arr.forEach((e, i) => (e.zIndex = i + 1));
      return { ...prev, [activeSide]: arr };
    });
     
  }, [activeSide]);

  const sendToBack = useCallback((id: string) => {
    setDesign((prev) => {
      const arr = [...prev[activeSide]];
      const idx = arr.findIndex((e) => e.id === id);
      if (idx <= 0) return prev;
      const [el] = arr.splice(idx, 1);
      arr.unshift(el);
      arr.forEach((e, i) => (e.zIndex = i + 1));
      return { ...prev, [activeSide]: arr };
    });
     
  }, [activeSide]);

  const applyCardSizePreset = (preset: string) => {
    const p = CARD_SIZE_PRESETS.find((x) => x.value === preset);
    if (p && p.width > 0) updateConfig({ width: p.width, height: p.height });
  };

  // ── Drag & drop with smart guides ──
  const handleElementPointerDown = (e: React.PointerEvent, el: CardElement) => {
    if (el.locked) return;
    if (e.button === 2) return; // context menu handled separately
    e.stopPropagation();
    setSelectedId(el.id);
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const scale = rect.width / cmToPx(design.config.width);
    dragRef.current = {
      id: el.id, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    const move = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = (ev.clientX - dragRef.current.startX) / scale / 37.8;
      const dy = (ev.clientY - dragRef.current.startY) / scale / 37.8;
      let newX = dragRef.current.origX + dx;
      let newY = dragRef.current.origY + dy;
      if (snapToGrid) {
        newX = Math.round(newX / 0.5) * 0.5;
        newY = Math.round(newY / 0.5) * 0.5;
      }
      // Smart guides — snap to centers/edges of other visible elements
      const newGuides = { x: [] as number[], y: [] as number[] };
      if (smartGuides) {
        const others = elements.filter((o) => o.id !== el.id && o.visible);
        const eCx = newX + el.width / 2;
        const eCy = newY + el.height / 2;
        const eL = newX, eR = newX + el.width, eT = newY, eB = newY + el.height;
        const cardCx = design.config.width / 2;
        const cardCy = design.config.height / 2;
        const TOL = 0.15; // 1.5mm
        let snappedX = newX, snappedY = newY;
        for (const o of others) {
          const oCx = o.x + o.width / 2, oCy = o.y + o.height / 2;
          const oL = o.x, oR = o.x + o.width, oT = o.y, oB = o.y + o.height;
          if (Math.abs(eCx - oCx) < TOL) { snappedX = oCx - el.width / 2; newGuides.x.push(oCx); }
          else if (Math.abs(eL - oL) < TOL) { snappedX = oL; newGuides.x.push(oL); }
          else if (Math.abs(eR - oR) < TOL) { snappedX = oR - el.width; newGuides.x.push(oR); }
          if (Math.abs(eCy - oCy) < TOL) { snappedY = oCy - el.height / 2; newGuides.y.push(oCy); }
          else if (Math.abs(eT - oT) < TOL) { snappedY = oT; newGuides.y.push(oT); }
          else if (Math.abs(eB - oB) < TOL) { snappedY = oB - el.height; newGuides.y.push(oB); }
        }
        // Snap to card center
        if (Math.abs(eCx - cardCx) < TOL) { snappedX = cardCx - el.width / 2; newGuides.x.push(cardCx); }
        if (Math.abs(eCy - cardCy) < TOL) { snappedY = cardCy - el.height / 2; newGuides.y.push(cardCy); }
        newX = snappedX; newY = snappedY;
      }
      newX = Math.max(-2, Math.min(design.config.width + 1, newX));
      newY = Math.max(-2, Math.min(design.config.height + 1, newY));
      updateEl(dragRef.current.id, { x: Math.round(newX * 100) / 100, y: Math.round(newY * 100) / 100 });
      setGuides(newGuides);
    };
    const up = (ev: PointerEvent) => {
      dragRef.current = null;
      setGuides({ x: [], y: [] });
      (ev.target as HTMLElement).releasePointerCapture?.(ev.pointerId);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, target: "element" | "bg") => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("حجم الصورة يجب أن يكون أقل من 20MB"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      if (target === "bg") {
        updateConfig({ bgImage: data });
        toast.success("تم رفع خلفية البطاقة");
      } else if (selectedId) {
        updateEl(selectedId, { imageData: data });
        toast.success("تم رفع الصورة");
      } else {
        const el = createElement("uploadedImage");
        el.imageData = data;
        setDesign((prev) => ({ ...prev, [activeSide]: [...prev[activeSide], el] }));
        setSelectedId(el.id);
        toast.success("تم إضافة الصورة");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(design, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `aquacore-card-template-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير القالب");
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.front && data.back && data.config) { setDesign(data); toast.success("تم استيراد القالب"); }
        else throw new Error();
      } catch { toast.error("ملف غير صالح"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleReset = () => {
    if (confirm("إعادة تعيين كامل؟ سيتم فقدان كل التغييرات.")) {
      setDesign(DEFAULT_DESIGN); setSelectedId(null);
      toast.success("تمت إعادة التعيين");
    }
  };

  // ── Templates ──
  const handleSaveTemplateSubmit = async () => {
    if (!templateName.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/card-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName.trim(),
          cardSize: currentPreset,
          orientation: design.config.width >= design.config.height ? "landscape" : "portrait",
          width: design.config.width, height: design.config.height,
          layout: JSON.stringify(design),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("تم حفظ القالب بنجاح");
      setShowSaveTemplate(false); setTemplateName("");
    } catch { toast.error("فشل حفظ القالب"); }
    finally { setGenerating(false); }
  };

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch("/api/card-templates");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch { toast.error("فشل تحميل القوالب"); }
    finally { setLoadingTemplates(false); }
  };

  const handleApplyTemplate = async (id: string) => {
    try {
      const res = await fetch(`/api/card-templates/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const layout = data.template?.layout;
      // layout may be string or already-parsed object
      const parsed = typeof layout === "string" ? JSON.parse(layout) : layout;
      if (parsed && parsed.front && parsed.back && parsed.config) {
        setDesign(parsed);
        setShowLoadTemplate(false);
        toast.success("تم تحميل القالب");
      } else { toast.error("القالب غير صالح"); }
    } catch { toast.error("فشل تحميل القالب"); }
  };

  // ── Export functions ──
  const getSelectedSubs = () => {
    const subs = subscribers.filter((s) => selectedSubIds.includes(s.id));
    if (subs.length === 0) {
      toast.error("اختر منخرطاً واحداً على الأقل");
      return null;
    }
    return subs;
  };

  // ═══════════════════════════════════════════════════════════════
  //  🔑 جلب صور المنخرطين كـ data URLs قبل الطباعة
  //  هذا يضمن ظهور الصور في نافذة الطباعة (التي قد لا ترسل cookies)
  // ═══════════════════════════════════════════════════════════════
  const prepareSubsWithPhotos = async (subs: SubscriberWithComputed[]): Promise<any[]> => {
    const result: any[] = [];
    const photosMap: Record<string, string> = {};
    for (const sub of subs) {
      const photoPath = (sub as unknown as { photoPath?: string | null }).photoPath;
      if (photoPath) {
        try {
          const res = await fetch(`/api/subscribers/${sub.id}/photo?size=cropped&raw=1`);
          if (res.ok) {
            const blob = await res.blob();
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            photosMap[sub.id] = dataUrl;
            result.push({ ...sub, photoDataUrl: dataUrl });
          } else {
            result.push(sub);
          }
        } catch {
          result.push(sub);
        }
      } else {
        result.push(sub);
      }
    }
    // 🔑 حدّث الحالة لتغذية الحاوية المخفية (WYSIWYG)
    setPreparedPhotos(photosMap);
    return result;
  };

  // ═══════════════════════════════════════════════════════════════
  //  🔑 تحويل التصميم الحر (CardDesign) إلى تصميم طباعة مهيكل (PrintDesign)
  //  نستخرج النصوص والألوان من العناصر الحرة، لكن الطباعة تستخدم تخطيط ثابت
  // ═══════════════════════════════════════════════════════════════
  const buildPrintDesign = (): PrintDesign => {
    const c = design.config;
    const findEl = (type: string) => design.front.find((e) => e.type === type) || design.back.find((e) => e.type === type);

    const clubNameEl = findEl("clubName");
    const cardTitleEl = findEl("cardTitle");
    const customTextEl = design.front.find((e) => e.type === "customText");

    const config: PrintCardConfig = {
      bgColor: c.bgColor,
      borderColor: c.borderColor,
      borderWidth: c.borderWidth,
      borderRadius: c.borderRadius,
      accentColor: clubNameEl?.color || "#0f766e",
      subAccentColor: cardTitleEl?.color || "#ca8a04",
      bloodColor: findEl("bloodType")?.color || "#dc2626",
      fontFamily: clubNameEl?.fontFamily || "Cairo",
      showPhoto: !!findEl("photo")?.visible,
      showQR: !!findEl("qr")?.visible,
      showLogo: !!findEl("logo")?.visible,
      showBorders: c.borderWidth > 0,
    };

    const texts: PrintCardTexts = {
      headerText: clubNameEl?.text || "النادي الرياضي",
      subHeaderText: "*- فرع السباحة *-",
      cardTitle: cardTitleEl?.text || "بطاقة الانخراط",
      footerText: "يُمنع الدخول إلى المسبح دون تقديم بطاقة الانخراط.",
      backTitle: design.back.find((e) => e.type === "cardTitle")?.text || "معلومات الاشتراك",
      backInfoTitle: design.back.find((e) => e.type === "cardTitle")?.text || "معلومات الاشتراك",
      backDaysLabel: "أيام السباحة",
      backTimeLabel: "التوقيت",
      backExpiryLabel: "ت.ن.إ",
    };

    return { config, texts };
  };

  // ═══════════════════════════════════════════════════════════════
  //  🔑 WYSIWYG Print/Export — كل العمليات تلتقط CardCanvas من DOM
  //  ما تراه = ما تطبعه. لا توليد HTML منفصل.
  // ═══════════════════════════════════════════════════════════════

  // حاوية طباعة مخفية تعرض CardCanvas لكل منخرط مُحدد (front + back)
  const printContainerRef = useRef<HTMLDivElement | null>(null);

  // 🔑 دالة موحدة لالتقاط كل البطاقات من الحاوية المخفية في JSX
  // الحاوية معروضة ضمن شجرة React الطبيعية (كل contexts متوفرة).
  // نحدّث preparedPhotos ثم ننتظر re-render قبل الالتقاط.
  const captureAllCards = useCallback(async (subs: SubscriberWithComputed[]): Promise<HTMLCanvasElement[]> => {
    // 1) جلب الصور وتحديث الحاوية المخفية
    const subsWithPhotos = await prepareSubsWithPhotos(subs);
    // 2) انتظر حتى يعيد React الرسم (state update + paint)
    await new Promise((r) => setTimeout(r, 600));
    // 3) التقط من الحاوية المخفية
    const container = printContainerRef.current;
    if (!container) {
      console.error("printContainerRef is null");
      return [];
    }
    const cardEls = Array.from(container.querySelectorAll("[data-card]")) as HTMLElement[];
    console.log(`[captureAllCards] found ${cardEls.length} card elements`);
    if (cardEls.length === 0) {
      // fallback: حاوية فارغة — استخدم createRoot مؤقت
      console.warn("No cards in hidden container, falling back to createRoot");
      return captureAllCardsFallback(subsWithPhotos, design);
    }
    const html2canvasMod = await import("html2canvas");
    const html2canvas = html2canvasMod.default;
    const canvases: HTMLCanvasElement[] = [];
    for (const el of cardEls) {
      try {
        const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#fff", useCORS: true, allowTaint: false, logging: false });
        canvases.push(canvas);
      } catch (e) { console.error("card capture failed", e); }
    }
    return canvases;
  }, [design]);

  // Fallback: إذا فشلت الحاوية المخفية، استخدم createRoot مؤقت
  const captureAllCardsFallback = async (subsWithPhotos: any[], designSnapshot: any): Promise<HTMLCanvasElement[]> => {
    const tempContainer = document.createElement("div");
    tempContainer.style.cssText = "position:fixed;left:-99999px;top:0;pointer-events:none;opacity:0;width:400px;";
    document.body.appendChild(tempContainer);
    const { createRoot } = await import("react-dom/client");
    const ReactMod = (await import("react")).default;
    const { CardCanvas } = await import("@/components/card-canvas");
    const root = createRoot(tempContainer);
    await new Promise<void>((resolve) => {
      root.render(
        ReactMod.createElement(
          "div",
          null,
          subsWithPhotos.map((s: any) =>
            ReactMod.createElement(ReactMod.Fragment, { key: s.id },
              ReactMod.createElement(CardCanvas, { design: designSnapshot, side: "front" as const, sub: s, origin: window.location.origin, scale: 1 }),
              ReactMod.createElement(CardCanvas, { design: designSnapshot, side: "back" as const, sub: s, origin: window.location.origin, scale: 1 })
            )
          )
        )
      );
      setTimeout(resolve, 800);
    });
    const cardEls = Array.from(tempContainer.querySelectorAll("[data-card]")) as HTMLElement[];
    console.log(`[fallback] found ${cardEls.length} card elements`);
    const html2canvasMod = await import("html2canvas");
    const html2canvas = html2canvasMod.default;
    const canvases: HTMLCanvasElement[] = [];
    for (const el of cardEls) {
      try {
        const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#fff", useCORS: true, allowTaint: false, logging: false });
        canvases.push(canvas);
      } catch (e) { console.error("fallback card capture failed", e); }
    }
    root.unmount();
    document.body.removeChild(tempContainer);
    return canvases;
  };

  // 1) طباعة مباشرة — يلتقط CardCanvas ويطبع
  const handlePrintDirect = async () => {
    const subs = getSelectedSubs();
    if (!subs) return;
    setGenerating(true);
    try {
      const canvases = await captureAllCards(subs);
      if (canvases.length === 0) { toast.error("لم يتم إنشاء أي بطاقة"); return; }
      const w = window.open("", "_blank");
      if (!w) { toast.error("اسمح بالنوافذ المنبثقة للموقع"); return; }
      const pagesHTML = Array.from({ length: Math.ceil(canvases.length / 8) }).map((_, pageIdx) => {
        const pageCards = canvases.slice(pageIdx * 8, pageIdx * 8 + 8);
        const imgs = pageCards.map((c) => `<img src="${c.toDataURL("image/png")}" style="width:93mm;height:66.25mm;object-fit:contain;" />`).join("");
        return `<div class="print-page">${imgs}</div>`;
      }).join("");
      w.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>طباعة بطاقات — AquaCore</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
@page{size:A4 portrait;margin:10mm;}
body{font-family:'Cairo','Tajawal',Arial,sans-serif;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.print-page{display:grid;grid-template-columns:repeat(2,93mm);grid-template-rows:repeat(4,66.25mm);gap:4mm;width:190mm;page-break-after:always;}
.print-page:last-child{page-break-after:auto;}
@media screen{body{background:#f0f0f0;padding:20px;}.print-page{margin:0 auto 20px;background:#fff;padding:10mm;box-shadow:0 4px 12px rgba(0,0,0,0.15);}}
</style></head><body>${pagesHTML}</body></html>`);
      w.document.close();
      // 🔑 استخدم setTimeout بدلاً من onload (أكثر موثوقية)
      setTimeout(() => { try { w.focus(); w.print(); } catch (e) { console.error(e); } }, 800);
      toast.success(`جاري تحضير ${subs.length} بطاقة للطباعة (WYSIWYG)`);
    } catch (e) { console.error(e); toast.error("فشل الطباعة — تأكد من السماح بالنوافذ المنبثقة"); }
    finally { setGenerating(false); }
  };

  // 2) PDF (بطاقة واحدة) — jsPDF من صورة CardCanvas المرئي
  const handlePrintPDF = async () => {
    const cardEl = cardRef.current;
    if (!cardEl) { toast.error("حدد بطاقة أولاً من المصمم"); return; }
    const previewSub = subscribers.find((s) => s.id === previewSubId) || subscribers[0];
    if (!previewSub) { toast.error("لا يوجد منخرط"); return; }
    setGenerating(true);
    try {
      const fname = `بطاقة_${previewSub.fileNumber || previewSub.lastName}_${Date.now()}.pdf`;
      await exportCardPDF(cardEl, fname);
      toast.success("تم تصدير PDF (WYSIWYG)");
    } catch (e) { console.error(e); toast.error("فشل إنشاء PDF — تحقق من Console"); }
    finally { setGenerating(false); }
  };

  // 3) Word — HTML من نفس CardDesign
  const handleExportWord = async () => {
    const subs = getSelectedSubs();
    if (!subs) return;
    setGenerating(true);
    try {
      const subsWithPhotos = await prepareSubsWithPhotos(subs);
      const fname = `AquaCore_بطاقات_${new Date().toISOString().split("T")[0]}.doc`;
      exportCardWord(subsWithPhotos, design, window.location.origin, fname);
      toast.success(`تم تصدير ${subs.length} بطاقة بصيغة Word`);
    } catch (e) { console.error(e); toast.error("فشل تصدير Word"); }
    finally { setGenerating(false); }
  };

  // 4) PNG — لقطة CardCanvas من DOM (WYSIWYG تام)
  const handleExportPNG = async () => {
    const cardEl = cardRef.current;
    if (!cardEl) { toast.error("حدد بطاقة أولاً من المصمم"); return; }
    const previewSub = subscribers.find((s) => s.id === previewSubId) || subscribers[0];
    if (!previewSub) { toast.error("لا يوجد منخرط"); return; }
    setGenerating(true);
    try {
      const fname = `بطاقة_${previewSub.fileNumber || previewSub.lastName}_${Date.now()}.png`;
      await exportCardPNG(cardEl, fname);
      toast.success("تم تصدير PNG (WYSIWYG)");
    } catch (e) { console.error(e); toast.error("فشل تصدير PNG — تحقق من Console"); }
    finally { setGenerating(false); }
  };

  // 5) A4 PDF (8 بطاقات) — يلتقط CardCanvas لكل منخرط ويرتبها في A4
  const handleExportA4 = async () => {
    const subs = getSelectedSubs();
    if (!subs) return;
    setGenerating(true);
    try {
      const canvases = await captureAllCards(subs);
      if (canvases.length === 0) { toast.error("لم يتم إنشاء أي بطاقة"); return; }
      const fname = `AquaCore_8بطاقات_A4_${new Date().toISOString().split("T")[0]}.pdf`;
      await exportA4PDF(canvases, fname, { cols: 2, rows: 4, cardWidthMM: 93, cardHeightMM: 66.25, gapMM: 4 });
      toast.success(`تم تصدير ${subs.length} بطاقة في A4 (WYSIWYG)`);
    } catch (e) { console.error(e); toast.error("فشل تصدير A4 — تحقق من Console"); }
    finally { setGenerating(false); }
  };

  // ── Members filtering ──
  const filteredSubs = useMemo(() => {
    let result = subscribers.filter((s) => {
      if (search) {
        const q = search.toLowerCase();
        if (!(
          s.lastName.toLowerCase().includes(q) ||
          s.firstName.toLowerCase().includes(q) ||
          s.fileNumber.toLowerCase().includes(q) ||
          (s.subscriptionType || "").toLowerCase().includes(q)
        )) return false;
      }
      if (subFilter && s.subscriptionType !== subFilter) return false;
      if (genderFilter && s.gender !== genderFilter) return false;
      if (statusFilter && s.renewalStatus !== statusFilter) return false;
      return true;
    });
    result.sort((a, b) => a.fileNumber.localeCompare(b.fileNumber, undefined, { numeric: true }));
    return result;
  }, [subscribers, search, subFilter, genderFilter, statusFilter]);

  const toggleSubSelect = (id: string) => {
    setSelectedSubIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
    setPreviewSubId(id);
  };

  // ── Rename handler ──
  const handleRenameSave = () => {
    if (renameTarget && renameValue.trim()) {
      updateEl(renameTarget.id, { name: renameValue.trim() });
      toast.success("تم إعادة التسمية");
    }
    setRenameTarget(null);
  };

  // ── Keyboard clipboard ops (Ctrl+C/V) ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && selectedId) {
        const el = elements.find((x) => x.id === selectedId);
        if (el) { clipboardRef.current = { ...el }; toast.success("تم النسخ"); }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v" && clipboardRef.current) {
        const c = clipboardRef.current;
        const pasted: CardElement = { ...c, id: uid(), x: c.x + 0.5, y: c.y + 0.5, name: c.name + " (لصق)" };
        setDesign((prev) => ({ ...prev, [activeSide]: [...prev[activeSide], pasted] }));
        setSelectedId(pasted.id);
        toast.success("تم اللصق");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
     
  }, [selectedId, elements, activeSide]);

  // ── Render helpers ──
  const renderCanvas = (side: "front" | "back") => {
    const sideElements = side === "front" ? design.front : design.back;
    const config = design.config;
    const naturalW = cmToPx(config.width);
    const naturalH = cmToPx(config.height);
    const scale = zoom === "fit" ? Math.min(1, (cardRef.current?.parentElement?.clientWidth ?? naturalW) / naturalW) : zoom / 100;
    const gradientDir = config.gradientDirection === "horizontal" ? "to right" : config.gradientDirection === "vertical" ? "to bottom" : "to bottom right";
    const bgStyle: React.CSSProperties = config.bgImage
      ? { backgroundColor: config.bgColor, backgroundImage: `url(${config.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" }
      : config.gradientEnabled
        ? { background: `linear-gradient(${gradientDir}, ${config.gradientStart || "#0f766e"}, ${config.gradientEnd || "#0369a1"})` }
        : { backgroundColor: config.bgColor };

    return (
      <div className="flex flex-col items-center gap-2">
        {viewMode === "both" && (
          <Badge variant="outline" className="text-[10px] bg-white/70 backdrop-blur">
            {side === "front" ? "الواجهة الأمامية" : "الواجهة الخلفية"}
          </Badge>
        )}
        <div
          className="relative shadow-2xl rounded-xl overflow-hidden"
          data-card={side}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
          style={{
            width: `${naturalW}px`, height: `${naturalH}px`,
            transform: `scale(${scale})`, transformOrigin: "top center",
            ...bgStyle,
            opacity: config.bgOpacity / 100,
            border: `${config.borderWidth}px ${config.borderStyle} ${config.borderColor}`,
            borderRadius: `${config.borderRadius}px`,
            direction: "rtl",
          }}
          ref={side === activeSide ? cardRef : undefined}
        >
          {/* Background image overlay */}
          {config.bgImage && (
            <div className="absolute inset-0 pointer-events-none"
              style={{ backgroundColor: config.bgColor, opacity: 1 - (config.bgImageOpacity ?? 30) / 100 }} />
          )}
          {/* Grid overlay */}
          {showGrid && (
            <div className="absolute inset-0 pointer-events-none" style={{
              zIndex: 9999,
              backgroundImage: `linear-gradient(to right, rgba(15,118,110,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,118,110,0.18) 1px, transparent 1px)`,
              backgroundSize: `${0.5 * 37.8}px ${0.5 * 37.8}px`,
            }} />
          )}
          {/* Watermark on back */}
          {side === "back" && (
            <img src="/images/rcs-logo-official.png" alt=""
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-3/4 w-3/4 object-contain pointer-events-none"
              style={{ opacity: 0.1 }}
              onError={(e) => { e.currentTarget.style.display = "none"; }} />
          )}
          {/* Smart guides */}
          {guides.x.map((gx, i) => (
            <div key={`gx${i}`} className="absolute pointer-events-none" style={{
              left: `${gx * 37.8}px`, top: 0, bottom: 0, width: "1px",
              background: "#ec4899", zIndex: 9998, boxShadow: "0 0 4px rgba(236,72,153,0.6)",
            }} />
          ))}
          {guides.y.map((gy, i) => (
            <div key={`gy${i}`} className="absolute pointer-events-none" style={{
              top: `${gy * 37.8}px`, left: 0, right: 0, height: "1px",
              background: "#ec4899", zIndex: 9998, boxShadow: "0 0 4px rgba(236,72,153,0.6)",
            }} />
          ))}
          {/* Elements */}
          {sideElements.filter((e) => e.visible).sort((a, b) => a.zIndex - b.zIndex).map((el) => {
            const isSelected = side === activeSide && selectedId === el.id;
            const showText = isTextType(el.type);
            const showImg = isImageType(el.type);
            const showCode = isCodeType(el.type);
            return (
              <div
                key={el.id}
                onPointerDown={(e) => side === activeSide ? handleElementPointerDown(e, el) : undefined}
                onDoubleClick={() => {
                  if (side !== activeSide) { setActiveSide(side); setSelectedId(el.id); return; }
                  setRenameTarget(el); setRenameValue(el.name);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (side !== activeSide) setActiveSide(side);
                  setSelectedId(el.id);
                }}
                className={cn(
                  "absolute flex items-center select-none transition-shadow",
                  el.locked ? "cursor-default" : "cursor-move",
                  isSelected && "ring-2 ring-sky-500 ring-offset-1",
                  el.shadow && "shadow-lg",
                )}
                style={{
                  left: `${el.x * 37.8}px`, top: `${el.y * 37.8}px`,
                  width: `${el.width * 37.8}px`, height: `${el.height * 37.8}px`,
                  transform: `rotate(${el.rotation}deg)`,
                  opacity: el.opacity / 100,
                  zIndex: el.zIndex,
                  justifyContent: el.textAlign === "center" ? "center" : el.textAlign === "left" ? "flex-start" : "flex-end",
                  direction: "rtl", overflow: "hidden",
                  backgroundColor: el.bgColor ? `${el.bgColor}${alphaHex(el.bgOpacity ?? 100)}` : undefined,
                  border: el.borderWidth ? `${el.borderWidth}px ${el.borderStyle} ${el.borderColor}` : undefined,
                  borderRadius: el.shapeKind === "circle" ? "50%" : `${el.borderRadius || 0}px`,
                  padding: "0 4px",
                }}
              >
                {showCode && el.type === "qr" && (
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(previewSub?.fileNumber || "RCS")}&color=000000&bgcolor=ffffff`}
                    alt="QR" className="w-full h-full object-contain" draggable={false} />
                )}
                {showCode && el.type === "barcode" && (
                  <img src={`https://api.qrserver.com/v1/create-barcode/?data=${encodeURIComponent(previewSub?.fileNumber || "RCS")}&type=code128`}
                    alt="barcode" className="w-full h-full object-contain" draggable={false} />
                )}
                {showImg && el.type === "logo" && (
                  <img src="/images/rcs-logo-official.png" alt="logo" className="w-full h-full object-contain"
                    onError={(e) => { e.currentTarget.style.display = "none"; }} draggable={false} />
                )}
                {showImg && el.type === "uploadedImage" && (
                  el.imageData
                    ? <img src={el.imageData} alt="img" className="w-full h-full object-contain" draggable={false} />
                    : <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs">صورة</div>
                )}
                {showImg && el.type === "photo" && (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs overflow-hidden relative"
                    style={{
                      borderRadius: el.shapeKind === "circle" ? "50%" : (el.borderRadius || 8),
                      border: el.borderWidth ? `${el.borderWidth}px ${el.borderStyle || "solid"} ${el.borderColor || "#000"}` : undefined,
                      boxShadow: el.shadow ? "0 2px 8px rgba(0,0,0,0.15)" : undefined,
                    }}>
                    {el.imageData ? (
                      <img src={el.imageData} alt="عضو" className="w-full h-full object-cover" draggable={false} />
                    ) : previewSub && getSubPhotoPath(previewSub) ? (
                      <img
                        src={`/api/subscribers/${previewSub.id}/photo?size=cropped&raw=1`}
                        alt="صورة المنخرط"
                        className="absolute inset-0 w-full h-full object-cover"
                        draggable={false}
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    ) : (
                      <User className="h-1/2 w-1/2 opacity-40" />
                    )}
                  </div>
                )}
                {el.type === "shape" && <div className="w-full h-full" />}
                {showText && (
                  <span style={{
                    fontFamily: `${el.fontFamily}, Arial, sans-serif`,
                    fontSize: `${el.fontSize}px`,
                    fontWeight: el.fontWeight as React.CSSProperties["fontWeight"],
                    color: el.color,
                    textAlign: el.textAlign as React.CSSProperties["textAlign"],
                    width: "100%", lineHeight: 1.3, wordBreak: "break-word",
                  }}>
                    {(el.showLabel ? (el.labelText || "") : "") + getContent(el, previewSub)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ─────────────────────────── RENDER ───────────────────────────

  const isMobile = breakpoint === "mobile";

  return (
    <TooltipProvider delayDuration={300}>
      <div
        dir="rtl"
        className={cn(
          "flex flex-col h-screen overflow-hidden font-sans text-foreground transition-colors",
          "bg-gradient-to-br from-slate-100 via-sky-50 to-teal-50",
          darkMode && "dark bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-blue-950",
        )}
      >
        {/* ════════════ 1. TOP TOOLBAR (floating glassmorphism) ════════════ */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="m-3 mb-2 rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-xl"
        >
          <div className="flex items-center gap-2 px-3 py-2 flex-wrap">
            {/* Logo */}
            <div className="flex items-center gap-2 px-2">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-teal-500 via-sky-500 to-blue-600 flex items-center justify-center shadow-lg">
                <Droplets className="h-4 w-4 text-white" />
              </div>
              <div className="hidden sm:block leading-tight">
                <div className="text-sm font-bold bg-gradient-to-l from-teal-600 to-sky-600 bg-clip-text text-transparent">AquaCore</div>
                <div className="text-[9px] text-muted-foreground">مصمم البطاقات الاحترافي</div>
              </div>
            </div>

            {onBack && (
              <Button variant="ghost" size="sm" onClick={onBack} className="h-8 text-xs">
                رجوع
              </Button>
            )}

            <Separator orientation="vertical" className="h-6 mx-1 hidden sm:block" />

            {/* Undo / Redo */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={undo} disabled={historyIndex <= 0} className="h-8 w-8 p-0">
                  <Undo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">تراجع (Ctrl+Z)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={redo} disabled={historyIndex >= history.length - 1} className="h-8 w-8 p-0">
                  <Redo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">إعادة (Ctrl+Y)</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-6 mx-1 hidden sm:block" />

            {/* Front / Back / Both toggle */}
            <div className="flex items-center bg-muted/50 rounded-lg p-0.5">
              {(["front","back","both"] as const).map((v) => (
                <button key={v} onClick={() => { setViewMode(v); if (v !== "both") setActiveSide(v); }}
                  className={cn("px-2 sm:px-3 py-1 rounded-md text-[11px] font-semibold transition",
                    viewMode === v ? "bg-gradient-to-l from-teal-500 to-sky-500 text-white shadow" : "hover:bg-accent")}>
                  {v === "front" ? "أمامي" : v === "back" ? "خلفي" : "الاثنين"}
                </button>
              ))}
            </div>

            <Separator orientation="vertical" className="h-6 mx-1 hidden sm:block" />

            {/* Templates */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => setShowSaveTemplate(true)} className="h-8 px-2">
                  <Save className="h-4 w-4" /> <span className="hidden md:inline mr-1 text-xs">حفظ قالب</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">حفظ كقالب</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => { fetchTemplates(); setShowLoadTemplate(true); }} className="h-8 w-8 p-0">
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">تحميل قالب</TooltipContent>
            </Tooltip>

            <input ref={fileTemplateRef} type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => fileTemplateRef.current?.click()} className="h-8 w-8 p-0 hidden sm:flex">
                  <Upload className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">استيراد JSON</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={handleExportJSON} className="h-8 w-8 p-0 hidden sm:flex">
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">تصدير JSON</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-6 mx-1 hidden sm:block" />

            {/* ═══ 4 أزرار طباعة احترافية ═══ */}
            <div className="flex items-center gap-1">
              {/* 1) طباعة مباشرة */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    onClick={handlePrintDirect}
                    disabled={generating}
                    className="h-8 bg-teal-700 hover:bg-teal-800 text-white gap-1"
                  >
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                    <span className="text-xs">طباعة</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">طباعة مباشرة (Recto/Verso — 8/A4)</TooltipContent>
              </Tooltip>

              {/* 2) PDF */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handlePrintPDF}
                    disabled={generating}
                    className="h-8 gap-1 border-red-300 text-red-700 hover:bg-red-50"
                  >
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    <span className="text-xs">PDF</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">حفظ كـ PDF (Recto/Verso)</TooltipContent>
              </Tooltip>

              {/* 3) Word */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportWord}
                    disabled={generating}
                    className="h-8 gap-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                  >
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    <span className="text-xs">Word</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">تصدير Word قابل للتحرير</TooltipContent>
              </Tooltip>

              {/* 4) PNG */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportPNG}
                    disabled={generating}
                    className="h-8 gap-1 border-green-300 text-green-700 hover:bg-green-50"
                  >
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                    <span className="text-xs">PNG</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">تصدير صورة PNG عالية الدقة (البطاقة المعروضة)</TooltipContent>
              </Tooltip>

              {/* 5) A4 (8 بطاقات) */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportA4}
                    disabled={generating}
                    className="h-8 gap-1 border-purple-300 text-purple-700 hover:bg-purple-50"
                  >
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Grid3x3 className="h-4 w-4" />}
                    <span className="text-xs">A4</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">تصدير 8 بطاقات في صفحة A4 (WYSIWYG)</TooltipContent>
              </Tooltip>
            </div>

            {/* Preview */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(true)} className="h-8 w-8 p-0">
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">معاينة</TooltipContent>
            </Tooltip>

            {/* Settings */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)} className="h-8 w-8 p-0">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">إعدادات البطاقة</TooltipContent>
            </Tooltip>

            {/* Dark mode */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => setDarkMode((d) => !d)} className="h-8 w-8 p-0">
                  {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">الوضع الليلي</TooltipContent>
            </Tooltip>

            <div className="flex-1" />

            {/* Sidebar toggles (desktop/tablet) */}
            {!isMobile && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => setLeftSidebarOpen((o) => !o)} className="h-8 w-8 p-0">
                      {leftSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">الشريط الجانبي الأيسر</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => setRightSidebarOpen((o) => !o)} className="h-8 w-8 p-0">
                      {rightSidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">الشريط الجانبي الأيمن</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </motion.div>

        {/* ════════════ MAIN AREA: 3 columns ════════════ */}
        <div className="flex flex-1 overflow-hidden gap-2 px-2 pb-2">
          {/* ───── 2. LEFT SIDEBAR — Members ───── */}
          {(!isMobile && leftSidebarOpen) && (
            <motion.aside
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="w-80 shrink-0 rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-lg overflow-hidden flex flex-col"
            >
              <MembersSidebar
                subscribers={filteredSubs}
                allSubscribersCount={subscribers.length}
                selectedSubIds={selectedSubIds}
                previewSubId={previewSubId}
                onToggle={toggleSubSelect}
                onSelectAll={() => setSelectedSubIds(filteredSubs.map((s) => s.id))}
                onClearAll={() => setSelectedSubIds([])}
                search={search} setSearch={setSearch}
                subFilter={subFilter} setSubFilter={setSubFilter}
                genderFilter={genderFilter} setGenderFilter={setGenderFilter}
                statusFilter={statusFilter} setStatusFilter={setStatusFilter}
                subTypes={subTypes}
              />
            </motion.aside>
          )}

          {/* ───── 3. CENTER WORKSPACE ───── */}
          <main className="flex-1 flex flex-col rounded-2xl bg-slate-200/60 dark:bg-slate-950/40 backdrop-blur-sm border border-white/30 dark:border-white/5 shadow-inner overflow-hidden">
            {/* Canvas toolbar */}
            <div className="flex items-center gap-1 px-3 py-2 border-b border-white/20 dark:border-white/5 bg-white/40 dark:bg-slate-900/40 backdrop-blur flex-wrap">
              <Badge variant="outline" className="text-[10px] bg-white/60 dark:bg-slate-900/60">
                <CreditCard className="h-3 w-3 ml-1" /> {design.config.width}×{design.config.height}سم
              </Badge>
              <Badge variant="outline" className="text-[10px] bg-white/60 dark:bg-slate-900/60">
                {currentPreset}
              </Badge>

              <div className="flex-1" />

              {/* Grid + Snap + Guides */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant={showGrid ? "default" : "ghost"} size="sm" onClick={() => setShowGrid((g) => !g)} className="h-8 w-8 p-0">
                    <Grid3x3 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">شبكة</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant={snapToGrid ? "default" : "ghost"} size="sm" onClick={() => setSnapToGrid((s) => !s)} className="h-8 w-8 p-0">
                    <Magnet className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">محاذاة للشبكة</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant={smartGuides ? "default" : "ghost"} size="sm" onClick={() => setSmartGuides((g) => !g)} className="h-8 w-8 p-0">
                    <Wand2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">أدلة ذكية</TooltipContent>
              </Tooltip>

              <Separator orientation="vertical" className="h-6 mx-1" />

              {/* Zoom controls */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => setZoom((z) => z === "fit" ? 0.5 : z === 0.5 ? 0.75 : Math.max(0.25, (typeof z === "number" ? z : 1) - 0.25))} className="h-8 w-8 p-0">
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">تصغير</TooltipContent>
              </Tooltip>
              <button
                onClick={() => setZoom("fit")}
                className="px-2 h-8 rounded-md text-[11px] font-semibold bg-muted/50 hover:bg-accent min-w-[60px]"
              >
                {zoom === "fit" ? "ملاءمة" : `${Math.round((zoom as number) * 100)}%`}
              </button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => setZoom((z) => {
                    const cur = z === "fit" ? 1 : z;
                    return Math.min(3, cur + 0.25);
                  })} className="h-8 w-8 p-0">
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">تكبير</TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <Maximize className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem onClick={() => setZoom("fit")} className="text-xs cursor-pointer">ملاءمة</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setZoom(1)} className="text-xs cursor-pointer">100%</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setZoom(1.5)} className="text-xs cursor-pointer">150%</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setZoom(2)} className="text-xs cursor-pointer">200%</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Canvas area */}
            <ScrollArea className="flex-1">
              <div className="min-h-full flex flex-col items-center justify-start p-6 sm:p-10 gap-6">
                {viewMode === "both" ? (
                  <div className="flex flex-col lg:flex-row gap-8 items-center">
                    {renderCanvas("front")}
                    {renderCanvas("back")}
                  </div>
                ) : (
                  renderCanvas(viewMode)
                )}
                <p className="text-xs text-muted-foreground text-center mt-4">
                  اسحب العناصر لتحريكها • نقر مزدوج لإعادة التسمية • Ctrl+Z تراجع • Ctrl+D تكرار • Delete حذف
                </p>
              </div>
            </ScrollArea>

            {/* Add elements bar */}
            <div className="border-t border-white/20 dark:border-white/5 bg-white/40 dark:bg-slate-900/40 backdrop-blur px-3 py-2">
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-1.5 pb-1">
                  {ELEMENT_LIBRARY.map((el) => {
                    const Icon = el.icon;
                    return (
                      <button
                        key={el.type}
                        onClick={() => addElement(el.type)}
                        title={el.label}
                        className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-white/40 dark:border-white/5 hover:border-teal-400/60 hover:bg-teal-50/60 dark:hover:bg-teal-900/20 transition shrink-0"
                      >
                        <Icon className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                        <span className="text-[9px] text-muted-foreground">{el.label}</span>
                      </button>
                    );
                  })}
                  <input ref={fileImageRef} type="file" accept="image/png,image/jpeg,image/jpg" onChange={(e) => handleImageUpload(e, "element")} className="hidden" />
                  <button
                    onClick={() => fileImageRef.current?.click()}
                    title="رفع صورة"
                    className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-white/40 dark:border-white/5 hover:border-teal-400/60 hover:bg-teal-50/60 dark:hover:bg-teal-900/20 transition shrink-0"
                  >
                    <Upload className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    <span className="text-[9px] text-muted-foreground">رفع صورة</span>
                  </button>
                </div>
              </ScrollArea>
            </div>
          </main>

          {/* ───── 4. RIGHT SIDEBAR — Properties ───── */}
          {(!isMobile && rightSidebarOpen) && (
            <motion.aside
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="w-72 shrink-0 rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-lg overflow-hidden"
            >
              <RightSidebar
                design={design}
                activeSide={activeSide}
                selected={selected}
                updateEl={updateEl}
                updateConfig={updateConfig}
                addElement={addElement}
                deleteElement={deleteElement}
                duplicateElement={duplicateElement}
                toggleVisible={toggleVisible}
                bringToFront={bringToFront}
                sendToBack={sendToBack}
                setSelectedId={setSelectedId}
                selectedId={selectedId}
                onRename={(el) => { setRenameTarget(el); setRenameValue(el.name); }}
                currentPreset={currentPreset}
                applyCardSizePreset={applyCardSizePreset}
                fileImageRef={fileImageRef}
                fileBgRef={fileBgRef}
                handleImageUpload={handleImageUpload}
              />
            </motion.aside>
          )}
        </div>

        {/* ════════════ MOBILE: bottom navigation bar ════════════ */}
        {isMobile && (
          <div className="flex border-t border-white/30 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shrink-0">
            <MobileTabButton icon={Users} label="الأعضاء" onClick={() => setMembersSheetOpen(true)} />
            <MobileTabButton icon={Layers} label="العناصر" badge={elements.length} onClick={() => setElementsSheetOpen(true)} />
            <MobileTabButton icon={Palette} label="خصائص" disabled={!selected} onClick={() => selected ? setPropsSheetOpen(true) : toast.info("اختر عنصراً أولاً")} />
            <MobileTabButton icon={Settings2} label="إعدادات" onClick={() => setShowSettings(true)} />
          </div>
        )}

        {/* ════════════ MOBILE SHEETS ════════════ */}
        {isMobile && (
          <>
            <Sheet open={membersSheetOpen} onOpenChange={setMembersSheetOpen}>
              <SheetContent side="bottom" className="h-[85vh] p-0">
                <SheetHeader className="px-4 py-3 border-b bg-gradient-to-l from-teal-600 to-sky-700 text-white">
                  <SheetTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> قائمة المنخرطين</SheetTitle>
                </SheetHeader>
                <div className="overflow-y-auto h-[calc(100%-56px)]">
                  <MembersSidebar
                    subscribers={filteredSubs}
                    allSubscribersCount={subscribers.length}
                    selectedSubIds={selectedSubIds}
                    previewSubId={previewSubId}
                    onToggle={toggleSubSelect}
                    onSelectAll={() => setSelectedSubIds(filteredSubs.map((s) => s.id))}
                    onClearAll={() => setSelectedSubIds([])}
                    search={search} setSearch={setSearch}
                    subFilter={subFilter} setSubFilter={setSubFilter}
                    genderFilter={genderFilter} setGenderFilter={setGenderFilter}
                    statusFilter={statusFilter} setStatusFilter={setStatusFilter}
                    subTypes={subTypes}
                  />
                </div>
              </SheetContent>
            </Sheet>
            <Sheet open={elementsSheetOpen} onOpenChange={setElementsSheetOpen}>
              <SheetContent side="bottom" className="h-[70vh] p-0">
                <SheetHeader className="px-4 py-3 border-b bg-gradient-to-l from-teal-600 to-sky-700 text-white">
                  <SheetTitle className="flex items-center gap-2"><Layers className="h-5 w-5" /> العناصر</SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-[calc(100%-56px)]">
                  <div className="p-3">
                    <div className="grid grid-cols-4 gap-1.5 mb-3">
                      {ELEMENT_LIBRARY.map((el) => {
                        const Icon = el.icon;
                        return (
                          <button key={el.type} onClick={() => { addElement(el.type); setElementsSheetOpen(false); }}
                            className="flex flex-col items-center gap-0.5 p-2 rounded-lg border border-border hover:bg-accent transition">
                            <Icon className="h-4 w-4 text-teal-600" />
                            <span className="text-[9px]">{el.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <Separator className="my-2" />
                    <LayersList
                      elements={elements} selectedId={selectedId} setSelectedId={(id) => { setSelectedId(id); setElementsSheetOpen(false); }}
                      toggleVisible={toggleVisible} deleteElement={deleteElement}
                      duplicateElement={duplicateElement} bringToFront={bringToFront} sendToBack={sendToBack}
                      onRename={(el) => { setRenameTarget(el); setRenameValue(el.name); }}
                    />
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
            <Sheet open={propsSheetOpen} onOpenChange={setPropsSheetOpen}>
              <SheetContent side="bottom" className="h-[85vh] p-0">
                <SheetHeader className="px-4 py-3 border-b bg-gradient-to-l from-teal-600 to-sky-700 text-white">
                  <SheetTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> {selected?.name || "خصائص"}</SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-[calc(100%-56px)]">
                  {selected ? (
                    <PropertiesContent
                      selected={selected} updateEl={updateEl} updateConfig={updateConfig}
                      bringToFront={bringToFront} sendToBack={sendToBack}
                      currentPreset={currentPreset} applyCardSizePreset={applyCardSizePreset}
                      design={design}
                    />
                  ) : (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p>اختر عنصراً لعرض خصائصه</p>
                    </div>
                  )}
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </>
        )}

        {/* ════════════ DIALOGS ════════════ */}
        {/* Settings */}
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Settings2 className="h-5 w-5 text-teal-600" /> إعدادات البطاقة
              </DialogTitle>
            </DialogHeader>
            <CardSettingsContent design={design} updateConfig={updateConfig}
              currentPreset={currentPreset} applyCardSizePreset={applyCardSizePreset}
              fileBgRef={fileBgRef} handleImageUpload={handleImageUpload} />
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={handleReset} className="text-rose-600 hover:bg-rose-50">
                <Trash2 className="h-4 w-4 ml-1" /> إعادة تعيين
              </Button>
              <Button onClick={() => setShowSettings(false)}>تم</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Save template */}
        <Dialog open={showSaveTemplate} onOpenChange={setShowSaveTemplate}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Save className="h-5 w-5 text-teal-600" /> حفظ كقالب
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">
              سيتم حفظ التصميم الحالي ({design.config.width}×{design.config.height}سم) كقالب قابل لإعادة الاستخدام.
            </p>
            <Input placeholder="اسم القالب" value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveTemplateSubmit(); }} autoFocus />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSaveTemplate(false)}>إلغاء</Button>
              <Button onClick={handleSaveTemplateSubmit} disabled={!templateName.trim() || generating}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Load template */}
        <Dialog open={showLoadTemplate} onOpenChange={setShowLoadTemplate}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <FolderOpen className="h-5 w-5 text-teal-600" /> تحميل قالب
              </DialogTitle>
            </DialogHeader>
            {loadingTemplates ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
              </div>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد قوالب محفوظة</p>
            ) : (
              <ScrollArea className="max-h-80">
                <div className="space-y-2">
                  {templates.map((t: any) => (
                    <button key={t.id} onClick={() => handleApplyTemplate(t.id)}
                      className="w-full text-right p-3 rounded-lg border hover:bg-accent hover:border-teal-400/40 transition">
                      <div className="font-semibold text-sm">{t.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {t.cardSize || "custom"} • {t.width}×{t.height}سم
                        {t.isShared && <span className="text-teal-600"> • مشترك</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowLoadTemplate(false)}>إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rename */}
        <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Pencil className="h-5 w-5 text-teal-600" /> إعادة تسمية العنصر
              </DialogTitle>
            </DialogHeader>
            <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleRenameSave(); }} autoFocus />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRenameTarget(null)}>إلغاء</Button>
              <Button onClick={handleRenameSave}>حفظ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview modal */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Eye className="h-5 w-5 text-teal-600" /> معاينة البطاقة
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-6 max-h-[70vh] overflow-y-auto p-2">
              <div>
                <Badge variant="outline" className="mb-2 text-[10px]">الواجهة الأمامية</Badge>
                {renderCanvas("front")}
              </div>
              <div>
                <Badge variant="outline" className="mb-2 text-[10px]">الواجهة الخلفية</Badge>
                {renderCanvas("back")}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Hidden file inputs (desktop) */}
        <input ref={fileBgRef} type="file" accept="image/png,image/jpeg" onChange={(e) => handleImageUpload(e, "bg")} className="hidden" />

        {/* ═══ WYSIWYG Print Container (مخفي) ═══
            يعرض CardCanvas لكل منخرط مُحدد (front + back).
            يُستخدم من: handlePrintDirect + handleExportA4.
            نفس مكوّن React = نفس النتيجة في الطباعة والتصدير. */}
        <div
          ref={printContainerRef}
          aria-hidden
          style={{ position: "fixed", left: "-99999px", top: 0, pointerEvents: "none" }}
        >
          {selectedSubIds.map((id) => {
            const s = subscribers.find((x) => x.id === id);
            if (!s) return null;
            const sWithPhoto = preparedPhotos[id] ? { ...s, photoDataUrl: preparedPhotos[id] } : s;
            return (
              <React.Fragment key={id}>
                <CardCanvas design={design} side="front" sub={sWithPhoto} origin={window.location.origin} scale={1} />
                <CardCanvas design={design} side="back" sub={sWithPhoto} origin={window.location.origin} scale={1} />
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}

// ════════════════════════════ MEMBERS SIDEBAR ════════════════════════════

function MembersSidebar({
  subscribers, allSubscribersCount, selectedSubIds, previewSubId,
  onToggle, onSelectAll, onClearAll, search, setSearch,
  subFilter, setSubFilter, genderFilter, setGenderFilter,
  statusFilter, setStatusFilter, subTypes,
}: {
  subscribers: SubscriberWithComputed[];
  allSubscribersCount: number;
  selectedSubIds: string[];
  previewSubId: string | null;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  search: string; setSearch: (s: string) => void;
  subFilter: string; setSubFilter: (s: string) => void;
  genderFilter: string; setGenderFilter: (s: string) => void;
  statusFilter: string; setStatusFilter: (s: string) => void;
  subTypes: any[];
}) {
  const getTypeColor = (code: string) => subTypes.find((st: any) => st.code === code)?.color || "#0d9488";
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-white/20 dark:border-white/5 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm flex items-center gap-1.5">
            <Users className="h-4 w-4 text-teal-600" /> المنخرطون
          </h3>
          <Badge variant="secondary" className="text-[10px]">{selectedSubIds.length}/{allSubscribersCount}</Badge>
        </div>

        <div className="relative">
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="بحث بالاسم أو الرقم..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="h-8 pr-7 text-xs" />
        </div>

        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setSubFilter("")}
            className={cn("px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap transition",
              !subFilter ? "bg-teal-600 text-white" : "bg-muted hover:bg-accent")}>الكل</button>
          {subTypes.slice(0, 6).map((t: any) => (
            <button key={t.code} onClick={() => setSubFilter(t.code)}
              className={cn("px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap transition border",
                subFilter === t.code ? "text-white" : "bg-muted hover:bg-accent")}
              style={subFilter === t.code ? { backgroundColor: t.color, borderColor: t.color } : { borderColor: t.color + "40" }}>
              {t.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-1">
          <Select value={genderFilter || "all"} onValueChange={(v) => setGenderFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="h-7 text-[10px]"><SelectValue placeholder="الجنس" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">كل الأجناس</SelectItem>
              <SelectItem value="ذكر" className="text-xs">ذكر</SelectItem>
              <SelectItem value="أنثى" className="text-xs">أنثى</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="h-7 text-[10px]"><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">كل الحالات</SelectItem>
              <SelectItem value="مدفوع" className="text-xs">مدفوع</SelectItem>
              <SelectItem value="لم يدفع" className="text-xs">لم يدفع</SelectItem>
              <SelectItem value="تأمين فقط" className="text-xs">تأمين فقط</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2 flex-1" onClick={onSelectAll}>تحديد الكل</Button>
          <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2 flex-1" onClick={onClearAll}>إلغاء التحديد</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ minHeight: "200px", maxHeight: "calc(100vh - 340px)" }}>
        {subscribers.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            <User className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>لا توجد نتائج</p>
          </div>
        ) : (
          <div className="divide-y divide-white/10 dark:divide-white/5">
            {subscribers.map((s) => {
              const isSelected = selectedSubIds.includes(s.id);
              const isPreview = previewSubId === s.id;
              const typeColor = getTypeColor(s.subscriptionType);
              return (
                <button key={s.id} onClick={() => onToggle(s.id)}
                  className={cn("w-full flex items-start gap-2 p-2.5 text-right transition",
                    isPreview ? "bg-teal-500/10 ring-1 ring-teal-500/30" : "hover:bg-accent/40")}>
                  <div className={cn("h-4 w-4 rounded border-2 flex items-center justify-center mt-0.5 shrink-0",
                    isSelected ? "bg-teal-600 border-teal-600 text-white" : "border-border")}>
                    {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] font-bold text-teal-700 dark:text-teal-400 truncate">{s.fileNumber}</span>
                      <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: typeColor }} />
                    </div>
                    <p className="text-xs font-semibold truncate">{s.lastName} {s.firstName}</p>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground flex-wrap">
                      <span>{s.subscriptionType}</span>
                      <span>•</span>
                      <span>{s.age} سنة</span>
                      {s.gender && (<><span>•</span><span>{s.gender}</span></>)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════ RIGHT SIDEBAR ════════════════════════════

function RightSidebar({
  design, activeSide, selected, updateEl, updateConfig, addElement, deleteElement,
  duplicateElement, toggleVisible, bringToFront, sendToBack, setSelectedId, selectedId,
  onRename, currentPreset, applyCardSizePreset, fileImageRef, fileBgRef, handleImageUpload,
}: {
  design: CardDesign;
  activeSide: "front" | "back";
  selected: CardElement | null;
  updateEl: (id: string, u: Partial<CardElement>) => void;
  updateConfig: (u: Partial<CardConfig>) => void;
  addElement: (t: ElementType) => void;
  deleteElement: (id: string) => void;
  duplicateElement: (id: string) => void;
  toggleVisible: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  setSelectedId: (id: string | null) => void;
  selectedId: string | null;
  onRename: (el: CardElement) => void;
  currentPreset: string;
  applyCardSizePreset: (p: string) => void;
  fileImageRef: React.RefObject<HTMLInputElement | null>;
  fileBgRef: React.RefObject<HTMLInputElement | null>;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>, target: "element" | "bg") => void;
}) {
  const elements = activeSide === "front" ? design.front : design.back;
  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-2">
        {/* Selected element header */}
        {selected ? (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-teal-500/10 border border-teal-500/20">
            <Palette className="h-4 w-4 text-teal-600 shrink-0" />
            <span className="font-bold text-xs flex-1 truncate">{selected.name}</span>
            <Badge variant="outline" className="text-[8px] h-4 px-1 shrink-0">{selected.type}</Badge>
          </div>
        ) : (
          <div className="p-3 text-center text-xs text-muted-foreground rounded-lg bg-muted/30 border border-dashed">
            <Layers className="h-6 w-6 mx-auto mb-1 opacity-30" />
            <p>اختر عنصراً لعرض خصائصه</p>
          </div>
        )}

        {/* Card Settings panel */}
        <CollapsiblePanel title="إعدادات البطاقة" icon={CreditCard} defaultOpen>
          <div className="space-y-2">
            <div>
              <Label className="text-[10px] mb-1 block">حجم البطاقة</Label>
              <Select value={currentPreset} onValueChange={applyCardSizePreset}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CARD_SIZE_PRESETS.map((p) => <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <Label className="text-[10px]">عرض (سم)</Label>
                <Input type="number" step="0.5" value={design.config.width}
                  onChange={(e) => updateConfig({ width: parseFloat(e.target.value) || 10 })} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">ارتفاع (سم)</Label>
                <Input type="number" step="0.5" value={design.config.height}
                  onChange={(e) => updateConfig({ height: parseFloat(e.target.value) || 7 })} className="h-8 text-xs" />
              </div>
            </div>
            <div>
              <Label className="text-[10px]">لون الخلفية</Label>
              <Input type="color" value={design.config.bgColor}
                onChange={(e) => updateConfig({ bgColor: e.target.value })} className="h-8 w-full" />
            </div>
            <label className="flex items-center justify-between text-[11px] font-medium">
              <span>خلفية متدرجة</span>
              <Switch checked={design.config.gradientEnabled || false}
                onCheckedChange={(v) => updateConfig({ gradientEnabled: v })} />
            </label>
            {design.config.gradientEnabled && (
              <div className="grid grid-cols-2 gap-1.5 pl-2 border-r-2 border-teal-500/30">
                <div>
                  <Label className="text-[9px]">بداية</Label>
                  <Input type="color" value={design.config.gradientStart || "#0f766e"}
                    onChange={(e) => updateConfig({ gradientStart: e.target.value })} className="h-8" />
                </div>
                <div>
                  <Label className="text-[9px]">نهاية</Label>
                  <Input type="color" value={design.config.gradientEnd || "#0369a1"}
                    onChange={(e) => updateConfig({ gradientEnd: e.target.value })} className="h-8" />
                </div>
                <Select value={design.config.gradientDirection || "diagonal"}
                  onValueChange={(v) => updateConfig({ gradientDirection: v as any })}>
                  <SelectTrigger className="h-7 text-[10px] col-span-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="horizontal" className="text-xs">أفقي</SelectItem>
                    <SelectItem value="vertical" className="text-xs">عمودي</SelectItem>
                    <SelectItem value="diagonal" className="text-xs">قطري</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CollapsiblePanel>

        {/* Layers panel */}
        <CollapsiblePanel title={`الطبقات (${elements.length})`} icon={Layers} defaultOpen>
          <LayersList
            elements={elements} selectedId={selectedId} setSelectedId={setSelectedId}
            toggleVisible={toggleVisible} deleteElement={deleteElement}
            duplicateElement={duplicateElement} bringToFront={bringToFront} sendToBack={sendToBack}
            onRename={onRename} />
        </CollapsiblePanel>

        {/* Object Properties (only when selected) */}
        {selected && (
          <PropertiesContent
            selected={selected} updateEl={updateEl} updateConfig={updateConfig}
            bringToFront={bringToFront} sendToBack={sendToBack}
            currentPreset={currentPreset} applyCardSizePreset={applyCardSizePreset}
            design={design} />
        )}
      </div>
    </ScrollArea>
  );
}

// ════════════════════════════ PROPERTIES CONTENT ════════════════════════════

function PropertiesContent({
  selected, updateEl, updateConfig, bringToFront, sendToBack,
  currentPreset, applyCardSizePreset, design,
}: {
  selected: CardElement;
  updateEl: (id: string, u: Partial<CardElement>) => void;
  updateConfig: (u: Partial<CardConfig>) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  currentPreset: string;
  applyCardSizePreset: (p: string) => void;
  design: CardDesign;
}) {
  const showText = isTextType(selected.type);
  const showImage = isImageType(selected.type);
  const showCode = isCodeType(selected.type);

  return (
    <>
      {/* Layer ops */}
      <CollapsiblePanel title="الترتيب والقفل" icon={BringToFront} defaultOpen>
        <div className="space-y-2">
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => bringToFront(selected.id)}>
              <BringToFront className="h-3 w-3 ml-1" /> للأمام
            </Button>
            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => sendToBack(selected.id)}>
              <SendToBack className="h-3 w-3 ml-1" /> للخلف
            </Button>
          </div>
          <Button size="sm" variant={selected.locked ? "default" : "outline"} className="w-full h-8 text-xs"
            onClick={() => updateEl(selected.id, { locked: !selected.locked })}>
            {selected.locked ? <Lock className="h-3 w-3 ml-1" /> : <Unlock className="h-3 w-3 ml-1" />}
            {selected.locked ? "إلغاء القفل" : "قفل العنصر"}
          </Button>
        </div>
      </CollapsiblePanel>

      {/* Position & Size */}
      <CollapsiblePanel title="الموضع والحجم" icon={Square} defaultOpen>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <Label className="text-[10px]">X (سم)</Label>
              <Input type="number" step="0.1" value={Math.round(selected.x * 10) / 10}
                onChange={(e) => updateEl(selected.id, { x: parseFloat(e.target.value) || 0 })} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[10px]">Y (سم)</Label>
              <Input type="number" step="0.1" value={Math.round(selected.y * 10) / 10}
                onChange={(e) => updateEl(selected.id, { y: parseFloat(e.target.value) || 0 })} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[10px]">عرض</Label>
              <Input type="number" step="0.5" value={selected.width}
                onChange={(e) => updateEl(selected.id, { width: parseFloat(e.target.value) || 1 })} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[10px]">ارتفاع</Label>
              <Input type="number" step="0.5" value={selected.height}
                onChange={(e) => updateEl(selected.id, { height: parseFloat(e.target.value) || 1 })} className="h-8 text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-[10px]">دوران: {selected.rotation}°</Label>
            <input type="range" min="0" max="360" value={selected.rotation}
              onChange={(e) => updateEl(selected.id, { rotation: parseInt(e.target.value) })} className="w-full" />
          </div>
          <div>
            <Label className="text-[10px]">الشفافية: {selected.opacity}%</Label>
            <input type="range" min="0" max="100" value={selected.opacity}
              onChange={(e) => updateEl(selected.id, { opacity: parseInt(e.target.value) })} className="w-full" />
          </div>
        </div>
      </CollapsiblePanel>

      {/* Typography panel */}
      {showText && (
        <CollapsiblePanel title="النص والخط" icon={Type} defaultOpen>
          <div className="space-y-2">
            {isEditableText(selected.type) && (
              <div>
                <Label className="text-[10px]">المحتوى</Label>
                <textarea value={selected.text || ""} onChange={(e) => updateEl(selected.id, { text: e.target.value })}
                  rows={2} className="w-full text-xs p-2 rounded border bg-background" />
              </div>
            )}
            <div>
              <Label className="text-[10px]">الخط</Label>
              <select value={selected.fontFamily} onChange={(e) => updateEl(selected.id, { fontFamily: e.target.value })}
                className="w-full h-8 text-xs rounded border bg-card">
                {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-[10px]">الحجم: {selected.fontSize}px</Label>
              <input type="range" min="6" max="32" value={selected.fontSize}
                onChange={(e) => updateEl(selected.id, { fontSize: parseInt(e.target.value) })} className="w-full" />
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant={selected.fontWeight === "bold" ? "default" : "outline"} className="h-8 flex-1 text-xs"
                onClick={() => updateEl(selected.id, { fontWeight: selected.fontWeight === "bold" ? "normal" : "bold" })}>
                <Bold className="h-3 w-3" />
              </Button>
              <Button size="sm" variant={selected.textAlign === "right" ? "default" : "outline"} className="h-8 flex-1 text-xs"
                onClick={() => updateEl(selected.id, { textAlign: "right" })}><AlignRight className="h-3 w-3" /></Button>
              <Button size="sm" variant={selected.textAlign === "center" ? "default" : "outline"} className="h-8 flex-1 text-xs"
                onClick={() => updateEl(selected.id, { textAlign: "center" })}><AlignCenter className="h-3 w-3" /></Button>
              <Button size="sm" variant={selected.textAlign === "left" ? "default" : "outline"} className="h-8 flex-1 text-xs"
                onClick={() => updateEl(selected.id, { textAlign: "left" })}><AlignLeft className="h-3 w-3" /></Button>
            </div>
            <div>
              <Label className="text-[10px]">اللون</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {PRESET_COLORS.map((c) => (
                  <button key={c} onClick={() => updateEl(selected.id, { color: c })}
                    className={cn("h-5 w-5 rounded border-2", selected.color === c ? "border-teal-500" : "border-border")}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
              <Input type="color" value={selected.color || "#000000"}
                onChange={(e) => updateEl(selected.id, { color: e.target.value })} className="h-8 w-full mt-1" />
            </div>
            {!isEditableText(selected.type) && (
              <label className="flex items-center gap-2 text-[11px]">
                <Checkbox checked={selected.showLabel || false}
                  onCheckedChange={(v) => updateEl(selected.id, { showLabel: !!v })} />
                إظهار تسمية
              </label>
            )}
            {selected.showLabel && (
              <Input value={selected.labelText || ""} onChange={(e) => updateEl(selected.id, { labelText: e.target.value })}
                placeholder="نص التسمية" className="h-8 text-xs" />
            )}
          </div>
        </CollapsiblePanel>
      )}

      {/* Image properties panel */}
      {showImage && (
        <CollapsiblePanel title="خصائص الصورة" icon={ImageIcon} defaultOpen>
          <div className="space-y-2">
            {selected.type === "photo" && (
              <>
                <Label className="text-[10px]">شكل الإطار</Label>
                <div className="flex gap-1">
                  <Button size="sm" variant={selected.shapeKind !== "circle" && (selected.borderRadius || 0) === 0 ? "default" : "outline"}
                    className="flex-1 h-8 text-xs" onClick={() => updateEl(selected.id, { shapeKind: "rectangle", borderRadius: 0 })}>مربع</Button>
                  <Button size="sm" variant={selected.shapeKind === "circle" ? "default" : "outline"}
                    className="flex-1 h-8 text-xs" onClick={() => updateEl(selected.id, { shapeKind: "circle" })}>دائري</Button>
                  <Button size="sm" variant={selected.shapeKind !== "circle" && (selected.borderRadius || 0) > 0 ? "default" : "outline"}
                    className="flex-1 h-8 text-xs" onClick={() => updateEl(selected.id, { shapeKind: "rectangle", borderRadius: 12 })}>زوايا</Button>
                </div>
                {selected.shapeKind !== "circle" && (
                  <div>
                    <Label className="text-[10px]">انحناء: {selected.borderRadius || 0}px</Label>
                    <input type="range" min="0" max="50" value={selected.borderRadius || 0}
                      onChange={(e) => updateEl(selected.id, { borderRadius: parseInt(e.target.value), shapeKind: "rectangle" })} className="w-full" />
                  </div>
                )}
                <label className="flex items-center gap-2 text-[11px]">
                  <Checkbox checked={selected.shadow || false}
                    onCheckedChange={(v) => updateEl(selected.id, { shadow: !!v })} />
                  ظل
                </label>
              </>
            )}
            <div>
              <Label className="text-[10px]">حدود الإطار</Label>
              <div className="flex gap-1">
                <Input type="number" min="0" max="10" value={selected.borderWidth || 0}
                  onChange={(e) => updateEl(selected.id, { borderWidth: parseInt(e.target.value) })} className="h-8 w-12 text-xs" />
                <Input type="color" value={selected.borderColor || "#000000"}
                  onChange={(e) => updateEl(selected.id, { borderColor: e.target.value })} className="h-8 w-12 p-1" />
                <select value={selected.borderStyle || "solid"}
                  onChange={(e) => updateEl(selected.id, { borderStyle: e.target.value })}
                  className="flex-1 h-8 text-xs rounded border bg-card">
                  <option value="solid">متصل</option>
                  <option value="dashed">متقطع</option>
                  <option value="dotted">نقاط</option>
                </select>
              </div>
            </div>
            {selected.type === "uploadedImage" && (
              <p className="text-[10px] text-muted-foreground bg-muted/40 rounded p-2">
                لاستبدال الصورة: حدد العنصر ثم اضغط «رفع صورة» في شريط الإضافة بالأسفل.
              </p>
            )}
            <p className="text-[9px] text-muted-foreground">
              object-fit: cover دائماً — الصورة لا تتمدد ولا تتشوّه.
            </p>
          </div>
        </CollapsiblePanel>
      )}

      {/* QR/Barcode settings */}
      {showCode && (
        <CollapsiblePanel title="إعدادات الكود" icon={QrCode} defaultOpen>
          <div className="space-y-2 text-[11px] text-muted-foreground">
            <p>• النوع: {selected.type === "qr" ? "QR Code" : "Barcode (Code128)"}</p>
            <p>• المصدر: رقم ملف المنخرط ({selected.type === "qr" ? "QR" : "BAR"})</p>
            <p>• يُولّد تلقائياً عند المعاينة والطباعة</p>
            <div>
              <Label className="text-[10px]">لون الخلفية</Label>
              <Input type="color" value={selected.bgColor || "#ffffff"}
                onChange={(e) => updateEl(selected.id, { bgColor: e.target.value })} className="h-8 w-full" />
            </div>
          </div>
        </CollapsiblePanel>
      )}

      {/* Appearance panel (background, border for non-text) */}
      {!showText && (
        <CollapsiblePanel title="المظهر العام" icon={Palette}>
          <div className="space-y-2">
            <div>
              <Label className="text-[10px]">خلفية العنصر</Label>
              <div className="flex items-center gap-2">
                <Input type="color" value={selected.bgColor || "#ffffff"}
                  onChange={(e) => updateEl(selected.id, { bgColor: e.target.value })} className="h-8 w-12 p-1" />
                <input type="range" min="0" max="100" value={selected.bgOpacity ?? 100}
                  onChange={(e) => updateEl(selected.id, { bgOpacity: parseInt(e.target.value) })} className="flex-1" />
              </div>
            </div>
            {selected.type === "shape" && (
              <div className="flex gap-1">
                <Button size="sm" variant={selected.shapeKind === "rectangle" ? "default" : "outline"} className="flex-1 h-8 text-xs"
                  onClick={() => updateEl(selected.id, { shapeKind: "rectangle" })}><Square className="h-3 w-3 ml-1" /> مستطيل</Button>
                <Button size="sm" variant={selected.shapeKind === "circle" ? "default" : "outline"} className="flex-1 h-8 text-xs"
                  onClick={() => updateEl(selected.id, { shapeKind: "circle" })}><Circle className="h-3 w-3 ml-1" /> دائرة</Button>
              </div>
            )}
          </div>
        </CollapsiblePanel>
      )}
    </>
  );
}

// ════════════════════════════ LAYERS LIST ════════════════════════════

function LayersList({
  elements, selectedId, setSelectedId, toggleVisible, deleteElement,
  duplicateElement, bringToFront, sendToBack, onRename,
}: {
  elements: CardElement[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  toggleVisible: (id: string) => void;
  deleteElement: (id: string) => void;
  duplicateElement: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  onRename: (el: CardElement) => void;
}) {
  return (
    <div className="space-y-1 max-h-72 overflow-y-auto">
      {elements.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">لا توجد عناصر</p>
      ) : (
        [...elements].reverse().map((el) => (
          <div key={el.id} onClick={() => setSelectedId(el.id)}
            className={cn("flex items-center gap-1 p-1.5 rounded-lg cursor-pointer text-xs transition",
              selectedId === el.id ? "bg-teal-500/10 ring-1 ring-teal-500/30" : "hover:bg-accent")}>
            <button onClick={(e) => { e.stopPropagation(); toggleVisible(el.id); }} className="text-muted-foreground hover:text-foreground">
              {el.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); onRename(el); }} className="text-muted-foreground hover:text-foreground">
              <Pencil className="h-3 w-3" />
            </button>
            <span className={cn("flex-1 truncate", !el.visible && "opacity-50")}>{el.name}</span>
            {el.locked && <Lock className="h-3 w-3 text-amber-500" />}
            <button onClick={(e) => { e.stopPropagation(); bringToFront(el.id); }} className="text-muted-foreground hover:text-foreground">
              <ChevronUp className="h-3 w-3" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); sendToBack(el.id); }} className="text-muted-foreground hover:text-foreground">
              <ChevronDown className="h-3 w-3" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); duplicateElement(el.id); }} className="text-muted-foreground hover:text-foreground">
              <Copy className="h-3 w-3" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }} className="text-muted-foreground hover:text-rose-500">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))
      )}
    </div>
  );
}

// ════════════════════════════ COLLAPSIBLE PANEL ════════════════════════════

function CollapsiblePanel({
  title, icon: Icon, defaultOpen, children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="rounded-lg border border-white/30 dark:border-white/5 overflow-hidden bg-white/40 dark:bg-slate-900/40">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-bold hover:bg-accent/40 transition">
        <Icon className="h-3.5 w-3.5 text-teal-600 shrink-0" />
        <span className="flex-1 text-right">{title}</span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-2 space-y-2 border-t border-white/20 dark:border-white/5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ════════════════════════════ CARD SETTINGS CONTENT (for settings dialog) ════════════════════════════

function CardSettingsContent({
  design, updateConfig, currentPreset, applyCardSizePreset, fileBgRef, handleImageUpload,
}: {
  design: CardDesign;
  updateConfig: (u: Partial<CardConfig>) => void;
  currentPreset: string;
  applyCardSizePreset: (p: string) => void;
  fileBgRef: React.RefObject<HTMLInputElement | null>;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>, target: "element" | "bg") => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">حجم البطاقة</Label>
        <Select value={currentPreset} onValueChange={applyCardSizePreset}>
          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CARD_SIZE_PRESETS.map((p) => <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">عرض (سم)</Label><Input type="number" step="0.5" value={design.config.width} onChange={(e) => updateConfig({ width: parseFloat(e.target.value) || 10 })} className="h-9" /></div>
        <div><Label className="text-xs">ارتفاع (سم)</Label><Input type="number" step="0.5" value={design.config.height} onChange={(e) => updateConfig({ height: parseFloat(e.target.value) || 7 })} className="h-9" /></div>
        <div><Label className="text-xs">أعمدة</Label><Input type="number" min="1" max="4" value={design.config.cols} onChange={(e) => updateConfig({ cols: parseInt(e.target.value) || 2 })} className="h-9" /></div>
        <div><Label className="text-xs">صفوف</Label><Input type="number" min="1" max="6" value={design.config.rows} onChange={(e) => updateConfig({ rows: parseInt(e.target.value) || 4 })} className="h-9" /></div>
        <div><Label className="text-xs">فراغ (مم)</Label><Input type="number" step="0.5" value={design.config.gap} onChange={(e) => updateConfig({ gap: parseFloat(e.target.value) || 0 })} className="h-9" /></div>
        <div><Label className="text-xs">انحناء (px)</Label><Input type="number" value={design.config.borderRadius} onChange={(e) => updateConfig({ borderRadius: parseInt(e.target.value) || 0 })} className="h-9" /></div>
      </div>
      <div><Label className="text-xs">لون الخلفية</Label><Input type="color" value={design.config.bgColor} onChange={(e) => updateConfig({ bgColor: e.target.value })} className="h-9 w-full" /></div>
      <div><Label className="text-xs">شفافية الخلفية: {design.config.bgOpacity}%</Label><input type="range" min="0" max="100" value={design.config.bgOpacity} onChange={(e) => updateConfig({ bgOpacity: parseInt(e.target.value) })} className="w-full" /></div>
      <div className="rounded-lg border p-3 space-y-2">
        <label className="flex items-center justify-between text-xs font-semibold">
          <span>خلفية متدرجة</span>
          <Switch checked={design.config.gradientEnabled || false} onCheckedChange={(v) => updateConfig({ gradientEnabled: v })} />
        </label>
        {design.config.gradientEnabled && (
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-[10px]">لون البداية</Label><Input type="color" value={design.config.gradientStart || "#0f766e"} onChange={(e) => updateConfig({ gradientStart: e.target.value })} className="h-9 w-full" /></div>
            <div><Label className="text-[10px]">لون النهاية</Label><Input type="color" value={design.config.gradientEnd || "#0369a1"} onChange={(e) => updateConfig({ gradientEnd: e.target.value })} className="h-9 w-full" /></div>
            <Select value={design.config.gradientDirection || "diagonal"} onValueChange={(v) => updateConfig({ gradientDirection: v as any })}>
              <SelectTrigger className="h-9 text-xs col-span-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="horizontal" className="text-xs">أفقي</SelectItem>
                <SelectItem value="vertical" className="text-xs">عمودي</SelectItem>
                <SelectItem value="diagonal" className="text-xs">قطري</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div>
        <Label className="text-xs">صورة خلفية (PNG/JPEG حتى 20MB)</Label>
        <input ref={fileBgRef} type="file" accept="image/png,image/jpeg" onChange={(e) => handleImageUpload(e, "bg")} className="hidden" />
        <div className="flex gap-1 mt-1">
          <Button size="sm" variant="outline" className="flex-1 h-9" onClick={() => fileBgRef.current?.click()}>
            <ImageIcon className="h-4 w-4 ml-1" /> رفع
          </Button>
          {design.config.bgImage && (
            <Button size="sm" variant="ghost" className="h-9 text-rose-600" onClick={() => updateConfig({ bgImage: undefined })}>إزالة</Button>
          )}
        </div>
      </div>
      {design.config.bgImage && (
        <div><Label className="text-xs">شفافية صورة الخلفية: {design.config.bgImageOpacity ?? 30}%</Label>
          <input type="range" min="0" max="100" value={design.config.bgImageOpacity ?? 30} onChange={(e) => updateConfig({ bgImageOpacity: parseInt(e.target.value) })} className="w-full" /></div>
      )}
      <div><Label className="text-xs">لون الإطار</Label><Input type="color" value={design.config.borderColor} onChange={(e) => updateConfig({ borderColor: e.target.value })} className="h-9 w-full" /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">عرض الإطار (px)</Label><Input type="number" value={design.config.borderWidth} onChange={(e) => updateConfig({ borderWidth: parseInt(e.target.value) || 0 })} className="h-9" /></div>
        <div>
          <Label className="text-xs">نمط الإطار</Label>
          <select value={design.config.borderStyle} onChange={(e) => updateConfig({ borderStyle: e.target.value })} className="w-full h-9 text-sm rounded border bg-card">
            <option value="solid">متصل</option>
            <option value="dashed">متقطع</option>
            <option value="dotted">نقاط</option>
            <option value="double">مزدوج</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════ MOBILE TAB BUTTON ════════════════════════════

function MobileTabButton({
  icon: Icon, label, badge, disabled, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: number;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={cn("flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition",
        disabled ? "text-muted-foreground/40" : "text-teal-600 hover:bg-accent")}>
      <div className="relative">
        <Icon className="h-4 w-4" />
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1.5 -left-2 bg-rose-500 text-white text-[8px] rounded-full h-3 min-w-3 px-0.5 flex items-center justify-center">
            {badge}
          </span>
        )}
      </div>
      {label}
    </button>
  );
}

// ════════════════════════════ PRINT HTML GENERATORS ════════════════════════════

function buildElementHTML(el: CardElement, sub: SubscriberWithComputed | null): string {
  const base = `position:absolute;left:${el.x}cm;top:${el.y}cm;width:${el.width}cm;height:${el.height}cm;display:flex;align-items:center;justify-content:${el.textAlign === "center" ? "center" : el.textAlign === "left" ? "flex-start" : "flex-end"};direction:rtl;overflow:hidden;transform:rotate(${el.rotation}deg);opacity:${el.opacity / 100};z-index:${el.zIndex};${el.bgColor ? `background-color:${el.bgColor}${alphaHex(el.bgOpacity ?? 100)};` : ""}${el.borderWidth ? `border:${el.borderWidth}px ${el.borderStyle} ${el.borderColor};` : ""}border-radius:${el.shapeKind === "circle" ? "50%" : `${el.borderRadius || 0}px`};padding:0 4px;${el.shadow ? "box-shadow:0 2px 8px rgba(0,0,0,0.15);" : ""}`;
  if (el.type === "qr") return `<div style="${base}"><img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(sub?.fileNumber || "RCS")}&color=000000&bgcolor=ffffff" style="width:100%;height:100%;object-fit:contain;" /></div>`;
  if (el.type === "barcode") return `<div style="${base}"><img src="https://api.qrserver.com/v1/create-barcode/?data=${encodeURIComponent(sub?.fileNumber || "RCS")}&type=code128" style="width:100%;height:100%;object-fit:contain;" /></div>`;
  if (el.type === "logo") return `<div style="${base}"><img src="/images/rcs-logo-official.png" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none'" /></div>`;
  if (el.type === "uploadedImage" && el.imageData) return `<div style="${base}"><img src="${el.imageData}" style="width:100%;height:100%;object-fit:contain;" /></div>`;
  if (el.type === "photo") {
    const photoSrc = sub && getSubPhotoPath(sub) ? `${window.location.origin}/api/subscribers/${sub.id}/photo?size=cropped&raw=1` : "";
    const br = el.shapeKind === "circle" ? "50%" : (el.borderRadius || 8) + "px";
    const phStyle = `width:100%;height:100%;background:#e5e7eb;border-radius:${br};display:flex;align-items:center;justify-content:center;font-size:8px;color:#999;`;
    const imgStyle = `position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:${br};`;
    return `<div style="${base}overflow:hidden;border-radius:${br};position:relative;">${photoSrc ? `<img src="${photoSrc}" style="${imgStyle}" onerror="this.style.display='none'" /><div style="${phStyle}">صورة</div>` : `<div style="${phStyle}">صورة</div>`}</div>`;
  }
  if (el.type === "shape") return `<div style="${base}"></div>`;
  const content = getContent(el, sub);
  const label = el.showLabel ? (el.labelText || "") : "";
  return `<div style="${base}"><span style="font-family:${el.fontFamily},Arial,sans-serif;font-size:${((el.fontSize || 10) * 0.265).toFixed(1)}mm;font-weight:${el.fontWeight};color:${el.color};text-align:${el.textAlign};width:100%;line-height:1.3;word-break:break-word;">${escapeHtml(label + content)}</span></div>`;
}

function buildCardHTML(sub: SubscriberWithComputed | null, design: CardDesign, side: "front" | "back"): string {
  const { config } = design;
  const els = side === "front" ? design.front : design.back;
  const elsHTML = els.filter((e) => e.visible).sort((a, b) => a.zIndex - b.zIndex).map((el) => buildElementHTML(el, sub)).join("");
  const gradDir = config.gradientDirection === "horizontal" ? "to right" : config.gradientDirection === "vertical" ? "to bottom" : "to bottom right";
  const bgStyle = config.bgImage
    ? `background-image:url(${config.bgImage});background-size:cover;background-position:center;background-color:${config.bgColor};`
    : config.gradientEnabled
      ? `background:linear-gradient(${gradDir}, ${config.gradientStart || "#0f766e"}, ${config.gradientEnd || "#0369a1"});`
      : `background-color:${config.bgColor};`;
  const logoWatermark = side === "back" ? `<img src="/images/rcs-logo-official.png" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);height:75%;width:75%;object-fit:contain;opacity:0.1;z-index:0;" onerror="this.style.display='none'" />` : "";
  return `<div style="width:${config.width}cm;height:${config.height}cm;${bgStyle}border:${config.borderWidth}px ${config.borderStyle} ${config.borderColor};border-radius:${config.borderRadius}px;position:relative;overflow:hidden;direction:rtl;break-inside:avoid;">${logoWatermark}${elsHTML}</div>`;
}

function generatePrintHTML(subscribers: SubscriberWithComputed[], design: CardDesign): string {
  const { config } = design;
  const cardsPerPage = config.cols * config.rows;
  let pagesHTML = "";
  for (let i = 0; i < subscribers.length; i += cardsPerPage) {
    const chunk = subscribers.slice(i, i + cardsPerPage);
    pagesHTML += `<div class="print-page" style="width:21cm;min-height:297mm;padding:10mm;direction:rtl;"><div style="display:grid;grid-template-columns:repeat(${config.cols},1fr);gap:${config.gap}mm;">${chunk.map((s) => buildCardHTML(s, design, "front")).join("")}</div></div>`;
    pagesHTML += `<div class="print-page" style="width:21cm;min-height:297mm;padding:10mm;direction:ltr;"><div style="display:grid;grid-template-columns:repeat(${config.cols},1fr);gap:${config.gap}mm;">${chunk.map((s) => buildCardHTML(s, design, "back")).join("")}</div></div>`;
  }
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>بطاقات الانخراط - AquaCore</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Cairo','Tajawal',Arial,sans-serif;background:white;}@page{size:Letter portrait;margin:0 1.27cm;}.print-page{page-break-after:always;}.print-page:last-child{page-break-after:auto;}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}@media screen{.print-page{margin:10mm auto;box-shadow:0 4px 12px rgba(0,0,0,0.1);}body{background:#f5f5f5;padding:20px;}}</style></head><body>${pagesHTML}</body></html>`;
}

function generatePrint8HTML(subscribers: SubscriberWithComputed[], design: CardDesign): string {
  const cardsHTML = subscribers.map((s) => buildCardHTML(s, design, "front") + buildCardHTML(s, design, "back")).join("");
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>8 بطاقات/A4 - AquaCore</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Cairo','Tajawal',Arial,sans-serif;background:white;}@page{size:A4 portrait;margin:8mm;}.page{display:grid;grid-template-columns:repeat(2,1fr);grid-template-rows:repeat(4,1fr);gap:4mm;}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}@media screen{.page{margin:10mm auto;box-shadow:0 4px 12px rgba(0,0,0,0.1);padding:8mm;}body{background:#f5f5f5;padding:20px;}}</style></head><body><div class="page">${cardsHTML}</div></body></html>`;
}

function generateWordHTML(subscribers: SubscriberWithComputed[], design: CardDesign): string {
  const { config } = design;
  const today = new Date();
  const year = today.getFullYear();
  const dateStr = today.toISOString().split("T")[0].replace(/-/g, "/");

  const generateCardCell = (sub: SubscriberWithComputed, side: "front" | "back") => {
    const els = side === "front" ? design.front : design.back;
    const elsHTML = els.filter((e) => e.visible).sort((a, b) => a.zIndex - b.zIndex).map((el) => {
      const base = `position:absolute;left:${el.x}cm;top:${el.y}cm;width:${el.width}cm;height:${el.height}cm;display:flex;align-items:center;justify-content:${el.textAlign === "center" ? "center" : el.textAlign === "left" ? "flex-start" : "flex-end"};direction:rtl;overflow:hidden;${el.bgColor ? `background-color:${el.bgColor};` : ""}${el.borderWidth ? `border:${el.borderWidth}px ${el.borderStyle} ${el.borderColor};` : ""}border-radius:${el.borderRadius || 0}px;padding:0 4px;`;
      if (el.type === "qr") return `<div style="${base}"><img src="https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(sub.fileNumber)}&color=000000&bgcolor=ffffff" style="width:100%;height:100%;object-fit:contain;" /></div>`;
      if (el.type === "barcode") return `<div style="${base}"><img src="https://api.qrserver.com/v1/create-barcode/?data=${encodeURIComponent(sub.fileNumber)}&type=code128" style="width:100%;height:100%;object-fit:contain;" /></div>`;
      if (el.type === "logo") return `<div style="${base}"><img src="/images/rcs-logo-official.png" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none'" /></div>`;
      if (el.type === "uploadedImage" && el.imageData) return `<div style="${base}"><img src="${el.imageData}" style="width:100%;height:100%;object-fit:contain;" /></div>`;
      if (el.type === "photo") {
        const photoSrc = getSubPhotoPath(sub) ? `${window.location.origin}/api/subscribers/${sub.id}/photo?size=cropped&raw=1` : "";
        const phStyle = `width:100%;height:100%;background:#e5e7eb;border-radius:8px;`;
        const imgStyle = `position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:8px;`;
        return `<div style="${base}overflow:hidden;border-radius:8px;position:relative;">${photoSrc ? `<img src="${photoSrc}" style="${imgStyle}" onerror="this.style.display='none'" /><div style="${phStyle}"></div>` : `<div style="${phStyle}"></div>`}</div>`;
      }
      if (el.type === "shape") return `<div style="${base}"></div>`;
      const content = getContent(el, sub);
      const label = el.showLabel ? (el.labelText || "") : "";
      return `<div style="${base}"><span style="font-family:${el.fontFamily},Arial,sans-serif;font-size:${((el.fontSize || 10) * 0.265).toFixed(1)}mm;font-weight:${el.fontWeight};color:${el.color};text-align:${el.textAlign};width:100%;line-height:1.3;">${escapeHtml(label + content)}</span></div>`;
    }).join("");
    const logoWatermark = side === "back" ? `<img src="/images/rcs-logo-official.png" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);height:75%;width:75%;object-fit:contain;opacity:0.1;" onerror="this.style.display='none'" />` : "";
    return `<div style="width:${config.width}cm;height:${config.height}cm;background-color:${config.bgColor};border:${config.borderWidth}px ${config.borderStyle} ${config.borderColor};border-radius:${config.borderRadius}px;position:relative;overflow:hidden;direction:rtl;display:inline-block;margin:5mm;">${logoWatermark}${elsHTML}</div>`;
  };

  const entete = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr>
        <td style="width:20%;text-align:right;vertical-align:middle;">
          <img src="/images/rcs-logo-official.png" style="height:60px;width:60px;object-fit:contain;" onerror="this.style.display='none'" />
        </td>
        <td style="width:60%;text-align:center;vertical-align:middle;">
          <p style="font-size:14px;font-weight:bold;color:#0f766e;margin:2px;">AquaCore Club Manager</p>
          <p style="font-size:12px;font-weight:bold;color:#f59e0b;margin:2px;">بطاقات الانخراط</p>
          <p style="font-size:11px;color:#666;margin:2px;">${year}</p>
        </td>
        <td style="width:20%;text-align:left;vertical-align:middle;">
          <img src="/images/rcs-logo-official.png" style="height:60px;width:60px;object-fit:contain;" onerror="this.style.display='none'" />
        </td>
      </tr>
    </table>
    <hr style="border:1px solid #0f766e;margin:10px 0;" />
    <h2 style="text-align:center;font-size:16px;font-weight:bold;color:#0f766e;margin:15px 0;">بطاقات الانخراط — ${subscribers.length} بطاقة</h2>
    <p style="text-align:left;font-size:11px;color:#666;margin:5px 0;">سعيدة في: ${dateStr}</p>
  `;

  const frontCards = subscribers.map((s) => generateCardCell(s, "front")).join("");
  const backCards = subscribers.map((s) => generateCardCell(s, "back")).join("");

  return `<!DOCTYPE html><html dir="rtl" lang="ar" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>بطاقات الانخراط - AquaCore</title><style>@page{size:A4 portrait;margin:15mm;}body{font-family:'Cairo','Tahoma',Arial,sans-serif;font-size:12px;line-height:1.5;}</style></head><body>
    ${entete}
    <h3 style="text-align:center;font-size:14px;color:#0f766e;margin:20px 0 10px;">الواجهة الأمامية (RECTO)</h3>
    <div style="text-align:center;">${frontCards}</div>
    <br style="page-break-before:always;" />
    <h3 style="text-align:center;font-size:14px;color:#0f766e;margin:20px 0 10px;">الواجهة الخلفية (VERSO)</h3>
    <div style="text-align:center;">${backCards}</div>
  </body></html>`;
}

export default CardDesignerPro;

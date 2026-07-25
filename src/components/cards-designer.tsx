"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard, Download, Upload, Loader2, Layers, Check, RotateCw,
  Type, Square, Circle, Image as ImageIcon, QrCode, User, Hash,
  Droplet, Calendar, Wallet, Clock, Tag, Building2, Plus, Eye,
  EyeOff, Trash2, Copy, Save, Printer, Search, RefreshCw,
  ChevronUp, ChevronDown, Bold, AlignRight, AlignCenter, AlignLeft,
  Palette, FileText, Settings2, X, Lock, Unlock, Clipboard, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useScaleFit } from "@/hooks/use-scale-fit";
import { useSubscriptionTypes } from "@/hooks/use-subscription-types";
import type { SubscriberWithComputed } from "@/lib/rcs";

// ──────────────── Types ────────────────

type ElementType =
  | "customText" | "shape" | "logo" | "qr" | "photo" | "uploadedImage"
  | "fullName" | "memberId" | "bloodType" | "dateOfBirth" | "paymentDate"
  | "swimmingDays" | "swimmingTime" | "subscriptionType" | "expiryDate"
  | "clubName" | "cardTitle";

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
}

interface CardDesign {
  front: CardElement[];
  back: CardElement[];
  config: CardConfig;
}

// ──────────────── Constants ────────────────

// SUB_SYMBOLS لم تعد ثابتة — نستخدم subscriptionType مباشرة
const PRESET_COLORS = ["#000000","#ffffff","#0f766e","#0369a1","#dc2626","#ea580c","#ca8a04","#16a34a","#0891b2","#7c3aed","#c026d3","#475569","#fbbf24","#34d399","#60a5fa","#f472b6"];
const FONTS = ["Tahoma","Arial","Times New Roman","Courier New","Verdana","Georgia","Trebuchet MS","Palatino"];

const ELEMENT_LIBRARY: { type: ElementType; label: string; icon: typeof Type }[] = [
  { type: "customText", label: "نص", icon: Type },
  { type: "shape", label: "مستطيل", icon: Square },
  { type: "logo", label: "شعار", icon: Building2 },
  { type: "uploadedImage", label: "صورة", icon: ImageIcon },
  { type: "qr", label: "QR", icon: QrCode },
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

const DEFAULT_DESIGN: CardDesign = {
  front: [
    { id: "f1", type: "logo", name: "شعار", x: 7.5, y: 0.3, width: 2, height: 1.2, rotation: 0, opacity: 100, zIndex: 1, visible: true },
    { id: "f2", type: "clubName", name: "اسم النادي", x: 0.5, y: 0.3, width: 6.5, height: 0.7, rotation: 0, opacity: 100, zIndex: 2, visible: true, text: "نادي RCS", fontFamily: "Tahoma", fontSize: 13, fontWeight: "bold", textAlign: "right", color: "#0f766e", showLabel: false },
    { id: "f3", type: "cardTitle", name: "عنوان", x: 0.5, y: 1.0, width: 6.5, height: 0.5, rotation: 0, opacity: 100, zIndex: 3, visible: true, text: "بطاقة الانخراط", fontFamily: "Tahoma", fontSize: 9, fontWeight: "normal", textAlign: "right", color: "#666666", showLabel: false },
    { id: "f4", type: "photo", name: "صورة", x: 0.5, y: 1.8, width: 2.5, height: 3, rotation: 0, opacity: 100, zIndex: 4, visible: true, bgColor: "#e5e7eb", bgOpacity: 100, borderRadius: 8 },
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
  config: { width: 10, height: 7, cols: 2, rows: 4, gap: 0, offsetX: 0, offsetY: 0, bgColor: "#ffffff", bgOpacity: 100, borderColor: "#0f766e", borderWidth: 2, borderStyle: "solid", borderRadius: 12 },
};

function uid() { return Math.random().toString(36).substring(2, 11); }

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
  const el: CardElement = { id: uid(), type, name: ELEMENT_LIBRARY.find((e) => e.type === type)?.label || type, x: 1, y: 1 + Math.random() * 2, width: 4, height: 1, rotation: 0, opacity: 100, zIndex: 99, visible: true };
  if (type === "customText") { el.text = "نص جديد"; el.fontFamily = "Tahoma"; el.fontSize = 10; el.fontWeight = "normal"; el.textAlign = "right"; el.color = "#000000"; }
  if (type === "clubName") { el.text = "نادي RCS"; el.fontFamily = "Tahoma"; el.fontSize = 13; el.fontWeight = "bold"; el.textAlign = "right"; el.color = "#0f766e"; }
  if (type === "cardTitle") { el.text = "بطاقة الانخراط"; el.fontFamily = "Tahoma"; el.fontSize = 12; el.fontWeight = "bold"; el.textAlign = "center"; el.color = "#0f766e"; }
  if (type !== "customText" && type !== "cardTitle" && type !== "clubName" && type !== "logo" && type !== "qr" && type !== "photo" && type !== "shape" && type !== "uploadedImage") { el.fontFamily = "Tahoma"; el.fontSize = 10; el.fontWeight = "normal"; el.textAlign = "right"; el.color = "#333333"; el.showLabel = true; el.labelText = ELEMENT_LIBRARY.find((e) => e.type === type)?.label + ": "; }
  if (type === "shape") { el.shapeKind = "rectangle"; el.bgColor = "#0f766e"; el.bgOpacity = 100; el.borderColor = "#000000"; el.borderWidth = 0; el.borderStyle = "solid"; el.borderRadius = 4; el.width = 3; el.height = 1; }
  if (type === "logo") { el.width = 2; el.height = 1.5; }
  if (type === "uploadedImage") { el.width = 3; el.height = 2; }
  if (type === "qr") { el.width = 2; el.height = 2; }
  if (type === "photo") { el.width = 2.5; el.height = 3; el.bgColor = "#e5e7eb"; el.bgOpacity = 100; el.borderRadius = 8; }
  return el;
}

// ──────────────── Main Component ────────────────

export function CardsDesigner({ subscribers, onBack }: { subscribers: SubscriberWithComputed[]; onBack?: () => void }) {
  const [design, setDesign] = useState<CardDesign>(() => { try { const s = localStorage.getItem("rcs-card-design-v3"); if (s) return JSON.parse(s); } catch {} return DEFAULT_DESIGN; });
  const [activeSide, setActiveSide] = useState<"front" | "back">("front");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [subFilter, setSubFilter] = useState<string>("");
  const [subSort, setSubSort] = useState<"fileNumber" | "lastName" | "firstName" | "subscriptionType">("fileNumber");
  const { activeTypes: subTypes } = useSubscriptionTypes();
  const [showSettings, setShowSettings] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exportFormat, setExportFormat] = useState<"pdf" | "word">("pdf");
  const fileTemplateRef = useRef<HTMLInputElement>(null);
  const fileImageRef = useRef<HTMLInputElement>(null);
  const fileBgRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const breakpoint = useBreakpoint();
  // Mobile sheets state
  const [mobileElementsSheet, setMobileElementsSheet] = useState(false);
  const [mobilePropsSheet, setMobilePropsSheet] = useState(false);
  const [mobileSubsSheet, setMobileSubsSheet] = useState(false);
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; elementId: string | null } | null>(null);
  // Clipboard for copy/paste
  const [clipboard, setClipboard] = useState<CardElement | null>(null);
  // Rename dialog
  const [renameTarget, setRenameTarget] = useState<CardElement | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => { const t = setTimeout(() => localStorage.setItem("rcs-card-design-v3", JSON.stringify(design)), 500); return () => clearTimeout(t); }, [design]);

  const elements = activeSide === "front" ? design.front : design.back;
  const selected = elements.find((e) => e.id === selectedId) || null;
  const previewSub = subscribers.find((s) => s.id === selectedSubIds[0]) || null;

  const updateEl = useCallback((id: string, updates: Partial<CardElement>) => { setDesign((prev) => ({ ...prev, [activeSide]: prev[activeSide].map((e) => e.id === id ? { ...e, ...updates } : e) })); }, [activeSide]);
  const updateConfig = useCallback((updates: Partial<CardConfig>) => { setDesign((prev) => ({ ...prev, config: { ...prev.config, ...updates } })); }, []);

  const addElement = (type: ElementType) => { const el = createElement(type); setDesign((prev) => ({ ...prev, [activeSide]: [...prev[activeSide], el] })); setSelectedId(el.id); };
  const deleteElement = (id: string) => { setDesign((prev) => ({ ...prev, [activeSide]: prev[activeSide].filter((e) => e.id !== id) })); if (selectedId === id) setSelectedId(null); };
  const duplicateElement = (id: string) => { const el = elements.find((e) => e.id === id); if (!el) return; const copy = { ...el, id: uid(), x: el.x + 0.5, y: el.y + 0.5 }; setDesign((prev) => ({ ...prev, [activeSide]: [...prev[activeSide], copy] })); setSelectedId(copy.id); };
  const toggleVisible = (id: string) => updateEl(id, { visible: !elements.find((e) => e.id === id)?.visible });
  const moveZ = (id: string, dir: "up" | "down") => { setDesign((prev) => { const arr = [...prev[activeSide]]; const idx = arr.findIndex((e) => e.id === id); if (idx === -1) return prev; if (dir === "up" && idx < arr.length - 1) [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]; else if (dir === "down" && idx > 0) [arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]]; arr.forEach((e, i) => e.zIndex = i + 1); return { ...prev, [activeSide]: arr }; }); };

  const handleMouseDown = (e: React.MouseEvent, el: CardElement) => {
    // Right-click: open context menu (don't start drag)
    if (e.button === 2) {
      e.preventDefault();
      e.stopPropagation();
      setSelectedId(el.id);
      setContextMenu({ x: e.clientX, y: e.clientY, elementId: el.id });
      return;
    }
    // Don't drag if locked
    if (el.locked) return;
    e.stopPropagation(); setSelectedId(el.id);
    const card = e.currentTarget.closest("[data-card]") as HTMLElement; if (!card) return;
    const rect = card.getBoundingClientRect(); const scale = rect.width / (design.config.width * 37.8);
    dragRef.current = { id: el.id, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y };
    const move = (ev: MouseEvent) => { if (!dragRef.current) return; const dx = (ev.clientX - dragRef.current.startX) / scale / 37.8; const dy = (ev.clientY - dragRef.current.startY) / scale / 37.8; updateEl(dragRef.current.id, { x: Math.max(-2, Math.min(design.config.width + 1, dragRef.current.origX + dx)), y: Math.max(-2, Math.min(design.config.height + 1, dragRef.current.origY + dy)) }); };
    const up = () => { dragRef.current = null; document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
    document.addEventListener("mousemove", move); document.addEventListener("mouseup", up);
  };

  // Double-click: open properties
  const handleDoubleClick = (el: CardElement) => {
    setSelectedId(el.id);
    if (breakpoint === "mobile") setMobilePropsSheet(true);
  };

  // Context menu actions
  const handleContextAction = (action: string) => {
    if (!contextMenu?.elementId) return;
    const el = elements.find((e) => e.id === contextMenu.elementId);
    if (!el) { setContextMenu(null); return; }

    switch (action) {
      case "properties":
        setSelectedId(el.id);
        if (breakpoint === "mobile") setMobilePropsSheet(true);
        break;
      case "rename":
        setRenameTarget(el);
        setRenameValue(el.name);
        break;
      case "copy":
        setClipboard({ ...el });
        toast.success("تم النسخ");
        break;
      case "paste":
        if (clipboard) {
          const pasted = { ...clipboard, id: uid(), name: clipboard.name + " (نسخة)", x: clipboard.x + 0.5, y: clipboard.y + 0.5 };
          setDesign((prev) => ({ ...prev, [activeSide]: [...prev[activeSide], pasted] }));
          setSelectedId(pasted.id);
          toast.success("تم اللصق");
        }
        break;
      case "delete":
        deleteElement(el.id);
        break;
      case "lock":
        updateEl(el.id, { locked: !el.locked });
        toast.success(el.locked ? "تم إلغاء القفل" : "تم القفل");
        break;
      case "toggleVisible":
        toggleVisible(el.id);
        break;
      case "bringFront":
        moveZ(el.id, "up");
        break;
      case "sendBack":
        moveZ(el.id, "down");
        break;
      case "duplicate":
        duplicateElement(el.id);
        break;
    }
    setContextMenu(null);
  };

  // Close context menu on any click elsewhere
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [contextMenu]);

  // Handle rename save
  const handleRenameSave = () => {
    if (renameTarget && renameValue.trim()) {
      updateEl(renameTarget.id, { name: renameValue.trim() });
      toast.success("تم إعادة التسمية");
    }
    setRenameTarget(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, target: "element" | "bg") => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("حجم الصورة يجب أن يكون أقل من 20MB"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { const data = ev.target?.result as string; if (target === "bg") { updateConfig({ bgImage: data }); toast.success("تم رفع خلفية البطاقة"); } else if (selectedId) { updateEl(selectedId, { imageData: data }); toast.success("تم رفع الصورة"); } else { const el = createElement("uploadedImage"); el.imageData = data; setDesign((prev) => ({ ...prev, [activeSide]: [...prev[activeSide], el] })); setSelectedId(el.id); toast.success("تم إضافة الصورة"); } };
    reader.readAsDataURL(file); e.target.value = "";
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(design, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `rcs-card-template-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url); toast.success("تم تصدير القالب");
  };
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = (ev) => { try { const data = JSON.parse(ev.target?.result as string); if (data.front && data.back && data.config) { setDesign(data); toast.success("تم استيراد القالب"); } else throw new Error(); } catch { toast.error("ملف غير صالح"); } }; reader.readAsText(file); e.target.value = ""; };
  const handleReset = () => { if (confirm("إعادة تعيين كامل؟")) { setDesign(DEFAULT_DESIGN); setSelectedId(null); toast.success("تمت إعادة التعيين"); } };

  const handlePrint = () => {
    const subs = subscribers.filter((s) => selectedSubIds.includes(s.id));
    if (subs.length === 0) { toast.error("اختر منخرطاً واحداً على الأقل"); return; }
    setGenerating(true);
    try {
      const w = window.open("", "_blank"); if (!w) { toast.error("اسمح بالنوافذ المنبثقة"); return; }
      w.document.write(generatePrintHTML(subs, design)); w.document.close();
      w.onload = () => setTimeout(() => w.print(), 800);
      toast.success(`تم إنشاء ${subs.length} بطاقة (RECTO/VERSO)`);
    } catch { toast.error("فشل"); } finally { setGenerating(false); }
  };

  const handleExportWord = () => {
    const subs = subscribers.filter((s) => selectedSubIds.includes(s.id));
    if (subs.length === 0) { toast.error("اختر منخرطاً واحداً على الأقل"); return; }
    setGenerating(true);
    try {
      const html = generateWordHTML(subs, design);
      const blob = new Blob([html], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `RCS_بطاقات_${new Date().toISOString().split("T")[0]}.doc`; a.click(); URL.revokeObjectURL(url);
      toast.success(`تم تصدير ${subs.length} بطاقة بصيغة Word`);
    } catch { toast.error("فشل التصدير"); } finally { setGenerating(false); }
  };

  const filteredSubs = useMemo(() => {
    let result = subscribers.filter((s) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return s.lastName.toLowerCase().includes(q) ||
             s.firstName.toLowerCase().includes(q) ||
             s.fileNumber.toLowerCase().includes(q) ||
             (s.subscriptionType || "").toLowerCase().includes(q);
    });
    if (subFilter) result = result.filter((s) => s.subscriptionType === subFilter);
    result.sort((a, b) => {
      switch (subSort) {
        case "lastName": return a.lastName.localeCompare(b.lastName);
        case "firstName": return a.firstName.localeCompare(b.firstName);
        case "subscriptionType": return (a.subscriptionType || "").localeCompare(b.subscriptionType || "");
        default: return a.fileNumber.localeCompare(b.fileNumber, undefined, { numeric: true });
      }
    });
    return result;
  }, [subscribers, search, subFilter, subSort]);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top toolbar — wraps on mobile, full row on desktop */}
      <div className="border-b bg-card px-2 sm:px-4 py-2 flex items-center justify-between gap-2 flex-wrap no-print">
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          {onBack && <Button variant="ghost" size="sm" onClick={onBack}>رجوع</Button>}
          <span className="font-bold text-sm truncate">مصمم البطاقات</span>
          <Badge variant="secondary" className="shrink-0">{selectedSubIds.length} محدد</Badge>
        </div>
        {/* Buttons row — wraps to next line on narrow screens */}
        <div className="flex items-center gap-1 flex-wrap justify-end">
          <input ref={fileTemplateRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          <Button size="sm" variant="outline" onClick={() => fileTemplateRef.current?.click()} className="h-8 px-2 sm:px-3">
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline mr-1">قالب</span>
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport} className="h-8 px-2 sm:px-3">
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline mr-1">تصدير</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowSettings(!showSettings)} className="h-8 px-2 sm:px-3">
            <Settings2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline mr-1">إعدادات</span>
          </Button>
          <Button size="sm" variant="outline" onClick={handleReset} className="h-8 px-2 sm:px-3">
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline mr-1">إعادة</span>
          </Button>
          <div className="w-px h-6 bg-border mx-0.5 hidden sm:block" />
          <Button size="sm" variant="outline" onClick={handleExportWord} disabled={generating} className="h-8 px-2 sm:px-3">
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            <span className="mr-1">Word</span>
          </Button>
          <Button size="sm" onClick={handlePrint} disabled={generating} className="h-8 px-2 sm:px-3">
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
            <span className="mr-1">PDF</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop: Left — elements + list (hidden on mobile) */}
        <div className="hidden lg:block w-56 border-l bg-card overflow-y-auto no-print">
          <ElementsPanel
            elements={elements}
            activeSide={activeSide}
            setActiveSide={setActiveSide}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            addElement={addElement}
            toggleVisible={toggleVisible}
            moveZ={moveZ}
            duplicateElement={duplicateElement}
            deleteElement={deleteElement}
            fileImageRef={fileImageRef}
            handleImageUpload={handleImageUpload}
          />
        </div>

        {/* Center — canvas (with auto-fit scale on mobile) */}
        <div className="flex-1 overflow-auto bg-muted/20 flex flex-col items-center justify-start p-2 sm:p-6">
          <div className="flex items-center gap-1 mb-3 bg-card rounded-lg p-1 border no-print">
            <button onClick={() => setActiveSide("front")} className={cn("px-3 sm:px-4 py-1.5 rounded text-xs sm:text-sm font-semibold transition", activeSide === "front" ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>الواجهة الأمامية</button>
            <button onClick={() => setActiveSide("back")} className={cn("px-3 sm:px-4 py-1.5 rounded text-xs sm:text-sm font-semibold transition", activeSide === "back" ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>الواجهة الخلفية</button>
          </div>

          {/* Card canvas — wrapped in a fit-to-screen scaler */}
          <CardCanvasScaler design={design} elements={elements} selectedId={selectedId} previewSub={previewSub} activeSide={activeSide} handleMouseDown={handleMouseDown} handleDoubleClick={handleDoubleClick} setSelectedId={setSelectedId} />

          <p className="text-xs text-muted-foreground mt-3 no-print text-center px-2">{design.config.width}سم × {design.config.height}سم — اسحب العناصر لتحريكها — اضغط على عنصر لتحديده</p>
        </div>

        {/* Desktop: Right — properties (hidden on mobile) */}
        <div className="hidden lg:block w-64 border-r bg-card overflow-y-auto no-print">
          {selected ? (
            <PropertiesPanel selected={selected} updateEl={updateEl} />
          ) : (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-semibold mb-1">حدد عنصراً من البطاقة</p>
              <p className="text-xs">لعرض خصائصه هنا</p>
            </div>
          )}
        </div>

        {/* Mobile: bottom action bar — opens elements or properties sheets */}
        {breakpoint === "mobile" && (
          <div className="flex border-t bg-card shrink-0 no-print">
            <button
              onClick={() => setMobileElementsSheet(true)}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold text-muted-foreground hover:bg-accent"
            >
              <Layers className="h-4 w-4" /> العناصر
              <Badge variant="outline" className="text-[8px] h-3 px-1">{elements.length}</Badge>
            </button>
            <button
              onClick={() => selected ? setMobilePropsSheet(true) : toast.info("اختر عنصراً أولاً")}
              className={cn("flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold", selected ? "text-primary" : "text-muted-foreground opacity-50")}
            >
              <Palette className="h-4 w-4" /> الخصائص
            </button>
          </div>
        )}

        {/* Mobile: Elements sheet (bottom) */}
        {breakpoint === "mobile" && (
          <Sheet open={mobileElementsSheet} onOpenChange={setMobileElementsSheet}>
            <SheetContent side="bottom" className="h-[75vh] p-0">
              <SheetHeader className="px-4 py-3 border-b bg-gradient-to-l from-teal-600 to-sky-700 text-white">
                <SheetTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2"><Layers className="h-5 w-5" /> العناصر</span>
                  <button onClick={() => setMobileElementsSheet(false)} className="p-1 rounded hover:bg-white/20"><X className="h-4 w-4" /></button>
                </SheetTitle>
              </SheetHeader>
              <div className="overflow-y-auto h-[calc(100%-56px)]">
                <ElementsPanel
                  elements={elements}
                  activeSide={activeSide}
                  setActiveSide={setActiveSide}
                  selectedId={selectedId}
                  setSelectedId={(id) => { setSelectedId(id); setMobileElementsSheet(false); }}
                  addElement={addElement}
                  toggleVisible={toggleVisible}
                  moveZ={moveZ}
                  duplicateElement={duplicateElement}
                  deleteElement={deleteElement}
                  fileImageRef={fileImageRef}
                  handleImageUpload={handleImageUpload}
                />
              </div>
            </SheetContent>
          </Sheet>
        )}

        {/* Mobile: Properties sheet (bottom) */}
        {breakpoint === "mobile" && selected && (
          <Sheet open={mobilePropsSheet} onOpenChange={setMobilePropsSheet}>
            <SheetContent side="bottom" className="h-[80vh] p-0">
              <SheetHeader className="px-4 py-3 border-b bg-gradient-to-l from-teal-600 to-sky-700 text-white">
                <SheetTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2"><Palette className="h-5 w-5" /> {selected.name}</span>
                  <button onClick={() => setMobilePropsSheet(false)} className="p-1 rounded hover:bg-white/20"><X className="h-4 w-4" /></button>
                </SheetTitle>
              </SheetHeader>
              <div className="overflow-y-auto h-[calc(100%-56px)]">
                <PropertiesPanel selected={selected} updateEl={updateEl} />
              </div>
            </SheetContent>
          </Sheet>
        )}

        {/* Desktop: Subscribers vertical panel (4th column) */}
        <div className="hidden xl:flex w-72 border-r bg-card flex-col no-print shrink-0">
          <SubscriberVerticalList
            subscribers={filteredSubs}
            selectedSubIds={selectedSubIds}
            onSelect={setSelectedSubIds}
            search={search}
            setSearch={setSearch}
            subFilter={subFilter}
            setSubFilter={setSubFilter}
            subSort={subSort}
            setSubSort={setSubSort}
            subTypes={subTypes}
          />
        </div>
      </div>

      {/* Mobile: Subscribers bottom bar */}
      {breakpoint === "mobile" && (
        <button
          onClick={() => setMobileSubsSheet(true)}
          className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold text-muted-foreground hover:bg-accent border-t shrink-0"
        >
          <User className="h-4 w-4" />
          <Badge variant="outline" className="text-[8px] h-3 px-1">{selectedSubIds.length} محدد</Badge>
        </button>
      )}

      {breakpoint === "mobile" && (
        <Sheet open={mobileSubsSheet} onOpenChange={setMobileSubsSheet}>
          <SheetContent side="bottom" className="h-[80vh] p-0">
            <SheetHeader className="px-4 py-3 border-b bg-gradient-to-l from-teal-600 to-sky-700 text-white">
              <SheetTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2"><User className="h-5 w-5" /> قائمة المنخرطين</span>
                <button onClick={() => setMobileSubsSheet(false)} className="p-1 rounded hover:bg-white/20"><X className="h-4 w-4" /></button>
              </SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto h-[calc(100%-56px)]">
              <SubscriberVerticalList
                subscribers={filteredSubs}
                selectedSubIds={selectedSubIds}
                onSelect={setSelectedSubIds}
                search={search}
                setSearch={setSearch}
                subFilter={subFilter}
                setSubFilter={setSubFilter}
                subSort={subSort}
                setSubSort={setSubSort}
                subTypes={subTypes}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-[100] bg-card border border-border/60 rounded-xl shadow-2xl py-1 min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <CtxItem icon={Palette} label="خصائص العنصر" onClick={() => handleContextAction("properties")} />
          <CtxItem icon={Pencil} label="إعادة تسمية" onClick={() => handleContextAction("rename")} />
          <div className="h-px bg-border/40 my-1" />
          <CtxItem icon={Copy} label="نسخ" onClick={() => handleContextAction("copy")} />
          <CtxItem icon={Clipboard} label="لصق" disabled={!clipboard} onClick={() => handleContextAction("paste")} />
          <CtxItem icon={Layers} label="تكرار" onClick={() => handleContextAction("duplicate")} />
          <div className="h-px bg-border/40 my-1" />
          <CtxItem icon={contextMenu.elementId && elements.find(e => e.id === contextMenu.elementId)?.locked ? Unlock : Lock} label={contextMenu.elementId && elements.find(e => e.id === contextMenu.elementId)?.locked ? "إلغاء القفل" : "قفل"} onClick={() => handleContextAction("lock")} />
          <CtxItem icon={contextMenu.elementId && elements.find(e => e.id === contextMenu.elementId)?.visible ? EyeOff : Eye} label={contextMenu.elementId && elements.find(e => e.id === contextMenu.elementId)?.visible ? "إخفاء" : "إظهار"} onClick={() => handleContextAction("toggleVisible")} />
          <div className="h-px bg-border/40 my-1" />
          <CtxItem icon={ChevronUp} label="إحضار للأمام" onClick={() => handleContextAction("bringFront")} />
          <CtxItem icon={ChevronDown} label="إرسال للخلف" onClick={() => handleContextAction("sendBack")} />
          <div className="h-px bg-border/40 my-1" />
          <CtxItem icon={Trash2} label="حذف" danger onClick={() => handleContextAction("delete")} />
        </div>
      )}

      {/* Rename Dialog */}
      {renameTarget && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => setRenameTarget(null)}>
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-sm flex items-center gap-2"><Pencil className="h-4 w-4 text-primary" /> إعادة تسمية العنصر</h3>
            <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="h-10" autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleRenameSave(); }} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-9" onClick={() => setRenameTarget(null)}>إلغاء</Button>
              <Button className="flex-1 h-9" onClick={handleRenameSave}>حفظ</Button>
            </div>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowSettings(false)}>
          <div className="bg-card rounded-2xl p-6 max-w-md w-full space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-base">إعدادات البطاقة</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-sm">عرض (سم)</Label><Input type="number" step="0.5" value={design.config.width} onChange={(e) => updateConfig({ width: parseFloat(e.target.value) || 10 })} className="h-9" /></div>
              <div><Label className="text-sm">ارتفاع (سم)</Label><Input type="number" step="0.5" value={design.config.height} onChange={(e) => updateConfig({ height: parseFloat(e.target.value) || 7 })} className="h-9" /></div>
              <div><Label className="text-sm">أعمدة</Label><Input type="number" min="1" max="4" value={design.config.cols} onChange={(e) => updateConfig({ cols: parseInt(e.target.value) || 2 })} className="h-9" /></div>
              <div><Label className="text-sm">صفوف</Label><Input type="number" min="1" max="6" value={design.config.rows} onChange={(e) => updateConfig({ rows: parseInt(e.target.value) || 4 })} className="h-9" /></div>
              <div><Label className="text-sm">فراغ (مم)</Label><Input type="number" step="0.5" value={design.config.gap} onChange={(e) => updateConfig({ gap: parseFloat(e.target.value) || 0 })} className="h-9" /></div>
              <div><Label className="text-sm">انحناء (px)</Label><Input type="number" value={design.config.borderRadius} onChange={(e) => updateConfig({ borderRadius: parseInt(e.target.value) || 0 })} className="h-9" /></div>
            </div>
            <div><Label className="text-sm">لون الخلفية</Label><Input type="color" value={design.config.bgColor} onChange={(e) => updateConfig({ bgColor: e.target.value })} className="h-9 w-full" /></div>
            <div><Label className="text-sm">شفافية الخلفية: {design.config.bgOpacity}%</Label><input type="range" min="0" max="100" value={design.config.bgOpacity} onChange={(e) => updateConfig({ bgOpacity: parseInt(e.target.value) })} className="w-full" /></div>
            <div><Label className="text-sm">صورة خلفية (PNG حتى 20MB)</Label><input ref={fileBgRef} type="file" accept="image/png,image/jpeg" onChange={(e) => handleImageUpload(e, "bg")} className="hidden" /><div className="flex gap-1"><Button size="sm" variant="outline" className="flex-1 h-9" onClick={() => fileBgRef.current?.click()}><ImageIcon className="h-4 w-4 ml-1" /> رفع</Button>{design.config.bgImage && <Button size="sm" variant="ghost" className="h-9 text-rose-600" onClick={() => updateConfig({ bgImage: undefined })}>إزالة</Button>}</div></div>
            {design.config.bgImage && <div><Label className="text-sm">شفافية صورة الخلفية: {design.config.bgImageOpacity ?? 30}%</Label><input type="range" min="0" max="100" value={design.config.bgImageOpacity ?? 30} onChange={(e) => updateConfig({ bgImageOpacity: parseInt(e.target.value) })} className="w-full" /></div>}
            <div><Label className="text-sm">لون الإطار</Label><Input type="color" value={design.config.borderColor} onChange={(e) => updateConfig({ borderColor: e.target.value })} className="h-9 w-full" /></div>
            <Button className="w-full" onClick={() => setShowSettings(false)}>تم</Button>
          </div>
        </div>
      )}

    </div>
  );
}

// ──────────────── CardCanvasScaler (fit-to-screen + transform: scale) ────────────────
//
// Renders the card at its natural pixel dimensions (cm × 37.8 px/cm), then
// applies transform: scale() so it fits the available width on any screen.
// On desktop it renders at full size; on mobile it scales down.

function CardCanvasScaler({
  design,
  elements,
  selectedId,
  previewSub,
  activeSide,
  handleMouseDown,
  handleDoubleClick,
  setSelectedId,
}: {
  design: CardDesign;
  elements: CardElement[];
  selectedId: string | null;
  previewSub: SubscriberWithComputed | null;
  activeSide: "front" | "back";
  handleMouseDown: (e: React.MouseEvent, el: CardElement) => void;
  handleDoubleClick: (el: CardElement) => void;
  setSelectedId: (id: string | null) => void;
}) {
  const naturalW = design.config.width * 37.8;
  const naturalH = design.config.height * 37.8;
  // Only scale on mobile/tablet; desktop shows full size with scroll
  const { containerRef, scale } = useScaleFit(naturalW, naturalH);

  return (
    <div
      ref={containerRef}
      className="flex justify-center w-full"
      style={{ height: `${naturalH * scale}px`, minHeight: "120px" }}
    >
      <div
        data-card
        onClick={() => setSelectedId(null)}
        className="relative shadow-2xl"
        style={{
          width: `${naturalW}px`,
          height: `${naturalH}px`,
          transform: `scale(${scale})`,
          transformOrigin: "top center",
          backgroundColor: design.config.bgColor,
          opacity: design.config.bgOpacity / 100,
          border: `${design.config.borderWidth}px ${design.config.borderStyle} ${design.config.borderColor}`,
          borderRadius: `${design.config.borderRadius}px`,
          direction: "rtl",
          overflow: "hidden",
          backgroundImage: design.config.bgImage ? `url(${design.config.bgImage})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {design.config.bgImage && (
          <div className="absolute inset-0" style={{ backgroundColor: design.config.bgColor, opacity: 1 - (design.config.bgImageOpacity ?? 30) / 100 }} />
        )}
        {activeSide === "back" && (
          <img src="/images/rcs-logo-official.png" alt="" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-3/4 w-3/4 object-contain pointer-events-none" style={{ opacity: 0.1 }} onError={(e) => e.currentTarget.style.display = "none"} />
        )}
        {elements.filter((e) => e.visible).sort((a, b) => a.zIndex - b.zIndex).map((el) => (
          <div
            key={el.id}
            onMouseDown={(e) => handleMouseDown(e, el)}
            onDoubleClick={() => handleDoubleClick(el)}
            onContextMenu={(e) => { e.preventDefault(); handleMouseDown(e, el); }}
            className={cn(
              "absolute flex items-center select-none",
              el.locked ? "cursor-default" : "cursor-move",
              selectedId === el.id && "ring-2 ring-blue-500 ring-offset-1"
            )}
            style={{
              left: `${el.x * 37.8}px`,
              top: `${el.y * 37.8}px`,
              width: `${el.width * 37.8}px`,
              height: `${el.height * 37.8}px`,
              transform: `rotate(${el.rotation}deg)`,
              opacity: el.opacity / 100,
              zIndex: el.zIndex,
              justifyContent: el.textAlign === "center" ? "center" : el.textAlign === "left" ? "flex-start" : "flex-end",
              direction: "rtl",
              overflow: "hidden",
              backgroundColor: el.bgColor ? `${el.bgColor}${Math.round((el.bgOpacity ?? 100) * 2.55).toString(16).padStart(2, "0")}` : undefined,
              border: el.borderWidth ? `${el.borderWidth}px ${el.borderStyle} ${el.borderColor}` : undefined,
              borderRadius: el.shapeKind === "circle" ? "50%" : `${el.borderRadius || 0}px`,
              padding: "0 4px",
            }}
          >
            {el.type === "qr" && <img src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(previewSub?.fileNumber || "RCS")}&color=000000&bgcolor=ffffff`} alt="QR" className="w-full h-full object-contain" draggable={false} />}
            {el.type === "logo" && <img src="/images/rcs-logo-official.png" alt="logo" className="w-full h-full object-contain" onError={(e) => e.currentTarget.style.display = "none"} draggable={false} />}
            {el.type === "uploadedImage" && el.imageData && <img src={el.imageData} alt="img" className="w-full h-full object-contain" draggable={false} />}
            {el.type === "uploadedImage" && !el.imageData && <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs">صورة</div>}
            {el.type === "photo" && (
              <div
                className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs overflow-hidden"
                style={{
                  borderRadius: el.shapeKind === "circle" ? "50%" : (el.borderRadius || 8),
                  border: el.borderWidth ? `${el.borderWidth}px ${el.borderStyle || "solid"} ${el.borderColor || "#000"}` : undefined,
                  boxShadow: el.shadow ? "0 2px 8px rgba(0,0,0,0.15)" : undefined,
                }}
              >
                {el.imageData ? (
                  <img src={el.imageData} alt="عضو" className="w-full h-full object-cover" draggable={false} />
                ) : (
                  <User className="h-1/2 w-1/2 opacity-40" />
                )}
              </div>
            )}
            {el.type === "shape" && <div className="w-full h-full" />}
            {el.type !== "qr" && el.type !== "logo" && el.type !== "photo" && el.type !== "shape" && el.type !== "uploadedImage" && (
              <span style={{ fontFamily: `${el.fontFamily}, Arial, sans-serif`, fontSize: `${el.fontSize}px`, fontWeight: el.fontWeight as React.CSSProperties["fontWeight"], color: el.color, textAlign: el.textAlign as React.CSSProperties["textAlign"], width: "100%", lineHeight: 1.3, wordBreak: "break-word" }}>
                {(el.showLabel ? (el.labelText || "") : "") + getContent(el, previewSub)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────── ElementsPanel (reused by desktop sidebar + mobile sheet) ────────────────
function ElementsPanel({
  elements,
  activeSide,
  setActiveSide,
  selectedId,
  setSelectedId,
  addElement,
  toggleVisible,
  moveZ,
  duplicateElement,
  deleteElement,
  fileImageRef,
  handleImageUpload,
}: {
  elements: CardElement[];
  activeSide: "front" | "back";
  setActiveSide: (s: "front" | "back") => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  addElement: (t: ElementType) => void;
  toggleVisible: (id: string) => void;
  moveZ: (id: string, dir: "up" | "down") => void;
  duplicateElement: (id: string) => void;
  deleteElement: (id: string) => void;
  fileImageRef: React.RefObject<HTMLInputElement | null>;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>, target: "element" | "bg") => void;
}) {
  return (
    <div className="p-3">
      <h3 className="font-bold text-xs mb-2 text-muted-foreground uppercase">إضافة عنصر</h3>
      <div className="grid grid-cols-3 gap-1.5">
        {ELEMENT_LIBRARY.map((el) => {
          const Icon = el.icon;
          return (
            <button key={el.type} onClick={() => addElement(el.type)} title={el.label} className="flex flex-col items-center gap-0.5 p-2 rounded-lg border border-border hover:bg-accent hover:border-primary/40 transition group">
              <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              <span className="text-[9px] text-muted-foreground">{el.label}</span>
            </button>
          );
        })}
      </div>
      <input ref={fileImageRef} type="file" accept="image/png,image/jpeg,image/jpg" onChange={(e) => handleImageUpload(e, "element")} className="hidden" />
      <Button size="sm" variant="outline" className="w-full mt-2 h-8 text-xs" onClick={() => fileImageRef.current?.click()}>
        <ImageIcon className="h-3.5 w-3.5 ml-1" /> رفع صورة/شعار
      </Button>
      <div className="border-t my-3" />
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-xs text-muted-foreground uppercase">العناصر ({elements.length})</h3>
        <div className="flex gap-1">
          <button onClick={() => setActiveSide("front")} className={cn("text-[10px] px-2 py-0.5 rounded", activeSide === "front" ? "bg-primary text-primary-foreground" : "bg-muted")}>أمامي</button>
          <button onClick={() => setActiveSide("back")} className={cn("text-[10px] px-2 py-0.5 rounded", activeSide === "back" ? "bg-primary text-primary-foreground" : "bg-muted")}>خلفي</button>
        </div>
      </div>
      <div className="space-y-1 max-h-96 overflow-y-auto">
        {elements.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">لا توجد عناصر</p>
        ) : (
          [...elements].reverse().map((el) => (
            <div key={el.id} onClick={() => setSelectedId(el.id)} className={cn("flex items-center gap-1 p-1.5 rounded-lg cursor-pointer text-xs transition", selectedId === el.id ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-accent")}>
              <button onClick={(e) => { e.stopPropagation(); toggleVisible(el.id); }} className="text-muted-foreground">{el.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}</button>
              <span className={cn("flex-1 truncate", !el.visible && "opacity-50")}>{el.name}</span>
              <button onClick={(e) => { e.stopPropagation(); moveZ(el.id, "up"); }} className="text-muted-foreground"><ChevronUp className="h-3 w-3" /></button>
              <button onClick={(e) => { e.stopPropagation(); moveZ(el.id, "down"); }} className="text-muted-foreground"><ChevronDown className="h-3 w-3" /></button>
              <button onClick={(e) => { e.stopPropagation(); duplicateElement(el.id); }} className="text-muted-foreground"><Copy className="h-3 w-3" /></button>
              <button onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }} className="text-muted-foreground hover:text-rose-500"><Trash2 className="h-3 w-3" /></button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ──────────────── PropertiesPanel (reused by desktop sidebar + mobile sheet) ────────────────
function PropertiesPanel({
  selected,
  updateEl,
}: {
  selected: CardElement;
  updateEl: (id: string, updates: Partial<CardElement>) => void;
}) {
  const isTextType = selected.type !== "logo" && selected.type !== "qr" && selected.type !== "photo" && selected.type !== "shape" && selected.type !== "uploadedImage";
  const isEditableText = selected.type === "customText" || selected.type === "cardTitle" || selected.type === "clubName";

  return (
    <div className="p-3 space-y-1">
      {/* Element header with badge */}
      <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/20 mb-2">
        <Palette className="h-4 w-4 text-primary shrink-0" />
        <span className="font-bold text-xs flex-1 truncate">{selected.name}</span>
        <Badge variant="outline" className="text-[8px] h-4 px-1 shrink-0">{selected.type}</Badge>
      </div>

      {/* 📍 الموضع */}
      <CollapsibleSection title="📍 الموضع" defaultOpen>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-[10px]">X (سم)</Label><Input type="number" step="0.1" value={Math.round(selected.x * 10) / 10} onChange={(e) => updateEl(selected.id, { x: parseFloat(e.target.value) || 0 })} className="h-8 text-xs" /></div>
          <div><Label className="text-[10px]">Y (سم)</Label><Input type="number" step="0.1" value={Math.round(selected.y * 10) / 10} onChange={(e) => updateEl(selected.id, { y: parseFloat(e.target.value) || 0 })} className="h-8 text-xs" /></div>
          <div><Label className="text-[10px]">عرض</Label><Input type="number" step="0.5" value={selected.width} onChange={(e) => updateEl(selected.id, { width: parseFloat(e.target.value) || 1 })} className="h-8 text-xs" /></div>
          <div><Label className="text-[10px]">ارتفاع</Label><Input type="number" step="0.5" value={selected.height} onChange={(e) => updateEl(selected.id, { height: parseFloat(e.target.value) || 1 })} className="h-8 text-xs" /></div>
        </div>
        <div className="mt-2"><Label className="text-[10px]">دوران: {selected.rotation}°</Label><input type="range" min="0" max="360" value={selected.rotation} onChange={(e) => updateEl(selected.id, { rotation: parseInt(e.target.value) })} className="w-full" /></div>
      </CollapsibleSection>

      {/* 📝 النص */}
      {isTextType && (
        <CollapsibleSection title="📝 النص" defaultOpen>
          {isEditableText && (
            <div className="mb-2"><Label className="text-[10px]">المحتوى</Label><textarea value={selected.text || ""} onChange={(e) => updateEl(selected.id, { text: e.target.value })} rows={2} className="w-full text-xs p-2 rounded border bg-background" /></div>
          )}
          <div><Label className="text-[10px]">الخط</Label><select value={selected.fontFamily} onChange={(e) => updateEl(selected.id, { fontFamily: e.target.value })} className="w-full h-8 text-xs rounded border bg-card">{FONTS.map((f) => <option key={f} value={f}>{f}</option>)}</select></div>
          <div className="mt-1"><Label className="text-[10px]">الحجم: {selected.fontSize}px</Label><input type="range" min="6" max="24" value={selected.fontSize} onChange={(e) => updateEl(selected.id, { fontSize: parseInt(e.target.value) })} className="w-full" /></div>
          <div className="flex gap-1 mt-1">
            <Button size="sm" variant={selected.fontWeight === "bold" ? "default" : "outline"} className="h-8 flex-1 text-xs" onClick={() => updateEl(selected.id, { fontWeight: selected.fontWeight === "bold" ? "normal" : "bold" })}><Bold className="h-3 w-3" /></Button>
            <Button size="sm" variant={selected.textAlign === "right" ? "default" : "outline"} className="h-8 flex-1 text-xs" onClick={() => updateEl(selected.id, { textAlign: "right" })}><AlignRight className="h-3 w-3" /></Button>
            <Button size="sm" variant={selected.textAlign === "center" ? "default" : "outline"} className="h-8 flex-1 text-xs" onClick={() => updateEl(selected.id, { textAlign: "center" })}><AlignCenter className="h-3 w-3" /></Button>
            <Button size="sm" variant={selected.textAlign === "left" ? "default" : "outline"} className="h-8 flex-1 text-xs" onClick={() => updateEl(selected.id, { textAlign: "left" })}><AlignLeft className="h-3 w-3" /></Button>
          </div>
          <div className="mt-2">
            <Label className="text-[10px]">اللون</Label>
            <div className="flex flex-wrap gap-1 mt-1">{PRESET_COLORS.map((c) => <button key={c} onClick={() => updateEl(selected.id, { color: c })} className={cn("h-5 w-5 rounded border-2", selected.color === c ? "border-primary" : "border-border")} style={{ backgroundColor: c }} />)}</div>
            <Input type="color" value={selected.color} onChange={(e) => updateEl(selected.id, { color: e.target.value })} className="h-8 w-full mt-1" />
          </div>
          {!isEditableText && (
            <label className="flex items-center gap-2 text-xs mt-2"><input type="checkbox" checked={selected.showLabel || false} onChange={(e) => updateEl(selected.id, { showLabel: e.target.checked })} /> إظهار تسمية</label>
          )}
          {selected.showLabel && <Input value={selected.labelText || ""} onChange={(e) => updateEl(selected.id, { labelText: e.target.value })} className="h-8 text-xs mt-1" />}
        </CollapsibleSection>
      )}

      {/* 🎨 المظهر */}
      <CollapsibleSection title="🎨 المظهر">
        <div><Label className="text-[10px]">شفافية: {selected.opacity}%</Label><input type="range" min="0" max="100" value={selected.opacity} onChange={(e) => updateEl(selected.id, { opacity: parseInt(e.target.value) })} className="w-full" /></div>
        <div className="mt-2"><Label className="text-[10px]">خلفية العنصر</Label><div className="flex items-center gap-2"><Input type="color" value={selected.bgColor || "#ffffff"} onChange={(e) => updateEl(selected.id, { bgColor: e.target.value })} className="h-8 w-12 p-1" /><Input type="range" min="0" max="100" value={selected.bgOpacity ?? 100} onChange={(e) => updateEl(selected.id, { bgOpacity: parseInt(e.target.value) })} className="flex-1" /></div></div>
        <div className="mt-2"><Label className="text-[10px]">إطار</Label><div className="flex gap-1"><select value={selected.borderStyle || "none"} onChange={(e) => updateEl(selected.id, { borderStyle: e.target.value })} className="flex-1 h-8 text-xs rounded border bg-card"><option value="none">بدون</option><option value="solid">متصل</option><option value="dashed">متقطع</option><option value="dotted">نقاط</option></select><Input type="number" min="0" max="10" value={selected.borderWidth || 0} onChange={(e) => updateEl(selected.id, { borderWidth: parseInt(e.target.value) })} className="h-8 w-12 text-xs" /><Input type="color" value={selected.borderColor || "#000000"} onChange={(e) => updateEl(selected.id, { borderColor: e.target.value })} className="h-8 w-12 p-1" /></div></div>
        <div className="mt-2"><Label className="text-[10px]">انحناء: {selected.borderRadius || 0}px</Label><input type="range" min="0" max="50" value={selected.borderRadius || 0} onChange={(e) => updateEl(selected.id, { borderRadius: parseInt(e.target.value) })} className="w-full" /></div>
        {selected.type === "shape" && <div className="flex gap-1 mt-2"><Button size="sm" variant={selected.shapeKind === "rectangle" ? "default" : "outline"} className="flex-1 h-8 text-xs" onClick={() => updateEl(selected.id, { shapeKind: "rectangle" })}><Square className="h-3 w-3 ml-1" /> مستطيل</Button><Button size="sm" variant={selected.shapeKind === "circle" ? "default" : "outline"} className="flex-1 h-8 text-xs" onClick={() => updateEl(selected.id, { shapeKind: "circle" })}><Circle className="h-3 w-3 ml-1" /> دائرة</Button></div>}
      </CollapsibleSection>
    </div>
  );
}

// ──────────────── Collapsible Section (Accordion-like) ────────────────
function CollapsibleSection({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="rounded-lg border border-border/40 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-bold hover:bg-accent/40 transition"
      >
        <span>{title}</span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
      </button>
      {open && <div className="p-2 space-y-1 border-t border-border/40">{children}</div>}
    </div>
  );
}

// ──────────────── Print HTML ────────────────

function generatePrintHTML(subscribers: SubscriberWithComputed[], design: CardDesign): string {
  const { config } = design;
  const cardsPerPage = config.cols * config.rows;
  const generateCard = (sub: SubscriberWithComputed | null, side: "front" | "back") => {
    const els = side === "front" ? design.front : design.back;
    const elsHTML = els.filter((e) => e.visible).sort((a, b) => a.zIndex - b.zIndex).map((el) => {
      const base = `position:absolute;left:${el.x}cm;top:${el.y}cm;width:${el.width}cm;height:${el.height}cm;display:flex;align-items:center;justify-content:${el.textAlign === "center" ? "center" : el.textAlign === "left" ? "flex-start" : "flex-end"};direction:rtl;overflow:hidden;transform:rotate(${el.rotation}deg);opacity:${el.opacity / 100};z-index:${el.zIndex};${el.bgColor ? `background-color:${el.bgColor}${Math.round((el.bgOpacity ?? 100) * 2.55).toString(16).padStart(2, "0")};` : ""}${el.borderWidth ? `border:${el.borderWidth}px ${el.borderStyle} ${el.borderColor};` : ""}border-radius:${el.shapeKind === "circle" ? "50%" : `${el.borderRadius || 0}px`};padding:0 4px;`;
      if (el.type === "qr") return `<div style="${base}"><img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(sub?.fileNumber || "RCS")}&color=000000&bgcolor=ffffff" style="width:100%;height:100%;object-fit:contain;" /></div>`;
      if (el.type === "logo") return `<div style="${base}"><img src="/images/rcs-logo-official.png" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none'" /></div>`;
      if (el.type === "uploadedImage" && el.imageData) return `<div style="${base}"><img src="${el.imageData}" style="width:100%;height:100%;object-fit:contain;" /></div>`;
      if (el.type === "photo") return `<div style="${base}background:#e5e7eb;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:8px;color:#999;">صورة</div>`;
      if (el.type === "shape") return `<div style="${base}"></div>`;
      const content = getContent(el, sub); const label = el.showLabel ? (el.labelText || "") : "";
      return `<div style="${base}"><span style="font-family:${el.fontFamily},Arial,sans-serif;font-size:${el.fontSize}px;font-weight:${el.fontWeight};color:${el.color};text-align:${el.textAlign};width:100%;line-height:1.3;word-break:break-word;">${escapeHtml(label + content)}</span></div>`;
    }).join("");
    const bgStyle = config.bgImage ? `background-image:url(${config.bgImage});background-size:cover;background-position:center;` : "";
    const logoWatermark = side === "back" ? `<img src="/images/rcs-logo-official.png" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);height:75%;width:75%;object-fit:contain;opacity:0.1;z-index:0;" onerror="this.style.display='none'" />` : "";
    return `<div style="width:${config.width}cm;height:${config.height}cm;background-color:${config.bgColor};${bgStyle}border:${config.borderWidth}px ${config.borderStyle} ${config.borderColor};border-radius:${config.borderRadius}px;position:relative;overflow:hidden;direction:rtl;break-inside:avoid;">${logoWatermark}${elsHTML}</div>`;
  };
  let pagesHTML = "";
  for (let i = 0; i < subscribers.length; i += cardsPerPage) {
    const chunk = subscribers.slice(i, i + cardsPerPage);
    pagesHTML += `<div class="print-page" style="width:21cm;min-height:297mm;padding:10mm;direction:rtl;"><div style="display:grid;grid-template-columns:repeat(${config.cols},1fr);gap:${config.gap}mm;">${chunk.map((s) => generateCard(s, "front")).join("")}</div></div>`;
    pagesHTML += `<div class="print-page" style="width:21cm;min-height:297mm;padding:10mm;direction:ltr;"><div style="display:grid;grid-template-columns:repeat(${config.cols},1fr);gap:${config.gap}mm;">${chunk.map((s) => generateCard(s, "back")).join("")}</div></div>`;
  }
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>بطاقات الانخراط - نادي RCS</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Cairo','Tajawal',Arial,sans-serif;background:white;}@page{size:Letter portrait;margin:0 1.27cm;}.print-page{page-break-after:always;}.print-page:last-child{page-break-after:auto;}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}@media screen{.print-page{margin:10mm auto;box-shadow:0 4px 12px rgba(0,0,0,0.1);}body{background:#f5f5f5;padding:20px;}}</style></head><body>${pagesHTML}</body></html>`;
}

// ──────────────── Word HTML (with EN-TETE) ────────────────

function generateWordHTML(subscribers: SubscriberWithComputed[], design: CardDesign): string {
  const { config } = design;
  const today = new Date();
  const year = today.getFullYear();
  const dateStr = today.toISOString().split("T")[0].replace(/-/g,"/");

  const generateCardCell = (sub: SubscriberWithComputed, side: "front" | "back") => {
    const els = side === "front" ? design.front : design.back;
    const elsHTML = els.filter((e) => e.visible).sort((a, b) => a.zIndex - b.zIndex).map((el) => {
      const base = `position:absolute;left:${el.x}cm;top:${el.y}cm;width:${el.width}cm;height:${el.height}cm;display:flex;align-items:center;justify-content:${el.textAlign === "center" ? "center" : el.textAlign === "left" ? "flex-start" : "flex-end"};direction:rtl;overflow:hidden;${el.bgColor ? `background-color:${el.bgColor};` : ""}${el.borderWidth ? `border:${el.borderWidth}px ${el.borderStyle} ${el.borderColor};` : ""}border-radius:${el.borderRadius || 0}px;padding:0 4px;`;
      if (el.type === "qr") return `<div style="${base}"><img src="https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(sub.fileNumber)}&color=000000&bgcolor=ffffff" style="width:100%;height:100%;object-fit:contain;" /></div>`;
      if (el.type === "logo") return `<div style="${base}"><img src="/images/rcs-logo-official.png" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none'" /></div>`;
      if (el.type === "uploadedImage" && el.imageData) return `<div style="${base}"><img src="${el.imageData}" style="width:100%;height:100%;object-fit:contain;" /></div>`;
      if (el.type === "photo") return `<div style="${base}background:#e5e7eb;border-radius:8px;"></div>`;
      if (el.type === "shape") return `<div style="${base}"></div>`;
      const content = getContent(el, sub); const label = el.showLabel ? (el.labelText || "") : "";
      return `<div style="${base}"><span style="font-family:${el.fontFamily},Arial,sans-serif;font-size:${el.fontSize}px;font-weight:${el.fontWeight};color:${el.color};text-align:${el.textAlign};width:100%;line-height:1.3;">${escapeHtml(label + content)}</span></div>`;
    }).join("");
    const logoWatermark = side === "back" ? `<img src="/images/rcs-logo-official.png" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);height:75%;width:75%;object-fit:contain;opacity:0.1;" onerror="this.style.display='none'" />` : "";
    return `<div style="width:${config.width}cm;height:${config.height}cm;background-color:${config.bgColor};border:${config.borderWidth}px ${config.borderStyle} ${config.borderColor};border-radius:${config.borderRadius}px;position:relative;overflow:hidden;direction:rtl;display:inline-block;margin:5mm;">${logoWatermark}${elsHTML}</div>`;
  };

  // EN-TETE (from Word file template)
  const entete = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr>
        <td style="width:20%;text-align:right;vertical-align:middle;">
          <img src="/images/rcs-logo-official.png" style="height:60px;width:60px;object-fit:contain;" onerror="this.style.display='none'" />
        </td>
        <td style="width:60%;text-align:center;vertical-align:middle;">
          <p style="font-size:14px;font-weight:bold;color:#0f766e;margin:2px;">النادي الهاوي متعدد الرياضات</p>
          <p style="font-size:12px;font-weight:bold;color:#f59e0b;margin:2px;">الرائد - سعيدة</p>
          <p style="font-size:11px;color:#666;margin:2px;">فرع السباحة</p>
        </td>
        <td style="width:20%;text-align:left;vertical-align:middle;">
          <img src="/images/rcs-logo-official.png" style="height:60px;width:60px;object-fit:contain;" onerror="this.style.display='none'" />
        </td>
      </tr>
    </table>
    <table style="width:100%;border-collapse:collapse;margin-bottom:15px;font-size:11px;">
      <tr>
        <td style="text-align:right;font-weight:bold;">الرقم: ..... / ن.ر.ه. ..... / ر.س ..... / ${year}</td>
        <td style="text-align:left;font-weight:bold;">سعيدة في: ${dateStr}</td>
      </tr>
    </table>
    <hr style="border:1px solid #0f766e;margin:10px 0;" />
    <h2 style="text-align:center;font-size:16px;font-weight:bold;color:#0f766e;margin:15px 0;">بطاقات الانخراط — ${subscribers.length} بطاقة</h2>
  `;

  // Front page
  const frontCards = subscribers.map((s) => generateCardCell(s, "front")).join("");
  // Back page
  const backCards = subscribers.map((s) => generateCardCell(s, "back")).join("");

  return `<!DOCTYPE html><html dir="rtl" lang="ar" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>بطاقات الانخراط - نادي RCS</title><style>@page{size:A4 portrait;margin:15mm;}body{font-family:'Cairo','Tahoma',Arial,sans-serif;font-size:12px;line-height:1.5;}</style></head><body>
    ${entete}
    <h3 style="text-align:center;font-size:14px;color:#0f766e;margin:20px 0 10px;">الواجهة الأمامية (RECTO)</h3>
    <div style="text-align:center;">${frontCards}</div>
    <br style="page-break-before:always;" />
    <h3 style="text-align:center;font-size:14px;color:#0f766e;margin:20px 0 10px;">الواجهة الخلفية (VERSO)</h3>
    <div style="text-align:center;">${backCards}</div>
  </body></html>`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Context Menu item helper
function CtxItem({ icon: Icon, label, onClick, disabled, danger }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition text-right",
        disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-accent",
        danger ? "text-rose-600 hover:bg-rose-500/10" : "text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1">{label}</span>
    </button>
  );
}

// ════════════ SubscriberVerticalList — لوحة المنخرطين العمودية ════════════
function SubscriberVerticalList({
  subscribers,
  selectedSubIds,
  onSelect,
  search,
  setSearch,
  subFilter,
  setSubFilter,
  subSort,
  setSubSort,
  subTypes,
}: {
  subscribers: SubscriberWithComputed[];
  selectedSubIds: string[];
  onSelect: (ids: string[]) => void;
  search: string;
  setSearch: (s: string) => void;
  subFilter: string;
  setSubFilter: (s: string) => void;
  subSort: "fileNumber" | "lastName" | "firstName" | "subscriptionType";
  setSubSort: (s: "fileNumber" | "lastName" | "firstName" | "subscriptionType") => void;
  subTypes: any[];
}) {
  const toggleSelect = (id: string) => {
    onSelect(selectedSubIds.includes(id)
      ? selectedSubIds.filter((i) => i !== id)
      : [...selectedSubIds, id]);
  };

  const getTypeColor = (code: string) => {
    const t = subTypes.find((st: any) => st.code === code);
    return t?.color || "#0d9488";
  };

  return (
    <div className="flex flex-col h-full">
      {/* ═══ Header ═══ */}
      <div className="p-2 border-b space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-xs flex items-center gap-1.5">
            <User className="h-4 w-4" /> المنخرطون
          </h3>
          <Badge variant="secondary" className="text-[9px]">{selectedSubIds.length}/{subscribers.length}</Badge>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو الرقم..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pr-7 text-xs"
          />
        </div>

        {/* Filters — horizontal scroll */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          <button
            onClick={() => setSubFilter("")}
            className={cn("px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap transition", !subFilter ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent")}
          >
            الكل
          </button>
          {subTypes.map((t: any) => (
            <button
              key={t.code}
              onClick={() => setSubFilter(t.code)}
              className={cn("px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap transition border", subFilter === t.code ? "text-white" : "bg-muted hover:bg-accent")}
              style={subFilter === t.code ? { backgroundColor: t.color, borderColor: t.color } : { borderColor: t.color + "40" }}
            >
              {t.name}
            </button>
          ))}
        </div>

        {/* Sort + Actions */}
        <div className="flex items-center gap-1">
          <select
            value={subSort}
            onChange={(e) => setSubSort(e.target.value as any)}
            className="h-7 text-[10px] rounded border bg-card px-1 flex-1"
          >
            <option value="fileNumber">ترتيب: رقم الملف</option>
            <option value="lastName">ترتيب: اللقب</option>
            <option value="firstName">ترتيب: الاسم</option>
            <option value="subscriptionType">ترتيب: النوع</option>
          </select>
          <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2" onClick={() => onSelect(subscribers.map((s) => s.id))}>تحديد الكل</Button>
          <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2" onClick={() => onSelect([])}>إلغاء</Button>
        </div>
      </div>

      {/* ═══ List — virtual scroll with simple slicing ═══ */}
      <div className="flex-1 overflow-y-auto">
        {subscribers.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            <User className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>لا توجد نتائج</p>
          </div>
        ) : (
          subscribers.map((s) => {
            const isSelected = selectedSubIds.includes(s.id);
            const typeColor = getTypeColor(s.subscriptionType);
            return (
              <button
                key={s.id}
                onClick={() => toggleSelect(s.id)}
                className={cn(
                  "w-full flex items-start gap-2 p-2 border-b text-right transition",
                  isSelected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-accent/40"
                )}
              >
                {/* Checkbox */}
                <div className={cn("h-4 w-4 rounded border-2 flex items-center justify-center mt-0.5 shrink-0", isSelected ? "bg-primary border-primary text-primary-foreground" : "border-border")}>
                  {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] font-bold text-primary truncate">{s.fileNumber}</span>
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: typeColor }} />
                  </div>
                  <p className="text-xs font-semibold truncate">{s.lastName} {s.firstName}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{s.subscriptionType}</span>
                    <span>•</span>
                    <span>{s.age} سنة</span>
                    {s.gender && (<><span>•</span><span>{s.gender}</span></>)}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

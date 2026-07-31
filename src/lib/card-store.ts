"use client";

import { create } from "zustand";
import type { CardDesign, CardElement, CardConfig, ElementType } from "./card-types";
import { uid } from "./card-types";

// ═══════════════════════════════════════════════════════════════
//  Default Card Design — RCS Club membership card
// ═══════════════════════════════════════════════════════════════

export const DEFAULT_DESIGN: CardDesign = {
  front: [
    { id: "f1", type: "logo", name: "شعار", x: 7.5, y: 0.3, width: 2, height: 1.2, rotation: 0, opacity: 100, zIndex: 1, visible: true },
    { id: "f2", type: "clubName", name: "اسم النادي", x: 0.5, y: 0.3, width: 6.5, height: 0.7, rotation: 0, opacity: 100, zIndex: 2, visible: true, text: "النادي الرياضي المتعدد الرياضات الرائد - سعيدة", fontFamily: "Cairo", fontSize: 11, fontWeight: "bold", textAlign: "right", color: "#0f766e", showLabel: false },
    { id: "f3", type: "cardTitle", name: "عنوان", x: 0.5, y: 1.0, width: 6.5, height: 0.5, rotation: 0, opacity: 100, zIndex: 3, visible: true, text: "بطاقة الانخراط", fontFamily: "Cairo", fontSize: 10, fontWeight: "normal", textAlign: "right", color: "#ca8a04", showLabel: false },
    { id: "f4", type: "photo", name: "صورة", x: 0.5, y: 1.8, width: 2.5, height: 3, rotation: 0, opacity: 100, zIndex: 4, visible: true, bgColor: "#e5e7eb", bgOpacity: 100, borderRadius: 8, shapeKind: "rectangle", shadow: true },
    { id: "f5", type: "fullName", name: "الاسم", x: 3.2, y: 1.8, width: 6, height: 0.8, rotation: 0, opacity: 100, zIndex: 5, visible: true, fontFamily: "Cairo", fontSize: 14, fontWeight: "bold", textAlign: "right", color: "#111111", showLabel: false },
    { id: "f6", type: "memberId", name: "رقم", x: 3.2, y: 2.6, width: 3, height: 0.6, rotation: 0, opacity: 100, zIndex: 6, visible: true, fontFamily: "Cairo", fontSize: 10, fontWeight: "normal", textAlign: "right", color: "#0f766e", showLabel: true, labelText: "رقم: " },
    { id: "f7", type: "bloodType", name: "فصيلة", x: 6.2, y: 2.6, width: 3, height: 0.6, rotation: 0, opacity: 100, zIndex: 7, visible: true, fontFamily: "Cairo", fontSize: 12, fontWeight: "bold", textAlign: "right", color: "#dc2626", showLabel: true, labelText: "🩸 " },
    { id: "f8", type: "dateOfBirth", name: "ميلاد", x: 3.2, y: 3.2, width: 3, height: 0.6, rotation: 0, opacity: 100, zIndex: 8, visible: true, fontFamily: "Cairo", fontSize: 9, fontWeight: "normal", textAlign: "right", color: "#333333", showLabel: true, labelText: "الميلاد: " },
    { id: "f9", type: "subscriptionType", name: "نوع", x: 6.2, y: 3.2, width: 3, height: 0.6, rotation: 0, opacity: 100, zIndex: 9, visible: true, fontFamily: "Cairo", fontSize: 9, fontWeight: "normal", textAlign: "right", color: "#333333", showLabel: true, labelText: "النوع: " },
    { id: "f10", type: "qr", name: "QR", x: 7.5, y: 4.2, width: 2, height: 2, rotation: 0, opacity: 100, zIndex: 10, visible: true },
  ],
  back: [
    { id: "b1", type: "cardTitle", name: "عنوان", x: 0.5, y: 0.3, width: 9, height: 0.7, rotation: 0, opacity: 100, zIndex: 1, visible: true, text: "معلومات الاشتراك", fontFamily: "Cairo", fontSize: 12, fontWeight: "bold", textAlign: "center", color: "#0f766e", showLabel: false },
    { id: "b2", type: "swimmingDays", name: "أيام", x: 0.5, y: 1.5, width: 9, height: 0.6, rotation: 0, opacity: 100, zIndex: 2, visible: true, fontFamily: "Cairo", fontSize: 10, fontWeight: "normal", textAlign: "right", color: "#333333", showLabel: true, labelText: "أيام السباحة: " },
    { id: "b3", type: "swimmingTime", name: "وقت", x: 0.5, y: 2.2, width: 9, height: 0.6, rotation: 0, opacity: 100, zIndex: 3, visible: true, fontFamily: "Cairo", fontSize: 10, fontWeight: "normal", textAlign: "right", color: "#333333", showLabel: true, labelText: "التوقيت: " },
    { id: "b4", type: "subscriptionType", name: "نوع", x: 0.5, y: 2.9, width: 9, height: 0.6, rotation: 0, opacity: 100, zIndex: 4, visible: true, fontFamily: "Cairo", fontSize: 10, fontWeight: "normal", textAlign: "right", color: "#333333", showLabel: true, labelText: "نوع الاشتراك: " },
    { id: "b5", type: "expiryDate", name: "نهاية", x: 0.5, y: 3.6, width: 9, height: 0.6, rotation: 0, opacity: 100, zIndex: 5, visible: true, fontFamily: "Cairo", fontSize: 11, fontWeight: "bold", textAlign: "right", color: "#dc2626", showLabel: true, labelText: "تاريخ الانتهاء: " },
  ],
  config: {
    width: 10, height: 7, cols: 2, rows: 4, gap: 0, offsetX: 0, offsetY: 0,
    bgColor: "#ffffff", bgOpacity: 100,
    borderColor: "#0f766e", borderWidth: 2, borderStyle: "solid", borderRadius: 12,
    gradientEnabled: false, gradientStart: "#0f766e", gradientEnd: "#0369a1", gradientDirection: "diagonal",
  },
};

// ═══════════════════════════════════════════════════════════════
//  Zustand Store — Single Source of Truth
// ═══════════════════════════════════════════════════════════════
//  كل العمليات (المصمم، المعاينة، الطباعة، التصدير) تقرأ من هنا.
//  لا توجد نسخ منفصلة من CardDesign.

interface CardDesignState {
  design: CardDesign;
  activeSide: "front" | "back";
  selectedElementId: string | null;
  selectedSubscriberId: string | null;
  hydrated: boolean;

  // Hydration (load from localStorage)
  hydrate: () => void;

  // Design ops
  setDesign: (design: CardDesign) => void;
  updateConfig: (updates: Partial<CardConfig>) => void;
  resetDesign: () => void;

  // Side + selection
  setActiveSide: (side: "front" | "back") => void;
  setSelectedElementId: (id: string | null) => void;
  setSelectedSubscriberId: (id: string | null) => void;

  // Element ops
  addElement: (type: ElementType) => void;
  updateElement: (id: string, updates: Partial<CardElement>) => void;
  deleteElement: (id: string) => void;
  duplicateElement: (id: string) => void;
  toggleVisible: (id: string) => void;
  toggleLocked: (id: string) => void;
  moveZ: (id: string, dir: "up" | "down") => void;

  // Persistence
  saveToLocalStorage: () => void;
}

const STORAGE_KEY = "aquacore-card-design-pro-v3";

export const useCardDesignStore = create<CardDesignState>((set, get) => ({
  design: DEFAULT_DESIGN,
  activeSide: "front",
  selectedElementId: null,
  selectedSubscriberId: null,
  hydrated: false,

  hydrate: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CardDesign;
        if (parsed.front && parsed.back && parsed.config) {
          set({ design: parsed, hydrated: true });
          return;
        }
      }
    } catch { /* ignore */ }
    set({ hydrated: true });
  },

  setDesign: (design) => {
    set({ design });
    get().saveToLocalStorage();
  },

  updateConfig: (updates) => {
    set((state) => ({
      design: { ...state.design, config: { ...state.design.config, ...updates } },
    }));
    get().saveToLocalStorage();
  },

  resetDesign: () => {
    set({ design: DEFAULT_DESIGN, selectedElementId: null });
    get().saveToLocalStorage();
  },

  setActiveSide: (side) => set({ activeSide: side }),
  setSelectedElementId: (id) => set({ selectedElementId: id }),
  setSelectedSubscriberId: (id) => set({ selectedSubscriberId: id }),

  addElement: (type) => {
    const meta = ELEMENT_LIBRARY.find((e) => e.type === type);
    const el = createDefaultElement(type);
    set((state) => ({
      design: { ...state.design, [state.activeSide]: [...state.design[state.activeSide], el] },
      selectedElementId: el.id,
    }));
    void meta;
    get().saveToLocalStorage();
  },

  updateElement: (id, updates) => {
    set((state) => ({
      design: {
        ...state.design,
        [state.activeSide]: state.design[state.activeSide].map((e) =>
          e.id === id ? { ...e, ...updates } : e
        ),
      },
    }));
    get().saveToLocalStorage();
  },

  deleteElement: (id) => {
    set((state) => ({
      design: {
        ...state.design,
        [state.activeSide]: state.design[state.activeSide].filter((e) => e.id !== id),
      },
      selectedElementId: state.selectedElementId === id ? null : state.selectedElementId,
    }));
    get().saveToLocalStorage();
  },

  duplicateElement: (id) => {
    const state = get();
    const el = state.design[state.activeSide].find((e) => e.id === id);
    if (!el) return;
    const copy = { ...el, id: uid(), x: el.x + 0.5, y: el.y + 0.5, name: el.name + " (نسخة)" };
    set({
      design: { ...state.design, [state.activeSide]: [...state.design[state.activeSide], copy] },
      selectedElementId: copy.id,
    });
    get().saveToLocalStorage();
  },

  toggleVisible: (id) => {
    const state = get();
    const el = state.design[state.activeSide].find((e) => e.id === id);
    if (el) get().updateElement(id, { visible: !el.visible });
  },

  toggleLocked: (id) => {
    const state = get();
    const el = state.design[state.activeSide].find((e) => e.id === id);
    if (el) get().updateElement(id, { locked: !el.locked });
  },

  moveZ: (id, dir) => {
    set((state) => {
      const arr = [...state.design[state.activeSide]];
      const idx = arr.findIndex((e) => e.id === id);
      if (idx === -1) return state;
      if (dir === "up" && idx < arr.length - 1) [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      else if (dir === "down" && idx > 0) [arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]];
      arr.forEach((e, i) => (e.zIndex = i + 1));
      return { design: { ...state.design, [state.activeSide]: arr } };
    });
    get().saveToLocalStorage();
  },

  saveToLocalStorage: () => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(get().design));
    } catch { /* ignore */ }
  },
}));

// ─── Element library (shared) ─────────────────────────────────────────
import {
  Type, Square, Image as ImageIcon, QrCode, User, Hash,
  Droplet, Calendar, Wallet, Clock, Tag, Building2,
} from "lucide-react";

export const ELEMENT_LIBRARY: { type: ElementType; label: string; icon: typeof Type }[] = [
  { type: "customText", label: "نص", icon: Type },
  { type: "shape", label: "مستطيل", icon: Square },
  { type: "logo", label: "شعار", icon: Building2 },
  { type: "uploadedImage", label: "صورة", icon: ImageIcon },
  { type: "qr", label: "QR", icon: QrCode },
  { type: "barcode", label: "باركود", icon: Hash },
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

function createDefaultElement(type: ElementType): CardElement {
  const meta = ELEMENT_LIBRARY.find((e) => e.type === type);
  const el: CardElement = {
    id: uid(), type, name: meta?.label || type,
    x: 1, y: 1 + Math.random() * 2, width: 4, height: 1,
    rotation: 0, opacity: 100, zIndex: 99, visible: true,
  };
  if (type === "customText") { el.text = "نص جديد"; el.fontFamily = "Cairo"; el.fontSize = 10; el.fontWeight = "normal"; el.textAlign = "right"; el.color = "#000000"; }
  if (type === "clubName") { el.text = "نادي RCS"; el.fontFamily = "Cairo"; el.fontSize = 13; el.fontWeight = "bold"; el.textAlign = "right"; el.color = "#0f766e"; }
  if (type === "cardTitle") { el.text = "بطاقة الانخراط"; el.fontFamily = "Cairo"; el.fontSize = 12; el.fontWeight = "bold"; el.textAlign = "center"; el.color = "#0f766e"; }
  const editable = type === "customText" || type === "cardTitle" || type === "clubName";
  const isTextDynamic = !editable && type !== "logo" && type !== "qr" && type !== "photo" && type !== "shape" && type !== "uploadedImage" && type !== "barcode";
  if (isTextDynamic) {
    el.fontFamily = "Cairo"; el.fontSize = 10; el.fontWeight = "normal"; el.textAlign = "right"; el.color = "#333333";
    el.showLabel = true; el.labelText = (meta?.label || "") + ": ";
  }
  if (type === "shape") { el.shapeKind = "rectangle"; el.bgColor = "#0f766e"; el.bgOpacity = 100; el.borderColor = "#000000"; el.borderWidth = 0; el.borderStyle = "solid"; el.borderRadius = 4; el.width = 3; el.height = 1; }
  if (type === "logo") { el.width = 2; el.height = 1.5; }
  if (type === "uploadedImage") { el.width = 3; el.height = 2; }
  if (type === "qr" || type === "barcode") { el.width = 2; el.height = 2; }
  if (type === "photo") { el.width = 2.5; el.height = 3; el.bgColor = "#e5e7eb"; el.bgOpacity = 100; el.borderRadius = 8; el.shapeKind = "rectangle"; el.shadow = true; }
  return el;
}

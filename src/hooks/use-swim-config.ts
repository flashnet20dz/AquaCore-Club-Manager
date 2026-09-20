"use client";

import { useState, useEffect, useCallback } from "react";
import { SWIMMING_DAYS, TIME_SLOTS } from "@/lib/rcs";

/**
 * useSwimConfig — Hook موحد لأيام السباحة والتوقيتات
 * ─────────────────────────────────────────────────
 * Single Source of Truth: أيام/توقيتات السباحة تُدار من
 * الإعدادات ← تبويب «المنخرطون» وتُقرأ من قاعدة البيانات هنا.
 * أي تعديل في الإعدادات ينعكس فوراً على نموذج المنخرط،
 * الانتظار، التعويضات… (بعد استدعاء invalidateSwimConfig)
 *
 * Fallback: أثناء التحميل أو عند فشل الشبكة نستخدم القوائم
 * الثابتة من rcs.ts حتى لا تتعطل الواجهة أبداً.
 */

import {
  type SwimmingDayGroup,
  DEFAULT_SWIMMING_GROUPS,
  parseSwimmingGroups,
} from "@/lib/swimming-groups";

export interface SwimDayOption {
  id: string;
  name: string;
  shortName: string;
  color: string;
  active: boolean;
  sortOrder: number;
}

export interface SwimSlotOption {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  active: boolean;
  sortOrder: number;
  // ★ يوم الأسبوع المرتبط بالحصة (sat|sun|mon|tue|wed|thu|fri) — null/undefined = عامة تظهر كل الأيام
  dayOfWeek?: string | null;
}

// ─── Cache على مستوى الوحدة (يُشارك بين كل المكوّنات) ───
let cachedDays: SwimDayOption[] | null = null;
let cachedSlots: SwimSlotOption[] | null = null;
let cachedGroups: SwimmingDayGroup[] | null = null;
let cachedOperatingDays: string[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 30_000; // 30 ثانية
let inflight: Promise<void> | null = null;

// اشتراكات المكونات المثبّة — يُبلّغون عند أي تعديل من الإعدادات
type Listener = () => void;
const listeners = new Set<Listener>();

/** إبطال الكاش + إبلاغ كل المكوّنات المفتوحة — التزامن الفوري مع الإعدادات */
export function invalidateSwimConfig() {
  cachedDays = null;
  cachedSlots = null;
  cachedGroups = null;
  cachedOperatingDays = null;
  cacheTimestamp = 0;
  inflight = null;
  for (const l of listeners) {
    try { l(); } catch { /* تجاهل */ }
  }
}

/**
 * ⚡ بذر فوري للكاش بقيم معلومة (بدون إعادة جلب شبكية) + إبلاغ كل المكوّنات.
 * تُستخدم بعد نجاح PATCH في مركز تشغيل المسبح حتى تنعكس التغييرات
 * لحظياً على كل الشاشات المفتوحة (التسجيل، الحضور، ساعات العمل…) بأسرع وقت.
 */
export function seedSwimConfigCache(patch: {
  days?: SwimDayOption[];
  slots?: SwimSlotOption[];
  groups?: SwimmingDayGroup[];
  operatingDays?: string[];
}) {
  if (patch.days) cachedDays = patch.days;
  if (patch.slots) cachedSlots = patch.slots;
  if (patch.groups) cachedGroups = patch.groups;
  if (patch.operatingDays) cachedOperatingDays = patch.operatingDays;
  cacheTimestamp = Date.now();
  for (const l of listeners) {
    try { l(); } catch { /* تجاهل */ }
  }
}

/** تحويل أيام قاعدة البيانات إلى قائمة أسماء صالحة للاستخدام (الفعّالة فقط) */
export function activeDayNames(days: SwimDayOption[]): string[] {
  const names = days.filter((d) => d.active).map((d) => d.name);
  return names.length ? names : [...SWIMMING_DAYS];
}

/** تحويل التوقيتات إلى تسميات "09:00-10:00" (الفعّالة فقط) */
export function activeSlotLabels(slots: SwimSlotOption[]): string[] {
  const labels = slots
    .filter((s) => s.active)
    .map((s) => (s.name && s.name.includes("-") ? s.name : `${s.startTime}-${s.endTime}`));
  return labels.length ? labels : [...TIME_SLOTS];
}

async function loadConfig(): Promise<void> {
  const [daysRes, slotsRes] = await Promise.all([
    fetch("/api/swimming-days").catch(() => null),
    fetch("/api/swimming-slots").catch(() => null),
  ]);
  if (daysRes?.ok) {
    const d = await daysRes.json().catch(() => null);
    if (d?.days?.length) cachedDays = d.days;
    if (Array.isArray(d?.groups)) cachedGroups = d.groups;
    if (Array.isArray(d?.operatingDays)) cachedOperatingDays = d.operatingDays;
  }
  if (slotsRes?.ok) {
    const s = await slotsRes.json().catch(() => null);
    if (s?.slots?.length) cachedSlots = s.slots;
  }
  cacheTimestamp = Date.now();
}

export function useSwimConfig(options?: { immediate?: boolean }) {
  const immediate = options?.immediate !== false;
  const [days, setDays] = useState<SwimDayOption[]>(cachedDays || []);
  const [slots, setSlots] = useState<SwimSlotOption[]>(cachedSlots || []);
  const [groups, setGroups] = useState<SwimmingDayGroup[]>(cachedGroups || DEFAULT_SWIMMING_GROUPS);
  const [operatingDays, setOperatingDays] = useState<string[]>(cachedOperatingDays || ["0", "1", "2", "3", "4", "5"]);
  const [loading, setLoading] = useState(!cachedDays);

  const refresh = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && cachedDays && cachedSlots && cachedGroups && now - cacheTimestamp < CACHE_DURATION) {
      setDays(cachedDays);
      setSlots(cachedSlots);
      setGroups(cachedGroups);
      if (cachedOperatingDays) setOperatingDays(cachedOperatingDays);
      setLoading(false);
      return;
    }
    if (!inflight) inflight = loadConfig().finally(() => { inflight = null; });
    try {
      setLoading(true);
      await inflight;
      setDays(cachedDays || []);
      setSlots(cachedSlots || []);
      setGroups(cachedGroups || DEFAULT_SWIMMING_GROUPS);
      if (cachedOperatingDays) setOperatingDays(cachedOperatingDays);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (immediate) refresh();
  }, [immediate, refresh]);

  // 🔗 اشتراك فوري: تعديل من الإعدادات ⟵ انعكاس لحظي بلا إعادة تحميل
  // ⚡ إن كان الكاش مبذوراً (seedSwimConfigCache) نطبّقه فوراً بلا أي طلب شبكة،
  //   وإن كان باطلاً (invalidateSwimConfig) نجلب من جديد.
  useEffect(() => {
    const l = () => {
      if (cachedDays && cachedGroups) {
        setDays(cachedDays);
        setSlots(cachedSlots || []);
        setGroups(cachedGroups);
        if (cachedOperatingDays) setOperatingDays(cachedOperatingDays);
        setLoading(false);
      } else {
        refresh(true);
      }
    };
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, [refresh]);

  /** أسماء الأيام الفعّالة */
  const dayNames = days.length ? activeDayNames(days) : [...SWIMMING_DAYS];
  const slotLabels = slots.length ? activeSlotLabels(slots) : [...TIME_SLOTS];

  /** الأفواج النشطة فقط */
  const activeGroups = groups.filter((g) => g.active);
  const groupNames = activeGroups.map((g) => g.name);

  return {
    days,
    slots,
    groups,
    activeGroups,
    groupNames,
    operatingDays,
    dayNames,
    slotLabels,
    loading,
    refresh,
    invalidate: invalidateSwimConfig,
  };
}

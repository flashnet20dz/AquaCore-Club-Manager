"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * useSubscriptionTypes — Hook موحد لجلب أنواع الاشتراك
 * ─────────────────────────────────────────────────
 * Single Source of Truth: كل الصفحات تستخدم هذا الـ hook
 * أي تحديث في الإعدادات ينعكس فوراً على كل الصفحات
 */

export interface SubscriptionTypeData {
  id: string;
  name: string;
  code: string;
  color: string;
  description?: string;
  subscriptionFee: number;
  insuranceFee: number;
  compoundRights: number;
  durationDays: number;
  givesMembershipNumber: boolean;
  requiresInsurance: boolean;
  requiresCompoundFee: boolean;
  renewableMonthly: boolean;
  freeSubscription: boolean;
  numberingGroup: string;
  active: boolean;
  sortOrder: number;
}

// Cache محلي بسيط لتجنب الطلبات المتكررة
let cachedTypes: SubscriptionTypeData[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 30000; // 30 ثانية

export function useSubscriptionTypes() {
  const [types, setTypes] = useState<SubscriptionTypeData[]>(cachedTypes || []);
  const [loading, setLoading] = useState(!cachedTypes);
  const [error, setError] = useState<string | null>(null);

  const fetchTypes = useCallback(async (force = false) => {
    // استخدام cache إذا كان أقل من 30 ثانية
    const now = Date.now();
    if (!force && cachedTypes && (now - cacheTimestamp) < CACHE_DURATION) {
      setTypes(cachedTypes);
      setLoading(false);
      return cachedTypes;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/subscription-types");
      if (!res.ok) throw new Error("فشل جلب أنواع الاشتراك");
      const data = await res.json();
      const newTypes = data.types || [];
      cachedTypes = newTypes;
      cacheTimestamp = now;
      setTypes(newTypes);
      setError(null);
      return newTypes;
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ غير معروف");
      // Fallback: قائمة افتراضية
      const fallback = [
        { code: "/", name: "عادي" },
        { code: "OPOW", name: "OPOW" },
        { code: "DJS", name: "DJS" },
        { code: "FCS", name: "FCS" },
        { code: "RCS", name: "RCS" },
        { code: "POLICE", name: "POLICE" },
        { code: "MJ", name: "MJ" },
      ].map((t) => ({
        id: t.code,
        name: t.name,
        code: t.code,
        color: "#0d9488",
        subscriptionFee: 0,
        insuranceFee: 500,
        compoundRights: 1000,
        durationDays: 30,
        givesMembershipNumber: true,
        requiresInsurance: true,
        requiresCompoundFee: true,
        renewableMonthly: true,
        freeSubscription: false,
        active: true,
        sortOrder: 0,
      })) as SubscriptionTypeData[];
      setTypes(fallback);
      return fallback;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  // إعادة جلب بعد أي تحديث (invalidate cache)
  const refresh = useCallback(() => {
    cachedTypes = null;
    cacheTimestamp = 0;
    return fetchTypes(true);
  }, [fetchTypes]);

  // الأنواع النشطة فقط
  const activeTypes = types.filter((t) => t.active);

  // خيارات للـ Select / Dropdown
  const selectOptions = activeTypes.map((t) => ({
    value: t.code,
    label: t.name === t.code ? t.name : `${t.name} (${t.code})`,
    color: t.color,
  }));

  // خيارات للفلاتر (مع "الكل")
  const filterOptions = [
    { value: "", label: "الكل" },
    ...activeTypes.map((t) => ({
      value: t.code,
      label: t.name === t.code ? t.name : `${t.name} (${t.code})`,
      color: t.color,
    })),
  ];

  // خيارات للأزرار (FilterChips)
  const chipOptions = activeTypes.map((t) => ({
    id: t.code,
    label: t.name,
    color: t.color,
  }));

  // الحصول على نوع بالكود
  const getTypeByCode = useCallback((code: string) => {
    return types.find((t) => t.code === code);
  }, [types]);

  return {
    types,
    activeTypes,
    selectOptions,
    filterOptions,
    chipOptions,
    getTypeByCode,
    loading,
    error,
    refresh,
  };
}

/**
 * مسح الـ cache — يُستدعى بعد أي POST/PATCH/DELETE
 */
export function invalidateSubscriptionTypesCache() {
  cachedTypes = null;
  cacheTimestamp = 0;
}

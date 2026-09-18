"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  DEFAULT_PAGE_ITEMS,
  PAGE_TO_EXPORT_TYPES,
  type PageNavigationItem,
} from "@/lib/page-navigation-config";

const STORAGE_KEY = "aquacore_page_nav_preferences_v1";
const EVENT_NAME = "aquacore:page-nav-updated";
const DB_SETTING_KEY = "pageNavPreferences";

export interface PagePreference {
  id: string;
  order: number;
  visible: boolean;
  customLabel?: string;
  customShortLabel?: string;
  customExportTitle?: string;
}

export function usePageNavigation() {
  const [preferences, setPreferences] = useState<Record<string, PagePreference>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const isSyncingRef = useRef(false);

  // 1. تحميل التفضيلات من التخزين المحلي أولاً لسرعة العرض (0ms)
  const loadPreferencesFromStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, PagePreference>;
        setPreferences(parsed);
      }
    } catch {
      // تجاهل
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // 2. المزامنة مع قاعدة البيانات (Setting) لجلب التفضيلات المحفوظة مركزياً
  const syncWithDatabase = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) return;
      const data = await res.json();
      const rawDbPref = data.settings?.[DB_SETTING_KEY];
      if (rawDbPref) {
        const parsedDb = JSON.parse(rawDbPref) as Record<string, PagePreference>;
        if (parsedDb && typeof parsedDb === "object") {
          // دمج ذكي: التفضيلات من قاعدة البيانات تُحدّث التخزين المحلي
          setPreferences((prev) => {
            const merged = { ...prev, ...parsedDb };
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      }
    } catch {
      // الصمت في حالة عدم الاتصال بالإنترنت
    } finally {
      isSyncingRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadPreferencesFromStorage();
    syncWithDatabase();

    const handleUpdate = () => {
      loadPreferencesFromStorage();
    };

    window.addEventListener(EVENT_NAME, handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [loadPreferencesFromStorage, syncWithDatabase]);

  // 3. حفظ التفضيلات محلياً وفي قاعدة البيانات وبث حدث التحديث
  const savePreferences = useCallback((newPrefs: Record<string, PagePreference>) => {
    setPreferences(newPrefs);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs));
      window.dispatchEvent(new CustomEvent(EVENT_NAME));
    } catch {
      // تجاهل
    }

    // إرسال الحفظ لقاعدة البيانات في الخلفية
    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: {
          [DB_SETTING_KEY]: JSON.stringify(newPrefs),
        },
      }),
    }).catch(() => {
      // في حالة العمل أوفلاين، يبقى التخزين المحلي هو الأساس
    });
  }, []);

  // 4. دمج التفضيلات مع العناصر الافتراضية
  const orderedItems = useMemo<PageNavigationItem[]>(() => {
    return [...DEFAULT_PAGE_ITEMS].map((item) => {
      const pref = preferences[item.id];
      const customLabel = pref?.customLabel?.trim() || undefined;
      const customShortLabel = pref?.customShortLabel?.trim() || undefined;
      const customExportTitle = pref?.customExportTitle?.trim() || undefined;

      return {
        ...item,
        defaultOrder: pref?.order ?? item.defaultOrder,
        defaultVisible: pref ? pref.visible : item.defaultVisible,
        label: customLabel || item.label,
        shortLabel: customShortLabel || item.shortLabel || item.label,
        customLabel,
        customShortLabel,
        customExportTitle,
      };
    }).sort((a, b) => a.defaultOrder - b.defaultOrder);
  }, [preferences]);

  // 5. تبديل إظهار / إخفاء صفحة
  const toggleVisibility = useCallback((id: string, visible: boolean) => {
    const item = DEFAULT_PAGE_ITEMS.find((it) => it.id === id);
    if (item && !item.canHide && !visible) {
      return; // لا يمكن إخفاء الصفحات الأساسية
    }

    const currentPrefs = { ...preferences };
    orderedItems.forEach((it, idx) => {
      if (!currentPrefs[it.id]) {
        currentPrefs[it.id] = {
          id: it.id,
          order: idx + 1,
          visible: it.defaultVisible,
          customLabel: it.customLabel,
          customShortLabel: it.customShortLabel,
          customExportTitle: it.customExportTitle,
        };
      }
    });

    currentPrefs[id] = {
      ...currentPrefs[id],
      visible,
    };

    savePreferences(currentPrefs);
  }, [preferences, orderedItems, savePreferences]);

  // 6. تحريك صفحة للأعلى أو للأسفل
  const moveItem = useCallback((id: string, direction: "up" | "down") => {
    const currentIndex = orderedItems.findIndex((it) => it.id === id);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= orderedItems.length) return;

    const newItems = [...orderedItems];
    const [moved] = newItems.splice(currentIndex, 1);
    newItems.splice(targetIndex, 0, moved);

    const newPrefs: Record<string, PagePreference> = {};
    newItems.forEach((it, idx) => {
      const existing = preferences[it.id];
      newPrefs[it.id] = {
        id: it.id,
        order: idx + 1,
        visible: it.defaultVisible,
        customLabel: existing?.customLabel,
        customShortLabel: existing?.customShortLabel,
        customExportTitle: existing?.customExportTitle,
      };
    });

    savePreferences(newPrefs);
  }, [orderedItems, preferences, savePreferences]);

  // 7. إعادة الترتيب المباشر لمصفوفة IDs
  const reorderItems = useCallback((newIds: string[]) => {
    const newPrefs: Record<string, PagePreference> = {};
    newIds.forEach((id, idx) => {
      const existing = preferences[id];
      const orig = orderedItems.find((it) => it.id === id);
      newPrefs[id] = {
        id,
        order: idx + 1,
        visible: orig ? orig.defaultVisible : true,
        customLabel: existing?.customLabel,
        customShortLabel: existing?.customShortLabel,
        customExportTitle: existing?.customExportTitle,
      };
    });
    savePreferences(newPrefs);
  }, [orderedItems, preferences, savePreferences]);

  // 8. تعديل اسم الصفحة والمسميات المخصصة
  const updatePageTitle = useCallback((
    id: string,
    customLabel: string,
    customShortLabel?: string,
    customExportTitle?: string
  ) => {
    const currentPrefs = { ...preferences };
    const existing = currentPrefs[id];
    const orig = DEFAULT_PAGE_ITEMS.find((it) => it.id === id);

    currentPrefs[id] = {
      id,
      order: existing?.order ?? (orig ? orig.defaultOrder : 99),
      visible: existing?.visible ?? (orig ? orig.defaultVisible : true),
      customLabel: customLabel.trim() || undefined,
      customShortLabel: customShortLabel?.trim() || undefined,
      customExportTitle: customExportTitle?.trim() || undefined,
    };

    savePreferences(currentPrefs);
  }, [preferences, savePreferences]);

  // 9. استعادة الاسم الأصلي لصفحة معينة
  const resetPageTitle = useCallback((id: string) => {
    if (!preferences[id]) return;
    const currentPrefs = { ...preferences };
    currentPrefs[id] = {
      ...currentPrefs[id],
      customLabel: undefined,
      customShortLabel: undefined,
      customExportTitle: undefined,
    };
    savePreferences(currentPrefs);
  }, [preferences, savePreferences]);

  // 10. استعادة كافة الأسماء الافتراضية
  const resetAllTitles = useCallback(() => {
    const currentPrefs = { ...preferences };
    Object.keys(currentPrefs).forEach((k) => {
      currentPrefs[k] = {
        ...currentPrefs[k],
        customLabel: undefined,
        customShortLabel: undefined,
        customExportTitle: undefined,
      };
    });
    savePreferences(currentPrefs);
  }, [preferences, savePreferences]);

  // 11. استعادة الترتيب والظهور والأسماء للافتراضي الشامل
  const resetToDefault = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setPreferences({});
      window.dispatchEvent(new CustomEvent(EVENT_NAME));
    } catch {
      // تجاهل
    }

    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: {
          [DB_SETTING_KEY]: "",
        },
      }),
    }).catch(() => {});
  }, []);

  // 12. مساعدات استخراج العناوين الفعالة للصفحات والتقارير
  const getEffectivePageLabel = useCallback((pageId: string): string => {
    const found = orderedItems.find((it) => it.id === pageId);
    if (!found) return pageId;
    return found.customLabel || found.label;
  }, [orderedItems]);

  const getEffectiveExportTitle = useCallback((datasetType: string, defaultTitle: string): string => {
    // 1. فحص إذا كان نوع التصدير مرتبطاً بصفحة مخصصة
    for (const [pageId, types] of Object.entries(PAGE_TO_EXPORT_TYPES)) {
      if (types.includes(datasetType)) {
        const item = orderedItems.find((it) => it.id === pageId);
        if (item) {
          if (item.customExportTitle) {
            // إذا خصص المستخدم عنوان تصدير خاص بالصفحة
            return item.customExportTitle;
          }
          if (item.customLabel) {
            // استبدال الاسم القديم بالاسم المخصص الجديد في عنوان التصدير
            const origLabel = DEFAULT_PAGE_ITEMS.find((it) => it.id === pageId)?.label;
            if (origLabel && defaultTitle.includes(origLabel)) {
              return defaultTitle.replace(origLabel, item.customLabel);
            }
            if (defaultTitle.includes("المنخرطين") && item.customLabel) {
              return defaultTitle.replace("المنخرطين", item.customLabel);
            }
            return `${defaultTitle} (${item.customLabel})`;
          }
        }
      }
    }
    return defaultTitle;
  }, [orderedItems]);

  return {
    items: orderedItems,
    isLoaded,
    toggleVisibility,
    moveItem,
    reorderItems,
    updatePageTitle,
    resetPageTitle,
    resetAllTitles,
    resetToDefault,
    getEffectivePageLabel,
    getEffectiveExportTitle,
  };
}

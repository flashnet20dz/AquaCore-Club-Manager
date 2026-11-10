"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";

export interface PoolData {
  id: string;
  clubId: string;
  name: string;
  code: string;
  fileNumberPrefix?: string | null;
  capacity?: number | null;
  lengthMeters?: number | null;
  lanesCount?: number | null;
  address?: string | null;
  phone?: string | null;
  color?: string | null;
  active: boolean;
  status: string;
  isDefault: boolean;
  activeSubscribersCount?: number;
  todayAttendancesCount?: number;
}

interface PoolContextValue {
  pools: PoolData[];
  loading: boolean;
  error: string | null;
  currentPoolId: string; // "all" or specific pool id
  currentPool: PoolData | null;
  defaultPool: PoolData | null;
  isMultiPool: boolean;
  setCurrentPoolId: (id: string) => void;
  refreshPools: () => Promise<void>;
}

const STORAGE_KEY = "aquacore_selected_pool_id";

const PoolContext = createContext<PoolContextValue>({
  pools: [],
  loading: true,
  error: null,
  currentPoolId: "all",
  currentPool: null,
  defaultPool: null,
  isMultiPool: false,
  setCurrentPoolId: () => {},
  refreshPools: async () => {},
});

export function PoolProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/pin" ||
    pathname === "/register-club" ||
    pathname?.startsWith("/member/");

  const [pools, setPools] = useState<PoolData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPoolId, setCurrentPoolIdState] = useState<string>("all");

  const refreshPools = useCallback(async () => {
    if (isPublicRoute) {
      setPools([]);
      setError(null);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/pools", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        setPools([]);
        setError(null);
        return;
      }
      if (!res.ok) throw new Error("تعذر جلب بيانات المسابح");
      const data = await res.json();
      const list: PoolData[] = data.pools || [];
      setPools(list);
      setError(null);

      // التحقق من صلاحية المسبح المختار حالياً
      const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (saved && saved !== "all") {
        const found = list.find((p) => p.id === saved && p.active);
        if (found) {
          setCurrentPoolIdState(saved);
        } else if (list.length > 0) {
          setCurrentPoolIdState("all");
        }
      }
    } catch (e) {
      console.error("PoolProvider refresh error:", e);
      setError(e instanceof Error ? e.message : "خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }, [isPublicRoute]);

  useEffect(() => {
    refreshPools();
  }, [refreshPools]);

  const setCurrentPoolId = useCallback((id: string) => {
    setCurrentPoolIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  const defaultPool = useMemo(() => {
    return pools.find((p) => p.isDefault) || pools[0] || null;
  }, [pools]);

  const currentPool = useMemo(() => {
    if (currentPoolId === "all") return null;
    return pools.find((p) => p.id === currentPoolId) || null;
  }, [pools, currentPoolId]);

  const isMultiPool = useMemo(() => {
    const activePools = pools.filter((p) => p.active);
    return activePools.length > 1;
  }, [pools]);

  return (
    <PoolContext.Provider
      value={{
        pools,
        loading,
        error,
        currentPoolId,
        currentPool,
        defaultPool,
        isMultiPool,
        setCurrentPoolId,
        refreshPools,
      }}
    >
      {children}
    </PoolContext.Provider>
  );
}

export function usePools() {
  return useContext(PoolContext);
}

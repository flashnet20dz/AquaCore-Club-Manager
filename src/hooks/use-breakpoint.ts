"use client";

import { useState, useEffect } from "react";

export type Breakpoint = "mobile" | "tablet" | "desktop";

/**
 * useBreakpoint — returns the current responsive mode.
 *   - mobile:  width < 768px
 *   - tablet:  768px <= width < 1024px
 *   - desktop: width >= 1024px
 *
 * Falls back to "desktop" on SSR (no window) to avoid hydration mismatches;
 * corrects on mount.
 */
export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>("desktop");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const calc = () => {
      const w = window.innerWidth;
      if (w < 768) setBp("mobile");
      else if (w < 1024) setBp("tablet");
      else setBp("desktop");
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  return bp;
}

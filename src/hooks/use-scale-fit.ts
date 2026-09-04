"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * useScaleFit — calculates the scale factor needed to fit a fixed-dimension
 * element (e.g., an A4-ratio letterhead) inside a responsive container,
 * without distorting it.
 *
 * Uses ResizeObserver to recalculate whenever the container resizes.
 *
 * @param targetWidth  The natural width of the design (e.g., 1100)
 * @param targetHeight The natural height of the design (e.g., 220)
 * @returns { containerRef, scale, scaledWidth, scaledHeight }
 *          - containerRef: attach to the wrapper div
 *          - scale: the multiplier to apply via transform: scale()
 *          - scaledWidth/scaledHeight: the final pixel dimensions after scaling
 */
export function useScaleFit(targetWidth: number, targetHeight: number) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Fallback if ResizeObserver isn't available
    if (typeof ResizeObserver === "undefined") {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setScale(Math.min(w / targetWidth, h / targetHeight));
      return;
    }
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        const w = cr.width;
        const h = cr.height;
        if (w > 0 && h > 0) {
          const s = Math.min(w / targetWidth, h / targetHeight);
          setScale(s > 0 ? s : 0.1);
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [targetWidth, targetHeight]);

  const scaledWidth = targetWidth * scale;
  const scaledHeight = targetHeight * scale;

  return { containerRef, scale, scaledWidth, scaledHeight };
}

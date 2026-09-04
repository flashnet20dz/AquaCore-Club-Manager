"use client";

import { ReactNode, CSSProperties } from "react";

/**
 * ResponsiveGrid — a CSS Grid that automatically fits as many columns
 * as possible, each at least `minCardWidth` pixels wide.
 *
 * Uses `grid-template-columns: repeat(auto-fit, minmax(minCardWidth, 1fr))`
 * which is the modern, flexible alternative to fixed breakpoints like
 * `grid-cols-2 lg:grid-cols-4`. The browser handles the column count
 * automatically based on the available width — no JS, no breakpoints.
 *
 * Example:
 *   <ResponsiveGrid minCardWidth={260}>
 *     {subscribers.map(s => <Card key={s.id} />)}
 *   </ResponsiveGrid>
 *
 * On a 1200px screen → 4 columns (260×4 + gaps)
 * On a 768px tablet  → 2-3 columns
 * On a 375px phone   → 1 column
 */
interface ResponsiveGridProps {
  children: ReactNode;
  /** Minimum width of each card in pixels. Default: 260. */
  minCardWidth?: number;
  /** Gap between cards in pixels. Default: 16. */
  gap?: number;
  /** Additional className for the grid container. */
  className?: string;
  /** Additional inline styles. */
  style?: CSSProperties;
}

export function ResponsiveGrid({
  children,
  minCardWidth = 260,
  gap = 16,
  className,
  style,
}: ResponsiveGridProps) {
  return (
    <div
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(${minCardWidth}px, 1fr))`,
        gap: `${gap}px`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

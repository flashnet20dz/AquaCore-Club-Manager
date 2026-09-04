/**
 * AquaCore Theme System — Design Tokens + Presets
 * ─────────────────────────────────────────────────────────────────
 * Built on CSS Variables (oklch/HSL) compatible with shadcn/ui.
 *
 * Architecture:
 *   - Semantic tokens (primary/secondary/accent/success/warning/danger/info)
 *   - Component tokens (derived automatically: card-bg, input-border, etc.)
 *   - Each token has Light + Dark variants
 *   - Shade generation: derived from primary hue via fixed oklch offsets
 *
 * All colors use oklch() for perceptual uniformity (matches existing globals.css).
 */

export type BorderRadius = "sharp" | "medium" | "full";
export type Density = "comfortable" | "normal" | "compact";
export type FontFamily = "cairo" | "tajawal" | "system";
export type Mode = "light" | "dark" | "system";

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
}

export interface ThemeTokens extends ThemeColors {
  // Derived from primary automatically via oklch offsets
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  ring: string;
  destructive: string;
  success: string;
  warning: string;
  info: string;
  // Dark variants
  backgroundDark: string;
  foregroundDark: string;
  cardDark: string;
  cardForegroundDark: string;
  popoverDark: string;
  popoverForegroundDark: string;
  primaryDark: string;
  secondaryDark: string;
  accentDark: string;
  mutedDark: string;
  mutedForegroundDark: string;
  borderDark: string;
  inputDark: string;
  ringDark: string;
  destructiveDark: string;
  successDark: string;
  warningDark: string;
  infoDark: string;
  sidebarDark: string;
  sidebarForegroundDark: string;
  sidebarPrimaryDark: string;
  sidebarAccentDark: string;
  sidebarBorderDark: string;
}

// ════════════ Theme Presets (8 professional palettes) ════════════
export interface ThemePreset {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  // Primary palette as oklch values: [L, C, H]
  primary: [number, number, number];
  secondary: [number, number, number];
  accent: [number, number, number];
  // Preview swatches (hex for display in settings)
  swatches: { primary: string; secondary: string; accent: string };
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "ocean",
    name: "أزرق المحيط",
    nameEn: "Ocean Blue",
    description: "القالب الافتراضي — أزرق عميق واحترافي",
    primary: [0.42, 0.13, 230],
    secondary: [0.7, 0.12, 210],
    accent: [0.65, 0.15, 160],
    swatches: { primary: "#0F4C81", secondary: "#00B4D8", accent: "#10B981" },
  },
  {
    id: "royal",
    name: "الأزرق الملكي",
    nameEn: "Royal Blue",
    description: "أزرق ملكي فاخر مع بنفسجي",
    primary: [0.45, 0.18, 265],
    secondary: [0.6, 0.16, 250],
    accent: [0.62, 0.2, 290],
    swatches: { primary: "#3730A3", secondary: "#4F46E5", accent: "#7C3AED" },
  },
  {
    id: "emerald",
    name: "الزمردي",
    nameEn: "Emerald",
    description: "أخضر زمردي منعش",
    primary: [0.5, 0.14, 160],
    secondary: [0.65, 0.15, 165],
    accent: [0.7, 0.18, 145],
    swatches: { primary: "#047857", secondary: "#10B981", accent: "#34D399" },
  },
  {
    id: "azure",
    name: "الأزرق السماوي",
    nameEn: "Azure Sky",
    description: "أزرق سماوي فاتح ومريح",
    primary: [0.55, 0.16, 230],
    secondary: [0.68, 0.14, 220],
    accent: [0.65, 0.15, 190],
    swatches: { primary: "#0284C7", secondary: "#0EA5E9", accent: "#06B6D4" },
  },
  {
    id: "midnight",
    name: "منتصف الليل",
    nameEn: "Midnight",
    description: "بنفسجي داكن أنيق",
    primary: [0.5, 0.18, 280],
    secondary: [0.62, 0.16, 260],
    accent: [0.65, 0.2, 320],
    swatches: { primary: "#6366F1", secondary: "#818CF8", accent: "#C026D3" },
  },
  {
    id: "coral",
    name: "المرجاني",
    nameEn: "Coral Sunset",
    description: "برتقالي مرجاني دافئ",
    primary: [0.6, 0.18, 30],
    secondary: [0.68, 0.16, 15],
    accent: [0.65, 0.18, 350],
    swatches: { primary: "#EA580C", secondary: "#F43F5E", accent: "#EC4899" },
  },
  {
    id: "amber",
    name: "الكهرماني",
    nameEn: "Amber Gold",
    description: "ذهبي كهرماني فاخر",
    primary: [0.62, 0.16, 65],
    secondary: [0.7, 0.15, 50],
    accent: [0.55, 0.14, 30],
    swatches: { primary: "#CA8A04", secondary: "#EAB308", accent: "#D97706" },
  },
  {
    id: "forest",
    name: "الغابة",
    nameEn: "Forest",
    description: "أخضر غابة طبيعي",
    primary: [0.42, 0.12, 145],
    secondary: [0.55, 0.1, 130],
    accent: [0.6, 0.15, 80],
    swatches: { primary: "#166534", secondary: "#16A34A", accent: "#A3A3A3" },
  },
];

// ════════════ Token generation from primary color ════════════

/** Format oklch tuple as CSS string */
function oklch(l: number, c: number, h: number): string {
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(0)})`;
}

/**
 * Generate full token set from a primary color (oklch L,C,H).
 * Derives all other tokens via perceptual offsets — no manual dark/light needed.
 */
export function generateTokens(
  primary: [number, number, number],
  secondary: [number, number, number],
  accent: [number, number, number]
): ThemeTokens {
  const [pL, pC, pH] = primary;
  const [sL, sC, sH] = secondary;
  const [aL, aC, aH] = accent;

  return {
    primary: oklch(pL, pC, pH),
    secondary: oklch(sL, sC, sH),
    accent: oklch(aL, aC, aH),
    // Light theme
    background: oklch(0.98, 0.005, pH),
    foreground: oklch(0.15, 0.02, pH),
    card: oklch(1, 0, 0),
    cardForeground: oklch(0.15, 0.02, pH),
    popover: oklch(1, 0, 0),
    popoverForeground: oklch(0.15, 0.02, pH),
    muted: oklch(0.95, 0.01, pH),
    mutedForeground: oklch(0.55, 0.02, pH),
    border: oklch(0.9, 0.01, pH),
    input: oklch(0.94, 0.01, pH),
    ring: oklch(pL, pC, pH),
    destructive: oklch(0.6, 0.22, 25),
    success: oklch(0.62, 0.18, 145),
    warning: oklch(0.72, 0.16, 75),
    info: oklch(0.58, 0.16, 255),
    // Dark theme
    backgroundDark: oklch(0.13, 0.015, pH),
    foregroundDark: oklch(0.97, 0.005, pH),
    cardDark: oklch(0.17, 0.02, pH),
    cardForegroundDark: oklch(0.97, 0.005, pH),
    popoverDark: oklch(0.17, 0.02, pH),
    popoverForegroundDark: oklch(0.97, 0.005, pH),
    primaryDark: oklch(Math.min(pL + 0.18, 0.75), pC, pH),
    secondaryDark: oklch(sL, sC, sH),
    accentDark: oklch(aL, aC, aH),
    mutedDark: oklch(0.22, 0.02, pH),
    mutedForegroundDark: oklch(0.72, 0.015, pH),
    borderDark: oklch(0.28, 0.02, pH),
    inputDark: oklch(0.22, 0.02, pH),
    ringDark: oklch(Math.min(pL + 0.18, 0.75), pC, pH),
    destructiveDark: oklch(0.65, 0.22, 25),
    successDark: oklch(0.62, 0.18, 145),
    warningDark: oklch(0.72, 0.16, 75),
    infoDark: oklch(0.58, 0.16, 255),
    sidebarDark: oklch(0.15, 0.015, pH),
    sidebarForegroundDark: oklch(0.97, 0.005, pH),
    sidebarPrimaryDark: oklch(Math.min(pL + 0.18, 0.75), pC, pH),
    sidebarAccentDark: oklch(0.24, 0.03, pH),
    sidebarBorderDark: oklch(0.28, 0.02, pH),
  };
}

/** Get preset by id (falls back to ocean) */
export function getPreset(id: string | null | undefined): ThemePreset {
  return THEME_PRESETS.find((p) => p.id === id) || THEME_PRESETS[0];
}

// ════════════ CSS Variables application ════════════

export interface ClubThemeConfig {
  themePreset?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  logoUrl?: string | null;
  borderRadius?: string | null;
  density?: string | null;
  fontFamily?: string | null;
}

/**
 * Apply a theme config to the document root via CSS variables.
 * Called client-side on mount + whenever theme changes.
 */
export function applyThemeConfig(config: ClubThemeConfig): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  // 1. Pick preset or custom colors
  let primary: [number, number, number];
  let secondary: [number, number, number];
  let accent: [number, number, number];

  const preset = getPreset(config.themePreset);
  primary = preset.primary;
  secondary = preset.secondary;
  accent = preset.accent;

  // Override with custom colors if provided (parsed from oklch string)
  if (config.primaryColor) {
    const parsed = parseOklch(config.primaryColor);
    if (parsed) primary = parsed;
  }
  if (config.secondaryColor) {
    const parsed = parseOklch(config.secondaryColor);
    if (parsed) secondary = parsed;
  }
  if (config.accentColor) {
    const parsed = parseOklch(config.accentColor);
    if (parsed) accent = parsed;
  }

  // 2. Generate tokens
  const tokens = generateTokens(primary, secondary, accent);

  // 3. Apply light theme CSS variables
  const style = root.style;
  style.setProperty("--primary", tokens.primary);
  style.setProperty("--primary-foreground", "oklch(0.99 0 0)");
  style.setProperty("--secondary", tokens.secondary);
  style.setProperty("--secondary-foreground", "oklch(0.99 0 0)");
  style.setProperty("--accent", tokens.accent);
  style.setProperty("--accent-foreground", "oklch(0.99 0 0)");
  style.setProperty("--background", tokens.background);
  style.setProperty("--foreground", tokens.foreground);
  style.setProperty("--card", tokens.card);
  style.setProperty("--card-foreground", tokens.cardForeground);
  style.setProperty("--popover", tokens.popover);
  style.setProperty("--popover-foreground", tokens.popoverForeground);
  style.setProperty("--muted", tokens.muted);
  style.setProperty("--muted-foreground", tokens.mutedForeground);
  style.setProperty("--border", tokens.border);
  style.setProperty("--input", tokens.input);
  style.setProperty("--ring", tokens.ring);
  style.setProperty("--destructive", tokens.destructive);
  style.setProperty("--success", tokens.success);
  style.setProperty("--warning", tokens.warning);
  style.setProperty("--info", tokens.info);

  // 4. Apply dark theme CSS variables (in .dark scope)
  // We set them as data-attributes on root and use a style tag
  style.setProperty("--primary-dark", tokens.primaryDark);
  style.setProperty("--secondary-dark", tokens.secondaryDark);
  style.setProperty("--accent-dark", tokens.accentDark);
  style.setProperty("--background-dark", tokens.backgroundDark);
  style.setProperty("--foreground-dark", tokens.foregroundDark);

  // Dark theme overrides — applied via a dynamically injected style tag
  ensureDarkStyleTag();
  const darkCss = `
    .dark {
      --primary: ${tokens.primaryDark} !important;
      --secondary: ${tokens.secondaryDark} !important;
      --accent: ${tokens.accentDark} !important;
      --background: ${tokens.backgroundDark} !important;
      --foreground: ${tokens.foregroundDark} !important;
      --card: ${tokens.cardDark} !important;
      --card-foreground: ${tokens.cardForegroundDark} !important;
      --popover: ${tokens.popoverDark} !important;
      --popover-foreground: ${tokens.popoverForegroundDark} !important;
      --muted: ${tokens.mutedDark} !important;
      --muted-foreground: ${tokens.mutedForegroundDark} !important;
      --border: ${tokens.borderDark} !important;
      --input: ${tokens.inputDark} !important;
      --ring: ${tokens.ringDark} !important;
      --destructive: ${tokens.destructiveDark} !important;
      --success: ${tokens.successDark} !important;
      --warning: ${tokens.warningDark} !important;
      --info: ${tokens.infoDark} !important;
      --sidebar: ${tokens.sidebarDark} !important;
      --sidebar-foreground: ${tokens.sidebarForegroundDark} !important;
      --sidebar-primary: ${tokens.sidebarPrimaryDark} !important;
      --sidebar-primary-foreground: oklch(0.99 0 0) !important;
      --sidebar-accent: ${tokens.sidebarAccentDark} !important;
      --sidebar-accent-foreground: ${tokens.sidebarForegroundDark} !important;
      --sidebar-border: ${tokens.sidebarBorderDark} !important;
      --sidebar-ring: ${tokens.sidebarPrimaryDark} !important;
    }
  `;
  const tag = document.getElementById("aquacore-dark-theme");
  if (tag) tag.textContent = darkCss;

  // 5. Border radius
  const radiusMap: Record<BorderRadius, string> = {
    sharp: "0.25rem",
    medium: "0.875rem",
    full: "1.5rem",
  };
  const radius = radiusMap[(config.borderRadius as BorderRadius)] || "0.875rem";
  style.setProperty("--radius", radius);

  // 6. Density (spacing scale factor)
  const densityMap: Record<Density, string> = {
    comfortable: "1.15",
    normal: "1",
    compact: "0.85",
  };
  const scale = densityMap[(config.density as Density)] || "1";
  style.setProperty("--spacing-scale", scale);
  style.setProperty("--density-padding", `calc(1rem * ${scale})`);

  // 7. Font family
  const fontMap: Record<FontFamily, string> = {
    cairo: "var(--font-cairo)",
    tajawal: "var(--font-tajawal)",
    system: "system-ui, sans-serif",
  };
  const font = fontMap[(config.fontFamily as FontFamily)] || "var(--font-cairo)";
  style.setProperty("--font-active", font);

  // 8. Logo URL (data attribute for components to read)
  if (config.logoUrl) {
    root.setAttribute("data-club-logo", config.logoUrl);
  } else {
    root.removeAttribute("data-club-logo");
  }
}

/** Inject a style tag for dark theme overrides (once) */
function ensureDarkStyleTag(): void {
  if (document.getElementById("aquacore-dark-theme")) return;
  const tag = document.createElement("style");
  tag.id = "aquacore-dark-theme";
  document.head.appendChild(tag);
}

/** Parse "oklch(L C H)" string → [L, C, H] tuple */
export function parseOklch(str: string): [number, number, number] | null {
  const m = str.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/);
  if (!m) return null;
  return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])];
}

/** Convert oklch tuple → "oklch(L C H)" string */
export function oklchString(l: number, c: number, h: number): string {
  return oklch(l, c, h);
}

// ════════════ Contrast checking (WCAG AA) ════════════

/**
 * Approximate relative luminance from oklch L component.
 * oklch L is perceptual lightness (0-1), close to relative luminance.
 */
function luminance(l: number): number {
  return l;
}

/**
 * Contrast ratio between two oklch L values (0-1).
 * Returns ratio 1-21 (1=same, 21=max contrast).
 */
export function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a primary color passes WCAG AA with white text.
 * Returns { passes, ratio, suggestion }.
 */
export function checkContrast(primaryL: number): {
  passes: boolean;
  ratio: number;
  suggestion?: string;
} {
  const whiteL = 0.99;
  const blackL = 0.15;
  const withWhite = contrastRatio(primaryL, whiteL);
  const withBlack = contrastRatio(primaryL, blackL);

  // AA requires 4.5:1 for normal text, 3:1 for large text
  if (withWhite >= 4.5) {
    return { passes: true, ratio: withWhite };
  }
  if (withBlack >= 4.5) {
    return { passes: true, ratio: withBlack, suggestion: "استخدم نصاً داكناً مع هذا اللون" };
  }
  // Suggest a darker/lighter variant
  const suggestion = primaryL > 0.5
    ? "أفتح اللون قليلاً أو استخدم نصاً داكناً"
    : "أغمق اللون قليلاً لتحسين التباين";
  return { passes: false, ratio: Math.max(withWhite, withBlack), suggestion };
}

// ════════════ Default config (Ocean Blue) ════════════
export const DEFAULT_THEME_CONFIG: ClubThemeConfig = {
  themePreset: "ocean",
  borderRadius: "medium",
  density: "normal",
  fontFamily: "cairo",
};

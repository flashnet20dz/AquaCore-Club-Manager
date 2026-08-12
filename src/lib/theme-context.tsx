"use client";

/**
 * AquaCore Theme Provider
 * ─────────────────────────────────────────────────────────────────
 * - Applies club theme config (colors, logo, radius, density, font) on mount
 * - Applies personal dark/light/system mode (localStorage)
 * - Listens to prefers-color-scheme for "system" mode
 * - No flash: inline script in layout.tsx handles initial dark class
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import {
  applyThemeConfig,
  DEFAULT_THEME_CONFIG,
  type ClubThemeConfig,
  type Mode,
} from "@/lib/theme-presets";

interface ThemeContextValue {
  mode: Mode;
  setMode: (m: Mode) => void;
  clubTheme: ClubThemeConfig;
  setClubTheme: (c: ClubThemeConfig) => void;
  reloadClubTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>("system");
  const [clubTheme, setClubThemeState] = useState<ClubThemeConfig>(DEFAULT_THEME_CONFIG);

  // Apply dark/light/system mode
  const applyMode = useCallback((m: Mode) => {
    const root = document.documentElement;
    const stored = localStorage.getItem("rcs-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    let isDark = false;
    if (m === "dark") isDark = true;
    else if (m === "light") isDark = false;
    else isDark = prefersDark; // system

    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("rcs-theme", isDark ? "dark" : "light");
    localStorage.setItem("rcs-theme-mode", m);
  }, []);

  // Initialize from localStorage on mount
  useEffect(() => {
    const savedMode = (localStorage.getItem("rcs-theme-mode") as Mode) || "system";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModeState(savedMode);
    applyMode(savedMode);

    // Listen to system color scheme changes (only if mode=system)
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const currentMode = (localStorage.getItem("rcs-theme-mode") as Mode) || "system";
      if (currentMode === "system") {
        applyMode("system");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [applyMode]);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    applyMode(m);
  }, [applyMode]);

  // Load + apply club theme from API
  const reloadClubTheme = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/theme");
      if (!res.ok) return;
      const data = await res.json();
      if (data.config) {
        setClubThemeState(data.config);
        applyThemeConfig(data.config);
      } else {
        applyThemeConfig(DEFAULT_THEME_CONFIG);
      }
    } catch {
      // Offline or unauthenticated — apply default
      applyThemeConfig(DEFAULT_THEME_CONFIG);
    }
  }, []);

  useEffect(() => {
    // Synchronize with external API (legitimate setState in effect for async fetch)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reloadClubTheme();
  }, [reloadClubTheme]);

  const setClubTheme = useCallback((c: ClubThemeConfig) => {
    setClubThemeState(c);
    applyThemeConfig(c);
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, setMode, clubTheme, setClubTheme, reloadClubTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/lib/theme-context";

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark =
    mode === "dark" ||
    (mode === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const toggle = () => {
    const nextMode = isDark ? "light" : "dark";
    setMode(nextMode);
  };

  return (
    <button
      onClick={toggle}
      className="relative h-9 w-9 rounded-xl border border-border/70 bg-card hover:bg-accent/80 transition-colors flex items-center justify-center shadow-xs"
      title={isDark ? "التحويل إلى الوضع النهاري" : "التحويل إلى الوضع الليلي"}
      aria-label="تبديل الوضع الليلي والنهاري"
    >
      <motion.div
        initial={false}
        animate={{
          rotate: mounted ? (isDark ? 180 : 0) : 0,
          scale: mounted ? (isDark ? 0 : 1) : 1,
          opacity: mounted ? (isDark ? 0 : 1) : 1,
        }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="absolute"
      >
        <Sun className="h-4 w-4 text-amber-500" />
      </motion.div>
      <motion.div
        initial={false}
        animate={{
          rotate: mounted ? (isDark ? 0 : -180) : -180,
          scale: mounted ? (isDark ? 1 : 0) : 0,
          opacity: mounted ? (isDark ? 1 : 0) : 0,
        }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="absolute"
      >
        <Moon className="h-4 w-4 text-indigo-400" />
      </motion.div>
    </button>
  );
}

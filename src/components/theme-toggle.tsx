"use client";

import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

export function ThemeToggle() {
  // Initialize from DOM (set by inline script in layout)
  const [dark, setDark] = useState(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  const toggle = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      try { localStorage.setItem("rcs-theme", "dark"); } catch {}
    } else {
      document.documentElement.classList.remove("dark");
      try { localStorage.setItem("rcs-theme", "light"); } catch {}
    }
  };

  return (
    <button
      onClick={toggle}
      className="relative h-9 w-9 rounded-lg border border-border/60 bg-card hover:bg-accent transition flex items-center justify-center"
      title={dark ? "الوضع النهاري" : "الوضع الليلي"}
    >
      <motion.div
        initial={false}
        animate={{ rotate: dark ? 180 : 0, scale: dark ? 0 : 1 }}
        transition={{ duration: 0.3 }}
        className="absolute"
      >
        <Sun className="h-4 w-4 text-amber-500" />
      </motion.div>
      <motion.div
        initial={false}
        animate={{ rotate: dark ? 0 : -180, scale: dark ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="absolute"
      >
        <Moon className="h-4 w-4 text-indigo-400" />
      </motion.div>
    </button>
  );
}

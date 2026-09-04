"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Waves, Loader2, Delete, Lock, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { notifyClick, notifyError, notifySuccess } from "@/lib/sounds";

export default function PinLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  // Already logged in? Redirect.
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.user) window.location.href = "/";
      })
      .catch(() => {});
  }, []);

  const handlePress = (digit: string) => {
    notifyClick();
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) {
        // Auto-submit when 4 digits entered
        setTimeout(() => submitPin(newPin), 150);
      }
    }
  };

  const handleDelete = () => {
    notifyClick();
    setPin(pin.slice(0, -1));
  };

  const submitPin = useCallback(async (pinValue: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/cashier-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        notifyError();
        setShake(true);
        setTimeout(() => setShake(false), 500);
        toast.error(data.error || "PIN غير صحيح");
        setPin("");
      } else {
        notifySuccess();
        toast.success(`مرحباً ${data.user.name}`);
        window.location.href = "/";
      }
    } catch {
      notifyError();
      toast.error("خطأ في الاتصال");
      setPin("");
    } finally {
      setLoading(false);
    }
  }, []);

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (loading) return;
      if (/^[0-9]$/.test(e.key)) {
        handlePress(e.key);
      } else if (e.key === "Backspace") {
        handleDelete();
      } else if (e.key === "Enter" && pin.length === 4) {
        submitPin(pin);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pin, loading, submitPin]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-teal-600 via-sky-700 to-indigo-800 relative overflow-hidden">
      {/* Decorative waves */}
      <div className="absolute inset-0 opacity-10">
        <svg className="absolute bottom-0 left-0 w-full h-1/2" viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path d="M0,60 C150,100 350,0 600,60 C850,120 1050,20 1200,60 L1200,120 L0,120 Z" fill="white" />
        </svg>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-24 w-24 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 mb-3 overflow-hidden shadow-lg">
            <img
              src="/images/aquacore-logo.png"
              alt="AquaCore"
              className="h-full w-full object-contain p-1"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <h1 className="text-xl font-extrabold text-white">دخول الكاشير السريع</h1>
          <p className="text-xs text-white/70 mt-1">أدخل 4 أرقام للدخول</p>
        </div>

        {/* Card */}
        <motion.div
          animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 p-6"
        >
          {/* PIN display */}
          <div className="flex justify-center gap-3 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={i}
                animate={pin.length === i ? { scale: [1, 1.2, 1] } : {}}
                className={`h-4 w-4 rounded-full border-2 transition-colors ${
                  i < pin.length ? "bg-primary border-primary" : "border-border bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button
                key={d}
                onClick={() => handlePress(d)}
                disabled={loading}
                className="h-16 rounded-2xl bg-muted hover:bg-primary/15 hover:text-primary transition-colors text-2xl font-bold tabular-nums active:scale-95 disabled:opacity-50"
              >
                {d}
              </button>
            ))}
            <button
              onClick={handleDelete}
              disabled={loading || pin.length === 0}
              className="h-16 rounded-2xl bg-muted hover:bg-rose-500/15 hover:text-rose-600 transition-colors flex items-center justify-center active:scale-95 disabled:opacity-50"
            >
              <Delete className="h-6 w-6" />
            </button>
            <button
              onClick={() => handlePress("0")}
              disabled={loading}
              className="h-16 rounded-2xl bg-muted hover:bg-primary/15 hover:text-primary transition-colors text-2xl font-bold tabular-nums active:scale-95 disabled:opacity-50"
            >
              0
            </button>
            <button
              onClick={() => pin.length === 4 && submitPin(pin)}
              disabled={loading || pin.length !== 4}
              className="h-16 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center active:scale-95 disabled:opacity-30"
            >
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ArrowRight className="h-6 w-6" />}
            </button>
          </div>

          {/* Back to login */}
          <div className="mt-5 pt-4 border-t border-border/60 text-center">
            <a
              href="/login"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <Waves className="h-3 w-3" /> العودة لتسجيل الدخول الكامل
            </a>
          </div>
        </motion.div>

        <p className="text-center text-xs text-white/60 mt-4">
          © 2026 AquaCore Club Manager — كاشير سريع
        </p>
      </motion.div>
    </div>
  );
}

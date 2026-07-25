"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Lock, LogIn, Loader2, AlertCircle, Eye, EyeOff,
  Building2, KeyRound, Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          window.location.href = callbackUrl;
        }
      })
      .catch(() => {});
  }, [callbackUrl]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "بيانات الدخول غير صحيحة");
        toast.error(data.error || "فشل تسجيل الدخول");
        setLoading(false);
        return;
      }

      toast.success(`مرحباً بك ${data.user.name}`);
      window.location.href = callbackUrl;
    } catch (err) {
      console.error("Login error:", err);
      setError("تعذر الاتصال بالخادم. حاول مرة أخرى.");
      toast.error("خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-950">
      {/* ─── Static background (no heavy animations for mobile performance) ─── */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-teal-950 to-slate-950" />
        {/* دوائر ثابتة بدون animation — تمنع التوهج في WebView */}
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 rounded-full bg-teal-500/15 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 rounded-full bg-sky-500/15 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      {/* ─── Login card ─── */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[420px]"
      >
        <div className="bg-white/[0.07] backdrop-blur-2xl rounded-[2rem] border border-white/[0.12] shadow-2xl overflow-hidden">
          <div className="h-1 bg-gradient-to-l from-teal-400 via-sky-400 to-indigo-400" />

          <div className="p-8 sm:p-10">
            {/* Logo + title */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center h-24 w-24 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 mb-4 overflow-hidden shadow-lg">
                <img
                  src="/images/aquacore-logo.png"
                  alt="AquaCore Club Manager"
                  className="h-full w-full object-contain p-1"
                  onError={(e) => {
                    // fallback للأيقونة إن فشل تحميل الشعار
                    const t = e.currentTarget as HTMLImageElement;
                    t.style.display = "none";
                  }}
                />
              </div>
              <h1 className="text-xl font-extrabold text-white tracking-tight">
                AquaCore Club Manager
              </h1>
              <p className="text-sm text-teal-400/80 mt-1 font-medium">منظومة إدارة النوادي الرياضية</p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-5">
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-300"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                  البريد الإلكتروني
                </Label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@club.dz"
                    className="h-12 pr-10 pl-4 bg-white/[0.06] border-white/[0.12] text-white placeholder:text-white/25 rounded-xl focus:bg-white/[0.1] focus:border-teal-400/40 transition"
                    required
                    autoComplete="email"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                  كلمة المرور
                </Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-12 pr-10 pl-10 bg-white/[0.06] border-white/[0.12] text-white placeholder:text-white/25 rounded-xl focus:bg-white/[0.1] focus:border-teal-400/40 transition"
                    required
                    autoComplete="current-password"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-white/30 hover:text-white/60 transition"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 text-base font-bold rounded-xl bg-gradient-to-l from-teal-500 to-sky-500 hover:from-teal-400 hover:to-sky-400 border-0 text-white shadow-lg shadow-teal-500/20 transition-all hover:shadow-xl hover:shadow-teal-500/30"
              >
                {loading ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> جاري الدخول...</>
                ) : (
                  <><LogIn className="h-5 w-5 ml-1" /> تسجيل الدخول</>
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-white/30">أو</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3">
              <a
                href="/register-club"
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-teal-400/20 transition group"
              >
                <Building2 className="h-5 w-5 text-teal-400/70 group-hover:text-teal-400 transition" />
                <span className="text-xs font-semibold text-white/70 group-hover:text-white transition">تسجيل نادٍ جديد</span>
              </a>
              <a
                href="/pin"
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-amber-400/20 transition group"
              >
                <KeyRound className="h-5 w-5 text-amber-400/70 group-hover:text-amber-400 transition" />
                <span className="text-xs font-semibold text-white/70 group-hover:text-white transition">دخول الكاشير</span>
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-white/30 mt-6">
          © 2026 AquaCore Club Manager — جميع الحقوق محفوظة
        </p>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950">
          <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

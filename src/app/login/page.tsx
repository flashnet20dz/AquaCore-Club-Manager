"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Lock, LogIn, Loader2, AlertCircle, Eye, EyeOff,
  Building2, KeyRound, Waves, Users, QrCode, CreditCard,
  BarChart3, Wallet, ShieldCheck, CheckCircle2, Sparkles, Zap,
  Calendar, Award, Bell, Shield, Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { DEFAULT_LOGIN_CONFIG } from "@/lib/login-config";

// ═════════════════════════════════════════════════════════════
//  ★ مساعدات الأيقونات والتصميم المائي الديناميكي
// ═════════════════════════════════════════════════════════════

const getIconComponent = (name: string) => {
  switch (name) {
    case "Users": return Users;
    case "Calendar": return Calendar;
    case "QrCode": return QrCode;
    case "IdCard": return Sparkles;
    case "Wallet": return Wallet;
    case "BarChart3": return BarChart3;
    case "CreditCard": return CreditCard;
    case "Zap": return Zap;
    case "ShieldCheck": return ShieldCheck;
    case "Waves": return Waves;
    default: return Sparkles;
  }
};

const getFeatureColorClass = (color: string) => {
  switch (color) {
    case "cyan":
      return { card: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30", icon: "text-cyan-400" };
    case "emerald":
      return { card: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30", icon: "text-emerald-400" };
    case "indigo":
      return { card: "from-indigo-500/20 to-indigo-500/5 border-indigo-500/30", icon: "text-indigo-400" };
    case "amber":
      return { card: "from-amber-500/20 to-amber-500/5 border-amber-500/30", icon: "text-amber-300" };
    case "teal":
      return { card: "from-teal-500/20 to-teal-500/5 border-teal-500/30", icon: "text-teal-300" };
    case "rose":
      return { card: "from-rose-500/20 to-rose-500/5 border-rose-500/30", icon: "text-rose-400" };
    case "violet":
      return { card: "from-violet-500/20 to-violet-500/5 border-violet-500/30", icon: "text-violet-400" };
    case "fuchsia":
      return { card: "from-fuchsia-500/20 to-fuchsia-500/5 border-fuchsia-500/30", icon: "text-fuchsia-400" };
    default:
      return { card: "from-teal-500/20 to-teal-500/5 border-teal-500/30", icon: "text-teal-300" };
  }
};

const THEME_STYLES: Record<string, {
  bg: string;
  glow1: string;
  glow2: string;
  accentText: string;
  heroHighlight: string;
  cardTopBar: string;
  buttonGrad: string;
  badgeBorder: string;
}> = {
  "aquatic-luxury": {
    bg: "from-[#020b17] via-[#051a30] to-[#010914]",
    glow1: "bg-teal-400/20",
    glow2: "bg-sky-400/20",
    accentText: "text-teal-400",
    heroHighlight: "bg-gradient-to-l from-teal-400 via-sky-300 to-cyan-400 bg-clip-text text-transparent",
    cardTopBar: "bg-gradient-to-l from-teal-400 via-sky-400 to-cyan-300",
    buttonGrad: "bg-gradient-to-l from-teal-500 to-sky-500 hover:from-teal-400 hover:to-sky-400 text-white shadow-teal-500/25",
    badgeBorder: "border-teal-500/40 text-teal-300 bg-teal-500/10",
  },
  "ocean-blue": {
    bg: "from-[#020c1d] via-[#06183d] to-[#010815]",
    glow1: "bg-sky-500/20",
    glow2: "bg-blue-600/20",
    accentText: "text-sky-400",
    heroHighlight: "bg-gradient-to-l from-sky-400 via-blue-300 to-indigo-300 bg-clip-text text-transparent",
    cardTopBar: "bg-gradient-to-l from-sky-400 via-blue-500 to-indigo-400",
    buttonGrad: "bg-gradient-to-l from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white shadow-sky-500/25",
    badgeBorder: "border-sky-500/40 text-sky-300 bg-sky-500/10",
  },
  "midnight-aurora": {
    bg: "from-[#0d0b16] via-[#1c0f24] to-[#090710]",
    glow1: "bg-fuchsia-500/20",
    glow2: "bg-pink-500/20",
    accentText: "text-[#e04fa4]",
    heroHighlight: "highlight-flip",
    cardTopBar: "bg-gradient-to-l from-[#e04fa4] via-[#d6336c] to-[#bef264]",
    buttonGrad: "hue-morph text-white",
    badgeBorder: "border-pink-500/40 text-pink-300 bg-pink-500/10",
  },
  "olympic-pool": {
    bg: "from-[#02131b] via-[#042838] to-[#010e14]",
    glow1: "bg-cyan-400/25",
    glow2: "bg-emerald-400/20",
    accentText: "text-cyan-400",
    heroHighlight: "bg-gradient-to-l from-cyan-300 via-teal-300 to-emerald-300 bg-clip-text text-transparent",
    cardTopBar: "bg-gradient-to-l from-cyan-400 via-teal-400 to-emerald-400",
    buttonGrad: "bg-gradient-to-l from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black shadow-cyan-500/25",
    badgeBorder: "border-cyan-500/40 text-cyan-300 bg-cyan-500/10",
  },
};

// ── شريط الماركي المتحرك ──
function DynamicMarquee({ items, theme }: { items: string[]; theme: string }) {
  const row = (ariaHidden: boolean) => (
    <div className="flex items-center gap-12 shrink-0" aria-hidden={ariaHidden || undefined}>
      {items.map((item, i) => (
        <span key={i} className="inline-flex items-center gap-12">
          <span className={cn(
            "text-[12px] font-extrabold tracking-wide",
            i % 2 === 0 ? "text-cyan-300" : "text-emerald-300/90 font-mono"
          )}>
            {item}
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/70" />
        </span>
      ))}
    </div>
  );
  return (
    <div className="marquee marquee-mask py-2" role="presentation">
      <div className="marquee-track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // إعدادات واجهة الدخول الديناميكية المعدلة من المدير العام
  const [config, setConfig] = useState(DEFAULT_LOGIN_CONFIG);

  // جلب إعدادات الواجهة المخصصة
  useEffect(() => {
    fetch("/api/super-admin/login-customizer", { cache: "no-store" })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Failed to load customizer config");
      })
      .then((data) => {
        if (data && data.config) {
          setConfig(data.config);
        }
      })
      .catch((err) => {
        console.warn("Using default login page config:", err);
      });
  }, []);

  // التحقق من الجلسة الحالية
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          try {
            sessionStorage.removeItem("rcs-active-tab");
            localStorage.removeItem("rcs-active-tab");
          } catch {}
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
      try {
        sessionStorage.removeItem("rcs-active-tab");
        localStorage.removeItem("rcs-active-tab");
      } catch {}
      window.location.href = callbackUrl;
    } catch (err) {
      console.error("Login error:", err);
      setError("تعذر الاتصال بالخادم. حاول مرة أخرى.");
      toast.error("خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  const currentTheme = THEME_STYLES[config.themeStyle] || THEME_STYLES["aquatic-luxury"];

  return (
    <div className={cn(
      "min-h-screen flex relative overflow-hidden text-slate-100 selection:bg-teal-500 selection:text-white bg-gradient-to-br transition-colors duration-700",
      currentTheme.bg
    )}>
      {/* ═════════════════════════════════════════════════════════
          ★ خلفية مائية عامة تملأ كامل الصفحة لمنع أي فراغ أسود
          ═════════════════════════════════════════════════════════ */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* طبقة انكسارات ضوء مياه المسبح (Water Caustics) */}
        {config.waterRipples && (
          <div 
            className="absolute inset-0 opacity-25 mix-blend-screen animate-aquatic-caustic pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle at 45% 45%, rgba(56, 189, 248, 0.28) 0%, transparent 65%), radial-gradient(circle at 15% 85%, rgba(20, 184, 166, 0.22) 0%, transparent 55%), radial-gradient(circle at 85% 15%, rgba(14, 165, 233, 0.22) 0%, transparent 55%)`,
            }}
          />
        )}

        {/* شبكة هندسية خافتة مستوحاة من مسارات ومربعات أحواض السباحة */}
        <div 
          className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(to right, #38bdf8 1px, transparent 1px), linear-gradient(to bottom, #38bdf8 1px, transparent 1px)`,
            backgroundSize: `40px 40px`,
          }}
        />

        {/* دوائر التوهج المائي الحية */}
        <div className={cn("absolute -top-32 -right-32 w-[550px] h-[550px] rounded-full blur-3xl opacity-25 animate-water-pulse", currentTheme.glow1)} />
        <div className={cn("absolute -bottom-32 -left-32 w-[550px] h-[550px] rounded-full blur-3xl opacity-25 animate-water-pulse", currentTheme.glow2)} />

        {/* فقاعات مائية متوهجة عائمة تضفي روح المسابح */}
        <div className="absolute top-[18%] left-[7%] w-3.5 h-3.5 rounded-full bg-cyan-400/40 blur-[1px] animate-aquatic-float hidden md:block" />
        <div className="absolute top-[68%] left-[16%] w-2.5 h-2.5 rounded-full bg-teal-300/35 blur-[1px] animate-aquatic-float hidden md:block" style={{ animationDelay: "2.5s" }} />
        <div className="absolute bottom-[22%] right-[12%] w-4 h-4 rounded-full bg-sky-300/30 blur-[1px] animate-aquatic-float hidden md:block" style={{ animationDelay: "4.5s" }} />
      </div>

      {/* ═════════════════════════════════════════════════════════
          ★ القسم الأيمن (RTL) — الواجهة التعريفية (Hero + Features)
          ═════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-[55%] flex-col relative z-10 overflow-hidden border-l border-white/[0.08]">
        {/* خلفية صورة المسبح مع تدرج متقدم */}
        <div className="absolute inset-0">
          <img
            src={config.customBgUrl || "/images/hero-swimming.png"}
            alt="مسبح النادي"
            className="w-full h-full object-cover opacity-25 scale-105 transition-transform duration-1000"
            onError={(e) => {
              const t = e.currentTarget as HTMLImageElement;
              t.src = "/images/hero-swimming.png";
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-slate-950/95" />
          <div className={cn("absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full blur-3xl opacity-30", currentTheme.glow1)} />
          <div className={cn("absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full blur-3xl opacity-30", currentTheme.glow2)} />
        </div>

        {/* المحتوى التعريفي */}
        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14 overflow-y-auto">
          {/* ─── الشعار + العنوان ─── */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3.5 mb-2"
          >
            <div className="h-14 w-14 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 overflow-hidden flex items-center justify-center shadow-xl shadow-teal-500/10">
              <img
                src="/images/aquacore-logo.png"
                alt="AquaCore"
                className="h-full w-full object-contain p-1"
                onError={(e) => {
                  const t = e.currentTarget as HTMLImageElement;
                  t.style.display = "none";
                }}
              />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight" style={{ fontFamily: "var(--font-unbounded), var(--font-cairo-play), sans-serif" }}>
                Aqua<span className={currentTheme.accentText}>Core</span>
              </h1>
              <p className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                Club Manager
                <span className="text-[10px] text-teal-300 border border-teal-500/30 bg-teal-500/10 rounded-full px-2 py-0.5 font-mono">
                  v10 · 2026
                </span>
              </p>
            </div>
          </motion.div>

          {/* ─── الوصف التعريفي المخصص من المدير ─── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-7 mb-6"
          >
            <h2 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight mb-3" style={{ fontFamily: "var(--font-unbounded), var(--font-cairo-play), sans-serif" }}>
              {config.heroTitle}
              <br />
              <span className={currentTheme.heroHighlight}>{config.heroHighlight}</span>
            </h2>
            <p className="text-sm xl:text-base text-slate-300/80 leading-relaxed max-w-xl">
              {config.heroDescription}
            </p>

            {/* ملصقات الشارة الذكية */}
            <div className="hidden md:flex items-center gap-3 mt-5">
              {(config.stickers || []).map((stk, idx) => {
                const StkIcon = getIconComponent(stk.icon);
                return (
                  <span
                    key={idx}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border backdrop-blur-md shadow-sm transition-all",
                      stk.color === "lime"
                        ? "bg-lime-400/10 border-lime-400/30 text-lime-300"
                        : "bg-teal-400/10 border-teal-400/30 text-teal-300"
                    )}
                  >
                    <StkIcon className="h-3.5 w-3.5" />
                    <span>{stk.text}</span>
                  </span>
                );
              })}
            </div>
          </motion.div>

          {/* ─── الإحصائيات الديناميكية ─── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="grid grid-cols-4 gap-2.5 mb-7"
          >
            {(config.stats || []).map((s, i) => (
              <div key={i} className="text-center rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md py-3 px-1.5 shadow-md">
                <p className="text-lg xl:text-xl font-extrabold text-teal-300 tabular-nums leading-none font-mono">
                  {s.value}
                </p>
                <p className="text-[10px] xl:text-[11px] text-slate-400 mt-1.5 font-medium">{s.label}</p>
              </div>
            ))}
          </motion.div>

          {/* ─── بطاقات الميزات القابلة للتخصيص ─── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="grid grid-cols-2 gap-3 flex-1 content-start"
          >
            {(config.features || []).map((f, i) => {
              const FIcon = getIconComponent(f.icon);
              const colorInfo = getFeatureColorClass(f.color);
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.5 + i * 0.06 }}
                  className={cn("rounded-2xl bg-gradient-to-br border p-3.5 backdrop-blur-md shadow-lg", colorInfo.card)}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="h-8 w-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0 shadow-inner">
                      <FIcon className={cn("h-4 w-4", colorInfo.icon)} />
                    </div>
                    <h3 className="text-xs font-bold text-white tracking-wide">{f.title}</h3>
                  </div>
                  <p className="text-[11px] text-slate-300/70 leading-relaxed">{f.desc}</p>
                </motion.div>
              );
            })}
          </motion.div>

          {/* ─── شريط الماركي الصاخب ─── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="mt-6 mb-3 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md"
          >
            <DynamicMarquee items={config.marqueeItems || []} theme={config.themeStyle} />
          </motion.div>

          {/* ─── Footer تعريفي ─── */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-teal-400" />
              <span>منصة سحابية ومحلية موقّعة رقمياً — بياناتك مؤمنة بالكامل</span>
            </div>
            <span className="font-mono text-[10px] text-slate-500">AquaCore v10.0</span>
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════
          ★ القسم الأيسر (RTL) — نموذج الدخول مع تصميم مائي متقدم
          ═════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-10 relative z-10 overflow-hidden">
        
        {/* ─── شارات عائمة احترافية على الشاشات الكبيرة تملأ الفراغ بالكامل ─── */}
        {config.floatingBadges && (
          <>
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="hidden 2xl:flex items-center gap-3 absolute top-12 left-12 p-3.5 rounded-2xl bg-slate-900/60 border border-teal-500/20 backdrop-blur-xl shadow-2xl animate-aquatic-float"
            >
              <div className="h-10 w-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
                <Waves className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-100">نوادي ومسابح السباحة</p>
                <p className="text-[10px] text-slate-400">إدارة الحصص، المدربين، والأحواض</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="hidden 2xl:flex items-center gap-3 absolute bottom-12 right-12 p-3.5 rounded-2xl bg-slate-900/60 border border-sky-500/20 backdrop-blur-xl shadow-2xl animate-aquatic-float"
              style={{ animationDelay: "3s" }}
            >
              <div className="h-10 w-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-100">تشفير وأمان بنكي AES-256</p>
                <p className="text-[10px] text-slate-400">حماية تامة للبيانات والاشتراكات</p>
              </div>
            </motion.div>
          </>
        )}

        {/* ─── شريط التنبيه الإداري العام (إن وجد) ─── */}
        {Boolean(config.announcement) && (
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-[420px] mb-4"
          >
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs shadow-xl backdrop-blur-xl">
              <Bell className="h-4 w-4 text-amber-400 shrink-0 animate-bounce" />
              <span className="font-semibold leading-relaxed">{config.announcement}</span>
            </div>
          </motion.div>
        )}

        {/* ─── بطاقة تسجيل الدخول الزجاجية الفاخرة ─── */}
        <motion.div
          initial={{ opacity: 0, y: 25, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-[420px]"
        >
          <div className="bg-slate-900/70 backdrop-blur-2xl rounded-[2rem] border border-white/[0.12] shadow-2xl overflow-hidden relative">
            {/* الشريط اللوني العلوي الديناميكي */}
            <div className={cn("h-1.5 transition-all duration-700", currentTheme.cardTopBar)} />

            <div className="p-7 sm:p-9">
              {/* شعار للجوال والشاشات المتوسطة */}
              <div className="lg:hidden text-center mb-6">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-white/5 border border-white/10 mb-2.5 overflow-hidden shadow-xl">
                  <img
                    src="/images/aquacore-logo.png"
                    alt="AquaCore"
                    className="h-full w-full object-contain p-1"
                    onError={(e) => {
                      const t = e.currentTarget as HTMLImageElement;
                      t.style.display = "none";
                    }}
                  />
                </div>
                <h1 className="text-lg font-extrabold text-white" style={{ fontFamily: "var(--font-unbounded), var(--font-cairo-play), sans-serif" }}>
                  Aqua<span className={currentTheme.accentText}>Core</span> Club Manager
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">منظومة إدارة نوادي السباحة</p>
              </div>

              {/* عنوان نموذج الدخول */}
              <div className="mb-6 text-right">
                <h2 className="text-xl font-extrabold text-white mb-1 flex items-center gap-2">
                  <span>{config.loginTitle || "تسجيل الدخول"}</span>
                  <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {config.loginSubtitle || "أدخل بياناتك للوصول إلى لوحة الإدارة"}
                </p>
              </div>

              {/* النموذج */}
              <form onSubmit={handleLogin} className="space-y-4">
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      exit={{ opacity: 0, y: -8, height: 0 }}
                      className="flex items-center gap-2 rounded-xl bg-rose-500/15 border border-rose-500/30 px-3.5 py-2.5 text-xs text-rose-200"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                      <span className="font-medium">{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* حقل البريد الإلكتروني */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300 block text-right">
                    البريد الإلكتروني
                  </Label>
                  <div className="relative">
                    <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@rcs.dz"
                      className="h-12 pr-11 pl-4 bg-slate-950/70 border-white/[0.12] text-white placeholder:text-slate-500 rounded-2xl focus:border-teal-400 focus:bg-slate-950 focus:ring-1 focus:ring-teal-400/40 text-xs font-mono transition-all"
                      required
                      autoComplete="email"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* حقل كلمة المرور مع زر الإظهار والإخفاء فائق الاستجابة */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-300">
                      كلمة المرور
                    </Label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[11px] text-teal-400 hover:text-teal-300 transition-colors flex items-center gap-1 focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      <span>{showPassword ? "إخفاء" : "إظهار"}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-12 pr-11 pl-12 bg-slate-950/70 border-white/[0.12] text-white placeholder:text-slate-500 rounded-2xl focus:border-teal-400 focus:bg-slate-950 focus:ring-1 focus:ring-teal-400/40 text-xs font-mono transition-all"
                      required
                      autoComplete="current-password"
                      dir="ltr"
                    />
                    
                    {/* زر إظهار/إخفاء كلمة المرور المباشر داخل الحقل */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowPassword(!showPassword);
                      }}
                      title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                      aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-teal-300 transition-all z-20 cursor-pointer shadow-sm"
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5 text-teal-400" /> : <Eye className="h-3.5 w-3.5 text-slate-300" />}
                    </button>
                  </div>
                </div>

                {/* زر تسجيل الدخول الرئيسي */}
                <Button
                  type="submit"
                  disabled={loading}
                  className={cn("w-full h-12 text-sm font-bold border-0 rounded-2xl transition-all shadow-lg", currentTheme.buttonGrad)}
                >
                  {loading ? (
                    <><Loader2 className="h-5 w-5 animate-spin ml-2" /> جاري التحقق والدخول...</>
                  ) : (
                    <><LogIn className="h-5 w-5 ml-2" /> تسجيل الدخول</>
                  )}
                </Button>
              </form>

              {/* فاصل أنيق */}
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[11px] text-slate-400">أو الوصول السريع</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* أزرار الإجراءات الإضافية */}
              <div className="grid grid-cols-2 gap-3">
                <a
                  href="/register-club"
                  className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-teal-400/40 transition group glow-hover"
                >
                  <Building2 className="h-5 w-5 text-teal-400/80 group-hover:text-teal-300 transition" />
                  <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition">تسجيل نادٍ جديد</span>
                </a>
                <a
                  href="/pin"
                  className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-amber-300/40 transition group glow-hover"
                >
                  <KeyRound className="h-5 w-5 text-amber-300/80 group-hover:text-amber-200 transition" />
                  <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition">دخول الكاشير</span>
                </a>
              </div>
            </div>
          </div>

          {/* تذييل أسفل البطاقة */}
          <p className="text-center text-xs text-slate-400/60 mt-5">
            © 2026 AquaCore Club Manager — جميع الحقوق محفوظة
          </p>
        </motion.div>
      </div>
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

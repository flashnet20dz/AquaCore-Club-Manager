"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Lock, LogIn, Loader2, AlertCircle, Eye, EyeOff,
  Building2, KeyRound, Waves, Users, QrCode, CreditCard,
  BarChart3, Wallet, ShieldCheck, CheckCircle2, Sparkles, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// ═════════════════════════════════════════════════════════════
//  ★ قائمة الميزات للعرض في الواجهة التعريفية
// ═════════════════════════════════════════════════════════════
const FEATURES = [
  {
    icon: Users,
    title: "إدارة المنخرطين",
    desc: "تسجيل، تعديل، وبحث عن المنخرطين مع توليد تلقائي لأرقام الملفات",
    color: "from-pink-500/20 to-pink-500/5 border-pink-500/30",
    iconColor: "text-pink-400",
  },
  {
    icon: QrCode,
    title: "تتبع الحضور بالـ QR",
    desc: "تسجيل حضور سريع عبر مسح الباركود + إحصائيات لحظية للحمام",
    color: "from-fuchsia-500/20 to-fuchsia-500/5 border-fuchsia-500/30",
    iconColor: "text-fuchsia-400",
  },
  {
    icon: CreditCard,
    title: "تجديد الاشتراكات",
    desc: "نظام تجديد مرن مع تواريخ مخصصة وتنبيهات تلقائية قبل الانتهاء",
    color: "from-violet-500/20 to-violet-500/5 border-violet-500/30",
    iconColor: "text-violet-400",
  },
  {
    icon: Sparkles,
    title: "تصميم وطباعة البطاقات",
    desc: "مصمم بطاقات احترافي WYSIWYG مع طباعة RECTO/VERSO للوجهين",
    color: "from-yellow-500/20 to-yellow-500/5 border-yellow-500/30",
    iconColor: "text-yellow-300",
  },
  {
    icon: Wallet,
    title: "الإدارة المالية",
    desc: "لوحة مالية متكاملة: معاملات، دفعات، تقارير، وأرصدة لحظية",
    color: "from-lime-500/20 to-lime-500/5 border-lime-500/30",
    iconColor: "text-lime-300",
  },
  {
    icon: BarChart3,
    title: "تقارير وإحصائيات",
    desc: "تصدير Word/PDF/Excel + خريطة ازدحام + تحليل الحضور والغائب",
    color: "from-rose-500/20 to-rose-500/5 border-rose-500/30",
    iconColor: "text-rose-400",
  },
];

const STATS = [
  { value: "+1000", label: "منخرط مدار" },
  { value: "+12", label: "نادٍ رياضي" },
  { value: "24/7", label: "وصول مستمر" },
  { value: "100%", label: "آمن ومشفّر" },
];

// ── شريط الماركي: لا بيج · لا ضجيج · لا خوف (يتوقف عند التحويم) ──
const MARQUEE_ITEMS = [
  "لا بيج · لا ضجيج · لا خوف",
  "NO BEIGE · NO NOISE · NO FEAR",
  "حضور لحظي بالـ QR",
  "MOTION EARNS ATTENTION",
  "إدارة مالية صاخبة الوضوح",
  "LOUD BRANDS EARN QUIET TRUST",
  "v10.0 · AQUACORE 2026",
];

function MarqueeBand() {
  const row = (ariaHidden: boolean) => (
    <div className="flex items-center gap-12 shrink-0" aria-hidden={ariaHidden || undefined}>
      {MARQUEE_ITEMS.map((item, i) => (
        <span key={i} className="inline-flex items-center gap-12">
          <span className={i % 2 === 0 ? "text-[13px] font-extrabold text-[#e04fa4]" : "energy-mark text-[11px] text-lime-300/90"}>
            {item}
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-lime-300/70" />
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

  return (
    <div className="min-h-screen flex bg-[#0d0b10] relative overflow-hidden">
      {/* ═════════════════════════════════════════════════════════
          ★ القسم الأيمن (RTL) — الواجهة التعريفية (Hero + Features)
          ═════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-[55%] flex-col relative overflow-hidden">
        {/* الخلفية المتدرجة + صورة المسبح */}
        <div className="absolute inset-0">
          <img
            src="/images/hero-swimming.png"
            alt="مسبح النادي"
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#0d0b10]/95 via-[#1c0f1a]/90 to-[#0d0b10]/95" />
          {/* دوائر توهج حية (شفق ماجنتا متحرك) */}
          <div className="aurora-blob absolute top-[-5%] right-[-5%] w-96 h-96 rounded-full bg-[#e04fa4]/15 blur-3xl" />
          <div className="aurora-blob-delayed absolute bottom-[-5%] left-[-5%] w-96 h-96 rounded-full bg-fuchsia-600/15 blur-3xl" />
        </div>

        {/* المحتوى */}
        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14 overflow-y-auto">
          {/* ─── الشعار + العنوان ─── */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3 mb-2"
          >
            <div className="h-14 w-14 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 overflow-hidden flex items-center justify-center shadow-lg">
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
                Aqua<span className="text-[#e04fa4]">Core</span>
              </h1>
              <p className="text-xs text-pink-400/80 font-medium flex items-center gap-1.5">
                Club Manager
                <span className="energy-mark text-[9px] text-lime-300/70 border border-lime-300/30 rounded-full px-1.5 py-px">v10 · 2026</span>
              </p>
            </div>
          </motion.div>

          {/* ─── الوصف التعريفي ─── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-8 mb-6"
          >
            <h2 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight mb-3" style={{ fontFamily: "var(--font-unbounded), var(--font-cairo-play), sans-serif" }}>
              منظومة عصرية متكاملة
              <br />
              <span className="highlight-flip">لإدارة نوادي السباحة</span>
            </h2>
            <p className="text-sm xl:text-base text-white/60 leading-relaxed max-w-xl">
              منصة سحابية احترافية لإدارة الاشتراكات والحضور والمالية في الأندية الرياضية —
              تسجيل، إحصائيات، تجديد، حضور بكود QR، تصميم وطباعة البطاقات، وإشعارات تلقائية.
            </p>
            {/* ── ملصقتان (اثنان في الصفحة، لا ثالث لهما) ── */}
            <div className="hidden md:flex items-center gap-4 mt-5">
              <span className="sticker sticker-lime text-sm">
                <QrCode className="h-4 w-4" />
                حضور لحظي بالـ QR
              </span>
              <span className="sticker sticker-magenta sticker-flip text-sm">
                <Zap className="h-4 w-4" />
                24/7 جاهز
              </span>
            </div>
          </motion.div>

          {/* ─── الإحصائيات ─── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="grid grid-cols-4 gap-2 mb-8"
          >
            {STATS.map((s, i) => (
              <div key={i} className="text-center rounded-xl bg-white/[0.04] border border-white/[0.08] py-2.5 px-1">
                <p className="text-lg xl:text-xl font-extrabold text-lime-300 tabular-nums leading-none font-mono">{s.value}</p>
                <p className="text-[9px] xl:text-[10px] text-white/50 mt-1">{s.label}</p>
              </div>
            ))}
          </motion.div>

          {/* ─── بطاقات الميزات ─── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="grid grid-cols-2 gap-3 flex-1 content-start"
          >
            {FEATURES.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.5 + i * 0.08 }}
                className={`rounded-xl bg-gradient-to-br ${f.color} border p-3 backdrop-blur-sm`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0`}>
                    <f.icon className={`h-4 w-4 ${f.iconColor}`} />
                  </div>
                  <h3 className="text-sm font-bold text-white">{f.title}</h3>
                </div>
                <p className="text-[11px] text-white/50 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* ─── شريط الماركي الصاخب (يتوقف عند التحويم) ─── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="mt-6 mb-4 rounded-full bg-white/[0.04] border border-white/[0.08]"
          >
            <MarqueeBand />
          </motion.div>

          {/* ─── Footer تعريفي ─── */}
          <div className="pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-white/40">
            <ShieldCheck className="h-4 w-4 text-pink-400/60" />
            <span>منصة موقّعة رقمياً — بياناتك محمية بأحدث معايير الأمان</span>
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════
          ★ القسم الأيسر (RTL) — نموذج الدخول
          ═════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 relative">
        {/* خلفية متدرجة للجوال */}
        <div className="absolute inset-0 lg:hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0d0b10] via-[#170d13] to-[#0d0b10]" />
          <div className="aurora-blob absolute top-[-10%] right-[-5%] w-72 h-72 rounded-full bg-[#e04fa4]/15 blur-3xl" />
          <div className="aurora-blob-delayed absolute bottom-[-10%] left-[-5%] w-72 h-72 rounded-full bg-fuchsia-600/15 blur-3xl" />
        </div>

        {/* نموذج الدخول */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-[420px]"
        >
          <div className="bg-white/[0.07] backdrop-blur-2xl rounded-[2rem] border border-white/[0.12] shadow-2xl overflow-hidden">
            <div className="h-1.5 bg-gradient-to-l from-[#e04fa4] via-[#d6336c] to-[#bef264]" />

            <div className="p-7 sm:p-10">
              {/* شعار للجوال */}
              <div className="lg:hidden text-center mb-6">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-white/5 border border-white/10 mb-3 overflow-hidden shadow-lg">
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
                  Aqua<span className="text-[#e04fa4]">Core</span> Club Manager
                </h1>
                <p className="text-xs text-pink-400/80 mt-0.5">منظومة إدارة النوادي الرياضية</p>
              </div>

              {/* عنوان الدخول */}
              <div className="hidden lg:block mb-6">
                <h2 className="text-xl font-extrabold text-white mb-1">تسجيل الدخول</h2>
                <p className="text-sm text-white/50">أدخل بياناتك للوصول إلى لوحة الإدارة</p>
              </div>

              {/* النموذج */}
              <form onSubmit={handleLogin} className="space-y-4">
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

                <div className="space-y-1.5">
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
                      className="h-12 pr-10 pl-4 bg-white/[0.06] border-white/[0.12] text-white placeholder:text-white/25 rounded-2xl focus:bg-white/[0.1] focus:border-[#e04fa4]/60 transition"
                      required
                      autoComplete="email"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
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
                      className="h-12 pr-10 pl-10 bg-white/[0.06] border-white/[0.12] text-white placeholder:text-white/25 rounded-2xl focus:bg-white/[0.1] focus:border-[#e04fa4]/60 transition"
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
                  className="hue-morph w-full h-12 text-base font-bold border-0"
                >
                  {loading ? (
                    <><Loader2 className="h-5 w-5 animate-spin" /> جاري الدخول...</>
                  ) : (
                    <><LogIn className="h-5 w-5 ml-1" /> تسجيل الدخول</>
                  )}
                </Button>
              </form>

              {/* فاصل */}
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-white/30">أو</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* أزرار الإجراءات */}
              <div className="grid grid-cols-2 gap-3">
                <a
                  href="/register-club"
                  className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-pink-400/40 transition group glow-hover"
                >
                  <Building2 className="h-5 w-5 text-pink-400/70 group-hover:text-pink-400 transition" />
                  <span className="text-xs font-semibold text-white/70 group-hover:text-white transition">تسجيل نادٍ جديد</span>
                </a>
                <a
                  href="/pin"
                  className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-yellow-300/40 transition group glow-hover"
                >
                  <KeyRound className="h-5 w-5 text-yellow-300/70 group-hover:text-yellow-300 transition" />
                  <span className="text-xs font-semibold text-white/70 group-hover:text-white transition">دخول الكاشير</span>
                </a>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-white/30 mt-5">
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
        <div className="min-h-screen flex items-center justify-center bg-[#0d0b10]">
          <Loader2 className="h-8 w-8 animate-spin text-[#e04fa4]" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

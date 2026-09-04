"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Building2, User, Mail, Phone, Lock, Loader2, CheckCircle2, ArrowRight,
  Waves, MapPin, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function RegisterClubPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    clubName: "", city: "", country: "الجزائر",
    managerName: "", phone: "", email: "",
    username: "", password: "", confirmPassword: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    if (form.password.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/clubs/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل التسجيل");
      setSuccess(true);
      toast.success("تم استلام طلب التسجيل بنجاح");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-teal-950 to-slate-950" />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative bg-white/[0.07] backdrop-blur-2xl rounded-[2rem] border border-white/[0.12] shadow-2xl p-8 max-w-md w-full text-center overflow-hidden"
        >
          <div className="h-1 bg-gradient-to-l from-teal-400 via-sky-400 to-indigo-400 absolute top-0 left-0 right-0" />
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/20 mb-4 mt-4">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          </div>
          <h2 className="text-xl font-extrabold text-white mb-2">تم استلام طلبك بنجاح</h2>
          <p className="text-sm text-white/50 mb-6 leading-relaxed">
            سيتم مراجعة طلب تسجيل النادي من قبل الإدارة.
            <br />سيتم تفعيل الحساب بعد الموافقة.
            <br />لا يمكن تسجيل الدخول قبل الموافقة.
          </p>
          <Button
            onClick={() => router.push("/login")}
            className="w-full h-12 rounded-xl bg-gradient-to-l from-teal-500 to-sky-500 hover:from-teal-400 hover:to-sky-400 border-0 text-white font-bold shadow-lg shadow-teal-500/20"
          >
            <ArrowRight className="h-5 w-5 ml-1" /> العودة لتسجيل الدخول
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-950">
      {/* Background — same as login */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-teal-950 to-slate-950" />
        <motion.div
          className="absolute top-[-10%] right-[-5%] w-96 h-96 rounded-full bg-teal-500/20 blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[-10%] left-[-5%] w-96 h-96 rounded-full bg-sky-500/20 blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.5, 0.3, 0.5] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[520px] max-h-[95vh] overflow-y-auto"
      >
        <div className="bg-white/[0.07] backdrop-blur-2xl rounded-[2rem] border border-white/[0.12] shadow-2xl overflow-hidden">
          <div className="h-1 bg-gradient-to-l from-teal-400 via-sky-400 to-indigo-400" />

          <div className="p-8 sm:p-10">
            {/* Title */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center h-24 w-24 rounded-2xl bg-white/5 border border-white/10 mb-4 overflow-hidden shadow-lg">
                <img
                  src="/images/aquacore-logo.png"
                  alt="AquaCore"
                  className="h-full w-full object-contain p-1"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              <h1 className="text-xl font-extrabold text-white tracking-tight">تسجيل نادٍ جديد</h1>
              <p className="text-sm text-teal-400/80 mt-1 font-medium">املأ الاستمارة — سيتم مراجعة طلبك</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Club info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="h-3 w-3" /> اسم النادي *
                  </Label>
                  <Input
                    value={form.clubName}
                    onChange={(e) => setForm({ ...form, clubName: e.target.value })}
                    className="h-12 bg-white/[0.06] border-white/[0.12] text-white placeholder:text-white/25 rounded-xl focus:bg-white/[0.1] focus:border-teal-400/40 transition"
                    placeholder="نادي الرائد"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="h-3 w-3" /> المدينة *
                  </Label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="h-12 bg-white/[0.06] border-white/[0.12] text-white placeholder:text-white/25 rounded-xl focus:bg-white/[0.1] focus:border-teal-400/40 transition"
                    placeholder="سعيدة"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="h-3 w-3" /> الدولة
                </Label>
                <Input
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="h-12 bg-white/[0.06] border-white/[0.12] text-white placeholder:text-white/25 rounded-xl focus:bg-white/[0.1] focus:border-teal-400/40 transition"
                  placeholder="الجزائر"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="h-3 w-3" /> اسم المسؤول *
                  </Label>
                  <Input
                    value={form.managerName}
                    onChange={(e) => setForm({ ...form, managerName: e.target.value })}
                    className="h-12 bg-white/[0.06] border-white/[0.12] text-white placeholder:text-white/25 rounded-xl focus:bg-white/[0.1] focus:border-teal-400/40 transition"
                    placeholder="محمد الأمين"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
                    <Phone className="h-3 w-3" /> رقم الهاتف *
                  </Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="h-12 bg-white/[0.06] border-white/[0.12] text-white placeholder:text-white/25 rounded-xl focus:bg-white/[0.1] focus:border-teal-400/40 transition"
                    dir="ltr"
                    placeholder="0550000000"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="h-3 w-3" /> البريد الإلكتروني *
                </Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="h-12 bg-white/[0.06] border-white/[0.12] text-white placeholder:text-white/25 rounded-xl focus:bg-white/[0.1] focus:border-teal-400/40 transition"
                  dir="ltr"
                  placeholder="club@email.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="h-3 w-3" /> اسم المستخدم *
                </Label>
                <Input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="h-12 bg-white/[0.06] border-white/[0.12] text-white placeholder:text-white/25 rounded-xl focus:bg-white/[0.1] focus:border-teal-400/40 transition"
                  dir="ltr"
                  placeholder="manager"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="h-3 w-3" /> كلمة المرور *
                  </Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="h-12 bg-white/[0.06] border-white/[0.12] text-white placeholder:text-white/25 rounded-xl focus:bg-white/[0.1] focus:border-teal-400/40 transition"
                    dir="ltr"
                    placeholder="6 أحرف على الأقل"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="h-3 w-3" /> تأكيد كلمة المرور *
                  </Label>
                  <Input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    className="h-12 bg-white/[0.06] border-white/[0.12] text-white placeholder:text-white/25 rounded-xl focus:bg-white/[0.1] focus:border-teal-400/40 transition"
                    dir="ltr"
                    placeholder="••••••"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/login")}
                  className="flex-1 h-12 rounded-xl bg-white/[0.04] border-white/[0.12] text-white/70 hover:bg-white/[0.08] hover:text-white"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-12 rounded-xl bg-gradient-to-l from-teal-500 to-sky-500 hover:from-teal-400 hover:to-sky-400 border-0 text-white font-bold shadow-lg shadow-teal-500/20"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "إرسال طلب التسجيل"}
                </Button>
              </div>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-white/30 mt-6">
          © 2026 AquaCore Club Manager — جميع الحقوق محفوظة
        </p>
      </motion.div>
    </div>
  );
}

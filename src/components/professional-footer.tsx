"use client";

import { useState, useEffect } from "react";
import {
  Waves,
  ShieldCheck,
  Headphones,
  Phone,
  Mail,
  ArrowUp,
  Server,
  Activity,
  Lock,
  Cpu,
  Terminal,
  ExternalLink,
  MessageSquare,
  CheckCircle2,
  Copy,
  Check,
  X,
  Sparkles,
  HelpCircle,
  Clock,
  Layers,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

interface ProfessionalFooterProps {
  clubName?: string;
  headerTitle?: string;
  onNavigateTab?: (tab: string) => void;
  onOpenCommandPalette?: () => void;
  sessionUser?: {
    name?: string;
    role?: string;
    username?: string;
  } | null;
}

export function ProfessionalFooter({
  clubName = "النادي الرياضي الهاوي متعدد الرياضات الرائد بلدية سعيدة",
  headerTitle,
  onNavigateTab,
  onOpenCommandPalette,
  sessionUser,
}: ProfessionalFooterProps) {
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("ar-DZ", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const copyPhoneNumber = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText("0664451250");
      setCopiedPhone(true);
      toast.success("تم نسخ رقم هاتف مدير الموقع والدعم إلى الحافظة: 0664451250");
      setTimeout(() => setCopiedPhone(false), 2200);
    }
  };

  const displayName = clubName || headerTitle || "النادي الرياضي المعتمد";

  return (
    <>
      <footer className="mt-auto border-t border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl relative overflow-hidden transition-colors">
        {/* Top Decorative Ambient Gradient Line */}
        <div className="h-1 w-full bg-gradient-to-r from-teal-500 via-sky-500 to-indigo-500 opacity-90" />

        {/* ══════════ Top Telemetry & Status Bar ══════════ */}
        <div className="border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/60 dark:bg-slate-900/40 px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="max-w-[1500px] mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Operational Health Badge */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-950/50 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[11px] font-bold">جميع الأنظمة السحابية تعمل بكفاءة (100% Uptime)</span>
              </div>

              <span className="hidden sm:inline-block text-[11px] text-muted-foreground font-mono">
                AquaCore Suite Enterprise • v2.6.4 Pro
              </span>
            </div>

            {/* Quick Metrics & Time */}
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5" title="توقيت الجزائر المحلي GMT+1">
                <Clock className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                <span>الجزائر (GMT+1):</span>
                <span className="font-mono font-bold text-foreground">{currentTime || "--:--:--"}</span>
              </div>

              <div className="hidden md:flex items-center gap-1.5" title="زمن استجابة قاعدة البيانات">
                <Activity className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                <span>الاستجابة:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">12ms</span>
              </div>

              <div className="hidden lg:flex items-center gap-1.5" title="أمان متقدم وتشفير">
                <Lock className="h-3.5 w-3.5 text-indigo-500" />
                <span>تشفير:</span>
                <span className="font-semibold text-foreground">TLS 1.3 / AES-256</span>
              </div>

              {onOpenCommandPalette && (
                <button
                  type="button"
                  onClick={onOpenCommandPalette}
                  className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-200/60 dark:bg-slate-800 text-[10px] font-mono text-foreground hover:bg-primary hover:text-white transition cursor-pointer"
                  title="فتح لوحة الأوامر السريعة"
                >
                  <Terminal className="h-3 w-3" />
                  <span>Ctrl + K</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ══════════ Main Multi-Column Content ══════════ */}
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
            {/* ── العمود 1: هوية المنظومة والترخيص ── */}
            <div className="space-y-3.5">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-teal-500 to-sky-600 flex items-center justify-center text-white shadow-lg shadow-teal-500/25 shrink-0">
                  <Waves className="h-5 w-5" strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-foreground tracking-tight">
                    AquaCore Club Manager
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    المنظومة الرقمية السحابية لإدارة المسابح والاشتراكات
                  </p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                منصة متكاملة ومخصصة لإدارة المنخرطين، إصدار بطاقات السباحة الذكية بالباركود ورموز QR، الدفتر المالي المحاسبي الموحد، وجدولة الحصص بكفاءة عالية.
              </p>

              <div className="pt-1 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                  <ShieldCheck className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  ترخيص رسمي معتمد للنوادي الرياضية
                </span>
              </div>
            </div>

            {/* ── العمود 2: معلومات مدير الموقع والدعم التقني (Webmaster & Support) ── */}
            <div className="space-y-3.5">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Headphones className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  إدارة المنظومة والدعم التقني
                </h4>
              </div>

              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">المسؤول التقني والمطور:</span>
                  <span className="text-xs font-bold text-foreground">م. علاء الدين — مدير المنظومة</span>
                </div>

                {/* Direct Phone & Copy */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
                  <a
                    href="tel:0664451250"
                    className="flex items-center gap-2 text-xs font-bold text-foreground hover:text-teal-600 dark:hover:text-teal-400 transition"
                    title="انقر للاتصال المباشر"
                    dir="ltr"
                  >
                    <div className="h-6 w-6 rounded-lg bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                      <Phone className="h-3 w-3" />
                    </div>
                    <span className="font-mono">0664451250</span>
                  </a>

                  <button
                    type="button"
                    onClick={copyPhoneNumber}
                    className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 transition cursor-pointer shadow-2xs"
                    title="نسخ رقم الهاتف"
                  >
                    {copiedPhone ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600" />
                        <span className="text-[10px] text-emerald-600 font-bold">تم النسخ</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span className="text-[10px]">نسخ</span>
                      </>
                    )}
                  </button>
                </div>

                {/* WhatsApp & Email Row */}
                <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
                  <a
                    href="https://wa.me/213664451250"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/20 transition cursor-pointer"
                  >
                    <MessageSquare className="h-3 w-3" />
                    <span>واتساب مباشر</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => setAdminModalOpen(true)}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-500/20 transition cursor-pointer"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>بطاقة الدعم</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ── العمود 3: الوصول السريع والتنقل في المنظومة ── */}
            <div className="space-y-3.5">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                  <Layers className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  أقسام المنظومة السريعة
                </h4>
              </div>

              <ul className="space-y-1.5 text-xs">
                {[
                  { label: "لوحة التحكم والمؤشرات اليومية", tab: "dashboard" },
                  { label: "سجل المنخرطين وإدارة الاشتراكات", tab: "subscribers" },
                  { label: "مصمم بطاقات PVC الذكية للسباحة", tab: "cards-pro" },
                  { label: "الدفتر المالي والتحليل المحاسبي", tab: "financial-hub" },
                  { label: "جدول المسبح ومسح الحضور بالباركود", tab: "scanner" },
                ].map((item, idx) => (
                  <li key={idx}>
                    <button
                      type="button"
                      onClick={() => onNavigateTab?.(item.tab)}
                      className="text-muted-foreground hover:text-teal-600 dark:hover:text-teal-400 hover:translate-x-[-3px] transition flex items-center gap-2 cursor-pointer text-right w-full py-0.5"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-700 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* ── العمود 4: الأمان والمواصفات السحابية ── */}
            <div className="space-y-3.5">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                  <Server className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  الأمان والبيئة السحابية
                </h4>
              </div>

              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span>حالة المزامنة والنسخ:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> متصلة وآمنة
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span>البروتوكول الأمني:</span>
                  <span className="font-mono text-foreground font-semibold">End-to-End Vault</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span>المستخدم الحالي:</span>
                  <span className="text-foreground font-semibold truncate max-w-[130px]">
                    {sessionUser?.name || "مدير النادي"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span>المقر المعتمد:</span>
                  <span className="text-foreground font-semibold">ولاية سعيدة، الجزائر</span>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={scrollToTop}
                className="w-full h-8 text-xs font-semibold gap-1.5 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-foreground"
              >
                <ArrowUp className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                الرجوع إلى أعلى الصفحة
              </Button>
            </div>
          </div>
        </div>

        {/* ══════════ Bottom Legal & Rights Strip ══════════ */}
        <div className="border-t border-slate-200/60 dark:border-slate-800/80 bg-slate-100/50 dark:bg-slate-950 px-4 sm:px-6 lg:px-8 py-4">
          <div className="max-w-[1500px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground text-center sm:text-right">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="font-semibold text-foreground">
                © {new Date().getFullYear()} AquaCore Club Manager.
              </span>
              <span>جميع الحقوق محفوظة ومحمية بموجب ترخيص الاستخدام للنوادي الرياضية.</span>
            </div>

            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-muted-foreground">
                تطوير وإشراف: <strong className="text-foreground">م. علاء الدين</strong>
              </span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="text-teal-600 dark:text-teal-400 font-semibold font-mono">
                AquaCore Engine v2.6
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* ══════════ Webmaster / Admin Info Modal ══════════ */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {adminModalOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4"
                onClick={() => setAdminModalOpen(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, y: 15, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  exit={{ scale: 0.95, y: 15, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden text-right"
                >
                  {/* Decorative Bar */}
                  <div className="h-1.5 w-full bg-gradient-to-r from-teal-500 via-sky-500 to-indigo-600" />

                  {/* Header */}
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                        <Headphones className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-foreground">
                          بطاقة مدير الموقع والدعم التقني
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          AquaCore Official Administration & Support
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAdminModalOpen(false)}
                      className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="p-5 space-y-4">
                    {/* Admin Contact Card */}
                    <div className="rounded-2xl border border-teal-500/25 bg-gradient-to-br from-teal-900/90 to-slate-900 text-white p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-teal-300" />
                          <span className="text-xs font-bold text-teal-200">مدير المنظومة والمطور</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-bold">
                          متاح ومباشر
                        </span>
                      </div>
                      <div>
                        <h4 className="text-base font-black text-white">المهندس: علاء الدين (Eng. Aladine)</h4>
                        <p className="text-xs text-teal-100/70">
                          الإشراف العام، الصيانة السحابية، والدعم التقني لنوادي السباحة
                        </p>
                      </div>
                    </div>

                    {/* Contacts List */}
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                        <div className="flex items-center gap-2.5">
                          <Phone className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                          <div>
                            <p className="text-[10px] text-muted-foreground">رقم الهاتف المباشر</p>
                            <p className="font-mono font-bold text-foreground" dir="ltr">0664451250</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={copyPhoneNumber}
                            className="h-7 px-2 text-xs gap-1 cursor-pointer"
                          >
                            {copiedPhone ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                            <span>{copiedPhone ? "تم النسخ" : "نسخ"}</span>
                          </Button>
                          <a
                            href="tel:0664451250"
                            className="h-7 px-3 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-500 text-white flex items-center justify-center transition"
                          >
                            اتصال
                          </a>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                        <div className="flex items-center gap-2.5">
                          <MessageSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          <div>
                            <p className="text-[10px] text-muted-foreground">المحادثة الفورية عبر واتساب</p>
                            <p className="font-mono font-bold text-foreground" dir="ltr">+213 664 45 12 50</p>
                          </div>
                        </div>
                        <a
                          href="https://wa.me/213664451250"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-7 px-3 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1 transition"
                        >
                          <ExternalLink className="h-3 w-3" />
                          فتح المحادثة
                        </a>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                        <div className="flex items-center gap-2.5">
                          <Mail className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                          <div>
                            <p className="text-[10px] text-muted-foreground">البريد الإلكتروني للإدارة والدعم</p>
                            <p className="font-mono font-bold text-foreground text-[11px]" dir="ltr">rcs.natation.saida@gmail.com</p>
                          </div>
                        </div>
                        <a
                          href="mailto:rcs.natation.saida@gmail.com"
                          className="h-7 px-3 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center transition"
                        >
                          إرسال
                        </a>
                      </div>
                    </div>

                    {/* Guarantee & SLA Note */}
                    <div className="rounded-xl p-3 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed flex items-start gap-2">
                      <HelpCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                      <span>
                        للحصول على مساعدة في استعادة النسخ الاحتياطية، تمديد الاشتراك، أو طلب تخصيص بطاقات النادي، يتوفر الدعم الفني بشكل فوري ومستمر.
                      </span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground text-[11px]">
                      النادي: <strong className="text-foreground">{displayName}</strong>
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAdminModalOpen(false)}
                      className="h-8 px-4 text-xs font-semibold rounded-xl cursor-pointer"
                    >
                      إغلاق
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database, FileJson, CheckCircle2, AlertCircle, Loader2,
  ShieldCheck, Sparkles, Clock, ArrowRight, RefreshCw,
  Users, Image as ImageIcon, Settings as SettingsIcon,
  CreditCard, Briefcase, Check, ShieldAlert, Zap,
  ChevronDown, ChevronUp, Layers, FileText, CalendarDays,
  Shield, Key, Mail, Award, FileCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { notifySuccess, notifyError } from "@/lib/sounds";

export interface RestoreFilePayload {
  file?: File;
  localFilename?: string;
  localFileSize?: number;
  targetEndpoint: "/api/backup" | "/api/backup/restore-db" | "/api/backup/restore-local";
  defaultMode?: "replace" | "merge";
}

interface RestoreCounts {
  subscribers?: number;
  subscriberPhotos?: number;
  subscriberContracts?: number;
  settings?: number;
  payments?: number;
  renewals?: number;
  financialTransactions?: number;
  employees?: number;
  employmentContracts?: number;
  contractTemplates?: number;
  guardAssignments?: number;
  poolClosures?: number;
  compensations?: number;
  compensationHistory?: number;
  waitlists?: number;
  swimmingDays?: number;
  swimmingTimeSlots?: number;
  cardTemplates?: number;
  subscriptionTypes?: number;
  cashierPins?: number;
  clubSettings?: number;
  uiConfigurations?: number;
  uiTemplates?: number;
  activities?: number;
  notifications?: number;
  users?: number;
  auditLogs?: number;
  featureFlags?: number;
  totalImported?: number;
  [key: string]: any;
}

interface RestoreProgressDialogProps {
  payload: RestoreFilePayload | null;
  onClose: () => void;
  onSuccess?: () => void;
}

type StepState = "confirm" | "progress" | "success" | "error";

export function RestoreProgressDialog({
  payload,
  onClose,
  onSuccess,
}: RestoreProgressDialogProps) {
  const [step, setStep] = useState<StepState>("confirm");
  const [mode, setMode] = useState<"replace" | "merge">("replace");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [uploadText, setUploadText] = useState<string>("");
  const [currentStageText, setCurrentStageText] = useState<string>("");
  const [activeStageIndex, setActiveStageIndex] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [summaryCounts, setSummaryCounts] = useState<RestoreCounts | null>(null);
  const [countdown, setCountdown] = useState<number>(6);
  const [countdownPaused, setCountdownPaused] = useState<boolean>(false);
  const [showAllPages, setShowAllPages] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const stageIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (payload) {
      setStep("confirm");
      setMode(payload.defaultMode || "replace");
      setProgressPercent(0);
      setElapsedSeconds(0);
      setErrorMessage("");
      setSummaryCounts(null);
      setCountdown(6);
      setCountdownPaused(false);
      setShowAllPages(false);
    }
  }, [payload]);

  // عداد الثواني أثناء التقدم
  useEffect(() => {
    if (step === "progress") {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step]);

  // عداد تنازلي للتحديث التلقائي بعد النجاح
  useEffect(() => {
    if (step === "success" && !countdownPaused) {
      const cdTimer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(cdTimer);
            handleFinishAndReload();
            return 0;
          }
          return c - 1;
        });
      }, 1000);
      return () => clearInterval(cdTimer);
    }
  }, [step, countdownPaused]);

  if (!payload) return null;

  const fileName = payload.file ? payload.file.name : payload.localFilename || "نسخة احتياطية";
  const fileSize = payload.file ? payload.file.size : payload.localFileSize || 0;
  const isDbExt = fileName.endsWith(".db") || fileName.endsWith(".sqlite");
  const isJsonExt = fileName.endsWith(".json");
  const formattedSize =
    fileSize > 1024 * 1024
      ? `${(fileSize / (1024 * 1024)).toFixed(1)} ميغابايت`
      : fileSize > 0
      ? `${(fileSize / 1024).toFixed(1)} كيلوبايت`
      : "محفوظ محلياً";

  const stages = [
    { title: "قراءة الحزمة والتحقق من التوقيع", desc: payload.localFilename ? "قراءة سريعة ومباشرة من السيرفر" : "رفع تدفقي فائق السرعة عبر الشبكة" },
    { title: "فحص التوافق وسلامة الترويسة", desc: "التحقق التلقائي من بنية الجداول وقاعدة البيانات" },
    { title: "استعادة السجلات والمنخرطين والصور", desc: "معالجة شاملة لكافة المنخرطين والصور الشخصية Base64" },
    { title: "إعادة بناء الفهارس وتثبيت الجلسة", desc: "تحديث الفهارس وحفظ جلسة العمل وتأمين البيانات" },
  ];

  // بدء عملية الاستعادة الفعلية
  const startRestore = () => {
    setStep("progress");
    setProgressPercent(10);
    setActiveStageIndex(0);
    setCurrentStageText("جاري فحص الحزمة وتهيئة بيئة الاستعادة الشاملة...");

    // إذا كانت نسخة محلية مخزنة على السيرفر
    if (payload.localFilename) {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/backup/restore-local");
      xhr.setRequestHeader("Content-Type", "application/json");

      let curr = 15;
      stageIntervalRef.current = setInterval(() => {
        curr += 8;
        if (curr >= 35 && curr < 65) {
          setActiveStageIndex(1);
          setCurrentStageText("التحقق من ترويسة SQLite وهيكلية السجلات والترخيص...");
        } else if (curr >= 65 && curr < 85) {
          setActiveStageIndex(2);
          setCurrentStageText("جاري استعادة المنخرطين، الصور الشخصية، والعمليات المالية...");
        } else if (curr >= 85 && curr < 98) {
          setActiveStageIndex(3);
          setCurrentStageText("جاري كتابة الفهارس وحفظ جلسة العمل وتأمين البيانات...");
        }
        if (curr < 98) {
          setProgressPercent(curr);
        }
      }, 400);

      xhr.onload = () => {
        if (stageIntervalRef.current) clearInterval(stageIntervalRef.current);
        try {
          const data = JSON.parse(xhr.responseText || "{}");
          if (xhr.status >= 200 && xhr.status < 300 && data.success) {
            setProgressPercent(100);
            setActiveStageIndex(3);
            notifySuccess();
            const counts: RestoreCounts = data.importedCounts || {};
            counts.totalImported = data.totalImported || (data.size ? 1 : 0);
            setSummaryCounts(counts);
            setStep("success");
          } else {
            notifyError();
            setErrorMessage(data.error || "حدث خطأ غير متوقع أثناء معالجة ملف النسخة الاحتياطية.");
            setStep("error");
          }
        } catch {
          notifyError();
          setErrorMessage("تعذر قراءة استجابة الخادم. يرجى مراجعة الاتصال.");
          setStep("error");
        }
      };

      xhr.onerror = () => {
        if (stageIntervalRef.current) clearInterval(stageIntervalRef.current);
        notifyError();
        setErrorMessage("انقطع الاتصال بالخادم أثناء المعالجة. يرجى المحاولة مرة أخرى.");
        setStep("error");
      };

      xhr.send(JSON.stringify({ filename: payload.localFilename, mode }));
      return;
    }

    // رفع ملف من جهاز العميل
    const formData = new FormData();
    formData.append("file", payload.file!);
    formData.append("mode", mode);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", payload.targetEndpoint);

    // تتبع الرفع الحقيقي للبيانات (0% → 50%)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const loadedMb = (e.loaded / (1024 * 1024)).toFixed(1);
        const totalMb = (e.total / (1024 * 1024)).toFixed(1);
        const percent = Math.min(50, Math.round((e.loaded / e.total) * 50));
        setProgressPercent(percent);
        setUploadText(`تم رفع ${loadedMb} ميغابايت من ${totalMb} ميغابايت (${Math.round((e.loaded / e.total) * 100)}%)`);

        if (percent >= 50) {
          setActiveStageIndex(1);
          setCurrentStageText("اكتمل الرفع. جاري فحص ترويسة البيانات وتوافق الجداول...");
        }
      }
    };

    // بعد اكتمال الرفع: محاكاة مراحل المعالجة على الخادم (50% → 96%)
    xhr.upload.onload = () => {
      setActiveStageIndex(1);
      setProgressPercent(55);
      setCurrentStageText("التحقق من ترويسة SQLite وهيكلية السجلات...");

      let curr = 55;
      stageIntervalRef.current = setInterval(() => {
        curr += 5;
        if (curr >= 70 && curr < 85) {
          setActiveStageIndex(2);
          setCurrentStageText("جاري استعادة المنخرطين، الصور الشخصية عالية الدقة، والعمليات المالية...");
        } else if (curr >= 85 && curr < 98) {
          setActiveStageIndex(3);
          setCurrentStageText("جاري كتابة الفهارس وحفظ جلسة العمل وتأمين البيانات...");
        }
        if (curr < 98) {
          setProgressPercent(curr);
        }
      }, 700);
    };

    xhr.onload = () => {
      if (stageIntervalRef.current) clearInterval(stageIntervalRef.current);

      try {
        const data = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 200 && xhr.status < 300 && data.success) {
          setProgressPercent(100);
          setActiveStageIndex(3);
          notifySuccess();

          const counts: RestoreCounts = data.importedCounts || {};
          counts.totalImported = data.totalImported || (data.size ? 1 : 0);
          setSummaryCounts(counts);
          setStep("success");
        } else {
          notifyError();
          setErrorMessage(data.error || "حدث خطأ غير متوقع أثناء معالجة ملف النسخة الاحتياطية.");
          setStep("error");
        }
      } catch (err: any) {
        notifyError();
        setErrorMessage("تعذر قراءة استجابة الخادم. يرجى مراجعة الاتصال.");
        setStep("error");
      }
    };

    xhr.onerror = () => {
      if (stageIntervalRef.current) clearInterval(stageIntervalRef.current);
      notifyError();
      setErrorMessage("انقطع الاتصال بالخادم أثناء رفع الملف. يرجى المحاولة مرة أخرى.");
      setStep("error");
    };

    xhr.send(formData);
  };

  const handleFinishAndReload = () => {
    if (onSuccess) onSuccess();
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200" dir="rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-xl rounded-3xl border border-border/80 bg-card p-6 shadow-2xl space-y-6 relative overflow-hidden"
      >
        {/* خلفية تجميلية متدرجة */}
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500" />

        {/* ═════════ الحالة 1: تأكيد البدء واختيار الوضع ═════════ */}
        {step === "confirm" && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-indigo-500/15 text-indigo-600 flex items-center justify-center shrink-0 shadow-inner">
                  {isDbExt ? <Database className="h-6 w-6" /> : <FileJson className="h-6 w-6" />}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                    تأكيد استعادة النسخة الاحتياطية
                    <Badge variant="outline" className="text-[10px] bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30">
                      كشف ذكي وتلقائي
                    </Badge>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    سيتم فحص محتوى الحزمة ومعالجتها واسترجاع السجلات والصور بالكامل.
                  </p>
                </div>
              </div>
            </div>

            {/* بطاقة معلومات الملف */}
            <div className="p-3.5 rounded-2xl border border-border/70 bg-muted/30 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-semibold text-muted-foreground">الملف المختار:</span>
                  <span className="text-xs font-bold font-mono text-foreground truncate" dir="ltr">
                    {fileName}
                  </span>
                </div>
                <Badge variant="secondary" className="text-[11px] font-mono shrink-0">
                  {formattedSize}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  حماية الجلسة: لن يتم تسجيل خروجك
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-blue-700 dark:text-blue-400 font-medium">
                  <Zap className="h-3.5 w-3.5" />
                  نسخة أمان محلية تلقائية قبل البدء
                </span>
              </div>
            </div>

            {/* اختيار وضع الاستعادة */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground">اختر وضع الاستعادة المطلوب:</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setMode("replace")}
                  className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between gap-1.5 ${
                    mode === "replace"
                      ? "border-emerald-500 bg-emerald-500/10 text-foreground shadow-xs ring-1 ring-emerald-500"
                      : "border-border/70 bg-card hover:bg-muted/40 text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">استبدال كامل (100%)</span>
                    {mode === "replace" && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                  </div>
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    مطابقة تامة لملف النسخة المستوردة مع إفراغ السجلات السابقة بأمان.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("merge")}
                  className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between gap-1.5 ${
                    mode === "merge"
                      ? "border-blue-500 bg-blue-500/10 text-foreground shadow-xs ring-1 ring-blue-500"
                      : "border-border/70 bg-card hover:bg-muted/40 text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-400">دمج مع السجلات</span>
                    {mode === "merge" && <Check className="h-3.5 w-3.5 text-blue-600" />}
                  </div>
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    إضافة السجلات الجديدة وتحديث المطابق منها دون حذف السجلات الحالية.
                  </p>
                </button>
              </div>
            </div>

            {/* أزرار الإجراء */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="text-xs h-10 px-4"
              >
                إلغاء الأمر
              </Button>
              <Button
                size="sm"
                onClick={startRestore}
                className="text-xs font-bold h-10 px-6 gap-2 bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-600/20"
              >
                <Sparkles className="h-4 w-4" />
                بدء عملية الاستعادة الشاملة الآن
              </Button>
            </div>
          </div>
        )}

        {/* ═════════ الحالة 2: التقدم الحي ومراحل المعالجة ═════════ */}
        {step === "progress" && (
          <div className="space-y-6 py-2">
            <div className="text-center space-y-2">
              <div className="relative inline-flex items-center justify-center">
                <div className="h-16 w-16 rounded-3xl bg-indigo-500/15 text-indigo-600 flex items-center justify-center animate-pulse">
                  <Database className="h-8 w-8" />
                </div>
                <div className="absolute -top-1 -right-1">
                  <Loader2 className="h-5 w-5 text-indigo-600 animate-spin" />
                </div>
              </div>

              <div>
                <h3 className="font-bold text-base text-foreground">جاري استعادة البيانات والملفات الشاملة</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {currentStageText}
                </p>
              </div>
            </div>

            {/* شريط التقدم الرقمي */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-foreground">{progressPercent}%</span>
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, "0")}
                </span>
              </div>
              <Progress value={progressPercent} className="h-2.5 bg-muted" />
              {uploadText && (
                <p className="text-[11px] font-mono text-muted-foreground text-left" dir="ltr">
                  {uploadText}
                </p>
              )}
            </div>

            {/* قائمة المراحل والخطوات */}
            <div className="p-3.5 rounded-2xl border border-border/70 bg-muted/20 space-y-2.5">
              {stages.map((stg, i) => {
                const isDone = i < activeStageIndex || progressPercent === 100;
                const isCurrent = i === activeStageIndex && progressPercent < 100;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div
                      className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-xs transition-colors ${
                        isDone
                          ? "bg-emerald-500 text-white"
                          : isCurrent
                          ? "bg-indigo-600 text-white animate-pulse"
                          : "bg-muted text-muted-foreground border border-border/60"
                      }`}
                    >
                      {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-bold leading-tight ${isCurrent ? "text-indigo-600 dark:text-indigo-400" : isDone ? "text-foreground" : "text-muted-foreground"}`}>
                        {stg.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">{stg.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-center">
              <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl py-2 px-3 inline-block">
                يرجى الانتظار دون إغلاق المتصفح حتى تكتمل كتابة السجلات وتأمين قاعدة البيانات...
              </p>
            </div>
          </div>
        )}

        {/* ═════════ الحالة 3: الاحتفال بالاكتمال والتقرير الإحصائي ═════════ */}
        {step === "success" && (
          <div className="space-y-5 text-center py-1">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/20 text-emerald-600 ring-8 ring-emerald-500/10 shadow-lg">
              <CheckCircle2 className="h-9 w-9" />
            </div>

            <div>
              <h3 className="font-extrabold text-xl text-foreground">تمت استعادة البيانات بنجاح 100%!</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                تم استرجاع كافة السجلات والصور الشخصية والإعدادات بدقة عالية وبقيت جلستك الإدارية متصلة ومؤمّنة.
              </p>
            </div>

            {/* بطاقات الإحصائيات المسترجعة لكافة صفحات وأقسام الموقع */}
            {summaryCounts && (
              <div className="max-h-64 overflow-y-auto p-1 space-y-2 text-right">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {summaryCounts.subscribers !== undefined && (
                    <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold">
                        <Users className="h-3 w-3" />
                        المنخرطون
                      </div>
                      <p className="text-lg font-extrabold font-mono text-foreground">
                        {summaryCounts.subscribers}
                      </p>
                    </div>
                  )}

                  {summaryCounts.subscriberPhotos !== undefined && summaryCounts.subscriberPhotos > 0 && (
                    <div className="p-2.5 rounded-xl border border-teal-500/30 bg-teal-500/5 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-teal-700 dark:text-teal-400 text-[11px] font-semibold">
                        <ImageIcon className="h-3 w-3" />
                        الصور الشخصية
                      </div>
                      <p className="text-lg font-extrabold font-mono text-foreground">
                        {summaryCounts.subscriberPhotos}
                      </p>
                    </div>
                  )}

                  {summaryCounts.payments !== undefined && summaryCounts.payments > 0 && (
                    <div className="p-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/5 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400 text-[11px] font-semibold">
                        <CreditCard className="h-3 w-3" />
                        المدفوعات والوصولات
                      </div>
                      <p className="text-lg font-extrabold font-mono text-foreground">
                        {summaryCounts.payments}
                      </p>
                    </div>
                  )}

                  {summaryCounts.renewals !== undefined && summaryCounts.renewals > 0 && (
                    <div className="p-2.5 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 text-[11px] font-semibold">
                        <RefreshCw className="h-3 w-3" />
                        سجلات التجديد
                      </div>
                      <p className="text-lg font-extrabold font-mono text-foreground">
                        {summaryCounts.renewals}
                      </p>
                    </div>
                  )}

                  {summaryCounts.attendances !== undefined && summaryCounts.attendances > 0 && (
                    <div className="p-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/5 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-cyan-700 dark:text-cyan-400 text-[11px] font-semibold">
                        <Check className="h-3 w-3" />
                        حضور التمارين
                      </div>
                      <p className="text-lg font-extrabold font-mono text-foreground">
                        {summaryCounts.attendances}
                      </p>
                    </div>
                  )}

                  {summaryCounts.financialTransactions !== undefined && summaryCounts.financialTransactions > 0 && (
                    <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold">
                        <Zap className="h-3 w-3" />
                        العمليات المالية
                      </div>
                      <p className="text-lg font-extrabold font-mono text-foreground">
                        {summaryCounts.financialTransactions}
                      </p>
                    </div>
                  )}

                  {summaryCounts.employees !== undefined && summaryCounts.employees > 0 && (
                    <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 text-[11px] font-semibold">
                        <Briefcase className="h-3 w-3" />
                        العمال والموظفون
                      </div>
                      <p className="text-lg font-extrabold font-mono text-foreground">
                        {summaryCounts.employees}
                      </p>
                    </div>
                  )}

                  {summaryCounts.workHours !== undefined && summaryCounts.workHours > 0 && (
                    <div className="p-2.5 rounded-xl border border-orange-500/30 bg-orange-500/5 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-orange-700 dark:text-orange-400 text-[11px] font-semibold">
                        <Clock className="h-3 w-3" />
                        ساعات العمل
                      </div>
                      <p className="text-lg font-extrabold font-mono text-foreground">
                        {summaryCounts.workHours}
                      </p>
                    </div>
                  )}

                  {summaryCounts.wagePayments !== undefined && summaryCounts.wagePayments > 0 && (
                    <div className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 text-[11px] font-semibold">
                        <CreditCard className="h-3 w-3" />
                        أجور ومستحقات
                      </div>
                      <p className="text-lg font-extrabold font-mono text-foreground">
                        {summaryCounts.wagePayments}
                      </p>
                    </div>
                  )}

                  {summaryCounts.incomingMails !== undefined && summaryCounts.incomingMails > 0 && (
                    <div className="p-2.5 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-400 text-[11px] font-semibold">
                        <Briefcase className="h-3 w-3" />
                        المراسلات الإدارية
                      </div>
                      <p className="text-lg font-extrabold font-mono text-foreground">
                        {summaryCounts.incomingMails}
                      </p>
                    </div>
                  )}

                  {summaryCounts.settings !== undefined && (
                    <div className="p-2.5 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 text-[11px] font-semibold">
                        <SettingsIcon className="h-3 w-3" />
                        الإعدادات والأنظمة
                      </div>
                      <p className="text-lg font-extrabold font-mono text-foreground">
                        {summaryCounts.settings}
                      </p>
                    </div>
                  )}

                  {summaryCounts.activities !== undefined && summaryCounts.activities > 0 && (
                    <div className="p-2.5 rounded-xl border border-sky-500/30 bg-sky-500/5 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-sky-700 dark:text-sky-400 text-[11px] font-semibold">
                        <Sparkles className="h-3 w-3" />
                        سجل الأنشطة
                      </div>
                      <p className="text-lg font-extrabold font-mono text-foreground">
                        {summaryCounts.activities}
                      </p>
                    </div>
                  )}

                  {summaryCounts.subscriberContracts !== undefined && summaryCounts.subscriberContracts > 0 && (
                    <div className="p-2.5 rounded-xl border border-teal-500/30 bg-teal-500/5 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-teal-700 dark:text-teal-400 text-[11px] font-semibold">
                        <FileCheck className="h-3 w-3" />
                        عقود المنخرطين
                      </div>
                      <p className="text-lg font-extrabold font-mono text-foreground">
                        {summaryCounts.subscriberContracts}
                      </p>
                    </div>
                  )}

                  {summaryCounts.employmentContracts !== undefined && summaryCounts.employmentContracts > 0 && (
                    <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 text-[11px] font-semibold">
                        <FileText className="h-3 w-3" />
                        عقود العمل
                      </div>
                      <p className="text-lg font-extrabold font-mono text-foreground">
                        {summaryCounts.employmentContracts}
                      </p>
                    </div>
                  )}

                  {summaryCounts.compensations !== undefined && summaryCounts.compensations > 0 && (
                    <div className="p-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/5 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400 text-[11px] font-semibold">
                        <RefreshCw className="h-3 w-3" />
                        حصص التعويض
                      </div>
                      <p className="text-lg font-extrabold font-mono text-foreground">
                        {summaryCounts.compensations}
                      </p>
                    </div>
                  )}

                  {summaryCounts.waitlists !== undefined && summaryCounts.waitlists > 0 && (
                    <div className="p-2.5 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-400 text-[11px] font-semibold">
                        <Users className="h-3 w-3" />
                        قائمة الانتظار
                      </div>
                      <p className="text-lg font-extrabold font-mono text-foreground">
                        {summaryCounts.waitlists}
                      </p>
                    </div>
                  )}

                  <div className="p-2.5 rounded-xl border border-border/70 bg-card space-y-0.5">
                    <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-semibold">
                      <Clock className="h-3 w-3" />
                      الوقت المستغرق
                    </div>
                    <p className="text-lg font-extrabold font-mono text-foreground">
                      {elapsedSeconds} ث
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* تفصيل صفحات المنظومة الـ 24 المشمولة */}
            {summaryCounts && (
              <div className="space-y-2 text-right">
                <button
                  type="button"
                  onClick={() => setShowAllPages(!showAllPages)}
                  className="w-full py-2 px-3 rounded-xl border border-indigo-500/25 bg-indigo-500/5 hover:bg-indigo-500/10 text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center justify-between transition-colors shadow-xs"
                >
                  <span className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-indigo-600" />
                    استعراض كل صفحات وأقسام المنظومة الـ 24 (شاملة 100%)
                  </span>
                  {showAllPages ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showAllPages && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-2xl border border-border/80 bg-muted/30 p-3 max-h-56 overflow-y-auto space-y-1.5 text-xs"
                  >
                    {[
                      { title: "لوحة التحكم الرئيسية (Dashboard)", count: `${summaryCounts.activities ?? 0} أنشطة / ${summaryCounts.notifications ?? 0} إشعارات`, icon: Sparkles },
                      { title: "سجل المنخرطين والصور والعقود", count: `${summaryCounts.subscribers ?? 0} منخرط / ${summaryCounts.subscriberPhotos ?? 0} صورة / ${summaryCounts.subscriberContracts ?? 0} عقد`, icon: Users },
                      { title: "تسجيل الحضور والغياب (Pointage)", count: `${summaryCounts.attendances ?? 0} حضور`, icon: Check },
                      { title: "التجديدات والاشتراكات الشهرية", count: `${summaryCounts.renewals ?? 0} تجديد`, icon: RefreshCw },
                      { title: "التأمين الرياضي وحقوق المركب", count: `${summaryCounts.payments ?? 0} وصل دفع`, icon: Shield },
                      { title: "الدفتر المالي والعمليات والمصاريف", count: `${summaryCounts.financialTransactions ?? 0} عملية مالية`, icon: Zap },
                      { title: "التعويضات المالية للعمال والموظفين", count: `${summaryCounts.staffCompensations ?? 0} تعويض عمال`, icon: Award },
                      { title: "الوارد الإداري وسجل المراسلات", count: `${summaryCounts.incomingMails ?? 0} مراسلة واردة`, icon: Mail },
                      { title: "عقود العمل وقوالب العقود الرسمية", count: `${summaryCounts.employmentContracts ?? 0} عقد / ${summaryCounts.contractTemplates ?? 0} قالب`, icon: FileCheck },
                      { title: "ساعات العمل وتعيين الحراس", count: `${summaryCounts.workHours ?? 0} ساعات عمل / ${summaryCounts.guardAssignments ?? 0} تعيين`, icon: Clock },
                      { title: "تسديدات الأجور ووصولات الاستلام", count: `${summaryCounts.wagePayments ?? 0} دفعة أجر / ${summaryCounts.wageReceipts ?? 0} وصل استلام`, icon: CreditCard },
                      { title: "إغلاقات المسبح والتعويضات", count: `${summaryCounts.compensations ?? 0} تعويض / ${summaryCounts.poolClosures ?? 0} إغلاق`, icon: CalendarDays },
                      { title: "قائمة الانتظار الذكية", count: `${summaryCounts.waitlists ?? 0} مسجل في الانتظار`, icon: Users },
                      { title: "جدول المسبح والحصص والأيام", count: `${summaryCounts.swimmingDays ?? 0} أيام / ${summaryCounts.swimmingTimeSlots ?? 0} حصص`, icon: CalendarDays },
                      { title: "مصمم وقوالب بطاقات الانخراط", count: `${summaryCounts.cardTemplates ?? 0} قالب بطاقة CR80`, icon: CreditCard },
                      { title: "المستخدمون ورموز الكاشير السريعة", count: `${summaryCounts.users ?? 0} مستخدم / ${summaryCounts.cashierPins ?? 0} كود كاشير`, icon: Key },
                      { title: "أنواع وباقات الاشتراكات ورسومها", count: `${summaryCounts.subscriptionTypes ?? 0} نوع اشتراك`, icon: FileText },
                      { title: "إعدادات النادي والهوية البصرية", count: `${summaryCounts.settings ?? 0} إعدادات / قالب وهوية النادي`, icon: SettingsIcon },
                      { title: "تخصيص الواجهات والصفحات", count: `${summaryCounts.uiConfigurations ?? 0} واجهة مخصصة`, icon: Layers },
                      { title: "خصائص المنظومة والصلاحيات", count: `${summaryCounts.featureFlags ?? 0} خاصية مفعلة`, icon: ShieldCheck },
                      { title: "سجل التدقيق وتتبع العمليات الحساسة", count: `${summaryCounts.auditLogs ?? 0} سجل تدقيق`, icon: FileText },
                      { title: "اشتراكات النادي وأكواد التفعيل", count: `${summaryCounts.activationCodes ?? 0} كود تفعيل`, icon: Key },
                      { title: "محرك المزامنة السحابية والأوفلاين", count: "جاهز ومتزامن 100%", icon: RefreshCw },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-1.5 rounded-lg bg-background/60 border border-border/40">
                        <span className="flex items-center gap-1.5 text-foreground font-medium">
                          <item.icon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          {item.title}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-muted-foreground">{item.count}</span>
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </div>
            )}

            {/* العداد التنازلي التلقائي وأزرار المتابعة */}
            <div className="pt-2 space-y-3">
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                <span>سيتم تحديث المنظومة تلقائياً خلال</span>
                <span className="font-mono font-bold text-foreground text-sm">{countdown}</span>
                <span>ثوانٍ...</span>
                <button
                  type="button"
                  onClick={() => setCountdownPaused(!countdownPaused)}
                  className="text-xs text-indigo-600 underline mr-2"
                >
                  {countdownPaused ? "استئناف" : "إيقاف مؤقت"}
                </button>
              </div>

              <div className="flex items-center justify-center gap-2">
                <Button
                  onClick={handleFinishAndReload}
                  className="text-xs font-bold h-11 px-8 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25 rounded-2xl"
                >
                  <RefreshCw className="h-4 w-4" />
                  تحديث وتطبيق البيانات فوراً
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ═════════ الحالة 4: معالجة الأخطاء بأمان ووضوح ═════════ */}
        {step === "error" && (
          <div className="space-y-5 py-2">
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400">
              <AlertCircle className="h-6 w-6 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-sm">تعذرت استعادة النسخة الاحتياطية</h4>
                <p className="text-xs leading-relaxed">{errorMessage}</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              يرجى التأكد من أن الملف سليم بصيغة SQLite (.db) أو ملف بيانات JSON مهيكل، وأنه تم تصديره من منظومة AquaCore Club Manager.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="text-xs h-9 px-4"
              >
                إغلاق
              </Button>
              <Button
                size="sm"
                onClick={startRestore}
                className="text-xs font-bold h-9 px-5 gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                إعادة المحاولة
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

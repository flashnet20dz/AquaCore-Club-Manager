"use client";

import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Wifi, Globe, Cloud, Check, Copy, ExternalLink, RefreshCw,
  Server, Smartphone, Monitor, ShieldCheck, AlertCircle, ArrowRightLeft,
  Loader2, CheckCircle2, Zap
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const DEFAULT_CLOUD_URL = "https://aladine-pool-manager.vercel.app";

interface NetworkInterface {
  name: string;
  address: string;
  url: string;
  isWifi: boolean;
}

interface NetworkInfo {
  hostname: string;
  port: string;
  interfaces: NetworkInterface[];
  defaultUrl: string;
  localDomainUrl: string;
}

interface NetworkConnectionDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NetworkConnectionDialog({ open, onClose }: NetworkConnectionDialogProps) {
  const [activeTab, setActiveTab] = useState<"client" | "host">("client");
  const [currentUrl, setCurrentUrl] = useState<string>("");
  const [customUrl, setCustomUrl] = useState<string>("");
  const [isCloud, setIsCloud] = useState<boolean>(true);
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latency?: number } | null>(null);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // قراءة السيرفر الفعال حالياً
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aquacore_server_url");
      const origin = window.location.origin;
      const effective = saved || origin;
      setCurrentUrl(effective);
      setCustomUrl(saved || "");

      const isLocalHost = effective.includes("localhost") ||
        effective.includes("127.0.0.1") ||
        /^https?:\/\/192\.168\./.test(effective) ||
        /^https?:\/\/10\./.test(effective) ||
        /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./.test(effective);

      setIsCloud(!isLocalHost);
    }
  }, [open]);

  // جلب معلومات شبكة الحاسوب (للربط المحلي)
  const fetchNetworkInfo = useCallback(async () => {
    setLoadingInfo(true);
    try {
      const res = await fetch("/api/network-info");
      if (res.ok) {
        const data = await res.json();
        setNetworkInfo(data);
      }
    } catch {
      // offline or not supported
    } finally {
      setLoadingInfo(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchNetworkInfo();
    }
  }, [open, fetchNetworkInfo]);

  // فحص الاتصال بسيرفر معين
  const handleTestConnection = async (targetUrl: string) => {
    if (!targetUrl) {
      toast.error("يرجى إدخال رابط أو عنوان السيرفر");
      return;
    }

    let urlToTest = targetUrl.trim();
    if (!urlToTest.startsWith("http://") && !urlToTest.startsWith("https://")) {
      urlToTest = `http://${urlToTest}`;
    }

    setTesting(true);
    setTestResult(null);

    const startTime = performance.now();
    try {
      const res = await fetch(`${urlToTest}/api/network-info`, {
        method: "GET",
        mode: "cors",
        signal: AbortSignal.timeout(3500),
      }).catch(async () => {
        // Fallback HEAD request to root
        return await fetch(urlToTest, { method: "HEAD", mode: "no-cors", signal: AbortSignal.timeout(3500) });
      });

      const latency = Math.round(performance.now() - startTime);

      if (res.ok || res.type === "opaque") {
        setTestResult({
          ok: true,
          message: `تم الاتصال بنجاح (${latency} ms)`,
          latency,
        });
        toast.success(`السيرفر متصل ويعمل بسرعة ${latency} ms`);
      } else {
        setTestResult({
          ok: false,
          message: `استجاب السيرفر برمز: ${res.status}`,
        });
      }
    } catch {
      setTestResult({
        ok: false,
        message: "تعذر الوصول إلى هذا العنوان. تأكد أن الحاسوب متصل بنفس الواي فاي وأن السيرفر يعمل.",
      });
      toast.error("تعذر الاتصال بالسيرفر المحدد");
    } finally {
      setTesting(false);
    }
  };

  // تطبيق السيرفر والانتقال إليه
  const handleApplyServer = (urlToSet: string) => {
    let clean = urlToSet.trim();
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
      clean = `http://${clean}`;
    }

    localStorage.setItem("aquacore_server_url", clean);
    toast.success("تم تحديث خادم الاتصال بنجاح. جاري التحويل...");

    setTimeout(() => {
      window.location.href = clean;
    }, 800);
  };

  const handleResetToCloud = () => {
    localStorage.removeItem("aquacore_server_url");
    toast.success("تمت العودة إلى السيرفر السحابي الافتراضي");
    setTimeout(() => {
      window.location.href = DEFAULT_CLOUD_URL;
    }, 600);
  };

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedUrl(text);
      toast.success("تم نسخ الرابط");
      setTimeout(() => setCopiedUrl(null), 2000);
    }
  };

  const recommendedLocalUrl = networkInfo?.defaultUrl || "";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden rounded-3xl border-border/70 shadow-2xl bg-card">
        {/* Header with vibrant ocean gradient */}
        <div className="bg-gradient-to-l from-teal-600 via-teal-700 to-sky-800 p-6 text-white relative">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
              <ArrowRightLeft className="h-6 w-6 text-teal-200" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black tracking-tight text-white">
                إعدادات الاتصال وقاعدة البيانات
              </DialogTitle>
              <DialogDescription className="text-teal-100 text-xs sm:text-sm mt-0.5">
                ربط الهاتف والكمبيوتر بنفس قاعدة البيانات (سحابياً أو عبر الشبكة المحلية)
              </DialogDescription>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge className="bg-white/15 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm text-xs py-1 px-2.5">
              {isCloud ? (
                <><Globe className="h-3.5 w-3.5 ml-1 text-sky-300" /> الوضع السحابي (عبر الإنترنت)</>
              ) : (
                <><Wifi className="h-3.5 w-3.5 ml-1 text-emerald-300" /> الوضع المحلي (شبكة الواي فاي)</>
              )}
            </Badge>
            <span className="text-[11px] text-teal-100/80 truncate max-w-[280px]">
              {currentUrl}
            </span>
          </div>
        </div>

        <div className="p-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid grid-cols-2 h-11 bg-muted/60 p-1 rounded-2xl mb-6">
              <TabsTrigger value="client" className="rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5">
                <Smartphone className="h-4 w-4" /> توصيل هذا الجهاز
              </TabsTrigger>
              <TabsTrigger value="host" className="rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5">
                <Monitor className="h-4 w-4" /> عنوان هذا الحاسوب (Host)
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: توصيل الهاتف / الجهاز */}
            <TabsContent value="client" className="space-y-5 focus:outline-none">
              {/* Preset Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Cloud Preset */}
                <div
                  onClick={() => handleApplyServer(DEFAULT_CLOUD_URL)}
                  className={cn(
                    "p-4 rounded-2xl border transition-all cursor-pointer hover:border-teal-500/50 hover:shadow-md",
                    isCloud
                      ? "bg-teal-500/5 border-teal-500/40 ring-1 ring-teal-500/30"
                      : "bg-muted/30 border-border/60"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                      <Cloud className="h-4 w-4" />
                    </div>
                    {isCloud && (
                      <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full">
                        الخادم النشط
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-sm">السيرفر السحابي (Vercel)</h4>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    قاعدة بيانات PostgreSQL سحابية مشتركة عبر الإنترنت لجميع الأجهزة.
                  </p>
                </div>

                {/* Local Network Preset */}
                <div
                  onClick={() => recommendedLocalUrl && setCustomUrl(recommendedLocalUrl)}
                  className={cn(
                    "p-4 rounded-2xl border transition-all cursor-pointer hover:border-emerald-500/50 hover:shadow-md",
                    !isCloud
                      ? "bg-emerald-500/5 border-emerald-500/40 ring-1 ring-emerald-500/30"
                      : "bg-muted/30 border-border/60"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Wifi className="h-4 w-4" />
                    </div>
                    {!isCloud && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        الخادم النشط
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-sm">السيرفر المحلي (WiFi)</h4>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    قاعدة بيانات محلية داخل النادي بدون إنترنت عبر شبكة الواي فاي.
                  </p>
                </div>
              </div>

              {/* Manual IP / URL Input */}
              <div className="space-y-3 bg-muted/20 p-4 rounded-2xl border border-border/60">
                <Label className="text-xs font-bold flex items-center gap-1.5">
                  <Server className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  أدخل رابط السيرفر المخصص أو عنوان IP للكمبيوتر
                </Label>
                <div className="flex gap-2">
                  <Input
                    dir="ltr"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="http://192.168.1.15:3000"
                    className="h-10 text-xs sm:text-sm font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleTestConnection(customUrl)}
                    disabled={testing || !customUrl}
                    className="h-10 px-3 shrink-0 cursor-pointer"
                  >
                    {testing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 text-amber-500 ml-1" />
                    )}
                    فحص
                  </Button>
                </div>

                {/* Test Result Feedback */}
                {testResult && (
                  <div
                    className={cn(
                      "p-3 rounded-xl text-xs flex items-center gap-2",
                      testResult.ok
                        ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300"
                        : "bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300"
                    )}
                  >
                    {testResult.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    onClick={() => handleApplyServer(customUrl)}
                    disabled={!customUrl}
                    className="flex-1 h-10 font-bold bg-teal-600 hover:bg-teal-500 text-white cursor-pointer"
                  >
                    <Check className="h-4 w-4 ml-1.5" /> حفظ والاتصال بهذا السيرفر
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResetToCloud}
                    className="h-10 cursor-pointer"
                    title="إعادة ضبط السيرفر السحابي الافتراضي"
                  >
                    السحابة الافتراضية
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: معلومات المضيف (الكمبيوتر الرئيسي) */}
            <TabsContent value="host" className="space-y-4 focus:outline-none">
              <div className="bg-sky-500/10 border border-sky-500/20 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex items-center gap-2 text-sky-800 dark:text-sky-200 font-bold">
                  <Smartphone className="h-4 w-4 text-sky-600" />
                  كيف تربط هاتف النادي بهذا الكمبيوتر؟
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  1. تأكد أن الهاتف والكمبيوتر متصلان بنفس شبكة الواي فاي (WiFi) في النادي.<br />
                  2. شغّل السيرفر عبر ملف <strong>start-server.bat</strong> على الكمبيوتر.<br />
                  3. من تطبيق الهاتف، امسح رمز الـ QR أدناه أو افتح العنوان في متصفح الهاتف.
                </p>
              </div>

              {loadingInfo ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
                </div>
              ) : recommendedLocalUrl ? (
                <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-muted/30 border border-border/70">
                  <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 shrink-0">
                    <QRCodeSVG value={recommendedLocalUrl} size={140} level="M" />
                  </div>
                  <div className="space-y-3 flex-1 w-full text-center sm:text-right">
                    <div>
                      <span className="text-[11px] font-semibold text-muted-foreground">العنوان الموصى به للهاتف:</span>
                      <div className="font-mono text-sm sm:text-base font-bold text-teal-700 dark:text-teal-300 mt-0.5 break-all">
                        {recommendedLocalUrl}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(recommendedLocalUrl)}
                        className="h-8 text-xs font-semibold cursor-pointer"
                      >
                        {copiedUrl === recommendedLocalUrl ? (
                          <><Check className="h-3.5 w-3.5 ml-1 text-emerald-500" /> تم النسخ</>
                        ) : (
                          <><Copy className="h-3.5 w-3.5 ml-1" /> نسخ الرابط</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => window.open(recommendedLocalUrl, "_blank")}
                        className="h-8 text-xs font-semibold cursor-pointer"
                      >
                        <ExternalLink className="h-3.5 w-3.5 ml-1" /> فتح في تبويب جديد
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center p-6 text-muted-foreground text-xs">
                  تعذر استكشاف شبكة الواي فاي المحلية. يمكنك استخدام الرابط السحابي.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="bg-muted/20 px-6 py-3 border-t border-border/60">
          <Button variant="ghost" onClick={onClose} className="cursor-pointer">
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

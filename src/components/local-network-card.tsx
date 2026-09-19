"use client";

import { useEffect, useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Wifi, Smartphone, Copy, Check, ExternalLink, RefreshCw,
  ShieldCheck, Loader2, Info, QrCode, Cloud, WifiOff, MonitorSmartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

/**
 * هل نحن داخل الشبكة المحلية؟
 * - localhost / 127.0.0.1 → النسخة المفتوحة على حاسوب النادي نفسه
 * - 192.168.* / 10.* / 172.16-31.* → متصفح هاتف متصل بالخادم المحلي عبر الواي فاي
 * - غير ذلك (مثل vercel.app) → النسخة السحابية عبر الإنترنت
 */
function detectMode(): "local" | "cloud" {
  if (typeof window === "undefined") return "cloud";
  const h = window.location.hostname;
  if (h === "localhost" || h === "127.0.0.1") return "local";
  if (/^192\.168\.\d+\.\d+$/.test(h)) return "local";
  if (/^10\.\d+\.\d+\.\d+$/.test(h)) return "local";
  if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(h)) return "local";
  return "cloud";
}

export function LocalNetworkCard({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useState<"local" | "cloud">("cloud");
  const [data, setData] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUrl, setSelectedUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [serverReachable, setServerReachable] = useState<boolean | null>(null);

  const fetchInfo = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/network-info");
      if (res.ok) {
        const json: NetworkInfo = await res.json();
        setData(json);
        setServerReachable(true);
        // في الوضع المحلي نعرض العنوان المحلي، وفي السحابي نعرض رابط الموقع الحالي
        if (detectMode() === "local") {
          setSelectedUrl(json.defaultUrl || "");
        } else {
          setSelectedUrl(window.location.origin);
        }
      } else {
        setServerReachable(false);
      }
    } catch {
      setServerReachable(false);
      toast.error("تعذر قراءة عناوين الشبكة المحلية");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMode(detectMode());
    fetchInfo();
  }, [fetchInfo]);

  const handleCopy = () => {
    if (!selectedUrl) return;
    navigator.clipboard.writeText(selectedUrl);
    setCopied(true);
    toast.success("تم نسخ الرابط بنجاح");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 rounded-2xl border border-border/70 bg-card">
        <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
      </div>
    );
  }

  const isLocal = mode === "local";

  return (
    <div className="space-y-4" dir="rtl">
      {/* بطاقة الاتصال الرئيسية */}
      <div className={cn(
        "rounded-2xl border p-5 shadow-sm space-y-4 bg-gradient-to-br via-card to-card",
        isLocal ? "border-teal-500/30 from-teal-500/10" : "border-sky-500/30 from-sky-500/10"
      )}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
              isLocal ? "bg-teal-500/15 text-teal-600" : "bg-sky-500/15 text-sky-600"
            )}>
              {isLocal ? <Wifi className="h-5 w-5" /> : <Cloud className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base text-foreground">الاتصال المحلي عبر الواي فاي (بدون إنترنت)</h3>
                <Badge className={cn("text-white text-[10px] py-0 px-2", isLocal ? "bg-emerald-500" : "bg-sky-500")}>
                  {isLocal ? "متصل بالخادم المحلي ✓" : "النسخة السحابية (إنترنت)"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                تعمل المنظومة في الحالتين: <strong>مع الإنترنت</strong> عبر الرابط السحابي، و<strong>بدون إنترنت</strong> عبر خادم حاسوب النادي على الواي فاي.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={fetchInfo}
            className="text-xs gap-1.5 self-start sm:self-auto"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            تحديث واختبار الاتصال
          </Button>
        </div>

        {/* حالة الخادم الحالي */}
        <div className={cn(
          "flex items-center gap-2 text-xs rounded-xl px-3 py-2 border",
          serverReachable === true
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
            : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400"
        )}>
          {serverReachable === true ? (
            <>
              <Check className="h-4 w-4 shrink-0" />
              <span>هذا الجهاز متصل حالياً بخادم المنظومة بنجاح — كل الوظائف تعمل من هنا.</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 shrink-0" />
              <span>تعذر الوصول إلى خادم المنظومة من هذا الجهاز — تحقق من نفس شبكة الواي فاي وتشغيل البرنامج على حاسوب النادي.</span>
            </>
          )}
        </div>

        {/* عرض الـ QR Code مع تفاصيل الرابط */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center pt-2">
          {/* رمز الاستجابة السريعة QR Code */}
          <div className="md:col-span-4 flex flex-col items-center justify-center p-4 rounded-xl bg-white border border-border/80 shadow-sm text-center">
            {selectedUrl ? (
              <>
                <QRCodeSVG
                  value={selectedUrl}
                  size={160}
                  level="M"
                  includeMargin={true}
                  className="rounded-lg"
                />
                <span className="text-[11px] font-bold text-slate-700 mt-2 flex items-center gap-1">
                  <QrCode className="h-3.5 w-3.5 text-teal-600" /> امسح بكاميرا الهاتف
                </span>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">لا يتوفر عنوان للاتصال</p>
            )}
          </div>

          {/* تفاصيل الاتصال والتعليمات */}
          <div className="md:col-span-8 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {isLocal
                  ? "رابط الدخول المباشر من الهاتف أو التابلت (بدون إنترنت):"
                  : "رابط النسخة السحابية (يعمل مع الإنترنت فقط):"}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  value={selectedUrl}
                  readOnly
                  className="h-10 font-mono text-xs font-bold text-teal-700 dark:text-teal-300 bg-muted/50"
                  dir="ltr"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleCopy}
                  className="h-10 w-10 shrink-0"
                  title="نسخ الرابط"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
                <a
                  href={selectedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center h-10 px-3 rounded-xl border border-border text-xs font-bold hover:bg-muted shrink-0"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* محولات الشبكة المتوفرة — فقط في الوضع المحلي */}
            {isLocal && data && data.interfaces.length > 0 && (
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">اختر عنوان الشبكة (Wi-Fi أو كابل Ethernet):</Label>
                <div className="flex flex-wrap gap-1.5">
                  {data.interfaces.map((iface, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedUrl(iface.url)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg border text-xs font-mono transition-all",
                        selectedUrl === iface.url
                          ? "bg-teal-600 text-white border-teal-600 font-bold shadow-sm"
                          : "bg-background border-border text-muted-foreground hover:bg-muted"
                      )}
                      dir="ltr"
                    >
                      {iface.address} ({iface.name})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* تنبيه الوضع السحابي: كيف يعمل بدون إنترنت؟ */}
            {!isLocal && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                  <MonitorSmartphone className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>للعمل بدون إنترنت على الواي فاي المحلي:</span>
                </div>
                <ul className="text-[11px] text-amber-900/80 dark:text-amber-200/80 space-y-1 list-disc list-inside leading-relaxed">
                  <li>شغّل <strong>نسخة سطح المكتب (AquaCore Desktop)</strong> على حاسوب النادي — هي تشغّل خادماً محلياً على المنفذ 3872.</li>
                  <li>شغّل ملف <code className="px-1 py-0.5 rounded bg-background font-mono text-[10px] font-bold border border-amber-400">تفعيل_الاتصال_بالهاتف.bat</code> كمسؤول (مرة واحدة) لفتح المنافذ 3000 و3872.</li>
                  <li>افتح النسخة المكتبية على الحاسوب وانتقل إلى هذه الشاشة — سيظهر رمز QR المحلي هنا تلقائياً.</li>
                  <li>صل الهاتف بنفس واي فاي النادي وامسح الرمز — تعمل المنظومة كاملة بدون إنترنت!</li>
                </ul>
              </div>
            )}

            {/* خطوات الربط السريعة — الوضع المحلي */}
            {isLocal && (
              <div className="rounded-xl bg-muted/40 p-3 border border-border/60 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Smartphone className="h-3.5 w-3.5 text-teal-600" />
                  كيف يعمل بدون إنترنت؟ (خطوات سريعة):
                </div>
                <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside leading-relaxed">
                  <li>صل الهاتف بنفس شبكة راوتر النادي (أو افتح نقطة اتصال Hotspot من حاسوب النادي).</li>
                  <li>افتح تطبيق الكاميرا بالهاتف ووجهه نحو رمز QR أعلاه، ثم اضغط على الرابط المنبثق.</li>
                  <li>اضغط خيار <strong>«إضافة إلى الشاشة الرئيسية»</strong> ليعمل كتطبيق جوال كامل الشاشة.</li>
                  <li>أي منخرط يُسجل، أو أي حضور يُمسح من الهاتف يُحفظ فوراً في الكمبيوتر الرئيسي!</li>
                </ul>
              </div>
            )}

            {/* تنبيه استكشاف أخطاء الاتصال */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" />
                <span>الهاتف لا يتصل؟ (ERR_CONNECTION_TIMED_OUT / REFUSED)</span>
              </div>
              <ul className="text-[11px] text-amber-900/80 dark:text-amber-200/80 space-y-1 list-disc list-inside leading-relaxed">
                <li>شغّل <code className="px-1 py-0.5 rounded bg-background font-mono text-[10px] font-bold border border-amber-400">تفعيل_الاتصال_بالهاتف.bat</code> بالزر الأيمن ← <strong>«تشغيل كمسؤول»</strong> — يفتح المنافذ 3000 و3872 في جدار الحماية.</li>
                <li>إذا ظهرت للهاتف رسالة <strong>«شبكة الواي فاي بلا إنترنت — هل تبقى متصلاً؟»</strong> اضغط <strong>«البقاء متصلاً»</strong> (هذا طبيعي في الوضع المحلي).</li>
                <li>أوقف بيانات الهاتف المحمولة (4G) مؤقتاً — بعض الهواتف تتجاوز الواي فاي تلقائياً عندما لا يجد إنترنت.</li>
                <li>تأكد أن الهاتف والحاسوب على <strong>نفس شبكة الراوتر</strong>، وأن الراوتر لا يفعّل «عزل الأجهزة» (AP Isolation / Client Isolation).</li>
              </ul>
            </div>

            {/* معلومة المنفذين */}
            <div className="flex items-start gap-2 text-[11px] text-muted-foreground rounded-xl bg-muted/30 p-2.5 border border-border/50">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-teal-600" />
              <span>
                المنافذ المعتمدة: <strong dir="ltr">3872</strong> لنسخة سطح المكتب Electron (العمل بدون إنترنت) و <strong dir="ltr">3000</strong> لتشغيل المتصفح عبر npm start — كلاهما يجب أن يكون مفتوحاً في جدار الحماية.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Wifi, Smartphone, Copy, Check, ExternalLink, RefreshCw,
  ShieldCheck, Loader2, Info, Laptop, QrCode
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

export function LocalNetworkCard({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUrl, setSelectedUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const fetchInfo = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/network-info");
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setSelectedUrl(json.defaultUrl || "");
      }
    } catch {
      toast.error("تعذر قراءة عناوين الشبكة المحلية");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInfo();
  }, []);

  const handleCopy = () => {
    if (!selectedUrl) return;
    navigator.clipboard.writeText(selectedUrl);
    setCopied(true);
    toast.success("تم نسخ الرابط المحلي بنجاح");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 rounded-2xl border border-border/70 bg-card">
        <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* بطاقة الاتصال الرئيسية */}
      <div className="rounded-2xl border border-teal-500/30 bg-gradient-to-br from-teal-500/10 via-card to-card p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-teal-500/15 text-teal-600 flex items-center justify-center shrink-0">
              <Wifi className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-foreground">الاتصال المحلي عبر الواي فاي (بدون إنترنت)</h3>
                <Badge className="bg-emerald-500 text-white text-[10px] py-0 px-2">
                  قاعدة بيانات موحدة
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                اربط هواتف الاستقبال والمدربين على نفس شبكة الواي فاي للعمل معاً في نفس اللحظة.
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
            تحديث الـ IP
          </Button>
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
              <p className="text-xs text-muted-foreground">لا يتوفر عنوان IP محلي</p>
            )}
          </div>

          {/* تفاصيل الاتصال والتعليمات */}
          <div className="md:col-span-8 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">رابط الدخول المباشر من الهاتف أو التابلت:</Label>
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

            {/* محولات الشبكة المتوفرة (إن وجد أكثر من محول) */}
            {data && data.interfaces.length > 1 && (
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">اختر محول الشبكة (Wi-Fi أو كابل Ethernet):</Label>
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

            {/* خطوات الربط السريعة */}
            <div className="rounded-xl bg-muted/40 p-3 border border-border/60 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Smartphone className="h-3.5 w-3.5 text-teal-600" />
                كيف يعمل بدون إنترنت؟ (خطوات سريعة):
              </div>
              <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside leading-relaxed">
                <li>صل الهاتف بنفس شبكة راوتر النادي (أو افتح نقطة اتصال Hotspot من هاتفك).</li>
                <li>افتح تطبيق الكاميرا بالهاتف ووجهه نحو رمز QR أعلاه، ثم اضغط على الرابط المنبثق.</li>
                <li>اضغط خيار <strong>«إضافة إلى الشاشة الرئيسية»</strong> ليعمل كتطبيق جوال كامل الشاشة.</li>
                <li>أي منخرط يُسجل، أو أي حضور يُمسح من الهاتف يُحفظ فوراً في الكمبيوتر الرئيسي!</li>
              </ul>
            </div>

            {/* تنبيه استكشاف أخطاء جدار الحماية */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" />
                <span>تعذر الاتصال من الهاتف (ERR_CONNECTION_TIMED_OUT)؟</span>
              </div>
              <p className="text-[11px] text-amber-900/80 dark:text-amber-200/80 leading-relaxed">
                في أنظمة ويندوز، يقوم جدار الحماية (Windows Defender Firewall) بحظر المنافذ الواردة للأجهزة المتصلة افتراضياً.
                لحلها بنقرة واحدة: انقر بالزر الأيمن على ملف <code className="px-1.5 py-0.5 rounded bg-background font-mono text-[10px] font-bold border border-amber-400">تفعيل_الاتصال_بالهاتف.bat</code> في المجلد الرئيسي للبرنامج واختر <strong>«تشغيل كمسؤول» (Exécuter en tant qu&apos;administrateur)</strong> وسيفتح المنفذ فوراً!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

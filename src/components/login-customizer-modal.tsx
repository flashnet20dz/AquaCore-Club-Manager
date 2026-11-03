"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Palette,
  Sparkles,
  Waves,
  Layout,
  BarChart3,
  Megaphone,
  Eye,
  RotateCcw,
  Save,
  Loader2,
  CheckCircle2,
  Layers,
  Sliders,
  Type,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";

interface LoginCustomizerModalProps {
  open: boolean;
  onClose: () => void;
}

export function LoginCustomizerModal({ open, onClose }: LoginCustomizerModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("general");

  // جلب الإعدادات الحالية
  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/login-customizer");
      const data = await res.json();
      if (data.config) {
        setConfig(data.config);
      }
    } catch {
      toast.error("فشل في تحميل إعدادات واجهة الدخول");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchConfig();
    }
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/super-admin/login-customizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "✓ تم حفظ وتطبيق التصميم الجديد بنجاح!");
        onClose();
      } else {
        toast.error(data.error || "فشل في حفظ الإعدادات");
      }
    } catch {
      toast.error("خطأ في الاتصال بالخادم");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("هل أنت متأكد من استعادة التصميم الافتراضي لواجهة الدخول؟")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/super-admin/login-customizer", {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        setConfig(data.config);
        toast.success("✓ تم استعادة التصميم الافتراضي");
      } else {
        toast.error(data.error || "فشل الاستعادة");
      }
    } catch {
      toast.error("خطأ في الاتصال");
    } finally {
      setSaving(false);
    }
  };

  if (!config) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-cyan-500 mb-3" />
          <p className="text-sm font-semibold">جاري تحميل مخصّص واجهة الدخول...</p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-0 border border-slate-700/80 bg-slate-950 text-white shadow-2xl rounded-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <DialogHeader className="p-5 border-b border-slate-800 bg-gradient-to-l from-cyan-950/40 via-slate-900 to-slate-950">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
                <Palette className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
                  تخصيص وتصميم واجهة تسجيل الدخول
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                    صلاحية المدير العام
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  تحكم كامل في العناوين، الخلفية المائية، بطاقات الميزات، الإحصائيات والشريط الإخباري
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open("/login", "_blank")}
                className="h-8 text-xs bg-slate-800/80 border-slate-700 text-cyan-300 hover:bg-slate-700 gap-1.5"
              >
                <Eye className="h-3.5 w-3.5" /> معاينة مباشرة
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Content Tabs */}
        <div className="flex-1 overflow-y-auto p-5">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-5 bg-slate-900/90 border border-slate-800 p-1 rounded-xl mb-5">
              <TabsTrigger value="general" className="text-xs font-semibold gap-1.5 data-[state=active]:bg-cyan-500 data-[state=active]:text-white">
                <Type className="h-3.5 w-3.5" /> العناوين والنصوص
              </TabsTrigger>
              <TabsTrigger value="theme" className="text-xs font-semibold gap-1.5 data-[state=active]:bg-cyan-500 data-[state=active]:text-white">
                <Waves className="h-3.5 w-3.5" /> النمط والخلفية
              </TabsTrigger>
              <TabsTrigger value="stats" className="text-xs font-semibold gap-1.5 data-[state=active]:bg-cyan-500 data-[state=active]:text-white">
                <BarChart3 className="h-3.5 w-3.5" /> الإحصائيات
              </TabsTrigger>
              <TabsTrigger value="features" className="text-xs font-semibold gap-1.5 data-[state=active]:bg-cyan-500 data-[state=active]:text-white">
                <Layout className="h-3.5 w-3.5" /> بطاقات الميزات
              </TabsTrigger>
              <TabsTrigger value="marquee" className="text-xs font-semibold gap-1.5 data-[state=active]:bg-cyan-500 data-[state=active]:text-white">
                <Megaphone className="h-3.5 w-3.5" /> الأخبار والإعلانات
              </TabsTrigger>
            </TabsList>

            {/* تبويب 1: العناوين والنصوص */}
            <TabsContent value="general" className="space-y-4 mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300">العنوان التعريفي الرئيسي</Label>
                  <Input
                    value={config.heroTitle || ""}
                    onChange={(e) => setConfig({ ...config, heroTitle: e.target.value })}
                    placeholder="منظومة عصرية متكاملة"
                    className="bg-slate-900 border-slate-800 text-white h-10 text-sm"
                  />
                  <p className="text-[11px] text-slate-500">السطر الأول من العنوان الرئيسي على الشاشات الكبيرة</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300">الكلمة المظللة (Highlight)</Label>
                  <Input
                    value={config.heroHighlight || ""}
                    onChange={(e) => setConfig({ ...config, heroHighlight: e.target.value })}
                    placeholder="لإدارة نوادي السباحة"
                    className="bg-slate-900 border-slate-800 text-cyan-300 font-bold h-10 text-sm"
                  />
                  <p className="text-[11px] text-slate-500">السطر الثاني الذي يظهر مع تأثير تمييز لوني لافت</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">الوصف التعريفي التفصيلي</Label>
                <Textarea
                  value={config.heroDescription || ""}
                  onChange={(e) => setConfig({ ...config, heroDescription: e.target.value })}
                  rows={3}
                  className="bg-slate-900 border-slate-800 text-white text-xs leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300">عنوان كرت تسجيل الدخول</Label>
                  <Input
                    value={config.loginTitle || ""}
                    onChange={(e) => setConfig({ ...config, loginTitle: e.target.value })}
                    placeholder="تسجيل الدخول"
                    className="bg-slate-900 border-slate-800 text-white h-10 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300">الوصف التوجيهي لكرت الدخول</Label>
                  <Input
                    value={config.loginSubtitle || ""}
                    onChange={(e) => setConfig({ ...config, loginSubtitle: e.target.value })}
                    placeholder="أدخل بياناتك للوصول إلى لوحة الإدارة"
                    className="bg-slate-900 border-slate-800 text-white h-10 text-sm"
                  />
                </div>
              </div>
            </TabsContent>

            {/* تبويب 2: النمط والخلفية */}
            <TabsContent value="theme" className="space-y-5 mt-0">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-300">نمط التصميم المائي (Aquatic Theme Style)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { id: "aquatic-luxury", label: "مسبح فاخر", desc: "أكوا عميق مع تموجات زمردية وسيان", color: "from-cyan-900 via-teal-950 to-slate-950" },
                    { id: "ocean-blue", label: "أزرق محيطي", desc: "أزرق بحري مع لمسات كحلي كريستالي", color: "from-blue-900 via-indigo-950 to-slate-950" },
                    { id: "midnight-aurora", label: "شفق ليلي", desc: "ماجنتا وشفق بنفسجي حيوي مع كوانتم", color: "from-fuchsia-950 via-purple-950 to-slate-950" },
                    { id: "olympic-pool", label: "مسبح أولمبي", desc: "مسبح كلاسيكي مضاء تحت الماء", color: "from-sky-900 via-cyan-950 to-slate-950" },
                  ].map((th) => (
                    <div
                      key={th.id}
                      onClick={() => setConfig({ ...config, themeStyle: th.id })}
                      className={`cursor-pointer rounded-xl p-3 border transition-all text-right ${
                        config.themeStyle === th.id
                          ? "border-cyan-400 bg-cyan-950/40 ring-2 ring-cyan-400/20"
                          : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                      }`}
                    >
                      <div className={`h-12 w-full rounded-lg bg-gradient-to-br ${th.color} mb-2.5 border border-white/10`} />
                      <p className="text-xs font-bold text-white">{th.label}</p>
                      <p className="text-[10px] text-slate-400 line-clamp-1">{th.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5 text-cyan-400" /> رابط صورة خلفية مخصصة (اختياري)
                </Label>
                <Input
                  value={config.customBgUrl || ""}
                  onChange={(e) => setConfig({ ...config, customBgUrl: e.target.value })}
                  placeholder="https://... أو /images/hero-swimming.png"
                  className="bg-slate-900 border-slate-800 text-white h-10 text-xs font-mono"
                  dir="ltr"
                />
                <p className="text-[11px] text-slate-500">
                  اترك الحقل فارغاً لاستخدام صورة المسبح الافتراضية عالية الدقة مع التدرج المائي.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                  <div>
                    <p className="text-xs font-bold text-white">تأثير تموجات المياه التفاعلية (Water Waves)</p>
                    <p className="text-[10px] text-slate-400">حركة انسيابية هادئة مستوحاة من حركة الماء</p>
                  </div>
                  <Switch
                    checked={config.waterRipples !== false}
                    onCheckedChange={(checked) => setConfig({ ...config, waterRipples: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                  <div>
                    <p className="text-xs font-bold text-white">الشارات العائمة (ملء الفراغ على الشاشات العريضة)</p>
                    <p className="text-[10px] text-slate-400">بطاقات أمان وتزامن تزين المساحة الشاسعة</p>
                  </div>
                  <Switch
                    checked={config.floatingBadges !== false}
                    onCheckedChange={(checked) => setConfig({ ...config, floatingBadges: checked })}
                  />
                </div>
              </div>
            </TabsContent>

            {/* تبويب 3: الإحصائيات */}
            <TabsContent value="stats" className="space-y-4 mt-0">
              <Label className="text-xs font-bold text-slate-300">مؤشرات الأداء والإحصائيات المعروضة</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(config.stats || []).map((st: any, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-400">القيمة #{idx + 1}</Label>
                      <Input
                        value={st.value || ""}
                        onChange={(e) => {
                          const newStats = [...config.stats];
                          newStats[idx].value = e.target.value;
                          setConfig({ ...config, stats: newStats });
                        }}
                        className="h-8 text-xs bg-slate-950 font-bold text-cyan-400 border-slate-700"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-400">التسمية</Label>
                      <Input
                        value={st.label || ""}
                        onChange={(e) => {
                          const newStats = [...config.stats];
                          newStats[idx].label = e.target.value;
                          setConfig({ ...config, stats: newStats });
                        }}
                        className="h-8 text-xs bg-slate-950 text-white border-slate-700"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* تبويب 4: بطاقات الميزات */}
            <TabsContent value="features" className="space-y-4 mt-0">
              <Label className="text-xs font-bold text-slate-300">بطاقات الميزات الستة المعروضة على الواجهة</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-1">
                {(config.features || []).map((feat: any, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-cyan-400 font-bold">ميزة #{idx + 1} — العنوان</Label>
                      <Input
                        value={feat.title || ""}
                        onChange={(e) => {
                          const newFeat = [...config.features];
                          newFeat[idx].title = e.target.value;
                          setConfig({ ...config, features: newFeat });
                        }}
                        className="h-8 text-xs bg-slate-950 text-white border-slate-700 font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-400">الوصف التعريفي</Label>
                      <Input
                        value={feat.desc || ""}
                        onChange={(e) => {
                          const newFeat = [...config.features];
                          newFeat[idx].desc = e.target.value;
                          setConfig({ ...config, features: newFeat });
                        }}
                        className="h-8 text-[11px] bg-slate-950 text-slate-300 border-slate-700"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* تبويب 5: الأخبار والإعلانات */}
            <TabsContent value="marquee" className="space-y-4 mt-0">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">شريط الإعلان أو التنبيه العام (اختياري)</Label>
                <Input
                  value={config.announcement || ""}
                  onChange={(e) => setConfig({ ...config, announcement: e.target.value })}
                  placeholder="مثال: مرحباً بكم في منظومة AquaCore — مواعيد العمل مستمرة 24/7"
                  className="bg-slate-900 border-slate-800 text-white h-10 text-xs"
                />
                <p className="text-[11px] text-slate-500">
                  إذا أدخلت نصاً هنا، سيظهر كشريط إعلان بارز وأنيق أعلى نموذج تسجيل الدخول مباشرة.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <Label className="text-xs font-bold text-slate-300">عناصر الشريط الإخباري المتحرك (Marquee)</Label>
                <div className="space-y-2">
                  {(config.marqueeItems || []).map((item: string, idx: number) => (
                    <Input
                      key={idx}
                      value={item}
                      onChange={(e) => {
                        const newItems = [...config.marqueeItems];
                        newItems[idx] = e.target.value;
                        setConfig({ ...config, marqueeItems: newItems });
                      }}
                      className="bg-slate-900 border-slate-800 text-white h-8 text-xs"
                    />
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={saving}
            className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" /> استعادة الافتراضي
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              إلغاء
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="text-xs bg-gradient-to-l from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white font-bold gap-1.5 shadow-lg shadow-cyan-500/20"
            >
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> جاري الحفظ والتطبيق...</>
              ) : (
                <><Save className="h-4 w-4" /> حفظ وتطبيق فوراً</>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

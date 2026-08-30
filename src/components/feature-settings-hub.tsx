"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2, Save, Puzzle, Info, ExternalLink, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import type { FeatureGroupDef } from "@/lib/feature-settings";
import { toast } from "sonner";

/**
 * FeatureSettingsHub — مركز إعدادات الميزات
 * ─────────────────────────────────────────
 * «كل ميزة لها إعداداتها في صفحة الإعدادات ومتزامنة معها»
 * كل بطاقة تُظهر: الميزة، مفاتيحها، وأين تُستهلك فعلياً (consumedBy)
 * حتى يعرف المستخدم أن الإعداد حي وليس ديكوراً.
 */

type Group = FeatureGroupDef & { /* محوّل من JSON */ };

export function FeatureSettingsHub() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/feature-settings");
      const data = await res.json();
      setGroups(data.groups || []);
      setValues(data.values || {});
      setOriginal(data.values || {});
    } catch {
      toast.error("تعذّر جلب إعدادات الميزات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setVal = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      // أرسل المفاتيح المتغيرة فقط
      const changed: Record<string, string> = {};
      for (const [k, v] of Object.entries(values)) {
        if (original[k] !== v) changed[k] = v;
      }
      if (!Object.keys(changed).length) {
        toast.info("لا تغييرات للحفظ");
        return;
      }
      const res = await fetch("/api/feature-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: changed }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "فشل الحفظ");
      }
      toast.success("تم حفظ إعدادات الميزات — سارية فوراً على كل الميزات");
      setOriginal({ ...original, ...changed });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const revert = () => {
    setValues({ ...original });
    toast.info("تمت إعادة القيم المحفوظة");
  };

  const dirtyCount = Object.keys(values).filter((k) => original[k] !== values[k]).length;

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Puzzle className="h-4 w-4 text-primary" />
          <h4 className="font-bold text-sm">إعدادات الميزات المتزامنة</h4>
          <Badge variant="secondary" className="text-[10px]">{groups.length} ميزات</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          {dirtyCount > 0 && (
            <>
              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-400">{dirtyCount} تغيير غير محفوظ</Badge>
              <Button size="sm" variant="ghost" onClick={revert}><RotateCcw className="h-3.5 w-3.5 ml-1" /> تراجع</Button>
            </>
          )}
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 ml-1" />}
            حفظ
          </Button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        كل إعداد هنا يقرؤه النظام مباشرة وقت التشغيل — التغيير يسري فوراً على الميزة في كل الصفحات دون إعادة تشغيل.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {groups.map((g) => (
          <div key={g.id} className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
            <div>
              <h5 className="font-bold text-sm flex items-center gap-1.5">
                <span aria-hidden>{g.icon}</span> {g.name}
              </h5>
              <p className="text-[11px] text-muted-foreground mt-0.5">{g.description}</p>
            </div>

            <div className="space-y-2.5">
              {g.settings.map((s) => {
                const key = s.key;
                if (s.type === "boolean") {
                  return (
                    <div key={key} className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 p-2.5">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold">{s.label}</p>
                        {s.help && <p className="text-[10px] text-muted-foreground mt-0.5">{s.help}</p>}
                      </div>
                      <Switch
                        checked={values[key] === "true"}
                        onCheckedChange={(c) => setVal(key, c ? "true" : "false")}
                        aria-label={s.label}
                      />
                    </div>
                  );
                }
                if (s.type === "textarea") {
                  return (
                    <div key={key} className="space-y-1">
                      <Label className="text-xs">{s.label}</Label>
                      <Textarea
                        rows={2}
                        value={values[key] ?? ""}
                        onChange={(e) => setVal(key, e.target.value)}
                        className="text-xs"
                      />
                      {s.help && <p className="text-[10px] text-muted-foreground">{s.help}</p>}
                    </div>
                  );
                }
                return (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs">{s.label}</Label>
                    <Input
                      type={s.type === "number" ? "number" : "text"}
                      value={values[key] ?? ""}
                      onChange={(e) => setVal(key, e.target.value)}
                      className="h-9 text-xs"
                      placeholder={s.placeholder}
                    />
                    {s.help && <p className="text-[10px] text-muted-foreground">{s.help}</p>}
                  </div>
                );
              })}
            </div>

            <div className="rounded-lg bg-primary/5 border border-primary/20 p-2.5">
              <p className="text-[10px] font-bold text-primary flex items-center gap-1 mb-1">
                <Info className="h-3 w-3" /> أين تُستخدم هذه الإعدادات؟
              </p>
              <ul className="space-y-0.5">
                {g.consumedBy.map((c) => (
                  <li key={c} className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <ExternalLink className="h-2.5 w-2.5 shrink-0" /> {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

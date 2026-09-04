"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  Database, Download, Upload, Loader2, CheckCircle2, AlertCircle, FileJson,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export function BackupPanel() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [importPreview, setImportPreview] = useState<{ counts: Record<string, number>; exportedAt: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) throw new Error("فشل التصدير");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rcs-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تصدير النسخة الاحتياطية بنجاح");
    } catch {
      toast.error("فشل التصدير");
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPendingFile(f);
    // Preview
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        setImportPreview({
          counts: data.counts || {},
          exportedAt: data.exportedAt || "",
        });
      } catch {
        toast.error("ملف غير صالح");
        setPendingFile(null);
      }
    };
    reader.readAsText(f);
  };

  const handleImport = async () => {
    if (!pendingFile) return;
    setImporting(true);
    try {
      const text = await pendingFile.text();
      const backup = JSON.parse(text);
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backup, mode: importMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`تم الاستيراد: ${data.imported} عنصر (${data.skipped} متجاهل)`);
      setPendingFile(null);
      setImportPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الاستيراد");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Export card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border/60 bg-gradient-to-br from-emerald-500/5 to-transparent p-5"
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
            <Download className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm">تصدير نسخة احتياطية</h3>
            <p className="text-xs text-muted-foreground">صدّر جميع بيانات النظام في ملف JSON واحد</p>
          </div>
        </div>
        <Button onClick={handleExport} disabled={exporting} className="w-full">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 ml-1" />}
          تنزيل النسخة الاحتياطية
        </Button>
      </motion.div>

      {/* Import card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-border/60 bg-card p-5"
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm">استيراد نسخة احتياطية</h3>
            <p className="text-xs text-muted-foreground">استعد البيانات من ملف JSON</p>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
        />

        {!pendingFile ? (
          <Button onClick={() => fileRef.current?.click()} variant="outline" className="w-full">
            <FileJson className="h-4 w-4 ml-1" /> اختر ملف JSON
          </Button>
        ) : (
          <div className="space-y-3">
            {importPreview && (
              <div className="rounded-xl bg-muted/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">ملف النسخة الاحتياطية</span>
                  <Badge variant="outline" className="text-[10px]">
                    {new Date(importPreview.exportedAt).toISOString().split("T")[0].replace(/-/g,"/")}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {Object.entries(importPreview.counts).slice(0, 6).map(([key, val]) => (
                    <div key={key} className="text-center bg-card rounded-lg p-1.5">
                      <p className="font-bold tabular-nums">{val}</p>
                      <p className="text-[10px] text-muted-foreground">{key}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-semibold">وضع الاستيراد:</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setImportMode("merge")}
                  className={`p-2 rounded-lg border-2 text-xs font-semibold transition ${
                    importMode === "merge" ? "border-primary bg-primary/10" : "border-border"
                  }`}
                >
                  دمج (إضافة للموجود)
                </button>
                <button
                  onClick={() => setImportMode("replace")}
                  className={`p-2 rounded-lg border-2 text-xs font-semibold transition ${
                    importMode === "replace" ? "border-rose-500 bg-rose-500/10 text-rose-700" : "border-border"
                  }`}
                >
                  استبدال (حذف الموجود)
                </button>
              </div>
              {importMode === "replace" && (
                <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 p-2 rounded-lg">
                  <AlertCircle className="h-3.5 w-3.5" />
                  تحذير: سيتم حذف جميع البيانات الحالية!
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleImport} disabled={importing} className="flex-1">
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 ml-1" />}
                استيراد البيانات
              </Button>
              <Button
                variant="outline"
                onClick={() => { setPendingFile(null); setImportPreview(null); if (fileRef.current) fileRef.current.value = ""; }}
              >
                إلغاء
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

"use client";

/**
 * ═══════════════════════════════════════════════════════════════
 *  BulkPhotoUpload — رفع صور المنخرطين الجماعي بالمطابقة التلقائية
 * ═══════════════════════════════════════════════════════════════
 *
 *  - مطابقة تلقائية فورية من أسماء الملفات عبر matchPhotoFiles
 *  - استعراض ومراجعة قبل الرفع مع تصفية وبحث
 *  - معالجة في المتصفح: اكتشاف الوجه + قص 300x300 + تصغير الأصل لـ 800px
 *  - توازي 2 في وقت واحد مع إمكانية الإيقاف وإعادة المحاولة
 *  - تصدير تقرير CSV مع BOM يدعم Excel
 *  - متوافق مع React 19 (Zero setState in useEffect)
 */

import * as React from "react";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import JSZip from "jszip";
import {
  Upload,
  FolderUp,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  XCircle,
  HelpCircle,
  Copy,
  Hash,
  RefreshCw,
  Loader2,
  CheckSquare,
  Download,
  Search,
  X,
  Play,
  Square as StopIcon,
  ChevronDown,
  Sparkles,
  FileArchive,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  matchPhotoFiles,
  generateMatchCsvReport,
  type CandidateSubscriber,
  type MatchResultItem,
  type BulkMatchSummary,
} from "@/lib/photo-filename-match";
import {
  processPhoto,
  makeDownscaledOriginal,
  fileToDataURL,
} from "@/lib/photo-processing";

export interface BulkPhotoUploadProps {
  subscribers: CandidateSubscriber[];
  onDone?: () => void;
  className?: string;
}

type FilterTab = "all" | "matched" | "review" | "has_photo" | "unmatched" | "duplicate";

interface ItemUploadState {
  status: "idle" | "uploading" | "success" | "error";
  error?: string;
  retries?: number;
}

// ─────────────────────────────────────────────────────────────
// مكوّن عرض الصورة المصغرة مع إدارة دورة حياة createObjectURL
// ─────────────────────────────────────────────────────────────
function FileThumbnail({ file, className }: { file?: File; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  if (!url) {
    return (
      <div className={cn("w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground", className)}>
        <ImageIcon className="w-5 h-5 opacity-40" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={file?.name || "صورة"}
      className={cn("w-10 h-10 rounded-lg object-cover border border-border/60 bg-background", className)}
      loading="lazy"
    />
  );
}

// ─────────────────────────────────────────────────────────────
// المكوّن الرئيسي
// ─────────────────────────────────────────────────────────────
export function BulkPhotoUpload({ subscribers, onDone, className }: BulkPhotoUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [enableFaceDetection, setEnableFaceDetection] = useState(true);
  const [selectedPoolId, setSelectedPoolId] = useState<string>("all");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(200);

  // تخزين التعديل اليدوي لاختيار الصفوف: true = محدد، false = غير محدد
  const [selectionOverrides, setSelectionOverrides] = useState<Map<string, boolean>>(new Map());

  // حالات الرفع لكل ملف (المفتاح هو cleanFileName)
  const [uploadStates, setUploadStates] = useState<Record<string, ItemUploadState>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [isExtractingZip, setIsExtractingZip] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  const cancelledRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // خريطة سريعة للوصول لكائن File بالاسم
  const filesByName = useMemo(() => {
    const map = new Map<string, File>();
    for (const f of files) {
      map.set(f.name, f);
    }
    return map;
  }, [files]);

  // استخراج قائمة المسابح المتاحة
  const pools = useMemo(() => {
    const map = new Map<string, string>();
    for (const sub of subscribers) {
      const pName = sub.poolName || sub.pool;
      if (sub.poolId && pName) {
        map.set(sub.poolId, pName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [subscribers]);

  // المطابقة النقية الفورية (بدون أي أثر جانبي أو setState داخل effect)
  const { results: matchResults, summary: baseSummary } = useMemo(() => {
    if (files.length === 0) {
      const emptySummary: BulkMatchSummary = {
        total: 0,
        matched: 0,
        hasPhoto: 0,
        digitsOnly: 0,
        ambiguous: 0,
        unmatched: 0,
        duplicate: 0,
        invalid: 0,
        selectedCount: 0,
      };
      return { results: [], summary: emptySummary };
    }

    const mappedInputs = files.map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
      lastModified: f.lastModified,
      file: f,
    }));

    return matchPhotoFiles(mappedInputs, subscribers, {
      poolId: selectedPoolId === "all" ? undefined : selectedPoolId,
      replaceExisting,
    });
  }, [files, subscribers, selectedPoolId, replaceExisting]);

  // دالة فحص هل الصف محدد للرفع حالياً
  const isRowSelected = useCallback(
    (row: MatchResultItem): boolean => {
      if (row.status === "unmatched" || row.status === "invalid") return false;
      if (selectionOverrides.has(row.cleanFileName)) {
        return Boolean(selectionOverrides.get(row.cleanFileName));
      }
      return row.selected;
    },
    [selectionOverrides]
  );

  // حساب العدد الفعلي للمحددات للرفع
  const selectedCount = useMemo(() => {
    let count = 0;
    for (const r of matchResults) {
      if (isRowSelected(r)) count++;
    }
    return count;
  }, [matchResults, isRowSelected]);

  // تصفية النتائج بحسب التبويب النشط والبحث
  const filteredResults = useMemo(() => {
    let list = matchResults;

    // تصفية حسب التبويب
    if (filterTab === "matched") {
      list = list.filter((r) => r.status === "matched");
    } else if (filterTab === "review") {
      list = list.filter(
        (r) => r.status === "ambiguous" || r.confidence === "digits" || r.status === "duplicate"
      );
    } else if (filterTab === "has_photo") {
      list = list.filter((r) => r.hasExistingPhoto);
    } else if (filterTab === "unmatched") {
      list = list.filter((r) => r.status === "unmatched" || r.status === "invalid");
    } else if (filterTab === "duplicate") {
      list = list.filter((r) => r.status === "duplicate");
    }

    // تصفية حسب نص البحث
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((r) => {
        if (r.cleanFileName.toLowerCase().includes(q)) return true;
        if (r.matchedSubscriber) {
          if (r.matchedSubscriber.fileNumber.toLowerCase().includes(q)) return true;
          if (r.matchedSubscriber.firstName.toLowerCase().includes(q)) return true;
          if (r.matchedSubscriber.lastName.toLowerCase().includes(q)) return true;
          if (`${r.matchedSubscriber.firstName} ${r.matchedSubscriber.lastName}`.toLowerCase().includes(q)) return true;
        }
        return false;
      });
    }

    return list;
  }, [matchResults, filterTab, searchQuery]);

  // الصفوف المعروضة مع التجزئة (200 صف)
  const displayedResults = useMemo(() => {
    return filteredResults.slice(0, visibleCount);
  }, [filteredResults, visibleCount]);

  // تصدير قائمة أسماء الملفات المطلوبة للمصور
  const handleExportMissingPhotosList = useCallback(() => {
    const missing = subscribers.filter((s) => !s.photoPath && !s.photoThumb);
    if (missing.length === 0) {
      toast.info("جميع المنخرطين لديهم صور بالفعل!");
      return;
    }

    const rows = [
      ["رقم الملف", "الاسم واللقب", "المسبح", "اسم ملف الصورة المقترح"],
      ...missing.map((s) => [
        s.fileNumber,
        `${s.firstName} ${s.lastName}`,
        s.poolName || s.pool || "المسبح الافتراضي",
        `${s.fileNumber}.jpg`,
      ]),
    ];

    const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `قائمة_المنخرطين_بدون_صور_للمصور_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`تم تصدير قائمة ${missing.length} منخرط بدون صورة`);
  }, [subscribers]);

  // معالجة اختيار الملفات مع دعم استخراج ZIP تلقائياً
  const handleFilesAdded = useCallback(async (newFiles: FileList | File[]) => {
    const incoming = Array.from(newFiles);
    if (incoming.length === 0) return;

    const extracted: File[] = [];
    let hadZip = false;

    for (const item of incoming) {
      const isZip =
        item.name.toLowerCase().endsWith(".zip") ||
        item.type === "application/zip" ||
        item.type === "application/x-zip-compressed";

      if (isZip) {
        hadZip = true;
        try {
          setIsExtractingZip(true);
          toast.info(`جاري فك ضغط الأرشيف: ${item.name}...`);
          const zip = await JSZip.loadAsync(item);
          const imageEntries: { path: string; file: any }[] = [];

          zip.forEach((relativePath, zipEntry) => {
            if (zipEntry.dir) return;
            if (relativePath.includes("__MACOSX")) return;
            const lower = relativePath.toLowerCase();
            if (
              lower.endsWith(".jpg") ||
              lower.endsWith(".jpeg") ||
              lower.endsWith(".png") ||
              lower.endsWith(".webp")
            ) {
              imageEntries.push({ path: relativePath, file: zipEntry });
            }
          });

          for (const entry of imageEntries) {
            const blob = await entry.file.async("blob");
            const fileName = entry.path.split("/").pop() || entry.path;
            const mime = fileName.toLowerCase().endsWith(".png")
              ? "image/png"
              : fileName.toLowerCase().endsWith(".webp")
              ? "image/webp"
              : "image/jpeg";
            const file = new File([blob], fileName, { type: mime, lastModified: Date.now() });
            extracted.push(file);
          }
          toast.success(`تم استخراج ${imageEntries.length} صورة من ${item.name}`);
        } catch (err: any) {
          toast.error(`فشل فك ضغط ${item.name}: ${err?.message || "ملف تالف"}`);
        } finally {
          setIsExtractingZip(false);
        }
      } else {
        extracted.push(item);
      }
    }

    if (extracted.length === 0) {
      if (hadZip) toast.warning("لم يتم العثور على أي صور (JPG/PNG/WEBP) داخل ملف ZIP");
      return;
    }

    setFiles((prev) => {
      // دمج الملفات مع تجنب التكرار بالاسم والحجم
      const existingKey = new Set(prev.map((f) => `${f.name}:${f.size}`));
      const toAdd = extracted.filter((f) => !existingKey.has(`${f.name}:${f.size}`));
      return [...prev, ...toAdd];
    });
    // إعادة تعيين التجزئة
    setVisibleCount(200);
  }, []);

  // سحب وإفلات
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (isUploading) return;
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFilesAdded(e.dataTransfer.files);
      }
    },
    [isUploading, handleFilesAdded]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // تبديل اختيار صف معين
  const toggleRowSelection = useCallback(
    (cleanFileName: string, currentSelected: boolean) => {
      setSelectionOverrides((prev) => {
        const next = new Map(prev);
        next.set(cleanFileName, !currentSelected);
        return next;
      });
    },
    []
  );

  // تحديد / إلغاء تحديد كل الصفوف المصفاة
  const toggleSelectAllVisible = useCallback(() => {
    const selectable = filteredResults.filter(
      (r) => r.status !== "unmatched" && r.status !== "invalid"
    );
    if (selectable.length === 0) return;

    const allCurrentlySelected = selectable.every((r) => isRowSelected(r));
    setSelectionOverrides((prev) => {
      const next = new Map(prev);
      for (const r of selectable) {
        next.set(r.cleanFileName, !allCurrentlySelected);
      }
      return next;
    });
  }, [filteredResults, isRowSelected]);

  // مسح الكل
  const handleClearAll = useCallback(() => {
    if (isUploading) return;
    setFiles([]);
    setSelectionOverrides(new Map());
    setUploadStates({});
    setVisibleCount(200);
    setSearchQuery("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
  }, [isUploading]);

  // تصدير تقرير CSV
  const handleDownloadCsv = useCallback(() => {
    if (matchResults.length === 0) return;
    const csvContent = generateMatchCsvReport(matchResults);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `تقرير_مطابقة_صور_المنخرطين_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير تقرير المطابقة بصيغة CSV");
  }, [matchResults]);

  // ─────────────────────────────────────────────────────────────
  // محرك الرفع بالتوازي (Concurrency = 2) مع إعادة المحاولة والإيقاف
  // ─────────────────────────────────────────────────────────────
  const uploadSinglePhoto = useCallback(
    async (row: MatchResultItem, attempt = 1): Promise<{ success: boolean; error?: string }> => {
      const subscriberId = row.matchedSubscriber?.id;
      if (!subscriberId) {
        return { success: false, error: "لا يوجد معرّف منخرط" };
      }

      const fileObj = row.file.file || filesByName.get(row.cleanFileName);
      if (!fileObj) {
        return { success: false, error: "الملف الأصلي غير متوفر" };
      }

      try {
        // 1. قراءة الملف dataURL
        const dataUrl = await fileToDataURL(fileObj);

        // 2. معالجة الوجه والقص في المتصفح
        const processed = await processPhoto(dataUrl, {
          enableFaceDetection,
          targetSize: 300,
          thumbSize: 100,
          quality: 0.85,
        });

        // 3. تصغير الصورة الأصلية بحد أقصى 800px وجودة 0.8 لتجنب تضخيم قاعدة البيانات
        const downscaledOriginal = await makeDownscaledOriginal(dataUrl, 800, 0.8);

        // 4. الإرسال إلى API
        const res = await fetch(`/api/subscribers/${encodeURIComponent(subscriberId)}/photo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            original: downscaledOriginal,
            cropped: processed.cropped,
            thumbnail: processed.thumbnail,
            faceDetected: processed.faceDetected,
          }),
        });

        if (res.ok) {
          return { success: true };
        }

        // أخطاء العميل 4xx دائمة فلا نعيد المحاولة
        if (res.status >= 400 && res.status < 500) {
          let msg = `خطأ ${res.status}`;
          try {
            const errData = await res.json();
            if (errData.error) msg = errData.error;
          } catch {}
          return { success: false, error: msg };
        }

        // أخطاء الخادم 5xx أو غيرها قد تكون مؤقتة: إعادة المحاولة حتى محاولتين
        if (attempt <= 2) {
          await new Promise((r) => setTimeout(r, 600 * attempt));
          return uploadSinglePhoto(row, attempt + 1);
        }

        return { success: false, error: `خطأ في الخادم (${res.status})` };
      } catch (err: any) {
        // أخطاء الشبكة: إعادة المحاولة
        if (attempt <= 2) {
          await new Promise((r) => setTimeout(r, 600 * attempt));
          return uploadSinglePhoto(row, attempt + 1);
        }
        return { success: false, error: err?.message || "فشل الاتصال بالشبكة" };
      }
    },
    [enableFaceDetection, filesByName]
  );

  const startUploadQueue = useCallback(
    async (itemsToUpload: MatchResultItem[]) => {
      if (itemsToUpload.length === 0) return;

      cancelledRef.current = false;
      setIsUploading(true);
      setUploadProgress({ done: 0, total: itemsToUpload.length });

      // تهيئة حالات الصفوف المحددة إلى idle
      setUploadStates((prev) => {
        const next = { ...prev };
        for (const item of itemsToUpload) {
          next[item.cleanFileName] = { status: "idle" };
        }
        return next;
      });

      let queueIndex = 0;
      let completedCount = 0;
      let successCount = 0;
      let errorCount = 0;

      // عامل توازي (Worker)
      const worker = async () => {
        while (queueIndex < itemsToUpload.length && !cancelledRef.current) {
          const currentIndex = queueIndex++;
          const row = itemsToUpload[currentIndex];

          // تعيين جاري الرفع
          setUploadStates((prev) => ({
            ...prev,
            [row.cleanFileName]: { status: "uploading" },
          }));

          const res = await uploadSinglePhoto(row);

          completedCount++;
          if (res.success) {
            successCount++;
          } else {
            errorCount++;
          }

          setUploadProgress({ done: completedCount, total: itemsToUpload.length });
          setUploadStates((prev) => ({
            ...prev,
            [row.cleanFileName]: {
              status: res.success ? "success" : "error",
              error: res.error,
            },
          }));
        }
      };

      // تشغيل عاملين بالتوازي (Concurrency = 2)
      await Promise.all([worker(), worker()]);

      setIsUploading(false);

      if (cancelledRef.current) {
        toast.info(`تم إيقاف الرفع. تم بنجاح: ${successCount}، المتبقي: ${itemsToUpload.length - completedCount}`);
      } else {
        if (errorCount === 0) {
          toast.success(`اكتمل الرفع بنجاح! تم رفع ${successCount} صورة.`);
        } else {
          toast.warning(`اكتمل الرفع مع ملاحظات: ${successCount} تم بنجاح، ${errorCount} فشل.`);
        }
      }

      // إشعار التطبيق بتحديث البيانات
      if (successCount > 0) {
        onDone?.();
      }
    },
    [uploadSinglePhoto, onDone]
  );

  // بدء رفع الصور المحددة
  const handleStartUpload = useCallback(() => {
    const items = matchResults.filter(
      (r) => isRowSelected(r) && r.status === "matched" && r.matchedSubscriber
    );
    if (items.length === 0) {
      toast.info("لا توجد صور محددة ومطابقة للرفع");
      return;
    }
    startUploadQueue(items);
  }, [matchResults, isRowSelected, startUploadQueue]);

  // إعادة محاولة العناصر الفاشلة
  const handleRetryFailed = useCallback(() => {
    const failedItems = matchResults.filter(
      (r) =>
        isRowSelected(r) &&
        r.status === "matched" &&
        r.matchedSubscriber &&
        uploadStates[r.cleanFileName]?.status === "error"
    );
    if (failedItems.length === 0) {
      toast.info("لا توجد صور فاشلة لإعادة المحاولة");
      return;
    }
    startUploadQueue(failedItems);
  }, [matchResults, isRowSelected, uploadStates, startUploadQueue]);

  // إيقاف الرفع
  const handleStopUpload = useCallback(() => {
    cancelledRef.current = true;
    toast.info("جاري إيقاف المهام غير المنتهية...");
  }, []);

  // شارة الحالة
  const renderStatusBadge = (row: MatchResultItem) => {
    if (row.status === "matched") {
      switch (row.confidence) {
        case "exact":
          return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[11px]"><CheckCircle2 className="w-3 h-3" /> مطابقة تامة</Badge>;
        case "normalized":
          return <Badge variant="outline" className="bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/30 gap-1 text-[11px]"><CheckCircle2 className="w-3 h-3" /> تطبيع اسم</Badge>;
        case "copy":
          return <Badge variant="outline" className="bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30 gap-1 text-[11px]"><Copy className="w-3 h-3" /> نسخة مكررة</Badge>;
        case "digits":
          return <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 text-[11px]"><Hash className="w-3 h-3" /> أرقام فقط</Badge>;
      }
    }
    if (row.status === "ambiguous") {
      return <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30 gap-1 text-[11px]"><HelpCircle className="w-3 h-3" /> غامض ({row.ambiguousCandidates?.length || 0})</Badge>;
    }
    if (row.status === "duplicate") {
      return <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 text-[11px]"><Copy className="w-3 h-3" /> مكرر (ملف آخر فاز)</Badge>;
    }
    if (row.status === "invalid") {
      return <Badge variant="outline" className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 gap-1 text-[11px]"><XCircle className="w-3 h-3" /> غير صالح</Badge>;
    }
    return <Badge variant="outline" className="bg-muted text-muted-foreground border-border gap-1 text-[11px]"><AlertCircle className="w-3 h-3" /> غير موجود</Badge>;
  };

  // أيقونة حالة الرفع المباشرة
  const renderUploadState = (cleanFileName: string) => {
    const s = uploadStates[cleanFileName];
    if (!s || s.status === "idle") return null;
    if (s.status === "uploading") {
      return (
        <span className="flex items-center gap-1 text-xs text-primary font-medium animate-pulse">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> جاري المعالجة...
        </span>
      );
    }
    if (s.status === "success") {
      return (
        <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
          <CheckCircle2 className="w-3.5 h-3.5" /> تم الرفع
        </span>
      );
    }
    if (s.status === "error") {
      return (
        <span className="flex items-center gap-1 text-xs text-rose-600 font-medium" title={s.error}>
          <XCircle className="w-3.5 h-3.5" /> {s.error || "فشل الرفع"}
        </span>
      );
    }
    return null;
  };

  const hasFailedUploads = useMemo(() => {
    return Object.values(uploadStates).some((s) => s.status === "error");
  }, [uploadStates]);

  return (
    <div className={cn("rounded-2xl border border-border/60 bg-card p-5 space-y-5", className)}>
      {/* ─── ترويسة المكوّن ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <h3 className="font-bold text-base flex items-center gap-2 text-foreground">
            <FolderUp className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            رفع صور المنخرطين الجماعي بالمطابقة التلقائية
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            ارفع ملفات الصور دفعة واحدة أو مجلداً كاملاً؛ سيقوم النظام بربط كل صورة بالمنخرط المطابق حسب رقم الملف (مثل RCS001.jpg أو P2-RCS001.png).
          </p>
        </div>

        {/* أزرار الإجراءات السريعة */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportMissingPhotosList}
            disabled={isUploading}
            className="text-xs h-8 gap-1.5 border-teal-500/30 text-teal-700 dark:text-teal-300 hover:bg-teal-500/10"
            title="تصدير قائمة أرقام وأسماء المنخرطين الذين ليس لديهم صورة لتسليمها للمصور"
          >
            <FileText className="w-3.5 h-3.5" /> قائمة المصور (الملفات المطلوبة)
          </Button>

          {files.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadCsv}
                disabled={isUploading}
                className="text-xs h-8 gap-1"
              >
                <Download className="w-3.5 h-3.5" /> تقرير CSV
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                disabled={isUploading}
                className="text-xs h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 gap-1"
              >
                <X className="w-3.5 h-3.5" /> مسح الكل
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ─── منطقة السحب والإفلات وأزرار الاختيار ─── */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={cn(
          "border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-200",
          files.length === 0
            ? "border-teal-500/40 bg-teal-500/5 hover:border-teal-500/70 hover:bg-teal-500/10 p-8"
            : "border-border/60 bg-muted/20 hover:border-border"
        )}
      >
        {/* حقول الإدخال المخفية */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp,.zip,application/zip,application/x-zip-compressed"
          onChange={(e) => e.target.files && handleFilesAdded(e.target.files)}
          className="hidden"
          disabled={isUploading || isExtractingZip}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          // @ts-expect-error webkitdirectory is standard in browsers but not yet in react types
          webkitdirectory=""
          directory=""
          onChange={(e) => e.target.files && handleFilesAdded(e.target.files)}
          className="hidden"
          disabled={isUploading || isExtractingZip}
        />

        <div className="flex flex-col items-center justify-center max-w-md mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-3 shadow-inner">
            {isExtractingZip ? (
              <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
            ) : (
              <Upload className="w-6 h-6" />
            )}
          </div>

          <p className="font-semibold text-sm text-foreground mb-1">
            {isExtractingZip ? "جاري فك ضغط الأرشيف واستخراج الصور..." : "اسحب وأفلت صور المنخرطين أو ملف ZIP هنا"}
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            يدعم صور JPG و PNG و WEBP وأرشيف ZIP (حتى 10MB للملف). يُطابق اسم الملف مع رقم ملف المنخرط تلقائياً.
          </p>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isExtractingZip}
              className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5 shadow-sm"
            >
              <ImageIcon className="w-4 h-4" /> اختيار صور / ZIP
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => folderInputRef.current?.click()}
              disabled={isUploading || isExtractingZip}
              className="gap-1.5 border-teal-500/30 hover:bg-teal-500/10 text-teal-700 dark:text-teal-300"
            >
              <FolderUp className="w-4 h-4" /> اختيار مجلد كامل
            </Button>
          </div>
        </div>
      </div>

      {/* ─── الخيارات وشريط الملخص وقائمة المعاينة (تظهر فقط عند وجود ملفات) ─── */}
      {files.length > 0 && (
        <div className="space-y-4">
          {/* خيارات المعالجة والمسبح */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border/60 bg-muted/30">
            <div className="flex items-center gap-6 flex-wrap">
              {/* خيار استبدال الصور الموجودة */}
              <div className="flex items-center space-x-2 space-x-reverse">
                <Switch
                  id="replace-existing"
                  checked={replaceExisting}
                  onCheckedChange={setReplaceExisting}
                  disabled={isUploading}
                />
                <Label htmlFor="replace-existing" className="text-xs cursor-pointer select-none">
                  استبدال الصور الموجودة مسبقاً
                </Label>
              </div>

              {/* خيار اكتشاف الوجه تلقائياً */}
              <div className="flex items-center space-x-2 space-x-reverse">
                <Switch
                  id="face-detect"
                  checked={enableFaceDetection}
                  onCheckedChange={setEnableFaceDetection}
                  disabled={isUploading}
                />
                <Label htmlFor="face-detect" className="text-xs cursor-pointer select-none flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-teal-500" />
                  اكتشاف الوجه وقص ذكي تلقائياً
                </Label>
              </div>
            </div>

            {/* فلتر المسبح إذا كان النادي يحتوي على أكثر من مسبح */}
            {pools.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">المسبح المستهدف:</span>
                <select
                  value={selectedPoolId}
                  onChange={(e) => setSelectedPoolId(e.target.value)}
                  disabled={isUploading}
                  className="text-xs rounded-lg border border-border bg-background px-2.5 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">جميع المسابح</option>
                  {pools.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* ─── شريط الملخص الرقمي ─── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            <div className="p-2.5 rounded-xl border border-border/60 bg-card text-center">
              <span className="text-[10px] text-muted-foreground block">إجمالي الملفات</span>
              <span className="text-base font-bold text-foreground">{baseSummary.total}</span>
            </div>
            <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-center">
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block">مطابق</span>
              <span className="text-base font-bold text-emerald-700 dark:text-emerald-400">{baseSummary.matched}</span>
            </div>
            <div className="p-2.5 rounded-xl border border-teal-500/30 bg-teal-500/5 text-center">
              <span className="text-[10px] text-teal-700 dark:text-teal-400 block">المحدد للرفع</span>
              <span className="text-base font-bold text-teal-700 dark:text-teal-400">{selectedCount}</span>
            </div>
            <div className="p-2.5 rounded-xl border border-blue-500/30 bg-blue-500/5 text-center">
              <span className="text-[10px] text-blue-700 dark:text-blue-400 block">لديه صورة</span>
              <span className="text-base font-bold text-blue-700 dark:text-blue-400">{baseSummary.hasPhoto}</span>
            </div>
            <div className="p-2.5 rounded-xl border border-purple-500/30 bg-purple-500/5 text-center">
              <span className="text-[10px] text-purple-700 dark:text-purple-400 block">غامض</span>
              <span className="text-base font-bold text-purple-700 dark:text-purple-400">{baseSummary.ambiguous}</span>
            </div>
            <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 text-center">
              <span className="text-[10px] text-amber-700 dark:text-amber-400 block">مكرر</span>
              <span className="text-base font-bold text-amber-700 dark:text-amber-400">{baseSummary.duplicate}</span>
            </div>
            <div className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/5 text-center">
              <span className="text-[10px] text-rose-700 dark:text-rose-400 block">غير موجود</span>
              <span className="text-base font-bold text-rose-700 dark:text-rose-400">{baseSummary.unmatched}</span>
            </div>
            <div className="p-2.5 rounded-xl border border-border/60 bg-muted/40 text-center">
              <span className="text-[10px] text-muted-foreground block">غير صالح</span>
              <span className="text-base font-bold text-muted-foreground">{baseSummary.invalid}</span>
            </div>
          </div>

          {/* ─── أزرار التحكم بالرفع وشريط التقدم ─── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-teal-500/30 bg-gradient-to-r from-teal-500/10 via-background to-card shadow-sm">
            <div className="flex items-center gap-3">
              {!isUploading ? (
                <Button
                  onClick={handleStartUpload}
                  disabled={selectedCount === 0}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold gap-2 shadow-sm"
                >
                  <Play className="w-4 h-4 fill-current" />
                  رفع {selectedCount} صورة محددة
                </Button>
              ) : (
                <Button
                  onClick={handleStopUpload}
                  variant="destructive"
                  className="font-semibold gap-2 shadow-sm"
                >
                  <StopIcon className="w-4 h-4 fill-current" />
                  إيقاف مؤقت
                </Button>
              )}

              {hasFailedUploads && !isUploading && (
                <Button
                  onClick={handleRetryFailed}
                  variant="outline"
                  className="border-rose-500/30 text-rose-600 hover:bg-rose-500/10 gap-1.5"
                >
                  <RefreshCw className="w-4 h-4" />
                  إعادة محاولة الفاشلة
                </Button>
              )}
            </div>

            {/* مؤشر التقدم أثناء الرفع */}
            {isUploading && (
              <div className="flex-1 max-w-xs space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>جاري الرفع...</span>
                  <span className="font-mono font-semibold text-foreground">
                    {uploadProgress.done} / {uploadProgress.total}
                  </span>
                </div>
                <Progress
                  value={uploadProgress.total > 0 ? (uploadProgress.done / uploadProgress.total) * 100 : 0}
                  className="h-2"
                />
              </div>
            )}
          </div>

          {/* ─── أدوات التصفية والبحث والجدول ─── */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* شرائح التصفية */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  variant={filterTab === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterTab("all")}
                  className={cn("h-7 text-xs px-2.5", filterTab === "all" ? "bg-primary" : "")}
                >
                  الكل ({baseSummary.total})
                </Button>
                <Button
                  variant={filterTab === "matched" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterTab("matched")}
                  className={cn("h-7 text-xs px-2.5", filterTab === "matched" ? "bg-emerald-600 hover:bg-emerald-700" : "")}
                >
                  مطابق ({baseSummary.matched})
                </Button>
                <Button
                  variant={filterTab === "review" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterTab("review")}
                  className={cn("h-7 text-xs px-2.5", filterTab === "review" ? "bg-amber-600 hover:bg-amber-700" : "")}
                >
                  يحتاج مراجعة ({baseSummary.ambiguous + baseSummary.digitsOnly + baseSummary.duplicate})
                </Button>
                <Button
                  variant={filterTab === "has_photo" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterTab("has_photo")}
                  className={cn("h-7 text-xs px-2.5", filterTab === "has_photo" ? "bg-blue-600 hover:bg-blue-700" : "")}
                >
                  لديه صورة ({baseSummary.hasPhoto})
                </Button>
                <Button
                  variant={filterTab === "unmatched" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterTab("unmatched")}
                  className={cn("h-7 text-xs px-2.5", filterTab === "unmatched" ? "bg-rose-600 hover:bg-rose-700" : "")}
                >
                  غير مطابق / تالف ({baseSummary.unmatched + baseSummary.invalid})
                </Button>
              </div>

              {/* حقل البحث وزر تحديد الكل */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSelectAllVisible}
                  className="h-8 text-xs gap-1"
                  title="تحديد أو إلغاء تحديد الظاهر"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-primary" /> تحديد الظاهر
                </Button>

                <div className="relative w-44 sm:w-56">
                  <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="بحث برقم أو اسم..."
                    className="h-8 text-xs pr-8 pl-7"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ─── جدول معاينة المطابقة ─── */}
            <div className="rounded-xl border border-border/60 overflow-hidden bg-background">
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-xs text-right border-collapse">
                  <thead className="bg-muted/60 sticky top-0 z-10 border-b border-border/60 backdrop-blur-sm">
                    <tr>
                      <th className="p-2.5 w-10 text-center">
                        <span className="sr-only">تحديد</span>
                      </th>
                      <th className="p-2.5 w-14 text-center">المعاينة</th>
                      <th className="p-2.5">اسم ملف الصورة</th>
                      <th className="p-2.5">المنخرط المطابق</th>
                      <th className="p-2.5">حالة المطابقة</th>
                      <th className="p-2.5">ملاحظات / سبب النتيجة</th>
                      <th className="p-2.5 text-left w-32">حالة الرفع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {displayedResults.map((row) => {
                      const selected = isRowSelected(row);
                      const isSelectable = row.status !== "unmatched" && row.status !== "invalid";
                      const currentUpload = uploadStates[row.cleanFileName];
                      const matchedPool = row.matchedSubscriber?.poolName || row.matchedSubscriber?.pool;

                      return (
                        <tr
                          key={row.cleanFileName}
                          className={cn(
                            "transition-colors hover:bg-muted/40",
                            selected && "bg-teal-500/5 dark:bg-teal-500/10",
                            currentUpload?.status === "uploading" && "bg-primary/5",
                            currentUpload?.status === "success" && "bg-emerald-500/5",
                            currentUpload?.status === "error" && "bg-rose-500/5"
                          )}
                        >
                          {/* مربع التحديد */}
                          <td className="p-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={!isSelectable || isUploading}
                              onChange={() => toggleRowSelection(row.cleanFileName, selected)}
                              className="rounded border-border text-teal-600 focus:ring-teal-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            />
                          </td>

                          {/* المعاينة المصغرة */}
                          <td className="p-2.5 text-center">
                            <FileThumbnail file={row.file.file || filesByName.get(row.cleanFileName)} />
                          </td>

                          {/* اسم الملف والحجم */}
                          <td className="p-2.5">
                            <div className="font-mono font-medium text-foreground text-[11px] truncate max-w-[200px]" title={row.cleanFileName}>
                              {row.cleanFileName}
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {(row.file.size / 1024).toFixed(1)} KB
                            </span>
                          </td>

                          {/* المنخرط المطابق */}
                          <td className="p-2.5">
                            {row.matchedSubscriber ? (
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-foreground text-[11px]">
                                    {row.matchedSubscriber.fileNumber}
                                  </span>
                                  {matchedPool && (
                                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                                      {matchedPool}
                                    </Badge>
                                  )}
                                  {row.hasExistingPhoto && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-blue-500/30 text-blue-600">
                                      لديه صورة
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                  {row.matchedSubscriber.firstName} {row.matchedSubscriber.lastName}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">—</span>
                            )}
                          </td>

                          {/* شارة حالة المطابقة */}
                          <td className="p-2.5 whitespace-nowrap">
                            {renderStatusBadge(row)}
                          </td>

                          {/* ملاحظات / سبب النتيجة */}
                          <td className="p-2.5 text-[11px] text-muted-foreground max-w-[240px]">
                            {row.ambiguousCandidates && row.ambiguousCandidates.length > 0 ? (
                              <div className="text-purple-700 dark:text-purple-400">
                                مرشحون محتملون: {row.ambiguousCandidates.map((c) => c.fileNumber).join(", ")}
                              </div>
                            ) : (
                              <span>{row.reason || "—"}</span>
                            )}
                          </td>

                          {/* حالة الرفع */}
                          <td className="p-2.5 text-left whitespace-nowrap">
                            {renderUploadState(row.cleanFileName)}
                          </td>
                        </tr>
                      );
                    })}

                    {filteredResults.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-muted-foreground">
                          لا توجد نتائج مطابقة لمعايير البحث أو التصفية الحالية
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* زر عرض المزيد إذا كان هناك أكثر من 200 صف */}
              {filteredResults.length > visibleCount && (
                <div className="p-3 bg-muted/30 border-t border-border/60 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVisibleCount((prev) => prev + 200)}
                    className="text-xs h-8 gap-1.5"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                    عرض 200 صف إضافي (يُعرض حالياً {displayedResults.length} من أصل {filteredResults.length})
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

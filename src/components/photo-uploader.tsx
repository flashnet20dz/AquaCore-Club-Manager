"use client";

/**
 * ═══════════════════════════════════════════════════════════════
 *  PhotoUploader — إدارة الصورة الشخصية للمنخرط
 * ═══════════════════════════════════════════════════════════════
 *
 *  مكوّن احترافي لرفع / التقاط / حذف صورة المنخرط مع:
 *  - معالجة ذكية (اكتشاف الوجه + قص + تحسين) عبر lib/photo-processing
 *  - رفع للخادم عبر POST /api/subscribers/[id]/photo
 *  - واجهة Drag & Drop
 *  - التقاط بالكاميرا (getUserMedia)
 *  - واجهة متفائلة + toast للنجاح/الخطأ
 *  - RTL، تصميم AquaCore (teal/sky gradients)
 */

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  User,
  Upload,
  Camera,
  Trash2,
  RefreshCw,
  Loader2,
  Image as ImageIcon,
  AlertCircle,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  processPhoto,
  validateImageFile,
  type ProcessedImage,
} from "@/lib/photo-processing";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface PhotoUploaderProps {
  /** معرّف المنخرط (إذا undefined → temp mode: لا يرفع للـ API، فقط يُرجع البيانات) */
  subscriberId?: string;
  /** الصورة الحالية (data URL أو null) */
  currentPhoto?: string | null;
  /** يُستدعى عند تغيّر الصورة (cropped) أو حذفها (null) */
  onPhotoChange?: (dataUrl: string | null) => void;
  /** في temp mode: يُستدعى بالبيانات الكاملة للصورة المعالجة (original+cropped+thumbnail+faceDetected) */
  onPhotoProcessed?: (data: { original: string; cropped: string; thumbnail: string; faceDetected: boolean } | null) => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp";

function photoEndpoint(subscriberId: string): string {
  return `/api/subscribers/${encodeURIComponent(subscriberId)}/photo`;
}

export function PhotoUploader({
  subscriberId,
  currentPhoto,
  onPhotoChange,
  onPhotoProcessed,
  disabled,
}: PhotoUploaderProps) {
  // ─── Displayed photo state (synced from prop via "adjust during render") ───
  // نمط React الموصى به لمزامنة state مع prop بدون useEffect (تفادي setState-in-effect)
  const propPhoto = currentPhoto ?? null;
  const [photoUrl, setPhotoUrl] = useState<string | null>(propPhoto);
  const [prevPropPhoto, setPrevPropPhoto] = useState<string | null>(propPhoto);
  if (prevPropPhoto !== propPhoto) {
    setPrevPropPhoto(propPhoto);
    setPhotoUrl(propPhoto);
  }

  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Camera state
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraSaving, setCameraSaving] = useState(false);

  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Ref mirror of the displayed photo so async handlers can read the latest
  // value for optimistic-revert without stale-closure issues.
  const photoUrlRef = useRef<string | null>(photoUrl);
  useEffect(() => {
    photoUrlRef.current = photoUrl;
  }, [photoUrl]);

  // ─── Camera helpers ───────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch {
        /* ignore */
      }
    }
  }, []);

  // startCamera contains NO synchronous setState — all setState calls happen
  // after `await`, so the effect that invokes it is not flagged by
  // react-hooks/set-state-in-effect.
  const startCamera = useCallback(async () => {
    try {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        throw new Error("المتصفح لا يدعم الكاميرا");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {
          /* autoplay may be blocked; muted+playsInline should allow it */
        });
      }
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      const errName = err?.name || "";
      let msg = "تعذّر الوصول إلى الكاميرا";
      if (
        errName === "NotAllowedError" ||
        errName === "PermissionDeniedError"
      ) {
        msg = "تم رفض إذن الكاميرا. يرجى السماح بالوصول من إعدادات المتصفح.";
      } else if (
        errName === "NotFoundError" ||
        errName === "DevicesNotFoundError" ||
        errName === "OverconstrainedError"
      ) {
        msg = "لم يتم العثور على كاميرا متاحة على هذا الجهاز.";
      } else if (errName === "NotReadableError") {
        msg = "الكاميرا قيد الاستخدام من قبل تطبيق آخر.";
      } else if (err?.message) {
        msg = err.message;
      }
      setCameraError(msg);
    } finally {
      setCameraStarting(false);
    }
  }, []);

  // Synchronous resets live in the click handler (not in an effect),
  // so they don't trigger react-hooks/set-state-in-effect.
  const openCamera = useCallback(() => {
    setCapturedImage(null);
    setCameraError(null);
    setCameraStarting(true);
    setCameraOpen(true);
  }, []);

  // Manage camera lifecycle: start when dialog opens, stop when it closes.
  // This is a legitimate external-system sync (MediaStream). The setState
  // calls inside startCamera happen after `await getUserMedia` (async), not
  // synchronously within this effect body — but the linter's interprocedural
  // analysis is conservative, so we silence it here with justification.
  useEffect(() => {
    if (cameraOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [cameraOpen, startCamera, stopCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // ─── Upload helper ────────────────────────────────────────────────
  const uploadProcessed = useCallback(
    async (processed: ProcessedImage): Promise<void> => {
      setIsUploading(true);
      try {
        // 🔑 Temp mode (new subscriber, no id yet): لا ترفع للـ API، فقط أرجع البيانات
        if (!subscriberId) {
          onPhotoChange?.(processed.cropped);
          onPhotoProcessed?.({
            original: processed.original,
            cropped: processed.cropped,
            thumbnail: processed.thumbnail,
            faceDetected: processed.faceDetected,
          });
          toast.success("✓ تم التقاط الصورة", {
            description: processed.faceDetected
              ? "تم اكتشاف الوجه تلقائياً — ستُحفظ بعد تسجيل المنخرط"
              : "لم يتم اكتشاف وجه — ستُحفظ بعد تسجيل المنخرط",
          });
          return;
        }

        // Normal mode: ارفع للـ API
        const res = await fetch(photoEndpoint(subscriberId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            original: processed.original,
            cropped: processed.cropped,
            thumbnail: processed.thumbnail,
            faceDetected: processed.faceDetected,
          }),
        });
        if (!res.ok) {
          let msg = "فشل رفع الصورة";
          try {
            const d = await res.json();
            if (d?.error) msg = d.error;
          } catch {
            /* ignore */
          }
          throw new Error(msg);
        }
        onPhotoChange?.(processed.cropped);
        toast.success("✓ تم حفظ الصورة الشخصية", {
          description: processed.faceDetected
            ? "تم اكتشاف الوجه تلقائياً"
            : "لم يتم اكتشاف وجه — يُنصح بإعادة التصوير",
        });
      } catch (e: unknown) {
        const err = e as { message?: string };
        toast.error("فشل رفع الصورة", {
          description: err?.message || "خطأ غير متوقع",
        });
        throw e;
      } finally {
        setIsUploading(false);
      }
    },
    [subscriberId, onPhotoChange, onPhotoProcessed]
  );

  // ─── Process + upload from File or dataURL ────────────────────────
  const handleProcessAndUpload = useCallback(
    async (input: File | string): Promise<void> => {
      // Validate File (strings from camera are already JPEG dataURLs)
      if (input instanceof File) {
        const v = validateImageFile(input);
        if (!v.valid) {
          toast.error("ملف غير صالح", { description: v.error });
          return;
        }
      }

      setIsProcessing(true);
      setProcessingMessage("جاري المعالجة الذكية...");
      setWarning(null);

      let processed: ProcessedImage;
      try {
        processed = await processPhoto(input);
      } catch (e: unknown) {
        const err = e as { message?: string };
        toast.error("فشلت معالجة الصورة", {
          description: err?.message || "خطأ غير متوقع",
        });
        setIsProcessing(false);
        setProcessingMessage("");
        return;
      }

      setFaceDetected(processed.faceDetected);
      setWarning(processed.warning ?? null);

      // Optimistic preview immediately
      const prevPhoto = photoUrlRef.current;
      setPhotoUrl(processed.cropped);
      setIsProcessing(false);
      setProcessingMessage("");

      // Upload in background (awaited for error handling)
      try {
        await uploadProcessed(processed);
      } catch {
        // Revert optimistic preview on failure
        setPhotoUrl(prevPhoto);
        setWarning(null);
        setFaceDetected(false);
      }
    },
    [uploadProcessed]
  );

  // ─── File input ───────────────────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleProcessAndUpload(file);
    // reset so the same file can be re-selected later
    e.target.value = "";
  };

  // ─── Drag & drop ──────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled || isProcessing || isUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void handleProcessAndUpload(file);
  };

  // ─── Camera capture ───────────────────────────────────────────────
  const captureFrame = () => {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImage(dataUrl);
  };

  const saveCapture = async () => {
    if (!capturedImage) return;
    setCameraSaving(true);
    try {
      await handleProcessAndUpload(capturedImage);
      setCameraOpen(false);
    } finally {
      setCameraSaving(false);
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      // 🔑 Temp mode: لا حاجة لطلب API، فقط امسح الحالة
      if (!subscriberId) {
        setPhotoUrl(null);
        setWarning(null);
        setFaceDetected(false);
        onPhotoChange?.(null);
        onPhotoProcessed?.(null);
        toast.success("تم حذف الصورة");
        setDeleteOpen(false);
        return;
      }

      const res = await fetch(photoEndpoint(subscriberId), {
        method: "DELETE",
      });
      if (!res.ok) {
        let msg = "فشل حذف الصورة";
        try {
          const d = await res.json();
          if (d?.error) msg = d.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      setPhotoUrl(null);
      setWarning(null);
      setFaceDetected(false);
      onPhotoChange?.(null);
      toast.success("تم حذف الصورة الشخصية");
      setDeleteOpen(false);
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error("فشل الحذف", { description: err?.message || "خطأ غير متوقع" });
    } finally {
      setIsDeleting(false);
    }
  };

  const busy = isProcessing || isUploading || disabled;

  return (
    <Card className="gap-0 overflow-hidden rounded-2xl border-border/60 p-0">
      <CardHeader className="border-b bg-gradient-to-l from-teal-500/10 to-sky-500/10 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-sky-500 text-white shadow-sm">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">الصورة الشخصية</CardTitle>
              <CardDescription className="text-xs">
                رفع أو التقاط صورة المنخرط مع اكتشاف الوجه تلقائياً
              </CardDescription>
            </div>
          </div>
          {photoUrl && !isProcessing && (
            <Badge
              variant={faceDetected ? "default" : "secondary"}
              className={cn(
                "gap-1",
                faceDetected
                  ? "bg-gradient-to-l from-teal-500 to-sky-500 text-white"
                  : "border-amber-400/60 bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
              )}
            >
              {faceDetected ? (
                <>
                  <Check className="h-3 w-3" /> وجه
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3" /> بدون وجه
                </>
              )}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-6">
        {/* Preview frame */}
        <div className="flex justify-center">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "relative aspect-square w-[200px] shrink-0 overflow-hidden rounded-2xl border-2 border-dashed bg-muted/30 transition-colors",
              isDragging ? "border-teal-500 bg-teal-500/10" : "border-border",
              busy && "opacity-90"
            )}
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="صورة المنخرط"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center text-muted-foreground/70">
                <User className="h-16 w-16" />
                <span className="mt-2 text-xs">لا توجد صورة</span>
              </div>
            )}

            {/* Drag hint */}
            {!photoUrl && !isProcessing && !isDragging && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-2 text-center text-[11px] text-white">
                اسحب الصورة هنا
              </div>
            )}

            {/* Processing / uploading overlay */}
            {(isProcessing || isUploading) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 text-white backdrop-blur-sm">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-xs font-medium">
                  {isProcessing
                    ? processingMessage || "جاري المعالجة..."
                    : "جاري الحفظ..."}
                </span>
              </div>
            )}

            {/* Drag-over highlight */}
            {isDragging && !isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center bg-teal-500/15 text-sm font-medium text-teal-700 dark:text-teal-200">
                أفلت للرفع
              </div>
            )}
          </div>
        </div>

        {/* Face detection warning */}
        {warning && !isProcessing && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="text-xs leading-relaxed">{warning}</div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {!photoUrl ? (
            <>
              <Button
                type="button"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="bg-gradient-to-l from-teal-500 to-sky-500 text-white hover:opacity-90"
              >
                <Upload className="h-4 w-4" />
                رفع صورة
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={openCamera}
                disabled={busy}
              >
                <Camera className="h-4 w-4" />
                التقاط بالكاميرا
              </Button>
            </>
          ) : (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm" disabled={busy}>
                    <RefreshCw className="h-4 w-4" />
                    تغيير
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center">
                  <DropdownMenuItem
                    onSelect={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    رفع صورة جديدة
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={openCamera}>
                    <Camera className="h-4 w-4" />
                    التقاط بالكاميرا
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
                disabled={busy}
              >
                <Trash2 className="h-4 w-4" />
                حذف
              </Button>
            </>
          )}
        </div>

        {/* Hidden file input (accessible via Label) */}
        <Label htmlFor="photo-uploader-file" className="sr-only">
          رفع صورة المنخرط
        </Label>
        <Input
          id="photo-uploader-file"
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={handleInputChange}
          disabled={busy}
        />
      </CardContent>

      {/* ─── Camera Dialog ─────────────────────────────────────────── */}
      <Dialog
        open={cameraOpen}
        onOpenChange={(o) => {
          if (!cameraSaving) setCameraOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-teal-600" />
              التقاط صورة بالكاميرا
            </DialogTitle>
            <DialogDescription>
              وجّه الكاميرا نحو وجه المنخرط ثم اضغط التقاط
            </DialogDescription>
          </DialogHeader>

          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border bg-black">
            {capturedImage ? (
              <img
                src={capturedImage}
                alt="الصورة الملتقطة"
                className="h-full w-full object-cover"
              />
            ) : (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
                {cameraStarting && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="text-xs">جاري تشغيل الكاميرا...</span>
                  </div>
                )}
                {cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-white">
                    <AlertCircle className="h-10 w-10 text-amber-400" />
                    <span className="text-sm">{cameraError}</span>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            {capturedImage ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCapturedImage(null)}
                  disabled={cameraSaving}
                >
                  <RefreshCw className="h-4 w-4" />
                  إعادة
                </Button>
                <Button
                  type="button"
                  onClick={saveCapture}
                  disabled={cameraSaving}
                  className="bg-gradient-to-l from-teal-500 to-sky-500 text-white hover:opacity-90"
                >
                  {cameraSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  حفظ
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCameraOpen(false)}
                  disabled={cameraSaving || cameraStarting}
                >
                  إلغاء
                </Button>
                <Button
                  type="button"
                  onClick={captureFrame}
                  disabled={cameraStarting || !!cameraError}
                  className="bg-gradient-to-l from-teal-500 to-sky-500 text-white hover:opacity-90"
                >
                  <Camera className="h-4 w-4" />
                  التقاط
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete confirm ───────────────────────────────────────── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل تريد حذف الصورة؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف الصورة الشخصية لهذا المنخرط نهائياً. لا يمكن التراجع عن هذا
              الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default PhotoUploader;

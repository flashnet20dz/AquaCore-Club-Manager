/**
 * ═══════════════════════════════════════════════════════════════
 *  معالجة الصور في المتصفح — اكتشاف الوجه + قص + تحسين
 * ═══════════════════════════════════════════════════════════════
 *
 *  يستخدم:
 *  - FaceDetector API (مدعومة في Chrome/Electron) لاكتشاف الوجه
 *  - Canvas API للقص والمعالجة
 *  - fallback: قص ذكي وسط الصورة إن فشل الـ FaceDetector
 *
 *  يعمل 100% في المتصفح/ Electron بدون أي اتصال شبكة.
 */

export interface ProcessedImage {
  original: string;        // base64 JPEG (الصورة الأصلية)
  cropped: string;         // base64 JPEG 300×300 (مقصوصة على الوجه)
  thumbnail: string;       // base64 JPEG 100×100 (نسخة مصغّرة)
  faceDetected: boolean;
  facesCount: number;
  warning?: string;
}

export interface PhotoProcessOptions {
  targetSize?: number;
  thumbSize?: number;
  quality?: number;
  enableFaceDetection?: boolean;
  enhance?: boolean;
}

const DEFAULT_OPTIONS: Required<PhotoProcessOptions> = {
  targetSize: 300,
  thumbSize: 100,
  quality: 0.85,
  enableFaceDetection: true,
  enhance: true,
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("فشل تحميل الصورة"));
    img.src = src;
  });
}

export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("فشل قراءة الملف"));
    reader.readAsDataURL(file);
  });
}

async function detectFaces(img: HTMLImageElement): Promise<{ x: number; y: number; width: number; height: number }[] | null> {
  if (typeof (window as any).FaceDetector === "undefined") {
    return null;
  }
  try {
    const faceDetector = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 20 });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const faces = await faceDetector.detect(canvas);
    return faces.map((f: any) => ({
      x: f.boundingBox.x,
      y: f.boundingBox.y,
      width: f.boundingBox.width,
      height: f.boundingBox.height,
    }));
  } catch (e) {
    console.warn("FaceDetector failed:", e);
    return null;
  }
}

function computeCropBox(
  face: { x: number; y: number; width: number; height: number },
  imgWidth: number,
  imgHeight: number
): { x: number; y: number; size: number } {
  const expandW = face.width * 1.8;
  const expandH = face.height * 2.4;
  const size = Math.min(Math.max(expandW, expandH), Math.min(imgWidth, imgHeight));
  const centerX = face.x + face.width / 2;
  const centerY = face.y + face.height * 0.4;
  let x = centerX - size / 2;
  let y = centerY - size / 2;
  x = Math.max(0, Math.min(x, imgWidth - size));
  y = Math.max(0, Math.min(y, imgHeight - size));
  return { x, y, size };
}

function createThumbnail(img: HTMLImageElement, box: { x: number; y: number; size: number }, thumbSize: number, quality: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = thumbSize;
  canvas.height = thumbSize;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, box.x, box.y, box.size, box.size, 0, 0, thumbSize, thumbSize);
  return canvas.toDataURL("image/jpeg", quality);
}

function enhanceImage(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const contrast = 1.1;
  const brightness = 1.05;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrast + 128 * brightness));
    data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * contrast + 128 * brightness));
    data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * contrast + 128 * brightness));
  }
  ctx.putImageData(imageData, 0, 0);
}

export async function processPhoto(
  input: File | string,
  options: PhotoProcessOptions = {}
): Promise<ProcessedImage> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const dataURL = typeof input === "string" ? input : await fileToDataURL(input);
  const img = await loadImage(dataURL);

  let faces: { x: number; y: number; width: number; height: number }[] | null = null;
  if (opts.enableFaceDetection) {
    faces = await detectFaces(img);
  }

  let cropBox: { x: number; y: number; size: number };
  let faceDetected = false;
  let warning: string | undefined;

  if (faces && faces.length > 0) {
    if (faces.length > 1) {
      warning = "تم اكتشاف أكثر من شخص. سيتم استخدام أول وجه — يُنصح بتصوير المنخرط وحده.";
    }
    faceDetected = true;
    cropBox = computeCropBox(faces[0], img.naturalWidth, img.naturalHeight);
  } else {
    const minDim = Math.min(img.naturalWidth, img.naturalHeight);
    cropBox = {
      x: (img.naturalWidth - minDim) / 2,
      y: (img.naturalHeight - minDim) / 2,
      size: minDim,
    };
    if (opts.enableFaceDetection && faces === null) {
      warning = "لم يتم اكتشاف الوجه تلقائياً (المتصفح لا يدعم FaceDetector). تم القص من الوسط.";
    } else if (opts.enableFaceDetection && faces !== null && faces.length === 0) {
      warning = "لم يتم اكتشاف أي شخص داخل الصورة. تم القص من الوسط — يُنصح بإعادة التصوير.";
    }
  }

  const croppedCanvas = document.createElement("canvas");
  croppedCanvas.width = opts.targetSize;
  croppedCanvas.height = opts.targetSize;
  const ctx = croppedCanvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, cropBox.x, cropBox.y, cropBox.size, cropBox.size, 0, 0, opts.targetSize, opts.targetSize);

  if (opts.enhance) {
    enhanceImage(croppedCanvas);
  }

  const cropped = croppedCanvas.toDataURL("image/jpeg", opts.quality);
  const thumbnail = createThumbnail(img, cropBox, opts.thumbSize, opts.quality);

  return {
    original: dataURL,
    cropped,
    thumbnail,
    faceDetected,
    facesCount: faces ? faces.length : 0,
    warning,
  };
}

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: "نوع الملف غير مسموح. المسموح: JPG, PNG, WEBP" };
  }
  const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    return { valid: false, error: "امتداد الملف غير مسموح" };
  }
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: "حجم الملف يتجاوز 10MB" };
  }
  return { valid: true };
}

export function generatePhotoId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "ph-" + Date.now() + "-" + Math.random().toString(36).substring(2, 10);
}

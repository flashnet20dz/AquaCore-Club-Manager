import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import fs from "fs";
import path from "path";

const AUTO_BACKUP_SETTING_KEY = "autoBackupConfig";
const DEFAULT_BACKUP_DIR = path.join(process.cwd(), "backups");

export interface AutoBackupConfig {
  enabled: boolean;
  interval: "every6h" | "daily" | "weekly" | "onClose";
  destination: string;
  retentionCount: number;
  lastBackupDate?: string | null;
  lastBackupSize?: number;
  lastBackupFilename?: string;
}

const DEFAULT_CONFIG: AutoBackupConfig = {
  enabled: false,
  interval: "daily",
  destination: "backups",
  retentionCount: 15,
  lastBackupDate: null,
};

// GET: جلب إعدادات النسخ الاحتياطي التلقائي وسجل النسخ المحفوظة
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const setting = await db.setting.findUnique({
      where: { clubId_key: { clubId: user.clubId!, key: AUTO_BACKUP_SETTING_KEY } },
    });

    let config: AutoBackupConfig = DEFAULT_CONFIG;
    if (setting?.value) {
      try {
        config = { ...DEFAULT_CONFIG, ...JSON.parse(setting.value) };
      } catch {}
    }

    // فحص مجلد النسخ الاحتياطي وقراءة الملفات الموجودة
    const targetDir = config.destination && config.destination !== "backups"
      ? config.destination
      : DEFAULT_BACKUP_DIR;

    let history: { filename: string; size: number; date: string; isDb: boolean }[] = [];
    if (fs.existsSync(targetDir)) {
      const files = fs.readdirSync(targetDir);
      history = files
        .filter((f) => f.endsWith(".db") || f.endsWith(".sqlite") || f.endsWith(".json"))
        .map((f) => {
          const fullPath = path.join(targetDir, f);
          const stat = fs.statSync(fullPath);
          return {
            filename: f,
            size: stat.size,
            date: stat.mtime.toISOString(),
            isDb: f.endsWith(".db") || f.endsWith(".sqlite"),
          };
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    return NextResponse.json({ config, history, defaultDir: DEFAULT_BACKUP_DIR });
  } catch (e) {
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

// POST: حفظ إعدادات النسخ الاحتياطي التلقائي
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await req.json();
    const config: AutoBackupConfig = {
      enabled: Boolean(body.enabled),
      interval: body.interval || "daily",
      destination: body.destination || "backups",
      retentionCount: Number(body.retentionCount) || 15,
      lastBackupDate: body.lastBackupDate || null,
      lastBackupSize: body.lastBackupSize,
      lastBackupFilename: body.lastBackupFilename,
    };

    await db.setting.upsert({
      where: { clubId_key: { clubId: user.clubId!, key: AUTO_BACKUP_SETTING_KEY } },
      update: { value: JSON.stringify(config) },
      create: { clubId: user.clubId!, key: AUTO_BACKUP_SETTING_KEY, value: JSON.stringify(config) },
    });

    return NextResponse.json({ success: true, config });
  } catch (e) {
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

// PUT: تنفيذ فوري لنسخة احتياطية وحفظها في المجلد المحدد مع التنظيف الذاتي
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const setting = await db.setting.findUnique({
      where: { clubId_key: { clubId: user.clubId!, key: AUTO_BACKUP_SETTING_KEY } },
    });

    let config: AutoBackupConfig = DEFAULT_CONFIG;
    if (setting?.value) {
      try {
        config = { ...DEFAULT_CONFIG, ...JSON.parse(setting.value) };
      } catch {}
    }

    const targetDir = config.destination && config.destination !== "backups"
      ? config.destination
      : DEFAULT_BACKUP_DIR;

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // مسار قاعدة بيانات SQLite
    const devDbPath = path.join(process.cwd(), "prisma", "dev.db");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `aquacore-auto-backup-${timestamp}.db`;
    const destPath = path.join(targetDir, filename);

    let savedSize = 0;
    if (fs.existsSync(devDbPath)) {
      // تفريغ سجل الكتابة المسبقة (WAL) لضمان اكتمال كافة العمليات 100% في dev.db
      try {
        await db.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE);");
      } catch (walErr) {
        console.warn("[auto-backup] WAL checkpoint warning:", walErr);
      }
      // نسخ ملف SQLite كاملاً لقطة طبق الأصل 100%
      fs.copyFileSync(devDbPath, destPath);
      savedSize = fs.statSync(destPath).size;
    } else {
      // احتياط: تصدير JSON إن لم يكن dev.db في المسار الافتراضي
      const jsonFilename = `aquacore-auto-backup-${timestamp}.json`;
      const jsonDestPath = path.join(targetDir, jsonFilename);
      const [subscribers, settings, attendances, payments] = await Promise.all([
        db.subscriber.findMany({ where: { clubId: user.clubId! } }),
        db.setting.findMany({ where: { clubId: user.clubId! } }),
        db.attendance.findMany({ where: { clubId: user.clubId! } }),
        db.payment.findMany({ where: { clubId: user.clubId! } }),
      ]);
      const data = { subscribers, settings, attendances, payments, date: new Date().toISOString() };
      fs.writeFileSync(jsonDestPath, JSON.stringify(data, null, 2), "utf8");
      savedSize = fs.statSync(jsonDestPath).size;
    }

    // التنظيف الذاتي (Auto-pruning): حذف النسخ الأقدم إن زادت عن retentionCount
    const maxFiles = config.retentionCount || 15;
    const allFiles = fs.readdirSync(targetDir)
      .filter((f) => f.startsWith("aquacore-auto-backup-"))
      .map((f) => ({
        name: f,
        time: fs.statSync(path.join(targetDir, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);

    if (allFiles.length > maxFiles) {
      const toDelete = allFiles.slice(maxFiles);
      for (const f of toDelete) {
        try {
          fs.unlinkSync(path.join(targetDir, f.name));
        } catch {}
      }
    }

    // تحديث تاريخ آخر نسخة
    const updatedConfig: AutoBackupConfig = {
      ...config,
      lastBackupDate: new Date().toISOString(),
      lastBackupSize: savedSize,
      lastBackupFilename: filename,
    };

    await db.setting.upsert({
      where: { clubId_key: { clubId: user.clubId!, key: AUTO_BACKUP_SETTING_KEY } },
      update: { value: JSON.stringify(updatedConfig) },
      create: { clubId: user.clubId!, key: AUTO_BACKUP_SETTING_KEY, value: JSON.stringify(updatedConfig) },
    });

    return NextResponse.json({
      success: true,
      filename,
      size: savedSize,
      targetDir,
      config: updatedConfig,
    });
  } catch (e) {
    return NextResponse.json({ error: "فشل إنشاء النسخة الاحتياطية" }, { status: 500 });
  }
}

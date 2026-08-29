// ═══════════════════════════════════════════════════════════
// RCS Club — Electron Main Process (Hybrid: Offline + Online)
// ═══════════════════════════════════════════════════════════
//
// يعمل بطريقتين:
// 1. Offline: يحمّل Next.js محلياً + SQLite محلي
// 2. Online:  يحمّل من السحابة (Vercel) + PostgreSQL (Neon)
//
// الأمان: contextIsolation=true, nodeIntegration=false
//
// ⚠️ ملاحظة مهمة: ipcMain لا يملك invoke() — فقط handle().
//   invoke() موجودة فقط في ipcRenderer. لتنفيذ منطق داخل Main
//   Process، استخرجه إلى دالة مستقلة واستدعِها مباشرة.
//

const { app, BrowserWindow, Menu, shell, ipcMain, dialog, Notification } = require("electron");
const path = require("path");
const fs = require("fs");
const desktopSettings = require("./desktop-settings");

let mainWindow = null;
let splashWindow = null;

// وضع العمل: Hybrid — يعمل offline و online
// 1. يحاول تشغيل خادم Next.js محلياً (مع SQLite)
// 2. إذا فشل، يحمّل من السحابة (Vercel + PostgreSQL)
const { spawn } = require("child_process");
const CLOUD_URL = "https://aladine-pool-manager.vercel.app";
const LOCAL_URL = "http://localhost:3872"; // بورت مخصص لتجنب التعارض

let nextServer = null;
let usingLocal = false;

// مسار ملفات التطبيق — Next.js Standalone داخل asar
function getAppDir() {
  // في production: ملفات standalone داخل asar في .next/standalone/
  // __dirname = electron/ داخل asar
  // نرجع لجذر asar ثم ندخل .next/standalone/
  const standaloneDir = path.join(__dirname, "..", ".next", "standalone");
  if (fs.existsSync(path.join(standaloneDir, "server.js"))) {
    return standaloneDir;
  }
  // في dev: جذر المشروع
  return path.join(__dirname, "..");
}

// ═══════════════════════════════════════════════════════════
// بدء خادم Next.js المحلي للعمل Offline
// ═══════════════════════════════════════════════════════════

/**
 * بدء خادم Next.js محلي
 * يُرجع true إذا نجح، false إذا فشل
 */
function startLocalServer() {
  return new Promise((resolve) => {
    try {
      const appDir = getAppDir();
      const serverPath = path.join(appDir, "server.js");
      // في standalone, ملفات .next تكون داخل standalone/.next/
      const nextDir = path.join(appDir, ".next");

      console.log("[Server] appDir:", appDir);
      console.log("[Server] serverPath:", serverPath);
      console.log("[Server] .next exists:", fs.existsSync(nextDir));

      if (!fs.existsSync(serverPath)) {
        console.log("[Server] server.js not found, will use cloud");
        resolve(false);
        return;
      }

      // ضبط متغيرات البيئة لـ SQLite محلي
      const dbPath = getDatabasePath();
      const env = {
        ...process.env,
        DATABASE_URL: `file:${dbPath}`,
        DIRECT_URL: `file:${dbPath}`,
        NEXTAUTH_SECRET: "rcs-club-desktop-secret-2024-offline",
        NEXTAUTH_URL: LOCAL_URL,
        PORT: "3872",
        HOSTNAME: "127.0.0.1",
        NODE_ENV: "production",
      };

      console.log("[Server] Starting Next.js standalone server...");
      console.log("[Server] Database:", dbPath);
      console.log("[Server] Working dir:", appDir);

      nextServer = spawn(process.execPath, [serverPath], {
        env,
        cwd: appDir,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let started = false;
      const timeout = setTimeout(() => {
        if (!started) {
          console.log("[Server] Timeout — falling back to cloud");
          resolve(false);
        }
      }, 15000);

      nextServer.stdout.on("data", (data) => {
        const output = data.toString();
        console.log("[Server]", output.trim());
        if (output.includes("Ready") || output.includes("started") || output.includes("localhost:3872")) {
          if (!started) {
            started = true;
            clearTimeout(timeout);
            usingLocal = true;
            console.log("[Server] ✅ Local server ready at", LOCAL_URL);
            resolve(true);
          }
        }
      });

      nextServer.stderr.on("data", (data) => {
        console.error("[Server Error]", data.toString().trim());
      });

      nextServer.on("error", (err) => {
        console.error("[Server] Failed to start:", err);
        clearTimeout(timeout);
        resolve(false);
      });

      nextServer.on("exit", (code) => {
        console.log("[Server] Exited with code", code);
        usingLocal = false;
      });

    } catch (e) {
      console.error("[Server] Exception:", e);
      resolve(false);
    }
  });
}

/**
 * التحقق من أن الخادم المحلي يستجيب
 */
async function checkLocalServer() {
  try {
    const http = require("http");
    return new Promise((resolve) => {
      const req = http.get(LOCAL_URL, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on("error", () => resolve(false));
      req.setTimeout(3000, () => { req.destroy(); resolve(false); });
    });
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// دوال مستقلة (Standalone Functions) — يمكن استدعاؤها من أي مكان
// ═══════════════════════════════════════════════════════════

/**
 * الحصول على مسار قاعدة البيانات
 */
function getDatabasePath() {
  return path.join(app.getPath("userData"), "rcs-club.db");
}

/**
 * الحصول على معلومات قاعدة البيانات
 */
function getDatabaseInfo() {
  const dbPath = getDatabasePath();
  const exists = fs.existsSync(dbPath);
  return {
    type: "sqlite",
    path: dbPath,
    exists,
    size: exists ? fs.statSync(dbPath).size : 0,
  };
}

/**
 * إنشاء نسخة احتياطية من قاعدة البيانات
 * @param {string} [targetPath] - مسار الوجهة (اختياري)
 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
 */
async function doBackup(targetPath?: string) {
  try {
    const dbPath = getDatabasePath();
    if (!fs.existsSync(dbPath)) {
      return { success: false, error: "قاعدة البيانات غير موجودة" };
    }
    const backupPath = targetPath || path.join(
      desktopSettings.getDefaultBackupsPath(),
      `backup-${Date.now()}.db`
    );
    // التأكد من وجود مجلد الوجهة
    const backupDir = path.dirname(backupPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    fs.copyFileSync(dbPath, backupPath);

    // تحديث تاريخ آخر نسخ احتياطي
    const settings = desktopSettings.getAllSettings();
    settings.lastBackupDate = new Date().toISOString();
    desktopSettings.saveSettings(settings);

    return { success: true, path: backupPath };
  } catch (e) {
    console.error("Backup error:", e);
    return { success: false, error: (e as Error).message };
  }
}

/**
 * استعادة نسخة احتياطية
 * @param {string} sourcePath - مسار ملف النسخة
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function doRestore(sourcePath: string) {
  try {
    const dbPath = getDatabasePath();
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: "ملف النسخة الاحتياطية غير موجود" };
    }
    // نسخة احتياطية للقاعدة الحالية قبل الاستعادة
    if (fs.existsSync(dbPath)) {
      const tempPath = dbPath + ".pre-restore.bak";
      fs.copyFileSync(dbPath, tempPath);
    }
    fs.copyFileSync(sourcePath, dbPath);
    return { success: true };
  } catch (e) {
    console.error("Restore error:", e);
    return { success: false, error: (e as Error).message };
  }
}

/**
 * تصدير قاعدة البيانات (يفتح dialog لاختيار المسار ثم ينفذ backup)
 * @returns {Promise<{success: boolean, path?: string}>}
 */
async function doExportDatabase() {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `rcs-club-export-${Date.now()}.db`,
    filters: [{ name: "Database", extensions: ["db"] }],
  });
  if (result.canceled || !result.filePath) {
    return { success: false };
  }
  return doBackup(result.filePath);
}

/**
 * استيراد قاعدة بيانات (يفتح dialog لاختيار الملف ثم ينفذ restore)
 * @returns {Promise<{success: boolean, path?: string}>}
 */
async function doImportDatabase() {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [{ name: "Database", extensions: ["db"] }],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false };
  }
  const sourcePath = result.filePaths[0];
  const restoreResult = await doRestore(sourcePath);
  return { ...restoreResult, path: sourcePath };
}

/**
 * نسخ احتياطي تلقائي — يتحقق من الإعدادات والتواريخ قبل التنفيذ
 * @returns {Promise<{success: boolean, reason?: string, path?: string}>}
 */
async function doAutoBackup() {
  const settings = desktopSettings.getAllSettings();
  if (!settings.autoBackupEnabled) {
    return { success: false, reason: "disabled" };
  }

  const lastBackup = settings.lastBackupDate ? new Date(settings.lastBackupDate) : null;
  const now = new Date();
  const interval = settings.autoBackupInterval;
  const intervalMs =
    interval === "daily" ? 86400000 :
    interval === "weekly" ? 604800000 :
    2592000000; // monthly

  if (lastBackup && (now.getTime() - lastBackup.getTime()) < intervalMs) {
    return { success: false, reason: "not-due" };
  }

  return doBackup();
}

// ═══════════════════════════════════════════════════════════
// Splash screen — يظهر أثناء تحميل التطبيق
// ═══════════════════════════════════════════════════════════
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 350,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    center: true,
    show: true,
  });

  splashWindow.loadFile(path.join(__dirname, "splash.html"));
  splashWindow.on("closed", () => { splashWindow = null; });
}

// ═══════════════════════════════════════════════════════════
// النافذة الرئيسية
// ═══════════════════════════════════════════════════════════
function createWindow() {
  // استرجاع آخر حجم وموقع للنافذة
  const settings = desktopSettings.getAllSettings();
  const windowState = settings.windowState || {
    width: 1400, height: 900, x: undefined, y: undefined, isMaximized: false,
  };

  mainWindow = new BrowserWindow({
    width: windowState.width || 1400,
    height: windowState.height || 900,
    x: windowState.x,
    y: windowState.y,
    minWidth: 1024,
    minHeight: 700,
    title: "نادي RCS — منظومة إدارة الاشتراكات",
    icon: path.join(__dirname, "..", "public", "images", "rcs-logo-official.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: process.env.NODE_ENV !== "production",
    },
    show: false,
    backgroundColor: "#0f766e",
    autoHideMenuBar: false,
  });

  // إظهار النافذة عند جاهزيتها
  mainWindow.once("ready-to-show", () => {
    if (splashWindow) splashWindow.close();
    mainWindow.show();
    if (windowState.isMaximized) mainWindow.maximize();
  });

  // تحميل التطبيق — Hybrid mode
  // إذا كان الخادم المحلي يعمل → استخدمه (offline)
  // وإلا → حمّل من السحابة (online)
  if (usingLocal) {
    console.log("[Window] Loading from local server:", LOCAL_URL);
    mainWindow.loadURL(LOCAL_URL);
  } else {
    console.log("[Window] Loading from cloud:", CLOUD_URL);
    mainWindow.loadURL(CLOUD_URL);
  }

  // حفظ حجم وموقع النافذة
  const saveWindowState = () => {
    if (!mainWindow) return;
    const bounds = mainWindow.getBounds();
    const isMaximized = mainWindow.isMaximized();
    const s = desktopSettings.getAllSettings();
    s.windowState = { ...bounds, isMaximized };
    desktopSettings.saveSettings(s);
  };
  mainWindow.on("resize", saveWindowState);
  mainWindow.on("move", saveWindowState);
  mainWindow.on("close", saveWindowState);

  // فتح الروابط الخارجية في المتصفح
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const targetUrl = usingLocal ? LOCAL_URL : CLOUD_URL;
    if (url !== targetUrl && !url.startsWith(targetUrl)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const targetUrl = usingLocal ? LOCAL_URL : CLOUD_URL;
    if (url !== targetUrl && !url.startsWith(targetUrl)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // القائمة
  buildMenu();
}

// ═══════════════════════════════════════════════════════════
// القائمة
// ═══════════════════════════════════════════════════════════
function buildMenu() {
  const template = [
    {
      label: "ملف",
      submenu: [
        {
          label: "طباعة",
          accelerator: "CmdOrCtrl+P",
          click: () => mainWindow?.webContents.print({ printBackground: true }),
        },
        {
          label: "تصدير PDF",
          accelerator: "CmdOrCtrl+Shift+P",
          click: async () => {
            if (!mainWindow) return;
            const data = await mainWindow.webContents.printToPDF({ printBackground: true });
            dialog.showSaveDialog(mainWindow, {
              defaultPath: "rcs-export.pdf",
              filters: [{ name: "PDF", extensions: ["pdf"] }],
            }).then((r) => {
              if (!r.canceled && r.filePath) fs.writeFileSync(r.filePath, data);
            });
          },
        },
        { type: "separator" },
        {
          label: "نسخة احتياطية",
          click: async () => {
            const result = await doBackup();
            if (result.success) {
              dialog.showMessageBox(mainWindow, {
                type: "info",
                title: "نسخة احتياطية",
                message: "تم إنشاء نسخة احتياطية بنجاح",
                detail: `المسار: ${result.path}`,
                buttons: ["حسناً"],
              });
            }
          },
        },
        {
          label: "استعادة نسخة",
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ["openFile"],
              filters: [{ name: "Database", extensions: ["db"] }],
            });
            if (!result.canceled && result.filePaths[0]) {
              const restoreResult = await doRestore(result.filePaths[0]);
              dialog.showMessageBox(mainWindow, {
                type: restoreResult.success ? "info" : "error",
                title: "استعادة",
                message: restoreResult.success ? "تمت الاستعادة بنجاح" : "فشلت الاستعادة",
                detail: restoreResult.error || "أعد تشغيل التطبيق",
                buttons: ["حسناً"],
              });
            }
          },
        },
        { type: "separator" },
        { label: "تحديث", accelerator: "CmdOrCtrl+R", click: () => mainWindow?.reload() },
        { type: "separator" },
        { label: "خروج", accelerator: "CmdOrCtrl+Q", click: () => app.quit() },
      ],
    },
    {
      label: "تحرير",
      submenu: [
        { label: "تراجع", role: "undo" },
        { label: "إعادة", role: "redo" },
        { type: "separator" },
        { label: "قص", role: "cut" },
        { label: "نسخ", role: "copy" },
        { label: "لصق", role: "paste" },
        { label: "تحديد الكل", role: "selectAll" },
      ],
    },
    {
      label: "عرض",
      submenu: [
        { label: "تكبير", role: "zoomIn" },
        { label: "تصغير", role: "zoomOut" },
        { label: "حجم طبيعي", role: "resetZoom" },
        { type: "separator" },
        { label: "ملء الشاشة", role: "togglefullscreen" },
        { type: "separator" },
        { label: "أدوات المطور", role: "toggleDevTools" },
      ],
    },
    {
      label: "نافذة",
      submenu: [
        { label: "تصغير", role: "minimize" },
        { label: "تكبير", role: "toggleMaximize" },
        { label: "إغلاق", role: "close" },
      ],
    },
    {
      label: "مساعدة",
      submenu: [
        {
          label: "عن البرنامج",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "عن نادي RCS",
              message: "نادي RCS — منظومة إدارة الاشتراكات",
              detail: `الإصدار ${app.getVersion()}\nالنادي الهاوي متعدد الرياضات\nالرائد - سعيدة\nفرع السباحة\n\nيعمل أوفلاين (SQLite) وسحابياً (PostgreSQL)`,
              buttons: ["حسناً"],
            });
          },
        },
        {
          label: "فتح مجلد البيانات",
          click: () => shell.openPath(app.getPath("userData")),
        },
        {
          label: "الموقع السحابي",
          click: () => shell.openExternal(CLOUD_URL),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ═══════════════════════════════════════════════════════════
// IPC Handlers — تستقبل الطلبات من Renderer
// كل handler يستدعي الدالة المستقلة مباشرة (لا يستخدم ipcMain.invoke)
// ═══════════════════════════════════════════════════════════

// ─── معلومات التطبيق ───
ipcMain.handle("get-app-version", () => app.getVersion());

// ─── الطباعة ───
ipcMain.handle("print", async () => {
  if (!mainWindow) return false;
  mainWindow.webContents.print({ silent: false, printBackground: true });
  return true;
});

ipcMain.handle("print-to-pdf", async (event, options) => {
  if (!mainWindow) return null;
  const data = await mainWindow.webContents.printToPDF(
    options || { printBackground: true }
  );
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: "rcs-export.pdf",
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, data);
    return result.filePath;
  }
  return null;
});

ipcMain.handle("silent-print", async () => {
  if (!mainWindow) return false;
  mainWindow.webContents.print({ silent: true, printBackground: true });
  return true;
});

// ─── إدارة الملفات ───
ipcMain.handle("save-file", async (event, data, filename, filters) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: filename || "file.txt",
    filters: filters || [{ name: "All Files", extensions: ["*"] }],
  });
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, data);
    return result.filePath;
  }
  return null;
});

ipcMain.handle("open-file", async (event, filters) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: filters || [{ name: "All Files", extensions: ["*"] }],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle("read-file", async (event, filePath) => {
  try {
    return fs.readFileSync(filePath);
  } catch (e) {
    console.error("read-file error:", e);
    return null;
  }
});

ipcMain.handle("get-app-data-path", () => app.getPath("userData"));
ipcMain.handle("get-user-data-path", () => app.getPath("userData"));

ipcMain.handle("list-files", async (event, dir) => {
  const targetDir = dir || desktopSettings.getDefaultFilesPath();
  try {
    return fs.readdirSync(targetDir);
  } catch (e) {
    return [];
  }
});

ipcMain.handle("delete-file", async (event, filePath) => {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (e) {
    return false;
  }
});

ipcMain.handle("ensure-dir", async (event, dir) => {
  try {
    fs.mkdirSync(dir, { recursive: true });
    return true;
  } catch (e) {
    return false;
  }
});

// ─── النسخ الاحتياطي ───
// كل handler يستدعي الدالة المستقلة مباشرة
ipcMain.handle("backup-database", async (event, targetPath) => {
  return doBackup(targetPath);
});

ipcMain.handle("restore-database", async (event, sourcePath) => {
  return doRestore(sourcePath);
});

ipcMain.handle("export-database", async () => {
  return doExportDatabase();
});

ipcMain.handle("import-database", async () => {
  return doImportDatabase();
});

ipcMain.handle("auto-backup", async () => {
  return doAutoBackup();
});

// ─── الإشعارات ───
ipcMain.handle("show-notification", async (event, title, body) => {
  try {
    if (Notification.isSupported()) {
      new Notification({
        title,
        body,
        icon: path.join(__dirname, "..", "public", "images", "rcs-logo-official.png"),
      }).show();
      return true;
    }
    return false;
  } catch (e) {
    console.error("Notification error:", e);
    return false;
  }
});

// ─── النافذة ───
ipcMain.handle("window-minimize", () => {
  mainWindow?.minimize();
});
ipcMain.handle("window-maximize", () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle("window-close", () => {
  mainWindow?.close();
});
ipcMain.handle("window-is-maximized", () => mainWindow?.isMaximized() || false);
ipcMain.handle("set-fullscreen", (event, flag) => {
  mainWindow?.setFullScreen(flag);
});
ipcMain.handle("hide-splash", () => {
  if (splashWindow) splashWindow.close();
});

// ─── إعدادات Desktop ───
ipcMain.handle("get-desktop-settings", () => desktopSettings.getAllSettings());
ipcMain.handle("set-desktop-setting", (event, key, value) => {
  return desktopSettings.setSetting(key, value);
});

// ─── قاعدة البيانات ───
ipcMain.handle("get-database-info", () => getDatabaseInfo());
ipcMain.handle("get-database-path", () => getDatabasePath());

// ─── روابط خارجية ───
ipcMain.handle("open-external", (event, url) => shell.openExternal(url));
ipcMain.handle("open-path", (event, p) => shell.openPath(p));

// ─── التحديثات (مُعطّل — جاهز للمستقبل) ───
ipcMain.handle("check-for-updates", () => ({
  available: false,
  message: "التحديثات معطّلة حالياً",
}));
ipcMain.handle("download-update", () => ({ success: false, message: "معطّل" }));
ipcMain.handle("install-update", () => ({ success: false, message: "معطّل" }));

// ═══════════════════════════════════════════════════════════
// App lifecycle
// ═══════════════════════════════════════════════════════════

// منع تشغيل أكثر من نسخة
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    // التأكد من وجود المجلدات
    desktopSettings.ensureDirectories();

    // إنشاء splash screen
    createSplash();

    // ═══ محاولة بدء خادم Next.js محلي (للعمل offline) ═══
    console.log("[App] Attempting to start local server...");
    const localStarted = await startLocalServer();

    if (localStarted) {
      // التحقق من أن الخادم يستجيب فعلاً
      const isResponsive = await checkLocalServer();
      if (isResponsive) {
        console.log("[App] ✅ Using LOCAL server (offline mode with SQLite)");
      } else {
        console.log("[App] ⚠️ Local server not responsive, using cloud");
        usingLocal = false;
      }
    } else {
      console.log("[App] ℹ️ Local server not available, using cloud (online mode)");
    }

    // إنشاء النافذة الرئيسية
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    // النسخ الاحتياطي التلقائي عند البدء
    setTimeout(() => {
      doAutoBackup().catch((e) =>
        console.error("Auto-backup failed:", e)
      );
    }, 5000);
  });
}

app.on("window-all-closed", () => {
  // إيقاف الخادم المحلي إذا كان يعمل
  if (nextServer) {
    console.log("[App] Stopping local server...");
    nextServer.kill();
    nextServer = null;
  }
  app.quit();
});

// الأمان: منع إنشاء نوافذ غير مصرح بها
app.on("web-contents-created", (event, contents) => {
  contents.on("will-attach-webview", (event, webPreferences, params) => {
    delete params.preload;
    delete params.preloadURL;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
  });
});

// تصدير الدوال المستقلة للاستخدام الخارجي (اختياري)
module.exports = { doBackup, doRestore, doAutoBackup, getDatabaseInfo, getDatabasePath };

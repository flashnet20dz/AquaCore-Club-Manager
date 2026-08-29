// ═══════════════════════════════════════════════════════════
// preload.js — جسر آمن بين Electron والـ Next.js app
// ═══════════════════════════════════════════════════════════
//
// contextIsolation: true  ←(isolate renderer from Node.js)
// nodeIntegration: false  ←(no direct Node.js access in renderer)
//
// فقط الـ APIs المُعلَنة هنا متاحة في window.electronAPI
//

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // ─── معلومات التطبيق ───
  getVersion: () => ipcRenderer.invoke("get-app-version"),
  platform: process.platform,
  isElectron: true,
  environment: "desktop",

  // ─── الطباعة ───
  print: () => ipcRenderer.invoke("print"),
  printToPDF: (options) => ipcRenderer.invoke("print-to-pdf", options),
  silentPrint: () => ipcRenderer.invoke("silent-print"),

  // ─── إدارة الملفات ───
  saveFile: (data, filename, filters) =>
    ipcRenderer.invoke("save-file", data, filename, filters),
  openFile: (filters) => ipcRenderer.invoke("open-file", filters),
  readFile: (filePath) => ipcRenderer.invoke("read-file", filePath),
  getAppDataPath: () => ipcRenderer.invoke("get-app-data-path"),
  getUserDataPath: () => ipcRenderer.invoke("get-user-data-path"),
  listFiles: (dir) => ipcRenderer.invoke("list-files", dir),
  deleteFile: (filePath) => ipcRenderer.invoke("delete-file", filePath),
  ensureDir: (dir) => ipcRenderer.invoke("ensure-dir", dir),

  // ─── النسخ الاحتياطي ───
  backupDatabase: (targetPath) => ipcRenderer.invoke("backup-database", targetPath),
  restoreDatabase: (sourcePath) => ipcRenderer.invoke("restore-database", sourcePath),
  exportDatabase: (targetPath) => ipcRenderer.invoke("export-database", targetPath),
  importDatabase: (sourcePath) => ipcRenderer.invoke("import-database", sourcePath),
  autoBackup: () => ipcRenderer.invoke("auto-backup"),

  // ─── الإشعارات ───
  showNotification: (title, body) =>
    ipcRenderer.invoke("show-notification", title, body),

  // ─── النافذة ───
  minimize: () => ipcRenderer.invoke("window-minimize"),
  maximize: () => ipcRenderer.invoke("window-maximize"),
  close: () => ipcRenderer.invoke("window-close"),
  isMaximized: () => ipcRenderer.invoke("window-is-maximized"),
  setFullScreen: (flag) => ipcRenderer.invoke("set-fullscreen", flag),

  // ─── إعدادات Desktop ───
  getDesktopSettings: () => ipcRenderer.invoke("get-desktop-settings"),
  setDesktopSetting: (key, value) =>
    ipcRenderer.invoke("set-desktop-setting", key, value),

  // ─── قاعدة البيانات ───
  getDatabaseInfo: () => ipcRenderer.invoke("get-database-info"),
  getDatabasePath: () => ipcRenderer.invoke("get-database-path"),

  // ─── التحديثات (مُعطّل الآن — جاهز للمستقبل) ───
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on("update-available", callback);
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on("update-downloaded", callback);
  },

  // ─── روابط خارجية ───
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  openPath: (path) => ipcRenderer.invoke("open-path", path),

  // ─── شاشة البدء (Splash) ───
  hideSplash: () => ipcRenderer.invoke("hide-splash"),
});

// طباعة رسالة تأكيد في console
console.log("✓ Electron preload bridge initialized");
console.log("  Platform:", process.platform);
console.log("  Environment: desktop (offline-capable)");

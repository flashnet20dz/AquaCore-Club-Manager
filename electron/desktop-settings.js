// ═══════════════════════════════════════════════════════════
// Desktop Settings — إعدادات تطبيق سطح المكتب
// ═══════════════════════════════════════════════════════════

const { app } = require("electron");
const path = require("path");
const fs = require("fs");

const SETTINGS_FILE = "desktop-settings.json";

function getSettingsPath() {
  return path.join(app.getPath("userData"), SETTINGS_FILE);
}

const DEFAULT_SETTINGS = {
  // مسار حفظ الملفات
  filesLocation: "", // فارغ = مجلد المستخدم الافتراضي
  backupLocation: "", // فارغ = مجلد المستخدم الافتراضي/backups
  exportsLocation: "", // فارغ = مجلد المستخدم/exports

  // الطابعة
  defaultPrinter: "",
  silentPrint: false,
  printBackground: true,

  // التشغيل مع Windows
  autoStart: false,
  minimizeToTray: false,

  // اللغة والثيم
  language: "ar",
  theme: "dark", // dark | light | system

  // النسخ الاحتياطي التلقائي
  autoBackupEnabled: true,
  autoBackupInterval: "daily", // daily | weekly | monthly
  autoBackupMaxCount: 7,

  // قاعدة البيانات
  databaseType: "sqlite",
  lastBackupDate: null,

  // المزامنة مع السحابة (Sync)
  syncApiKey: "",
  syncEnabled: true,
  lastSyncStatus: "idle",
  lastSyncAt: null,

  // الترخيص والاشتراك (Offline License) — AquaCore
  trialStartedAt: null,
  trialEndDate: null,
  subscriptionPlan: null,
  subscriptionEndDate: null,
  graceEndDate: null,
  activationCode: null,
  hardwareFingerprint: null,
};

let cachedSettings = null;

function loadSettings() {
  if (cachedSettings) return cachedSettings;

  const settingsPath = getSettingsPath();
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, "utf8");
      cachedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    } else {
      cachedSettings = { ...DEFAULT_SETTINGS };
      saveSettings(cachedSettings);
    }
  } catch (e) {
    console.error("Error loading desktop settings:", e);
    cachedSettings = { ...DEFAULT_SETTINGS };
  }
  return cachedSettings;
}

function saveSettings(settings) {
  const settingsPath = getSettingsPath();
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");
    cachedSettings = settings;
    return true;
  } catch (e) {
    console.error("Error saving desktop settings:", e);
    return false;
  }
}

function getSetting(key) {
  const settings = loadSettings();
  return settings[key];
}

function setSetting(key, value) {
  const settings = loadSettings();
  settings[key] = value;
  return saveSettings(settings);
}

function getAllSettings() {
  return loadSettings();
}

// مسارات افتراضية
function getDefaultFilesPath() {
  const settings = loadSettings();
  if (settings.filesLocation) return settings.filesLocation;
  return path.join(app.getPath("userData"), "files");
}

function getDefaultBackupsPath() {
  const settings = loadSettings();
  if (settings.backupLocation) return settings.backupLocation;
  return path.join(app.getPath("userData"), "backups");
}

function getDefaultExportsPath() {
  const settings = loadSettings();
  if (settings.exportsLocation) return settings.exportsLocation;
  return path.join(app.getPath("userData"), "exports");
}

// التأكد من وجود المجلدات
function ensureDirectories() {
  const dirs = [
    getDefaultFilesPath(),
    getDefaultBackupsPath(),
    getDefaultExportsPath(),
    path.join(getDefaultFilesPath(), "subscribers"), // صور المنخرطين
    path.join(getDefaultFilesPath(), "logos"), // شعارات النادي
    path.join(getDefaultFilesPath(), "templates"), // القوالب
    path.join(getDefaultFilesPath(), "cards"), // البطاقات
    path.join(getDefaultFilesPath(), "pdf"), // PDF
    path.join(getDefaultFilesPath(), "word"), // Word
    path.join(getDefaultFilesPath(), "excel"), // Excel
    path.join(getDefaultFilesPath(), "contracts"), // العقود
  ];
  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

module.exports = {
  loadSettings,
  saveSettings,
  getSetting,
  setSetting,
  getAllSettings,
  getDefaultFilesPath,
  getDefaultBackupsPath,
  getDefaultExportsPath,
  ensureDirectories,
  DEFAULT_SETTINGS,
};

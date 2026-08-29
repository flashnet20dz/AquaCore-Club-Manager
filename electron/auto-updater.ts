// eslint-disable-next-line @typescript-eslint/no-require-imports
// electron/auto-updater.ts — نظام التحديثات التلقائية
// يتحقق من GitHub Releases ويحمّل التحديثات

const { autoUpdater } = require("electron-updater");
const { dialog } = require("electron");

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on("update-available", (info: any) => {
  dialog.showMessageBox({
    type: "info",
    title: "تحديث متاح",
    message: `يتوفر إصدار جديد: ${info.version}`,
    detail: "سيتم تحميل التحديث تلقائياً وتثبيته عند إغلاق البرنامج.",
    buttons: ["حسناً"],
  });
});

autoUpdater.on("update-not-available", () => {
  dialog.showMessageBox({
    type: "info",
    title: "لا توجد تحديثات",
    message: "أنت تستخدم أحدث إصدار",
    buttons: ["حسناً"],
  });
});

autoUpdater.on("update-downloaded", () => {
  dialog
    .showMessageBox({
      type: "info",
      title: "تحديث جاهز",
      message: "تم تحميل التحديث",
      detail: "سيتم تثبيته وإعادة تشغيل البرنامج الآن.",
      buttons: ["تثبيت وإعادة تشغيل", "لاحقاً"],
    })
    .then((result: any) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
});

autoUpdater.on("error", (err: any) => {
  console.error("Auto-updater error:", err);
});

function checkForUpdates() {
  autoUpdater.checkForUpdatesAndNotify();
}

module.exports = { checkForUpdates };

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.aquacore.clubmanager",
  appName: "AquaCore Club Manager",
  webDir: "www",
  // 🔑 Live URL mode مع دعم offline caching
  server: {
    androidScheme: "https",
    url: "https://aladine-pool-manager.vercel.app",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    // 🔑 تم إزالة captureInput — كان يمنع الكتابة في حقول الإدخال
    webContentsDebuggingEnabled: false,
    backgroundColor: "#ffffff",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#0f766e",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      spinnerColor: "#ffffff",
      splashFullScreen: true,
      splashImmersive: true,
    },
    Camera: {
      permissions: ["camera"],
    },
    Preferences: {
      group: "AquaCoreCache",
    },
    App: {
      backgroundColor: "#ffffff",
    },
  },
  cordova: {},
};

export default config;

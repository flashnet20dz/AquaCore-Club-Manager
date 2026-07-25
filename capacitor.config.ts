import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.aquacore.clubmanager",
  appName: "AquaCore Club Manager",
  webDir: "www",
  // 🔑 Live URL mode: التطبيق يحمّل من Vercel مباشرة
  // هذا يعني أن التحديثات تظهر فوراً بدون إعادة بناء APK
  server: {
    androidScheme: "https",
    url: "https://aladine-pool-manager.vercel.app",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#0f766e",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#ffffff",
      splashFullScreen: true,
      splashImmersive: true,
    },
    Camera: {
      permissions: ["camera"],
    },
  },
  cordova: {},
};

export default config;

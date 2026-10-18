import type { ExpoConfig } from "expo/config";
const androidPreview = process.env.QFLEET_ANDROID_PREVIEW === "1";
const config: ExpoConfig = {
  name: androidPreview ? "Querra Șofer Test" : "Querra Șofer", slug: "qfleet-driver", version: "0.1.0", scheme: androidPreview ? "qfleet-driver-test" : "qfleet-driver",
  orientation: "portrait", userInterfaceStyle: "dark", icon: "./assets/icon.png",
  ios: { bundleIdentifier: "com.querra.qfleet.driver", supportsTablet: true, buildNumber: "1", infoPlist: { CFBundleDevelopmentRegion: "ro" } },
  android: { package: androidPreview ? "com.querra.qfleet.driver.preview" : "com.querra.qfleet.driver", versionCode: 1, allowBackup: false,
    blockedPermissions: ["android.permission.READ_EXTERNAL_STORAGE", "android.permission.WRITE_EXTERNAL_STORAGE", "android.permission.RECORD_AUDIO", "android.permission.SYSTEM_ALERT_WINDOW"] },
  plugins: [["expo-notifications", { mode: process.env.EXPO_PUBLIC_APNS_ENVIRONMENT === "sandbox" ? "development" : "production" }], "./plugins/withAndroidTransport.cjs", ["expo-secure-store", { faceIDPermission: false }], ["expo-location", {
    isIosBackgroundLocationEnabled: true, isAndroidBackgroundLocationEnabled: true, isAndroidForegroundServiceEnabled: true,
    locationWhenInUsePermission: "Querra trimite poziția camionului către firma ta doar când activezi GPS în tură.",
    locationAlwaysAndWhenInUsePermission: "În tură, Querra trimite poziția și cu ecranul blocat. Modul Privat și Oprește GPS întrerup colectarea.",
    locationAlwaysPermission: "Querra folosește locația în fundal numai după activarea GPS în tură. Poți opri colectarea din aplicație.",
    locationFullAccuracyPermission: "Locația precisă permite afișarea poziției camionului pe harta firmei în timpul turei.",
    motionUsagePermission: false
  }]],
};
export default config;

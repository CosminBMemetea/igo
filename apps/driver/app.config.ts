import type { ExpoConfig } from "expo/config";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
const androidPreview = process.env.QFLEET_ANDROID_PREVIEW === "1";
const androidPackage = androidPreview ? "com.querra.qfleet.driver.preview" : "com.querra.qfleet.driver";
const firebaseFile = resolve(__dirname, "firebase", androidPreview ? "google-services.preview.json" : "google-services.production.json");
const hasFirebase = existsSync(firebaseFile);
if (hasFirebase) {
  const firebase = JSON.parse(readFileSync(firebaseFile, "utf8"));
  if (!firebase.client?.some((client: { client_info?: { android_client_info?: { package_name?: string } } }) =>
    client.client_info?.android_client_info?.package_name === androidPackage)) {
    throw new Error(`Firebase configuration does not contain Android package ${androidPackage}.`);
  }
}
const config: ExpoConfig = {
  name: androidPreview ? "Querra Șofer Test" : "Querra Șofer", slug: "qfleet-driver", version: "0.1.0", scheme: androidPreview ? "qfleet-driver-test" : "qfleet-driver",
  orientation: "portrait", userInterfaceStyle: "dark", icon: "./assets/icon.png",
  ios: { bundleIdentifier: "com.querra.qfleet.driver", supportsTablet: true, buildNumber: "1", infoPlist: { CFBundleDevelopmentRegion: "ro" } },
  android: { package: androidPackage, ...(hasFirebase ? { googleServicesFile: firebaseFile } : {}), versionCode: 1, allowBackup: false,
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

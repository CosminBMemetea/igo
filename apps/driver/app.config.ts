import type { ExpoConfig } from "expo/config";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
const androidPreview = process.env.QFLEET_ANDROID_PREVIEW === "1";
const androidPackage = androidPreview ? "com.querra.qfleet.driver.preview" : "com.querra.qfleet.driver";
const firebaseFile = resolve(__dirname, "firebase", androidPreview ? "google-services.preview.json" : "google-services.production.json");
let firebaseProjectId: string | undefined;
const hasFirebase = existsSync(firebaseFile);
if (hasFirebase) {
  const firebase = JSON.parse(readFileSync(firebaseFile, "utf8"));
  firebaseProjectId = firebase.project_info?.project_id;
  if (!firebase.client?.some((client: { client_info?: { android_client_info?: { package_name?: string } } }) =>
    client.client_info?.android_client_info?.package_name === androidPackage)) {
    throw new Error(`Firebase configuration does not contain Android package ${androidPackage}.`);
  }
}
const config: ExpoConfig = {
  extra: { firebaseProjectId },
  name: androidPreview ? "Querra Șofer Test" : "Querra Șofer", slug: "qfleet-driver", version: "0.1.0", scheme: androidPreview ? "qfleet-driver-test" : "qfleet-driver",
  orientation: "portrait", userInterfaceStyle: "dark", icon: "./assets/icon.png",
  locales: { ro: "./locales/ro.json", en: "./locales/en.json", pl: "./locales/pl.json" },
  ios: { bundleIdentifier: "com.querra.qfleet.driver", supportsTablet: true, buildNumber: "1", infoPlist: { CFBundleDevelopmentRegion: "ro", CFBundleAllowMixedLocalizations: true, ITSAppUsesNonExemptEncryption: false },
    privacyManifests: {
      NSPrivacyTracking: false, NSPrivacyTrackingDomains: [],
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults", NSPrivacyAccessedAPITypeReasons: ["CA92.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp", NSPrivacyAccessedAPITypeReasons: ["C617.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime", NSPrivacyAccessedAPITypeReasons: ["35F9.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace", NSPrivacyAccessedAPITypeReasons: ["E174.1"] },
      ],
      NSPrivacyCollectedDataTypes: [
        { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePreciseLocation", NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
        { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePhoneNumber", NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
        { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeName", NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
        { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePhotosorVideos", NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
        { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeDeviceID", NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
      ],
    } },
  android: { package: androidPackage, ...(hasFirebase ? { googleServicesFile: firebaseFile } : {}), versionCode: 2, allowBackup: false,
    adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", monochromeImage: "./assets/monochrome-icon.png", backgroundColor: "#0b0b0c" },
    blockedPermissions: ["android.permission.READ_EXTERNAL_STORAGE", "android.permission.WRITE_EXTERNAL_STORAGE", "android.permission.RECORD_AUDIO", "android.permission.SYSTEM_ALERT_WINDOW"] },
  plugins: [["expo-font", { fonts: ["./assets/fonts/Inter-Regular.ttf", "./assets/fonts/Inter-Medium.ttf", "./assets/fonts/Inter-SemiBold.ttf", "./assets/fonts/Inter-Bold.ttf"] }], ["expo-splash-screen", { image: "./assets/splash-icon.png", imageWidth: 200, resizeMode: "contain", backgroundColor: "#0b0b0c" }], ["expo-image-picker", { cameraPermission: "Fotografiază documentul CMR sau dovada livrării pentru cursa ta.", photosPermission: "Alege fotografia documentului pe care vrei să o trimiți firmei.", microphonePermission: false }], ["expo-notifications", { defaultChannel: "qfleet-alerts", mode: process.env.EXPO_PUBLIC_APNS_ENVIRONMENT === "sandbox" ? "development" : "production" }], "./plugins/withAndroidTransport.cjs", ["expo-secure-store", { faceIDPermission: false }], ["expo-location", {
    isIosBackgroundLocationEnabled: true, isAndroidBackgroundLocationEnabled: true, isAndroidForegroundServiceEnabled: true,
    locationWhenInUsePermission: "Querra trimite poziția camionului către firma ta doar când activezi GPS în tură.",
    locationAlwaysAndWhenInUsePermission: "În tură, Querra trimite poziția și cu ecranul blocat, pentru harta firmei și avertizarea la depășirea limitei de viteză setate de firmă. Modul Privat și Oprește GPS întrerup colectarea.",
    locationAlwaysPermission: "Querra folosește locația în fundal numai după activarea GPS în tură. Poți opri colectarea din aplicație.",
    locationFullAccuracyPermission: "Locația precisă permite afișarea poziției camionului pe harta firmei în timpul turei.",
    motionUsagePermission: false
  }]],
};
export default config;

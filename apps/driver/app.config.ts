import type { ExpoConfig } from "expo/config";
const config: ExpoConfig = {
  name: "Querra Șofer", slug: "qfleet-driver", version: "0.1.0", scheme: "qfleet-driver",
  orientation: "portrait", userInterfaceStyle: "dark", icon: "./assets/icon.png",
  ios: { bundleIdentifier: "com.querra.qfleet.driver", supportsTablet: true, buildNumber: "1", infoPlist: { CFBundleDevelopmentRegion: "ro" } },
  android: { package: "com.querra.qfleet.driver" },
  plugins: [["expo-secure-store", { faceIDPermission: false }], ["expo-location", {
    isIosBackgroundLocationEnabled: true, isAndroidBackgroundLocationEnabled: true, isAndroidForegroundServiceEnabled: true,
    locationWhenInUsePermission: "Querra trimite poziția camionului către firma ta doar când activezi GPS în tură.",
    locationAlwaysAndWhenInUsePermission: "În tură, Querra trimite poziția și cu ecranul blocat. Modul Privat și Oprește GPS întrerup colectarea.",
    locationAlwaysPermission: "Querra folosește locația în fundal numai după activarea GPS în tură. Poți opri colectarea din aplicație.",
    locationFullAccuracyPermission: "Locația precisă permite afișarea poziției camionului pe harta firmei în timpul turei.",
    motionUsagePermission: false
  }]],
};
export default config;

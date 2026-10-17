import type { ExpoConfig } from "expo/config";
const config: ExpoConfig = {
  name: "Querra Șofer", slug: "qfleet-driver", version: "0.1.0", scheme: "qfleet-driver",
  orientation: "portrait", userInterfaceStyle: "dark",
  ios: { bundleIdentifier: "com.querra.qfleet.driver", supportsTablet: true },
  android: { package: "com.querra.qfleet.driver" },
  plugins: ["expo-secure-store", ["expo-location", {
    isIosBackgroundLocationEnabled: true, isAndroidBackgroundLocationEnabled: true, isAndroidForegroundServiceEnabled: true,
    locationWhenInUsePermission: "Querra trimite poziția camionului către firma ta doar când activezi GPS în tură.",
    locationAlwaysAndWhenInUsePermission: "În tură, Querra trimite poziția și cu ecranul blocat. Modul Privat și Oprește GPS întrerup colectarea."
  }]],
};
export default config;

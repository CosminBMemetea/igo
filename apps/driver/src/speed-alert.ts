import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { read, write } from "./api";
import { driverAlert, type State } from "./speed-logic";
export { driverAlert } from "./speed-logic";
export const SPEED_CHANNEL = "qfleet-speed";
export type SpeedWarning = { kmh: number; limit: number; at: number };
export async function speedChannel() {
  if (Platform.OS === "android") await Notifications.setNotificationChannelAsync(SPEED_CHANNEL, {
    name: "Avertizare viteză", importance: Notifications.AndroidImportance.MAX, sound: "default", vibrationPattern: [0, 400, 150, 400], enableVibrate: true,
  });
}
/** Called from the background location task with the phone's own GPS speed (m/s). */
export async function checkSpeed(speedMs: number | null | undefined, accuracy: number | null | undefined, limit: number | undefined) {
  if (typeof limit !== "number" || limit < 30 || limit > 130) return;
  const kmh = typeof speedMs === "number" && Number.isFinite(speedMs) && speedMs >= 0 && (accuracy ?? 99) <= 30 ? speedMs * 3.6 : null;
  const st = (await read<State>("speed-alert")) ?? { overSince: null, lastAlert: null };
  const r = driverAlert(st, kmh, limit, Date.now());
  await write("speed-alert", r.st);
  if (!r.over) { await write("speed-warning", null); return; }
  if (!r.alert) return;
  const warning: SpeedWarning = { kmh: Math.round(kmh!), limit, at: Date.now() };
  await write("speed-warning", warning);
  await Notifications.scheduleNotificationAsync({
    content: { title: `Încetinește: ${warning.kmh} km/h`, body: `Ai depășit limita setată de firmă (${limit} km/h).`, sound: "default", data: { kind: "speed-local" },
      ...(Platform.OS === "android" ? { channelId: SPEED_CHANNEL, vibrate: [0, 400, 150, 400] } : { interruptionLevel: "timeSensitive" as const }) },
    trigger: Platform.OS === "android" ? { channelId: SPEED_CHANNEL } : null,
  }).catch(() => {});
}

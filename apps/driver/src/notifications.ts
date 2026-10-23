import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api, read, write, remove, sessionScope, type Login } from "./api";
import { queueRevocation, syncRevocations } from "./cleanup";
type Registration = { token: string; scope: string; validUntil: string; revokeReceipt?: string; transport?: "fcm" | "apns" };
const transport = () => Platform.OS === "android" ? "fcm" : "apns";
let generation = 0;
Notifications.setNotificationHandler({ handleNotification: async (n) => {
  // Local speed warnings are generated on the phone and must show even without server push.
  if (n.request.content.data?.kind === "speed-local") return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false };
  const active = await pushActive().catch(() => false);
  return { shouldShowBanner: active, shouldShowList: active, shouldPlaySound: active, shouldSetBadge: false };
} });
export async function pushActive() {
  const value = await read<Registration>("push-registration");
  if (!value || value.scope !== await sessionScope() || Date.parse(value.validUntil) <= Date.now()) return false;
  if (!(await Notifications.getPermissionsAsync()).granted) return false;
  const currentChannel = Platform.OS === "android" ? await Notifications.getNotificationChannelAsync("qfleet-alerts") : null;
  return Platform.OS !== "android" || (!!currentChannel && currentChannel.importance !== Notifications.AndroidImportance.NONE);
}
async function register(token: string, scope: string) {
  const version = generation, login = await read<Login>("login"), previous = await read<Registration>("push-registration");
  const r = await api<{ validUntil: string; revokeReceipt: string }>("/api/driver/push",
    { action: "on", transport: transport(), token, previousToken: previous?.scope === scope ? previous.token : undefined }, { scope });
  if (version !== generation || !login || (await read<Login>("login"))?.token !== login.token) {
    await queueRevocation(r.revokeReceipt, r.validUntil); return;
  }
  await write("push-registration", { token, scope, validUntil: r.validUntil, revokeReceipt: r.revokeReceipt, transport: transport() });
}
async function channel() {
  if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("qfleet-alerts", {
    name: "Alerte Querra", importance: Notifications.AndroidImportance.HIGH, sound: "default",
  });
  if (Platform.OS === "android" && (await Notifications.getNotificationChannelAsync("qfleet-alerts"))?.importance === Notifications.AndroidImportance.NONE)
    throw new Error("Canalul Alerte Querra este oprit. Reactivează-l în Setările notificărilor.");
}
export async function enablePush() {
  const version = generation, login = await read<Login>("login");
  const scope = await sessionScope();
  const config = await api<{ configured: boolean; environment?: string | null; projectId?: string | null }>(`/api/driver/push?transport=${transport()}`, undefined, { scope });
  if (!config.configured) throw new Error(`${Platform.OS === "android" ? "Serviciul Firebase" : "Serviciul Apple Push"} așteaptă configurarea Querra. Alertele rămân disponibile în aplicație.`);
  if (Platform.OS === "ios" && config.environment !== (process.env.EXPO_PUBLIC_APNS_ENVIRONMENT ?? "production"))
    throw new Error("Buildul iOS și serverul folosesc medii Apple Push diferite. Contactează Querra.");
  if (Platform.OS === "android" && config.projectId !== Constants.expoConfig?.extra?.firebaseProjectId)
    throw new Error("Aplicația și serverul folosesc proiecte Firebase diferite. Contactează Querra.");
  await channel();
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain !== false)
    permission = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
  if (!permission.granted) throw new Error("Permite notificările în Setările telefonului pentru Querra Șofer.");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const device = await Promise.race([Notifications.getDevicePushTokenAsync(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Tokenul push nu a sosit. Verifică internetul și configurarea aplicației, apoi reîncearcă.")), 12000);
    })]);
    if (device.type !== Platform.OS || typeof device.data !== "string") throw new Error("Token push invalid.");
    if (version !== generation || !login || (await read<Login>("login"))?.token !== login.token) return;
    await register(Platform.OS === "ios" ? device.data.toLowerCase() : device.data, scope);
  } finally { if (timer) clearTimeout(timer); }
}
/** Locally disabled immediately. Server revocation is durable and scoped to the old device row. */
export async function forgetPush() {
  ++generation;
  const r = await read<Registration>("push-registration");
  if (r?.revokeReceipt) await queueRevocation(r.revokeReceipt, r.validUntil);
  await remove("push-registration");
  await Notifications.dismissAllNotificationsAsync().catch(() => {});
}
export async function disablePush() {
  const r = await read<Registration>("push-registration");
  // Old installed versions did not have a revocation receipt. Upgrade online before disabling.
  if (r && !r.revokeReceipt && r.scope === await sessionScope())
    await api("/api/driver/push", { action: "off", transport: r.transport ?? "apns", token: r.token }, { scope: r.scope });
  await forgetPush();
  void syncRevocations().catch(() => {});
}
export async function syncPush() {
  const r = await read<Registration>("push-registration"), login = await read<Login>("login");
  if (!r || !login || r.scope !== await sessionScope()) return;
  if (!(await Notifications.getPermissionsAsync()).granted) { await disablePush(); return; }
  await channel();
  const status = await api<{ active: boolean; registered: boolean }>("/api/driver/push",
    { action: "status", transport: transport(), token: r.token }, { scope: r.scope });
  if (!status.registered && r.revokeReceipt && r.validUntil === login.expiresAt) { await forgetPush(); return; }
  if (!status.registered || r.validUntil !== login.expiresAt || !r.revokeReceipt) await register(r.token, r.scope);
}
export async function testPush() {
  const r = await read<Registration>("push-registration");
  if (!r || !await pushActive()) throw new Error("Activează mai întâi notificările.");
  const result = await api<{ status: string }>("/api/driver/push", { action: "test", transport: transport(), token: r.token }, { scope: r.scope });
  if (result.status !== "accepted") throw new Error(result.status === "queued"
    ? "Testul este în așteptare. Erorile temporare vor fi reîncercate; recepția nu este încă confirmată."
    : "Furnizorul nu a acceptat testul. Verifică configurarea notificărilor.");
}
export function listenPush(onOpen: () => void, onError: (message: string) => void) {
  let disposed = false;
  const tap = Notifications.addNotificationResponseReceivedListener(() => { if (!disposed) onOpen(); });
  const rotation = Notifications.addPushTokenListener(token => {
    if (token.type !== Platform.OS || typeof token.data !== "string") return;
    void (async () => {
      const r = await read<Registration>("push-registration");
      if (!disposed && r && r.scope === await sessionScope()) await register(Platform.OS === "ios" ? token.data.toLowerCase() : token.data, r.scope);
    })().catch(() => { if (!disposed) onError("Tokenul push nu a putut fi actualizat. Reîncearcă activarea notificărilor."); });
  });
  void Notifications.getLastNotificationResponseAsync().then(r => {
    if (!disposed && r) { onOpen(); void Notifications.clearLastNotificationResponseAsync().catch(() => {}); }
  }).catch(() => {});
  return () => { disposed = true; tap.remove(); rotation.remove(); };
}

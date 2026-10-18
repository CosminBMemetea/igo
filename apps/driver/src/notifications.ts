import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api, read, write, remove, sessionScope, type Login } from "./api";
type Registration = { token: string; scope: string; validUntil: string };
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
export async function pushActive() {
  const value = await read<Registration>("push-registration");
  return !!value && value.scope === await sessionScope() && Date.parse(value.validUntil) > Date.now();
}
async function register(token: string, scope: string) {
  const previous = await read<Registration>("push-registration");
  const r = await api<{ validUntil: string }>("/api/driver/push", { action: "on", token, previousToken: previous?.scope === scope ? previous.token : undefined }, { scope });
  if (await sessionScope() === scope) await write("push-registration", { token, scope, validUntil: r.validUntil });
}
export async function enablePush() {
  if (Platform.OS !== "ios") throw new Error("Activarea push nativă este pregătită momentan pentru iPhone. Pe Android poți folosi aplicația web instalată.");
  const scope = await sessionScope();
  const config = await api<{ configured: boolean; environment: string | null }>("/api/driver/push", undefined, { scope });
  if (!config.configured) throw new Error("Serviciul Apple Push așteaptă configurarea Querra. Alertele rămân disponibile în aplicație.");
  const environment = process.env.EXPO_PUBLIC_APNS_ENVIRONMENT ?? "production";
  if (config.environment !== environment) throw new Error("Buildul iOS și serverul folosesc medii Apple Push diferite. Contactează Querra.");
  const permission = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
  if (!permission.granted) throw new Error("Permite notificările în Setările iPhone pentru Querra Șofer.");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const device = await Promise.race([Notifications.getDevicePushTokenAsync(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Apple nu a returnat tokenul. Verifică semnarea aplicației, internetul și reîncearcă.")), 12000); })]);
    if (device.type !== "ios" || typeof device.data !== "string") throw new Error("Token Apple Push invalid.");
    await register(device.data.toLowerCase(), scope);
  } finally { if (timer) clearTimeout(timer); }
}
export async function disablePush() {
  const r = await read<Registration>("push-registration");
  if (r && r.scope === await sessionScope()) await api("/api/driver/push", { action: "off", token: r.token }, { scope: r.scope });
  await remove("push-registration");
}
export async function syncPush() {
  if (Platform.OS !== "ios") return;
  const r = await read<Registration>("push-registration"), login = await read<Login>("login");
  if (!r || !login || r.scope !== await sessionScope()) return;
  if (!(await Notifications.getPermissionsAsync()).granted) { await disablePush(); return; }
  const status = await api<{ active: boolean; registered: boolean }>("/api/driver/push", { action: "status", token: r.token }, { scope: r.scope });
  if (!status.registered) { await remove("push-registration"); return; }
  if (r.validUntil !== login.expiresAt) await register(r.token, r.scope);
}
export async function testPush() {
  const r = await read<Registration>("push-registration");
  if (!r || !await pushActive()) throw new Error("Activează mai întâi notificările.");
  const result = await api<{ status: string }>("/api/driver/push", { action: "test", token: r.token }, { scope: r.scope });
  if (result.status !== "accepted") throw new Error("Testul nu a fost încă acceptat de Apple. Erorile temporare vor fi reîncercate.");
}
export function listenPush(onOpen: () => void, onError: (message: string) => void) {
  const tap = Notifications.addNotificationResponseReceivedListener(() => onOpen());
  const rotation = Notifications.addPushTokenListener(token => {
    if (token.type !== "ios" || typeof token.data !== "string") return;
    void (async () => {
      const r = await read<Registration>("push-registration");
      if (r && r.scope === await sessionScope()) await register(token.data.toLowerCase(), r.scope);
    })().catch(() => onError("Tokenul push nu a putut fi actualizat. Reîncearcă activarea notificărilor."));
  });
  void Notifications.getLastNotificationResponseAsync().then(r => { if (r) { onOpen(); void Notifications.clearLastNotificationResponseAsync(); } });
  return () => { tap.remove(); rotation.remove(); };
}

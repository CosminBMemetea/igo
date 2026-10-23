import type { Store } from "./store/types";
import { newId } from "./store/types";
import { estimateKmh, limitFor, speedStep, type SpeedEventRow, type SpeedSample } from "./speed";
import { queueEmail } from "./email";
import { queuePush } from "./alert-delivery";
import { appOrigin } from "./app-origin";
import { tri, type Locale } from "./i18n";
import { localNow } from "./validate";
/** Skip owner push/email for the same truck within this window (the event is still recorded). */
export const OWNER_DEDUPE_MS = 15 * 60_000;
/** Runs after a driver position was accepted. Returns the reading so callers can log/test it. */
export async function recordSpeed(s: Store, firmId: string, userId: string, truckId: string, cur: SpeedSample, now = Date.now()) {
  const [cfg, recent, open] = await Promise.all([
    s.speedSettings(firmId),
    s.positions(firmId, localNow(new Date(now - 4 * 60_000)), truckId),
    s.openSpeedEvent(firmId, truckId),
  ]);
  const prev = recent.filter(p => p.capturedAt && p.capturedAt < cur.at).sort((a, b) => b.capturedAt!.localeCompare(a.capturedAt!))[0];
  const kmh = estimateKmh(cur, prev ? { at: prev.capturedAt!, lat: prev.lat, lng: prev.lng, accuracy: prev.accuracy ?? null } : null);
  const step = speedStep(open, cur, kmh, cfg, truckId, userId, () => newId("sp"));
  for (const id of step.drop) await s.deleteSpeedEvent(firmId, id);
  for (const e of step.save) await s.saveSpeedEvent(firmId, e);
  let queued = false;
  if (step.notify) queued = await notifyOwners(s, firmId, step.notify, now);
  return { kmh, limit: limitFor(cfg, truckId), notify: !!step.notify, queued };
}
async function notifyOwners(s: Store, firmId: string, e: SpeedEventRow, now: number) {
  const recent = await s.speedEvents(firmId, { truckId: e.truckId, sinceAt: new Date(now - OWNER_DEDUPE_MS - 3600_000).toISOString(), limit: 50 });
  if (recent.some(x => x.id !== e.id && x.ownerNotified && Date.parse(x.lastAt) > now - OWNER_DEDUPE_MS)) return false;
  const [users, trucks] = await Promise.all([s.users(firmId), s.trucks(firmId)]);
  const plate = trucks.find(t => t.id === e.truckId)?.plate ?? "", driver = users.find(u => u.id === e.userId)?.name ?? "";
  const kmh = Math.round(e.maxKmh);
  await s.addNotifications(firmId, [{ key: `speed:${e.id}`, userId: null, kind: "speeding", docId: null, params: { eventId: e.id, label: plate, driver, kmh, limit: e.limitKmh, at: e.startAt } }]);
  for (const u of users.filter(u => u.role === "owner" && !u.disabledAt)) {
    const loc = (["ro", "en", "pl"].includes(u.locale ?? "") ? u.locale : "ro") as Locale;
    const key = `speed:${e.id}:${u.id}`, context = { kind: "speed" as const, userId: u.id, eventId: e.id };
    const subject = `${tri(loc, "Depășire a limitei setate|Set limit exceeded|Przekroczenie ustawionego limitu")} · ${plate}`;
    const text = `${tri(loc, "Avertizare la depășirea limitei setate de tine.|Warning: the limit you set was exceeded.|Ostrzeżenie: przekroczono ustawiony przez Ciebie limit.")}\n${plate}${driver ? ` · ${driver}` : ""}\n${kmh} km/h · ${tri(loc, "limită|limit|limit")} ${e.limitKmh} km/h\n\n${tri(loc, "Viteza vine din GPS-ul telefonului și poate avea erori. Nu este o măsurare oficială.|Speed comes from the phone GPS and can be inaccurate. It is not an official measurement.|Prędkość pochodzi z GPS telefonu i może być niedokładna. To nie jest pomiar urzędowy.")}\n${appOrigin()}/speeding\n\nQuerra Fleet`;
    if (u.email && u.emailAlerts !== false) await queueEmail(s, firmId, key, { to: u.email, subject, text }, null, { context, defer: true });
    await queuePush(s, firmId, u, key, context);
  }
  return true;
}

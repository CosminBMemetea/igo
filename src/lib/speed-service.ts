import type { Store } from "./store/types";
import { newId } from "./store/types";
import { estimateKmh, limitFor, speedStep, NOTIFY_BACKOFF_S, NOTIFY_MAX_ATTEMPTS, type SpeedEventRow, type SpeedSample } from "./speed";
export { NOTIFY_BACKOFF_S, NOTIFY_MAX_ATTEMPTS };
import { queueEmail } from "./email";
import { queuePush } from "./alert-delivery";
import { appOrigin } from "./app-origin";
import { tri, type Locale } from "./i18n";
import { localNow } from "./validate";
/** Skip owner alerts for an event starting within this window after an earlier, already-notified event on the same truck (the event is still recorded). */
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
  // saveSpeedEvent writes motion only; delivery state goes through updateSpeedNotify (so retries and concurrent readings cannot undo each other).
  for (const e of step.save) await s.saveSpeedEvent(firmId, e);
  let queued = false;
  if (step.notify) {
    await s.updateSpeedNotify(firmId, step.notify.id, { notifyDue: true });
    queued = (await deliverSpeedAlert(s, firmId, step.notify, now)).queued;
  }
  // Opportunistic retry of this firm's due, unsent alerts (open or closed events), with backoff; the daily cron covers idle firms.
  // Cheap: LIMIT 3 on the partial index speed_events_firm_pending_ix (only undelivered rows); usually returns nothing.
  const pending = await s.pendingSpeedNotifications({ firmId, dueAt: new Date(now).toISOString(), maxAttempts: NOTIFY_MAX_ATTEMPTS, limit: 3 }).catch(() => []);
  for (const e of pending) if (e.id !== step.notify?.id && (await deliverSpeedAlert(s, firmId, e, now)).queued) queued = true;
  return { kmh, limit: limitFor(cfg, truckId), notify: !!step.notify, queued };
}
/** While an attempt runs, the row is leased so a concurrent reading or the cron skips it (no duplicate delivery). */
const NOTIFY_LEASE_MS = 120_000;
/** One delivery attempt for a due alert. It first claims the row (due → leased); if another reading or the cron holds it, it does nothing.
 *  Channels already done are skipped and outbox keys are idempotent, so even an expired lease cannot double-send. */
export async function deliverSpeedAlert(s: Store, firmId: string, row: SpeedEventRow, now = Date.now()): Promise<{ queued: boolean; status: "queued" | "deduped" | "failed" | "busy" }> {
  const e = await s.claimSpeedNotify(firmId, row.id, new Date(now).toISOString(), new Date(now + NOTIFY_LEASE_MS).toISOString(), NOTIFY_MAX_ATTEMPTS);
  if (!e) return { queued: false, status: "busy" };
  const done = new Set(e.notifyDone ?? []), attempts = (e.notifyAttempts ?? 0) + 1;
  const r = await notifyOwners(s, firmId, e, now, done).catch((err) => ({ status: "failed" as const, errors: [`setup: ${err instanceof Error ? err.message : String(err)}`] }));
  const notifyDone = [...done];
  if (r.status === "deduped") await s.updateSpeedNotify(firmId, e.id, { notifyAttempts: NOTIFY_MAX_ATTEMPTS, notifyNextAt: null, notifyDone: [...notifyDone, "deduped"] });
  else if (r.status === "queued") await s.updateSpeedNotify(firmId, e.id, { ownerNotified: true, notifyAttempts: attempts, notifyNextAt: null, notifyDone });
  else {
    const last = attempts >= NOTIFY_MAX_ATTEMPTS, wait = NOTIFY_BACKOFF_S[Math.min(attempts, NOTIFY_BACKOFF_S.length) - 1];
    await s.updateSpeedNotify(firmId, e.id, { notifyAttempts: attempts, notifyNextAt: last ? null : new Date(now + wait * 1000).toISOString(), notifyDone });
    // one line per attempt (attempts are spaced by the backoff), not per reading
    console.error(`speed notify failed event=${e.id} attempt=${attempts}/${NOTIFY_MAX_ATTEMPTS}${last ? " giving-up" : ` retry-in=${wait}s`}: ${r.errors.join("; ")}`);
  }
  // something new went into the outbox (email/push) on this attempt → the caller should drain
  return { queued: notifyDone.some(k => !(e.notifyDone ?? []).includes(k) && (k.startsWith("email:") || k.startsWith("push:"))), status: r.status };
}
/** Cron pass over all firms: due, unsent alerts. */
export async function retrySpeedAlerts(s: Store, now = Date.now(), limit = 200) {
  const rows = await s.pendingSpeedNotifications({ dueAt: new Date(now).toISOString(), maxAttempts: NOTIFY_MAX_ATTEMPTS, limit });
  let sent = 0, failed = 0, busy = 0;
  for (const e of rows) { const r = await deliverSpeedAlert(s, e.firmId, e, now); if (r.status === "failed") failed++; else if (r.status === "busy") busy++; else sent++; }
  return { processed: rows.length, sent, failed, busy };
}
/** Channels: "inbox", "email:<ownerId>", "push:<ownerId>" (recorded in `done`). The APP_URL check only gates email (the only channel with a link in its body). */
async function notifyOwners(s: Store, firmId: string, e: SpeedEventRow, now: number, done: Set<string>): Promise<{ status: "queued" | "deduped" | "failed"; errors: string[] }> {
  if (!done.size) {
    const recent = await s.speedEvents(firmId, { truckId: e.truckId, sinceAt: new Date(Date.parse(e.startAt) - OWNER_DEDUPE_MS - 3600_000).toISOString(), limit: 50 });
    if (recent.some(x => x.id !== e.id && x.ownerNotified && Math.abs(Date.parse(x.lastAt) - Date.parse(e.startAt)) < OWNER_DEDUPE_MS && x.startAt < e.startAt)) return { status: "deduped", errors: [] };
  }
  const [users, trucks] = await Promise.all([s.users(firmId), s.trucks(firmId)]);
  const plate = trucks.find(t => t.id === e.truckId)?.plate ?? "", driver = users.find(u => u.id === e.userId)?.name ?? "";
  const kmh = Math.round(e.maxKmh), errors: string[] = [];
  const attempt = async (channel: string, f: () => Promise<unknown>) => { if (done.has(channel)) return; try { await f(); done.add(channel); } catch (err) { errors.push(`${channel}: ${err instanceof Error ? err.message : String(err)}`); } };
  await attempt("inbox", () => s.addNotifications(firmId, [{ key: `speed:${e.id}`, userId: null, kind: "speeding", docId: null, params: { eventId: e.id, label: plate, driver, kmh, limit: e.limitKmh, at: e.startAt } }]));
  for (const u of users.filter(u => u.role === "owner" && !u.disabledAt)) {
    const loc = (["ro", "en", "pl"].includes(u.locale ?? "") ? u.locale : "ro") as Locale;
    const key = `speed:${e.id}:${u.id}`, context = { kind: "speed" as const, userId: u.id, eventId: e.id };
    const subject = `${tri(loc, "Depășire a limitei setate|Set limit exceeded|Przekroczenie ustawionego limitu")} · ${plate}`;
    if (u.email && u.emailAlerts !== false) await attempt(`email:${u.id}`, () => {
      const text = `${tri(loc, "Avertizare la depășirea limitei setate de tine.|Warning: the limit you set was exceeded.|Ostrzeżenie: przekroczono ustawiony przez Ciebie limit.")}\n${plate}${driver ? ` · ${driver}` : ""}\n${kmh} km/h · ${tri(loc, "limită|limit|limit")} ${e.limitKmh} km/h\n\n${tri(loc, "Viteza vine din GPS-ul telefonului și poate avea erori. Nu este o măsurare oficială.|Speed comes from the phone GPS and can be inaccurate. It is not an official measurement.|Prędkość pochodzi z GPS telefonu i może być niedokładna. To nie jest pomiar urzędowy.")}\n${appOrigin()}/speeding\n\nQuerra Fleet`;
      return queueEmail(s, firmId, key, { to: u.email!, subject, text }, null, { context, defer: true });
    });
    await attempt(`push:${u.id}`, () => queuePush(s, firmId, u, key, context));
  }
  return { status: errors.length ? "failed" : "queued", errors };
}

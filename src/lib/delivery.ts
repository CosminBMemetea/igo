import type { Store, EmailRow, PushDevice } from "./store/types";
import { emailProvider, type EmailProvider } from "./email-provider";
import { pushProvider, type PushProvider } from "./push";
import { DeliveryError } from "./delivery-errors";
import { reminderDocuments } from "./compliance-reminders";
import { daysLeft, stageFor } from "./docs";
import { localNow } from "./validate";
export type DeliveryProviders = { email: EmailProvider | null; push: PushProvider | null };
export const deliveryProviders = (): DeliveryProviders => ({ email: emailProvider(), push: pushProvider() });
export const MAX_ATTEMPTS = 8;
/** Re-evaluate membership, assignment and document version at delivery time, not just enqueue time. */
export async function deliveryRecipient(s: Store, row: EmailRow, today: string, now = Date.now()): Promise<{ valid: boolean; device?: PushDevice }> {
  const c = row.context;
  if (!c) return { valid: row.channel === "email" }; // time-limited lead confirmations/admin messages
  const u = await s.userById(c.userId);
  if (!u || u.disabledAt || !u.passwordHash || u.firmId !== row.firmId) return { valid: false };
  if (row.channel === "email" && (u.email !== row.to || (c.kind !== "account" && u.emailAlerts === false))) return { valid: false };
  let device: PushDevice | undefined;
  if (row.channel === "push") {
    device = (await s.pushDevices(u.firmId, u.id)).find(d => d.id === row.subscriptionId && d.sessionVersion === (u.sessionVersion ?? 0) && (!d.validUntil || Date.parse(d.validUntil) > now));
    if (!device || (device.nativeSessionId && await s.mobileSessionRevoked(device.nativeSessionId))) return { valid: false };
  }
  if (c.kind === "account") return { valid: (u.sessionVersion ?? 0) === c.version, device };
  if (c.kind === "test") return { valid: true, device };
  const [docs, trucks, users] = await Promise.all([s.docs(u.firmId), s.trucks(u.firmId), s.users(u.firmId)]);
  if (c.kind === "document") {
    const d = reminderDocuments(docs, trucks, users, today).find(d => d.id === c.docId && d.expires === c.expires);
    return { valid: !!d && stageFor(daysLeft(d.expires, today)) === c.stage && (u.role === "owner" || d.userId === u.id || (!!d.truckId && d.truckId === u.truckId)), device };
  }
  const task = (await s.complianceTasks(u.firmId)).find(t => t.id === c.taskId);
  const assigned = task && users.find(driver => driver.id === task.driverId && !driver.disabledAt && driver.truckId === task.truckId);
  return { valid: !!task && !!assigned && task.status === c.status && !!trucks.find(t => t.id === task.truckId && !t.archivedAt) &&
    (u.role === "owner" || (task.driverId === u.id && u.truckId === task.truckId)), device };
}
export function retryDelay(attempt: number, key: string) {
  const jitter = [...key].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 30_000, 0);
  return Math.min(6 * 3600000, 60_000 * 2 ** Math.max(0, attempt - 1)) + jitter;
}
export async function deliverClaim(s: Store, row: EmailRow, providers: DeliveryProviders, now = Date.now(), today = localNow().slice(0, 10)) {
  const finish = (status: "sent" | "queued" | "failed" | "cancelled", error: string | null, providerId?: string, nextAttemptAt?: string) => s.finishDelivery(row.id, row.leaseToken!, { status, error, providerId, nextAttemptAt });
  if (Date.parse(row.expiresAt) <= now) { await finish("cancelled", "expired"); return "cancelled" as const; }
  // Resend retains idempotency keys for 24h. Ambiguous requests must never be retried beyond that boundary.
  if (row.attempts > MAX_ATTEMPTS || (row.channel === "email" && row.firstAttemptAt && now - Date.parse(row.firstAttemptAt) >= 23 * 3600000)) {
    await finish("failed", "retry-window-ended"); return "failed" as const;
  }
  try {
    const recipient = await deliveryRecipient(s, row, today, now);
    if (!recipient.valid) { await finish("cancelled", "recipient-or-context-changed"); return "cancelled" as const; }
    const p = providers[row.channel];
    if (!p) { await finish("queued", "provider-not-configured", undefined, new Date(now + 300000).toISOString()); return "queued" as const; }
    const accepted = row.channel === "email" ? await providers.email!.send({ to: row.to, subject: row.subject, text: row.body }, `qfleet/${row.id}`) : await providers.push!.send(recipient.device!, row.key);
    await finish("sent", null, accepted.id);
    return "sent" as const;
  } catch (e) {
    const err = e instanceof DeliveryError ? e : new DeliveryError("delivery-temporary-error", true);
    if (err.removeDevice && row.firmId && row.context) await s.removePushDevice(row.firmId, row.context.userId, row.subscriptionId ?? undefined);
    const retry = err.retryable && row.attempts < MAX_ATTEMPTS;
    const next = now + Math.max(retryDelay(row.attempts, row.id), err.retryAfterMs);
    const canRetry = retry && next < Date.parse(row.expiresAt) && (row.channel !== "email" || next < Date.parse(row.firstAttemptAt!) + 23 * 3600000);
    await finish(canRetry ? "queued" : "failed", err.code, undefined, new Date(next).toISOString());
    return canRetry ? "queued" as const : "failed" as const;
  }
}
/** Bounded worker; concurrent invocations are safe. Disabled channels never consume attempts. */
export async function drainDeliveries(s: Store, options: { providers?: DeliveryProviders; now?: number; today?: string; max?: number; budgetMs?: number; id?: string } = {}) {
  const providers = options.providers ?? deliveryProviders();
  const channels = (["email", "push"] as const).filter(c => providers[c]);
  const result = { sent: 0, queued: 0, failed: 0, cancelled: 0, processed: 0, configured: channels };
  const deadline = Date.now() + (options.budgetMs ?? 40_000);
  while (result.processed < (options.max ?? 80) && Date.now() < deadline - 11000) {
    const now = options.now ?? Date.now();
    const row = await s.claimDelivery(channels, new Date(now).toISOString(), options.id);
    if (!row) break;
    const status = await deliverClaim(s, row, providers, now, options.today);
    result[status]++; result.processed++;
  }
  return result;
}

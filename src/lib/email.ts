import type { Store, DeliveryContext } from "./store/types";
import { emailProvider, type EmailMsg } from "./email-provider";
import { drainDeliveries } from "./delivery";
export { emailProvider, ResendProvider } from "./email-provider";
export type { EmailMsg, EmailProvider } from "./email-provider";
/** Durable enqueue first; provider idempotency + atomic lease protect every immediate send/retry. */
export async function queueEmail(s: Store, firmId: string | null, key: string, m: EmailMsg, p = emailProvider(), options: { context?: DeliveryContext; expiresAt?: string; defer?: boolean; today?: string } = {}) {
  const row = await s.addEmail({ firmId, key, to: m.to, subject: m.subject, body: m.text, context: options.context ?? null, expiresAt: options.expiresAt });
  if (!row) return null;
  if (!p || options.defer) return "queued" as const;
  const r = await drainDeliveries(s, { providers: { email: p, push: null }, id: row.id, max: 1, today: options.today });
  return r.sent ? "sent" as const : r.failed ? "failed" as const : "queued" as const;
}

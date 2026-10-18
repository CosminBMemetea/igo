import { httpFailure, DeliveryError } from "./delivery-errors";
export interface EmailMsg { to: string; subject: string; text: string }
export interface EmailProvider { name: string; send(m: EmailMsg, idempotencyKey?: string): Promise<{ id: string }> }
export class ResendProvider implements EmailProvider {
  name = "resend";
  constructor(private key: string, private from: string) {}
  async send(m: EmailMsg, idempotencyKey?: string) {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: { authorization: `Bearer ${this.key}`, "content-type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
      body: JSON.stringify({ from: this.from, to: [m.to], subject: m.subject, text: m.text }) });
    if (!r.ok) { await r.body?.cancel(); throw httpFailure("email", r.status, r.headers.get("retry-after")); }
    const j = await r.json().catch(() => ({})) as { id?: string };
    if (typeof j.id !== "string" || !j.id) throw new DeliveryError("email-invalid-response", true);
    return { id: j.id };
  }
}
export function emailProvider(): EmailProvider | null {
  const k = process.env.RESEND_API_KEY, f = process.env.EMAIL_FROM;
  return k && f ? new ResendProvider(k, f) : null;
}

// Querra Fleet: trimitere email în spatele unei interfețe. Furnizor: Resend (RESEND_API_KEY + EMAIL_FROM).
// Fără configurare: mesajul rămâne în coadă („queued”) și adminul îl vede ca netrimis — nu se simulează trimiterea.
import type { Store } from "./store/types";
export interface EmailMsg { to: string; subject: string; text: string }
export interface EmailProvider { name: string; send(m: EmailMsg): Promise<{ id: string }> }
export class ResendProvider implements EmailProvider {
  name = "resend";
  constructor(private key: string, private from: string) {}
  async send(m: EmailMsg) {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${this.key}`, "content-type": "application/json" }, body: JSON.stringify({ from: this.from, to: [m.to], subject: m.subject, text: m.text }) });
    const j = (await r.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!r.ok || !j.id) throw new Error(j.message || `HTTP ${r.status}`);
    return { id: j.id };
  }
}
export function emailProvider(): EmailProvider | null {
  const k = process.env.RESEND_API_KEY, f = process.env.EMAIL_FROM;
  return k && f ? new ResendProvider(k, f) : null;
}
/** Pune în coadă (deduplicat pe key) și trimite dacă există furnizor. Întoarce starea finală sau null dacă era deja în coadă. */
export async function queueEmail(s: Store, firmId: string | null, key: string, m: EmailMsg, p = emailProvider()) {
  const row = await s.addEmail({ firmId, key, to: m.to, subject: m.subject, body: m.text });
  if (!row) return null;
  if (!p) return "queued" as const;
  try { const r = await p.send(m); await s.setEmailStatus(row.id, "sent", null, r.id); return "sent" as const; }
  catch (e) { await s.setEmailStatus(row.id, "failed", String((e as Error).message).slice(0, 300), null); return "failed" as const; }
}

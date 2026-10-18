import { apnsConfig, sendApns } from "./apns";
import webpush from "web-push";
import { ECDH, createHash } from "node:crypto";
import type { PushDevice } from "./store/types";
import { DeliveryError, httpFailure } from "./delivery-errors";
export interface PushProvider { send(d: PushDevice, key: string): Promise<{ id: string }> }
/** Do not turn client-supplied subscription URLs into an arbitrary server-side HTTP proxy. */
export function validPushEndpoint(raw: string) {
  try {
    const u = new URL(raw);
    const host = u.hostname;
    return raw.length <= 2048 && u.protocol === "https:" && !u.username && !u.password && !u.port && !u.hash &&
      (host === "fcm.googleapis.com" || host === "updates.push.services.mozilla.com" || host === "web.push.apple.com" || /^[a-z0-9-]+\.notify\.windows\.com$/.test(host));
  } catch { return false; }
}
export function validPushSubscription(s: unknown): s is { endpoint: string; keys: { p256dh: string; auth: string } } {
  if (!s || typeof s !== "object") return false;
  const v = s as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof v.endpoint !== "string" || !validPushEndpoint(v.endpoint) || !v.keys || typeof v.keys.p256dh !== "string" || typeof v.keys.auth !== "string") return false;
  if (!/^[A-Za-z0-9_-]{87}=?$/.test(v.keys.p256dh) || !/^[A-Za-z0-9_-]{22}={0,2}$/.test(v.keys.auth)) return false;
  try { return Buffer.from(v.keys.auth, "base64url").length === 16 && ECDH.convertKey(Buffer.from(v.keys.p256dh, "base64url"), "prime256v1", undefined, undefined, "uncompressed").length === 65; } catch { return false; }
}
export function pushConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY, privateKey = process.env.VAPID_PRIVATE_KEY, subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;
  try { webpush.getVapidHeaders("https://web.push.apple.com", subject, publicKey, privateKey, "aes128gcm"); return { publicKey, privateKey, subject }; } catch { return null; }
}
export function pushProvider(): PushProvider | null {
  const vapidDetails = pushConfig();
  if (!vapidDetails && !apnsConfig()) return null;
  return { async send(d, key) {
    if (d.transport === "apns") return sendApns(d.endpoint.replace(/^apns:/, ""), key);
    if (!vapidDetails) throw new DeliveryError("webpush-not-configured", true, 300000);
    if (!validPushSubscription({ endpoint: d.endpoint, keys: d })) throw new DeliveryError("push-invalid-subscription", false, 0, true);
    const tag = createHash("sha256").update(key).digest("base64url").slice(0, 32);
    // Generic lock-screen content. Authentication and current role are checked when the app opens.
    const data = webpush.generateRequestDetails({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, JSON.stringify({ title: "Querra Fleet", body: "Ai o notificare nouă. Deschide aplicația pentru detalii.", tag, url: "/notifications" }), { vapidDetails, TTL: 3600, urgency: "normal", topic: tag });
    const r = await fetch(data.endpoint, { method: "POST", headers: data.headers as Record<string, string>, body: new Uint8Array(data.body!), redirect: "error", signal: AbortSignal.timeout(10_000) });
    await r.body?.cancel();
    if (!r.ok) throw httpFailure("push", r.status, r.headers.get("retry-after"));
    return { id: `push:${tag}` };
  } };
}

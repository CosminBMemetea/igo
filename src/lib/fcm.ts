import { createHash, createPrivateKey, sign } from "node:crypto";
import { DeliveryError, retryAfter } from "./delivery-errors";

/** Server-only service account. Never use an EXPO_PUBLIC_/NEXT_PUBLIC_ variable. */
export function fcmConfig() {
  try {
    const value = JSON.parse(process.env.FCM_SERVICE_ACCOUNT_JSON ?? "");
    if (value.type !== "service_account" || typeof value.project_id !== "string" || !/^[a-z][a-z0-9-]{4,62}$/.test(value.project_id)
      || typeof value.client_email !== "string" || !value.client_email.endsWith(".iam.gserviceaccount.com")) return null;
    const key = createPrivateKey(value.private_key);
    if (key.asymmetricKeyType !== "rsa" || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) return null;
    return { projectId: value.project_id as string, email: value.client_email as string, key };
  } catch { return null; }
}
export const validFcmToken = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_:.-]{100,2048}$/.test(value);
const oauthURL = "https://oauth2.googleapis.com/token";
type Config = NonNullable<ReturnType<typeof fcmConfig>>;
let cached: { identity: string; token: string; until: number } | undefined;
let flight: { identity: string; promise: Promise<string> } | undefined;
async function accessToken(config: Config) {
  const identity = createHash("sha256").update(config.email).update(config.key.export({ type: "pkcs8", format: "der" })).digest("hex");
  if (cached?.identity === identity && cached.until > Date.now()) return cached.token;
  if (flight?.identity === identity) return flight.promise;
  const promise = (async () => {
    const now = Math.floor(Date.now() / 1000), encode = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
    const payload = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iss: config.email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: oauthURL, iat: now, exp: now + 3600 })}`;
    const assertion = `${payload}.${sign("RSA-SHA256", Buffer.from(payload), config.key).toString("base64url")}`;
    const res = await fetch(oauthURL, { method: "POST", redirect: "error", signal: AbortSignal.timeout(10000),
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
    if (!res.ok) { await res.body?.cancel(); throw new DeliveryError(`fcm-auth-${res.status}`, true, 300000); }
    const data = await res.json();
    if (typeof data.access_token !== "string" || !data.access_token || !Number.isFinite(data.expires_in) || data.expires_in <= 60)
      throw new DeliveryError("fcm-auth-response", true, 300000);
    cached = { identity, token: data.access_token, until: Date.now() + Math.min(data.expires_in - 60, 3500) * 1000 };
    return cached.token;
  })();
  flight = { identity, promise };
  try { return await promise; } finally { if (flight?.promise === promise) flight = undefined; }
}
export function fcmFailure(status: number, code: string, after: string | null) {
  // A generic 404 can mean a missing project/API, not an invalid device.
  if (code === "UNREGISTERED") return new DeliveryError("fcm-device-revoked", false, 0, true);
  if (status === 401 || status === 403 || code === "SENDER_ID_MISMATCH")
    return new DeliveryError("fcm-configuration", true, 300000);
  return new DeliveryError(`fcm-http-${status}`, status === 408 || status === 429 || status >= 500,
    Math.max(retryAfter(after), status === 429 ? 60000 : 0));
}
export async function sendFcm(token: string, key: string) {
  const config = fcmConfig();
  if (!config) throw new DeliveryError("fcm-not-configured", true, 300000);
  if (!validFcmToken(token)) throw new DeliveryError("fcm-invalid-token", false, 0, true);
  const tag = createHash("sha256").update(key).digest("hex").slice(0, 32);
  for (let attempt = 0; attempt < 2; attempt++) {
    const bearer = await accessToken(config);
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${config.projectId}/messages:send`, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { token,
        notification: { title: "Querra Fleet", body: "Ai o notificare nouă. Deschide aplicația pentru detalii." },
        data: { screen: "notifications" },
        android: { priority: "HIGH", ttl: "3600s", notification: { channel_id: "qfleet-alerts", tag, sound: "default" } },
      } }),
    });
    if (res.status === 401 && attempt === 0) { if (cached?.token === bearer) cached = undefined; await res.body?.cancel(); continue; }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = data?.error?.details?.find((d: { "@type"?: string }) => d["@type"] === "type.googleapis.com/google.firebase.fcm.v1.FcmError");
      throw fcmFailure(res.status, detail?.errorCode ?? "", res.headers.get("retry-after"));
    }
    if (typeof data?.name !== "string") throw new DeliveryError("fcm-response", true);
    return { id: data.name };
  }
  throw new DeliveryError("fcm-auth", true, 300000);
}

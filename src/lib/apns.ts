import { connect } from "node:http2";
import { createHash, createPrivateKey, sign } from "node:crypto";
import { DeliveryError, httpFailure } from "./delivery-errors";
export function apnsConfig() {
  const keyId = process.env.APNS_KEY_ID, teamId = process.env.APNS_TEAM_ID, pem = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, "\n"), topic = process.env.APNS_TOPIC;
  const environment = process.env.APNS_ENVIRONMENT;
  if (!keyId || !teamId || !pem || !topic || !["sandbox", "production"].includes(environment ?? "")) return null;
  try { const key = createPrivateKey(pem); if (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1") return null; return { keyId, teamId, key, topic, environment }; } catch { return null; }
}
export function apnsJWT(config: NonNullable<ReturnType<typeof apnsConfig>>, now = Date.now()) {
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: config.keyId })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ iss: config.teamId, iat: Math.floor(now / 1000) })).toString("base64url");
  return `${header}.${body}.${sign("sha256", Buffer.from(`${header}.${body}`), { key: config.key, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
}
export const validApnsToken = (s: unknown): s is string => typeof s === "string" && /^[a-f0-9]{64,256}$/.test(s) && s.length % 2 === 0;
export function apnsFailure(status: number, reason: string) {
  if (status === 410 || (status === 400 && reason === "BadDeviceToken")) return new DeliveryError("apns-device-revoked", false, 0, true);
  return httpFailure("push", status, null);
}
let jwtCache: { identity: string; token: string; until: number } | null = null;
export async function sendApns(token: string, key: string) {
  const config = apnsConfig();
  if (!config) throw new DeliveryError("apns-not-configured", true, 300000);
  if (!validApnsToken(token)) throw new DeliveryError("apns-invalid-token", false, 0, true);
  const identity = `${config.teamId}:${config.keyId}:${createHash("sha256").update(config.key.export({ type: "pkcs8", format: "der" })).digest("hex")}`;
  if (!jwtCache || jwtCache.identity !== identity || jwtCache.until < Date.now()) jwtCache = { identity, token: apnsJWT(config), until: Date.now() + 40 * 60000 };
  const auth = jwtCache.token, collapse = createHash("sha256").update(key).digest("hex");
  return new Promise<{ id: string }>((resolve, reject) => {
    const client = connect(config.environment === "sandbox" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com");
    const timer = setTimeout(() => { client.destroy(); reject(new DeliveryError("apns-timeout", true)); }, 10000);
    const fail = () => { clearTimeout(timer); client.destroy(); reject(new DeliveryError("apns-network", true)); };
    client.on("error", fail);
    const request = client.request({ ":method": "POST", ":path": `/3/device/${token}`, authorization: `bearer ${auth}`, "apns-topic": config.topic,
      "apns-push-type": "alert", "apns-priority": "10", "apns-expiration": String(Math.floor(Date.now() / 1000) + 3600), "apns-collapse-id": collapse });
    let status = 0, id = "", data = "";
    request.on("response", h => { status = Number(h[":status"]); id = String(h["apns-id"] ?? collapse); });
    request.on("data", b => { if (data.length < 2048) data += b.toString(); });
    request.on("error", fail);
    request.on("end", () => {
      clearTimeout(timer); client.close();
      if (status === 200) resolve({ id });
      else { let reason = ""; try { reason = JSON.parse(data).reason; } catch {} reject(apnsFailure(status || 503, reason)); }
    });
    request.end(JSON.stringify({ aps: { alert: { title: "Querra Fleet", body: "Ai o notificare nouă. Deschide aplicația pentru detalii." }, sound: "default", "thread-id": "qfleet-alerts" }, screen: "notifications" }));
  });
}

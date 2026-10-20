import { fcmConfig, validFcmToken } from "@/lib/fcm";
import { mobileSessionId } from "@/lib/mobile-logout";
import { signToken } from "@/lib/session";
import { createHash } from "node:crypto";
import { notificationActor, notificationBody } from "@/lib/notification-auth";
import { verifyMobileSession } from "@/lib/mobile-session";
import { apnsConfig, validApnsToken } from "@/lib/apns";
import { store } from "@/lib/store";
import { drainDeliveries } from "@/lib/delivery";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
async function actor(req: Request) {
  if (process.env.MOBILE_DRIVER_ENABLED !== "1") return null;
  const token = req.headers.get("authorization");
  const session = token?.startsWith("Bearer ") ? await verifyMobileSession(token.slice(7), process.env.SESSION_SECRET) : null;
  const user = session ? await notificationActor() : null;
  return session && user?.role === "driver" && user.id === session.uid ? { user, session } : null;
}
export async function GET(req: Request) {
  if (!await actor(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const android = new URL(req.url).searchParams.get("transport") === "fcm";
  return Response.json(android ? { configured: !!fcmConfig(), projectId: fcmConfig()?.projectId ?? null } : { configured: !!apnsConfig(), environment: apnsConfig()?.environment ?? null }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(req: Request) {
  const a = await actor(req);
  if (!a) return Response.json({ error: "unauthorized" }, { status: 401 });
  const b = await notificationBody(req).catch(() => null), s = store(), { user: u, session } = a;
  const transport = b?.transport ?? "apns", validToken = transport === "fcm" ? validFcmToken : validApnsToken;
  if (!b || (transport !== "apns" && transport !== "fcm") || !validToken(b.token)) return Response.json({ error: "token" }, { status: 400 });
  const binding = `${transport}:${createHash("sha256").update(b.token).digest("hex")}`;
  const sessionId = mobileSessionId(req.headers.get("authorization")!.slice(7));
  const devices = await s.pushDevices(u.firmId, u.id);
  const existing = devices.find(d => d.binding === binding && d.sessionVersion === session.version && d.nativeSessionId === sessionId);
  if (b.action === "off") {
    if (existing) await s.removePushDevice(u.firmId, u.id, existing.id);
    else if (devices.some(d => d.binding === binding && !d.nativeSessionId))
      return Response.json({ error: "registration-upgrade-required" }, { status: 409 });
    return Response.json({ ok: true });
  }
  if (b.action === "status") return Response.json({ registered: !!existing, active: !!existing && (!existing.validUntil || Date.parse(existing.validUntil) > Date.now()) });
  if (!(transport === "fcm" ? fcmConfig() : apnsConfig())) return Response.json({ error: "push-not-configured" }, { status: 503 });
  if (b.action === "test") {
    if (!existing || (existing.validUntil && Date.parse(existing.validUntil) <= Date.now())) return Response.json({ error: "subscribe-first" }, { status: 409 });
    const row = await s.addEmail({ firmId: u.firmId, key: `push-test:${u.id}:${Math.floor(Date.now() / 60000)}`, to: "", subject: "Test notificare", body: "", channel: "push", subscriptionId: existing.id, context: { kind: "test", userId: u.id }, expiresAt: new Date(Date.now() + 600000).toISOString() });
    if (!row) return Response.json({ error: "wait-one-minute" }, { status: 429 });
    const r = await drainDeliveries(s, { id: row.id, max: 1 });
    return Response.json({ status: r.sent ? "accepted" : r.failed ? "failed" : "queued" });
  }
  if (b.action !== "on") return Response.json({ error: "action" }, { status: 400 });
  const expires = new Date(session.exp * 1000).toISOString();
  const response = async (id: string) => Response.json({ ok: true, validUntil: expires,
    revokeReceipt: await signToken({ purpose: "driver-push-revoke", id, firm: u.firmId, uid: u.id, exp: session.exp }, process.env.SESSION_SECRET!) });
  if (existing?.validUntil === expires) return response(existing.id);
  if ((await s.authFail(`native-push:${u.id}`, 20, 10)).lockedUntil) return Response.json({ error: "rate-limit" }, { status: 429 });
  if (!existing && (await s.pushDevices(u.firmId, u.id)).length >= 10) return Response.json({ error: "device-limit" }, { status: 409 });
  const device = await s.savePushDevice({ firmId: u.firmId, userId: u.id, binding, endpoint: `${transport}:${b.token}`, p256dh: "", auth: "", transport, nativeSessionId: sessionId, sessionVersion: session.version, validUntil: expires });
  if (validToken(b.previousToken) && b.previousToken !== b.token) {
    const previousBinding = `${transport}:${createHash("sha256").update(b.previousToken).digest("hex")}`;
    const previous = devices.find(d => d.binding === previousBinding && d.nativeSessionId === sessionId);
    // Delete by immutable row identity: a new login may have rebound the token meanwhile.
    if (previous) await s.removePushDevice(u.firmId, u.id, previous.id);
  }
  return response(device.id);
}

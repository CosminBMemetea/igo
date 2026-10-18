import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { store } from "@/lib/store";
import { pushConfig, validPushSubscription } from "@/lib/push";
import { notificationActor, notificationSameOrigin, notificationBody, PUSH_COOKIE } from "@/lib/notification-auth";
import { drainDeliveries } from "@/lib/delivery";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
export async function GET() {
  const u = await notificationActor();
  if (!u) return fail("unauthorized", 401);
  const binding = (await cookies()).get(PUSH_COOKIE)?.value;
  const devices = await store().pushDevices(u.firmId, u.id);
  const active = binding ? devices.some(d => d.binding === binding && d.sessionVersion === (u.sessionVersion ?? 0)) : false;
  return NextResponse.json({ publicKey: pushConfig()?.publicKey ?? null, active, devices: devices.length }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(req: Request) {
  if (!notificationSameOrigin(req)) return fail("origin", 403);
  const u = await notificationActor();
  if (!u) return fail("unauthorized", 401);
  const body = await notificationBody(req).catch(() => null);
  if (!body) return fail("body", 400);
  const s = store(), cookie = (await cookies()).get(PUSH_COOKIE)?.value;
  if (body.action === "off" || body.action === "off-all") {
    if (body.action === "off-all") await s.removePushDevice(u.firmId, u.id);
    else if (cookie) await s.removePushDevice(u.firmId, u.id, undefined, cookie);
    const res = NextResponse.json({ ok: true }); res.cookies.delete(PUSH_COOKIE); return res;
  }
  if (!pushConfig()) return fail("push-not-configured", 503);
  if (body.action === "test") {
    const device = cookie ? (await s.pushDevices(u.firmId, u.id)).find(d => d.binding === cookie && d.sessionVersion === (u.sessionVersion ?? 0)) : null;
    if (!device) return fail("subscribe-first", 409);
    const row = await s.addEmail({ firmId: u.firmId, key: `push-test:${u.id}:${Math.floor(Date.now() / 60000)}`, to: "", subject: "Test push", body: "", channel: "push", subscriptionId: device.id, context: { kind: "test", userId: u.id }, expiresAt: new Date(Date.now() + 10 * 60000).toISOString() });
    if (!row) return fail("wait-one-minute", 429);
    const result = await drainDeliveries(s, { id: row.id, max: 1 });
    return NextResponse.json({ status: result.sent ? "accepted" : result.failed ? "failed" : "queued" });
  }
  if (body.action !== "on" || !validPushSubscription(body.subscription)) return fail("subscription", 400);
  if ((await s.authFail(`push-register:${u.id}`, 15, 10)).lockedUntil) return fail("rate-limit", 429);
  const binding = cookie && /^[\w-]{36}$/.test(cookie) ? cookie : randomUUID();
  const subscription = body.subscription;
  const existing = (await s.pushDevices(u.firmId, u.id)).find(d => d.endpoint === subscription.endpoint && d.binding === binding && d.sessionVersion === (u.sessionVersion ?? 0) && d.auth === subscription.keys.auth && d.p256dh === subscription.keys.p256dh);
  if (!existing && (await s.pushDevices(u.firmId, u.id)).length >= 10) return fail("device-limit", 409);
  if (!existing) {
    await s.removePushDevice(u.firmId, u.id, undefined, binding);
    await s.savePushDevice({ firmId: u.firmId, userId: u.id, endpoint: subscription.endpoint, ...subscription.keys, sessionVersion: u.sessionVersion ?? 0, binding });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PUSH_COOKIE, binding, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 365 * 86400 });
  return res;
}

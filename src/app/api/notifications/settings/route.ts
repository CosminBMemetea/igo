import { store } from "@/lib/store";
import { emailProvider } from "@/lib/email";
import { notificationActor, notificationSameOrigin, notificationBody } from "@/lib/notification-auth";
import { verifyPassword } from "@/lib/password";
import { normLogin } from "@/lib/validate";
export const dynamic = "force-dynamic";
export async function GET() {
  const u = await notificationActor();
  if (!u) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ email: u.email ?? "", enabled: u.emailAlerts !== false, configured: !!emailProvider() }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(req: Request) {
  if (!notificationSameOrigin(req)) return Response.json({ error: "origin" }, { status: 403 });
  const u = await notificationActor();
  if (!u) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await notificationBody(req).catch(() => null);
  if (!body || typeof body.enabled !== "boolean" || typeof body.email !== "string") return Response.json({ error: "body" }, { status: 400 });
  const email = normLogin(body.email.trim()), s = store();
  if (email !== (u.email ?? "")) {
    if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return Response.json({ error: "email" }, { status: 400 });
    const key = `notification-email:${u.id}`;
    if ((await s.authFails(key)).lockedUntil) return Response.json({ error: "rate-limit" }, { status: 429 });
    if (typeof body.password !== "string" || body.password.length > 200 || !verifyPassword(body.password, u.passwordHash)) {
      await s.authFail(key, 5, 15); return Response.json({ error: "password" }, { status: 400 });
    }
    try { await s.setUserEmail(u.id, email); } catch { return Response.json({ error: "email-unavailable" }, { status: 409 }); }
    await s.authClear(key);
  }
  await s.setEmailAlerts(u.firmId, u.id, body.enabled);
  return Response.json({ ok: true });
}

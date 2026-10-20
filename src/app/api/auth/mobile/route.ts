import { randomUUID } from "node:crypto";
import { logoutReceipt } from "@/lib/mobile-logout";
import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { normLogin } from "@/lib/validate";
import { verifyPassword } from "@/lib/password";
import { hasSecret, signToken } from "@/lib/session";
import { MOBILE_TTL_S, type MobileSession } from "@/lib/mobile-session";
import { reportOperationFailure } from "@/lib/operation-error";
export const dynamic = "force-dynamic";
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(req: Request) {
  if (process.env.MOBILE_DRIVER_ENABLED !== "1") return reply({ error: "mobile-unavailable" }, 404);
  if (!hasSecret(process.env.SESSION_SECRET)) return reply({ error: "unavailable" }, 503);
  try {
    const b = await req.json().catch(() => null);
    if (!b || typeof b.login !== "string" || !b.login.trim() || b.login.length > 200 || typeof b.password !== "string" || b.password.length > 200) return reply({ error: "credentials" }, 400);
    const s = store(), login = normLogin(b.login), ku = `u:${login}`;
    const ki = `ip:${(req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local"}`;
    const [a, c] = await Promise.all([s.authFails(ku), s.authFails(ki)]);
    if (a.lockedUntil || c.lockedUntil) return reply({ error: "locked" }, 429);
    const u = await s.userByLogin(login);
    if (!u || u.role !== "driver" || u.disabledAt || !verifyPassword(b.password, u.passwordHash) || !await s.firm(u.firmId)) {
      await Promise.all([s.authFail(ku, 5, 15), s.authFail(ki, 30, 15)]);
      await new Promise(r => setTimeout(r, 600));
      return reply({ error: "credentials" }, 401);
    }
    await s.authClear(ku);
    const exp = Math.floor(Date.now() / 1000) + MOBILE_TTL_S;
    const session: MobileSession = { purpose: "driver-mobile", sid: randomUUID(), role: "driver", uid: u.id, firm: u.firmId, email: u.email ?? u.phone ?? u.name, version: u.sessionVersion ?? 0, exp };
    const token = await signToken(session, process.env.SESSION_SECRET);
    return reply({ uid: u.id, firm: u.firmId, token, logoutReceipt: await logoutReceipt(token, session), expiresAt: new Date(exp * 1000).toISOString() });
  } catch (e) { return reply({ error: "unavailable", reference: reportOperationFailure("mobile-login", e) }, 503); }
}

import { timingSafeEqual } from "node:crypto";
import { adminConfigured, verifyPassword } from "@/lib/password";
import { back, withSession } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { normLogin } from "@/lib/validate";
export const dynamic = "force-dynamic";
const same = (a: string, b: string) => { const x = Buffer.from(a.toLowerCase()), y = Buffer.from(b.toLowerCase()); return x.length === y.length && timingSafeEqual(x, y); };
/** Admin (din env) sau cont de firmă (proprietar: email; șofer: telefon + PIN). */
export async function POST(req: Request) {
  if ((process.env.SESSION_SECRET?.length ?? 0) < 32) return back(req, "/login?e=nosecret");
  const fd = await req.formData().catch(() => null);
  const login = String(fd?.get("email") ?? "").trim().slice(0, 200), password = String(fd?.get("password") ?? "").slice(0, 200);
  if (adminConfigured() && same(login, process.env.ADMIN_EMAIL!) && verifyPassword(password, process.env.ADMIN_PASSWORD_HASH))
    return withSession(back(req, "/admin"), { role: "admin", email: process.env.ADMIN_EMAIL!, firm: "demo" });
  const u = login ? await store().userByLogin(normLogin(login)) : null;
  if (u && verifyPassword(password, u.passwordHash)) {
    const f = await store().firm(u.firmId);
    if (f) { const res = back(req, u.role === "driver" ? "/driver" : "/"); if (u.locale) res.cookies.set("igo-locale", u.locale, { path: "/", maxAge: 31536000, sameSite: "lax" }); return withSession(res, { role: u.role, email: u.email ?? u.phone ?? u.name, firm: f.id, uid: u.id, trial: f.trialStart }); }
  }
  await new Promise((r) => setTimeout(r, 600));
  return back(req, "/login?e=bad");
}

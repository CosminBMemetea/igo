import { timingSafeEqual } from "node:crypto";
import { adminConfigured, verifyPassword } from "@/lib/password";
import { back, safeNext, withSession } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { normLogin } from "@/lib/validate";
import { clearDemo } from "@/lib/demo-shift";
export const dynamic = "force-dynamic";
const same = (a: string, b: string) => { const x = Buffer.from(a.toLowerCase()), y = Buffer.from(b.toLowerCase()); return x.length === y.length && timingSafeEqual(x, y); };
/** Admin (din env) sau cont de firmă (proprietar: email; șofer: telefon + PIN). */
export async function POST(req: Request) {
  if ((process.env.SESSION_SECRET?.length ?? 0) < 32) return back(req, "/login?e=nosecret");
  const fd = await req.formData().catch(() => null);
  const next = fd?.get("next");
  const login = String(fd?.get("email") ?? "").trim().slice(0, 200), password = String(fd?.get("password") ?? "").slice(0, 200);
  if (adminConfigured() && same(login, process.env.ADMIN_EMAIL!) && verifyPassword(password, process.env.ADMIN_PASSWORD_HASH))
    { const sess = { role: "admin" as const, email: process.env.ADMIN_EMAIL!, firm: "demo" }; return withSession(clearDemo(back(req, safeNext(next, sess) ?? "/admin")), sess); }
  const as = fd?.get("as") === "driver" ? "driver" : "owner";
  const nq = `&as=${as}${typeof next === "string" && next ? `&next=${encodeURIComponent(next.slice(0, 200))}` : ""}`;
  // anti-brute-force: 5 greșeli pe cont → blocare 15 min (se dublează), 30 pe IP într-o oră → blocare IP
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local", kU = `u:${normLogin(login)}`, kI = `ip:${ip}`;
  const s = store(), [tu, ti] = login ? await Promise.all([s.authFails(kU), s.authFails(kI)]).catch(() => [{ lockedUntil: null }, { lockedUntil: null }]) : [{ lockedUntil: null }, { lockedUntil: null }];
  const locked = tu.lockedUntil ?? ti.lockedUntil;
  if (locked) return back(req, `/login?e=locked&m=${Math.max(1, Math.ceil((Date.parse(locked) - Date.now()) / 60000))}${nq}`);
  const u = login ? await store().userByLogin(normLogin(login)) : null;
  if (u?.disabledAt && verifyPassword(password, u.passwordHash)) return back(req, `/login?e=off${nq}`);
  if (u && !u.disabledAt && verifyPassword(password, u.passwordHash)) {
    await s.authClear(kU).catch(() => {});
    const f = await store().firm(u.firmId);
    if (f) { const sess = { role: u.role, email: u.email ?? u.phone ?? u.name, firm: f.id, uid: u.id, trial: f.trialStart }; const res = back(req, safeNext(next, sess) ?? (u.role === "driver" ? "/driver" : "/feed")); if (u.locale) res.cookies.set("igo-locale", u.locale, { path: "/", maxAge: 31536000, sameSite: "lax" }); clearDemo(res); return withSession(res, sess); }
  }
  let lk: string | null = null;
  if (login) { const [a, b] = await Promise.all([s.authFail(kU, 5, 15), s.authFail(kI, 30, 15)]).catch(() => [{ lockedUntil: null }, { lockedUntil: null }]); lk = a.lockedUntil ?? b.lockedUntil; }
  await new Promise((r) => setTimeout(r, 600));
  if (lk) return back(req, `/login?e=locked&m=${Math.max(1, Math.ceil((Date.parse(lk) - Date.now()) / 60000))}${nq}`);
  return back(req, `/login?e=${as === "driver" ? "badpin" : "bad"}${nq}`);
}

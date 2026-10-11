import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { canSwitchPlan, decide } from "@/lib/access";

// ?lang= / ?theme= pentru toți; ?plan= / ?view= doar pentru admin. Antetele x-igo-* se setează aici (cele venite din afară se șterg).
const PUBLIC_PARAMS: [string, string, RegExp][] = [["lang", "igo-locale", /^(ro|en|pl)$/], ["theme", "igo-theme", /^(dark|light)$/]];
const ADMIN_PARAMS: [string, string, RegExp][] = [["plan", "igo-plan", /^(trial|start|pro|business)$/], ["view", "igo-view", /^(admin|user)$/]];
export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET);
  const d = decide(path, s);
  if (d.kind === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (d.kind === "login") { const u = req.nextUrl.clone(); u.pathname = "/login"; u.search = ""; return NextResponse.redirect(u); }
  const set: [string, string][] = [];
  for (const [q, c, re] of [...PUBLIC_PARAMS, ...(canSwitchPlan(s) ? ADMIN_PARAMS : [])]) {
    const v = req.nextUrl.searchParams.get(q);
    if (v && re.test(v)) set.push([c, v]);
  }
  if (!req.cookies.get("igo-trial-start")) set.push(["igo-trial-start", new Date().toISOString().slice(0, 10)]);
  const headers = new Headers(req.headers);
  headers.delete("x-igo-role"); headers.delete("x-igo-email");
  if (s) { headers.set("x-igo-role", s.role); headers.set("x-igo-email", s.email); }
  const jar = new Map(req.cookies.getAll().map((x) => [x.name, x.value]));
  for (const [k, v] of set) jar.set(k, v);
  headers.set("cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "));
  const res = NextResponse.next({ request: { headers } });
  for (const [k, v] of set) res.cookies.set(k, v, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}
export const config = { matcher: ["/((?!_next|favicon|icon|icons/|apple-icon|manifest).*)"] };

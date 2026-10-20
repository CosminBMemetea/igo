import { mobileSessionId } from "@/lib/mobile-logout";
import { store } from "@/lib/store";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { mobileRoute, verifyMobileSession } from "@/lib/mobile-session";
import { canSwitchPlan, decide, roleHome } from "@/lib/access";

// ?lang= / ?theme= pentru toți; ?plan= / ?view= doar pentru admin. Antetele x-igo-* se setează aici (cele venite din afară se șterg).
const PUBLIC_PARAMS: [string, string, RegExp][] = [["lang", "igo-locale", /^(ro|en|pl)$/], ["theme", "igo-theme", /^(dark|light)$/]];
const ADMIN_PARAMS: [string, string, RegExp][] = [["plan", "igo-plan", /^(trial|start|pro|business)$/], ["view", "igo-view", /^(admin|user)$/]];
export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const bearer = req.headers.get("authorization");
  const mobile = bearer?.startsWith("Bearer ") && !path.startsWith("/api/cron/");
  if (mobile && (process.env.MOBILE_DRIVER_ENABLED !== "1" || !mobileRoute(path, req.method)))
    return NextResponse.json({ error: "mobile-unavailable" }, { status: 403 });
  const s = mobile ? await verifyMobileSession(bearer!.slice(7), process.env.SESSION_SECRET)
    : await verifySession(req.cookies.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET);
  if (mobile && s) {
    try { if (await store().mobileSessionRevoked(mobileSessionId(bearer!.slice(7)))) return NextResponse.json({ error: "unauthorized" }, { status: 401 }); }
    catch { return NextResponse.json({ error: "unavailable" }, { status: 503 }); }
  }
  if (s && (path === "/login" || path === "/signup") && req.method === "GET") { const u = req.nextUrl.clone(); u.pathname = roleHome(s.role); u.search = ""; return NextResponse.redirect(u); }
  const d = decide(path, s);
  if (d.kind === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (d.kind === "forbidden") {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const u = req.nextUrl.clone(); u.pathname = d.home; u.search = `?denied=${encodeURIComponent(path.slice(0, 60))}`; return NextResponse.redirect(u);
  }
  if (d.kind === "login") { const u = req.nextUrl.clone(); u.pathname = "/login"; const nx = path + req.nextUrl.search; u.search = path !== "/" && nx.length <= 200 ? `?next=${encodeURIComponent(nx)}` : ""; return NextResponse.redirect(u); }
  const set: [string, string][] = [];
  for (const [q, c, re] of [...PUBLIC_PARAMS, ...(canSwitchPlan(s) ? ADMIN_PARAMS : [])]) {
    const v = req.nextUrl.searchParams.get(q);
    if (v && re.test(v)) set.push([c, v]);
  }
  if (!req.cookies.get("igo-trial-start")) set.push(["igo-trial-start", new Date().toISOString().slice(0, 10)]);
  const headers = new Headers(req.headers);
  headers.set("x-igo-path", path);
  const den = req.nextUrl.searchParams.get("denied");
  headers.delete("x-igo-denied"); if (den && /^\/[\w\/-]{0,60}$/.test(den)) headers.set("x-igo-denied", den);
  for (const h of ["x-igo-role", "x-igo-email", "x-igo-firm", "x-igo-uid", "x-igo-trial", "x-igo-version"]) headers.delete(h);
  if (s) {
    headers.set("x-igo-role", s.role); headers.set("x-igo-email", encodeURIComponent(s.email)); headers.set("x-igo-firm", s.firm);
    headers.set("x-igo-version", String(s.version ?? 0));
    if (s.uid) headers.set("x-igo-uid", s.uid);
    if (s.trial) headers.set("x-igo-trial", s.trial);
  }
  const jar = new Map(req.cookies.getAll().map((x) => [x.name, x.value]));
  for (const [k, v] of set) jar.set(k, v);
  headers.set("cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "));
  const res = NextResponse.next({ request: { headers } });
  for (const [k, v] of set) res.cookies.set(k, v, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}
export const config = { matcher: ["/((?!_next|favicon|icon|icons/|demo/|apple-icon|manifest|api/health).*)"] };

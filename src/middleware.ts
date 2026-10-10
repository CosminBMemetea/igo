import { NextResponse, type NextRequest } from "next/server";

// ?lang= / ?theme= / ?plan= → cookie (vizibil chiar în request-ul curent). Pornește proba la prima vizită.
const PARAMS: [string, string, RegExp][] = [["lang", "igo-locale", /^(ro|en|pl)$/], ["theme", "igo-theme", /^(dark|light)$/], ["plan", "igo-plan", /^(trial|start|pro|business)$/]];
export function middleware(req: NextRequest) {
  const set: [string, string][] = [];
  for (const [q, c, re] of PARAMS) {
    const v = req.nextUrl.searchParams.get(q);
    if (v && re.test(v)) set.push([c, v]);
  }
  if (!req.cookies.get("igo-trial-start")) set.push(["igo-trial-start", new Date().toISOString().slice(0, 10)]);
  if (!set.length) return NextResponse.next();
  const headers = new Headers(req.headers);
  const jar = new Map(req.cookies.getAll().map((x) => [x.name, x.value]));
  for (const [k, v] of set) jar.set(k, v);
  headers.set("cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "));
  const res = NextResponse.next({ request: { headers } });
  for (const [k, v] of set) res.cookies.set(k, v, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}
export const config = { matcher: ["/((?!api|_next|favicon|icon).*)"] };

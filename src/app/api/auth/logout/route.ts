import { back } from "@/lib/auth-cookie";
import { SESSION_COOKIE } from "@/lib/session";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const res = back(req, "/login");
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  for (const c of ["igo-plan", "igo-view", "igo-firm"]) res.cookies.set(c, "", { path: "/", maxAge: 0 });
  return res;
}
/** Cont dezactivat / șters: tenant() redirecționează aici → ștergem sesiunea și arătăm motivul. */
export async function GET(req: Request) {
  const res = back(req, "/login?e=off");
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  for (const c of ["igo-plan", "igo-view", "igo-firm"]) res.cookies.set(c, "", { path: "/", maxAge: 0 });
  return res;
}

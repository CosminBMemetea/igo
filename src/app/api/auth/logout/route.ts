import { back } from "@/lib/auth-cookie";
import { SESSION_COOKIE } from "@/lib/session";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const res = back(req, "/login");
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  for (const c of ["igo-plan", "igo-view"]) res.cookies.set(c, "", { path: "/", maxAge: 0 });
  return res;
}

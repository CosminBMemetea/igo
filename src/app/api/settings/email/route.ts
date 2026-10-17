import { headers } from "next/headers";
import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { verifyPassword } from "@/lib/password";
import { normLogin } from "@/lib/validate";
export const dynamic = "force-dynamic";
/** Schimbă emailul patronului; cere parola curentă (și e limitat ca loginul). */
export async function POST(req: Request) {
  const h = await headers(), uid = h.get("x-igo-uid");
  if (h.get("x-igo-role") !== "owner" || !uid) return back(req, "/login");
  const fd = await req.formData(), email = normLogin(String(fd.get("email") ?? "").trim().slice(0, 200)), pw = String(fd.get("password") ?? "").slice(0, 200);
  const s = store(), u = await s.userById(uid), key = `u:${u?.email ?? uid}`;
  if (!u) return back(req, "/login");
  if ((await s.authFails(key)).lockedUntil) return back(req, "/settings?e=locked#email");
  if (!verifyPassword(pw, u.passwordHash)) { await s.authFail(key, 5, 15); return back(req, "/settings?e=pw#email"); }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return back(req, "/settings?e=email#email");
  try { await s.setUserEmail(u.id, email); } catch { return back(req, "/settings?e=emaildup#email"); }
  return back(req, "/settings?ok=email#email");
}

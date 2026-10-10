import { timingSafeEqual } from "node:crypto";
import { adminConfigured, verifyPassword } from "@/lib/password";
import { back, withSession } from "@/lib/auth-cookie";
export const dynamic = "force-dynamic";
const same = (a: string, b: string) => { const x = Buffer.from(a.toLowerCase()), y = Buffer.from(b.toLowerCase()); return x.length === y.length && timingSafeEqual(x, y); };
export async function POST(req: Request) {
  if (!adminConfigured()) return back(req, "/login?e=disabled");
  const fd = await req.formData().catch(() => null);
  const email = String(fd?.get("email") ?? "").trim().slice(0, 200), password = String(fd?.get("password") ?? "").slice(0, 200);
  const ok = same(email, process.env.ADMIN_EMAIL!) && verifyPassword(password, process.env.ADMIN_PASSWORD_HASH);
  if (!ok) { await new Promise((r) => setTimeout(r, 600)); return back(req, "/login?e=bad"); }
  return withSession(back(req, "/"), "admin", process.env.ADMIN_EMAIL!);
}

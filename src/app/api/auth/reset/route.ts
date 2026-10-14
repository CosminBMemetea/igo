import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { hashPassword } from "@/lib/scrypt";
import { PASSWORD_MIN } from "@/lib/validate";
import { readReset, resetMatches } from "@/lib/reset";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const fd = await req.formData().catch(() => null), tk = String(fd?.get("t") ?? ""), pw = String(fd?.get("password") ?? "").slice(0, 200), pw2 = String(fd?.get("password2") ?? "").slice(0, 200);
  const q = `/reset?t=${encodeURIComponent(tk)}`;
  const p = await readReset(tk, process.env.SESSION_SECRET);
  const u = p ? await store().userById(p.uid) : null;
  if (!p || !u || !resetMatches(p, u.passwordHash)) return back(req, `${q}&e=token`);
  if (pw.length < PASSWORD_MIN || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return back(req, `${q}&e=weak`);
  if (pw !== pw2) return back(req, `${q}&e=mismatch`);
  await store().setUserPassword(u.id, hashPassword(pw));
  if (u.email) await store().authClear(`u:${u.email}`).catch(() => {});
  return back(req, "/login?ok=reset");
}

import { normRef } from "@/lib/referral";
import { back, withSession } from "@/lib/auth-cookie";
import { hashPassword } from "@/lib/scrypt";
import { store, dbConfigured } from "@/lib/store";
import { checkLimits, clientIp } from "@/lib/rate-limit";
import { PASSWORD_MIN, clip, isEmail, normEmail } from "@/lib/validate";
export const dynamic = "force-dynamic";
const COMMON = ["parola123", "password", "password1", "12345678", "123456789", "qwertyui", "parola1234", "querra123"];
/** Same rule as password reset (letters + digits), plus common passwords and the email's local part. */
const weakPassword = (pw: string, email: string) => { const p = pw.toLowerCase(), local = email.split("@")[0]; return !/[a-z]/i.test(pw) || !/\d/.test(pw) || /^(.)\1+$/.test(pw) || COMMON.includes(p) || (local.length >= 3 && p.includes(local)); };
/** Înscriere proprietar: firmă goală pe proba de 30 de zile + cont owner. */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production" && !dbConfigured()) return new Response("Account creation unavailable: database not configured", { status: 503 });
  if ((process.env.SESSION_SECRET?.length ?? 0) < 32) return back(req, "/signup?e=nosecret");
  const fd = await req.formData().catch(() => null);
  if (!fd) return back(req, "/signup?e=form");
  const name = clip(fd.get("firm"), 120), cui = clip(fd.get("cui"), 20).toUpperCase().replace(/\s/g, "") || null;
  const email = normEmail(clip(fd.get("email"), 200)), password = String(fd.get("password") ?? "").slice(0, 200);
  // On a validation error, send back what was typed (never the password) so the form is not wiped.
  const keep = (e: string) => { const q = new URLSearchParams({ e, firm: name, email: String(fd.get("email") ?? "").slice(0, 200), cui: cui ?? "" }); const r = normRef(fd.get("ref")); if (r) q.set("ref", r); return back(req, `/signup?${q}`); };
  if (name.length < 2) return keep("firm");
  if (!isEmail(email)) return keep("email");
  if (password.length < PASSWORD_MIN) return keep("password");
  if (weakPassword(password, email)) return keep("weakpw");
  if (cui && !/^(RO)?\d{2,10}$/.test(cui)) return keep("cui");
  if (fd.get("consent") !== "on") return keep("consent");
  if (email === process.env.ADMIN_EMAIL?.toLowerCase()) return keep("exists");
  const ip = clientIp(req), limited = await checkLimits([{ key: `signup:ip:${ip}`, limit: 5, windowS: 3600 }, { key: `signup:ipd:${ip}`, limit: 20, windowS: 86400 }]);
  if (limited) return back(req, "/signup?e=rate");
  const s = store();
  if (await s.userByLogin(email)) return back(req, "/signup?e=exists");
  const firm = await s.createFirm({ name, cui, referredBy: normRef(fd.get("ref")) });
  try {
    const u = await s.createUser({ firmId: firm.id, role: "owner", name: "", email, phone: null, passwordHash: hashPassword(password) });
    await s.updateFirm(firm.id, { detailsDone: true });
    return withSession(back(req, "/trucks"), { role: "owner", email, firm: firm.id, uid: u.id, trial: firm.trialStart });
  } catch { return back(req, "/signup?e=exists"); }
}

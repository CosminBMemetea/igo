import { normRef } from "@/lib/referral";
import { back, withSession } from "@/lib/auth-cookie";
import { hashPassword } from "@/lib/scrypt";
import { store } from "@/lib/store";
import { PASSWORD_MIN, clip, isEmail, normEmail } from "@/lib/validate";
export const dynamic = "force-dynamic";
/** Înscriere proprietar: firmă goală pe proba de 30 de zile + cont owner. */
export async function POST(req: Request) {
  if ((process.env.SESSION_SECRET?.length ?? 0) < 32) return back(req, "/signup?e=nosecret");
  const fd = await req.formData().catch(() => null);
  if (!fd) return back(req, "/signup?e=form");
  const name = clip(fd.get("firm"), 120), cui = clip(fd.get("cui"), 20).toUpperCase().replace(/\s/g, "") || null;
  const email = normEmail(clip(fd.get("email"), 200)), password = String(fd.get("password") ?? "").slice(0, 200);
  if (name.length < 2) return back(req, "/signup?e=firm");
  if (!isEmail(email)) return back(req, "/signup?e=email");
  if (password.length < PASSWORD_MIN) return back(req, "/signup?e=password");
  if (cui && !/^(RO)?\d{2,10}$/.test(cui)) return back(req, "/signup?e=cui");
  if (email === process.env.ADMIN_EMAIL?.toLowerCase()) return back(req, "/signup?e=exists");
  const s = store();
  if (await s.userByLogin(email)) return back(req, "/signup?e=exists");
  const firm = await s.createFirm({ name, cui, referredBy: normRef(fd.get("ref")) });
  try {
    const u = await s.createUser({ firmId: firm.id, role: "owner", name: "", email, phone: null, passwordHash: hashPassword(password) });
    return withSession(back(req, "/setup"), { role: "owner", email, firm: firm.id, uid: u.id, trial: firm.trialStart });
  } catch { return back(req, "/signup?e=exists"); }
}

import { back, withSession } from "@/lib/auth-cookie";
import { readInvite } from "@/lib/invite";
import { hashPassword } from "@/lib/scrypt";
import { store } from "@/lib/store";
import { clip, isPhone, isPin, normPhone } from "@/lib/validate";
export const dynamic = "force-dynamic";
/** Șoferul acceptă invitația: își confirmă telefonul și își alege un PIN de 6 cifre. */
export async function POST(req: Request) {
  const fd = await req.formData().catch(() => null);
  const t = clip(fd?.get("t") ?? null, 2000);
  const inv = await readInvite(t, process.env.SESSION_SECRET);
  if (!inv) return back(req, "/join?e=token");
  const q = `/join?t=${encodeURIComponent(t)}`;
  const s = store();
  const row = await s.invite(inv.firm, inv.inv);
  const firm = await s.firm(inv.firm);
  if (!row || !firm) return back(req, "/join?e=token");
  if (row.usedAt) return back(req, "/join?e=used");
  const phone = normPhone(clip(fd!.get("phone"), 30)), pin = String(fd!.get("pin") ?? ""), pin2 = String(fd!.get("pin2") ?? "");
  if (!isPhone(phone)) return back(req, `${q}&e=phone`);
  if (!isPin(pin) || pin !== pin2) return back(req, `${q}&e=pin`);
  let uid: string;
  try { uid = (await s.createUser({ firmId: firm.id, role: "driver", name: row.name, email: null, phone, passwordHash: hashPassword(pin) })).id; }
  catch { return back(req, `${q}&e=phoneused`); }
  if (!(await s.useInvite(firm.id, row.id, uid))) return back(req, "/join?e=used");
  return withSession(back(req, "/driver"), { role: "driver", email: phone, firm: firm.id, uid, trial: firm.trialStart });
}

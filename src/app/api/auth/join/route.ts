import { back, withSession } from "@/lib/auth-cookie";
import { readInvite } from "@/lib/invite";
import { hashPassword } from "@/lib/scrypt";
import { store } from "@/lib/store";
import { clip, isPhone, isPin, weakPin, normPhone } from "@/lib/validate";
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
  if (inv.exp !== Math.floor(Date.parse(row.createdAt) / 1000) + 14 * 86400) return back(req, "/join?e=token");
  if (row.usedAt) return back(req, "/join?e=used");
  if (row.revokedAt) return back(req, "/join?e=revoked");
  const phone = normPhone(clip(fd!.get("phone"), 30)), pin = String(fd!.get("pin") ?? ""), pin2 = String(fd!.get("pin2") ?? "");
  if (!isPhone(phone)) return back(req, `${q}&e=phone`);
  if (!isPin(pin)) return back(req, `${q}&e=len`);
  if (pin !== pin2) return back(req, `${q}&e=mismatch`);
  if (weakPin(pin)) return back(req, `${q}&e=weak`);
  if (row.phone && row.phone !== phone) return back(req, `${q}&e=phone`);
  let uid: string;
  try {
    const user = await s.acceptInvite(firm.id, row.id, phone, hashPassword(pin));
    if (!user) return back(req, "/join?e=used");
    uid = user.id;
  } catch (e) {
    const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
    if (code === "23505" || (e as Error).message === "exists") return back(req, `${q}&e=phoneused`);
    throw e;
  }
  const res = back(req, "/join/ready"); res.cookies.set("igo-locale", row.locale ?? "ro", { path: "/", maxAge: 31536000, sameSite: "lax" });
  return withSession(res, { role: "driver", email: phone, firm: firm.id, uid, trial: firm.trialStart });
}

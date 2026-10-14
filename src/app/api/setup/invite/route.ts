import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { writableFirm } from "@/lib/tenant";
import { clip, isPhone, normPhone } from "@/lib/validate";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const f = await writableFirm(); if (!f) return back(req, "/setup?e=nofirm");
  const fd = await req.formData();
  const name = clip(fd.get("name"), 80), raw = clip(fd.get("phone"), 30), phone = raw ? normPhone(raw) : null;
  if (name.length < 2) return back(req, "/setup?step=3&e=name");
  if (phone && !isPhone(phone)) return back(req, "/setup?step=3&e=phone");
  if (phone) {
    const s = store(), [us, inv] = await Promise.all([s.users(f.id), s.invites(f.id)]);
    if (us.some((u) => u.phone && normPhone(u.phone) === phone && !u.disabledAt) || inv.some((i) => !i.usedAt && !(i as { revokedAt?: string | null }).revokedAt && i.phone && normPhone(i.phone) === phone)) return back(req, "/setup?step=3&e=dupphone");
  }
  const l = String(fd.get("locale") ?? "ro"), locale = l === "en" || l === "pl" ? l : "ro";
  const inv = await store().createInvite(f.id, name, phone, locale);
  return back(req, `/setup?step=3&inv=${inv.id}`);
}

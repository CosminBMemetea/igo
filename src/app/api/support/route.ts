import { headers } from "next/headers";
import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { clip, isPhone, normPhone } from "@/lib/validate";
export const dynamic = "force-dynamic";
/** „Asistență Querra”: cererea se salvează; adminul o vede în /admin. Fără email deocamdată. */
export async function POST(req: Request) {
  const fd = await req.formData();
  const h = headers(), role = h.get("x-igo-role"), e = h.get("x-igo-email");
  const name = clip(fd.get("name"), 80), phone = normPhone(clip(fd.get("phone"), 30));
  if (name.length < 2 || !isPhone(phone)) return back(req, "/support?e=1");
  await store().addSupport({ firmId: role === "owner" || role === "driver" ? h.get("x-igo-firm") : null, email: e ? decodeURIComponent(e) : null, name, phone, slot: clip(fd.get("slot"), 40) || null, message: clip(fd.get("message"), 1000) });
  return back(req, "/support?sent=1");
}

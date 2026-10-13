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
  const offer = fd.get("topic") === "offer", qs = offer ? "&topic=offer" : "";
  if (name.length < 2 || !isPhone(phone)) return back(req, `/support?e=1${qs}`);
  // subiect + număr de camioane: fără coloană nouă în DB — intră la începutul mesajului
  const subject = clip(fd.get("subject"), 80), n = Math.round(Number(fd.get("trucks")) || 0), trucks = n > 0 && n <= 5000 ? n : null;
  const head = [subject, trucks ? `${trucks} 🚚` : ""].filter(Boolean).join(" · ");
  await store().addSupport({ firmId: role === "owner" || role === "driver" ? h.get("x-igo-firm") : null, email: e ? decodeURIComponent(e) : null, name, phone, slot: clip(fd.get("slot"), 40) || null, message: clip((head ? `[${head}] ` : "") + clip(fd.get("message"), 1000), 1000) });
  return back(req, "/support?sent=1");
}

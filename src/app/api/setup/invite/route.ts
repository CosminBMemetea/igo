import { store } from "@/lib/store";
import { writableFirm } from "@/lib/tenant";
import { clip, isPhone, normPhone } from "@/lib/validate";
import { duplicateError, formReply } from "@/lib/form-response";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const f = await writableFirm(), fd = await req.formData();
  const dest = fd.get("ret") === "/drivers" ? "/drivers" : "/setup?step=3";
  if (!f) return formReply(req, dest, "nofirm", 403);
  const name = clip(fd.get("name"), 80), phone = normPhone(clip(fd.get("phone"), 30));
  if (name.length < 2) return formReply(req, dest, "name");
  if (!isPhone(phone)) return formReply(req, dest, "phone");
  const l = String(fd.get("locale") ?? DEFAULT_LOCALE), locale = isLocale(l) ? l : DEFAULT_LOCALE;
  try {
    const inv = await store().createDriverInvite(f.id, name, phone, locale);
    return formReply(req, `${dest}${dest.includes("?") ? "&" : "?"}inv=${inv.id}&ok=1${dest === "/drivers" ? `#invite-${inv.id}` : ""}`);
  } catch (e) { return formReply(req, dest, duplicateError(e) ? "dupphone" : "server", duplicateError(e) ? 409 : 503); }
}

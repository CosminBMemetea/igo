import { store } from "@/lib/store";
import { writableFirm } from "@/lib/tenant";
import { clip } from "@/lib/validate";
import { formReply } from "@/lib/form-response";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const f = await writableFirm(), fd = await req.formData();
  const dest = fd.get("ret") === "/drivers" ? "/drivers" : "/setup?step=3";
  if (!f) return formReply(req, dest, "nofirm", 403);
  const ok = await store().setUserDisabled(f.id, clip(fd.get("uid"), 60), fd.get("off") === "1");
  return formReply(req, `${dest}${dest.includes("?") ? "&" : "?"}ok=1`, ok ? undefined : "missing", 404);
}

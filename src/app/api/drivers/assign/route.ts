import { writableFirm } from "@/lib/tenant";
import { store } from "@/lib/store";
import { clip } from "@/lib/validate";
import { formReply } from "@/lib/form-response";
export async function POST(req: Request) {
  const firm = await writableFirm(), fd = await req.formData();
  const dest = fd.get("ret") === "/trucks" ? "/trucks" : "/drivers";
  if (!firm) return formReply(req, dest, "nofirm", 403);
  try { await store().setUserTruck(firm.id, clip(fd.get("uid"), 60), clip(fd.get("truck"), 60) || null); }
  catch { return formReply(req, dest, "assignment", 409); }
  return formReply(req, `${dest}?ok=1`);
}

import { back } from "@/lib/auth-cookie";
import { store, DOC_TYPES, type DocType } from "@/lib/store";
import { writableFirm } from "@/lib/tenant";
import { clip, isDate } from "@/lib/validate";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const f = await writableFirm(); if (!f) return back(req, "/setup?e=nofirm");
  const fd = await req.formData();
  const truckId = clip(fd.get("truck"), 60), type = String(fd.get("type")) as DocType, expires = clip(fd.get("expires"), 10);
  if (!DOC_TYPES.includes(type) || !isDate(expires)) return back(req, "/setup?step=4&e=doc");
  try { await store().addDoc(f.id, { truckId, type, expires }); } catch { return back(req, "/setup?step=4&e=doc"); }
  return back(req, "/setup?step=4&ok=1");
}

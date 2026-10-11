import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { writableFirm } from "@/lib/tenant";
import { clip } from "@/lib/validate";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const f = await writableFirm(); if (!f) return back(req, "/documents?e=nofirm");
  const fd = await req.formData(), id = clip(fd.get("id"), 60);
  const s = store(), d = (await s.docs(f.id)).find((x) => x.id === id);
  if (d?.fileId) await s.deleteFile(f.id, d.fileId);
  await s.deleteDoc(f.id, id);
  return back(req, `/documents?tab=${fd.get("tab") === "drivers" ? "drivers" : "vehicles"}&ok=1`);
}

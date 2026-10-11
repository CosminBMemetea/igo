import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { writableFirm } from "@/lib/tenant";
import { clip } from "@/lib/validate";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const fd = await req.formData(), id = clip(fd.get("tripId"), 60);
  const f = await writableFirm(); if (!f) return back(req, `/trips/${id}`);
  await store().setPod(f.id, id, fd.get("received") === "1");
  return back(req, `/trips/${id}`);
}

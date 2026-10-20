import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { tenant, writableFirm } from "@/lib/tenant";
import { paperworkFor } from "@/lib/paperwork";
import { clip } from "@/lib/validate";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const fd = await req.formData(), id = clip(fd.get("tripId"), 60);
  const f = await writableFirm(); if (!f) return back(req, `/trips/${id}`);
  const received = fd.get("received") === "1";
  // POD can only be marked once the load was delivered; unmarking is always allowed.
  if (received) { const pw = await paperworkFor(await tenant(), id); if (!pw.unloadedAt) return back(req, `/trips/${id}`); }
  await store().setPod(f.id, id, received);
  return back(req, `/trips/${id}`);
}

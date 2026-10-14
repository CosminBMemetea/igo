import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { writableFirm } from "@/lib/tenant";
import { clip } from "@/lib/validate";
export const dynamic = "force-dynamic";
/** Dezactivează / reactivează un șofer (șofer plecat): acces revocat imediat, istoricul rămâne. */
export async function POST(req: Request) {
  const f = await writableFirm(); if (!f) return back(req, "/setup?step=3&e=nofirm");
  const fd = await req.formData(), id = clip(fd.get("uid"), 60), off = fd.get("off") === "1";
  const ok = await store().setUserDisabled(f.id, id, off);
  if (ok && off) { const s = store(); const u = await s.userById(id); if (u?.truckId) await s.setUserTruck(f.id, id, null).catch(() => {}); }
  return back(req, `/setup?step=3&ok=${ok ? (off ? "off" : "on") : "0"}`);
}

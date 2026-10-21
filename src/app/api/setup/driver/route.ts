import { store } from "@/lib/store";
import { writableFirm } from "@/lib/tenant";
import { clip } from "@/lib/validate";
import { formReply } from "@/lib/form-response";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const f = await writableFirm(), fd = await req.formData();
  const dest = fd.get("ret") === "/drivers" ? "/drivers" : "/setup?step=3";
  if (!f) return formReply(req, dest, "nofirm", 403);
  const s = store(), uid = clip(fd.get("uid"), 60), off = fd.get("off") === "1";
  const ok = await s.setUserDisabled(f.id, uid, off);
  if (!ok) return formReply(req, dest, "missing", 404);
  // reactivare: îi redăm ultimul camion, dacă e încă liber (nearhivat, fără alt șofer activ); altfel rămâne fără camion + avertismentul din UI
  let truck = "";
  if (!off) {
    const last = (await s.assignments(f.id, uid)).map((a, i) => ({ a, i })).sort((x, y) => String(y.a.at).localeCompare(String(x.a.at)) || x.i - y.i)[0]?.a.truckId;
    const taken = last ? (await s.users(f.id)).some((u) => u.id !== uid && u.truckId === last && !u.disabledAt) : true;
    if (last && !taken) { try { await s.setUserTruck(f.id, uid, last); truck = "&truck=1"; } catch { /* ocupat / arhivat / în tură: rămâne avertismentul */ } }
  }
  return formReply(req, `${dest}${dest.includes("?") ? "&" : "?"}ok=1${truck}`);
}

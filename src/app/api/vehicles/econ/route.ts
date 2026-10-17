import { operationCode, reportOperationFailure } from "@/lib/operation-error";
import { formReply } from "@/lib/form-response";
import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { tenant, writableFirm } from "@/lib/tenant";
import { clip } from "@/lib/validate";
import { COST_KEYS, COST_MAX, type CostProfile } from "@/lib/costs";
import { readDemoEcon, writeDemoEcon } from "@/lib/econ-store";
export const dynamic = "force-dynamic";
const num = (v: FormDataEntryValue | null, max: number) => { const n = Number(String(v ?? "").replace(",", ".").replace(/\s/g, "")); return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 1000) / 1000 : null; };
/** Costuri pe camion / scoatere din flotă / preț + tonaj pe cursă. Demo: doar cookie (nimic în DB). Firmă reală: patron/admin. */
export async function POST(req: Request) {
  const fd = await req.formData(), vid = clip(fd.get("vid"), 60), action = String(fd.get("action") ?? ""), tid = clip(fd.get("tid"), 80);
  const to = action === "trip" ? `/trips/${tid}` : `/vehicles/${vid}?tab=costs${action === "costs" ? "&saved=1" : ""}`;
  const tn = await tenant();
  if (tn.role === "driver") return back(req, to);
  const costs: Partial<CostProfile> = {};
  if (action === "costs") for (const k of COST_KEYS) { const n = num(fd.get(k), COST_MAX[k]); if (n === null) return formReply(req, `/vehicles/${vid}?tab=costs`, "num"); costs[k] = n; }
  if (tn.demo) {
    const e = (await readDemoEcon());
    if (action === "costs") e.c[vid] = costs;
    else if (action === "archive") { if (!e.a.includes(vid)) e.a.push(vid); }
    else if (action === "restore") e.a = e.a.filter((x) => x !== vid);
    else if (action === "trip" && tid) { const r = num(fd.get("revenue"), 1e6), t = num(fd.get("tonnes"), 60); e.t[tid] = { ...(r !== null ? { r } : {}), ...(t !== null ? { t } : {}) }; }
    const res = formReply(req, action === "archive" ? `/vehicles/${vid}?archived=1` : to);
    writeDemoEcon(res, e);
    return res;
  }
  const f = await writableFirm(); if (!f) return back(req, to);
  if (action === "trip" && tid) {
    const revenue = num(fd.get("revenue"), 1e6), tonnes = String(fd.get("tonnes") ?? "").trim() ? num(fd.get("tonnes"), 60) : null;
    if (revenue === null || (String(fd.get("tonnes") ?? "").trim() && tonnes === null)) return formReply(req, `/trips/${tid}`, "num");
    if (!(await store().updateTrip(f.id, tid, { revenue, tonnes }))) return formReply(req, "/trips", "missing", 404);
  }
  try {
    if (action === "costs" || action === "archive" || action === "restore") {
      const changed = await store().updateTruckEcon(f.id, vid, action === "costs" ? { costs } : { archived: action === "archive" });
      if (!changed) return formReply(req, to, "missing", 404);
    }
  } catch (e) {
    const busy = operationCode(e) === "truck-busy";
    if (!busy) reportOperationFailure("truck-economics", e);
    return formReply(req, `/vehicles/${vid}?tab=costs`, busy ? "truck-busy" : "unavailable", busy ? 409 : 503);
  }
  return formReply(req, action === "archive" ? `/vehicles/${vid}?archived=1` : to);
}

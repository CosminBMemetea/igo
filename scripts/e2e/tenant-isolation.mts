// Cross-tenant + role isolation over HTTP against a LOCAL server and LOCAL database only.
// Usage: B=http://localhost:3917 DATABASE_URL=<local pglite-socket/postgres> tsx scripts/e2e/tenant-isolation.mts
import pg from "pg";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const B = process.env.B ?? "http://localhost:3917", DB = process.env.DATABASE_URL ?? "";
if (!/127\.0\.0\.1|localhost/.test(DB)) throw new Error("refusing: DATABASE_URL must be local");
const pool = new pg.Pool({ connectionString: DB, max: 2 });
type Jar = { cookie: string; name: string };
const jar = (name: string): Jar => ({ cookie: "", name });
async function req(j: Jar | null, method: string, path: string, body?: FormData | object, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { origin: B, ...extra };
  if (j?.cookie) headers.cookie = j.cookie;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body; else if (body) { payload = JSON.stringify(body); headers["content-type"] = "application/json"; }
  const r = await fetch(B + path, { method, headers, body: payload, redirect: "manual" });
  for (const c of r.headers.getSetCookie()) { const [kv] = c.split(";"); const [k] = kv.split("="); if (j) j.cookie = [...j.cookie.split("; ").filter((x) => x && !x.startsWith(k + "=")), kv].join("; "); }
  return { status: r.status, loc: r.headers.get("location") ?? "", text: await r.text() };
}
const form = (o: Record<string, string | Blob>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const q = async (sql: string, p: unknown[] = []) => (await pool.query(sql, p)).rows;
const JPEG = await (await import("sharp")).default({ create: { width: 64, height: 48, channels: 3, background: "#c33" } }).jpeg().toBuffer();
async function firm(tag: string) {
  const o = jar(`${tag}-owner`), email = `${tag.toLowerCase()}${Date.now()}@iso.test`;
  await req(o, "POST", "/api/auth/signup", form({ firm: `Firma ${tag} SRL`, email, password: "testpass12345", consent: "on" }));
  if (!o.cookie.includes("igo-session")) throw new Error(`signup ${tag} failed`);
  await req(o, "POST", "/api/setup/truck", form({ plate: `${tag === "A" ? "AB" : "BH"} 0${tag === "A" ? 1 : 2} ISO`, model: "DAF", tank: "600", l100: "30" }));
  const phone = `07${String(Date.now()).slice(-8)}`;
  await req(o, "POST", "/api/setup/invite", form({ name: `Sofer ${tag}`, phone }));
  const page = await req(o, "GET", "/setup?step=3"); const t = decodeURIComponent(page.text.match(/\/join\?t=([^"'<\s&]+)/)?.[1] ?? "");
  const d = jar(`${tag}-driver`); await req(d, "POST", "/api/auth/join", form({ t, phone, pin: "482915", pin2: "482915" }));
  if (!d.cookie.includes("igo-session")) throw new Error(`join ${tag} failed`);
  const [f] = await q("select f.id from firms f join users u on u.firm_id=f.id where u.email=$1", [email]);
  const [truck] = await q("select id from trucks where firm_id=$1", [f.id]);
  const [drv] = await q("select id from users where firm_id=$1 and role='driver'", [f.id]);
  await req(o, "POST", "/api/drivers/assign", form({ uid: drv.id, truck: truck.id }));
  const today = new Date().toISOString().slice(0, 10);
  const trip = await req(o, "POST", "/api/trips/new", { from: "Oradea", to: "Arad", date: today, driverId: drv.id, truckId: truck.id });
  await req(o, "POST", "/api/docs", form({ scope: "vehicle", type: "rca", target: truck.id, expires: "2027-01-01", file: new Blob([JPEG], { type: "image/jpeg" }) }));
  await req(d, "POST", "/api/driver/shift", { vehicleId: truck.id, action: "start", checklist: ["chk.tyres", "chk.fluids", "chk.docs", "chk.damage"] });
  const tripId = JSON.parse(trip.text).id as string;
  await req(d, "POST", "/api/files", form({ kind: "cmr", tripId, file: new Blob([JPEG], { type: "image/jpeg" }, ) }));
  await req(d, "POST", "/api/driver/fill", form({ vehicleId: truck.id, litres: "100", odometerKm: "500000", station: "OMV", amount: "700", currency: "RON", key: `k${Date.now()}aaaaaaaaaaaa` }));
  await req(o, "POST", "/api/import/commit", { text: `Data;Nr. inmatriculare;Litri;Valoare\n${today.split("-").reverse().join(".")} 08:00;${(await q("select plate from trucks where id=$1", [truck.id]))[0].plate};120;900\n`, filename: "x.csv" });
  return { o, d, firmId: f.id as string, truckId: truck.id as string, driverId: drv.id as string, tripId };
}
const FIRM_TABLES = async () => (await q("select table_name from information_schema.columns where column_name='firm_id' and table_schema='public'")).map((r) => r.table_name as string);
async function snapshot(firmId: string) {
  const out: Record<string, string> = {};
  for (const t of await FIRM_TABLES()) out[t] = JSON.stringify(await q(`select * from "${t}" where firm_id=$1 order by 1`, [firmId]));
  out.firms = JSON.stringify(await q("select * from firms where id=$1", [firmId]));
  return out;
}
async function idsOf(firmId: string) {
  const ids = new Set<string>();
  for (const t of await FIRM_TABLES()) for (const r of await q(`select * from "${t}" where firm_id=$1`, [firmId])) for (const [k, v] of Object.entries(r)) if ((k === "id" || k.endsWith("_id")) && typeof v === "string" && v !== firmId && v.length > 6) ids.add(v);
  return [...ids];
}
function routes(dir = "src/app/api"): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) out.push(...routes(p)); else if (n === "route.ts") out.push(dir.replace("src/app", "")); }
  return out;
}
const SKIP = /^\/api\/(auth|cron|health|leads)(\/|$)/;
const FIELDS = ["id", "tripId", "truckId", "vehicleId", "driverId", "uid", "userId", "truck", "target", "docId", "fileId", "vid", "tid", "inviteId", "expectedTruckId", "actorId"];
await q("delete from auth_throttle where key like 'rl:signup%'"); // local DB only (guarded above)
const A = await firm("A"), Bf = await firm("Bx");
const bIds = await idsOf(Bf.firmId), before = await snapshot(Bf.firmId);
const bMarkers = [...bIds, "Firma Bx", "Sofer Bx", "BH 02 ISO"];
const leaks: string[] = [], roleLeaks: string[] = [];
// positive controls: the detector must see B's own data from B's session, and B must actually have data
const ctl = await req(Bf.o, "GET", "/api/trips"); if (!ctl.text.includes(Bf.tripId)) throw new Error("control failed: B cannot see its own trip");
const ctlFile = await req(Bf.o, "GET", `/api/files/${(await q("select id from files where firm_id=$1", [Bf.firmId]))[0]?.id}`); if (ctlFile.status !== 200) throw new Error(`control failed: B file ${ctlFile.status}`);
const counts = Object.fromEntries(Object.entries(before).map(([k, v]) => [k, (JSON.parse(v) as unknown[]).length]).filter(([, n]) => n));
let calls = 0;
for (const r of routes()) {
  if (SKIP.test(r)) continue;
  const concrete = r.replace("[id]", "__ID__");
  for (const who of [A.o, A.d]) for (const bid of bIds) {
    const path = concrete.replace("__ID__", bid);
    const bag: Record<string, string> = {}; for (const k of FIELDS) bag[k] = bid;
    const variants: [string, FormData | object | undefined, string][] = [["GET", undefined, `${path}?${new URLSearchParams(bag)}`], ["POST", form({ ...bag, action: "archive", reason: "isolation test", confirm: "x", type: "rca", scope: "vehicle", expires: "2027-01-01", kind: "cmr" }), path], ["POST", { ...bag, action: "start", checklist: ["chk.tyres", "chk.fluids", "chk.docs"], from: "X", to: "Y", date: "2026-10-21", reason: "isolation" }, path]];
    for (const m of ["PATCH", "PUT", "DELETE"]) variants.push([m, form({ ...bag, action: "delete" }), path]);
    for (const [m, body, url] of variants) {
      const res = await req(who, m, url, body); calls++;
      const hit = bMarkers.find((x) => res.text.includes(x) && !url.includes(x) );
      if (res.status < 400 && hit) leaks.push(`${who.name} ${m} ${r} → ${res.status} exposes ${hit.slice(0, 24)}`);
    }
    if (!r.includes("[id]")) break; // body-param routes: one B id per field set is enough after the first pass
  }
}
// second pass: every B id in every field for body routes (cheap: only POST form)
for (const r of routes()) { if (SKIP.test(r) || r.includes("[id]")) continue; for (const bid of bIds) for (const k of FIELDS) for (const action of ["archive", "delete", "save"]) { await req(A.o, "POST", r, form({ [k]: bid, action, reason: "isolation test", litres: "1", tripId: k === "id" ? Bf.tripId : bid })); calls++; } }
const after = await snapshot(Bf.firmId);
for (const t of Object.keys(before)) if (before[t] !== after[t]) leaks.push(`firm B table ${t} changed by firm A requests`);
// driver must not reach owner-only routes
for (const r of ["/api/drivers/assign", "/api/drivers/reinvite", "/api/setup/truck", "/api/setup/invite", "/api/trips/new", "/api/trips/cancel", "/api/trips/complete", "/api/settings/truck", "/api/settings/email", "/api/docs", "/api/docs/delete", "/api/import/commit", "/api/vehicles/econ", "/api/feed/resolve", "/api/admin/firm/delete", "/api/firm/demo", "/api/trips/pod", "/api/receipts/manage", "/api/files/delete"]) {
  const res = await req(A.d, "POST", r, form({ id: A.tripId, uid: A.driverId, truck: A.truckId, vid: A.truckId, action: "archive", reason: "role test" }));
  const ok = res.status === 401 || res.status === 403 || (res.status >= 300 && res.status < 400 && /\/(driver|login)|[?&]e=nofirm/.test(res.loc));
  if (!ok) roleLeaks.push(`driver POST ${r} → ${res.status} ${res.loc}`);
}
// positive controls for the new owner write routes: A can edit/delete its own receipt and trip file
const own: string[] = [];
{ const [fx] = await q("select id from fuel_transactions where firm_id=$1 and source='driver' limit 1", [A.firmId]);
  if (fx) { await req(A.o, "POST", "/api/receipts/manage", form({ id: fx.id, action: "save", litres: "77", amount: "500", odometer: "1000", station: "Edit" }));
    if ((await q("select litres from fuel_transactions where id=$1", [fx.id]))[0]?.litres !== 77) own.push("owner edit receipt failed");
    await req(A.o, "POST", "/api/receipts/manage", form({ id: fx.id, action: "delete" }));
    if ((await q("select 1 from fuel_transactions where id=$1", [fx.id])).length) own.push("owner delete receipt failed"); } else own.push("no A receipt to control");
  const [fl] = await q("select id, trip_id from files where firm_id=$1 and trip_id is not null limit 1", [A.firmId]);
  if (fl) { await req(A.o, "POST", "/api/files/delete", form({ id: fl.id, tripId: fl.trip_id })); if ((await q("select 1 from files where id=$1", [fl.id])).length) own.push("owner delete file failed"); } else own.push("no A file to control"); }
if (own.length) leaks.push(...own.map((x) => "control: " + x));
console.log(JSON.stringify({ calls, bIds: bIds.length, counts, leaks, roleLeaks }, null, 1));
await pool.end();
process.exit(leaks.length || roleLeaks.length ? 1 : 0);

// smoke:isolation — izolare între firme pe HTTP, pentru FIECARE rută din src/app (pagini + API, toate metodele exportate),
// plus încărcare → vizualizare → ștergere de fișier prin mock-ul local de Vercel Blob.
// Doar bază LOCALĂ (TEST_DATABASE_URL pe localhost; se GOLEȘTE). Cere `npm run build` făcut înainte.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import sharp from "sharp";
import { startBlobMock } from "./lib/blob-mock";

const URL_DB = process.env.TEST_DATABASE_URL;
if (!URL_DB) { console.log("smoke:isolation: TEST_DATABASE_URL lipsește, sar peste"); process.exit(0); }
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(URL_DB)) throw new Error("smoke:isolation: refuz — TEST_DATABASE_URL trebuie să fie local");
let fail = 0, checks = 0; const fails: string[] = [];
const ok = (n: string, c: boolean, extra = "") => { checks++; if (!c) { fail++; fails.push(`${n} ${extra}`); console.log(`FAIL ${n} ${extra}`); } };

// ---------- rutele, generate din src/app ----------
type Route = { path: string; kind: "page" | "api"; methods: string[] };
function scan(dir = "src/app"): Route[] {
  const out: Route[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { out.push(...scan(p)); continue; }
    const path = dir.replace(/^src\/app/, "").replace(/\/\([^)]+\)/g, "") || "/";
    if (n === "page.tsx") out.push({ path, kind: "page", methods: ["GET"] });
    if (n === "route.ts") out.push({ path, kind: "api", methods: [...readFileSync(p, "utf8").matchAll(/export (?:async )?function (GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]) });
  }
  return out;
}
/** Fiecare rută are o clasă. O rută nouă fără clasă = eșec (nu poate fi sărită). */
type Cls = "public" | "auth" | "admin" | "cron" | "firm";
const CLASS: Record<string, Cls> = {
  "/": "firm", "/login": "auth", "/signup": "auth", "/forgot": "auth", "/reset": "auth", "/join": "auth", "/join/ready": "auth", "/incearca": "public",
  "/terms": "public", "/privacy": "public", "/features": "public", "/plans": "public", "/visibility": "public", "/recomanda": "public", "/admin": "admin",
  "/api/auth/demo": "auth", "/api/auth/forgot": "auth", "/api/auth/join": "auth", "/api/auth/login": "auth", "/api/auth/logout": "auth", "/api/auth/mobile": "auth", "/api/auth/mobile/logout": "auth", "/api/auth/reset": "auth", "/api/auth/signup": "auth",
  "/api/cron/deliveries": "cron", "/api/cron/reminders": "cron", "/api/cron/speed-alerts": "cron", "/api/health": "public", "/api/leads": "public", "/api/me/locale": "public",
  "/api/admin/firm": "admin", "/api/admin/firm/delete": "admin", "/api/admin/reminders": "admin", "/api/admin/test-email": "admin",
};
const routes = scan(), isFirm = (r: Route) => (CLASS[r.path] ?? "firm") === "firm";
// rutele de firmă nu au nevoie de intrare în CLASS: implicit „firm” = testate complet. Intrările din CLASS trebuie să existe încă.
for (const k of Object.keys(CLASS)) ok(`CLASS: ${k} există în src/app`, routes.some((r) => r.path === k));

// ---------- server local ----------
const db = new pg.Client({ connectionString: URL_DB }); await db.connect();
await db.query("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
const blob = await startBlobMock();
const env = { ...process.env, DATABASE_URL: URL_DB, SESSION_SECRET: randomBytes(32).toString("hex"), ADMIN_EMAIL: "", ADMIN_PASSWORD_HASH: "", GROQ_API_KEY: "", BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_localmock_notasecret", BLOB_ACCESS: "private", VERCEL_BLOB_API_URL: blob.url };
await new Promise<void>((res, rej) => spawn(process.execPath, ["scripts/migrate.mjs"], { env, stdio: "ignore" }).on("exit", (c) => (c ? rej(new Error("migrate")) : res())));
const PORT = 4000 + Math.floor(Math.random() * 900), B = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { env, stdio: "ignore", detached: true });
const stop = () => { try { process.kill(-srv.pid!); } catch { /* oprit */ } blob.close(); };
for (let i = 0; i < 80; i++) { try { await fetch(`${B}/login`); break; } catch { await new Promise((r) => setTimeout(r, 500)); } }

type Jar = { cookie: string; name: string };
const jar = (name: string): Jar => ({ cookie: "", name });
async function req(j: Jar | null, method: string, path: string, body?: FormData | object) {
  const headers: Record<string, string> = { origin: B };
  if (j?.cookie) headers.cookie = j.cookie;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body; else if (body) { payload = JSON.stringify(body); headers["content-type"] = "application/json"; }
  const r = await fetch(B + path, { method, headers, body: payload, redirect: "manual" });
  for (const c of r.headers.getSetCookie()) { const [kv] = c.split(";"); const [k] = kv.split("="); if (j) j.cookie = [...j.cookie.split("; ").filter((x) => x && !x.startsWith(k + "=")), kv].join("; "); }
  const buf = Buffer.from(await r.arrayBuffer());
  return { status: r.status, loc: r.headers.get("location") ?? "", text: buf.toString("utf8"), buf, type: r.headers.get("content-type") ?? "" };
}
const form = (o: Record<string, string | Blob>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const q = async (sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows;
const JPEG = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#c33" } }).jpeg().toBuffer();

async function firm(tag: string, plate: string) {
  const o = jar(`${tag}-owner`), email = `${tag.toLowerCase()}@iso.test`;
  await req(o, "POST", "/api/auth/signup", form({ firm: `Firma ${tag} SRL`, email, password: "testpass12345", consent: "on" }));
  if (!o.cookie.includes("igo-session")) throw new Error(`signup ${tag} failed`);
  await req(o, "POST", "/api/setup/truck", form({ plate, model: "DAF", tank: "600", l100: "30" }));
  const phone = tag === "A" ? "0744100200" : "0744300400";
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
  await req(d, "POST", "/api/driver/fill", form({ vehicleId: truck.id, litres: "100", odometerKm: "500000", station: "OMV", amount: "700", currency: "RON", key: `k${tag}aaaaaaaaaaaaaaa` }));
  return { o, d, firmId: f.id as string, truckId: truck.id as string, driverId: drv.id as string, tripId };
}
try {
  const A = await firm("A", "AB 01 ISO"), Bf = await firm("Bx", "BH 02 ISO");

  // ---------- 1. încărcare → vizualizare → ștergere (mock Blob) ----------
  {
    const up = await req(A.d, "POST", "/api/files", form({ kind: "cmr", tripId: A.tripId, file: new Blob([JPEG], { type: "image/jpeg" }) }));
    const id = (() => { try { return JSON.parse(up.text).id as string; } catch { return ""; } })();
    ok("upload CMR → 200 + id", up.status === 200 && !!id, `${up.status} ${up.text.slice(0, 80)}`);
    const row = (await q("select storage, url from files where id=$1", [id]))[0];
    ok("upload: stocat în Blob (mock), nu în DB", row?.storage === "blob" && String(row?.url).startsWith(blob.url) && blob.objects.size >= 1);
    const view = await req(A.o, "GET", `/api/files/${id}`);
    ok("vizualizare patron: aceiași octeți", view.status === 200 && view.buf.equals(JPEG) && view.type.startsWith("image/jpeg"), `${view.status}`);
    ok("vizualizare șofer (cursa lui): 200", (await req(A.d, "GET", `/api/files/${id}`)).status === 200);
    ok("vizualizare firma B: 404", (await req(Bf.o, "GET", `/api/files/${id}`)).status === 404);
    const pageT = await req(A.o, "GET", `/trips/${A.tripId}`);
    ok("cursa afișează fișierul", pageT.status === 200 && pageT.text.includes(`/api/files/${id}`));
    const fake = await req(A.d, "POST", "/api/files", form({ kind: "cmr", tripId: A.tripId, file: new Blob([Buffer.from("not an image")], { type: "image/jpeg" }) }));
    ok("upload fals (text ca .jpg) → 415", fake.status === 415, `${fake.status}`);
    const big = await req(A.d, "POST", "/api/files", form({ kind: "cmr", tripId: A.tripId, file: new Blob([randomBytes(2 * 1024 * 1024 + 10)], { type: "image/jpeg" }) }));
    ok("upload prea mare → 413", big.status === 413, `${big.status}`);
    ok("ștergere de firma B: refuzată", (await req(Bf.o, "POST", "/api/files/delete", form({ id, tripId: A.tripId }))).status >= 300 && (await q("select 1 from files where id=$1", [id])).length === 1);
    const before = blob.objects.size, del = await req(A.o, "POST", "/api/files/delete", form({ id, tripId: A.tripId }));
    ok("ștergere patron: rând + obiect Blob șterse", del.status < 400 && (await q("select 1 from files where id=$1", [id])).length === 0 && blob.objects.size === before - 1, `${del.status}`);
    ok("după ștergere: 404", (await req(A.o, "GET", `/api/files/${id}`)).status === 404);
    await req(A.d, "POST", "/api/files", form({ kind: "pod", tripId: A.tripId, file: new Blob([JPEG], { type: "image/jpeg" }) }));
  }
  // B are și el un fișier de cursă (ținta testelor de izolare)
  await req(Bf.d, "POST", "/api/files", form({ kind: "cmr", tripId: Bf.tripId, file: new Blob([JPEG], { type: "image/jpeg" }) }));

  // ---------- 2. izolare pe fiecare rută ----------
  const FIRM_TABLES = (await q("select table_name from information_schema.columns where column_name='firm_id' and table_schema='public'")).map((r) => r.table_name as string);
  const snap = async (id: string) => { const o: Record<string, string> = {}; for (const t of FIRM_TABLES) o[t] = JSON.stringify(await q(`select * from "${t}" where firm_id=$1 order by 1`, [id])); o.firms = JSON.stringify(await q("select * from firms where id=$1", [id])); return o; };
  const bIds: string[] = []; for (const t of FIRM_TABLES) for (const r of await q(`select * from "${t}" where firm_id=$1`, [Bf.firmId])) for (const [k, v] of Object.entries(r)) if ((k === "id" || k.endsWith("_id")) && typeof v === "string" && v !== Bf.firmId && v.length > 6 && !bIds.includes(v)) bIds.push(v);
  const bFile = (await q("select id from files where firm_id=$1 and trip_id is not null", [Bf.firmId]))[0].id as string;
  const markers = [...bIds, "Firma Bx", "Sofer Bx", "BH 02 ISO", "BH02ISO"];
  // controale pozitive: detectorul vede datele lui B din sesiunea lui B
  ok("control: B își vede cursa", (await req(Bf.o, "GET", `/trips/${Bf.tripId}`)).status === 200);
  ok("control: B își vede fișierul", (await req(Bf.o, "GET", `/api/files/${bFile}`)).status === 200);
  const before = await snap(Bf.firmId);
  const FIELDS = ["id", "tripId", "truckId", "vehicleId", "driverId", "uid", "userId", "truck", "target", "docId", "fileId", "vid", "tid", "inviteId", "expectedTruckId", "actorId", "v", "trip"];
  // ținta potrivită pentru fiecare segment dinamic
  const idFor = (path: string) => path.startsWith("/api/files") ? bFile : path.includes("trips") ? Bf.tripId : path.includes("vehicles") ? Bf.truckId : bIds[0];
  const denied = (s: number, loc: string) => s === 403 || s === 404 || (s >= 300 && s < 400 && /\/(login|driver)(\?|$)|[?&]e=/.test(loc));
  const covered = new Set<string>(); let calls = 0;
  for (const r of routes.filter(isFirm)) {
    const dyn = /\[[^\]]+\]/.test(r.path);
    for (const who of [A.o, A.d]) for (const m of r.methods) {
      const targets = dyn ? [idFor(r.path)] : bIds;
      for (const bid of targets) {
        const path = r.path.replace(/\[[^\]]+\]/g, bid);
        const bag: Record<string, string> = {}; for (const k of FIELDS) bag[k] = bid;
        const variants: [string, FormData | object | undefined][] = m === "GET" ? [[`${path}?${new URLSearchParams(bag)}`, undefined]]
          : [[path, form({ ...bag, action: m === "DELETE" ? "delete" : "archive", reason: "isolation", type: "rca", scope: "vehicle", expires: "2027-01-01", kind: "cmr", litres: "1" })], [path, { ...bag, action: "start", kind: "loaded", from: "X", to: "Y", checklist: [] }]];
        for (const [url, body] of variants) {
          const res = await req(who, m, url, body); calls++;
          const hit = markers.find((x) => res.text.includes(x) && !url.includes(encodeURIComponent(x)) && !url.includes(x));
          ok(`${who.name} ${m} ${r.path}: fără date B`, !(res.status < 400 && hit), `→ ${res.status} conține ${hit?.slice(0, 20)}`);
          if (dyn) ok(`${who.name} ${m} ${r.path} cu id-ul lui B → 403/404`, denied(res.status, res.loc), `→ ${res.status} ${res.loc}`);
        }
        if (!dyn && m === "GET") break; // GET fără segment: toate câmpurile au deja un id B; unul ajunge
      }
      covered.add(`${r.path} ${m}`);
    }
  }
  // id-uri B în query pe paginile care citesc ?v= / ?trip=
  for (const [u, who] of [[`/replay?v=${Bf.truckId}`, A.o], [`/replay?trip=${Bf.tripId}`, A.o], [`/vehicles/${Bf.truckId}/history`, A.o], [`/driver/trips/${Bf.tripId}`, A.d]] as const) {
    const res = await req(who, "GET", u); ok(`${who.name} GET ${u.split("?")[0]} cu id B → 404`, res.status === 404, `→ ${res.status} ${res.loc}`);
  }
  // ---------- 2b. aceeași firmă: un șofer nu vede cursele / actele altui șofer (ecranele /driver/*) ----------
  {
    await req(A.o, "POST", "/api/setup/invite", form({ name: "Sofer Doi", phone: "0744500600" }));
    const page = await req(A.o, "GET", "/setup?step=3");
    const tokens = [...page.text.matchAll(/\/join\?t=([^"'<\s&]+)/g)].map(m => decodeURIComponent(m[1]));
    const d2 = jar("A2-driver");
    for (const t of tokens.reverse()) { await req(d2, "POST", "/api/auth/join", form({ t, phone: "0744500600", pin: "593104", pin2: "593104" })); if (d2.cookie.includes("igo-session")) break; }
    ok("șofer 2 în firma A: cont activ", d2.cookie.includes("igo-session"));
    const [u2] = await q("select id from users where firm_id=$1 and role='driver' and id<>$2", [A.firmId, A.driverId]);
    await req(A.o, "POST", "/api/setup/truck", form({ plate: "IS 99 DOI", model: "MAN", tank: "500", l100: "29" }));
    const [tr2] = await q("select id from trucks where firm_id=$1 and id<>$2", [A.firmId, A.truckId]);
    await req(A.o, "POST", "/api/drivers/assign", form({ uid: u2?.id ?? "", truck: tr2?.id ?? "" }));
    const tr = await req(A.o, "POST", "/api/trips/new", { from: "Satu Mare", to: "Graz", km: 1050, date: new Date().toISOString().slice(0, 10), driverId: u2?.id, truckId: tr2?.id });
    const t2 = JSON.parse(tr.text).id as string; if (!t2) console.log("trip2", tr.status, tr.text.slice(0, 200), tr2, u2);
    const dr1 = await req(A.o, "POST", "/api/docs", form({ scope: "driver", type: "licence", target: A.driverId, expires: "2027-03-01", file: new Blob([JPEG], { type: "image/jpeg" }) }));
    await req(A.o, "POST", "/api/docs", form({ scope: "driver", type: "medical", target: u2?.id ?? "", expires: "2027-04-01", file: new Blob([JPEG], { type: "image/jpeg" }) }));
    const f1 = (await q("select file_id from documents where user_id=$1", [A.driverId]))[0]?.file_id as string, f2 = (await q("select file_id from documents where user_id=$1", [u2?.id]))[0]?.file_id as string;
    ok("acte personale create pentru ambii șoferi", !!f1 && !!f2 && !!t2, `${dr1.status} ${dr1.loc} ${f1} ${f2} ${t2}`);
    for (const path of ["/driver", "/driver/trips", "/driver/docs", "/driver/profile"]) {
      const mine = await req(A.d, "GET", path), other = await req(d2, "GET", path);
      ok(`șofer 1 ${path}: 200, fără cursa/actele șoferului 2`, mine.status === 200 && !mine.text.includes(t2) && !mine.text.includes("Graz") && !mine.text.includes(f2) && !mine.text.includes("Sofer Doi"), `${mine.status}`);
      ok(`șofer 2 ${path}: 200, fără cursa/actele șoferului 1`, other.status === 200 && !other.text.includes(A.tripId) && !other.text.includes("Arad") && !other.text.includes(f1) && !other.text.includes("Sofer A"), `${other.status}`);
    }
    ok("șofer 1 /driver/trips își vede cursa", (await req(A.d, "GET", "/driver/trips")).text.includes(A.tripId));
    ok("șofer 2 /driver/trips își vede cursa", (await req(d2, "GET", "/driver/trips")).text.includes(t2));
    ok("șofer 1 /driver/docs își vede actul", (await req(A.d, "GET", "/driver/docs")).text.includes(f1));
    ok("șofer 1 /driver/trips/[cursa șoferului 2] → 404", (await req(A.d, "GET", `/driver/trips/${t2}`)).status === 404);
    await req(A.o, "POST", "/api/trips/delete", form({ id: t2 }));
  }
  const after = await snap(Bf.firmId);
  for (const t of Object.keys(before)) ok(`tabela ${t} a firmei B neschimbată`, before[t] === after[t]);
  // ---------- 3. ștergeri proprii (patron), refuzate pentru șofer ----------
  {
    const plate = (await q("select plate from trucks where id=$1", [A.truckId]))[0].plate as string, day = new Date().toISOString().slice(0, 10).split("-").reverse().join(".");
    await req(A.o, "POST", "/api/import/commit", { text: `Data;Nr. inmatriculare;Litri;Valoare\n${day} 08:00;${plate};120;900\n${day} 09:00;${plate};80;600\n${day} 10:00;${plate};60;450\n`, filename: "a.csv" });
    const rows = await q("select id, import_id from fuel_transactions where firm_id=$1 and source<>'driver'", [A.firmId]);
    ok("import A: 3 rânduri", rows.length === 3, String(rows.length));
    ok("șofer nu poate șterge rânduri importate", denied((await req(A.d, "POST", "/api/import/delete", form({ id: rows[0].id }))).status, "") && (await q("select 1 from fuel_transactions where id=$1", [rows[0].id])).length === 1);
    const one = await req(A.o, "POST", "/api/import/delete", form({ id: rows[0].id, ret: "/receipts" }));
    ok("patron șterge un rând importat", one.loc.includes("deleted=1") && (await q("select 1 from fuel_transactions where id=$1", [rows[0].id])).length === 0, one.loc);
    const drvFill = (await q("select id from fuel_transactions where firm_id=$1 and source='driver'", [A.firmId])).length;
    ok("ștergerea unui bon de șofer prin /api/import/delete e refuzată", (await req(A.o, "POST", "/api/import/delete", form({ id: (await q("select id from fuel_transactions where firm_id=$1 and source='driver'", [A.firmId]))[0].id }))).loc.includes("e=missing"));
    const lot = await req(A.o, "POST", "/api/import/delete", form({ importId: rows[0].import_id }));
    ok("patron șterge lotul importului", lot.loc.includes("deleted=2") && (await q("select 1 from fuel_transactions where import_id=$1", [rows[0].import_id])).length === 0 && (await q("select 1 from fuel_imports where id=$1", [rows[0].import_id])).length === 0, lot.loc);
    ok("bonurile șoferului rămân", (await q("select id from fuel_transactions where firm_id=$1 and source='driver'", [A.firmId])).length === drvFill);
    ok("alertele se recalculează (pagina merge)", (await req(A.o, "GET", "/alerts")).status === 200);
    // cursă cu fișier + evenimente
    const tp = await req(A.o, "POST", "/api/trips/new", { from: "Cluj", to: "Deva", date: new Date().toISOString().slice(0, 10), driverId: A.driverId, truckId: A.truckId });
    const tid = JSON.parse(tp.text).id as string;
    await req(A.d, "POST", "/api/files", form({ kind: "cmr", tripId: tid, file: new Blob([JPEG], { type: "image/jpeg" }) }));
    await req(A.d, "POST", "/api/trips/event", { tripId: tid, kind: "wait_start", key: randomBytes(8).toString("hex") });
    await req(A.d, "POST", "/api/trips/event", { tripId: tid, kind: "wait_end", key: randomBytes(8).toString("hex") });
    const fl = await q("select id, url from files where trip_id=$1", [tid]), ev = await q("select 1 from trip_events where trip_id=$1", [tid]);
    ok("cursă de test: fișier + evenimente", fl.length === 1 && ev.length >= 1, `${fl.length}/${ev.length}`);
    ok("șofer nu poate șterge cursa", denied((await req(A.d, "POST", "/api/trips/delete", form({ id: tid }))).status, (await req(A.d, "POST", "/api/trips/delete", form({ id: tid }))).loc) && (await q("select 1 from trips where id=$1", [tid])).length === 1);
    const objs = blob.objects.size, del = await req(A.o, "POST", "/api/trips/delete", form({ id: tid }));
    ok("patron șterge cursa → /trips?deleted=1", del.loc.includes("/trips?deleted=1"), del.loc);
    ok("cascadă: cursă, evenimente, rând fișier, obiect Blob", (await q("select 1 from trips where id=$1", [tid])).length === 0 && (await q("select 1 from trip_events where trip_id=$1", [tid])).length === 0 && (await q("select 1 from files where trip_id=$1", [tid])).length === 0 && blob.objects.size === objs - 1);
    ok("după ștergere: pagina cursei 404", (await req(A.o, "GET", `/trips/${tid}`)).status === 404);
    await req(A.d, "POST", "/api/trips/event", { tripId: A.tripId, kind: "loaded", key: randomBytes(8).toString("hex") });
    const loaded = (await q("select loaded_at from trips where id=$1", [A.tripId]))[0]?.loaded_at;
    const running = await req(A.o, "POST", "/api/trips/delete", form({ id: A.tripId }));
    ok("cursă în desfășurare (încărcată) → e=running, păstrată", !!loaded && running.loc.includes("e=running") && (await q("select 1 from trips where id=$1", [A.tripId])).length === 1, `${loaded} ${running.loc}`);
  }
  // ---------- 4. r26: răspunsuri corecte (nu 500 / „ok” fals) ----------
  {
    const J = async (j: Jar | null, path: string, body: FormData | object, accept = "application/json") => {
      const headers: Record<string, string> = { origin: B, accept }; if (j?.cookie) headers.cookie = j.cookie;
      let payload: BodyInit; if (body instanceof FormData) payload = body; else { payload = JSON.stringify(body); headers["content-type"] = "application/json"; }
      const r = await fetch(B + path, { method: "POST", headers, body: payload, redirect: "manual" }); return { status: r.status, loc: r.headers.get("location") ?? "", text: await r.text() };
    };
    const raw = async (j: Jar, path: string, body: string, type: string) => { const r = await fetch(B + path, { method: "POST", headers: { origin: B, cookie: j.cookie, "content-type": type }, body, redirect: "manual" }); return r.status; };
    // /api/settings/speed: JSON acceptat, corp stricat → 400 (înainte: 500)
    const sj = await J(A.o, "/api/settings/speed", { limit: 90, over: 10, after: 30, alerts: true, trucks: { [A.truckId]: 85 } });
    ok("r26 speed: JSON valid → 200", sj.status === 200 && JSON.parse(sj.text).ok === true, `${sj.status} ${sj.text.slice(0, 80)}`);
    ok("r26 speed: JSON salvat", (await q("select limit_kmh from speed_settings where firm_id=$1", [A.firmId]))[0]?.limit_kmh === 90);
    ok("r26 speed: JSON invalid (limit 500) → 400", (await J(A.o, "/api/settings/speed", { limit: 500, over: 10, after: 30 })).status === 400);
    ok("r26 speed: JSON stricat → 400", (await raw(A.o, "/api/settings/speed", "{nu e json", "application/json")) === 400);
    ok("r26 speed: corp text/plain → 4xx/redirect, nu 500", (await raw(A.o, "/api/settings/speed", "limit=90", "text/plain")) !== 500);
    ok("r26 speed: camion al firmei B → 400", (await J(A.o, "/api/settings/speed", { limit: 90, over: 10, after: 30, trucks: { [Bf.truckId]: 80 } })).status === 400);
    ok("r26 speed: șofer → 403", (await J(A.d, "/api/settings/speed", { limit: 90, over: 10, after: 30 })).status === 403);
    // /api/docs/delete: id al altei firme → not-found, niciodată ok=1; documentul lui B rămâne
    const bDoc = (await q("select id from documents where firm_id=$1 limit 1", [Bf.firmId]))[0]?.id as string;
    ok("r26 docs/delete: există un document B", !!bDoc);
    ok("r26 docs/delete: id B (JSON) → 404", (await J(A.o, "/api/docs/delete", form({ id: bDoc }))).status === 404);
    const dPlain = await req(A.o, "POST", "/api/docs/delete", form({ id: bDoc }));
    ok("r26 docs/delete: id B (formular) → e=missing, nu ok=1", dPlain.status === 303 && dPlain.loc.includes("e=missing") && !dPlain.loc.includes("ok=1"), `${dPlain.status} ${dPlain.loc}`);
    ok("r26 docs/delete: documentul B neatins", (await q("select 1 from documents where id=$1", [bDoc])).length === 1);
    const aDoc = (await q("select id from documents where firm_id=$1 and scope='vehicle' limit 1", [A.firmId]))[0]?.id as string;
    const dOwn = await req(A.o, "POST", "/api/docs/delete", form({ id: aDoc }));
    ok("r26 docs/delete: propriul document → ok=1, șters", dOwn.loc.includes("ok=1") && (await q("select 1 from documents where id=$1", [aDoc])).length === 0, dOwn.loc);
    // /api/files/delete apelat de șofer → 403 curat (și pe formular, și pe JSON), fișierul rămâne
    const aFile = (await q("select id, trip_id from files where firm_id=$1 and trip_id is not null limit 1", [A.firmId]))[0];
    const fd1 = await req(A.d, "POST", "/api/files/delete", form({ id: aFile.id, tripId: aFile.trip_id }));
    ok("r26 files/delete: șofer (formular) → 403", fd1.status === 403 && fd1.text.includes("forbidden"), `${fd1.status} ${fd1.loc}`);
    ok("r26 files/delete: șofer (JSON) → 403", (await J(A.d, "/api/files/delete", form({ id: aFile.id, tripId: aFile.trip_id }))).status === 403);
    ok("r26 files/delete: fișierul rămâne", (await q("select 1 from files where id=$1", [aFile.id])).length === 1);
    ok("r26 files: șoferul încă își vede fișierul", (await req(A.d, "GET", `/api/files/${aFile.id}`)).status === 200);
    // /apple-touch-icon.png public (iOS îl cere fără sesiune)
    for (const p of ["/apple-touch-icon.png", "/apple-touch-icon-precomposed.png", "/icons/apple-touch-icon.png"]) {
      const r = await req(null, "GET", p); ok(`r26 ${p}: public 200 image/png`, r.status === 200 && r.type.startsWith("image/png"), `${r.status} ${r.loc} ${r.type}`);
    }
    // /api/driver/ping: fix mai vechi decât tura → 422 (clientul îl aruncă, nu repornește); rafală → 429
    await req(A.d, "POST", "/api/driver/shift", { vehicleId: A.truckId, action: "stop" });
    const st = await req(A.d, "POST", "/api/driver/shift", { vehicleId: A.truckId, action: "start", checklist: ["chk.tyres", "chk.fluids", "chk.docs", "chk.damage"] });
    ok("r26 ping: tura repornită", st.status === 200, `${st.status} ${st.text.slice(0, 80)}`);
    const pre = await req(A.d, "POST", "/api/driver/ping", { vehicleId: A.truckId, lat: 47.05, lng: 21.93, accuracy: 10, capturedAt: new Date(Date.now() - 4000).toISOString() });
    ok("r26 ping: fix dinaintea turei → 422 before-shift", pre.status === 422 && pre.text.includes("before-shift"), `${pre.status} ${pre.text.slice(0, 80)}`);
    const codes: number[] = [];
    for (let i = 0; i < 36; i++) codes.push((await req(A.d, "POST", "/api/driver/ping", { vehicleId: A.truckId, lat: 47.05 + i / 1e4, lng: 21.93, accuracy: 10, capturedAt: new Date().toISOString() })).status);
    ok("r26 ping: primul fix proaspăt → 2xx", codes[0] >= 200 && codes[0] < 300, codes.slice(0, 5).join(","));
    ok("r26 ping: rafală → 429 (plafon server)", codes.includes(429) && codes.filter(c => c >= 200 && c < 300).length <= 31, codes.join(","));
    ok("r26 ping: niciun 500 în rafală", !codes.includes(500), codes.join(","));
  }
  for (const r of routes.filter(isFirm)) for (const m of r.methods) ok(`acoperire: ${r.path} ${m}`, covered.has(`${r.path} ${m}`));
  ok("acoperire: rute de firmă găsite", routes.filter(isFirm).length >= 60, String(routes.filter(isFirm).length));
  console.log(`smoke:isolation: ${routes.length} rute (${routes.filter(isFirm).length} de firmă), ${calls} cereri, ${bIds.length} id-uri B`);
} finally { stop(); await db.end(); }
console.log(fail ? `smoke:isolation: ${fail}/${checks} eșec(uri)\n${fails.slice(0, 40).join("\n")}` : `smoke:isolation OK (${checks} verificări)`);
process.exit(fail ? 1 : 0);

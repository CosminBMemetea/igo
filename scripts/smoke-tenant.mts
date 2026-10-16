// smoke:tenant — capăt la capăt pe Postgres real: înscriere → firmă goală → pașii de setup → camion salvat și citit din DB;
// comutatorul „Date demo”; invitația șoferului; izolarea între firme.
// Cere: build făcut (npm run build) și TEST_DATABASE_URL (o bază de test care se GOLEȘTE). Pornește singur `next start`.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import pg from "pg";
const URL_DB = process.env.TEST_DATABASE_URL;
if (!URL_DB) { console.log("smoke:tenant: TEST_DATABASE_URL lipsește, sar peste (ex.: postgres://igo:igo@localhost/igo_test)"); process.exit(0); }
let fail = 0;
const ok = (n: string, c: boolean, extra = "") => { console.log(`${c ? "PASS" : "FAIL"} ${n}${c ? "" : " " + extra}`); if (!c) fail++; };
const db = new pg.Client({ connectionString: URL_DB }); await db.connect();
await db.query("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
const speechMock = createServer(async (req, res) => {
  const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const input = Buffer.concat(chunks).toString();
  if (req.url === "/audio/transcriptions" && input.includes("whisper-large-v3-turbo")) { res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ text: "de la Oradea la Arad mâine cu Ioan Pop" })); }
  else { res.statusCode = 503; res.end("unavailable"); }
});
await new Promise<void>((resolve) => speechMock.listen(0, "127.0.0.1", resolve));
const speechPort = (speechMock.address() as { port: number }).port;
const env = { ...process.env, GROQ_API_KEY: "synthetic-test-key", GROQ_BASE_URL: `http://127.0.0.1:${speechPort}`, DATABASE_URL: URL_DB, SESSION_SECRET: randomBytes(32).toString("hex"), ADMIN_EMAIL: "", ADMIN_PASSWORD_HASH: "" };
await new Promise<void>((res, rej) => spawn(process.execPath, ["scripts/migrate.mjs"], { env, stdio: "inherit" }).on("exit", (c) => (c ? rej(new Error("migrate")) : res())));
const tables = (await db.query("select table_name from information_schema.tables where table_schema='public'")).rows.map((r) => r.table_name);
ok("migrații aplicate (7 tabele)", ["firms", "users", "invites", "trucks", "documents", "trips", "support_requests"].every((t) => tables.includes(t)), tables.join(","));
const PORT = 3000 + Math.floor(Math.random() * 900) + 4000, BASE = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { env, stdio: "ignore", detached: true });
const stop = () => { try { process.kill(-srv.pid!); } catch { /* deja oprit */ } };
for (let i = 0; i < 60; i++) { try { await fetch(`${BASE}/login`); break; } catch { await new Promise((r) => setTimeout(r, 500)); } }

class Agent {
  jar = new Map<string, string>();
  async json(path: string, body: unknown) {
    const r = await fetch(BASE + path, { method: "POST", redirect: "manual", headers: { cookie: [...this.jar].map(([k,v]) => `${k}=${v}`).join("; "), "content-type": "application/json" }, body: JSON.stringify(body) });
    for (const c of r.headers.getSetCookie()) { const [kv] = c.split(";"); const i = kv.indexOf("="); this.jar.set(kv.slice(0, i), kv.slice(i + 1)); }
    return { status: r.status, body: await r.json() };
  }
  async go(path: string, form?: Record<string, string>) {
    const r = await fetch(BASE + path, { method: form ? "POST" : "GET", redirect: "manual", headers: { cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "), ...(form ? { "content-type": "application/x-www-form-urlencoded" } : {}) }, body: form ? new URLSearchParams(form).toString() : undefined });
    for (const c of r.headers.getSetCookie()) { const [kv] = c.split(";"); const i = kv.indexOf("="); this.jar.set(kv.slice(0, i), kv.slice(i + 1)); }
    return { status: r.status, loc: r.headers.get("location") ?? "", text: await r.text() };
  }
}
const vehiclesOf = async (a: Agent) => { const r = await a.go("/api/vehicles"); return r.status === 200 ? (JSON.parse(r.text).vehicles as { id: string; name: string }[]) : null; };
try {
  // 1. înscriere → firmă goală
  const A = new Agent();
  const s1 = await A.go("/api/auth/signup", { firm: "Trans Test A SRL", cui: "RO123456", email: "Owner.A@Test.ro", password: "parola-lunga-1" });
  ok("înscriere → /trucks + cookie de sesiune", s1.status === 303 && s1.loc.endsWith("/trucks") && A.jar.has("igo-session"), `${s1.status} ${s1.loc}`);
  const firmA = (await db.query("select f.* from firms f join users u on u.firm_id=f.id where u.email='owner.a@test.ro'")).rows[0];
  ok("firmă creată în DB, pe probă, fără date demo", !!firmA && firmA.demo_mode === false && !!firmA.trial_start);
  ok("firmă goală: 0 camioane", (await vehiclesOf(A))?.length === 0);
  const home = await A.go("/");
  ok("acasă: stare goală + setup", home.status === 200 && home.text.includes("/setup?step=5") && home.text.includes("empty"));
  // 2. setup
  ok("pas 1 firmă+monedă", (await A.go("/api/setup/firm", { name: "Trans Test A SRL", cui: "RO123456", currency: "EUR" })).loc.endsWith("/setup?step=2"));
  ok("pas 2 camion", (await A.go("/api/setup/truck", { plate: "bh21 qrt", vin: "", tank: "600", l100: "29,5", model: "Volvo FH" })).loc.includes("ok=1"));
  ok("pas 2 plăcuță dublă respinsă", (await A.go("/api/setup/truck", { plate: "BH 21 QRT" })).loc.includes("e=dup"));
  const tA = (await db.query("select * from trucks where firm_id=$1", [firmA.id])).rows;
  ok("camion salvat în Postgres (plăcuță normalizată)", tA.length === 1 && tA[0].plate === "BH 21 QRT" && tA[0].tank_l === 600 && tA[0].normal_l100 === 29.5, JSON.stringify(tA));
  ok("camion citit înapoi prin API", (await vehiclesOf(A))?.[0]?.name === "BH 21 QRT");
  const inv = await A.go("/api/setup/invite", { name: "Ioan Pop", phone: "0744 123 456" });
  ok("pas 3 invitație", inv.loc.includes("step=3&inv="));
  ok("pas 4 document", (await A.go("/api/setup/doc", { truck: tA[0].id, type: "itp", expires: "2026-12-01" })).loc.includes("ok=1"));
  ok("pas 5 prima cursă", (await A.go("/api/setup/trip", { truck: tA[0].id, client: "Dedeman SRL", title: "Oradea → Sibiu", date: "2026-10-10", km: "330", revenue: "2500", litres: "", fuelPrice: "7.3", tolls: "120", driver: "450" })).loc.includes("ok=1"));
  const trip = (await db.query("select * from trips where firm_id=$1", [firmA.id])).rows[0];
  ok("cursă în DB, litri estimați din consum", trip?.litres === 97, JSON.stringify(trip));
  const setup = await A.go("/setup?step=5");
  ok("setup 5/5 (fără CSV: cursa bifează pasul)", setup.text.includes("5") && /5 (din|of|z) 5/.test(setup.text));
  const costSave = await A.go("/api/vehicles/econ", { vid: tA[0].id, action: "costs", leasing: "2500" });
  ok("costurile se salvează cu intrare în vigoare viitoare", costSave.loc.includes("saved=1"));
  const costTruck = (await db.query("select costs, cost_history from trucks where id=$1", [tA[0].id])).rows[0];
  ok("salvarea păstrează profilul inițial", costTruck.costs === null && costTruck.cost_history.length === 1 && costTruck.cost_history[0].costs.leasing === 2500);
  const costsPage = await A.go(`/vehicles/${tA[0].id}?tab=costs`);
  ok("pagina arată luna de aplicare și istoricul", costsPage.status === 200 && costsPage.text.includes(costTruck.cost_history[0].month) && costsPage.text.includes("Lunile anterioare rămân neschimbate"));
  // 3. comutator date demo
  await A.go("/api/firm/demo", { on: "1" });
  const vd = await vehiclesOf(A);
  ok("Date demo PORNIT → firma demo", !!vd && vd.length === 7 && vd.some((v) => v.name === "BH 21 QRT") && !vd.some((v) => v.name.includes("Lexion")) && !vd.some((v) => v.id === tA[0].id));
  ok("mod demo: API-ul indică demo", JSON.parse((await A.go("/api/trips")).text).demo === true);
  ok("mod demo: nicio scriere accidentală în firma reală", (await A.json("/api/trips/new", { from: "A", to: "B", truckId: tA[0].id, date: "2026-12-01", km: 100 })).status === 403);
  for (const path of ["/", "/trucks", "/drivers", "/live", "/trips/bh21qrt-15", "/replay?trip=bh21qrt-15"]) ok(`demo: ${path} se randează`, (await A.go(path)).status === 200);
  const demoDriver = new Agent();
  await demoDriver.go("/api/auth/demo", { as: "driver" });
  const demoDriverPage = await demoDriver.go("/driver");
  ok("șoferul demo fără utilizator DB nu este deconectat", demoDriverPage.status === 200 && demoDriverPage.text.includes("driver-main") && !demoDriverPage.text.includes("NEXT_REDIRECT"));
  ok("pauza privată demo se salvează", (await demoDriver.json("/api/driver/private", { vehicleId: "bh21qrt", on: true })).body.private === true);
  await demoDriver.go("/api/auth/demo", { as: "owner" });
  const demoLive = JSON.parse((await demoDriver.go("/api/live")).text);
  ok("schimbarea rolului păstrează pauza privată", demoLive.vehicles.find((v: { id: string }) => v.id === "bh21qrt")?.status === "private");
  await demoDriver.go("/api/auth/demo", { as: "driver" });
  const demoEvent = await demoDriver.json("/api/trips/event", { tripId: "bh21qrt-15", kind: "unloaded" });
  ok("evenimentul demo folosește ora simulată 14:00", demoEvent.status === 200 && new Intl.DateTimeFormat("en-GB", {timeZone:"Europe/Bucharest",hour:"2-digit",minute:"2-digit"}).format(new Date(demoEvent.body.at)) === "14:00");
  ok("cursa demo inexistentă este respinsă", (await demoDriver.json("/api/trips/event", { tripId: "missing", kind: "loaded" })).status === 404);
  await demoDriver.go("/api/auth/demo", { as: "owner", reset: "1" });
  ok("reluarea demo-ului șterge pauza privată", JSON.parse((await demoDriver.go("/api/live")).text).vehicles.find((v: {id:string}) => v.id === "bh21qrt")?.status !== "private");
  await A.go("/api/firm/demo", { on: "0" });
  const vo = await vehiclesOf(A);
  ok("Date demo OPRIT → firma mea", vo?.length === 1 && vo[0].id === tA[0].id);
  ok("mod real: API-ul nu etichetează datele drept demo", JSON.parse((await A.go("/api/trips")).text).demo === false);
  ok("harta reală nu este etichetată demo", JSON.parse((await A.go("/api/live")).text).demo === false);
  ok("card asociat manual înainte de import", (await A.go("/api/import/assign", { card: "0000-1234", truck: tA[0].id, from: "2026-10-01T08:00" })).loc.includes("assigned=1"));
  ok("asocierea păstrează zerourile inițiale", (await db.query("select card from fuel_card_periods where firm_id=$1", [firmA.id])).rows.some((x) => x.card === "00001234"));
  ok("asocierea cere explicit data de început", (await A.go("/api/import/assign", { card: "NO-DATE", truck: tA[0].id })).loc.includes("e=assign"));
  ok("asocierea respinge data calendaristică invalidă", (await A.go("/api/import/assign", { card: "BAD-DATE", truck: tA[0].id, from: "2026-02-31T08:00" })).loc.includes("e=assign"));
  ok("istoricul și începutul perioadei apar în UI", (await A.go("/import")).text.includes("2026-10-01 08:00"));
  ok("card prea lung respins, fără trunchiere", (await A.go("/api/import/assign", { card: "1".repeat(41), truck: tA[0].id, from: "2026-10-01T08:00" })).loc.includes("e=assign"));
  ok("cardul nu poate fi legat de camion inexistent", (await A.go("/api/import/assign", { card: "TEST", truck: "missing", from: "2026-10-01T08:00" })).loc.includes("e=assign"));
  const archivedTruckId = `arch_${firmA.id}`;
  await db.query("insert into trucks (id, firm_id, plate, archived_at) values ($1,$2,'BH 98 TST',now())", [archivedTruckId, firmA.id]);
  ok("cardul nu poate fi legat de camion arhivat", (await A.go("/api/import/assign", { card: "TEST-ARCHIVED", truck: archivedTruckId, from: "2026-10-01T08:00" })).loc.includes("e=assign"));
  await db.query("delete from trucks where id=$1", [archivedTruckId]);
  // 4. invitația șoferului
  const s3 = await A.go("/setup?step=3");
  const link = /\/join\?t=([^"&\\]+)/.exec(s3.text.replace(/&amp;/g, "&"))?.[1];
  ok("link de invitație semnat în pagina de setup", !!link);
  const pending = (await db.query("select id from users where firm_id=$1 and role='driver'", [firmA.id])).rows[0];
  ok("patronul alocă explicit camionul înainte de activare", (await A.go("/api/drivers/assign", { uid: pending.id, truck: tA[0].id })).loc.includes("ok=1"));
  const D = new Agent();
  const jp = await D.go(`/join?t=${link}`);
  ok("șoferul deschide linkul fără cont", jp.status === 200 && jp.text.includes("Trans Test A SRL"));
  ok("token falsificat respins", (await D.go(`/join?t=${link!.slice(0, -3)}abc`)).text.includes("join") && !(await D.go(`/join?t=${link!.slice(0, -3)}abc`)).text.includes("Trans Test A SRL"));
  const j = await D.go("/api/auth/join", { t: decodeURIComponent(link!), phone: "0744 123 456", pin: "493827", pin2: "493827" });
  ok("invitație acceptată → /driver", j.status === 303 && j.loc.endsWith("/driver"), `${j.status} ${j.loc}`);
  const drv = (await db.query("select * from users where firm_id=$1 and role='driver'", [firmA.id])).rows;
  ok("șofer în DB, telefon normalizat, invitație consumată", drv.length === 1 && drv[0].phone === "+40744123456" && (await db.query("select used_at from invites where firm_id=$1", [firmA.id])).rows[0].used_at != null);
  ok("pagina de șofer vede camionul firmei", (await D.go("/driver")).text.includes("BH 21 QRT"));
  ok("șoferul nu vede pagini de proprietar", (await D.go("/trips")).status === 307 && (await D.go("/api/vehicles")).status === 403);
  ok("invitație refolosită → respinsă", (await new Agent().go("/api/auth/join", { t: decodeURIComponent(link!), phone: "0744000111", pin: "111111", pin2: "111111" })).loc.includes("e=used"));
  const DL = new Agent();
  ok("șoferul intră cu telefon + PIN", (await DL.go("/api/auth/login", { email: "0744123456", password: "493827" })).loc.endsWith("/driver"));
  const parsed = await A.json("/api/trips/parse", { text: "de la Oradea la Arad mâine cu Ioan Pop" });
  ok("text rostit → rută și șofer corecte", parsed.status === 200 && parsed.body.from === "Oradea" && parsed.body.to === "Arad" && parsed.body.driverId === drv[0].id);
  const audio = new FormData(); audio.set("audio", new Blob(["synthetic fixture"], { type: "audio/webm" }), "test.webm"); audio.set("language", "ro");
  const transcribed = await fetch(BASE + "/api/trips/transcribe", { method: "POST", headers: { cookie: [...A.jar].map(([k,v]) => `${k}=${v}`).join("; ") }, body: audio });
  ok("audio → text prin furnizor simulat", transcribed.status === 200 && (await transcribed.json()).text.includes("Oradea"));
  ok("șoferul nu poate folosi transcrierea patronului", (await D.json("/api/trips/transcribe", {})).status === 403);
  const payload = { from: "Oradea", to: "Arad", date: "2026-12-01", truckId: tA[0].id, driverId: drv[0].id, km: "120", revenue: "2000" };
  ok("numere invalide respinse", (await A.json("/api/trips/new", { ...payload, revenue: "abc" })).status === 400);
  const retryBody = { ...payload, key: "http-new-trip-001" };
  const retries = await Promise.all([A.json("/api/trips/new", retryBody), A.json("/api/trips/new", retryBody)]);
  ok("creare concurentă: o singură cursă", retries.every((r) => r.status === 200) && retries[0].body.id === retries[1].body.id);
  ok("aceeași cheie cu alte date respinsă", (await A.json("/api/trips/new", { ...retryBody, revenue: "4000" })).status === 409);
  ok("cheie invalidă respinsă", (await A.json("/api/trips/new", { ...retryBody, key: "bad" })).status === 400);
  const created = retries[0];
  ok("cursă planificată creată", created.status === 200 && !!created.body.id);
  ok("cursă planificată editată", (await A.json("/api/trips/new", { ...payload, id: created.body.id, to: "Timișoara" })).status === 200);
  const filtered = await A.go("/trips?status=planned&q=Timi");
  ok("filtrare curse planificate", filtered.text.includes("Oradea → Timișoara"));
  const eventBody = { tripId: created.body.id, kind: "loaded", key: "http-load-001", actorId: drv[0].id, occurredAt: new Date(Date.now() - 3600000).toISOString() };
  ok("cont schimbat respins la sincronizare", (await D.json("/api/trips/event", { ...eventBody, actorId: "another-user" })).status === 403);
  ok("descărcare înainte de încărcare respinsă", (await D.json("/api/trips/event", { ...eventBody, kind: "unloaded" })).status === 409);
  ok("încărcare confirmată", (await D.json("/api/trips/event", eventBody)).body.ok === true);
  const feedTime = (await db.query("select at from driver_events where user_id=$1 and kind='loaded' order by at desc limit 1", [drv[0].id])).rows[0].at;
  ok("fluxul păstrează ora evenimentului offline", new Date(feedTime).toISOString() === eventBody.occurredAt);
  ok("retransmitere fără dublare", (await D.json("/api/trips/event", eventBody)).body.duplicate === true);
  ok("editarea după încărcare respinsă", (await A.json("/api/trips/new", { ...payload, id: created.body.id })).status === 409);
  ok("anularea după încărcare respinsă", (await A.go("/api/trips/cancel", { id: created.body.id, reason: "Test cancellation" })).loc.includes("e=transition"));
  ok("livrare confirmată", (await D.json("/api/trips/event", { ...eventBody, kind: "unloaded", key: "http-unload-001", occurredAt: new Date().toISOString() })).body.ok === true);
  await db.query("update trips set date='2026-01-01' where id=$1", [created.body.id]);
  ok("patronul finalizează cursa livrată", (await A.go("/api/trips/complete", { id: created.body.id })).loc.endsWith(`/trips/${created.body.id}`));
  const toCancel = await A.json("/api/trips/new", payload);
  ok("șoferul nu anulează cursa", (await D.go("/api/trips/cancel", { id: toCancel.body.id, reason: "Test cancellation" })).status === 403);
  ok("anulare cu motiv confirmată", (await A.go("/api/trips/cancel", { id: toCancel.body.id, reason: "Client cancelled" })).loc.endsWith(`/trips/${toCancel.body.id}`));
  ok("istoricul anulării vizibil", (await A.go(`/trips/${toCancel.body.id}`)).text.includes("Client cancelled"));
  ok("cursa încheiată nu poate fi rescrisă", (await A.json("/api/trips/new", { ...payload, id: created.body.id })).status === 409);
  for (const path of ["/", "/trips", "/trucks", "/drivers", "/documents", "/receipts", "/invoices", "/settings", "/feed", "/notifications", "/savings", "/ranking"]) {
    const page = await A.go(path);
    ok(`pagina patronului ${path} se randează`, page.status === 200 && !page.text.includes("Application error"));
  }
  for (const patch of [{ km: "-1" }, { km: "Infinity" }, { tonnes: "61" }, { revenue: "NaN" }, { date: "2026-02-31" }, { driverId: "foreign-driver" }, { truckId: "foreign-truck" }]) {
    ok(`date invalide respinse ${JSON.stringify(patch)}`, (await A.json("/api/trips/new", { ...payload, ...patch })).status === 400);
  }
  const emptyRun = await A.json("/api/trips/new", { ...payload, tonnes: "0", revenue: "0" });
  const emptyRow = (await db.query("select tonnes,revenue from trips where id=$1", [emptyRun.body.id])).rows[0];
  ok("tonajul și venitul zero rămân zero", emptyRun.status === 200 && emptyRow.tonnes === 0 && emptyRow.revenue === 0);
  // 5. izolare între firme
  const B = new Agent();
  await B.go("/api/auth/signup", { firm: "Firma B", email: "b@test.ro", password: "parola-lunga-2" });
  const vb = await vehiclesOf(B);
  ok("firma B nu vede camioanele lui A", vb?.length === 0);
  ok("B nu poate pune document pe camionul lui A", (await B.go("/api/setup/doc", { truck: tA[0].id, type: "rca", expires: "2027-01-01" })).loc.includes("e=doc"));
  ok("B nu poate pune cursă pe camionul lui A", (await B.go("/api/setup/trip", { truck: tA[0].id, client: "X", title: "Y", date: "2026-10-10", km: "10", revenue: "10", fuelPrice: "7" })).loc.includes("e=trip"));
  ok("în DB: nimic scris pe firma B", (await db.query("select (select count(*) from documents d join firms f on f.id=d.firm_id where f.name='Firma B')::int + (select count(*) from trips t join firms f on f.id=t.firm_id where f.name='Firma B')::int as n")).rows[0].n === 0);
  ok("B nu poate alege altă firmă (doar admin)", (await B.go("/api/admin/firm", { id: firmA.id })).status === 403 && (await B.go("/admin")).status === 307);
  const tripsB = await B.go("/trips");
  ok("lista de curse B: goală, fără cursa lui A", tripsB.status === 200 && !tripsB.text.includes("Oradea → Sibiu"));
  { const r = await B.go(`/trips/${trip.id}`); ok("B nu poate deschide cursa lui A", (r.status === 404 || r.text.includes("NEXT_NOT_FOUND") || r.text.includes("404")) && !r.text.includes("Oradea → Sibiu")); }
  ok("pagini permanente camion și șofer", (await A.go("/trucks")).text.includes("BH 21 QRT") && (await A.go("/drivers")).text.includes("Ioan Pop"));
  await A.go("/api/setup/driver", { uid: drv[0].id, off: "1", ret: "/drivers" });
  const revoked = await D.go("/driver");
  ok("dezactivarea revocă sesiunea existentă", revoked.status === 307 && revoked.loc.includes("/api/auth/logout"));
  const disabled = (await db.query("select truck_id, disabled_at, session_version from users where id=$1", [drv[0].id])).rows[0];
  ok("dezactivarea eliberează camionul", disabled.truck_id === null && !!disabled.disabled_at && disabled.session_version > 0);
  // 6. asistență
  await A.go("/api/support", { name: "Owner A", phone: "0744999888", slot: "morning", message: "ajutor" });
  ok("cerere Asistență Querra salvată", (await db.query("select * from support_requests where firm_id=$1", [firmA.id])).rows.length === 1);
} finally { stop(); await db.end(); speechMock.close(); }
console.log(fail ? `smoke:tenant: ${fail} eșec(uri)` : "smoke:tenant OK");
process.exit(fail ? 1 : 0);

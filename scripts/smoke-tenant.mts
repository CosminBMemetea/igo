// smoke:tenant — capăt la capăt pe Postgres real: înscriere → firmă goală → pașii de setup → camion salvat și citit din DB;
// comutatorul „Date demo”; invitația șoferului; izolarea între firme.
// Cere: build făcut (npm run build) și TEST_DATABASE_URL (o bază de test care se GOLEȘTE). Pornește singur `next start`.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import pg from "pg";
const URL_DB = process.env.TEST_DATABASE_URL;
if (!URL_DB) { console.log("smoke:tenant: TEST_DATABASE_URL lipsește, sar peste (ex.: postgres://igo:igo@localhost/igo_test)"); process.exit(0); }
let fail = 0;
const ok = (n: string, c: boolean, extra = "") => { console.log(`${c ? "PASS" : "FAIL"} ${n}${c ? "" : " " + extra}`); if (!c) fail++; };
const db = new pg.Client({ connectionString: URL_DB }); await db.connect();
await db.query("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
const env = { ...process.env, DATABASE_URL: URL_DB, SESSION_SECRET: randomBytes(32).toString("hex"), ADMIN_EMAIL: "", ADMIN_PASSWORD_HASH: "" };
await new Promise<void>((res, rej) => spawn(process.execPath, ["scripts/migrate.mjs"], { env, stdio: "inherit" }).on("exit", (c) => (c ? rej(new Error("migrate")) : res())));
const tables = (await db.query("select table_name from information_schema.tables where table_schema='public'")).rows.map((r) => r.table_name);
ok("migrații aplicate (7 tabele)", ["firms", "users", "invites", "trucks", "documents", "trips", "support_requests"].every((t) => tables.includes(t)), tables.join(","));
const PORT = 3000 + Math.floor(Math.random() * 900) + 4000, BASE = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { env, stdio: "ignore", detached: true });
const stop = () => { try { process.kill(-srv.pid!); } catch { /* deja oprit */ } };
for (let i = 0; i < 60; i++) { try { await fetch(`${BASE}/login`); break; } catch { await new Promise((r) => setTimeout(r, 500)); } }

class Agent {
  jar = new Map<string, string>();
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
  ok("Date demo PORNIT → firma demo", !!vd && vd.length > 5 && vd.some((v) => v.name === "BH 21 QRT") && !vd.some((v) => v.name.includes("Lexion")) && !vd.some((v) => v.id === tA[0].id));
  await A.go("/api/firm/demo", { on: "0" });
  const vo = await vehiclesOf(A);
  ok("Date demo OPRIT → firma mea", vo?.length === 1 && vo[0].id === tA[0].id);
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
} finally { stop(); await db.end(); }
console.log(fail ? `smoke:tenant: ${fail} eșec(uri)` : "smoke:tenant OK");
process.exit(fail ? 1 : 0);

// smoke:feed — „Fluxul flotei” pe HTTP: demo (filtre, indicator live, 3 limbi), firmă reală (evenimente din aplicația
// șoferului, filtre pe tip/camion, acțiuni rapide), firmă goală (stare goală), izolare între firme, timp de răspuns.
// Doar bază LOCALĂ (TEST_DATABASE_URL pe localhost; se GOLEȘTE). Cere `npm run build` făcut înainte.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import pg from "pg";

const URL_DB = process.env.TEST_DATABASE_URL;
if (!URL_DB) { console.log("smoke:feed: TEST_DATABASE_URL lipsește, sar peste"); process.exit(0); }
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(URL_DB)) throw new Error("smoke:feed: refuz — TEST_DATABASE_URL trebuie să fie local");
let fail = 0, checks = 0;
const ok = (n: string, c: boolean, extra = "") => { checks++; if (!c) { fail++; console.log(`FAIL ${n} ${extra}`); } };

const db = new pg.Client({ connectionString: URL_DB }); await db.connect();
await db.query("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
const env = { ...process.env, DATABASE_URL: URL_DB, SESSION_SECRET: randomBytes(32).toString("hex"), ADMIN_EMAIL: "", ADMIN_PASSWORD_HASH: "", GROQ_API_KEY: "", BLOB_READ_WRITE_TOKEN: "" };
await new Promise<void>((res, rej) => spawn(process.execPath, ["scripts/migrate.mjs"], { env, stdio: "ignore" }).on("exit", (c) => (c ? rej(new Error("migrate")) : res())));
const PORT = 5000 + Math.floor(Math.random() * 900), B = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { env, stdio: "ignore", detached: true });
const stop = () => { try { process.kill(-srv.pid!); } catch { /* oprit */ } };
for (let i = 0; i < 80; i++) { try { await fetch(`${B}/login`); break; } catch { await new Promise((r) => setTimeout(r, 500)); } }

type Jar = { cookie: string };
async function req(j: Jar | null, method: string, path: string, body?: FormData | object) {
  const headers: Record<string, string> = { origin: B };
  if (j?.cookie) headers.cookie = j.cookie;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body; else if (body) { payload = JSON.stringify(body); headers["content-type"] = "application/json"; }
  const t0 = Date.now(), r = await fetch(B + path, { method, headers, body: payload, redirect: "manual" });
  for (const c of r.headers.getSetCookie()) { const [kv] = c.split(";"); const [k] = kv.split("="); if (j) j.cookie = [...j.cookie.split("; ").filter((x) => x && !x.startsWith(k + "=")), kv].join("; "); }
  const text = await r.text();
  return { status: r.status, loc: r.headers.get("location") ?? "", text, ms: Date.now() - t0 };
}
const form = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const q = async (sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows;
const setLoc = (j: Jar, l: string) => { j.cookie = [...j.cookie.split("; ").filter((x) => x && !x.startsWith("igo-locale=")), `igo-locale=${l}`].join("; "); };

try {
  // ---------- demo ----------
  const demo: Jar = { cookie: "" }; await req(demo, "POST", "/api/auth/demo");
  await req(demo, "GET", "/feed"); // încălzire
  const f = await req(demo, "GET", "/feed");
  ok("demo /feed 200", f.status === 200, String(f.status));
  ok("demo /feed sub 3 s", f.ms < 3000, `${f.ms} ms`);
  ok("demo: indicator live", f.text.includes('class="fnow'));
  ok("demo: filtre", f.text.includes('class="fchips"') && (f.text.match(/class="fchip/g) ?? []).length >= 3);
  ok("demo: povești", f.text.includes('class="fstories"'));
  ok("demo: filtru camion", f.text.includes('class="fchtruck"'));
  for (const [l, word] of [["ro", "Toate"], ["en", "All"], ["pl", "Wszystko"]] as const) { setLoc(demo, l); const r = await req(demo, "GET", "/feed"); ok(`demo ${l}: eticheta filtrului`, r.text.includes(`>${word}<`), l); }
  setLoc(demo, "ro");
  ok("demo: fără scriere în DB", (await q("select count(*)::int n from driver_events"))[0].n === 0);

  // ---------- firme reale ----------
  async function firm(tag: string, plate: string, ip: string) {
    const o: Jar = { cookie: "" }, email = `${tag.toLowerCase()}@feed.test`;
    await fetch(B + "/api/auth/signup", { method: "POST", headers: { origin: B, "x-forwarded-for": ip }, body: form({ firm: `Flux ${tag} SRL`, email, password: "testpass12345", consent: "on" }), redirect: "manual" }).then((r) => { for (const c of r.headers.getSetCookie()) o.cookie = [o.cookie, c.split(";")[0]].filter(Boolean).join("; "); });
    if (!o.cookie.includes("igo-session")) throw new Error(`signup ${tag} failed`);
    await req(o, "POST", "/api/setup/truck", form({ plate, model: "DAF", tank: "600", l100: "30" }));
    const [fr] = await q("select f.id from firms f join users u on u.firm_id=f.id where u.email=$1", [email]);
    const [truck] = await q("select id from trucks where firm_id=$1", [fr.id]);
    return { o, firmId: fr.id as string, truckId: truck.id as string };
  }
  const A = await firm("A", "BH 01 FDA", "10.1.1.1"), Bf = await firm("B", "CJ 02 FDB", "10.1.1.2"), E = await firm("E", "TM 03 FDE", "10.1.1.3");
  const K = ["shift_start", "loaded", "wait_start", "wait_end", "fill", "private_on", "private_off", "unloaded"];
  for (let i = 0; i < K.length; i++) await q("insert into driver_events (id,firm_id,truck_id,kind,at,note) values ($1,$2,$3,$4,$5,$6)", [`sf${i}`, A.firmId, A.truckId, K[i], new Date(Date.now() - (K.length - i) * 20 * 60000).toISOString(), i === 4 ? "NOTA-A-SECRETA" : null]);
  const a = await req(A.o, "GET", "/feed");
  ok("real /feed 200", a.status === 200, String(a.status));
  ok("real /feed sub 3 s", a.ms < 3000, `${a.ms} ms`);
  ok("real: toate evenimentele", (a.text.match(/class="rfe /g) ?? []).length === K.length, String((a.text.match(/class="rfe /g) ?? []).length));
  ok("real: rânduri apăsabile", (a.text.match(/class="rfrow"/g) ?? []).length === K.length);
  ok("real: filtre pe tip", a.text.includes('class="fchips"') && a.text.includes(">Marfă<") && a.text.includes(">Alimentări<"));
  ok("real: indicator live", a.text.includes('class="fnow'));
  ok("real: nota apare", a.text.includes("NOTA-A-SECRETA"));
  ok("real: grupat pe zi", a.text.includes('class="rfday"'));
  const b = await req(Bf.o, "GET", "/feed");
  ok("izolare: B nu vede evenimentele lui A", b.status === 200 && !b.text.includes("NOTA-A-SECRETA") && !b.text.includes("BH 01 FDA"));
  ok("izolare: B are stare goală", b.text.includes('class="rfempty'));
  const e = await req(E.o, "GET", "/feed");
  ok("gol: fără filtre când nu e nimic", e.text.includes('class="rfempty') && !e.text.includes('class="fchips"'));
  const anon = await req(null, "GET", "/feed");
  ok("anonim: redirecționat", anon.status >= 300 && anon.status < 400, String(anon.status));
} finally { stop(); await db.end(); }
console.log(`smoke:feed — ${checks - fail}/${checks} ok`);
process.exit(fail ? 1 : 0);

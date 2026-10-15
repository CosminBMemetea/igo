// smoke:auth: cookie de sesiune obligatoriu, roluri, schimbarea planului doar pentru admin, parole scrypt.
import { randomBytes, scryptSync } from "node:crypto";
import { signSession, verifySession, type Session } from "../src/lib/session";
import { canSwitchPlan, decide, effectivePlan } from "../src/lib/access";
import { verifyPassword } from "../src/lib/scrypt";
import { planIncludes } from "../src/lib/features";
let fail = 0;
const ok = (n: string, c: boolean) => { console.log(`${c ? "PASS" : "FAIL"} ${n}`); if (!c) fail++; };
const SECRET = randomBytes(32).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const admin: Session = { role: "admin", email: "a@x.ro", firm: "demo", exp: now + 3600 };
const user: Session = { role: "user", email: "demo@querrafleet.demo", firm: "demo", exp: now + 3600 };
const tok = await signSession(admin, SECRET);
ok("sesiune validă se verifică", (await verifySession(tok, SECRET))?.role === "admin");
const [b, s] = tok.split(".");
const forged = Buffer.from(JSON.stringify({ ...user, role: "admin" })).toString("base64url") + "." + s;
ok("payload modificat → respins", (await verifySession(forged, SECRET)) === null);
ok("semnătură greșită → respins", (await verifySession(`${b}.${s.slice(0, -2)}xx`, SECRET)) === null);
ok("alt secret → respins", (await verifySession(tok, randomBytes(32).toString("base64url"))) === null);
ok("expirat → respins", (await verifySession(await signSession({ ...user, exp: now - 1 }, SECRET), SECRET)) === null);
ok("fără SESSION_SECRET → respins", (await verifySession(tok, undefined)) === null && (await verifySession(tok, "scurt")) === null);
ok("fără cookie → respins", (await verifySession(undefined, SECRET)) === null);
// acces
ok("pagină fără sesiune → /login", decide("/", null).kind === "login" && decide("/crm", null).kind === "login");
ok("API fără sesiune → 401", decide("/api/trips", null).kind === "unauthorized" && decide("/api/ask", null).kind === "unauthorized");
ok("/login și /api/auth/* publice", decide("/login", null).kind === "allow" && decide("/api/auth/demo", null).kind === "allow");
ok("demo user are acces la date demo", decide("/api/trips", user).kind === "allow" && decide("/live", user).kind === "allow");
// roluri + plan
ok("?plan= doar pentru admin", canSwitchPlan(admin) && !canSwitchPlan(user) && !canSwitchPlan(null));
const a1 = effectivePlan(admin, "admin", "start", "trial");
ok("admin în mod Admin: totul deblocat", a1.adminView && planIncludes(a1.plan, "crm") && planIncludes(a1.plan, "probe"));
const a2 = effectivePlan(admin, "user", "start", "trial");
ok("admin în mod Utilizator vede planul ales (Start: CRM blocat)", !a2.adminView && a2.plan === "start" && !planIncludes(a2.plan, "crm"));
const u1 = effectivePlan(user, "user", "business", "start");
ok("user ignoră planul de previzualizare", u1.plan === "start" && !u1.adminView);
ok("user nu poate cere mod Admin", !effectivePlan(user, "admin", "business", "start").adminView);
// parole
const salt = randomBytes(16), hash = scryptSync("parola-de-test-123", salt, 32, { N: 16384, r: 8, p: 1 });
const stored = `scrypt:16384:8:1:${salt.toString("base64")}:${hash.toString("base64")}`;
ok("parolă corectă", verifyPassword("parola-de-test-123", stored));
ok("parolă greșită", !verifyPassword("parola-de-test-124", stored));
ok("hash lipsă/stricat", !verifyPassword("x", undefined) && !verifyPassword("x", "abc") && !verifyPassword("x", "scrypt:1:1:1:aa:bb"));
// roluri de firmă (owner/driver)
const owner: Session = { role: "owner", email: "o@x.ro", firm: "f_1", uid: "u_1", exp: now + 3600 };
const driver: Session = { role: "driver", email: "+40744123456", firm: "f_1", uid: "u_2", exp: now + 3600 };
ok("sesiune owner/driver se verifică", (await verifySession(await signSession(owner, SECRET), SECRET))?.firm === "f_1" && (await verifySession(await signSession(driver, SECRET), SECRET))?.role === "driver");
ok("rol necunoscut → respins", (await verifySession(await signSession({ ...owner, role: "root" as never }, SECRET), SECRET)) === null);
ok("/signup și /join publice", decide("/signup", null).kind === "allow" && decide("/join", null).kind === "allow");
ok("șofer: doar /driver și API-ul lui", decide("/driver", driver).kind === "allow" && decide("/api/driver/fill", driver).kind === "allow" && decide("/", driver).kind === "forbidden" && decide("/api/trips", driver).kind === "forbidden");
ok("setup doar owner/admin", decide("/setup", owner).kind === "allow" && decide("/setup", admin).kind === "allow" && decide("/setup", user).kind === "forbidden" && decide("/api/setup/truck", driver).kind === "forbidden");
ok("/admin doar admin", decide("/admin", admin).kind === "allow" && decide("/admin", owner).kind === "forbidden" && decide("/api/admin/firm", owner).kind === "forbidden");
ok("owner nu poate schimba planul", !canSwitchPlan(owner) && !canSwitchPlan(driver));
if (fail) { console.error(`smoke:auth: ${fail} eșec(uri)`); process.exit(1); }
ok("demo poate deschide /import", decide("/import", user).kind === "allow");
ok("demo poate previzualiza/importa (în memorie)", decide("/api/import/preview", user).kind === "allow" && decide("/api/import/commit", user).kind === "allow");
ok("demo NU poate asocia carduri / setup", decide("/api/import/assign", user).kind === "forbidden" && decide("/setup", user).kind === "forbidden");
ok("demo poate explora camioanele și șoferii", decide("/trucks", user).kind === "allow" && decide("/drivers", user).kind === "allow" && decide("/api/drivers/assign", user).kind === "forbidden");
ok("demo poate deschide /replay", decide("/replay", user).kind === "allow");
{
  const { demoSandbox, DEMO_TRUCKS } = await import("../src/lib/fuel/demo-import");
  ok("importul demo folosește cele 7 camioane", DEMO_TRUCKS.length === 7 && DEMO_TRUCKS.some((x) => x.plate === "BH 77 QRT"));
  const { commit } = await import("../src/lib/fuel/import");
  const { readFileSync } = await import("node:fs");
  const a = await demoSandbox(), b2 = await demoSandbox();
  const r = await commit(a.s, a.f.id, readFileSync("public/samples/anomalii.csv", "utf8"), "anomalii.csv");
  ok("import demo în sandbox", r.ok && r.added > 0);
  ok("sandbox demo izolat (alt sandbox gol)", (await b2.s.fuel(b2.f.id, { limit: 10 })).length === 0);
  const { demoReplay } = await import("../src/lib/replay");
  const rp = demoReplay("bh21qrt", "2026-10-15", null)!;
  ok("replay demo: geometrie, alimentare, pauză, privat", rp.path.length > 100 && ["fuel", "pause", "private"].every((k) => rp.events.some((e) => e.kind === k)));
  const pv = rp.events.find((e) => e.kind === "private")!;
  ok("replay: nicio poziție în porțiunea privată", !rp.path.some((p) => p[2] > pv.km + 0.01 && p[2] < pv.km + 1));
}
console.log("smoke:auth OK");

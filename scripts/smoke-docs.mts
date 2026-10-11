// smoke:docs — starea documentelor, pragurile de reamintire, idempotența jobului zilnic, limita de 2 MB la fișiere,
// tokenul de invitație (+ anulare) și izolarea fișierelor/evenimentelor între firme (Postgres cu TEST_DATABASE_URL).
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { docStatus, stageFor, dueReminders } from "../src/lib/docs";
import { checkFile, MAX_FILE_BYTES } from "../src/lib/files";
import { inviteToken, readInvite, INVITE_TTL_S } from "../src/lib/invite";
import { summarize } from "../src/lib/paperwork";
let fail = 0;
const ok = (n: string, c: boolean, extra = "") => { console.log(`${c ? "PASS" : "FAIL"} ${n}${c ? "" : " " + extra}`); if (!c) fail++; };
const T = "2026-10-15";
const add = (n: number) => { const d = new Date(Date.parse(T + "T00:00:00Z") + n * 864e5); return d.toISOString().slice(0, 10); };

// 1. stare
const st = (n: number) => docStatus(add(n), T).status;
ok("stare: 31 z valid · 30 sub 30 · 8 sub 30 · 7 urgent · 0 urgent · -1 expirat", st(31) === "valid" && st(30) === "soon" && st(8) === "soon" && st(7) === "urgent" && st(0) === "urgent" && st(-1) === "expired");
ok("zile rămase corecte peste schimbarea de oră (25.10)", docStatus("2026-10-27", "2026-10-24").days === 3);
// 2. praguri
const stages = [45, 31, 30, 20, 14, 8, 7, 2, 1, 0, -5].map(stageFor).join(",");
ok("praguri 30/14/7/1/0", stages === ",,d30,d30,d14,d14,d7,d7,d1,d0,d0", stages);
const users = [{ id: "o", role: "owner" as const, email: "o@x.ro" }, { id: "dr", role: "driver" as const, email: null, truckId: "t1" }, { id: "d2", role: "driver" as const, email: null, truckId: "t2" }];
const rem = dueReminders([{ id: "a", type: "rca", expires: add(6), truckId: "t1", userId: null, label: "B 1" }, { id: "b", type: "licence", expires: add(1), truckId: null, userId: "d2", label: "Ion" }, { id: "c", type: "itp", expires: add(90), truckId: "t2", userId: null, label: "B 2" }], users, T);
const keys = rem.map((r) => r.key).sort().join(" ");
ok("destinatari: proprietar (clopoțel+email), șoferul camionului, șoferul titular; nimic pentru 90 de zile", keys === "a:2026-10-21:d7:dr a:2026-10-21:d7:mail:o a:2026-10-21:d7:owner b:2026-10-16:d1:d2 b:2026-10-16:d1:mail:o b:2026-10-16:d1:owner", keys);
// 3. fișiere
ok("limita 2 MB: exact 2 MB trece, +1 octet respins", checkFile(MAX_FILE_BYTES, "image/jpeg") === null && checkFile(MAX_FILE_BYTES + 1, "image/jpeg") === "size");
ok("tipuri: PDF/JPEG da, HTML/SVG nu, gol nu", checkFile(10, "application/pdf") === null && checkFile(10, "text/html") === "type" && checkFile(10, "image/svg+xml") === "type" && checkFile(0, "image/png") === "empty");
// 4. token invitație
const sec = "s".repeat(32), now = 1_800_000_000;
const tk = await inviteToken("f1", "i1", sec, now);
ok("token invitație valid", (await readInvite(tk, sec, now + 10))?.inv === "i1");
ok("token alterat / alt secret / expirat → respins", !(await readInvite(tk.slice(0, -2) + "xx", sec, now)) && !(await readInvite(tk, "x".repeat(32), now)) && !(await readInvite(tk, sec, now + INVITE_TTL_S + 1)));
// 5. așteptare
const w = summarize([{ kind: "loaded", at: "2026-10-15T06:00:00Z", lat: null, lng: null }, { kind: "wait_start", at: "2026-10-15T08:00:00Z", lat: null, lng: null }, { kind: "wait_end", at: "2026-10-15T09:30:00Z", lat: null, lng: null }, { kind: "wait_start", at: "2026-10-15T11:00:00Z", lat: null, lng: null }], Date.parse("2026-10-15T11:20:00Z"));
ok("timp de așteptare: 90 min închis + 20 min deschis = 110", w.waitMin === 110 && w.waiting && w.loadedAt === "2026-10-15T06:00:00Z");

// 6. Postgres
const URL_DB = process.env.TEST_DATABASE_URL;
if (!URL_DB) console.log("smoke:docs: TEST_DATABASE_URL lipsește, sar peste partea Postgres");
else {
  const pool = new pg.Pool({ connectionString: URL_DB, max: 2 });
  await pool.query("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
  await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  const schema = await import("../src/db/schema");
  const { PgStore } = await import("../src/lib/store/pg");
  const { runReminders } = await import("../src/lib/reminders");
  const { saveFile, readFile } = await import("../src/lib/files");
  const s = new PgStore(drizzle(pool, { schema }) as never);
  const A = await s.createFirm({ name: "A SRL", cui: null }), B = await s.createFirm({ name: "B SRL", cui: null });
  const own = await s.createUser({ firmId: A.id, role: "owner", name: "Ana", email: `a${Date.now()}@x.ro`, phone: null, passwordHash: "x" });
  const tA = await s.addTruck(A.id, { plate: "BH01AAA", vin: null, model: null, tankL: 600, normalL100: 30 });
  const drv = await s.createUser({ firmId: A.id, role: "driver", name: "Ion", email: null, phone: `07${Date.now() % 1e8}`, passwordHash: "x" });
  await s.setUserTruck(A.id, drv.id, tA.id);
  const d1 = await s.addDoc(A.id, { truckId: tA.id, userId: null, scope: "vehicle", type: "rca", expires: add(6) });
  await s.addDoc(A.id, { truckId: null, userId: drv.id, scope: "driver", type: "tachoCard", expires: add(-3) });
  await s.addDoc(A.id, { truckId: tA.id, userId: null, scope: "vehicle", type: "itp", expires: add(200) });
  const r1 = await runReminders(s, T, null);
  ok("job: 4 notificări (2 proprietar + 2 șofer), 2 emailuri în coadă fără furnizor", r1.notifications === 4 && r1.emails.queued === 2 && r1.emails.sent === 0, JSON.stringify(r1));
  const r2 = await runReminders(s, T, null);
  ok("job rulat de două ori → zero duplicate", r2.notifications === 0 && r2.emails.queued + r2.emails.sent + r2.emails.failed === 0, JSON.stringify(r2));
  const mails = await s.emails();
  ok("emailurile nefurnizate rămân „queued”, nu „sent”", mails.length === 2 && mails.every((m) => m.status === "queued" && !m.sentAt));
  const sent: string[] = [];
  const fake = { name: "fake", send: async (m: { to: string }) => { sent.push(m.to); return { id: "x" + sent.length }; } };
  const r3 = await runReminders(s, add(5), fake); // a doua zi: RCA trece în pragul d1
  ok("pragul următor (1 zi) → notificări noi + email trimis prin furnizor", r3.notifications === 2 && r3.emails.sent === 1 && sent.length === 1, JSON.stringify(r3));
  await s.updateDoc(A.id, d1.id, { expires: add(400) });
  ok("document reînnoit → nicio reamintire nouă", (await runReminders(s, add(5), fake)).notifications === 0);
  ok("clopoțel: proprietarul și șoferul își văd doar notificările lor", (await s.notifications(A.id, null)).length === 3 && (await s.notifications(A.id, drv.id)).length === 3 && (await s.notifications(B.id, null)).length === 0);
  await s.markRead(A.id, drv.id);
  ok("marcare ca citit doar pentru șofer", (await s.notifications(A.id, drv.id)).every((n) => n.readAt) && (await s.notifications(A.id, null)).every((n) => !n.readAt));
  // fișiere + izolare
  const trip = await s.addTrip(A.id, { truckId: tA.id, client: "X", title: "Oradea → Cluj", date: T, km: 150, revenue: 2000, litres: 45, fuelPrice: 7, tolls: 0, driverCost: 300, other: 0 });
  const big = Buffer.alloc(MAX_FILE_BYTES + 1, 1);
  let capErr = ""; try { await saveFile(s, A.id, { kind: "cmr", tripId: trip.id, name: "x.jpg", mime: "image/jpeg", bytes: big, userId: drv.id }); } catch (e) { capErr = (e as Error).message; }
  ok("upload > 2 MB respins de server", capErr === "size");
  const f = await saveFile(s, A.id, { kind: "cmr", tripId: trip.id, name: "cmr.jpg", mime: "image/jpeg", bytes: Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]), userId: drv.id });
  ok("fișier salvat în Postgres (bytea) și citit înapoi", f.storage === "db" && (await readFile(s, A.id, f.id))?.bytes.length === 6);
  ok("izolare: firma B nu citește fișierul lui A", (await readFile(s, B.id, f.id)) === null && (await s.files(B.id, { tripId: trip.id })).length === 0);
  let iso = ""; try { await s.addFile(B.id, { kind: "pod", tripId: trip.id, docId: null, name: "p", mime: "image/jpeg", size: 1, storage: "db", url: null, userId: null, data: Buffer.from([1]) }); } catch (e) { iso = (e as Error).message; }
  ok("izolare: B nu poate atașa fișiere la cursa lui A", iso === "trip");
  let ev = ""; try { await s.addTripEvent(B.id, { tripId: trip.id, kind: "loaded", at: new Date().toISOString(), lat: null, lng: null, userId: null }); } catch (e) { ev = (e as Error).message; }
  ok("izolare: evenimente și POD doar în firma proprie", ev === "trip" && !(await s.setPod(B.id, trip.id, true)) && (await s.setPod(A.id, trip.id, true)));
  ok("izolare: B nu șterge/modifică documentele lui A", !(await s.deleteDoc(B.id, d1.id)) && (await s.updateDoc(B.id, d1.id, { expires: add(1) })) === null);
  // invitație anulată
  const inv = await s.createInvite(A.id, "Vasile", null);
  ok("invitație anulată (doar în firma ei)", !(await s.revokeInvite(B.id, inv.id)) && (await s.revokeInvite(A.id, inv.id)) && !!(await s.invite(A.id, inv.id))?.revokedAt);
  await pool.end();
}
console.log(fail ? `smoke:docs: ${fail} FAIL` : "smoke:docs: toate PASS");
process.exit(fail ? 1 : 0);

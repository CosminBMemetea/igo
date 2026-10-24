// smoke:speed — speed-limit warnings: pure logic, driver alert rate-limit, ranking, store (memory + local Postgres),
// owner notification dedupe and tenant isolation. Postgres only via local TEST_DATABASE_URL.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MemStore } from "../src/lib/store/mem";
import type { Store } from "../src/lib/store/types";
import { SPEED_DEFAULTS, estimateKmh, parseSpeedSettings, speedStep, driverAlert, speedRanking, speedExposure, speedCsv, limitFor, speedParts, bucharestDay, csvCell, SPEED_CSV_HEAD, type SpeedEventRow, type SpeedSample } from "../src/lib/speed";
import { recordSpeed, retrySpeedAlerts, NOTIFY_MAX_ATTEMPTS, NOTIFY_BACKOFF_S } from "../src/lib/speed-service";
import { speedReport, isoLocal } from "../src/lib/speed-report";
import { completedDay } from "../src/lib/trip-stage";
import { driverAlert as nativeAlert } from "../apps/driver/src/speed-logic";
import { decide } from "../src/lib/access";
import { rankings } from "../src/lib/ranking";
import { readFileSync } from "node:fs";

// ---- settings parsing
const cfg = parseSpeedSettings({ limit: "85", over: "10", after: "60", alerts: "on", trucks: { t1: "80", t2: "" } }, ["t1", "t2"])!;
assert.equal(parseSpeedSettings({ limit: "85", over: "10", after: "60", trucks: { foreign: "70" } }, ["t1"]), null, "foreign truck id rejected");
assert.equal(cfg.limitKmh, 85); assert.deepEqual(cfg.truckLimits, { t1: 80 }); assert.equal(limitFor(cfg, "t1"), 80); assert.equal(limitFor(cfg, "t2"), 85);
assert.equal(parseSpeedSettings({ limit: "5" }, []), null); assert.equal(parseSpeedSettings({ limit: "400" }, []), null);
assert.equal(SPEED_DEFAULTS.limitKmh, 90);
// strict integer parser (review MINOR)
assert.ok(parseSpeedSettings({ limit: "90", over: "10", after: "60" }, []));
for (const bad of ["9e1", "0x5A", " 90", "90 ", "090", "90.0", "+90", "", "1e2"]) assert.equal(parseSpeedSettings({ limit: bad, over: "10", after: "60" }, []), null, `limit ${JSON.stringify(bad)} rejected`);
assert.equal(parseSpeedSettings({ limit: 90.5 }, []), null); assert.equal(parseSpeedSettings({ limit: 90, over: "10", after: "60" }, [])!.limitKmh, 90, "numeric integer accepted");
// ---- estimation: native speed first, implausible jumps rejected, noisy fixes rejected
const at = (s: number) => new Date(Date.parse("2026-10-20T08:00:00Z") + s * 1000).toISOString();
const P = (s: number, lat: number, speedMs?: number | null, accuracy = 8): SpeedSample => ({ at: at(s), lat, lng: 25, accuracy, speedMs });
assert.equal(estimateKmh(P(0, 45, 27.78), null), 100);
assert.equal(estimateKmh(P(10, 45.1, 27.78), P(0, 45)), null, "11 km in 10 s is a GPS jump");
assert.equal(estimateKmh(P(0, 45, 30, 80), null), null, "inaccurate native speed ignored without previous point");
const est = estimateKmh(P(30, 45 + 0.0075), P(0, 45))!; assert.ok(est > 95 && est < 100, `estimated ${est}`);
assert.equal(estimateKmh(P(30, 45.0075, null, 120), P(0, 45)), null);
assert.equal(estimateKmh(P(0, 45, 60), null), null, "216 km/h is implausible");
// ---- event lifecycle
let n = 0; const id = () => `e${++n}`;
const c90 = { ...SPEED_DEFAULTS };
let open: SpeedEventRow | null = null, notified = 0;
const feed = (s: number, kmh: number | null) => { const r = speedStep(open, P(s, 45), kmh, c90, "t", "u", id); notified += r.notify ? 1 : 0; const o = r.save.find(e => e.open) ?? null; open = o; return r; };
feed(0, 92); assert.equal(open, null, "within tolerance");
feed(0, 98); assert.ok(open); feed(30, 99); assert.equal(notified, 0, "+9 is not over +10");
feed(40, 105); feed(70, 104); assert.equal(notified, 0, "30 s high not enough");
feed(101, 106); assert.equal(notified, 1, ">60 s high → owner alert"); feed(130, 120); assert.equal(notified, 1, "once per event");
const closed = feed(140, 80); assert.equal(closed.save[0].open, false); assert.equal(closed.save[0].maxKmh, 120); assert.equal(closed.save[0].durationS, 130); assert.equal(open, null);
// duplicate sample (dt = 0, same capturedAt) is ignored, not double-counted (review MINOR)
open = null; feed(0, 100); const o1 = open as SpeedEventRow | null; const dup = feed(0, 130); assert.equal(dup.save.length, 0, "dt=0 ignored"); open = o1; assert.equal(open!.maxKmh, 100); assert.equal(open!.samples, 1);
// grace: a short dip below +10 does not reset the 60 s timer; a long one does (review MINOR)
open = null; notified = 0; feed(0, 105); feed(30, 105); feed(35, 98); feed(40, 105); feed(65, 105);
assert.equal(open!.highS, 55, "dip inside the grace window keeps the run but its time is not counted (30 + 25)"); assert.equal(notified, 0);
feed(75, 105); assert.equal(notified, 1, "5 s dip kept the timer");
open = null; notified = 0; feed(0, 105); feed(30, 105); feed(50, 98); feed(60, 105); feed(95, 105); assert.equal(notified, 0, "20 s dip resets the timer"); assert.equal(open!.highS, 35);
// dip longer than the grace window, even when the low reading came early: resume 15 s after the last high reading starts a fresh run
open = null; notified = 0; feed(0, 105); feed(50, 105); feed(52, 98); feed(65, 105); assert.equal(open!.highS, 0, "dip > 10 s resets far-over time"); feed(120, 105); assert.equal(notified, 0); feed(126, 105); assert.equal(notified, 1);
// one owner alert per event, even after a reset and a second long run
feed(140, 98); feed(160, 105); feed(240, 105); assert.equal(notified, 1, "notify once per event");
// a long reading gap without dips counts as high (no evidence of a dip)
open = null; notified = 0; feed(0, 105); feed(61, 105); assert.equal(notified, 1);
open = null; feed(0, 100); const drop = feed(200, 100); assert.equal(drop.drop.length, 1, "single-sample event dropped after gap");
// ---- driver alert (web lib and native copy agree)
for (const fn of [driverAlert, nativeAlert]) {
  let st = { overSince: null as number | null, lastAlert: null as number | null }; const seen: number[] = [];
  for (const [t, k] of [[0, 100], [3000, 100], [6000, 100], [60000, 100], [130000, 100], [131000, 80], [135000, 100], [141000, 100]] as const) {
    const r = fn(st, k, 90, t); st = r.st; if (r.alert) seen.push(t);
  }
  assert.deepEqual(seen, [6000, 130000], "hold 5 s, then max once per 120 s; dropping below resets hold but not rate limit");
  assert.equal(fn({ overSince: 0, lastAlert: null }, 200, 90, 10000).alert, false, "implausible speed never alerts");
}
// ---- exposure + ranking: only finished trips, days in Europe/Bucharest (review MAJOR 2 + MINOR)
assert.equal(speedExposure([], 100, 3600), null, "under 300 km → no score");
assert.equal(bucharestDay("2026-09-30T21:30:00Z"), "2026-10-01");
const D = (h: string) => `2026-10-10T${h}:00:00Z`;
const trips = [
  { driverId: "a", truckId: "t1", km: 500, date: "2026-10-10", deliveredAt: D("12") },
  { driverId: "a", truckId: "t1", km: 700, date: "2026-10-10", planned: true, loadedAt: D("08") }, // started, not finished
  { driverId: "a", truckId: "t1", km: 200, date: "2026-10-05" }, // manual trip marked done without a delivery time → counts on its date (same as the fuel score)
  { driverId: "a", truckId: "t1", km: 900, date: "2026-10-11", deliveredAt: D("13"), cancelledAt: "x" },
  { driverId: "a", truckId: "t1", km: 800, date: "2026-10-12", planned: true, deliveredAt: D("14") },
  { driverId: "a", truckId: "t1", km: 100, date: "2026-09-30", deliveredAt: "2026-09-30T21:30:00Z" }, // Oct 1 in Bucharest → counts
  { driverId: "b", truckId: "t2", km: 50, date: "2026-10-10", deliveredAt: D("12") },
];
const evs = [{ userId: "a", truckId: "t1", durationS: 60, open: false, samples: 3, startAt: "2026-09-30T22:00:00Z" }, { userId: "a", truckId: "t1", durationS: 60, open: false, samples: 3, startAt: "2026-09-30T20:00:00Z" }] as SpeedEventRow[];
const rk = speedRanking([{ id: "a", name: "A" }, { id: "b", name: "B" }], trips, evs, "2026-10-01");
const ra = rk.find(r => r.id === "a")!;
assert.equal(ra.km, 800, "only finished, non-cancelled, non-planned km; Bucharest day"); assert.equal(ra.ex!.events, 1, "event on Sep 30 Bucharest excluded, 01:00 Oct 1 included"); assert.equal(rk.find(r => r.id === "b"), undefined, "50 km is not enough data");
// ---- real-firm score uses the speed part with weight 15 (review MAJOR 4)
const sp = speedParts(trips, evs, "2026-10-01"); assert.deepEqual(Object.keys(sp), ["t1"], "t2 under 300 km gets no part"); const ex1 = speedExposure([evs[0]], 800, 0)!;
assert.deepEqual(sp.t1, { part: ex1.score / 100, per100: ex1.per100, events: 1, km: 800 });
const veh = [{ id: "t1", name: "T1", kind: "truck", per100: true, baselineRate: 30, driver: "A" }] as never[], views = [{ vehicleId: "t1", km: 600, actualRate: 30, date: "2026-10-10", active: false }] as never[];
const zero = { part: 0, per100: 4.2, events: 25, km: 600 };
const r0 = rankings(veh, views, [], "2026-10-20", false).drivers[0], r1 = rankings(veh, views, [], "2026-10-20", false, { t1: zero }).drivers[0];
assert.equal(r0.parts.speed, undefined); assert.equal(r0.speedPer100, null); assert.equal(r1.parts.speed, 0); assert.equal(r1.speedPer100, 4.2, "per-100 km value shown on /ranking");
assert.equal(r1.score, Math.round(((35 * r1.parts.cons! + 10 * r1.parts.alerts!) / (35 + 15 + 10)) * 100), "speed counts with weight 15");
assert.equal(rankings(veh, views, [], "2026-10-20", true, { t1: zero }).drivers[0].parts.speed !== 0, true, "demo keeps its own sample speed part");
// ---- one finished-trip definition for fuel and speed (Testing MUST-FIX A)
const vw = (x: object) => ({ vehicleId: "t1", km: 400, actualRate: 30, date: "2026-10-10", active: false, ...x }) as never;
assert.equal(completedDay(vw({})), "2026-10-10"); assert.equal(completedDay(vw({ cancelledAt: "x" })), null, "cancelled is not finished"); assert.equal(completedDay(vw({ active: true })), null);
assert.equal(completedDay(vw({ deliveredAt: "2026-10-11T22:30:00Z" })), "2026-10-12", "delivery day in Bucharest");
const rc = rankings(veh, [vw({}), vw({ cancelledAt: "x", actualRate: 90 })], [], "2026-10-20", false).drivers[0]; assert.equal(rc.km, 400, "fuel score skips cancelled trips"); assert.equal(rc.l100, 30);
// ---- CSV: numeric negatives stay numbers, text injection neutralised, localized headers with zone (review MINOR)
assert.equal(csvCell(-25.123), "-25.123"); assert.equal(csvCell("-25.123456"), "-25.123456"); assert.equal(csvCell("-cmd"), `"'-cmd"`); assert.equal(csvCell("=1+1"), `"'=1+1"`); assert.equal(csvCell("@x"), `"'@x"`);
const csvRow = { plate: "B 1 QRT", driver: 'Ion "X"', e: { ...closed.save[0], lng: -3.7038, lat: 40.4168 } };
const csvRo = speedCsv([csvRow], x => x, "ro"); assert.ok(csvRo.includes('"Ion ""X"""')); assert.ok(csvRo.includes("-3.7") && !csvRo.includes("'-3"), "negative longitude not prefixed");
for (const l of ["ro", "en", "pl"] as const) { const h = speedCsv([], x => x, l).split(/\r?\n/)[0]; assert.ok(h.startsWith(SPEED_CSV_HEAD[l][0]) && /României|Romania|Rumunii/.test(h), `${l} header`); }
assert.notEqual(SPEED_CSV_HEAD.ro[0], SPEED_CSV_HEAD.en[0]); assert.notEqual(SPEED_CSV_HEAD.en[0], SPEED_CSV_HEAD.pl[0]);
// ---- source guards: live banner, demo VITEZĂ column, real score wired, CSV locale (review MAJOR 3, 4, MINOR)
const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
for (const [p, re] of [["src/components/DriverTracking.tsx", /setSpeedWarn\(\{[^}]*\}\);[^\n]*\n\s*if \(!r\.alert\) return;/], ["apps/driver/src/speed-alert.ts", /write\("speed-warning", warning\);[^\n]*\n\s*if \(!r\.alert\) return;/]] as const)
  assert.match(src(p), re, `${p}: banner updates on every over reading, only effects throttled`);
const rp = src("src/app/ranking/page.tsx"); assert.match(rp, /COLS: Comp\[\] = \[[^\]]*"speed"/); assert.match(rp, /d\.demo && R\.telematics/); assert.match(rp, /Exemplu demo/); assert.match(rp, /DemoBadge/);
for (const p of ["src/app/ranking/page.tsx", "src/app/feed/page.tsx", "src/app/page.tsx"]) assert.match(src(p), /rankings\([^\n]*await realSpeedParts\(store\(\), d\.tn\.firm\?\.id, d\.demo\)\)/, `${p}: real speed part wired`);
assert.match(src("src/app/api/speeding/csv/route.ts"), /speedCsv\(rows, isoLocal, loc\)/);
// CSV time = Romania local time with its UTC offset; 03:00–04:00 on 25 Oct 2026 happens twice (Testing E)
assert.equal(isoLocal("2026-10-25T00:30:00Z"), "2026-10-25T03:30:00+03:00"); assert.equal(isoLocal("2026-10-25T01:30:00Z"), "2026-10-25T03:30:00+02:00");
assert.equal(isoLocal("2026-03-29T00:59:59Z"), "2026-03-29T02:59:59+02:00"); assert.equal(isoLocal("2026-03-29T01:00:00Z"), "2026-03-29T04:00:00+03:00"); assert.equal(isoLocal("2026-12-31T22:00:00.500Z"), "2027-01-01T00:00:00+02:00");
assert.match(src("src/app/ranking/page.tsx"), /t\(loc, "rk\.subReal"\)/, "real-firm score subtitle reachable");
assert.match(src("src/app/ranking/page.tsx"), /x\.speedPer100/, "real-firm speed component shown");
assert.match(src("src/app/speeding/page.tsx"), /\\u00a0/, "durations use non-breaking spaces");
const vj = JSON.parse(src("vercel.json")) as { crons: { path: string; schedule: string }[] }; const cj = vj.crons.find(c => c.path === "/api/cron/speed-alerts");
assert.ok(cj && /^\d+ \d+ \* \* \*$/.test(cj.schedule), "daily speed-alert retry cron (Hobby: once per day)");
// cron route refuses without CRON_SECRET or with a wrong bearer
{ const { GET } = await import("../src/app/api/cron/speed-alerts/route"), saved = process.env.CRON_SECRET; const call = (h?: string) => GET(new Request("http://x/api/cron/speed-alerts", { headers: h ? { authorization: h } : {} }));
  delete process.env.CRON_SECRET; assert.equal((await call("Bearer undefined")).status, 401); assert.equal((await call()).status, 401, "no CRON_SECRET → refuse");
  process.env.CRON_SECRET = "qa-speed-cron-secret-32-characters-x"; assert.equal((await call("Bearer bad")).status, 401); assert.equal((await call()).status, 401);
  const savedDb = process.env.DATABASE_URL; delete process.env.DATABASE_URL; const ok = await call("Bearer qa-speed-cron-secret-32-characters-x"); assert.equal(ok.status, 200); assert.equal((await ok.json()).skipped, "no database");
  if (savedDb) process.env.DATABASE_URL = savedDb; if (saved) process.env.CRON_SECRET = saved; else delete process.env.CRON_SECRET; }
// ---- routes: driver cannot reach owner speed pages/APIs
for (const p of ["/speeding", "/api/speeding/csv", "/api/settings/speed"]) {
  assert.notEqual(decide(p, { role: "driver", firmId: "f", userId: "u" } as never).kind, "allow", `driver blocked from ${p}`);
  assert.equal(decide(p, null).kind === "allow", false, `anon blocked from ${p}`);
}

async function storeChecks(s: Store, label: string) {
  const f = await s.createFirm({ name: "Speed QA " + randomUUID().slice(0, 6), cui: null }), g = await s.createFirm({ name: "Speed QA other " + randomUUID().slice(0, 6), cui: null });
  try {
    const t = await s.addTruck(f.id, { plate: "SP 01 QRT", vin: null, model: null, tankL: null, normalL100: null });
    const tg = await s.addTruck(g.id, { plate: "SP 02 QRT", vin: null, model: null, tankL: null, normalL100: null });
    const owner = await s.createUser({ firmId: f.id, role: "owner", name: "Owner", email: `o-${randomUUID()}@example.test`, phone: null, passwordHash: "qa" });
    const driver = await s.createUser({ firmId: f.id, role: "driver", name: "Driver", email: null, phone: null, passwordHash: "qa" });
    assert.deepEqual(await s.speedSettings(f.id), SPEED_DEFAULTS);
    await s.setSpeedSettings(f.id, { ...SPEED_DEFAULTS, limitKmh: 85, truckLimits: { [t.id]: 80 } });
    assert.equal((await s.speedSettings(f.id)).truckLimits[t.id], 80); assert.equal((await s.speedSettings(g.id)).limitKmh, 90, `${label}: settings isolated`);
    const now = Date.now(), base = now - 200_000; let queuedAny = false;
    for (let i = 0; i <= 8; i++) {
      const at = new Date(base + i * 20_000).toISOString(), sample = { at, lat: 45 + i * 0.005, lng: 25, accuracy: 8, speedMs: 27.8 };
      await s.addPosition(f.id, { truckId: t.id, at: at.slice(0, 16), capturedAt: at, lat: sample.lat, lng: sample.lng, accuracy: 8 });
      const r = await recordSpeed(s, f.id, driver.id, t.id, sample, base + i * 20_000);
      assert.equal(r.limit, 80); queuedAny ||= r.queued;
    }
    assert.ok(queuedAny, `${label}: owner alert queued`);
    const ev = await s.speedEvents(f.id, {}); assert.equal(ev.length, 1); assert.ok(ev[0].ownerNotified); assert.equal(ev[0].userId, driver.id);
    const mails = (await s.emails(500)).filter(m => m.firmId === f.id);
    assert.equal(mails.filter(m => m.channel !== "push" && m.to === owner.email).length, 1, `${label}: one email`);
    assert.ok(mails[0].body.toLowerCase().includes("limit"), "body mentions limit");
    assert.ok(!/amend|fine|mandat/i.test(mails.map(m => m.body).join(" ").replace(/nu garantează evitarea amenzilor|does not guarantee you avoid fines|nie gwarantuje uniknięcia mandatów/gi, "")), "no fine-prevention promise");
    assert.equal((await s.notifications(f.id, null)).filter(x => x.kind === "speeding").length, 1);
    // second event soon after → recorded, owner not notified again (dedupe)
    const b2 = base + 400_000;
    for (let i = 0; i <= 8; i++) { const at = new Date(b2 + i * 20_000).toISOString(); await s.addPosition(f.id, { truckId: t.id, at: at.slice(0, 16), capturedAt: at, lat: 46 + i * 0.005, lng: 25, accuracy: 8 }); await recordSpeed(s, f.id, driver.id, t.id, { at, lat: 46 + i * 0.005, lng: 25, accuracy: 8, speedMs: 27.8 }, b2 + i * 20_000); }
    assert.equal((await s.speedEvents(f.id, {})).length, 2); assert.equal((await s.emails(500)).filter(m => m.firmId === f.id && m.channel !== "push").length, 1, `${label}: dedupe`);
    // isolation
    assert.equal((await s.speedEvents(g.id, {})).length, 0, `${label}: other firm sees nothing`);
    assert.equal((await s.speedEvents(g.id, { truckId: t.id })).length, 0);
    assert.equal(await s.openSpeedEvent(g.id, t.id), null);
    await assert.rejects(s.saveSpeedEvent(g.id, { ...ev[0], maxKmh: 1 }), Error, `${label}: cannot overwrite foreign event`);
    await s.deleteSpeedEvent(g.id, ev[0].id); assert.equal((await s.speedEvents(f.id, {})).length, 2, `${label}: cannot delete foreign event`);
    assert.equal((await speedReport(s, g.id, { days: 90, truckId: t.id, userId: "" })).rows.length, 0);
    void tg;
    // retention
    assert.ok(await s.purgeSpeedEvents(new Date(now + 3600_000).toISOString()) >= 2); assert.equal((await s.speedEvents(f.id, {})).length, 0);
    await concurrentReadings(s, f.id, driver.id, owner.email!, label);
    await badAppUrl(s, f.id, driver.id, owner.email!, label);
    if (label === "memory") await failingChannel(s as MemStore, f.id, t.id, driver.id, owner.email!);
    console.log(`PASS ${label}: settings, events, owner alert + dedupe, isolation, retention`);
  } finally { await s.deleteFirm(f.id).catch(() => {}); await s.deleteFirm(g.id).catch(() => {}); }
}
const drive = async (s: Store, firmId: string, userId: string, truckId: string, b: number, i: number, kmh = 100, lat0 = 48) => {
  const at = new Date(b + i * 20_000).toISOString(), lat = lat0 + i * 0.005 * kmh / 100;
  await s.addPosition(firmId, { truckId, at: at.slice(0, 16), capturedAt: at, lat, lng: 25, accuracy: 8 });
  return recordSpeed(s, firmId, userId, truckId, { at, lat, lng: 25, accuracy: 8, speedMs: kmh / 3.6 }, b + i * 20_000);
};
/** Testing C: two readings processed at the same time must not double-send (idempotent keys per event/owner). */
async function concurrentReadings(s: Store, firmId: string, userId: string, ownerEmail: string, label: string) {
  const t = await s.addTruck(firmId, { plate: "SP 03 QRT", vin: null, model: null, tankL: null, normalL100: null }), b = Date.now() - 100_000;
  for (let i = 0; i <= 3; i++) await drive(s, firmId, userId, t.id, b, i); // 60 s high: not yet over 60
  const at4 = new Date(b + 80_000).toISOString(), at5 = new Date(b + 81_000).toISOString();
  await s.addPosition(firmId, { truckId: t.id, at: at4.slice(0, 16), capturedAt: at4, lat: 48.02, lng: 25, accuracy: 8 }); await s.addPosition(firmId, { truckId: t.id, at: at5.slice(0, 16), capturedAt: at5, lat: 48.0203, lng: 25, accuracy: 8 });
  const rs = await Promise.all([recordSpeed(s, firmId, userId, t.id, { at: at4, lat: 48.02, lng: 25, accuracy: 8, speedMs: 27.8 }, b + 80_000), recordSpeed(s, firmId, userId, t.id, { at: at5, lat: 48.0203, lng: 25, accuracy: 8, speedMs: 27.8 }, b + 81_000)]);
  assert.ok(rs.some(r => r.notify), `${label}: concurrent readings crossed the threshold`);
  const ev = (await s.speedEvents(firmId, { truckId: t.id })); assert.equal(ev.length, 1); assert.ok(ev[0].ownerNotified);
  assert.equal((await s.emails(500)).filter(m => m.firmId === firmId && m.channel !== "push" && m.to === ownerEmail && m.body.includes("SP 03 QRT")).length, 1, `${label}: concurrent readings → one email`);
  assert.equal((await s.notifications(firmId, null)).filter(x => x.kind === "speeding" && (x.params as { eventId?: string }).eventId === ev[0].id).length, 1, `${label}: concurrent readings → one inbox entry`);
}
/** Testing B: a bad APP_URL blocks only the email (it carries the link); the in-app inbox is still written; email retried later. */
async function badAppUrl(s: Store, firmId: string, userId: string, ownerEmail: string, label: string) {
  const t = await s.addTruck(firmId, { plate: "SP 04 QRT", vin: null, model: null, tankL: null, normalL100: null }), b = Date.now() - 200_000, saved = process.env.APP_URL;
  const errs: string[] = [], ce = console.error; console.error = (...a: unknown[]) => { errs.push(a.map(String).join(" ")); };
  try {
    process.env.APP_URL = "http://insecure.example";
    for (let i = 0; i <= 6; i++) await drive(s, firmId, userId, t.id, b, i); // notify at i=4 (80 s), retry not due at i=5 (+20 s < 30 s), due at i=6 (+40 s)
  } finally { console.error = ce; if (saved === undefined) delete process.env.APP_URL; else process.env.APP_URL = saved; }
  const [ev] = await s.speedEvents(firmId, { truckId: t.id });
  assert.equal(ev.ownerNotified, false); assert.equal(ev.notifyAttempts, 2, `${label}: backoff: one attempt at the threshold, the next only when due`);
  assert.equal(errs.filter(x => x.includes("speed notify failed")).length, 2, `${label}: one log line per attempt, not per reading`); assert.ok(errs.some(x => x.includes(`event=${ev.id}`) && x.includes("APP_URL")));
  assert.ok(ev.notifyDone!.includes("inbox"), `${label}: inbox not blocked by APP_URL`); assert.equal((await s.notifications(firmId, null)).filter(x => (x.params as { eventId?: string }).eventId === ev.id).length, 1);
  const mails = async () => (await s.emails(500)).filter(m => m.firmId === firmId && m.channel !== "push" && m.to === ownerEmail && m.body.includes("SP 04 QRT")).length;
  assert.equal(await mails(), 0);
  // cron pass after APP_URL is fixed (event may already be closed)
  const r = await retrySpeedAlerts(s, b + 6 * 20_000 + NOTIFY_BACKOFF_S[1] * 1000 + 1000); assert.ok(r.processed >= 1 && r.failed === 0, `${label}: cron retry ${JSON.stringify(r)}`);
  assert.equal(await mails(), 1); const [ev2] = await s.speedEvents(firmId, { truckId: t.id }); assert.ok(ev2.ownerNotified); assert.equal((await s.notifications(firmId, null)).filter(x => (x.params as { eventId?: string }).eventId === ev.id).length, 1, `${label}: no duplicate inbox entry`);
}
/** Review MAJOR 1: a throwing channel leaves the event unflagged; the next reading retries; idempotent keys avoid duplicates. */
async function failingChannel(s: MemStore, firmId: string, truckId: string, userId: string, ownerEmail: string) {
  let fail = true; const flaky = new Proxy(s, { get(o, k, r) { const v = Reflect.get(o, k, r); return k === "addNotifications" ? async (...a: unknown[]) => { if (fail) throw new Error("inbox down"); return (v as (...x: unknown[]) => unknown).apply(o, a); } : typeof v === "function" ? v.bind(o) : v; } }) as Store;
  const b = Date.now() + 3 * 3600_000; let last = null as Awaited<ReturnType<typeof recordSpeed>> | null;
  const step = async (i: number) => { const at = new Date(b + i * 20_000).toISOString(); await s.addPosition(firmId, { truckId, at: at.slice(0, 16), capturedAt: at, lat: 47 + i * 0.005, lng: 25, accuracy: 8 }); last = await recordSpeed(flaky, firmId, userId, truckId, { at, lat: 47 + i * 0.005, lng: 25, accuracy: 8, speedMs: 27.8 }, b + i * 20_000); };
  const mails = async () => (await s.emails(500)).filter(m => m.firmId === firmId && m.channel !== "push" && m.to === ownerEmail).length, before = await mails();
  const ce = console.error; let logs = 0; console.error = (...a: unknown[]) => { if (String(a[0]).includes("speed notify failed")) logs++; else ce(...a); };
  try {
    for (let i = 0; i <= 5; i++) await step(i);
    const ev = (await s.speedEvents(firmId, {})).find(e => e.open)!; assert.ok(ev.highS > 60, "high long enough");
    assert.equal(ev.ownerNotified, false, "failed channel → event stays unflagged");
    assert.equal(await mails(), before + 1, "other channels still queued (email not blocked by inbox failure)");
    assert.equal(logs, 1, "reading 20 s later is inside the 30 s backoff: no new attempt, no new log");
    fail = false; await step(6);
    assert.equal((await s.speedEvents(firmId, {})).find(e => e.id === ev.id)!.ownerNotified, true, "retry on the next due reading succeeds");
    assert.equal(await mails(), before + 1, "idempotent key: no duplicate email on retry");
    await step(7); assert.equal(await mails(), before + 1);
    // failure outlasting the episode: event closes unsent, the cron pass delivers it later
    fail = true; const b2 = b + 6 * 3600_000;
    const go = async (i: number, kmh: number) => { const at = new Date(b2 + i * 20_000).toISOString(), lat = 49 + i * 0.005 * kmh / 100; await s.addPosition(firmId, { truckId, at: at.slice(0, 16), capturedAt: at, lat, lng: 25, accuracy: 8 }); await recordSpeed(flaky, firmId, userId, truckId, { at, lat, lng: 25, accuracy: 8, speedMs: kmh / 3.6 }, b2 + i * 20_000); };
    for (let i = 0; i <= 5; i++) await go(i, 100); await go(6, 60);
    const e2 = (await s.speedEvents(firmId, {})).find(e => e.startAt === new Date(b2).toISOString())!; assert.equal(e2.open, false); assert.equal(e2.ownerNotified, false); assert.ok(e2.notifyDue);
    fail = false; const cr = await retrySpeedAlerts(flaky, b2 + 3600_000); assert.equal(cr.failed, 0); assert.ok((await s.speedEvents(firmId, {})).find(e => e.id === e2.id)!.ownerNotified, "closed, unsent event delivered by the cron pass");
    // a permanent failure stops after NOTIFY_MAX_ATTEMPTS
    fail = true; const b3 = b + 12 * 3600_000;
    const go3 = async (i: number) => { const at = new Date(b3 + i * 20_000).toISOString(), lat = 50 + i * 0.005; await s.addPosition(firmId, { truckId, at: at.slice(0, 16), capturedAt: at, lat, lng: 25, accuracy: 8 }); await recordSpeed(flaky, firmId, userId, truckId, { at, lat, lng: 25, accuracy: 8, speedMs: 27.8 }, b3 + i * 20_000); };
    for (let i = 0; i <= 5; i++) await go3(i);
    for (let d = 1; d <= NOTIFY_MAX_ATTEMPTS + 3; d++) await retrySpeedAlerts(flaky, b3 + d * 86400_000);
    const e3 = (await s.speedEvents(firmId, {})).find(e => e.startAt === new Date(b3).toISOString())!; assert.equal(e3.notifyAttempts, NOTIFY_MAX_ATTEMPTS); assert.equal(e3.ownerNotified, false);
    assert.equal((await s.pendingSpeedNotifications({ dueAt: new Date(b3 + 99 * 86400_000).toISOString(), maxAttempts: NOTIFY_MAX_ATTEMPTS, limit: 10 })).length, 0, "gives up after max attempts");
  } finally { console.error = ce; }
}
await storeChecks(new MemStore(), "memory");
if (process.env.TEST_DATABASE_URL) {
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.TEST_DATABASE_URL)) throw new Error("smoke:speed: TEST_DATABASE_URL must be local");
  const { default: pg } = await import("pg"), { drizzle } = await import("drizzle-orm/node-postgres"), { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const schema = await import("../src/db/schema"), { PgStore } = await import("../src/lib/store/pg");
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 1 }); // PGlite socket serves one connection
  try { await migrate(drizzle(pool), { migrationsFolder: "drizzle" }); await storeChecks(new PgStore(drizzle(pool, { schema })), "postgres"); } finally { await pool.end(); }
} else console.log("SKIP Postgres: TEST_DATABASE_URL unavailable");
console.log("PASS smoke:speed logic");

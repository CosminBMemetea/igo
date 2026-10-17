import assert from "node:assert/strict";
import { dayReplayWindow, tripReplayWindow, windowPositions } from "../src/lib/truck-history";
import { firmReplay } from "../src/lib/replay";
import type { PosRow, FuelTxRow } from "../src/lib/store/types";
const now = new Date("2026-10-19T12:00:00Z");
const base = { date: "2026-10-17", active: true, planned: true };
assert.equal(tripReplayWindow(base, now), null);
assert.equal(tripReplayWindow({ ...base, cancelledAt: now.toISOString() }, now), null);
assert.equal(tripReplayWindow({ ...base, loadedAt: "invalid" }, now), null);
assert.equal(tripReplayWindow({ ...base, active: false, planned: false }, now)?.kind, "day");
assert.equal(dayReplayWindow("2026-02-31"), null);
assert.equal(dayReplayWindow("2026-12-31")?.until, "2027-01-01T00:00");
const first = tripReplayWindow({ ...base, loadedAt: "2026-10-17T05:00:00Z", deliveredAt: "2026-10-17T06:00:00Z" }, now)!;
const second = tripReplayWindow({ ...base, loadedAt: "2026-10-17T06:00:00Z", deliveredAt: "2026-10-17T07:00:00Z" }, now)!;
assert.equal(first.from, "2026-10-17T08:00"); assert.equal(first.until, "2026-10-17T09:00");
const point = (at: string, lat = 46, truckId = "t"): PosRow => ({ truckId, at, lat, lng: 22 });
const pos = [point("2026-10-17T07:59"), point("2026-10-17T08:00"), point("2026-10-17T08:10", 46.01), point("2026-10-17T09:00", 47), point("2026-10-17T09:10", 47.01), point("2026-10-17T10:00", 48), point("2026-10-17T08:05", 50, "foreign")];
const a = windowPositions(pos, "t", first), b = windowPositions(pos, "t", second);
assert.deepEqual(a.map(p => p.at), ["2026-10-17T08:00", "2026-10-17T08:10"]);
assert.equal(a.some(p => b.includes(p)), false);
assert.equal(windowPositions([...a, a[0], point("2026-10-17T08:00:00"), point("2026-10-17T08:05", 100)], "t", first).length, 2);
console.log("PASS same-day trips isolated at their boundaries; duplicate times, other trucks and invalid coordinates excluded");
const crossing = tripReplayWindow({ ...base, loadedAt: "2026-10-17T20:50:00Z", deliveredAt: "2026-10-17T21:20:00Z" }, now)!;
const night = [point("2026-10-17T23:50"), point("2026-10-18T00:00", 46.01), point("2026-10-18T00:10", 46.02), point("2026-10-18T00:20", 46.03)];
const fuel = ["2026-10-17T20:00", "2026-10-18T00:05", "2026-10-18T01:00"].map((at, i) => ({ truckId: "t", at, station: "Fuel " + i, litres: 100 })) as FuelTxRow[];
const replay = firmReplay({ vehicleId: "t", plate: "TEST", driver: "Historical driver", date: crossing.date, tripId: "trip", route: "A → B", rate: 30, pos: night, fuel, window: crossing })!;
assert.ok(replay); assert.equal(replay.keys.length, 3); assert.equal(replay.start, 1430); assert.equal(replay.end, 1450);
assert.equal(replay.events.filter(e => e.kind === "fuel").length, 1);
assert.equal(replay.route, "A → B"); assert.equal(replay.driver, "Historical driver");
assert.ok(replay.events.every(e => e.min >= replay.start && e.min <= replay.end));
assert.equal(firmReplay({ vehicleId: "t", plate: "TEST", driver: "", date: first.date, tripId: "trip", rate: 30, pos: [a[0], a[0]], fuel: [], window: first }), null);
console.log("PASS multi-day GPS timeline and fuel interval; insufficient distinct positions rejected");
console.log("PASS planned/cancelled trips have no replay; legacy trips explicitly use day scope; strict date boundaries");

// Romania repeats 03:00 at the autumn DST change; UTC fixes remain distinct.
const dst = tripReplayWindow({ ...base, date: "2026-10-25", loadedAt: "2026-10-25T00:30:00Z", deliveredAt: "2026-10-25T01:30:00Z" }, new Date("2026-10-26T00:00:00Z"))!;
assert.ok(dst);
const dstPoints = [
  { ...point("2026-10-25T03:40"), capturedAt: "2026-10-25T00:40:00Z" },
  { ...point("2026-10-25T03:10", 46.01), capturedAt: "2026-10-25T01:10:00Z" },
  { ...point("2026-10-25T03:40", 46.02), capturedAt: "2026-10-25T01:40:00Z" },
];
assert.deepEqual(windowPositions(dstPoints, "t", dst), dstPoints.slice(0,2));
const dstReplay = firmReplay({ vehicleId: "t", plate: "DST", driver: "", date: dst.date, tripId: "dst", rate: 30, pos: dstPoints, fuel: [], window: dst })!;
assert.equal(dstReplay.end - dstReplay.start, 30);
assert.ok(dstReplay.clockOrigin);
const precise = [0, 1].map(i => ({ ...point("2026-10-17T08:00", 46 + i / 100), capturedAt: `2026-10-17T05:00:0${i}Z` }));
assert.equal(windowPositions(precise, "t", first).length, 2);
console.log("PASS UTC: repeated DST hour, reversed local bounds and distinct second-level fixes");

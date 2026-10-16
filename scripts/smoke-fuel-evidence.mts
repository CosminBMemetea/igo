import assert from "node:assert/strict";
import { firmFuelAlerts, fillToFill, type RTx, type RTruck, type RPos } from "../src/lib/fuel/rules";
import { computeAlerts, whyText } from "../src/lib/fleet/rules";
import { TRUCKS } from "../src/lib/fleet/data";
import { DemoRepository } from "../src/lib/repo";
import { economii } from "../src/lib/economii";
import { monthSummary, tripViews } from "../src/lib/query";
import { CATALOGS, LOCALES } from "../src/lib/i18n";
import { FT } from "../src/lib/feed-i18n";
import { FEATURES } from "../src/lib/features";
import { localNow } from "../src/lib/validate";

const test = (name: string, fn: () => void) => { fn(); console.log(`PASS ${name}`); };
const truck: RTruck = { id: "truck", plate: "TEST", tankL: 600, normalL100: 30, baseline: null };
const tx = (id: string, at: string, litres: number, odometer: number | null, more: Partial<RTx> = {}): RTx => ({ id, truckId: truck.id, at, litres, odometer, lat: null, lng: null, station: "Test", card: "001", ...more });
const a = tx("a", "2026-10-05T10:00", 300, 1000);
const b = tx("b", "2026-10-06T10:00", 300, 2000, { lat: 47, lng: 22 });
const far: RPos = { truckId: truck.id, at: "2026-10-06T10:10", lat: 46, lng: 23 };
test("GPS alone cannot produce fuel anomalies", () => assert.deepEqual(firmFuelAlerts([truck], [], [far]), []));
test("missing or stale GPS cannot imply a station mismatch", () => {
  for (const positions of [[], [{ ...far, at: "2026-10-06T10:31" }], [{ ...far, truckId: "other" }]])
    assert(!firmFuelAlerts([truck], [b], positions).some(x => x.rule === "card-fara-camion"));
});
test("station coordinates are required even with GPS", () => assert(!firmFuelAlerts([truck], [{ ...b, lat: null, lng: null }], [far]).some(x => x.rule === "card-fara-camion")));
test("a nearby position prevents a mismatch even when another point is far away", () => assert(!firmFuelAlerts([truck], [b], [far, { ...far, lat: 47, lng: 22, at: "2026-10-06T09:59" }]).some(x => x.rule === "card-fara-camion")));
test("GPS alert exposes the sample timestamp and comparison window in all languages", () => {
  const alert = firmFuelAlerts([truck], [b], [far]).find(x => x.rule === "card-fara-camion")!;
  assert.equal(alert.params.gpsAt, far.at); assert.equal(alert.params.gpsWindowMin, 30);
  for (const loc of LOCALES) { const text = whyText(loc, alert); assert(text.includes("10:10")); assert(text.includes("30")); assert(!/undefined|NaN|\{\w+\}/.test(text)); }
});
test("baseline does not silently drop a fill with missing odometer", () => {
  const middle = tx("missing", "2026-10-05T18:00", 200, null);
  assert.equal(fillToFill([a, middle, b]).l100, null);
  assert.equal(fillToFill([b, a]).l100, 30);
});
test("impossible speed, reverse odometer and mixed trucks cannot form a baseline", () => {
  assert.equal(fillToFill([a, { ...b, at: "2026-10-05T10:10" }]).l100, null);
  assert.equal(fillToFill([a, { ...b, odometer: 900 }]).l100, null);
  assert.equal(fillToFill([a, { ...b, truckId: "other" }]).l100, null);
});
test("tank-drop rule requires an actual sensor flag, even if a level array exists", () => {
  const t = { ...TRUCKS[0], hasLevelSensor: false };
  const data = { trucks: [t], fills: [], levels: { [t.id]: [{ min: 600, levelL: 200, moving: false }, { min: 610, levelL: 100, moving: false }] } };
  assert.equal(computeAlerts(data).length, 0);
  assert(computeAlerts({ ...data, trucks: [{ ...t, hasLevelSensor: true }] }).some(x => x.rule === "scadere-parcat"));
});
const repo = new DemoRepository();
const [vehicles, trips, alerts] = await Promise.all([repo.vehicles(), repo.trips(), repo.alerts()]);
const views = tripViews(trips, vehicles);
test("fuel anomalies, even duplicate alerts, never create financial savings", () => {
  const zero = economii(views, [], vehicles, 15);
  const anomalies = economii(views, [...alerts, ...alerts], vehicles, 15);
  assert.equal(anomalies.total, zero.total); assert.equal(anomalies.total, anomalies.lines.fuel);
  assert.equal(anomalies.anomalyCount, alerts.filter(x => x.theft).length * 2);
  assert(!("theft" in anomalies.lines));
});
test("cancelled trips and prior months do not leak into current savings", () => {
  const base = { ...views.find(x => !x.active)!, vehicle: { ...vehicles[0], real: true }, date: localNow().slice(0, 7) + "-01" };
  const data = [base, { ...base, id: "cancelled", cancelledAt: "2026-10-16T10:00" }, { ...base, id: "old", date: "2020-01-01" }];
  assert.equal(economii(data, [], vehicles, 16).lines.fuel, Math.round(base.s.savedLei));
  assert.equal(economii(data, [], vehicles, 16).lines.fuel, Math.round(monthSummary(data).savings.savedLei));
});
test("copy distinguishes estimates, purchases and review; sensor integration is planned", () => {
  for (const loc of LOCALES) {
    const c = CATALOGS[loc];
    assert(!/consum real|real consumption|rzeczywiste zużycie/i.test(c["login.heroSub"]));
    assert(!/furt|theft|kradzie/i.test(FT[loc].rConfirm));
    assert(c["fuel.manual"] && c["fuel.estimate"] && c["fuel.evidence"] && c["rp.unknownTank"]);
  }
  assert.equal(FEATURES.find(f => f.id === "probe")?.planned, true);
});
console.log("smoke:fuel-evidence OK");

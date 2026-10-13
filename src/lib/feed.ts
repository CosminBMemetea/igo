// „Fluxul flotei”: evenimentele zilei (demo) într-un feed — doar ce contează, cu prioritate.
// Totul derivat determinist din datele demo existente (trasee, opriri, bonuri, alerte, clasament). Nimic scris nicăieri.
import { CITY_CC, CC_CUR, DEMO_LEI_PER, DEMO_NOW_MIN, FILLS, TRUCKS, dayPlan, haversineKm, minToHHMM, nearestWaypoint, pathBetween, pointAtKm, routeTotalKm, type LatLng, type Truck } from "./fleet/data";
import type { Client, Vehicle } from "./fleet/seed";
import type { AppAlert } from "./repo";
import type { LiveVehicle, TripView } from "./query";
import type { DriverRank } from "./ranking";
import { fmtDate, fmtMoney, fmtNum, t, type Locale, type MsgKey } from "./i18n";
import { FT, fill } from "./feed-i18n";

export type Prio = "critical" | "normal" | "positive" | "trivial";
export type Kind = "border" | "fuel" | "idle" | "delivered" | "group" | "doc" | "theft" | "eco" | "rank" | "ontime";
export interface MiniMap { full: string; done: string; dot: [number, number]; w: number; h: number }
export interface FeedEvent {
  id: string; kind: Kind; prio: Prio; min: number | null; when?: string; vehicleId: string; plate: string; driver: string; hue: number; initials: string;
  title: string; sub: string; flag?: string; map?: MiniMap; clap?: boolean;
  cta?: { href: string; label: string; tel?: boolean; note?: string };
  receipt?: { station: string; litres: string; lei: string; orig?: string; time: string };
  plates?: string[]; place?: string;
}
export interface Story { vehicleId: string; driver: string; plate: string; status: LiveVehicle["status"]; hue: number; initials: string; km: number; rate: string; map?: MiniMap; priv: boolean; stops: { kind: keyof typeof FT.ro.st; time: string; place: string }[]; fill?: FeedEvent["receipt"] }

const W = 300, H = 150;
export const hueOf = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
export const initialsOf = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
export const flagOf = (cc: string) => String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
const ccOf = (city: string) => CITY_CC[city] ?? "RO";
const thin = (p: LatLng[], n = 70) => (p.length <= n ? p : Array.from({ length: n }, (_, i) => p[Math.round((i * (p.length - 1)) / (n - 1))]));

/** proiecție simplă (echirectangulară, corectată cu cos(lat)) într-o cutie W×H, cu margine */
function mini(t: Truck, toKm: number, focusKm?: number): MiniMap {
  const half = routeTotalKm(t) / 2, full = thin(pathBetween(t, 0, half)), done = thin(pathBetween(t, 0, Math.min(toKm, half)), 50);
  const k = Math.cos((full[0][0] * Math.PI) / 180);
  const xs = full.map((p) => p[1] * k), ys = full.map((p) => p[0]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), pad = 16;
  const s = Math.min((W - 2 * pad) / (x1 - x0 || 1), (H - 2 * pad) / (y1 - y0 || 1));
  const ox = (W - (x1 - x0) * s) / 2, oy = (H - (y1 - y0) * s) / 2;
  const P = (p: LatLng): [number, number] => [Math.round((ox + (p[1] * k - x0) * s) * 10) / 10, Math.round((oy + (y1 - p[0]) * s) * 10) / 10];
  const d = (pts: LatLng[]) => pts.map((p, i) => `${i ? "L" : "M"}${P(p).join(" ")}`).join("");
  const fk = Math.min(focusKm ?? toKm, half);
  return { full: d(full), done: d(done), dot: P(pointAtKm(t, fk)), w: W, h: H };
}
/** minutul zilei la care camionul ajunge la km-ul dat (după planul zilei) */
function minuteAtKm(t: Truck, km: number): number | null {
  for (const p of dayPlan(t)) if (p.kind === "drive" && km >= p.kmStart && km <= p.kmEnd) return p.start + ((km - p.kmStart) / (p.kmEnd - p.kmStart || 1)) * (p.end - p.start);
  return null;
}
const WPK = new Map<string, number[]>();
/** km-ul fiecărui punct de traseu pe drumul de dus */
function waypointKm(t: Truck): number[] {
  let r = WPK.get(t.id); if (r) return r;
  const half = routeTotalKm(t) / 2, samp: [number, LatLng][] = [];
  for (let k = 0; k <= half; k += 2) samp.push([k, pointAtKm(t, k)]);
  r = t.route.map((w) => samp.reduce((b, s) => (haversineKm(s[1], w.at) < haversineKm(b[1], w.at) ? s : b))[0]);
  WPK.set(t.id, r); return r;
}

export interface FeedInput { loc: Locale; vehicles: Vehicle[]; views: TripView[]; clients: Client[]; alerts: AppAlert[]; live: LiveVehicle[]; drivers: DriverRank[]; now?: number }
export function buildFeed({ loc, vehicles, views, clients, alerts, live, drivers, now = DEMO_NOW_MIN }: FeedInput) {
  const F = FT[loc], region = new Intl.DisplayNames([loc], { type: "region" });
  const evs: FeedEvent[] = [], queue: FeedEvent[] = [], stories: Story[] = [];
  const avgPrice = FILLS.reduce((a, f) => a + f.priceLei, 0) / FILLS.reduce((a, f) => a + f.litres, 0);
  const who = (v: Vehicle) => ({ vehicleId: v.id, plate: v.name, driver: v.driver, hue: hueOf(v.driver), initials: initialsOf(v.driver) });
  const push = (e: FeedEvent) => (e.min != null && e.min > now ? queue : evs).push(e);
  for (const t of TRUCKS) {
    const v = vehicles.find((x) => x.id === t.id), lv = live.find((x) => x.id === t.id);
    if (!v || !lv) continue;
    const priv = lv.status === "private", plan = dayPlan(t), half = routeTotalKm(t) / 2, total = half * 2;
    const trip = views.find((x) => x.vehicleId === t.id && x.active), client = trip ? clients.find((c) => c.id === trip.clientId)?.name ?? "" : "";
    const dest = t.route[t.route.length - 1].name, kmNow = Math.min(lv.today, total);
    // poveste
    const stops: Story["stops"] = [];
    if (t.depMin < now) stops.push({ kind: "depart", time: minToHHMM(t.depMin), place: t.route[0].name });
    for (const p of plan) if (p.start < now && p.kind !== "drive" && p.start > 0) {
      const place = nearestWaypoint(t, pointAtKm(t, p.kmStart)).name, isDel = p.kind === "break" && Math.abs(p.kmStart - half) < 1;
      stops.push({ kind: p.kind === "pump" ? "pump" : isDel ? "deliver" : "break", time: minToHHMM(p.start), place });
    }
    if (priv) { stories.push({ ...who(v), status: lv.status, km: Math.round(lv.today), rate: "—", priv: true, stops: [] }); }
    else {
      // GDPR: camionul în pauză privată nu apare în flux cu poziție (doar alertele și documentele)
      // treceri de graniță — dus și întors
      const wk = waypointKm(t);
      for (let i = 1; i < t.route.length; i++) {
        const a = ccOf(t.route[i - 1].name), b = ccOf(t.route[i].name); if (a === b) continue;
        const kmB = (wk[i - 1] + wk[i]) / 2;
        for (const [km, cc, place] of [[kmB, b, a === "RO" ? t.route[i - 1].name : t.route[i].name], [total - kmB, a, a === "RO" ? t.route[i - 1].name : t.route[i].name]] as [number, string, string][]) {
          const m = minuteAtKm(t, km); if (m == null || m > now + 240) continue;
          const back = km > half, left = back ? total - km : half - km, eta = minToHHMM(m + (left / 64) * 60);
          push({ id: `b-${t.id}-${Math.round(km)}`, kind: "border", prio: "normal", min: Math.round(m), ...who(v), flag: flagOf(cc), title: fill(F.border, { country: region.of(cc) ?? cc, flag: flagOf(cc) }), sub: fill(F.borderSub, { place, dest: back ? t.route[0].name : dest, eta }), map: mini(t, Math.min(km, half), back ? total - km : km) });
        }
      }
      // alimentarea zilei
      const pump = plan.find((p) => p.kind === "pump");
      if (pump) {
        const f = FILLS.find((x) => x.id === `${t.id}-today`), at = pointAtKm(t, pump.kmStart), wp = nearestWaypoint(t, at);
        const litres = f?.litres ?? Math.round(((pump.kmStart + 360) * t.normalL100) / 100), lei = f?.priceLei ?? Math.round(litres * 7.31 * 100) / 100;
        const cc = ccOf(wp.name), cur = CC_CUR[cc] ?? "RON", orig = cur !== "RON" ? `${fmtNum(loc, Math.round((lei / DEMO_LEI_PER[cur]) * 100) / 100, 2)} ${cur}` : undefined;
        const pl = lei / litres, vs = (pl / avgPrice - 1) * 100, station = f?.station ?? `OMV ${wp.name}`;
        const rc = { station, litres: `${fmtNum(loc, litres)} L`, lei: fmtMoney(loc, lei, 2), orig, time: minToHHMM(pump.start + 8) };
        push({ id: `f-${t.id}`, kind: "fuel", prio: "normal", min: Math.round(pump.start + 8), ...who(v), flag: cc !== "RO" ? flagOf(cc) : undefined, title: fill(F.fuel, { litres: fmtNum(loc, litres), station }), sub: fill(F.fuelSub, { price: fmtMoney(loc, pl, 2), vs: `${vs >= 0 ? "+" : "−"}${fmtNum(loc, Math.abs(vs), 1)}%` }), map: mini(t, pump.kmStart), receipt: rc });
      }
      // livrarea (descărcare la destinație)
      const del = plan.find((p) => p.kind === "break" && Math.abs(p.kmStart - half) < 1);
      if (del && del.start <= now + 240) {
        const early = 10 + (hueOf(t.id) % 35);
        push({ id: `d-${t.id}`, kind: "delivered", prio: "trivial", min: Math.round(del.start), ...who(v), flag: ccOf(dest) !== "RO" ? flagOf(ccOf(dest)) : undefined, title: fill(F.delivered, { place: dest }), sub: `${fill(F.deliveredSub, { client: client || "—", time: minToHHMM(del.start) })} · ${fill(F.early, { n: early })}`, map: mini(t, half), clap: true, place: dest });
      }
      // oprire lungă acum
      const cur = plan.find((p) => now >= p.start && now < p.end);
      if (cur && (cur.kind === "break" || (cur.kind === "stop" && cur.start > 0)) && now - cur.start >= 30) {
        const place = nearestWaypoint(t, pointAtKm(t, cur.kmStart)).name, min = Math.round(now - cur.start);
        evs.push({ id: `i-${t.id}`, kind: "idle", prio: "normal", min: Math.round(cur.start + 30), ...who(v), title: fill(F.idle, { min }), sub: fill(F.idleSub, { place, idle: Math.round(min * 0.4) }), map: mini(t, cur.kmStart), cta: { href: `tel:+40000000${String(100 + (hueOf(t.id) % 900))}`, label: F.call, tel: true, note: F.demoPhone } });
      }
      const fe = [...evs, ...queue].find((e) => e.id === `f-${t.id}` && e.min != null && e.min <= now);
      stories.push({ ...who(v), status: lv.status, km: Math.round(lv.today), rate: `${fmtNum(loc, lv.rate, 1)} L/100`, priv: false, map: t.depMin < now ? mini(t, Math.min(kmNow, half), kmNow > half ? total - kmNow : kmNow) : undefined, stops, fill: fe?.receipt });
    }
  }
  // grupare: descărcări în aceeași țară (≥2) → un singur card
  const dels = evs.filter((e) => e.kind === "delivered"), byCc = new Map<string, FeedEvent[]>();
  for (const e of dels) { const cc = e.flag ?? "RO"; byCc.set(cc, [...(byCc.get(cc) ?? []), e]); }
  for (const [flag, g] of byCc) if (g.length >= 2 && flag !== "RO") {
    for (const e of g) evs.splice(evs.indexOf(e), 1);
    const cc = String.fromCharCode(...[...flag].map((c) => (c.codePointAt(0) ?? 0) - 0x1f1e6 + 65).filter((x) => x >= 65 && x <= 90));
    const last = g.reduce((a, b) => ((a.min ?? 0) > (b.min ?? 0) ? a : b));
    evs.push({ ...last, id: `g-${cc}`, kind: "group", prio: "trivial", title: fill(F.group, { n: g.length, country: region.of(cc) ?? cc, flag }), sub: g.map((e) => `${e.plate} → ${e.place ?? ""}`).join("  ·  "), plates: g.map((e) => e.plate), map: undefined, clap: false });
  }
  // momente bune
  const eco = live.filter((x) => x.status !== "private" && x.todayUnit === "km" && x.today > 120).map((x) => ({ x, v: vehicles.find((v) => v.id === x.id)! })).filter((o) => o.v).sort((a, b) => a.x.rate / a.v.baselineRate - b.x.rate / b.v.baselineRate)[0];
  if (eco) { const t = TRUCKS.find((x) => x.id === eco.v.id)!; evs.push({ id: `e-${eco.v.id}`, kind: "eco", prio: "positive", min: now - 22, ...who(eco.v), title: fill(F.eco, { rate: fmtNum(loc, eco.x.rate, 1) }), sub: fill(F.ecoSub, { pct: `${fmtNum(loc, Math.abs((eco.x.rate / eco.v.baselineRate - 1) * 100), 0)}%`, km: fmtNum(loc, eco.x.today) }), map: t ? mini(t, Math.min(eco.x.today, routeTotalKm(t) / 2)) : undefined, clap: true }); }
  const top = drivers[0], tv = top ? vehicles.find((v) => v.id === top.id) : null;
  if (top && tv) evs.push({ id: `r-${top.id}`, kind: "rank", prio: "positive", min: 8 * 60 + 5, ...who(tv), title: fill(F.rank1, { driver: top.driver }), sub: fill(F.rankSub, { score: top.score, why: top.best ? t(loc, `rk.c.${top.best}` as MsgKey) : "" }), clap: true });
  const ot = [...drivers].filter((d) => d.onTime != null && d.id !== top?.id).sort((a, b) => (b.onTime ?? 0) - (a.onTime ?? 0))[0], ov = ot ? vehicles.find((v) => v.id === ot.id) : null;
  if (ot && ov) { const tr = TRUCKS.find((x) => x.id === ot.id); evs.push({ id: `o-${ot.id}`, kind: "ontime", prio: "positive", min: 10 * 60 + 40, ...who(ov), title: fill(F.ontimeStreak, { driver: ot.driver, n: 6 + (hueOf(ot.id) % 7) }), sub: fill(F.ontimeSub, { place: tr ? tr.route[tr.route.length - 1].name : "—" }), clap: true }); }
  // critice (fixate sus): suspiciune de furt + documente care expiră curând
  const pinned: FeedEvent[] = [];
  for (const a of alerts.filter((x) => x.theft && x.rule === "card-fara-camion").slice(0, 1)) {
    const v = vehicles.find((x) => x.id === a.vehicleId); if (!v) continue;
    pinned.push({ id: `t-${a.id}`, kind: "theft", prio: "critical", min: null, when: fmtDate(loc, String(a.params.time ?? a.time)), ...who(v), title: fill(F.theft, { litres: fmtNum(loc, Number(a.params.litres)), station: String(a.params.station) }), sub: fill(F.theftSub, { dist: fmtNum(loc, Number(a.params.dist)), lei: fmtMoney(loc, Number(a.params.litres) * 7.3) }), cta: { href: "/alerts", label: F.seeAlert } });
  }
  for (const a of alerts.filter((x) => x.rule === "doc-expiry" && Number(x.params.days) <= 14).sort((p, q) => Number(p.params.days) - Number(q.params.days)).slice(0, 2)) {
    const v = vehicles.find((x) => x.id === a.vehicleId); if (!v) continue;
    const days = Number(a.params.days), dk = `doc.${a.params.doc}` as MsgKey, doc = t(loc, dk) !== dk ? t(loc, dk) : String(a.params.doc).toUpperCase();
    pinned.push({ id: `c-${a.id}`, kind: "doc", prio: "critical", min: null, when: fmtDate(loc, String(a.params.date)), ...who(v), title: days <= 0 ? fill(F.docToday, { doc }) : fill(F.doc, { doc, days }), sub: fill(F.docSub, { owner: String(a.params.owner), date: fmtDate(loc, String(a.params.date)) }), cta: { href: "/documents", label: F.renew } });
  }
  evs.sort((a, b) => (b.min ?? 0) - (a.min ?? 0));
  queue.sort((a, b) => (a.min ?? 0) - (b.min ?? 0));
  const order = (s: Story) => ({ moving: 0, pump: 1, working: 1, stopped: 2, offline: 3, private: 4 })[s.status];
  stories.sort((a, b) => order(a) - order(b));
  const moving = live.filter((x) => x.status === "moving" || x.status === "working").length;
  const next = live.filter((x) => x.eta && x.status !== "private").sort((a, b) => (a.eta ?? "").localeCompare(b.eta ?? "")).slice(0, 3).map((x) => ({ plate: x.name, dest: x.dest, eta: x.eta! }));
  const summary = { moving, total: live.length, fills: evs.filter((e) => e.kind === "fuel").length, km: Math.round(live.filter((x) => x.todayUnit === "km").reduce((a, x) => a + x.today, 0)), alerts: pinned.length, next, top: eco ? { driver: eco.v.driver, plate: eco.v.name, rate: fmtNum(loc, eco.x.rate, 1) } : null };
  return { pinned, events: evs, queue: queue.slice(0, 8), stories, summary, now };
}

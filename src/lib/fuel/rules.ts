// Querra Fleet: reguli anti-furt / consum pe datele firmei (CSV card + bonuri șofer + poziții GPS). Pure; testate în smoke:fuel.
import type { Severity } from "../fleet/rules";

export type FirmRule = "peste-capacitate" | "l100-mare" | "consum-peste-normal" | "odo-inapoi" | "odo-salt" | "dubla" | "noapte" | "weekend" | "card-fara-camion" | "nr-diferit";
export const FIRM_RULES: FirmRule[] = ["peste-capacitate", "l100-mare", "consum-peste-normal", "odo-inapoi", "odo-salt", "dubla", "noapte", "weekend", "card-fara-camion", "nr-diferit"];
export interface RTruck { id: string; plate: string; tankL: number | null; normalL100: number | null; baseline: number | null }
export interface RTx { id: string; truckId: string | null; at: string; litres: number; odometer: number | null; station: string; card: string | null; lat: number | null; lng: number | null; plate?: string | null }
export interface RPos { truckId: string; at: string; lat: number; lng: number }
export interface FirmAlert { id: string; rule: FirmRule; vehicleId: string; time: string; severity: Severity; theft: boolean; params: Record<string, string | number> }

export const T = {
  overTankTolerance: 0.02, // 2% toleranță la pompă
  l100High: 0.25,          // +25% peste referință → suspect de furt
  l100Over: 0.15,          // +15% → consum peste normal
  minKm: 50, maxKm: 3000,
  maxKmh: 90,              // km între alimentări / ore > 90 km/h → salt de kilometraj
  dupMinutes: 120,
  nightFrom: 22, nightTo: 5,
  posWindowMin: 30, posMaxKm: 5,
};
const r1 = (n: number) => Math.round(n * 10) / 10;
const mins = (a: string, b: string) => (Date.parse(b + ":00Z") - Date.parse(a + ":00Z")) / 60000;
export function haversine(a: [number, number], b: [number, number]) {
  const R = 6371, dLat = ((b[0] - a[0]) * Math.PI) / 180, dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
/** Referința de consum: normalul declarat al camionului, altfel baza din istoricul cardului. */
export const refL100 = (t: RTruck) => t.normalL100 ?? t.baseline;

/** Media L/100km plin-la-plin pe un set de alimentări (pentru baza din istoric). */
export function fillToFill(tx: RTx[]): { km: number; litres: number; l100: number | null; n: number } {
  const s = tx.filter((x) => x.odometer != null).sort((a, b) => a.at.localeCompare(b.at));
  let km = 0, litres = 0, n = 0;
  for (let i = 1; i < s.length; i++) {
    const d = s[i].odometer! - s[i - 1].odometer!;
    if (d < T.minKm || d > T.maxKm) continue;
    km += d; litres += s[i].litres; n++;
  }
  return { km, litres, l100: km >= 500 ? r1((litres / km) * 100) : null, n };
}

export function firmFuelAlerts(trucks: RTruck[], txAll: RTx[], positions: RPos[] = []): FirmAlert[] {
  const out: FirmAlert[] = [];
  for (const t of trucks) {
    const tx = txAll.filter((x) => x.truckId === t.id).sort((a, b) => a.at.localeCompare(b.at));
    const ref = refL100(t);
    const pos = positions.filter((p) => p.truckId === t.id);
    tx.forEach((f, i) => {
      const prev = i > 0 ? tx[i - 1] : null;
      // GDPR: fără poziții în jurul alimentării (mod privat / în afara turei) → regula GPS nu se aplică, iar alertele acestei alimentări poartă „fără poziție (privat)”
      const near = f.lat != null && f.lng != null ? pos.filter((p) => Math.abs(mins(p.at.slice(0, 16), f.at)) <= T.posWindowMin) : [];
      const noPos = f.lat != null && f.lng != null && !near.length;
      const push = (rule: FirmRule, severity: Severity, theft: boolean, params: FirmAlert["params"]) => out.push({ id: `${rule}-${f.id}`, rule, vehicleId: t.id, time: f.at, severity, theft, params: noPos ? { ...params, nogps: 1 } : params });
      if (t.tankL && f.litres > t.tankL * (1 + T.overTankTolerance))
        push("peste-capacitate", "high", true, { station: f.station, time: f.at, litres: f.litres, plate: t.plate, tank: t.tankL, excess: Math.round(f.litres - t.tankL) });
      // bon citit de AI cu alt număr de înmatriculare decât camionul pe care s-a raportat
      const np = (s: string) => s.replace(/[^A-Z0-9]/gi, "").toUpperCase();
      if (f.plate && np(f.plate).length >= 5 && np(f.plate) !== np(t.plate)) push("nr-diferit", "high", true, { plate: t.plate, receiptPlate: f.plate, time: f.at, station: f.station, litres: f.litres });
      const h = +f.at.slice(11, 13), dow = new Date(f.at.slice(0, 10) + "T12:00:00Z").getUTCDay();
      if (h >= T.nightFrom || h < T.nightTo) push("noapte", "low", false, { plate: t.plate, time: f.at, station: f.station, litres: f.litres, from: `${T.nightFrom}:00`, to: `0${T.nightTo}:00` });
      else if (dow === 0 || dow === 6) push("weekend", "low", false, { plate: t.plate, time: f.at, station: f.station, litres: f.litres });
      if (prev) {
        const dm = mins(prev.at, f.at);
        if (dm >= 0 && dm <= T.dupMinutes) {
          const total = r1(prev.litres + f.litres), over = !!t.tankL && total > t.tankL;
          push("dubla", over ? "high" : "medium", over, { plate: t.plate, time: f.at, fromTime: prev.at, minutes: Math.round(dm), litres1: prev.litres, litres2: f.litres, total, station: f.station, tank: t.tankL ?? 0 });
        }
        if (prev.odometer != null && f.odometer != null) {
          const km = f.odometer - prev.odometer, hours = Math.max(dm / 60, 0.25);
          if (km < 0) push("odo-inapoi", "high", true, { plate: t.plate, time: f.at, fromTime: prev.at, odoFrom: prev.odometer, odoTo: f.odometer });
          else if (km > T.maxKm || km / hours > T.maxKmh) push("odo-salt", "medium", true, { plate: t.plate, time: f.at, fromTime: prev.at, odoFrom: prev.odometer, odoTo: f.odometer, km, hours: r1(hours), kmh: Math.round(km / hours), max: T.maxKmh });
          else if (km >= T.minKm && ref) {
            const l100 = r1((f.litres / km) * 100), pct = Math.round((l100 / ref - 1) * 100);
            const params = { time: f.at, fromTime: prev.at, station: f.station, litres: f.litres, km, l100, pct, ref, normal: ref, plate: t.plate };
            if (l100 > ref * (1 + T.l100High)) push("l100-mare", "high", true, { ...params, threshold: T.l100High * 100 });
            else if (l100 > ref * (1 + T.l100Over)) push("consum-peste-normal", "medium", false, { ...params, threshold: T.l100Over * 100 });
          }
        }
      }
      if (f.lat != null && f.lng != null && pos.length) {
        if (near.length) {
          const dist = Math.min(...near.map((p) => haversine([p.lat, p.lng], [f.lat!, f.lng!])));
          if (dist > T.posMaxKm) push("card-fara-camion", "high", true, { card: f.card ?? "—", litres: f.litres, station: f.station, time: f.at, plate: t.plate, dist: Math.round(dist), threshold: T.posMaxKm });
        }
      }
    });
  }
  return out;
}

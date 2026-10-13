import Link from "next/link";
import { fmtMoney, fmtNum, fmtPct, type Locale } from "@/lib/i18n";
import { EL, ef } from "@/lib/econ-i18n";
import { fleetEcon } from "@/lib/econ";
import type { TripView } from "@/lib/query";
import type { Vehicle } from "@/lib/fleet/seed";

/** KPI-uri de flotă: profit real, grad de încărcare, km goi (Acasă, Flux, Curse). */
export function EconKpis({ vehicles, views, loc, compact }: { vehicles: Vehicle[]; views: TripView[]; loc: Locale; compact?: boolean }) {
  const L = EL[loc], f = fleetEcon(vehicles, views);
  if (!f.n) return null;
  const ep = f.km ? f.emptyKm / f.km : 0;
  return (
    <section className={`ekpis fade${compact ? " compact" : ""}`} aria-label={L.realProfit}>
      <Link href="/trips" className="ekpi"><span className="k">{L.kpiProfit}</span><b className={f.profit < 0 ? "neg" : "pos"}>{fmtMoney(loc, f.profit)}</b><small>{ef(L.kpiProfitSub, { n: f.n, m: fmtPct(loc, f.margin, 1) })}</small></Link>
      {f.loadPct !== null ? <div className="ekpi"><span className="k">{L.load}</span><b>{fmtPct(loc, f.loadPct, 0)}</b><span className="ebar" aria-hidden="true"><i style={{ width: `${Math.min(100, f.loadPct * 100)}%` }} /></span><small>{L.kpiLoadSub}</small></div> : null}
      <div className="ekpi"><span className="k">{L.emptyKm}</span><b className={ep > 0.15 ? "warn" : undefined}>{fmtNum(loc, f.emptyKm)} km</b><small>{ef(L.kpiEmptySub, { p: fmtPct(loc, ep, 0) })}</small></div>
      <div className="ekpi"><span className="k">{L.costKm}</span><b>{fmtMoney(loc, f.cpk, 2)}</b><small>{L.fleetAvg} · {fmtNum(loc, f.km)} km</small></div>
    </section>
  );
}
/** comparația pe flotă: cost real / km pe camion, cel curent evidențiat */
export function FleetCompare({ vehicles, views, loc, current }: { vehicles: Vehicle[]; views: TripView[]; loc: Locale; current?: string }) {
  const L = EL[loc], f = fleetEcon(vehicles, views), rows = [...f.rows].sort((a, b) => a.cpk - b.cpk), max = Math.max(...rows.map((r) => r.cpk), 0.01);
  return (
    <div className="fcmp">
      {rows.map((r) => (
        <Link key={r.v.id} href={`/vehicles/${r.v.id}?tab=costs`} className={`fcr${r.v.id === current ? " me" : ""}${r.cpk > f.cpk * 1.08 ? " hi" : ""}`}>
          <span className="pl">{r.v.name}</span>
          <span className="br" aria-hidden="true"><i style={{ width: `${(r.cpk / max) * 100}%` }} /><em style={{ left: `${(f.cpk / max) * 100}%` }} /></span>
          <span className="v">{fmtMoney(loc, r.cpk, 2)}</span>
          <span className={`m ${r.profit < 0 ? "neg" : "pos"}`}>{fmtPct(loc, r.margin, 0)}</span>
        </Link>
      ))}
      <p className="hint">│ {L.fleetAvg}: {fmtMoney(loc, f.cpk, 2)} {L.perKm} · {L.margin} %</p>
    </div>
  );
}

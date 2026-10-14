import Link from "next/link";
import FleetMap from "./FleetMap";
import { CITY_CC, DEMO_NOW_MIN, TRUCKS } from "@/lib/fleet/data";
import { flagOf } from "@/lib/feed";
import { fmtNum, tri, type Locale } from "@/lib/i18n";
import { mapLabels } from "@/lib/labels";
import type { LiveVehicle } from "@/lib/query";

/** Preview uses the same live fleet as /live, including visitor privacy changes. */
export function DemoFleet({ live, loc, theme }: { live: LiveVehicle[]; loc: Locale; theme: "light" | "dark" }) {
  const countries = new Set(TRUCKS.filter((t) => live.some((v) => v.id === t.id)).flatMap((t) => t.route.map((w) => CITY_CC[w.name] ?? "RO")));
  const L = mapLabels(loc);
  return <section className="demo-fleet" aria-labelledby="demo-fleet-title">
    <div className="demo-fleet-head">
      <div><div className="eyebrow">QUERRA FLEET · {tri(loc, "DEMO EUROPA|EUROPE DEMO|DEMO EUROPA")}</div>
        <h1 id="demo-fleet-title">{tri(loc, "Flota ta, dintr-o privire.|Your fleet at a glance.|Twoja flota w jednym miejscu.")}</h1>
        <p>{live.length} {tri(loc, "camioane|trucks|ciężarówek")} · {new Set(live.map((v) => v.driver)).size} {tri(loc, "șoferi|drivers|kierowców")} · {countries.size} {tri(loc, "țări pe trasee|countries along the routes|krajów na trasach")}</p>
      </div>
      <Link className="btn sec" href="/live">{tri(loc, "Deschide harta|Open map|Otwórz mapę")} <span aria-hidden="true">↗</span></Link>
    </div>
    <div className="demo-fleet-body">
      <div className="demo-fleet-map">
        <FleetMap mode="strip" vehicles={live} zones={[]} parcels={[]} theme={theme} loc={loc} labels={L} now={DEMO_NOW_MIN} />
        <div className="demo-fleet-time"><i />14:00 <span>· {tri(loc, "ora României|Romania time|czas rumuński")}</span></div>
        <div className="demo-fleet-legend"><span><i />{tri(loc, "Traseu parcurs|Completed route|Przejechana trasa")}</span><span><i />{tri(loc, "Traseu rămas|Remaining route|Pozostała trasa")}</span></div>
      </div>
      <div className="demo-fleet-routes">
        {live.map((v, i) => {
          const t = TRUCKS.find((x) => x.id === v.id)!;
          const first = t.route[0], last = t.route[t.route.length - 1];
          return <Link href={`/live?v=${v.id}`} className="demo-fleet-route" key={v.id}>
            <span className="demo-fleet-index">{String(i + 1).padStart(2, "0")}</span>
            <div><div className="demo-fleet-route-title"><b>{v.name}</b><span className={`demo-fleet-status ${v.status}`}>{L[`st.${v.status}`]}</span></div>
              <p>{flagOf(CITY_CC[first.name] ?? "RO")} {first.name} <span aria-hidden="true">→</span> {flagOf(CITY_CC[last.name] ?? "RO")} {last.name}</p>
              <small>{v.driver} · {v.status === "private" ? L.privPanel : v.left ? `${fmtNum(loc, v.left)} km · ETA ${v.eta ?? "—"}` : tri(loc, "la destinație|at destination|na miejscu")}</small>
            </div><span className="demo-fleet-arrow" aria-hidden="true">↗</span>
          </Link>;
        })}
      </div>
    </div>
    <div className="demo-fleet-foot"><span>{tri(loc, "Date de prezentare. Încearcă harta, cursele și profilurile echipajelor.|Sample data. Explore the map, trips and crew profiles.|Dane przykładowe. Poznaj mapę, kursy i profile kierowców.")}</span><Link href="/trips">{tri(loc, "Vezi cursele|View trips|Zobacz kursy")} →</Link></div>
  </section>;
}

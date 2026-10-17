import { SearchField } from "@/components/SearchField";
import Link from "next/link";
import { load } from "@/lib/data";
import { fmtNum, tri, type Locale } from "@/lib/i18n";
import { TRUCKS } from "@/lib/fleet/data";
import { initialsOf } from "@/lib/feed";

export async function DemoRoster({ kind, loc, query = "" }: { kind: "drivers" | "trucks"; loc: Locale; query?: string }) {
  const d = await load(), live = await d.live();
  const drivers = kind === "drivers", q = query.trim().toLocaleLowerCase();
  const visible = d.vehicles.filter((v) => `${v.name} ${v.model} ${v.driver}`.toLocaleLowerCase().includes(q));
  return <main>
    <div className="eyebrow">QUERRA FLEET · DEMO</div><h1 className="h1">{drivers ? tri(loc, "Șoferi|Drivers|Kierowcy") : tri(loc, "Camioane|Trucks|Pojazdy")} <span className="acc">{d.vehicles.length}</span></h1>
    <p className="sub">{tri(loc, "Fiecare șofer are camionul și cursa lui. Explorează echipajele din demo.|Every driver has an assigned truck and trip. Explore the demo crew.|Każdy kierowca ma swój pojazd i kurs. Poznaj zespół demonstracyjny.")}</p>
    <form method="get" className="roster-search"><SearchField id="roster-query" label={tri(loc, "Caută șofer sau camion|Search driver or truck|Szukaj kierowcy lub pojazdu")} value={query} button={tri(loc, "Caută|Search|Szukaj")} /></form>
    <div className="demo-roster">{visible.map((v) => {
      const tr = d.views.find((t) => t.vehicleId === v.id && t.active), lv = live.find((t) => t.id === v.id);
      return <section className="sheet demo-roster-card" key={v.id}>
        <div className="demo-roster-person"><span>{initialsOf(v.driver)}</span><div><h2>{drivers ? v.driver : v.name}</h2><p>{drivers ? `${v.name} · ${v.model}` : `${v.model} · ${v.driver}`}</p></div></div>
        <div className="demo-roster-route"><small>{tri(loc, "Cursa de azi|Today's trip|Dzisiejszy kurs")}</small><p>{tr?.title ?? TRUCKS.find((t) => t.id === v.id)?.routeName}</p><span>{lv?.status === "private" ? tri(loc, "Pauză privată|Private break|Prywatna przerwa") : lv?.left ? `${fmtNum(loc, lv.left)} km · ETA ${lv.eta ?? "—"}` : tri(loc, "La destinație|At destination|Na miejscu")}</span></div>
        <div className="invrow">{tr ? <Link href={`/trips/${tr.id}`} className="btn pri sm">{tri(loc, "Vezi cursa|View trip|Zobacz kurs")}</Link> : null}<Link className="btn sec sm" href={`/vehicles/${v.id}`}>{tri(loc, "Detalii camion|Truck details|Szczegóły pojazdu")}</Link></div>
      </section>;
    })}</div>
    {!visible.length ? <p className="msg" role="status">{tri(loc, "Niciun rezultat. Încearcă alt nume.|No results. Try another name.|Brak wyników. Spróbuj innej nazwy.")}</p> : null}
  </main>;
}

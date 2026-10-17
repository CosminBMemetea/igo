import { t } from "@/lib/i18n";
import { EmptyState } from "@/components/EmptyState";
import { getPrefs } from "@/lib/prefs";
import { load } from "@/lib/data";
import { mapLabels } from "@/lib/labels";
import { DEMO_NOW_MIN } from "@/lib/fleet/data";
import FleetMap from "@/components/FleetMap";
import { nowMin } from "@/lib/real-live";
import { Gate } from "@/components/Gate";

export const dynamic = "force-dynamic";
export default async function Live(props: { searchParams: Promise<{ v?: string }> }) {
  const searchParams = await props.searchParams;
  const prefs = (await getPrefs());
  const d = await load();
  const live = (await d.live());
  if (!d.demo && !live.length) return <main><EmptyState kind="live" loc={prefs.loc} canSetup={d.tn.role === "owner" || d.tn.role === "admin"} /><p className="gdpr" style={{ margin: "0 auto", textAlign: "center" }}><b>GDPR</b> · {t(prefs.loc, "priv.gdpr")}</p></main>;
  const L = ({ ro: { title: "Fără poziție pe hartă", priv: "Privat (pauză)", noGps: "în tură, fără GPS", stale: "în tură, semnal GPS vechi", off: "nu e în tură" }, en: { title: "Not on the map", priv: "Private (break)", noGps: "on shift, no GPS", stale: "on shift, GPS signal old", off: "not on shift" }, pl: { title: "Poza mapą", priv: "Prywatnie (przerwa)", noGps: "na zmianie, bez GPS", stale: "na zmianie, stary sygnał GPS", off: "poza zmianą" } } as const)[prefs.loc] ?? { title: "", priv: "", noGps: "", stale: "", off: "" };
  const initial = live.some((x) => x.id === searchParams.v) ? searchParams.v : d.demo ? "bh21qrt" : (live.find((x) => x.at) ?? live[0]).id;
  return (
    <main className="live-page" style={{ padding: 0 }}>
      <Gate feature="live" prefs={prefs}>
        <FleetMap mode="full" vehicles={live} zones={d.zones} parcels={d.parcels} theme={prefs.theme} loc={prefs.loc} labels={mapLabels(prefs.loc)} now={d.demo ? DEMO_NOW_MIN : nowMin()} initial={initial} fitAll={!searchParams.v} />
        {!d.demo && live.some((x) => !x.at || x.status === "offline") ? <ul className="lv-off" aria-label={L.title}>{live.filter((x) => !x.at || x.status === "offline").map((x) => (
          <li key={x.id} className={x.status === "private" ? "p" : x.onShift ? "w" : ""}><b>{x.name}</b><span>{x.driver ? `${x.driver} · ` : ""}{x.status === "private" ? L.priv : x.onShift ? (x.at ? L.stale : L.noGps) : L.off}</span></li>))}</ul> : null}
      </Gate>
    </main>
  );
}

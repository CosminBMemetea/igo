import { t } from "@/lib/i18n";
import { EmptyState } from "@/components/EmptyState";
import { getPrefs } from "@/lib/prefs";
import { load } from "@/lib/data";
import { mapLabels } from "@/lib/labels";
import { DEMO_NOW_MIN } from "@/lib/fleet/data";
import FleetMap from "@/components/FleetMap";
import { Gate } from "@/components/Gate";

export const dynamic = "force-dynamic";
export default async function Live({ searchParams }: { searchParams: { v?: string } }) {
  const prefs = getPrefs();
  const d = await load();
  if (!d.demo) return <main><EmptyState kind="live" loc={prefs.loc} canSetup={d.tn.role === "owner" || d.tn.role === "admin"} /><p className="gdpr" style={{ margin: "0 auto", textAlign: "center" }}><b>GDPR</b> · {t(prefs.loc, "priv.gdpr")}</p></main>;
  const live = d.live();
  const initial = live.some((x) => x.id === searchParams.v) ? searchParams.v : "bh21qrt";
  return (
    <main className="live-page" style={{ padding: 0 }}>
      <Gate feature="live" prefs={prefs}>
        <FleetMap mode="full" vehicles={live} zones={d.zones} parcels={d.parcels} theme={prefs.theme} loc={prefs.loc} labels={mapLabels(prefs.loc)} now={DEMO_NOW_MIN} initial={initial} fitAll={!searchParams.v} />
      </Gate>
    </main>
  );
}

import { EmptyState } from "@/components/EmptyState";
import { getPrefs } from "@/lib/prefs";
import { load } from "@/lib/data";
import { monthSummary } from "@/lib/query";
import { fmtMoney, t } from "@/lib/i18n";
import { TripRows } from "../TripRows";

export const dynamic = "force-dynamic";
export default async function Trips() {
  const { loc } = getPrefs();
  const d = await load();
  if (!d.demo && !d.trips.length) return <main><EmptyState kind="trips" loc={loc} canSetup={d.tn.role === "owner" || d.tn.role === "admin"} /></main>;
  const m = monthSummary(d.views);
  return (
    <main>
      <div className="eyebrow fade">{t(loc, "nav.trips")}</div>
      <h1 className="h1 fade">{t(loc, "trips.title")}</h1>
      <p className="sub fade d1" dangerouslySetInnerHTML={{ __html: t(loc, "trips.sub", { n: m.n, total: fmtMoney(loc, m.profit) }) }} />
      <section className="section" style={{ marginTop: 40 }}><TripRows rows={d.views} loc={loc} /></section>
    </main>
  );
}

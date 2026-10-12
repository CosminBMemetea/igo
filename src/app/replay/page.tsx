import { getPrefs } from "@/lib/prefs";
import { t, type MsgKey } from "@/lib/i18n";
import { tenant } from "@/lib/tenant";
import { store } from "@/lib/store";
import { demoReplay, firmReplay } from "@/lib/replay";
import { TRUCKS } from "@/lib/fleet/data";
import ReplayMap from "@/components/ReplayMap";
import { EmptyState } from "@/components/EmptyState";
import Link from "next/link";

export const dynamic = "force-dynamic";
const RK = ["title", "back", "play", "pauseBtn", "scrub", "follow", "time", "km", "litres", "fueled", "stops", "events", "fuel", "pause", "private", "privShort", "privNote", "start", "end", "openTrip", "st_drive", "st_pause", "st_fuel", "st_private", "st_end"] as const;
const DEMO_DAY = "2026-10-15";
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Bucharest" });

export default async function Replay({ searchParams }: { searchParams: { v?: string; trip?: string; d?: string } }) {
  const prefs = getPrefs(), { loc } = prefs;
  const tn = await tenant();
  const r = tn.repo;
  const [vehicles, trips] = await Promise.all([r.vehicles(), r.trips()]);
  const trip = searchParams.trip ? trips.find((x) => x.id === searchParams.trip) ?? null : null;
  const vid = trip?.vehicleId ?? searchParams.v ?? (tn.demo ? "bh21qrt" : vehicles[0]?.id);
  const v = vehicles.find((x) => x.id === vid);
  const L = Object.fromEntries(RK.map((k) => [k, t(loc, `rp.${k}` as MsgKey)]));
  const back = trip ? `/trips/${trip.id}` : v ? `/vehicles/${v.id}` : "/live";
  let data = null;
  if (tn.demo) data = demoReplay(TRUCKS.some((x) => x.id === vid) ? vid! : "bh21qrt", trip?.date ?? DEMO_DAY, trip && TRUCKS.some((x) => x.id === trip.vehicleId) ? trip.id : null);
  else if (v && tn.firm) {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.d ?? "") ? searchParams.d! : trip?.date ?? today();
    const s = store();
    const [pos, fuel] = await Promise.all([s.positions(tn.firm.id, `${date}T00:00`), s.fuel(tn.firm.id, { truckId: v.id, limit: 500 })]);
    data = firmReplay({ vehicleId: v.id, plate: v.name, driver: v.driver, date, tripId: trip?.id ?? null, rate: v.baselineRate || 30, pos, fuel });
  }
  if (!data) return (
    <main className="setup">
      <div className="eyebrow">{L.title}</div>
      <h1 className="h1">{v?.name ?? "—"}</h1>
      <div className="msg warn" style={{ marginTop: 18 }}>{t(loc, "rp.none")}</div>
      <p className="gdpr"><b>GDPR</b> · {t(loc, "priv.gdpr")}</p>
      <Link className="btn sec" href={back} style={{ marginTop: 18 }}>{L.back}</Link>
      {!vehicles.length ? <EmptyState kind="live" loc={loc} canSetup={tn.role === "owner" || tn.role === "admin"} /> : null}
    </main>
  );
  return (
    <main className="live-page rp-page" style={{ padding: 0 }}>
      <ReplayMap data={data} theme={prefs.theme} loc={loc} L={L} back={back} />
    </main>
  );
}

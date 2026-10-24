import Link from "next/link";
import { ComplianceCard } from "@/components/ComplianceDashboard";
import { ComplianceTasks } from "@/components/ComplianceTasks";
import { Gate } from "@/components/Gate";
import { getPrefs } from "@/lib/prefs";
import { tenant } from "@/lib/tenant";
import { tri, t, fmtDate, type MsgKey } from "@/lib/i18n";
import { driverView } from "@/lib/driver-view";
import { CHECK_ACTION, CHECK_LABEL } from "@/lib/driver-checklist";
import { COMPLIANCE_LABELS, complianceBadge } from "@/lib/compliance-labels";
export const dynamic = "force-dynamic";

/** Acte: întâi ce lipsește (cu buton de poză), apoi actele mele și ale camionului. */
export default async function DriverDocsPage(props: { searchParams: Promise<{ v?: string }> }) {
  const sp = await props.searchParams, prefs = await getPrefs(), { loc } = prefs;
  const tn = await tenant();
  const dv = await driverView(tn, tn.role === "driver" ? undefined : sp.v);
  const realDriver = !tn.demo && tn.role === "driver";
  const href = (tripId: string, k: string) => realDriver ? `/driver/trips/${encodeURIComponent(tripId)}#pw-${k}` : `/driver?${dv.vehicle ? `v=${encodeURIComponent(dv.vehicle.id)}&` : ""}trip=${encodeURIComponent(tripId)}#pw-${k}`;
  const truck = (id: string | null) => dv.allVehicles.find(x => x.id === id)?.name;
  return <Gate feature="driverApp" prefs={prefs}><main className="driver-main">
    <h1 className="dpage-h fade">{tri(loc, "Acte|Documents|Dokumenty")}</h1>
    <section className="dsec fade" aria-labelledby="miss-h">
      <h2 id="miss-h" className="dsec-h">{tri(loc, "De trimis|To send|Do wysłania")}<span className="dsec-n">{dv.missing.length}</span></h2>
      {dv.missing.length ? <ul className="dmiss">{dv.missing.map(m => <li key={`${m.tripId}-${m.key}`} className="dmiss-i">
        <div className="dmiss-t"><b>{tri(loc, CHECK_LABEL[m.key])}</b><span className="ell">{m.title}</span><small>{fmtDate(loc, m.date, true)}{truck(m.truckId) ? ` · ${truck(m.truckId)}` : ""}</small></div>
        <Link className="btn pri dact" href={href(m.tripId, m.key)}><span aria-hidden="true">📷</span>{tri(loc, CHECK_ACTION[m.key] ?? "Deschide|Open|Otwórz")}</Link>
      </li>)}</ul> : <p className="dok"><span aria-hidden="true">✓</span>{tri(loc, "Toate actele curselor sunt trimise.|All trip documents are sent.|Wszystkie dokumenty kursów wysłane.")}</p>}
    </section>
    <section className="dsec fade d1" id="personal-docs" aria-labelledby="pers-h">
      <h2 id="pers-h" className="dsec-h">{tri(loc, "Actele mele|My documents|Moje dokumenty")}</h2>
      <div className="list">
        {dv.myDocs.length ? dv.myDocs.map(d => <div key={d.id} className="it" style={{ cursor: "default" }}>
          <div><div className="t">{t(loc, `doc.${d.type}` as MsgKey)}</div><div className="m">{d.expires ? `${t(loc, "docs.expires")} ${fmtDate(loc, d.expires, true)}` : "—"}{d.fileId ? <> · <a className="link" href={`/api/files/${encodeURIComponent(d.fileId)}`} target="_blank" rel="noreferrer">{t(loc, "dc.openFile")}</a></> : null}</div></div>
          <span className={`badge ${complianceBadge(d.state)}`}>{tri(loc, COMPLIANCE_LABELS[d.state])}</span>
        </div>) : <p className="sub">{t(loc, "dc.none")}</p>}
      </div>
    </section>
    {dv.tasks.length ? <ComplianceTasks tasks={dv.tasks} vehicles={dv.vehicles} today={dv.today} loc={loc} driver /> : null}
    {dv.vehicle ? <section id="docs" className="fade d2"><ComplianceCard vehicle={dv.vehicle} docs={dv.vehicleDocs} today={dv.today} loc={loc} driver demo={tn.demo} /></section> : null}
  </main></Gate>;
}

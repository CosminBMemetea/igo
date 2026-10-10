import Link from "next/link";
import { getPrefs } from "@/lib/prefs";
import { load } from "@/lib/data";
import { fmtDate, fmtMoney, fmtNum, fmtPct, t } from "@/lib/i18n";
import { Gate } from "@/components/Gate";

export const dynamic = "force-dynamic";
const BADGE = { paid: "ok", due: "warn", overdue: "bad" } as const;
const EU = new Set(["AT", "HU", "IT", "PL", "DE"]);
export default async function Invoices({ searchParams }: { searchParams: { trip?: string } }) {
  const prefs = getPrefs(), { loc } = prefs;
  const d = await load();
  const inv = d.views.filter((v) => v.invoiceNo).sort((a, b) => b.date.localeCompare(a.date));
  const sel = inv.find((v) => v.id === searchParams.trip) ?? inv[0];
  const client = d.clients.find((c) => c.id === sel.clientId)!;
  const reverse = EU.has(client.country);
  const vat = reverse ? 0 : Math.round(sel.revenue * 0.21 * 100) / 100;
  const due = new Date(Date.parse(sel.date) + client.payDays * 86400000).toISOString().slice(0, 10);
  return (
    <Gate feature="invoicing" prefs={prefs}>
      <main>
        <div className="eyebrow fade">{t(loc, "inv.title")}</div>
        <h1 className="h1 fade">{sel.invoiceNo}</h1>
        <p className="sub fade d1">{t(loc, "inv.sub")}</p>
        <section className="grid2 section" style={{ gridTemplateColumns: "1.3fr 1fr", marginTop: 40 }}>
          <div className="paper fade d1">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div><div style={{ letterSpacing: ".3em", fontWeight: 500 }}>QUERRA TRANS SRL</div><div style={{ color: "#8a8c92", marginTop: 6 }}>RO 41234567 · J05/1234/2019<br />Oradea</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 24, fontWeight: 300 }}>{t(loc, "inv.invoice")}</div><div style={{ color: "#8a8c92" }}>{sel.invoiceNo} · {fmtDate(loc, sel.date, true)}</div><div style={{ color: "#8a8c92", fontSize: 11 }}>{t(loc, "inv.draft")}</div></div>
            </div>
            <div style={{ marginTop: 30, color: "#8a8c92", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase" }}>{t(loc, "inv.billTo")}</div>
            <div style={{ marginTop: 4 }}>{client.name} · {client.vat}</div>
            <table>
              <thead><tr><th>{t(loc, "inv.desc")}</th><th className="r">{sel.ha ? "ha" : "km"}</th><th className="r">{t(loc, "inv.amount")}</th></tr></thead>
              <tbody>
                <tr><td>{sel.vehicle.kind === "agri" ? `${t(loc, `type.${sel.type}`)} · ${sel.title}` : `${t(loc, "type.transport")} ${sel.title}`} · {sel.vehicle.name}</td><td className="r">{fmtNum(loc, sel.ha || sel.km)}</td><td className="r">{fmtMoney(loc, sel.revenue, 2)}</td></tr>
                <tr><td>{reverse ? t(loc, "inv.reverse") : t(loc, "inv.vat")}</td><td /><td className="r">{fmtMoney(loc, vat, 2)}</td></tr>
              </tbody>
            </table>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22, fontSize: 20 }}><span>{t(loc, "inv.total")}</span><span>{fmtMoney(loc, sel.revenue + vat, 2)}</span></div>
            <div style={{ color: "#8a8c92", marginTop: 22 }}>{t(loc, "inv.due")}: {fmtDate(loc, due, true)} · IBAN RO49 BTRL 0000 1234 5678 90 · CMR, POD</div>
          </div>
          <div className="fade d2">
            <div className="card"><div className="k">{t(loc, "col.profit")}</div><div className={`n ${sel.p.profit < 0 ? "neg" : "pos"}`}>{fmtMoney(loc, sel.p.profit)}</div><div className="d">{fmtPct(loc, sel.p.margin)} {t(loc, "col.margin")} · <Link className="acc" href={`/trips/${sel.id}`}>{t(loc, "trip.detail")}</Link></div></div>
            <div style={{ display: "grid", gap: 10, marginTop: 22 }}><button className="btn pri" disabled title="demo">{t(loc, "inv.send")}</button><button className="btn sec" disabled title="demo">PDF</button></div>
            <div className="eyebrow" style={{ marginTop: 36 }}>{t(loc, "inv.export")}</div>
            <div className="list" style={{ marginTop: 8 }}>
              {([["e-Factura (ANAF SPV)", "inv.efactura"], ["SmartBill", "inv.smartbill"], ["SAGA", "inv.saga"]] as const).map(([n, k]) => <div key={n} className="it"><div><div className="t">{n}</div><div className="m">{t(loc, k)}</div></div><span className="badge">{t(loc, "inv.planned")}</span></div>)}
            </div>
          </div>
        </section>
        <section className="section">
          {inv.slice(0, 14).map((r) => (
            <Link key={r.id} href={`/invoices?trip=${r.id}`} className="row" style={{ gridTemplateColumns: "1fr 1.4fr 1fr 1fr" }}>
              <div className="t">{r.invoiceNo}</div>
              <div><div className="t">{r.title}</div><div className="m">{fmtDate(loc, r.date)} · {d.clients.find((c) => c.id === r.clientId)?.name}</div></div>
              <div className="v">{fmtMoney(loc, r.revenue)}</div>
              <div style={{ textAlign: "right" }}><span className={`badge ${BADGE[r.payment]}`}>{t(loc, `pay.${r.payment}`)}</span></div>
            </Link>
          ))}
        </section>
      </main>
    </Gate>
  );
}

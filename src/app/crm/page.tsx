import { EmptyState } from "@/components/EmptyState";
import Link from "next/link";
import { getPrefs } from "@/lib/prefs";
import { load } from "@/lib/data";
import { clientSummaries } from "@/lib/query";
import { fmtDate, fmtMoney, fmtPct, plural, t } from "@/lib/i18n";
import { Gate } from "@/components/Gate";
import { CountUp } from "@/components/CountUp";

export const dynamic = "force-dynamic";
const BADGE = { paid: "ok", due: "warn", overdue: "bad" } as const;
export default async function Crm({ searchParams }: { searchParams: { c?: string } }) {
  const prefs = getPrefs(), { loc } = prefs;
  const d = await load();
  if (!d.demo && !d.clients.length) return <main><EmptyState kind="crm" loc={loc} canSetup={d.tn.role === "owner" || d.tn.role === "admin"} /></main>;
  const cs = clientSummaries(d.clients, d.views);
  const sel = cs.find((x) => x.client.id === searchParams.c) ?? cs[0];
  const total = cs.reduce((s, x) => s + x.profit, 0), collect = cs.reduce((s, x) => s + x.toCollect, 0), overdue = cs.reduce((s, x) => s + x.overdue, 0);
  const ini = (n: string) => n.split(" ").slice(0, 2).map((w) => w[0]).join("");
  return (
    <Gate feature="crm" prefs={prefs}>
      <main>
        <div className="eyebrow fade">{t(loc, "crm.title")}</div>
        <section className="hero" style={{ marginTop: 8 }}>
          <div className="fade"><div className="big md"><CountUp value={Math.round(total)} loc={loc} /><small>{t(loc, "cur")}</small></div><p className="sub" dangerouslySetInnerHTML={{ __html: t(loc, "crm.profit", { n: cs.length }) }} /></div>
          <div className="fade d1"><div className="big md" style={{ color: "var(--fg2)" }}><CountUp value={Math.round(collect)} loc={loc} /><small>{t(loc, "cur")}</small></div><p className="sub" dangerouslySetInnerHTML={{ __html: t(loc, "crm.toCollect", { overdue: fmtMoney(loc, overdue) }) }} /></div>
        </section>
        <section className="grid2 section">
          <div className="list fade">
            {cs.map((x) => (
              <Link key={x.client.id} href={`/crm?c=${x.client.id}`} className={`it${x === sel ? " on" : ""}`}>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}><span className="av">{ini(x.client.name)}</span><div><div className="t">{x.client.name}</div><div className="m">{t(loc, "crm.trips", { n: plural(loc, x.n, "u.trip"), m: fmtPct(loc, x.margin, 0) })}</div></div></div>
                <div style={{ textAlign: "right" }}><div className={`v ${x.profit < 0 ? "neg" : "pos"}`}>{fmtMoney(loc, x.profit)}</div><span className={`badge ${BADGE[x.worst]}`}>{t(loc, `pay.${x.worst}`)}</span></div>
              </Link>
            ))}
          </div>
          <div className="fade d1">
            <div style={{ display: "flex", gap: 18, alignItems: "center" }}><span className="av" style={{ width: 64, height: 64, fontSize: 20 }}>{ini(sel.client.name)}</span><div><div style={{ fontSize: 30, fontWeight: 300, letterSpacing: "-.02em" }}>{sel.client.name}</div><div className="sub" style={{ marginTop: 4 }}>{sel.client.country} · {sel.client.vat}</div></div></div>
            <div className="cards" style={{ marginTop: 28 }}>
              <div className="card"><div className="k">{t(loc, "col.profit")}</div><div className={`n ${sel.profit < 0 ? "neg" : "pos"}`}>{fmtMoney(loc, sel.profit)}</div></div>
              <div className="card"><div className="k">{t(loc, "col.margin")}</div><div className="n">{fmtPct(loc, sel.margin, 0)}</div></div>
              <div className="card"><div className="k">{t(loc, "crm.avgPay")}</div><div className="n">{t(loc, "crm.days", { n: sel.client.payDays })}</div></div>
            </div>
            <div className="eyebrow" style={{ marginTop: 36 }}>{t(loc, "crm.contacts")}</div>
            <div className="kv">{sel.client.contacts.map((c) => [<div key={c.name + "a"}>{c.name} · {t(loc, `role.${c.role}`)}</div>, <div key={c.name + "b"}>{c.phone}<br /><span style={{ color: "var(--fg2)", fontSize: 13 }}>{c.email}</span></div>])}</div>
            <div className="eyebrow" style={{ marginTop: 32 }}>{t(loc, "crm.orders")}</div>
            {sel.trips.slice(0, 8).map((r) => (
              <Link key={r.id} className="row r3" href={`/trips/${r.id}`}>
                <div><div className="t">{r.title}</div><div className="m">{fmtDate(loc, r.date)} · {r.vehicle.name}{r.invoiceNo ? ` · ${r.invoiceNo}` : ""}</div></div>
                <div className={`v ${r.p.profit < 0 ? "neg" : "pos"}`}>{fmtMoney(loc, r.p.profit)}</div>
                <div style={{ textAlign: "right" }}><span className={`badge ${r.active ? "acc" : BADGE[r.payment]}`}>{r.active ? t(loc, r.planned ? "trip.planned" : "trip.active") : t(loc, `pay.${r.payment}`)}</span></div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </Gate>
  );
}

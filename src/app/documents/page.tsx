import { HScroll } from "@/components/HScroll";
import { EmptyState } from "@/components/EmptyState";
import Link from "next/link";
import { getPrefs } from "@/lib/prefs";
import { tenant } from "@/lib/tenant";
import { store } from "@/lib/store";
import { fmtDate, fmtNum, t, type Locale, type MsgKey, plural } from "@/lib/i18n";
import { Gate } from "@/components/Gate";
import { docStatus, STATUS_CLASS, STATUS_COLOR } from "@/lib/docs";
import { todayFor } from "@/lib/today";
import { DRIVER_DOC_TYPES, VEHICLE_DOC_TYPES } from "@/lib/store/types";
import type { Doc } from "@/lib/fleet/seed";

export const dynamic = "force-dynamic";
const ERR = ["type", "date", "km", "target", "missing", "file-size", "file-type", "nofirm"];
function Calendar({ docs, today, loc, label }: { docs: Doc[]; today: string; loc: Locale; label: (d: Doc) => string }) {
  const months = [0, 1, 2].map((k) => { const d = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1 + k, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  const wd = [1, 2, 3, 4, 5, 6, 7].map((i) => new Intl.DateTimeFormat(loc === "ro" ? "ro-RO" : loc === "pl" ? "pl-PL" : "en-GB", { weekday: "narrow", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 5, i))));
  return (
    <div className="cal">
      {months.map(({ y, m }) => {
        const first = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7, n = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
        const key = (d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        return (
          <div key={`${y}-${m}`} className="calm">
            <div className="eyebrow">{new Intl.DateTimeFormat(loc === "ro" ? "ro-RO" : loc === "pl" ? "pl-PL" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m, 1)))}</div>
            <div className="calg">
              {wd.map((w, i) => <b key={i}>{w}</b>)}
              {Array.from({ length: first }, (_, i) => <span key={`e${i}`} />)}
              {Array.from({ length: n }, (_, i) => {
                const day = key(i + 1), hits = docs.filter((d) => d.expires === day);
                return <span key={day} className={`${day === today ? "today" : ""}${hits.length ? " hit" : ""}`} title={hits.map((d) => `${t(loc, `doc.${d.type}` as MsgKey)} · ${label(d)}`).join("\n")}>{i + 1}{hits.length ? <i style={{ background: STATUS_COLOR[docStatus(day, today).status] }} /> : null}</span>;
              })}
            </div>
            <div className="calh">{docs.filter((d) => d.expires?.startsWith(key(1).slice(0, 7))).map((d) => <div key={d.id}><i style={{ background: STATUS_COLOR[docStatus(d.expires!, today).status] }} />{fmtDate(loc, d.expires!, true)} · {t(loc, `doc.${d.type}` as MsgKey)} · {label(d)}</div>)}</div>
          </div>
        );
      })}
    </div>
  );
}
export default async function Documents({ searchParams }: { searchParams: { tab?: string; view?: string; add?: string; edit?: string; e?: string; ok?: string } }) {
  const prefs = getPrefs(), { loc } = prefs;
  const tn = await tenant(), r = tn.repo;
  const [docs, vehicles, services] = await Promise.all([r.docs(), r.vehicles(), r.services()]);
  const canEdit = !tn.demo && !!tn.firm && (tn.role === "owner" || tn.role === "admin");
  const drivers = canEdit ? (await store().users(tn.firm!.id)).filter((u) => u.role === "driver") : [];
  const tab = ["vehicles", "drivers", "trips", "service"].includes(searchParams.tab ?? "") ? searchParams.tab! : "vehicles";
  const today = todayFor(tn.demo);
  if (!tn.demo && !docs.length && !searchParams.add) return <main><EmptyState kind="docs" loc={loc} canSetup={canEdit} />{canEdit ? <p style={{ textAlign: "center" }}><Link className="btn pri" href="/documents?add=1">{t(loc, "dc.add")}</Link></p> : null}</main>;
  const dated = docs.filter((d) => d.expires);
  const soon = dated.filter((d) => docStatus(d.expires!, today).status !== "valid").sort((a, b) => a.expires!.localeCompare(b.expires!));
  const vname = (id: string) => vehicles.find((v) => v.id === id)?.name ?? id;
  const label = (d: Doc) => (d.scope === "vehicle" ? vname(d.ownerId) : d.scope === "trip" ? d.ownerId.replace(/-(\d+)$/, " · $1 oct") : d.ownerId);
  const scope = { vehicles: "vehicle", drivers: "driver", trips: "trip" } as const;
  const list = tab === "service" ? [] : docs.filter((d) => d.scope === scope[tab as "vehicles"]).sort((a, b) => (a.expires ?? "9").localeCompare(b.expires ?? "9"));
  const editing = searchParams.edit ? docs.find((d) => d.id === searchParams.edit) : null;
  const formScope = editing ? editing.scope : tab === "drivers" ? "driver" : "vehicle";
  const view = searchParams.view === "cal" ? "cal" : "list";
  const counts = { expired: 0, urgent: 0, soon: 0, valid: 0 };
  for (const d of dated) counts[docStatus(d.expires!, today).status]++;
  const form = canEdit && (searchParams.add || editing) ? (
    <form className="sheet" action="/api/docs" method="post" encType="multipart/form-data" style={{ marginTop: 24 }}>
      {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
      <input type="hidden" name="scope" value={formScope} />
      <div className="seg" style={{ marginBottom: 16, width: "auto" }}>
        <Link href="/documents?tab=vehicles&add=1" className={formScope === "vehicle" ? "on" : ""}>{t(loc, "docs.vehicles")}</Link>
        <Link href="/documents?tab=drivers&add=1" className={formScope === "driver" ? "on" : ""}>{t(loc, "docs.drivers")}</Link>
      </div>
      <div className="two">
        <label className="lf"><span>{formScope === "driver" ? t(loc, "dc.driver") : t(loc, "set.truck")}</span>
          <select name="target" defaultValue={editing ? (editing.scope === "driver" ? editing.userId : editing.ownerId) : undefined} required>
            {formScope === "driver" ? drivers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>) : vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>
        <label className="lf"><span>{t(loc, "set.docType")}</span>
          <select name="type" defaultValue={editing?.type}>{(formScope === "driver" ? DRIVER_DOC_TYPES : VEHICLE_DOC_TYPES).map((d) => <option key={d} value={d}>{t(loc, `doc.${d}` as MsgKey)}</option>)}</select>
        </label>
      </div>
      <div className="two">
        <label className="lf"><span>{t(loc, "docs.expires")}</span><input name="expires" type="date" required defaultValue={editing?.expires ?? undefined} /></label>
        {formScope === "vehicle" ? <label className="lf"><span>{t(loc, "dc.dueKm")}</span><input name="dueKm" inputMode="numeric" placeholder="450000" defaultValue={editing?.dueKm ?? undefined} /></label> : <span />}
      </div>
      <label className="lf"><span>{t(loc, "dc.note")}</span><input name="note" maxLength={200} defaultValue={editing?.note ?? undefined} placeholder="Allianz-Țiriac, poliță 123…" /></label>
      <label className="lf"><span>{t(loc, "dc.file")}</span><input name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" /></label>
      {formScope === "driver" && !drivers.length ? <p className="msg warn">{t(loc, "dc.noDrivers")}</p> : null}
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}><button className="btn pri">{t(loc, editing ? "imp.save" : "dc.add")}</button><Link className="btn sec" href={`/documents?tab=${tab}`}>{t(loc, "dc.cancel")}</Link></div>
      <p className="hint">{t(loc, "dc.fileHint")}</p>
    </form>
  ) : null;
  const body = (
    <main>
      <div className="eyebrow fade">{t(loc, "docs.title")} · {t(loc, "dc.attn")}</div>
      <div className="big fade" style={{ marginTop: 8 }}>{soon.length}</div>
      <p className="sub fade d1">{t(loc, "dc.sub", { total: dated.length, expired: counts.expired, urgent: counts.urgent, soon: counts.soon, valid: counts.valid })}</p>
      {searchParams.ok ? <p className="msg ok">{t(loc, "set.saved")}</p> : null}
      {searchParams.e && ERR.includes(searchParams.e) ? <p className="msg err">{t(loc, `dc.e.${searchParams.e}` as MsgKey)}</p> : null}
      <div className="dtools fade d2">
        <div className="seg">
          {(["vehicles", "drivers", "trips", "service"] as const).map((k) => <Link key={k} href={`/documents?tab=${k}&view=${view}`} className={tab === k ? "on" : ""}>{t(loc, `docs.${k}`)}</Link>)}
        </div>
        <div className="seg">
          <Link href={`/documents?tab=${tab}`} className={view === "list" ? "on" : ""}>{t(loc, "dc.list")}</Link>
          <Link href={`/documents?tab=${tab}&view=cal`} className={view === "cal" ? "on" : ""}>{t(loc, "dc.cal")}</Link>
        </div>
        {canEdit ? <Link className="btn pri sm" href={`/documents?tab=${tab === "drivers" ? "drivers" : "vehicles"}&add=1`}>+ {t(loc, "dc.add")}</Link> : tn.demo ? <span className="hint">{t(loc, "dc.demoRO")}</span> : null}
      </div>
      {form}
      <section className="section" style={{ marginTop: 28 }}>
        {view === "cal" ? <Calendar docs={dated.filter((d) => tab === "service" || d.scope === scope[tab as "vehicles"])} today={today} loc={loc} label={label} /> : tab === "service" ? (
          <Gate feature="maintenance" prefs={prefs} inline>
            <div className="cards">
              {services.length ? services.map((s) => <div className="card" key={s.vehicleId + s.kind}><div className="k">{vname(s.vehicleId)}</div><div className="n">{fmtNum(loc, s.remaining)} {s.unit === "days" ? t(loc, "u.day").split("|")[1] : s.unit}</div><div className="d">{t(loc, `svc.${s.kind}`)}</div><div className="meter"><i style={{ width: `${s.progress * 100}%`, background: s.progress > 0.9 ? "var(--neg)" : s.progress > 0.7 ? "#f5a524" : "var(--pos)" }} /></div></div>)
                : docs.filter((d) => d.type === "service").map((d) => <div className="card" key={d.id}><div className="k">{label(d)}</div><div className="n">{d.dueKm ? `${fmtNum(loc, d.dueKm)} km` : fmtDate(loc, d.expires!, true)}</div><div className="d">{t(loc, "doc.service")}</div></div>)}
            </div>
          </Gate>
        ) : (
<HScroll hint={t(loc, "ui.swipe")} min={0}>          <div className="list">
            {tab === "trips" ? <p className="sub" style={{ marginBottom: 12 }}>{t(loc, "docs.tripNote")}</p> : null}
            {list.map((d, i) => {
              const st = d.expires ? docStatus(d.expires, today) : null;
              return (
                <div key={d.id} className={`it fade d${Math.min(4, i)}`}>
                  <div style={{ minWidth: 0 }}>
                    <div className="t">{t(loc, `doc.${d.type}` as MsgKey)} · {label(d)}</div>
                    <div className="m">{[d.provider ?? d.note, d.expires ? `${t(loc, "docs.expires")} ${fmtDate(loc, d.expires, true)}` : "✓", d.dueKm ? t(loc, "dc.orKm", { km: fmtNum(loc, d.dueKm) }) : null].filter(Boolean).join(" · ")}{d.fileId ? <> · <a className="link" href={`/api/files/${d.fileId}`} target="_blank" rel="noreferrer">{t(loc, "dc.openFile")}</a></> : null}</div>
                    {st ? <div className="meter" style={{ width: 220, maxWidth: "100%" }}><i style={{ width: `${Math.max(8, 100 - Math.min(100, Math.max(0, st.days) / 3.65))}%`, background: STATUS_COLOR[st.status] }} /></div> : null}
                  </div>
                  <div className="dact">
                    {st ? <span className={`badge ${STATUS_CLASS[st.status]}`}>{st.status === "expired" ? t(loc, "dc.expired", { n: -st.days }) : st.status === "valid" ? t(loc, "docs.ok") : t(loc, "docs.days", { n: plural(loc, st.days, "u.day") })}</span> : <span className="badge ok">✓</span>}
                    {canEdit && d.scope !== "trip" ? <>
                      <Link className="btn sec sm" href={`/documents?tab=${tab}&edit=${d.id}`}>{t(loc, "dc.edit")}</Link>
                      <form action="/api/docs/delete" method="post"><input type="hidden" name="id" value={d.id} /><input type="hidden" name="tab" value={tab} /><button className="btn sec sm" aria-label={t(loc, "dc.delete")}>✕</button></form>
                    </> : null}
                  </div>
                </div>
              );
            })}
            {!list.length ? <p className="sub">{t(loc, "dc.none")}</p> : null}
          </div></HScroll>
        )}
      </section>
    </main>
  );
  return <Gate feature="documents" prefs={prefs}>{body}</Gate>;
}

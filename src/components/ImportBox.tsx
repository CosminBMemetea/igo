"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { tri, type Locale } from "@/lib/i18n";
import { pluralForm } from "@/lib/i18n/plural";
import type { Summary } from "@/lib/fuel/import";
import { FIELDS, REQUIRED, headerSig, type Field, type Mapping } from "@/lib/fuel/parse";

type L = Record<string, string>;
const fmt = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
type DemoRes = { report: { plate: string; meta: string; base: string }[]; alerts: { id: string; severity: string; theft: boolean; title: string; why: string; nogps: boolean }[] };
const LS = "qf-demo-map:";
export function ImportBox({ labels: l, fieldLabels, demo }: { labels: L; fieldLabels: Record<Field, string>; demo?: boolean; samples?: [string, string][] }) {
  const [res, setRes] = useState<DemoRes | null>(null);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [sum, setSum] = useState<Summary | null>(null);
  const [mapping, setMapping] = useState<Mapping | undefined>();
  const [assign, setAssign] = useState<Record<string, string>>({});
  const [showMap, setShowMap] = useState(false);
  const [busy, setBusy] = useState(false);
  // reîmprospătare / închidere în timpul importului sau cu un fișier necomis: browserul cere confirmare
  const pending = busy || !!sum;
  useEffect(() => { if (!pending) return; const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; }; addEventListener("beforeunload", h); return () => removeEventListener("beforeunload", h); }, [pending]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const [enc, setEnc] = useState("UTF-8");

  // fetch cu timeout: niciodată blocat pe „Citim…” (rețea slabă, cold start, răspuns invalid)
  async function post(url: string, body: unknown): Promise<Response | null> {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 20000);
    try { return await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ac.signal }); }
    catch { return null; } finally { clearTimeout(t); }
  }
  async function preview(text: string, m?: Mapping) {
    setBusy(true); setMsg(null);
    const r = await post("/api/import/preview", { text, mapping: m });
    setBusy(false);
    if (!r || !r.ok) { setMsg({ ok: false, text: r?.status === 413 ? l.big : l.err }); return; }
    const s = (await r.json().catch(() => null)) as Summary | null;
    if (!s) { setMsg({ ok: false, text: l.err }); return; }
    // demo: maparea „salvată” trăiește doar în browser (localStorage), nu pe server
    if (demo && !m) { try { const saved = localStorage.getItem(LS + headerSig(s.headers)); if (saved) { await preview(text, JSON.parse(saved)); setSum((x) => (x ? { ...x, savedMapping: true, confident: !x.missing.length } : x)); return; } } catch {} }
    setSum(s); setMapping(s.mapping); setShowMap(!s.confident);
  }
  async function pick(f: File | undefined) {
    if (!f) return;
    if (input.current) input.current.value = ""; // același fișier poate fi ales din nou
    if (f.size > 3 * 1024 * 1024) { setMsg({ ok: false, text: l.big }); return; }
    if (/\.(pdf|xlsx?|docx?|png|jpe?g|heic|webp|zip)$/i.test(f.name)) { setMsg({ ok: false, text: l.notCsv }); return; }
    const buf = await f.arrayBuffer();
    if (new Uint8Array(buf.slice(0, 2000)).includes(0)) { setMsg({ ok: false, text: l.notCsv }); return; } // binary, not text
    // UTF-8, altfel Windows-1250/1252 (exporturi vechi din Excel)
    let text = new TextDecoder("utf-8").decode(buf);
    let e = "UTF-8";
    if (text.includes("\uFFFD")) { text = new TextDecoder("windows-1250").decode(buf); e = "Windows-1250"; }
    setEnc(e);
    setFile({ name: f.name, text }); setAssign({}); setSum(null); setRes(null);
    await preview(text);
  }
  async function go() {
    if (!file) return;
    setBusy(true);
    const r = await post("/api/import/commit", { text: file.text, filename: file.name, mapping, assign });
    setBusy(false);
    const j = r ? await r.json().catch(() => null) : null;
    if (!r || !r.ok || !j?.ok) {
      if (j?.summary) { setSum(j.summary); setMapping(j.summary.mapping); }
      setMsg({ ok: false, text: j?.error === "card-mapping-changed" ? tri(l.loc as Locale, "Asocierea cardului s-a schimbat. Reîncarcă fișierul pentru o previzualizare nouă.|The card mapping changed. Reload the file for a fresh preview.|Przypisanie karty się zmieniło. Wczytaj plik ponownie, aby odświeżyć podgląd.") : l.err }); return;
    }
    setMsg({ ok: true, text: fmt(demo ? l.demoDone : l.done, { added: j.added, dupes: j.dupes }) });
    if (demo && j.demo) { setRes(j.demo); try { if (sum) localStorage.setItem(LS + headerSig(sum.headers), JSON.stringify(mapping ?? {})); } catch {} }
    setFile(null); setSum(null); if (input.current) input.current.value = "";
    if (!demo) router.refresh();
  }
  useEffect(() => { const h = (e: Event) => { const d = (e as CustomEvent<{ k: string; n: string }>).detail; if (d && !busyRef.current) { if (window.innerWidth < 900) document.querySelector(".sgrid")?.scrollIntoView({ behavior: "smooth", block: "start" }); void trySample(d.k, d.n); } }; window.addEventListener("qf-sample", h); return () => window.removeEventListener("qf-sample", h); });
  const busyRef = useRef(false); busyRef.current = busy;
  async function trySample(k: string, n: string) {
    const r = await fetch(`/samples/${k}.csv`).catch(() => null); if (!r || !r.ok) { setMsg({ ok: false, text: l.err }); return; }
    const b = await r.blob(); await pick(new File([b], `${k}.csv`, { type: "text/csv" })); void n;
  }
  const setField = (f: Field, v: string) => { const m = { ...(sum?.mapping ?? mapping) }; if (v === "") delete m[f]; else m[f] = +v; setMapping(m); if (file) preview(file.text, m); };
  return (
    <div className="imp">
      <label className={`drop${drag ? " on" : ""}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}>
        <input ref={input} type="file" accept=".csv,.txt,text/csv" onChange={(e) => pick(e.target.files?.[0])} />
        <svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
        <b>{file ? file.name : l.drop}</b>
        <span>{busy ? l.reading : l.dropHint}</span>
      </label>
      {/* exemplele: în caseta laterală (SampleList) — trimit evenimentul „qf-sample” */}
      {msg ? <p className={`msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p> : null}
      {res ? (
        <div className="sheet dres" style={{ marginTop: 18 }}>
          <div className="eyebrow">{l.demoReport}</div>
          <div className="list" style={{ marginTop: 10 }}>{res.report.map((r) => <div key={r.plate} className="it" style={{ cursor: "default" }}><div style={{ minWidth: 0 }}><div className="t">{r.plate}</div><div className="m">{r.meta}</div><div className="m">{r.base}</div></div><span className="badge ok">✓</span></div>)}</div>
          <div className="eyebrow" style={{ marginTop: 20 }}>{fmt(l.demoAlerts, { n: res.alerts.length })}</div>
          {res.alerts.length ? <div className="dalerts">{res.alerts.map((a) => <div key={a.id} className={`da ${a.severity}`}><i /><div><b>{a.title}</b>{a.theft ? <span className="badge neg">!</span> : null}{a.nogps ? <span className="badge priv">GPS —</span> : null}<p>{a.why}</p></div></div>)}</div> : <p className="hint" style={{ marginTop: 8, position: "static" }}>{l.demoNoAlerts}</p>}
          <button type="button" className="btn sec" style={{ marginTop: 16, width: "100%" }} onClick={() => { setRes(null); setMsg(null); }}>{l.again}</button>
        </div>
      ) : null}
      {sum ? (
        <div className="sheet" style={{ marginTop: 18 }}>
          <div className="ihead">
            <div><div className="eyebrow">{l.detected}</div><div className="t">{sum.sourceName} · {fmt(l.rows, { n: sum.valid, total: sum.total })}</div></div>
            <span className={`badge ${sum.confident ? "ok" : "warn"}`}>{sum.confident ? l.sure : l.unsure}</span>
          </div>
          <div className="imeta">
            <span className="mchip">{l.delim} <b>{({ ";": ";", ",": ",", "\t": "TAB", "|": "|" } as Record<string, string>)[sum.delimiter] ?? sum.delimiter}</b></span>
            <span className="mchip">{l.enc} <b>{enc}</b></span>
            <span className="mchip">{fmt(l.cols, { n: sum.headers.length })}</span>
            {sum.savedMapping ? <span className="badge ok" title={l.savedHint}>✓ {l.saved}</span> : null}
          </div>
          <div className="eyebrow" style={{ marginTop: 14 }}>{l.prev}</div>
          <div className="ptable hsx"><table><thead><tr><th>#</th>{sum.headers.map((h, i) => { const f = FIELDS.find((x) => sum.mapping?.[x] === i); return <th key={i} className={f ? "mapped" : ""}>{h}{f ? <small>→ {fieldLabels[f]}</small> : null}</th>; })}</tr></thead><tbody>{sum.preview.map((r, i) => <tr key={i}><td>{i + 2}</td>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>
          <div className="istats">
            <div><b>{sum.newRows}</b><span>{l.new}</span></div>
            <div><b>{sum.dupes}</b><span>{l.dupes}</span></div>
            <div><b>{sum.matched}</b><span>{l.matched}</span></div>
            <div><b>{sum.total - sum.valid}</b><span>{l.skipped}</span></div>
          </div>
          {sum.from ? <p className="hint" style={{ margin: "10px 0 0" }}>{fmt(l.period, { from: sum.from.replace("T", " "), to: sum.to!.replace("T", " ") })}{sum.skipped.nonfuel ? ` · ${fmt(l.nonfuel, { n: sum.skipped.nonfuel })}` : ""}</p> : null}
          <button type="button" className="link" style={{ marginTop: 14, background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={() => setShowMap(!showMap)}>{showMap ? l.hideMap : l.showMap}</button>
          {showMap ? (
            <div className="map">
              {!sum.confident ? <p className="msg warn">{sum.missing.length ? fmt(l.missing, { f: sum.missing.map((f) => fieldLabels[f]).join(", ") }) : l.check}</p> : null}
              <div className="mgrid">
                {FIELDS.map((f) => (
                  <label key={f} className="lf"><span>{fieldLabels[f]}{REQUIRED.includes(f) ? " *" : ""}</span>
                    <select value={sum.mapping?.[f] ?? ""} onChange={(e) => setField(f, e.target.value)}>
                      <option value="">—</option>
                      {sum.headers.map((h, i) => <option key={i} value={i}>{h || `#${i + 1}`}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <p className="hint" style={{ margin: "10px 0 0" }}>{l.saveNote}</p>
            </div>
          ) : null}
          {sum.errors.length ? (
            <div style={{ marginTop: 20 }}>
              <div className="eyebrow">{fmt(l.errs, { n: sum.total - sum.valid })}</div>
              <div className="ierr">
                {sum.errors.slice(0, 12).map((e, i) => <div key={i}><b>{fmt(l.line, { n: e.line })}</b><span>{l[`why_${e.reason}`]}</span>{e.value ? <code>{e.value}</code> : null}</div>)}
                {sum.errors.length > 12 ? <div className="m">{fmt(l.more, { n: sum.total - sum.valid - 12 })}</div> : null}
              </div>
            </div>
          ) : null}
          {sum.conflicts.length ? <div className="msg err" role="alert"><p>{tri(l.loc as Locale, "Import oprit: plăcuța din CSV contrazice istoricul cardului. Verifică perioada cardului sau corectează fișierul, apoi reîncarcă-l.|Import blocked: the CSV registration conflicts with the card history. Check the card period or correct the file, then reload it.|Import zablokowany: rejestracja w CSV jest sprzeczna z historią karty. Sprawdź okres karty lub popraw plik i wczytaj go ponownie.")}</p><ul>{sum.conflicts.slice(0, 8).map((x, i) => <li key={i}>{x.card} · {x.at.replace("T", " ")} · {x.plate} ≠ {x.expected}</li>)}</ul></div> : null}
          {sum.future || sum.dupes || sum.total - sum.valid > 0 || sum.unknown.length ? (
            <ul className="impwarn" role="status">
              {sum.future ? <li>{fmt(l.warnFuture, { n: sum.future })}</li> : null}
              {sum.dupes ? <li>{fmt(l.warnDupes, { n: sum.dupes })}</li> : null}
              {sum.total - sum.valid > 0 ? <li>{fmt(l.warnSkipped, { n: sum.total - sum.valid })}</li> : null}
              {sum.unknown.length ? <li>{fmt(l.warnUnknown, { n: sum.unknown.reduce((a, u) => a + u.n, 0) })}</li> : null}
            </ul>
          ) : null}
          {sum.unknown.length ? (
            <div style={{ marginTop: 20 }}>
              <div className="eyebrow">{l.unknown}</div>
              <p className="hint" style={{ margin: "6px 0 10px" }}>{l.unknownHint}</p>
              <div className="list">
                {sum.unknown.map((u) => (
                  <div key={u.card ?? u.plate ?? ""} className="it" style={{ cursor: "default" }}>
                    <div style={{ minWidth: 0 }}><div className="t">{u.card ? `${l.card} ${u.card}` : u.plate}</div><div className="m">{fmt(l.unknownMeta, { fills: `${u.n} ${pluralForm(l.loc, u.n, l.fillUnit)}`, litres: u.litres })}{u.plate && u.card ? ` · ${u.plate}` : ""}</div></div>
                    {u.card ? (
                      <select className="tsel" value={assign[u.card] ?? ""} onChange={(e) => setAssign({ ...assign, [u.card!]: e.target.value })} aria-label={l.assign}>
                        <option value="">{l.assign}</option>
                        {sum.trucks.map((t) => <option key={t.id} value={t.id}>{t.plate}</option>)}
                      </select>
                    ) : <span className="badge warn">{l.addTruck}</span>}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {sum.fx?.map((x) => (
            <p key={x.cur} className={`msg ${x.missing ? "warn" : ""}`} style={{ marginTop: 10 }}>
              {x.n > x.missing && x.rate ? fmt(x.n - x.missing === 1 ? l.eur1 : l.eur, { fills: `${x.n - x.missing} ${pluralForm(l.loc, x.n - x.missing, l.fillUnit)}`, cur: x.cur, rate: x.rate.toLocaleString(l.loc, { maximumFractionDigits: 4 }), date: x.fxDate!.split("-").reverse().join(".") }) + (x.peg ? " " + l.peg : "") : null}
              {x.missing ? <>{x.n > x.missing ? <br /> : null}{fmt(l.otherCur, { cur: x.cur })}</> : null}
            </p>
          ))}
          <button className="btn pri" style={{ marginTop: 22, width: "100%" }} disabled={busy || !sum.valid || !sum.newRows || !!sum.missing.length || !!sum.conflicts.length} onClick={go}>{busy ? l.reading : fmt(l.go, { fills: `${sum.newRows} ${pluralForm(l.loc, sum.newRows, l.fillUnit)}` })}</button>
        </div>
      ) : null}
    </div>
  );
}

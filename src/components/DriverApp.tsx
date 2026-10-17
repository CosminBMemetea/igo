"use client";
import { useDriverTracking } from "./DriverTracking";
import { SHIFT_CHECKS as CHECKS } from "@/lib/shift-checklist";
import { loadReceiptDraft, saveReceiptDraft } from "@/lib/receipt-draft";
import { enqueue, flushOutbox } from "@/lib/outbox";
import { localNow } from "@/lib/validate";
import { tri } from "@/lib/i18n";
import { saveThumb } from "./ReceiptThumb";
import { useEffect, useRef, useState } from "react";
import { shrinkImage } from "@/lib/shrink";
import { sniffImage, MAX_PHOTO_IN } from "@/lib/imgsniff";
import { fmtNum, type Locale } from "@/lib/i18n";
import { Icon } from "./icons";

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
/** Poză aproape uniformă (albă/neagră/goală) → nu e bon; nu o trimitem la AI. */
async function blankImage(file: File): Promise<boolean | null> {
  try {
    const bmp = await createImageBitmap(file); const c = document.createElement("canvas"); c.width = 48; c.height = 48;
    const g = c.getContext("2d")!; g.drawImage(bmp, 0, 0, 48, 48); const d = g.getImageData(0, 0, 48, 48).data;
    let s = 0, s2 = 0; const n = d.length / 4; for (let i = 0; i < d.length; i += 4) { const y = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; s += y; s2 += y * y; }
    return Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2)) < 4;
  } catch { return null; } // nu se poate decoda
}
const CURS = ["RON", "EUR", "PLN", "HUF", "CZK", "BGN", "CHF", "GBP", "SEK", "DKK", "NOK"];
export function DriverApp({ queueScope, actorId, vehicleId, vehicleName, hello, labels: L, lastFill, loc, initial, demoKm, serverNow, demo, preview, today, switchTo }: { queueScope?: string; actorId?: string; switchTo?: { id: string; name: string }[]; today?: { km: number; hours: number } | null; preview?: boolean; demo?: boolean; serverNow: number; demoKm?: number | null; initial?: { start: string; priv: boolean } | null; vehicleId: string; vehicleName: string; hello: string; labels: Record<string, string>; lastFill: string; loc: Locale }) {
  const [on, setOn] = useState(!!initial), [km, setKm] = useState(today?.km ?? 0), [now, setNow] = useState(serverNow); // același „acum” ca pe server → hidratare identică; apoi ceasul real
  const [checks, setChecks] = useState<string[]>([]), [msg, setMsg] = useState<{ t: string; k: "ok" | "err" | "warn" | "" }>({ t: "", k: "" });
  const [form, setForm] = useState(false), [f, setF] = useState({ litres: "", odo: "", amount: "", station: "" }), [photo, setPhoto] = useState<File | null>(null), [read, setRead] = useState(""), [readInfo, setReadInfo] = useState(""), [last, setLast] = useState(lastFill);
  const [aiOk, setAiOk] = useState(false), [busy, setBusy] = useState(false), [formErr, setFormErr] = useState(""), idem = useRef(newKey()), [cur, setCur] = useState("RON"), [rDate, setRDate] = useState(""), [rPlate, setRPlate] = useState("");
  const receiptVehicle = useRef(vehicleId), mutationAt = useRef(0);
  const receiptLock = useRef(false), photoVersion = useRef(0);
  useEffect(() => { setLast(lastFill); }, [lastFill]);
  useEffect(() => {
    if (!f.litres && !f.odo && !f.amount && !f.station && !photo) receiptVehicle.current = vehicleId;
  }, [vehicleId, f.litres, f.odo, f.amount, f.station, photo]);
  const draftScope = !demo && !preview ? queueScope : undefined;
  const [draftReady, setDraftReady] = useState(!draftScope), [draftError, setDraftError] = useState(false);
  useEffect(() => {
    if (!draftScope) return;
    let active = true;
    void loadReceiptDraft(draftScope).then(d => {
      if (!active || !d) return;
      receiptVehicle.current = d.vehicleId; idem.current = d.key;
      setF(d.fields); setPhoto(d.photo); setCur(d.currency); setRDate(d.date); setRPlate(d.plate); setAiOk(d.aiOk); setForm(d.form);
    }).catch(() => { if (active) setDraftError(true); }).finally(() => { if (active) setDraftReady(true); });
    return () => { active = false; };
  }, [draftScope]);
  useEffect(() => {
    if (!draftScope || !draftReady) return;
    void saveReceiptDraft(draftScope, { vehicleId: receiptVehicle.current, key: idem.current, form, fields: f, photo, currency: cur, date: rDate, plate: rPlate, aiOk }).catch(() => setDraftError(true));
  }, [draftScope, draftReady, form, f, photo, cur, rDate, rPlate, aiOk]);
  const [priv, setPriv] = useState(!!initial?.priv);
  // demo: km azi = exact valoarea de pe harta live (aceeași sursă: liveFleet), nu crește în pauza privată
  const shownKm = demoKm != null ? demoKm : km;
  // ore azi: baza calculată pe server (tură ∩ azi, fără pauze) + timpul curs de atunci doar cât e în tură și nu e privat
  const work = useRef<{ ms: number; since: number | null }>({ ms: (today?.hours ?? 0) * 3600000, since: initial && !initial.priv ? serverNow : null });
  const pauseWork = (t = Date.now()) => { const w = work.current; if (w.since !== null) { w.ms += Math.max(0, t - w.since); w.since = null; } };
  useEffect(() => { setNow(Date.now()); const i = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(i); }, []);

  const shiftBusy = useRef(false);
  const [askEnd, setAskEnd] = useState(false);
  const { gps, lastAck } = useDriverTracking();
  // Ignore snapshots racing a local action briefly; do not compare phone and server clocks.
  useEffect(() => {
    if (shiftBusy.current || Date.now() - mutationAt.current < 5000) return;
    setOn(!!initial); setPriv(!!initial?.priv);
    setKm(today?.km ?? 0);
    work.current = { ms: (today?.hours ?? 0) * 3600000, since: initial && !initial.priv ? serverNow : null };
    window.dispatchEvent(new CustomEvent("qf-shift", { detail: !!initial && !initial.priv }));
  }, [serverNow, initial?.start, initial?.priv, today?.km, today?.hours, vehicleId]); // eslint-disable-line react-hooks/exhaustive-deps
  const endDialog = useRef<HTMLDialogElement>(null);
  const shiftTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!askEnd) return; const dialog = endDialog.current, trigger = shiftTrigger.current; dialog?.showModal(); document.documentElement.classList.add("msheet-open"); return () => { dialog?.close(); document.documentElement.classList.remove("msheet-open"); trigger?.focus(); }; }, [askEnd]);
  // „Termină tura”: întâi confirmare (foaie proprie), abia apoi oprim tura
  function toggle() { if (on && !preview) { setAskEnd(true); return; } void doToggle(); }
  async function doToggle() {
    if (!on && checks.length < 3) { setMsg({ t: L["drv.checkNeeded"], k: "err" }); return; }
    if (preview) { setMsg({ t: L["drv.previewNo"], k: "warn" }); return; }
    if (shiftBusy.current) return;
    shiftBusy.current = true;
    const next = !on;
    if (!next) window.dispatchEvent(new Event("qf-tracking-pause"));
    const rs = await fetch("/api/driver/shift", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ vehicleId, action: next ? "start" : "stop", checklist: checks }) }).catch(() => null);
    shiftBusy.current = false;
    if (!rs?.ok) { window.dispatchEvent(new CustomEvent("qf-shift", { detail: on && !priv })); setMsg({ t: rs?.status === 409 || rs?.status === 403 ? L["drv.role"] : L["drv.invalid"], k: "err" }); return; }
    mutationAt.current = Date.now();
    setPriv(false);
    setOn(next); setMsg({ t: "", k: "" }); window.dispatchEvent(new CustomEvent("qf-shift", { detail: next }));
    if (next) { work.current.since = Date.now(); }
    else pauseWork();
    window.dispatchEvent(new Event("qf-refresh"));
  }
  async function togglePriv() {
    if (preview) { setMsg({ t: L["drv.previewNo"], k: "warn" }); return; }
    if (shiftBusy.current) return;
    shiftBusy.current = true;
    const next = !priv;
    if (next) window.dispatchEvent(new Event("qf-tracking-pause"));
    const r = await fetch("/api/driver/private", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ vehicleId, on: next }) }).catch(() => null);
    shiftBusy.current = false;
    if (!r?.ok) { window.dispatchEvent(new CustomEvent("qf-shift", { detail: on && !priv })); setMsg({ t: r?.status === 409 ? L["drv.role"] : L["drv.invalid"], k: "err" }); return; }
    mutationAt.current = Date.now();
    if (next) pauseWork(); else if (on) work.current.since = Date.now();
    setPriv(next); window.dispatchEvent(new CustomEvent("qf-shift", { detail: on && !next }));
    window.dispatchEvent(new Event("qf-refresh"));
  }
  async function onPhoto(file0: File | null) {
    const version = ++photoVersion.current;
    setPhoto(file0); setRead(""); setReadInfo(""); setAiOk(false); setCur("RON"); setRDate("");
    if (!file0) return;
    const manual = (m: string, preserve = false) => { if (version !== photoVersion.current) return; if (!preserve) setPhoto(null); setRead(m); if (!preserve) setF((x) => ({ ...x, litres: "", odo: "", amount: "", station: "" })); };
    // validare înainte de orice: mărime, apoi conținutul real (primii octeți), nu extensia
    if (file0.size > MAX_PHOTO_IN) return manual(L["drv.tooBig"]);
    const head = new Uint8Array(await file0.slice(0, 16).arrayBuffer());
    if (version !== photoVersion.current) return;
    const kind = sniffImage(head);
    if (!kind) return manual(L["drv.notImage"]);
    setRead(L["drv.reading"]);
    const file = await shrinkImage(file0);
    const blank = await blankImage(file);
    if (version !== photoVersion.current) return;
    if (blank === null && kind !== "heic") return manual(L["drv.notImage"]);
    if (blank) return manual(L["drv.notReceipt"]);
    setPhoto(file);
    const fd = new FormData(); fd.append("photo", file);
    try {
      const r = await fetch("/api/receipt/extract", { method: "POST", body: fd, cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (version !== photoVersion.current) return;
      if (r.ok && j.fields) {
        const x0 = j.fields as { currency?: string | null; operator?: string | null; station?: string | null; date?: string | null; plate?: string | null; litres?: number | null; amount?: number | null; odometerKm?: number | null };
        // operator și stație separate: „Petrom Oradea 3”, nu două rânduri lipite
        const st = [x0.operator, x0.station && x0.operator && x0.station.toLowerCase().startsWith(x0.operator.toLowerCase()) ? x0.station.slice(x0.operator.length).trim() : x0.station].filter(Boolean).join(" ").slice(0, 80);
        setF((x) => ({ litres: x0.litres?.toString() ?? x.litres, odo: x0.odometerKm?.toString() ?? x.odo, amount: x0.amount?.toString() ?? x.amount, station: st || x.station }));
        const norm = (p: string) => p.replace(/[^A-Z0-9]/gi, "").toUpperCase();
        const meta = [x0.date ? x0.date.split("-").reverse().join(".") : null, x0.plate ? `${x0.plate}${norm(x0.plate) !== norm(vehicleName) ? ` ≠ ${vehicleName}` : ""}` : null].filter(Boolean).join(" · ");
        setReadInfo(meta);
        setRPlate(x0.plate ?? ""); if (x0.currency && CURS.includes(x0.currency)) setCur(x0.currency); if (x0.date) setRDate(x0.date);
        // exemplul demo NU e etichetat ca citire AI (nici în mesaj, nici în aiRead)
        setAiOk(!j.sample); setRead(j.sample ? L["drv.sample"] : L["drv.read"]);
      } else manual(r.status === 413 ? L["drv.tooBig"] : r.status === 415 ? L["drv.notImage"] : r.status === 422 ? L["drv.notReceipt"] : L["drv.readManual"], ![413, 415, 422].includes(r.status));
    } catch { manual(L["drv.readManual"], true); }
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draftReady || receiptLock.current || busy || read === L["drv.reading"]) return; // lock before the first asynchronous write
    if (receiptVehicle.current !== vehicleId) { setFormErr(tri(loc, "Camionul atribuit s-a schimbat. Bonul este păstrat în formular; verifică alocarea înainte de trimitere.|Assigned truck changed. Your receipt stays in the form; check the assignment before sending.|Przypisany pojazd zmienił się. Paragon pozostaje w formularzu; sprawdź przypisanie przed wysłaniem.")); return; }
    const litres = Number(f.litres.replace(",", ".")), odoS = f.odo.replace(/[\s.]/g, ""), odo = Number(odoS);
    if (!(litres >= 1 && litres <= 2000)) { setFormErr(L["drv.litresRange"]); return; }
    if (!/^\d+$/.test(odoS) || !(odo >= 1 && odo <= 5_000_000)) { setFormErr(L["drv.odoRange"]); return; }
    const amount = f.amount.trim() ? Number(f.amount.replace(",", ".")) : null;
    if (amount !== null && (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000)) { setFormErr(tri(loc, "Verifică suma bonului: trebuie să fie un număr pozitiv.|Check the receipt amount: enter a positive number.|Sprawdź kwotę paragonu: wpisz liczbę dodatnią.")); return; }
    receiptLock.current = true;
    setFormErr(""); setBusy(true);
    try {
      const fd = new FormData();
      fd.append("vehicleId", vehicleId); if (rPlate && aiOk) fd.append("plate", rPlate.slice(0, 20)); fd.append("litres", String(litres)); fd.append("odometerKm", String(odo)); fd.append("station", f.station.trim().slice(0, 80)); fd.append("amount", f.amount.replace(",", ".")); fd.append("aiRead", String(aiOk)); fd.append("key", idem.current); fd.append("currency", cur); if (rDate) fd.append("date", rDate);
      if (photo) fd.append("photo", photo);
      if (queueScope && actorId && !demo && !preview) {
        if (!rDate) fd.set("date", localNow().slice(0,10));
        await enqueue({ id: idem.current, scope: queueScope, actorId, kind: "fill", label: `${litres} L · ${vehicleName}`, payload: [...fd.entries()] });
        photoVersion.current++; idem.current = newKey(); setMsg({ t: tri(loc, "Bon salvat pe telefon. Verifică Sincronizare pentru confirmarea trimiterii.|Receipt saved on device. Check Sync for delivery confirmation.|Paragon zapisano na urządzeniu. Sprawdź synchronizację."), k: "warn" });
        setForm(false); setF({ litres: "", odo: "", amount: "", station: "" }); setPhoto(null); setRead(""); setAiOk(false); setRDate(""); setCur("RON");
        if (navigator.onLine) void flushOutbox(queueScope).catch(() => {});
        return;
      }
      const r = await fetch("/api/driver/fill", { method: "POST", body: fd }).catch(() => null);
      const j = r ? await r.json().catch(() => ({})) : {};
      if (r?.ok) { photoVersion.current++; idem.current = newKey(); const fid = (j.id ?? j.fill?.id) as string | undefined; if (photo && fid && !j.dup) void saveThumb(fid, photo); const fx = j.fx as { currency: string; amountRon: number | null; fxRate: number | null; fxDate: string | null; ok: boolean } | null;
        const fxT = fx ? (fx.ok && fx.amountRon != null ? " " + L["drv.fxOk"].replace("{ron}", fmtNum(loc, fx.amountRon, 2)).replace("{rate}", fmtNum(loc, fx.fxRate ?? 0, 4)).replace(/\{cur\}/g, fx.currency).replace("{date}", (fx.fxDate ?? "").split("-").reverse().join(".")) : " " + L["drv.fxNo"].replace("{cur}", fx.currency)) : "";
        setMsg({ t: (j.dup ? L["drv.dup"] : L["drv.sent"]) + fxT, k: fx && !fx.ok ? "warn" : "ok" }); setCur("RON"); setRDate(""); setLast(`${fmtNum(loc, litres, litres % 1 ? 1 : 0)} L · ${f.station.trim().slice(0, 80) || "—"}`); setForm(false); setF({ litres: "", odo: "", amount: "", station: "" }); setPhoto(null); setRead(""); setAiOk(false); }
      else { if (r?.status === 409) setMsg({ t: "", k: "" }); setFormErr(r?.status === 409 ? L["drv.role"] : r?.status === 413 ? L["drv.tooBig"] : L["drv.invalid"]); }
    } catch { setFormErr(tri(loc, "Bonul nu a putut fi păstrat pe telefon. Nu închide formularul; încearcă din nou.|Could not save the receipt on this device. Keep the form open and retry.|Nie udało się zapisać paragonu. Nie zamykaj formularza i spróbuj ponownie.")); } finally { receiptLock.current = false; setBusy(false); }
  }
  const trackingOk = gps === "ok" && lastAck !== null && now - lastAck < 90000;
  const w = work.current, hours = (w.ms + (w.since !== null ? Math.max(0, now - w.since) : 0)) / 3600000;
  return (
    <div className="phone">
      {preview ? <div className="pvbar fade" role="note"><b>{L["drv.preview"]}</b><span>{L["drv.previewHint"]}</span></div> : null}
      <div className="eyebrow fade">{vehicleName}</div>
      <h1 className="fade" style={{ fontWeight: 300, fontSize: 40, letterSpacing: "-.02em", marginTop: 8 }}>{hello}</h1>
      <div className="pill fade d1" style={{ marginTop: 14 }}><span className="dot" style={{ background: on ? "var(--pos)" : "var(--fg3)", margin: 0 }} />{on ? L["drv.onShift"] : L["drv.offShift"]}</div>
      {!on && !preview && switchTo && switchTo.length ? (
        <div className="drvtruck fade d1">
          <div><span className="eyebrow">{L["drv.truckQ"]}</span><b>{vehicleName}</b></div>
          <details><summary className="btn sec sm">{L["drv.truckChange"]}</summary><div className="drvtruck-list">{switchTo.map((x) => <a key={x.id} href={`/driver?v=${x.id}`} className="btn sec sm">{x.name}</a>)}</div></details>
        </div>
      ) : null}
      {!on || priv ? (
        <div className={`privbox fade d1${priv ? " on" : ""}`} role="status"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c5 0 9 5 9 7a10 10 0 0 1-2.6 3.5M6.1 6.4C4 7.8 3 10.7 3 12c0 2 4 7 9 7 1.5 0 2.9-.4 4.1-1" /></svg><div><b>{L["priv.on"]}</b><span>{priv ? L["priv.break"] : L["priv.offShift"]}</span><small className="geo-off">⌀ {L["priv.geoOff"]}</small></div></div>
      ) : <div className="privbox track fade d1" role="status"><span className="dot" style={{ background: demo || trackingOk ? "var(--pos)" : "var(--fg3)", margin: 0 }} /><div><b>{gps === "error" && !demo ? tri(loc, "Poziția nu este confirmată de server|Position not confirmed by server|Pozycja niepotwierdzona przez serwer") : L["priv.tracking" + (demo || trackingOk ? "" : gps === "off" ? "Off" : "Wait")]}</b><span>{L[gps === "off" && !demo ? "priv.trackingOffHint" : "priv.trackingHint"]}</span></div></div>}
      <div className="driver-stats fade d1">
        <div><div className="drv-big" suppressHydrationWarning>{fmtNum(loc, shownKm, 1)}</div><div className="eyebrow">{L["drv.kmToday"]}</div></div>
        <div><div className="drv-big" style={{ color: "var(--fg2)" }} suppressHydrationWarning>{fmtNum(loc, hours, 1)}<span style={{ fontSize: ".5em" }}>h</span></div><div className="eyebrow">{L["drv.hoursToday"]}</div></div>
      </div>
      {!on ? (
        <div className="sheet fade d2">
          <div className="eyebrow">{L["drv.check"]}</div>
          {CHECKS.map((c) => <div key={c} className="chkrow" role="checkbox" aria-checked={checks.includes(c)} tabIndex={0} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); e.currentTarget.click(); } }} onClick={() => setChecks((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]))}><span>{L[c]}</span><span className={`chkbox${checks.includes(c) ? " on" : ""}`}>{checks.includes(c) ? <Icon name="check" /> : null}</span></div>)}
        </div>
      ) : null}
      <div className="fade d2" style={{ marginTop: 16, display: "grid", gap: 12 }}>
        <button ref={shiftTrigger} className="btn pri start" style={on ? { background: "var(--neg)" } : undefined} onClick={toggle}>{on ? L["drv.stop"] : L["drv.start"]}</button>
        {askEnd ? <dialog ref={endDialog} className="msheet-bg any" aria-labelledby="endq" onCancel={() => setAskEnd(false)} onClick={(e) => { if (e.target === e.currentTarget) setAskEnd(false); }}><div className="msheet endsheet" onClick={(e) => e.stopPropagation()}>
          <div className="msheet-grab" /><h3 id="endq">{L["drv.endQ"]}</h3><p>{L["drv.endTxt"]}</p>
          <button className="btn pri danger" autoFocus onClick={() => { setAskEnd(false); void doToggle(); }}>{L["drv.endYes"]}</button>
          <button className="btn sec" onClick={() => setAskEnd(false)}>{L["drv.endNo"]}</button>
        </div></dialog> : null}
        {on ? <button className={`btn sec start privbtn${priv ? " on" : ""}`} onClick={togglePriv} aria-pressed={priv}>{priv ? L["priv.resume"] : L["priv.toggle"]}</button> : null}
        <button className="btn sec start" disabled={!draftReady} onClick={() => setForm((x) => !x)}><Icon name="fuel" size={20} /><span>{L["drv.fill"]}</span></button>
      </div>
      {msg.t ? <p className={`msg ${msg.k}`}>{msg.t}</p> : null}
      {draftError ? <p className="msg warn" role="alert">{tri(loc, "Salvarea automată pe telefon nu este disponibilă. Păstrează pagina deschisă până trimiți bonul.|Autosave is unavailable. Keep this page open until you send the receipt.|Automatyczny zapis jest niedostępny. Nie zamykaj strony przed wysłaniem paragonu.")}</p> : null}
      {form && draftReady ? (
        <form className="sheet fade" onSubmit={send}>
          <label className="field receipt-photo" style={{ paddingTop: 0, cursor: "pointer" }}><span>{L["drv.photo"]}<br /><small style={{ color: "var(--fg3)" }}>{photo ? photo.name : L["drv.photoHint"]}</small></span><span className="ico" style={{ background: "var(--bg3)" }}><Icon name="camera" /></span><input type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPhoto(e.target.files?.[0] ?? null)} /></label>
          {read ? <p className="msg">{read}{readInfo ? <><br /><small style={{ color: "var(--fg2)" }}>{L["drv.readMeta"]}: {readInfo}</small></> : null}</p> : null}
          {([["litres", "drv.litres", "decimal"], ["odo", "drv.odo", "numeric"], ["amount", "drv.amount", "decimal"], ["station", "drv.station", "text"]] as const).map(([k, lab, mode]) => (
            <label key={k} className="field receipt-field"><span>{L[lab]}</span>{k === "amount" ? <select className="tsel cursel" aria-label={L["drv.cur"]} value={cur} onChange={(e) => setCur(e.target.value)}>{CURS.map((c) => <option key={c} value={c}>{c === "RON" ? "lei" : c}</option>)}</select> : null}<input className="input" aria-label={L[lab]} inputMode={mode} maxLength={k === "station" ? 80 : 12} value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} /></label>
          ))}
          {formErr ? <p className="msg err" role="alert">{formErr}</p> : null}
          <button className="btn pri start" style={{ height: 60, marginTop: 8 }} disabled={busy || preview || read === L["drv.reading"]} aria-busy={busy} title={preview ? L["drv.previewNo"] : undefined}>{busy ? L["drv.sending"] : L["drv.send"]}</button>
        </form>
      ) : null}
      <div className="sheet fade d3"><div className="field" style={{ padding: "4px 0" }}><span style={{ whiteSpace: "nowrap" }}>{L["drv.lastFill"]}</span><span className="ell" title={last} style={{ color: "var(--fg2)", fontSize: 14 }}>{last}</span></div></div>
      <p className="sub" style={{ fontSize: 12, marginTop: 20, textAlign: "center" }}>{L["drv.consent"]}</p>
    </div>
  );
}

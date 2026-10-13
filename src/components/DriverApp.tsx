"use client";
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
const CHECKS = ["chk.tyres", "chk.fluids", "chk.docs", "chk.damage"];
function hav(a: [number, number], b: [number, number]) {
  const R = 6371, r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
export function DriverApp({ vehicleId, vehicleName, hello, labels: L, lastFill, loc, initial, demoKm, serverNow, demo }: { demo?: boolean; serverNow: number; demoKm?: number | null; initial?: { start: string; priv: boolean } | null; vehicleId: string; vehicleName: string; hello: string; labels: Record<string, string>; lastFill: string; loc: Locale }) {
  const [on, setOn] = useState(!!initial), [start, setStart] = useState<number | null>(initial ? Date.parse(initial.start) || Date.now() : null), [km, setKm] = useState(0), [now, setNow] = useState(serverNow); // același „acum” ca pe server → hidratare identică; apoi ceasul real
  const [checks, setChecks] = useState<string[]>([]), [msg, setMsg] = useState<{ t: string; k: "ok" | "err" | "warn" | "" }>({ t: "", k: "" });
  const [form, setForm] = useState(false), [f, setF] = useState({ litres: "", odo: "", amount: "", station: "" }), [photo, setPhoto] = useState<File | null>(null), [read, setRead] = useState(""), [readInfo, setReadInfo] = useState(""), [last, setLast] = useState(lastFill);
  const [aiOk, setAiOk] = useState(false), [busy, setBusy] = useState(false), [formErr, setFormErr] = useState(""), idem = useRef(newKey()), [cur, setCur] = useState("RON"), [rDate, setRDate] = useState("");
  const [priv, setPriv] = useState(!!initial?.priv);
  // demo: km azi = exact valoarea de pe harta live (aceeași sursă: liveFleet), nu crește în pauza privată
  const shownKm = demoKm != null ? (on ? demoKm : 0) : km;
  const privRef = useRef(!!initial?.priv);
  const lastPos = useRef<[number, number] | null>(null), watch = useRef<number | null>(null);
  useEffect(() => { setNow(Date.now()); const i = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(i); }, []);
  useEffect(() => () => { if (watch.current != null) navigator.geolocation?.clearWatch(watch.current); }, []);

  async function toggle() {
    if (!on && checks.length < 3) { setMsg({ t: L["drv.checkNeeded"], k: "err" }); return; }
    const next = !on;
    setPriv(false); privRef.current = false;
    setOn(next); setMsg({ t: "", k: "" }); window.dispatchEvent(new CustomEvent("qf-shift", { detail: next }));
    await fetch("/api/driver/shift", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ vehicleId, action: next ? "start" : "stop", checklist: checks }) }).catch(() => null);
    if (next) {
      setStart(Date.now()); setKm(0); lastPos.current = null;
    }
  }
  function startWatch() {
      if (!navigator.geolocation) { setMsg({ t: L["drv.gpsOff"], k: "" }); return; }
      if (watch.current != null) return;
      watch.current = navigator.geolocation.watchPosition((p) => {
        const here: [number, number] = [p.coords.latitude, p.coords.longitude];
        if (lastPos.current && p.coords.accuracy < 60) setKm((k) => k + hav(lastPos.current!, here));
        lastPos.current = here;
        if (privRef.current) return; // modul privat: nu se trimite nimic
        fetch("/api/driver/ping", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ vehicleId, lat: here[0], lng: here[1], speed: p.coords.speed }) }).catch(() => null);
      }, () => setMsg({ t: L["drv.gpsOff"], k: "" }), { enableHighAccuracy: true, maximumAge: 15000 });
  }
  // GDPR: GPS-ul e pornit DOAR în tură și în afara pauzei private; altfel watch-ul e oprit complet (nici nu se cere locația)
  useEffect(() => {
    // demo: fără GPS real deloc (km vin din aceeași sursă ca harta live) — nicio cerere de permisiune în prezentări
    if (on && !priv && !demo) { startWatch(); return; }
    setMsg((x) => (x.t === L["drv.gpsOff"] ? { t: "", k: "" } : x)); // mesajul GPS vechi nu rămâne pe ecran în privat / după tură
    if (watch.current != null) { navigator.geolocation?.clearWatch(watch.current); watch.current = null; }
    lastPos.current = null;
  }, [on, priv]); // eslint-disable-line react-hooks/exhaustive-deps
  async function togglePriv() {
    const next = !priv;
    const r = await fetch("/api/driver/private", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ vehicleId, on: next }) }).catch(() => null);
    if (!r?.ok) { setMsg({ t: L["drv.invalid"], k: "err" }); return; }
    setPriv(next); privRef.current = next; window.dispatchEvent(new CustomEvent("qf-shift", { detail: on && !next }));
  }
  async function onPhoto(file0: File | null) {
    setPhoto(file0); setRead(""); setReadInfo(""); setAiOk(false); setCur("RON"); setRDate("");
    if (!file0) return;
    const manual = (m: string) => { setPhoto(null); setRead(m); setF((x) => ({ ...x, litres: "", odo: "", amount: "", station: "" })); };
    // validare înainte de orice: mărime, apoi conținutul real (primii octeți), nu extensia
    if (file0.size > MAX_PHOTO_IN) return manual(L["drv.tooBig"]);
    const head = new Uint8Array(await file0.slice(0, 16).arrayBuffer());
    const kind = sniffImage(head);
    if (!kind) return manual(L["drv.notImage"]);
    setRead(L["drv.reading"]);
    const file = await shrinkImage(file0);
    const blank = await blankImage(file);
    if (blank === null && kind !== "heic") return manual(L["drv.notImage"]);
    if (blank) return manual(L["drv.notReceipt"]);
    setPhoto(file);
    const fd = new FormData(); fd.append("photo", file);
    try {
      const r = await fetch("/api/receipt/extract", { method: "POST", body: fd, cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.fields) {
        const x0 = j.fields as { currency?: string | null; operator?: string | null; station?: string | null; date?: string | null; plate?: string | null; litres?: number | null; amount?: number | null; odometerKm?: number | null };
        // operator și stație separate: „Petrom Oradea 3”, nu două rânduri lipite
        const st = [x0.operator, x0.station && x0.operator && x0.station.toLowerCase().startsWith(x0.operator.toLowerCase()) ? x0.station.slice(x0.operator.length).trim() : x0.station].filter(Boolean).join(" ").slice(0, 80);
        setF((x) => ({ litres: x0.litres?.toString() ?? x.litres, odo: x0.odometerKm?.toString() ?? x.odo, amount: x0.amount?.toString() ?? x.amount, station: st || x.station }));
        const norm = (p: string) => p.replace(/[^A-Z0-9]/gi, "").toUpperCase();
        const meta = [x0.date ? x0.date.split("-").reverse().join(".") : null, x0.plate ? `${x0.plate}${norm(x0.plate) !== norm(vehicleName) ? ` ≠ ${vehicleName}` : ""}` : null].filter(Boolean).join(" · ");
        setReadInfo(meta);
        if (x0.currency && CURS.includes(x0.currency)) setCur(x0.currency); if (x0.date) setRDate(x0.date);
        // exemplul demo NU e etichetat ca citire AI (nici în mesaj, nici în aiRead)
        setAiOk(!j.sample); setRead(j.sample ? L["drv.sample"] : L["drv.read"]);
      } else manual(r.status === 413 ? L["drv.tooBig"] : r.status === 415 ? L["drv.notImage"] : r.status === 422 ? L["drv.notReceipt"] : L["drv.readManual"]);
    } catch { manual(L["drv.readManual"]); }
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return; // dublu-clic: o singură trimitere
    const litres = Number(f.litres.replace(",", ".")), odoS = f.odo.replace(/[\s.]/g, ""), odo = Number(odoS);
    if (!(litres >= 1 && litres <= 2000)) { setFormErr(L["drv.litresRange"]); return; }
    if (!/^\d+$/.test(odoS) || !(odo >= 1 && odo <= 5_000_000)) { setFormErr(L["drv.odoRange"]); return; }
    setFormErr(""); setBusy(true);
    try {
      const fd = new FormData();
      fd.append("vehicleId", vehicleId); fd.append("litres", String(litres)); fd.append("odometerKm", String(odo)); fd.append("station", f.station.trim().slice(0, 80)); fd.append("amount", f.amount.replace(",", ".")); fd.append("aiRead", String(aiOk)); fd.append("key", idem.current); fd.append("currency", cur); if (rDate) fd.append("date", rDate);
      if (photo) fd.append("photo", photo);
      const r = await fetch("/api/driver/fill", { method: "POST", body: fd }).catch(() => null);
      const j = r ? await r.json().catch(() => ({})) : {};
      if (r?.ok) { idem.current = newKey(); const fx = j.fx as { currency: string; amountRon: number | null; fxRate: number | null; fxDate: string | null; ok: boolean } | null;
        const fxT = fx ? (fx.ok && fx.amountRon != null ? " " + L["drv.fxOk"].replace("{ron}", fmtNum(loc, fx.amountRon, 2)).replace("{rate}", fmtNum(loc, fx.fxRate ?? 0, 4)).replace(/\{cur\}/g, fx.currency).replace("{date}", (fx.fxDate ?? "").split("-").reverse().join(".")) : " " + L["drv.fxNo"].replace("{cur}", fx.currency)) : "";
        setMsg({ t: (j.dup ? L["drv.dup"] : L["drv.sent"]) + fxT, k: fx && !fx.ok ? "warn" : "ok" }); setCur("RON"); setRDate(""); setLast(`${fmtNum(loc, litres, litres % 1 ? 1 : 0)} L · ${f.station.trim().slice(0, 80) || "—"}`); setForm(false); setF({ litres: "", odo: "", amount: "", station: "" }); setPhoto(null); setRead(""); setAiOk(false); }
      else setFormErr(r?.status === 413 ? L["drv.tooBig"] : L["drv.invalid"]);
    } finally { setBusy(false); }
  }
  const hours = start ? (now - start) / 3600000 : 0;
  return (
    <div className="phone">
      <div className="eyebrow fade">{vehicleName}</div>
      <h1 className="fade" style={{ fontWeight: 300, fontSize: 40, letterSpacing: "-.02em", marginTop: 8 }}>{hello}</h1>
      <div className="pill fade d1" style={{ marginTop: 14 }}><span className="dot" style={{ background: on ? "var(--pos)" : "var(--fg3)", margin: 0 }} />{on ? L["drv.onShift"] : L["drv.offShift"]}</div>
      {!on || priv ? (
        <div className={`privbox fade d1${priv ? " on" : ""}`} role="status"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c5 0 9 5 9 7a10 10 0 0 1-2.6 3.5M6.1 6.4C4 7.8 3 10.7 3 12c0 2 4 7 9 7 1.5 0 2.9-.4 4.1-1" /></svg><div><b>{L["priv.on"]}</b><span>{priv ? L["priv.break"] : L["priv.offShift"]}</span><small className="geo-off">⌀ {L["priv.geoOff"]}</small></div></div>
      ) : <div className="privbox track fade d1" role="status"><span className="dot" style={{ background: "var(--pos)", margin: 0 }} /><div><b>{L["priv.tracking"]}</b><span>{L["priv.trackingHint"]}</span></div></div>}
      <div className="fade d1" style={{ marginTop: 40, display: "flex", gap: 40 }}>
        <div><div className="drv-big" suppressHydrationWarning>{fmtNum(loc, shownKm, 1)}</div><div className="eyebrow">{L["drv.kmToday"]}</div></div>
        <div><div className="drv-big" style={{ color: "var(--fg2)" }} suppressHydrationWarning>{fmtNum(loc, hours, 1)}<span style={{ fontSize: ".5em" }}>h</span></div><div className="eyebrow">{L["drv.hoursToday"]}</div></div>
      </div>
      {!on ? (
        <div className="sheet fade d2">
          <div className="eyebrow">{L["drv.check"]}</div>
          {CHECKS.map((c) => <div key={c} className="chkrow" role="checkbox" aria-checked={checks.includes(c)} tabIndex={0} onClick={() => setChecks((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]))}><span>{L[c]}</span><span className={`chkbox${checks.includes(c) ? " on" : ""}`}>{checks.includes(c) ? <Icon name="check" /> : null}</span></div>)}
        </div>
      ) : null}
      <div className="fade d2" style={{ marginTop: 16, display: "grid", gap: 12 }}>
        <button className="btn pri start" style={on ? { background: "var(--neg)" } : undefined} onClick={toggle}>{on ? L["drv.stop"] : L["drv.start"]}</button>
        {on ? <button className={`btn sec start privbtn${priv ? " on" : ""}`} onClick={togglePriv} aria-pressed={priv}>{priv ? L["priv.resume"] : L["priv.toggle"]}</button> : null}
        <button className="btn sec start" onClick={() => setForm((x) => !x)}><Icon name="fuel" size={20} /><span>{L["drv.fill"]}</span></button>
      </div>
      {msg.t ? <p className={`msg ${msg.k}`}>{msg.t}</p> : null}
      {form ? (
        <form className="sheet fade" onSubmit={send}>
          <label className="field" style={{ paddingTop: 0, cursor: "pointer" }}><span>{L["drv.photo"]}<br /><small style={{ color: "var(--fg3)" }}>{photo ? photo.name : L["drv.photoHint"]}</small></span><span className="ico" style={{ background: "var(--bg3)" }}><Icon name="camera" /></span><input type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPhoto(e.target.files?.[0] ?? null)} /></label>
          {read ? <p className="msg">{read}{readInfo ? <><br /><small style={{ color: "var(--fg2)" }}>{L["drv.readMeta"]}: {readInfo}</small></> : null}</p> : null}
          {([["litres", "drv.litres", "decimal"], ["odo", "drv.odo", "numeric"], ["amount", "drv.amount", "decimal"], ["station", "drv.station", "text"]] as const).map(([k, lab, mode]) => (
            <label key={k} className="field"><span>{L[lab]}</span>{k === "amount" ? <select className="tsel cursel" aria-label={L["drv.cur"]} value={cur} onChange={(e) => setCur(e.target.value)}>{CURS.map((c) => <option key={c} value={c}>{c === "RON" ? "lei" : c}</option>)}</select> : null}<input className="input" inputMode={mode} maxLength={k === "station" ? 80 : 12} value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} /></label>
          ))}
          {formErr ? <p className="msg err" role="alert">{formErr}</p> : null}
          <button className="btn pri start" style={{ height: 60, marginTop: 8 }} disabled={busy} aria-busy={busy}>{busy ? L["drv.sending"] : L["drv.send"]}</button>
        </form>
      ) : null}
      <div className="sheet fade d3"><div className="field" style={{ padding: "4px 0" }}><span style={{ whiteSpace: "nowrap" }}>{L["drv.lastFill"]}</span><span className="ell" title={last} style={{ color: "var(--fg2)", fontSize: 14 }}>{last}</span></div></div>
      <p className="sub" style={{ fontSize: 12, marginTop: 20, textAlign: "center" }}>{L["drv.consent"]}</p>
    </div>
  );
}

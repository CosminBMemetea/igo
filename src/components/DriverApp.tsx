"use client";
import { useEffect, useRef, useState } from "react";
import { shrinkImage } from "@/lib/shrink";
import { fmtNum, type Locale } from "@/lib/i18n";
import { Icon } from "./icons";

const CHECKS = ["chk.tyres", "chk.fluids", "chk.docs", "chk.damage"];
function hav(a: [number, number], b: [number, number]) {
  const R = 6371, r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
export function DriverApp({ vehicleId, vehicleName, hello, labels: L, lastFill, loc, initial, demoKm, serverNow }: { serverNow: number; demoKm?: number | null; initial?: { start: string; priv: boolean } | null; vehicleId: string; vehicleName: string; hello: string; labels: Record<string, string>; lastFill: string; loc: Locale }) {
  const [on, setOn] = useState(!!initial), [start, setStart] = useState<number | null>(initial ? Date.parse(initial.start) || Date.now() : null), [km, setKm] = useState(0), [now, setNow] = useState(serverNow); // același „acum” ca pe server → hidratare identică; apoi ceasul real
  const [checks, setChecks] = useState<string[]>([]), [msg, setMsg] = useState<{ t: string; k: "ok" | "err" | "" }>({ t: "", k: "" });
  const [form, setForm] = useState(false), [f, setF] = useState({ litres: "", odo: "", amount: "", station: "" }), [photo, setPhoto] = useState<File | null>(null), [read, setRead] = useState(""), [readInfo, setReadInfo] = useState(""), [last, setLast] = useState(lastFill);
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
    if (on && !priv) { startWatch(); return; }
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
    setPhoto(file0); setRead(""); setReadInfo("");
    if (!file0) return;
    setRead(L["drv.reading"]);
    const file = await shrinkImage(file0); setPhoto(file);
    const fd = new FormData(); fd.append("photo", file);
    try {
      const r = await fetch("/api/receipt/extract", { method: "POST", body: fd, cache: "no-store" });
      const j = await r.json();
      if (r.ok && j.fields) {
        const x0 = j.fields as { operator?: string | null; station?: string | null; date?: string | null; plate?: string | null; litres?: number | null; amount?: number | null; odometerKm?: number | null };
        // operator și stație separate: „Petrom Oradea 3”, nu două rânduri lipite
        const st = [x0.operator, x0.station && x0.operator && x0.station.toLowerCase().startsWith(x0.operator.toLowerCase()) ? x0.station.slice(x0.operator.length).trim() : x0.station].filter(Boolean).join(" ");
        setF((x) => ({ litres: x0.litres?.toString() ?? x.litres, odo: x0.odometerKm?.toString() ?? x.odo, amount: x0.amount?.toString() ?? x.amount, station: st || x.station }));
        const norm = (p: string) => p.replace(/[^A-Z0-9]/gi, "").toUpperCase();
        const meta = [x0.date ? x0.date.split("-").reverse().join(".") : null, x0.plate ? `${x0.plate}${norm(x0.plate) !== norm(vehicleName) ? ` ≠ ${vehicleName}` : ""}` : null].filter(Boolean).join(" · ");
        setReadInfo(meta);
        setRead(j.sample ? L["drv.sample"] : L["drv.read"]);
      } else setRead(L["drv.readManual"]);
    } catch { setRead(L["drv.readManual"]); }
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const litres = Number(f.litres.replace(",", ".")), odo = Number(f.odo.replace(/\D/g, ""));
    if (!(litres > 0) || !(odo > 0)) { setMsg({ t: L["drv.invalid"], k: "err" }); return; }
    const fd = new FormData();
    fd.append("vehicleId", vehicleId); fd.append("litres", String(litres)); fd.append("odometerKm", String(odo)); fd.append("station", f.station); fd.append("amount", f.amount.replace(",", ".")); fd.append("aiRead", String(read === L["drv.read"]));
    if (photo) fd.append("photo", photo);
    const r = await fetch("/api/driver/fill", { method: "POST", body: fd });
    if (r.ok) { setMsg({ t: L["drv.sent"], k: "ok" }); setLast(`${fmtNum(loc, litres, litres % 1 ? 1 : 0)} L · ${f.station || "—"}`); setForm(false); setF({ litres: "", odo: "", amount: "", station: "" }); setPhoto(null); setRead(""); }
    else setMsg({ t: L["drv.invalid"], k: "err" });
  }
  const hours = start ? (now - start) / 3600000 : 0;
  return (
    <div className="phone">
      <div className="eyebrow fade">{vehicleName}</div>
      <h1 className="fade" style={{ fontWeight: 300, fontSize: 40, letterSpacing: "-.02em", marginTop: 8 }}>{hello}</h1>
      <div className="pill fade d1" style={{ marginTop: 14 }}><span className="dot" style={{ background: on ? "var(--pos)" : "var(--fg3)", margin: 0 }} />{on ? L["drv.onShift"] : L["drv.offShift"]}</div>
      {!on || priv ? (
        <div className={`privbox fade d1${priv ? " on" : ""}`} role="status"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c5 0 9 5 9 7a10 10 0 0 1-2.6 3.5M6.1 6.4C4 7.8 3 10.7 3 12c0 2 4 7 9 7 1.5 0 2.9-.4 4.1-1" /></svg><div><b>{L["priv.on"]}</b><span>{priv ? L["priv.break"] : L["priv.offShift"]}</span></div></div>
      ) : <div className="privbox track fade d1" role="status"><span className="dot" style={{ background: "var(--pos)", margin: 0 }} /><div><b>{L["priv.tracking"]}</b><span>{L["priv.trackingHint"]}</span></div></div>}
      <div className="fade d1" style={{ marginTop: 40, display: "flex", gap: 40 }}>
        <div><div className="drv-big" suppressHydrationWarning>{fmtNum(loc, shownKm, 1)}</div><div className="eyebrow">{L["drv.kmToday"]}</div></div>
        <div><div className="drv-big" style={{ color: "var(--fg2)" }}>{fmtNum(loc, hours, 1)}<span style={{ fontSize: ".5em" }}>h</span></div><div className="eyebrow">{L["drv.hoursToday"]}</div></div>
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
            <label key={k} className="field"><span>{L[lab]}</span><input className="input" inputMode={mode} value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} /></label>
          ))}
          <button className="btn pri start" style={{ height: 60, marginTop: 8 }}>{L["drv.send"]}</button>
        </form>
      ) : null}
      <div className="sheet fade d3"><div className="field" style={{ padding: "4px 0" }}><span>{L["drv.lastFill"]}</span><span style={{ color: "var(--fg2)", fontSize: 14 }}>{last}</span></div></div>
      <p className="sub" style={{ fontSize: 12, marginTop: 20, textAlign: "center" }}>{L["drv.consent"]}</p>
    </div>
  );
}

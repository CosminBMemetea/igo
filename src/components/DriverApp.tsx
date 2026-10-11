"use client";
import { useEffect, useRef, useState } from "react";
import { fmtNum, type Locale } from "@/lib/i18n";
import { Icon } from "./icons";

const CHECKS = ["chk.tyres", "chk.fluids", "chk.docs", "chk.damage"];
function hav(a: [number, number], b: [number, number]) {
  const R = 6371, r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
export function DriverApp({ vehicleId, vehicleName, hello, labels: L, lastFill, loc }: { vehicleId: string; vehicleName: string; hello: string; labels: Record<string, string>; lastFill: string; loc: Locale }) {
  const [on, setOn] = useState(false), [start, setStart] = useState<number | null>(null), [km, setKm] = useState(0), [now, setNow] = useState(Date.now());
  const [checks, setChecks] = useState<string[]>([]), [msg, setMsg] = useState<{ t: string; k: "ok" | "err" | "" }>({ t: "", k: "" });
  const [form, setForm] = useState(false), [f, setF] = useState({ litres: "", odo: "", amount: "", station: "" }), [photo, setPhoto] = useState<File | null>(null), [read, setRead] = useState(""), [last, setLast] = useState(lastFill);
  const lastPos = useRef<[number, number] | null>(null), watch = useRef<number | null>(null);
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(i); }, []);
  useEffect(() => () => { if (watch.current != null) navigator.geolocation?.clearWatch(watch.current); }, []);

  async function toggle() {
    if (!on && checks.length < 3) { setMsg({ t: L["drv.checkNeeded"], k: "err" }); return; }
    const next = !on;
    setOn(next); setMsg({ t: "", k: "" }); window.dispatchEvent(new CustomEvent("qf-shift", { detail: next }));
    await fetch("/api/driver/shift", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ vehicleId, action: next ? "start" : "stop", checklist: checks }) }).catch(() => null);
    if (next) {
      setStart(Date.now()); setKm(0); lastPos.current = null;
      if (!navigator.geolocation) { setMsg({ t: L["drv.gpsOff"], k: "" }); return; }
      watch.current = navigator.geolocation.watchPosition((p) => {
        const here: [number, number] = [p.coords.latitude, p.coords.longitude];
        if (lastPos.current && p.coords.accuracy < 60) setKm((k) => k + hav(lastPos.current!, here));
        lastPos.current = here;
        fetch("/api/driver/ping", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ vehicleId, lat: here[0], lng: here[1], speed: p.coords.speed }) }).catch(() => null);
      }, () => setMsg({ t: L["drv.gpsOff"], k: "" }), { enableHighAccuracy: true, maximumAge: 15000 });
    } else if (watch.current != null) { navigator.geolocation.clearWatch(watch.current); watch.current = null; }
  }
  async function onPhoto(file: File | null) {
    setPhoto(file); setRead("");
    if (!file) return;
    setRead(L["drv.reading"]);
    const fd = new FormData(); fd.append("photo", file);
    try {
      const r = await fetch("/api/receipt/extract", { method: "POST", body: fd });
      const j = await r.json();
      if (r.ok && j.fields) {
        setF((x) => ({ litres: j.fields.litres?.toString() ?? x.litres, odo: j.fields.odometerKm?.toString() ?? x.odo, amount: j.fields.amount?.toString() ?? x.amount, station: j.fields.station ?? x.station }));
        setRead(L["drv.read"]);
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
    if (r.ok) { setMsg({ t: L["drv.sent"], k: "ok" }); setLast(`${fmtNum(loc, litres)} L · ${f.station || "—"}`); setForm(false); setF({ litres: "", odo: "", amount: "", station: "" }); setPhoto(null); setRead(""); }
    else setMsg({ t: L["drv.invalid"], k: "err" });
  }
  const hours = start ? (now - start) / 3600000 : 0;
  return (
    <div className="phone">
      <div className="eyebrow fade">{vehicleName}</div>
      <h1 className="fade" style={{ fontWeight: 300, fontSize: 40, letterSpacing: "-.02em", marginTop: 8 }}>{hello}</h1>
      <div className="pill fade d1" style={{ marginTop: 14 }}><span className="dot" style={{ background: on ? "var(--pos)" : "var(--fg3)", margin: 0 }} />{on ? L["drv.onShift"] : L["drv.offShift"]}</div>
      <div className="fade d1" style={{ marginTop: 40, display: "flex", gap: 40 }}>
        <div><div className="drv-big">{fmtNum(loc, km, 1)}</div><div className="eyebrow">{L["drv.kmToday"]}</div></div>
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
        <button className="btn sec start" onClick={() => setForm((x) => !x)}><Icon name="fuel" size={20} /><span>{L["drv.fill"]}</span></button>
      </div>
      {msg.t ? <p className={`msg ${msg.k}`}>{msg.t}</p> : null}
      {form ? (
        <form className="sheet fade" onSubmit={send}>
          <label className="field" style={{ paddingTop: 0, cursor: "pointer" }}><span>{L["drv.photo"]}<br /><small style={{ color: "var(--fg3)" }}>{photo ? photo.name : L["drv.photoHint"]}</small></span><span className="ico" style={{ background: "var(--bg3)" }}><Icon name="camera" /></span><input type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPhoto(e.target.files?.[0] ?? null)} /></label>
          {read ? <p className="msg">{read}</p> : null}
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

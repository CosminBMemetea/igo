"use client";
import { useEffect, useRef, useState } from "react";
import type { PaperFile } from "@/lib/paperwork";

type Ev = "loaded" | "unloaded" | "wait_start" | "wait_end";
const MAX = 2 * 1024 * 1024;
/** Comprimă poza în telefon: max 1600 px, JPEG; coboară calitatea până intră sub 2 MB. */
async function compress(f: File): Promise<Blob> {
  if (!f.type.startsWith("image/")) return f;
  const img = await createImageBitmap(f).catch(() => null);
  if (!img) return f;
  const k = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  for (const q of [0.72, 0.55, 0.4]) {
    const b = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", q));
    if (b && b.size <= MAX) return b;
  }
  return f;
}
// HH:MM ora României, identic pe server (Node ICU) și în orice browser: doar cifre, fără formatare dependentă de locale
const RO_HM = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Bucharest", hourCycle: "h23", hour: "numeric", minute: "numeric" });
const hhmm = (iso: string | null) => { if (!iso) return "—"; const p = Object.fromEntries(RO_HM.formatToParts(new Date(iso)).map((x) => [x.type, x.value])); return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`; };
export function TripPaperwork({ tripId, title, demo, onShift: onShift0, initial, L, loc, serverNow }: { serverNow: number; loc: string; tripId: string; title: string; demo: boolean; onShift: boolean; initial: { loadedAt: string | null; unloadedAt: string | null; waitMin: number; waitSince: string | null; files: PaperFile[] }; L: Record<string, string> }) {
  const [st, setSt] = useState(initial), [busy, setBusy] = useState(""), [msg, setMsg] = useState<{ t: string; k: string }>({ t: "", k: "" });
  const [onShift, setOnShift] = useState(onShift0), [geo, setGeo] = useState(true), [now, setNow] = useState(serverNow);
  const cmr = useRef<HTMLInputElement>(null), pod = useRef<HTMLInputElement>(null);
  useEffect(() => { setGeo(localStorage.getItem("qf-geo") !== "0"); const h = (e: Event) => setOnShift((e as CustomEvent<boolean>).detail); window.addEventListener("qf-shift", h); return () => window.removeEventListener("qf-shift", h); }, []);
  useEffect(() => { setNow(Date.now()); }, []);
  useEffect(() => { if (!st.waitSince) return; const i = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(i); }, [st.waitSince]);
  const pos = () => new Promise<{ lat?: number; lng?: number }>((res) => {
    // locația doar în tură și doar cu acordul șoferului
    if (!onShift || !geo || !navigator.geolocation) return res({});
    navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res({}), { timeout: 6000, maximumAge: 60000 });
  });
  async function event(kind: Ev) {
    setBusy(kind); setMsg({ t: "", k: "" });
    const p = await pos();
    const r = await fetch("/api/trips/event", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tripId, kind, ...p }) }).catch(() => null);
    setBusy("");
    if (!r?.ok) { setMsg({ t: L["pw.err"], k: "err" }); return; }
    const { at } = (await r.json()) as { at: string };
    setSt((s) => kind === "loaded" ? { ...s, loadedAt: at } : kind === "unloaded" ? { ...s, unloadedAt: at } : kind === "wait_start" ? { ...s, waitSince: at } : { ...s, waitSince: null, waitMin: s.waitMin + Math.round((Date.parse(at) - Date.parse(s.waitSince ?? at)) / 60000) });
    setMsg({ t: `${L[`pw.ev.${kind}`]} · ${hhmm(at)}${p.lat ? " · 📍" : ""}`, k: "ok" });
  }
  async function upload(kind: "cmr" | "pod", list: FileList | null) {
    if (!list?.length) return;
    setBusy(kind); setMsg({ t: "", k: "" });
    const added: PaperFile[] = [];
    for (const f of Array.from(list).slice(0, 8)) {
      const b = await compress(f);
      if (b.size > MAX) { setMsg({ t: L["pw.tooBig"], k: "err" }); continue; }
      const fd = new FormData(); fd.append("file", b, f.name.replace(/\.\w+$/, "") + (b.type === "image/jpeg" ? ".jpg" : "")); fd.append("kind", kind); fd.append("tripId", tripId);
      const r = await fetch("/api/files", { method: "POST", body: fd }).catch(() => null);
      if (!r?.ok) { setMsg({ t: r?.status === 413 ? L["pw.tooBig"] : L["pw.err"], k: "err" }); continue; }
      const j = (await r.json()) as { id?: string };
      added.push({ id: j.id ?? `local-${Date.now()}`, kind, src: j.id ? `/api/files/${j.id}` : URL.createObjectURL(b), name: f.name });
    }
    setBusy("");
    if (added.length) { setSt((s) => ({ ...s, files: [...s.files, ...added] })); setMsg({ t: L["pw.uploaded"].replace("{n}", String(added.length)), k: "ok" }); }
  }
  const waitNow = st.waitMin + (st.waitSince ? Math.max(0, Math.round((now - Date.parse(st.waitSince)) / 60000)) : 0);
  const files = (k: "cmr" | "pod") => st.files.filter((f) => f.kind === k);
  return (
    <section className="pw">
      <div className="eyebrow">{L["pw.today"]}</div>
      <div className="pwt">{title}</div>
      <div className="pwg">
        <button className={`pwb${st.loadedAt ? " done" : ""}`} disabled={!!busy} onClick={() => event("loaded")}><b>{L["pw.loaded"]}</b><span>{st.loadedAt ? hhmm(st.loadedAt) : L["pw.tap"]}</span></button>
        <button className={`pwb${st.unloadedAt ? " done" : ""}`} disabled={!!busy || !st.loadedAt} onClick={() => event("unloaded")}><b>{L["pw.unloaded"]}</b><span>{st.unloadedAt ? hhmm(st.unloadedAt) : L["pw.tap"]}</span></button>
      </div>
      <button className={`pwwait${st.waitSince ? " on" : ""}`} disabled={!!busy} onClick={() => event(st.waitSince ? "wait_end" : "wait_start")}>
        <span>{st.waitSince ? L["pw.waitStop"] : L["pw.wait"]}</span><b suppressHydrationWarning>{Math.floor(waitNow / 60)}h {String(waitNow % 60).padStart(2, "0")}m</b>
      </button>
      <p className="hint">{L["pw.waitHint"]}</p>
      {(["cmr", "pod"] as const).map((k) => (
        <div key={k} className="pwdoc">
          <div className="head"><h3>{L[`pw.${k}`]}</h3><button className="btn sec sm" disabled={!!busy} onClick={() => (k === "cmr" ? cmr : pod).current?.click()}>{busy === k ? "…" : `+ ${L["pw.photo"]}`}</button></div>
          <input ref={k === "cmr" ? cmr : pod} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => { upload(k, e.target.files); e.target.value = ""; }} />
          <div className="thumbs">{files(k).length ? files(k).map((f, i) => <a key={f.id} href={f.src} target="_blank" rel="noreferrer"><img src={f.src} alt={`${L[`pw.${k}`]} ${i + 1}`} loading="lazy" /></a>) : <span className="hint">{L["pw.none"]}</span>}</div>
        </div>
      ))}
      <label className="pwgeo"><input type="checkbox" checked={geo && onShift} disabled={!onShift} onChange={(e) => { setGeo(e.target.checked); localStorage.setItem("qf-geo", e.target.checked ? "1" : "0"); }} /> <span>{onShift ? L["pw.geo"] : L["pw.geoOff"]}</span></label>
      {msg.t ? <p className={`msg ${msg.k}`}>{msg.t}</p> : null}
      {demo ? <p className="hint" style={{ marginTop: 10 }}>{L["pw.demo"]}</p> : null}
    </section>
  );
}

"use client";
import { tri, type Locale } from "@/lib/i18n";
import { enqueue, flushOutbox, outboxItems } from "@/lib/outbox";
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
/** 1h 05m · în curs: 1:05:09 */
const fmtWait = (sec: number, live = false) => { const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return live ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${h}h ${String(m).padStart(2, "0")}m`; };
export function TripPaperwork({ queueScope, actorId, readOnly, tripId, title, demo, onShift: onShift0, initial, L, loc, serverNow, clockOffset = 0 }: { clockOffset?: number; queueScope?: string; actorId?: string; readOnly?: boolean; serverNow: number; loc: string; tripId: string; title: string; demo: boolean; onShift: boolean; initial: { loadedAt: string | null; unloadedAt: string | null; waitMin: number; waitSince: string | null; files: PaperFile[] }; L: Record<string, string> }) {
  const [st, setSt] = useState(initial), [busy, setBusy] = useState(""), [msg, setMsg] = useState<{ t: string; k: string }>({ t: "", k: "" });
  const [onShift, setOnShift] = useState(onShift0), [geo, setGeo] = useState(true), [now, setNow] = useState(serverNow + clockOffset);
  const [pending, setPending] = useState(false);
  const eventLock = useRef(false);
  const cmr = useRef<HTMLInputElement>(null), pod = useRef<HTMLInputElement>(null);
  useEffect(() => { try { setGeo(localStorage.getItem("qf-geo") !== "0"); } catch { setGeo(false); } const h = (e: Event) => setOnShift((e as CustomEvent<boolean>).detail); window.addEventListener("qf-shift", h); return () => window.removeEventListener("qf-shift", h); }, []);
  useEffect(() => { setNow(Date.now() + clockOffset); }, [clockOffset]);
  useEffect(() => { if (!st.waitSince) return; const i = setInterval(() => setNow(Date.now() + clockOffset), 1000); return () => clearInterval(i); }, [st.waitSince, clockOffset]);
  useEffect(() => {
    if (!queueScope) return;
    let alive = true;
    const read = () => { void outboxItems(queueScope).then((items) => {
      if (!alive) return;
      const events = items.filter((x) => x.kind === "event" && (x.payload as Record<string,string>).tripId === tripId);
      let state = { ...initial };
      for (const item of events) {
        const p = item.payload as Record<string,string>, at = p.occurredAt;
        if (p.kind === "loaded") state.loadedAt = at;
        if (p.kind === "unloaded") state.unloadedAt = at;
        if (p.kind === "wait_start") state.waitSince = at;
        if (p.kind === "wait_end") { state.waitMin += Math.max(0, Math.round((Date.parse(at) - Date.parse(state.waitSince ?? at))/60000)); state.waitSince = null; }
      }
      setSt(state); setPending(events.length > 0);
    }).catch(() => {}); };
    read(); window.addEventListener("igo-outbox",read); return () => { alive=false; window.removeEventListener("igo-outbox",read); };
  }, [queueScope, tripId, initial]);
  const pos = () => new Promise<{ lat?: number; lng?: number }>((res) => {
    // locația doar în tură și doar cu acordul șoferului
    if (demo || !onShift || !geo || !navigator.geolocation) return res({}); // demo: fără GPS real
    navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res({}), { timeout: 6000, maximumAge: 60000 });
  });
  async function event(kind: Ev) {
    if (eventLock.current || readOnly) return; eventLock.current = true;
    setBusy(kind); setMsg({ t: "", k: "" });
    if (queueScope && actorId && !demo) {
      try {
        const at = new Date().toISOString();
        await enqueue({ id: crypto.randomUUID(), scope: queueScope, actorId, kind: "event", label: `${title} · ${L[`pw.ev.${kind}`]}`, payload: { tripId, kind, occurredAt: at } });
        setPending(true);
        setSt((s) => kind === "loaded" ? { ...s, loadedAt: at } : kind === "unloaded" ? { ...s, unloadedAt: at } : kind === "wait_start" ? { ...s, waitSince: at } : { ...s, waitSince: null, waitMin: s.waitMin + Math.max(0, Math.round((Date.parse(at) - Date.parse(s.waitSince ?? at)) / 60000)) });
        setMsg({ t: tri(loc as Locale, "Salvat pe telefon · în așteptarea sincronizării.|Saved on device · waiting for sync.|Zapisano na urządzeniu · oczekuje na synchronizację."), k: "warn" });
        if (navigator.onLine) void flushOutbox(queueScope).catch(() => {});
      } catch { setMsg({ t: L["pw.err"], k: "err" }); }
      finally { setBusy(""); eventLock.current = false; }
      return;
    }
    const p = await pos();
    const r = await fetch("/api/trips/event", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tripId, kind, key: crypto.randomUUID(), ...(demo ? { occurredAt: new Date(Date.now() + clockOffset).toISOString() } : {}), ...p }) }).catch(() => null);
    setBusy(""); eventLock.current = false;
    if (!r?.ok) { setMsg({ t: L["pw.err"], k: "err" }); return; }
    const { at } = (await r.json()) as { at: string };
    setSt((s) => kind === "loaded" ? { ...s, loadedAt: at } : kind === "unloaded" ? { ...s, unloadedAt: at } : kind === "wait_start" ? { ...s, waitSince: at } : { ...s, waitSince: null, waitMin: s.waitMin + Math.round((Date.parse(at) - Date.parse(s.waitSince ?? at)) / 60000) });
    setMsg({ t: `${L[`pw.ev.${kind}`]} · ${hhmm(at)}${p.lat ? " · 📍" : ""}`, k: "ok" });
  }
  async function upload(kind: "cmr" | "pod", list: FileList | null) {
    if (!list?.length) return;
    if (eventLock.current || readOnly) return; eventLock.current = true;
    setBusy(kind); setMsg({ t: "", k: "" });
    try {
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
    } catch { setMsg({ t: L["pw.err"], k: "err" }); } finally { setBusy(""); eventLock.current = false; }
  }
  const waitSec = st.waitMin * 60 + (st.waitSince ? Math.max(0, Math.floor((now - Date.parse(st.waitSince)) / 1000)) : 0);
  const waitNow = st.waitMin + (st.waitSince ? Math.max(0, Math.round((now - Date.parse(st.waitSince)) / 60000)) : 0);
  const files = (k: "cmr" | "pod") => st.files.filter((f) => f.kind === k);
  return (
    <section className="pw">
      <div className="eyebrow">{L["pw.today"]}</div>
      <div className="pwt">{title}</div>{pending ? <p className="msg warn">{tri(loc as Locale, "Operațiuni în așteptare pe telefon — încă neconfirmate de server.|Actions pending on this device — not yet confirmed by server.|Operacje oczekują na potwierdzenie serwera.")}</p> : null}
      <div className="pwg">
        <button className={`pwb${st.loadedAt ? " done" : ""}`} disabled={!!busy || readOnly || !!st.loadedAt || !!st.waitSince} onClick={() => event("loaded")}><b>{L["pw.loaded"]}</b><span>{st.loadedAt ? hhmm(st.loadedAt) : L["pw.tap"]}</span></button>
        <button className={`pwb${st.unloadedAt ? " done" : ""}`} disabled={!!busy || readOnly || !st.loadedAt || !!st.unloadedAt || !!st.waitSince} onClick={() => event("unloaded")}><b>{L["pw.unloaded"]}</b><span>{st.unloadedAt ? hhmm(st.unloadedAt) : L["pw.tap"]}</span></button>
      </div>
      {/* card ca „Am încărcat / Am descărcat”: stare clară (nepornit / în curs), cronometru care rulează, buton explicit Pornește/Oprește */}
      <div className={`pwwait${st.waitSince ? " on" : ""}`} role="group" aria-label={L["pw.wait"]}>
        <i className="pwi" aria-hidden>{st.waitSince ? <span className="pwdot" /> : "⏳"}</i>
        <div className="pwwt"><b>{L["pw.wait"]}</b><span suppressHydrationWarning>{st.waitSince ? L["pw.wSince"].replace("{t}", hhmm(st.waitSince)) : waitNow ? `${L["pw.wTotal"]} · ${fmtWait(waitNow * 60)}` : L["pw.wIdle"]}</span></div>
        {st.waitSince || waitNow ? <time className="pwclock" suppressHydrationWarning>{fmtWait(st.waitSince ? waitSec : waitNow * 60, !!st.waitSince)}</time> : null}
        <button className={`btn ${st.waitSince ? "pri pwstop" : "sec"} sm`} disabled={!!busy || readOnly || !!st.unloadedAt} aria-pressed={!!st.waitSince} onClick={() => event(st.waitSince ? "wait_end" : "wait_start")}>{st.waitSince ? L["pw.wStop"] : L["pw.wStart"]}</button>
      </div>
      <p className="hint">{L["pw.waitHint"]}</p>
      {(["cmr", "pod"] as const).map((k) => (
        <div key={k} className="pwdoc">
          <div className="head"><h3>{L[`pw.${k}`]}</h3><button className="btn sec sm" disabled={!!busy || readOnly} onClick={() => (k === "cmr" ? cmr : pod).current?.click()}>{busy === k ? "…" : `+ ${L["pw.photo"]}`}</button></div>
          <input ref={k === "cmr" ? cmr : pod} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => { upload(k, e.target.files); e.target.value = ""; }} />
          <div className="thumbs">{files(k).length ? files(k).map((f, i) => <a key={f.id} href={f.src} target="_blank" rel="noreferrer"><img src={f.src} alt={`${L[`pw.${k}`]} ${i + 1}`} loading="lazy" /></a>) : <span className="hint">{L["pw.none"]}</span>}</div>
        </div>
      ))}
      {!queueScope && !demo ? <label className="pwgeo"><input type="checkbox" checked={geo && onShift} disabled={!onShift} onChange={(e) => { setGeo(e.target.checked); try { localStorage.setItem("qf-geo", e.target.checked ? "1" : "0"); } catch { /* The preference remains valid for this page. */ } }} /> <span>{onShift ? L["pw.geo"] : L["pw.geoOff"]}</span></label> : null}
      {msg.t ? <p className={`msg ${msg.k}`}>{msg.t}</p> : null}
      {demo ? <p className="hint" style={{ marginTop: 10 }}>{L["pw.demo"]}</p> : null}
    </section>
  );
}

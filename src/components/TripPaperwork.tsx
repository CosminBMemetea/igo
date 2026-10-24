"use client";
import { useRouter } from "next/navigation";
import { DRIVER_TRIP_UPDATE, type DriverTripUpdate } from "@/lib/driver-trip-update";
import { fill, tri, type Locale } from "@/lib/i18n";
import { enqueue, flushOutbox, outboxItems } from "@/lib/outbox";
import { useEffect, useRef, useState } from "react";
import type { PaperFile } from "@/lib/paperwork";
import { projectPaperwork, mergePaperFiles, type PaperworkAck, type PaperworkState } from "@/lib/paperwork-state";
import { uploadPaperworkPhotos } from "@/lib/paperwork-upload";
import { sniffImage, MAX_PHOTO_IN } from "@/lib/imgsniff";

type Ev = "loaded" | "unloaded" | "wait_start" | "wait_end";
const MAX = 2 * 1024 * 1024;
/** Comprimă poza în telefon: max 1600 px, JPEG; coboară calitatea până intră sub 2 MB. */
/** Tip real după primii octeți (nu după extensie): poze JPEG/PNG/WebP/HEIC sau PDF. */
async function fileKind(f: File): Promise<string | null> {
  const b = new Uint8Array(await f.slice(0, 16).arrayBuffer());
  if (b.length >= 5 && String.fromCharCode(...b.slice(0, 5)) === "%PDF-") return "pdf";
  return sniffImage(b);
}
async function compress(f: File): Promise<Blob> {
  if (!f.type.startsWith("image/")) return f;
  const img = await createImageBitmap(f).catch(() => null);
  if (!img) return f;
  try {
  const k = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  for (const q of [0.72, 0.55, 0.4]) {
    const b = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", q));
    if (b && b.size <= MAX) return b;
  }
  return f;
  } finally { img.close(); }
}
// HH:MM ora României, identic pe server (Node ICU) și în orice browser: doar cifre, fără formatare dependentă de locale
const RO_HM = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Bucharest", hourCycle: "h23", hour: "numeric", minute: "numeric" });
const hhmm = (iso: string | null) => { if (!iso) return "—"; const p = Object.fromEntries(RO_HM.formatToParts(new Date(iso)).map((x) => [x.type, x.value])); return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`; };
/** 1h 05m · în curs: 1:05:09 */
const fmtWait = (sec: number, live = false) => { const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return live ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${h}h ${String(m).padStart(2, "0")}m`; };
export function TripPaperwork({ queueScope, actorId, readOnly, tripId, title, demo, onShift: onShift0, initial, L, loc, serverNow, clockOffset = 0, canRecordEvents = true }: { canRecordEvents?: boolean; clockOffset?: number; queueScope?: string; actorId?: string; readOnly?: boolean; serverNow: number; loc: string; tripId: string; title: string; demo: boolean; onShift: boolean; initial: PaperworkState; L: Record<string, string> }) {
  const router = useRouter();
  const notify = (kind: DriverTripUpdate["kind"], at: string) => { if (demo) window.dispatchEvent(new CustomEvent(DRIVER_TRIP_UPDATE, { detail: { tripId, kind, at } })); else router.refresh(); };
  const [st, setSt] = useState(initial), [busy, setBusy] = useState(""), [msg, setMsg] = useState<{ t: string; k: string; event?: boolean }>({ t: "", k: "" });
  const [onShift, setOnShift] = useState(onShift0), [geo, setGeo] = useState(true), [now, setNow] = useState(serverNow + clockOffset);
  const [pending, setPending] = useState(false), [blocked, setBlocked] = useState(false), [queueReady, setQueueReady] = useState(!queueScope);
  const accepted = useRef<PaperworkAck[]>([]);
  const [uploaded, setUploaded] = useState<PaperFile[]>([]);
  const eventLock = useRef(false), msgRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (msg.t && msg.k !== "ok") msgRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [msg]);
  const cmr = useRef<HTMLInputElement>(null), pod = useRef<HTMLInputElement>(null);
  useEffect(() => { try { setGeo(localStorage.getItem("qf-geo") !== "0"); } catch { setGeo(false); } const h = (e: Event) => setOnShift((e as CustomEvent<boolean>).detail); window.addEventListener("qf-shift", h); return () => window.removeEventListener("qf-shift", h); }, []);
  useEffect(() => { setNow(Date.now() + clockOffset); }, [clockOffset]);
  useEffect(() => { setOnShift(onShift0); }, [onShift0]);
  useEffect(() => { if (!st.waitSince) return; const i = setInterval(() => setNow(Date.now() + clockOffset), 1000); return () => clearInterval(i); }, [st.waitSince, clockOffset]);
  useEffect(() => {
    setUploaded(files => files.filter(file => !initial.files.some(saved => saved.id === file.id)));
    if (!queueScope) { if (!demo) setSt(initial); return; }
    let alive = true, revision = 0;
    setQueueReady(false);
    accepted.current = accepted.current.filter(e => e.tripId === tripId && Date.parse(e.at) > (Date.parse(initial.lastEventAt ?? "") || 0));
    const read = () => {
      const current = ++revision;
      void outboxItems(queueScope).then(items => {
        if (!alive || current !== revision) return;
        const projected = projectPaperwork(initial, tripId, items, accepted.current);
        setSt(projected.state); setPending(projected.pending); setBlocked(projected.blocked); setQueueReady(true);
      }).catch(() => { if (alive && current === revision) setQueueReady(false); });
    };
    const acknowledge = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.scope !== queueScope || detail.tripId !== tripId || !detail.id || !detail.occurredAt) return;
      accepted.current = [...accepted.current.filter(e => e.id !== detail.id), { id: detail.id, tripId, kind: detail.kind, at: detail.occurredAt }];
      setMsg({ t: tri(loc as Locale, "Etapă confirmată de firmă.|Step confirmed by the company.|Etap potwierdzony przez firmę."), k: "ok" });
      read(); router.refresh();
    };
    read(); window.addEventListener("igo-outbox", read); window.addEventListener("qf-trip-server-ack", acknowledge);
    return () => { alive = false; window.removeEventListener("igo-outbox", read); window.removeEventListener("qf-trip-server-ack", acknowledge); };
  }, [queueScope, tripId, initial, demo, router, loc]);
  const pos = () => new Promise<{ lat?: number; lng?: number }>((res) => {
    // locația doar în tură și doar cu acordul șoferului
    if (demo || !onShift || !geo || !navigator.geolocation) return res({}); // demo: fără GPS real
    navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res({}), { timeout: 6000, maximumAge: 60000 });
  });
  async function event(kind: Ev) {
    if (eventLock.current || readOnly || !canRecordEvents || !queueReady || blocked) return; eventLock.current = true;
    setBusy(kind); setMsg({ t: "", k: "" });
    if (queueScope && actorId && !demo) {
      try {
        const at = new Date().toISOString();
        await enqueue({ id: crypto.randomUUID(), scope: queueScope, actorId, kind: "event", label: `${title} · ${L[`pw.ev.${kind}`]}`, payload: { tripId, kind, occurredAt: at } });
        setPending(true);
        setSt((s) => kind === "loaded" ? { ...s, loadedAt: at } : kind === "unloaded" ? { ...s, unloadedAt: at } : kind === "wait_start" ? { ...s, waitSince: at } : { ...s, waitSince: null, waitMin: s.waitMin + Math.max(0, (Date.parse(at) - Date.parse(s.waitSince ?? at)) / 60000) });
        setMsg({ t: tri(loc as Locale, "Salvat pe telefon · în așteptarea sincronizării.|Saved on device · waiting for sync.|Zapisano na urządzeniu · oczekuje na synchronizację."), k: "warn", event: true });
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
    setSt((s) => kind === "loaded" ? { ...s, loadedAt: at } : kind === "unloaded" ? { ...s, unloadedAt: at } : kind === "wait_start" ? { ...s, waitSince: at } : { ...s, waitSince: null, waitMin: s.waitMin + Math.max(0, (Date.parse(at) - Date.parse(s.waitSince ?? at)) / 60000) });
    if (kind === "loaded" || kind === "unloaded") notify(kind, at);
    setMsg({ t: `${L[`pw.ev.${kind}`]} · ${hhmm(at)}${p.lat ? " · 📍" : ""}`, k: "ok" });
  }
  async function upload(kind: "cmr" | "pod", list: FileList | null) {
    if (!list?.length) return;
    if (eventLock.current || readOnly) return; eventLock.current = true;
    setBusy(kind); setMsg({ t: "", k: "" });
    try {
      const result = await uploadPaperworkPhotos(Array.from(list), async f => {
        const kindOf = await fileKind(f);
        // mărimea înaintea tipului: doar pozele recunoscute se pot micșora sub 2 MB
        if (f.size > MAX_PHOTO_IN || (f.size > MAX && (!kindOf || kindOf === "pdf"))) throw new Error(L["pw.tooBig"]);
        if (!kindOf) throw new Error(tri(loc as Locale, "tip nepermis: doar poze JPG, PNG, WebP, HEIC sau PDF|file type not allowed: only JPG, PNG, WebP, HEIC photos or PDF|niedozwolony typ: tylko zdjęcia JPG, PNG, WebP, HEIC lub PDF"));
        const b = await compress(f);
        if (b.size > MAX) throw new Error(L["pw.tooBig"]);
        const fd = new FormData(); fd.append("file", b, b.type === "image/jpeg" ? f.name.replace(/\.\w+$/, "") + ".jpg" : f.name); fd.append("kind", kind); fd.append("tripId", tripId);
        const r = await fetch("/api/files", { method: "POST", body: fd, signal: AbortSignal.timeout(45000) });
        if (!r.ok) throw new Error(r.status === 413 ? L["pw.tooBig"] : r.status === 415 ? tri(loc as Locale, "tip nepermis: doar poze JPG, PNG, WebP, HEIC sau PDF|file type not allowed: only JPG, PNG, WebP, HEIC photos or PDF|niedozwolony typ: tylko zdjęcia JPG, PNG, WebP, HEIC lub PDF") : L["pw.err"]);
        const j = (await r.json()) as { id?: string };
        if (!j.id && !demo) throw new Error(L["pw.err"]);
        return { id: j.id ?? `local-${crypto.randomUUID()}`, kind, src: j.id ? `/api/files/${j.id}` : URL.createObjectURL(b), name: f.name };
      });
      if (result.added.length) {
        setUploaded(files => mergePaperFiles(files, result.added));
        if (kind === "pod") notify("pod", new Date().toISOString()); else if (!demo) router.refresh();
      }
      const parts = [result.added.length === 1 ? tri(loc as Locale, "1 fișier încărcat|1 file uploaded|1 plik przesłany") : fill(loc as Locale, L["pw.uploaded"], { n: result.added.length })];
      if (result.failed.length) parts.push(tri(loc as Locale, "Fișiere netrimise|Files not sent|Niewysłane pliki") + `: ${result.failed.map(f => `${f.name} (${f.reason})`).join("; ")}`);
      if (result.skipped) parts.push(tri(loc as Locale, "Maximum 8 fotografii odată. Selectează din nou restul|Maximum 8 photos at a time. Select the remaining photos again|Maksymalnie 8 zdjęć naraz. Wybierz pozostałe ponownie") + ` (${result.skipped}).`);
      setMsg({ t: parts.join(" · "), k: result.failed.length || result.skipped ? "warn" : "ok" });
    } catch { setMsg({ t: L["pw.err"], k: "err" }); } finally { setBusy(""); eventLock.current = false; }
  }
  const waitSec = Math.round(st.waitMin * 60) + (st.waitSince ? Math.max(0, Math.floor((now - Date.parse(st.waitSince)) / 1000)) : 0);
  const files = (k: "cmr" | "pod") => mergePaperFiles(st.files, uploaded).filter((f) => f.kind === k);
  return (
    <section className="pw">
      <div className="eyebrow">{readOnly ? L["pw.today"] : st.unloadedAt ? tri(loc as Locale, "Cursă livrată · documente|Delivered trip · documents|Dostarczony kurs · dokumenty") : st.loadedAt ? tri(loc as Locale, "Cursa în desfășurare · acțiuni|Current trip · actions|Bieżący kurs · działania") : L["pw.today"]}</div>
      <div className="pwt">{title}</div>{blocked ? <p role="alert" className="msg err">{tri(loc as Locale, "Firma nu a acceptat o operație. Verifică lista de sincronizare înainte de a continua.|An action was not accepted. Check the sync list before continuing.|Operacja nie została zaakceptowana. Sprawdź listę synchronizacji.")}</p> : pending ? <p className="msg warn">{tri(loc as Locale, "Operațiuni în așteptare pe telefon — încă neconfirmate de server.|Actions pending on this device — not yet confirmed by server.|Operacje oczekują na potwierdzenie serwera.")}</p> : null}
      {!queueReady && <p className="msg warn">{tri(loc as Locale, "Verificăm operațiunile salvate pe telefon…|Checking saved actions on this device…|Sprawdzamy zapisane operacje…")}</p>}
      {canRecordEvents && <><div className="pwg">
        <button className={`pwb${st.loadedAt ? " done" : ""}`} disabled={!!busy || readOnly || !queueReady || blocked || !!st.loadedAt || !!st.unloadedAt || !!st.waitSince} onClick={() => event("loaded")}><b>{L["pw.loaded"]}</b><span>{st.loadedAt ? hhmm(st.loadedAt) : L["pw.tap"]}</span></button>
        <button className={`pwb${st.unloadedAt ? " done" : ""}`} disabled={!!busy || readOnly || !queueReady || blocked || !st.loadedAt || !!st.unloadedAt || !!st.waitSince} onClick={() => event("unloaded")}><b>{L["pw.unloaded"]}</b><span>{st.unloadedAt ? hhmm(st.unloadedAt) : L["pw.tap"]}</span></button>
      </div>
      {/* card ca „Am încărcat / Am descărcat”: stare clară (nepornit / în curs), cronometru care rulează, buton explicit Pornește/Oprește */}
      <div className={`pwwait${st.waitSince ? " on" : ""}`} role="group" aria-label={L["pw.wait"]}>
        <i className="pwi" aria-hidden>{st.waitSince ? <span className="pwdot" /> : "⏳"}</i>
        <div className="pwwt"><b>{L["pw.wait"]}</b><span suppressHydrationWarning>{st.waitSince ? L["pw.wSince"].replace("{t}", hhmm(st.waitSince)) : waitSec > 0 ? `${L["pw.wTotal"]} · ${fmtWait(Math.max(60, Math.ceil(waitSec / 60) * 60))}` : L["pw.wIdle"]}</span></div>
        {st.waitSince || waitSec > 0 ? <time className="pwclock" suppressHydrationWarning>{fmtWait(st.waitSince ? waitSec : Math.max(60, Math.ceil(waitSec / 60) * 60), !!st.waitSince)}</time> : null}
        <button className={`btn ${st.waitSince ? "pri pwstop" : "sec"} sm`} disabled={!!busy || readOnly || !queueReady || blocked || !!st.unloadedAt} aria-pressed={!!st.waitSince} onClick={() => event(st.waitSince ? "wait_end" : "wait_start")}>{st.waitSince ? L["pw.wStop"] : L["pw.wStart"]}</button>
      </div>
      <p className="hint">{L["pw.waitHint"]}</p></>}
      {msg.t && !(blocked && msg.event) ? <p ref={msgRef} role={msg.k === "ok" ? "status" : "alert"} style={{ overflowWrap: "anywhere" }} className={`msg ${msg.k}`}>{msg.t}</p> : null}
      {(["cmr", "pod"] as const).map((k) => (
        <div key={k} id={`pw-${k}`} className="pwdoc">
          <div className="head"><h3>{L[`pw.${k}`]}</h3><button className="btn sec sm" disabled={!!busy || readOnly} onClick={() => (k === "cmr" ? cmr : pod).current?.click()}>{busy === k ? "…" : `+ ${L["pw.photo"]}`}</button></div>
          <input ref={k === "cmr" ? cmr : pod} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" multiple hidden onChange={(e) => { upload(k, e.target.files); e.target.value = ""; }} />
          <div className="thumbs">{files(k).length ? files(k).map((f, i) => <a key={f.id} href={f.src} target="_blank" rel="noreferrer">{/\.pdf$/i.test(f.name) ? <span className="pwpdf" aria-label={`${L[`pw.${k}`]} ${i + 1} PDF`}>PDF</span> : <img src={f.src} alt={`${L[`pw.${k}`]} ${i + 1}`} loading="lazy" />}</a>) : <span className="hint">{L["pw.none"]}</span>}</div>
        </div>
      ))}
      {!queueScope && !demo ? <label className="pwgeo"><input type="checkbox" checked={geo && onShift} disabled={!onShift} onChange={(e) => { setGeo(e.target.checked); try { localStorage.setItem("qf-geo", e.target.checked ? "1" : "0"); } catch { /* The preference remains valid for this page. */ } }} /> <span>{onShift ? L["pw.geo"] : L["pw.geoOff"]}</span></label> : null}
      {demo ? <p className="hint" style={{ marginTop: 10 }}>{L["pw.demo"]}</p> : null}
    </section>
  );
}

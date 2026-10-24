"use client";
import { decNum, clipChars, AMOUNT_MAX, localNow } from "@/lib/validate";
import { postDriverControl } from "@/lib/driver-control";
import { useDriverTracking } from "./DriverTracking";
import { SHIFT_CHECKS as CHECKS } from "@/lib/shift-checklist";
import { loadReceiptDraft, saveReceiptDraft } from "@/lib/receipt-draft";
import { enqueue, flushOutbox, outboxItems } from "@/lib/outbox";
import { tri } from "@/lib/i18n";
import { saveThumb } from "./ReceiptThumb";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { shrinkImage } from "@/lib/shrink";
import { sniffImage, MAX_PHOTO_IN } from "@/lib/imgsniff";
import { fmtNum, type Locale } from "@/lib/i18n";
import { Icon } from "./icons";
import { ShiftBar, ShiftConfirm, shiftControlError } from "./DriverShiftBar";

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
export function DriverApp({ queueScope, actorId, vehicleId, vehicleName, hello, labels: L, lastFill, loc, initial, demoKm, serverNow, demo, preview, today, switchTo, hasWork: serverHasWork = false, workTripIds, top, trip }: { top?: ReactNode; trip?: ReactNode; hasWork?: boolean; workTripIds?: string[]; queueScope?: string; actorId?: string; switchTo?: { id: string; name: string }[]; today?: { km: number; hours: number } | null; preview?: boolean; demo?: boolean; serverNow: number; demoKm?: number | null; initial?: { start: string; priv: boolean } | null; vehicleId: string; vehicleName: string; hello: string; labels: Record<string, string>; lastFill: string; loc: Locale }) {
  const [localDelivered, setLocalDelivered] = useState<string[]>([]), [ackDelivered, setAckDelivered] = useState<string[]>([]);
  const [readScope, setReadScope] = useState<string | null>(null), [queueError, setQueueError] = useState(false);
  const queueReady = !queueScope || demo || readScope === queueScope;
  const hasWork = serverHasWork && (!workTripIds || workTripIds.some(id => !localDelivered.includes(id) && !ackDelivered.includes(id)));
  useEffect(() => {
    if (!queueScope || demo) return;
    let active = true, revision = 0;
    const read = () => {
      const current = ++revision;
      void outboxItems(queueScope).then(items => {
        if (!active || current !== revision) return;
        setLocalDelivered(items.filter(x => x.kind === "event" && x.status === "pending" && (x.payload as Record<string,string>).kind === "unloaded").map(x => (x.payload as Record<string,string>).tripId));
        setReadScope(queueScope); setQueueError(false);
      }).catch(() => { if (active && current === revision) { setReadScope(null); setQueueError(true); } });
    };
    const ack = (event: Event) => { const d = (event as CustomEvent).detail; if (d?.scope === queueScope && d.kind === "unloaded") setAckDelivered(old => [...old, d.tripId]); };
    read(); window.addEventListener("igo-outbox", read); window.addEventListener("qf-trip-server-ack", ack);
    return () => { active = false; window.removeEventListener("igo-outbox", read); window.removeEventListener("qf-trip-server-ack", ack); };
  }, [queueScope, demo]);
  const [withoutTrip, setWithoutTrip] = useState(false);
  useEffect(() => { setWithoutTrip(false); }, [vehicleId, hasWork, initial?.start]);
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

  const shiftBusy = useRef(false), shiftStart = useRef(initial?.start), [startAt, setStartAt] = useState(initial?.start), [barMsg, setBarMsg] = useState("");
  useEffect(() => { if (!barMsg) return; const i = setTimeout(() => setBarMsg(""), 6000); return () => clearTimeout(i); }, [barMsg]);
  const [ask, setAsk] = useState<"start" | "stop" | null>(null);
  const { gps, lastAck, held } = useDriverTracking();
  const controlError = (status: number) => shiftControlError(loc, status);
  // Ignore snapshots racing a local action briefly; do not compare phone and server clocks.
  useEffect(() => {
    if (shiftBusy.current || Date.now() - mutationAt.current < 5000) return;
    shiftStart.current = initial?.start; setStartAt(initial?.start);
    setOn(!!initial); setPriv(!!initial?.priv);
    setKm(today?.km ?? 0);
    work.current = { ms: (today?.hours ?? 0) * 3600000, since: initial && !initial.priv ? serverNow : null };
    window.dispatchEvent(new CustomEvent("qf-shift", { detail: !!initial && !initial.priv }));
  }, [serverNow, initial?.start, initial?.priv, today?.km, today?.hours, vehicleId]); // eslint-disable-line react-hooks/exhaustive-deps
  const endDialog = useRef<HTMLDialogElement>(null);
  const shiftTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!ask) return; const dialog = endDialog.current, trigger = shiftTrigger.current; dialog?.showModal(); document.documentElement.classList.add("msheet-open"); return () => { dialog?.close(); document.documentElement.classList.remove("msheet-open"); trigger?.focus(); }; }, [ask]);
  // „Termină tura”: întâi confirmare (foaie proprie), abia apoi oprim tura
  const [needCheck, setNeedCheck] = useState(false);
  const checkBox = useRef<HTMLDivElement>(null), shiftCard = useRef<HTMLElement>(null);
  // bara de jos: dacă lipsește verificarea de dimineață, o aducem în ecran și o evidențiem
  function showCheck() {
    setNeedCheck(true);
    const el = checkBox.current ?? shiftCard.current;
    el?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    (checkBox.current?.querySelector('[aria-checked="false"]') as HTMLElement | null)?.focus({ preventScroll: true });
  }
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("check")) return;
    const u = new URL(window.location.href); u.searchParams.delete("check"); window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
    if (!on) setTimeout(showCheck, 150);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  function onGo() {
    if (on || preview) { toggle(); return; }
    if (!queueReady || !hasWork && !withoutTrip) { shiftCard.current?.scrollIntoView({ behavior: "smooth", block: "center" }); setNeedCheck(true); return; }
    toggle();
  }
  function toggle() {
    if (preview) { void doToggle(); return; }
    if (on) { setAsk("stop"); return; }
    // pornirea: întâi verificarea de dimineață, apoi confirmarea „Pornești tura acum?”
    if (!queueReady || !hasWork && !withoutTrip) return;
    if (checks.length < 3) { showCheck(); return; }
    setAsk("start");
  }
  async function doToggle() {
    if (!on && (!queueReady || !hasWork && !withoutTrip)) return;
    if (!on && checks.length < 3) { showCheck(); return; }
    if (preview) { setBarMsg(L["drv.previewNo"]); return; }
    if (shiftBusy.current) return;
    shiftBusy.current = true;
    const next = !on;
    if (!next) window.dispatchEvent(new Event("qf-tracking-pause"));
    const rs = await postDriverControl("/api/driver/shift", { vehicleId, action: next ? "start" : "stop", checklist: checks, ...(!next && !demo && shiftStart.current ? { expectedShiftStart: shiftStart.current } : {}) });
    shiftBusy.current = false;
    if (!rs.ok) { if (next) window.dispatchEvent(new CustomEvent("qf-shift", { detail: on && !priv })); setBarMsg(controlError(rs.status)); return; }
    mutationAt.current = Date.now();
    shiftStart.current = next ? rs.data?.shift?.start : undefined; setStartAt(shiftStart.current);
    setPriv(false);
    if (!next) setChecks([]); window.dispatchEvent(new Event("qf-tracking-resume"));
    setOn(next); setMsg({ t: "", k: "" }); setNeedCheck(false); window.dispatchEvent(new CustomEvent("qf-shift", { detail: next }));
    if (next) { work.current.since = Date.now(); }
    else pauseWork();
    window.dispatchEvent(new Event("qf-refresh"));
  }
  async function togglePriv() {
    if (preview) { setBarMsg(L["drv.previewNo"]); return; }
    if (shiftBusy.current) return;
    shiftBusy.current = true;
    const next = !priv;
    if (next) window.dispatchEvent(new Event("qf-tracking-pause"));
    const r = await postDriverControl("/api/driver/private", { vehicleId, on: next, ...(!demo && shiftStart.current ? { expectedShiftStart: shiftStart.current } : {}) });
    shiftBusy.current = false;
    if (!r.ok) { if (!next) window.dispatchEvent(new CustomEvent("qf-shift", { detail: on && !priv })); setBarMsg(controlError(r.status)); return; }
    mutationAt.current = Date.now();
    if (next) pauseWork(); else if (on) work.current.since = Date.now();
    window.dispatchEvent(new Event("qf-tracking-resume"));
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
      if (j.demo) return manual(L["drv.demoManual"], true);
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
      } else manual(r.status === 413 ? L["drv.tooBig"] : r.status === 415 ? L["drv.notImage"] : r.status === 422 ? L["drv.notReceipt"] : r.status === 429 ? L["drv.rateLimited"] : L["drv.readManual"], ![413, 415, 422].includes(r.status));
    } catch { manual(L["drv.readManual"], true); }
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draftReady || receiptLock.current || busy || read === L["drv.reading"]) return; // lock before the first asynchronous write
    if (receiptVehicle.current !== vehicleId) { setFormErr(tri(loc, "Camionul atribuit s-a schimbat. Bonul este păstrat în formular; verifică alocarea înainte de trimitere.|Assigned truck changed. Your receipt stays in the form; check the assignment before sending.|Przypisany pojazd zmienił się. Paragon pozostaje w formularzu; sprawdź przypisanie przed wysłaniem.")); return; }
    const litres = decNum(f.litres), odoS = f.odo.replace(/[\s.]/g, ""), odo = Number(odoS);
    if (!(litres >= 1 && litres <= 2000)) { setFormErr(L["drv.litresRange"]); return; }
    if (!/^\d+$/.test(odoS) || !(odo >= 1 && odo <= 5_000_000)) { setFormErr(L["drv.odoRange"]); return; }
    const amount = f.amount.trim() ? decNum(f.amount) : null;
    if (amount !== null && amount > AMOUNT_MAX) { setFormErr(tri(loc, "Suma e prea mare (maximum 10.000.000). Verifică cifrele de pe bon.|Amount is too large (maximum 10,000,000). Check the digits on the receipt.|Kwota jest za duża (maksymalnie 10 000 000). Sprawdź cyfry na paragonie.")); return; }
    if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) { setFormErr(tri(loc, "Verifică suma bonului: trebuie să fie un număr pozitiv.|Check the receipt amount: enter a positive number.|Sprawdź kwotę paragonu: wpisz liczbę dodatnią.")); return; }
    receiptLock.current = true;
    setFormErr(""); setBusy(true);
    try {
      const fd = new FormData();
      fd.append("vehicleId", vehicleId); if (rPlate && aiOk) fd.append("plate", rPlate.slice(0, 20)); fd.append("litres", String(litres)); fd.append("odometerKm", String(odo)); fd.append("station", clipChars(f.station, 80)); fd.append("amount", amount === null ? "" : String(amount)); fd.append("aiRead", String(aiOk)); fd.append("key", idem.current); fd.append("currency", cur); if (rDate) fd.append("date", rDate);
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
        setMsg({ t: (j.dup ? L["drv.dup"] : L["drv.sent"]) + fxT, k: fx && !fx.ok ? "warn" : "ok" }); setCur("RON"); setRDate(""); setLast(`${fmtNum(loc, litres, litres % 1 ? 1 : 0)} L · ${clipChars(f.station, 80) || "—"}`); setForm(false); setF({ litres: "", odo: "", amount: "", station: "" }); setPhoto(null); setRead(""); setAiOk(false); }
      else { if (r?.status === 409) setMsg({ t: "", k: "" }); setFormErr(r?.status === 409 ? L["drv.role"] : r?.status === 413 ? L["drv.tooBig"] : L["drv.invalid"]); }
    } catch { setFormErr(tri(loc, "Bonul nu a putut fi păstrat pe telefon. Nu închide formularul; încearcă din nou.|Could not save the receipt on this device. Keep the form open and retry.|Nie udało się zapisać paragonu. Nie zamykaj formularza i spróbuj ponownie.")); } finally { receiptLock.current = false; setBusy(false); }
  }
  const trackingOk = gps === "ok" && lastAck !== null && now - lastAck < 90000;
  const w = work.current, hours = (w.ms + (w.since !== null ? Math.max(0, now - w.since) : 0)) / 3600000;
  const state = !on ? "off" : priv ? "priv" : "on";
  const stateLabel = !on ? L["drv.offShift"] : priv ? tri(loc, "Pauză privată|Private break|Przerwa prywatna") : L["drv.onShift"];
  // o singură frază: ce vede patronul acum (aceeași regulă ca pe server: poziții doar în tură, niciuna în privat)
  const ownerLine = !on ? tri(loc, "În afara turei nu se trimite nicio poziție.|Off shift: no location is sent.|Poza zmianą lokalizacja nie jest wysyłana.")
    : priv ? tri(loc, "Patronul vede doar „Privat”, fără poziție.|The owner sees only “Private”, no location.|Właściciel widzi tylko „Prywatnie”, bez lokalizacji.")
    : tri(loc, "Patronul vede camionul pe hartă. Privat = fără poziție.|The owner sees the truck on the map. Private = no location.|Właściciel widzi pojazd na mapie. Prywatnie = bez lokalizacji.");
  const gpsIssue = on && !priv && !demo && !held && (gps === "error" || gps === "off" || !trackingOk);
  return (
    <div className="phone drv-home">
      {preview ? <div className="pvbar fade" role="note"><b>{L["drv.preview"]}</b><span>{L["drv.previewHint"]}</span></div> : null}
      <div className="drv-hello fade"><div><div className="eyebrow">{vehicleName}</div><h1>{hello}</h1></div><span className={`drv-state s-${state}`} role="status"><i aria-hidden="true" />{stateLabel}</span></div>
      {top}
      {!on && !preview && switchTo && switchTo.length ? (
        <div className="drvtruck fade d1">
          <div><span className="eyebrow">{L["drv.truckQ"]}</span><b>{vehicleName}</b></div>
          <details><summary className="btn sec sm">{L["drv.truckChange"]}</summary><div className="drvtruck-list">{switchTo.map((x) => <a key={x.id} href={`/driver?v=${x.id}`} className="btn sec sm">{x.name}</a>)}</div></details>
        </div>
      ) : null}
      {held && !demo ? <div className="msg warn driver-gps-hold" role="status"><span>{tri(loc, "GPS rămâne oprit pe acest dispozitiv. Reîncearcă operația neconfirmată sau reia GPS explicit.|GPS remains stopped on this device. Retry the unconfirmed action or explicitly resume GPS.|GPS pozostaje wyłączony. Ponów niepotwierdzoną operację lub wznów GPS.")}</span><button type="button" className="btn sec sm" onClick={() => window.dispatchEvent(new Event("qf-tracking-resume"))}>{tri(loc, "Reia GPS|Resume GPS|Wznów GPS")}</button></div> : null}
      <section ref={shiftCard} id="drv-shift" className={`drv-shift fade d1 s-${state}${needCheck ? " need" : ""}`} aria-label={tri(loc, "Tura|Shift|Zmiana")}>
        <div className="drv-shift-stats">
          <div><b suppressHydrationWarning>{fmtNum(loc, shownKm, 1)}</b><span>{L["drv.kmToday"]}</span></div>
          <div><b suppressHydrationWarning>{fmtNum(loc, hours, 1)}<small>h</small></b><span>{L["drv.hoursToday"]}</span></div>
        </div>
        {!on && queueReady && (hasWork || withoutTrip) ? (
          <div className="drv-check" id="drv-check" ref={checkBox}>
            <div className="eyebrow">{L["drv.check"]} <span className="drv-check-n">{Math.min(checks.length, CHECKS.length)}/{CHECKS.length}</span></div>
            {needCheck && checks.length < 3 ? <p className="msg err drv-check-need" role="alert">{L["drv.checkNeeded"]}</p> : null}
            {CHECKS.map((c) => <div key={c} className="chkrow" role="checkbox" aria-checked={checks.includes(c)} tabIndex={0} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); e.currentTarget.click(); } }} onClick={() => setChecks((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]))}><span>{L[c]}</span><span className={`chkbox${checks.includes(c) ? " on" : ""}`}>{checks.includes(c) ? <Icon name="check" /> : null}</span></div>)}
          </div>
        ) : null}
        {!on && !queueReady && <p role="status" className="sub">{tri(loc, queueError ? "Operațiunile locale nu pot fi citite. Reîncarcă pagina înainte de a începe tura.|Local actions could not be read. Reload before starting the shift.|Nie można odczytać operacji lokalnych. Odśwież stronę przed rozpoczęciem zmiany." : "Verificăm operațiunile salvate pe telefon…|Checking actions saved on this device…|Sprawdzanie operacji zapisanych na urządzeniu…")}</p>}
        {!on && queueReady && !hasWork && !withoutTrip ? <><p className="sub">{tri(loc, "Nicio cursă de pornit pe acest camion.|No trip to start on this truck.|Brak kursu do rozpoczęcia tym pojazdem.")}</p><button className="btn sec start" onClick={() => setWithoutTrip(true)}>{tri(loc, "Lucrez fără cursă alocată|Work without an assigned trip|Praca bez przypisanego kursu")}</button></> : null}
        <p className="drv-owner-line">{ownerLine}</p>
        {gpsIssue ? <p className="drv-gps-line" role="status">{gps === "error" ? tri(loc, "Poziția nu este confirmată de server|Position not confirmed by server|Pozycja niepotwierdzona przez serwer") : L[gps === "off" ? "priv.trackingOff" : "priv.trackingWait"]}{gps === "off" ? <small>{L["priv.trackingOffHint"]}</small> : null}</p> : null}
      </section>
      <ShiftBar state={state} blocked={!on && (!queueReady || (!hasWork && !withoutTrip))} start={on ? startAt : null} msg={barMsg} now={now} loc={loc} startLabel={L["drv.start"]} stopLabel={L["drv.stop"]} goRef={shiftTrigger}
        offSub={!queueReady ? tri(loc, "Se verifică telefonul…|Checking this device…|Sprawdzanie urządzenia…") : !hasWork && !withoutTrip ? tri(loc, "Nicio cursă de pornit|No trip to start|Brak kursu") : checks.length >= 3 ? tri(loc, "Verificare gata ✓|Check done ✓|Kontrola gotowa ✓") : tri(loc, `Verificare ${checks.length}/${CHECKS.length}|Check ${checks.length}/${CHECKS.length}|Kontrola ${checks.length}/${CHECKS.length}`)}
        onGo={onGo} onPriv={() => void togglePriv()} />
      {ask ? <ShiftConfirm kind={ask} plate={vehicleName} start={startAt} now={now} loc={loc} dialogRef={endDialog} onYes={() => { setAsk(null); void doToggle(); }} onNo={() => setAsk(null)} /> : null}
      {trip}
      <button className="btn sec start drv-fuel fade d2" disabled={!draftReady} onClick={() => setForm((x) => !x)} aria-expanded={form}><Icon name="fuel" size={20} /><span>{L["drv.fill"]}</span><small className="ell">{last}</small></button>
      {msg.t ? <p className={`msg ${msg.k}`}>{msg.t}</p> : null}
      {draftError ? <p className="msg warn" role="alert">{tri(loc, "Salvarea automată pe telefon nu este disponibilă. Păstrează pagina deschisă până trimiți bonul.|Autosave is unavailable. Keep this page open until you send the receipt.|Automatyczny zapis jest niedostępny. Nie zamykaj strony przed wysłaniem paragonu.")}</p> : null}
      {form && draftReady ? (
        <form className="sheet fade" onSubmit={send}>
          <label className="field receipt-photo" style={{ paddingTop: 0, cursor: "pointer" }}><span>{L["drv.photo"]}<br /><small style={{ color: "var(--fg3)" }}>{photo ? photo.name : demo ? L["drv.demoManual"] : L["drv.photoHint"]}</small></span><span className="ico" style={{ background: "var(--bg3)" }}><Icon name="camera" /></span><input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ""; void onPhoto(f); }} /></label>
          {read ? <p className="msg">{read}{readInfo ? <><br /><small style={{ color: "var(--fg2)" }}>{L["drv.readMeta"]}: {readInfo}</small></> : null}</p> : null}
          {([["litres", "drv.litres", "decimal"], ["odo", "drv.odo", "numeric"], ["amount", "drv.amount", "decimal"], ["station", "drv.station", "text"]] as const).map(([k, lab, mode]) => (
            <label key={k} className="field receipt-field"><span>{L[lab]}</span>{k === "amount" ? <select className="tsel cursel" aria-label={L["drv.cur"]} value={cur} onChange={(e) => setCur(e.target.value)}>{CURS.map((c) => <option key={c} value={c}>{c === "RON" ? "lei" : c}</option>)}</select> : null}<input className="input" aria-label={L[lab]} inputMode={mode} maxLength={k === "station" ? 80 : 12} value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} /></label>
          ))}
          {formErr ? <p className="msg err" role="alert">{formErr}</p> : null}
          <button className="btn pri start" style={{ height: 60, marginTop: 8 }} disabled={busy || preview || read === L["drv.reading"]} aria-busy={busy} title={preview ? L["drv.previewNo"] : undefined}>{busy ? L["drv.sending"] : L["drv.send"]}</button>
        </form>
      ) : null}
      <p className="sub drv-consent">{L["drv.consent"]}</p>
    </div>
  );
}

"use client";
// Bara de tură fixă deasupra meniului de jos: Pornește/Termină tura + Privat la o atingere, pe toate taburile.
// Acasă o alimentează DriverApp (verificarea de dimineață e acolo); Curse/Acte/Profil folosesc RemoteShiftBar.
import { useEffect, useRef, useState, type Ref } from "react";
import { useRouter } from "next/navigation";
import { tri, type Locale } from "@/lib/i18n";
import { postDriverControl } from "@/lib/driver-control";
import { Icon } from "./icons";

export type ShiftState = "off" | "on" | "priv";
export const shiftControlError = (loc: Locale, status: number) => [401, 403, 409].includes(status)
  ? tri(loc, "Tura, camionul sau sesiunea s-a schimbat. Reîncarcă pagina și verifică starea înainte să reîncerci.|The shift, truck or session changed. Reload and check the current state before retrying.|Zmiana, pojazd lub sesja uległy zmianie. Odśwież i sprawdź stan przed ponowieniem.")
  : tri(loc, "Operația nu este confirmată. Verifică internetul și reîncearcă.|Action not confirmed. Check your connection and retry.|Operacja niepotwierdzona. Sprawdź połączenie i spróbuj ponownie.");

const elapsed = (ms: number) => {
  const m = Math.max(0, Math.floor(ms / 60000)), h = Math.floor(m / 60), mm = m % 60;
  return h ? `${h}h ${String(mm).padStart(2, "0")}m` : `${mm} min`;
};

export function ShiftBar({ state, start, now, loc, startLabel, stopLabel, offSub, onGo, onPriv, goRef, busy, msg, blocked }: {
  blocked?: boolean; state: ShiftState; start?: string | null; now: number; loc: Locale; startLabel: string; stopLabel: string; offSub: string;
  onGo: () => void; onPriv: () => void; goRef?: Ref<HTMLButtonElement>; busy?: boolean; msg?: string;
}) {
  const t0 = start ? Date.parse(start) : NaN;
  const sub = state === "off" ? offSub
    : state === "priv" ? tri(loc, "Privat · fără poziție|Private · no location|Bez lokalizacji")
    : `${tri(loc, "În tură|On shift|Na zmianie")}${Number.isNaN(t0) ? "" : ` ${elapsed(now - t0)}`}`;
  const privLabel = tri(loc, "Privat|Private|Prywatnie");
  return <div className={`dsb s-${state}`} role="region" aria-label={tri(loc, "Tura|Shift|Zmiana")}>
    {msg ? <p className="dsb-msg" role="alert">{msg}</p> : null}
    <button ref={goRef} type="button" className={`dsb-go${state === "off" ? (blocked ? " blocked" : "") : " stop"}`} onClick={onGo} aria-disabled={state === "off" && blocked ? true : undefined} aria-busy={busy || undefined} disabled={busy}>
      <span className="dsb-ic" aria-hidden="true"><Icon name={state === "off" ? "play" : "pause"} size={20} /></span>
      <span className="dsb-t"><b>{state === "off" ? startLabel : stopLabel}</b><small key={state} suppressHydrationWarning>{sub}</small></span>
    </button>
    <button type="button" className={`dsb-priv${state === "priv" ? " on" : ""}`} onClick={onPriv} disabled={state === "off" || busy} aria-pressed={state === "priv"}
      aria-label={`${privLabel}: ${state === "priv" ? tri(loc, "pornit|on|włączony") : tri(loc, "oprit|off|wyłączony")}`}
      title={state === "off" ? tri(loc, "Privat merge doar în timpul turei|Private works only during a shift|Tryb prywatny działa tylko w trakcie zmiany") : undefined}>
      <span className="dsb-sw" aria-hidden="true"><i /></span><span className="dsb-pl">{privLabel}</span>
    </button>
  </div>;
}

type Labels = { start: string; stop: string; endQ: string; endTxt: string; endYes: string; endNo: string };
/** Curse / Acte / Profil: aceeași tură, aceleași API-uri; pornirea trece prin verificarea de pe Acasă. */
export function RemoteShiftBar({ vehicleId, initial, serverNow, loc, labels: L, preview, demo }: {
  vehicleId: string; initial: { start: string; priv: boolean } | null; serverNow: number; loc: Locale; labels: Labels; preview?: boolean; demo?: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(!!initial), [priv, setPriv] = useState(!!initial?.priv), [start, setStart] = useState(initial?.start ?? null);
  const [now, setNow] = useState(serverNow), [ask, setAsk] = useState(false), [busy, setBusy] = useState(false), [msg, setMsg] = useState("");
  const lock = useRef(false), mutationAt = useRef(0), dialog = useRef<HTMLDialogElement>(null), go = useRef<HTMLButtonElement>(null);
  useEffect(() => { setNow(Date.now()); const i = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(i); }, []);
  useEffect(() => {
    if (lock.current || Date.now() - mutationAt.current < 5000) return;
    setOn(!!initial); setPriv(!!initial?.priv); setStart(initial?.start ?? null);
  }, [initial?.start, initial?.priv, serverNow]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!ask) return; const d = dialog.current, trigger = go.current; d?.showModal(); document.documentElement.classList.add("msheet-open"); return () => { d?.close(); document.documentElement.classList.remove("msheet-open"); trigger?.focus(); }; }, [ask]);
  useEffect(() => { if (!msg) return; const i = setTimeout(() => setMsg(""), 6000); return () => clearTimeout(i); }, [msg]);
  const done = () => { mutationAt.current = Date.now(); window.dispatchEvent(new Event("qf-tracking-resume")); router.refresh(); };
  function onGo() {
    // pornirea cere verificarea de dimineață → o deschidem pe Acasă; patronul în previzualizare merge tot acolo
    if (!on || preview) { router.push(preview ? "/driver" : "/driver?check=1"); return; }
    setAsk(true);
  }
  async function stop() {
    if (lock.current) return; lock.current = true; setBusy(true);
    window.dispatchEvent(new Event("qf-tracking-pause"));
    const r = await postDriverControl("/api/driver/shift", { vehicleId, action: "stop", checklist: [], ...(!demo && start ? { expectedShiftStart: start } : {}) });
    lock.current = false; setBusy(false);
    if (!r.ok) { window.dispatchEvent(new CustomEvent("qf-shift", { detail: on && !priv })); setMsg(shiftControlError(loc, r.status)); return; }
    setOn(false); setPriv(false); setStart(null); setMsg("");
    window.dispatchEvent(new CustomEvent("qf-shift", { detail: false })); done();
  }
  async function togglePriv() {
    if (preview) { router.push("/driver"); return; }
    if (lock.current || !on) return; lock.current = true; setBusy(true);
    const next = !priv;
    if (next) window.dispatchEvent(new Event("qf-tracking-pause"));
    const r = await postDriverControl("/api/driver/private", { vehicleId, on: next, ...(!demo && start ? { expectedShiftStart: start } : {}) });
    lock.current = false; setBusy(false);
    if (!r.ok) { if (!next) window.dispatchEvent(new CustomEvent("qf-shift", { detail: on && !priv })); setMsg(shiftControlError(loc, r.status)); return; }
    setPriv(next); setMsg("");
    window.dispatchEvent(new CustomEvent("qf-shift", { detail: !next })); done();
  }
  return <>
    <ShiftBar state={!on ? "off" : priv ? "priv" : "on"} start={start} now={now} loc={loc} startLabel={L.start} stopLabel={L.stop}
      offSub={tri(loc, "Întâi verificarea|Check first|Najpierw kontrola")} onGo={onGo} onPriv={() => void togglePriv()} goRef={go} busy={busy} msg={msg} />
    {ask ? <dialog ref={dialog} className="msheet-bg any" aria-labelledby="dsb-endq" onCancel={() => setAsk(false)} onClick={(e) => { if (e.target === e.currentTarget) setAsk(false); }}><div className="msheet endsheet" onClick={(e) => e.stopPropagation()}>
      <div className="msheet-grab" /><h3 id="dsb-endq">{L.endQ}</h3><p>{L.endTxt}</p>
      <button className="btn pri danger" autoFocus onClick={() => { setAsk(false); void stop(); }}>{L.endYes}</button>
      <button className="btn sec" onClick={() => setAsk(false)}>{L.endNo}</button>
    </div></dialog> : null}
  </>;
}

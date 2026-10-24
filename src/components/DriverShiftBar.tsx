"use client";
// Bara de tură fixă deasupra meniului de jos: Pornește/Termină tura + Privat la o atingere, pe toate taburile.
// Acasă o alimentează DriverApp (verificarea de dimineață e acolo); Curse/Acte/Profil folosesc RemoteShiftBar.
import { useEffect, useRef, useState, type Ref, type RefObject } from "react";
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

/** Confirmarea de pornire/oprire a turei: întrebare scurtă + camion + ce se întâmplă cu locația; Da / Anulează. */
export function ShiftConfirm({ kind, plate, start, now, loc, dialogRef, onYes, onNo }: {
  kind: "start" | "stop"; plate: string; start?: string | null; now: number; loc: Locale; dialogRef: RefObject<HTMLDialogElement | null>; onYes: () => void; onNo: () => void;
}) {
  const t0 = start ? Date.parse(start) : NaN;
  const q = kind === "start" ? tri(loc, "Pornești tura acum?|Start your shift now?|Zacząć zmianę teraz?") : tri(loc, "Termini tura acum?|End your shift now?|Zakończyć zmianę teraz?");
  const meta = kind === "start" ? tri(loc, "Verificare făcută ✓|Check done ✓|Kontrola gotowa ✓")
    : Number.isNaN(t0) ? tri(loc, "În tură|On shift|Na zmianie") : `${tri(loc, "În tură de|On shift for|Na zmianie od")} ${elapsed(now - t0)}`;
  const txt = kind === "start"
    ? tri(loc, "Locația camionului se trimite firmei cât ești în tură. O poți opri oricând cu Privat.|The truck's location is shared with your company while you're on shift. Pause it anytime with Private.|Lokalizacja pojazdu jest wysyłana firmie w trakcie zmiany. Możesz ją wstrzymać przyciskiem Prywatnie.")
    : tri(loc, "Se oprește trimiterea locației. Cursa rămâne deschisă până apeși „Am descărcat”.|Location sharing stops. The trip stays open until you tap “Unloaded”.|Wysyłanie lokalizacji zostanie zatrzymane. Kurs pozostaje otwarty do „Rozładowano”.");
  const yes = kind === "start" ? tri(loc, "Da, pornește tura|Yes, start shift|Tak, zacznij zmianę") : tri(loc, "Da, termină tura|Yes, end shift|Tak, zakończ zmianę");
  const id = `shq-${kind}`;
  return <dialog ref={dialogRef} className={`msheet-bg any shq-${kind}`} aria-labelledby={id} aria-describedby={`${id}-d`} onCancel={(e) => { e.preventDefault(); onNo(); }} onClick={(e) => { if (e.target === e.currentTarget) onNo(); }}>
    <div className="msheet endsheet shq" onClick={(e) => e.stopPropagation()}>
      <div className="msheet-grab" />
      <span className={`shq-ic ${kind === "start" ? "shq-ic-go" : "shq-ic-end"}`} aria-hidden="true"><Icon name={kind === "start" ? "play" : "pause"} size={22} /></span>
      <h3 id={id}>{q}</h3>
      <p className="shq-meta"><b>{plate}</b><span aria-hidden="true"> · </span><span suppressHydrationWarning>{meta}</span></p>
      <p id={`${id}-d`}>{txt}</p>
      <button type="button" className={`btn pri ${kind === "start" ? "go" : "danger"}`} autoFocus onClick={onYes}>{yes}</button>
      <button type="button" className="btn sec" onClick={onNo}>{tri(loc, "Anulează|Cancel|Anuluj")}</button>
    </div>
  </dialog>;
}

type Labels = { start: string; stop: string };
/** Curse / Acte / Profil: aceeași tură, aceleași API-uri; pornirea trece prin verificarea de pe Acasă. */
export function RemoteShiftBar({ vehicleId, plate, initial, serverNow, loc, labels: L, preview, demo }: {
  vehicleId: string; plate: string; initial: { start: string; priv: boolean } | null; serverNow: number; loc: Locale; labels: Labels; preview?: boolean; demo?: boolean;
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
    {ask ? <ShiftConfirm kind="stop" plate={plate} start={start} now={now} loc={loc} dialogRef={dialog} onYes={() => { setAsk(false); void stop(); }} onNo={() => setAsk(false)} /> : null}
  </>;
}

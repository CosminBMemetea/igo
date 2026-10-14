"use client";
// „+ Cursă nouă”: de unde, unde, când, șofer — restul se completează singur (camionul șoferului, km estimați).
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TripDictation } from "./TripDictation";
import Link from "next/link";
import { tri } from "@/lib/i18n";
import { estimateKm } from "@/lib/trip-new";

type Loc = "ro" | "en" | "pl";
const L = {
  ro: { btn: "+ Cursă nouă", dup: "Duplică cursa", title: "Cursă nouă", quick: "Scrie sau dictează", quickPh: "ex. Salonta–Timișoara mâine, Ion", fill: "Completează", mic: "Dictează", from: "De unde", to: "Unde", when: "Când", today: "Azi", tmr: "Mâine", day2: "Poimâine", driver: "Șofer", noDriver: "Fără șofer", truck: "Camion", auto: "din camionul șoferului", km: "Km (estimat)", kmNeed: "Orașul nu e în listă: scrie km aproximativ.", more: "Client, tonaj, preț (opțional)", client: "Client", tonnes: "Tonaj (t)", revenue: "Preț cursă (lei)", save: "Creează cursa", saving: "Se salvează…", cancel: "Anulează", ok: "Cursa a fost creată și apare la șofer în „Cursa de azi”.", e: { conflict: "Cererea a fost deja salvată cu alte date. Verifică lista de curse.", route: "Completează de unde și unde.", date: "Alege data.", truck: "Alege camionul.", km: "Scrie km aproximativ.", closed: "Cursa a fost încheiată sau nu mai este disponibilă. Reîncarcă pagina.", num: "Verifică tonajul și prețul: folosește valori pozitive valide.", driver: "Șoferul nu are acest camion alocat. Verifică alocarea în Șoferi.", nofirm: "Doar patronul poate crea curse.", bad: "Nu am putut salva. Încearcă din nou." }, parsed: "Am completat din text — verifică și salvează.", parseFail: "N-am înțeles tot; completează ce lipsește." },
  en: { btn: "+ New trip", dup: "Duplicate trip", title: "New trip", quick: "Type or dictate", quickPh: "e.g. Salonta–Timișoara tomorrow, Ion", fill: "Fill in", mic: "Dictate", from: "From", to: "To", when: "When", today: "Today", tmr: "Tomorrow", day2: "In 2 days", driver: "Driver", noDriver: "No driver", truck: "Truck", auto: "from the driver's truck", km: "Km (estimate)", kmNeed: "City not in the list: enter approximate km.", more: "Client, tonnage, price (optional)", client: "Client", tonnes: "Tonnage (t)", revenue: "Trip price (lei)", save: "Create trip", saving: "Saving…", cancel: "Cancel", ok: "Trip created; the driver sees it under “Today's trip”.", e: { conflict: "This request was saved with different details. Check the trips list.", route: "Fill in from and to.", date: "Pick a date.", truck: "Pick a truck.", km: "Enter approximate km.", closed: "Trip completed or unavailable. Reload the page.", num: "Check tonnage and price: enter valid non-negative values.", driver: "This truck is not assigned to that driver. Check Drivers.", nofirm: "Only the owner can create trips.", bad: "Couldn't save. Try again." }, parsed: "Filled in from your text — check and save.", parseFail: "Didn't get everything; fill in what's missing." },
  pl: { btn: "+ Nowy kurs", dup: "Duplikuj kurs", title: "Nowy kurs", quick: "Napisz lub podyktuj", quickPh: "np. Salonta–Timișoara jutro, Ion", fill: "Uzupełnij", mic: "Dyktuj", from: "Skąd", to: "Dokąd", when: "Kiedy", today: "Dziś", tmr: "Jutro", day2: "Pojutrze", driver: "Kierowca", noDriver: "Bez kierowcy", truck: "Pojazd", auto: "z pojazdu kierowcy", km: "Km (szacunek)", kmNeed: "Miasta nie ma na liście: wpisz przybliżone km.", more: "Klient, tonaż, cena (opcjonalnie)", client: "Klient", tonnes: "Tonaż (t)", revenue: "Cena kursu (lei)", save: "Utwórz kurs", saving: "Zapisuję…", cancel: "Anuluj", ok: "Kurs utworzony; kierowca widzi go w „Dzisiejszy kurs”.", e: { conflict: "Żądanie zapisano z innymi danymi. Sprawdź listę kursów.", route: "Uzupełnij skąd i dokąd.", date: "Wybierz datę.", truck: "Wybierz pojazd.", km: "Wpisz przybliżone km.", closed: "Kurs zakończony lub niedostępny. Odśwież stronę.", num: "Sprawdź tonaż i cenę: wpisz poprawne wartości nieujemne.", driver: "Ten pojazd nie jest przypisany do kierowcy. Sprawdź Kierowców.", nofirm: "Tylko właściciel może tworzyć kursy.", bad: "Nie udało się zapisać. Spróbuj ponownie." }, parsed: "Uzupełniono z tekstu — sprawdź i zapisz.", parseFail: "Nie wszystko zrozumiałem; uzupełnij brakujące." },
} as const;
export interface NTDriver { id: string; name: string; truckId: string | null }
export interface NTPrefill { date?: string; from?: string; to?: string; driverId?: string | null; truckId?: string | null; client?: string; tonnes?: number | null; km?: number | null; revenue?: number | null }
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };


export function NewTrip({ loc, today, drivers, trucks, prefill, dup, autoOpen, editId }: { loc: Loc; today: string; drivers: NTDriver[]; trucks: { id: string; plate: string }[]; prefill?: NTPrefill; dup?: boolean; autoOpen?: boolean; editId?: string }) {
  const T = L[loc] ?? L.ro, r = useRouter();
  const [open, setOpen] = useState(!!autoOpen), [busy, setBusy] = useState(false), [msg, setMsg] = useState<{ t: string; k: "ok" | "err" | "" }>({ t: "", k: "" });
  const [f, setF] = useState({ from: prefill?.from ?? "", to: prefill?.to ?? "", date: editId ? prefill?.date ?? today : dup ? addDays(today, 1) : today, driverId: prefill?.driverId ?? "", truckId: prefill?.truckId ?? "", km: prefill?.km ? String(prefill.km) : "", kmTouched: !!prefill?.km, client: prefill?.client && prefill.client !== "—" ? prefill.client : "", tonnes: prefill?.tonnes != null ? String(prefill.tonnes) : "", revenue: prefill?.revenue != null ? String(prefill.revenue) : "" });
  const [quick, setQuick] = useState("");
  const [dictating, setDictating] = useState(false);
  const requestLock = useRef(false);
  const submission = useRef<{ body: string; key: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), titleId = useId();
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  // camionul: din șoferul ales, dacă nu l-a schimbat patronul
  const [truckTouched, setTruckTouched] = useState(!!prefill?.truckId);
  useEffect(() => { if (truckTouched) return; const d = drivers.find((x) => x.id === f.driverId); set({ truckId: d?.truckId ?? "" }); }, [f.driverId]); // eslint-disable-line react-hooks/exhaustive-deps
  const est = useMemo(() => (f.from && f.to ? estimateKm(f.from, f.to) : null), [f.from, f.to]);
  useEffect(() => { if (!f.kmTouched) set({ km: est ? String(est) : "" }); }, [est]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.documentElement.style.overflow;
    dialog.current?.showModal();
    dialog.current?.querySelector<HTMLInputElement>("input")?.focus();
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = overflow; previous?.focus(); };
  }, [open]);


  async function parse(text: string) {
    if (!text.trim() || requestLock.current) return;
    requestLock.current = true; setBusy(true);
    const j = await fetch("/api/trips/parse", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(12000) }).then((x) => x.ok ? x.json() : null).catch(() => null) as (NTPrefill & { date?: string; km?: number | null; driver?: string }) | null;
    requestLock.current = false; setBusy(false);
    if (!j) { setMsg({ t: T.e.bad, k: "err" }); return; }
    set({ ...(j.from ? { from: j.from } : {}), ...(j.to ? { to: j.to } : {}), ...(j.date ? { date: j.date } : {}), ...(j.driverId ? { driverId: j.driverId } : {}), ...(j.client ? { client: j.client } : {}), ...(j.tonnes != null ? { tonnes: String(j.tonnes) } : {}), ...(j.from && j.to ? { km: j.km ? String(j.km) : "", kmTouched: true } : {}) });
    if (j.driver) { setTruckTouched(false); set({ driverId: j.driverId ?? "", truckId: j.truckId ?? "" }); }
    setMsg({ t: j.from && j.to ? T.parsed : T.parseFail, k: j.from && j.to ? "ok" : "err" });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (requestLock.current || dictating) return;
    if (!f.from.trim() || !f.to.trim()) { setMsg({ t: T.e.route, k: "err" }); return; }
    if (!f.truckId && !f.driverId) { setMsg({ t: T.e.truck, k: "err" }); return; }
    if (!f.km) { setMsg({ t: T.e.km, k: "err" }); return; }
    requestLock.current = true; setBusy(true);
    const body = JSON.stringify({ ...f, id: editId, driverId: f.driverId || null });
    if (!submission.current || submission.current.body !== body) submission.current = { body, key: crypto.randomUUID() };
    const res = await fetch("/api/trips/new", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...JSON.parse(body), key: submission.current.key }), signal: AbortSignal.timeout(20000) }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    requestLock.current = false; setBusy(false);
    if (!res?.ok) { setMsg({ t: (T.e as Record<string, string>)[j.error as string] ?? T.e.bad, k: "err" }); return; }
    submission.current = null;
    setMsg({ t: tri(loc, "Cursa a fost salvată.|Trip saved.|Kurs zapisany."), k: "ok" }); setOpen(false); r.refresh();
    r.push(`/trips/${j.id}`);
  }
  const dateChips: [string, string][] = [[T.today, today], [T.tmr, addDays(today, 1)], [T.day2, addDays(today, 2)]];
  return (
    <>
      <button type="button" className={`btn ${dup ? "sec sm" : "pri"} ntbtn`} onClick={() => { setMsg({ t: "", k: "" }); setOpen(true); }}>{editId ? tri(loc, "Editează cursa|Edit trip|Edytuj kurs") : dup ? T.dup : T.btn}</button>
      {msg.k === "ok" && !open ? <p className="msg ok nt-ok" role="status">{msg.t}</p> : null}
      {open ? (
        <dialog ref={dialog} className="msheet-bg any" aria-labelledby={titleId} onCancel={(e) => { e.preventDefault(); if (!requestLock.current) setOpen(false); }} onClick={(e) => { if (e.target === e.currentTarget && !requestLock.current) setOpen(false); }}>
          <form className="msheet ntsheet" onClick={(e) => e.stopPropagation()} onSubmit={save} noValidate>
            <div className="msheet-grab" />
            <div className="nt-heading"><h3 id={titleId}>{editId ? tri(loc, "Editează cursa|Edit trip|Edytuj kurs") : dup ? T.dup : T.title}</h3><button type="button" className="ico" aria-label={T.cancel} disabled={busy} onClick={() => setOpen(false)}>✕</button></div>
            <div className="ntquick">
              <label className="lf"><span>{T.quick}</span><input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder={T.quickPh} enterKeyHint="go" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void parse(quick); } }} /></label>
              <div className="ntqbtns"><TripDictation loc={loc} disabled={busy} onActive={setDictating} onText={(text) => { setQuick(text); void parse(text); }} /><button type="button" className="btn sec sm" disabled={busy || dictating || !quick.trim()} onClick={() => parse(quick)}>✨ {T.fill}</button></div>
            </div>
            <div className="nt2">
              <label className="lf"><span>{T.from}</span><input value={f.from} onChange={(e) => set({ from: e.target.value, kmTouched: false })} required maxLength={60} autoComplete="off" placeholder="Salonta" /></label>
              <label className="lf"><span>{T.to}</span><input value={f.to} onChange={(e) => set({ to: e.target.value, kmTouched: false })} required maxLength={60} autoComplete="off" placeholder="Timișoara" /></label>
            </div>
            <div className="lf"><span>{T.when}</span><div className="ntchips">{dateChips.map(([l, d]) => <button key={d} type="button" className={`chip${f.date === d ? " on" : ""}`} onClick={() => set({ date: d })} aria-pressed={f.date === d}>{l}</button>)}<input type="date" value={f.date} min={editId ? undefined : today} onChange={(e) => set({ date: e.target.value })} aria-label={T.when} /></div></div>
            <div className="lf"><span>{T.driver}</span><div className="ntchips">{drivers.map((d) => <button key={d.id} type="button" className={`chip${f.driverId === d.id ? " on" : ""}`} onClick={() => { setTruckTouched(false); set({ driverId: d.id }); }} aria-pressed={f.driverId === d.id} disabled={!d.truckId}>{d.name}{!d.truckId ? " · " + tri(loc, "fără camion|no truck|bez pojazdu") : ""}</button>)}<button type="button" className={`chip${!f.driverId ? " on" : ""}`} onClick={() => { setTruckTouched(true); set({ driverId: "" }); }} aria-pressed={!f.driverId}>{T.noDriver}</button></div></div>
            <p className="hint"><Link href="/drivers">{tri(loc, "Gestionează șoferii și alocările|Manage drivers and assignments|Zarządzaj kierowcami i przydziałami")}</Link></p>
            <div className="nt2">
              <label className="lf"><span>{T.truck}{f.truckId && !truckTouched && drivers.find((x) => x.id === f.driverId)?.truckId === f.truckId ? <small> · {T.auto}</small> : null}</span><select value={f.truckId} onChange={(e) => { setTruckTouched(true); set({ truckId: e.target.value, driverId: drivers.find((d) => d.truckId === e.target.value)?.id ?? "" }); }}><option value="">—</option>{trucks.map((t) => <option key={t.id} value={t.id}>{t.plate}</option>)}</select></label>
              <label className="lf"><span>{T.km}</span><input inputMode="numeric" value={f.km} onChange={(e) => set({ km: e.target.value.replace(/[^\d]/g, ""), kmTouched: true })} placeholder={est ? String(est) : "—"} /></label>
            </div>
            {f.from && f.to && !est && !f.km ? <p className="hint">{T.kmNeed}</p> : null}
            <details className="ntmore" open={!!(f.client || f.tonnes || f.revenue)}><summary>{T.more}</summary>
              <label className="lf"><span>{T.client}</span><input value={f.client} onChange={(e) => set({ client: e.target.value })} maxLength={120} /></label>
              <div className="nt2"><label className="lf"><span>{T.tonnes}</span><input inputMode="decimal" value={f.tonnes} onChange={(e) => set({ tonnes: e.target.value })} /></label><label className="lf"><span>{T.revenue}</span><input inputMode="decimal" value={f.revenue} onChange={(e) => set({ revenue: e.target.value })} /></label></div>
            </details>
            {msg.t && open ? <p className={`msg ${msg.k}`} role={msg.k === "err" ? "alert" : "status"}>{msg.t}</p> : null}
            <button className="btn pri ntsave" disabled={busy || dictating} aria-busy={busy}>{busy ? T.saving : editId ? tri(loc, "Salvează modificările|Save changes|Zapisz zmiany") : T.save}</button>
            <button type="button" className="btn sec ntsave" disabled={busy} onClick={() => setOpen(false)}>{T.cancel}</button>
          </form>
        </dialog>
      ) : null}
    </>
  );
}

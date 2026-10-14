"use client";
// „+ Cursă nouă”: de unde, unde, când, șofer — restul se completează singur (camionul șoferului, km estimați).
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { estimateKm } from "@/lib/trip-new";

type Loc = "ro" | "en" | "pl";
const L = {
  ro: { btn: "+ Cursă nouă", dup: "Duplică cursa", title: "Cursă nouă", quick: "Scrie sau dictează", quickPh: "ex. Salonta–Timișoara mâine, Ion", fill: "Completează", mic: "Dictează", from: "De unde", to: "Unde", when: "Când", today: "Azi", tmr: "Mâine", day2: "Poimâine", driver: "Șofer", noDriver: "Fără șofer", truck: "Camion", auto: "din camionul șoferului", km: "Km (estimat)", kmNeed: "Orașul nu e în listă: scrie km aproximativ.", more: "Client, tonaj, preț (opțional)", client: "Client", tonnes: "Tonaj (t)", revenue: "Preț cursă (lei)", save: "Creează cursa", saving: "Se salvează…", cancel: "Anulează", ok: "Cursa a fost creată și apare la șofer în „Cursa de azi”.", e: { route: "Completează de unde și unde.", date: "Alege data.", truck: "Alege camionul.", km: "Scrie km aproximativ.", driver: "Șoferul nu mai e activ.", nofirm: "Doar patronul poate crea curse.", bad: "Nu am putut salva. Încearcă din nou." }, parsed: "Am completat din text — verifică și salvează.", parseFail: "N-am înțeles tot; completează ce lipsește." },
  en: { btn: "+ New trip", dup: "Duplicate trip", title: "New trip", quick: "Type or dictate", quickPh: "e.g. Salonta–Timișoara tomorrow, Ion", fill: "Fill in", mic: "Dictate", from: "From", to: "To", when: "When", today: "Today", tmr: "Tomorrow", day2: "In 2 days", driver: "Driver", noDriver: "No driver", truck: "Truck", auto: "from the driver's truck", km: "Km (estimate)", kmNeed: "City not in the list: enter approximate km.", more: "Client, tonnage, price (optional)", client: "Client", tonnes: "Tonnage (t)", revenue: "Trip price (lei)", save: "Create trip", saving: "Saving…", cancel: "Cancel", ok: "Trip created; the driver sees it under “Today's trip”.", e: { route: "Fill in from and to.", date: "Pick a date.", truck: "Pick a truck.", km: "Enter approximate km.", driver: "That driver is no longer active.", nofirm: "Only the owner can create trips.", bad: "Couldn't save. Try again." }, parsed: "Filled in from your text — check and save.", parseFail: "Didn't get everything; fill in what's missing." },
  pl: { btn: "+ Nowy kurs", dup: "Duplikuj kurs", title: "Nowy kurs", quick: "Napisz lub podyktuj", quickPh: "np. Salonta–Timișoara jutro, Ion", fill: "Uzupełnij", mic: "Dyktuj", from: "Skąd", to: "Dokąd", when: "Kiedy", today: "Dziś", tmr: "Jutro", day2: "Pojutrze", driver: "Kierowca", noDriver: "Bez kierowcy", truck: "Pojazd", auto: "z pojazdu kierowcy", km: "Km (szacunek)", kmNeed: "Miasta nie ma na liście: wpisz przybliżone km.", more: "Klient, tonaż, cena (opcjonalnie)", client: "Klient", tonnes: "Tonaż (t)", revenue: "Cena kursu (lei)", save: "Utwórz kurs", saving: "Zapisuję…", cancel: "Anuluj", ok: "Kurs utworzony; kierowca widzi go w „Dzisiejszy kurs”.", e: { route: "Uzupełnij skąd i dokąd.", date: "Wybierz datę.", truck: "Wybierz pojazd.", km: "Wpisz przybliżone km.", driver: "Ten kierowca nie jest już aktywny.", nofirm: "Tylko właściciel może tworzyć kursy.", bad: "Nie udało się zapisać. Spróbuj ponownie." }, parsed: "Uzupełniono z tekstu — sprawdź i zapisz.", parseFail: "Nie wszystko zrozumiałem; uzupełnij brakujące." },
} as const;
export interface NTDriver { id: string; name: string; truckId: string | null }
export interface NTPrefill { from?: string; to?: string; driverId?: string | null; truckId?: string | null; client?: string; tonnes?: number | null; km?: number | null; revenue?: number | null }
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
type SR = { lang: string; interimResults: boolean; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; onend: () => void; onerror: () => void; start(): void; stop(): void };

export function NewTrip({ loc, today, drivers, trucks, prefill, dup, autoOpen }: { loc: Loc; today: string; drivers: NTDriver[]; trucks: { id: string; plate: string }[]; prefill?: NTPrefill; dup?: boolean; autoOpen?: boolean }) {
  const T = L[loc] ?? L.ro, r = useRouter();
  const [open, setOpen] = useState(!!autoOpen), [busy, setBusy] = useState(false), [msg, setMsg] = useState<{ t: string; k: "ok" | "err" | "" }>({ t: "", k: "" });
  const [f, setF] = useState({ from: prefill?.from ?? "", to: prefill?.to ?? "", date: dup ? addDays(today, 1) : today, driverId: prefill?.driverId ?? (drivers.length === 1 ? drivers[0].id : ""), truckId: prefill?.truckId ?? "", km: prefill?.km ? String(prefill.km) : "", kmTouched: !!prefill?.km, client: prefill?.client && prefill.client !== "—" ? prefill.client : "", tonnes: prefill?.tonnes ? String(prefill.tonnes) : "", revenue: prefill?.revenue ? String(prefill.revenue) : "" });
  const [quick, setQuick] = useState(""), [listening, setListening] = useState(false), sr = useRef<SR | null>(null);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  // camionul: din șoferul ales, dacă nu l-a schimbat patronul
  const [truckTouched, setTruckTouched] = useState(!!prefill?.truckId);
  useEffect(() => { if (truckTouched) return; const d = drivers.find((x) => x.id === f.driverId); set({ truckId: d?.truckId ?? (trucks.length === 1 ? trucks[0].id : "") }); }, [f.driverId]); // eslint-disable-line react-hooks/exhaustive-deps
  const est = useMemo(() => (f.from && f.to ? estimateKm(f.from, f.to) : null), [f.from, f.to]);
  useEffect(() => { if (!f.kmTouched) set({ km: est ? String(est) : "" }); }, [est]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); }; addEventListener("keydown", k); document.documentElement.style.overflow = "hidden"; return () => { removeEventListener("keydown", k); document.documentElement.style.overflow = ""; }; }, [open]);
  const canMic = typeof window !== "undefined" && !!((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);

  async function parse(text: string) {
    if (!text.trim()) return;
    setBusy(true);
    const j = await fetch("/api/trips/parse", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) }).then((x) => x.json()).catch(() => null) as (NTPrefill & { date?: string; km?: number | null }) | null;
    setBusy(false);
    if (!j) { setMsg({ t: T.e.bad, k: "err" }); return; }
    set({ ...(j.from ? { from: j.from } : {}), ...(j.to ? { to: j.to } : {}), ...(j.date ? { date: j.date } : {}), ...(j.driverId ? { driverId: j.driverId } : {}), ...(j.client ? { client: j.client } : {}), ...(j.tonnes ? { tonnes: String(j.tonnes) } : {}), ...(j.km ? { km: String(j.km), kmTouched: false } : {}) });
    if (j.driverId) setTruckTouched(false);
    setMsg({ t: j.from && j.to ? T.parsed : T.parseFail, k: j.from && j.to ? "ok" : "err" });
  }
  function mic() {
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const C = W.SpeechRecognition ?? W.webkitSpeechRecognition; if (!C) return;
    if (listening) { sr.current?.stop(); return; }
    const s = new C(); sr.current = s; s.lang = loc === "en" ? "en-GB" : loc === "pl" ? "pl-PL" : "ro-RO"; s.interimResults = false;
    s.onresult = (e) => { const tx = e.results[0][0].transcript; setQuick(tx); void parse(tx); };
    s.onend = () => setListening(false); s.onerror = () => setListening(false);
    setListening(true); s.start();
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy) return;
    if (!f.from.trim() || !f.to.trim()) { setMsg({ t: T.e.route, k: "err" }); return; }
    if (!f.truckId && !f.driverId) { setMsg({ t: T.e.truck, k: "err" }); return; }
    if (!f.km) { setMsg({ t: T.e.km, k: "err" }); return; }
    setBusy(true);
    const res = await fetch("/api/trips/new", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, driverId: f.driverId || null }) }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) { setMsg({ t: (T.e as Record<string, string>)[j.error as string] ?? T.e.bad, k: "err" }); return; }
    setMsg({ t: T.ok, k: "ok" }); setOpen(false); r.refresh();
    if (dup) r.push(`/trips/${j.id}`);
  }
  const dateChips: [string, string][] = [[T.today, today], [T.tmr, addDays(today, 1)], [T.day2, addDays(today, 2)]];
  return (
    <>
      <button type="button" className={`btn ${dup ? "sec sm" : "pri"} ntbtn`} onClick={() => { setMsg({ t: "", k: "" }); setOpen(true); }}>{dup ? T.dup : T.btn}</button>
      {msg.k === "ok" && !open ? <p className="msg ok nt-ok" role="status">{msg.t}</p> : null}
      {open ? (
        <div className="msheet-bg any" onClick={() => setOpen(false)}>
          <form className="msheet ntsheet" role="dialog" aria-modal="true" aria-labelledby="nt-t" onClick={(e) => e.stopPropagation()} onSubmit={save} noValidate>
            <div className="msheet-grab" />
            <h3 id="nt-t">{dup ? T.dup : T.title}</h3>
            <div className="ntquick">
              <label className="lf"><span>{T.quick}</span><input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder={T.quickPh} enterKeyHint="go" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void parse(quick); } }} /></label>
              <div className="ntqbtns">{canMic ? <button type="button" className={`btn sec sm${listening ? " on" : ""}`} onClick={mic} aria-pressed={listening}>🎙 {T.mic}</button> : null}<button type="button" className="btn sec sm" disabled={busy || !quick.trim()} onClick={() => parse(quick)}>✨ {T.fill}</button></div>
            </div>
            <div className="nt2">
              <label className="lf"><span>{T.from}</span><input value={f.from} onChange={(e) => set({ from: e.target.value })} required maxLength={60} autoComplete="off" placeholder="Salonta" /></label>
              <label className="lf"><span>{T.to}</span><input value={f.to} onChange={(e) => set({ to: e.target.value })} required maxLength={60} autoComplete="off" placeholder="Timișoara" /></label>
            </div>
            <div className="lf"><span>{T.when}</span><div className="ntchips">{dateChips.map(([l, d]) => <button key={d} type="button" className={`chip${f.date === d ? " on" : ""}`} onClick={() => set({ date: d })} aria-pressed={f.date === d}>{l}</button>)}<input type="date" value={f.date} min={today} onChange={(e) => set({ date: e.target.value })} aria-label={T.when} /></div></div>
            <div className="lf"><span>{T.driver}</span><div className="ntchips">{drivers.map((d) => <button key={d.id} type="button" className={`chip${f.driverId === d.id ? " on" : ""}`} onClick={() => { setTruckTouched(false); set({ driverId: d.id }); }} aria-pressed={f.driverId === d.id}>{d.name}</button>)}<button type="button" className={`chip${!f.driverId ? " on" : ""}`} onClick={() => set({ driverId: "" })}>{T.noDriver}</button></div></div>
            <div className="nt2">
              <label className="lf"><span>{T.truck}{f.truckId && !truckTouched && drivers.find((x) => x.id === f.driverId)?.truckId === f.truckId ? <small> · {T.auto}</small> : null}</span><select value={f.truckId} onChange={(e) => { setTruckTouched(true); set({ truckId: e.target.value }); }}><option value="">—</option>{trucks.map((t) => <option key={t.id} value={t.id}>{t.plate}</option>)}</select></label>
              <label className="lf"><span>{T.km}</span><input inputMode="numeric" value={f.km} onChange={(e) => set({ km: e.target.value.replace(/[^\d]/g, ""), kmTouched: true })} placeholder={est ? String(est) : "—"} /></label>
            </div>
            {f.from && f.to && !est && !f.km ? <p className="hint">{T.kmNeed}</p> : null}
            <details className="ntmore" open={!!(f.client || f.tonnes || f.revenue)}><summary>{T.more}</summary>
              <label className="lf"><span>{T.client}</span><input value={f.client} onChange={(e) => set({ client: e.target.value })} maxLength={120} /></label>
              <div className="nt2"><label className="lf"><span>{T.tonnes}</span><input inputMode="decimal" value={f.tonnes} onChange={(e) => set({ tonnes: e.target.value })} /></label><label className="lf"><span>{T.revenue}</span><input inputMode="decimal" value={f.revenue} onChange={(e) => set({ revenue: e.target.value })} /></label></div>
            </details>
            {msg.t && open ? <p className={`msg ${msg.k}`} role={msg.k === "err" ? "alert" : "status"}>{msg.t}</p> : null}
            <button className="btn pri ntsave" disabled={busy} aria-busy={busy}>{busy ? T.saving : T.save}</button>
            <button type="button" className="btn sec ntsave" onClick={() => setOpen(false)}>{T.cancel}</button>
          </form>
        </div>
      ) : null}
    </>
  );
}

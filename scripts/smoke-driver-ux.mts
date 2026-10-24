// r23: ecranele șoferului — checklist per cursă, secțiuni Acum/Următoarele/Terminate, acte lipsă, randare RO/EN/PL fără date străine.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { tripChecklist, driverSections, missingDocs } from "../src/lib/driver-checklist";
import { DriverTrips } from "../src/components/DriverTrips";
import { DriverApp } from "../src/components/DriverApp";
import type { DriverTripSummary } from "../src/lib/driver-trips";
(globalThis as any).React = React;
const render = (node: React.ReactNode) => renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} } as any }, node));
const today = "2026-10-24";
const base: DriverTripSummary = { id: "x", truckId: "t1", client: "Client QA", title: "Oradea → Viena", date: today, planned: true, loadedAt: null, deliveredAt: null, cancelledAt: null, cancelReason: null, podReceived: false, waitSince: null };
const T = (id: string, p: Partial<DriverTripSummary>) => ({ ...base, id, ...p });
const st = (t: DriverTripSummary, docs = { cmr: 0, pod: 0 }) => Object.fromEntries(tripChecklist(t, docs, today).map(c => [c.key, c.state]));

// checklist
assert.deepEqual(st(T("a", {})), { start: "todo", cmr: "todo", delivery: "later", pod: "later" });
assert.deepEqual(st(T("a", { date: "2026-10-30" })), { start: "later", cmr: "later", delivery: "later", pod: "later" });
assert.deepEqual(st(T("a", { loadedAt: `${today}T06:00:00Z` })), { start: "done", cmr: "missing", delivery: "todo", pod: "later" });
assert.deepEqual(st(T("a", { loadedAt: `${today}T06:00:00Z` }), { cmr: 1, pod: 0 }), { start: "done", cmr: "done", delivery: "todo", pod: "later" });
assert.deepEqual(st(T("a", { loadedAt: "x", deliveredAt: `${today}T12:00:00Z` }), { cmr: 1, pod: 0 }), { start: "done", cmr: "done", delivery: "done", pod: "missing" });
assert.deepEqual(st(T("a", { loadedAt: "x", deliveredAt: "y", podReceived: true })), { start: "done", delivery: "done", pod: "done" }, "POD primit → nu mai cerem CMR");
assert.deepEqual(st(T("a", { date: "2026-10-20" })), { start: "missing", cmr: "todo", delivery: "later", pod: "later" });
assert.deepEqual(tripChecklist(T("a", { cancelledAt: "z" }), undefined, today), []);
assert.ok(!Object.values(st(T("a", { planned: false }))).includes("missing"), "cursă închisă de patron: nimic roșu");

// secțiuni
const trips = [
  T("now", { loadedAt: `${today}T06:00:00Z` }),
  T("ready", { date: today }),
  T("future", { date: "2026-11-02", title: "Cluj → Berlin" }),
  T("pod", { date: "2026-10-22", loadedAt: "a", deliveredAt: "b" }),
  T("done", { date: "2026-10-10", loadedAt: "a", deliveredAt: "b", podReceived: true }),
  T("old", { date: "2026-09-01", loadedAt: "a", deliveredAt: "b", podReceived: true, title: "Vechi → Foarte" }),
  T("oldpod", { date: "2026-08-01", loadedAt: "a", deliveredAt: "b", title: "POD vechi → Lipsă" }),
  T("canc", { date: "2026-10-21", cancelledAt: "c", cancelReason: "Client a anulat" }),
];
const s = driverSections(trips, today);
assert.deepEqual(s.now.map(x => x.id), ["now", "ready"]);
assert.deepEqual(s.next.map(x => x.id), ["future"], "cursele viitoare sunt vizibile");
assert.ok(s.done.some(x => x.id === "done") && s.done.some(x => x.id === "pod") && !s.done.some(x => x.id === "old"), "terminate = 30 zile");
assert.ok(s.done.some(x => x.id === "oldpod"), "fără POD rămâne vizibilă până se trimite");
assert.deepEqual(s.cancelled.map(x => x.id), ["canc"]);
const miss = missingDocs(trips, { pod: { cmr: 1, pod: 0 } }, today);
assert.deepEqual(miss.map(m => `${m.tripId}:${m.key}`), ["now:cmr", "pod:pod", "oldpod:cmr", "oldpod:pod"]);

// randare: secțiuni + acțiuni cu o atingere, cu ancoră spre camera actului
const props = { trips, today, truckId: "t1", trucks: [{ id: "t1", name: "BH 21 QRT" }], docs: { pod: { cmr: 1, pod: 0 } } };
const ro = render(React.createElement(DriverTrips, { ...props, loc: "ro" }));
for (const txt of ["Acum", "Următoarele", "Terminate · 30 zile", "Berlin", "Continuă cursa", "Fotografiază CMR", "Trimite POD", "CMR semnat", "Anulate"]) assert.ok(ro.includes(txt), `RO: ${txt}`);
assert.ok(!ro.includes("Foarte"), "cursa terminată de peste 30 zile nu apare");
assert.match(ro, /href="\/driver\/trips\/pod#pw-pod"/);
assert.match(ro, /href="\/driver\/trips\/now#pw-cmr"/);
assert.ok(!/<a\s[^>]*>(?:(?!<\/a>).)*<a /s.test(ro), "fără linkuri imbricate");
const en = render(React.createElement(DriverTrips, { ...props, loc: "en" })), pl = render(React.createElement(DriverTrips, { ...props, loc: "pl" }));
for (const txt of ["Now", "Upcoming", "Finished · 30 days", "Send POD"]) assert.ok(en.includes(txt), `EN: ${txt}`);
for (const txt of ["Teraz", "Nadchodzące", "Zakończone · 30 dni", "Wyślij POD"]) assert.ok(pl.includes(txt), `PL: ${txt}`);
const home = render(React.createElement(DriverTrips, { ...props, loc: "ro", variant: "home", embedded: true, demo: true }));
assert.ok(home.includes("Continuă cursa") && !home.includes("Următoarele"), "Acasă: doar cursa de acum");
assert.match(home, /href="\/driver\?v=t1&amp;trip=now#pw-cmr"/);

// tura (r24): Start/Stop + Privat într-o bară fixă deasupra meniului de jos, nu în card (fără scroll)
const shift = { vehicleId: "t1", vehicleName: "BH 21 QRT", hello: "Salut", labels: { "drv.start": "Pornește tura", "drv.stop": "Termină tura", "drv.checkNeeded": "Bifează verificarea" }, lastFill: "—", loc: "ro" as const, serverNow: Date.now(), hasWork: true };
const bar = (html: string) => html.match(/<div class="dsb s-(\w+)"[\s\S]*?<\/button><\/div>/)?.[0] ?? "";
const off = render(React.createElement(DriverApp, shift)), offBar = bar(off);
assert.ok(offBar.startsWith('<div class="dsb s-off"'), "Acasă: bara de tură există");
assert.match(offBar, /class="dsb-go"/); assert.ok(offBar.includes("Pornește tura") && offBar.includes("Verificare 0/4"), "Start + progresul verificării");
assert.match(offBar, /class="dsb-priv"[^>]*disabled=""/); assert.match(offBar, /aria-pressed="false"/);
assert.ok(!/<section[^>]*drv-shift[\s\S]*?<\/section>/.exec(off)![0].includes("<button"), "cardul de tură nu mai dublează butoanele");
assert.ok(off.includes('id="drv-check"') && off.includes("În afara turei nu se trimite nicio poziție."));
const t0 = new Date(Date.now() - (2 * 60 + 14) * 60000 - 5000).toISOString();
const on = render(React.createElement(DriverApp, { ...shift, initial: { start: t0, priv: false } })), onBar = bar(on);
assert.match(onBar, /class="dsb-go stop"/); assert.ok(onBar.includes("Termină tura") && onBar.includes("În tură 2h 14m"), onBar);
assert.ok(!/class="dsb-priv"[^>]*disabled/.test(onBar), "Privat activ într-o atingere în tură"); assert.ok(on.includes("Patronul vede camionul pe hartă"));
const priv = render(React.createElement(DriverApp, { ...shift, initial: { start: t0, priv: true } })), privBar = bar(priv);
assert.match(privBar, /class="dsb s-priv"/); assert.match(privBar, /dsb-priv on/); assert.match(privBar, /aria-pressed="true"/); assert.ok(privBar.includes("Privat: pornit") && privBar.includes("fără poziție"));
// celelalte taburi: aceeași bară, pornirea trece prin verificarea de pe Acasă
const { ShiftBar } = await import("../src/components/DriverShiftBar");
for (const [loc, start, chk] of [["en", "Start shift", "On shift 2h 14m"], ["pl", "Zacznij zmianę", "Na zmianie 2h 14m"]] as const) {
  const h = render(React.createElement(ShiftBar, { state: "on", start: t0, now: Date.now(), loc, startLabel: start, stopLabel: "x", offSub: "", onGo() {}, onPriv() {} }));
  assert.ok(h.includes(chk), `${loc}: ${h}`);
}
const { RemoteShiftBar } = await import("../src/components/DriverShiftBar");
const rl = { start: "Pornește tura", stop: "Termină tura" };
const rOff = render(React.createElement(RemoteShiftBar, { vehicleId: "t1", plate: "B 101 QAA", initial: null, serverNow: Date.now(), loc: "ro", labels: rl }));
assert.ok(rOff.includes("Întâi verificarea") && /class="dsb-priv"[^>]*disabled=""/.test(rOff), rOff);
const rPriv = render(React.createElement(RemoteShiftBar, { vehicleId: "t1", plate: "B 101 QAA", initial: { start: t0, priv: true }, serverNow: Date.now(), loc: "ro", labels: rl }));
assert.ok(rPriv.includes("dsb s-priv") && rPriv.includes("Termină tura"));
const remote = await readFile("src/components/DriverShiftBar.tsx", "utf8");
assert.ok(remote.includes('"/driver?check=1"') && remote.includes("setAsk(true)") && remote.includes('<ShiftConfirm kind="stop"'), "Start → verificarea pe Acasă, Stop → confirmare");
// r25: confirmare și la pornire (după verificare), clară și la oprire; camionul apare în întrebare; RO/EN/PL
const { ShiftConfirm } = await import("../src/components/DriverShiftBar");
const conf = (kind: "start" | "stop", loc: "ro" | "en" | "pl") => render(React.createElement(ShiftConfirm, { kind, plate: "B 101 QAA", start: kind === "stop" ? t0 : null, now: Date.now(), loc, dialogRef: { current: null }, onYes() {}, onNo() {} }));
for (const [loc, q, yes, no, meta] of [
  ["ro", "Pornești tura acum?", "Da, pornește tura", "Anulează", "Verificare făcută ✓"], ["en", "Start your shift now?", "Yes, start shift", "Cancel", "Check done ✓"], ["pl", "Zacząć zmianę teraz?", "Tak, zacznij zmianę", "Anuluj", "Kontrola gotowa ✓"]] as const) {
  const h = conf("start", loc); assert.ok(h.includes(q) && h.includes(yes) && h.includes(no) && h.includes(meta) && h.includes("B 101 QAA"), `${loc} start: ${h}`);
  assert.match(h, /class="btn pri go"/); assert.match(h, /aria-labelledby="shq-start"/);
}
for (const [loc, q, yes, dur] of [["ro", "Termini tura acum?", "Da, termină tura", "În tură de 2h 14m"], ["en", "End your shift now?", "Yes, end shift", "On shift for 2h 14m"], ["pl", "Zakończyć zmianę teraz?", "Tak, zakończ zmianę", "Na zmianie od 2h 14m"]] as const) {
  const h = conf("stop", loc); assert.ok(h.includes(q) && h.includes(yes) && h.includes(dur) && h.includes("B 101 QAA"), `${loc} stop: ${h}`); assert.match(h, /class="btn pri danger"/);
}
const app = await readFile("src/components/DriverApp.tsx", "utf8");
assert.match(app, /if \(checks\.length < 3\) \{ showCheck\(\); return; \}\s*setAsk\("start"\)/, "confirmarea de pornire vine abia după verificare");
assert.match(app, /if \(on\) \{ setAsk\("stop"\); return; \}/);
for (const p of ["src/app/driver/trips/(list)/page.tsx", "src/app/driver/docs/page.tsx", "src/app/driver/profile/page.tsx", "src/app/driver/trips/[id]/page.tsx"]) assert.ok((await readFile(p, "utf8")).includes("<DriverShiftDock />"), `bara de tură pe ${p}`);
console.log("PASS driver UX: checklist states, Acum/Următoarele/Terminate (30 zile), acte lipsă cu acțiune foto, RO/EN/PL, bara fixă Start/Stop + Privat pe toate taburile, confirmare la pornire și oprire");

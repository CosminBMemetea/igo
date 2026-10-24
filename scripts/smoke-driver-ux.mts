// r23: ecranele șoferului — checklist per cursă, secțiuni Acum/Următoarele/Terminate, acte lipsă, randare RO/EN/PL fără date străine.
import assert from "node:assert/strict";
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

// tura: Start/Stop mare + Privat lângă el + o frază despre ce vede patronul
const shift = { vehicleId: "t1", vehicleName: "BH 21 QRT", hello: "Salut", labels: { "drv.start": "Pornește tura", "drv.stop": "Termină tura", "priv.resume": "Reiau tura" }, lastFill: "—", loc: "ro" as const, serverNow: Date.now(), hasWork: true };
const off = render(React.createElement(DriverApp, shift));
assert.match(off, /class="drv-go"/); assert.match(off, /class="drv-priv"[^>]*disabled=""/); assert.ok(off.includes("În afara turei nu se trimite nicio poziție."));
const on = render(React.createElement(DriverApp, { ...shift, initial: { start: new Date().toISOString(), priv: false } }));
assert.match(on, /class="drv-go stop"/); assert.ok(on.includes("Patronul vede camionul pe hartă"));
assert.ok(!/class="drv-priv"[^>]*disabled/.test(on), "Privat activ într-o atingere în tură");
const priv = render(React.createElement(DriverApp, { ...shift, initial: { start: new Date().toISOString(), priv: true } }));
assert.match(priv, /drv-priv on/); assert.ok(priv.includes("Reiau tura") && priv.includes("fără poziție"));
console.log("PASS driver UX: checklist states, Acum/Următoarele/Terminate (30 zile), acte lipsă cu acțiune foto, RO/EN/PL, Start/Stop + Privat");

import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DriverApp } from "../src/components/DriverApp";
import { DriverTrips } from "../src/components/DriverTrips";
import { TripPaperwork } from "../src/components/TripPaperwork";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
(globalThis as any).React = React;
const render = (node: React.ReactNode) => renderToStaticMarkup(React.createElement(AppRouterContext.Provider, {value: {refresh(){},push(){},replace(){},back(){},forward(){},prefetch(){}} as any}, node));
const shiftProps = {vehicleId:"truck",vehicleName:"BH QA",hello:"Salut",labels:{"drv.start":"Pornește tura","drv.stop":"Termină tura"},lastFill:"—",loc:"ro" as const,serverNow:Date.now()};
const noWork = render(React.createElement(DriverApp, {...shiftProps,hasWork:false}));
// r24: butonul stă mereu în bara fixă, dar fără cursă/telefon neverificat e blocat (aria-disabled) și explică motivul
const blockedGo = /class="dsb-go blocked"[^>]*aria-disabled="true"/;
assert.match(noWork, blockedGo); assert.equal(noWork.includes("Nicio cursă de pornit"),true); assert.equal(noWork.includes("Lucrez fără cursă alocată"),true);
const ready = render(React.createElement(DriverApp, {...shiftProps,hasWork:true}));
assert.equal(ready.includes("Pornește tura"),true); assert.doesNotMatch(ready, blockedGo);
const restoring = render(React.createElement(DriverApp, {...shiftProps,hasWork:true,queueScope:"qa-driver"}));
assert.match(restoring, blockedGo);assert.equal(restoring.includes("Verificăm operațiunile"),true);
const active = render(React.createElement(DriverApp, {...shiftProps,hasWork:false,initial:{start:new Date().toISOString(),priv:false}}));
assert.equal(active.includes("Pornește tura"),false);assert.equal(active.includes("Termină tura"),true);assert.doesNotMatch(active, blockedGo);
const trip = {id:"trip",truckId:"truck",title:"Oradea → Viena",date:"2026-10-19",client:"QA",planned:true,loadedAt:"2026-10-19T08:00:00Z"};
const tripsProps = {today:"2026-10-19",truckId:"truck",trucks:[{id:"truck",name:"BH QA"}],loc:"ro" as const};
for (const trips of [[], [{...trip,truckId:"other"}], [{...trip,deliveredAt:"2026-10-19T09:00:00Z"}], [{...trip,cancelledAt:"2026-10-19T09:00:00Z"}], [{...trip,loadedAt:null,date:"2026-10-20"}]]) {
  assert.equal(render(React.createElement(DriverTrips,{...tripsProps,trips})).includes("Continuă cursa"),false);
}
assert.equal(render(React.createElement(DriverTrips,{...tripsProps,trips:[trip]})).includes("Continuă cursa"),true);
assert.equal(render(React.createElement(DriverTrips,{...tripsProps,trips:[trip],queueScope:"qa-driver"})).includes("Continuă cursa"),false);
const paperwork={tripId:"trip",title:"QA",demo:false,onShift:true,serverNow:Date.now(),loc:"ro",initial:{loadedAt:null,unloadedAt:null,waitMin:0,waitSince:null,files:[]},L:{"pw.loaded":"Am încărcat","pw.unloaded":"Am descărcat","pw.wStart":"Pornește așteptarea","pw.cmr":"CMR"}};
const pendingPaperwork = render(React.createElement(TripPaperwork,{...paperwork,queueScope:"qa-driver"}));
assert.match(pendingPaperwork, /Verificăm operațiunile/);
assert.match(pendingPaperwork, /disabled=""><b>Am încărcat/);
const future = render(React.createElement(TripPaperwork,{...paperwork,canRecordEvents:false}));
assert.equal(future.includes("Am încărcat"),false);assert.equal(future.includes("Pornește așteptarea"),false);assert.equal(future.includes("CMR"),true);
console.log("PASS rendered driver UI: no start for empty/future/delivered/cancelled/other truck; shift remains distinct; future trip allows documents but no lifecycle controls");

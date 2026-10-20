import assert from "node:assert/strict";
import { parseCompliance, roadRegime, vehicleCompliance, currentDocument, documentState } from "../src/lib/compliance";
import { previewProfiles, csv, parseCsv, PROFILE_HEADERS } from "../src/lib/compliance-csv";
import { docStatus } from "../src/lib/docs";
import { reminderDocuments } from "../src/lib/compliance-reminders";
import { runReminders } from "../src/lib/reminders";
import { MemStore } from "../src/lib/store/mem";
import { businessAlerts } from "../src/lib/repo";
import { VEHICLES, type Doc } from "../src/lib/fleet/seed";
import type { Store } from "../src/lib/store/types";
const day = "2026-10-18";
let checks = 0;
function check(name: string, test: () => void) { test(); checks++; console.log(`PASS ${name}`); }
const profile = parseCompliance({category:"N3",mtmaKg:"18000",seats:"2",euro:"6",propulsion:"diesel",country:"RO"})!;
check("freight > 3.5t uses TollRo; 3.5t itself uses vignette", () => { assert.equal(roadRegime(profile), "tollro"); assert.equal(roadRegime({...profile,category:"N1", mtmaKg:3500}), "vignette"); });
check("buses remain vignette; display kind and EURO cannot imply regime", () => { assert.equal(roadRegime({...profile,category:"M3",seats:45}),"vignette"); assert.equal(roadRegime(null),"unknown"); assert.equal(roadRegime({...profile,category:null}),"unknown"); });
check("contradictory category / mass / seats rejected", () => { assert.equal(parseCompliance({...profile,category:"N1"}),null); assert.equal(parseCompliance({...profile,category:"N2",mtmaKg:3500}),null); assert.equal(parseCompliance({...profile,category:"M1",seats:12}),null); assert.equal(parseCompliance({...profile,mtmaKg:3.5}),null); });
check("electric is propulsion, not EURO; unknown stays unknown", () => { assert.ok(parseCompliance({...profile,propulsion:"electric",euro:null})); assert.equal(parseCompliance({...profile,euro:"electric"}),null); assert.equal(roadRegime(parseCompliance({})),"unknown"); });
check("missing documents and unknown classification never green", () => { const items=vehicleCompliance(null,[],day); assert.equal(items.filter(i=>i.state==="missing").length,2); assert.ok(items.some(i=>i.type==="classification")); });
check("old vignette never satisfies TollRo", () => { const items=vehicleCompliance(profile,[{id:"v",type:"vignette",expires:"2027-01-01"}],day); assert.equal(items.find(i=>i.type==="vignette")?.state,"not-applicable"); assert.equal(items.find(i=>i.type==="tollro")?.state,"unknown"); });
const docs=[{id:"old",type:"rca",expires:"2026-10-20"},{id:"new",type:"rca",validFrom:"2026-10-21",expires:"2027-10-20"}];
check("future renewal does not hide active expiry; gap is not valid",()=>{assert.equal(currentDocument(docs,day)?.id,"old");assert.equal(documentState(currentDocument(docs,"2026-10-21"),"2026-10-21"),"valid");assert.equal(documentState(currentDocument([docs[1]],day),day),"future");});
check("invalid dates fail closed; expiry day inclusive and DST stable",()=>{assert.equal(docStatus("2026-02-30",day).status,"unknown");assert.equal(docStatus("garbage",day).status,"unknown");assert.equal(documentState({id:"x",type:"itp",expires:day},day),"urgent");assert.equal(docStatus("2026-10-27","2026-10-24").days,3);});
check("CSV quoting and formula escaping",()=>{assert.deepEqual(parseCsv(csv([["plate","note"],["BH 21 QRT",'a,"b"\nc']])),[["plate","note"],["BH 21 QRT",'a,"b"\nc']]);assert.ok(csv([["=HYPERLINK(1)"]]).includes("'=HYPERLINK"));assert.throws(()=>parseCsv('"not closed'));});
check("dashboard alerts agree with renewals, TollRo, archived vehicles and local date",()=>{
  const vehicle={...VEHICLES[0],compliance:profile}, doc=(id:string,type:Doc["type"],expires:string):Doc=>({id,scope:"vehicle",ownerId:vehicle.id,type,expires});
  const records=[doc("old","rca","2026-10-17"),doc("new","rca","2027-10-17"),doc("v","vignette","2026-10-17"),doc("itp","itp","2026-10-18")];
  const alerts=businessAlerts([vehicle],[],records,Date.parse("2026-10-17T22:30:00Z"));
  assert.deepEqual(alerts.map(a=>a.id),["doc-itp"]);assert.equal(alerts[0].params.days,0);
  assert.equal(businessAlerts([{...vehicle,archived:true}],[],records).length,0);
});

async function storeChecks(s: Store) {
  const a=await s.createFirm({name:"Compliance QA",cui:null}), b=await s.createFirm({name:"Other QA",cui:null});
  try {
    const truck=await s.addTruck(a.id,{plate:"BH 21 QRT",vin:null,model:null,tankL:600,normalL100:30,compliance:profile});
    const second=await s.addTruck(a.id,{plate:"BH 22 QRT",vin:null,model:null,tankL:600,normalL100:30});
    const driver=await s.createUser({firmId:a.id,role:"driver",name:"Driver",email:null,phone:null,passwordHash:"test"});
    await s.createUser({firmId:a.id,role:"owner",name:"Owner",email:`qa-${a.id}@example.invalid`,phone:null,passwordHash:"test"});
    await s.setUserTruck(a.id,driver.id,truck.id);
    const old=await s.addDoc(a.id,{truckId:truck.id,type:"rca",expires:"2026-10-20"});
    const future=await s.addDoc(a.id,{truckId:truck.id,type:"rca",validFrom:"2026-10-21",expires:"2027-10-20"});
    assert.equal(reminderDocuments(await s.docs(a.id),await s.trucks(a.id),await s.users(a.id),day)[0]?.id,old.id);
    const one=await runReminders(s,day,null), two=await runReminders(s,day,null);
    assert.equal(one.notifications,2);assert.equal(two.notifications,0);assert.equal(one.emails.queued,1);assert.equal(two.emails.queued,0);
    assert.equal((await runReminders(s,"2026-10-21",null)).notifications,0);
    assert.equal(reminderDocuments(await s.docs(a.id),await s.trucks(a.id),await s.users(a.id),"2026-10-21")[0]?.id,future.id);
    checks++;console.log("PASS reminders deduplicate and suppress superseded policy, not future renewal");
    const text=csv([Array.from(PROFILE_HEADERS),[truck.plate,"N3",18000,2,5,"diesel","RO"],[second.plate,"N1",3500,3,6,"diesel","RO"]]);
    const preview=previewProfiles(text,await s.trucks(a.id));assert.equal(preview.errors.length,0);
    assert.equal(await s.updateComplianceBatch(b.id,preview.changes),false);
    assert.equal(await s.updateComplianceBatch(a.id,preview.changes),true);
    assert.equal(await s.updateComplianceBatch(a.id,preview.changes),false);
    assert.equal((await s.trucks(a.id)).find(t=>t.id===truck.id)?.compliance?.euro,"5");
    const fresh=previewProfiles(text,await s.trucks(a.id));fresh.changes[0].next.euro="4";fresh.changes[1].previous=null;
    assert.equal(await s.updateComplianceBatch(a.id,fresh.changes),false);
    assert.equal((await s.trucks(a.id)).find(t=>t.id===truck.id)?.compliance?.euro,"5");
    assert.equal(previewProfiles(csv([Array.from(PROFILE_HEADERS),["XX1234","N3",18000,2,6,"diesel","RO"]]),await s.trucks(a.id)).errors.length,1);
    checks++;console.log("PASS CSV import tenant isolation, stale preview and all-or-nothing update");
    const raceA=previewProfiles(text,await s.trucks(a.id)),raceB=previewProfiles(text,await s.trucks(a.id));
    raceA.changes[0].next.euro="3";raceB.changes[0].next.euro="2";
    const results=await Promise.all([s.updateComplianceBatch(a.id,raceA.changes),s.updateComplianceBatch(a.id,raceB.changes)]);
    assert.equal(results.filter(Boolean).length,1);
    checks++;console.log("PASS simultaneous conflicting imports accept exactly one snapshot");
    assert.equal(await s.addComplianceTask(b.id,{truckId:truck.id,driverId:driver.id,type:"rca",due:day}),null);
    const concurrent=await Promise.all([0,1].map(()=>s.addComplianceTask(a.id,{truckId:truck.id,driverId:driver.id,type:"rca",due:day})));
    const task=concurrent[0];assert.ok(task);assert.equal(concurrent[1]?.id,task.id);
    assert.equal((await s.addComplianceTask(a.id,{truckId:truck.id,driverId:driver.id,type:"rca",due:day}))?.id,task.id);
    assert.equal(await s.updateComplianceTask(b.id,task.id,"done"),false);
    assert.equal(await s.updateComplianceTask(a.id,task.id,"done",driver.id),false);
    assert.equal(await s.updateComplianceTask(a.id,task.id,"acknowledged",driver.id),true);
    await s.setUserTruck(a.id,driver.id,second.id);
    assert.equal(await s.updateComplianceTask(a.id,task.id,"acknowledged",driver.id),false);
    assert.equal(await s.updateComplianceTask(a.id,task.id,"done"),true);
    assert.equal(await s.updateComplianceTask(a.id,task.id,"acknowledged",driver.id),false);
    checks++;console.log("PASS tasks deduplicate, cannot cross tenants, reassignments revoke access, driver cannot complete");
    await s.updateTruckEcon(a.id,truck.id,{archived:true});
    await s.addDoc(a.id,{truckId:null,userId:driver.id,type:"licence",expires:day});
    await s.setUserDisabled(a.id,driver.id,true);
    assert.equal(reminderDocuments(await s.docs(a.id),await s.trucks(a.id),await s.users(a.id),day).length,0);
    checks++;console.log("PASS archived vehicles and disabled drivers excluded from reminders");
  } finally { await s.deleteFirm(a.id);await s.deleteFirm(b.id); }
}
await storeChecks(new MemStore());
if (process.env.PGLITE_MODULE) {
  const {PGlite}=await import(process.env.PGLITE_MODULE), {drizzle}=await import("drizzle-orm/node-postgres"), {migrate}=await import("drizzle-orm/node-postgres/migrator");
  const schema=await import("../src/db/schema"), {PgStore}=await import("../src/lib/store/pg");
  const pg=new PGlite();
  const adapter={query:async (q: string | {text:string;rowMode?:string}, values:unknown[]) => { const text=typeof q === "string" ? q : q.text; if(!values?.length && text.includes(";")){const all=await pg.exec(text);return all[all.length-1] ?? {rows:[],fields:[]};} /* migrations are multi-statement */ return pg.query(text, values, typeof q === "string" ? {} : {rowMode:q.rowMode as "array"|"object"|undefined}); }};
  const d=drizzle(adapter as never,{schema});
  try {await migrate(d,{migrationsFolder:"drizzle"}); await storeChecks(new PgStore(d));}finally{await pg.close();}
} else if(process.env.TEST_DATABASE_URL){
  const {default:pg}=await import("pg"),{drizzle}=await import("drizzle-orm/node-postgres"),{migrate}=await import("drizzle-orm/node-postgres/migrator");
  const schema=await import("../src/db/schema"),{PgStore}=await import("../src/lib/store/pg");
  const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,max:3});
  try {await migrate(drizzle(pool),{migrationsFolder:"drizzle"});await storeChecks(new PgStore(drizzle(pool,{schema})));}finally{await pool.end();}
}else console.log("SKIP Postgres: TEST_DATABASE_URL unavailable");
console.log(`Compliance: ${checks} groups PASS`);
